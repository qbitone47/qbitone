// ============================================================
// Qubit One — Executive data model (Phase 5 · CEO Command Center)
// ============================================================
// ONE canonical underlying data source for every executive screen
// (spec §9 — Data Consistency): the same revenue, pipeline, cash
// and health numbers are reused by CEO Overview (59), Revenue
// Snapshot (60), Sales Command (61), Finance Snapshot (62),
// KPI Drilldown (71) and Reports (72). The CEO layer is a
// presentation/decision layer over the existing business domains —
// it never invents parallel numbers.
//
// Shared client + server. Server authorization lives in
// executive-server.ts behind /api/executive.
// ============================================================

import type { ScreenId, ScreenParams } from "./screens";
import { WORKSPACE_NOW } from "./workspace-data";

// ---------- reporting context (one period across every screen) ----------

export const EXEC_PERIOD = {
  /** Current fiscal quarter — Indian FY: Q3 = Oct–Dec */
  label: "Q3 FY27",
  window: "1 Oct – 31 Dec 2026",
  asOf: WORKSPACE_NOW,
  asOfLabel: "Friday, 13 November 2026 · 09:42 IST",
  elapsedPct: 48.6,
  /** data up to end of October is final; November is month-to-date */
  monthLabel: "November 2026 (month-to-date)",
} as const;

export type DomainId =
  | "revenue"
  | "sales"
  | "finance"
  | "people"
  | "marketing"
  | "service"
  | "inventory"
  | "field";

export type DomainStatus = "live" | "ok" | "delayed" | "stale" | "unavailable";

export interface Freshness {
  status: DomainStatus;
  /** epoch of the last successful source sync */
  updatedAt: number;
  /** human label, e.g. "Updated 18 min ago" */
  label: string;
  /** when delayed/stale — say why, never look live (spec §7) */
  detail?: string;
}

// ---------- INR helpers (values are stored in crores; 1 Cr = ₹1,00,00,000) ----------

/** ₹1.24 Cr / ₹68.0 L / ₹18,400 — a single enterprise formatting voice */
export function formatINR(cr: number): string {
  const abs = Math.abs(cr);
  if (abs >= 1) return `₹${cr.toFixed(2)} Cr`;
  if (abs >= 0.01) return `₹${(cr * 100).toFixed(cr * 100 >= 100 ? 0 : 1)} L`;
  return `₹${Math.round(cr * 1e7).toLocaleString("en-IN")}`;
}

