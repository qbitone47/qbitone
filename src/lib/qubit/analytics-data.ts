// ============================================================
// Qubit One — Analytics & Audit data model (Phase 17)
// ============================================================
// ONE centralized analytics/reporting/audit-intelligence layer
// over the authoritative existing Qubit One systems (spec §2–§3):
//
//   Sales      → sales-data / sales-server   (live store, scoped)
//   Executive  → executive-data canonical domain blocks
//   Workspace  → workspace-data (tasks, meetings, approvals)
//   Audit      → security-server audit trail (THE audit system)
//
// Analytics is NEVER a second source of truth. This module holds
// only: metric definitions (governance), the semantic dataset
// catalog (the controlled reporting layer — no SQL), funnel /
// cohort definitions, and the demo stores for saved reports,
// schedules and export jobs. Shared client + server; authorization
// lives in analytics-server.ts behind /api/analytics.
// ============================================================

import type { WorkspaceRole } from "./workspace-server";
import { WORKSPACE_NOW } from "./workspace-data";
import type { Freshness } from "./executive-data";

// ---------- reporting context (one period across every screen) ----------

export const ANALYTICS_PERIOD = {
  label: "Q3 FY27",
  window: "1 Oct – 13 Nov 2026",
  asOf: WORKSPACE_NOW,
  asOfLabel: "Friday, 13 November 2026 · 09:42 IST",
  fiscalNote: "Fiscal year April–March (FY27 = Apr 2026 – Mar 2027) · Timezone Asia/Kolkata (IST) · Currency INR (₹)",
} as const;

// ============================================================
// Metric governance (spec §6) — every important metric has ONE
// definition. Modules may not silently redefine these.
// ============================================================

export interface MetricDefinition {
  id: string;
  name: string;
  definition: string;
  calc: string;
  source: string;
  period: string;
  owner: string;
  /** metrics that are frequently confused — the UI must always label which one is shown */
  caution?: string;
}

