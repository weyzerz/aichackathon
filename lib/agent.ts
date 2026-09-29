import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { sql } from "@/lib/db";
import { escalateTask } from "@/lib/escalation";
import { venmoPayUrl } from "@/lib/venmo";
import type { AgentEvent, Message, Person, TaskStatus, Wedding } from "@/lib/types";

const MODEL = process.env.AI_MODEL ?? "anthropic/claude-sonnet-5.5";

export interface RunAgentInput {
  event: AgentEvent;
  personId: string;
  taskId?: number;
}

export interface RunAgentResult {
  text: string;
  steps: number;
  actions: string[];
}

interface TaskRow {
  id: number;
  title: string;
  details: string | null;
  due: string | null;
  amount: string | null;
  status: TaskStatus;
  status_note: string | null;
  nudge_count: number;
  escalated_to: string | null;
  area_id: string;
  area_name: string;
  is_surprise: boolean;
  owner_id: string;
  owner_name: string;
  owner_venmo: string | null;
}

async function loadTasks(personId: string, includeTaskId?: number): Promise<TaskRow[]> {
  return (await sql`
    select t.id, t.title, t.details, to_char(t.due_date, 'YYYY-MM-DD') as due,
           t.amount::text as amount, t.status, t.status_note, t.nudge_count, t.escalated_to,
           a.id as area_id, a.name as area_name, a.is_surprise,
           o.id as owner_id, o.name as owner_name, o.venmo as owner_venmo
    from tasks t
    join areas a on a.id = t.area_id
    join people o on o.id = a.owner_id
    where t.assignee_id = ${personId}
      and (t.status <> 'done' or t.id = ${includeTaskId ?? -1}
           or t.updated_at > now() - interval '1 day')
    order by t.id`) as TaskRow[];
}

function describeTask(t: TaskRow): string {
  const parts = [
    `#${t.id} "${t.title}"`,
    `area: ${t.area_name} (owner ${t.owner_name})`,
    `status: ${t.status}${t.status_note ? ` (${t.status_note})` : ""}`,
  ];
  if (t.details) parts.push(`details: ${t.details}`);
  if (t.due) parts.push(`due: ${t.due}`);
  if (t.amount) {
    parts.push(`amount owed: $${t.amount} to ${t.owner_name}`);
    if (t.owner_venmo)
      parts.push(`pay link: ${venmoPayUrl(t.owner_venmo, t.amount, t.title)}`);
  }
  if (t.escalated_to) parts.push(`already escalated to ${t.escalated_to}`);
  return "- " + parts.join("; ");
}

function systemPrompt(wedding: Wedding): string {
  return `You are the coordinator for ${wedding.name}'s wedding party. You message members of the
wedding party about their tasks, inside the wedding app. You are warm, brief and
upbeat, like a well-organized friend. Messages are 1–3 short sentences. No emoji spam.

Your job is follow-through:
- When a task is assigned, tell the person what's needed, why, and by when.
- When they reply, figure out which task it's about. If they did it, mark it done with a
  short note. If they're working on it, mark in_progress. If they ask a question, answer
  ONLY from the wedding details you were given.
- If you can't answer from the details, or they raise a problem, escalate.
- If they report a blocker, also mark the task blocked. Otherwise don't change status when escalating.

Never:
- change deadlines, amounts, or plans, or promise anything on the couple's behalf;
- reveal anything about a surprise area to the couple;
- guess facts that aren't in the wedding details.

Always escalate: money problems, conflicts, anything emotional, requests to change the
plan, and anything you can't answer. When you escalate, tell the person kindly that
you've passed it to the person the escalate tool reports.

For 'nudge' events: send one friendly reminder about that task and ask for a quick status.
For 'deadline' events: the task is due within 2 days. Send one friendly heads-up naming the due
date (e.g. "due Thursday") and ask whether it's on track.
For money tasks, include the pay link when asking them to pay.
Use tools for every action. Always end by sending the person exactly one message (send_message).
When you ask about a specific task, set expects_reply true with its task_id.`;
}

