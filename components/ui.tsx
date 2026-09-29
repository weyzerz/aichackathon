import type { ReactNode } from "react";
import type { Task } from "@/lib/types";
import { serif } from "./fonts";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(60,50,30,0.08),0_4px_16px_rgba(60,50,30,0.05)] ring-1 ring-[#EDE7DA] ${className}`}
    >
      {children}
    </div>
  );
}

export function Heading({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`${serif.className} text-xl font-medium text-[#2F3A28] ${className}`}>
      {children}
    </h2>
  );
}

type ChipKind = "done" | "in_progress" | "todo" | "blocked" | "escalated";

const CHIP: Record<ChipKind, { label: string; cls: string }> = {
  done: { label: "Done", cls: "bg-[#DCEBD3] text-[#2E5E22] ring-[#B9D6A8]" },
  in_progress: { label: "In progress", cls: "bg-[#FBEFC8] text-[#7A5A00] ring-[#EED9A0]" },
  todo: { label: "To do", cls: "bg-[#EEEBE4] text-[#5B574E] ring-[#DDD8CD]" },
  blocked: { label: "Blocked", cls: "bg-[#F8DAD5] text-[#9A2E1F] ring-[#EDB8AF]" },
  escalated: { label: "Escalated", cls: "bg-[#F8DAD5] text-[#9A2E1F] ring-[#EDB8AF]" },
};

export function chipKind(task: Task): ChipKind {
  if (task.escalated_to && task.status !== "done") return "escalated";
  return task.status;
}

export function StatusChip({ task }: { task: Task }) {
  const c = CHIP[chipKind(task)];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-colors duration-500 ${c.cls}`}
    >
      {c.label === "Done" && <span aria-hidden>✓</span>}
      {c.label}
    </span>
  );
}

export function relativeTime(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function formatDate(ymd: string | null | undefined): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: y !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

export function formatMoney(amount: string | null): string {
  if (!amount) return "";
  const n = Number(amount);
  if (Number.isNaN(n)) return `$${amount}`;
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#5F6F52] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] hover:bg-[#51603F] disabled:opacity-50";
export const btnGhost =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-[#5F6F52] ring-1 ring-[#CBD3C2] transition hover:bg-[#F1F3EC] active:scale-[0.98] disabled:opacity-50";

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-[#8A8578]">{children}</p>;
}