export const METRIC_CATALOG: MetricDefinition[] = [
  {
    id: "revenue-recognized",
    name: "Revenue (Recognized)",
    definition: "Revenue recognised per accounting policy in the period — the headline financial figure.",
    calc: "Sum of recognised revenue lines from the Finance ledger for the period",
    source: "Finance ledger · Revenue module",
    period: "Fiscal period, to date",
    owner: "Finance — Priya Sharma",
    caution: "Never silently mixed with Booked or Collected values — all three are labelled wherever they appear.",
  },
  {
    id: "revenue-booked",
    name: "Revenue (Booked)",
    definition: "Contract value signed in the period (sales basis).",
    calc: "Sum of signed order/contract values with an order date inside the period",
    source: "Sales orders · Finance ledger",
    period: "Fiscal period, to date",
    owner: "Finance — Priya Sharma",
    caution: "Booked ≠ Recognized ≠ Collected. Each figure is labelled at every appearance.",
  },
  {
    id: "revenue-collected",
    name: "Revenue (Collected)",
    definition: "Cash actually received against invoices in the period.",
    calc: "Sum of settled invoice payments with a value date inside the period",
    source: "Finance ledger · Payments",
    period: "Fiscal period, to date",
    owner: "Finance — Priya Sharma",
  },
  {
    id: "pipeline-value",
    name: "Pipeline Value",
    definition: "Total value of open sales opportunities, unweighted.",
    calc: "Σ valueCr of opportunities not in a closed stage",
    source: "Sales opportunities (live sales store)",
    period: "Current",
    owner: "Sales — Meera Iyer",
  },
  {
    id: "weighted-pipeline",
    name: "Weighted Pipeline",
    definition: "Pipeline value weighted by stage probability — a forecast view, never an actual.",
    calc: "Σ valueCr × stage probability",
    source: "Sales opportunities (live sales store)",
    period: "Current",
    owner: "Sales — Meera Iyer",
    caution: "Weighted pipeline is a forecast construct and is never presented as actual revenue.",
  },
  {
    id: "win-rate",
    name: "Win Rate",
    definition: "Share of closed opportunities that were won in the period.",
    calc: "Won opportunities ÷ (Won + Lost) closed opportunities",
    source: "Sales opportunities (live sales store)",
    period: "Fiscal period, to date",
    owner: "Sales — Meera Iyer",
  },
  {
    id: "lead-conversion",
    name: "Lead Conversion",
    definition: "Share of leads converted to contacts/accounts/opportunities.",
    calc: "Converted leads ÷ total leads in scope",
    source: "Sales leads (live sales store)",
    period: "Current dataset",
    owner: "Sales — Meera Iyer",
  },
  {
    id: "cpl",
    name: "Cost per Lead (CPL)",
    definition: "Marketing spend divided by leads generated in the period.",
    calc: "Marketing spend ÷ leads",
    source: "Marketing Automation connector (currently delayed)",
    period: "QTD as of 31 Oct 2026",
    owner: "Marketing — Divya Nair",
    caution: "Source sync is delayed — November figures are incomplete, not missing.",
  },
  {
    id: "sourced-pipeline",
    name: "Marketing-sourced Pipeline",
    definition: "Open pipeline value attributed to marketing-sourced leads.",
    calc: "Σ pipeline value of opportunities whose originating lead was marketing-sourced",
    source: "Marketing attribution (where configured)",
    period: "QTD as of 31 Oct 2026",
    owner: "Marketing — Divya Nair",
    caution: "Attribution is not invented — only leads with a configured source contribute.",
  },
  {
    id: "headcount",
    name: "Headcount",
    definition: "Employees on roll at the reporting date.",
    calc: "Count of employees with status Active / Probation / Notice Period / On Leave",
    source: "HR employee registry (aggregated)",
    period: "As of 13 Nov 2026",
    owner: "HR — Neha Kulkarni",
    caution: "Aggregated, privacy-safe counts only — no individual HR data appears in analytics.",
  },
  {
    id: "attrition-annualized",
    name: "Attrition (Annualized)",
    definition: "Annualized share of employees who exited, per department and company-wide.",
    calc: "(Exits in period ÷ average headcount) × annualization factor",
    source: "HR employee registry (aggregated)",
    period: "Fiscal year to date",
    owner: "HR — Neha Kulkarni",
  },
  {
    id: "sla-compliance",
    name: "SLA Compliance",
    definition: "Share of tickets resolved within the SLA window.",
    calc: "Tickets resolved within SLA ÷ tickets resolved",
    source: "Service desk (canonical service data)",
    period: "Trailing 30 days",
    owner: "Service — Ramesh Pillai",
  },
  {
    id: "task-completion",
    name: "Task Completion Rate",
    definition: "Share of tasks completed before their due date (or on it). On-time completions ÷ tasks due so far.",
    calc: "Completed tasks with completedAt ≤ due ÷ tasks with due ≤ now",
    source: "Workspace task system (the ONE task store)",
    period: "Selected window",
    owner: "Workspace operations",
    caution: "Deliberately excludes any behavioural tracking — no activity scores, no efficiency scores.",
  },
  {
    id: "inventory-value",
    name: "Inventory Valuation",
    definition: "Financial valuation of stock on hand — owned by Finance; operational stock metrics are reported separately.",
    calc: "Σ (on-hand qty × valuation cost) per valuation policy",
    source: "Inventory valuation · Finance-aligned",
    period: "As of last stock sync",
    owner: "Finance — Priya Sharma",
    caution: "Operational stock levels and financial valuation are clearly separated (spec §16).",
  },
  {
    id: "dsso-days",
    name: "DSO (Days Sales Outstanding)",
    definition: "Average days to collect payment after invoicing.",
    calc: "Receivables ÷ recognized revenue × days in period",
    source: "Finance ledger",
    period: "Trailing 90 days",
    owner: "Finance — Priya Sharma",
  },
];

export const metricById = (id: string): MetricDefinition | undefined =>
  METRIC_CATALOG.find((m) => m.id === id);

// ============================================================
// Semantic dataset catalog — the controlled reporting layer
// (spec §21: no arbitrary production SQL; server-enforced fields,
// rows and permissions). Report Builder operates ONLY on these.
// ============================================================

export type AnalyticsFieldKind = "dimension" | "measure";
export type AnalyticsFieldType = "string" | "number" | "currency-cr" | "currency-inr" | "pct" | "count" | "date";

export interface AnalyticsField {
  id: string;
  label: string;
  kind: AnalyticsFieldKind;
  type: AnalyticsFieldType;
  description: string;
  /** sensitive fields are excluded from exports unless a reason is recorded */
  sensitive?: boolean;
}

export interface AnalyticsDataset {
  id: string;
  label: string;
  description: string;
  /** authoritative source system — lineage shown on every report */
  system: string;
  sourceNote: string;
  freshness: Freshness;
  fields: AnalyticsField[];
  roles: WorkspaceRole[];
  /** exports from sensitive datasets require a recorded reason */
  sensitive?: boolean;
  defaultViz: ReportViz;
}

export type ReportViz = "table" | "bar" | "line" | "area" | "kpi";

const f = (id: string, label: string, kind: AnalyticsFieldKind, type: AnalyticsFieldType, description: string, sensitive = false): AnalyticsField =>
  ({ id, label, kind, type, description, sensitive });

