# Wedding Party Coordinator — Build Plan

## 1. Context

**Hackathon build, solo, 2-hour budget.** Judged on, in order:
1. Agency: does it act, or advise?
2. Work displaced: is it a function, or a feature?
3. Creativity
4. It runs live and was built today
5. Clear in a two-minute demo

**Product:** an installable web app for a wedding party. The couple are admins. Delegates (e.g. the maid of honor) own areas of work. Members (bridesmaids, groomsmen) get their own task list. An **AI coordinator agent** does the follow-through: it messages people about their tasks, reads their replies, updates task status, answers questions from the wedding details, nudges people who go quiet, and escalates to the right person when something is stuck.

**The job it replaces:** the maid of honor's and the couple's own coordination work (not the wedding planner).

**Positioning:** "Planning apps help the couple decide. We make sure everyone else actually does their part."

**The core loop (protect this above everything else):**
assign task → agent messages assignee → assignee replies in plain words → agent updates task / answers / escalates → if silent, agent nudges twice, then escalates.

## 2. Stack and constraints

- **Next.js (App Router, TypeScript, Tailwind)** deployed on **Vercel**.
- **Postgres via Neon**, added through the Vercel Marketplace (Vercel project → Storage). Use `@neondatabase/serverless` with plain SQL. **No ORM.**
- **Claude via Vercel AI Gateway** using the Vercel AI SDK (`ai` package). Env var `AI_GATEWAY_API_KEY` (or Vercel OIDC when deployed). Model: the current Claude Sonnet from the AI Gateway model list (a string like `anthropic/claude-sonnet-...`; look up the exact id, do not guess).
  - Check the installed `ai` version. v5+: tools use `inputSchema` and the loop uses `stopWhen: stepCountIs(5)`. Older: `parameters` and `maxSteps: 5`.
- **Installable web app (PWA)**: manifest + icons, standalone display. No native app.
- **No realtime service.** Pages poll `GET /api/state` every 2 seconds.
- **No auth.** A role picker on `/` stands in for login. Row-level security is out of scope (demo only).
- **Mobile-first UI**: max width ~430px centered, bottom tab bar.
- Server-only secrets. The browser never calls the model or the database directly.

### Environment variables
- `DATABASE_URL` (added by the Neon integration; if only `POSTGRES_URL` exists, use that)
- `AI_GATEWAY_API_KEY`
- `AI_MODEL` (the gateway model id)
- `FOLLOWUP_SECONDS` (demo: `60`; real: `172800`)
- `DEMO_MODE` (`true` enables `/api/reset`)

## 3. Human setup (dashboards only)

1. Create an empty GitHub repo; clone it locally.
2. Create a Vercel project from the repo.
3. Vercel project → Storage → create **Neon Postgres** → connect to the project.
4. Vercel → AI Gateway → create an API key → add `AI_GATEWAY_API_KEY` to project env vars. Add `AI_MODEL`, `FOLLOWUP_SECONDS=60`, `DEMO_MODE=true`.
5. Locally: `npm i -g vercel`, `vercel link`, `vercel env pull .env.local`.

## 4. Data model — `db/schema.sql`

```sql
create table wedding (
  id int primary key default 1,
  name text not null,
  date date not null,
  info jsonb not null            -- venue, colors, dress, hotel, schedule, faq
);

create table people (
  id text primary key,           -- short slug, e.g. 'maya'
  name text not null,
  role text not null check (role in ('couple','delegate','member')),
  title text,                    -- 'Bride', 'Maid of Honor', 'Bridesmaid'
  venmo text                     -- username, optional
);

create table areas (
  id text primary key,
  name text not null,
  owner_id text not null references people(id),
  is_surprise boolean not null default false   -- hidden from couple
);

create table tasks (
  id serial primary key,
  area_id text not null references areas(id),
  assignee_id text not null references people(id),
  created_by text not null references people(id),
  title text not null,
  details text,
  due_date date,
  amount numeric(10,2),          -- optional money owed (Venmo link)
  status text not null default 'todo'
    check (status in ('todo','in_progress','done','blocked')),
  status_note text,
  awaiting_since timestamptz,    -- set when agent expects a reply; null when answered
  nudge_count int not null default 0,
  escalated_to text references people(id),
  escalation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id serial primary key,
  thread_person_id text not null references people(id), -- whose chat thread
  sender text not null,          -- 'agent' or a people.id
  task_id int references tasks(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table notifications (
  id serial primary key,
  person_id text not null references people(id),
  task_id int references tasks(id),
  kind text not null check (kind in ('message','escalation','update')),
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table activity (
  id serial primary key,
  task_id int references tasks(id),
  body text not null,
  created_at timestamptz not null default now()
);
```

