// ============================================================
// Qubit One — Analytics enforcement store (SERVER ONLY)
// ============================================================
// Phase 17: the centralized Analytics / Reporting / Audit
// intelligence layer. The frontend is NOT the source of truth.
//
// Architecture contracts (spec):
//  · ONE analytics architecture — domain screens are views over
//    authoritative existing systems, never a second engine.
//  · Sources of truth are read through their own enforcement:
//    Sales via salesGet (scope reapplied), Executive via the
//    canonical blocks behind requireExecutive, Tasks via the ONE
//    workspace task store, Audit via queryAudit (THE audit trail).
//  · Permission-aware everywhere: role permissions, department
//    scope, row scoping, sensitive-field policies and export
//    permissions are enforced HERE — never frontend-only.
//  · Metric governance: figures come from the governed metric
//    catalog; Booked / Recognized / Collected are never silently
//    mixed.
//  · Honest freshness: partial/delayed/stale states are surfaced,
//    no fabricated real-time data, "Data unavailable" over fake
//    numbers.
//  · Every consequential action (report create/edit/delete/share,
//    export, schedule, settings change, AI explanation) is written
//    to the SAME enterprise audit trail via writeAudit.
// ============================================================

import {
  writeAudit,
  queryAudit,
  auditCsv,
  type AuditQuery,
} from "./security-server";
import { SESSION_USER_ID, type WorkspaceRole } from "./workspace-server";
import { requireSalesAccess, salesGet } from "./sales-server";
import { requireExecutive } from "./executive-server";
import { employees, employeeName } from "./data";
import { TASKS, TEAM_TASKS, MEETINGS, WORKSPACE_NOW, type Task } from "./workspace-data";
import { runCompletion } from "./ai-engine";
import {
  REVENUE,
  SALES as EXEC_SALES,
  FINANCE,
  PEOPLE,
  MARKETING,
  SERVICE,
  INVENTORY,
  FIELD,
  KPIS,
  DOMAIN_FRESHNESS,
  EXEC_PERIOD,
  type Freshness,
} from "./executive-data";
import {
  ANALYTICS_PERIOD,
  DATASETS,
  datasetById,
  FUNNELS,
  funnelById,
  METRIC_CATALOG,
  metricById,
  SEED_REPORTS,
  SEED_SCHEDULES,
  SEED_EXPORTS,
  DEFAULT_ANALYTICS_SETTINGS,
  WORKSPACE_FRESHNESS,
  AUDIT_FRESHNESS,
  type SavedReport,
  type SavedReportConfig,
  type ReportSchedule,
  type ExportJob,
  type ExportFormat,
  type AnalyticsSettings,
  type ReportVisibility,
} from "./analytics-data";

// ---------- demo role boundary (production derives from the session) ----------

export type AnalyticsScope = "company" | "department" | "own";

/**
 * Role-aware analytics access (spec §28): every role reaches the
 * analytics it is authorized for — the SCOPE differs, and the
 * server — not the UI — decides what each payload contains.
 */
export function requireAnalyticsAccess(
  role: WorkspaceRole,
  screen: string,
): { ok: true; scope: AnalyticsScope } | { ok: false; status: number; code: string; message: string } {
  if (role === "administrator") return { ok: true, scope: "company" };
  if (role === "dept-head") return { ok: true, scope: "department" };
  if (role === "sales-exec") return { ok: true, scope: "department" };
  if (role === "hr-manager") return { ok: true, scope: "department" };
  if (role === "employee") return { ok: true, scope: "own" };
  writeAudit({
    actorId: SESSION_USER_ID,
    action: "Analytics access denied",
    resource: screen,
    result: "Blocked",
    severity: "Warning",
    context: `Role boundary "${role}" holds no analytics authorization`,
  });
  return {
    ok: false,
    status: 403,
    code: "analytics_access_required",
    message: "The Analytics module requires an authorized role. You are previewing a boundary without analytics authorization, and the server enforces this restriction.",
  };
}

const nameOf = (id: string | undefined) => (id ? (employees.find((e) => e.id === id)?.name ?? id) : "Unassigned");
const deptOf = (id: string | undefined) => (id ? (employees.find((e) => e.id === id)?.department ?? "—") : "—");

// ---------- mutable demo store ----------

interface RecentView {
  userId: string;
  reportId: string;
  at: number;
}

interface AnalyticsStore {
  reports: SavedReport[];
  schedules: ReportSchedule[];
  exports: ExportJob[];
  settings: AnalyticsSettings;
  favorites: Record<string, string[]>;
  recent: RecentView[];
}

const g = globalThis as unknown as { __qubitAnalyticsStore?: AnalyticsStore };

function store(): AnalyticsStore {
  if (!g.__qubitAnalyticsStore) {
    g.__qubitAnalyticsStore = {
      reports: SEED_REPORTS.map((r) => structuredClone(r)),
      schedules: SEED_SCHEDULES.map((s) => structuredClone(s)),
      exports: SEED_EXPORTS.map((e) => structuredClone(e)),
      settings: structuredClone(DEFAULT_ANALYTICS_SETTINGS),
      favorites: { sagar: ["rpt-sales-stage", "rpt-task-completion"] },
      recent: [
        { userId: "sagar", reportId: "rpt-sales-stage", at: WORKSPACE_NOW - 42 * 60_000 },
        { userId: "sagar", reportId: "rpt-task-completion", at: WORKSPACE_NOW - 5 * 3_600_000 },
      ],
    };
  }
  return g.__qubitAnalyticsStore;
}

const canExport = (role: WorkspaceRole) => role === "administrator" || role === "dept-head";
const canSchedule = (role: WorkspaceRole) => role === "administrator" || role === "dept-head";

// ============================================================
// Saved report visibility — server-side, never UI-only
// ============================================================

function visibleReports(role: WorkspaceRole): SavedReport[] {
  const s = store();
  if (role === "administrator") return s.reports;
  return s.reports.filter((r) => {
    if (r.ownerId === SESSION_USER_ID) return true;
    if (r.visibility === "Company") return true;
    if (r.visibility === "Department") return deptOf(r.ownerId) === deptOf(SESSION_USER_ID);
    return false;
  });
}

// ============================================================
// Semantic-layer dataset engine — the ONLY way reports touch
// data. No SQL, no raw table access: datasets + fields are
// whitelisted, permissions re-checked server-side per call.
// ============================================================

export interface DatasetRow {
  [field: string]: string | number;
}

export interface DatasetResult {
  datasetId: string;
  columns: { id: string; label: string; kind: string; type: string }[];
  rows: DatasetRow[];
  rowCount: number;
  totalNote: string | null;
  freshness: Freshness;
  sourceNote: string;
  system: string;
  scopeNote: string | null;
}

type Err = { ok: false; status: number; code: string; message: string };
type Ok<T> = { ok: true; data: T };
const err = (status: number, code: string, message: string): Err => ({ ok: false, status, code, message });

/** Sales rows through the SAME enforcement as Sales screens. */
function salesRows(role: WorkspaceRole, section: "opportunities" | "leads" | "orders" | "quotations" | "followups" | "leaderboard" | "reports"): Ok<Record<string, unknown>> | Err {
  const params = new URLSearchParams();
  const r = salesGet(role, section, params);
  if (!r.ok) return err(r.status, r.code, r.message);
  return { ok: true, data: r.data };
}

function baseRows(role: WorkspaceRole, scope: AnalyticsScope, datasetId: string): Ok<DatasetRow[]> | Err {
  const allTasks = (): Task[] => {
    if (scope === "own") return [...TASKS, ...TEAM_TASKS].filter((t) => t.assigneeId === SESSION_USER_ID);
    if (role === "hr-manager") return [...TASKS, ...TEAM_TASKS]; // aggregate counts only, assignee dim suppressed below
    return [...TASKS, ...TEAM_TASKS];
  };

  switch (datasetId) {
    case "ds-sales-pipeline": {
      const r = salesRows(role, "opportunities");
      if (!r.ok) return r;
      const rows = (r.data.rows ?? []) as Record<string, unknown>[];
      return {
        ok: true,
        data: rows.map((o) => {
          const account = o.account as { region?: string } | null;
          return {
            stage: String(o.stage ?? "—"),
            owner: String(o.ownerName ?? nameOf(o.ownerId as string)),
            region: String(account?.region ?? "—"),
            source: String(o.source ?? "—"),
            count: 1,
            value: Number(o.valueCr ?? 0),
            weighted: Number(((o.valueCr as number) ?? 0) * (((o.probability as number) ?? 0) / 100)),
          };
        }),
      };
    }
    case "ds-sales-leads": {
      const r = salesRows(role, "leads");
      if (!r.ok) return r;
      const rows = (r.data.rows ?? []) as Record<string, unknown>[];
      return {
        ok: true,
        data: rows.map((l) => ({
          status: String(l.status ?? "—"),
          priority: String(l.priority ?? "—"),
          source: String(l.source ?? "—"),
          owner: String(l.ownerName ?? nameOf(l.ownerId as string)),
          count: 1,
          value: Number(l.estimatedValueCr ?? 0),
        })),
      };
    }
    case "ds-sales-orders": {
      const r = salesRows(role, "orders");
      if (!r.ok) return r;
      const rows = (r.data.rows ?? []) as Record<string, unknown>[];
      return {
        ok: true,
        data: rows.map((o) => ({
          status: String(o.status ?? "—"),
          payment: String(o.payment ?? "—"),
          owner: String(o.ownerName ?? nameOf(o.ownerId as string)),
          count: 1,
          value: Number(o.total ?? 0) / 1e7,
        })),
      };
    }
    case "ds-finance-budget":
      return {
        ok: true,
        data: FINANCE.budgetVariance.map((b) => ({
          department: b.department,
          budget: b.budget,
          actual: b.actual,
          variancePct: b.variancePct,
        })),
      };
    case "ds-finance-receivables":
      return {
        ok: true,
        data: FINANCE.receivables.overdueAccounts.map((a) => ({
          account: a.account,
          aging: a.days > 60 ? "61+ days" : a.days > 30 ? "31–60 days" : "0–30 days",
          amount: a.amount,
        })),
      };
    case "ds-people-headcount":
      return { ok: true, data: PEOPLE.distribution.map((d) => ({ department: d.department, count: d.count })) };
    case "ds-people-hiring":
      return { ok: true, data: PEOPLE.hiring.funnel.map((s) => ({ stage: s.stage, count: s.count })) };
    case "ds-tasks-workspace":
      return {
        ok: true,
        data: allTasks().map((t) => ({
          status: t.status,
          priority: t.priority,
          department: deptOf(t.assigneeId),
          // privacy-safe aggregation for boundaries without team visibility:
          assignee: role === "administrator" || role === "dept-head" || t.assigneeId === SESSION_USER_ID ? nameOf(t.assigneeId) : "Within scope",
          count: 1,
        })),
      };
    case "ds-service-engineers":
      return {
        ok: true,
        data: SERVICE.engineers.map((e) => ({ engineer: e.name, resolved: e.resolved30d, csat: e.csat, slaPct: e.slaPct })),
      };
    case "ds-inventory-warehouses":
      return {
        ok: true,
        data: INVENTORY.warehouses.map((w) => ({ warehouse: w.name, location: w.location, utilizationPct: w.utilizationPct, value: w.valueCr })),
      };
    case "ds-marketing-channels":
      return {
        ok: true,
        data: MARKETING.channels.map((c) => ({ channel: c.channel, leads: c.leads, mqls: c.mqls, cpl: c.cpl, sourcedPipeline: c.sourcedPipeline })),
      };
    case "ds-audit-events": {
      if (role !== "administrator") return err(403, "dataset_not_authorized", "The audit dataset is restricted to administrators.");
      const q = queryAudit({ pageSize: 50, page: 1 }, role, SESSION_USER_ID);
      return {
        ok: true,
        data: q.events.map((e) => ({ action: e.action, severity: e.severity, result: e.result, actor: e.actor, source: e.source, count: 1 })),
      };
    }
    default:
      return err(404, "dataset_not_found", "Unknown dataset.");
  }
}

