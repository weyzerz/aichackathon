import { z } from "zod";
import { sql } from "@/lib/db";
import { runAgent } from "@/lib/agent";
import type { Person, Task } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  title: z.string().trim().min(1),
  details: z.string().optional(),
  assigneeId: z.string().min(1),
  areaId: z.string().min(1),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  amount: z.coerce.number().positive().optional(),
  isSecret: z.boolean().optional(),
  createdBy: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 400 });
  }
  const b = parsed.data;

  let task: Task;
  try {
    [task] = (await sql`
      insert into tasks (area_id, assignee_id, created_by, title, details, due_date, amount, is_secret)
      values (${b.areaId}, ${b.assigneeId}, ${b.createdBy}, ${b.title},
              ${b.details || null}, ${b.dueDate ?? null}, ${b.amount ?? null}, ${b.isSecret ?? false})
      returning *`) as Task[];
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }

  const people = (await sql`
    select * from people where id in (${b.createdBy}, ${b.assigneeId})`) as Person[];
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  await sql`
    insert into activity (task_id, body)
    values (${task.id}, ${`${name(b.createdBy)} assigned "${b.title}" to ${name(b.assigneeId)}`})`;

  try {
    const agent = await runAgent({ event: "assigned", taskId: task.id, personId: b.assigneeId });
    return Response.json({ task, agent });
  } catch (e) {
    console.error("runAgent(assigned) failed", e);
    return Response.json({ task, agentError: String(e) });
  }
}
