import { sql } from "@/lib/db";
import { runAgent } from "@/lib/agent";
import { escalateTask } from "@/lib/escalation";
import type { Task } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FOLLOWUP_SECONDS = Number(process.env.FOLLOWUP_SECONDS ?? 60) || 60;

export async function POST() {
  // awaiting_since is read back as text so the compare-and-swap below matches
  // exactly (JS Date would drop microseconds).
  const due = (await sql`
    select id, assignee_id, awaiting_since::text as old
    from tasks
    where status in ('todo', 'in_progress')
      and awaiting_since < now() - make_interval(secs => ${FOLLOWUP_SECONDS})
      and escalated_to is null
    order by id`) as { id: number; assignee_id: string; old: string }[];

  const results: { taskId: number; action: string; error?: string }[] = [];

  await Promise.all(
    due.map(async (row) => {
      // Atomic claim: only one caller wins per interval.
      const [claimed] = (await sql`
        update tasks
        set awaiting_since = now(), nudge_count = nudge_count + 1
        where id = ${row.id} and awaiting_since = ${row.old}::timestamptz
        returning *`) as Task[];
      if (!claimed) {
        results.push({ taskId: row.id, action: "skipped (claimed elsewhere)" });
        return;
      }
      try {
        if (claimed.nudge_count <= 2) {
          await runAgent({ event: "nudge", taskId: claimed.id, personId: claimed.assignee_id });
          results.push({ taskId: claimed.id, action: `nudge ${claimed.nudge_count}` });
        } else {
          const { target } = await escalateTask(claimed.id, "No reply after 2 reminders");
          if (target) {
            await sql`
              insert into messages (thread_person_id, sender, task_id, body)
              values (${claimed.assignee_id}, 'agent', ${claimed.id},
                      ${`No worries — I've looped in ${target.name} on "${claimed.title}" so they can help.`})`;
          }
          results.push({ taskId: claimed.id, action: `escalated to ${target?.id ?? "no one"}` });
        }
      } catch (e) {
        console.error("tick failed for task", claimed.id, e);
        results.push({ taskId: claimed.id, action: "error", error: String(e) });
      }
    }),
  );

  return Response.json({ checked: due.length, results });
}
