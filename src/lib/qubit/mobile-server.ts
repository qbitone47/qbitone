// ============================================================
// Qubit One — Mobile enforcement layer (SERVER ONLY)
// ============================================================
// Phase 18 · screens 285–300. Mobile is an interface, not a system:
// every record served here is composed from the AUTHORITATIVE
// existing Qubit One systems through their own enforcement —
//   · Tasks / Approvals / Mail / Profile → workspace-server
//   · Leads / Follow-ups / Visits / WhatsApp / Pipeline   → salesGet /
//     salesPost (the Sales gate and scope re-apply for every call)
//   · Meetings / Notifications / Activity  → the workspace stores
//   · Service canon → executive-data SERVICE block (same source the
//     executive + analytics layers read)
//   · AI → the centralized Qubit AI Platform (runCompletion) with a
//     permission-scoped, server-composed basis (spec §41)
// No mobile database exists. The only NEW records mobile owns are
// the ones no existing system kept yet (attendance punches, field
// visit execution state, meeting field notes) — each is a single
// audited store, not a parallel copy of anything.
// Every consequential action lands in the ONE enterprise audit
// trail via writeAudit. Permissions are enforced HERE, never in
// the UI (spec §5, §34).
// ============================================================

import { createHash } from "crypto";
import { writeAudit } from "./security-server";
import {
  SESSION_USER_ID,
  listApprovals,
  decideApproval,
  listTasks,
  createTask,
  updateTask,
  listMail,
  sendMail,
  saveDraft,
  markMail,
  updateProfile,
  type WorkspaceRole,
} from "./workspace-server";
import {
  MEETINGS,
  NOTIFICATIONS,
  ACTIVITY,
  EVENTS,
  WORKSPACE_NOW,
  ist,
  fmtTime,
  fmtDateTime,
  type Task,
  type Meeting,
  type ApprovalRequest,
} from "./workspace-data";
import { employees, getEmployee, COMPANY_NAME } from "./data";
import { salesGet, salesPost } from "./sales-server";
import { SERVICE } from "./executive-data";
import { runCompletion, UNTRUSTED_CONTENT_RULE, untrustedBlock } from "./ai-engine";
import {
  VISIT_TRANSITIONS,
  VISIT_CHECKLISTS,
  QUICK_ACTIONS,
  ROLE_BUSINESS_MODULES,
  OFFLINE_SUPPORT,
  MOBILE_PERIOD,
  type VisitLifecycleStage,
  type ChecklistItemDef,
} from "./mobile-data";

const ACTOR_NAME = "Sagar Singh";

// ---------- shared helpers ----------

type Result<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string };

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (status: number, code: string, message: string): Result<never> => ({ ok: false, status, code, message });

/** IST day key, e.g. "2026-11-13" */
const dayKey = (ts: number) => {
  const d = ist(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

const WORKSPACE_DAY = dayKey(WORKSPACE_NOW);

const nameOf = (id: string | null | undefined) =>
  id ? employees.find((e) => e.id === id)?.name ?? id : "Unassigned";

const employeeBrief = (id: string | null | undefined) => {
  const e = getEmployee(id);
  return e ? { id: e.id, name: e.name, title: e.title, department: e.department, phone: e.phone, email: e.email } : null;
};

// ---------- mobile-owned audited stores (single source each) ----------

interface AttendanceRecord {
  id: string;
  employeeId: string;
  day: string; // IST day key
  checkinAt: number;
  checkoutAt?: number;
  workedMin?: number;
  method: string;
}

interface MobileStore {
  attendance: AttendanceRecord[];
  meetingNotes: Map<string, { at: number; by: string; text: string }[]>;
  meetingActions: Map<string, { title: string; ownerId: string; due: number | null; at: number }[]>;
  visitStage: Map<string, VisitLifecycleStage>;
  visitNotes: Map<string, { at: number; by: string; text: string }[]>;
  visitChecklist: Map<string, { id: string; label: string; critical: boolean; done: boolean }[]>;
  visitParts: Map<string, { name: string; qty: number; at: number }[]>;
  visitEvidence: Map<string, string[]>;
  waRead: Map<string, boolean>;
  notifRead: Map<string, boolean>;
  taskComments: Map<string, { at: number; by: string; text: string }[]>;
  aiChats: { id: string; at: number; messages: { role: "user" | "assistant"; content: string; basis?: string }[] }[];
  cardShares: { at: number; channel: string }[];
}

let _store: MobileStore | null = null;
function store(): MobileStore {
  if (!_store) {
    _store = {
      attendance: [],
      meetingNotes: new Map(),
      meetingActions: new Map(),
      visitStage: new Map(),
      visitNotes: new Map(),
      visitChecklist: new Map(),
      visitParts: new Map(),
      visitEvidence: new Map(),
      waRead: new Map(),
      notifRead: new Map(),
      taskComments: new Map(),
      aiChats: [],
      cardShares: [],
    };
  }
  return _store;
}

// ============================================================
// GET — one composed section per mobile screen
// ============================================================

export type MobileSection =
  | "home" | "sales-home" | "lead" | "whatsapp" | "meetings" | "tasks"
  | "service-home" | "visit" | "attendance" | "approvals" | "notifications"
  | "profile" | "id-card" | "visiting-card" | "mail" | "ai";

export function sectionFor(s: string | null): MobileSection | null {
  return !!s && (["home", "sales-home", "lead", "whatsapp", "meetings", "tasks", "service-home", "visit", "attendance", "approvals", "notifications", "profile", "id-card", "visiting-card", "mail", "ai"] as const).includes(s as MobileSection)
    ? (s as MobileSection)
    : null;
}

export async function mobileGet(role: WorkspaceRole, section: MobileSection, params: URLSearchParams): Promise<Result<Record<string, unknown>>> {
  switch (section) {
    case "home":
      return ok(homePayload(role));
    case "sales-home":
      return salesHomePayload(role);
    case "lead":
      return leadPayload(role, params.get("id") ?? "");
    case "whatsapp":
      return whatsappPayload(role, params.get("id") ?? undefined);
    case "meetings":
      return meetingsPayload(params.get("id") ?? undefined);
    case "tasks":
      return tasksPayload(params.get("id") ?? undefined);
    case "service-home":
      return ok(await serviceHomePayload(role));
    case "visit":
      return visitPayload(role, params.get("id") ?? "");
    case "attendance":
      return ok(attendancePayload());
    case "approvals":
      return approvalsPayload(role, params.get("id") ?? undefined);
    case "notifications":
      // notificationsPayload already returns a Result (ok/fail) — do not wrap twice.
      return notificationsPayload(params.get("category") ?? undefined);
    case "profile":
      return ok(profilePayload(role));
    case "id-card":
      return ok(idCardPayload());
    case "visiting-card":
      return ok(visitingCardPayload());
    case "mail":
      return mailPayload(role, params.get("folder") ?? "inbox", params.get("id") ?? undefined, params.get("q") ?? undefined);
    case "ai":
      return ok(aiPayload(role));
  }
}

// ---------- home (285) ----------

function homePayload(role: WorkspaceRole) {
  const me = getEmployee(SESSION_USER_ID)!;
  const hour = ist(WORKSPACE_NOW).getUTCHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const tasks = listTasks();
  const open = tasks.filter((t) => t.status !== "Completed" && t.status !== "Cancelled");
  const overdue = open.filter((t) => t.due !== null && t.due < WORKSPACE_NOW);
  const dueToday = open.filter((t) => t.due !== null && dayKey(t.due) === WORKSPACE_DAY);

  const todayMeetings = MEETINGS.filter(
    (m) => dayKey(m.start) === WORKSPACE_DAY && m.status !== "Cancelled" && m.participantIds.includes(SESSION_USER_ID),
  ).sort((a, b) => a.start - b.start);
  const nextMeeting = todayMeetings.find((m) => m.end >= WORKSPACE_NOW) ?? null;

  const approvalQueue = listApprovals(role);
  const pendingApprovals = (approvalQueue.queue ?? []).filter((a) => a.status === "Pending");

  const notifications = NOTIFICATIONS.map((n) => ({ ...n, unread: store().notifRead.has(n.id) ? false : n.unread }));
  const unreadNotifications = notifications.filter((n) => n.unread);

  const unreadMail = listMail(role, { folder: "inbox", unreadOnly: true, limit: 5 });

  const attendance = todayAttendance();

  return {
    asOf: { label: MOBILE_PERIOD.label, timezone: MOBILE_PERIOD.timezone },
    identity: {
      id: me.id,
      name: me.name,
      title: me.title,
      department: me.department,
      location: me.location,
      employeeId: me.employeeId,
      email: me.email,
      phone: me.phone,
      role,
    },
    greeting,
    offline: OFFLINE_SUPPORT,
    counts: {
      tasksOpen: open.length,
      tasksOverdue: overdue.length,
      tasksDueToday: dueToday.length,
      meetingsToday: todayMeetings.length,
      approvalsPending: pendingApprovals.length,
      notificationsUnread: unreadNotifications.length,
      mailUnread: unreadMail.total,
    },
    tasks: {
      overdue: overdue.slice(0, 3).map(taskBrief),
      dueToday: dueToday.slice(0, 3).map(taskBrief),
    },
    nextMeeting: nextMeeting ? meetingBrief(nextMeeting) : null,
    meetingsToday: todayMeetings.slice(0, 4).map(meetingBrief),
    approvals: pendingApprovals.slice(0, 3).map(approvalBrief),
    notifications: unreadNotifications.slice(0, 3).map(notificationBrief),
    importantMessages: unreadMail.items.slice(0, 3).map((m) => ({
      id: m.id,
      from: m.fromId ? nameOf(m.fromId) : m.fromExternal?.name ?? "External",
      subject: m.subject,
      preview: m.preview,
      ts: m.ts,
    })),
    attendance,
    quickActions: QUICK_ACTIONS.filter((a) => a.roles.includes(role)),
    businessModules: ROLE_BUSINESS_MODULES[role] ?? [],
    recentActivity: ACTIVITY.slice(0, 5).map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      detail: a.detail,
      ts: a.ts,
    })),
    sourceNote: "Composed live from the Workspace, Approvals, Mail and Notification systems — the same records as desktop, scoped to your role.",
  };
}

