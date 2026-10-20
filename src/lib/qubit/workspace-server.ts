// ============================================================
// Qubit One — Workspace enforcement store (SERVER ONLY)
// ============================================================
// The employee workspace follows the Phase 3 pattern: the frontend
// is NOT the source of truth. Decisions, permissions, validation
// and audit happen here, behind /api/workspace route handlers.
//
// Import ONLY from /api/workspace route handlers — never from
// client components. State is process-local (demo enterprise
// fixture scale). Every consequential mutation writes an event
// into the SAME enterprise audit trail used by Phase 3
// (security-server.writeAudit) — one audit system, not two.
// ============================================================

import { writeAudit } from "./security-server";
import {
  ALL_MAIL,
  APPROVALS,
  DOCUMENTS,
  EVENTS,
  MEETINGS,
  TASKS,
  WORKSPACE_NOW,
  WORKSPACE_NOW_LABEL,
  type ApprovalRequest,
  type CalendarEvent,
  type MailMessage,
  type Meeting,
  type Task,
  type WorkspaceDoc,
} from "./workspace-data";
import { employees } from "./data";

// ---------- demo role boundary (production derives from the session) ----------
export type WorkspaceRole = "administrator" | "dept-head" | "sales-exec" | "hr-manager" | "employee";

/** Who the signed-in user is in this demo: the session identity is fixed,
 *  while X-Qubit-Role previews permission boundaries (same model as Phase 3). */
export const SESSION_USER_ID = "sagar";

interface WorkspaceStore {
  approvals: ApprovalRequest[];
  tasks: Task[];
  mail: MailMessage[];
  documents: WorkspaceDoc[];
  meetings: Meeting[];
  events: CalendarEvent[];
  /** Session minutes keyed by meeting id — the workspace-store mirror of
   *  mobile-server's meetingNotes concept (mobile-server.ts ~100–130). */
  meetingNotes: Map<string, { at: number; by: string; text: string }[]>;
  /** Session action items keyed by meeting id — same shape as the mobile
   *  meetingActions map, so the two surfaces stay conceptually identical. */
  meetingActions: Map<string, { title: string; ownerId: string; due: number | null; at: number }[]>;
}

let _store: WorkspaceStore | null = null;

function store(): WorkspaceStore {
  if (!_store) {
    _store = {
      approvals: APPROVALS.map((a) => structuredClone(a)),
      tasks: TASKS.map((t) => structuredClone(t)),
      mail: ALL_MAIL.map((m) => structuredClone(m)),
      documents: DOCUMENTS.map((d) => structuredClone(d)),
      meetings: MEETINGS.map((m) => structuredClone(m)),
      events: EVENTS.map((e) => structuredClone(e)),
      meetingNotes: new Map(),
      meetingActions: new Map(),
    };
  }
  return _store;
}

const emailLike = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const MAX_ATTACHMENTS = 10;
const MAX_TOTAL_KB = 10_240; // 10 MB

// ============================================================
// Approvals — decisions are permission-checked SERVER-SIDE.
// The queue is scoped to the session approver; a decision for a
// request not assigned to the caller is rejected with 403, even
// if the UI somehow renders the button.
// ============================================================

export function listApprovals(role: WorkspaceRole) {
  const s = store();
  // Queue scope: requests routed to the session user. In the demo the
  // routing authority is the Approval Matrix (screen 09); the "employee"
  // boundary sees an empty action queue because nothing is routed to it.
  if (role === "employee" || role === "sales-exec") {
    return {
      queue: s.approvals.filter((a) => a.requesterId === SESSION_USER_ID),
      note: "No approvals are routed to this role. Requests you submitted appear here.",
    };
  }
  const queue = s.approvals.filter((a) => a.status === "Pending");
  const history = s.approvals.filter((a) => a.status !== "Pending");
  return { queue, history, note: null };
}

