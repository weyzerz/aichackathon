import { sql } from "@/lib/db";
import type { Person, Task } from "@/lib/types";

export interface EscalationRoute {
  /** Primary person the escalation is routed to (null = no one; logged only). */
  target: Person | null;
  /** Everyone who should get an escalation notification (includes target). */
  notify: Person[];
}

/**
 * Routing per PLAN §6:
 * 1. Area owner is not the assignee → area owner.
 * 2. Else if area is a surprise → another delegate, or no one.
 * 3. Else → the couple (maya primary, jordan notified too).
 * Surprise-area tasks are never routed to the couple.
 */
export async function escalationTarget(
  task: Pick<Task, "area_id" | "assignee_id">,
): Promise<EscalationRoute> {
  const [area] = (await sql`select * from areas where id = ${task.area_id}`) as {
    owner_id: string;
    is_surprise: boolean;
  }[];
  const people = (await sql`select * from people`) as Person[];
  const byId = (id: string) => people.find((p) => p.id === id) ?? null;

  if (area && area.owner_id !== task.assignee_id) {
    const owner = byId(area.owner_id);
    return { target: owner, notify: owner ? [owner] : [] };
  }
  if (area?.is_surprise) {
    const other = people.find((p) => p.role === "delegate" && p.id !== task.assignee_id) ?? null;
    return { target: other, notify: other ? [other] : [] };
  }
  const couple = people.filter((p) => p.role === "couple" && p.id !== task.assignee_id);
  const primary = couple.find((p) => p.id === "maya") ?? couple[0] ?? null;
  return { target: primary, notify: couple };
}

/**
 * Escalate a task: set escalated_to / escalation_reason, clear awaiting_since,
 * notify the target(s) and log activity. Status is left unchanged.
 */
export async function escalateTask(
  taskId: number,
  reason: string,
): Promise<{ task: Task; target: Person | null }> {
  const [task] = (await sql`select * from tasks where id = ${taskId}`) as Task[];
  if (!task) throw new Error(`Task ${taskId} not found`);
  const [assignee] = (await sql`select * from people where id = ${task.assignee_id}`) as Person[];
  const route = await escalationTarget(task);
  const who = assignee?.name ?? task.assignee_id;

  const [updated] = (await sql`
    update tasks
    set escalated_to = ${route.target?.id ?? null},
        escalation_reason = ${reason},
        awaiting_since = null,
        updated_at = now()
    where id = ${taskId}
    returning *`) as Task[];

  for (const p of route.notify) {
    await sql`
      insert into notifications (person_id, task_id, kind, body)
      values (${p.id}, ${taskId}, 'escalation',
              ${`${who}'s "${task.title}" needs you: ${reason}`})`;
  }

  const body = route.target
    ? `Escalated ${who}'s "${task.title}" to ${route.target.name} — ${reason}`
    : `Couldn't escalate ${who}'s "${task.title}" (surprise area, no one else to route to) — ${reason}`;
  await sql`insert into activity (task_id, body) values (${taskId}, ${body})`;

  return { task: updated, target: route.target };
}
