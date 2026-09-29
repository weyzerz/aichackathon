"use client";

import { useState } from "react";
import type { Area, CreateTaskBody, Person } from "@/lib/types";
import { Card, Heading, btnGhost, btnPrimary } from "./ui";

export function AssignForm({
  viewer,
  people,
  areas,
  onDone,
  onCancel,
}: {
  viewer: Person;
  people: Person[];
  areas: Area[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [isSecret, setIsSecret] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = people.filter((p) => p.role !== "couple");

  function toggle(id: string) {
    setAssignees((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || assignees.length === 0 || !areaId) {
      setError("Add a title, at least one person, and an area.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const results = await Promise.all(
        assignees.map((assigneeId) => {
          const body: CreateTaskBody = {
            title: title.trim(),
            assigneeId,
            areaId,
            createdBy: viewer.id,
            ...(details.trim() ? { details: details.trim() } : {}),
            ...(dueDate ? { dueDate } : {}),
            ...(amount && !Number.isNaN(Number(amount)) ? { amount: Number(amount) } : {}),
            ...(isSecret ? { isSecret: true } : {}),
          };
          return fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }),
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed) {
        setError(`${failed} of ${results.length} assignments failed. Try again.`);
        setPending(false);
        return;
      }
      onDone();
    } catch {
      setError("Couldn't reach the server. Try again.");
      setPending(false);
    }
  }

  const input =
    "w-full rounded-xl border border-[#DDD8CD] bg-[#FBFAF7] px-3 py-2.5 text-[15px] text-[#2F3A28] outline-none focus:border-[#8A9A7B] focus:ring-2 focus:ring-[#8A9A7B]/30";

  if (pending) {
    return (
      <Card className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="flex gap-1.5">
          <span className="pl-dot h-2.5 w-2.5 rounded-full bg-[#8A9A7B]" />
          <span className="pl-dot h-2.5 w-2.5 rounded-full bg-[#8A9A7B] [animation-delay:150ms]" />
          <span className="pl-dot h-2.5 w-2.5 rounded-full bg-[#8A9A7B] [animation-delay:300ms]" />
        </span>
        <p className="text-[15px] font-medium text-[#5F6F52]">Coordinator is messaging…</p>
        <p className="text-sm text-[#8A8578]">
          {assignees
            .map((id) => people.find((p) => p.id === id)?.name ?? id)
            .join(", ")}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Heading>Assign a task</Heading>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[#5B574E]">Title</span>
          <input
            className={input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Order bridesmaid dress by Nov 15"
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[#5B574E]">Details</span>
          <textarea
            className={`${input} min-h-20`}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[#5B574E]">Assign to</span>
          <div className="flex flex-wrap gap-2">
            {candidates.map((p) => {
              const on = assignees.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  aria-pressed={on}
                  className={`min-h-11 rounded-full px-4 text-sm font-semibold ring-1 transition ${
                    on
                      ? "bg-[#5F6F52] text-white ring-[#5F6F52]"
                      : "bg-white text-[#5F6F52] ring-[#CBD3C2] hover:bg-[#F1F3EC]"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[#5B574E]">Area</span>
          <select className={input} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.is_surprise ? " (surprise)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#5B574E]">Due date</span>
            <input
              type="date"
              className={input}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#5B574E]">Amount ($)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className={input}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>
        {viewer.role !== "couple" && (
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-[#F6F1E4] px-3 py-3">
            <span>
              <span className="block text-sm font-semibold text-[#2F3A28]">🤫 Secret from the bride &amp; groom</span>
              <span className="block text-xs text-[#8A8578]">Maya and Jordan won&apos;t see this task</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isSecret}
              onClick={() => setIsSecret((v) => !v)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${isSecret ? "bg-[#5F6F52]" : "bg-[#D9D4C7]"}`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${isSecret ? "left-[22px]" : "left-0.5"}`}
              />
            </button>
          </label>
        )}
        {error && <p className="text-sm text-[#9A2E1F]">{error}</p>}
        <div className="flex gap-3">
          <button type="button" className={`${btnGhost} flex-1`} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={`${btnPrimary} flex-[2]`}>
            Assign{assignees.length > 1 ? ` to ${assignees.length}` : ""}
          </button>
        </div>
      </form>
    </Card>
  );
}