// ---------- sales home (286) ----------

interface SalesRows { rows: Record<string, unknown>[]; scope: string }
interface SalesVisitRow { id: string; plannedAt: number; status: string; purpose: string; location: string; account?: { name?: string } | null; ownerId: string }

function salesHomePayload(role: WorkspaceRole): Result<Record<string, unknown>> {
  const gate = salesGet(role, "home", new URLSearchParams());
  if (!gate.ok) {
    return { ok: false, status: gate.status, code: gate.code, message: gate.message };
  }
  const leads = salesGet(role, "leads", new URLSearchParams());
  const followups = salesGet(role, "followups", new URLSearchParams());
  const opportunities = salesGet(role, "opportunities", new URLSearchParams());
  const pipeline = salesGet(role, "pipeline", new URLSearchParams());
  const visits = salesGet(role, "visits", new URLSearchParams());
  const quotations = salesGet(role, "quotations", new URLSearchParams());
  const orders = salesGet(role, "orders", new URLSearchParams());
  const targets = salesGet(role, "targets", new URLSearchParams());

  const leadRows = (leads.ok ? (leads.data as unknown as SalesRows).rows : []) as Record<string, unknown>[];
  const fuRows = (followups.ok ? (followups.data as unknown as SalesRows).rows : []) as Record<string, unknown>[];
  const oppRows = (opportunities.ok ? (opportunities.data as unknown as SalesRows).rows : []) as Record<string, unknown>[];
  const visitRows = (visits.ok ? (visits.data as unknown as SalesRows).rows : []) as unknown as SalesVisitRow[];
  const quoteRows = (quotations.ok ? (quotations.data as unknown as SalesRows).rows : []) as Record<string, unknown>[];
  const orderRows = (orders.ok ? (orders.data as unknown as SalesRows).rows : []) as Record<string, unknown>[];
  const targetRows = (targets.ok ? (targets.data as unknown as { rows: Record<string, unknown>[] }).rows : []) as Record<string, unknown>[];

  const today = visitRows.filter((v) => v.status !== "Cancelled" && dayKey(v.plannedAt) === dayKey(Date.now()));
  const upcomingVisits = visitRows.filter((v) => v.status === "Planned" && v.plannedAt > Date.now()).slice(0, 4);

  const pipelineTotals = pipeline.ok ? (pipeline.data as Record<string, unknown>).totals : null;

  return ok({
    scope: (gate.data as Record<string, unknown>).scope ?? null,
    counts: {
      leads: leadRows.length,
      leadsNew: leadRows.filter((l) => l.status === "New").length,
      followupsOverdue: fuRows.filter((f) => f.state === "Overdue").length,
      followupsToday: fuRows.filter((f) => f.state === "Due Today").length,
      opportunities: oppRows.length,
      openQuotes: quoteRows.filter((q) => q.status !== "Accepted" && q.status !== "Cancelled" && q.status !== "Rejected").length,
      openOrders: orderRows.filter((o) => o.status !== "Closed" && o.status !== "Cancelled").length,
      visitsToday: today.length,
    },
    leads: leadRows.slice(0, 5).map((l) => ({
      id: l.id, name: l.name, company: l.company, status: l.status, priority: l.priority,
      ownerName: l.ownerName ?? null, estimatedValueCr: l.estimatedValueCr ?? null,
    })),
    followups: fuRows
      .filter((f) => f.state === "Overdue" || f.state === "Due Today")
      .slice(0, 5)
      .map((f) => ({ id: f.id, type: f.type, subject: f.subject, state: f.state, dueAt: f.dueAt, priority: f.priority, leadId: f.leadId ?? null })),
    opportunities: oppRows.slice(0, 4).map((o) => ({
      id: o.id, name: o.name, stage: o.stage, valueCr: o.valueCr, probability: o.probability, riskNote: o.riskNote ?? null,
    })),
    pipelineTotals,
    visitsToday: today.slice(0, 4).map((v) => ({
      id: v.id, plannedAt: v.plannedAt, purpose: v.purpose, location: v.location, status: v.status,
      account: v.account?.name ?? null,
    })),
    upcomingVisits: upcomingVisits.map((v) => ({
      id: v.id, plannedAt: v.plannedAt, purpose: v.purpose, location: v.location, status: v.status,
      account: v.account?.name ?? null,
    })),
    targets: targetRows.filter((r) => r.kind === "employee" && r.refId === SESSION_USER_ID).slice(0, 2),
    quickActions: QUICK_ACTIONS.filter((a) => ["create-lead", "add-followup", "whatsapp", "create-visit"].includes(a.id) && a.roles.includes(role)),
    sourceNote: "Every figure is read through the Sales Operating System gate — company / team / own scope re-applies server-side.",
  });
}

// ---------- lead detail (287) ----------

function leadPayload(role: WorkspaceRole, leadId: string): Result<Record<string, unknown>> {
  if (!leadId) return fail(400, "lead_required", "A lead id is required.");
  const res = salesGet(role, "lead", new URLSearchParams({ id: leadId }));
  if (!res.ok) return { ok: false, status: res.status, code: res.code, message: res.message };
  const activity = salesGet(role, "activity", new URLSearchParams({ entityId: leadId }));
  const data = res.data as Record<string, unknown>;
  const lead = data.lead as Record<string, unknown>;
  const acts = activity.ok ? ((activity.data as Record<string, unknown>).rows as Record<string, unknown>[]).slice(0, 6) : [];
  return ok({
    lead,
    scope: data.scope,
    recentActivity: acts.map((a) => ({ id: a.id, type: a.type, summary: a.summary, at: a.at, source: a.source ?? a.channel ?? "Sales activity" })),
    channels: {
      call: `tel:${String(lead.phone ?? "").replace(/\s/g, "")}`,
      whatsapp: `https://wa.me/${String(lead.phone ?? "").replace(/\D/g, "")}`,
      email: `mailto:${lead.email ?? ""}`,
    },
    channelNote: "Call opens the device dialer, WhatsApp opens the WhatsApp app against the business number, email opens compose — legitimate device/integration handoffs, never simulated (spec §8).",
    sourceNote: "Lead record read through the Sales OS with scope re-applied; timeline is the SAME customer activity record.",
  });
}

// ---------- whatsapp (288) ----------

function whatsappPayload(role: WorkspaceRole, convId?: string): Result<Record<string, unknown>> {
  if (convId) {
    const res = salesGet(role, "whatsapp-conversation", new URLSearchParams({ id: convId }));
    if (!res.ok) return { ok: false, status: res.status, code: res.code, message: res.message };
    const conversation = (res.data as Record<string, unknown>).conversation as Record<string, unknown>;
    if (store().waRead.has(convId)) conversation.unread = 0;
    return ok({ conversation, integrationsNote: "WhatsApp Business API is the configured transport (int-whatsapp). Replies, consent checks, retention and audit ride the existing integration." });
  }
  const res = salesGet(role, "whatsapp", new URLSearchParams());
  if (!res.ok) return { ok: false, status: res.status, code: res.code, message: res.message };
  const rows = ((res.data as Record<string, unknown>).rows ?? []) as Record<string, unknown>[];
  return ok({
    conversations: rows.map((c) => {
      const msgs = (c.messages ?? []) as { body: string; at: number; direction: string }[];
      const last = msgs[msgs.length - 1];
      return {
        id: c.id,
        contactName: c.contactName,
        waNumber: c.waNumber,
        status: c.status,
        unread: store().waRead.has(String(c.id)) ? 0 : c.unread,
        lastMessageAt: c.lastMessageAt,
        lastMessage: last ? { body: last.body, direction: last.direction } : null,
        leadId: c.leadId ?? null,
        leadName: c.lead ? (c.lead as Record<string, unknown>).name : null,
        accountName: c.account ? (c.account as Record<string, unknown>).name : null,
        ownerName: c.ownerName,
      };
    }),
    connected: true,
    sourceNote: "The authorized WhatsApp Business inbox — conversations you own by scope. Consent, API limits, retention and audit are enforced by the existing integration layer.",
  });
}

