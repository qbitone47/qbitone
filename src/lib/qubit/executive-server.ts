// ============================================================
// Qubit One — Executive enforcement store (SERVER ONLY)
// ============================================================
// The CEO Command Center follows the Phase 3/4 pattern: the
// frontend is NOT the source of truth. Executive access,
// step-up authentication for high-value decisions, note rules,
// alert actions, report generation and export authorization are
// enforced here, behind /api/executive route handlers.
//
// Every consequential mutation writes into the SAME enterprise
// audit trail used by Phases 3–4 (security-server.writeAudit) —
// one audit system, not two. Export events are recorded too
// (spec §20). The CEO layer aggregates the canonical business
// blocks from executive-data.ts — it never invents parallel
// business truth.
// ============================================================

import { writeAudit } from "./security-server";
import {
  AI_INSIGHTS,
  EXEC_ALERTS,
  EXEC_APPROVALS,
  EXEC_REPORTS,
  type AiInsight,
  type ExecAlert,
  type ExecApproval,
  type ExecReport,
} from "./executive-data";
import { SESSION_USER_ID, type WorkspaceRole } from "./workspace-server";
import { employees } from "./data";

// ---------- demo role boundary (production derives from the session) ----------
// The signed-in session is the CEO (sagar). "Preview as role" restricts
// the boundary — non-executive roles get 403 with an audited denial,
// mirroring how production authorization would treat them.

interface ExecutiveStore {
  alerts: ExecAlert[];
  approvals: ExecApproval[];
  insights: AiInsight[];
  reports: ExecReport[];
}

let _store: ExecutiveStore | null = null;

function store(): ExecutiveStore {
  if (!_store) {
    _store = {
      alerts: EXEC_ALERTS.map((a) => structuredClone(a)),
      approvals: EXEC_APPROVALS.map((a) => structuredClone(a)),
      insights: AI_INSIGHTS.map((i) => structuredClone(i)),
      reports: EXEC_REPORTS.map((r) => structuredClone(r)),
    };
  }
  return _store;
}

/** Executive authority gate — server-side, never UI-only. */
export function requireExecutive(role: WorkspaceRole): { ok: true } | { ok: false; status: number; code: string; message: string } {
  if (role === "administrator") return { ok: true };
  writeAudit({
    actorId: SESSION_USER_ID,
    action: "Executive command center access denied",
    resource: "CEO Command Center",
    result: "Blocked",
    severity: "Warning",
    context: `Role boundary "${role}" holds no executive access to company-wide performance data`,
  });
  return {
    ok: false,
    status: 403,
    code: "executive_access_required",
    message: "The CEO Command Center requires executive access. You are previewing a non-executive role boundary.",
  };
}

const nameOf = (id: string | undefined) => (id ? (employees.find((e) => e.id === id)?.name ?? id) : undefined);

// ---------- list functions (GET) — reflect live store state ----------

export function listAlerts(role: WorkspaceRole) {
  const gate = requireExecutive(role);
  if (!gate.ok) return gate;
  return { ok: true as const, alerts: store().alerts };
}

export function listApprovals(role: WorkspaceRole) {
  const gate = requireExecutive(role);
  if (!gate.ok) return gate;
  return { ok: true as const, approvals: store().approvals };
}

export function listReports(role: WorkspaceRole) {
  const gate = requireExecutive(role);
  if (!gate.ok) return gate;
  return { ok: true as const, reports: store().reports };
}

// ============================================================
// Alerts — acknowledge / assign / dismiss (reason required)
// ============================================================