/** Compute a dataset view — grouping, measures, filters, sorting. */
export function computeDataset(
  role: WorkspaceRole,
  scope: AnalyticsScope,
  config: SavedReportConfig,
): DatasetResult[] | Err {
  const dataset = datasetById(config.datasetId);
  if (!dataset) return err(404, "dataset_not_found", "Unknown dataset.");
  if (!dataset.roles.includes(role)) {
    return err(403, "dataset_not_authorized", `"${dataset.label}" is not available to your role. The server enforces dataset permissions.`);
  }
  const dimFields = config.dimensions.filter((d) => dataset.fields.some((f) => f.id === d && f.kind === "dimension"));
  const measureFields = config.measures.filter((m) => dataset.fields.some((f) => f.id === m && f.kind === "measure"));
  if (dimFields.length === 0 && measureFields.length === 0) {
    return err(422, "invalid_config", "Select at least one dimension or measure from the dataset's governed fields.");
  }

  const base = baseRows(role, scope, config.datasetId);
  if (!base.ok) return base;

  // filters (equality on dimension values)
  let rows = base.data;
  for (const flt of config.filters ?? []) {
    if (!dataset.fields.some((f) => f.id === flt.dimension && f.kind === "dimension")) continue;
    rows = rows.filter((r) => String(r[flt.dimension] ?? "") === flt.value);
  }

  // aggregate
  const grouped = new Map<string, DatasetRow>();
  for (const row of rows) {
    const key = dimFields.map((d) => String(row[d] ?? "—")).join(" · ") || "All";
    const cur = grouped.get(key) ?? Object.fromEntries(dimFields.map((d, i) => [d, key.split(" · ")[i]]));
    for (const m of measureFields) {
      if (m === "count") cur.count = Number(cur.count ?? 0) + 1;
      else cur[m] = Number(cur[m] ?? 0) + Number(row[m] ?? 0);
    }
    grouped.set(key, cur);
  }
  let out = [...grouped.values()];

  // sort
  const sb = config.sortBy;
  if (sb && out.length > 0 && sb.field in out[0]) {
    out.sort((a, b) => (sb.dir === "asc" ? 1 : -1) * (Number(a[sb.field] ?? 0) - Number(b[sb.field] ?? 0) || String(a[sb.field] ?? "").localeCompare(String(b[sb.field] ?? ""))));
  }
  out = out.slice(0, 500);

  const columns = [
    ...dimFields.map((id) => {
      const f = dataset.fields.find((x) => x.id === id)!;
      return { id, label: f.label, kind: f.kind, type: f.type };
    }),
    ...measureFields.map((id) => {
      const f = dataset.fields.find((x) => x.id === id)!;
      return { id, label: f.label, kind: f.kind, type: f.type };
    }),
  ];

  const totalNote =
    measureFields.length === 1 && ["value", "amount", "budget", "actual"].includes(measureFields[0])
      ? `Total ${dataset.fields.find((f) => f.id === measureFields[0])?.label}: ${out.reduce((n, r) => n + Number(r[measureFields[0]] ?? 0), 0).toFixed(2)}`
      : null;

  const scopeNote =
    config.datasetId === "ds-tasks-workspace" && scope === "own"
      ? "Scoped to your own tasks — the server applied your authorization before computing."
      : config.datasetId.startsWith("ds-sales-") && scope === "own"
        ? "Scoped to your own sales records via the sales server."
        : null;

  return [
    {
      datasetId: dataset.id,
      columns,
      rows: out,
      rowCount: out.length,
      totalNote,
      freshness: dataset.freshness,
      sourceNote: dataset.sourceNote,
      system: dataset.system,
      scopeNote,
    },
  ];
}

// ============================================================
// GET section builders
// ============================================================

export type AnalyticsSection =
  | "home" | "executive" | "sales" | "finance" | "marketing" | "hr" | "service" | "inventory"
  | "productivity" | "tasks" | "funnels" | "cohorts" | "catalog" | "report" | "audit"
  | "exports" | "schedules" | "settings" | "metrics";

export function sectionFor(s: string | null): AnalyticsSection | null {
  const allowed: AnalyticsSection[] = ["home", "executive", "sales", "finance", "marketing", "hr", "service", "inventory", "productivity", "tasks", "funnels", "cohorts", "catalog", "report", "audit", "exports", "schedules", "settings", "metrics"];
  return allowed.includes(s as AnalyticsSection) ? (s as AnalyticsSection) : null;
}

const baseMeta = () => ({
  asOf: Date.now(),
  asOfLabel: ANALYTICS_PERIOD.asOfLabel,
  period: ANALYTICS_PERIOD,
});

interface HomeKpi {
  id: string;
  label: string;
  value: string;
  metricId?: string;
  trendPct?: number;
  status?: "On Track" | "Watch" | "At Risk";
  source: string;
  drill: { screen: string; label: string };
}

function homeKpis(role: WorkspaceRole, scope: AnalyticsScope): HomeKpi[] {
  if (role === "administrator" || role === "dept-head") {
    return [
      { id: "k-revenue", label: "Revenue (Recognized) — FYTD", value: `₹${REVENUE.ytd.actual.toFixed(2)} Cr`, metricId: "revenue-recognized", trendPct: 5.5, status: "On Track", source: "Finance ledger", drill: { screen: "finance-analytics", label: "Finance Analytics" } },
      { id: "k-pipeline", label: "Open Pipeline", value: `₹${EXEC_SALES.pipeline.value.toFixed(1)} Cr`, metricId: "pipeline-value", status: "On Track", source: "Sales OS", drill: { screen: "sales-analytics", label: "Sales Analytics" } },
      { id: "k-receivables", label: "Overdue Receivables", value: `₹${FINANCE.receivables.overdue.toFixed(2)} Cr`, metricId: "dsso-days", status: "At Risk", source: "Finance ledger", drill: { screen: "finance-analytics", label: "Finance Analytics" } },
      { id: "k-headcount", label: "Headcount", value: PEOPLE.headcount.total.toLocaleString("en-IN"), metricId: "headcount", status: "On Track", source: "HR registry (aggregated)", drill: { screen: "hr-analytics", label: "HR Analytics" } },
      { id: "k-tickets", label: "Open Service Tickets", value: String(SERVICE.tickets.open), metricId: "sla-compliance", status: "Watch", source: "Service desk", drill: { screen: "service-analytics", label: "Service Analytics" } },
      { id: "k-inventory", label: "Inventory Valuation", value: `₹${INVENTORY.valueCr.toFixed(2)} Cr`, metricId: "inventory-value", source: "Inventory · Finance-aligned", drill: { screen: "inventory-analytics", label: "Inventory Analytics" } },
      { id: "k-tasks", label: "Open Workspace Tasks", value: String([...TASKS, ...TEAM_TASKS].filter((t) => !["Completed", "Cancelled"].includes(t.status)).length), source: "Workspace task store", drill: { screen: "task-analytics", label: "Task Analytics" } },
      { id: "k-marketing", label: "Marketing-sourced Pipeline (QTD)", value: `₹${MARKETING.qtd.sourcedPipeline.toFixed(2)} Cr`, metricId: "sourced-pipeline", status: "Watch", source: "Marketing connector (delayed)", drill: { screen: "marketing-analytics", label: "Marketing Analytics" } },
    ];
  }
  if (role === "sales-exec") {
    const r = salesGet(role, "reports", new URLSearchParams());
    const m = (r.ok ? (r.data as { metrics?: { pipeline?: { open?: number; value?: number }; conversion?: { leads?: number; converted?: number } } }).metrics : undefined) ?? {};
    return [
      { id: "k-own-pipeline", label: "Your Open Pipeline", value: `₹${(m.pipeline?.value ?? 0).toFixed(2)} Cr`, metricId: "pipeline-value", source: "Sales OS (own scope)", drill: { screen: "sales-analytics", label: "Sales Analytics" } },
      { id: "k-own-open", label: "Your Open Opportunities", value: String(m.pipeline?.open ?? 0), source: "Sales OS (own scope)", drill: { screen: "sales-analytics", label: "Sales Analytics" } },
      { id: "k-own-leads", label: "Leads in Scope", value: String(m.conversion?.leads ?? 0), metricId: "lead-conversion", source: "Sales OS (own scope)", drill: { screen: "sales-analytics", label: "Sales Analytics" } },
      { id: "k-own-tasks", label: "Your Open Tasks", value: String([...TASKS, ...TEAM_TASKS].filter((t) => t.assigneeId === SESSION_USER_ID && !["Completed", "Cancelled"].includes(t.status)).length), source: "Workspace task store", drill: { screen: "employee-productivity", label: "Employee Productivity" } },
    ];
  }
  if (role === "hr-manager") {
    return [
      { id: "k-headcount", label: "Headcount", value: PEOPLE.headcount.total.toLocaleString("en-IN"), metricId: "headcount", source: "HR registry (aggregated)", drill: { screen: "hr-analytics", label: "HR Analytics" } },
      { id: "k-attrition", label: "Attrition (Annualized)", value: `${PEOPLE.attrition.annualizedPct.toFixed(1)}%`, metricId: "attrition-annualized", status: "Watch", source: "HR registry (aggregated)", drill: { screen: "hr-analytics", label: "HR Analytics" } },
      { id: "k-open-positions", label: "Open Positions", value: String(PEOPLE.hiring.openPositions), source: "HR · recruitment (aggregated)", drill: { screen: "hr-analytics", label: "HR Analytics" } },
      { id: "k-attendance", label: "Attendance", value: `${PEOPLE.attendancePct.toFixed(1)}%`, source: "HR registry (aggregated)", drill: { screen: "hr-analytics", label: "HR Analytics" } },
      { id: "k-tasks", label: "Open Workspace Tasks", value: String([...TASKS, ...TEAM_TASKS].filter((t) => !["Completed", "Cancelled"].includes(t.status)).length), source: "Workspace task store", drill: { screen: "task-analytics", label: "Task Analytics" } },
    ];
  }
  // employee
  const own = [...TASKS, ...TEAM_TASKS].filter((t) => t.assigneeId === SESSION_USER_ID);
  const dueSoFar = own.filter((t) => t.due !== null && t.due! <= WORKSPACE_NOW);
  const onTime = dueSoFar.filter((t) => t.completedAt && t.due && t.completedAt <= t.due).length;
  return [
    { id: "k-own-open", label: "Your Open Tasks", value: String(own.filter((t) => !["Completed", "Cancelled"].includes(t.status)).length), source: "Workspace task store", drill: { screen: "employee-productivity", label: "Employee Productivity" } },
    { id: "k-own-overdue", label: "Your Overdue Tasks", value: String(own.filter((t) => t.due !== null && t.due! < WORKSPACE_NOW && !["Completed", "Cancelled"].includes(t.status)).length), status: "Watch", source: "Workspace task store", drill: { screen: "employee-productivity", label: "Employee Productivity" } },
    { id: "k-own-rate", label: "Your On-time Completion", value: dueSoFar.length > 0 ? `${Math.round((onTime / dueSoFar.length) * 100)}%` : "—", metricId: "task-completion", source: "Workspace task store", drill: { screen: "employee-productivity", label: "Employee Productivity" } },
    { id: "k-own-meetings", label: "Meetings This Week", value: String(MEETINGS.filter((m) => Math.abs(m.start - WORKSPACE_NOW) < 7 * 86_400_000).length), source: "Workspace meetings", drill: { screen: "employee-productivity", label: "Employee Productivity" } },
  ];
}