// ---------- meetings (289) ----------

function meetingBrief(m: Meeting) {
  return {
    id: m.id,
    title: m.title,
    start: m.start,
    end: m.end,
    timeLabel: `${fmtTime(m.start)} – ${fmtTime(m.end)}`,
    location: m.location,
    platform: m.platform,
    status: m.status,
    organizer: nameOf(m.organizerId),
    participants: m.participantIds.map(nameOf),
    agenda: m.agenda ?? null,
    participantCount: m.participantIds.length,
  };
}

function meetingsPayload(meetingId?: string) {
  if (meetingId) {
    const m = MEETINGS.find((x) => x.id === meetingId);
    if (!m) return fail(404, "not_found", "Meeting not found.");
    if (!m.participantIds.includes(SESSION_USER_ID) && m.organizerId !== SESSION_USER_ID) {
      return fail(403, "forbidden", "You are not a participant of this meeting.");
    }
    const s = store();
    const notes = s.meetingNotes.get(meetingId) ?? [];
    const extraActions = s.meetingActions.get(meetingId) ?? [];
    return ok({
      meeting: {
        ...meetingBrief(m),
        notes: [...(m.notes ? [{ at: m.start, by: "Meeting record", text: m.notes }] : []), ...notes],
        actionItems: [
          ...(m.actionItems ?? []).map((a) => ({ title: a.title, owner: nameOf(a.ownerId), due: a.due, at: null as number | null })),
          ...extraActions.map((a) => ({ title: a.title, owner: nameOf(a.ownerId), due: a.due, at: a.at })),
        ],
        aiSummary: m.aiSummary ?? null,
        joinAvailable: m.status === "Scheduled" || m.status === "In Progress",
        joinPlatform: m.platform,
        joinNote: m.platform === "In person"
          ? "In-person meeting — navigate to the location."
          : `Join happens in ${m.platform}. Qubit One hands off to the meeting platform and records the join — it never simulates the call.`,
      },
      sourceNote: "The ONE enterprise Meetings module — notes and action items recorded from mobile are appended to the same meeting record store.",
    });
  }
  const today = MEETINGS.filter(
    (m) => dayKey(m.start) === WORKSPACE_DAY && m.status !== "Cancelled" && (m.participantIds.includes(SESSION_USER_ID) || m.organizerId === SESSION_USER_ID),
  ).sort((a, b) => a.start - b.start);
  const upcoming = MEETINGS.filter(
    (m) => m.start > WORKSPACE_NOW && m.status === "Scheduled" && (m.participantIds.includes(SESSION_USER_ID) || m.organizerId === SESSION_USER_ID),
  ).sort((a, b) => a.start - b.start);
  const past = MEETINGS.filter(
    (m) => m.status === "Completed" && (m.participantIds.includes(SESSION_USER_ID) || m.organizerId === SESSION_USER_ID),
  ).sort((a, b) => b.start - a.start).slice(0, 4);
  return ok({
    today: today.map(meetingBrief),
    upcoming: upcoming.slice(0, 8).map(meetingBrief),
    past: past.map((m) => ({ ...meetingBrief(m), notes: m.notes ?? null, aiSummary: m.aiSummary ?? null })),
    asOfDay: WORKSPACE_DAY,
    sourceNote: "Today/upcoming/past derive from the enterprise Meetings module — no second calendar.",
  });
}

// ---------- tasks (290) ----------

function taskBrief(t: Task) {
  return {
    id: t.id,
    title: t.title,
    detail: t.detail,
    status: t.status,
    priority: t.priority,
    due: t.due,
    dueLabel: t.due ? fmtDateTime(t.due) : null,
    source: t.source,
    assigner: nameOf(t.ownerId === SESSION_USER_ID ? null : t.ownerId),
  };
}

function tasksPayload(taskId?: string) {
  if (taskId) {
    const t = listTasks().find((x) => x.id === taskId);
    if (!t) return fail(404, "not_found", "Task not found in your queue.");
    const transitions: Record<string, string[]> = {
      "Not Started": ["In Progress", "Cancelled"],
      "In Progress": ["Waiting", "Blocked", "Completed", "Cancelled"],
      Blocked: ["In Progress", "Waiting", "Cancelled"],
      Waiting: ["In Progress", "Blocked", "Cancelled"],
      Completed: ["In Progress"],
      Cancelled: [],
    };
    return ok({
      task: taskBrief(t),
      allowedTransitions: transitions[t.status] ?? [],
      comments: store().taskComments.get(taskId) ?? [],
      actionNote: "Status transitions are enforced by the ONE workspace task system (server-side). Reassignment and priority editing run on desktop where the full task workspace lives; comments recorded here are appended to the same task.",
      attachmentNote: "Attachments ride the enterprise document vault (My Documents) — mobile upload is not configured yet, and Qubit One will not pretend otherwise.",
    });
  }
  const tasks = listTasks();
  const open = tasks.filter((t) => t.status !== "Completed" && t.status !== "Cancelled");
  const overdue = open.filter((t) => t.due !== null && t.due < WORKSPACE_NOW).sort((a, b) => (a.due ?? 0) - (b.due ?? 0));
  const today = open.filter((t) => t.due !== null && dayKey(t.due) === WORKSPACE_DAY && t.due >= WORKSPACE_NOW);
  const upcoming = open.filter((t) => t.due !== null && t.due > WORKSPACE_NOW && dayKey(t.due) !== WORKSPACE_DAY).sort((a, b) => (a.due ?? 0) - (b.due ?? 0));
  const someday = open.filter((t) => t.due === null);
  const done = tasks.filter((t) => t.status === "Completed").slice(0, 6);
  return ok({
    overdue: overdue.map(taskBrief),
    today: today.map(taskBrief),
    upcoming: upcoming.slice(0, 8).map(taskBrief),
    someday: someday.slice(0, 6).map(taskBrief),
    completed: done.map(taskBrief),
    counts: { overdue: overdue.length, today: today.length, upcoming: upcoming.length, completed: done.length },
    asOfDay: WORKSPACE_DAY,
    sourceNote: "My Tasks — the ONE workspace task store, assignee-scoped server-side.",
  });
}

// ---------- service home (291) ----------

async function serviceHomePayload(role: WorkspaceRole): Promise<Record<string, unknown>> {
  const salesRoles: WorkspaceRole[] = ["administrator", "dept-head", "sales-exec"];
  let visits: Record<string, unknown>[] = [];
  let visitsNote: string | null = null;
  if (salesRoles.includes(role)) {
    const res = salesGet(role, "visits", new URLSearchParams());
    if (res.ok) visits = (((res.data as Record<string, unknown>).rows ?? []) as unknown as SalesVisitRow[]).map((v) => ({
      id: v.id, plannedAt: v.plannedAt, purpose: v.purpose, location: v.location, status: v.status,
      account: v.account?.name ?? null, ownerId: v.ownerId,
    }));
  } else {
    visitsNote = "Field visits require a sales/service authorization your preview role does not hold — the visit list is not shown rather than emptied silently.";
  }
  const today = visits.filter((v) => v.status !== "Cancelled" && dayKey(v.plannedAt as number) === dayKey(Date.now()));
  const openVisits = visits.filter((v) => v.status === "Planned" || v.status === "In Progress");
  const partsPending = [...store().visitParts.entries()]
    .flatMap(([visitId, parts]) => parts.map((p) => ({ visitId, ...p })))
    .slice(0, 5);
  return {
    tickets: SERVICE.tickets,
    sla: SERVICE.sla,
    criticalAccounts: SERVICE.criticalAccounts,
    visitsToday: today.map((v) => ({
      id: v.id, plannedAt: v.plannedAt, purpose: v.purpose, location: v.location, status: v.status, account: v.account,
    })),
    openVisits: openVisits.slice(0, 5).map((v) => ({
      id: v.id, plannedAt: v.plannedAt, purpose: v.purpose, location: v.location, status: v.status, account: v.account,
    })),
    visitsNote,
    pendingItems: {
      reports: `${visits.filter((v) => v.status === "Completed").length} completed visit record(s) feed the service report pipeline — reports generate from the SAME visit records, never re-typed.`,
      signatures: "E-signature capture is not configured in this environment. Customer confirmation is recorded as a typed, audited name on the visit record — clearly labeled, never rendered as a captured signature.",
    },
    partsPending,
    quickActions: QUICK_ACTIONS.filter((a) => ["create-visit", "attendance"].includes(a.id)),
    sourceNote: "Service canon (tickets/SLA/CSAT) is the same executive-canonical source the CEO and analytics views read; visits are read through the Sales OS gate.",
  };
}

