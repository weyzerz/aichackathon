import { z } from "zod";
import { sql } from "@/lib/db";
import type { Person, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

const Body = z.object({ byPersonId: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isInteger(taskId)) return Response.json({ error: "bad id" }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  const [task] = (await sql`
    update tasks
    set escalated_to = null, escalation_reason = null, nudge_count = 0, updated_at = now()
    where id = ${taskId}
    returning *`) as Task[];
  if (!task) return Response.json({ error: "not found" }, { status: 404 });

  const people = (await sql`
    select * from people where id in (${parsed.data.byPersonId}, ${task.assignee_id})`) as Person[];
  const name = (pid: string) => people.find((p) => p.id === pid)?.name ?? pid;
  await sql`
    insert into activity (task_id, body)
    values (${taskId}, ${`${name(parsed.data.byPersonId)} resolved the escalation on ${name(task.assignee_id)}'s "${task.title}"`})`;

  return Response.json({ task });
}