export const DATASETS: AnalyticsDataset[] = [
  {
    id: "ds-sales-pipeline",
    label: "Sales — Opportunities",
    description: "Open and closed sales opportunities from the Sales operating system, scoped to the caller's authorization.",
    system: "Sales OS · opportunities",
    sourceNote: "Read from the live sales store via the sales server — no duplicate pipeline database exists.",
    freshness: { status: "ok", updatedAt: WORKSPACE_NOW - 26 * 60_000, label: "Updated 26 min ago" },
    roles: ["administrator", "dept-head", "sales-exec"],
    defaultViz: "bar",
    fields: [
      f("stage", "Stage", "dimension", "string", "Opportunity stage"),
      f("owner", "Owner", "dimension", "string", "Salesperson owning the opportunity"),
      f("region", "Region", "dimension", "string", "Account region"),
      f("source", "Source", "dimension", "string", "Original lead source"),
      f("count", "Opportunities", "measure", "count", "Number of opportunities"),
      f("value", "Pipeline value (₹ Cr)", "measure", "currency-cr", "Sum of opportunity values"),
      f("weighted", "Weighted value (₹ Cr)", "measure", "currency-cr", "Sum of value × probability — forecast construct"),
    ],
  },
  {
    id: "ds-sales-leads",
    label: "Sales — Leads",
    description: "Leads from the Sales operating system with status, priority and source dimensions.",
    system: "Sales OS · leads",
    sourceNote: "Read from the live sales store via the sales server.",
    freshness: { status: "ok", updatedAt: WORKSPACE_NOW - 26 * 60_000, label: "Updated 26 min ago" },
    roles: ["administrator", "dept-head", "sales-exec"],
    defaultViz: "bar",
    fields: [
      f("status", "Status", "dimension", "string", "Lead status"),
      f("priority", "Priority", "dimension", "string", "Hot / Warm / Cold"),
      f("source", "Source", "dimension", "string", "Lead source"),
      f("owner", "Owner", "dimension", "string", "Lead owner"),
      f("count", "Leads", "measure", "count", "Number of leads"),
      f("value", "Estimated value (₹ Cr)", "measure", "currency-cr", "Sum of estimated values"),
    ],
  },
  {
    id: "ds-sales-orders",
    label: "Sales — Orders",
    description: "Sales orders with payment and fulfilment state — the booked-value basis.",
    system: "Sales OS · orders",
    sourceNote: "Read from the live sales store via the sales server.",
    freshness: { status: "ok", updatedAt: WORKSPACE_NOW - 26 * 60_000, label: "Updated 26 min ago" },
    roles: ["administrator", "dept-head", "sales-exec"],
    defaultViz: "bar",
    fields: [
      f("status", "Status", "dimension", "string", "Order status"),
      f("payment", "Payment state", "dimension", "string", "Unpaid / Partially Paid / Paid"),
      f("owner", "Owner", "dimension", "string", "Order owner"),
      f("count", "Orders", "measure", "count", "Number of orders"),
      f("value", "Order value (₹ Cr)", "measure", "currency-cr", "Sum of order totals — booked basis"),
    ],
  },
  {
    id: "ds-finance-budget",
    label: "Finance — Budget vs Actual",
    description: "Department budgets against actuals for the fiscal period. Finance is the financial source of truth.",
    system: "Finance · budget ledger",
    sourceNote: "Read from the canonical Finance block — analytics never recomputes financial truth.",
    freshness: { status: "ok", updatedAt: WORKSPACE_NOW - 34 * 60_000, label: "Updated 34 min ago" },
    roles: ["administrator"],
    sensitive: true,
    defaultViz: "bar",
    fields: [
      f("department", "Department", "dimension", "string", "Cost-centre department"),
      f("budget", "Budget (₹ Cr)", "measure", "currency-cr", "Approved budget for the period"),
      f("actual", "Actual (₹ Cr)", "measure", "currency-cr", "Actual spend to date"),
      f("variancePct", "Variance %", "measure", "pct", "(Actual − Budget) ÷ Budget"),
    ],
  },
  {
    id: "ds-finance-receivables",
    label: "Finance — Receivables Aging",
    description: "Overdue receivables by account and aging bucket. Sensitive financial data — restricted access.",
    system: "Finance · receivables ledger",
    sourceNote: "Read from the canonical Finance block.",
    freshness: { status: "ok", updatedAt: WORKSPACE_NOW - 34 * 60_000, label: "Updated 34 min ago" },
    roles: ["administrator"],
    sensitive: true,
    defaultViz: "table",
    fields: [
      f("account", "Account", "dimension", "string", "Customer account"),
      f("aging", "Aging bucket", "dimension", "string", "31–60 / 61–90 / 90+ days overdue"),
      f("amount", "Amount (₹ Cr)", "measure", "currency-cr", "Overdue amount"),
    ],
  },
  {
    id: "ds-people-headcount",
    label: "People — Headcount by Department",
    description: "Aggregated, privacy-safe headcount distribution. No individual HR data exists at this level.",
    system: "HR registry (aggregated)",
    sourceNote: "Aggregated counts only — the analytics layer never exposes salary, payroll, documents or candidate data.",
    freshness: { status: "ok", updatedAt: WORKSPACE_NOW - 62 * 60_000, label: "Updated 1 h ago" },
    roles: ["administrator", "hr-manager"],
    defaultViz: "bar",
    fields: [
      f("department", "Department", "dimension", "string", "Department name"),
      f("count", "Headcount", "measure", "count", "Employees on roll"),
    ],
  },
  {
    id: "ds-people-hiring",
    label: "People — Recruitment Funnel",
    description: "Aggregated recruitment funnel counts. Candidate-level data is excluded from analytics.",
    system: "HR · recruitment (aggregated)",
    sourceNote: "Aggregated funnel counts only; candidate identities never enter the analytics layer.",
    freshness: { status: "ok", updatedAt: WORKSPACE_NOW - 62 * 60_000, label: "Updated 1 h ago" },
    roles: ["administrator", "hr-manager"],
    defaultViz: "bar",
    fields: [
      f("stage", "Funnel stage", "dimension", "string", "Applied → Screened → Interviewed → Offered → Joined"),
      f("count", "Candidates", "measure", "count", "Candidates at the stage (aggregate)"),
    ],
  },
  {
    id: "ds-tasks-workspace",
    label: "Workspace — Tasks",
    description: "The ONE workspace task store — status, priority, department of the assignee. No second task database exists.",
    system: "Workspace · task system",
    sourceNote: "Read from the workspace task store, scoped to the caller's authorization.",
    freshness: { status: "live", updatedAt: WORKSPACE_NOW, label: "Live · from the workspace store" },
    roles: ["administrator", "dept-head", "hr-manager", "sales-exec", "employee"],
    defaultViz: "bar",
    fields: [
      f("status", "Status", "dimension", "string", "Task status"),
      f("priority", "Priority", "dimension", "string", "High / Medium / Low"),
      f("department", "Assignee department", "dimension", "string", "Department of the assignee"),
      f("assignee", "Assignee", "dimension", "string", "Task assignee (visible within your scope only)"),
      f("count", "Tasks", "measure", "count", "Number of tasks"),
    ],
  },
  {
    id: "ds-service-engineers",
    label: "Service — Engineer Performance",
    description: "Aggregated service engineer performance over the trailing 30 days.",
    system: "Service desk",
    sourceNote: "Read from the canonical Service block — analytics never writes to the service desk.",
    freshness: { status: "live", updatedAt: WORKSPACE_NOW - 12 * 60_000, label: "Live · updated 12 min ago" },
    roles: ["administrator", "dept-head"],
    defaultViz: "table",
    fields: [
      f("engineer", "Engineer", "dimension", "string", "Service engineer"),
      f("resolved", "Resolved (30d)", "measure", "count", "Tickets resolved in trailing 30 days"),
      f("csat", "CSAT", "measure", "number", "Average CSAT score"),
      f("slaPct", "SLA %", "measure", "pct", "SLA compliance share"),
    ],
  },
  {
    id: "ds-inventory-warehouses",
    label: "Inventory — Warehouse Value & Utilization",
    description: "Operational warehouse utilization and Finance-aligned stock valuation by warehouse.",
    system: "Inventory · warehouses",
    sourceNote: "Operational utilization from the inventory system; valuation aligned with Finance (kept separate, spec §16).",
    freshness: { status: "ok", updatedAt: WORKSPACE_NOW - 117 * 60_000, label: "Updated 07:45 IST" },
    roles: ["administrator", "dept-head"],
    defaultViz: "bar",
    fields: [
      f("warehouse", "Warehouse", "dimension", "string", "Warehouse / DC name"),
      f("location", "Location", "dimension", "string", "City / region"),
      f("utilizationPct", "Utilization %", "measure", "pct", "Space utilization"),
      f("value", "Stock value (₹ Cr)", "measure", "currency-cr", "Finance-aligned valuation"),
    ],
  },
  {
    id: "ds-marketing-channels",
    label: "Marketing — Channel Performance",
    description: "Leads, MQLs, CPL and sourced pipeline by channel. Platform-reported metrics are labelled; attribution is not invented.",
    system: "Marketing Automation connector",
    sourceNote: "Currently delayed — figures are final as of 31 Oct 2026; November is incomplete, not missing.",
    freshness: {
      status: "delayed",
      updatedAt: Date.parse("2026-10-31T23:30:00+05:30"),
      label: "Delayed — source sync since 04:00 IST",
      detail: "Marketing Automation connector is re-running its nightly sync. Figures are final as of 31 Oct; November is incomplete, not missing.",
    },
    roles: ["administrator", "dept-head", "sales-exec"],
    defaultViz: "bar",
    fields: [
      f("channel", "Channel", "dimension", "string", "Marketing channel"),
      f("leads", "Leads", "measure", "count", "Platform-reported leads"),
      f("mqls", "MQLs", "measure", "count", "Marketing-qualified leads"),
      f("cpl", "CPL (₹)", "measure", "currency-inr", "Cost per lead"),
      f("sourcedPipeline", "Sourced pipeline (₹ Cr)", "measure", "currency-cr", "Pipeline attributed where configured"),
    ],
  },
  {
    id: "ds-audit-events",
    label: "Audit — Event Counts",
    description: "Counts over the ONE enterprise audit trail, grouped by action, severity, result, actor or source.",
    system: "Enterprise Audit Log (Phase 3)",
    sourceNote: "Read-only aggregation over security-server's audit store — the Audit Explorer (281) reads the same store; no second audit database exists.",
    freshness: { status: "live", updatedAt: WORKSPACE_NOW, label: "Live · from the audit store" },
    roles: ["administrator"],
    sensitive: true,
    defaultViz: "bar",
    fields: [
      f("action", "Action", "dimension", "string", "Audited action name"),
      f("severity", "Severity", "dimension", "string", "Info / Warning / High / Critical"),
      f("result", "Result", "dimension", "string", "Success / Failure / Blocked"),
      f("actor", "Actor", "dimension", "string", "Who performed the action"),
      f("source", "Source", "dimension", "string", "Web / SSO / API origin"),
      f("count", "Events", "measure", "count", "Number of audit events"),
    ],
  },
];

