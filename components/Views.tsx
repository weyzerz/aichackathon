import type { Activity, Area, Notification, Person, Task, Wedding } from "@/lib/types";
import { TaskRow } from "./TaskRow";
import { Card, Empty, Heading, formatDate, formatMoney, relativeTime } from "./ui";
import { serif } from "./fonts";

export function MyTasks({
  viewer,
  tasks,
  areas,
  now,
}: {
  viewer: Person;
  tasks: Task[];
  areas: Area[];
  now: number;
}) {
  const mine = tasks
    .filter((t) => t.assignee_id === viewer.id)
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.id - b.id);
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const open = mine.filter((t) => t.status !== "done").length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Heading className="text-2xl">Your tasks</Heading>
        <p className="text-sm text-[#8A8578]">
          {mine.length === 0 ? "Nothing yet" : open === 0 ? "All done — thank you!" : `${open} to go`}
        </p>
      </div>
      {mine.length === 0 && <Empty>Nothing on your list yet.</Empty>}
      {mine.map((t) => (
        <Card key={t.id} className="flex flex-col gap-3">
          <TaskRow task={t} area={areaById.get(t.area_id)} now={now} />
          {t.details && <p className="px-1 text-sm text-[#5B574E]">{t.details}</p>}
          {t.response && (
            <p className="whitespace-pre-line rounded-xl bg-[#F3F8EF] px-3 py-2 text-sm text-[#2F3A28] ring-1 ring-[#DCEBD3]">
              <span className="font-semibold text-[#2E5E22]">You sent: </span>
              {t.response}
            </p>
          )}
          {t.pay_url && t.status !== "done" && (
            <a
              href={t.pay_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#3D95CE] px-4 text-[15px] font-semibold text-white shadow-sm transition active:scale-[0.98] hover:bg-[#3282B8]"
            >
              Pay {formatMoney(t.amount)} via Venmo
            </a>
          )}
        </Card>
      ))}
    </div>
  );
}

export function WeddingView({ wedding }: { wedding: Wedding }) {
  const info = wedding.info ?? ({} as Wedding["info"]);
  const rows: [string, string | undefined][] = [
    ["Date", formatDate(wedding.date)],
    ["Venue", info.venue],
    ["Colors", info.colors],
    ["Bridesmaid dress", info.bridesmaid_dress],
    ["Hotel block", info.hotel_block],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="py-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A9A7B]">The wedding of</p>
        <h2 className={`${serif.className} mt-1 text-4xl text-[#2F3A28]`}>{wedding.name}</h2>
        <p className="mt-1 text-[#5B574E]">{formatDate(wedding.date)}</p>
      </div>
      <Card>
        <dl className="flex flex-col divide-y divide-[#F0ECE3]">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="py-3 first:pt-0 last:pb-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#8A9A7B]">{k}</dt>
                <dd className="mt-0.5 text-[15px] text-[#2F3A28]">{v}</dd>
              </div>
            ))}
        </dl>
      </Card>
      {info.schedule?.length > 0 && (
        <Card>
          <Heading className="mb-3">Schedule</Heading>
          <ol className="flex flex-col gap-2.5">
            {info.schedule.map((s, i) => (
              <li key={i} className="flex gap-3 text-[15px] text-[#2F3A28]">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#8A9A7B]" />
                {s}
              </li>
            ))}
          </ol>
        </Card>
      )}
      {info.faq && Object.keys(info.faq).length > 0 && (
        <Card>
          <Heading className="mb-3">FAQ</Heading>
          <dl className="flex flex-col gap-3">
            {Object.entries(info.faq).map(([q, a]) => (
              <div key={q}>
                <dt className="text-sm font-semibold capitalize text-[#5F6F52]">{q.replace(/_/g, " ")}</dt>
                <dd className="text-[15px] text-[#2F3A28]">{a}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </div>
  );
}

const KIND_ICON: Record<Notification["kind"], string> = {
  message: "💬",
  escalation: "⚠",
  update: "✓",
};

export function Alerts({ notifications, now }: { notifications: Notification[]; now: number }) {
  return (
    <div className="flex flex-col gap-3">
      <Heading className="text-2xl">Alerts</Heading>
      {notifications.length === 0 && <Empty>No alerts yet.</Empty>}
      {notifications.map((n) => (
        <Card
          key={n.id}
          className={`flex gap-3 ${n.read ? "" : "border-l-4 border-[#8A9A7B]"} ${
            n.kind === "escalation" ? "bg-[#FFF8F6]" : ""
          }`}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm ${
              n.kind === "escalation"
                ? "bg-[#F8DAD5] text-[#9A2E1F]"
                : n.kind === "update"
                  ? "bg-[#DCEBD3] text-[#2E5E22]"
                  : "bg-[#EEF1E9] text-[#5F6F52]"
            }`}
            aria-hidden
          >
            {KIND_ICON[n.kind]}
          </span>
          <div className="min-w-0">
            <p className={`text-[15px] text-[#2F3A28] ${n.read ? "" : "font-semibold"}`}>{n.body}</p>
            <p className="mt-0.5 text-xs text-[#8A8578]">{relativeTime(n.created_at, now)}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ActivityFeed({ activity, now }: { activity: Activity[]; now: number }) {
  const sorted = [...activity].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Heading className="text-2xl">Activity</Heading>
        <p className="text-sm text-[#8A8578]">Everything the coordinator did for you</p>
      </div>
      {sorted.length === 0 && <Empty>No activity yet.</Empty>}
      {sorted.length > 0 && (
      <Card className="p-0">
        <ol className="relative">
          {sorted.map((a) => (
            <li
              key={a.id}
              className="pl-fade-in flex gap-3 border-b border-[#F0ECE3] px-4 py-3 last:border-b-0"
            >
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#8A9A7B]" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-snug text-[#2F3A28]">{a.body}</p>
                <p className="mt-0.5 text-xs text-[#8A8578]">{relativeTime(a.created_at, now)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      )}
    </div>
  );
}