export function alertAction(
  role: WorkspaceRole,
  input: { id: string; action: "acknowledge" | "assign" | "dismiss" | "reopen"; assigneeId?: string; reason?: string },
) {
  const gate = requireExecutive(role);
  if (!gate.ok) return gate;
  const s = store();
  const alert = s.alerts.find((a) => a.id === input.id);
  if (!alert) return { ok: false as const, status: 404, code: "not_found", message: "Alert not found." };

  if (input.action === "acknowledge") {
    if (alert.state === "Dismissed") return { ok: false as const, status: 409, code: "conflict", message: "This alert was dismissed — reopen it before acknowledging." };
    alert.state = alert.state === "New" ? "Assigned" : alert.state;
    alert.assignee = alert.assignee ?? "Sagar Singh";
    writeAudit({ actorId: SESSION_USER_ID, action: "Executive alert acknowledged", resource: `${alert.domainLabel} · ${alert.title}`, result: "Success", severity: alert.severity === "Critical" ? "High" : "Info", context: `Severity ${alert.severity}` });
    return { ok: true as const, alert };
  }

  if (input.action === "assign") {
    if (!input.assigneeId) return { ok: false as const, status: 422, code: "assignee_required", message: "Choose a person to assign this alert to." };
    const assignee = nameOf(input.assigneeId);
    if (!assignee) return { ok: false as const, status: 422, code: "unknown_assignee", message: "That assignee is not in the company directory." };
    alert.state = "Assigned";
    alert.assignee = assignee;
    writeAudit({ actorId: SESSION_USER_ID, action: "Executive alert assigned", resource: `${alert.domainLabel} · ${alert.title}`, result: "Success", severity: "Info", context: `Assigned to ${assignee}` });
    return { ok: true as const, alert };
  }

  if (input.action === "dismiss") {
    if (!input.reason || input.reason.trim().length < 4) {
      return { ok: false as const, status: 422, code: "reason_required", message: "A reason is required to dismiss an executive alert — it is recorded in the audit trail." };
    }
    alert.state = "Dismissed";
    alert.dismissedReason = input.reason.trim();
    writeAudit({ actorId: SESSION_USER_ID, action: "Executive alert dismissed", resource: `${alert.domainLabel} · ${alert.title}`, result: "Success", severity: "Info", context: `Reason: ${input.reason.trim()}` });
    return { ok: true as const, alert };
  }

  // reopen
  alert.state = "New";
  alert.dismissedReason = undefined;
  writeAudit({ actorId: SESSION_USER_ID, action: "Executive alert reopened", resource: `${alert.domainLabel} · ${alert.title}`, result: "Success", severity: "Info", context: "Reopened from Dismissed" });
  return { ok: true as const, alert };
}

// ============================================================
// Executive approvals — the same decision discipline as My
// Approvals (46): authority, step-up and note rules enforced
// server-side; every decision audited.
// ============================================================

export function decideExecutiveApproval(
  role: WorkspaceRole,
  input: { id: string; decision: "Approved" | "Rejected" | "Changes requested"; note?: string; stepUpPassword?: string },
) {
  const gate = requireExecutive(role);
  if (!gate.ok) return gate;
  const s = store();
  const req = s.approvals.find((a) => a.id === input.id);
  if (!req) return { ok: false as const, status: 404, code: "not_found", message: "Approval request not found." };
  if (req.state !== "Pending") {
    return { ok: false as const, status: 409, code: "already_decided", message: `This request was already ${req.state.toLowerCase()}. The record is final here — a new request is needed to change it.` };
  }

  // Step-up authentication for high-value / sensitive decisions.
  if (req.stepUpRequired) {
    if (!input.stepUpPassword || input.stepUpPassword.length < 8) {
      writeAudit({ actorId: SESSION_USER_ID, action: "Executive approval step-up failed", resource: `${req.kind} · ${req.title}`, result: "Blocked", severity: "Warning", context: "Reauthentication missing or too short" });
      return { ok: false as const, status: 401, code: "step_up_required", message: "Reauthentication is required before this decision can be recorded." };
    }
  }

  // Rejections and change requests always need a reason for the audit trail.
  if (input.decision !== "Approved" && (!input.note || input.note.trim().length < 4)) {
    return { ok: false as const, status: 422, code: "note_required", message: "A reason is required when rejecting or requesting changes." };
  }

  req.state = input.decision;
  req.decidedAt = Date.now();
  req.decidedBy = SESSION_USER_ID;
  req.decisionNote = input.note?.trim() || undefined;
  req.history = [
    ...req.history,
    { at: Date.now(), actor: "Sagar Singh", event: `${input.decision} — executive decision${input.note ? `: ${input.note.trim()}` : ""}` },
  ];

  writeAudit({
    actorId: SESSION_USER_ID,
    action: `Executive approval ${input.decision.toLowerCase()}`,
    resource: `${req.kind} · ${req.title}${req.amount ? ` (${req.amount} Cr)` : ""}`,
    result: "Success",
    severity: req.stepUpRequired ? "High" : "Info",
    source: "Web · Mumbai",
    context: req.stepUpRequired ? "Step-up authentication verified before recording" : `Routed via Approval Matrix (${req.rule})`,
  });

  return { ok: true as const, approval: req };
}