export const datasetById = (id: string): AnalyticsDataset | undefined =>
  DATASETS.find((d) => d.id === id);

// ============================================================
// Funnel definitions (screen 277) — configurable stages, computed
// server-side from authoritative data. The engine is not
// hard-coded for Sales (spec §19).
// ============================================================

export interface FunnelDef {
  id: string;
  name: string;
  domain: string;
  description: string;
  stages: string[];
  roles: WorkspaceRole[];
  sourceNote: string;
}

export const FUNNELS: FunnelDef[] = [
  {
    id: "funnel-sales",
    name: "Sales Funnel",
    domain: "Sales",
    description: "Lead → Contact → Opportunity → Proposal → Negotiation → Won, computed from the live sales store at the caller's scope.",
    stages: ["Lead", "Contact", "Opportunity", "Proposal", "Negotiation", "Won"],
    roles: ["administrator", "dept-head", "sales-exec"],
    sourceNote: "Live sales store (leads, contacts, opportunities, quotations, orders) via sales-server scoping.",
  },
  {
    id: "funnel-recruitment",
    name: "Recruitment Funnel",
    domain: "HR",
    description: "Application → Screening → Interview → Offer → Joined, from the aggregated recruitment funnel.",
    stages: ["Applied", "Screened", "Interviewed", "Offered", "Joined"],
    roles: ["administrator", "hr-manager"],
    sourceNote: "Canonical HR aggregation — candidate-level records never enter analytics.",
  },
  {
    id: "funnel-service",
    name: "Service Funnel",
    domain: "Service",
    description: "Request → Ticket → Assignment → Visit → Resolution, derived from canonical service and field-operations data.",
    stages: ["Request", "Ticket", "Assignment", "Visit", "Resolution"],
    roles: ["administrator", "dept-head"],
    sourceNote: "Canonical Service + Field blocks. Stage placement between Assignment and Visit is derived from visit completion data — noted on the screen, not silently interpolated.",
  },
  {
    id: "funnel-marketing",
    name: "Marketing Funnel",
    domain: "Marketing",
    description: "Lead → MQL → SQL → Sourced pipeline. Impression/engagement are platform-reported metrics not held in this source.",
    stages: ["Lead", "MQL", "SQL", "Sourced Pipeline"],
    roles: ["administrator", "dept-head", "sales-exec"],
    sourceNote: "Canonical Marketing block (delayed source). Attribution is not invented — only configured sources contribute.",
  },
];

