"use client";

import { useEffect, useRef, useState } from "react";
import type { Message, Person, PostMessageBody, Task } from "@/lib/types";
import { relativeTime } from "./ui";

interface Pending {
  key: string;
  body: string;
  created_at: string;
  afterCount: number; // thread length when sent
}

export function Chat({
  viewer,
  thread,
  tasks,
  now,
  onChange,
}: {
  viewer: Person;
  thread: Message[];
  tasks: Task[];
  now: number;
  onChange: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [sending, setSending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const taskTitle = new Map(tasks.map((t) => [t.id, t.title]));

  // Drop optimistic messages once the server thread contains them.
  const visiblePending = pending.filter((p) => {
    const later = thread.slice(p.afterCount);
    return !later.some((m) => m.sender === viewer.id && m.body === p.body);
  });

  const count = thread.length + visiblePending.length + (sending > 0 ? 1 : 0);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [count]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    setError(null);
    const p: Pending = {
      key: `${Date.now()}-${Math.random()}`,
      body,
      created_at: new Date().toISOString(),
      afterCount: thread.length,
    };
    setPending((cur) => [...cur, p]);
    setSending((n) => n + 1);
    try {
      const payload: PostMessageBody = { personId: viewer.id, body };
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      onChange();
    } catch {
      setError("Message didn't send. Tap to retry.");
      setPending((cur) => cur.filter((x) => x.key !== p.key));
      setDraft(body);
    } finally {
      setSending((n) => n - 1);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col gap-3 pb-4">
        {thread.length === 0 && visiblePending.length === 0 && (
          <p className="py-10 text-center text-sm text-[#8A8578]">
            Your coordinator will message you here about your tasks.
          </p>
        )}
        {thread.map((m) => (
          <Bubble
            key={m.id}
            mine={m.sender !== "agent"}
            body={m.body}
            tag={m.task_id != null ? taskTitle.get(m.task_id) : undefined}
            time={relativeTime(m.created_at, now)}
          />
        ))}
        {visiblePending.map((p) => (
          <Bubble key={p.key} mine body={p.body} time="sending…" faded />
        ))}
        {sending > 0 && (
          <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm text-[#5F6F52] shadow-sm ring-1 ring-[#EDE7DA]">
            <span className="flex gap-1">
              <span className="pl-dot h-1.5 w-1.5 rounded-full bg-[#8A9A7B]" />
              <span className="pl-dot h-1.5 w-1.5 rounded-full bg-[#8A9A7B] [animation-delay:150ms]" />
              <span className="pl-dot h-1.5 w-1.5 rounded-full bg-[#8A9A7B] [animation-delay:300ms]" />
            </span>
            Coordinator is typing…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={send}
        className="sticky bottom-0 -mx-4 flex items-end gap-2 border-t border-[#EDE7DA] bg-[#FAF7F0]/95 px-4 py-3 backdrop-blur"
      >
        <div className="flex-1">
          {error && <p className="mb-1 text-xs text-[#9A2E1F]">{error}</p>}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Reply to your coordinator…"
            className="w-full rounded-full border border-[#DDD8CD] bg-white px-4 py-3 text-[16px] text-[#2F3A28] outline-none focus:border-[#8A9A7B] focus:ring-2 focus:ring-[#8A9A7B]/30"
          />
        </div>
        <button
          type="submit"
          disabled={!draft.trim()}
          className="h-12 shrink-0 rounded-full bg-[#5F6F52] px-5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function Bubble({
  mine,
  body,
  tag,
  time,
  faded,
}: {
  mine: boolean;
  body: string;
  tag?: string;
  time: string;
  faded?: boolean;
}) {
  return (
    <div className={`flex max-w-[85%] flex-col gap-1 ${mine ? "items-end self-end" : "items-start self-start"}`}>
      {!mine && <span className="px-1 text-xs font-semibold text-[#5F6F52]">Coordinator</span>}
      <div
        className={`whitespace-pre-wrap px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
          mine
            ? "rounded-2xl rounded-br-md bg-[#5F6F52] text-white"
            : "rounded-2xl rounded-bl-md bg-white text-[#2F3A28] ring-1 ring-[#EDE7DA]"
        } ${faded ? "opacity-70" : ""}`}
      >
        {tag && (
          <span
            className={`mb-1 block w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              mine ? "bg-white/20 text-white" : "bg-[#EEF1E9] text-[#5F6F52]"
            }`}
          >
            {tag}
          </span>
        )}
        {body}
      </div>
      <span className="px-1 text-[11px] text-[#A39E90]">{time}</span>
    </div>
  );
}