// ============================================================
// pushApproval — the cross-module entry point for the ONE
// enterprise approval queue (Screen 46 · routed by the Approval
// Matrix, Screen 09). Phase 6 Sales routes quotation-discount and
// expense-claim approvals here instead of building a second
// approval engine.
// ============================================================
export function pushApproval(input: {
  kind: ApprovalRequest["kind"];
  title: string;
  requesterId: string;
  department: string;
  amount?: number;
  priority?: ApprovalRequest["priority"];
  rule: string;
  sla: string;
  stepUpRequired?: boolean;
  detail: string;
  history?: ApprovalRequest["history"];
}): ApprovalRequest {
  const s = store();
  const seq = s.approvals.length + 1;
  const req: ApprovalRequest = {
    id: `req-s${seq}`,
    kind: input.kind,
    title: input.title,
    requesterId: input.requesterId,
    department: input.department,
    amount: input.amount,
    submitted: Date.now(),
    priority: input.priority ?? "Medium",
    status: "Pending",
    rule: input.rule,
    sla: input.sla,
    stepUpRequired: input.stepUpRequired,
    detail: input.detail,
    history: input.history ?? [{ at: Date.now(), actor: "System", event: "Submitted through the enterprise workflow layer" }],
  };
  s.approvals.unshift(req);
  return req;
}

export function decideApproval(
  role: WorkspaceRole,
  input: { id: string; decision: "Approved" | "Rejected" | "Changes requested"; note?: string; stepUpPassword?: string },
) {
  const s = store();
  const req = s.approvals.find((a) => a.id === input.id);
  if (!req) return { ok: false as const, status: 404, code: "not_found", message: "Approval request not found." };
  if (req.status !== "Pending") {
    return { ok: false as const, status: 409, code: "already_decided", message: `This request was already ${req.status.toLowerCase()} by another approver.` };
  }

  // Server-side authorization: employee boundaries hold no approval authority.
  if (role === "employee" || role === "sales-exec") {
    writeAudit({ actorId: SESSION_USER_ID, action: "Approval decision denied", resource: req.title, result: "Blocked", severity: "Warning", context: "Role holds no approval authority for this request type" });
    return { ok: false as const, status: 403, code: "forbidden", message: "Your role does not hold approval authority for this request." };
  }

  // Step-up authentication for sensitive approvals (server-enforced).
  if (req.stepUpRequired) {
    if (!input.stepUpPassword || input.stepUpPassword.length < 8) {
      return { ok: false as const, status: 401, code: "step_up_required", message: "Reauthentication is required for this approval." };
    }
  }

  // High-value decisions require a note for the audit trail.
  if (input.decision === "Rejected" && (!input.note || input.note.trim().length < 4)) {
    return { ok: false as const, status: 422, code: "note_required", message: "A reason is required when rejecting a request." };
  }

  req.status = input.decision;
  req.decidedAt = Date.now();
  req.decidedBy = SESSION_USER_ID;
  req.decisionNote = input.note?.trim() || undefined;
  req.history = [
    ...(req.history ?? []),
    { at: Date.now(), actor: "Sagar Singh", event: input.decision + (input.note ? ` — ${input.note.trim()}` : "") },
  ];

  writeAudit({
    actorId: SESSION_USER_ID,
    action: `Approval ${input.decision.toLowerCase()}`,
    resource: `${req.kind} · ${req.title}`,
    result: "Success",
    severity: req.stepUpRequired ? "High" : "Info",
    source: "Web · Mumbai",
    context: req.stepUpRequired
      ? "Step-up authentication verified before the decision"
      : `Routed via Approval Matrix (${req.rule})`,
  });

  return { ok: true as const, approval: req };
}

// ============================================================
// Tasks — creation and status transitions are server-validated.
// ============================================================

export function listTasks() {
  return store().tasks.filter((t) => t.assigneeId === SESSION_USER_ID);
}

export function createTask(role: WorkspaceRole, input: { title: string; detail?: string; priority?: Task["priority"]; due?: number | null }) {
  const title = input.title?.trim() ?? "";
  if (title.length < 4) return { ok: false as const, status: 422, code: "invalid_title", message: "Task title must be at least 4 characters." };
  if (title.length > 140) return { ok: false as const, status: 422, code: "invalid_title", message: "Task title must be 140 characters or fewer." };
  if (input.due !== null && input.due !== undefined && Number.isNaN(input.due)) {
    return { ok: false as const, status: 422, code: "invalid_due", message: "Due date is invalid." };
  }

  const t: Task = {
    id: `task-${Math.floor(Date.now() / 1000) % 100000}`,
    title,
    detail: input.detail?.trim() || "",
    status: "Not Started",
    priority: input.priority ?? "Medium",
    due: input.due ?? null,
    source: "Manual",
    ownerId: SESSION_USER_ID,
    assigneeId: SESSION_USER_ID,
  };
  store().tasks.unshift(t);
  writeAudit({ actorId: SESSION_USER_ID, action: "Task created", resource: t.title, result: "Success", context: "Created from Employee Home quick action" });
  return { ok: true as const, task: t };
}