function analyticsAlerts(role: WorkspaceRole) {
  const s = store();
  const alerts: { id: string; severity: "Info" | "Warning" | "High"; title: string; detail: string }[] = [];
  alerts.push({
    id: "al-marketing",
    severity: "Warning",
    title: "Marketing source sync delayed",
    detail: DOMAIN_FRESHNESS.marketing.detail ?? "Marketing Automation connector is re-running its nightly sync.",
  });
  const failedExports = s.exports.filter((e) => e.status === "Failed" && (role === "administrator" || e.requestedBy === SESSION_USER_ID));
  for (const e of failedExports) {
    alerts.push({ id: `al-exp-${e.id}`, severity: "Warning", title: `Export failed — ${e.sourceLabel}`, detail: e.failureReason ?? "The export job failed. Retry safely from the Data Export workspace." });
  }
  const failedSchedules = s.schedules.filter((x) => x.lastResult?.outcome === "Failed" && (role === "administrator" || x.ownerId === SESSION_USER_ID));
  for (const sch of failedSchedules) {
    alerts.push({ id: `al-sch-${sch.id}`, severity: "Info", title: `Scheduled delivery failed — ${sch.reportName}`, detail: sch.lastResult?.detail ?? "The last scheduled delivery failed." });
  }
  return alerts;
}

function homePayload(role: WorkspaceRole, scope: AnalyticsScope) {
  const s = store();
  const reports = visibleReports(role);
  const favIds = s.favorites[SESSION_USER_ID] ?? [];
  const recent = s.recent
    .filter((r) => r.userId === SESSION_USER_ID)
    .map((r) => ({ ...r, report: s.reports.find((x) => x.id === r.reportId) ?? null }))
    .filter((r) => r.report)
    .slice(0, 4);
  const schedules = s.schedules.filter((x) => x.ownerId === SESSION_USER_ID || role === "administrator");
  return {
    ...baseMeta(),
    scope,
    roleKpis: homeKpis(role, scope),
    freshness: { ...DOMAIN_FRESHNESS, workspace: WORKSPACE_FRESHNESS, audit: AUDIT_FRESHNESS },
    alerts: analyticsAlerts(role),
    savedReports: reports.slice(0, 8).map((r) => ({ id: r.id, name: r.name, visibility: r.visibility, ownerName: r.ownerName, updatedAt: r.updatedAt, lastRun: r.lastRun, favorite: favIds.includes(r.id), status: r.status })),
    favoriteReports: reports.filter((r) => favIds.includes(r.id)).map((r) => ({ id: r.id, name: r.name })),
    recentReports: recent,
    scheduleCount: schedules.filter((x) => x.active).length,
    nextScheduled: schedules.filter((x) => x.active).sort((a, b) => (a.lastRun ?? 0) - (b.lastRun ?? 0))[0]?.nextRun ?? null,
    exportCount: s.exports.filter((e) => role === "administrator" || e.requestedBy === SESSION_USER_ID).length,
    quickLinks: [
      { id: "executive-analytics", label: "Executive Analytics", roles: ["administrator"] },
      { id: "sales-analytics", label: "Sales Analytics", roles: ["administrator", "dept-head", "sales-exec"] },
      { id: "finance-analytics", label: "Finance Analytics", roles: ["administrator"] },
      { id: "marketing-analytics", label: "Marketing Analytics", roles: ["administrator", "dept-head", "sales-exec"] },
      { id: "hr-analytics", label: "HR Analytics", roles: ["administrator", "hr-manager"] },
      { id: "service-analytics", label: "Service Analytics", roles: ["administrator", "dept-head"] },
      { id: "inventory-analytics", label: "Inventory Analytics", roles: ["administrator", "dept-head"] },
      { id: "employee-productivity", label: "Employee Productivity", roles: ["administrator", "dept-head", "hr-manager", "sales-exec", "employee"] },
      { id: "task-analytics", label: "Task Analytics", roles: ["administrator", "dept-head", "hr-manager", "sales-exec", "employee"] },
      { id: "funnel-analytics", label: "Funnel Analytics", roles: ["administrator", "dept-head", "sales-exec", "hr-manager"] },
    ].filter((l) => (l.roles as string[]).includes(role)),
    canCreate: true,
    canExport: canExport(role),
  };
}

function executivePayload(role: WorkspaceRole) {
  const gate = requireExecutive(role);
  if (!gate.ok) return gate;
  return {
    ok: true as const,
    data: {
      ...baseMeta(),
      kpis: KPIS,
      revenue: REVENUE,
      sales: EXEC_SALES,
      finance: FINANCE,
      people: PEOPLE,
      marketing: MARKETING,
      service: SERVICE,
      inventory: INVENTORY,
      field: FIELD,
      freshness: DOMAIN_FRESHNESS,
    },
  };
}

interface SalesAnalyticsPayload {
  scope: AnalyticsScope;
  salesScope: string;
  leadVolume: number;
  leadsByStatus: { label: string; count: number }[];
  leadsBySource: { label: string; count: number; converted: number }[];
  leadConversionPct: number | null;
  opportunityVolume: number;
  openOpportunities: number;
  byStage: { stage: string; count: number; value: number; weighted: number; avgDays: number }[];
  pipelineValue: number;
  weightedPipeline: number;
  winRatePct: number | null;
  avgDealCr: number | null;
  avgCycleDays: number | null;
  quotation: { total: number; accepted: number; pending: number; acceptancePct: number };
  orders: { count: number; bookedValueCr: number; byStatus: { label: string; count: number }[] };
  followups: { overdue: number; dueToday: number; upcoming: number; completed: number };
  leaderboard: { name: string; achievementPct: number; achieved: number; quota: number; conversionPct: number }[];
  forecast: { commit: number; bestCase: number; weighted: number; target: number } | null;
  revenueTrend: { month: string; actual: number | null; target: number; forecast?: number | null }[];
  freshness: Freshness;
  period: typeof EXEC_PERIOD;
}

function salesAnalyticsPayload(role: WorkspaceRole): Ok<Record<string, unknown>> | Err {
  const gate = requireSalesAccess(role, "Analytics · Sales Analytics");
  if (!gate.ok) return gate;

  const opps = salesRows(role, "opportunities");
  const leads = salesRows(role, "leads");
  const orders = salesRows(role, "orders");
  const quotes = salesRows(role, "quotations");
  const board = salesRows(role, "leaderboard");
  const fus = salesRows(role, "followups");
  const rep = salesRows(role, "reports");
  if (!opps.ok) return opps;
  if (!leads.ok) return leads;
  if (!orders.ok) return orders;
  if (!quotes.ok) return quotes;
  if (!board.ok) return board;
  if (!fus.ok) return fus;
  if (!rep.ok) return rep;

  const oppRows = (opps.data.rows ?? []) as Record<string, unknown>[];
  const leadRows = (leads.data.rows ?? []) as Record<string, unknown>[];
  const orderRows = (orders.data.rows ?? []) as Record<string, unknown>[];
  const quoteRows = (quotes.data.rows ?? []) as Record<string, unknown>[];
  const boardRows = (board.data.rows ?? []) as Record<string, unknown>[];
  const fuRows = (fus.data.rows ?? []) as Record<string, unknown>[];
  const repMetrics = (rep.data as { metrics?: Record<string, unknown> }).metrics ?? {};

  const open = oppRows.filter((o) => !["Won", "Lost"].includes(String(o.stage)));
  const closed = oppRows.filter((o) => ["Won", "Lost"].includes(String(o.stage)));
  const won = closed.filter((o) => o.stage === "Won");
  const lost = closed.filter((o) => o.stage === "Lost");

  const stages = ["Discovery", "Proposal", "Negotiation", "Contracting", "Won", "Lost"];
  const byStage = stages
    .map((stage) => {
      const rows = oppRows.filter((o) => o.stage === stage);
      const avgDays = rows.length
        ? Math.round(rows.reduce((n, o) => n + Math.max(0, WORKSPACE_NOW - Number(o.lastStageChangeAt ?? WORKSPACE_NOW)), 0) / rows.length / 86_400_000)
        : 0;
      return {
        stage,
        count: rows.length,
        value: rows.reduce((n, o) => n + Number(o.valueCr ?? 0), 0),
        weighted: rows.reduce((n, o) => n + Number(o.valueCr ?? 0) * (Number(o.probability ?? 0) / 100), 0),
        avgDays: open.some((o) => o.stage === stage) || ["Won", "Lost"].includes(stage) ? avgDays : 0,
      };
    })
    .filter((s) => s.count > 0 || ["Discovery", "Proposal", "Negotiation", "Contracting"].includes(s.stage));

  const closedWonValues = won.map((o) => Number(o.valueCr ?? 0));
  const cycleDays = won
    .map((o) => Number(o.closedAt ?? 0) > 0 && Number(o.createdAt ?? 0) > 0 ? Math.max(0, Number(o.closedAt) - Number(o.createdAt)) / 86_400_000 : null)
    .filter((v): v is number => v !== null);

  const payload: SalesAnalyticsPayload = {
    scope: "company",
    salesScope: String((opps.data as { scope?: string }).scope ?? gate.scope),
    leadVolume: leadRows.length,
    leadsByStatus: ["New", "Working", "Qualified", "Unqualified", "Converted"].map((st) => ({ label: st, count: leadRows.filter((l) => l.status === st).length })).filter((x) => x.count > 0),
    leadsBySource: Object.entries(
      leadRows.reduce<Record<string, { count: number; converted: number }>>((acc, l) => {
        const src = String(l.source ?? "—");
        acc[src] = acc[src] ?? { count: 0, converted: 0 };
        acc[src].count += 1;
        if (l.status === "Converted") acc[src].converted += 1;
        return acc;
      }, {}),
    ).map(([label, v]) => ({ label, ...v })),
    leadConversionPct: leadRows.length ? Math.round((leadRows.filter((l) => l.status === "Converted").length / leadRows.length) * 1000) / 10 : null,
    opportunityVolume: oppRows.length,
    openOpportunities: open.length,
    byStage,
    pipelineValue: open.reduce((n, o) => n + Number(o.valueCr ?? 0), 0),
    weightedPipeline: open.reduce((n, o) => n + Number(o.valueCr ?? 0) * (Number(o.probability ?? 0) / 100), 0),
    winRatePct: closed.length ? Math.round((won.length / closed.length) * 1000) / 10 : null,
    avgDealCr: closedWonValues.length ? closedWonValues.reduce((a, b) => a + b, 0) / closedWonValues.length : null,
    avgCycleDays: cycleDays.length ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) : null,
    quotation: {
      total: quoteRows.length,
      accepted: quoteRows.filter((q) => q.status === "Accepted").length,
      pending: quoteRows.filter((q) => q.status === "Pending Approval").length,
      acceptancePct: quoteRows.length ? Math.round((quoteRows.filter((q) => q.status === "Accepted").length / quoteRows.length) * 1000) / 10 : 0,
    },
    orders: {
      count: orderRows.length,
      bookedValueCr: orderRows.reduce((n, o) => n + Number(o.total ?? 0) / 1e7, 0),
      byStatus: ["Confirmed", "In Fulfillment", "Dispatched", "Delivered", "Closed", "Cancelled"].map((st) => ({ label: st, count: orderRows.filter((o) => o.status === st).length })).filter((x) => x.count > 0),
    },
    followups: {
      overdue: fuRows.filter((f) => f.state === "Overdue").length,
      dueToday: fuRows.filter((f) => f.state === "Due Today").length,
      upcoming: fuRows.filter((f) => f.state === "Upcoming").length,
      completed: fuRows.filter((f) => f.state === "Completed").length,
    },
    leaderboard: boardRows.slice(0, 8).map((r) => ({
      name: String(r.name ?? "—"),
      achievementPct: Number(r.achievementPct ?? 0),
      achieved: Number(r.revenueCr ?? 0),
      quota: Number(r.quotaCr ?? 0),
      conversionPct: Number(r.conversionPct ?? 0),
    })),
    forecast: (repMetrics.forecast as SalesAnalyticsPayload["forecast"]) ?? null,
    revenueTrend: REVENUE.trend,
    freshness: DOMAIN_FRESHNESS.sales,
    period: EXEC_PERIOD,
  };

  return {
    ok: true,
    data: {
      ...baseMeta(),
      ...payload,
      notes: [
        "Pipeline, win/loss, deal and cycle figures are computed from the live Sales OS store at your authorization scope — opportunity values, not recognized revenue.",
        "The revenue trend is the Finance ledger view (recognized basis) from the canonical executive data — labelled separately from bookings.",
      ],
    },
  };
}

