import { NextRequest, NextResponse } from "next/server";
import {
  alertAction,
  decideExecutiveApproval,
  insightFollowUp,
  listAlerts,
  listApprovals,
  listReports,
  reportAction,
  requireExecutive,
} from "@/lib/qubit/executive-server";
import type { WorkspaceRole } from "@/lib/qubit/workspace-server";
import {
  AI_INSIGHTS,
  DOMAIN_SUMMARIES,
  EXEC_PERIOD,
  FIELD,
  FINANCE,
  INVENTORY,
  KPIS,
  MARKETING,
  PEOPLE,
  REVENUE,
  SALES,
  SERVICE,
  sectionFor,
  type ExecutiveOverviewPayload,
} from "@/lib/qubit/executive-data";

const roleFrom = (req: NextRequest): WorkspaceRole =>
  (req.headers.get("X-Qubit-Role") as WorkspaceRole) ?? "administrator";

const denied = () =>
  NextResponse.json(
    { code: "executive_access_required", message: "The CEO Command Center requires executive access. You are previewing a non-executive role boundary." },
    { status: 403 },
  );

// GET /api/executive?section=… — one aggregation endpoint over the
// canonical business blocks. Sections let each screen load only what
// it needs (spec §17); the overview returns its curated cut.
export async function GET(req: NextRequest) {
  const role = roleFrom(req);
  const gate = requireExecutive(role);
  if (!gate.ok) return denied();

  const section = sectionFor(req.nextUrl.searchParams.get("section"));
  const base = { asOf: Date.now(), asOfLabel: EXEC_PERIOD.asOfLabel, period: EXEC_PERIOD };

  switch (section) {
    case "overview": {
      const alerts = listAlerts(role);
      const approvals = listApprovals(role);
      if (!alerts.ok || !approvals.ok) return denied();
      const payload: ExecutiveOverviewPayload = {
        period: EXEC_PERIOD,
        domains: DOMAIN_SUMMARIES,
        kpis: KPIS.slice(0, 6),
        alerts: alerts.alerts.filter((a) => a.state !== "Dismissed").slice(0, 4),
        approvals: approvals.approvals.filter((a) => a.state === "Pending").slice(0, 4),
        insights: AI_INSIGHTS.slice(0, 3),
      };
      return NextResponse.json({ ...base, ...payload });
    }
    case "revenue":
      return NextResponse.json({ ...base, revenue: REVENUE });
    case "sales":
      return NextResponse.json({ ...base, sales: SALES });
    case "finance":
      return NextResponse.json({ ...base, finance: FINANCE });
    case "people":
      return NextResponse.json({ ...base, people: PEOPLE });
    case "marketing":
      return NextResponse.json({ ...base, marketing: MARKETING });
    case "service":
      return NextResponse.json({ ...base, service: SERVICE });
    case "inventory":
      return NextResponse.json({ ...base, inventory: INVENTORY });
    case "field":
      return NextResponse.json({ ...base, field: FIELD });
    case "alerts": {
      const r = listAlerts(role);
      return r.ok ? NextResponse.json({ ...base, alerts: r.alerts }) : denied();
    }
    case "approvals": {
      const r = listApprovals(role);
      return r.ok ? NextResponse.json({ ...base, approvals: r.approvals }) : denied();
    }
    case "insights":
      return NextResponse.json({ ...base, insights: AI_INSIGHTS });
    case "kpis":
      return NextResponse.json({ ...base, kpis: KPIS });
    case "reports": {
      const r = listReports(role);
      return r.ok ? NextResponse.json({ ...base, reports: r.reports }) : denied();
    }
    default: {
      const alerts = listAlerts(role);
      const approvals = listApprovals(role);
      const reports = listReports(role);
      return NextResponse.json({
        ...base,
        domains: DOMAIN_SUMMARIES,
        kpis: KPIS,
        revenue: REVENUE,
        sales: SALES,
        finance: FINANCE,
        people: PEOPLE,
        marketing: MARKETING,
        service: SERVICE,
        inventory: INVENTORY,
        field: FIELD,
        alerts: alerts.ok ? alerts.alerts : [],
        approvals: approvals.ok ? approvals.approvals : [],
        insights: AI_INSIGHTS,
        reports: reports.ok ? reports.reports : [],
      });
    }
  }
}

// POST /api/executive — all consequential executive actions.
// Authorization, step-up and note rules are enforced server-side
// by executive-server; every accepted action is audited.
export async function POST(req: NextRequest) {
  let body: {
    action?: string;
    id?: string;
    decision?: string;
    note?: string;
    stepUpPassword?: string;
    assigneeId?: string;
    reason?: string;
    followUpId?: string;
    schedule?: string;
    format?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", message: "Invalid request." }, { status: 400 });
  }

  const role = roleFrom(req);

  switch (body.action) {
    case "alert.acknowledge":
    case "alert.assign":
    case "alert.dismiss":
    case "alert.reopen": {
      if (!body.id) return NextResponse.json({ code: "bad_request", message: "Provide the alert id." }, { status: 400 });
      const action = body.action.split(".")[1] as "acknowledge" | "assign" | "dismiss" | "reopen";
      const result = alertAction(role, { id: body.id, action, assigneeId: body.assigneeId, reason: body.reason });
      return result.ok
        ? NextResponse.json({ ok: true, alert: result.alert })
        : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    case "approval.decide": {
      if (!body.id || !body.decision || !["Approved", "Rejected", "Changes requested"].includes(body.decision)) {
        return NextResponse.json({ code: "bad_request", message: "Provide a request id and a valid decision." }, { status: 400 });
      }
      const result = decideExecutiveApproval(role, {
        id: body.id,
        decision: body.decision as "Approved" | "Rejected" | "Changes requested",
        note: body.note,
        stepUpPassword: body.stepUpPassword,
      });
      return result.ok
        ? NextResponse.json({ ok: true, approval: result.approval })
        : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    case "insight.followup": {
      if (!body.id || !body.followUpId) {
        return NextResponse.json({ code: "bad_request", message: "Provide the insight id and follow-up id." }, { status: 400 });
      }
      const result = insightFollowUp(role, { id: body.id, followUpId: body.followUpId });
      return result.ok
        ? NextResponse.json({ ok: true, followUp: result.followUp })
        : NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
    }
    case "report.generate":
    case "report.export":
    case "report.schedule": {
      if (!body.id) return NextResponse.json({ code: "bad_request", message: "Provide the report id." }, { status: 400 });
      const action = body.action.split(".")[1] as "generate" | "export" | "schedule";
      const result = reportAction(role, { id: body.id, action, schedule: body.schedule, format: body.format });
      if (!result.ok) {
        return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
      }
      return NextResponse.json({
        ok: true,
        report: result.report,
        format: "format" in result ? (result as { format?: string }).format : undefined,
      });
    }
    default:
      return NextResponse.json({ code: "unknown_action", message: "Unsupported executive action." }, { status: 400 });
  }
}