**Chat model:** each person has **one thread with the coordinator** (not one per task). The agent sees all of that person's open tasks and links each message to a task when relevant.

## 5. Seed data — `db/seed.sql`

Fictional wedding. Make names read well on a projector.

- **Wedding:** "Maya & Jordan", date 2027-06-12.
  `info`: venue "Cedar Hollow Farm, Woodinville WA"; colors "dusty sage and cream"; bridesmaid dress "Lulu & Fern style 4412, color Dusty Sage, any length"; hotel block "Woodinville Inn, code MAYAJORDAN, book by May 1"; schedule: rehearsal dinner Fri 6pm at the farm, hair & makeup Sat 9am in the bridal suite, photos 2:30pm, ceremony 4pm; faq: shoes "nude or gold, any heel", dress deadline "order by Nov 15 for alterations".
- **People:** `maya` (couple, Bride), `jordan` (couple, Groom), `priya` (delegate, Maid of Honor, venmo `priya-demo`), `sarah`, `jess`, `leah` (members, Bridesmaid).
- **Areas:** `attire` "Dresses & Attire" owner `priya`; `bachelorette` "Bachelorette" owner `priya`, **is_surprise = true**; `dayof` "Day-of" owner `maya`.
- **Background tasks** (so the board isn't empty):
  - jess — "Send shoe size" (attire) — done
  - leah — "Book room in hotel block" (dayof) — in_progress, note "booking this weekend"
  - sarah — "Pay bachelorette share" (bachelorette, amount 85) — todo
  - priya — "Book bachelorette Airbnb" (bachelorette) — done
- The three **"Order bridesmaid dress"** tasks are NOT seeded; they're created live in the demo.

`/api/reset` truncates all tables (restart identity, cascade) and re-runs the seed.

## 6. The agent — `lib/agent.ts`

One function: `runAgent({ event, taskId?, personId })` where `event` is `'assigned' | 'reply' | 'nudge'`.

**Context passed to the model**
- Wedding info JSON
- The person (name, title) and their open tasks (id, title, details, due, amount, status, area, area owner)
- For `assigned`/`nudge`: which task triggered it
- The last 15 messages in the person's thread
- For money tasks: the Venmo pay link (see §9)

**Tools** (each also inserts an `activity` row automatically)
- `send_message({ text, task_id?, expects_reply })` — insert a message in the person's thread (sender `agent`), create a `message` notification for the person; if `expects_reply` and `task_id`, set that task's `awaiting_since = now()`.
- `update_task({ task_id, status, note })` — set status/status_note/updated_at. If status becomes `done`, notify the area owner and the couple (couple skipped for surprise areas) with kind `update`.
- `escalate({ task_id, reason })` — route with `escalationTarget(task)` (below), set `escalated_to`, `escalation_reason`, clear `awaiting_since`, create an `escalation` notification for the target.

**Escalation routing — `escalationTarget(task)`**
1. If the area owner is not the assignee → the area owner.
2. Else if the area is a surprise → the other delegate or, failing that, no one (log it).
3. Else → the couple (`maya`; notify `jordan` too).
Surprise-area tasks are never routed to the couple.

**Loop limit:** 5 steps. Set `export const maxDuration = 60` on routes that call the agent.

**System prompt (draft)**
```
You are the coordinator for {wedding.name}'s wedding party. You message members of the
wedding party about their tasks, inside the wedding app. You are warm, brief and
upbeat, like a well-organized friend. Messages are 1–3 short sentences. No emoji spam.

Your job is follow-through:
- When a task is assigned, tell the person what's needed, why, and by when.
- When they reply, figure out which task it's about. If they did it, mark it done with a
  short note. If they're working on it, mark in_progress. If they ask a question, answer
  ONLY from the wedding details you were given.
- If you can't answer from the details, or they raise a problem, escalate.

Never:
- change deadlines, amounts, or plans, or promise anything on the couple's behalf;
- reveal anything about a surprise area to the couple;
- guess facts that aren't in the wedding details.

Always escalate: money problems, conflicts, anything emotional, requests to change the
plan, and anything you can't answer. When you escalate, tell the person kindly that
you've passed it to {target name}.

For 'nudge' events: send one friendly reminder about that task and ask for a quick status.
Use tools for every action. Always end by sending the person a message.
```

## 7. API routes (contracts)

| Route | Body | Does |
|---|---|---|
| `GET /api/state?viewer={personId}` | — | Returns `{ wedding, viewer, people, areas, tasks, thread, notifications, activity, escalations }` filtered for the viewer (see §8). |
| `POST /api/tasks` | `{ title, details?, assigneeId, areaId, dueDate?, amount?, createdBy }` | Insert task, then `runAgent({ event:'assigned', taskId, personId: assigneeId })`. |
| `POST /api/messages` | `{ personId, body }` | Insert message (sender = personId), clear `awaiting_since` on that person's tasks, then `runAgent({ event:'reply', personId })`. |
| `POST /api/tick` | — | Follow-ups (below). |
| `POST /api/tasks/[id]/resolve` | `{ byPersonId }` | Clear escalation fields; log activity. |
| `POST /api/notifications/read` | `{ personId }` | Mark that person's notifications read. |
| `POST /api/reset` | — | Only if `DEMO_MODE=true`: truncate + seed. |

**`/api/tick` follow-up logic** (no model call unless a nudge is due)
1. Select tasks where `status in ('todo','in_progress')`, `awaiting_since < now() - FOLLOWUP_SECONDS`, `escalated_to is null`.
2. For each, **claim atomically**:
   `update tasks set awaiting_since = now(), nudge_count = nudge_count + 1 where id = $1 and awaiting_since = $old returning *`.
   If no row returned, another tab claimed it — skip.
3. If the new `nudge_count <= 2` → `runAgent({ event:'nudge', taskId, personId: assignee })`.
4. Else → escalate directly in code (no model call) with reason "No reply after 2 reminders".

## 8. Screens and tabs

Mobile layout, bottom tab bar, polls `/api/state` every 2 s. The couple view also calls `POST /api/tick` every 15 s.

**`/` — Role picker.** Cards for each person ("Maya — Bride", "Priya — Maid of Honor", …) linking to their view. Plus a small "Reset demo" button when `DEMO_MODE`.

**Couple view — `/p/maya` (role = couple)**
- **Board** tab: tasks grouped by person with status chips (done = green, in_progress = yellow, todo = gray, blocked/escalated = red). **Escalations** card on top with reason + "Resolve". "+ Assign task" button → form (title, details, assignee(s) — allow selecting multiple to create one task each, area, due date, amount). Surprise-area tasks are excluded.
- **Activity** tab: agent activity feed, newest first ("Nudged Leah about her dress — no reply in 60s").
- **Wedding** tab: overview from `wedding.info`.
- **Alerts** tab: notifications; bell badge with unread count in the header.

**Delegate view — `/p/priya` (role = delegate)**
- Everything a member has, plus an **Area** tab: board of tasks in areas she owns (including surprise areas), escalations routed to her, and "+ Assign task" limited to her areas.

**Member view — `/p/sarah` (role = member)**
- **Tasks** tab: personal checklist with due dates, status, and (if `amount`) a **"Pay $85 via Venmo"** button.
- **Chat** tab: thread with the coordinator; text box to reply. This is where the agent talks to them.
- **Wedding** tab: overview (date, venue, dress, hotel, schedule).
- **Alerts** tab: notifications; opening it marks them read.

Visibility rules for `/api/state`:
- couple: all tasks except surprise areas; all activity except surprise-area tasks.
- delegate: own tasks + all tasks in areas they own.
- member: own tasks only. Thread = viewer's own thread.

## 9. Small pieces

- **PWA:** `app/manifest.ts` (name "Party Line", short_name "Party Line", display `standalone`, theme color sage `#8A9A7B`, background cream `#FAF7F0`), icons 192 and 512 PNG (generate from an SVG with `sharp`), `apple-touch-icon`, `viewport-fit=cover`, safe-area padding for the tab bar.
- **Venmo link helper** `lib/venmo.ts`: `https://venmo.com/{username}?txn=pay&amount={amount}&note={encoded note}`, paying the area owner's Venmo. Verify on a real phone; if the format misbehaves, fall back to `https://venmo.com/{username}`.
- **Design:** calm and clean — cream background, sage accents, one serif for headings, system sans for body. Big tap targets.

## 10. Execution phases

### Phase 0 — Foundation (parent agent, sequential)
1. `create-next-app` (TypeScript, Tailwind, App Router); install `ai`, `zod`, `@neondatabase/serverless`, `sharp` (dev).
2. `lib/db.ts` (neon client), `lib/types.ts` (types for every table + the `/api/state` response).
3. `db/schema.sql`, `db/seed.sql`, and `scripts/db-setup.ts` that runs both against `DATABASE_URL`. Run it.
4. Stub every API route from §7 returning the correct shape.
5. Commit, push, confirm Vercel deploy succeeds.
**Checkpoint:** deployed URL loads; `GET /api/state?viewer=maya` returns seeded data.

### Phase 1 — Parallel build (3 subagents)
Each subagent edits **only its own files**. Shared types live in `lib/types.ts` and are owned by the parent — subagents request changes instead of editing it.

- **Subagent A — Agent + write APIs.** Files: `lib/agent.ts`, `lib/escalation.ts`, `app/api/tasks/**`, `app/api/messages/**`, `app/api/tick/**`. Implement §6 and §7 (including atomic claim). Test with curl: assign → message appears; reply "ordered it!" → done; reply "what color?" → answer from info; reply "I can't afford it right now" → escalated to priya.
- **Subagent B — UI.** Files: `app/p/[personId]/**`, `components/**`. Implement §8 against the `/api/state` contract (use the stub data until A lands). Polling hook, tab bar, board, chat, assign form, alerts, escalations card.
- **Subagent C — Read APIs + shell.** Files: `app/api/state/**`, `app/api/notifications/**`, `app/api/reset/**`, `app/page.tsx`, `app/manifest.ts`, `public/icons/**`, `lib/venmo.ts`. Implement visibility rules, reset, role picker, PWA.

### Phase 2 — Integrate and verify (parent)
1. Merge, run locally, fix type errors.
2. Run the acceptance tests (§11) end to end.
3. Deploy; test on a phone ("Add to Home Screen").
4. Tune the system prompt if replies are long or wrong.

### Phase 3 — Stretch (only if everything in §11 passes)
In order: surprise mode polish → couple can reply to an escalation and the agent relays it → web push notifications → Gmail OAuth.

## 11. Acceptance tests

1. Maya assigns "Order bridesmaid dress by Nov 15" to Sarah, Jess and Leah in one go → each gets an agent message within ~5 s.
2. Sarah replies "ordered it! arrives the 20th" → her task turns green on Maya's board; activity logs it.
3. Jess replies "what color was it again?" → agent answers "Dusty Sage, Lulu & Fern style 4412" from info; task stays open.
4. Leah doesn't reply → after 60 s a nudge; after another 60 s a second nudge; then it appears in Escalations routed correctly.
5. Sarah replies "I can't afford the bachelorette share right now" → escalated to Priya, **not** visible to Maya.
6. Two browser tabs open on the couple view → Leah still receives exactly one nudge per interval.
7. Reset demo restores the seed.
8. Installed on a phone from the home screen, it opens full screen with the icon.

## 12. Demo script (2 minutes)

1. **0:00–0:20** — "Being maid of honor means being an unpaid project manager for people who don't answer texts."
2. **0:20–0:40** — Projector: Maya's board. Assign "Order bridesmaid dress by Nov 15" to all three bridesmaids.
3. **0:40–1:30** — Phone (installed app, as Sarah): the agent's message is there; reply "ordered!" → board turns green. Switch to Jess: ask the color → instant answer. Leah stays silent → nudge → lands in Escalations.
4. **1:30–2:00** — Activity feed: "Maya sent zero messages. The coordinator did the follow-through." Bonus if time: show the bachelorette area is invisible to Maya.

Record a backup video after the first successful run-through.

## 13. Out of scope

Real auth, row-level security, SMS, Gmail, native apps, multiple weddings, file uploads, vendor management, realtime subscriptions.
