// Shared contract between API routes and UI. Owned by the parent agent.

export type Role = "couple" | "delegate" | "member";
export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";
export type NotificationKind = "message" | "escalation" | "update";
export type AgentEvent = "assigned" | "reply" | "nudge" | "deadline";

export interface WeddingInfo {
  venue: string;
  colors: string;
  bridesmaid_dress: string;
  hotel_block: string;
  schedule: string[];
  faq: Record<string, string>;
}

export interface Wedding {
  id: number;
  name: string;
  date: string; // YYYY-MM-DD
  info: WeddingInfo;
}

export interface Person {
  id: string;
  name: string;
  role: Role;
  title: string | null;
  venmo: string | null;
}

/** An area of work, shown in the UI as an "event" (Bachelorette Weekend, Wedding Day…). */
export interface Area {
  id: string;
  name: string;
  owner_id: string;
  is_surprise: boolean; // hidden from the couple
  date_label: string | null; // e.g. "May 14–16, 2027"
  location: string | null;
  description: string | null;
  details: Record<string, string> | null; // label → value, e.g. { "Airbnb": "…", "Theme": "…" }
}

export interface Task {
  id: number;
  area_id: string;
  assignee_id: string;
  created_by: string;
  title: string;
  details: string | null;
  due_date: string | null; // YYYY-MM-DD
  amount: string | null; // numeric comes back as string
  status: TaskStatus;
  status_note: string | null;
  /** Info the assignee submitted for info-collecting tasks (e.g. flight details). Visible to the
   * assignee and the area owner (API strips it for others). */
  response: string | null;
  is_secret: boolean; // surprise for the bride: hidden from the couple
  awaiting_since: string | null; // ISO timestamp
  nudge_count: number;
  escalated_to: string | null;
  escalation_reason: string | null;
  deadline_reminded_at: string | null; // set when the pre-deadline reminder went out
  overdue_escalated: boolean;
  created_at: string;
  updated_at: string;
  // Present in /api/state responses only:
  pay_url?: string | null; // Venmo link when amount is set and area owner has venmo
}

export interface Message {
  id: number;
  thread_person_id: string;
  sender: string; // 'agent' or a person id
  task_id: number | null;
  body: string;
  created_at: string;
}

export interface Notification {
  id: number;
  person_id: string;
  task_id: number | null;
  kind: NotificationKind;
  body: string;
  read: boolean;
  created_at: string;
}

export interface Activity {
  id: number;
  task_id: number | null;
  body: string;
  created_at: string;
}

/** GET /api/state?viewer={personId} */
export interface StateResponse {
  wedding: Wedding;
  viewer: Person;
  people: Person[];
  areas: Area[]; // areas visible to the viewer (couple: non-surprise only)
  tasks: Task[]; // filtered by visibility rules
  thread: Message[]; // viewer's own thread with the coordinator, oldest first
  notifications: Notification[]; // viewer's, newest first
  activity: Activity[]; // filtered by visibility, newest first, max 50
  escalations: Task[]; // tasks with escalated_to = viewer (couple: also jordan/maya), not resolved
  demoMode: boolean;
}

/** POST /api/tasks */
export interface CreateTaskBody {
  title: string;
  details?: string;
  assigneeId: string;
  areaId: string;
  dueDate?: string;
  amount?: number;
  isSecret?: boolean; // hide from the couple
  createdBy: string;
}

/** POST /api/messages */
export interface PostMessageBody {
  personId: string;
  body: string;
}
