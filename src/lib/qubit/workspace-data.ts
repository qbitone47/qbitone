// ============================================================
// Qubit One — Core Employee Workspace data (Phase 4)
// ============================================================
// The employee's daily workspace reads from the SAME enterprise
// model as every other phase: employees, departments, roles and
// reporting lines come from ./data.ts — never duplicated here.
//
// Fixed demo clock (matches Phase 3 security fixtures):
//   Friday, 13 November 2026, 09:42 IST
// All relative times are hydration-stable because the clock is.
// ============================================================

import type { ScreenId, ScreenParams } from "./screens";
import { employees } from "./data";

// ---------- Demo clock ----------
export const WORKSPACE_NOW = Date.parse("2026-11-13T09:42:00+05:30");
export const WORKSPACE_NOW_LABEL = "Friday, 13 November 2026";
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Build an IST timestamp: dayOffset from today (0 = today), fixed wall-clock time. */
const at = (dayOffset: number, hour: number, minute = 0): number =>
  WORKSPACE_NOW - (9 * HOUR + 42 * MIN) + dayOffset * DAY + hour * HOUR + minute * MIN;

export const ist = (ts: number) => new Date(ts + 330 * 60_000); // shift to IST, read via UTC getters

export const fmtDateTime = (ts: number): string => {
  const d = ist(ts);
  const date = `${String(d.getUTCDate()).padStart(2, "0")} ${d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
  const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return `${date}, ${time}`;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const fmtDate = (ts: number): string => {
  const d = ist(ts);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

export const fmtTime = (ts: number): string => {
  const d = ist(ts);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

/** Stable relative label against the fixed demo clock. */
export const relTime = (ts: number): string => {
  const diff = WORKSPACE_NOW - ts;
  if (diff < 0) {
    const ahead = -diff;
    if (ahead < HOUR) return `in ${Math.max(1, Math.round(ahead / MIN))} min`;
    if (ahead < DAY) return `in ${Math.round(ahead / HOUR)} h`;
    return `in ${Math.round(ahead / DAY)} d`;
  }
  if (diff < MIN) return "just now";
  if (diff < HOUR) return `${Math.round(diff / MIN)} min ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)} h ago`;
  const days = Math.round(diff / DAY);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return fmtDate(ts);
};

// ============================================================
// Tasks (Screen 43)
// ============================================================

export type TaskStatus = "Not Started" | "In Progress" | "Blocked" | "Waiting" | "Completed" | "Cancelled";
export type TaskPriority = "High" | "Medium" | "Low";
export type TaskSource =
  | "Meeting action item"
  | "Workflow"
  | "Manager assignment"
  | "Sales activity"
  | "Service activity"
  | "HR workflow"
  | "Automation"
  | "AI recommendation"
  | "Approval process"
  | "Manual";

export interface Task {
  id: string;
  title: string;
  detail: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** null = no due date */
  due: number | null;
  source: TaskSource;
  /** who assigned / owns the origin */
  ownerId: string;
  assigneeId: string;
  /** business object this task relates to */
  related?: { label: string; kind: "Customer" | "Project" | "Workflow" | "Employee" | "Meeting" | "Ticket"; ref?: string };
  /** AI-generated tasks must be clearly identified */
  aiGenerated?: boolean;
  completedAt?: number;
}

export const TASKS: Task[] = [
  {
    id: "task-118", title: "Review Q4 board deck — revenue & pipeline section",
    detail: "Anita shared the draft for the December board meeting. Check the pipeline assumptions against the Q3 close before Friday.",
    status: "In Progress", priority: "High", due: at(0, 17, 0), source: "Manager assignment", ownerId: "sagar", assigneeId: "sagar",
    related: { label: "Board Meeting — Dec 2026", kind: "Meeting" },
  },
  {
    id: "task-121", title: "Finalise Acme Corp renewal terms with Rahul",
    detail: "Acme asked for a 12% discount on the 3-year renewal. Rahul needs the floor price before the client call on Monday.",
    status: "In Progress", priority: "High", due: at(0, 16, 0), source: "Sales activity", ownerId: "rahul", assigneeId: "sagar",
    related: { label: "Acme Corp · Renewal FY27", kind: "Customer" },
  },
  {
    id: "task-127", title: "Approve revised vendor contract — Brightline Logistics",
    detail: "Legal cleared the liability clause. Finance confirmed payment terms of Net-45. Ready for signature.",
    status: "Waiting", priority: "Medium", due: at(1, 12, 0), source: "Workflow", ownerId: "priya", assigneeId: "sagar",
    related: { label: "Vendor onboarding workflow", kind: "Workflow" },
  },
  {
    id: "task-131", title: "Sign off Q4 hiring plan — 14 open requisitions",
    detail: "Neha's team prepared the hiring plan. Two senior roles (Finance, Service) are behind schedule.",
    status: "Not Started", priority: "Medium", due: at(2, 11, 0), source: "HR workflow", ownerId: "neha", assigneeId: "sagar",
    related: { label: "HR & People · Hiring FY27 Q4", kind: "Project" },
  },
  {
    id: "task-134", title: "Review Qubit AI access-policy proposal",
    detail: "Arjun proposed tightening AI data scopes for the Service module. Needs your approval before the December rollout.",
    status: "Not Started", priority: "Medium", due: at(3, 15, 0), source: "Approval process", ownerId: "arjun", assigneeId: "sagar",
    related: { label: "IT & Technology", kind: "Project" },
  },
  {
    id: "task-139", title: "Prepare town-hall talking points",
    detail: "Quarterly town hall on Monday. Cover: FY27 targets, Bengaluru office expansion, service quality wins.",
    status: "Not Started", priority: "Medium", due: at(3, 10, 0), source: "Manual", ownerId: "sagar", assigneeId: "sagar",
  },
  {
    id: "task-142", title: "Escalation review — Site visit SLA breach (Zenith Manufacturing)",
    detail: "Two field visits breached the 48-hour SLA last week. Vikram prepared the corrective-action summary.",
    status: "Blocked", priority: "High", due: at(-1, 15, 0), source: "Service activity", ownerId: "vikramj", assigneeId: "sagar",
    related: { label: "Zenith Manufacturing · Ticket SV-2214", kind: "Ticket" },
  },
  {
    id: "task-147", title: "Review Bengaluru office lease renewal draft",
    detail: "Operations flagged a 18% rent escalation. Compare with the Whitefield alternative before the ops review.",
    status: "Not Started", priority: "Low", due: at(6, 12, 0), source: "Manual", ownerId: "sanjay", assigneeId: "sagar",
    related: { label: "Operations · Facilities", kind: "Project" },
  },
  {
    id: "task-151", title: "Consolidate department OKRs for FY27",
    detail: "All 8 departments submitted drafts. Consolidate into the company scorecard for the leadership offsite.",
    status: "In Progress", priority: "Medium", due: at(8, 17, 0), source: "Manual", ownerId: "sagar", assigneeId: "sagar",
  },
  {
    id: "task-155", title: "Ping Ankit Sharma — week 2 onboarding check-in",
    detail: "Qubit AI noticed the new sales trainee has not opened the product handbook. Suggested: a 15-minute check-in.",
    status: "Not Started", priority: "Low", due: at(1, 10, 30), source: "AI recommendation", ownerId: "sagar", assigneeId: "sagar",
    aiGenerated: true,
    related: { label: "Ankit Sharma · Onboarding", kind: "Employee" },
  },
  {
    id: "task-158", title: "Complete annual ethics & compliance declaration",
    detail: "Automation: your FY27 declaration is due before payroll lock on 30 November.",
    status: "Not Started", priority: "Medium", due: at(17, 18, 0), source: "Automation", ownerId: "neha", assigneeId: "sagar",
  },
  {
    id: "task-102", title: "Sign Q3 financial statements",
    detail: "Priya's team closed Q3 on 31 Oct. Statements audited and ready for signature.",
    status: "Completed", priority: "High", due: at(-6, 17, 0), source: "Approval process", ownerId: "priya", assigneeId: "sagar",
    completedAt: at(-5, 11, 20),
  },
  {
    id: "task-106", title: "Keynote dry run — Partner Summit",
    detail: "20-minute dry run with marketing. Slides reviewed, demo environment confirmed.",
    status: "Completed", priority: "Medium", due: at(-8, 15, 0), source: "Meeting action item", ownerId: "amit", assigneeId: "sagar",
    completedAt: at(-8, 16, 40),
    related: { label: "Partner Summit 2026", kind: "Meeting" },
  },
  {
    id: "task-109", title: "Approve Diwali bonus framework",
    detail: "HR proposal for FY26 festival bonus. Superseded by the revised compensation cycle.",
    status: "Cancelled", priority: "Low", due: null, source: "HR workflow", ownerId: "neha", assigneeId: "sagar",
  },
];

// Team tasks (for Employee 360 / manager scope — read-only context)
export const TEAM_TASKS: Task[] = [
  { id: "task-201", title: "Send revised proposal to Zenith Manufacturing", detail: "Include the corrected service-level table and the 2-year pricing option.", status: "In Progress", priority: "High", due: at(0, 14, 0), source: "Sales activity", ownerId: "rahul", assigneeId: "rohitv", related: { label: "Zenith Manufacturing", kind: "Customer" } },
  { id: "task-202", title: "Collect Q3 GST documentation from branches", detail: "Bengaluru and Delhi branches pending. Payroll lock on 30 Nov.", status: "Blocked", priority: "High", due: at(-2, 17, 0), source: "Workflow", ownerId: "priya", assigneeId: "tanvi", related: { label: "Finance · Taxation", kind: "Project" } },
  { id: "task-203", title: "Onboarding checklist — Ankit Sharma (day 10)", detail: "ID card issued, mailbox active, product handbook pending acknowledgement.", status: "In Progress", priority: "Medium", due: at(1, 16, 0), source: "HR workflow", ownerId: "neha", assigneeId: "anita", related: { label: "Ankit Sharma", kind: "Employee" } },
  { id: "task-204", title: "Warehouse B stock-take reconciliation", detail: "Second count scheduled for Saturday. Variance currently at 1.8%.", status: "In Progress", priority: "Medium", due: at(2, 18, 0), source: "Manual", ownerId: "karan", assigneeId: "siddharth", related: { label: "Inventory · Warehouse B", kind: "Project" } },
];

export const allTasksFor = (employeeId: string): Task[] =>
  [...TASKS, ...TEAM_TASKS].filter((t) => t.assigneeId === employeeId);

// ============================================================
// Meetings (Screens 44 · 45)
// ============================================================

export type MeetingStatus = "Scheduled" | "In Progress" | "Completed" | "Cancelled";

export interface Meeting {
  id: string;
  title: string;
  start: number;
  end: number;
  organizerId: string;
  participantIds: string[];
  location: string; // room, or platform
  // "Google Meet" / "Room" added in Phase 20 for the New-meeting dialog
  // (createMeeting) — additive only; existing fixtures untouched.
  platform: "Qubit Meet" | "Zoom" | "Microsoft Teams" | "Google Meet" | "Room" | "In person";
  status: MeetingStatus;
  agenda?: string;
  notes?: string;
  actionItems?: { title: string; ownerId: string; due: number | null; /** set by the workspace store when the item has been promoted into My Tasks (Phase 20) */ promoted?: boolean }[];
  /** AI meeting summary — only generated for completed meetings, permission-aware */
  aiSummary?: string;
  /** linked calendar event id */
  eventId?: string;
}

export const MEETINGS: Meeting[] = [
  {
    id: "mtg-311", title: "Leadership standup", start: at(0, 9, 30), end: at(0, 10, 0),
    organizerId: "sagar", participantIds: ["rahul", "priya", "neha", "arjun", "sanjay", "sagar"],
    location: "Qubit Meet · Room 8A", platform: "Qubit Meet", status: "In Progress",
    agenda: "Daily alignment — revenue, hiring, service escalations.",
    eventId: "ev-500",
  },
  {
    id: "mtg-312", title: "Acme Corp renewal — internal alignment", start: at(0, 11, 30), end: at(0, 12, 15),
    organizerId: "rahul", participantIds: ["rahul", "pankaj", "sagar"],
    location: "Microsoft Teams", platform: "Microsoft Teams", status: "Scheduled",
    agenda: "Agree discount floor before Monday's client call. Finance joined for margin check.",
    eventId: "ev-501",
  },
  {
    id: "mtg-313", title: "1:1 — Neha Patel (HR)", start: at(0, 15, 0), end: at(0, 15, 45),
    organizerId: "sagar", participantIds: ["neha", "sagar"],
    location: "Room 8C · Mumbai HQ", platform: "In person", status: "Scheduled",
    agenda: "Q4 hiring plan, HR policy refresh, engagement survey results.",
    eventId: "ev-502",
  },
  {
    id: "mtg-314", title: "Quarterly town hall — Q3 FY26", start: at(3, 16, 0), end: at(3, 17, 0),
    organizerId: "sagar", participantIds: ["rahul", "priya", "neha", "amit", "vikramj", "karan", "arjun", "sanjay"],
    location: "Qubit Meet · All-hands", platform: "Qubit Meet", status: "Scheduled",
    agenda: "FY27 targets, Bengaluru expansion, service quality wins, AMA.",
    eventId: "ev-503",
  },
  {
    id: "mtg-315", title: "Board prep — revenue deep dive", start: at(1, 11, 0), end: at(1, 12, 30),
    organizerId: "priya", participantIds: ["priya", "sagar", "rahul"],
    location: "Zoom", platform: "Zoom", status: "Scheduled",
    agenda: "Walk the revenue section of the board deck; stress-test pipeline assumptions.",
    eventId: "ev-504",
  },
  {
    id: "mtg-316", title: "IT security review — Qubit AI rollout", start: at(4, 10, 0), end: at(4, 11, 0),
    organizerId: "arjun", participantIds: ["arjun", "sagar", "nikhil"],
    location: "Qubit Meet · Room 3B", platform: "Qubit Meet", status: "Scheduled",
    agenda: "AI data scopes, audit trail coverage, December rollout gate.",
    eventId: "ev-505",
  },
  {
    id: "mtg-308", title: "Q3 close review", start: at(-1, 16, 0), end: at(-1, 17, 0),
    organizerId: "priya", participantIds: ["priya", "sagar", "kavita", "tanvi"],
    location: "Qubit Meet", platform: "Qubit Meet", status: "Completed",
    agenda: "Q3 results, tax position, procurement savings.",
    notes: "Q3 closed at ₹42.8 Cr net revenue, +11% YoY. Taxation raised two compliance items before 30 Nov. Procurement delivered ₹1.2 Cr savings vs plan.",
    actionItems: [
      { title: "Share Q3 summary with department heads", ownerId: "priya", due: at(0, 18, 0) },
      { title: "Review taxation compliance items", ownerId: "tanvi", due: at(4, 17, 0) },
    ],
    aiSummary: "Q3 closed strong at ₹42.8 Cr (+11% YoY). Two tax compliance items must be resolved before the 30 Nov payroll lock. Procurement exceeded its savings target by ₹0.3 Cr. No audit flags raised.",
    eventId: "ev-495",
  },
  {
    id: "mtg-309", title: "Vendor negotiation — Brightline Logistics", start: at(-2, 11, 0), end: at(-2, 12, 0),
    organizerId: "sagar", participantIds: ["sagar", "priya", "sanjay"],
    location: "Room 8A · Mumbai HQ", platform: "In person", status: "Completed",
    agenda: "Final liability and payment terms for the 3-year logistics contract.",
    notes: "Brightline accepted Net-45 with 2% early-payment discount. Liability cap raised to 2x contract value.",
    actionItems: [{ title: "Route contract for signature", ownerId: "sanjay", due: at(-1, 17, 0) }],
    eventId: "ev-492",
  },
  {
    id: "mtg-310", title: "Partner Summit keynote dry run", start: at(-8, 15, 0), end: at(-8, 16, 0),
    organizerId: "amit", participantIds: ["amit", "deepak", "sagar"],
    location: "Qubit Meet", platform: "Qubit Meet", status: "Completed",
    agenda: "Dry run of the 20-minute keynote; demo environment check.",
    notes: "Demo ran clean. Marketing to record the backup video on Monday.",
    aiSummary: "Keynote is ready. One risk: live demo depends on the staging environment — marketing will record a backup video. Suggested adding the service-quality story slide after customer wins.",
    eventId: "ev-470",
  },
];

// ============================================================
// Calendar events (Screen 44) — reference meetings + extra types
// ============================================================

export type EventType = "Meeting" | "Deadline" | "Company event" | "Leave" | "Focus time";

export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  start: number;
  end: number;
  allDay?: boolean;
  organizerId: string;
  /** employees who can see details; others see "Busy" */
  visibleTo?: "all" | "organizer-only";
  location?: string;
  meetingId?: string;
  taskId?: string;
  related?: string;
}

export const EVENTS: CalendarEvent[] = [
  // ——— this week (Mon 9 – Fri 13) ———
  { id: "ev-490", title: "Vendor negotiation — Brightline Logistics", type: "Meeting", start: at(-2, 11, 0), end: at(-2, 12, 0), organizerId: "sagar", meetingId: "mtg-309", location: "Room 8A · Mumbai HQ" },
  { id: "ev-491", title: "Warehouse B stock-take prep", type: "Meeting", start: at(-2, 15, 0), end: at(-2, 15, 45), organizerId: "karan", location: "Qubit Meet" },
  { id: "ev-492", title: "Board deck — numbers lock", type: "Deadline", start: at(-1, 18, 0), end: at(-1, 18, 30), organizerId: "priya", taskId: "task-118", related: "task-118" },
  { id: "ev-493", title: "Q3 close review", type: "Meeting", start: at(-1, 16, 0), end: at(-1, 17, 0), organizerId: "priya", meetingId: "mtg-308", location: "Qubit Meet" },
  { id: "ev-494", title: "Diwali celebration — Mumbai HQ", type: "Company event", start: at(-3, 15, 0), end: at(-3, 18, 0), organizerId: "neha", allDay: false, location: "Atrium · Mumbai HQ", related: "Organised by HR & People" },
  { id: "ev-495", title: "Divya Nair — approved leave", type: "Leave", start: at(-3, 0, 0), end: at(1, 23, 59), allDay: true, organizerId: "divya", visibleTo: "all", related: "Approved · HR & People" },
  { id: "ev-496", title: "Focus time — board deck review", type: "Focus time", start: at(0, 14, 0), end: at(0, 15, 0), organizerId: "sagar", related: "Held for task-118" },
  { id: "ev-500", title: "Leadership standup", type: "Meeting", start: at(0, 9, 30), end: at(0, 10, 0), organizerId: "sagar", meetingId: "mtg-311", location: "Qubit Meet · Room 8A" },
  { id: "ev-501", title: "Acme Corp renewal — internal alignment", type: "Meeting", start: at(0, 11, 30), end: at(0, 12, 15), organizerId: "rahul", meetingId: "mtg-312", location: "Microsoft Teams" },
  { id: "ev-502", title: "1:1 — Neha Patel (HR)", type: "Meeting", start: at(0, 15, 0), end: at(0, 15, 45), organizerId: "sagar", meetingId: "mtg-313", location: "Room 8C · Mumbai HQ" },
  { id: "ev-506", title: "Expenses — Q3 card statement", type: "Deadline", start: at(1, 17, 0), end: at(1, 17, 30), organizerId: "priya", related: "Finance deadline" },
  { id: "ev-504", title: "Board prep — revenue deep dive", type: "Meeting", start: at(1, 11, 0), end: at(1, 12, 30), organizerId: "priya", meetingId: "mtg-315", location: "Zoom" },
  { id: "ev-503", title: "Quarterly town hall — Q3 FY26", type: "Meeting", start: at(3, 16, 0), end: at(3, 17, 0), organizerId: "sagar", meetingId: "mtg-314", location: "Qubit Meet · All-hands" },
  { id: "ev-505", title: "IT security review — Qubit AI rollout", type: "Meeting", start: at(4, 10, 0), end: at(4, 11, 0), organizerId: "arjun", meetingId: "mtg-316", location: "Qubit Meet · Room 3B" },
  { id: "ev-507", title: "Brightline contract — signature deadline", type: "Deadline", start: at(4, 17, 0), end: at(4, 17, 30), organizerId: "sanjay", related: "task-127" },
  // ——— next week ———
  { id: "ev-510", title: "Acme Corp — client call", type: "Meeting", start: at(4, 15, 0), end: at(4, 15, 45), organizerId: "rahul", location: "Microsoft Teams" },
  { id: "ev-511", title: "Payroll lock — November", type: "Deadline", start: at(16, 23, 59), end: at(16, 23, 59), allDay: true, organizerId: "priya" },
  { id: "ev-512", title: "Leadership offsite — FY27 planning", type: "Company event", start: at(20, 9, 0), end: at(21, 18, 0), allDay: true, organizerId: "sagar", location: "Lonavala" },
  { id: "ev-513", title: "Compensation review — prep", type: "Meeting", start: at(1, 9, 0), end: at(1, 9, 45), organizerId: "neha", visibleTo: "organizer-only", location: "Room 2F" },
];

// ============================================================
// Approvals (Screen 46) — the approver's inbox.
// Distinct from the Approval Matrix (screen 09), which is the
// org-level configuration this queue is validated against.
// ============================================================

export type ApprovalKind =
  | "Leave request"
  | "Expense claim"
  | "Purchase request"
  | "Quotation discount"
  | "Access request"
  | "Employee workflow"
  | "Contract approval";

export type ApprovalState = "Pending" | "Approved" | "Rejected" | "Changes requested";

export interface ApprovalRequest {
  id: string;
  kind: ApprovalKind;
  title: string;
  requesterId: string;
  department: string;
  amount?: number; // INR
  submitted: number;
  priority: "High" | "Medium" | "Low";
  status: ApprovalState;
  /** approval-matrix rule that routed this request (screen 09 reference) */
  rule: string;
  sla: string;
  /** sensitive approvals require step-up authentication before decision */
  stepUpRequired?: boolean;
  detail: string;
  history?: { at: number; actor: string; event: string }[];
  decidedAt?: number;
  decisionNote?: string;
  decidedBy?: string;
}

export const APPROVALS: ApprovalRequest[] = [
  {
    id: "apr-508", kind: "Expense claim", title: "Client entertainment — Zenith Manufacturing visit",
    requesterId: "rohitv", department: "Sales", amount: 18400, submitted: at(-4, 11, 20),
    priority: "Medium", status: "Pending", rule: "Expense · ₹10,001–₹50,000 → Department Head", sla: "3 working days",
    detail: "Dinner with Zenith procurement team during the site visit on 8 Nov. 4 people · GST invoice attached.",
    history: [{ at: at(-4, 11, 20), actor: "Rohit Verma", event: "Submitted" }, { at: at(-4, 12, 5), actor: "System", event: "Routed via Approval Matrix → Department Head (Sales)" }],
  },
  {
    id: "apr-509", kind: "Leave request", title: "Earned leave — Meera Iyer (5 days)",
    requesterId: "meera", department: "Sales", submitted: at(-1, 9, 15),
    priority: "Low", status: "Pending", rule: "Leave · Employee → Reporting manager", sla: "2 working days",
    detail: "23–27 November. Backup coverage: Pankaj Sharma. No customer meetings scheduled in the window.",
    history: [{ at: at(-1, 9, 15), actor: "Meera Iyer", event: "Submitted" }],
  },
  {
    id: "apr-510", kind: "Purchase request", title: "Warehouse automation — 4 conveyor units",
    requesterId: "karan", department: "Inventory", amount: 1275000, submitted: at(-3, 14, 40),
    priority: "High", status: "Pending", rule: "Purchase · > ₹10,00,000 → Final authority (CEO)", sla: "5 working days",
    stepUpRequired: true,
    detail: "Warehouse B expansion. Vendor: Streamline Systems. Includes installation and 3-year service. Finance pre-check passed; ROI model attached in the request workspace.",
    history: [{ at: at(-3, 14, 40), actor: "Karan Mehta", event: "Submitted" }, { at: at(-3, 15, 2), actor: "System", event: "Routed via Approval Matrix → Final authority (> ₹10,00,000)" }, { at: at(-2, 10, 0), actor: "Priya Sharma", event: "Finance pre-approval recorded" }],
  },
  {
    id: "apr-511", kind: "Quotation discount", title: "Acme Corp renewal — 12% discount request",
    requesterId: "rahul", department: "Sales", amount: 3840000, submitted: at(0, 8, 55),
    priority: "High", status: "Pending", rule: "Discount · > 10% → Sales Head + Final authority", sla: "1 working day",
    detail: "3-year renewal worth ₹3.84 Cr. Sales Head approves up to 10%; the extra 2% needs final authority. Rahul's note: competitive pressure from a new entrant; floor price already vetted by finance.",
    history: [{ at: at(0, 8, 55), actor: "Rahul Mehta", event: "Submitted" }, { at: at(0, 9, 1), actor: "System", event: "Routed via Approval Matrix → Final authority" }],
  },
  {
    id: "apr-512", kind: "Access request", title: "Role access — Finance Analyst → Finance Manager (temporary)",
    requesterId: "rameshb", department: "Finance", submitted: at(-2, 16, 30),
    priority: "Medium", status: "Pending", rule: "Access · Role elevation → Manager + Security review", sla: "2 working days",
    detail: "Kavita Joshi on maternity cover from 1 Dec for 60 days. Requesting temporary elevation with month-end close permissions. Justification and approval path recorded in the access request (req-118).",
    history: [{ at: at(-2, 16, 30), actor: "Ramesh Bhatt", event: "Submitted" }, { at: at(-2, 16, 31), actor: "System", event: "Security review required — routed with final authority" }],
  },
  {
    id: "apr-513", kind: "Employee workflow", title: "Probation confirmation — Sneha Gupta",
    requesterId: "neha", department: "Operations", submitted: at(0, 9, 10),
    priority: "Medium", status: "Pending", rule: "Lifecycle · Probation confirmation → Manager + HR Head", sla: "3 working days",
    detail: "Sneha joined 1 Oct 2025 (Business Analyst). Manager rating: meets expectations. HR recommends confirmation with the standard band increment.",
    history: [{ at: at(0, 9, 10), actor: "Neha Patel", event: "Submitted" }],
  },
  {
    id: "apr-505", kind: "Contract approval", title: "Brightline Logistics — 3-year contract",
    requesterId: "sanjay", department: "Operations", amount: 8640000, submitted: at(-2, 10, 5),
    priority: "High", status: "Pending", rule: "Contract · > ₹50,00,000 → Final authority", sla: "5 working days",
    stepUpRequired: true,
    detail: "Negotiated terms: Net-45 with 2% early-payment discount, liability cap at 2x contract value. Legal sign-off recorded 12 Nov.",
    history: [{ at: at(-2, 10, 5), actor: "Sanjay Gupta", event: "Submitted" }, { at: at(-1, 11, 0), actor: "System", event: "Legal sign-off attached" }],
  },
  // ——— decision history ———
  {
    id: "apr-498", kind: "Expense claim", title: "Partner Summit booth — final invoice",
    requesterId: "amit", department: "Marketing", amount: 465000, submitted: at(-6, 12, 0),
    priority: "Medium", status: "Approved", rule: "Expense · ₹50,001–₹5,00,000 → Finance Head + Final authority", sla: "4 working days",
    detail: "Summit booth balance payment to ExpoGen Events Pvt Ltd.",
    history: [{ at: at(-6, 12, 0), actor: "Amit Verma", event: "Submitted" }, { at: at(-5, 10, 30), actor: "Priya Sharma", event: "Finance approval recorded" }, { at: at(-5, 11, 45), actor: "Sagar Singh", event: "Approved" }],
    decidedAt: at(-5, 11, 45), decidedBy: "sagar", decisionNote: "Within summit budget. Approved.",
  },
  {
    id: "apr-499", kind: "Purchase request", title: "Standing desks — Bengaluru office (phase 2)",
    requesterId: "sanjay", department: "Operations", amount: 89000, submitted: at(-7, 15, 0),
    priority: "Low", status: "Changes requested", rule: "Purchase · ₹50,001–₹1,00,000 → Operations Head + Finance", sla: "4 working days",
    detail: "34 desks for the new Bengaluru floor.",
    history: [{ at: at(-7, 15, 0), actor: "Sanjay Gupta", event: "Submitted" }, { at: at(-6, 9, 40), actor: "Sagar Singh", event: "Changes requested — add the Whitefield comparison before re-submission" }],
    decidedAt: at(-6, 9, 40), decidedBy: "sagar", decisionNote: "Add the Whitefield comparison before re-submission.",
  },
  {
    id: "apr-500", kind: "Quotation discount", title: "Zenith Manufacturing — 15% discount (rejected)",
    requesterId: "rohitv", department: "Sales", amount: 980000, submitted: at(-9, 10, 0),
    priority: "High", status: "Rejected", rule: "Discount · > 10% → Sales Head + Final authority", sla: "1 working day",
    detail: "15% on the annual service contract. Margin impact -6.2%.",
    history: [{ at: at(-9, 10, 0), actor: "Rohit Verma", event: "Submitted" }, { at: at(-8, 14, 20), actor: "Sagar Singh", event: "Rejected — below margin floor; counter at 8% with reduced scope" }],
    decidedAt: at(-8, 14, 20), decidedBy: "sagar", decisionNote: "Below margin floor. Counter at 8% with reduced scope.",
  },
];

// ============================================================
// Documents (Screen 47)
// ============================================================

export type DocCategory = "Personal" | "Shared with me" | "HR" | "Company" | "Workflow";

export interface WorkspaceDoc {
  id: string;
  name: string;
  type: "PDF" | "DOCX" | "XLSX" | "PPTX" | "PNG";
  category: DocCategory;
  ownerId: string;
  sizeKb: number;
  modified: number;
  sensitivity: "Public" | "Internal" | "Confidential" | "Restricted";
  starred?: boolean;
  linked?: { label: string; screen: ScreenId }[];
  description?: string;
}

export const DOCUMENTS: WorkspaceDoc[] = [
  { id: "doc-701", name: "Q4 Board Deck — draft v4.pptx", type: "PPTX", category: "Shared with me", ownerId: "priya", sizeKb: 8420, modified: at(0, 8, 12), sensitivity: "Confidential", starred: true, description: "December board meeting draft. Revenue section owner: Sagar.", linked: [{ label: "task-118 · Review Q4 board deck", screen: "my-tasks" }] },
  { id: "doc-702", name: "Acme Corp — Renewal FY27 Proposal.pdf", type: "PDF", category: "Shared with me", ownerId: "rahul", sizeKb: 1240, modified: at(-1, 17, 30), sensitivity: "Confidential", description: "3-year renewal proposal with the 12% discount option.", linked: [{ label: "apr-511 · Quotation discount approval", screen: "my-approvals" }] },
  { id: "doc-703", name: "Employment agreement — Sagar Singh.pdf", type: "PDF", category: "HR", ownerId: "neha", sizeKb: 380, modified: at(-650, 10, 0), sensitivity: "Restricted", description: "Your signed employment agreement. Managed by HR; visible to you and HR only." },
  { id: "doc-704", name: "FY27 compensation letter.pdf", type: "PDF", category: "HR", ownerId: "neha", sizeKb: 210, modified: at(-120, 9, 0), sensitivity: "Restricted", description: "Annual compensation letter issued 15 Jul 2026." },
  { id: "doc-705", name: "Employee Handbook 2026.pdf", type: "PDF", category: "Company", ownerId: "neha", sizeKb: 5210, modified: at(-40, 11, 0), sensitivity: "Public", starred: true, description: "Policies, code of conduct, benefits. Latest revision 04 Oct 2026." },
  { id: "doc-706", name: "Qubit One — Brand Guidelines v3.pdf", type: "PDF", category: "Company", ownerId: "amit", sizeKb: 18400, modified: at(-75, 14, 0), sensitivity: "Internal", description: "Logo usage, voice, templates." },
  { id: "doc-707", name: "FY27 OKR worksheet — Executive.xlsx", type: "XLSX", category: "Personal", ownerId: "sagar", sizeKb: 96, modified: at(-2, 18, 40), sensitivity: "Internal", description: "Consolidation sheet for the leadership offsite (task-151)." },
  { id: "doc-708", name: "Town hall — talking points.docx", type: "DOCX", category: "Personal", ownerId: "sagar", sizeKb: 44, modified: at(0, 7, 55), sensitivity: "Internal", description: "Draft notes for Monday's town hall (task-139)." },
  { id: "doc-709", name: "Brightline Logistics — Contract final.pdf", type: "PDF", category: "Workflow", ownerId: "sanjay", sizeKb: 980, modified: at(-1, 11, 0), sensitivity: "Confidential", description: "3-year logistics contract pending signature (apr-505).", linked: [{ label: "apr-505 · Contract approval", screen: "my-approvals" }] },
  { id: "doc-710", name: "Warehouse automation — ROI model.xlsx", type: "XLSX", category: "Workflow", ownerId: "karan", sizeKb: 156, modified: at(-3, 15, 10), sensitivity: "Internal", description: "Attachment to purchase request apr-510." },
  { id: "doc-711", name: "Q3 FY26 — Financial statements.pdf", type: "PDF", category: "Shared with me", ownerId: "priya", sizeKb: 2100, modified: at(-5, 16, 0), sensitivity: "Confidential", description: "Audited Q3 statements (task-102 sign-off)." },
  { id: "doc-712", name: "Zenith SLA breach — corrective actions.docx", type: "DOCX", category: "Shared with me", ownerId: "vikramj", sizeKb: 88, modified: at(-1, 9, 30), sensitivity: "Internal", description: "Field service escalation summary (task-142)." },
  { id: "doc-713", name: "Org photo — Diwali 2026.png", type: "PNG", category: "Company", ownerId: "neha", sizeKb: 4200, modified: at(-3, 19, 0), sensitivity: "Internal", description: "Diwali celebration at Mumbai HQ." },
];

// ============================================================
// Notifications (Screen 48) — deep-linked into the same OS
// ============================================================

export type NotificationCategory =
  | "Tasks" | "Approvals" | "Meetings" | "HR" | "Sales" | "Finance" | "Service" | "System" | "Security" | "Collaboration";

export interface WorkspaceNotification {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  ts: number;
  unread: boolean;
  priority: "High" | "Medium" | "Low";
  source: string;
  /** deep link into the same Qubit One operating system */
  link?: { screen: ScreenId; params?: ScreenParams };
}

export const NOTIFICATIONS: WorkspaceNotification[] = [
  { id: "ntf-901", title: "Discount approval needs your decision", body: "Rahul Mehta requested a 12% discount on the Acme Corp renewal (₹38.4 L). Sales Head approved up to 10% — final authority required.", category: "Approvals", ts: at(0, 8, 56), unread: true, priority: "High", source: "Approvals", link: { params: { approvalId: "apr-511" }, screen: "my-approvals" } },
  { id: "ntf-902", title: "Two tasks are overdue", body: "Escalation review — Zenith Manufacturing was due yesterday. Review before the leadership standup tomorrow.", category: "Tasks", ts: at(0, 7, 30), unread: true, priority: "High", source: "Tasks", link: { params: { taskId: "task-142" }, screen: "my-tasks" } },
  { id: "ntf-903", title: "Leadership standup starts in 18 minutes", body: "Room 8A · Qubit Meet. 6 participants. Today: revenue, hiring, service escalations.", category: "Meetings", ts: at(0, 9, 12), unread: true, priority: "Medium", source: "Meetings", link: { params: { meetingId: "mtg-311" }, screen: "my-meetings" } },
  { id: "ntf-904", title: "New sign-in from an unrecognised device", body: "Chrome on Windows · Pune, India · 07:58 IST. If this was you, no action is needed. Reviewed in Security Center.", category: "Security", ts: at(0, 8, 2), unread: true, priority: "High", source: "Security", link: { screen: "security-center" } },
  { id: "ntf-905", title: "Q3 financial statements are ready", body: "Priya Sharma shared the audited Q3 statements. Your sign-off task was completed on 7 Nov.", category: "Finance", ts: at(-1, 16, 5), unread: false, priority: "Medium", source: "Finance", link: { screen: "my-documents" } },
  { id: "ntf-906", title: "Probation confirmation — Sneha Gupta", body: "HR recommends confirmation with the standard band increment. Manager rating recorded.", category: "HR", ts: at(0, 9, 11), unread: false, priority: "Medium", source: "HR & People", link: { params: { approvalId: "apr-513" }, screen: "my-approvals" } },
  { id: "ntf-907", title: "Priya Sharma mentioned you", body: "\u201c@Sagar — the revenue assumptions are on slide 12. Can you check the pipeline stress-test before Friday?\u201d", category: "Collaboration", ts: at(-1, 15, 22), unread: false, priority: "Low", source: "Board deck · Comments", link: { screen: "my-documents" } },
  { id: "ntf-908", title: "Acme Corp asked for revised terms", body: "Meera Iyer: \u201cClient wants the 12% on paper before Monday's call.\u201d Internal alignment at 11:30 today.", category: "Sales", ts: at(0, 8, 40), unread: false, priority: "High", source: "Sales · Acme Corp", link: { params: { meetingId: "mtg-312" }, screen: "my-meetings" } },
  { id: "ntf-909", title: "Site visit SLA breached — Zenith Manufacturing", body: "Two visits exceeded the 48-hour SLA. Corrective-action summary is ready for review.", category: "Service", ts: at(-1, 10, 0), unread: false, priority: "High", source: "Service", link: { params: { taskId: "task-142" }, screen: "my-tasks" } },
  { id: "ntf-910", title: "Scheduled maintenance — Saturday 14 Nov, 22:00–00:30 IST", body: "Qubit One will be read-only during the window. No action needed; mail and approvals resume after.", category: "System", ts: at(-2, 12, 0), unread: false, priority: "Low", source: "IT & Technology" },
  { id: "ntf-911", title: "Welcome to Qubit One, Ankit!", body: "Automation: the Sales Trainee onboarding journey started 5 Oct. Day-40 check-in suggestion is in your tasks.", category: "HR", ts: at(-2, 9, 0), unread: false, priority: "Low", source: "HR & People", link: { params: { taskId: "task-155" }, screen: "my-tasks" } },
  { id: "ntf-912", title: "Warehouse automation ROI passed pre-check", body: "Finance pre-approved the ₹12.75 L purchase request. Final authority decision is pending with you.", category: "Finance", ts: at(-2, 10, 0), unread: false, priority: "Medium", source: "Finance", link: { params: { approvalId: "apr-510" }, screen: "my-approvals" } },
];

// ============================================================
// Activity (Screen 49) — personal timeline.
// Distinct from the enterprise Audit Log (screen 39): this is
// the employee-facing view of their own work events.
// ============================================================

export type ActivityType =
  | "Task completed" | "Meeting attended" | "Document uploaded" | "Approval performed"
  | "Profile change" | "Workflow action" | "Comment" | "Mail sent" | "Security event" | "Access change";

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  ts: number;
  related?: { label: string; screen: ScreenId; params?: ScreenParams };
  /** security events surface only the user's own events here, with a link to the authoritative audit trail */
  security?: boolean;
}

export const ACTIVITY: ActivityEntry[] = [
  { id: "act-801", type: "Mail sent", title: "Sent \u201cQ3 board deck — final for review\u201d", detail: "To Priya Sharma, Rahul Mehta. 1 attachment.", ts: at(0, 8, 30), related: { label: "Open Sent mail", screen: "sent-mail" } },
  { id: "act-802", type: "Comment", title: "Commented on the Q4 board deck", detail: "\u201cSlide 12 — pipeline stress-test uses the conservative case. Sign-off after the Acme decision.\u201d", ts: at(0, 8, 10), related: { label: "Q4 Board Deck — draft v4", screen: "my-documents" } },
  { id: "act-803", type: "Document uploaded", title: "Uploaded \u201cTown hall — talking points.docx\u201d", detail: "Personal work document · visible to you.", ts: at(0, 7, 55), related: { label: "My Documents", screen: "my-documents" } },
  { id: "act-804", type: "Security event", title: "Signed in from a new device", detail: "Chrome · Windows · Pune, India. MFA verified with authenticator app. This is your event; the authoritative record lives in the Audit Log.", ts: at(0, 7, 58), security: true, related: { label: "View in Audit Log", screen: "audit-log" } },
  { id: "act-805", type: "Task completed", title: "Completed \u201cSign Q3 financial statements\u201d", detail: "Assigned by Priya Sharma · completed 1 day before due.", ts: at(-5, 11, 20), related: { label: "My Tasks", screen: "my-tasks" } },
  { id: "act-806", type: "Approval performed", title: "Approved \u201cPartner Summit booth — final invoice\u201d", detail: "₹4,65,000 · within summit budget. Decision recorded with audit reference.", ts: at(-5, 11, 45), related: { label: "My Approvals", screen: "my-approvals" } },
  { id: "act-807", type: "Meeting attended", title: "Attended \u201cQ3 close review\u201d", detail: "With Priya Sharma, Kavita Joshi, Tanvi Shah. AI summary available.", ts: at(-1, 16, 0), related: { label: "Open meeting", screen: "my-meetings" } },
  { id: "act-808", type: "Workflow action", title: "Requested changes on \u201cStanding desks — Bengaluru (phase 2)\u201d", detail: "\u201cAdd the Whitefield comparison before re-submission.\u201d", ts: at(-6, 9, 40), related: { label: "My Approvals", screen: "my-approvals" } },
  { id: "act-809", type: "Meeting attended", title: "Attended \u201cVendor negotiation — Brightline Logistics\u201d", detail: "Agreed Net-45 terms; liability cap 2x. Action item routed to Sanjay Gupta.", ts: at(-2, 11, 0), related: { label: "Open meeting", screen: "my-meetings" } },
  { id: "act-810", type: "Profile change", title: "Updated work phone number", detail: "Changed from +91 98200 10001 to +91 98200 10901. Change recorded in your activity.", ts: at(-4, 12, 10) },
  { id: "act-811", type: "Document uploaded", title: "Uploaded \u201cFY27 OKR worksheet — Executive.xlsx\u201d", detail: "Shared with department heads.", ts: at(-2, 18, 40), related: { label: "My Documents", screen: "my-documents" } },
  { id: "act-812", type: "Task completed", title: "Completed \u201cKeynote dry run — Partner Summit\u201d", detail: "Action item from Partner Summit planning meeting.", ts: at(-8, 16, 40), related: { label: "My Tasks", screen: "my-tasks" } },
  { id: "act-813", type: "Access change", title: "Reviewed Qubit AI access-policy proposal", detail: "Assigned by Arjun Nair. Decision pending (task-134).", ts: at(-3, 15, 5), related: { label: "My Tasks", screen: "my-tasks" } },
  { id: "act-814", type: "Meeting attended", title: "Attended \u201cPartner Summit keynote dry run\u201d", detail: "With Amit Verma, Deepak Kumar.", ts: at(-8, 15, 0), related: { label: "Open meeting", screen: "my-meetings" } },
];

// ============================================================
// Mail (Screens 55–58)
// ============================================================

export type MailFolder = "inbox" | "sent" | "drafts" | "archive";
export type MailLabel = "Board" | "Finance" | "Sales" | "HR" | "Legal" | "Service" | "IT" | "Marketing";
export type SentStatus = "Sent" | "Delivered" | "Pending" | "Failed";

export interface MailAttachment {
  name: string;
  sizeKb: number;
  type: "PDF" | "XLSX" | "DOCX" | "PPTX" | "PNG";
}

export interface MailMessage {
  id: string;
  folder: MailFolder;
  threadOf?: string;
  fromId: string | null; // null = external sender
  fromExternal?: { name: string; email: string };
  to: string[]; // employee ids or external emails
  cc?: string[];
  bcc?: string[];
  subject: string;
  preview: string;
  body: string;
  ts: number;
  read: boolean;
  starred?: boolean;
  priority?: "High" | "Low";
  labels?: MailLabel[];
  attachments?: MailAttachment[];
  /** sent-only */
  sendStatus?: SentStatus;
  sendDetail?: string;
}

export const MAIL: MailMessage[] = [
  // ——— Inbox ———
  {
    id: "m-101", folder: "inbox", fromId: "priya", to: ["sagar"], subject: "Q4 board deck — final for review",
    preview: "Slide 12 has the pipeline stress-test. Two open items before we lock numbers on Friday: the Acme renewal assumption and the Brightline contract timing.",
    body: "Hi Sagar,\n\nSlide 12 now carries the pipeline stress-test (conservative case included). Two open items before we lock numbers on Friday:\n\n1. The Acme renewal assumption — currently modelled at 3 years, ₹3.84 Cr. If the discount lands at 12% instead of 10%, Q4 revenue shifts by ₹2.1 L.\n2. Brightline contract timing — if signature slips past 20 Nov, the FY26 cost line moves to January.\n\nEverything else matches the version we discussed on Tuesday. Comments are open on slide 12.\n\nThanks,\nPriya",
    ts: at(0, 8, 5), read: false, starred: true, labels: ["Board", "Finance"], priority: "High",
    attachments: [{ name: "Q4-Board-Deck-v4.pptx", sizeKb: 8420, type: "PPTX" }],
  },
  {
    id: "m-102", folder: "inbox", fromId: "rahul", to: ["sagar"], cc: ["pankaj"], subject: "RE: Acme Corp renewal — revised commercial terms",
    preview: "Client wants the 12% on paper before Monday's 10:30 call. Finance has vetted the floor price. Requesting final authority sign-off today.",
    body: "Sagar,\n\nUpdate from this morning's standup: the client wants the 12% on paper before Monday's 10:30 call. Finance has vetted the floor price (Priya is on CC).\n\nThe formal discount approval is already in your approvals queue — if you can decide today, we send the revised proposal this evening and hold the Monday slot for close.\n\nRahul",
    ts: at(0, 9, 15), read: false, labels: ["Sales"], priority: "High",
  },
  {
    id: "m-103", folder: "inbox", fromId: "arjun", to: ["sagar"], subject: "Qubit AI access-policy proposal — ready for your review",
    preview: "Tightened AI data scopes for the Service module: agents get AI summaries only for tickets they own. Audit trail coverage is complete. Task and proposal attached.",
    body: "Hi Sagar,\n\nThe Qubit AI access-policy proposal is ready for your review (task-134 in your workspace).\n\nKey changes:\n- Service agents receive AI summaries only for tickets they own — no cross-team leakage.\n- Sensitive AI actions (role data, financial summaries) require human approval, same as Phase 3 boundaries.\n- Every AI query writes an audit event; denials are recorded with reason codes.\n\nSecurity review is scheduled for Tuesday 10:00. Would like your approval before the December rollout gate.\n\nArjun",
    ts: at(-1, 17, 45), read: false, labels: ["IT"], attachments: [{ name: "AI-access-policy-proposal.pdf", sizeKb: 640, type: "PDF" }],
  },
  {
    id: "m-104", folder: "inbox", fromId: "neha", to: ["sagar"], subject: "Probation confirmation — Sneha Gupta (Operations)",
    preview: "Sneha completes probation on 31 Dec. Manager rating: meets expectations. Recommending confirmation with the standard band increment. Details in the approval.",
    body: "Hi Sagar,\n\nSneha Gupta (Business Analyst, Operations) completes probation on 31 December. Sanjay's rating: meets expectations; her stakeholder feedback from Finance is positive.\n\nRecommending confirmation with the standard band increment. The confirmation request is in your approvals queue — SLA is 3 working days.\n\nNeha",
    ts: at(0, 9, 11), read: true, labels: ["HR"],
  },
  {
    id: "m-105", folder: "inbox", fromId: "vikramj", to: ["sagar"], subject: "Zenith Manufacturing — SLA breach and corrective actions",
    preview: "Two field visits breached the 48-hour SLA last week (spare-part delay from the Pune hub). Corrective summary attached; escalation task is in your queue.",
    body: "Sagar,\n\nTwo Zenith Manufacturing visits breached the 48-hour SLA last week — root cause was a spare-part delay from the Pune hub (part SV-4471 was out of stock for 36 hours).\n\nCorrective actions: (1) minimum-stock threshold raised for the top 20 spare parts, (2) a backup supplier for SV-4471 is being onboarded, (3) the affected customer has been given a service credit.\n\nSummary attached. The escalation review task is in your queue.\n\nVikram",
    ts: at(-1, 9, 30), read: true, labels: ["Service"],
    attachments: [{ name: "Zenith-SLA-corrective-actions.docx", sizeKb: 88, type: "DOCX" }],
  },
  {
    id: "m-106", folder: "inbox", fromId: "sanjay", to: ["sagar"], cc: ["priya"], subject: "Brightline Logistics — contract ready for signature",
    preview: "Legal signed off yesterday. Net-45 with 2% early-payment discount, liability cap at 2x. Contract approval is in your queue; signature deadline is 17 Nov.",
    body: "Sagar,\n\nLegal signed off yesterday. Final terms: Net-45 with 2% early-payment discount; liability cap raised to 2x contract value (their original was 0.5x, so this is a strong outcome).\n\nThe contract approval is in your queue — signature deadline is 17 November to keep the 1 December go-live.\n\nSanjay",
    ts: at(-1, 11, 5), read: true, labels: ["Legal"], priority: "High",
  },
  {
    id: "m-107", folder: "inbox", fromExternal: { name: "Ananya Krishnan", email: "ananya.krishnan@acmecorp.in" }, fromId: null, to: ["sagar.singh@qubitone.in"],
    subject: "RE: Renewal discussion — confirming Monday 10:30 IST",
    preview: "Confirming Monday's call. Our procurement team will join. We would like the revised proposal shared 24 hours before the call, as discussed with Rahul.",
    body: "Dear Mr. Singh,\n\nConfirming Monday's call at 10:30 IST. Our procurement head, Mr. Deshpande, will join.\n\nAs discussed with Rahul, we would appreciate the revised proposal 24 hours before the call. The multi-year structure works for us provided the commercial terms are settled.\n\nBest regards,\nAnanya Krishnan\nProcurement Lead, Acme Corp",
    ts: at(-1, 14, 20), read: true, starred: true,
  },
  {
    id: "m-108", folder: "inbox", fromId: "amit", to: ["sagar"], subject: "Partner Summit — outcomes and follow-ups",
    preview: "214 partner leads captured, 38 qualified. Keynote NPS 72. Deck and lead list attached; the recap one-pager goes to all heads today.",
    body: "Sagar,\n\nPartner Summit wrap-up: 214 partner leads captured, 38 qualified for follow-up (list attached). Keynote NPS came in at 72.\n\nFollow-ups this week: recap one-pager to all department heads (today), qualified-lead routing to sales by Friday, and the backup demo video recorded Monday.\n\nAmit",
    ts: at(-3, 10, 15), read: true, labels: ["Marketing"],
    attachments: [{ name: "Summit-leads-qualified.xlsx", sizeKb: 214, type: "XLSX" }, { name: "Keynote-final.pptx", sizeKb: 15200, type: "PPTX" }],
  },
  {
    id: "m-109", folder: "inbox", fromId: "kavita", to: ["sagar"], subject: "November payroll calendar",
    preview: "Payroll lock on 30 Nov, 18:00. Leave approvals for the month must be decided by 28 Nov so accruals stay correct.",
    body: "Hi Sagar,\n\nPayroll lock is 30 November, 18:00. Leave approvals for November must be decided by the 28th for accruals to stay correct — Meera's request is already in your queue.\n\nAlso note the ethics declaration deadline (30 Nov) gates payroll for everyone including leadership.\n\nKavita",
    ts: at(-2, 9, 0), read: true, labels: ["Finance"],
  },
  {
    id: "m-110", folder: "inbox", fromExternal: { name: "Streamline Systems", email: "sales@streamline-systems.com" }, fromId: null, to: ["sagar.singh@qubitone.in"],
    subject: "Warehouse automation — revised quotation QTN-8841",
    preview: "Revised quotation attached: 4 conveyor units with installation and 3-year service. Valid until 30 November. Looking forward to the partnership.",
    body: "Dear Sir,\n\nPlease find the revised quotation QTN-8841 attached: four conveyor units including installation and a 3-year service plan, per the site survey of 6 November.\n\nThe quotation is valid until 30 November. We remain available for a technical call at your convenience.\n\nWarm regards,\nStreamline Systems Pvt Ltd",
    ts: at(-3, 16, 40), read: true,
    attachments: [{ name: "QTN-8841-revised.pdf", sizeKb: 512, type: "PDF" }],
  },
  {
    id: "m-111", folder: "inbox", fromId: "anita", to: ["sagar"], subject: "Welcome kit — Ankit Sharma, Sales Trainee",
    preview: "Ankit's ID card, mailbox and system access are all active. Product handbook acknowledgement is pending — Qubit AI flagged a check-in suggestion.",
    body: "Hi Sagar,\n\nQuick update on Ankit Sharma (Sales Trainee, started 5 Oct): ID card issued, mailbox active, Qubit One access provisioned with the Sales Executive base role.\n\nPending: product handbook acknowledgement. Qubit AI surfaced a check-in suggestion in your tasks — completely optional, but new joiners who get a week-2 check-in with leadership ramp faster.\n\nAnita",
    ts: at(-2, 11, 30), read: true, labels: ["HR"],
  },
  {
    id: "m-112", folder: "inbox", fromExternal: { name: "Qubit One IT", email: "it-notices@qubitone.in" }, fromId: null, to: ["all-employees@qubitone.in"],
    subject: "Scheduled maintenance — Saturday 14 Nov, 22:00–00:30 IST",
    preview: "Qubit One will be read-only during the maintenance window. Mail delivery is unaffected; approvals and edits resume after 00:30.",
    body: "Hello,\n\nQubit One will be read-only on Saturday 14 November between 22:00 and 00:30 IST while we upgrade the database cluster.\n\n- Mail delivery is unaffected.\n- Approvals, edits and exports resume after 00:30.\n- No action is required.\n\n— IT & Technology",
    ts: at(-2, 12, 0), read: true,
  },
  {
    id: "m-113", folder: "inbox", fromId: "deepak", to: ["sagar"], subject: "Photos from Diwali celebration",
    preview: "Sharing the album from Tuesday's celebration. The team put together a short montage for the town hall opener — 40 seconds, music licensed.",
    body: "Hi Sagar,\n\nSharing the Diwali album. The engagement team also cut a 40-second montage for the town hall opener (music is licensed, no attribution needed).\n\nDeepak",
    ts: at(-3, 19, 5), read: true, labels: ["Marketing"], starred: true,
    attachments: [{ name: "Diwali-2026-selects.png", sizeKb: 4200, type: "PNG" }],
  },
  {
    id: "m-114", folder: "inbox", fromId: "meera", to: ["sagar"], subject: "Field Sales — November pipeline note",
    preview: "Pipeline at ₹9.2 Cr for the quarter. Two at-risk deals (both procurement delays, not pricing). Will cover in Monday's revenue review if useful.",
    body: "Sagar,\n\nNovember pipeline stands at ₹9.2 Cr. Two deals are at risk — both due to procurement delays on the client side, not pricing. Everything else is on track.\n\nHappy to cover this in Monday's revenue review if useful.\n\nMeera",
    ts: at(-2, 15, 45), read: true, labels: ["Sales"],
  },
  {
    id: "m-115", folder: "inbox", fromId: "tanvi", to: ["sagar"], cc: ["priya"], subject: "GST documentation — two compliance items before 30 Nov",
    preview: "Bengaluru branch has 6 pending input-credit invoices; Delhi has a mismatch in the e-invoice series. Both are with branch accountants; escalation date 24 Nov.",
    body: "Dear Sir,\n\nTwo compliance items ahead of the 30 November payroll lock:\n\n1. Bengaluru: 6 pending input-credit invoices (₹3.1 L total).\n2. Delhi: e-invoice series mismatch for October — correction filed, acknowledgement expected by 20 Nov.\n\nBoth are with branch accountants. Escalation to finance head on 24 Nov if unresolved.\n\nRegards,\nTanvi Shah",
    ts: at(-4, 10, 30), read: true, labels: ["Finance"],
  },
  {
    id: "m-116", folder: "inbox", fromExternal: { name: "Qubit One Mail", email: "mailbox-daemon@qubitone.in" }, fromId: null, to: ["sagar.singh@qubitone.in"],
    subject: "Mail storage — 61% of quota used",
    preview: "Your mailbox uses 4.9 GB of 8 GB. Older items can be moved to Archive from Mail Search. Retention policy: 24 months online.",
    body: "Your mailbox currently uses 4.9 GB of the 8 GB enterprise quota.\n\nYou can free space by archiving older conversations (Mail Search → filter by date range → select → Archive).\n\nRetention policy: 24 months online, then 7 years in compliant cold storage per policy DLP-04.\n\n— Qubit One Mail",
    ts: at(-6, 8, 0), read: true,
  },
  // ——— Sent ———
  {
    id: "s-201", folder: "sent", fromId: "sagar", to: ["priya", "rahul"], subject: "Q3 board deck — final for review",
    preview: "Thanks Priya. Rahul — the Acme assumption should model the 10% case; if the 12% clears, we update the appendix, not the base case.",
    body: "Priya, Rahul,\n\nThanks Priya — reviewed slide 12 this morning. The conservative case reads well.\n\nRahul: the Acme assumption should model the 10% case. If the 12% clears, we update the appendix, not the base case — the board sees the conservative number.\n\nSign-off after today's Acme decision.\n\nSagar",
    ts: at(0, 8, 30), read: true, sendStatus: "Delivered", labels: ["Board"],
    attachments: [{ name: "Q4-Board-Deck-v4-comments.xlsx", sizeKb: 96, type: "XLSX" }],
  },
  {
    id: "s-202", folder: "sent", fromId: "sagar", to: ["all-heads@qubitone.in"], subject: "Town hall — Monday 16 Nov, 16:00",
    preview: "Agenda: FY27 targets, Bengaluru expansion, service quality wins, and open Q&A. Department heads: two slides each are due by Sunday evening.",
    body: "All,\n\nQuarterly town hall on Monday 16 November at 16:00 (Qubit Meet, all-hands).\n\nAgenda: FY27 targets, Bengaluru office expansion, service quality wins, open Q&A.\n\nDepartment heads: your two slides are due by Sunday evening — template is in the shared drive.\n\nSagar",
    ts: at(-1, 12, 0), read: true, sendStatus: "Delivered",
  },
  {
    id: "s-203", folder: "sent", fromId: "sagar", to: ["sneha"], subject: "Welcome to the leadership reviews — see you at the town hall",
    preview: "Your probation confirmation is in process. From November you'll join the monthly operations review — Sanjay will share the cadence.",
    body: "Sneha,\n\nYour probation confirmation is in process — congratulations, the feedback from Finance stakeholders has been excellent.\n\nFrom November you'll join the monthly operations review. Sanjay will share the cadence this week.\n\nSagar",
    ts: at(-3, 11, 0), read: true, sendStatus: "Sent",
  },
  {
    id: "s-204", folder: "sent", fromId: "sagar", to: ["rohitv"], subject: "RE: Zenith visit — expense claim",
    preview: "Claim received. It's in the standard queue with your department head — Rohit, route these to Pankaj first going forward; they route to me only above ₹50,000.",
    body: "Rohit,\n\nClaim received. One process note: route expense claims to Pankaj (department head) first — they route to me only above ₹50,000 or for exceptions.\n\nSagar",
    ts: at(-4, 12, 0), read: true, sendStatus: "Delivered",
  },
  {
    id: "s-205", folder: "sent", fromId: "sagar", to: ["ananya.krishnan@acmecorp.in"], subject: "RE: Renewal discussion — confirming Monday 10:30 IST",
    preview: "Confirmed for Monday 10:30 IST. Revised proposal will reach you by Sunday evening. Looking forward to continuing the partnership.",
    body: "Dear Ms. Krishnan,\n\nConfirmed for Monday 10:30 IST. Our Sales Head Rahul Mehta and Account Manager Pankaj Sharma will join.\n\nThe revised proposal will reach you by Sunday evening, as discussed.\n\nBest regards,\nSagar Singh\nChief Executive Officer, Qubit One Pvt Ltd",
    ts: at(-1, 14, 55), read: true, sendStatus: "Delivered",
  },
  {
    id: "s-206", folder: "sent", fromId: "sagar", to: ["arjun"], subject: "Qubit AI access policy — approved for the December gate",
    preview: "Policy approved with one addition: quarterly access recertification for AI data scopes, owned by your team. Add it to the rollout plan.",
    body: "Arjun,\n\nPolicy approved for the December gate, with one addition: quarterly access recertification for AI data scopes, owned by your team — same model as the role matrix reviews.\n\nAdd it to the rollout plan and we're set.\n\nSagar",
    ts: at(-5, 16, 20), read: true, sendStatus: "Sent",
  },
  {
    id: "s-207", folder: "sent", fromId: "sagar", to: ["accounts@brightline-logistics.in"], subject: "RE: Invoice INV-20261 — updated bank details",
    preview: "Verifying the bank detail change via our registered contact before we process. Sanjay Gupta will call your accounts team today.",
    body: "Team,\n\nWe received a request stating updated bank details for invoice INV-20261. Per our finance policy, we verify such changes via the registered contact before processing.\n\nSanjay Gupta (Operations Head) will call your accounts team today to confirm. Until then, the earlier details stand.\n\nSagar Singh\nQubit One Pvt Ltd",
    ts: at(-2, 13, 30), read: true, sendStatus: "Sent", priority: "High",
  },
  {
    id: "s-208", folder: "sent", fromId: "sagar", to: ["cfo.office@zenith-mfg.co.in"], subject: "Partnership renewal — meeting request",
    preview: "Requesting 30 minutes next week to discuss the renewal. Proposed Wednesday 11:00 IST; happy to adjust to your calendar.",
    body: "Dear CFO's office,\n\nRequesting 30 minutes next week to discuss our service renewal and the improvement plan following the recent SLA incidents.\n\nProposed Wednesday 11:00 IST — happy to adjust to your calendar.\n\nRegards,\nSagar Singh, Qubit One Pvt Ltd",
    ts: at(-4, 9, 45), read: true, sendStatus: "Failed", sendDetail: "Delivery failed — recipient domain (zenith-mfg.co.in) not reachable. The address may be outdated.",
  },
  {
    id: "s-209", folder: "sent", fromId: "sagar", to: ["nikhil"], subject: "Laptop refresh — aging devices report",
    preview: "Reviewed the aging report. Approve the refresh for devices older than 4 years in field service first — they carry the SLA risk.",
    body: "Nikhil,\n\nReviewed the aging report. Refresh for devices older than 4 years in field service first — they carry the SLA risk. HQ can follow in Q1.\n\nRaise the purchase request with IT & Technology as the budget owner.\n\nSagar",
    ts: at(-6, 17, 10), read: true, sendStatus: "Delivered",
  },
  // ——— Drafts ———
  {
    id: "d-301", folder: "drafts", fromId: "sagar", to: ["all-heads@qubitone.in"], subject: "FY27 OKRs — consolidation and offsite agenda",
    preview: "All eight department drafts are consolidated in the attached worksheet. Before the offsite: confirm your top-3 objectives and the one metric you don't want to miss\u2026",
    body: "All,\n\nAll eight department drafts are consolidated in the attached worksheet. Before the offsite (24–25 Nov, Lonavala):\n\n1. Confirm your top-3 objectives.\n2. Flag the one metric you don't want to miss.\n3. Note any cross-department dependency — those are where the offsite adds value.\n\nSagar",
    ts: at(0, 7, 40), read: true,
    attachments: [{ name: "FY27-OKR-worksheet.xlsx", sizeKb: 96, type: "XLSX" }],
  },
  {
    id: "d-302", folder: "drafts", fromId: "sagar", to: ["meera"], subject: "Field sales coverage during your leave",
    preview: "Plan for 23–27 Nov: Pankaj holds the Acme account, Arvind covers Jaipur visits. Send me the handover note by Friday and I'll approve the leave\u2026",
    body: "Meera,\n\nPlan for 23–27 Nov: Pankaj holds the Acme account, Arvind covers Jaipur visits.\n\nSend me the handover note by Friday and I'll approve the leave the same day.\n\nSagar",
    ts: at(-1, 10, 5), read: true,
  },
];

/** Older archive messages — generated deterministically so Mail Search
 *  operates at a believable enterprise scale (spec §13). */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ARCHIVE_SENDERS = ["rahul", "priya", "neha", "amit", "vikramj", "karan", "arjun", "sanjay", "pankaj", "meera", "kavita", "deepak"];
const ARCHIVE_TOPICS: [string, string][] = [
  ["Weekly revenue snapshot — week %N", "Numbers for week %N attached. Pipeline conversion steady at 24%."],
  ["Service review — month %N", "SLA at 96.4% for month %N. Two chronic escalations discussed."],
  ["HR calendar — month %N", "Engagement survey opens Monday. Manager briefings on Wednesday."],
  ["Campaign report — %N", "Spend efficiency improved 8% vs %N. Creative refresh scheduled."],
  ["Inventory reconciliation — %N", "Variance down to 0.9% after the count policy change."],
  ["Security patch cycle — %N", "All endpoints patched for %N. Zero critical exceptions."],
  ["Vendor payment run — %N", "₹1.8 Cr released for %N. Two invoices held pending GST corrections."],
  ["Town hall follow-ups — %N", "Action items from the %N town hall with owners and dates."],
];

const ARCHIVE_MESSAGES: MailMessage[] = (() => {
  const rnd = mulberry32(20261113);
  const out: MailMessage[] = [];
  for (let i = 0; i < 132; i++) {
    const sender = ARCHIVE_SENDERS[Math.floor(rnd() * ARCHIVE_SENDERS.length)];
    const [ts, body] = ARCHIVE_TOPICS[Math.floor(rnd() * ARCHIVE_TOPICS.length)];
    const n = 30 + Math.floor(rnd() * 90);
    const dayOffset = -(40 + i * 2 + Math.floor(rnd() * 2));
    out.push({
      id: `m-arc-${1000 + i}`,
      folder: "archive",
      fromId: sender,
      to: ["sagar"],
      subject: ts.replace("%N", String(n)),
      preview: body.replace("%N", String(n)),
      body: body.replace("%N", String(n)) + `\n\nDetails and attachments are available in the %N workspace.\n\n— sent via Qubit One Mail`,
      ts: at(dayOffset, 9 + Math.floor(rnd() * 9), Math.floor(rnd() * 60)),
      read: true,
      labels: [(["Finance", "Sales", "HR", "Service", "IT", "Marketing"] as MailLabel[])[Math.floor(rnd() * 6)]],
    });
  }
  return out;
})();

export const ALL_MAIL: MailMessage[] = [...MAIL, ...ARCHIVE_MESSAGES];

/** Authoritative count of the signed-in user's authorized mail scope,
 *  used by Mail Search for honest scale reporting. */
export const AUTHORIZED_MAIL_COUNT = ALL_MAIL.length;

// ============================================================
// Workspace selectors
// ============================================================

export const CURRENT_EMPLOYEE_ID = "sagar";

export const overdueTasks = (list: Task[]): Task[] =>
  list.filter((t) => t.due !== null && t.due < WORKSPACE_NOW && t.status !== "Completed" && t.status !== "Cancelled");

export const pendingApprovals = (list: ApprovalRequest[]): ApprovalRequest[] =>
  list.filter((a) => a.status === "Pending");

export const employeeById = (id: string | null | undefined) =>
  employees.find((e) => e.id === id);

export const mailboxUnreadCount = (list: MailMessage[]): number =>
  list.filter((m) => m.folder === "inbox" && !m.read).length;