export const funnelById = (id: string): FunnelDef | undefined => FUNNELS.find((x) => x.id === id);

// ============================================================
// Saved reports / schedules / export jobs — demo stores seeded
// here, mutated only through analytics-server (audited).
// ============================================================

export type ReportVisibility = "Private" | "Department" | "Company";

export interface SavedReportConfig {
  datasetId: string;
  dimensions: string[];
  measures: string[];
  /** dimension:value equality filters from the builder */
  filters: { dimension: string; value: string }[];
  sortBy?: { field: string; dir: "asc" | "desc" } | null;
  viz: ReportViz;
}

export interface SavedReport {
  id: string;
  name: string;
  description: string;
  config: SavedReportConfig;
  ownerId: string;
  ownerName: string;
  visibility: ReportVisibility;
  createdAt: number;
  updatedAt: number;
  lastRun?: number;
  favorite?: boolean;
  status: "Ready" | "Generating" | "Failed";
}

export const SEED_REPORTS: SavedReport[] = [
  {
    id: "rpt-sales-stage",
    name: "Sales pipeline by stage — Q3 FY27",
    description: "Opportunity count and value grouped by pipeline stage. Built on the Sales OS opportunities dataset.",
    config: { datasetId: "ds-sales-pipeline", dimensions: ["stage"], measures: ["count", "value"], filters: [], sortBy: { field: "value", dir: "desc" }, viz: "bar" },
    ownerId: "sagar",
    ownerName: "Sagar Singh",
    visibility: "Company",
    createdAt: Date.parse("2026-11-04T10:12:00+05:30"),
    updatedAt: Date.parse("2026-11-12T16:40:00+05:30"),
    lastRun: Date.parse("2026-11-13T08:05:00+05:30"),
    favorite: true,
    status: "Ready",
  },
  {
    id: "rpt-receivables-aging",
    name: "Overdue receivables aging",
    description: "Overdue amounts by account and aging bucket. Sensitive finance dataset — administrator access only.",
    config: { datasetId: "ds-finance-receivables", dimensions: ["account", "aging"], measures: ["amount"], filters: [], sortBy: { field: "amount", dir: "desc" }, viz: "table" },
    ownerId: "priya",
    ownerName: "Priya Sharma",
    visibility: "Private",
    createdAt: Date.parse("2026-10-28T11:30:00+05:30"),
    updatedAt: Date.parse("2026-11-10T09:20:00+05:30"),
    lastRun: Date.parse("2026-11-13T07:30:00+05:30"),
    status: "Ready",
  },
  {
    id: "rpt-task-completion",
    name: "Task load by assignee department",
    description: "Open vs total tasks grouped by the assignee's department — from the one workspace task store.",
    config: { datasetId: "ds-tasks-workspace", dimensions: ["department"], measures: ["count"], filters: [], sortBy: { field: "count", dir: "desc" }, viz: "bar" },
    ownerId: "sagar",
    ownerName: "Sagar Singh",
    visibility: "Department",
    createdAt: Date.parse("2026-11-06T14:02:00+05:30"),
    updatedAt: Date.parse("2026-11-06T14:02:00+05:30"),
    lastRun: Date.parse("2026-11-12T18:45:00+05:30"),
    favorite: true,
    status: "Ready",
  },
  {
    id: "rpt-hiring-funnel",
    name: "Recruitment funnel — FY27 to date",
    description: "Aggregated candidates per funnel stage. Built on the HR recruitment dataset (aggregate-only).",
    config: { datasetId: "ds-people-hiring", dimensions: ["stage"], measures: ["count"], filters: [], sortBy: null, viz: "bar" },
    ownerId: "neha",
    ownerName: "Neha Kulkarni",
    visibility: "Private",
    createdAt: Date.parse("2026-11-02T09:15:00+05:30"),
    updatedAt: Date.parse("2026-11-02T09:15:00+05:30"),
    lastRun: Date.parse("2026-11-11T10:00:00+05:30"),
    status: "Ready",
  },
  {
    id: "rpt-channel-leads",
    name: "Marketing leads by channel — Sep–Oct 2026",
    description: "Leads, MQLs and CPL by channel. Source delayed — figures final as of 31 Oct.",
    config: { datasetId: "ds-marketing-channels", dimensions: ["channel"], measures: ["leads", "mqls", "cpl"], filters: [], sortBy: { field: "leads", dir: "desc" }, viz: "table" },
    ownerId: "divya",
    ownerName: "Divya Nair",
    visibility: "Company",
    createdAt: Date.parse("2026-11-01T12:00:00+05:30"),
    updatedAt: Date.parse("2026-11-08T15:10:00+05:30"),
    lastRun: Date.parse("2026-11-10T09:00:00+05:30"),
    status: "Ready",
  },
  {
    id: "rpt-warehouse-value",
    name: "Inventory value by warehouse",
    description: "Finance-aligned stock valuation and utilization per warehouse — operational and financial views kept labelled.",
    config: { datasetId: "ds-inventory-warehouses", dimensions: ["warehouse", "location"], measures: ["value", "utilizationPct"], filters: [], sortBy: { field: "value", dir: "desc" }, viz: "bar" },
    ownerId: "sagar",
    ownerName: "Sagar Singh",
    visibility: "Department",
    createdAt: Date.parse("2026-11-05T17:25:00+05:30"),
    updatedAt: Date.parse("2026-11-05T17:25:00+05:30"),
    lastRun: Date.parse("2026-11-12T11:30:00+05:30"),
    status: "Ready",
  },
];

