import type { Area, Task } from "@/lib/types";
import { StatusChip, chipKind, formatDate, formatMoney } from "./ui";

const FLASH_MS = 8000;

/** One task line. Flashes green when it recently turned done (animation starts when the class is applied). */
export function TaskRow({
  task,
  area,
  now,
  showArea = true,
}: {
  task: Task;
  area?: Area;
  now: number;
  showArea?: boolean;
}) {
  const kind = chipKind(task);
  const recentlyChanged = now - Date.parse(task.updated_at) < FLASH_MS;
  const flash =
    recentlyChanged && kind === "done"
      ? "pl-flash-done"
      : recentlyChanged && kind === "escalated"
        ? "pl-flash-bad"
        : "";
  const tint =
    kind === "done"
      ? "bg-[#F3F8EF]"
      : kind === "escalated" || kind === "blocked"
        ? "bg-[#FDF3F1]"
        : kind === "in_progress"
          ? "bg-[#FFFBEF]"
          : "bg-[#FBFAF7]";

  return (
    <div
      className={`rounded-xl px-3 py-2.5 transition-colors duration-700 ${tint} ${flash}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`text-[15px] font-medium leading-snug text-[#2F3A28] ${kind === "done" ? "line-through decoration-[#9DB58F] decoration-2" : ""}`}
          >
            {task.title}
          </p>
          <p className="mt-0.5 text-xs text-[#8A8578]">
            {[
              showArea && area?.name,
              task.due_date && `Due ${formatDate(task.due_date)}`,
              task.amount && formatMoney(task.amount),
              area?.is_surprise && "Surprise",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {task.status_note && (
            <p className="mt-1 text-[13px] italic text-[#5B574E]">“{task.status_note}”</p>
          )}
          {task.escalation_reason && kind === "escalated" && (
            <p className="mt-1 text-[13px] text-[#9A2E1F]">⚠ {task.escalation_reason}</p>
          )}
        </div>
        <StatusChip task={task} />
      </div>
    </div>
  );
}