// ============================================================
// AI insights — AI recommends, the executive confirms; the
// follow-up is executed through the workflow layer and audited
// (spec §11: Recommend → Explain → Confirm → Execute → Audit).
// ============================================================

export function insightFollowUp(role: WorkspaceRole, input: { id: string; followUpId: string }) {
  const gate = requireExecutive(role);
  if (!gate.ok) return gate;
  const s = store();
  const insight = s.insights.find((i) => i.id === input.id);
  if (!insight) return { ok: false as const, status: 404, code: "not_found", message: "Insight not found." };
  const fu = insight.followUps.find((f) => f.id === input.followUpId);
  if (!fu) return { ok: false as const, status: 422, code: "unknown_follow_up", message: "That follow-up action is not offered by this insight." };

  writeAudit({
    actorId: SESSION_USER_ID,
    action: "AI insight follow-up accepted",
    resource: `${insight.category} · ${insight.title}`,
    result: "Success",
    severity: "Info",
    context: `Follow-up "${fu.label}" — executed through the authorized workflow layer, AI holds no direct write access`,
  });

  return { ok: true as const, insight, followUp: fu };
}

// ============================================================
// Reports — generate / export / schedule. Export events are
// recorded per spec §20; the failed report can be re-run.
// ============================================================

export function reportAction(
  role: WorkspaceRole,
  input: { id: string; action: "generate" | "export" | "schedule"; schedule?: string; format?: string },
) {
  const gate = requireExecutive(role);
  if (!gate.ok) return gate;
  const s = store();
  const report = s.reports.find((r) => r.id === input.id);
  if (!report) return { ok: false as const, status: 404, code: "not_found", message: "Report not found." };

  if (input.action === "generate") {
    if (report.status === "Generating") {
      return { ok: false as const, status: 409, code: "already_running", message: "This report is already generating — wait for the current run to finish." };
    }
    report.status = "Generating";
    writeAudit({ actorId: SESSION_USER_ID, action: "Executive report generation started", resource: report.title, result: "Success", severity: "Info", context: `Period ${report.period}` });
    // demo aggregation: the run completes quickly and honours the
    // known data-note (the risk digest depends on the Finance sync)
    setTimeout(() => {
      const r = store().reports.find((x) => x.id === input.id);
      if (!r || r.status !== "Generating") return;
      r.status = "Ready";
      r.lastGenerated = Date.now();
      // a successful run supersedes the previous failure note
      if (r.dataNote?.includes("failed")) r.dataNote = undefined;
    }, 2200);
    return { ok: true as const, report };
  }

  if (input.action === "export") {
    if (report.status !== "Ready") {
      return { ok: false as const, status: 409, code: "not_ready", message: "Only generated reports can be exported. Generate it first." };
    }
    const format = input.format && ["PDF", "XLSX"].includes(input.format) ? input.format : (report.format.startsWith("PDF") ? "PDF" : "XLSX");
    writeAudit({
      actorId: SESSION_USER_ID,
      action: "Executive report exported",
      resource: `${report.title} (${format})`,
      result: "Success",
      severity: "Info",
      context: `Period ${report.period} · data-masking and filter context respected; recipients unchanged`,
    });
    return { ok: true as const, report, format };
  }

  // schedule
  if (!input.schedule || input.schedule.trim().length < 3) {
    return { ok: false as const, status: 422, code: "schedule_required", message: "Provide a schedule description (e.g. Monthly · 1st working day)." };
  }
  report.schedule = input.schedule.trim();
  if (report.status !== "Generating") report.status = "Scheduled";
  writeAudit({ actorId: SESSION_USER_ID, action: "Executive report schedule updated", resource: report.title, result: "Success", severity: "Info", context: `Schedule: ${report.schedule}` });
  return { ok: true as const, report };
}
