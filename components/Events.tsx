"use client";

import { useState } from "react";
import type { Area, Person, Task, Wedding } from "@/lib/types";
import { AssignForm } from "./AssignForm";
import { WeddingView } from "./Views";
import { Card, Empty, Heading, StatusChip, btnPrimary, dueBadge } from "./ui";
import { serif } from "./fonts";

function SecretPill() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F3E6F0] px-2.5 py-1 text-xs font-semibold text-[#7A3E6A] ring-1 ring-[#E4CCDD]">
      🤫 Secret from the couple
    </span>
  );
}

function progress(tasks: Task[]) {
  const done = tasks.filter((t) => t.status === "done").length;
  return { done, total: tasks.length };
}

export function EventsList({
  viewer,
  people,
  areas,
  tasks,
  now,
  onChange,
  wedding,
}: {
  viewer: Person;
  people: Person[];
  areas: Area[];
  tasks: Task[];
  now: number;
  onChange: () => void;
  /** When set, the wedding overview is rendered below the event cards. */
  wedding?: Wedding;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? areas.find((a) => a.id === openId) : undefined;

  if (open) {
    return (
      <EventDetail
        viewer={viewer}
        people={people}
        area={open}
        tasks={tasks.filter((t) => t.area_id === open.id)}
        now={now}
        onChange={onChange}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Heading className="text-2xl">Events</Heading>
        <p className="text-sm text-[#8A8578]">Everything happening on the way to the big day</p>
      </div>
      {areas.length === 0 && <Empty>No events yet.</Empty>}
      {areas.map((a) => {
        const { done, total } = progress(tasks.filter((t) => t.area_id === a.id));
        const sub = [a.date_label, a.location].filter(Boolean).join(" · ");
        return (
          <button
            key={a.id}
            onClick={() => setOpenId(a.id)}
            className="text-left transition active:scale-[0.99]"
          >
            <Card className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <p className={`${serif.className} text-xl font-medium text-[#2F3A28]`}>{a.name}</p>
                <span aria-hidden className="mt-1 text-[#A39E90]">
                  ›
                </span>
              </div>
              {sub && <p className="text-sm text-[#6F6A5E]">{sub}</p>}
              {a.is_surprise && (
                <div>
                  <SecretPill />
                </div>
              )}
              {total > 0 ? (
                <div className="mt-1 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E8E4DA]">
                    <div
                      className="h-full rounded-full bg-[#7FA36A] transition-all duration-700"
                      style={{ width: `${(done / total) * 100}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-[#5F6F52]">
                    {done} of {total} done
                  </span>
                </div>
              ) : (
                <p className="text-xs text-[#8A8578]">No tasks yet</p>
              )}
            </Card>
          </button>
        );
      })}
      {wedding && (
        <div className="mt-4 border-t border-[#EDE7DA] pt-4">
          <WeddingView wedding={wedding} />
        </div>
      )}
    </div>
  );
}

export function EventDetail({
  viewer,
  people,
  area,
  tasks,
  now,
  onChange,
  onBack,
}: {
  viewer: Person;
  people: Person[];
  area: Area;
  tasks: Task[];
  now: number;
  onChange: () => void;
  onBack: () => void;
}) {
  const [assigning, setAssigning] = useState(false);
  const isOwner = viewer.id === area.owner_id;
  const canAssign = isOwner || viewer.role === "couple";
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const personOrder = (id: string) => {
    const i = people.findIndex((p) => p.id === id);
    return i === -1 ? people.length : i;
  };

  // Group by title, keeping first-created order.
  const groups = new Map<string, Task[]>();
  for (const t of [...tasks].sort((a, b) => a.id - b.id)) {
    const list = groups.get(t.title) ?? [];
    list.push(t);
    groups.set(t.title, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => personOrder(a.assignee_id) - personOrder(b.assignee_id));
  }

  const { done, total } = progress(tasks);
  const details = Object.entries(area.details ?? {}).filter(([, v]) => v);

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onBack}
        className="self-start rounded-lg py-1 text-sm font-semibold text-[#5F6F52] hover:underline"
      >
        ← All events
      </button>

      <div className="flex flex-col gap-1.5">
        <h2 className={`${serif.className} text-3xl font-medium leading-tight text-[#2F3A28]`}>
          {area.name}
        </h2>
        {area.date_label && <p className="text-[15px] font-medium text-[#5F6F52]">{area.date_label}</p>}
        {area.location && <p className="text-sm text-[#6F6A5E]">📍 {area.location}</p>}
        {area.is_surprise && (
          <div className="mt-1">
            <SecretPill />
          </div>
        )}
        {area.description && (
          <p className="mt-1 text-[15px] leading-relaxed text-[#5B574E]">{area.description}</p>
        )}
      </div>

      {details.length > 0 && (
        <Card>
          <dl className="flex flex-col divide-y divide-[#F0ECE3]">
            {details.map(([k, v]) => (
              <div key={k} className="py-3 first:pt-0 last:pb-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#8A9A7B]">{k}</dt>
                <dd className="mt-0.5 whitespace-pre-line text-[15px] text-[#2F3A28]">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <div className="flex items-end justify-between gap-3">
        <div>
          <Heading>Tasks</Heading>
          <p className="text-sm text-[#8A8578]">
            {total === 0 ? "Nothing yet" : `${done} of ${total} done`}
          </p>
        </div>
        {canAssign && !assigning && (
          <button className={btnPrimary} onClick={() => setAssigning(true)}>
            + Assign task
          </button>
        )}
      </div>

      {assigning && (
        <AssignForm
          viewer={viewer}
          people={people}
          areas={[area]}
          onCancel={() => setAssigning(false)}
          onDone={() => {
            setAssigning(false);
            onChange();
          }}
        />
      )}

      {groups.size === 0 && !assigning && <Empty>No tasks for this event yet.</Empty>}

      {[...groups.entries()].map(([title, list]) => {
        const responses = list.filter((t) => t.response);
        const showInfo = isOwner && responses.length > 0;
        const allIn = responses.length === list.length;
        const g = progress(list);
        return (
          <Card key={title} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[16px] font-semibold leading-snug text-[#2F3A28]">
                {title}
                {showInfo && (
                  <span className="font-normal text-[#8A8578]">
                    {" "}
                    · {responses.length} of {list.length} in
                  </span>
                )}
              </p>
              {showInfo && allIn ? (
                <span className="shrink-0 rounded-full bg-[#DCEBD3] px-2.5 py-1 text-xs font-semibold text-[#2E5E22] ring-1 ring-[#B9D6A8]">
                  ✓ Everyone&apos;s in
                </span>
              ) : (
                <span className="shrink-0 pt-0.5 text-xs text-[#8A8578]">
                  {g.done}/{g.total} done
                </span>
              )}
            </div>

            {showInfo ? (
              <dl className="flex flex-col divide-y divide-[#F0ECE3] rounded-xl bg-[#FBFAF7] px-3 ring-1 ring-[#F0ECE3]">
                {list.map((t) => (
                  <div key={t.id} className="flex items-start gap-3 py-2.5">
                    <dt className="w-20 shrink-0 text-sm font-semibold text-[#5F6F52]">
                      {name(t.assignee_id)}
                    </dt>
                    <dd
                      className={`min-w-0 flex-1 whitespace-pre-line break-words text-sm ${
                        t.response ? "text-[#2F3A28]" : "italic text-[#A39E90]"
                      }`}
                    >
                      {t.response ?? "Waiting…"}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {list.map((t) => (
                  <CompactRow key={t.id} task={t} name={name(t.assignee_id)} now={now} />
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}

const FLASH_MS = 8000;

function CompactRow({ task, name, now }: { task: Task; name: string; now: number }) {
  const due = dueBadge(task);
  const flash =
    task.status === "done" && now - Date.parse(task.updated_at) < FLASH_MS ? "pl-flash-done" : "";
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-xl bg-[#FBFAF7] px-3 py-2 ${flash}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-[15px] font-medium text-[#2F3A28]">{name}</span>
        {due && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              due.tone === "overdue" ? "bg-[#F6DDD8] text-[#9A2E1F]" : "bg-[#FBEFCF] text-[#8A6212]"
            }`}
          >
            {due.tone === "overdue" ? "⏰ " : ""}
            {due.label}
          </span>
        )}
      </div>
      <StatusChip task={task} />
    </li>
  );
}
