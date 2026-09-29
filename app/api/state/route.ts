import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { venmoPayUrl } from "@/lib/venmo";
import type {
  Activity,
  Area,
  Message,
  Notification,
  Person,
  StateResponse,
  Task,
  Wedding,
} from "@/lib/types";

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  const viewerId = req.nextUrl.searchParams.get("viewer");
  if (!viewerId) {
    return NextResponse.json({ error: "viewer is required" }, { status: 400 });
  }

  const [weddingRows, peopleRows, areaRows, taskRows, threadRows, notifRows] =
    await Promise.all([
      sql`select id, name, to_char(date, 'YYYY-MM-DD') as date, info from wedding where id = 1`,
      sql`select id, name, role, title, venmo from people order by
            case role when 'couple' then 0 when 'delegate' then 1 else 2 end, name`,
      sql`select id, name, owner_id, is_surprise, date_label, location, description, details from areas
            order by case id when 'bachelorette' then 0 when 'attire' then 1 else 2 end`,
      sql`select id, area_id, assignee_id, created_by, title, details,
            to_char(due_date, 'YYYY-MM-DD') as due_date, amount, status, status_note, response,
            deadline_reminded_at, overdue_escalated,
            awaiting_since, nudge_count, escalated_to, escalation_reason, created_at, updated_at
          from tasks order by created_at, id`,
      sql`select * from (
            select id, thread_person_id, sender, task_id, body, created_at
            from messages where thread_person_id = ${viewerId}
            order by created_at desc, id desc limit 100
          ) m order by created_at, id`,
      sql`select id, person_id, task_id, kind, body, read, created_at
          from notifications where person_id = ${viewerId}
          order by created_at desc, id desc limit 50`,
    ]);

  const people = peopleRows as Person[];
  const viewer = people.find((p) => p.id === viewerId);
  if (!viewer) {
    return NextResponse.json({ error: "unknown viewer" }, { status: 404 });
  }

  const allAreas = areaRows as Area[];
  const areaById = new Map(allAreas.map((a) => [a.id, a]));
  const personById = new Map(people.map((p) => [p.id, p]));
  const allTasks = taskRows as Task[];

  let tasks: Task[];
  let areas: Area[];
  if (viewer.role === "couple") {
    areas = allAreas.filter((a) => !a.is_surprise);
    const ok = new Set(areas.map((a) => a.id));
    tasks = allTasks.filter((t) => ok.has(t.area_id));
  } else if (viewer.role === "delegate") {
    const owned = new Set(allAreas.filter((a) => a.owner_id === viewer.id).map((a) => a.id));
    tasks = allTasks.filter((t) => t.assignee_id === viewer.id || owned.has(t.area_id));
    const visibleAreaIds = new Set([...owned, ...tasks.map((t) => t.area_id)]);
    areas = allAreas.filter((a) => visibleAreaIds.has(a.id));
  } else {
    tasks = allTasks.filter((t) => t.assignee_id === viewer.id);
    const ids = new Set(tasks.map((t) => t.area_id));
    areas = allAreas.filter((a) => ids.has(a.id));
  }

  tasks = tasks.map((t) => {
    let pay_url: string | null = null;
    if (t.amount != null) {
      const owner = personById.get(areaById.get(t.area_id)?.owner_id ?? "");
      if (owner?.venmo) pay_url = venmoPayUrl(owner.venmo, t.amount, t.title);
    }
    // Submitted info (e.g. flights) is only for the assignee and the event's organizer.
    const canSeeResponse =
      t.assignee_id === viewer.id || areaById.get(t.area_id)?.owner_id === viewer.id;
    return { ...t, pay_url, response: canSeeResponse ? t.response : null };
  });

  const taskIds = tasks.map((t) => t.id);
  let activity: Activity[] = [];
  if (viewer.role === "couple") {
    const surpriseIds = allAreas.filter((a) => a.is_surprise).map((a) => a.id);
    activity = (await sql`
      select a.id, a.task_id, a.body, a.created_at from activity a
      left join tasks t on t.id = a.task_id
      where a.task_id is null or not (t.area_id = any(${surpriseIds}))
      order by a.created_at desc, a.id desc limit 50`) as Activity[];
  } else if (taskIds.length > 0) {
    activity = (await sql`
      select id, task_id, body, created_at from activity
      where task_id = any(${taskIds})
      order by created_at desc, id desc limit 50`) as Activity[];
  }

  // The couple oversee everything visible to them (surprise areas are already filtered out),
  // so they see escalations routed to delegates too; everyone else sees their own.
  const escalations = tasks.filter(
    (t) => t.escalated_to != null && (viewer.role === "couple" || t.escalated_to === viewer.id)
  );

  const body: StateResponse = {
    wedding: weddingRows[0] as Wedding,
    viewer,
    people,
    areas,
    tasks,
    thread: threadRows as Message[],
    notifications: notifRows as Notification[],
    activity,
    escalations,
    demoMode: process.env.DEMO_MODE === "true",
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