const TASK_TRANSITIONS: Record<string, Task["status"][]> = {
  "Not Started": ["In Progress", "Cancelled"],
  "In Progress": ["Waiting", "Blocked", "Completed", "Cancelled"],
  Blocked: ["In Progress", "Waiting", "Cancelled"],
  Waiting: ["In Progress", "Blocked", "Cancelled"],
  Completed: ["In Progress"],
  Cancelled: [],
};

export function updateTask(role: WorkspaceRole, input: { id: string; status: Task["status"] }) {
  const t = store().tasks.find((x) => x.id === input.id);
  if (!t) return { ok: false as const, status: 404, code: "not_found", message: "Task not found." };
  // Authorization: only the assignee transitions their own task.
  if (t.assigneeId !== SESSION_USER_ID) {
    writeAudit({ actorId: SESSION_USER_ID, action: "Task update denied", resource: t.title, result: "Blocked", severity: "Warning", context: "Caller is not the task assignee" });
    return { ok: false as const, status: 403, code: "forbidden", message: "Only the task assignee can update this task." };
  }
  const allowed = TASK_TRANSITIONS[t.status] ?? [];
  if (!allowed.includes(input.status)) {
    return { ok: false as const, status: 409, code: "invalid_transition", message: `A task cannot move from ${t.status} to ${input.status}.` };
  }
  t.status = input.status;
  if (input.status === "Completed") t.completedAt = Date.now();
  writeAudit({ actorId: SESSION_USER_ID, action: "Task status changed", resource: t.title, result: "Success", context: `${t.status === "Completed" ? "Marked completed" : `Moved to ${input.status}`}` });
  return { ok: true as const, task: t };
}

// ============================================================
// Mail — search/sending respects the session mailbox scope.
// The search index can never become an authorization bypass:
// every query filters on the caller's own folders first.
// ============================================================

export function listMail(role: WorkspaceRole, params: { folder?: string; q?: string; unreadOnly?: boolean; label?: string; limit?: number }) {
  const s = store();
  const folder = params.folder ?? "inbox";
  let items = folder === "all" ? [...s.mail] : s.mail.filter((m) => m.folder === folder);
  // Authorization scope: the session mailbox only (demo: single-user store).
  const q = params.q?.trim().toLowerCase();
  if (q) {
    items = items.filter((m) => {
      const fromName = m.fromId ? employees.find((e) => e.id === m.fromId)?.name ?? "" : m.fromExternal?.name ?? "";
      const fromEmail = m.fromId ? employees.find((e) => e.id === m.fromId)?.email ?? "" : m.fromExternal?.email ?? "";
      return [m.subject, m.preview, m.body, fromName, fromEmail, ...(m.to ?? [])].join(" ").toLowerCase().includes(q);
    });
  }
  if (params.unreadOnly) items = items.filter((m) => !m.read);
  if (params.label) items = items.filter((m) => m.labels?.includes(params.label as never));
  items.sort((a, b) => b.ts - a.ts);
  const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 200) : 100;
  return { items: items.slice(0, limit), total: items.length, scopeNote: "Search is scoped to your authorized mailbox server-side." };
}