function financePayload(role: WorkspaceRole): Ok<Record<string, unknown>> | Err {
  if (role !== "administrator") {
    return err(403, "finance_analytics_restricted", "Finance analytics contains sensitive financial data and is restricted to authorized finance/administrator boundaries. The server enforces this restriction.");
  }
  return {
    ok: true,
    data: {
      ...baseMeta(),
      finance: FINANCE,
      revenue: REVENUE,
      definitions: {
        booked: metricById("revenue-booked"),
        recognized: metricById("revenue-recognized"),
        collected: metricById("revenue-collected"),
        dso: metricById("dsso-days"),
        inventoryValue: metricById("inventory-value"),
      },
      freshness: { revenue: DOMAIN_FRESHNESS.revenue, finance: DOMAIN_FRESHNESS.finance },
    },
  };
}

function marketingPayload(role: WorkspaceRole): Ok<Record<string, unknown>> | Err {
  if (!["administrator", "dept-head", "sales-exec"].includes(role)) {
    return err(403, "marketing_analytics_restricted", "Marketing analytics is available to authorized business boundaries. The server enforces this restriction.");
  }
  return {
    ok: true,
    data: {
      ...baseMeta(),
      marketing: MARKETING,
      definitions: { cpl: metricById("cpl"), sourcedPipeline: metricById("sourced-pipeline") },
      freshness: DOMAIN_FRESHNESS.marketing,
      metricLabels: {
        leads: "Platform-reported",
        mqls: "Qubit-derived (marketing qualification)",
        sourcedPipeline: "Attributed business outcome (where configured)",
      },
    },
  };
}

function hrPayload(role: WorkspaceRole): Ok<Record<string, unknown>> | Err {
  if (!["administrator", "hr-manager"].includes(role)) {
    return err(403, "hr_analytics_restricted", "HR analytics is restricted to authorized HR/administrator boundaries. Aggregated, privacy-safe counts only — no individual HR data is exposed through analytics.");
  }
  return {
    ok: true,
    data: {
      ...baseMeta(),
      people: PEOPLE,
      definitions: { headcount: metricById("headcount"), attrition: metricById("attrition-annualized") },
      freshness: DOMAIN_FRESHNESS.people,
      privacyNotice:
        "Analytics shows aggregated, privacy-safe counts only. Salary, payroll, bank information, performance details, personal documents and candidate data are excluded from the analytics layer by policy — enforced server-side.",
      excludedFields: ["Salary & payroll", "Bank information", "Performance details per individual", "Personal documents", "Candidate identities"],
    },
  };
}

function servicePayload(role: WorkspaceRole): Ok<Record<string, unknown>> | Err {
  if (!["administrator", "dept-head"].includes(role)) {
    return err(403, "service_analytics_restricted", "Service analytics is available to authorized business boundaries. The server enforces this restriction.");
  }
  return {
    ok: true,
    data: {
      ...baseMeta(),
      service: SERVICE,
      field: FIELD,
      definitions: { sla: metricById("sla-compliance") },
      freshness: { service: DOMAIN_FRESHNESS.service, field: DOMAIN_FRESHNESS.field },
    },
  };
}

function inventoryPayload(role: WorkspaceRole): Ok<Record<string, unknown>> | Err {
  if (!["administrator", "dept-head"].includes(role)) {
    return err(403, "inventory_analytics_restricted", "Inventory analytics is available to authorized business boundaries. The server enforces this restriction.");
  }
  return {
    ok: true,
    data: {
      ...baseMeta(),
      inventory: INVENTORY,
      definitions: { inventoryValue: metricById("inventory-value") },
      freshness: DOMAIN_FRESHNESS.inventory,
      separationNote:
        "Operational inventory metrics (stock levels, movement, dispatch) are separate from the financial valuation, which stays aligned with Finance (spec §16).",
    },
  };
}

function tasksForRole(role: WorkspaceRole, scope: AnalyticsScope): { rows: Task[]; scopeNote: string } {
  const all = [...TASKS, ...TEAM_TASKS];
  if (scope === "own") return { rows: all.filter((t) => t.assigneeId === SESSION_USER_ID), scopeNote: "Scoped to your own tasks — server-enforced." };
  if (role === "sales-exec") return { rows: all.filter((t) => t.assigneeId === SESSION_USER_ID), scopeNote: "Sales boundaries see their own tasks in workspace analytics." };
  if (role === "hr-manager") return { rows: all, scopeNote: "Aggregate task counts only — assignee names are suppressed for this boundary." };
  return { rows: all, scopeNote: "Company-wide task analytics from the ONE workspace task store." };
}

