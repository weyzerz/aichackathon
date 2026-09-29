import { z } from "zod";
import { sql } from "@/lib/db";
import { runAgent } from "@/lib/agent";
import type { Message } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  personId: z.string().min(1),
  body: z.string().trim().min(1).max(2000),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const { personId, body } = parsed.data;

  let message: Message;
  try {
    [message] = (await sql`
      insert into messages (thread_person_id, sender, body)
      values (${personId}, ${personId}, ${body})
      returning *`) as Message[];
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }

  // They replied: stop waiting on them (and reset the nudge cycle).
  await sql`
    update tasks set awaiting_since = null, nudge_count = 0
    where assignee_id = ${personId} and awaiting_since is not null`;

  try {
    const agent = await runAgent({ event: "reply", personId });
    return Response.json({ message, agent });
  } catch (e) {
    console.error("runAgent(reply) failed", e);
    return Response.json({ message, agentError: String(e) });
  }
}