// ---------- visit (292) ----------

function visitChecklistFor(visitId: string, purpose: string) {
  const s = store();
  const kind = /service|support|repair|maintenance|installation/i.test(purpose) ? "service" : "sales";
  const template: ChecklistItemDef[] = VISIT_CHECKLISTS[kind];
  const existing = s.visitChecklist.get(visitId);
  if (existing) return { kind, items: existing };
  const items = template.map((c) => ({ ...c, done: false }));
  s.visitChecklist.set(visitId, items);
  return { kind, items };
}

function visitStageOf(visit: { id?: string; status: string; checkedInAt?: number; completedAt?: number }): VisitLifecycleStage {
  const s = store();
  const overlay = s.visitStage.get(visit.id ?? "");
  if (overlay) return overlay;
  if (visit.status === "Completed") return "Completed";
  if (visit.status === "In Progress") return "In Progress";
  return "Scheduled";
}

function visitPayload(role: WorkspaceRole, visitId: string): Result<Record<string, unknown>> {
  if (!visitId) return fail(400, "visit_required", "A visit id is required.");
  const res = salesGet(role, "visit", new URLSearchParams({ id: visitId }));
  if (!res.ok) return { ok: false, status: res.status, code: res.code, message: res.message };
  const v = (res.data as Record<string, unknown>).visit as Record<string, unknown>;
  const s = store();
  const { kind, items } = visitChecklistFor(visitId, String(v.purpose ?? ""));
  const stage = visitStageOf(v as { status: string });
  const criticalOpen = items.filter((c) => c.critical && !c.done);
  return ok({
    visit: {
      id: v.id,
      account: v.account ?? null,
      contact: v.contact ?? null,
      plannedAt: v.plannedAt,
      durationMin: v.durationMin,
      location: v.location,
      purpose: v.purpose,
      status: v.status,
      outcome: v.outcome ?? null,
      notes: v.notes ?? null,
      nextAction: v.nextAction ?? null,
      checkedInAt: v.checkedInAt ?? null,
      completedAt: v.completedAt ?? null,
      ownerName: v.ownerName ?? nameOf(v.ownerId as string),
    },
    stage,
    allowedTransitions: VISIT_TRANSITIONS[stage] ?? [],
    checklist: { kind, items },
    criticalBlock: criticalOpen.length > 0,
    criticalOpen: criticalOpen.map((c) => c.label),
    fieldNotes: s.visitNotes.get(visitId) ?? [],
    parts: s.visitParts.get(visitId) ?? [],
    evidence: [...(s.visitEvidence.get(visitId) ?? []), ...((v.evidence as string[]) ?? [])],
    context: {
      warranty: "Warranty status lives in the asset/warranty registry, which is not linked to this visit yet — Qubit One shows the boundary instead of inventing a warranty state (spec §13).",
      serial: "Asset serial capture is part of the asset registry integration (not configured) — the field records it against the visit notes where known.",
      diagnosis: "Diagnosis is recorded as a field note; structured diagnostics require the service diagnostic integration.",
      signature: "Customer e-signature is not configured. Completion records the visit through visit.complete with outcome + notes + evidence, audited.",
      gps: "Location is used only with explicit permission. No GPS capture is implemented in this environment — visits record check-in time, not coordinates.",
    },
    sourceNote: "The visit record lives in the Sales/Field Visit system (one store). Mobile adds the field execution layer — lifecycle, checklist, notes, parts — audited against the same visit id.",
  });
}

// ---------- attendance (293) ----------

function todayAttendance() {
  const s = store();
  const today = dayKey(Date.now());
  const rec = s.attendance.find((a) => a.employeeId === SESSION_USER_ID && a.day === today);
  if (!rec) return { state: "Not checked in", record: null, verification: ATTENDANCE_VERIFICATION };
  const workedMin = rec.checkoutAt ? Math.round((rec.checkoutAt - rec.checkinAt) / 60000) : undefined;
  return {
    state: rec.checkoutAt ? "Checked out" : "Working",
    record: { ...rec, workedMin },
    verification: ATTENDANCE_VERIFICATION,
  };
}

const ATTENDANCE_VERIFICATION = {
  deviceVerification: false,
  locationVerification: false,
  note: "Device and location verification are NOT configured for this account (spec §14: clearly shown, never faked). A check-in is a plain, audited timestamp from your signed-in session.",
} as const;

function attendancePayload() {
  const s = store();
  const today = dayKey(Date.now());
  const mine = s.attendance.filter((a) => a.employeeId === SESSION_USER_ID).sort((a, b) => b.checkinAt - a.checkinAt);
  const todayRec = mine.find((a) => a.day === today) ?? null;
  const myLeave = EVENTS.filter(
    (e) => e.type === "Leave" && e.organizerId === SESSION_USER_ID && e.start <= Date.now() && e.end >= Date.now(),
  );
  const teamLeave = EVENTS.filter((e) => e.type === "Leave" && e.end >= Date.now() && e.start <= Date.now() + 7 * 86_400_000 && e.organizerId !== SESSION_USER_ID).slice(0, 4);
  return {
    today: todayRec
      ? { ...todayRec, workedMin: todayRec.checkoutAt ? Math.round((todayRec.checkoutAt - todayRec.checkinAt) / 60000) : null, state: todayRec.checkoutAt ? "Checked out" : "Working" }
      : null,
    canCheckIn: !todayRec,
    canCheckOut: !!todayRec && !todayRec.checkoutAt,
    history: mine.slice(0, 14).map((a) => ({
      id: a.id, day: a.day, checkinAt: a.checkinAt, checkoutAt: a.checkoutAt ?? null,
      workedMin: a.checkoutAt ? Math.round((a.checkoutAt - a.checkinAt) / 60000) : null, method: a.method,
    })),
    myLeave: myLeave.map((e) => ({ id: e.id, title: e.title, start: e.start, end: e.end, related: e.related ?? null })),
    teamLeave: teamLeave.map((e) => ({ id: e.id, title: e.title, start: e.start, end: e.end })),
    verification: ATTENDANCE_VERIFICATION,
    leaveNote: "Leave information comes from the enterprise calendar (the same events the HR/workspace calendar shows). Corrections follow the HR correction workflow on desktop — mobile records punches, it does not silently edit them.",
    sourceNote: "Attendance punches are the enterprise attendance record — one audited store. No duplicate HR attendance copy exists.",
  };
}

// ---------- approvals (294) ----------

function approvalBrief(a: ApprovalRequest) {
  return {
    id: a.id,
    kind: a.kind,
    title: a.title,
    requester: nameOf(a.requesterId),
    department: a.department,
    amount: a.amount ?? null,
    submitted: a.submitted,
    priority: a.priority,
    status: a.status,
    sla: a.sla,
    stepUpRequired: a.stepUpRequired ?? false,
    rule: a.rule,
  };
}

function approvalsPayload(role: WorkspaceRole, approvalId?: string) {
  const res = listApprovals(role);
  const all = [...(res.queue ?? []), ...(res.history ?? [])] as ApprovalRequest[];
  if (approvalId) {
    const a = all.find((x) => x.id === approvalId);
    if (!a) return fail(404, "not_found", "Approval request not found in your queue.");
    return ok({
      approval: {
        ...approvalBrief(a),
        detail: a.detail,
        history: (a.history ?? []).map((h) => ({ at: h.at, actor: h.actor, event: h.event })),
        decidedAt: a.decidedAt ?? null,
        decidedBy: a.decidedBy ?? null,
        decisionNote: a.decisionNote ?? null,
      },
      canDecide: a.status === "Pending" && role !== "employee" && role !== "sales-exec",
      stepUpRequired: a.stepUpRequired ?? false,
      stepUpNote: a.stepUpRequired
        ? "This request is flagged sensitive — the server requires reauthentication before the decision is accepted (the same step-up contract as desktop)."
        : null,
      sourceNote: "The centralized Approval Matrix queue (Screen 09 routing) — mobile decisions go through the SAME decideApproval enforcement.",
    });
  }
  return ok({
    queue: (res.queue ?? []).filter((a) => a.status === "Pending").map(approvalBrief),
    history: (res.history ?? []).slice(0, 10).map(approvalBrief),
    scopeNote: res.note,
    canDecide: role !== "employee" && role !== "sales-exec",
    sourceNote: "Pending + decided requests from the ONE approval queue, scoped by the Approval Matrix exactly as on desktop.",
  });
}