/** For whole-rupee values (e.g. CPL) */
export function formatRupees(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

// ============================================================
// Domain freshness map — one source may be delayed without
// breaking the rest of the command center (spec §18).
// ============================================================

const min = (m: number) => WORKSPACE_NOW - m * 60_000;

export const DOMAIN_FRESHNESS: Record<DomainId, Freshness> = {
  revenue: { status: "ok", updatedAt: min(18), label: "Updated 18 min ago" },
  sales: { status: "ok", updatedAt: min(26), label: "Updated 26 min ago" },
  finance: { status: "ok", updatedAt: min(34), label: "Updated 34 min ago" },
  people: { status: "ok", updatedAt: min(62), label: "Updated 1 h ago" },
  marketing: {
    status: "delayed",
    updatedAt: Date.parse("2026-10-31T23:30:00+05:30"),
    label: "Delayed — source sync since 04:00 IST",
    detail: "Marketing Automation connector is re-running its nightly sync. Figures are final as of 31 Oct; November is incomplete, not missing.",
  },
  service: { status: "live", updatedAt: min(12), label: "Live · updated 12 min ago" },
  inventory: { status: "ok", updatedAt: Date.parse("2026-11-13T07:45:00+05:30"), label: "Updated 07:45 IST" },
  field: { status: "live", updatedAt: min(9), label: "Live · updated 9 min ago" },
};

// ============================================================
// Revenue (recognized revenue, INR crores) — canonical numbers
// ============================================================

export interface RevenuePoint {
  month: string;
  /** null = future month (not yet actual) */
  actual: number | null;
  target: number;
  forecast?: number | null;
}

export interface RevenueByUnit {
  id: string;
  name: string;
  recognized: number;
  target: number;
  trendPct: number;
}

export interface RevenueContributor {
  account: string;
  industry: string;
  owner: string;
  region: string;
  recognized: number;
  growthPct: number;
}

export interface RevenueData {
  freshness: Freshness;
  /** financial-year to date (1 Apr – 13 Nov 2026) */
  ytd: { actual: number; target: number };
  quarter: { actualToDate: number; target: number; forecast: number; elapsedPct: number };
  /** November month-to-date, three accounting definitions (spec §24) */
  mtd: { booked: number; recognized: number; collected: number; label: string };
  q2SamePoint: { actual: number; target: number };
  trend: RevenuePoint[];
  byBusinessUnit: RevenueByUnit[];
  byRegion: { region: string; recognized: number; target: number }[];
  topContributors: RevenueContributor[];
  variance: { driver: string; impact: string; detail: string }[];
  definitions: { booked: string; recognized: string; collected: string };
}

export const REVENUE: RevenueData = {
  freshness: DOMAIN_FRESHNESS.revenue,
  ytd: { actual: 12.13, target: 11.5 },
  quarter: { actualToDate: 2.3, target: 2.53, forecast: 5.12, elapsedPct: 48.6 },
  mtd: {
    booked: 0.68,
    recognized: 0.62,
    collected: 0.51,
    label: "1 – 13 Nov 2026 (month-to-date)",
  },
  q2SamePoint: { actual: 2.18, target: 2.1 },
  trend: [
    { month: "Apr", actual: 1.52, target: 1.5 },
    { month: "May", actual: 1.61, target: 1.55 },
    { month: "Jun", actual: 1.73, target: 1.6 },
    { month: "Jul", actual: 1.79, target: 1.65 },
    { month: "Aug", actual: 1.86, target: 1.7 },
    { month: "Sep", actual: 1.94, target: 1.75 },
    { month: "Oct", actual: 1.68, target: 1.75 },
    { month: "Nov", actual: null, target: 1.8, forecast: 1.74 },
    { month: "Dec", actual: null, target: 1.8, forecast: 1.7 },
  ],
  byBusinessUnit: [
    { id: "bu-enterprise", name: "Enterprise Solutions", recognized: 1.06, target: 1.1, trendPct: -11.2 },
    { id: "bu-digital", name: "Digital Services", recognized: 0.72, target: 0.85, trendPct: 8.4 },
    { id: "bu-amc", name: "Support & AMC", recognized: 0.52, target: 0.58, trendPct: 3.1 },
  ],
  byRegion: [
    { region: "West", recognized: 0.94, target: 0.95 },
    { region: "South", recognized: 0.66, target: 0.72 },
    { region: "North", recognized: 0.41, target: 0.51 },
    { region: "East", recognized: 0.29, target: 0.35 },
  ],
  topContributors: [
    { account: "Acme Manufacturing", industry: "Manufacturing", owner: "Pankaj Sharma", region: "West", recognized: 0.382, growthPct: 12.4 },
    { account: "Zenith Industries", industry: "Industrial", owner: "Meera Iyer", region: "South", recognized: 0.315, growthPct: 6.8 },
    { account: "Meridian Trend", industry: "Retail", owner: "Vikram Singh", region: "North", recognized: 0.248, growthPct: -18.2 },
    { account: "Halcyon Logistics", industry: "Logistics", owner: "Rohit Verma", region: "West", recognized: 0.198, growthPct: 9.1 },
    { account: "Orbit Retail", industry: "Retail", owner: "Vikram Singh", region: "North", recognized: 0.171, growthPct: -4.6 },
  ],
  variance: [
    {
      driver: "Two enterprise deals slipped from October to December",
      impact: "−₹0.86 Cr October recognized revenue",
      detail: "Meridian Trend platform rollout and National Retail Co full-suite rollout both moved to December after procurement delays. Both are tracked as at-risk opportunities in Sales (61).",
    },
    {
      driver: "North region underdelivery",
      impact: "−₹0.10 Cr vs regional target",
      detail: "North recognized ₹0.41 Cr against ₹0.51 Cr target; coverage and field completion in the same region are also below plan.",
    },
  ],
  definitions: {
    booked: "Contract value signed in the period (sales basis).",
    recognized: "Revenue recognised per accounting policy — the headline figure.",
    collected: "Cash actually received against invoices in the period.",
  },
};

// ============================================================
// Sales — canonical numbers (bookings basis, distinct from
// recognized revenue; both are labelled on every screen)
// ============================================================

export interface SalesStage {
  stage: string;
  count: number;
  value: number;
  weighted: number;
}

export interface Opportunity {
  id: string;
  name: string;
  account: string;
  owner: string;
  region: string;
  value: number;
  stage: string;
  closeDate: string;
  probability: number;
  risk?: string;
  slippedFrom?: string;
}

export interface SalesRegion {
  region: string;
  head: string;
  bookings: number;
  quota: number;
  pipeline: number;
  coverage: number;
  winRate: number;
}

export interface SalesData {
  freshness: Freshness;
  quarter: { bookingsToDate: number; target: number };
  pipeline: { value: number; weighted: number; coverage: number; coverageTarget: number };
  forecast: { commit: number; bestCase: number; modelForecast: number; confidencePct: number; target: number };
  metrics: { winRate: number; winRateTarget: number; avgDeal: number; cycleDays: number; cycleTarget: number; leadConversionPct: number };
  funnel: SalesStage[];
  topOpportunities: Opportunity[];
  atRisk: Opportunity[];
  regions: SalesRegion[];
}

export const SALES: SalesData = {
  freshness: DOMAIN_FRESHNESS.sales,
  quarter: { bookingsToDate: 2.41, target: 5.35 },
  pipeline: { value: 9.8, weighted: 5.6, coverage: 1.8, coverageTarget: 2.0 },
  forecast: { commit: 4.7, bestCase: 5.6, modelForecast: 5.12, confidencePct: 72, target: 5.35 },
  metrics: { winRate: 31, winRateTarget: 35, avgDeal: 0.184, cycleDays: 42, cycleTarget: 38, leadConversionPct: 3.8 },
  funnel: [
    { stage: "Discovery", count: 68, value: 4.1, weighted: 1.72 },
    { stage: "Proposal", count: 34, value: 2.65, weighted: 1.48 },
    { stage: "Negotiation", count: 19, value: 2.12, weighted: 1.49 },
    { stage: "Contracting", count: 8, value: 0.93, weighted: 0.91 },
  ],
  topOpportunities: [
    { id: "opp-acme", name: "Platform expansion — Phase 2", account: "Acme Manufacturing", owner: "Pankaj Sharma", region: "West", value: 0.84, stage: "Negotiation", closeDate: "15 Dec 2026", probability: 75 },
    { id: "opp-zenith", name: "Renewal + automation add-on", account: "Zenith Industries", owner: "Meera Iyer", region: "South", value: 0.62, stage: "Contracting", closeDate: "8 Dec 2026", probability: 85 },
    { id: "opp-orbit", name: "Digital services suite", account: "Orbit Retail", owner: "Vikram Singh", region: "North", value: 0.48, stage: "Proposal", closeDate: "22 Dec 2026", probability: 55 },
    { id: "opp-halcyon", name: "Managed services contract", account: "Halcyon Logistics", owner: "Rohit Verma", region: "West", value: 0.35, stage: "Proposal", closeDate: "18 Dec 2026", probability: 50 },
    { id: "opp-indus", name: "Compliance module pilot", account: "Indus Bank", owner: "Arvind Swamy", region: "North", value: 0.29, stage: "Discovery", closeDate: "28 Feb 2027", probability: 25 },
  ],
  atRisk: [
    {
      id: "opp-meridian", name: "Enterprise platform rollout", account: "Meridian Trend", owner: "Vikram Singh", region: "North",
      value: 0.52, stage: "Negotiation", closeDate: "18 Dec 2026", probability: 45,
      risk: "Stalled at Negotiation for 21 days — legal review of data-processing terms.", slippedFrom: "October 2026",
    },
    {
      id: "opp-nrc", name: "Full-suite rollout", account: "National Retail Co", owner: "Pankaj Sharma", region: "West",
      value: 0.34, stage: "Contracting", closeDate: "21 Dec 2026", probability: 55,
      risk: "Procurement board meets 17 Dec — signing risk if agenda slips again.", slippedFrom: "October 2026",
    },
    {
      id: "opp-spire", name: "Pilot conversion — Phase 1", account: "Spire Health", owner: "Rohit Verma", region: "West",
      value: 0.18, stage: "Proposal", closeDate: "30 Dec 2026", probability: 30,
      risk: "Executive sponsor changed on 4 Nov — re-engagement plan in progress.",
    },
  ],
  regions: [
    { region: "West", head: "Meera Iyer", bookings: 0.86, quota: 1.9, pipeline: 3.1, coverage: 1.6, winRate: 34 },
    { region: "South", head: "Meera Iyer", bookings: 0.72, quota: 1.5, pipeline: 2.7, coverage: 1.8, winRate: 33 },
    { region: "North", head: "Vikram Singh", bookings: 0.51, quota: 1.2, pipeline: 2.4, coverage: 2.0, winRate: 28 },
    { region: "East", head: "Pankaj Sharma", bookings: 0.32, quota: 0.75, pipeline: 1.6, coverage: 2.1, winRate: 29 },
  ],
};

// ============================================================
// Finance — canonical numbers
// ============================================================

export interface FinanceData {
  freshness: Freshness;
  cash: { position: number; floor: number; runwayMonths: number; trend: { month: string; value: number }[] };
  receivables: { total: number; overdue: number; dsoDays: number; dsoDeltaDays: number; overdueAccounts: { account: string; amount: number; days: number }[] };
  payables: { total: number; dueThisWeek: number };
  margins: { gross: number; grossTarget: number; net: number };
  expenses: { month: string; actual: number; budget: number }[];
  opex: { actual: number; budget: number; variancePct: number };
  budgetVariance: { department: string; budget: number; actual: number; variancePct: number }[];
  risk: { label: string; detail: string; level: "High" | "Medium" | "Low" }[];
}

export const FINANCE: FinanceData = {
  freshness: DOMAIN_FRESHNESS.finance,
  cash: {
    position: 6.84,
    floor: 5.0,
    runwayMonths: 14,
    trend: [
      { month: "Jun", value: 7.42 },
      { month: "Jul", value: 7.28 },
      { month: "Aug", value: 7.05 },
      { month: "Sep", value: 7.31 },
      { month: "Oct", value: 6.97 },
      { month: "Nov", value: 6.84 },
    ],
  },
  receivables: {
    total: 3.62,
    overdue: 0.94,
    dsoDays: 58,
    dsoDeltaDays: 6,
    overdueAccounts: [
      { account: "Meridian Trend", amount: 0.31, days: 68 },
      { account: "Orbit Retail", amount: 0.22, days: 41 },
      { account: "Spire Health", amount: 0.16, days: 35 },
      { account: "6 other accounts", amount: 0.25, days: 32 },
    ],
  },
  payables: { total: 1.87, dueThisWeek: 0.42 },
  margins: { gross: 38.2, grossTarget: 40, net: 14.6 },
  expenses: [
    { month: "May", actual: 1.08, budget: 1.05 },
    { month: "Jun", actual: 1.11, budget: 1.08 },
    { month: "Jul", actual: 1.14, budget: 1.1 },
    { month: "Aug", actual: 1.16, budget: 1.12 },
    { month: "Sep", actual: 1.18, budget: 1.14 },
    { month: "Oct", actual: 1.21, budget: 1.16 },
    { month: "Nov", actual: 0.52, budget: 0.54 },
  ],
  opex: { actual: 1.21, budget: 1.16, variancePct: 4.3 },
  budgetVariance: [
    { department: "Sales", budget: 1.8, actual: 1.86, variancePct: 3.3 },
    { department: "Service", budget: 0.9, actual: 0.94, variancePct: 4.4 },
    { department: "Marketing", budget: 0.42, actual: 0.38, variancePct: -9.5 },
    { department: "IT & Technology", budget: 0.5, actual: 0.52, variancePct: 4.0 },
    { department: "Operations", budget: 0.63, actual: 0.61, variancePct: -3.2 },
    { department: "Inventory", budget: 0.15, actual: 0.14, variancePct: -6.7 },
    { department: "HR & People", budget: 0.32, actual: 0.33, variancePct: 3.1 },
    { department: "Finance", budget: 0.28, actual: 0.29, variancePct: 3.6 },
  ],
  risk: [
    { label: "Overdue receivables concentration", detail: "₹0.94 Cr overdue — Meridian Trend alone is ₹0.31 Cr at 68 days, the same account with a pending renewal deal.", level: "High" },
    { label: "Gross margin below target", detail: "38.2% vs 40% target — discount exceptions under executive review are the main pressure.", level: "Medium" },
    { label: "Marketing spend behind plan", detail: "−9.5% budget variance may under-feed Q4 pipeline if it persists.", level: "Medium" },
  ],
};

// ============================================================
// People — aggregated only (spec: no individual sensitive HR data
// at executive level; drill-down stops at department level)
// ============================================================

export interface PeopleData {
  freshness: Freshness;
  headcount: { total: number; aprTotal: number; netAdded: number; employeesOnRoll: number };
  trend: { month: string; headcount: number; hires: number; exits: number }[];
  attrition: { annualizedPct: number; targetPct: number; byDept: { department: string; pct: number; exitsQtd: number }[] };
  hiring: { openPositions: number; offersInFlight: number; avgTimeToFillDays: number; timeToFillTarget: number; funnel: { stage: string; count: number }[] };
  attendancePct: number;
  distribution: { department: string; count: number }[];
  insights: { title: string; detail: string; level: "High" | "Medium" | "Low" }[];
}

export const PEOPLE: PeopleData = {
  freshness: DOMAIN_FRESHNESS.people,
  headcount: { total: 1245, aprTotal: 1198, netAdded: 47, employeesOnRoll: 1245 },
  trend: [
    { month: "Apr", headcount: 1198, hires: 14, exits: 6 },
    { month: "May", headcount: 1206, hires: 12, exits: 4 },
    { month: "Jun", headcount: 1212, hires: 13, exits: 5 },
    { month: "Jul", headcount: 1219, hires: 15, exits: 6 },
    { month: "Aug", headcount: 1228, hires: 15, exits: 7 },
    { month: "Sep", headcount: 1233, hires: 11, exits: 8 },
    { month: "Oct", headcount: 1240, hires: 14, exits: 9 },
    { month: "Nov", headcount: 1245, hires: 12, exits: 8 },
  ],
  attrition: {
    annualizedPct: 12.4,
    targetPct: 10,
    byDept: [
      { department: "Service", pct: 16.8, exitsQtd: 9 },
      { department: "Sales", pct: 13.1, exitsQtd: 7 },
      { department: "Operations", pct: 11.9, exitsQtd: 4 },
      { department: "Inventory", pct: 10.2, exitsQtd: 2 },
      { department: "IT & Technology", pct: 9.6, exitsQtd: 2 },
      { department: "Finance", pct: 8.9, exitsQtd: 1 },
      { department: "Marketing", pct: 8.4, exitsQtd: 1 },
      { department: "HR & People", pct: 7.2, exitsQtd: 1 },
    ],
  },
  hiring: {
    openPositions: 23,
    offersInFlight: 6,
    avgTimeToFillDays: 34,
    timeToFillTarget: 30,
    funnel: [
      { stage: "Applied", count: 486 },
      { stage: "Screened", count: 158 },
      { stage: "Interviewed", count: 64 },
      { stage: "Offered", count: 11 },
      { stage: "Joined", count: 9 },
    ],
  },
  attendancePct: 94.2,
  distribution: [
    { department: "Sales", count: 243 },
    { department: "Delivery", count: 212 },
    { department: "Service", count: 186 },
    { department: "Operations", count: 142 },
    { department: "IT & Technology", count: 96 },
    { department: "Finance", count: 87 },
    { department: "Inventory", count: 74 },
    { department: "Marketing", count: 68 },
    { department: "Support", count: 76 },
    { department: "HR & People", count: 52 },
    { department: "Executive", count: 9 },
  ],
  insights: [
    { title: "Service attrition is the outlier", detail: "16.8% annualized vs 12.4% company — 9 exits this quarter including two senior engineers on notice period. A retention review with the HR Head is recommended.", level: "High" },
    { title: "Exits are trending up while hiring is flat", detail: "Exits rose from 5 (Jun) to 9 (Oct) while monthly hires held at 11–15. Net growth is narrowing.", level: "Medium" },
    { title: "Hiring is slower than target", detail: "Time-to-fill is 34 days against a 30-day target; 23 open positions with 6 offers in flight.", level: "Medium" },
  ],
};

// ============================================================
// Marketing — figures as of 31 Oct (source sync delayed; spec §7)
// ============================================================

export interface MarketingData {
  freshness: Freshness;
  qtd: { leads: number; mql: number; sql: number; sourcedPipeline: number; spend: number; cpl: number; contributionPct: number; contributionTarget: number };
  trend: { month: string; leads: number; mql: number; final: boolean }[];
  channels: { channel: string; leads: number; mqls: number; cpl: number; sourcedPipeline: number }[];
  campaigns: { name: string; status: "Active" | "Completed"; leads: number; pipeline: number; note: string }[];
  insights: string[];
}

export const MARKETING: MarketingData = {
  freshness: DOMAIN_FRESHNESS.marketing,
  qtd: {
    leads: 1840,
    mql: 612,
    sql: 214,
    sourcedPipeline: 1.62,
    spend: 0.384,
    cpl: 2087,
    contributionPct: 24,
    contributionTarget: 30,
  },
  trend: [
    { month: "Sep", leads: 640, mql: 212, final: true },
    { month: "Oct", leads: 586, mql: 188, final: true },
    { month: "Nov", leads: 0, mql: 0, final: false },
  ],
  channels: [
    { channel: "Organic search", leads: 612, mqls: 238, cpl: 410, sourcedPipeline: 0.52 },
    { channel: "Paid media", leads: 421, mqls: 146, cpl: 1820, sourcedPipeline: 0.38 },
    { channel: "Events", leads: 388, mqls: 112, cpl: 3120, sourcedPipeline: 0.41 },
    { channel: "Referral", leads: 253, mqls: 81, cpl: 640, sourcedPipeline: 0.19 },
    { channel: "Outbound", leads: 166, mqls: 35, cpl: 2410, sourcedPipeline: 0.12 },
  ],
  campaigns: [
    { name: "Manufacturing Digital Week", status: "Completed", leads: 214, pipeline: 0.44, note: "Best performer — 31 SQLs, feeding the Acme expansion deal." },
    { name: "Q3 Enterprise Push", status: "Active", leads: 178, pipeline: 0.39, note: "On plan; concentrates on West-region accounts." },
    { name: "Festive Retail Promo", status: "Active", leads: 96, pipeline: 0.11, note: "Underperforming — CPL 38% above plan; review scheduled 20 Nov." },
  ],
  insights: [
    "Events deliver the highest pipeline per lead despite the highest CPL — enterprise deals concentrate there.",
    "Organic search is the volume engine at ₹410 per lead — one-fifth of paid CPL.",
    "November data is pending the source sync; do not read the flat trend as a demand drop.",
  ],
};

// ============================================================
// Service — canonical numbers
// ============================================================

export interface ServiceData {
  freshness: Freshness;
  tickets: { open: number; openCritical: number; resolved30d: number; backlogTrend: { week: string; open: number }[] };
  sla: { compliancePct: number; targetPct: number; breachedCritical: number };
  times: { firstResponseMin: number; responseTargetMin: number; resolutionHours: number };
  csat: { score: number; responses: number };
  criticalAccounts: { account: string; accountValue: number; issue: string; hoursOpen: number; engineer: string; slaBreached: boolean }[];
  engineers: { name: string; resolved30d: number; csat: number; slaPct: number }[];
}

export const SERVICE: ServiceData = {
  freshness: DOMAIN_FRESHNESS.service,
  tickets: {
    open: 214,
    openCritical: 9,
    resolved30d: 486,
    backlogTrend: [
      { week: "W40", open: 262 },
      { week: "W42", open: 248 },
      { week: "W44", open: 236 },
      { week: "W46", open: 229 },
      { week: "W48", open: 214 },
    ],
  },
  sla: { compliancePct: 92.4, targetPct: 95, breachedCritical: 3 },
  times: { firstResponseMin: 38, responseTargetMin: 30, resolutionHours: 6.2 },
  csat: { score: 4.42, responses: 1240 },
  criticalAccounts: [
    { account: "Meridian Trend", accountValue: 0.52, issue: "Integration sync failures after their ERP update", hoursOpen: 31, engineer: "Ramesh Pillai", slaBreached: true },
    { account: "Zenith Industries", accountValue: 0.62, issue: "Data migration rollback during add-on rollout", hoursOpen: 18, engineer: "Prakash Rao", slaBreached: true },
    { account: "Orbit Retail", accountValue: 0.48, issue: "Checkout API latency in evening peak", hoursOpen: 12, engineer: "Deepa Krishnan", slaBreached: false },
  ],
  engineers: [
    { name: "Ramesh Pillai", resolved30d: 62, csat: 4.6, slaPct: 96 },
    { name: "Prakash Rao", resolved30d: 55, csat: 4.5, slaPct: 94 },
    { name: "Deepa Krishnan", resolved30d: 51, csat: 4.4, slaPct: 93 },
    { name: "Imran Sheikh", resolved30d: 47, csat: 4.3, slaPct: 91 },
    { name: "Latha Menon", resolved30d: 44, csat: 4.7, slaPct: 95 },
  ],
};

// ============================================================
// Inventory — canonical numbers
// ============================================================

export interface InventoryData {
  freshness: Freshness;
  valueCr: number;
  skus: number;
  health: { lowStock: number; overstock: number; stockouts: number };
  movement: { month: string; inbound: number; outbound: number }[];
  dispatch: { onTimePct: number; onTimeTarget: number; blocked: number; blockedReason: string };
  returnsCr: number;
  damagedCr: number;
  warehouses: { name: string; location: string; utilizationPct: number; valueCr: number }[];
  stockoutItems: { sku: string; name: string; blockedDispatches: number; eta: string }[];
  purchasePipeline: { openPOs: number; awaitingGoods: number; valueCr: number };
}

export const INVENTORY: InventoryData = {
  freshness: DOMAIN_FRESHNESS.inventory,
  valueCr: 4.28,
  skus: 1860,
  health: { lowStock: 34, overstock: 22, stockouts: 3 },
  movement: [
    { month: "Jun", inbound: 1.02, outbound: 1.18 },
    { month: "Jul", inbound: 1.14, outbound: 1.31 },
    { month: "Aug", inbound: 1.09, outbound: 1.27 },
    { month: "Sep", inbound: 1.21, outbound: 1.38 },
    { month: "Oct", inbound: 0.96, outbound: 1.22 },
  ],
  dispatch: { onTimePct: 93.1, onTimeTarget: 97, blocked: 12, blockedReason: "12 dispatches are waiting on 3 zero-stock SKUs (see exceptions)." },
  returnsCr: 0.086,
  damagedCr: 0.031,
  warehouses: [
    { name: "Mumbai DC", location: "Mumbai", utilizationPct: 88, valueCr: 1.72 },
    { name: "Bengaluru DC", location: "Bengaluru", utilizationPct: 71, valueCr: 1.14 },
    { name: "Delhi NCR DC", location: "Delhi NCR", utilizationPct: 64, valueCr: 0.89 },
    { name: "Pune DC", location: "Pune", utilizationPct: 93, valueCr: 0.53 },
  ],
  stockoutItems: [
    { sku: "NT-4G-X2", name: "4G Router X2", blockedDispatches: 12, eta: "18 Nov 2026" },
    { sku: "NT-EG-G3", name: "Edge Gateway G3", blockedDispatches: 5, eta: "22 Nov 2026" },
    { sku: "IOT-SH-S7", name: "Sensor Hub S7", blockedDispatches: 2, eta: "16 Nov 2026" },
  ],
  purchasePipeline: { openPOs: 38, awaitingGoods: 14, valueCr: 1.06 },
};

// ============================================================
// Field Operations — canonical numbers
// ============================================================

export interface FieldData {
  freshness: Freshness;
  engineers: { active: number; total: number };
  visits: { scheduledWeek: number; completed: number; delayed: number; completionPct: number; targetPct: number };
  jobs: { unresolved: number; criticalUnresolved: number; avgResolutionDays: number };
  regions: { region: string; engineers: number; visits: number; completed: number; delayed: number; completionPct: number }[];
  travelTrend: { week: string; visits: number }[];
  exceptions: { title: string; detail: string }[];
}

export const FIELD: FieldData = {
  freshness: DOMAIN_FRESHNESS.field,
  engineers: { active: 46, total: 52 },
  visits: { scheduledWeek: 128, completed: 96, delayed: 11, completionPct: 75, targetPct: 90 },
  jobs: { unresolved: 27, criticalUnresolved: 4, avgResolutionDays: 3.8 },
  regions: [
    { region: "West", engineers: 14, visits: 38, completed: 33, delayed: 2, completionPct: 87 },
    { region: "South", engineers: 12, visits: 34, completed: 27, delayed: 3, completionPct: 79 },
    { region: "North", engineers: 11, visits: 31, completed: 18, delayed: 5, completionPct: 58 },
    { region: "East", engineers: 9, visits: 25, completed: 18, delayed: 1, completionPct: 72 },
  ],
  travelTrend: [
    { week: "W43", visits: 96 },
    { week: "W44", visits: 104 },
    { week: "W45", visits: 112 },
    { week: "W46", visits: 118 },
    { week: "W47", visits: 121 },
    { week: "W48", visits: 128 },
  ],
  exceptions: [
    { title: "North region completion at 58%", detail: "Two engineers on unplanned leave; 5 visits rescheduled this week. Regional staffing review is recommended." },
    { title: "4 critical unresolved jobs in South", detail: "Includes the Zenith Industries migration rollback — the same account as an executive approval on pricing." },
  ],
};

// ============================================================
// Executive Alerts (68) — high-signal only (spec §12)
// ============================================================

export type AlertSeverity = "Info" | "Attention" | "High" | "Critical";
export type AlertState = "New" | "Assigned" | "Investigating" | "Dismissed" | "Resolved";

export interface ExecAlert {
  id: string;
  title: string;
  domain: DomainId;
  domainLabel: string;
  severity: AlertSeverity;
  whatHappened: string;
  whenText: string;
  whyItMatters: string;
  affected: string;
  recommended: string;
  drillScreen: ScreenId;
  drillParams?: ScreenParams;
  state: AlertState;
  assignee?: string;
  raisedAt: number;
  dismissedReason?: string;
}

const at = (day: number, h: number, m: number) =>
  Date.parse(`2026-11-${String(13 + day).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`);

export const EXEC_ALERTS: ExecAlert[] = [
  {
    id: "alr-01",
    title: "October revenue missed target — first miss in six months",
    domain: "revenue",
    domainLabel: "Revenue",
    severity: "Critical",
    whatHappened: "October closed at ₹1.68 Cr against the ₹1.75 Cr target (−4%), breaking a six-month beating streak. Two enterprise deals worth ₹0.86 Cr slipped into December.",
    whenText: "Raised 2 Nov, 08:15 IST",
    whyItMatters: "The Q3 forecast has moved to ₹5.12 Cr against the ₹5.35 Cr target. If the slipped deals slip again, Q3 closes ~7% light.",
    affected: "Q3 revenue forecast · West & North regions",
    recommended: "Review the December recovery plan with the Sales Head — both slipped deals are tracked in Sales Command Center.",
    drillScreen: "revenue-snapshot",
    state: "New",
    raisedAt: at(-11, 8, 15),
  },
  {
    id: "alr-02",
    title: "Overdue receivables crossed ₹90L — Meridian Trend at 68 days",
    domain: "finance",
    domainLabel: "Finance",
    severity: "High",
    whatHappened: "Overdue receivables reached ₹0.94 Cr. Meridian Trend alone holds ₹0.31 Cr past 68 days while its renewal deal is still in negotiation.",
    whenText: "Raised 10 Nov, 09:00 IST",
    whyItMatters: "Cash position is ₹6.84 Cr and DSO has risen 6 days. Collecting before the renewal signing materially strengthens the negotiating position.",
    affected: "Cash position · DSO · Meridian Trend renewal",
    recommended: "Join the Finance–Sales collection review scheduled before month-end.",
    drillScreen: "finance-snapshot",
    state: "Assigned",
    assignee: "Kavita Joshi",
    raisedAt: at(-3, 9, 0),
  },
  {
    id: "alr-03",
    title: "3 high-value customers have critical tickets breaching SLA",
    domain: "service",
    domainLabel: "Service",
    severity: "High",
    whatHappened: "Meridian Trend (31 h), Zenith Industries (18 h) and Orbit Retail (12 h) have unresolved critical issues. Combined account value: ₹1.62 Cr.",
    whenText: "Raised 12 Nov, 16:40 IST",
    whyItMatters: "All three accounts sit inside active renewals or expansion deals. Service failures during commercial negotiations carry renewal risk.",
    affected: "Renewals & expansion pipeline · CSAT",
    recommended: "Join the Meridian Trend escalation call today; ask the Service Manager for a joint recovery plan.",
    drillScreen: "service-overview",
    state: "New",
    raisedAt: at(-1, 16, 40),
  },
  {
    id: "alr-04",
    title: "Q3 forecast confidence dropped to 72%",
    domain: "sales",
    domainLabel: "Sales",
    severity: "High",
    whatHappened: "Forecast model confidence fell from 84% to 72% week-over-week. West-region pipeline coverage is 1.6x against the 2.0x standard.",
    whenText: "Raised 12 Nov, 07:20 IST",
    whyItMatters: "At 72% confidence the realistic Q3 range widens to ₹4.7–5.6 Cr — the difference between hitting and missing the ₹5.35 Cr target.",
    affected: "Q3 sales forecast · West region pipeline",
    recommended: "Review the West pipeline and the two slipped enterprise deals in Sales Command Center.",
    drillScreen: "sales-command",
    state: "Investigating",
    raisedAt: at(-1, 7, 20),
  },
  {
    id: "alr-05",
    title: "3 SKUs at zero stock — 12 dispatches blocked",
    domain: "inventory",
    domainLabel: "Inventory",
    severity: "Attention",
    whatHappened: "4G Router X2, Edge Gateway G3 and Sensor Hub S7 are at zero stock, blocking 12 customer dispatches. POs are in transit.",
    whenText: "Raised 11 Nov, 11:05 IST",
    whyItMatters: "Dispatch on-time is 93.1% against a 97% target. Two of the blocked orders belong to accounts with active renewal conversations.",
    affected: "12 dispatches · Pune & Mumbai DCs",
    recommended: "Expedite the 4G Router X2 purchase order (ETA 18 Nov) and check partial-shipment options with the two affected accounts.",
    drillScreen: "inventory-overview",
    state: "New",
    raisedAt: at(-2, 11, 5),
  },
  {
    id: "alr-06",
    title: "Service attrition at 16.8% — 5.2 pts above company average",
    domain: "people",
    domainLabel: "People",
    severity: "Attention",
    whatHappened: "Service lost 9 people this quarter (16.8% annualized) including two senior engineers now serving notice periods.",
    whenText: "Raised 6 Nov, 14:30 IST",
    whyItMatters: "Losing senior engineers while SLA is already below target compounds delivery risk on the same accounts that are renewing.",
    affected: "Service delivery capacity · senior coverage",
    recommended: "Run the retention review with the HR Head; include the two notice-period engineers in a stay conversation.",
    drillScreen: "people-overview",
    state: "Assigned",
    assignee: "Neha Patel",
    raisedAt: at(-7, 14, 30),
  },
  {
    id: "alr-07",
    title: "Two executive decisions pending beyond SLA",
    domain: "finance",
    domainLabel: "Approvals",
    severity: "High",
    whatHappened: "The cloud infrastructure renewal (₹1.24 Cr) and the Zenith pricing exception have waited past their 3-day SLA. The pricing exception is now blocking a Contracting-stage deal.",
    whenText: "Raised 13 Nov, 08:00 IST",
    whyItMatters: "The Zenith exception gates a ₹0.62 Cr Contracting-stage deal; every waiting day compresses the December close.",
    affected: "Zenith renewal · cloud infrastructure contract",
    recommended: "Decide both in Executive Approvals today — the pricing exception needs step-up verification.",
    drillScreen: "executive-approvals",
    state: "New",
    raisedAt: at(0, 8, 0),
  },
  {
    id: "alr-08",
    title: "North region field completion at 58% this week",
    domain: "field",
    domainLabel: "Field Ops",
    severity: "Info",
    whatHappened: "North completed 18 of 31 scheduled visits (58%) against a 90% standard — two engineers on unplanned leave.",
    whenText: "Raised 13 Nov, 07:30 IST",
    whyItMatters: "Field visits in North feed both service recovery and the Meridian Trend re-engagement.",
    affected: "North region service coverage",
    recommended: "Ask the Operations Head for the regional staffing plan and a recovery schedule for the rescheduled visits.",
    drillScreen: "field-operations",
    state: "New",
    raisedAt: at(0, 7, 30),
  },
];

// ============================================================
// Executive Approvals (69) — decisions that require executive
// authority per the Approval Matrix (screen 09). Never
// frontend-only: decisions are validated server-side.
// ============================================================

export type ExecApprovalKind =
  | "Contract renewal"
  | "Exception pricing"
  | "Strategic hiring"
  | "Capital purchase"
  | "Elevated access"
  | "Major expense";

export interface ExecApproval {
  id: string;
  kind: ExecApprovalKind;
  title: string;
  requesterId: string;
  department: string;
  /** one-time value, INR crores */
  amount?: number;
  /** annualised cost, INR crores */
  annualCost?: number;
  submitted: number;
  priority: "High" | "Medium" | "Low";
  state: "Pending" | "Approved" | "Rejected" | "Changes requested";
  stage: string;
  risk: { level: "High" | "Medium" | "Low"; detail: string };
  stepUpRequired?: boolean;
  detail: string;
  rule: string;
  sla: string;
  history: { at: number; actor: string; event: string }[];
  decidedAt?: number;
  decidedBy?: string;
  decisionNote?: string;
}

export const EXEC_APPROVALS: ExecApproval[] = [
  {
    id: "eap-01",
    kind: "Contract renewal",
    title: "Cloud infrastructure annual renewal — multi-year term",
    requesterId: "arjun",
    department: "IT & Technology",
    amount: 1.24,
    submitted: at(-4, 10, 12),
    priority: "High",
    state: "Pending",
    stage: "Executive review (final stage)",
    risk: { level: "High", detail: "3-year lock-in with 180-day exit notice. Committing before the Q4 cash review reduces flexibility." },
    stepUpRequired: true,
    detail: "Renewal of primary cloud infrastructure with a 12% committed-use discount, moving from annual to 3-year term. Usage grew 31% YoY; the committed tier matches the FY28 capacity plan.",
    rule: "Contract · ≥ ₹1 Cr → Chief Executive Officer",
    sla: "3 working days · waiting 4 days",
    history: [
      { at: at(-4, 10, 12), actor: "Arjun Nair", event: "Submitted with FY28 capacity plan" },
      { at: at(-4, 11, 2), actor: "System", event: "Routed via Approval Matrix → CEO (final stage)" },
      { at: at(-3, 9, 40), actor: "Finance", event: "Budget check cleared — FY27 capex line has headroom" },
    ],
  },
  {
    id: "eap-02",
    kind: "Exception pricing",
    title: "Zenith Industries renewal — 22% discount exception",
    requesterId: "meera",
    department: "Sales",
    amount: 0.62,
    submitted: at(-2, 15, 45),
    priority: "High",
    state: "Pending",
    stage: "Executive review",
    risk: { level: "High", detail: "Reduces contract margin by 6.2 points. Gross margin is already 1.8 pts below target; comparable exceptions must not cascade." },
    stepUpRequired: true,
    detail: "Zenith (₹0.62 Cr annual value) asks for 22% against the standard 12% renewal discount, citing a competitor offer. The account has a critical SLA-breaching ticket open; the Service recovery plan is attached.",
    rule: "Pricing exception > 20% → Chief Executive Officer",
    sla: "2 working days · waiting 2 days",
    history: [
      { at: at(-2, 15, 45), actor: "Meera Iyer", event: "Submitted with competitor-offer evidence" },
      { at: at(-2, 16, 10), actor: "System", event: "Routed via Approval Matrix → CEO" },
      { at: at(-1, 10, 5), actor: "Finance", event: "Margin impact quantified — −6.2 pts on contract" },
    ],
  },
  {
    id: "eap-03",
    kind: "Strategic hiring",
    title: "VP Engineering requisition — platform organization",
    requesterId: "arjun",
    department: "IT & Technology",
    annualCost: 0.92,
    submitted: at(-5, 9, 30),
    priority: "Medium",
    state: "Pending",
    stage: "Executive review",
    risk: { level: "Medium", detail: "Adds ₹0.92 Cr annual fixed cost. Headcount plan assumed backfill first; this creates a new leadership layer." },
    detail: "New VP Engineering to own the platform roadmap across Enterprise Solutions and Digital Services. Backfill-free requisition with internal-candidate assessment attached.",
    rule: "New leadership role → Chief Executive Officer",
    sla: "5 working days · waiting 5 days",
    history: [
      { at: at(-5, 9, 30), actor: "Arjun Nair", event: "Submitted with role charter" },
      { at: at(-5, 9, 58), actor: "System", event: "Routed via Approval Matrix → CEO" },
    ],
  },
  {
    id: "eap-04",
    kind: "Capital purchase",
    title: "Warehouse automation — Pune DC sorting line",
    requesterId: "karan",
    department: "Inventory",
    amount: 0.68,
    submitted: at(-6, 12, 20),
    priority: "Medium",
    state: "Pending",
    stage: "Executive review",
    risk: { level: "Medium", detail: "Pune DC is at 93% utilization, but the payback case assumes the FY28 volume plan holding." },
    detail: "Automated sorting line for Pune DC to lift dispatch on-time from 93.1% toward the 97% standard. Payback 2.6 years at planned volumes; vendor benchmark attached.",
    rule: "Capex · ≥ ₹50 L → Chief Executive Officer",
    sla: "5 working days · waiting 6 days",
    history: [
      { at: at(-6, 12, 20), actor: "Karan Mehta", event: "Submitted with vendor benchmark and payback model" },
      { at: at(-6, 12, 55), actor: "System", event: "Routed via Approval Matrix → CEO" },
    ],
  },
  {
    id: "eap-05",
    kind: "Elevated access",
    title: "Production DB elevated access — Finance data migration window",
    requesterId: "tanvi",
    department: "Finance",
    submitted: at(-2, 11, 15),
    priority: "High",
    state: "Pending",
    stage: "Final approval (Security cleared)",
    risk: { level: "High", detail: "Grants write access to production financial data. Time-boxed and audited, but the blast radius includes the general ledger." },
    stepUpRequired: true,
    detail: "Time-boxed elevated access (72 h) for the FY27 ledger migration on 21 Nov. Security review passed (Phase 3 controls); executive sign-off is the final gate. All access is session-audited.",
    rule: "Privileged access → Security + Chief Executive Officer",
    sla: "1 working day · waiting 2 days",
    history: [
      { at: at(-2, 11, 15), actor: "Tanvi Shah", event: "Submitted with migration runbook" },
      { at: at(-2, 11, 40), actor: "System", event: "Routed via Approval Matrix → Security + CEO" },
      { at: at(-1, 17, 25), actor: "Security", event: "Cleared — compensating controls verified (audit ref recorded)" },
    ],
  },
  {
    id: "eap-06",
    kind: "Major expense",
    title: "Q3 leadership offsite — 3-day planning session",
    requesterId: "neha",
    department: "HR & People",
    amount: 0.184,
    submitted: at(-1, 14, 5),
    priority: "Low",
    state: "Pending",
    stage: "Executive review",
    risk: { level: "Low", detail: "Within the FY27 people-cost plan; timing overlaps the Q4 forecast lockdown week." },
    detail: "3-day leadership offsite (18 people) in early December for FY28 planning. Venue quotes from two vendors attached.",
    rule: "Expense · ≥ ₹10 L → Chief Executive Officer",
    sla: "5 working days · waiting 1 day",
    history: [
      { at: at(-1, 14, 5), actor: "Neha Patel", event: "Submitted with two venue quotes" },
      { at: at(-1, 14, 22), actor: "System", event: "Routed via Approval Matrix → CEO" },
    ],
  },
];

// ============================================================
// CEO AI Insights (70) — evidence-based; AI inherits the CEO's
// authorization scope and never invents facts (spec §25).
// ============================================================

export type InsightCategory =
  | "Revenue"
  | "Sales"
  | "Finance"
  | "People"
  | "Marketing"
  | "Service"
  | "Inventory"
  | "Operations"
  | "Risk"
  | "Opportunities";

export interface AiInsight {
  id: string;
  category: InsightCategory;
  title: string;
  observation: string;
  evidence: { label: string; value: string }[];
  interpretation: string;
  impact: string;
  recommendation: string;
  confidence: "High" | "Medium" | "Low";
  /** required when confidence is Low/Medium — say why (spec: communicate uncertainty) */
  confidenceNote?: string;
  affectedArea: string;
  generatedAt: number;
  dataAsOf: string;
  drillScreen?: ScreenId;
  drillParams?: ScreenParams;
  followUps: { id: string; label: string }[];
}

export const AI_INSIGHTS: AiInsight[] = [
  {
    id: "ai-01",
    category: "Revenue",
    title: "Q3 lands ~₹0.23 Cr under target unless the two slipped deals sign in December",
    observation: "October closed 4% under target and the Q3 model forecast is ₹5.12 Cr against the ₹5.35 Cr target.",
    evidence: [
      { label: "October actual vs target", value: "₹1.68 Cr vs ₹1.75 Cr (−4.0%)" },
      { label: "Q3 forecast (model)", value: "₹5.12 Cr · confidence 72%" },
      { label: "Slipped pipeline", value: "Meridian Trend ₹0.52 Cr + National Retail Co ₹0.34 Cr" },
    ],
    interpretation: "Both slipped deals are in late stages, so December recovery is plausible — but only if the Meridian legal review and the NRC procurement board hold their dates.",
    impact: "A second slip moves the Q3 miss from ~4% to ~7% and pushes ~₹0.86 Cr into Q4.",
    recommendation: "Hold a December recovery review on the two deals; tie the Zenith pricing decision (pending with you) to the renewal negotiation.",
    confidence: "High",
    affectedArea: "Revenue · Sales",
    generatedAt: Date.parse("2026-11-13T06:12:00+05:30"),
    dataAsOf: "13 Nov 2026, 09:16 IST (Sales + Finance sync)",
    drillScreen: "revenue-snapshot",
    followUps: [
      { id: "fu-review", label: "Create December recovery review" },
      { id: "fu-note", label: "Note for Sales Head" },
    ],
  },
  {
    id: "ai-02",
    category: "Risk",
    title: "Receivables risk concentrates in one account that is also in renewal",
    observation: "₹0.94 Cr of receivables are overdue; Meridian Trend holds ₹0.31 Cr of it at 68 days while its renewal deal is stalled in Negotiation.",
    evidence: [
      { label: "Overdue receivables", value: "₹0.94 Cr · DSO 58 days (+6)" },
      { label: "Meridian Trend overdue", value: "₹0.31 Cr · 68 days" },
      { label: "Same account", value: "₹0.52 Cr deal at Negotiation, stalled 21 days" },
    ],
    interpretation: "Collection leverage and negotiation leverage are coupled: collecting before signing strengthens terms, but aggressive collection during a stalled renewal risks the relationship.",
    impact: "Cash position (₹6.84 Cr) absorbs the delay, but every extra week adds ~₹0.05 Cr to the overdue balance.",
    recommendation: "Sequence first: join the escalation call (Service), then support the collection conversation led by Finance.",
    confidence: "High",
    affectedArea: "Finance · Sales · Service",
    generatedAt: Date.parse("2026-11-13T06:12:00+05:30"),
    dataAsOf: "13 Nov 2026, 09:08 IST (Finance sync)",
    drillScreen: "finance-snapshot",
    followUps: [
      { id: "fu-collection", label: "Create collection review task" },
      { id: "fu-brief", label: "Request negotiation brief" },
    ],
  },
  {
    id: "ai-03",
    category: "Service",
    title: "SLA shortfall and attrition compound on the same renewal accounts",
    observation: "SLA compliance is 92.4% vs the 95% target while Service attrition runs at 16.8%; the three critical-ticket accounts are exactly the accounts inside renewals.",
    evidence: [
      { label: "SLA compliance", value: "92.4% vs 95% target" },
      { label: "Critical tickets", value: "3 accounts · ₹1.62 Cr combined value" },
      { label: "Service attrition", value: "16.8% annualized · 2 senior engineers on notice" },
    ],
    interpretation: "This is a delivery-capacity problem, not a process problem: the same team carries the renewal accounts and has lost senior coverage.",
    impact: "Renewal risk on ₹1.62 Cr of annual value if critical issues stay open into the negotiation window.",
    recommendation: "Sequence the retention review (with HR) before the December renewals; approve backfill for the two notice-period engineers.",
    confidence: "Medium",
    confidenceNote: "Correlation is strong but causal attribution needs ticket-level analysis that sits outside executive scope.",
    affectedArea: "Service · People",
    generatedAt: Date.parse("2026-11-13T06:12:00+05:30"),
    dataAsOf: "13 Nov 2026, 09:30 IST (Service sync)",
    drillScreen: "service-overview",
    followUps: [
      { id: "fu-retention", label: "Schedule retention review" },
    ],
  },
  {
    id: "ai-04",
    category: "Marketing",
    title: "Marketing is under-spending against plan — watch Q4 pipeline feed",
    observation: "Marketing spend is 9.5% under budget while pipeline contribution is 24% vs the 30% target.",
    evidence: [
      { label: "Budget variance", value: "₹0.38 Cr spent vs ₹0.42 Cr budget (−9.5%)" },
      { label: "Pipeline contribution", value: "24% vs 30% target" },
      { label: "Best channel", value: "Events — highest pipeline per lead despite ₹3,120 CPL" },
    ],
    interpretation: "Under-spending looks disciplined but is starving Q4 pipeline; the gap concentrates in demand-gen programs, not events.",
    impact: "A sustained 10% under-spend could pull ~₹0.3–0.4 Cr of Q4 sourced pipeline.",
    recommendation: "Ask the Marketing Head to reallocate the unspent budget to Q4 demand-gen before the budget freeze on 1 Dec.",
    confidence: "Medium",
    confidenceNote: "Marketing source sync is delayed — figures are final as of 31 Oct; November may change the picture.",
    affectedArea: "Marketing · Q4 pipeline",
    generatedAt: Date.parse("2026-11-13T06:12:00+05:30"),
    dataAsOf: "31 Oct 2026 (source sync delayed since 04:00 IST)",
    drillScreen: "marketing-overview",
    followUps: [
      { id: "fu-realloc", label: "Request reallocation plan" },
    ],
  },
  {
    id: "ai-05",
    category: "People",
    title: "Exit trend is rising while hiring holds flat",
    observation: "Monthly exits rose from 5 (Jun) to 9 (Oct) while hires held at 11–15; net headcount growth is narrowing.",
    evidence: [
      { label: "Exits by month", value: "Jun 5 → Oct 9 (annualized 12.4% vs 10% target)" },
      { label: "Hires by month", value: "11–15 per month, flat" },
      { label: "Open positions", value: "23 · time-to-fill 34 days vs 30 target" },
    ],
    interpretation: "If the exit trend holds, Q4 net growth could be near zero even without a hiring freeze.",
    impact: "Delivery capacity risk concentrated in Service (see the SLA insight).",
    recommendation: "Ask HR for a leaver-reason review for the last 90 days and a hiring-plan correction.",
    confidence: "Low",
    confidenceNote: "Small-sample trend (4 months); treat directionally, not as a forecast.",
    affectedArea: "People",
    generatedAt: Date.parse("2026-11-13T06:12:00+05:30"),
    dataAsOf: "13 Nov 2026, 08:40 IST (People sync)",
    drillScreen: "people-overview",
    followUps: [
      { id: "fu-leaver", label: "Request leaver-reason review" },
    ],
  },
  {
    id: "ai-06",
    category: "Operations",
    title: "One SKU family is the single point of failure for dispatch",
    observation: "Dispatch on-time is 93.1% vs the 97% standard, and all 12 blocked dispatches trace to 3 zero-stock SKUs led by 4G Router X2.",
    evidence: [
      { label: "Blocked dispatches", value: "12 · all on 3 SKUs" },
      { label: "4G Router X2", value: "12 blocked · PO in transit, ETA 18 Nov" },
      { label: "Dispatch on-time", value: "93.1% vs 97% target" },
    ],
    interpretation: "The dispatch miss is a procurement-timing problem, not a warehouse-throughput problem — though Pune DC at 93% utilization is the second-order constraint.",
    impact: "Clearing the three SKUs recovers most of the on-time gap before month-end.",
    recommendation: "Expedite the 4G Router X2 PO and consider partial shipment on the two renewal-linked orders.",
    confidence: "High",
    affectedArea: "Inventory · Dispatch",
    generatedAt: Date.parse("2026-11-13T06:12:00+05:30"),
    dataAsOf: "13 Nov 2026, 07:45 IST (Inventory sync)",
    drillScreen: "inventory-overview",
    followUps: [
      { id: "fu-expedite", label: "Ask Inventory to expedite PO" },
    ],
  },
];

// ============================================================
// KPI catalog (71) — every executive KPI carries its definition,
// source, period and drill path (spec §8). Contributor numbers
// come from the canonical domain blocks above.
// ============================================================

export type KpiUnit = "INR-cr" | "pct" | "x" | "count" | "hours" | "days" | "min";

export interface KpiDrillLevel {
  level: string;
  entity: string;
  note: string;
  authorized: boolean;
}

export interface Kpi {
  id: string;
  name: string;
  domain: DomainId;
  domainLabel: string;
  unit: KpiUnit;
  definition: string;
  calc: string;
  source: string;
  period: string;
  kind: "Actual" | "Forecast" | "Target";
  value: number;
  target?: number;
  variancePct?: number;
  comparisonText: string;
  trendPct: number;
  direction: "up-good" | "down-good";
  status: "On Track" | "Watch" | "At Risk";
  primaryDriver: string;
  contributors: { label: string; value: number; unit: KpiUnit }[];
  drivers: { label: string; detail: string }[];
  drill: KpiDrillLevel[];
  trendSeries: { label: string; value: number; target?: number }[];
  screen: ScreenId;
}

export const KPIS: Kpi[] = [
  {
    id: "kpi-revenue",
    name: "Revenue (Recognized)",
    domain: "revenue",
    domainLabel: "Revenue",
    unit: "INR-cr",
    definition: "Revenue recognised per accounting policy in the current fiscal quarter, to date.",
    calc: "Sum of recognised revenue lines for 1 Oct – 13 Nov 2026",
    source: "Finance ledger · Revenue module",
    period: "Q3 FY27 · to date",
    kind: "Actual",
    value: 2.3,
    target: 2.53,
    variancePct: -9.1,
    comparisonText: "+5.5% vs same point in Q2",
    trendPct: -13.4,
    direction: "up-good",
    status: "At Risk",
    primaryDriver: "Two enterprise deals slipped from October to December (−₹0.86 Cr)",
    contributors: [
      { label: "Enterprise Solutions", value: 1.06, unit: "INR-cr" },
      { label: "Digital Services", value: 0.72, unit: "INR-cr" },
      { label: "Support & AMC", value: 0.52, unit: "INR-cr" },
    ],
    drivers: [
      { label: "Slipped enterprise deals", detail: "Meridian Trend (₹0.52 Cr) and National Retail Co (₹0.34 Cr) moved from October to December." },
      { label: "North region underdelivery", detail: "North recognized ₹0.41 Cr vs ₹0.51 Cr target." },
    ],
    drill: [
      { level: "Company", entity: "Qubit One Pvt Ltd", note: "Recognized revenue, Q3 FY27 to date", authorized: true },
      { level: "Business Unit", entity: "Enterprise Solutions · Digital Services · Support & AMC", note: "Target vs actual per unit", authorized: true },
      { level: "Region", entity: "West · South · North · East", note: "Recognized vs regional target", authorized: true },
      { level: "Account", entity: "Top 5 contributing accounts", note: "Acme, Zenith, Meridian Trend, Halcyon, Orbit", authorized: true },
      { level: "Contract", entity: "Contract-level detail", note: "Requires Finance authorization beyond executive summary", authorized: false },
      { level: "Invoice", entity: "Invoice-level detail", note: "Restricted — Finance ledger access only", authorized: false },
    ],
    trendSeries: [
      { label: "Apr", value: 1.52, target: 1.5 },
      { label: "May", value: 1.61, target: 1.55 },
      { label: "Jun", value: 1.73, target: 1.6 },
      { label: "Jul", value: 1.79, target: 1.65 },
      { label: "Aug", value: 1.86, target: 1.7 },
      { label: "Sep", value: 1.94, target: 1.75 },
      { label: "Oct", value: 1.68, target: 1.75 },
    ],
    screen: "revenue-snapshot",
  },
  {
    id: "kpi-pipeline",
    name: "Pipeline Coverage",
    domain: "sales",
    domainLabel: "Sales",
    unit: "x",
    definition: "Open qualified pipeline value divided by the remaining-quarter bookings target.",
    calc: "Pipeline ₹9.8 Cr ÷ remaining target ₹5.35 Cr (weighted ₹5.6 Cr)",
    source: "Sales pipeline · opportunities with validated next steps",
    period: "Q3 FY27 · current",
    kind: "Actual",
    value: 1.8,
    target: 2.0,
    variancePct: -10,
    comparisonText: "1.9x at the same point in Q2",
    trendPct: -5.3,
    direction: "up-good",
    status: "Watch",
    primaryDriver: "West region coverage at 1.6x pulls the company average down",
    contributors: [
      { label: "West", value: 1.6, unit: "x" },
      { label: "South", value: 1.8, unit: "x" },
      { label: "North", value: 2.0, unit: "x" },
      { label: "East", value: 2.1, unit: "x" },
    ],
    drivers: [
      { label: "West coverage gap", detail: "1.6x vs 2.0x — the region carries the two slipped enterprise deals." },
      { label: "Weighted quality", detail: "Weighted pipeline ₹5.6 Cr of ₹9.8 Cr gross — 57% weighting is in line with historical conversion." },
    ],
    drill: [
      { level: "Company", entity: "Qubit One Pvt Ltd", note: "Coverage 1.8x vs 2.0x standard", authorized: true },
      { level: "Region", entity: "West · South · North · East", note: "Coverage and win rate per region", authorized: true },
      { level: "Team", entity: "Inside · Field · Channel teams", note: "Team-level roll-ups", authorized: true },
      { level: "Opportunity", entity: "128 open opportunities", note: "Named opportunities with owners", authorized: true },
      { level: "Contact", entity: "Buyer contacts", note: "Restricted — contact data is outside executive scope", authorized: false },
    ],
    trendSeries: [
      { label: "W44", value: 1.9, target: 2.0 },
      { label: "W45", value: 1.95, target: 2.0 },
      { label: "W46", value: 1.87, target: 2.0 },
      { label: "W47", value: 1.84, target: 2.0 },
      { label: "W48", value: 1.8, target: 2.0 },
    ],
    screen: "sales-command",
  },
  {
    id: "kpi-cash",
    name: "Cash Position",
    domain: "finance",
    domainLabel: "Finance",
    unit: "INR-cr",
    definition: "Total cash and equivalents across all operating accounts, as of the last ledger close.",
    calc: "Closing balance 13 Nov 2026 · runway = cash ÷ avg monthly net burn",
    source: "Finance ledger · Treasury",
    period: "As of 13 Nov 2026",
    kind: "Actual",
    value: 6.84,
    target: 5.0,
    comparisonText: "−₹0.13 Cr vs 31 Oct",
    trendPct: -1.9,
    direction: "up-good",
    status: "On Track",
    primaryDriver: "Collections timing — overdue receivables at ₹0.94 Cr",
    contributors: [
      { label: "Operating accounts", value: 5.11, unit: "INR-cr" },
      { label: "Deposit laddering", value: 1.73, unit: "INR-cr" },
    ],
    drivers: [
      { label: "Collections timing", detail: "₹0.94 Cr overdue receivables; Meridian Trend ₹0.31 Cr at 68 days." },
      { label: "Runway comfortable", detail: "14 months of runway against the ₹5.0 Cr floor policy." },
    ],
    drill: [
      { level: "Company", entity: "Qubit One Pvt Ltd", note: "₹6.84 Cr total, 14-month runway", authorized: true },
      { level: "Account group", entity: "Operating · deposits", note: "Split across account groups", authorized: true },
      { level: "Ledger account", entity: "Bank-level detail", note: "Requires Finance (Treasury) authorization", authorized: false },
    ],
    trendSeries: [
      { label: "Jun", value: 7.42 },
      { label: "Jul", value: 7.28 },
      { label: "Aug", value: 7.05 },
      { label: "Sep", value: 7.31 },
      { label: "Oct", value: 6.97 },
      { label: "Nov", value: 6.84 },
    ],
    screen: "finance-snapshot",
  },
  {
    id: "kpi-sla",
    name: "SLA Compliance",
    domain: "service",
    domainLabel: "Service",
    unit: "pct",
    definition: "Share of tickets resolved within the contractual SLA window over the last 30 days.",
    calc: "Resolved-within-SLA ÷ resolved total, 14 Oct – 13 Nov",
    source: "Service desk · SLA engine",
    period: "Last 30 days",
    kind: "Actual",
    value: 92.4,
    target: 95,
    variancePct: -2.7,
    comparisonText: "−1.1 pts vs previous 30 days",
    trendPct: -1.1,
    direction: "up-good",
    status: "Watch",
    primaryDriver: "Critical tickets on three renewal accounts breach SLA",
    contributors: [
      { label: "P1 critical", value: 86.2, unit: "pct" },
      { label: "P2 high", value: 91.8, unit: "pct" },
      { label: "P3 standard", value: 94.6, unit: "pct" },
    ],
    drivers: [
      { label: "Renewal-account load", detail: "Meridian Trend, Zenith, Orbit carry long-running critical issues." },
      { label: "Senior coverage gap", detail: "Two senior engineers on notice period compress escalation capacity." },
    ],
    drill: [
      { level: "Company", entity: "Qubit One Pvt Ltd", note: "92.4% last 30 days", authorized: true },
      { level: "Priority", entity: "P1 · P2 · P3", note: "Compliance per priority class", authorized: true },
      { level: "Account", entity: "Critical accounts", note: "Named accounts with open criticals", authorized: true },
      { level: "Ticket", entity: "Ticket-level detail", note: "Requires Service Manager authorization", authorized: false },
    ],
    trendSeries: [
      { label: "W44", value: 93.8, target: 95 },
      { label: "W45", value: 93.1, target: 95 },
      { label: "W46", value: 92.9, target: 95 },
      { label: "W47", value: 92.6, target: 95 },
      { label: "W48", value: 92.4, target: 95 },
    ],
    screen: "service-overview",
  },
  {
    id: "kpi-attrition",
    name: "Annualized Attrition",
    domain: "people",
    domainLabel: "People",
    unit: "pct",
    definition: "Rolling 12-month exits as a share of average headcount, company-wide.",
    calc: "Exits (rolling 12 m) ÷ average headcount × 100",
    source: "HR core · employee lifecycle (screen 06)",
    period: "Rolling 12 months",
    kind: "Actual",
    value: 12.4,
    target: 10,
    variancePct: 24,
    comparisonText: "+1.8 pts vs previous quarter",
    trendPct: 17,
    direction: "down-good",
    status: "At Risk",
    primaryDriver: "Service department at 16.8% — 9 exits this quarter",
    contributors: [
      { label: "Service", value: 16.8, unit: "pct" },
      { label: "Sales", value: 13.1, unit: "pct" },
      { label: "Operations", value: 11.9, unit: "pct" },
      { label: "Other departments", value: 8.6, unit: "pct" },
    ],
    drivers: [
      { label: "Service concentration", detail: "9 Service exits this quarter including two senior engineers." },
      { label: "Exit trend rising", detail: "Monthly exits 5 → 9 between June and October." },
    ],
    drill: [
      { level: "Company", entity: "Qubit One Pvt Ltd", note: "12.4% annualized", authorized: true },
      { level: "Department", entity: "All departments", note: "Attrition by department (aggregated)", authorized: true },
      { level: "Individual leaver", entity: "Leaver records", note: "Restricted — individual HR data stays in HR systems", authorized: false },
    ],
    trendSeries: [
      { label: "Q1", value: 10.2, target: 10 },
      { label: "Q2", value: 10.6, target: 10 },
      { label: "Jul", value: 11.2, target: 10 },
      { label: "Aug", value: 11.8, target: 10 },
      { label: "Sep", value: 12.1, target: 10 },
      { label: "Oct", value: 12.4, target: 10 },
    ],
    screen: "people-overview",
  },
  {
    id: "kpi-mkt",
    name: "Marketing Pipeline Contribution",
    domain: "marketing",
    domainLabel: "Marketing",
    unit: "pct",
    definition: "Share of qualified pipeline sourced by marketing programs in the quarter.",
    calc: "Marketing-sourced pipeline ₹1.62 Cr ÷ total qualified pipeline created in Q3",
    source: "Marketing automation · attribution model v3",
    period: "Q3 FY27 · to 31 Oct",
    kind: "Actual",
    value: 24,
    target: 30,
    variancePct: -20,
    comparisonText: "26% at the same point in Q2",
    trendPct: -7.7,
    direction: "up-good",
    status: "Watch",
    primaryDriver: "Demand-gen programs under-spent (−9.5% budget variance)",
    contributors: [
      { label: "Organic search", value: 0.52, unit: "INR-cr" },
      { label: "Events", value: 0.41, unit: "INR-cr" },
      { label: "Paid media", value: 0.38, unit: "INR-cr" },
      { label: "Referral + outbound", value: 0.31, unit: "INR-cr" },
    ],
    drivers: [
      { label: "Demand-gen under-spend", detail: "−9.5% budget variance starves Q4 pipeline feed." },
      { label: "Source sync delayed", detail: "November figures pending — read trend against 31 Oct baseline." },
    ],
    drill: [
      { level: "Company", entity: "Qubit One Pvt Ltd", note: "24% contribution, ₹1.62 Cr sourced", authorized: true },
      { level: "Channel", entity: "5 channels", note: "Leads, MQLs, CPL, pipeline per channel", authorized: true },
      { level: "Campaign", entity: "Named campaigns", note: "Campaign performance roll-up", authorized: true },
      { level: "Lead", entity: "Lead-level detail", note: "Restricted — lead records sit in the Marketing system", authorized: false },
    ],
    trendSeries: [
      { label: "Jul", value: 27, target: 30 },
      { label: "Aug", value: 26, target: 30 },
      { label: "Sep", value: 25, target: 30 },
      { label: "Oct", value: 24, target: 30 },
    ],
    screen: "marketing-overview",
  },
  {
    id: "kpi-dispatch",
    name: "Dispatch On-Time",
    domain: "inventory",
    domainLabel: "Inventory",
    unit: "pct",
    definition: "Dispatches shipped within the promised window over the last 30 days.",
    calc: "On-time dispatches ÷ total dispatches, 14 Oct – 13 Nov",
    source: "Inventory · dispatch engine",
    period: "Last 30 days",
    kind: "Actual",
    value: 93.1,
    target: 97,
    variancePct: -4,
    comparisonText: "−0.8 pts vs previous 30 days",
    trendPct: -0.9,
    direction: "up-good",
    status: "Watch",
    primaryDriver: "All blocked dispatches trace to 3 zero-stock SKUs",
    contributors: [
      { label: "Mumbai DC", value: 94.2, unit: "pct" },
      { label: "Bengaluru DC", value: 94.0, unit: "pct" },
      { label: "Delhi NCR DC", value: 93.5, unit: "pct" },
      { label: "Pune DC", value: 90.1, unit: "pct" },
    ],
    drivers: [
      { label: "Stockout concentration", detail: "12 blocked dispatches on 4G Router X2, Edge Gateway G3, Sensor Hub S7." },
      { label: "Pune utilization", detail: "93% utilization slows pick-pack at the most affected DC." },
    ],
    drill: [
      { level: "Company", entity: "Qubit One Pvt Ltd", note: "93.1% last 30 days", authorized: true },
      { level: "Warehouse", entity: "4 DCs", note: "On-time per distribution center", authorized: true },
      { level: "SKU", entity: "Blocked SKUs", note: "Named SKUs with ETAs", authorized: true },
      { level: "Order", entity: "Order-level detail", note: "Requires Inventory Manager authorization", authorized: false },
    ],
    trendSeries: [
      { label: "W44", value: 94.6, target: 97 },
      { label: "W45", value: 94.1, target: 97 },
      { label: "W46", value: 93.8, target: 97 },
      { label: "W47", value: 93.4, target: 97 },
      { label: "W48", value: 93.1, target: 97 },
    ],
    screen: "inventory-overview",
  },
  {
    id: "kpi-field",
    name: "Field Visit Completion",
    domain: "field",
    domainLabel: "Field Ops",
    unit: "pct",
    definition: "Completed field visits as a share of scheduled visits this week.",
    calc: "Completed 96 ÷ scheduled 128 visits (week W48)",
    source: "Field operations · visit engine",
    period: "Current week (W48)",
    kind: "Actual",
    value: 75,
    target: 90,
    variancePct: -16.7,
    comparisonText: "84% in the previous week",
    trendPct: -10.7,
    direction: "up-good",
    status: "At Risk",
    primaryDriver: "North region at 58% — two engineers on unplanned leave",
    contributors: [
      { label: "West", value: 87, unit: "pct" },
      { label: "South", value: 79, unit: "pct" },
      { label: "East", value: 72, unit: "pct" },
      { label: "North", value: 58, unit: "pct" },
    ],
    drivers: [
      { label: "North staffing gap", detail: "Two engineers on unplanned leave; 5 visits rescheduled." },
      { label: "Critical job load", detail: "4 critical unresolved jobs pull senior engineers off scheduled visits." },
    ],
    drill: [
      { level: "Company", entity: "Qubit One Pvt Ltd", note: "75% this week vs 90% standard", authorized: true },
      { level: "Region", entity: "West · South · North · East", note: "Completion and delays per region", authorized: true },
      { level: "Engineer", entity: "46 active engineers", note: "Visit counts per engineer", authorized: true },
      { level: "Visit", entity: "Visit-level detail", note: "Customer-identifying detail is restricted at executive level", authorized: false },
    ],
    trendSeries: [
      { label: "W44", value: 84, target: 90 },
      { label: "W45", value: 86, target: 90 },
      { label: "W46", value: 83, target: 90 },
      { label: "W47", value: 84, target: 90 },
      { label: "W48", value: 75, target: 90 },
    ],
    screen: "field-operations",
  },
];

// ============================================================
// Executive Reports (72) — reuse the analytics/reporting notion;
// generation and export are audited server-side (spec §20).
// ============================================================

export type ReportStatus = "Ready" | "Generating" | "Failed" | "Scheduled";

export interface ExecReport {
  id: string;
  title: string;
  category: string;
  period: string;
  ownerId: string;
  lastGenerated?: number;
  status: ReportStatus;
  schedule: string;
  format: "PDF" | "XLSX" | "PDF + XLSX";
  recipients: string[];
  description: string;
  /** optional note about source data quality (e.g. delayed source) */
  dataNote?: string;
}

export const EXEC_REPORTS: ExecReport[] = [
  {
    id: "rpt-exec-pack",
    title: "Monthly Executive Pack — Company Performance",
    category: "Company Performance",
    period: "October 2026",
    ownerId: "sagar",
    lastGenerated: Date.parse("2026-11-13T06:30:00+05:30"),
    status: "Ready",
    schedule: "Monthly · 1st working day 06:30",
    format: "PDF + XLSX",
    recipients: ["Board pack", "Sagar Singh", "Priya Sharma"],
    description: "The consolidated monthly view: revenue, pipeline, cash, service, people and operations with variance commentary.",
  },
  {
    id: "rpt-revenue-detail",
    title: "Revenue Detail — Recognized vs Booked vs Collected",
    category: "Revenue",
    period: "Q3 FY27 · to date",
    ownerId: "priya",
    lastGenerated: Date.parse("2026-11-12T18:15:00+05:30"),
    status: "Ready",
    schedule: "Monthly · 13th 18:00",
    format: "XLSX",
    recipients: ["Sagar Singh", "Priya Sharma", "Kavita Joshi"],
    description: "Ledger-grade revenue detail with the three accounting definitions reconciled per business unit and region.",
  },
  {
    id: "rpt-sales-forecast",
    title: "Sales Forecast & Pipeline Confidence",
    category: "Sales",
    period: "Week W48",
    ownerId: "rahul",
    lastGenerated: Date.parse("2026-11-12T07:00:00+05:30"),
    status: "Ready",
    schedule: "Weekly · Thursday 07:00",
    format: "PDF",
    recipients: ["Sagar Singh", "Rahul Mehta", "Regional heads"],
    description: "Commit / best-case / model forecast with confidence drivers and the at-risk opportunity list.",
  },
  {
    id: "rpt-budget-variance",
    title: "Finance Budget Variance — Departments",
    category: "Finance",
    period: "October 2026",
    ownerId: "priya",
    lastGenerated: Date.parse("2026-11-05T09:00:00+05:30"),
    status: "Ready",
    schedule: "Monthly · 5th 09:00",
    format: "PDF + XLSX",
    recipients: ["Sagar Singh", "Priya Sharma", "Department heads"],
    description: "Actual vs budget by department with variance commentary and the overdue receivables appendix.",
  },
  {
    id: "rpt-people",
    title: "People — Headcount, Hiring & Attrition",
    category: "People",
    period: "October 2026",
    ownerId: "neha",
    status: "Scheduled",
    schedule: "Monthly · 1 Dec 08:00",
    format: "PDF",
    recipients: ["Sagar Singh", "Neha Patel"],
    description: "Aggregated workforce view: headcount trend, hiring funnel, attrition by department. No individual-level data.",
  },
  {
    id: "rpt-marketing-roi",
    title: "Marketing Channel ROI & Pipeline Contribution",
    category: "Marketing",
    period: "Q3 FY27 · to 31 Oct",
    ownerId: "amit",
    lastGenerated: Date.parse("2026-11-03T16:45:00+05:30"),
    status: "Ready",
    schedule: "Monthly · 3rd 16:00",
    format: "PDF + XLSX",
    recipients: ["Sagar Singh", "Amit Verma"],
    description: "Channel-level CPL, MQL quality and sourced pipeline with campaign commentary.",
    dataNote: "Source sync delayed since 04:00 IST — reflects data through 31 Oct.",
  },
  {
    id: "rpt-service-sla",
    title: "Service SLA & CSAT Review",
    category: "Service",
    period: "Week W48",
    ownerId: "vikramj",
    lastGenerated: Date.parse("2026-11-11T08:30:00+05:30"),
    status: "Ready",
    schedule: "Weekly · Wednesday 08:30",
    format: "PDF",
    recipients: ["Sagar Singh", "Vikram Joshi", "Service leads"],
    description: "SLA compliance by priority, backlog trend, CSAT and the critical-account escalation list.",
  },
  {
    id: "rpt-inventory-valuation",
    title: "Inventory Valuation & Stock Health",
    category: "Inventory",
    period: "1 Nov 2026",
    ownerId: "karan",
    lastGenerated: Date.parse("2026-11-02T10:00:00+05:30"),
    status: "Ready",
    schedule: "Monthly · 2nd 10:00",
    format: "XLSX",
    recipients: ["Sagar Singh", "Karan Mehta", "Priya Sharma"],
    description: "Warehouse-level valuation, low-stock and overstock exceptions, purchase pipeline status.",
  },
  {
    id: "rpt-field",
    title: "Field Operations Summary",
    category: "Operations",
    period: "Week W47",
    ownerId: "sanjay",
    lastGenerated: Date.parse("2026-11-10T17:30:00+05:30"),
    status: "Ready",
    schedule: "Weekly · Tuesday 17:30",
    format: "PDF",
    recipients: ["Sagar Singh", "Sanjay Gupta", "Regional leads"],
    description: "Visit completion by region, delayed-visit reasons, unresolved jobs and travel trends.",
  },
  {
    id: "rpt-risk",
    title: "Risk & Exceptions — Executive Digest",
    category: "Risk",
    period: "October 2026",
    ownerId: "priya",
    lastGenerated: Date.parse("2026-11-13T05:45:00+05:30"),
    status: "Failed",
    schedule: "Monthly · 13th 05:45",
    format: "PDF",
    recipients: ["Sagar Singh", "Priya Sharma"],
    description: "Consolidated exceptions: revenue variance, receivables, SLA breaches, stockouts and pending decisions.",
    dataNote: "Last run failed while merging the Finance ledger extract — regenerate after the 09:00 sync.",
  },
];

// ============================================================
// Domain summaries — the CEO Overview (59) domain band.
// ============================================================

export interface DomainSummary {
  id: DomainId;
  name: string;
  screen: ScreenId;
  health: "On Track" | "Watch" | "At Risk";
  headline: string;
  sub: string;
  freshness: Freshness;
  /** count of high-signal alerts raised against this domain */
  attention: number;
}

export const DOMAIN_SUMMARIES: DomainSummary[] = [
  {
    id: "revenue",
    name: "Revenue",
    screen: "revenue-snapshot",
    health: "At Risk",
    headline: "₹2.30 Cr of ₹5.35 Cr target",
    sub: "October missed by 4% — forecast ₹5.12 Cr",
    freshness: DOMAIN_FRESHNESS.revenue,
    attention: 1,
  },
  {
    id: "sales",
    name: "Sales",
    screen: "sales-command",
    health: "Watch",
    headline: "Pipeline ₹9.8 Cr · coverage 1.8x",
    sub: "Forecast confidence 72%",
    freshness: DOMAIN_FRESHNESS.sales,
    attention: 1,
  },
  {
    id: "finance",
    name: "Finance",
    screen: "finance-snapshot",
    health: "Watch",
    headline: "Cash ₹6.84 Cr · 14-month runway",
    sub: "Overdue receivables ₹0.94 Cr",
    freshness: DOMAIN_FRESHNESS.finance,
    attention: 2,
  },
  {
    id: "people",
    name: "People",
    screen: "people-overview",
    health: "Watch",
    headline: "1,245 people · +47 net YTD",
    sub: "Attrition 12.4% vs 10% target",
    freshness: DOMAIN_FRESHNESS.people,
    attention: 1,
  },
  {
    id: "marketing",
    name: "Marketing",
    screen: "marketing-overview",
    health: "Watch",
    headline: "₹1.62 Cr sourced pipeline",
    sub: "Contribution 24% vs 30% target",
    freshness: DOMAIN_FRESHNESS.marketing,
    attention: 0,
  },
  {
    id: "service",
    name: "Service",
    screen: "service-overview",
    health: "Watch",
    headline: "SLA 92.4% vs 95% target",
    sub: "3 critical tickets on renewal accounts",
    freshness: DOMAIN_FRESHNESS.service,
    attention: 1,
  },
  {
    id: "inventory",
    name: "Inventory",
    screen: "inventory-overview",
    health: "Watch",
    headline: "₹4.28 Cr stock · 3 stockouts",
    sub: "12 dispatches blocked",
    freshness: DOMAIN_FRESHNESS.inventory,
    attention: 1,
  },
  {
    id: "field",
    name: "Field Ops",
    screen: "field-operations",
    health: "At Risk",
    headline: "75% visit completion this week",
    sub: "North region at 58%",
    freshness: DOMAIN_FRESHNESS.field,
    attention: 1,
  },
];

// ============================================================
// Server payload contract — /api/executive (?section=…)
// ============================================================

export type ExecutiveSection =
  | "overview"
  | "revenue"
  | "sales"
  | "finance"
  | "people"
  | "marketing"
  | "service"
  | "inventory"
  | "field"
  | "alerts"
  | "approvals"
  | "insights"
  | "kpis"
  | "reports";

export interface ExecutiveOverviewPayload {
  period: typeof EXEC_PERIOD;
  domains: DomainSummary[];
  kpis: Kpi[];
  alerts: ExecAlert[];
  approvals: ExecApproval[];
  insights: AiInsight[];
}

export interface ExecutiveSnapshot {
  ok: true;
  asOf: number;
  asOfLabel: string;
  period: typeof EXEC_PERIOD;
  section: ExecutiveSection | "all";
  data: unknown; // narrowed per-section by the caller
}

export const sectionFor = (s: string | null): ExecutiveSection | "all" => {
  const valid: ExecutiveSection[] = ["overview", "revenue", "sales", "finance", "people", "marketing", "service", "inventory", "field", "alerts", "approvals", "insights", "kpis", "reports"];
  return valid.includes(s as ExecutiveSection) ? (s as ExecutiveSection) : "all";
};