export async function runAgent({ event, personId, taskId }: RunAgentInput): Promise<RunAgentResult> {
  const [wedding] = (await sql`
    select id, name, to_char(date, 'YYYY-MM-DD') as date, info from wedding where id = 1`) as Wedding[];
  const [person] = (await sql`select * from people where id = ${personId}`) as Person[];
  if (!wedding || !person) throw new Error(`Unknown person ${personId}`);

  let tasks = await loadTasks(personId, taskId);
  if (person.role === "couple") tasks = tasks.filter((t) => !t.is_surprise);
  const taskById = (id: number) => tasks.find((t) => t.id === id);

  const recent = (
    (await sql`
      select * from messages where thread_person_id = ${personId}
      order by id desc limit 15`) as Message[]
  ).reverse();

  const trigger = taskId ? taskById(taskId) : undefined;
  const today = new Date().toISOString().slice(0, 10);
  const transcript = recent.length
    ? recent
        .map((m) => `${m.sender === "agent" ? "Coordinator" : person.name}${m.task_id ? ` [task #${m.task_id}]` : ""}: ${m.body}`)
        .join("\n")
    : "(no messages yet)";

  let eventLine: string;
  if (event === "assigned") eventLine = `EVENT: assigned — task #${taskId} was just assigned to ${person.name}. Introduce it.`;
  else if (event === "nudge")
    eventLine = `EVENT: nudge — ${person.name} hasn't replied about task #${taskId}. This is reminder ${trigger?.nudge_count ?? 1} of 2.`;
  else if (event === "deadline")
    eventLine = `EVENT: deadline — task #${taskId} is due ${trigger?.due ?? "soon"} and isn't done yet. Remind ${person.name}.`;
  else eventLine = `EVENT: reply — ${person.name} just sent a message (last in the thread). Respond to it.`;

  const prompt = `Today is ${today}. Wedding date: ${wedding.date}.

WEDDING DETAILS (the only facts you may use):
${JSON.stringify(wedding.info, null, 1)}

PERSON: ${person.name}${person.title ? ` (${person.title})` : ""}

THEIR TASKS:
${tasks.length ? tasks.map(describeTask).join("\n") : "(none)"}

THREAD (oldest first):
${transcript}

${eventLine}`;

  const actions: string[] = [];
  const log = async (task_id: number | null, body: string) => {
    actions.push(body);
    await sql`insert into activity (task_id, body) values (${task_id}, ${body})`;
  };

  const tools = {
    send_message: tool({
      description: "Send a message to the person in their chat thread.",
      inputSchema: z.object({
        text: z.string().describe("1-3 short sentences"),
        task_id: z.number().int().optional().describe("Task the message is about, if any"),
        expects_reply: z.boolean().describe("True if you're waiting on a reply about task_id"),
      }),
      execute: async ({ text, task_id, expects_reply }) => {
        const t = task_id != null ? taskById(task_id) : undefined;
        const tid = t ? t.id : null;
        await sql`
          insert into messages (thread_person_id, sender, task_id, body)
          values (${personId}, 'agent', ${tid}, ${text})`;
        await sql`
          insert into notifications (person_id, task_id, kind, body)
          values (${personId}, ${tid}, 'message', ${text})`;
        if (expects_reply && tid != null) {
          await sql`update tasks set awaiting_since = now() where id = ${tid}`;
        }
        const about = t ? ` about "${t.title}"` : "";
        let body: string;
        if (event === "nudge" && t && t.id === taskId)
          body = `Nudged ${person.name}${about} (reminder ${t.nudge_count} of 2)`;
        else if (event === "deadline" && t && t.id === taskId)
          body = `Reminded ${person.name} that "${t.title}" is due ${t.due ?? "soon"}`;
        else if (event === "reply") body = `Replied to ${person.name}${about}`;
        else body = `Messaged ${person.name}${about}`;
        await log(tid, body);
        return { ok: true };
      },
    }),
    update_task: tool({
      description: "Update the status of one of the person's tasks, with a short note.",
      inputSchema: z.object({
        task_id: z.number().int(),
        status: z.enum(["todo", "in_progress", "done", "blocked"]),
        note: z.string().describe("Short status note, e.g. 'ordered, arrives the 20th'"),
      }),
      execute: async ({ task_id, status, note }) => {
        const t = taskById(task_id);
        if (!t) return { ok: false, error: "Not one of this person's tasks" };
        await sql`
          update tasks set status = ${status}, status_note = ${note}, updated_at = now(),
            awaiting_since = case when ${status} = 'done' then null else awaiting_since end
          where id = ${task_id}`;
        t.status = status;
        const label = status === "in_progress" ? "in progress" : status;
        await log(task_id, `Marked ${person.name}'s "${t.title}" ${label}${note ? ` — ${note}` : ""}`);
        if (status === "done") {
          const recipients = new Set<string>([t.owner_id]);
          if (!t.is_surprise) {
            const couple = (await sql`select id from people where role = 'couple'`) as { id: string }[];
            couple.forEach((c) => recipients.add(c.id));
          }
          recipients.delete(personId);
          for (const rid of recipients) {
            await sql`
              insert into notifications (person_id, task_id, kind, body)
              values (${rid}, ${task_id}, 'update',
                      ${`${person.name} finished "${t.title}"${note ? ` — ${note}` : ""}`})`;
          }
        }
        return { ok: true };
      },
    }),
    escalate: tool({
      description:
        "Escalate a task to the right person (area owner, or the couple). Returns who it went to.",
      inputSchema: z.object({
        task_id: z.number().int(),
        reason: z.string().describe("Short reason, e.g. 'Can't afford the share right now'"),
      }),
      execute: async ({ task_id, reason }) => {
        const t = taskById(task_id);
        if (!t) return { ok: false, error: "Not one of this person's tasks" };
        const { target } = await escalateTask(task_id, reason);
        actions.push(`escalate #${task_id} → ${target?.name ?? "no one"}`);
        return { ok: true, escalated_to: target?.name ?? null };
      },
    }),
  };

  const result = await generateText({
    model: MODEL,
    instructions: systemPrompt(wedding),
    prompt,
    tools,
    stopWhen: stepCountIs(5),
    maxOutputTokens: 600,
  });

  return { text: result.text, steps: result.steps.length, actions };
}