export type ExportFormat = "CSV" | "XLSX" | "PDF";
export type ExportStatus = "Queued" | "Processing" | "Ready" | "Failed" | "Expired";

export interface ExportJob {
  id: string;
  /** a saved report or a raw dataset export */
  sourceKind: "report" | "dataset";
  sourceId: string;
  sourceLabel: string;
  datasetId: string;
  format: ExportFormat;
  rowCount: number;
  /** required for sensitive datasets — recorded in the audit trail */
  reason?: string;
  requestedBy: string;
  requesterName: string;
  requestedAt: number;
  status: ExportStatus;
  /** download link expiry — secure links expire (spec §24) */
  expiresAt?: number;
  failureReason?: string;
}

export const SEED_EXPORTS: ExportJob[] = [
  {
    id: "exp-1",
    sourceKind: "report",
    sourceId: "rpt-sales-stage",
    sourceLabel: "Sales pipeline by stage — Q3 FY27",
    datasetId: "ds-sales-pipeline",
    format: "XLSX",
    rowCount: 6,
    requestedBy: "sagar",
    requesterName: "Sagar Singh",
    requestedAt: Date.parse("2026-11-13T08:12:00+05:30"),
    status: "Ready",
    expiresAt: Date.parse("2026-11-13T20:12:00+05:30"),
  },
  {
    id: "exp-2",
    sourceKind: "dataset",
    sourceId: "ds-audit-events",
    sourceLabel: "Audit — Event Counts",
    datasetId: "ds-audit-events",
    format: "CSV",
    rowCount: 0,
    reason: "Quarterly security review — audit event distribution by action and severity.",
    requestedBy: "sagar",
    requesterName: "Sagar Singh",
    requestedAt: Date.parse("2026-11-13T09:30:00+05:30"),
    status: "Processing",
  },
  {
    id: "exp-3",
    sourceKind: "report",
    sourceId: "rpt-hiring-funnel",
    sourceLabel: "Recruitment funnel — FY27 to date",
    datasetId: "ds-people-hiring",
    format: "PDF",
    rowCount: 0,
    requestedBy: "neha",
    requesterName: "Neha Kulkarni",
    requestedAt: Date.parse("2026-11-12T17:44:00+05:30"),
    status: "Failed",
    failureReason: "Renderer unavailable for the PDF service at request time — retry safely from the export workspace.",
  },
];

