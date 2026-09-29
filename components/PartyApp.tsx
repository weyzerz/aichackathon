"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Role, StateResponse } from "@/lib/types";
import { Board } from "./Board";
import { Chat } from "./Chat";
import { EventsList } from "./Events";
import { ActivityFeed, Alerts, MyTasks, WeddingView } from "./Views";
import { btnPrimary } from "./ui";
import { serif } from "./fonts";

type TabId = "board" | "events" | "activity" | "tasks" | "chat" | "area" | "wedding" | "alerts";

const TABS: Record<Role, TabId[]> = {
  couple: ["board", "events", "activity", "wedding", "alerts"],
  // 5 tabs max on a 390px screen: the delegate's wedding overview lives at the bottom of Events.
  delegate: ["tasks", "events", "chat", "area", "alerts"],
  member: ["tasks", "events", "chat", "wedding", "alerts"],
};

const LABEL: Record<TabId, string> = {
  board: "Board",
  events: "Events",
  activity: "Activity",
  tasks: "Tasks",
  chat: "Chat",
  area: "Area",
  wedding: "Wedding",
  alerts: "Alerts",
};

const POLL_MS = 2000;
const TICK_MS = 15000;

const GLOBAL_CSS = `
@keyframes pl-flash-done {
  0% { background-color: #B9E3A3; box-shadow: 0 0 0 3px #7FBF62; transform: scale(1.02); }
  60% { background-color: #DDF0D2; box-shadow: 0 0 0 2px #A8D492; transform: scale(1); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
@keyframes pl-flash-bad {
  0% { box-shadow: 0 0 0 3px #E08A7A; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
@keyframes pl-dot { 0%, 80%, 100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
@keyframes pl-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
.pl-flash-done { animation: pl-flash-done 2.4s ease-out; }
.pl-flash-bad { animation: pl-flash-bad 1.6s ease-out; }
.pl-dot { animation: pl-dot 1.2s infinite ease-in-out; }
.pl-fade-in { animation: pl-fade-in .4s ease-out; }
`;