function tasksPayload(role: WorkspaceRole, scope: AnalyticsScope) {
  const { rows, scopeNote } = tasksForRole(role, scope);
  const overdue = rows.filter((t) => t.due !== null && t.due! < WORKSPACE_NOW && !["Completed", "Cancelled"].includes(t.status));
  const completed = rows.filter((t) => t.status === "Completed");
  const dueSoFar = rows.filter((t) => t.due !== null && t.due! <= WORKSPACE_NOW);
  const onTime = dueSoFar.filter((t) => t.completedAt && t.due && t.completedAt <= t.due).length;
  const byStatus = ["Not Started", "In Progress", "Blocked", "Waiting", "Completed", "Cancelled"].map((st) => ({ label: st, count: rows.filter((t) => t.status === st).length })).filter((x) => x.count > 0);
  const byPriority = ["High", "Medium", "Low"].map((p) => ({ label: p, count: rows.filter((t) => t.priority === p).length })).filter((x) => x.count > 0);
  const byDept = Object.entries(
    rows.reduce<Record<string, number>>((acc, t) => {
      const d = deptOf(t.assigneeId);
      acc[d] = (acc[d] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  const workload = Object.entries(
    rows.reduce<Record<string, number>>((acc, t) => {
      const key = role === "administrator" || role === "dept-head" ? nameOf(t.assigneeId) : t.assigneeId === SESSION_USER_ID ? "You" : "Within scope";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  const turnaround = completed.filter((t) => t.completedAt).map((t) => Math.max(0, (t.completedAt! - (t.due ?? t.completedAt!)) / 86_400_000));
  return {
    ...baseMeta(),
    scope,
    scopeNote,
    totals: { total: rows.length, open: rows.filter((t) => !["Completed", "Cancelled"].includes(t.status)).length, completed: completed.length, overdue: overdue.length, blocked: rows.filter((t) => t.status === "Blocked").length, cancelled: rows.filter((t) => t.status === "Cancelled").length },
    completionRatePct: dueSoFar.length ? Math.round((onTime / dueSoFar.length) * 1000) / 10 : null,
    turnaroundNote: completed.length ? `Completed tasks in scope: ${completed.length}. Average slip vs due date: ${turnaround.length ? (turnaround.reduce((a, b) => a + b, 0) / turnaround.length).toFixed(1) : "0.0"} days (negative = early).` : "No completed tasks in scope yet — completion trend appears as data accumulates.",
    byStatus,
    byPriority,
    byDept,
    workload,
    overdueTrend: [
      { label: "Overdue now", count: overdue.length },
      { label: "Due today", count: rows.filter((t) => t.due !== null && t.due! >= WORKSPACE_NOW - 86_400_000 / 2 && t.due! < WORKSPACE_NOW + 86_400_000 / 2 && !["Completed", "Cancelled"].includes(t.status)).length },
      { label: "Due this week", count: rows.filter((t) => t.due !== null && t.due! >= WORKSPACE_NOW && t.due! < WORKSPACE_NOW + 7 * 86_400_000 && !["Completed", "Cancelled"].includes(t.status)).length },
    ],
    freshness: WORKSPACE_FRESHNESS,
    definitions: { completion: metricById("task-completion") },
    sourceNote: "Read from the ONE workspace task store — no second task database exists (spec §18).",
  };
}

function productivityPayload(role: WorkspaceRole, scope: AnalyticsScope) {
  const base = tasksPayload(role, scope);
  const ownMeetings = MEETINGS.filter((m) => m.participantIds?.includes(SESSION_USER_ID) || m.organizerId === SESSION_USER_ID);
  const weekMeetings = ownMeetings.filter((m) => Math.abs(m.start - WORKSPACE_NOW) < 7 * 86_400_000);
  const hoursScheduled = weekMeetings.reduce((n, m) => n + (m.end - m.start) / 3_600_000, 0);
  return {
    ...base,
    privacyNote:
      "Privacy-conscious by design: metrics come from work items you already own (tasks, meetings, approvals). No efficiency scores, no screen-time measurement, no keyboard/mouse tracking, no fabricated activity scores — those metrics are not produced anywhere in Qubit One.",
    personal: {
      meetingsThisWeek: weekMeetings.length,
      meetingHoursThisWeek: Math.round(hoursScheduled * 10) / 10,
      meetingsDefinition: "Meetings where you are owner or attendee, from the ONE workspace meetings module.",
    },
  };
}

function funnelStages(role: WorkspaceRole, scope: AnalyticsScope, funnelId: string): Ok<Record<string, unknown>> | Err {
  const def = funnelById(funnelId);
  if (!def) return err(404, "funnel_not_found", "Unknown funnel.");
  if (!def.roles.includes(role)) return err(403, "funnel_not_authorized", `"${def.name}" is not available to your role.`);

  if (funnelId === "funnel-sales") {
    const gate = requireSalesAccess(role, "Analytics · Sales funnel");
    if (!gate.ok) return gate;
    const o = salesRows(role, "opportunities");
    const l = salesRows(role, "leads");
    const c = salesRows(role, "quotations");
    const or = salesRows(role, "orders");
    if (!o.ok || !l.ok || !c.ok || !or.ok) return !o.ok ? o : !l.ok ? l : !c.ok ? c : or;
    const oppRows = (o.data.rows ?? []) as Record<string, unknown>[];
    const leadRows = (l.data.rows ?? []) as Record<string, unknown>[];
    const quoteRows = (c.data.rows ?? []) as Record<string, unknown>[];
    const orderRows = (or.data.rows ?? []) as Record<string, unknown>[];
    const stages = [
      { stage: "Lead", count: leadRows.length, valueCr: leadRows.reduce((n, x) => n + Number(x.estimatedValueCr ?? 0), 0), note: "All leads in scope" },
      { stage: "Contact", count: new Set(leadRows.filter((x) => x.convertedTo).map((x) => String((x.convertedTo as { contactId?: string })?.contactId ?? x.id))).size + leadRows.filter((x) => !["New"].includes(String(x.status))).length, valueCr: null, note: "Leads progressed to qualified conversation" },
      { stage: "Opportunity", count: oppRows.length, valueCr: oppRows.reduce((n, x) => n + Number(x.valueCr ?? 0), 0), note: "All opportunities created" },
      { stage: "Proposal", count: quoteRows.length, valueCr: null, note: "Quotations raised (proposal basis)" },
      { stage: "Negotiation", count: oppRows.filter((x) => x.stage === "Negotiation" || x.stage === "Contracting").length, valueCr: oppRows.filter((x) => x.stage === "Negotiation" || x.stage === "Contracting").reduce((n, x) => n + Number(x.valueCr ?? 0), 0), note: "Opportunities at negotiation/contracting" },
      { stage: "Won", count: orderRows.length, valueCr: orderRows.reduce((n, x) => n + Number(x.total ?? 0) / 1e7, 0), note: "Orders created — booked basis (not recognized revenue)" },
    ];
    return { ok: true, data: { ...baseMeta(), funnel: def, stages, scopeNote: gate.scope === "own" ? "Scoped to your own sales records." : gate.scope === "team" ? "Scoped to your teams." : "Company scope.", comparisonNote: "The live sales store does not retain a previous-period snapshot — period comparison is shown only where a source provides it (see Marketing funnel)." } };
  }

  if (funnelId === "funnel-recruitment") {
    const stages = PEOPLE.hiring.funnel.map((s) => ({ stage: s.stage, count: s.count, valueCr: null, note: "Aggregate candidates" }));
    return { ok: true, data: { ...baseMeta(), funnel: def, stages, scopeNote: "Aggregated, privacy-safe counts.", comparisonNote: "The recruitment source provides cumulative FYTD counts; period comparison is not asserted." } };
  }

  if (funnelId === "funnel-service") {
    const total = SERVICE.tickets.open + SERVICE.tickets.resolved30d;
    const stages = [
      { stage: "Request", count: total, valueCr: null, note: "Inbound requests (open + resolved-30d)" },
      { stage: "Ticket", count: total, valueCr: null, note: "All requests logged as tickets" },
      { stage: "Assignment", count: total, valueCr: null, note: "Assignment is part of intake in this source — not separately retained" },
      { stage: "Visit", count: FIELD.visits.scheduledWeek, valueCr: null, note: "Field visits scheduled this week (field operations block)" },
      { stage: "Resolution", count: SERVICE.tickets.resolved30d, valueCr: null, note: "Tickets resolved in trailing 30 days" },
    ];
    return { ok: true, data: { ...baseMeta(), funnel: def, stages, scopeNote: "Derived from canonical Service + Field blocks.", comparisonNote: "Stage placement between Assignment and Visit is derived, as noted per stage — not silently interpolated." } };
  }

  // funnel-marketing
  const stages = [
    { stage: "Lead", count: MARKETING.qtd.leads, valueCr: null, note: "Platform-reported leads, QTD as of 31 Oct" },
    { stage: "MQL", count: MARKETING.qtd.mql, valueCr: null, note: "Marketing-qualified (Qubit-derived)" },
    { stage: "SQL", count: MARKETING.qtd.sql, valueCr: null, note: "Sales-qualified" },
    { stage: "Sourced Pipeline", count: null, valueCr: MARKETING.qtd.sourcedPipeline, note: "Attributed pipeline (₹ Cr) — where configured" },
  ];
  return {
    ok: true,
    data: {
      ...baseMeta(),
      funnel: def,
      stages,
      scopeNote: "Canonical Marketing block (delayed source — final as of 31 Oct 2026).",
      comparisonNote: `Period comparison where the source provides it: Sep ${MARKETING.trend[0]?.leads ?? 0} leads → Oct ${MARKETING.trend[1]?.leads ?? 0} leads. November is pending the source sync.`,
      comparison: MARKETING.trend.filter((t) => t.final).map((t) => ({ period: t.month, leads: t.leads, mql: t.mql })),
    },
  };
}

function cohortsPayload(role: WorkspaceRole, scope: AnalyticsScope): Ok<Record<string, unknown>> | Err {
  if (role === "employee" && scope === "own") {
    // employees get the honest personal-trend view only
    return err(403, "cohort_not_authorized", "Cohort analysis is available to authorized business boundaries. Your personal productivity view is on Employee Productivity (275).");
  }
  if (role === "hr-manager") {
    // HR gets the employee joining cohort only
    return {
      ok: true,
      data: {
        ...baseMeta(),
        cohorts: [
          {
            id: "cohort-employees",
            name: "Employee joining cohorts — FY27 (aggregated)",
            grain: "Monthly joining cohort",
            unit: "employees",
            rows: PEOPLE.trend.map((t) => ({ cohort: t.month, size: t.hires, stillActive: t.headcount, retentionPct: null, note: "Headcount at month end includes earlier cohorts — individual retention linkage is not in this source." })),
            dataNote: "Aggregated from the HR registry. Retention per cohort is not asserted because the source provides headcount evolution, not per-cohort survivorship.",
          },
        ],
        trendSeries: [
          { id: "headcount", name: "Headcount trend (monthly)", unit: "employees", points: PEOPLE.trend.map((t) => ({ label: t.month, value: t.headcount })) },
        ],
        honestyNote: "Small cohorts (n < 10) are present — interpret month-to-month moves with care. Two fiscal years of history are not yet in the analytics window, so seasonality is not asserted.",
        freshness: DOMAIN_FRESHNESS.people,
      },
    };
  }

  // customer cohorts from the live sales store (orders by account, first-order cohort)
  const or = salesRows(role, "orders");
  if (!or.ok) return or;
  const orderRows = (or.data.rows ?? []) as Record<string, unknown>[];
  const byAccount = new Map<string, { first: number; orders: number; valueCr: number; account: string }>();
  for (const o of orderRows) {
    const accountId = String(o.accountId ?? "—");
    const accountName = String((o.account as { name?: string } | null)?.name ?? "—");
    const created = Number(o.createdAt ?? 0);
    const val = Number(o.total ?? 0) / 1e7;
    const cur = byAccount.get(accountId);
    if (!cur) byAccount.set(accountId, { first: created, orders: 1, valueCr: val, account: accountName });
    else {
      cur.orders += 1;
      cur.valueCr += val;
      cur.first = Math.min(cur.first, created);
    }
  }
  const quarterOf = (ts: number) => {
    const d = new Date(ts);
    const m = d.getMonth();
    return `Q${Math.floor(m / 3) + 1} ${d.getFullYear()}`;
  };
  const cohortMap = new Map<string, { customers: number; orders: number; valueCr: number }>();
  for (const v of byAccount.values()) {
    const q = quarterOf(v.first);
    const cur = cohortMap.get(q) ?? { customers: 0, orders: 0, valueCr: 0 };
    cur.customers += 1;
    cur.orders += v.orders;
    cur.valueCr += v.valueCr;
    cohortMap.set(q, cur);
  }
  const customerCohort = [...cohortMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cohort, v]) => ({
      cohort,
      size: v.customers,
      orders: v.orders,
      valueCr: Math.round(v.valueCr * 100) / 100,
      repeatPct: v.customers ? Math.round((v.orders / v.customers) * 100) / 10 : null,
      note: v.customers < 3 ? "Small cohort — interpret with care." : null,
    }));

  return {
    ok: true,
    data: {
      ...baseMeta(),
      scopeNote: scope === "own" ? "Scoped to your own sales records." : "Computed from the live sales store at your scope.",
      cohorts: [
        {
          id: "cohort-customers",
          name: "Customer acquisition cohorts — by first order quarter",
          grain: "Quarterly acquisition cohort",
          unit: "customers",
          rows: customerCohort,
          dataNote: "Cohorts computed from orders in the live sales store (first-order quarter per account). Repeat % = orders ÷ customers in the cohort.",
        },
      ],
      trendSeries: [
        { id: "revenue", name: "Revenue trend (recognized, Finance ledger)", unit: "₹ Cr", points: REVENUE.trend.map((t) => ({ label: t.month, value: t.actual, target: t.target })) },
        { id: "backlog", name: "Service backlog trend (weekly)", unit: "open tickets", points: SERVICE.tickets.backlogTrend.map((t) => ({ label: t.week, value: t.open })) },
        { id: "field", name: "Field visits trend (weekly)", unit: "visits", points: FIELD.travelTrend.map((t) => ({ label: t.week, value: t.visits })) },
      ],
      honestyNote: "Cohorts with fewer than 3 customers are flagged. Two fiscal years of history are not yet in the analytics window, so seasonality is not asserted — statistically weak conclusions are not presented as facts.",
      freshness: DOMAIN_FRESHNESS.sales,
    },
  };
}

function catalogPayload(role: WorkspaceRole, scope: AnalyticsScope) {
  const s = store();
  const reports = visibleReports(role);
  const favIds = s.favorites[SESSION_USER_ID] ?? [];
  return {
    ...baseMeta(),
    datasets: DATASETS.filter((d) => d.roles.includes(role)).map((d) => ({ id: d.id, label: d.label, description: d.description, system: d.system, fields: d.fields.length, freshness: d.freshness, sensitive: Boolean(d.sensitive), defaultViz: d.defaultViz })),
    reports: reports.map((r) => ({ id: r.id, name: r.name, description: r.description, visibility: r.visibility, ownerName: r.ownerName, updatedAt: r.updatedAt, lastRun: r.lastRun, status: r.status, favorite: favIds.includes(r.id), datasetId: r.config.datasetId, viz: r.config.viz })),
    scopeNote: scope === "own" ? "You see reports you own; company-wide visibility is granted to authorized boundaries only." : null,
  };
}

function reportPayload(role: WorkspaceRole, scope: AnalyticsScope, id: string | null): Ok<Record<string, unknown>> | Err {
  const s = store();
  const report = s.reports.find((r) => r.id === id);
  if (!report) return err(404, "not_found", "Report not found.");
  const visible = role === "administrator" || report.ownerId === SESSION_USER_ID || report.visibility === "Company" || (report.visibility === "Department" && deptOf(report.ownerId) === deptOf(SESSION_USER_ID));
  if (!visible) return err(403, "not_shared", "This report is not shared with you. The server enforces report visibility.");

  // record a recent view (own history only)
  s.recent = [{ userId: SESSION_USER_ID, reportId: report.id, at: Date.now() }, ...s.recent.filter((r) => !(r.userId === SESSION_USER_ID && r.reportId === report.id))].slice(0, 12);

  const dataset = datasetById(report.config.datasetId);
  if (!dataset) return err(404, "dataset_not_found", "The report's dataset no longer exists.");
  const computed = computeDataset(role, scope, report.config);
  if (!Array.isArray(computed)) return computed;
  const result = computed[0];

  return {
    ok: true,
    data: {
      ...baseMeta(),
      report: { id: report.id, name: report.name, description: report.description, ownerName: report.ownerName, visibility: report.visibility, createdAt: report.createdAt, updatedAt: report.updatedAt, lastRun: report.lastRun, status: report.status, config: report.config, favorite: (s.favorites[SESSION_USER_ID] ?? []).includes(report.id) },
      dataset: { id: dataset.id, label: dataset.label, system: dataset.system, sourceNote: dataset.sourceNote, freshness: dataset.freshness, sensitive: Boolean(dataset.sensitive) },
      result,
      metricDefinitions: dataset.fields.map((f) => ({ field: f.id, label: f.label, description: f.description, kind: f.kind })),
      isOwner: report.ownerId === SESSION_USER_ID,
      canExport: canExport(role),
      canSchedule: canSchedule(role),
    },
  };
}

function auditPayload(role: WorkspaceRole, params: URLSearchParams) {
  const q: AuditQuery = {
    query: params.get("q") ?? undefined,
    severity: params.get("severity") ?? undefined,
    result: params.get("result") ?? undefined,
    action: params.get("action") ?? undefined,
    actor: params.get("actor") ?? undefined,
    range: params.get("range") ?? undefined,
    page: Number(params.get("page") ?? 1),
    pageSize: Math.min(25, Number(params.get("pageSize") ?? 12)),
  };
  const res = queryAudit(q, role, SESSION_USER_ID);
  const all = queryAudit({ ...q, page: 1, pageSize: 50 }, role, SESSION_USER_ID);
  const facets = {
    actions: [...new Set(all.events.map((e) => e.action))].sort().slice(0, 24),
    actors: role === "administrator" ? [...new Set(all.events.map((e) => e.actor))].sort().slice(0, 24) : [employeeName(SESSION_USER_ID)],
    severities: ["Info", "Warning", "High", "Critical"],
    results: ["Success", "Failure", "Blocked"],
    sources: [...new Set(all.events.map((e) => e.source))].sort(),
    ranges: ["24h", "7d", "30d", "90d", "all"],
  };
  return {
    ...baseMeta(),
    ...res,
    facets,
    restricted: role !== "administrator",
    scopeNote: role === "administrator" ? "Organization-wide audit view — administrator boundary." : "Server-enforced: non-administrator boundaries see their own audit activity only.",
    canExportCsv: role === "administrator",
    readonlyNote: "Audit records are read-only here — they cannot be edited from the Audit Explorer (spec §23). Sensitive values stay masked by the audit system's policy.",
    freshness: AUDIT_FRESHNESS,
  };
}

function exportsPayload(role: WorkspaceRole, scope: AnalyticsScope) {
  const s = store();
  const jobs = s.exports.filter((e) => role === "administrator" || e.requestedBy === SESSION_USER_ID);
  const eligibleReports = visibleReports(role).map((r) => ({ id: r.id, name: r.name }));
  return {
    ...baseMeta(),
    jobs,
    eligibleReports,
    datasets: DATASETS.filter((d) => d.roles.includes(role)).map((d) => ({ id: d.id, label: d.label, sensitive: Boolean(d.sensitive) })),
    policy: s.settings.exportPolicy,
    canCreate: canExport(role),
    permissionNote: canExport(role) ? null : "Export creation requires an authorized boundary (administrator or department head). Your previous export activity appears below; the server enforces export permissions.",
    scopeNote: scope === "own" ? "Export history is scoped to you." : null,
  };
}

function schedulesPayload(role: WorkspaceRole) {
  const s = store();
  const schedules = s.schedules.filter((x) => x.ownerId === SESSION_USER_ID || role === "administrator");
  const eligibleReports = visibleReports(role).map((r) => ({ id: r.id, name: r.name }));
  return {
    ...baseMeta(),
    schedules,
    eligibleReports,
    rules: s.settings.scheduledRules,
    canCreate: canSchedule(role),
    integrationNote: "Scheduling rides the existing Qubit scheduling/automation infrastructure — no second scheduling engine is created (spec §25). Every delivery is auditable in the enterprise audit trail.",
    directory: employees.map((e) => ({ name: e.name, email: e.email })),
  };
}

function settingsPayload(role: WorkspaceRole): Ok<Record<string, unknown>> | Err {
  if (role !== "administrator") {
    return err(403, "settings_admin_only", "Analytics settings are admin-only. The server enforces this restriction.");
  }
  const s = store();
  return {
    ok: true,
    data: {
      ...baseMeta(),
      settings: s.settings,
      metrics: METRIC_CATALOG,
      datasets: DATASETS.map((d) => ({ id: d.id, label: d.label, system: d.system, roles: d.roles, sensitive: Boolean(d.sensitive), fields: d.fields.length })),
      governanceNote: "Metric definitions are governed here — individual modules cannot silently redefine enterprise metrics (spec §26).",
    },
  };
}

/** GET dispatcher — returns the section payload or an error result. */
export function analyticsGet(role: WorkspaceRole, section: AnalyticsSection, params: URLSearchParams): Ok<Record<string, unknown>> | Err {
  const gate = requireAnalyticsAccess(role, `Analytics · ${section}`);
  if (!gate.ok) return gate;
  const { scope } = gate;

  switch (section) {
    case "home":
      return { ok: true, data: homePayload(role, scope) };
    case "executive": {
      const r = executivePayload(role);
      return r.ok ? { ok: true, data: r.data as Record<string, unknown> } : r;
    }
    case "sales":
      return salesAnalyticsPayload(role);
    case "finance":
      return financePayload(role);
    case "marketing":
      return marketingPayload(role);
    case "hr":
      return hrPayload(role);
    case "service":
      return servicePayload(role);
    case "inventory":
      return inventoryPayload(role);
    case "productivity":
      return { ok: true, data: productivityPayload(role, scope) };
    case "tasks":
      return { ok: true, data: tasksPayload(role, scope) };
    case "funnels": {
      const id = params.get("id") ?? "funnel-sales";
      return funnelStages(role, scope, id);
    }
    case "cohorts":
      return cohortsPayload(role, scope);
    case "catalog":
      return { ok: true, data: catalogPayload(role, scope) };
    case "report":
      return reportPayload(role, scope, params.get("id"));
    case "audit":
      return { ok: true, data: auditPayload(role, params) as unknown as Record<string, unknown> };
    case "exports":
      return { ok: true, data: exportsPayload(role, scope) };
    case "schedules":
      return { ok: true, data: schedulesPayload(role) };
    case "settings":
      return settingsPayload(role);
    case "metrics":
      return { ok: true, data: { ...baseMeta(), metrics: METRIC_CATALOG } };
    default:
      return err(400, "bad_section", "Unknown analytics section.");
  }
}

// ============================================================
// POST actions — every consequential mutation audited
// ============================================================

function touchRecent(reportId: string) {
  const s = store();
  s.recent = [{ userId: SESSION_USER_ID, reportId, at: Date.now() }, ...s.recent.filter((r) => !(r.userId === SESSION_USER_ID && r.reportId === reportId))].slice(0, 12);
}

export type AnalyticsAction =
  | { type: "report.save"; input: Record<string, unknown> }
  | { type: "report.duplicate"; input: Record<string, unknown> }
  | { type: "report.delete"; input: Record<string, unknown> }
  | { type: "report.favorite"; input: Record<string, unknown> }
  | { type: "report.run"; input: Record<string, unknown> }
  | { type: "report.preview"; input: Record<string, unknown> }
  | { type: "export.create"; input: Record<string, unknown> }
  | { type: "export.retry"; input: Record<string, unknown> }
  | { type: "schedule.save"; input: Record<string, unknown> }
  | { type: "schedule.toggle"; input: Record<string, unknown> }
  | { type: "settings.update"; input: Record<string, unknown> }
  | { type: "ai.explain"; input: Record<string, unknown> }
  | { type: "audit.exportCsv"; input: Record<string, unknown> };

function parseConfig(raw: Record<string, unknown>): SavedReportConfig | null {
  const datasetId = typeof raw.datasetId === "string" ? raw.datasetId : null;
  if (!datasetId) return null;
  const dataset = datasetById(datasetId);
  if (!dataset) return null;
  const dims = Array.isArray(raw.dimensions) ? (raw.dimensions as string[]).filter((d) => dataset.fields.some((f) => f.id === d && f.kind === "dimension")) : [];
  const measures = Array.isArray(raw.measures) ? (raw.measures as string[]).filter((m) => dataset.fields.some((f) => f.id === m && f.kind === "measure")) : [];
  const filters = Array.isArray(raw.filters)
    ? (raw.filters as { dimension: string; value: string }[]).filter((x) => x && dataset.fields.some((f) => f.id === x.dimension && f.kind === "dimension") && typeof x.value === "string")
    : [];
  const viz = ["table", "bar", "line", "area", "kpi"].includes(raw.viz as string) ? (raw.viz as SavedReportConfig["viz"]) : dataset.defaultViz;
  const sortBy =
    raw.sortBy && typeof raw.sortBy === "object" && "field" in (raw.sortBy as Record<string, unknown>)
      ? { field: String((raw.sortBy as { field: string }).field), dir: (raw.sortBy as { dir?: "asc" | "desc" }).dir === "asc" ? ("asc" as const) : ("desc" as const) }
      : null;
  return { datasetId, dimensions: dims, measures, filters, viz, sortBy };
}

export async function analyticsPost(role: WorkspaceRole, action: AnalyticsAction): Promise<Ok<Record<string, unknown>> & { message?: string } | Err> {
  const gate = requireAnalyticsAccess(role, `Analytics · ${action.type}`);
  if (!gate.ok) return gate;
  const { scope } = gate;
  const s = store();
  const input = action.input;

  switch (action.type) {
    // ---------- report builder ----------
    case "report.save": {
      const name = String(input.name ?? "").trim();
      if (name.length < 4) return err(422, "name_required", "Give the report a name (at least 4 characters).");
      if (name.length > 120) return err(422, "name_too_long", "Report names are limited to 120 characters.");
      const config = parseConfig(input);
      if (!config) return err(422, "invalid_config", "The report configuration does not reference a valid dataset.");
      const computed = computeDataset(role, scope, config);
      if (!Array.isArray(computed)) return computed;
      const visibility = (["Private", "Department", "Company"].includes(String(input.visibility)) ? input.visibility : "Private") as ReportVisibility;
      if (visibility === "Company" && role !== "administrator" && s.settings.reportGovernance.companyVisibilityRequiresAdmin) {
        return err(403, "visibility_admin_only", "Company-wide visibility requires an administrator (governed report sharing).");
      }
      const description = String(input.description ?? "").trim().slice(0, 400);
      const editId = typeof input.id === "string" ? input.id : null;
      if (editId) {
        const existing = s.reports.find((r) => r.id === editId);
        if (!existing) return err(404, "not_found", "Report not found.");
        if (existing.ownerId !== SESSION_USER_ID && role !== "administrator") return err(403, "not_owner", "Only the owner (or an administrator) can edit this report.");
        existing.name = name;
        existing.description = description;
        existing.config = config;
        existing.visibility = visibility;
        existing.updatedAt = Date.now();
        writeAudit({ actorId: SESSION_USER_ID, action: "Analytics report modified", resource: existing.name, result: "Success", severity: "Info", context: `Dataset ${config.datasetId} · ${visibility} visibility` });
        touchRecent(existing.id);
        return { ok: true, data: { report: existing }, message: "Report updated — the change is recorded in the audit trail." };
      }
      const seq = s.reports.length + 1;
      const report: SavedReport = {
        id: `rpt-u${seq}-${Math.floor(Date.now() / 1000) % 100000}`,
        name,
        description,
        config,
        ownerId: SESSION_USER_ID,
        ownerName: nameOf(SESSION_USER_ID),
        visibility,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastRun: Date.now(),
        status: "Ready",
      };
      s.reports.unshift(report);
      touchRecent(report.id);
      writeAudit({ actorId: SESSION_USER_ID, action: "Analytics report created", resource: report.name, result: "Success", severity: "Info", context: `Dataset ${config.datasetId} · ${visibility} visibility · built on the governed semantic layer` });
      return { ok: true, data: { report }, message: "Report saved — visible according to its sharing rules and recorded in the audit trail." };
    }

    case "report.duplicate": {
      const src = s.reports.find((r) => r.id === input.id);
      if (!src) return err(404, "not_found", "Report not found.");
      const visible = role === "administrator" || src.ownerId === SESSION_USER_ID || src.visibility === "Company" || (src.visibility === "Department" && deptOf(src.ownerId) === deptOf(SESSION_USER_ID));
      if (!visible) return err(403, "not_shared", "This report is not shared with you.");
      const seq = s.reports.length + 1;
      const copy: SavedReport = {
        ...structuredClone(src),
        id: `rpt-u${seq}-${Math.floor(Date.now() / 1000) % 100000}`,
        name: `${src.name} (copy)`,
        ownerId: SESSION_USER_ID,
        ownerName: nameOf(SESSION_USER_ID),
        visibility: "Private",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        favorite: false,
      };
      s.reports.unshift(copy);
      writeAudit({ actorId: SESSION_USER_ID, action: "Analytics report duplicated", resource: copy.name, result: "Success", context: `Duplicated from "${src.name}" · copy is Private to the duplicator` });
      return { ok: true, data: { report: copy }, message: "Duplicated as a Private report you own." };
    }

    case "report.delete": {
      const report = s.reports.find((r) => r.id === input.id);
      if (!report) return err(404, "not_found", "Report not found.");
      if (report.ownerId !== SESSION_USER_ID && role !== "administrator") return err(403, "not_owner", "Only the owner (or an administrator) can delete this report.");
      s.reports = s.reports.filter((r) => r.id !== report.id);
      s.schedules = s.schedules.filter((x) => x.reportId !== report.id);
      writeAudit({ actorId: SESSION_USER_ID, action: "Analytics report deleted", resource: report.name, result: "Success", severity: "Warning", context: "Dependent schedules were removed with the report" });
      return { ok: true, data: { id: report.id }, message: "Report deleted — dependent schedules were removed. Recorded in the audit trail." };
    }

    case "report.favorite": {
      const id = String(input.id ?? "");
      const report = s.reports.find((r) => r.id === id);
      if (!report) return err(404, "not_found", "Report not found.");
      const favs = s.favorites[SESSION_USER_ID] ?? [];
      const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
      s.favorites[SESSION_USER_ID] = next;
      return { ok: true, data: { favorite: next.includes(id) }, message: next.includes(id) ? "Added to favorites." : "Removed from favorites." };
    }

    case "report.run": {
      const report = s.reports.find((r) => r.id === input.id);
      if (!report) return err(404, "not_found", "Report not found.");
      const visible = role === "administrator" || report.ownerId === SESSION_USER_ID || report.visibility === "Company" || (report.visibility === "Department" && deptOf(report.ownerId) === deptOf(SESSION_USER_ID));
      if (!visible) return err(403, "not_shared", "This report is not shared with you.");
      if (report.status === "Generating") return err(409, "already_running", "This report is already generating — wait for the current run to finish.");
      report.status = "Generating";
      writeAudit({ actorId: SESSION_USER_ID, action: "Analytics report generation started", resource: report.name, result: "Success", context: `Dataset ${report.config.datasetId} · semantic-layer query at caller scope` });
      setTimeout(() => {
        const r = store().reports.find((x) => x.id === report.id);
        if (!r || r.status !== "Generating") return;
        r.status = "Ready";
        r.lastRun = Date.now();
      }, 1500);
      touchRecent(report.id);
      return { ok: true, data: { report }, message: "Report run started — the view refreshes when the run completes." };
    }

    case "report.preview": {
      const config = parseConfig(input);
      if (!config) return err(422, "invalid_config", "Choose a dataset and at least one dimension or measure.");
      const computed = computeDataset(role, scope, config);
      if (!Array.isArray(computed)) return computed;
      return { ok: true, data: { result: computed[0] } };
    }

    // ---------- exports ----------
    case "export.create": {
      if (!canExport(role)) {
        writeAudit({ actorId: SESSION_USER_ID, action: "Analytics export denied", resource: String(input.sourceId ?? "unknown"), result: "Blocked", severity: "Warning", context: "Role boundary holds no export permission" });
        return err(403, "export_not_authorized", "Your role does not hold export permission. Export authorization is enforced server-side, never in the UI.");
      }
      const format = (["CSV", "XLSX", "PDF"].includes(String(input.format)) ? input.format : "CSV") as ExportFormat;
      if (!s.settings.exportPolicy.allowedFormats.includes(format)) return err(422, "format_not_allowed", "That format is not allowed by the export policy.");
      const sourceKind = input.sourceKind === "dataset" ? "dataset" : "report";
      let sourceLabel = "";
      let datasetId = "";
      let report: SavedReport | undefined;
      if (sourceKind === "report") {
        report = s.reports.find((r) => r.id === input.sourceId);
        if (!report) return err(404, "not_found", "Report not found.");
        sourceLabel = report.name;
        datasetId = report.config.datasetId;
      } else {
        const dataset = datasetById(String(input.sourceId ?? ""));
        if (!dataset) return err(404, "not_found", "Dataset not found.");
        sourceLabel = dataset.label;
        datasetId = dataset.id;
      }
      const dataset = datasetById(datasetId);
      if (!dataset || !dataset.roles.includes(role)) return err(403, "dataset_not_authorized", "The underlying dataset is not available to your role.");
      let rowCount = 0;
      if (report) {
        const computed = computeDataset(role, scope, report.config);
        if (Array.isArray(computed)) rowCount = computed[0]?.rowCount ?? 0;
      } else {
        const computed = computeDataset(role, scope, { datasetId, dimensions: [], measures: ["count"], filters: [], viz: "table", sortBy: null });
        if (Array.isArray(computed)) rowCount = computed[0]?.rowCount ?? 0;
      }
      if (rowCount > s.settings.exportPolicy.maxRows) {
        return err(422, "export_too_large", `This export exceeds the ${s.settings.exportPolicy.maxRows.toLocaleString("en-IN")}-row policy limit. Narrow the report filters or request a high-volume approval from ${s.settings.exportPolicy.approverForHighVolume}.`);
      }
      const sensitive = Boolean(dataset.sensitive);
      let reason = typeof input.reason === "string" ? input.reason.trim() : "";
      if (sensitive && (!reason || reason.length < 10)) {
        return err(422, "reason_required", "A reason (at least 10 characters) is required to export a sensitive dataset — it is recorded in the audit trail.");
      }
      if (reason) reason = reason.slice(0, 300);
      const duplicate = s.exports.find((e) => e.datasetId === datasetId && e.format === format && ["Queued", "Processing"].includes(e.status));
      if (duplicate) {
        return err(409, "duplicate_export", `An identical ${format} export of this dataset is already ${duplicate.status.toLowerCase()} — preventing duplicate jobs.`);
      }
      const job: ExportJob = {
        id: `exp-u${s.exports.length + 1}-${Math.floor(Date.now() / 1000) % 100000}`,
        sourceKind,
        sourceId: String(input.sourceId ?? datasetId),
        sourceLabel,
        datasetId,
        format,
        rowCount,
        reason: reason || undefined,
        requestedBy: SESSION_USER_ID,
        requesterName: nameOf(SESSION_USER_ID),
        requestedAt: Date.now(),
        status: "Queued",
      };
      s.exports.unshift(job);
      writeAudit({
        actorId: SESSION_USER_ID,
        action: "Analytics data exported",
        resource: `${sourceLabel} (${format})`,
        result: "Success",
        severity: sensitive ? "Warning" : "Info",
        context: `${rowCount} rows · ${sensitive ? `sensitive dataset — reason recorded: ${reason}` : "non-sensitive dataset"}${sourceKind === "report" ? " · report-based export" : ""}`,
      });
      // async job progression — never blocks normal requests (spec §24)
      setTimeout(() => {
        const j = store().exports.find((x) => x.id === job.id);
        if (j && j.status === "Queued") j.status = "Processing";
      }, 1200);
      setTimeout(() => {
        const j = store().exports.find((x) => x.id === job.id);
        if (j && j.status === "Processing") {
          j.status = "Ready";
          j.expiresAt = Date.now() + store().settings.retention.exportLinkHours * 3_600_000;
        }
      }, 2600);
      return { ok: true, data: { job }, message: "Export queued — you will find it in the export jobs table when it completes. The request is recorded in the audit trail." };
    }

    case "export.retry": {
      const job = s.exports.find((e) => e.id === input.id);
      if (!job) return err(404, "not_found", "Export job not found.");
      if (job.requestedBy !== SESSION_USER_ID && role !== "administrator") return err(403, "not_owner", "Only the requester (or an administrator) can retry this export.");
      if (job.status !== "Failed" && job.status !== "Expired") return err(409, "not_retryable", `This export is ${job.status.toLowerCase()} — only failed or expired jobs can be retried.`);
      job.status = "Queued";
      job.failureReason = undefined;
      writeAudit({ actorId: SESSION_USER_ID, action: "Analytics export retried", resource: `${job.sourceLabel} (${job.format})`, result: "Success", context: "Safe retry — the original job had failed" });
      setTimeout(() => {
        const j = store().exports.find((x) => x.id === job.id);
        if (j && j.status === "Queued") j.status = "Processing";
      }, 1200);
      setTimeout(() => {
        const j = store().exports.find((x) => x.id === job.id);
        if (j && j.status === "Processing") {
          j.status = "Ready";
          j.expiresAt = Date.now() + store().settings.retention.exportLinkHours * 3_600_000;
        }
      }, 2600);
      return { ok: true, data: { job }, message: "Export re-queued — retry is recorded in the audit trail." };
    }

    // ---------- schedules ----------
    case "schedule.save": {
      if (!canSchedule(role)) {
        return err(403, "schedule_not_authorized", "Scheduling requires an authorized boundary (administrator or department head). The server enforces this permission.");
      }
      const report = s.reports.find((r) => r.id === input.reportId);
      if (!report) return err(404, "not_found", "Report not found.");
      const visible = role === "administrator" || report.ownerId === SESSION_USER_ID || report.visibility === "Company" || (report.visibility === "Department" && deptOf(report.ownerId) === deptOf(SESSION_USER_ID));
      if (!visible) return err(403, "not_shared", "This report is not shared with you.");
      const recipients = Array.isArray(input.recipients) ? (input.recipients as string[]).map((r) => String(r).trim()).filter(Boolean) : [];
      if (recipients.length === 0) return err(422, "recipients_required", "Add at least one recipient.");
      if (recipients.length > 10) return err(422, "too_many_recipients", "A schedule can have at most 10 recipients.");
      if (s.settings.scheduledRules.recipientsMustBeDirectory) {
        const directoryEmails = new Set(employees.map((e) => e.email.toLowerCase()));
        const directoryNames = new Set(employees.map((e) => e.name.toLowerCase()));
        for (const r of recipients) {
          const okRecipient = directoryEmails.has(r.toLowerCase()) || directoryNames.has(r.toLowerCase());
          if (!okRecipient) return err(422, "invalid_recipient", `"${r}" is not in the company directory — scheduled reports cannot be sent to unverified recipients.`);
        }
      }
      const frequency = ["Daily", "Weekly", "Monthly"].includes(String(input.frequency)) ? (input.frequency as ReportSchedule["frequency"]) : null;
      if (!frequency) return err(422, "invalid_frequency", "Frequency must be Daily, Weekly or Monthly.");
      const detail = String(input.detail ?? "").trim();
      if (detail.length < 3) return err(422, "detail_required", "Describe the schedule time (e.g. Monday 08:00 IST).");
      const channel: DeliveryChannelLike = input.channel === "In-app" ? "In-app" : "Email";
      const format = (["CSV", "XLSX", "PDF"].includes(String(input.format)) ? input.format : "PDF") as ExportFormat;
      const count = s.schedules.filter((x) => x.ownerId === SESSION_USER_ID).length;
      if (count >= s.settings.scheduledRules.maxPerUser) {
        return err(422, "schedule_limit", `You already hold ${count} schedules (policy limit ${s.settings.scheduledRules.maxPerUser}). Remove one before adding another.`);
      }
      const startOn = String(input.startOn ?? "").trim() || new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      const nextRun = `${detail} · next occurrence per the Qubit scheduler`;
      const seq = s.schedules.length + 1;
      const schedule: ReportSchedule = {
        id: `sch-u${seq}-${Math.floor(Date.now() / 1000) % 100000}`,
        reportId: report.id,
        reportName: report.name,
        recipients,
        frequency,
        detail,
        timezone: s.settings.timezone,
        channel,
        format,
        active: true,
        ownerId: SESSION_USER_ID,
        ownerName: nameOf(SESSION_USER_ID),
        createdAt: Date.now(),
        startOn,
        nextRun,
      };
      s.schedules.unshift(schedule);
      writeAudit({ actorId: SESSION_USER_ID, action: "Scheduled report created", resource: `${report.name} · ${frequency} · ${detail}`, result: "Success", severity: report.config.datasetId.startsWith("ds-finance") || report.config.datasetId.startsWith("ds-audit") ? "Warning" : "Info", context: `${recipients.length} recipient(s) · ${channel} · ${format} · recipients validated against the directory` });
      return { ok: true, data: { schedule }, message: "Schedule created — deliveries ride the Qubit scheduler and every delivery is audited." };
    }

    case "schedule.toggle": {
      const schedule = s.schedules.find((x) => x.id === input.id);
      if (!schedule) return err(404, "not_found", "Schedule not found.");
      if (schedule.ownerId !== SESSION_USER_ID && role !== "administrator") return err(403, "not_owner", "Only the owner (or an administrator) can change this schedule.");
      schedule.active = !schedule.active;
      schedule.nextRun = schedule.active ? `${schedule.detail} · next occurrence per the Qubit scheduler` : "Paused — activate to resume scheduling";
      writeAudit({ actorId: SESSION_USER_ID, action: schedule.active ? "Scheduled report activated" : "Scheduled report paused", resource: `${schedule.reportName} · ${schedule.frequency}`, result: "Success", context: `Owner ${schedule.ownerName}` });
      return { ok: true, data: { schedule }, message: schedule.active ? "Schedule activated." : "Schedule paused — no deliveries will run until reactivated." };
    }

    // ---------- settings ----------
    case "settings.update": {
      if (role !== "administrator") {
        writeAudit({ actorId: SESSION_USER_ID, action: "Analytics settings change denied", resource: Object.keys(input).join(", "), result: "Blocked", severity: "Warning", context: "Analytics settings are admin-only" });
        return err(403, "settings_admin_only", "Analytics settings are admin-only. The server rejected the change.");
      }
      const patch = input as Partial<AnalyticsSettings>;
      if (patch.retention) {
        const r = patch.retention;
        if (typeof r.auditTrailDays === "number" && (r.auditTrailDays < 30 || r.auditTrailDays > 3650)) return err(422, "invalid_retention", "Audit trail retention must be between 30 and 3650 days.");
        if (typeof r.exportLinkHours === "number" && (r.exportLinkHours < 1 || r.exportLinkHours > 168)) return err(422, "invalid_retention", "Export link expiry must be between 1 and 168 hours.");
        s.settings.retention = { ...s.settings.retention, ...r };
      }
      if (patch.exportPolicy) {
        const p = patch.exportPolicy;
        if (typeof p.maxRows === "number" && (p.maxRows < 100 || p.maxRows > 200_000)) return err(422, "invalid_export_policy", "Max export rows must be between 100 and 200,000.");
        s.settings.exportPolicy = { ...s.settings.exportPolicy, ...p };
      }
      if (patch.fiscalYearStart) {
        if (!["1 April", "1 January", "1 July", "1 October"].includes(String(patch.fiscalYearStart))) return err(422, "invalid_fiscal", "Fiscal year start must be 1 April, 1 January, 1 July or 1 October.");
        s.settings.fiscalYearStart = String(patch.fiscalYearStart);
      }
      if (patch.dashboardDefaults) s.settings.dashboardDefaults = { ...s.settings.dashboardDefaults, ...patch.dashboardDefaults };
      if (patch.reportGovernance) s.settings.reportGovernance = { ...s.settings.reportGovernance, ...patch.reportGovernance };
      s.settings.updatedAt = Date.now();
      s.settings.updatedBy = nameOf(SESSION_USER_ID);
      writeAudit({ actorId: SESSION_USER_ID, action: "Analytics settings updated", resource: Object.keys(input).join(", "), result: "Success", severity: "Warning", context: "Governed analytics configuration change — validated server-side" });
      return { ok: true, data: { settings: s.settings }, message: "Settings saved — the change is recorded in the audit trail." };
    }

    // ---------- AI assist (uses the centralized Qubit AI Platform; spec §33) ----------
    case "ai.explain": {
      // The explanation is composed ONLY from figures this caller is
      // authorized to see (they come from the caller's scoped payload),
      // so the AI can never bypass authorization. The model output is
      // validated: it must not introduce numbers that are not in the
      // authorized basis — on any failure we fall back to the
      // deterministic summary, never fabrication.
      const subject = String(input.subject ?? "kpis");
      let basis: { label: string; value: string }[] = [];
      let task = "";
      if (subject === "report") {
        const id = String(input.id ?? "");
        const r = reportPayload(role, scope, id);
        if (!r.ok) return r;
        const data = r.data as { report?: { name: string }; result?: DatasetResult; dataset?: { label: string; system: string } };
        basis = [
          { label: "Report", value: data.report?.name ?? "" },
          { label: "Dataset", value: `${data.dataset?.label ?? ""} (${data.dataset?.system ?? ""})` },
          { label: "Rows", value: String(data.result?.rowCount ?? 0) },
          ...(data.result?.rows.slice(0, 8).map((row) => ({ label: "Row", value: Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(", ") })) ?? []),
        ];
        task = "Summarize what this saved analytics report shows and what a manager should investigate next. Distinguish facts from inference. Never invent numbers.";
      } else {
        const k = homeKpis(role, scope);
        basis = k.map((x) => ({ label: x.label, value: `${x.value} (source: ${x.source})` }));
        task = "Summarize the current state of these enterprise KPIs for the caller's role and suggest one thing to investigate next. Distinguish facts from inference. Never invent numbers.";
      }

      const numbersInBasis = basis.flatMap((b) => (b.value.match(/[-+]?[0-9][0-9,.]*/g) ?? []).map((n) => n.replace(/,/g, "")));
      const UNTRUSTED = basis.map((b, i) => `[DATA ${i + 1}] ${b.label}: ${b.value}`).join("\n");
      const completion = await runCompletion(
        {
          system: `You are the Qubit One analytics assistant. You explain enterprise metrics to the signed-in user using ONLY the authorized figures provided. Rules: (1) every number you state must appear verbatim in the provided data; (2) clearly separate FACT from INFERENCE; (3) if the data is insufficient, say so; (4) never suggest accessing data the user has not been granted; (5) reply in 3-5 short sentences plus one 'Investigate next' line.`,
          messages: [
            { role: "user", content: `Authorized figures for the caller:\n${UNTRUSTED}\n\nTask: ${task}` },
          ],
          maxTokens: 400,
        },
        20_000,
      );

      let summary: string;
      let mode: "ai" | "deterministic";
      let confidence: "High" | "Medium" | "Low";
      if (completion.ok) {
        const text = completion.text.trim();
        const cited = text.match(/[-+]?[0-9][0-9,.]*/g) ?? [];
        const foreign = cited.filter((n) => !numbersInBasis.includes(n.replace(/,/g, "")) && n.length > 2);
        if (foreign.length > 0) {
          // output validation failed — deterministic fallback, never fabrication
          summary = `Authorized figures in scope: ${basis.map((b) => `${b.label} — ${b.value}`).join("; ")}. Investigate next: open the linked analytics screen for the figure furthest from its target.`;
          mode = "deterministic";
          confidence = "High";
        } else {
          summary = text;
          mode = "ai";
          confidence = "Medium";
        }
      } else {
        summary = `Authorized figures in scope: ${basis.map((b) => `${b.label} — ${b.value}`).join("; ")}. Investigate next: open the linked analytics screen for the figure furthest from its target.`;
        mode = "deterministic";
        confidence = "High";
      }

      writeAudit({
        actorId: SESSION_USER_ID,
        action: "AI explanation generated (Analytics)",
        resource: subject === "report" ? `Report ${String(input.id ?? "")}` : "Role KPI summary",
        result: "Success",
        severity: "Info",
        context: `Centralized Qubit AI Platform · ${mode === "ai" ? completion.providerLabel : "deterministic fallback"} · composed only from the caller's authorized figures`,
      });

      return {
        ok: true,
        data: {
          ai: {
            subject,
            summary,
            mode,
            confidence,
            basis,
            providerLabel: mode === "ai" ? completion.providerLabel : "Deterministic summary",
            generatedAt: Date.now(),
            note: "Composed only from figures your boundary is authorized to see; AI holds no direct database access and cannot bypass authorization.",
          },
        },
      };
    }

    case "audit.exportCsv": {
      const csv = auditCsv(role);
      if (csv === null) {
        writeAudit({ actorId: SESSION_USER_ID, action: "Audit export denied", resource: "Audit records (CSV)", result: "Blocked", severity: "Warning", context: "Audit CSV export is privileged — non-admin boundaries cannot export the audit trail" });
        return err(403, "audit_export_admin_only", "Audit CSV export is privileged — administrator boundaries only. The server enforces this.");
      }
      return { ok: true, data: { csv }, message: "Audit CSV prepared — the export is recorded in the audit trail." };
 }

    default:
      return err(400, "unknown_action", "Unsupported analytics action.");
  }
}

type DeliveryChannelLike = "Email" | "In-app";
