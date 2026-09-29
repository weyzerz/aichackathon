"use client";

import { useState } from "react";
import type { Area, Person, Task } from "@/lib/types";
import { AssignForm } from "./AssignForm";
import { TaskRow } from "./TaskRow";
import { Card, Empty, Heading, btnPrimary, chipKind, dueBadge } from "./ui";

export function Escalations({
  escalations,
  people,
  viewer,
  onChange,
}: {
  escalations: Task[];
  people: Person[];
  viewer: Person;
  onChange: () => void;
}) {
  const [resolving, setResolving] = useState<number | null>(null);
  if (escalations.length === 0) return null;
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? id;

  async function resolve(id: number) {
    setResolving(id);
    try {
      await fetch(`/api/tasks/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ byPersonId: viewer.id }),
      });
      onChange();
    } finally {
      setResolving(null);
    }
  }

  return (
    <Card className="pl-flash-bad border-l-4 border-[#C0503D] bg-[#FFF8F6]">
      <Heading className="mb-3 flex items-center gap-2 text-[#8A2B1C]">
        <span aria-hidden>⚠</span> Escalations
        <span className="rounded-full bg-[#C0503D] px-2 py-0.5 font-sans text-xs font-bold text-white">
          {escalations.length}
        </span>
      </Heading>
      <ul className="flex flex-col gap-3">
        {escalations.map((t) => (
          <li
            key={t.id}
            className="flex items-start justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-[#F0D3CC]"
          >
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[#2F3A28]">
                {name(t.assignee_id)} · {t.title}
              </p>
              <p className="mt-1 text-sm text-[#9A2E1F]">{t.escalation_reason ?? "Needs attention"}</p>
              {t.escalated_to && t.escalated_to !== viewer.id && (
                <p className="mt-1 text-xs text-[#8A8578]">Routed to {name(t.escalated_to)}</p>
              )}
            </div>
            <button
              className={`${btnPrimary} shrink-0`}
              disabled={resolving === t.id}
              onClick={() => resolve(t.id)}
            >
              {resolving === t.id ? "…" : "Resolve"}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function Board({
  viewer,
  people,
  areas,
  tasks,
  escalations,
  assignAreas,
  now,
  onChange,
  title = "Board",
}: {
  viewer: Person;
  people: Person[];
  areas: Area[];
  tasks: Task[];
  escalations: Task[];
  assignAreas: Area[];
  now: number;
  onChange: () => void;
  title?: string;
}) {
  const [assigning, setAssigning] = useState(false);
  const areaById = new Map(areas.map((a) => [a.id, a]));

  // Group by assignee, keeping people order.
  const groups = new Map<string, Task[]>();
  for (const t of [...tasks].sort((a, b) => a.id - b.id)) {
    const list = groups.get(t.assignee_id) ?? [];
    list.push(t);
    groups.set(t.assignee_id, list);
  }
  const order = [
    ...people.map((p) => p.id).filter((id) => groups.has(id)),
    ...[...groups.keys()].filter((id) => !people.some((p) => p.id === id)),
  ];

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const overdue = tasks.filter((t) => dueBadge(t)?.tone === "overdue").length;
  const dueSoon = tasks.filter((t) => dueBadge(t)?.tone === "soon").length;

  return (
    <div className="flex flex-col gap-4">
      <Escalations escalations={escalations} people={people} viewer={viewer} onChange={onChange} />

      <div className="flex items-end justify-between gap-3">
        <div>
          <Heading className="text-2xl">{title}</Heading>
          <p className="text-sm text-[#8A8578]">
            {done} of {total} done
            {overdue > 0 && <span className="font-semibold text-[#9A2E1F]"> · {overdue} overdue</span>}
            {dueSoon > 0 && <span className="font-semibold text-[#8A6212]"> · {dueSoon} due soon</span>}
          </p>
        </div>
        {!assigning && assignAreas.length > 0 && (
          <button className={btnPrimary} onClick={() => setAssigning(true)}>
            + Assign task
          </button>
        )}
      </div>

      {total > 0 && (
        <div className="h-2 overflow-hidden rounded-full bg-[#E8E4DA]">
          <div
            className="h-full rounded-full bg-[#7FA36A] transition-all duration-700"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      )}

      {assigning && (
        <AssignForm
          viewer={viewer}
          people={people}
          areas={assignAreas}
          onCancel={() => setAssigning(false)}
          onDone={() => {
            setAssigning(false);
            onChange();
          }}
        />
      )}

      {order.length === 0 && <Empty>No tasks yet. Assign one to get started.</Empty>}

      {order.map((pid) => {
        const person = people.find((p) => p.id === pid);
        const list = groups.get(pid) ?? [];
        const allDone = list.every((t) => t.status === "done");
        const hasProblem = list.some((t) => {
          const k = chipKind(t);
          return k === "escalated" || k === "blocked";
        });
        return (
          <Card key={pid}>
            <div className="mb-2 flex items-center gap-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold text-white transition-colors duration-700 ${
                  hasProblem ? "bg-[#C0503D]" : allDone ? "bg-[#6E9A5A]" : "bg-[#8A9A7B]"
                }`}
              >
                {(person?.name ?? pid).slice(0, 1).toUpperCase()}
              </span>
              <div>
                <p className="text-[17px] font-semibold text-[#2F3A28]">{person?.name ?? pid}</p>
                {person?.title && <p className="text-xs text-[#8A8578]">{person.title}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {list.map((t) => (
                <TaskRow key={t.id} task={t} area={areaById.get(t.area_id)} now={now} />
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