function usePartyState(personId: string) {
  const [data, setData] = useState<StateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mySeq = ++seq.current;
    try {
      const res = await fetch(`/api/state?viewer=${encodeURIComponent(personId)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(res.status === 404 ? "Person not found" : `Server error (${res.status})`);
      const json = (await res.json()) as StateResponse;
      if (mySeq !== seq.current) return; // a newer request superseded this one
      setData(json);
      setError(null);
      setNow(Date.now());
    } catch (e) {
      if (mySeq !== seq.current) return;
      setError(e instanceof Error ? e.message : "Couldn't load");
      setNow(Date.now());
    }
  }, [personId]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  return { data, error, now, refresh: load };
}

export default function PartyApp({ personId }: { personId: string }) {
  const { data, error, now, refresh } = usePartyState(personId);
  const [tab, setTab] = useState<TabId | null>(null);
  const role = data?.viewer.role;
  const tabs = role ? TABS[role] : [];
  const active: TabId | null = tab && tabs.includes(tab) ? tab : (tabs[0] ?? null);
  const unread = data?.notifications.filter((n) => !n.read).length ?? 0;

  // Couple view drives follow-ups.
  useEffect(() => {
    if (role !== "couple") return;
    const tick = () => void fetch("/api/tick", { method: "POST" }).catch(() => {});
    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [role]);

  // While Alerts is open, mark anything new as read.
  const marking = useRef(false);
  useEffect(() => {
    if (active !== "alerts" || unread === 0 || marking.current) return;
    marking.current = true;
    fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId }),
    })
      .then(() => refresh())
      .catch(() => {})
      .finally(() => {
        marking.current = false;
      });
  }, [active, unread, personId, refresh]);

  const mainRef = useRef<HTMLElement>(null);
  function go(t: TabId) {
    setTab(t);
    mainRef.current?.scrollTo({ top: 0 });
  }

  let body: ReactNode;
  if (!data) {
    body = error ? (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-[#9A2E1F]">Couldn&apos;t load: {error}</p>
        <p className="text-sm text-[#8A8578]">Retrying every few seconds…</p>
        <button className={btnPrimary} onClick={() => void refresh()}>
          Retry now
        </button>
      </div>
    ) : (
      <p className="py-20 text-center text-[#8A8578]">Loading…</p>
    );
  } else {
    const { viewer, people, areas, tasks, escalations, activity, notifications, thread, wedding } =
      data;
    const ownedAreas = areas.filter((a) => a.owner_id === viewer.id);
    const surprise = new Set(areas.filter((a) => a.is_surprise).map((a) => a.id));
    switch (active) {
      case "board":
        body = (
          <Board
            viewer={viewer}
            people={people}
            areas={areas}
            tasks={tasks.filter((t) => !surprise.has(t.area_id))}
            escalations={escalations}
            assignAreas={areas.filter((a) => !a.is_surprise)}
            now={now}
            onChange={() => void refresh()}
          />
        );
        break;
      case "area": {
        const owned = new Set(ownedAreas.map((a) => a.id));
        body = (
          <Board
            title={ownedAreas.length ? ownedAreas.map((a) => a.name).join(" & ") : "Your areas"}
            viewer={viewer}
            people={people}
            areas={areas}
            tasks={tasks.filter((t) => owned.has(t.area_id))}
            escalations={escalations}
            assignAreas={ownedAreas}
            now={now}
            onChange={() => void refresh()}
          />
        );
        break;
      }
      case "events":
        body = (
          <EventsList
            viewer={viewer}
            people={people}
            areas={areas}
            tasks={tasks}
            now={now}
            onChange={() => void refresh()}
            wedding={TABS[viewer.role].includes("wedding") ? undefined : wedding}
          />
        );
        break;
      case "activity":
        body = <ActivityFeed activity={activity} now={now} />;
        break;
      case "tasks":
        body = <MyTasks viewer={viewer} tasks={tasks} areas={areas} now={now} />;
        break;
      case "chat":
        body = (
          <Chat viewer={viewer} thread={thread} tasks={tasks} now={now} onChange={() => void refresh()} />
        );
        break;
      case "wedding":
        body = <WeddingView wedding={wedding} />;
        break;
      case "alerts":
        body = <Alerts notifications={notifications} now={now} />;
        break;
      default:
        body = null;
    }
  }

  const escalationCount = data?.escalations.length ?? 0;

  return (
    <div
      className="flex h-dvh w-full justify-center bg-[#EFEAE0]"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' }}
    >
      <style>{GLOBAL_CSS}</style>
      <div className="flex h-dvh w-full max-w-[430px] flex-col bg-[#FAF7F0] text-[#2F3A28] shadow-[0_0_40px_rgba(60,50,30,0.08)]">
        <header className="shrink-0 border-b border-[#EDE7DA] bg-[#FAF7F0] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`${serif.className} truncate text-xl font-medium text-[#2F3A28]`}>
                {data?.wedding.name ?? "Party Line"}
              </p>
              <p className="truncate text-sm text-[#6F6A5E]">
                {data ? (
                  <>
                    <span className="font-semibold text-[#5F6F52]">{data.viewer.name}</span>
                    {data.viewer.title ? ` · ${data.viewer.title}` : ""}
                  </>
                ) : (
                  personId
                )}
                {" · "}
                <Link href="/" className="underline decoration-[#CBD3C2] underline-offset-2 hover:text-[#5F6F52]">
                  Switch person
                </Link>
              </p>
            </div>
            <button
              onClick={() => data && go("alerts")}
              aria-label={`Alerts, ${unread} unread`}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#5F6F52] ring-1 ring-[#E3DDD0] transition active:scale-95"
            >
              <BellIcon />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C0503D] px-1 text-[11px] font-bold text-white ring-2 ring-[#FAF7F0]">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
          </div>
          {error && data && (
            <p className="mt-2 rounded-lg bg-[#FBEFC8] px-3 py-1.5 text-xs text-[#7A5A00]">
              Connection hiccup — retrying…
            </p>
          )}
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto px-4 pt-4">
          <div className={active === "chat" ? "flex min-h-full flex-col" : "pb-6"}>{body}</div>
        </main>

        {tabs.length > 0 && (
          <nav className="shrink-0 border-t border-[#EDE7DA] bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
            <ul className="flex">
              {tabs.map((t) => {
                const on = t === active;
                const badge =
                  t === "alerts" ? unread : t === "board" || t === "area" ? escalationCount : 0;
                return (
                  <li key={t} className="flex-1">
                    <button
                      onClick={() => go(t)}
                      aria-current={on ? "page" : undefined}
                      className={`relative flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-semibold transition ${
                        on ? "text-[#5F6F52]" : "text-[#A39E90] hover:text-[#6F6A5E]"
                      }`}
                    >
                      {on && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-[#5F6F52]" />}
                      <span className="relative">
                        <TabIcon tab={t} />
                        {badge > 0 && (
                          <span
                            className={`absolute -right-2 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                              t === "alerts" ? "bg-[#C0503D]" : "bg-[#E08A2E]"
                            }`}
                          />
                        )}
                      </span>
                      {LABEL[t]}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

const ICON_PATHS: Record<TabId, string[]> = {
  events: ["M3 4h18v18H3z", "M16 2v4", "M8 2v4", "M3 10h18"],
  board: ["M3 3h7v9H3z", "M14 3h7v5h-7z", "M14 12h7v9h-7z", "M3 16h7v5H3z"],
  activity: ["M22 12h-4l-3 9L9 3l-3 9H2"],
  tasks: ["M9 11l3 3L22 4", "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],
  chat: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  area: ["M12 2 2 7l10 5 10-5-10-5z", "M2 17l10 5 10-5", "M2 12l10 5 10-5"],
  wedding: ["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z"],
  alerts: ["M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
};

function TabIcon({ tab }: { tab: TabId }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICON_PATHS[tab].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