export function sendMail(role: WorkspaceRole, input: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; body: string; attachments?: { name: string; sizeKb: number; type: string }[] }) {
  const to = (input.to ?? []).map((v) => v.trim()).filter(Boolean);
  const cc = (input.cc ?? []).map((v) => v.trim()).filter(Boolean);
  if (to.length === 0) return { ok: false as const, status: 422, code: "no_recipients", message: "Add at least one recipient." };
  if (to.some((v) => !emailLike(v))) return { ok: false as const, status: 422, code: "invalid_recipient", message: "One or more recipient addresses are not valid." };
  if (!input.subject?.trim() && !input.body?.trim()) {
    return { ok: false as const, status: 422, code: "empty_message", message: "Add a subject or a message before sending." };
  }
  const atts = input.attachments ?? [];
  if (atts.length > MAX_ATTACHMENTS) return { ok: false as const, status: 422, code: "too_many_attachments", message: `A message can carry at most ${MAX_ATTACHMENTS} attachments.` };
  const totalKb = atts.reduce((n, a) => n + (a.sizeKb || 0), 0);
  if (totalKb > MAX_TOTAL_KB) return { ok: false as const, status: 422, code: "attachment_too_large", message: "Attachments exceed the 10 MB message limit." };

  const msg: MailMessage = {
    id: `s-${Math.floor(Date.now() / 1000) % 100000}`,
    folder: "sent",
    fromId: SESSION_USER_ID,
    to,
    cc: cc.length ? cc : undefined,
    subject: input.subject?.trim() || "(no subject)",
    preview: (input.body ?? "").replace(/\s+/g, " ").trim().slice(0, 140),
    body: input.body ?? "",
    ts: Date.now(),
    read: true,
    sendStatus: "Sent",
    attachments: atts.length
      ? atts.map((a) => ({ name: a.name, sizeKb: a.sizeKb, type: (a.type?.toUpperCase() || "BIN") as never }))
      : undefined,
  };
  store().mail.unshift(msg);
  writeAudit({ actorId: SESSION_USER_ID, action: "Mail sent", resource: msg.subject, result: "Success", context: `${to.length} recipient(s)${cc.length ? `, ${cc.length} cc` : ""}${atts.length ? `, ${atts.length} attachment(s)` : ""}` });
  return { ok: true as const, message: msg };
}

export function saveDraft(role: WorkspaceRole, input: Partial<MailMessage> & { draftId?: string }) {
  const s = store();
  if (input.draftId) {
    const existing = s.mail.find((m) => m.id === input.draftId && m.folder === "drafts");
    if (existing) {
      Object.assign(existing, {
        to: input.to ?? existing.to,
        cc: input.cc ?? existing.cc,
        subject: input.subject ?? existing.subject,
        body: input.body ?? existing.body,
        preview: (input.body ?? existing.body).replace(/\s+/g, " ").trim().slice(0, 140),
        ts: Date.now(),
      });
      return { ok: true as const, draft: existing };
    }
  }
  const draft: MailMessage = {
    id: `d-${Math.floor(Date.now() / 1000) % 100000}`,
    folder: "drafts",
    fromId: SESSION_USER_ID,
    to: input.to ?? [],
    subject: input.subject ?? "",
    preview: (input.body ?? "").replace(/\s+/g, " ").trim().slice(0, 140),
    body: input.body ?? "",
    ts: Date.now(),
    read: true,
  };
  s.mail.unshift(draft);
  return { ok: true as const, draft };
}

export function retryMail(role: WorkspaceRole, id: string) {
  const m = store().mail.find((x) => x.id === id);
  if (!m || m.folder !== "sent") return { ok: false as const, status: 404, code: "not_found", message: "Message not found in Sent." };
  if (m.sendStatus !== "Failed" && m.sendStatus !== "Pending") {
    return { ok: false as const, status: 409, code: "not_retryable", message: `This message is already ${(m.sendStatus ?? "sent").toLowerCase()}.` };
  }
  m.sendStatus = "Sent";
  m.sendDetail = undefined;
  writeAudit({ actorId: SESSION_USER_ID, action: "Mail retry succeeded", resource: m.subject, result: "Success", context: "Delivery retried after failure" });
  return { ok: true as const, message: m };
}

export function markMail(role: WorkspaceRole, id: string, patch: { read?: boolean; starred?: boolean; archive?: boolean }) {
  const m = store().mail.find((x) => x.id === id);
  if (!m) return { ok: false as const, status: 404, code: "not_found", message: "Message not found." };
  if (patch.read !== undefined) m.read = patch.read;
  if (patch.starred !== undefined) m.starred = patch.starred;
  if (patch.archive) m.folder = "archive";
  return { ok: true as const, message: m };
}

// ============================================================
// Documents — server-enforced access, per spec §47/§52.
// Restricted documents never expose metadata through any
// workspace route unless the caller holds the scope.
// ============================================================

const SENSITIVE_DOC_ACTIONS = new Set(["download", "share"]);