// ---------- notifications (295) ----------

function notificationBrief(n: (typeof NOTIFICATIONS)[number]) {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    category: n.category,
    ts: n.ts,
    unread: n.unread,
    priority: n.priority,
    source: n.source,
    link: n.link ?? null,
  };
}

function notificationsPayload(category?: string) {
  const s = store();
  let items = NOTIFICATIONS.map((n) => ({ ...n, unread: s.notifRead.has(n.id) ? false : n.unread }));
  const categories = [...new Set(NOTIFICATIONS.map((n) => n.category))];
  const unreadOnly = (category ?? "").trim().toLowerCase() === "unread";
  if (category && !unreadOnly && category.toLowerCase() !== "all") items = items.filter((n) => n.category.toLowerCase() === category.toLowerCase());
  if (unreadOnly) items = items.filter((n) => n.unread);
  return ok({
    items: items.map(notificationBrief),
    categories: ["All", "Unread", ...categories],
    unreadCount: NOTIFICATIONS.filter((n) => (s.notifRead.has(n.id) ? false : n.unread)).length,
    sourceNote: "The centralized notification engine — read-state is tracked server-side so mobile and desktop stay in step.",
  });
}

// ---------- profile (296) ----------

function profilePayload(role: WorkspaceRole) {
  const me = getEmployee(SESSION_USER_ID)!;
  const manager = me.managerId ? getEmployee(me.managerId) : null;
  return {
    profile: {
      id: me.id,
      name: me.name,
      title: me.title,
      department: me.department,
      location: me.location,
      email: me.email,
      phone: me.phone,
      status: me.status,
      since: me.since,
      employeeId: me.employeeId,
      manager: manager ? { id: manager.id, name: manager.name, title: manager.title } : null,
    },
    editableFields: ["phone"],
    lockedFieldsNote: "Employee ID, title, department, manager and status are company-controlled — the server rejects edits to them even if a crafted request includes them (the same updateProfile contract as desktop).",
    security: {
      sessions: "Managed in Device & Sessions (screen 35) — the same session store, opened from here.",
      passkeysAvailable: true,
      mfaAvailable: true,
    },
    cards: { idCard: "mobile-id-card", visitingCard: "mobile-visiting-card" },
    role,
    sourceNote: "Your employee registry record — the single identity used across desktop and mobile.",
  };
}

// ---------- id card (297) ----------

function idCardPayload() {
  const me = getEmployee(SESSION_USER_ID)!;
  const verificationPayload = createHash("sha256")
    .update([me.employeeId, me.name, me.title, me.department, me.status].join("|"))
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();
  return {
    card: {
      company: COMPANY_NAME,
      name: me.name,
      employeeId: me.employeeId,
      designation: me.title,
      department: me.department,
      location: me.location,
      status: me.status,
      photoInitials: me.name.split(" ").map((p) => p[0]).join("").slice(0, 2),
    },
    validity: me.status === "Active" ? "Valid — employment active" : `Status: ${me.status} — verify with HR`,
    verification: {
      payload: verificationPayload,
      note: "The QR encodes a signed verification reference (hash of registry fields) — it verifies against the employee registry without exposing any additional personal data (spec §18).",
    },
    minimizeNote: "The card carries the minimum required identity fields. Home address, personal contacts and HR-sensitive data are never rendered (spec §18).",
    sourceNote: "The same registry record behind the desktop Digital ID Card (screen 53).",
  };
}

// ---------- visiting card (298) ----------

