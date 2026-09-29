import { z } from "zod";
import { sql } from "@/lib/db";
import type { Person, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

const Body = z.object({ byPersonId: z.string(), note: z.string().optional() });

/** A delegate hands an escalation up to the couple (the only way the couple get pinged). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 });
  const { byPersonId, note } = parsed.data;

  const [task] = (await sql`
    select t.*, a.is_surprise from tasks t join areas a on a.id = t.area_id
    where t.id = ${Number(id)}`) as (Task & { is_surprise: boolean })[];
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
  if (task.is_secret || task.is_surprise)
    return Response.json({ error: "This one is a secret from the couple" }, { status: 400 });

  const people = (await sql`select * from people`) as Person[];
  const by = people.find((p) => p.id === byPersonId);
  const assignee = people.find((p) => p.id === task.assignee_id);
  const couple = people.filter((p) => p.role === "couple");
  const reason = `${by?.name ?? byPersonId}: ${note || task.escalation_reason || "Needs your call"}`;

  const [updated] = (await sql`
    update tasks set escalated_to = 'maya', escalation_reason = ${reason}, updated_at = now()
    where id = ${task.id} returning *`) as Task[];
  for (const c of couple) {
    await sql`
      insert into notifications (person_id, task_id, kind, body)
      values (${c.id}, ${task.id}, 'escalation',
              ${`${by?.name ?? "Your maid of honor"} needs you on ${assignee?.name ?? "someone"}'s "${task.title}": ${note || task.escalation_reason || ""}`})`;
  }
  await sql`
    insert into activity (task_id, body)
    values (${task.id}, ${`${by?.name ?? byPersonId} sent ${assignee?.name ?? ""}'s "${task.title}" to Maya`})`;
  return Response.json({ task: updated });
}