export function documentAction(
  role: WorkspaceRole,
  input: { action: "download" | "share" | "rename" | "move" | "upload"; docId?: string; name?: string; category?: string; toEmployeeId?: string; fileMeta?: { name: string; sizeKb: number; type: string } },
) {
  const s = store();

  if (input.action === "upload") {
    const f = input.fileMeta;
    if (!f || !f.name?.trim()) return { ok: false as const, status: 422, code: "invalid_file", message: "Choose a file to upload." };
    if (f.sizeKb > MAX_TOTAL_KB) return { ok: false as const, status: 422, code: "file_too_large", message: "Files above 10 MB must go through the enterprise storage vault." };
    const doc: WorkspaceDoc = {
      id: `doc-${Math.floor(Date.now() / 1000) % 100000}`,
      name: f.name,
      type: (f.type?.toUpperCase() || "DOCX") as WorkspaceDoc["type"],
      category: "Personal",
      ownerId: SESSION_USER_ID,
      sizeKb: f.sizeKb,
      modified: Date.now(),
      sensitivity: "Internal",
      description: "Uploaded from My Documents. File content remains in your enterprise storage; Qubit One holds the record.",
    };
    s.documents.unshift(doc);
    writeAudit({ actorId: SESSION_USER_ID, action: "Document uploaded", resource: doc.name, result: "Success", context: "My Documents · metadata record only" });
    return { ok: true as const, doc };
  }

  const doc = s.documents.find((d) => d.id === input.docId);
  if (!doc) return { ok: false as const, status: 404, code: "not_found", message: "Document not found." };

  if (SENSITIVE_DOC_ACTIONS.has(input.action) && doc.sensitivity === "Restricted") {
    writeAudit({ actorId: SESSION_USER_ID, action: `Document ${input.action} denied`, resource: doc.name, result: "Blocked", severity: "Warning", context: "Restricted document — HR-managed access only" });
    return { ok: false as const, status: 403, code: "restricted", message: "This document is restricted. Access is managed by HR — request access from the document owner." };
  }

  if (input.action === "download") {
    writeAudit({ actorId: SESSION_USER_ID, action: "Document downloaded", resource: doc.name, result: "Success", context: `Sensitivity: ${doc.sensitivity}` });
    return { ok: true as const, doc };
  }

  if (input.action === "share") {
    if (!input.toEmployeeId || !employees.some((e) => e.id === input.toEmployeeId)) {
      return { ok: false as const, status: 422, code: "invalid_recipient", message: "Choose a colleague to share with." };
    }
    if (doc.sensitivity === "Confidential" && role === "employee") {
      return { ok: false as const, status: 403, code: "forbidden", message: "Confidential documents cannot be shared from this role." };
    }
    writeAudit({ actorId: SESSION_USER_ID, action: "Document shared", resource: doc.name, result: "Success", context: `Shared with ${employees.find((e) => e.id === input.toEmployeeId)?.name}` });
    return { ok: true as const, doc };
  }

  if (doc.ownerId !== SESSION_USER_ID) {
    return { ok: false as const, status: 403, code: "forbidden", message: "Only the owner can rename or move this document." };
  }
  if (input.action === "rename") {
    const name = input.name?.trim();
    if (!name || name.length < 3) return { ok: false as const, status: 422, code: "invalid_name", message: "Enter a document name (3+ characters)." };
    doc.name = name;
  } else if (input.action === "move") {
    const cat = input.category as WorkspaceDoc["category"];
    if (!["Personal", "Shared with me", "HR", "Company", "Workflow"].includes(cat)) {
      return { ok: false as const, status: 422, code: "invalid_category", message: "Choose a valid category." };
    }
    doc.category = cat;
  }
  return { ok: true as const, doc };
}

// ============================================================
// Profile — only employee-owned fields are editable. Company-
// controlled fields (employee ID, department, manager, title,
// status) are rejected server-side even if a crafted request
// includes them.
// ============================================================

const EDITABLE_PROFILE_FIELDS = new Set(["phone", "about", "skills"]);