function visitingCardPayload() {
  const me = getEmployee(SESSION_USER_ID)!;
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${me.name}`,
    `ORG:${COMPANY_NAME}`,
    `TITLE:${me.title}`,
    `TEL;TYPE=WORK,VOICE:${me.phone}`,
    `EMAIL;TYPE=WORK:${me.email}`,
    "URL:https://www.qubitone.in",
    "END:VCARD",
  ].join("\n");
  return {
    card: {
      company: COMPANY_NAME,
      name: me.name,
      designation: me.title,
      department: me.department,
      phone: me.phone,
      email: me.email,
      website: "www.qubitone.in",
      location: me.location,
      photoInitials: me.name.split(" ").map((p) => p[0]).join("").slice(0, 2),
    },
    vcard,
    shareCount: store().cardShares.length,
    sharePolicy: "Sharing respects company policy: the share action records an audited event. The card carries only work contact fields (spec §19).",
    sourceNote: "Built on the Phase 4 visiting-card identity — the same record as screens 54/95.",
  };
}

// ---------- mail (299) ----------

function mailPayload(role: WorkspaceRole, folder: string, mailId?: string, q?: string) {
  if (mailId) {
    const res = listMail(role, { folder: "all", limit: 200 });
    const m = res.items.find((x) => x.id === mailId);
    if (!m) return fail(404, "not_found", "Message not found in your mailbox.");
    markMail(role, mailId, { read: true });
    return ok({
      message: {
        id: m.id, folder: m.folder, subject: m.subject, body: m.body, preview: m.preview, ts: m.ts,
        from: m.fromId ? nameOf(m.fromId) : m.fromExternal?.name ?? "External",
        fromEmail: m.fromId ? employees.find((e) => e.id === m.fromId)?.email : m.fromExternal?.email,
        to: m.to ?? [], cc: m.cc ?? [], attachments: m.attachments ?? [], labels: m.labels ?? [],
        sendStatus: m.sendStatus ?? null,
      },
      sourceNote: "Your enterprise mailbox — opening a message marks it read through the same mail system.",
    });
  }
  const res = listMail(role, { folder, q, limit: 40 });
  const counts = {
    inbox: listMail(role, { folder: "inbox" }).total,
    inboxUnread: listMail(role, { folder: "inbox", unreadOnly: true }).total,
    sent: listMail(role, { folder: "sent" }).total,
    drafts: listMail(role, { folder: "drafts" }).total,
  };
  return ok({
    folder,
    items: res.items.map((m) => ({
      id: m.id, subject: m.subject, preview: m.preview, ts: m.ts, read: m.read, starred: m.starred ?? false,
      from: m.fromId ? nameOf(m.fromId) : m.fromExternal?.name ?? "External",
      to: m.to ?? [], attachments: (m.attachments ?? []).length, sendStatus: m.sendStatus ?? null,
    })),
    counts,
    total: res.total,
    sourceNote: "The enterprise mail system (one mailbox across desktop and mobile). External transport is the configured mail integration — no fake delivery states.",
  });
}

// ---------- AI (300) ----------

function aiPayload(role: WorkspaceRole) {
  const s = store();
  const chat = s.aiChats[s.aiChats.length - 1] ?? null;
  return {
    prompts: [
      { id: "summarize-day", label: "Summarize my day" },
      { id: "pending-approvals", label: "Show my pending approvals" },
      { id: "leads-followup", label: "Which leads need follow-up?" },
      { id: "meetings-today", label: "Summarize today's meetings" },
      { id: "service-visits", label: "Show my open service visits" },
    ],
    conversation: chat ? chat.messages : [],
    conversationId: chat?.id ?? null,
    governance: {
      permissionNote: "The AI reads ONLY a context composed from data your role is already authorized to see — it cannot reach the database directly and cannot bypass authorization (spec §41).",
      approvalNote: "Consequential actions (approvals, status changes) are never executed by the AI — it points to them; you perform them through the governed screens.",
      provider: "Qubit AI runtime · GLM",
    },
    recentContextNote: role === "employee"
      ? "Your scope: your own tasks, meetings, notifications and mailbox."
      : "Your scope reflects your role boundary across Workspace, Sales and Service systems.",
    sourceNote: "A mobile interface to the existing Qubit AI Platform — one governance model, one audit trail.",
  };
}

/** Compose the permission-scoped basis for a mobile AI question. */
async function aiBasis(role: WorkspaceRole, question: string): Promise<{ basis: string; facts: string[] }> {
  const facts: string[] = [];
  const q = question.toLowerCase();

  // Tasks (always authorized — own queue)
  const tasks = listTasks();
  const open = tasks.filter((t) => t.status !== "Completed" && t.status !== "Cancelled");
  const overdue = open.filter((t) => t.due !== null && t.due < WORKSPACE_NOW);
  const dueToday = open.filter((t) => t.due !== null && dayKey(t.due) === WORKSPACE_DAY);
  if (overdue.length) facts.push(`Overdue tasks (${overdue.length}): ${overdue.slice(0, 3).map((t) => t.title).join("; ")}.`);
  if (dueToday.length) facts.push(`Tasks due today (${dueToday.length}): ${dueToday.slice(0, 3).map((t) => t.title).join("; ")}.`);
  if (!overdue.length && !dueToday.length) facts.push("No overdue or due-today tasks in your queue.");

  // Meetings today (own participation)
  const todayMeetings = MEETINGS.filter(
    (m) => dayKey(m.start) === WORKSPACE_DAY && m.status !== "Cancelled" && m.participantIds.includes(SESSION_USER_ID),
  );
  if (todayMeetings.length) {
    facts.push(`Meetings today (${todayMeetings.length}): ${todayMeetings.map((m) => `${m.title} at ${fmtTime(m.start)} (${m.location})`).join("; ")}.`);
  }

  // Approvals (role-scoped via listApprovals)
  const approvals = listApprovals(role);
  const pending = (approvals.queue ?? []).filter((a) => a.status === "Pending");
  if (pending.length) facts.push(`Pending approvals routed to you (${pending.length}): ${pending.slice(0, 3).map((a) => a.title).join("; ")}.`);
  else facts.push("No approvals are currently routed to you.");

  // Notifications unread
  const unread = NOTIFICATIONS.filter((n) => (store().notifRead.has(n.id) ? false : n.unread));
  if (unread.length) facts.push(`Unread notifications (${unread.length}): ${unread.slice(0, 3).map((n) => n.title).join("; ")}.`);

  // Sales-scoped facts only when the caller holds sales authorization
  const salesRoles: WorkspaceRole[] = ["administrator", "dept-head", "sales-exec"];
  if (salesRoles.includes(role) && (q.includes("lead") || q.includes("follow") || q.includes("sales") || q.includes("day") || q.includes("visit"))) {
    const fu = salesGet(role, "followups", new URLSearchParams());
    if (fu.ok) {
      const rows = ((fu.data as Record<string, unknown>).rows ?? []) as Record<string, unknown>[];
      const due = rows.filter((f) => f.state === "Overdue" || f.state === "Due Today");
      if (due.length) facts.push(`Sales follow-ups needing attention (${due.length}): ${due.slice(0, 4).map((f) => `${f.subject} (${f.state})`).join("; ")}.`);
      else facts.push("No overdue or due-today sales follow-ups in your scope.");
    }
    const visits = salesGet(role, "visits", new URLSearchParams());
    if (visits.ok && (q.includes("visit") || q.includes("service"))) {
      const rows = (((visits.data as Record<string, unknown>).rows ?? []) as unknown as SalesVisitRow[]).filter((v) => v.status === "Planned" || v.status === "In Progress");
      facts.push(rows.length
        ? `Open field visits (${rows.length}): ${rows.slice(0, 4).map((v) => `${v.purpose} at ${v.location} (${v.status})`).join("; ")}.`
        : "No open field visits in your scope.");
    }
  }

  const basis = [
    `Employee: ${ACTOR_NAME} (${role}). Today is ${MOBILE_PERIOD.label} (${MOBILE_PERIOD.timezone}).`,
    "AUTHORIZED CONTEXT (server-composed from systems this role may read):",
    ...facts.map((f) => `- ${f}`),
  ].join("\n");
  return { basis, facts };
}

// ============================================================
// POST — every consequential mobile action
// ============================================================

export type MobileAction =
  | { type: "task.status"; input: Record<string, unknown> }
  | { type: "task.create"; input: Record<string, unknown> }
  | { type: "task.comment"; input: Record<string, unknown> }
  | { type: "approval.decide"; input: Record<string, unknown> }
  | { type: "meeting.note"; input: Record<string, unknown> }
  | { type: "meeting.actionitem"; input: Record<string, unknown> }
  | { type: "meeting.join"; input: Record<string, unknown> }
  | { type: "attendance.checkin"; input: Record<string, unknown> }
  | { type: "attendance.checkout"; input: Record<string, unknown> }
  | { type: "visit.stage"; input: Record<string, unknown> }
  | { type: "visit.checklist"; input: Record<string, unknown> }
  | { type: "visit.note"; input: Record<string, unknown> }
  | { type: "visit.part"; input: Record<string, unknown> }
  | { type: "whatsapp.reply"; input: Record<string, unknown> }
  | { type: "lead.note"; input: Record<string, unknown> }
  | { type: "lead.followup"; input: Record<string, unknown> }
  | { type: "whatsapp.note"; input: Record<string, unknown> }
  | { type: "whatsapp.followup"; input: Record<string, unknown> }
  | { type: "whatsapp.read"; input: Record<string, unknown> }
  | { type: "notification.read"; input: Record<string, unknown> }
  | { type: "notification.readall"; input: Record<string, unknown> }
  | { type: "mail.mark"; input: Record<string, unknown> }
  | { type: "mail.send"; input: Record<string, unknown> }
  | { type: "mail.draft"; input: Record<string, unknown> }
  | { type: "profile.update"; input: Record<string, unknown> }
  | { type: "card.share"; input: Record<string, unknown> }
  | { type: "ai.ask"; input: Record<string, unknown> }
  | { type: "ai.clear"; input: Record<string, unknown> };

const str = (o: Record<string, unknown>, k: string): string | undefined =>
  typeof o[k] === "string" ? (o[k] as string).trim() : undefined;
const num = (o: Record<string, unknown>, k: string): number | undefined =>
  typeof o[k] === "number" && Number.isFinite(o[k] as number) ? (o[k] as number) : undefined;
const bool = (o: Record<string, unknown>, k: string): boolean | undefined =>
  typeof o[k] === "boolean" ? (o[k] as boolean) : undefined;

export async function mobilePost(role: WorkspaceRole, action: MobileAction): Promise<{ ok: true; message: string; [k: string]: unknown } | { ok: false; status: number; code: string; message: string }> {
  const s = store();
  switch (action.type) {
    case "task.status": {
      const id = str(action.input, "id");
      const status = str(action.input, "status");
      if (!id || !status) return { ok: false, status: 422, code: "invalid_input", message: "Task id and status are required." };
      const res = updateTask(role, { id, status: status as Task["status"] });
      if (!res.ok) return { ok: false, status: res.status, code: res.code, message: res.message };
      return { ok: true, message: `Task moved to ${status}.`, task: res.task };
    }
    case "task.create": {
      const title = str(action.input, "title");
      if (!title) return { ok: false, status: 422, code: "invalid_title", message: "A task title is required." };
      const res = createTask(role, { title, detail: str(action.input, "detail"), priority: str(action.input, "priority") as Task["priority"] | undefined, due: num(action.input, "due") ?? null });
      if (!res.ok) return { ok: false, status: res.status, code: res.code, message: res.message };
      return { ok: true, message: "Task created in your workspace queue.", task: res.task };
    }
    case "task.comment": {
      const id = str(action.input, "id");
      const text = str(action.input, "text");
      if (!id || !text || text.length < 2) return { ok: false, status: 422, code: "invalid_comment", message: "A comment of at least 2 characters is required." };
      const task = listTasks().find((t) => t.id === id);
      if (!task) return { ok: false, status: 404, code: "not_found", message: "Task not found in your queue." };
      const comments = s.taskComments.get(id) ?? [];
      comments.push({ at: Date.now(), by: ACTOR_NAME, text });
      s.taskComments.set(id, comments);
      writeAudit({ actorId: SESSION_USER_ID, action: "Mobile task comment", resource: task.title, result: "Success", source: "Mobile", context: "Comment appended to the workspace task record" });
      return { ok: true, message: "Comment added to the task.", comments };
    }
    case "approval.decide": {
      const id = str(action.input, "id");
      const decision = str(action.input, "decision") as "Approved" | "Rejected" | "Changes requested" | undefined;
      if (!id || !decision || !["Approved", "Rejected", "Changes requested"].includes(decision)) {
        return { ok: false, status: 422, code: "invalid_decision", message: "A valid decision is required." };
      }
      const res = decideApproval(role, { id, decision, note: str(action.input, "note"), stepUpPassword: str(action.input, "stepUpPassword") });
      if (!res.ok) return { ok: false, status: res.status, code: res.code, message: res.message };
      return { ok: true, message: `Request ${decision.toLowerCase()}. The decision is recorded in the enterprise audit trail.`, approval: res.approval };
    }
    case "meeting.note": {
      const id = str(action.input, "id");
      const text = str(action.input, "text");
      const m = id ? MEETINGS.find((x) => x.id === id) : undefined;
      if (!id || !m) return { ok: false, status: 404, code: "not_found", message: "Meeting not found." };
      if (!m.participantIds.includes(SESSION_USER_ID) && m.organizerId !== SESSION_USER_ID) {
        return { ok: false, status: 403, code: "forbidden", message: "Only participants can add notes to this meeting." };
      }
      if (!text || text.length < 2) return { ok: false, status: 422, code: "invalid_note", message: "A note of at least 2 characters is required." };
      const notes = s.meetingNotes.get(id) ?? [];
      notes.push({ at: Date.now(), by: ACTOR_NAME, text });
      s.meetingNotes.set(id, notes);
      writeAudit({ actorId: SESSION_USER_ID, action: "Mobile meeting note", resource: m.title, result: "Success", source: "Mobile", context: "Note appended to the meeting record" });
      return { ok: true, message: "Note added to the meeting record.", notes };
    }
    case "meeting.actionitem": {
      const id = str(action.input, "id");
      const title = str(action.input, "title");
      const m = id ? MEETINGS.find((x) => x.id === id) : undefined;
      if (!id || !m) return { ok: false, status: 404, code: "not_found", message: "Meeting not found." };
      if (!m.participantIds.includes(SESSION_USER_ID) && m.organizerId !== SESSION_USER_ID) {
        return { ok: false, status: 403, code: "forbidden", message: "Only participants can add action items." };
      }
      if (!title || title.length < 4) return { ok: false, status: 422, code: "invalid_title", message: "Describe the action item (4+ characters)." };
      const ownerId = str(action.input, "ownerId") ?? SESSION_USER_ID;
      if (!employees.some((e) => e.id === ownerId)) return { ok: false, status: 422, code: "invalid_owner", message: "Choose a valid owner." };
      const items = s.meetingActions.get(id) ?? [];
      items.push({ title, ownerId, due: num(action.input, "due") ?? null, at: Date.now() });
      s.meetingActions.set(id, items);
      writeAudit({ actorId: SESSION_USER_ID, action: "Mobile meeting action item", resource: `${m.title} — ${title}`, result: "Success", source: "Mobile", context: `Owner: ${nameOf(ownerId)}` });
      return { ok: true, message: "Action item recorded on the meeting.", items };
    }
    case "meeting.join": {
      const id = str(action.input, "id");
      const m = MEETINGS.find((x) => x.id === id);
      if (!m) return { ok: false, status: 404, code: "not_found", message: "Meeting not found." };
      if (m.status !== "Scheduled" && m.status !== "In Progress") {
        return { ok: false, status: 409, code: "invalid_state", message: `This meeting is ${m.status.toLowerCase()} — nothing to join.` };
      }
      writeAudit({ actorId: SESSION_USER_ID, action: "Mobile meeting join", resource: m.title, result: "Success", source: "Mobile", context: `Handoff to ${m.platform} recorded` });
      return { ok: true, message: `Handoff to ${m.platform} recorded — the meeting platform handles the call itself.`, platform: m.platform };
    }
    case "attendance.checkin": {
      const today = dayKey(Date.now());
      if (s.attendance.some((a) => a.employeeId === SESSION_USER_ID && a.day === today && !a.checkoutAt)) {
        return { ok: false, status: 409, code: "already_checked_in", message: "You are already checked in today." };
      }
      const rec: AttendanceRecord = {
        id: `att-${Date.now()}`,
        employeeId: SESSION_USER_ID,
        day: today,
        checkinAt: Date.now(),
        method: "Mobile · web session",
      };
      s.attendance.push(rec);
      writeAudit({ actorId: SESSION_USER_ID, action: "Mobile attendance check-in", resource: `Attendance ${today}`, result: "Success", source: "Mobile", context: "Plain timestamp — device/location verification not configured" });
      return { ok: true, message: `Checked in at ${fmtTime(rec.checkinAt)} (IST).`, record: rec, verification: ATTENDANCE_VERIFICATION };
    }
    case "attendance.checkout": {
      const today = dayKey(Date.now());
      const rec = s.attendance.find((a) => a.employeeId === SESSION_USER_ID && a.day === today);
      if (!rec) return { ok: false, status: 404, code: "not_checked_in", message: "No check-in found for today." };
      if (rec.checkoutAt) return { ok: false, status: 409, code: "already_checked_out", message: "You are already checked out today." };
      rec.checkoutAt = Date.now();
      rec.workedMin = Math.round((rec.checkoutAt - rec.checkinAt) / 60000);
      writeAudit({ actorId: SESSION_USER_ID, action: "Mobile attendance check-out", resource: `Attendance ${today}`, result: "Success", source: "Mobile", context: `Worked ${rec.workedMin} min` });
      return { ok: true, message: `Checked out at ${fmtTime(rec.checkoutAt)} — ${rec.workedMin} min recorded.`, record: rec };
    }
    case "visit.stage": {
      const id = str(action.input, "id");
      const next = str(action.input, "stage") as VisitLifecycleStage | undefined;
      if (!id || !next) return { ok: false, status: 422, code: "invalid_input", message: "Visit id and target stage are required." };
      const res = salesGet(role, "visit", new URLSearchParams({ id }));
      if (!res.ok) return { ok: false, status: res.status, code: res.code, message: res.message };
      const v = (res.data as Record<string, unknown>).visit as Record<string, unknown>;
      const current = visitStageOf(v as { status: string });
      const allowed = VISIT_TRANSITIONS[current] ?? [];
      if (!allowed.includes(next)) {
        return { ok: false, status: 409, code: "invalid_transition", message: `A visit cannot move from ${current} to ${next}.` };
      }
      // Delegated transitions touch the ONE visit record via the Sales OS.
      if (next === "In Progress") {
        const r = salesPost(role, { type: "visit.start", input: { id } });
        if (!r.ok) return { ok: false, status: r.status, code: r.code, message: r.message };
        s.visitStage.set(id, "In Progress");
        return { ok: true, message: r.message, stage: "In Progress" };
      }
      if (next === "Completed") {
        const items = s.visitChecklist.get(id) ?? [];
        const criticalOpen = items.filter((c) => c.critical && !c.done);
        if (criticalOpen.length) {
          return { ok: false, status: 409, code: "checklist_block", message: `Critical checklist items are open: ${criticalOpen.map((c) => c.label).join("; ")}. Complete or re-plan them first.` };
        }
        const outcome = str(action.input, "outcome");
        const notes = str(action.input, "notes") ?? (s.visitNotes.get(id) ?? []).map((n) => n.text).join(" • ");
        if (!outcome) return { ok: false, status: 422, code: "outcome_required", message: "Record the visit outcome before completing." };
        if (!notes) return { ok: false, status: 422, code: "notes_required", message: "Add at least one field note — visits complete with their notes." };
        const evidence = s.visitEvidence.get(id) ?? [];
        const r = salesPost(role, { type: "visit.complete", input: { id, outcome, notes, evidence, nextAction: str(action.input, "nextAction") } });
        if (!r.ok) return { ok: false, status: r.status, code: r.code, message: r.message };
        s.visitStage.set(id, "Completed");
        return { ok: true, message: r.message, stage: "Completed" };
      }
      // Overlay-only field stages (En Route, Arrived, Paused, resumed In Progress)
      s.visitStage.set(id, next);
      writeAudit({ actorId: SESSION_USER_ID, action: "Mobile visit stage", resource: String(v.purpose ?? id), result: "Success", source: "Mobile", context: `Field stage: ${current} → ${next}` });
      return { ok: true, message: `Visit stage moved to ${next}.`, stage: next };
    }
    case "visit.checklist": {
      const id = str(action.input, "id");
      const itemId = str(action.input, "itemId");
      const done = bool(action.input, "done");
      if (!id) return { ok: false, status: 422, code: "invalid_input", message: "A visit id is required." };
      const res = salesGet(role, "visit", new URLSearchParams({ id }));
      if (!res.ok) return { ok: false, status: res.status, code: res.code, message: res.message };
      const purpose = String(((res.data as Record<string, unknown>).visit as Record<string, unknown>).purpose ?? "");
      const { items } = visitChecklistFor(id, purpose);
      const item = items.find((c) => c.id === itemId);
      if (!item || typeof done !== "boolean") return { ok: false, status: 422, code: "invalid_item", message: "A valid checklist item and state are required." };
      item.done = done;
      writeAudit({ actorId: SESSION_USER_ID, action: "Mobile visit checklist", resource: `${purpose} · ${item.label}`, result: "Success", source: "Mobile", context: done ? "Marked complete" : "Reopened" });
      return { ok: true, message: `Checklist item ${done ? "completed" : "reopened"}.`, items };
    }
    case "visit.note": {
      const id = str(action.input, "id");
      const text = str(action.input, "text");
      if (!id || !text || text.length < 2) return { ok: false, status: 422, code: "invalid_note", message: "A note of at least 2 characters is required." };
      const res = salesGet(role, "visit", new URLSearchParams({ id }));
      if (!res.ok) return { ok: false, status: res.status, code: res.code, message: res.message };
      const notes = s.visitNotes.get(id) ?? [];
      notes.push({ at: Date.now(), by: ACTOR_NAME, text });
      s.visitNotes.set(id, notes);
      writeAudit({ actorId: SESSION_USER_ID, action: "Mobile visit note", resource: id, result: "Success", source: "Mobile", context: "Field note recorded against the visit" });
      return { ok: true, message: "Field note recorded.", notes };
    }
    case "visit.part": {
      const id = str(action.input, "id");
      const name = str(action.input, "name");
      const qty = num(action.input, "qty") ?? 1;
      if (!id || !name) return { ok: false, status: 422, code: "invalid_part", message: "A part name is required." };
      const res = salesGet(role, "visit", new URLSearchParams({ id }));
      if (!res.ok) return { ok: false, status: res.status, code: res.code, message: res.message };
      const parts = s.visitParts.get(id) ?? [];
      parts.push({ name, qty, at: Date.now() });
      s.visitParts.set(id, parts);
      writeAudit({ actorId: SESSION_USER_ID, action: "Mobile visit part recorded", resource: `${name} ×${qty}`, result: "Success", source: "Mobile", context: "Recorded against the visit — parts inventory remains the Inventory system's source of truth" });
      return { ok: true, message: "Part usage recorded against the visit.", parts };
    }
    case "lead.note": {
      const leadId = str(action.input, "leadId");
      const note = str(action.input, "note");
      if (!leadId || !note || note.length < 3) return { ok: false, status: 422, code: "invalid_note", message: "A note of at least 3 characters is required." };
      const r = salesPost(role, { type: "lead.note", input: { id: leadId, body: note } });
      if (!r.ok) return { ok: false, status: r.status, code: r.code, message: r.message };
      return { ok: true, message: r.message };
    }
    case "lead.followup": {
      const leadId = str(action.input, "leadId");
      const subject = str(action.input, "subject");
      if (!leadId || !subject) return { ok: false, status: 422, code: "invalid_input", message: "A lead and a subject are required." };
      const r = salesPost(role, { type: "lead.followup", input: { leadId, type: str(action.input, "type") ?? "Call", subject, dueAt: num(action.input, "dueAt") ?? Date.now() + 86_400_000, priority: "Medium" } });
      if (!r.ok) return { ok: false, status: r.status, code: r.code, message: r.message };
      return { ok: true, message: r.message };
    }
    case "whatsapp.reply": {
      const id = str(action.input, "id");
      const body = str(action.input, "body");
      const r = salesPost(role, { type: "whatsapp.reply", input: { id, body } });
      if (!r.ok) return { ok: false, status: r.status, code: r.code, message: r.message };
      s.waRead.set(id ?? "", true);
      return { ok: true, message: r.message, conversationId: r.conversationId };
    }
    case "whatsapp.note": {
      const id = str(action.input, "id");
      const text = str(action.input, "text");
      const r = salesPost(role, { type: "whatsapp.note", input: { id, text } });
      if (!r.ok) return { ok: false, status: r.status, code: r.code, message: r.message };
      return { ok: true, message: r.message };
    }
    case "whatsapp.followup": {
      const leadId = str(action.input, "leadId");
      const subject = str(action.input, "subject");
      if (!leadId || !subject) return { ok: false, status: 422, code: "invalid_input", message: "A lead and a subject are required." };
      const r = salesPost(role, { type: "lead.followup", input: { leadId, type: "WhatsApp", subject, dueAt: num(action.input, "dueAt") ?? Date.now() + 86_400_000, priority: "Medium" } });
      if (!r.ok) return { ok: false, status: r.status, code: r.code, message: r.message };
      return { ok: true, message: r.message };
    }
    case "whatsapp.read": {
      const id = str(action.input, "id");
      if (!id) return { ok: false, status: 422, code: "invalid_input", message: "A conversation id is required." };
      s.waRead.set(id, true);
      return { ok: true, message: "Conversation marked read." };
    }
    case "notification.read": {
      const id = str(action.input, "id");
      if (!id) return { ok: false, status: 422, code: "invalid_input", message: "A notification id is required." };
      s.notifRead.set(id, true);
      return { ok: true, message: "Marked as read." };
    }
    case "notification.readall": {
      for (const n of NOTIFICATIONS) s.notifRead.set(n.id, true);
      return { ok: true, message: "All notifications marked read." };
    }
    case "mail.mark": {
      const id = str(action.input, "id");
      if (!id) return { ok: false, status: 422, code: "invalid_input", message: "A message id is required." };
      const res = markMail(role, id, { read: bool(action.input, "read") ?? true, starred: bool(action.input, "starred") });
      if (!res.ok) return { ok: false, status: res.status, code: res.code, message: res.message };
      return { ok: true, message: "Mailbox updated." };
    }
    case "mail.send": {
      const to = Array.isArray(action.input.to) ? (action.input.to as string[]) : [];
      const res = sendMail(role, {
        to,
        cc: Array.isArray(action.input.cc) ? (action.input.cc as string[]) : [],
        subject: str(action.input, "subject") ?? "",
        body: str(action.input, "body") ?? "",
        attachments: Array.isArray(action.input.attachments) ? (action.input.attachments as { name: string; sizeKb: number; type: string }[]) : [],
      });
      if (!res.ok) return { ok: false, status: res.status, code: res.code, message: res.message };
      return { ok: true, message: "Message sent through the enterprise mail system.", id: res.message.id };
    }
    case "mail.draft": {
      const res = saveDraft(role, {
        draftId: str(action.input, "draftId"),
        to: Array.isArray(action.input.to) ? (action.input.to as string[]) : [],
        subject: str(action.input, "subject") ?? "",
        body: str(action.input, "body") ?? "",
      });
      if (!res.ok) return { ok: false, status: 500, code: "draft_failed", message: "The draft could not be saved." };
      return { ok: true, message: "Draft saved to your mailbox.", id: res.draft.id };
    }
    case "profile.update": {
      const patch: Record<string, unknown> = {};
      if (action.input.phone !== undefined) patch.phone = action.input.phone;
      if (action.input.about !== undefined) patch.about = action.input.about;
      const res = updateProfile(role, patch);
      if (!res.ok) return { ok: false, status: res.status, code: res.code, message: res.message };
      return { ok: true, message: "Profile updated — self-service fields only.", updated: res.updated };
    }
    case "card.share": {
      const channel = str(action.input, "channel") ?? "link";
      s.cardShares.push({ at: Date.now(), channel });
      writeAudit({ actorId: SESSION_USER_ID, action: "Mobile visiting card shared", resource: `via ${channel}`, result: "Success", source: "Mobile", context: "Work contact card share (policy-respecting)" });
      return { ok: true, message: `Card share via ${channel} recorded.`, shareCount: s.cardShares.length };
    }
    case "ai.ask": {
      const question = str(action.input, "question");
      if (!question || question.length < 3) return { ok: false, status: 422, code: "invalid_question", message: "Ask a question (3+ characters)." };
      if (question.length > 500) return { ok: false, status: 422, code: "invalid_question", message: "Keep the question under 500 characters." };
      const { basis, facts } = await aiBasis(role, question);
      let chat = s.aiChats[s.aiChats.length - 1];
      if (!chat) {
        chat = { id: `ai-${Date.now()}`, at: Date.now(), messages: [] };
        s.aiChats.push(chat);
      }
      chat.messages.push({ role: "user", content: question });
      const completion = await runCompletion(
        {
          system: [
            "You are the Qubit One Mobile assistant. Answer ONLY from the authorized context given to you.",
            UNTRUSTED_CONTENT_RULE,
            "Rules: be concise (<=120 words). Never invent numbers, names or statuses that are not in the context.",
            "If the context lacks the data, say exactly: Data unavailable.",
            "Do not propose performing consequential actions yourself — point the user to the governed screen instead.",
          ].join("\n"),
          messages: [{ role: "user", content: `${untrustedBlock("Authorized context", basis)}\n\nQuestion: ${question}` }],
          maxTokens: 320,
          temperature: 0.2,
        },
        20_000,
      );
      let answer: string;
      let mode: "ai" | "deterministic";
      if (completion.ok) {
        answer = completion.text;
        mode = "ai";
      } else {
        answer = [
          "The AI runtime is unavailable right now — here is the grounded summary from your authorized data:",
          ...facts.map((f) => `• ${f}`),
        ].join("\n");
        mode = "deterministic";
      }
      chat.messages.push({ role: "assistant", content: answer, basis: `mode:${mode}; facts:${facts.length}` });
      if (chat.messages.length > 40) chat.messages.splice(0, chat.messages.length - 40);
      writeAudit({
        actorId: SESSION_USER_ID,
        action: "Mobile AI answer generated",
        resource: question.slice(0, 80),
        result: "Success",
        source: "Mobile",
        severity: "Info",
        context: `Scoped basis (${facts.length} authorized facts) · ${mode === "ai" ? "LLM answer" : "deterministic fallback"} · latency ${"ms" in completion ? completion.ms : "n/a"}ms`,
      });
      return { ok: true, message: mode === "ai" ? "Answer generated from your authorized context." : "AI runtime unavailable — deterministic grounded summary provided.", conversation: chat.messages, mode };
    }
    case "ai.clear": {
      s.aiChats = [];
      return { ok: true, message: "Conversation cleared." };
    }
  }
}