export type ScheduleFrequency = "Daily" | "Weekly" | "Monthly";
export type DeliveryChannel = "Email" | "In-app";

export interface ReportSchedule {
  id: string;
  reportId: string;
  reportName: string;
  recipients: string[];
  frequency: ScheduleFrequency;
  /** e.g. "Monday 08:00 IST" */
  detail: string;
  timezone: string;
  channel: DeliveryChannel;
  format: ExportFormat;
  active: boolean;
  ownerId: string;
  ownerName: string;
  createdAt: number;
  startOn: string;
  endOn?: string;
  lastRun?: number;
  nextRun: string;
  lastResult?: { at: number; outcome: "Delivered" | "Failed"; detail: string };
}

export const SEED_SCHEDULES: ReportSchedule[] = [
  {
    id: "sch-1",
    reportId: "rpt-sales-stage",
    reportName: "Sales pipeline by stage — Q3 FY27",
    recipients: ["meera.iyer@qubitone.in", "rahul.mehta@qubitone.in"],
    frequency: "Weekly",
    detail: "Monday 08:00 IST",
    timezone: "Asia/Kolkata (IST)",
    channel: "Email",
    format: "XLSX",
    active: true,
    ownerId: "sagar",
    ownerName: "Sagar Singh",
    createdAt: Date.parse("2026-11-03T10:00:00+05:30"),
    startOn: "3 Nov 2026",
    lastRun: Date.parse("2026-11-09T08:00:00+05:30"),
    nextRun: "Mon 16 Nov 2026 · 08:00 IST",
    lastResult: { at: Date.parse("2026-11-09T08:00:12+05:30"), outcome: "Delivered", detail: "Delivered to 2 recipients (XLSX)" },
  },
  {
    id: "sch-2",
    reportId: "rpt-task-completion",
    reportName: "Task load by assignee department",
    recipients: ["Sagar Singh"],
    frequency: "Daily",
    detail: "18:00 IST",
    timezone: "Asia/Kolkata (IST)",
    channel: "In-app",
    format: "PDF",
    active: true,
    ownerId: "sagar",
    ownerName: "Sagar Singh",
    createdAt: Date.parse("2026-11-06T14:05:00+05:30"),
    startOn: "6 Nov 2026",
    lastRun: Date.parse("2026-11-12T18:00:05+05:30"),
    nextRun: "Fri 13 Nov 2026 · 18:00 IST",
    lastResult: { at: Date.parse("2026-11-12T18:00:05+05:30"), outcome: "Delivered", detail: "Delivered to the in-app notification centre" },
  },
  {
    id: "sch-3",
    reportId: "rpt-channel-leads",
    reportName: "Marketing leads by channel — Sep–Oct 2026",
    recipients: ["deepak.kumar@qubitone.in", "sagar.singh@qubitone.in"],
    frequency: "Monthly",
    detail: "1st working day 09:00 IST",
    timezone: "Asia/Kolkata (IST)",
    channel: "Email",
    format: "PDF",
    active: false,
    ownerId: "divya",
    ownerName: "Divya Nair",
    createdAt: Date.parse("2026-10-30T16:20:00+05:30"),
    startOn: "1 Nov 2026",
    lastRun: Date.parse("2026-11-02T09:00:10+05:30"),
    nextRun: "Paused — activate to resume scheduling",
    lastResult: { at: Date.parse("2026-11-02T09:00:10+05:30"), outcome: "Failed", detail: "Marketing source sync delayed — run skipped rather than deliver stale partial data; schedule paused pending connector recovery." },
  },
];