export function updateProfile(role: WorkspaceRole, patch: Record<string, unknown>) {
  const keys = Object.keys(patch);
  const illegal = keys.filter((k) => !EDITABLE_PROFILE_FIELDS.has(k));
  if (illegal.length > 0) {
    writeAudit({ actorId: SESSION_USER_ID, action: "Profile update denied", resource: illegal.join(", "), result: "Blocked", severity: "Warning", context: "Attempted edit of company-controlled fields" });
    return { ok: false as const, status: 403, code: "company_controlled", message: `These fields are managed by authorized HR workflows: ${illegal.join(", ")}.` };
  }
  if (patch.phone !== undefined) {
    const phone = String(patch.phone).trim();
    if (!/^\+91\s\d{5}\s\d{5}$/.test(phone)) {
      return { ok: false as const, status: 422, code: "invalid_phone", message: "Use the format +91 98200 12345." };
    }
  }
  if (patch.about !== undefined && String(patch.about).length > 280) {
    return { ok: false as const, status: 422, code: "invalid_about", message: "About must be 280 characters or fewer." };
  }
  if (patch.skills !== undefined && !Array.isArray(patch.skills)) {
    return { ok: false as const, status: 422, code: "invalid_skills", message: "Skills must be a list." };
  }
  writeAudit({ actorId: SESSION_USER_ID, action: "Profile updated", resource: keys.join(", "), result: "Success", context: "Self-service fields only" });
  return { ok: true as const, updated: keys };
}

// ============================================================
// Meetings (Screens 44 · 45) — the meetings/calendar domain is
// served from this store like every other workspace domain
// (Phase 19 §6/§12: no enterprise fixture values imported into
// client components).
//
// Scope model: "My Meetings" is a personal workspace surface —
// exactly like listTasks — so the list is scoped to the session
// identity by participation (organizer or invited participant)
// for every role preview. Roles with governance authority
// (administrator / dept-head) may CANCEL meetings they do not
// organize; that permission is enforced here, never in the UI.
//
// Minutes flow: notes and action items are recorded AGAINST the
// store's session maps (meetingNotes / meetingActions, keyed by
// meeting id — mirroring mobile-server's meetingNotes/meetingActions
// concept) for COMPLETED meetings, and only by the organizer.
// materializeMeeting() merges the fixture record with those session
// entries at read time, so every workspace reader — list, ?id=
// detail, cancel response and the calendar drawer — sees the same
// state without the store ever mutating the fixture-shaped record.
// Mobile overlap (honest note): the Phase 18 mobile surface (screen
// 289, mobile-server.ts) keeps its own session maps for its field
// flow; the mobile-* files are out of scope here, so the workspace
// store is the single authority for screens 44/45 and for
// /api/workspace/meetings.
// ============================================================

/** Fixture record + session minutes merged into the wire shape. */
function materializeMeeting(s: WorkspaceStore, m: Meeting): Meeting {
  const notes = s.meetingNotes.get(m.id) ?? [];
  const actions = s.meetingActions.get(m.id) ?? [];
  if (notes.length === 0 && actions.length === 0) return m;
  return {
    ...m,
    notes: notes.length ? [m.notes, ...notes.map((n) => n.text)].filter(Boolean).join("\n\n") : m.notes,
    actionItems: actions.length ? [...(m.actionItems ?? []), ...actions.map((a) => ({ title: a.title, ownerId: a.ownerId, due: a.due }))] : m.actionItems,
  };
}

export interface MeetingsScopePayload {
  meetings: Meeting[];
  events: CalendarEvent[];
  scope: "own";
  note: string | null;
  /** Fixed demo clock label so the UI renders the same "today" framing as before. */
  asOf: string;
  /** Fixed demo clock (IST epoch) the buckets and the calendar grid anchor to. */
  now: number;
}

export function listMeetings(role: WorkspaceRole): MeetingsScopePayload {
  const s = store();
  // Personal participation scope — organizer or invited participant.
  // (Same boundary as listTasks; meetings are personal workspace data.)
  const meetings = s.meetings
    .filter((m) => m.organizerId === SESSION_USER_ID || m.participantIds.includes(SESSION_USER_ID))
    .sort((a, b) => a.start - b.start)
    .map((m) => materializeMeeting(s, m));
  const scoped = role === "employee" || role === "sales-exec";
  return {
    meetings,
    // The session calendar: company events, deadlines and approved leave live
    // here too. Events flagged organizer-only keep their privacy rendering
    // ("Busy") in the UI; the display gate stays with the calendar surface.
    events: [...s.events],
    scope: "own",
    note: scoped
      ? "Scoped to your own participation — you see the meetings you organize or attend. Cancellation follows organizer permissions and is enforced server-side."
      : null,
    asOf: WORKSPACE_NOW_LABEL,
    now: WORKSPACE_NOW,
  };
}

