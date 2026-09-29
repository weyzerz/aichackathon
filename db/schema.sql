drop table if exists activity, notifications, messages, tasks, areas, people, wedding cascade;

create table wedding (
  id int primary key default 1,
  name text not null,
  date date not null,
  info jsonb not null
);

create table people (
  id text primary key,
  name text not null,
  role text not null check (role in ('couple','delegate','member')),
  title text,
  venmo text
);

create table areas (
  id text primary key,
  name text not null,
  owner_id text not null references people(id),
  is_surprise boolean not null default false,
  date_label text,
  location text,
  description text,
  details jsonb
);

create table tasks (
  id serial primary key,
  area_id text not null references areas(id),
  assignee_id text not null references people(id),
  created_by text not null references people(id),
  title text not null,
  details text,
  due_date date,
  amount numeric(10,2),
  status text not null default 'todo'
    check (status in ('todo','in_progress','done','blocked')),
  status_note text,
  response text,
  is_secret boolean not null default false,   -- hidden from the couple (e.g. surprises for the bride)
  awaiting_since timestamptz,
  nudge_count int not null default 0,
  escalated_to text references people(id),
  escalation_reason text,
  deadline_reminded_at timestamptz,
  overdue_escalated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id serial primary key,
  thread_person_id text not null references people(id),
  sender text not null,
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