// ============================================================
// Analytics settings (screen 284) — governed enterprise analytics
// administration. Mutations: admin-only, validated, audited.
// ============================================================

export interface AnalyticsSettings {
  fiscalYearStart: string;
  timezone: string;
  currency: string;
  refreshPolicies: { source: string; cadence: string; note: string }[];
  retention: { auditTrailDays: number; exportLinkHours: number; savedReportVersions: number };
  exportPolicy: { maxRows: number; reasonRequiredForSensitive: boolean; allowedFormats: ExportFormat[]; approverForHighVolume: string };
  reportGovernance: { defaultVisibility: ReportVisibility; companyVisibilityRequiresAdmin: boolean; sharingNote: string };
  scheduledRules: { maxPerUser: number; recipientsMustBeDirectory: boolean; deliveryAudit: string };
  dashboardDefaults: { defaultPeriod: string; defaultLanding: string; freshnessVisibility: string };
  updatedAt: number;
  updatedBy: string;
}

export const DEFAULT_ANALYTICS_SETTINGS: AnalyticsSettings = {
  fiscalYearStart: "1 April",
  timezone: "Asia/Kolkata (IST) — UTC+05:30",
  currency: "INR (₹)",
  refreshPolicies: [
    { source: "Sales OS (live store)", cadence: "Live — per request, server-scoped", note: "Reads the sales store directly through the same enforcement as Sales screens." },
    { source: "Finance ledger", cadence: "Every 30 min", note: "Canonical Finance block; delayed refresh surfaces a freshness badge, never fake numbers." },
    { source: "Marketing Automation connector", cadence: "Nightly 02:00 IST", note: "Currently re-running after a delay — analytics shows the delayed state honestly." },
    { source: "HR registry (aggregated)", cadence: "Hourly", note: "Aggregation only; individual HR data never enters the analytics layer." },
    { source: "Service desk", cadence: "Every 15 min", note: "Canonical service block." },
    { source: "Inventory", cadence: "Every 2 h", note: "Operational metrics; valuation stays Finance-aligned." },
    { source: "Enterprise Audit Log", cadence: "Live", note: "The single audit trail written by every module." },
  ],
  retention: { auditTrailDays: 400, exportLinkHours: 12, savedReportVersions: 10 },
  exportPolicy: {
    maxRows: 50000,
    reasonRequiredForSensitive: true,
    allowedFormats: ["CSV", "XLSX", "PDF"],
    approverForHighVolume: "Administrator",
  },
  reportGovernance: {
    defaultVisibility: "Private",
    companyVisibilityRequiresAdmin: true,
    sharingNote: "Reports are Private by default. Company-wide visibility requires an administrator; Department visibility shares with the report owner's department.",
  },
  scheduledRules: {
    maxPerUser: 25,
    recipientsMustBeDirectory: true,
    deliveryAudit: "Every scheduled delivery is written to the enterprise audit trail.",
  },
  dashboardDefaults: { defaultPeriod: "Current fiscal quarter (QTD)", defaultLanding: "Analytics Home (267)", freshnessVisibility: "Freshness badge on every dataset panel" },
  updatedAt: Date.parse("2026-11-10T11:05:00+05:30"),
  updatedBy: "Sagar Singh",
};

// ---------- freshness for the workspace + audit sources ----------

export const WORKSPACE_FRESHNESS: Freshness = {
  status: "live",
  updatedAt: WORKSPACE_NOW,
  label: "Live · workspace task store",
};

export const AUDIT_FRESHNESS: Freshness = {
  status: "live",
  updatedAt: WORKSPACE_NOW,
  label: "Live · enterprise audit trail",
};