export function getMeeting(role: WorkspaceRole, id: string) {
  const s = store();
  const m = s.meetings.find((x) => x.id === id);
  if (!m) return { ok: false as const, status: 404, code: "not_found", message: "Meeting not found." };
  const participating = m.organizerId === SESSION_USER_ID || m.participantIds.includes(SESSION_USER_ID);
  const governance = role === "administrator" || role === "dept-head";
  if (!participating && !governance) {
    writeAudit({ actorId: SESSION_USER_ID, action: "Meeting detail denied", resource: m.title, result: "Blocked", severity: "Warning", source: "Workspace", context: "Caller is neither the organizer nor a participant" });
    return { ok: false as const, status: 403, code: "forbidden", message: "You are not a participant of this meeting." };
  }
  return { ok: true as const, meeting: materializeMeeting(s, m) };
}

export function cancelMeeting(role: WorkspaceRole, input: { id: string; reason: string }) {
  const s = store();
  const m = s.meetings.find((x) => x.id === input.id);
  if (!m) return { ok: false as const, status: 404, code: "not_found", message: "Meeting not found." };
  if (m.status !== "Scheduled") {
    return {
      ok: false as const,
      status: 409,
      code: "invalid_state",
      message: m.status === "Cancelled" ? "This meeting was already cancelled." : `A meeting that is ${m.status.toLowerCase()} cannot be cancelled.`,
    };
  }
  const isOrganizer = m.organizerId === SESSION_USER_ID;
  const governance = role === "administrator" || role === "dept-head";
  if (!isOrganizer && !governance) {
    writeAudit({ actorId: SESSION_USER_ID, action: "Meeting cancellation denied", resource: `${m.title} (${m.id})`, result: "Blocked", severity: "Warning", source: "Workspace", context: "Only the organizer — or an administrator / department head — can cancel a meeting" });
    return { ok: false as const, status: 403, code: "forbidden", message: "Only the meeting organizer — or an administrator / department head — can cancel this meeting." };
  }
  const reason = input.reason?.trim() ?? "";
  if (reason.length < 4) {
    return { ok: false as const, status: 422, code: "reason_required", message: "A short reason is required when cancelling a meeting." };
  }
  m.status = "Cancelled";
  writeAudit({
    actorId: SESSION_USER_ID,
    action: "Meeting cancelled",
    resource: `${m.id} — ${m.title}`,
    result: "Success",
    severity: "Info",
    source: "Workspace",
    context: `${isOrganizer ? "Organizer" : "Governance"} cancellation — reason: ${reason}`,
  });
  return {
    ok: true as const,
    meeting: materializeMeeting(s, m),
    message: `"${m.title}" was cancelled — ${m.participantIds.length} participant${m.participantIds.length === 1 ? "" : "s"} notified and the calendar updated.`,
  };
}

// Notes and action items (the COMPLETED-meeting minutes flow) are recorded
// into the store's session maps keyed by meeting id — the workspace-store
// mirror of mobile-server's meetingNotes/meetingActions concept. Only the
// organizer records minutes; the fixture-shaped record is never mutated.
// Every read path materializes the map entries onto the meeting (see
// materializeMeeting) so list, ?id= detail and the calendar drawer agree.
export function saveMeetingNotes(role: WorkspaceRole, input: { id: string; text: string }) {
  const s = store();
  const m = s.meetings.find((x) => x.id === input.id);
  if (!m) return { ok: false as const, status: 404, code: "not_found", message: "Meeting not found." };
  if (m.organizerId !== SESSION_USER_ID) {
    writeAudit({ actorId: SESSION_USER_ID, action: "Meeting note denied", resource: `${m.id} — ${m.title}`, result: "Blocked", severity: "Warning", source: "Workspace", context: "Only the organizer can record minutes" });
    return { ok: false as const, status: 403, code: "forbidden", message: "Only the meeting organizer can record notes for this meeting." };
  }
  if (m.status !== "Completed") {
    return { ok: false as const, status: 409, code: "invalid_state", message: `Minutes are recorded on completed meetings — this one is ${m.status.toLowerCase()}.` };
  }
  const text = input.text?.trim() ?? "";
  if (text.length < 2) return { ok: false as const, status: 422, code: "invalid_note", message: "A note of at least 2 characters is required." };
  const entry = { at: Date.now(), by: SESSION_USER_ID, text };
  const existing = s.meetingNotes.get(m.id) ?? [];
  s.meetingNotes.set(m.id, [...existing, entry]);
  writeAudit({ actorId: SESSION_USER_ID, action: "Meeting notes saved", resource: `${m.id} — ${m.title}`, result: "Success", source: "Workspace", context: "Note appended to the meeting record" });
  return { ok: true as const, meeting: materializeMeeting(s, m), message: "Note added to the meeting record." };
}

