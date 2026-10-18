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
  TASKS,
  type ApprovalRequest,
  type MailMessage,
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
}

let _store: WorkspaceStore | null = null;

function store(): WorkspaceStore {
  if (!_store) {
    _store = {
      approvals: APPROVALS.map((a) => structuredClone(a)),
      tasks: TASKS.map((t) => structuredClone(t)),
      mail: ALL_MAIL.map((m) => structuredClone(m)),
      documents: DOCUMENTS.map((d) => structuredClone(d)),
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