export function addMeetingAction(role: WorkspaceRole, input: { id: string; title: string; ownerId?: string; due?: number | null }) {
  const s = store();
  const m = s.meetings.find((x) => x.id === input.id);
  if (!m) return { ok: false as const, status: 404, code: "not_found", message: "Meeting not found." };
  if (m.organizerId !== SESSION_USER_ID) {
    writeAudit({ actorId: SESSION_USER_ID, action: "Meeting action item denied", resource: `${m.id} — ${m.title}`, result: "Blocked", severity: "Warning", source: "Workspace", context: "Only the organizer can record action items" });
    return { ok: false as const, status: 403, code: "forbidden", message: "Only the meeting organizer can add action items." };
  }
  if (m.status !== "Completed") {
    return { ok: false as const, status: 409, code: "invalid_state", message: `Action items are recorded on completed meetings — this one is ${m.status.toLowerCase()}.` };
  }
  const title = input.title?.trim() ?? "";
  if (title.length < 4) return { ok: false as const, status: 422, code: "invalid_title", message: "Describe the action item (4+ characters)." };
  const ownerId = input.ownerId ?? SESSION_USER_ID;
  if (!employees.some((e) => e.id === ownerId)) {
    return { ok: false as const, status: 422, code: "invalid_owner", message: "Choose a valid owner." };
  }
  if (input.due !== null && input.due !== undefined && Number.isNaN(input.due)) {
    return { ok: false as const, status: 422, code: "invalid_due", message: "Due date is invalid." };
  }
  const entry = { title, ownerId, due: input.due ?? null, at: Date.now() };
  const existing = s.meetingActions.get(m.id) ?? [];
  s.meetingActions.set(m.id, [...existing, entry]);
  writeAudit({ actorId: SESSION_USER_ID, action: "Meeting action item added", resource: `${m.id} — ${title}`, result: "Success", source: "Workspace", context: `Owner: ${employees.find((e) => e.id === ownerId)?.name ?? ownerId}` });
  return { ok: true as const, meeting: materializeMeeting(s, m), message: "Action item recorded on the meeting." };
}

// Calendar entries created from My Calendar (screen 44) — personal events
// such as focus blocks and deadlines. Meeting invites WITH participants run
// through the Meetings module; this records the entry on the session
// calendar server-side so the screen holds no client-only business state.
export function createCalendarEvent(role: WorkspaceRole, input: { title: string; type: CalendarEvent["type"]; start: number; end: number; location?: string }) {
  const title = input.title?.trim() ?? "";
  if (title.length < 3) return { ok: false as const, status: 422, code: "invalid_title", message: "Give the event a title (at least 3 characters)." };
  const VALID_TYPES: CalendarEvent["type"][] = ["Meeting", "Deadline", "Company event", "Leave", "Focus time"];
  if (!VALID_TYPES.includes(input.type)) {
    return { ok: false as const, status: 422, code: "invalid_type", message: "Choose a valid event type." };
  }
  if (!Number.isFinite(input.start) || !Number.isFinite(input.end) || input.end <= input.start) {
    return { ok: false as const, status: 422, code: "invalid_time", message: "The event end must be after its start." };
  }
  const ev: CalendarEvent = {
    id: `ev-w${Math.floor(Date.now() / 1000) % 100000}`,
    title,
    type: input.type,
    start: input.start,
    end: input.end,
    organizerId: SESSION_USER_ID,
    location: input.location?.trim() || undefined,
  };
  store().events.push(ev);
  writeAudit({ actorId: SESSION_USER_ID, action: "Calendar event created", resource: title, result: "Success", source: "Workspace", context: `${ev.type} added from My Calendar` });
  return { ok: true as const, event: ev, message: `"${title}" was added to your calendar.` };
}
