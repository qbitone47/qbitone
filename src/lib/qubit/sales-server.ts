// ============================================================
// Qubit One — Sales enforcement store (SERVER ONLY)
// ============================================================
// Phase 6: the operational Sales module follows the Phase 3/4/5
// pattern — the frontend is NOT the source of truth. Scoping
// (company / team / own), lifecycle rules, duplicate guards,
// state transitions, approval routing and audit are enforced
// here, behind /api/sales route handlers.
//
// Integrations (all REUSED, none duplicated):
//  · Audit  → security-server.writeAudit (ONE enterprise trail)
//  · Approvals → workspace-server.pushApproval (My Approvals 46,
//    routed by the enterprise Approval Matrix 09)
//  · Identity → data.ts employees (owner names resolve there)
//  · Executive aggregates → executive-data SALES block (never
//    re-derived here)
// ============================================================

import { writeAudit } from "./security-server";
import { pushApproval, SESSION_USER_ID, type WorkspaceRole } from "./workspace-server";
import { employees } from "./data";

// ---------- IAM acting-identity context ----------
// salesGet/salesPost receive the verified session userId and run every
// scope/ownership composition synchronously (no await before the reads),
// so per-request identity values cannot interleave. The legacy constant
// remains only as the default for the standing fixture owner.
let ACTOR_ID = SESSION_USER_ID;
import {
  SALES_ACTIVITIES,
  SALES_ACCOUNTS,
  SALES_CONTACTS,
  SALES_EXPENSES,
  SALES_FOLLOWUPS,
  SALES_LEADS,
  SALES_LEADERBOARD,
  SALES_MEETINGS,
  SALES_ORDERS,
  SALES_OPPORTUNITIES,
  SALES_OWNERS,
  SALES_PERIOD,
  SALES_PRODUCTS,
  SALES_QUOTATIONS,
  SALES_REPORT_CATALOG,
  SALES_SETTINGS,
  SALES_TARGETS,
  SALES_TEAMS,
  SALES_TEAM_MEMBERS,
  SALES_TRAVEL,
  SALES_VISITS,
  WA_CONVERSATIONS,
  computeForecast,
  SALES_FUNNEL_HISTORY,
  type ActivityType,
  type LeadPriority,
  type LeadStatus,
  type OpportunityStage,
  type QuotationStatus,
  type SalesAccount,
  type SalesActivity,
  type SalesContact,
  type SalesExpense,
  type SalesFollowUp,
  type SalesLead,
  type SalesMeeting,
  type SalesOpportunity,
  type SalesOrder,
  type SalesQuotation,
  type SalesSettings,
  type SalesVisit,
  type TravelPlan,
  type WaConversation,
} from "./sales-data";

// ---------- role model ----------
// administrator → Sales Admin (+ company-wide visibility)
// dept-head     → Sales Manager (team scope)
// sales-exec    → Sales Employee (own records)
// employee / hr-manager → no sales authorization (403, audited)

export type SalesScope = "company" | "team" | "own";

export function requireSalesAccess(
  role: WorkspaceRole,
  screen: string,
): { ok: true; scope: SalesScope } | { ok: false; status: number; code: string; message: string } {
  if (role === "administrator") return { ok: true, scope: "company" };
  if (role === "dept-head") return { ok: true, scope: "team" };
  if (role === "sales-exec") return { ok: true, scope: "own" };
  writeAudit({
    actorId: ACTOR_ID,
    action: "Sales access denied",
    resource: screen,
    result: "Blocked",
    severity: "Warning",
    context: `Role boundary "${role}" holds no authorization for the Sales Operating System`,
  });
  return {
    ok: false,
    status: 403,
    code: "sales_access_required",
    message: "The Sales Operating System requires a sales role. You are previewing a boundary without sales authorization, and the server enforces this restriction.",
  };
}

/** Manager boundary: the session user's teams (demo: Sales Head sees all teams). */
function visibleTeamMemberIds(scope: SalesScope): Set<string> {
  if (scope === "company") return new Set([...SALES_TEAM_MEMBERS, "sagar"]);
  if (scope === "team") return new Set([...SALES_TEAM_MEMBERS]); // Sales Head preview: all sales teams
  // own → session identity only
  return new Set([ACTOR_ID]);
}

function canSee(scope: SalesScope, ownerId: string | undefined): boolean {
  if (!ownerId) return true; // unassigned pool is visible for triage at every sales role
  return visibleTeamMemberIds(scope).has(ownerId);
}

const nameOf = (id: string | undefined) => (id ? (employees.find((e) => e.id === id)?.name ?? id) : "Unassigned");

// ---------- mutable demo store ----------
interface SalesStore {
  seq: number;
  leads: SalesLead[];
  contacts: SalesContact[];
  accounts: SalesAccount[];
  opportunities: SalesOpportunity[];
  followups: SalesFollowUp[];
  meetings: SalesMeeting[];
  quotations: SalesQuotation[];
  orders: SalesOrder[];
  activities: SalesActivity[];
  conversations: WaConversation[];
  visits: SalesVisit[];
  travel: TravelPlan[];
  expenses: SalesExpense[];
  settings: SalesSettings;
}

// Phase 20 — globalThis singleton (see workspace-server): route bundles
// must share ONE sales store so /api/sales, /api/mobile, /api/analytics and
// /api/search read and write the same pipeline state.
const g = globalThis as unknown as { __qubitSalesStore?: SalesStore };

function store(): SalesStore {
  if (!g.__qubitSalesStore) {
    g.__qubitSalesStore = {
      seq: 1000,
      leads: SALES_LEADS.map((x) => structuredClone(x)),
      contacts: SALES_CONTACTS.map((x) => structuredClone(x)),
      accounts: SALES_ACCOUNTS.map((x) => structuredClone(x)),
      opportunities: SALES_OPPORTUNITIES.map((x) => structuredClone(x)),
      followups: SALES_FOLLOWUPS.map((x) => structuredClone(x)),
      meetings: SALES_MEETINGS.map((x) => structuredClone(x)),
      quotations: SALES_QUOTATIONS.map((x) => structuredClone(x)),
      orders: SALES_ORDERS as SalesOrder[],
      activities: SALES_ACTIVITIES.map((x) => structuredClone(x)),
      conversations: WA_CONVERSATIONS.map((x) => structuredClone(x)),
      visits: SALES_VISITS.map((x) => structuredClone(x)),
      travel: SALES_TRAVEL.map((x) => structuredClone(x)),
      expenses: SALES_EXPENSES.map((x) => structuredClone(x)),
      settings: structuredClone(SALES_SETTINGS),
    };
  }
  return g.__qubitSalesStore;
}

function nextId(prefix: string): string {
  const s = store();
  s.seq += 1;
  return `${prefix}-${s.seq}`;
}

function addActivity(a: Omit<SalesActivity, "id">) {
  const s = store();
  const act: SalesActivity = { id: nextId("act"), ...a };
  s.activities.unshift(act);
  return act;
}

// ---------- shared math ----------

export function quoteSubtotal(q: Pick<SalesQuotation, "items">): number {
  return q.items.reduce((sum, i) => sum + i.qty * i.unitPrice * (1 - i.discountPct / 100), 0);
}
export function quoteTax(q: Pick<SalesQuotation, "items" | "taxPct">): number {
  return Math.round(quoteSubtotal(q) * (q.taxPct / 100));
}
export function quoteTotal(q: Pick<SalesQuotation, "items" | "taxPct">): number {
  return quoteSubtotal(q) + quoteTax(q);
}
export function quoteOverallDiscountPct(q: Pick<SalesQuotation, "items">): number {
  const gross = q.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  if (gross <= 0) return 0;
  return ((gross - quoteSubtotal(q)) / gross) * 100;
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// ---------- derived payloads ----------

function leadWithRefs(l: SalesLead, scope: SalesScope) {
  const s = store();
  return {
    ...l,
    ownerName: nameOf(l.ownerId),
    isMine: l.ownerId === ACTOR_ID,
    activity: s.activities.filter((a) => a.entity.kind === "lead" && a.entity.id === l.id).slice(0, 8),
    relatedOpportunity: l.convertedTo?.opportunityId
      ? s.opportunities.find((o) => o.id === l.convertedTo?.opportunityId) ?? null
      : null,
    scopeNote: scope === "own" && l.ownerId !== ACTOR_ID ? undefined : undefined,
  };
}

function oppWithRefs(o: SalesOpportunity) {
  const s = store();
  return {
    ...o,
    ownerName: nameOf(o.ownerId),
    account: s.accounts.find((a) => a.id === o.accountId) ?? null,
    contact: s.contacts.find((c) => c.id === o.contactId) ?? null,
    quotation: o.quotationId ? s.quotations.find((q) => q.id === o.quotationId) ?? null : null,
    followups: s.followups.filter((f) => f.opportunityId === o.id),
    meetings: s.meetings.filter((m) => m.opportunityId === o.id),
    visits: s.visits.filter((v) => v.opportunityId === o.id),
    activity: s.activities.filter((a) => a.entity.kind === "opportunity" && a.entity.id === o.id).slice(0, 12),
    isMine: o.ownerId === ACTOR_ID,
  };
}

function accountWithRefs(a: SalesAccount) {
  const s = store();
  return {
    ...a,
    ownerName: nameOf(a.ownerId),
    contacts: s.contacts.filter((c) => c.accountId === a.id),
    opportunities: s.opportunities.filter((o) => o.accountId === a.id && o.stage !== "Won" && o.stage !== "Lost"),
    quotations: s.quotations.filter((q) => q.accountId === a.id),
    orders: s.orders.filter((o) => o.accountId === a.id),
    visits: s.visits.filter((v) => v.accountId === a.id),
    meetings: s.meetings.filter((m) => m.accountId === a.id),
    activity: s.activities
      .filter((act) =>
        (act.entity.kind === "account" && act.entity.id === a.id) ||
        (act.entity.kind === "opportunity" && s.opportunities.some((o) => o.id === act.entity.id && o.accountId === a.id)) ||
        (act.entity.kind === "quotation" && s.quotations.some((q) => q.id === act.entity.id && q.accountId === a.id)) ||
        (act.entity.kind === "order" && s.orders.some((o) => o.id === act.entity.id && o.accountId === a.id)) ||
        (act.entity.kind === "contact" && s.contacts.some((c) => c.id === act.entity.id && c.accountId === a.id)),
      )
      .slice(0, 14),
  };
}

function contactWithRefs(c: SalesContact) {
  const s = store();
  const account = s.accounts.find((a) => a.id === c.accountId) ?? null;
  return {
    ...c,
    ownerName: nameOf(c.ownerId),
    account,
    leads: s.leads.filter((l) => l.company === account?.name),
    opportunities: s.opportunities.filter((o) => o.contactId === c.id),
    meetings: s.meetings.filter((m) => m.contactId === c.id),
    visits: s.visits.filter((v) => v.contactId === c.id),
    quotations: s.quotations.filter((q) => q.contactId === c.id),
    activity: s.activities
      .filter((a) =>
        (a.entity.kind === "contact" && a.entity.id === c.id) ||
        (a.entity.kind === "opportunity" && s.opportunities.some((o) => o.id === a.entity.id && o.contactId === c.id)) ||
        (a.entity.kind === "lead" && s.leads.some((l) => l.id === a.entity.id && l.contactPerson === c.name)),
      )
      .slice(0, 12),
  };
}

function quotationWithRefs(q: SalesQuotation) {
  const s = store();
  return {
    ...q,
    ownerName: nameOf(q.ownerId),
    account: s.accounts.find((a) => a.id === q.accountId) ?? null,
    contact: q.contactId ? s.contacts.find((c) => c.id === q.contactId) ?? null : null,
    opportunity: q.opportunityId ? s.opportunities.find((o) => o.id === q.opportunityId) ?? null : null,
    order: q.status === "Accepted" ? s.orders.find((o) => o.quotationId === q.id) ?? null : null,
    subtotal: quoteSubtotal(q),
    taxAmount: quoteTax(q),
    total: quoteTotal(q),
    overallDiscountPct: Math.round(quoteOverallDiscountPct(q) * 10) / 10,
  };
}

function orderWithRefs(o: SalesOrder) {
  const s = store();
  return {
    ...o,
    ownerName: nameOf(o.ownerId),
    account: s.accounts.find((a) => a.id === o.accountId) ?? null,
    quotation: o.quotationId ? s.quotations.find((q) => q.id === o.quotationId) ?? null : null,
    opportunity: o.opportunityId ? s.opportunities.find((op) => op.id === o.opportunityId) ?? null : null,
    activity: s.activities.filter((a) => a.entity.kind === "order" && a.entity.id === o.id),
  };
}

function visitWithRefs(v: SalesVisit) {
  const s = store();
  return {
    ...v,
    ownerName: nameOf(v.ownerId),
    account: s.accounts.find((a) => a.id === v.accountId) ?? null,
    contact: v.contactId ? s.contacts.find((c) => c.id === v.contactId) ?? null : null,
    opportunity: v.opportunityId ? s.opportunities.find((o) => o.id === v.opportunityId) ?? null : null,
    travel: s.travel.find((t) => t.visitIds.includes(v.id)) ?? null,
    expenses: s.expenses.filter((e) => e.visitId === v.id),
    activity: s.activities.filter((a) => a.entity.kind === "visit" && a.entity.id === v.id),
  };
}

function pipelinePayload(scope: SalesScope) {
  const s = store();
  const open = s.opportunities.filter((o) => canSee(scope, o.ownerId) && o.stage !== "Won" && o.stage !== "Lost");
  const stages = ["New", "Qualification", "Discovery", "Proposal", "Negotiation", "Contracting"] as OpportunityStage[];
  const columns = stages.map((st) => {
    const cards = open.filter((o) => o.stage === st);
    return {
      stage: st,
      count: cards.length,
      value: cards.reduce((sum, o) => sum + o.valueCr, 0),
      weighted: cards.reduce((sum, o) => sum + (o.valueCr * o.probability) / 100, 0),
      cards: cards.map((o) => ({
        id: o.id,
        name: o.name,
        accountId: o.accountId,
        accountName: s.accounts.find((a) => a.id === o.accountId)?.name ?? "—",
        ownerName: nameOf(o.ownerId),
        ownerId: o.ownerId,
        valueCr: o.valueCr,
        probability: o.probability,
        expectedClose: o.expectedClose,
        nextAction: o.nextAction,
        riskNote: o.riskNote,
        isMine: o.ownerId === ACTOR_ID,
      })),
    };
  });
  const won = s.opportunities.filter((o) => canSee(scope, o.ownerId) && o.stage === "Won");
  const lost = s.opportunities.filter((o) => canSee(scope, o.ownerId) && o.stage === "Lost");
  const gross = open.reduce((sum, o) => sum + o.valueCr, 0);
  return {
    columns,
    won: { count: won.length, value: won.reduce((s2, o) => s2 + o.valueCr, 0), cards: won.map((o) => ({ id: o.id, name: o.name, accountName: s.accounts.find((a) => a.id === o.accountId)?.name ?? "—", valueCr: o.valueCr, closedAt: o.closedAt, ownerName: nameOf(o.ownerId) })) },
    lost: { count: lost.length, cards: lost.map((o) => ({ id: o.id, name: o.name, lossReason: o.lossReason ?? "—", ownerName: nameOf(o.ownerId) })) },
    totals: { gross, weighted: open.reduce((sum, o) => sum + (o.valueCr * o.probability) / 100, 0), count: open.length },
  };
}

function forecastPayload(scope: SalesScope) {
  const rows = SALES_TARGETS.filter((r) => (scope === "own" ? r.kind === "employee" && r.refId === ACTOR_ID : true));
  const summary = computeForecast(rows);
  return { rows, summary, history: SALES_FUNNEL_HISTORY, period: SALES_PERIOD };
}

function homePayload(scope: SalesScope) {
  const s = store();
  const mine = (o: { ownerId: string }) => canSee(scope, o.ownerId);
  const myOpps = s.opportunities.filter((o) => mine(o) && o.stage !== "Won" && o.stage !== "Lost");
  const now = Date.now();
  const todays = s.followups.filter((f) => mine(f) && (f.state === "Overdue" || f.state === "Due Today"));
  const upcoming = s.followups
    .filter((f) => mine(f) && f.state === "Upcoming")
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, 4);
  const meetings = s.meetings
    .filter((m) => mine(m) && m.status === "Scheduled" && m.startAt >= now - 12 * 3_600_000)
    .sort((a, b) => a.startAt - b.startAt)
    .slice(0, 4);
  const recentLeads = s.leads.filter((l) => mine(l)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
  const recentActivity = s.activities.filter((a) => {
    if (a.entity.kind === "opportunity") return s.opportunities.some((o) => o.id === a.entity.id && mine(o));
    if (a.entity.kind === "lead") return s.leads.some((l) => l.id === a.entity.id && mine(l));
    if (a.entity.kind === "quotation") return s.quotations.some((q) => q.id === a.entity.id && mine(q));
    if (a.entity.kind === "order") return s.orders.some((o) => o.id === a.entity.id && mine(o));
    return false;
  }).slice(0, 6);
  const pendingQuotes = s.quotations.filter((q) => mine(q) && ["Draft", "Pending Approval", "Sent", "Viewed", "Negotiation"].includes(q.status));
  const target = SALES_TARGETS.find((t) => t.kind === "employee" && t.refId === ACTOR_ID) ?? null;
  const teamTarget = scope !== "own" ? SALES_TARGETS.filter((t) => t.kind === "team") : [];
  return {
    scope,
    myOpps: myOpps.slice(0, 5).map((o) => ({ id: o.id, name: o.name, accountName: s.accounts.find((a) => a.id === o.accountId)?.name ?? "—", stage: o.stage, valueCr: o.valueCr, probability: o.probability, expectedClose: o.expectedClose, riskNote: o.riskNote, nextAction: o.nextAction })),
    pipeline: pipelinePayload(scope).totals,
    followups: { today: todays.slice(0, 5), upcoming },
    meetings,
    recentLeads,
    recentActivity,
    pendingQuotations: pendingQuotes.slice(0, 4).map((q) => ({ id: q.id, number: q.number, status: q.status, accountId: q.accountId, accountName: s.accounts.find((a) => a.id === q.accountId)?.name ?? "—", total: quoteTotal(q), ownerName: nameOf(q.ownerId) })),
    target: target ? { quotaCr: target.quotaCr, achievedCr: target.achievedCr, pipelineCr: target.pipelineCr, forecastCr: target.forecastCr } : null,
    teamTargets: teamTarget,
    counts: {
      myOpenOpps: myOpps.length,
      dueFollowups: todays.length,
      unreadWhatsApp: s.conversations.filter((c) => mine(c) && c.unread > 0).length,
      visitsPlanned: s.visits.filter((v) => mine(v) && v.status === "Planned").length,
    },
  };
}

function teamPayload(scope: SalesScope) {
  const s = store();
  if (scope === "own") {
    return { ok: false as const, status: 403, code: "manager_required", message: "The team dashboard requires a manager boundary. Sales executives see their own workspace on Sales Home." };
  }
  const teams = SALES_TEAMS.map((t) => {
    const target = SALES_TARGETS.find((r) => r.kind === "team" && r.refId === t.id)!;
    const members = t.memberIds.map((m) => {
      const empTarget = SALES_TARGETS.find((r) => r.kind === "employee" && r.refId === m);
      const opps = s.opportunities.filter((o) => o.ownerId === m && o.stage !== "Won" && o.stage !== "Lost");
      const overdue = s.followups.filter((f) => f.ownerId === m && f.state === "Overdue");
      const lb = SALES_LEADERBOARD.find((l) => l.employeeId === m);
      return {
        employeeId: m,
        name: nameOf(m),
        quotaCr: empTarget?.quotaCr ?? 0,
        achievedCr: empTarget?.achievedCr ?? 0,
        pipelineCr: opps.reduce((sum, o) => sum + o.valueCr, 0),
        openOpps: opps.length,
        overdueFollowups: overdue.length,
        conversionPct: lb?.conversionPct ?? 0,
        attention:
          overdue.length >= 2 ? "Overdue follow-ups piling up"
          : (empTarget && empTarget.quotaCr > 0 && empTarget.achievedCr / empTarget.quotaCr < 0.2) ? "Achievement below pace"
          : (lb && lb.followupCompletionPct < 70) ? "Follow-up completion needs coaching"
          : null,
      };
    });
    const teamOpps = s.opportunities.filter((o) => t.memberIds.includes(o.ownerId) && o.stage !== "Won" && o.stage !== "Lost");
    const risks = teamOpps.filter((o) => o.riskNote);
    return { id: t.id, name: t.name, region: t.region, head: nameOf(t.headId), target, members, risks: risks.map((o) => ({ id: o.id, name: o.name, riskNote: o.riskNote!, ownerName: nameOf(o.ownerId), valueCr: o.valueCr })), openOpps: teamOpps.length, quotations: s.quotations.filter((q) => t.memberIds.includes(q.ownerId) && ["Draft", "Pending Approval", "Sent", "Viewed", "Negotiation"].includes(q.status)).length };
  });
  const totals = {
    quotaCr: teams.reduce((s2, t) => s2 + t.target.quotaCr, 0),
    achievedCr: teams.reduce((s2, t) => s2 + t.target.achievedCr, 0),
    pipelineCr: teams.reduce((s2, t) => s2 + t.target.pipelineCr, 0),
    forecastCr: teams.reduce((s2, t) => s2 + t.target.forecastCr, 0),
  };
  return { ok: true as const, teams, totals, overdueTotal: s.followups.filter((f) => f.state === "Overdue").length };
}

// ============================================================
// GET sections
// ============================================================

export type SalesSection =
  | "home" | "leads" | "lead" | "contacts" | "contact" | "accounts" | "account"
  | "opportunities" | "opportunity" | "pipeline" | "forecast" | "targets" | "leaderboard"
  | "followups" | "meetings" | "quotations" | "quotation" | "orders" | "order"
  | "activity" | "whatsapp" | "whatsapp-conversation" | "visits" | "visit" | "travel"
  | "expenses" | "reports" | "team" | "settings" | "form-refs";

export function sectionAllowed(s: string | null): s is SalesSection {
  return !!s && [
    "home", "leads", "lead", "contacts", "contact", "accounts", "account",
    "opportunities", "opportunity", "pipeline", "forecast", "targets", "leaderboard",
    "followups", "meetings", "quotations", "quotation", "orders", "order",
    "activity", "whatsapp", "whatsapp-conversation", "visits", "visit", "travel",
    "expenses", "reports", "team", "settings", "form-refs",
  ].includes(s);
}

type Result<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string };

export type SalesActionResult =
  | { ok: true; message: string; [k: string]: unknown }
  | { ok: false; status: number; code: string; message: string; matches?: { kind: string; id: string; label: string; reason: string }[] };

export function salesGet(role: WorkspaceRole, section: SalesSection, params: URLSearchParams, userId: string = SESSION_USER_ID): Result<Record<string, unknown>> {
  ACTOR_ID = userId;
  const gate = requireSalesAccess(role, `Sales · ${section}`);
  if (!gate.ok) return gate;
  const { scope } = gate;
  const s = store();
  const id = params.get("id");
  const entityId = params.get("entityId");

  const deny = (): Result<never> => ({ ok: false, status: 404, code: "not_found", message: "This record is outside your authorized scope — the server does not disclose it." });
  const deny404 = (): Result<never> => ({ ok: false, status: 404, code: "not_found", message: "Record not found." });

  switch (section) {
    case "home":
      return { ok: true, data: { period: SALES_PERIOD, ...homePayload(scope) } };
    case "leads": {
      const rows = s.leads.filter((l) => canSee(scope, l.ownerId)).map((l) => leadWithRefs(l, scope));
      return { ok: true, data: { rows, scope, owners: SALES_OWNERS, sources: s.settings.leadSources, savedViews: defaultLeadViews(scope) } };
    }
    case "lead": {
      const l = s.leads.find((x) => x.id === id);
      if (!l || !canSee(scope, l.ownerId)) return l ? deny() : deny404();
      return { ok: true, data: { lead: leadWithRefs(l, scope), scope } };
    }
    case "contacts": {
      const rows = s.contacts.filter((c) => canSee(scope, c.ownerId)).map(contactWithRefs);
      return { ok: true, data: { rows } };
    }
    case "contact": {
      const c = s.contacts.find((x) => x.id === id);
      if (!c || !canSee(scope, c.ownerId)) return c ? deny() : deny404();
      return { ok: true, data: { contact: contactWithRefs(c) } };
    }
    case "accounts": {
      const rows = s.accounts.filter((a) => canSee(scope, a.ownerId)).map(accountWithRefs);
      return { ok: true, data: { rows } };
    }
    case "account": {
      const a = s.accounts.find((x) => x.id === id);
      if (!a || !canSee(scope, a.ownerId)) return a ? deny() : deny404();
      return { ok: true, data: { account: accountWithRefs(a) } };
    }
    case "opportunities": {
      const rows = s.opportunities.filter((o) => canSee(scope, o.ownerId)).map(oppWithRefs);
      return { ok: true, data: { rows, scope } };
    }
    case "opportunity": {
      const o = s.opportunities.find((x) => x.id === id);
      if (!o || !canSee(scope, o.ownerId)) return o ? deny() : deny404();
      return { ok: true, data: { opportunity: oppWithRefs(o) } };
    }
    case "pipeline":
      return { ok: true, data: { period: SALES_PERIOD, ...pipelinePayload(scope) } };
    case "forecast":
      return { ok: true, data: forecastPayload(scope) };
    case "targets": {
      const rows = SALES_TARGETS.filter((r) => (scope === "own" ? r.kind === "employee" && r.refId === ACTOR_ID : true));
      return { ok: true, data: { rows, scope, canEdit: role === "administrator", period: SALES_PERIOD } };
    }
    case "leaderboard": {
      const rows = SALES_LEADERBOARD.filter((r) => canSee(scope, r.employeeId));
      return { ok: true, data: { rows, scope, teams: SALES_TEAMS, period: SALES_PERIOD } };
    }
    case "followups": {
      const rows = s.followups.filter((f) => canSee(scope, f.ownerId));
      return { ok: true, data: { rows, scope } };
    }
    case "meetings": {
      const rows = s.meetings.filter((m) => canSee(scope, m.ownerId)).map((m) => ({
        ...m,
        ownerName: nameOf(m.ownerId),
        account: s.accounts.find((a) => a.id === m.accountId) ?? null,
        contact: m.contactId ? s.contacts.find((c) => c.id === m.contactId) ?? null : null,
        opportunity: m.opportunityId ? s.opportunities.find((o) => o.id === m.opportunityId) ?? null : null,
      }));
      return { ok: true, data: { rows, scope } };
    }
    case "quotations": {
      const rows = s.quotations.filter((q) => canSee(scope, q.ownerId)).map(quotationWithRefs);
      return { ok: true, data: { rows, scope } };
    }
    case "quotation": {
      const q = s.quotations.find((x) => x.id === id);
      if (!q || !canSee(scope, q.ownerId)) return q ? deny() : deny404();
      return { ok: true, data: { quotation: quotationWithRefs(q) } };
    }
    case "orders": {
      const rows = s.orders.filter((o) => canSee(scope, o.ownerId)).map(orderWithRefs);
      return { ok: true, data: { rows, scope } };
    }
    case "order": {
      const o = s.orders.find((x) => x.id === id);
      if (!o || !canSee(scope, o.ownerId)) return o ? deny() : deny404();
      return { ok: true, data: { order: orderWithRefs(o) } };
    }
    case "activity": {
      let rows = s.activities.filter((a) => {
        const resolveOwner = (): string | undefined => {
          if (a.entity.kind === "lead") return s.leads.find((l) => l.id === a.entity.id)?.ownerId;
          if (a.entity.kind === "account") return s.accounts.find((x) => x.id === a.entity.id)?.ownerId;
          if (a.entity.kind === "contact") return s.contacts.find((c) => c.id === a.entity.id)?.ownerId;
          if (a.entity.kind === "opportunity") return s.opportunities.find((o) => o.id === a.entity.id)?.ownerId;
          if (a.entity.kind === "quotation") return s.quotations.find((q) => q.id === a.entity.id)?.ownerId;
          if (a.entity.kind === "order") return s.orders.find((o) => o.id === a.entity.id)?.ownerId;
          if (a.entity.kind === "visit") return s.visits.find((v) => v.id === a.entity.id)?.ownerId;
          return undefined;
        };
        return canSee(scope, resolveOwner()) && (!entityId || a.entity.id === entityId);
      });
      if (entityId) rows = rows.slice(0, 30);
      const refs = {
        accounts: Object.fromEntries(s.accounts.map((a) => [a.id, a.name])),
        opportunities: Object.fromEntries(s.opportunities.map((o) => [o.id, o.name])),
        leads: Object.fromEntries(s.leads.map((l) => [l.id, l.name])),
        quotations: Object.fromEntries(s.quotations.map((q) => [q.id, q.number])),
        orders: Object.fromEntries(s.orders.map((o) => [o.id, o.number])),
      };
      return { ok: true, data: { rows, refs, scope } };
    }
    case "whatsapp": {
      const rows = s.conversations.filter((c) => canSee(scope, c.ownerId)).map((c) => ({
        ...c,
        ownerName: nameOf(c.ownerId),
        account: c.accountId ? s.accounts.find((a) => a.id === c.accountId) ?? null : null,
        lead: c.leadId ? s.leads.find((l) => l.id === c.leadId) ?? null : null,
        opportunity: c.opportunityId ? s.opportunities.find((o) => o.id === c.opportunityId) ?? null : null,
        followup: s.followups.find((f) => f.leadId === c.leadId && f.type === "WhatsApp" && f.state !== "Completed") ?? null,
      }));
      return { ok: true, data: { rows, scope, connected: true } };
    }
    case "whatsapp-conversation": {
      const c = s.conversations.find((x) => x.id === id);
      if (!c || !canSee(scope, c.ownerId)) return c ? deny() : deny404();
      return {
        ok: true,
        data: {
          conversation: {
            ...c,
            ownerName: nameOf(c.ownerId),
            account: c.accountId ? s.accounts.find((a) => a.id === c.accountId) ?? null : null,
            lead: c.leadId ? s.leads.find((l) => l.id === c.leadId) ?? null : null,
            opportunity: c.opportunityId ? s.opportunities.find((o) => o.id === c.opportunityId) ?? null : null,
          },
        },
      };
    }
    case "visits": {
      const rows = s.visits.filter((v) => canSee(scope, v.ownerId)).map(visitWithRefs);
      return { ok: true, data: { rows, scope } };
    }
    case "visit": {
      const v = s.visits.find((x) => x.id === id);
      if (!v || !canSee(scope, v.ownerId)) return v ? deny() : deny404();
      return { ok: true, data: { visit: visitWithRefs(v) } };
    }
    case "travel": {
      const rows = s.travel.filter((t) => canSee(scope, t.ownerId)).map((t) => ({
        ...t,
        ownerName: nameOf(t.ownerId),
        visits: t.visitIds.map((vid) => s.visits.find((v) => v.id === vid) ?? null).filter(Boolean),
        expenses: s.expenses.filter((e) => e.travelId === t.id),
      }));
      return { ok: true, data: { rows, scope } };
    }
    case "expenses": {
      const rows = s.expenses.filter((e) => (scope === "own" ? e.employeeId === ACTOR_ID : true)).map((e) => ({
        ...e,
        employeeName: nameOf(e.employeeId),
        opportunity: e.opportunityId ? s.opportunities.find((o) => o.id === e.opportunityId) ?? null : null,
        visit: e.visitId ? s.visits.find((v) => v.id === e.visitId) ?? null : null,
        travel: e.travelId ? s.travel.find((t) => t.id === e.travelId) ?? null : null,
      }));
      return { ok: true, data: { rows, scope, canDecide: role === "administrator" || role === "dept-head" } };
    }
    case "reports": {
      const metrics = {
        pipeline: pipelinePayload(scope).totals,
        forecast: forecastPayload(scope).summary,
        conversion: {
          leads: s.leads.length,
          qualified: s.leads.filter((l) => ["Qualified", "Converted"].includes(l.status)).length,
          converted: s.leads.filter((l) => l.status === "Converted").length,
          bySource: Object.entries(
            s.leads.reduce<Record<string, { total: number; converted: number }>>((acc, l) => {
              acc[l.source] = acc[l.source] ?? { total: 0, converted: 0 };
              acc[l.source].total += 1;
              if (l.status === "Converted") acc[l.source].converted += 1;
              return acc;
            }, {}),
          ).map(([source, v]) => ({ source, ...v })),
        },
        winloss: {
          won: s.opportunities.filter((o) => o.stage === "Won").map((o) => ({ id: o.id, name: o.name, valueCr: o.valueCr, ownerName: nameOf(o.ownerId), closedAt: o.closedAt })),
          lost: s.opportunities.filter((o) => o.stage === "Lost").map((o) => ({ id: o.id, name: o.name, lossReason: o.lossReason ?? "—" })),
          lossReasons: s.settings.lossReasons,
        },
        quotation: {
          total: s.quotations.length,
          accepted: s.quotations.filter((q) => q.status === "Accepted").length,
          pending: s.quotations.filter((q) => q.status === "Pending Approval").length,
          avgDiscountPct: Math.round((s.quotations.reduce((sum, q) => sum + quoteOverallDiscountPct(q), 0) / Math.max(1, s.quotations.length)) * 10) / 10,
        },
        aging: s.opportunities
          .filter((o) => canSee(scope, o.ownerId) && o.stage !== "Won" && o.stage !== "Lost")
          .map((o) => ({ id: o.id, name: o.name, stage: o.stage, daysInStage: Math.floor((Date.now() - o.lastStageChangeAt) / 86_400_000), ownerName: nameOf(o.ownerId), valueCr: o.valueCr, riskNote: o.riskNote }))
          .sort((a, b) => b.daysInStage - a.daysInStage),
      };
      return { ok: true, data: { catalog: SALES_REPORT_CATALOG, metrics, scope, canExport: role === "administrator" || role === "dept-head" } };
    }
    case "team": {
      const t = teamPayload(scope);
      return t.ok ? { ok: true, data: { ...t, scope } as unknown as Record<string, unknown> } : { ok: false, status: t.status, code: t.code, message: t.message };
    }
    case "settings":
      return { ok: true, data: { settings: s.settings, canEdit: role === "administrator" } };
    case "form-refs":
      return {
        ok: true,
        data: {
          owners: SALES_OWNERS,
          accounts: s.accounts.map((a) => ({ id: a.id, name: a.name, ownerId: a.ownerId })),
          contacts: s.contacts.map((c) => ({ id: c.id, name: c.name, accountId: c.accountId })),
          opportunities: s.opportunities.filter((o) => canSee(scope, o.ownerId)).map((o) => ({ id: o.id, name: o.name, accountId: o.accountId })),
          leads: s.leads.filter((l) => canSee(scope, l.ownerId)).map((l) => ({ id: l.id, name: l.name, company: l.company })),
          products: s.settings && SALES_PRODUCTS,
          sources: s.settings.leadSources,
          industries: ["Manufacturing", "Retail", "Logistics", "Banking", "Healthcare", "Textiles", "Media", "Energy", "Pharmaceuticals", "Food Processing", "Automotive", "EdTech", "Other"],
        },
      };
    default:
      return { ok: false, status: 400, code: "bad_section", message: "Unknown sales section." };
  }
}

function defaultLeadViews(scope: SalesScope) {
  const base = [
    { id: "view-hot", label: "Hot leads", filter: { priority: "Hot" } },
    { id: "view-new", label: "New this week", filter: { status: "New" } },
    { id: "view-unassigned", label: "Unassigned", filter: { unassigned: true } },
    { id: "view-today", label: "Follow-up today", filter: { followup: "today" } },
  ];
  return scope === "own" ? base.slice(0, 3) : base;
}

// ============================================================
// POST actions — validation, lifecycle rules, audit
// ============================================================

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const phoneOk = (v: string) => /^\+?[0-9 ()-]{8,18}$/.test(v);
const now = () => Date.now();

function findDuplicates(input: { name?: string; email?: string; phone?: string; company?: string }) {
  const s = store();
  const matches: { kind: string; id: string; label: string; reason: string }[] = [];
  for (const l of s.leads) {
    if (input.email && l.email.toLowerCase() === input.email.toLowerCase()) matches.push({ kind: "lead", id: l.id, label: `${l.name} — ${l.contactPerson}`, reason: "Same email" });
    else if (input.phone && l.phone.replace(/\D/g, "").endsWith(input.phone.replace(/\D/g, "").slice(-10))) matches.push({ kind: "lead", id: l.id, label: `${l.name} — ${l.contactPerson}`, reason: "Similar phone" });
    else if (input.name && l.name.toLowerCase() === input.name.toLowerCase()) matches.push({ kind: "lead", id: l.id, label: `${l.name} — ${l.contactPerson}`, reason: "Same lead name" });
  }
  for (const c of s.contacts) {
    if (input.email && c.email.toLowerCase() === input.email.toLowerCase()) matches.push({ kind: "contact", id: c.id, label: `${c.name} (${c.designation})`, reason: "Same email as existing contact" });
    else if (input.phone && c.phone.replace(/\D/g, "").endsWith(input.phone.replace(/\D/g, "").slice(-10))) matches.push({ kind: "contact", id: c.id, label: `${c.name} (${c.designation})`, reason: "Similar phone to existing contact" });
  }
  for (const a of s.accounts) {
    if (input.company && a.name.toLowerCase() === input.company.toLowerCase()) matches.push({ kind: "account", id: a.id, label: a.name, reason: "Account already exists" });
  }
  return matches;
}

export type Action =
  | { type: "lead.create"; input: Record<string, unknown> }
  | { type: "lead.assign"; input: Record<string, unknown> }
  | { type: "lead.status"; input: Record<string, unknown> }
  | { type: "lead.note"; input: Record<string, unknown> }
  | { type: "lead.followup"; input: Record<string, unknown> }
  | { type: "lead.convert"; input: Record<string, unknown> }
  | { type: "opportunity.stage"; input: Record<string, unknown> }
  | { type: "opportunity.update"; input: Record<string, unknown> }
  | { type: "followup.complete"; input: Record<string, unknown> }
  | { type: "followup.reschedule"; input: Record<string, unknown> }
  | { type: "meeting.create"; input: Record<string, unknown> }
  | { type: "meeting.reschedule"; input: Record<string, unknown> }
  | { type: "meeting.cancel"; input: Record<string, unknown> }
  | { type: "meeting.notes"; input: Record<string, unknown> }
  | { type: "quotation.create"; input: Record<string, unknown> }
  | { type: "quotation.update"; input: Record<string, unknown> }
  | { type: "quotation.submit"; input: Record<string, unknown> }
  | { type: "quotation.decide"; input: Record<string, unknown> }
  | { type: "quotation.send"; input: Record<string, unknown> }
  | { type: "quotation.cancel"; input: Record<string, unknown> }
  | { type: "quotation.revise"; input: Record<string, unknown> }
  | { type: "order.create"; input: Record<string, unknown> }
  | { type: "order.update"; input: Record<string, unknown> }
  | { type: "order.cancel"; input: Record<string, unknown> }
  | { type: "expense.create"; input: Record<string, unknown> }
  | { type: "expense.submit"; input: Record<string, unknown> }
  | { type: "expense.delete"; input: Record<string, unknown> }
  | { type: "visit.create"; input: Record<string, unknown> }
  | { type: "visit.reschedule"; input: Record<string, unknown> }
  | { type: "visit.cancel"; input: Record<string, unknown> }
  | { type: "visit.start"; input: Record<string, unknown> }
  | { type: "visit.complete"; input: Record<string, unknown> }
  | { type: "travel.create"; input: Record<string, unknown> }
  | { type: "travel.cancel"; input: Record<string, unknown> }
  | { type: "whatsapp.assign"; input: Record<string, unknown> }
  | { type: "whatsapp.link"; input: Record<string, unknown> }
  | { type: "whatsapp.reply"; input: Record<string, unknown> }
  | { type: "whatsapp.note"; input: Record<string, unknown> }
  | { type: "whatsapp.lead"; input: Record<string, unknown> }
  | { type: "settings.update"; input: Record<string, unknown> }
  | { type: "target.update"; input: Record<string, unknown> };

const str = (o: Record<string, unknown>, k: string): string | undefined => (typeof o[k] === "string" ? (o[k] as string).trim() : undefined);
const num = (o: Record<string, unknown>, k: string): number | undefined => (typeof o[k] === "number" && Number.isFinite(o[k] as number) ? (o[k] as number) : undefined);
const bool = (o: Record<string, unknown>, k: string): boolean | undefined => (typeof o[k] === "boolean" ? (o[k] as boolean) : undefined);

export function salesPost(role: WorkspaceRole, action: Action, userId: string = SESSION_USER_ID): SalesActionResult {
  ACTOR_ID = userId;
  const s = store();
  const gate = requireSalesAccess(role, `Sales · ${action.type}`);
  if (!gate.ok) return gate;
  const { scope } = gate;
  const audit = (args: { action: string; resource: string; severity?: "Info" | "Warning" | "High"; context: string; result?: "Success" | "Blocked" }) =>
    writeAudit({ actorId: ACTOR_ID, action: args.action, resource: args.resource, result: args.result ?? "Success", severity: args.severity ?? "Info", source: "Sales OS", context: args.context });

  const ownOnly = (ownerId: string | undefined): SalesActionResult | null => {
    if (scope === "company") return null;
    if (ownerId && canSee(scope, ownerId)) return null;
    return { ok: false, status: 403, code: "scope_denied", message: scope === "own" ? "Only records you own can be changed from this boundary." : "Only records inside your team scope can be changed." };
  };

  switch (action.type) {
    // ---------- leads ----------
    case "lead.create": {
      const i = action.input;
      const name = str(i, "name");
      const company = str(i, "company");
      const email = str(i, "email");
      const phone = str(i, "phone");
      if (!name || !company || !email || !phone) return { ok: false, status: 422, code: "required", message: "Lead name, company, email and phone are required." };
      if (!emailOk(email)) return { ok: false, status: 422, code: "invalid_email", message: "Enter a valid email address." };
      if (!phoneOk(phone)) return { ok: false, status: 422, code: "invalid_phone", message: "Enter a valid phone number." };
      if (!str(i, "ownerId")) return { ok: false, status: 422, code: "owner_required", message: "Choose an owner — leads are never created unowned." };
      const matches = findDuplicates({ name, email, phone, company });
      if (matches.length > 0 && !bool(i, "force")) {
        return { ok: false, status: 409, code: "possible_duplicates", message: "Possible existing matches were found — review them before creating a duplicate.", matches };
      }
      const lead: SalesLead = {
        id: nextId("lead"),
        name, company,
        contactPerson: str(i, "contactPerson") ?? name,
        phone, email,
        source: str(i, "source") ?? "Website",
        industry: str(i, "industry") ?? "Other",
        location: str(i, "location") ?? "—",
        ownerId: str(i, "ownerId")!,
        status: "New",
        priority: (str(i, "priority") as LeadPriority) ?? "Warm",
        score: num(i, "score") ?? 50,
        estimatedValueCr: num(i, "estimatedValueCr") ?? 0,
        expectedClose: str(i, "expectedClose"),
        nextFollowUpAt: num(i, "nextFollowUpAt"),
        createdAt: now(),
        lastActivityAt: now(),
        tags: Array.isArray(i.tags) ? (i.tags as string[]).slice(0, 6) : [],
        notes: str(i, "notes"),
      };
      s.leads.unshift(lead);
      addActivity({ at: now(), type: "Status change", actorId: ACTOR_ID, entity: { kind: "lead", id: lead.id }, summary: "Lead created", outcome: `Source ${lead.source}` });
      if (lead.nextFollowUpAt) {
        s.followups.unshift({ id: nextId("fu"), type: "Call", subject: `First follow-up — ${lead.name}`, ownerId: lead.ownerId, leadId: lead.id, dueAt: lead.nextFollowUpAt, state: "Upcoming", priority: lead.priority === "Hot" ? "High" : "Medium" });
      }
      audit({ action: "Lead created", resource: `${lead.name} — ${lead.company}`, context: `Owner ${nameOf(lead.ownerId)} · source ${lead.source}${lead.nextFollowUpAt ? " · follow-up scheduled" : ""}` });
      return { ok: true, message: `Lead created and assigned to ${nameOf(lead.ownerId)}. An initial activity was recorded.`, lead: leadWithRefs(lead, scope) };
    }

    case "lead.assign": {
      const lead = s.leads.find((l) => l.id === str(action.input, "id"));
      if (!lead) return { ok: false, status: 404, code: "not_found", message: "Lead not found." };
      if (!canSee(scope, lead.ownerId)) return { ok: false, status: 403, code: "scope_denied", message: "This lead is outside your authorized scope." };
      if (scope === "own") return { ok: false, status: 403, code: "manager_required", message: "Reassignment is a manager action — ask your sales manager, or use Convert to move the lead forward." };
      const to = str(action.input, "ownerId");
      if (!to || !SALES_OWNERS.some((o) => o.id === to)) return { ok: false, status: 422, code: "owner_required", message: "Choose a valid owner from the sales team." };
      if (to === lead.ownerId) return { ok: false, status: 422, code: "same_owner", message: "This lead already belongs to that owner." };
      const from = lead.ownerId;
      lead.ownerId = to;
      lead.lastActivityAt = now();
      s.followups.filter((f) => f.leadId === lead.id && f.state !== "Completed").forEach((f) => (f.ownerId = to));
      addActivity({ at: now(), type: "Lead assigned", actorId: ACTOR_ID, entity: { kind: "lead", id: lead.id }, summary: `Ownership moved ${nameOf(from)} → ${nameOf(to)}` });
      audit({ action: "Lead ownership changed", resource: `${lead.name} — ${lead.company}`, context: `${nameOf(from)} → ${nameOf(to)}; open follow-ups reassigned` });
      return { ok: true, message: `Lead reassigned to ${nameOf(to)}. Open follow-ups moved with it.`, lead: leadWithRefs(lead, scope) };
    }

    case "lead.status": {
      const lead = s.leads.find((l) => l.id === str(action.input, "id"));
      if (!lead) return { ok: false, status: 404, code: "not_found", message: "Lead not found." };
      if (scope === "own" && lead.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only records you own can be changed from this boundary." };
      const status = str(action.input, "status") as LeadStatus | undefined;
      if (!status || !["Working", "Qualified", "Unqualified"].includes(status)) return { ok: false, status: 422, code: "invalid_status", message: "Status must be Working, Qualified or Unqualified — use Convert for the full lifecycle." };
      if (status === "Unqualified" && !str(action.input, "reason")) return { ok: false, status: 422, code: "reason_required", message: "A disqualification reason is required — it is kept on the lead and in the audit trail." };
      const prev = lead.status;
      lead.status = status;
      if (status === "Unqualified") lead.disqualifiedReason = str(action.input, "reason");
      lead.lastActivityAt = now();
      addActivity({ at: now(), type: "Status change", actorId: ACTOR_ID, entity: { kind: "lead", id: lead.id }, summary: `Lead ${prev} → ${status}`, outcome: status === "Unqualified" ? lead.disqualifiedReason : undefined });
      audit({ action: `Lead marked ${status.toLowerCase()}`, resource: `${lead.name} — ${lead.company}`, context: `${prev} → ${status}${status === "Unqualified" ? ` · reason: ${lead.disqualifiedReason}` : ""}` });
      return { ok: true, message: `Lead marked ${status}.`, lead: leadWithRefs(lead, scope) };
    }

    case "lead.note": {
      const lead = s.leads.find((l) => l.id === str(action.input, "id"));
      if (!lead) return { ok: false, status: 404, code: "not_found", message: "Lead not found." };
      if (!canSee(scope, lead.ownerId)) return { ok: false, status: 403, code: "scope_denied", message: "This lead is outside your authorized scope." };
      const body = str(action.input, "body");
      if (!body || body.length < 3) return { ok: false, status: 422, code: "note_required", message: "Write the note before saving." };
      lead.lastActivityAt = now();
      addActivity({ at: now(), type: "Note", actorId: ACTOR_ID, entity: { kind: "lead", id: lead.id }, summary: body });
      audit({ action: "Note added to lead", resource: `${lead.name} — ${lead.company}`, context: body.slice(0, 120) });
      return { ok: true, message: "Note recorded on the lead timeline." };
    }

    case "lead.followup": {
      const lead = s.leads.find((l) => l.id === str(action.input, "id"));
      if (!lead) return { ok: false, status: 404, code: "not_found", message: "Lead not found." };
      if (!canSee(scope, lead.ownerId)) return { ok: false, status: 403, code: "scope_denied", message: "This lead is outside your authorized scope." };
      const dueAt = num(action.input, "dueAt");
      const type = (str(action.input, "type") ?? "Call") as SalesFollowUp["type"];
      if (!dueAt || dueAt < now() - 60_000) return { ok: false, status: 422, code: "invalid_date", message: "Schedule the follow-up for a future date and time." };
      const fu: SalesFollowUp = { id: nextId("fu"), type, subject: str(action.input, "subject") ?? `Follow-up — ${lead.name}`, ownerId: lead.ownerId, leadId: lead.id, dueAt, state: dueAt < today0End() ? "Due Today" : "Upcoming", priority: (str(action.input, "priority") as "High" | "Medium" | "Low") ?? "Medium" };
      s.followups.unshift(fu);
      lead.nextFollowUpAt = dueAt;
      addActivity({ at: now(), type: "Follow-up", actorId: ACTOR_ID, entity: { kind: "lead", id: lead.id }, summary: `${fu.type} follow-up scheduled — ${new Date(dueAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` });
      audit({ action: "Follow-up scheduled", resource: `${lead.name} — ${lead.company}`, context: `${fu.type} · due ${new Date(dueAt).toLocaleString("en-IN")}` });
      return { ok: true, message: "Follow-up scheduled and visible in the Follow-up Queue." };
    }

    case "lead.convert": {
      const lead = s.leads.find((l) => l.id === str(action.input, "id"));
      if (!lead) return { ok: false, status: 404, code: "not_found", message: "Lead not found." };
      if (!canSee(scope, lead.ownerId)) return { ok: false, status: 403, code: "scope_denied", message: "This lead is outside your authorized scope." };
      if (lead.status === "Converted") return { ok: false, status: 409, code: "already_converted", message: "This lead is already converted — the history on the lead shows what was created." };
      if (lead.status === "Unqualified") return { ok: false, status: 409, code: "unqualified", message: "Unqualified leads cannot be converted. Re-qualify the lead first." };
      const i = action.input;
      const accountId = str(i, "accountId");
      const newAccountName = str(i, "newAccountName");
      const contactId = str(i, "contactId");
      if (!accountId && !newAccountName) return { ok: false, status: 422, code: "account_required", message: "Choose an existing account or provide a new account name — the review step prevents duplicates." };
      if (!contactId && !newAccountName && !accountId) return { ok: false, status: 422, code: "contact_required", message: "Choose an existing contact or create one." };
      let acc = accountId ? s.accounts.find((a) => a.id === accountId) : undefined;
      if (!acc) {
        const dup = findDuplicates({ company: newAccountName });
        if (dup.some((m) => m.kind === "account")) return { ok: false, status: 409, code: "possible_duplicates", message: "An account with that name already exists — match it instead of creating a duplicate.", matches: dup };
        acc = { id: nextId("acc"), name: newAccountName!, industry: str(i, "industry") ?? lead.industry, location: lead.location, region: "—", ownerId: str(i, "opportunityOwnerId") ?? lead.ownerId, status: "Customer", customerSince: new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" }), phone: lead.phone, website: "—", employees: 0 };
        s.accounts.unshift(acc);
        audit({ action: "Account created from lead conversion", resource: acc.name, context: `From lead ${lead.name}` });
      }
      let ct = contactId ? s.contacts.find((c) => c.id === contactId) : undefined;
      if (!ct) {
        const dup = findDuplicates({ email: lead.email, phone: lead.phone });
        if (dup.some((m) => m.kind === "contact")) return { ok: false, status: 409, code: "possible_duplicates", message: "A contact with that email/phone already exists — match it instead of creating a duplicate.", matches: dup };
        ct = { id: nextId("ct"), name: lead.contactPerson, designation: str(i, "designation") ?? "Contact", accountId: acc.id, phone: lead.phone, email: lead.email, ownerId: lead.ownerId, consent: { whatsapp: true, email: true, call: true }, preferred: "Email" };
        s.contacts.unshift(ct);
      }
      const oppId = bool(i, "createOpportunity") === false ? undefined : nextId("opp");
      let opp: SalesOpportunity | undefined;
      if (oppId) {
        const valueCr = num(i, "valueCr") ?? lead.estimatedValueCr;
        if (!valueCr || valueCr <= 0) return { ok: false, status: 422, code: "value_required", message: "Set an opportunity value before converting." };
        opp = {
          id: oppId,
          name: str(i, "opportunityName") ?? `${acc.name} — new business`,
          accountId: acc.id,
          contactId: ct.id,
          ownerId: str(i, "opportunityOwnerId") ?? lead.ownerId,
          stage: (str(i, "stage") as OpportunityStage) ?? "Qualification",
          probability: num(i, "probability") ?? 20,
          valueCr,
          expectedClose: str(i, "expectedClose") ?? "TBD",
          source: lead.source,
          products: [],
          nextAction: str(i, "nextAction") ?? "First follow-up after conversion",
          nextFollowUpAt: lead.nextFollowUpAt,
          createdAt: now(),
          lastStageChangeAt: now(),
        };
        s.opportunities.unshift(opp);
      }
      lead.status = "Converted";
      lead.convertedTo = { contactId: ct.id, accountId: acc.id, opportunityId: opp?.id, at: now() };
      lead.lastActivityAt = now();
      addActivity({ at: now(), type: "Conversion", actorId: ACTOR_ID, entity: { kind: "lead", id: lead.id }, summary: `Lead converted — contact, account${opp ? " and opportunity" : ""} created`, outcome: [ct.name, acc.name, opp?.name].filter(Boolean).join(" · ") });
      audit({ action: "Lead converted", resource: `${lead.name} — ${lead.company}`, context: `Contact ${ct.name} · Account ${acc.name}${opp ? ` · Opportunity ${opp.name}` : " · no opportunity created"}` });
      return {
        ok: true,
        message: `Conversion complete — ${ct.name} · ${acc.name}${opp ? ` · ${opp.name}` : ""}. The conversion is recorded on the lead timeline and in the audit trail.`,
        contactId: ct.id,
        accountId: acc.id,
        opportunityId: opp?.id,
      };
    }

    // ---------- opportunities ----------
    case "opportunity.stage": {
      const opp = s.opportunities.find((o) => o.id === str(action.input, "id"));
      if (!opp) return { ok: false, status: 404, code: "not_found", message: "Opportunity not found." };
      if (scope === "own" && opp.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only records you own can be changed from this boundary." };
      const to = str(action.input, "stage") as OpportunityStage | undefined;
      if (!to) return { ok: false, status: 422, code: "stage_required", message: "Choose the target stage." };
      const flow: OpportunityStage[] = ["New", "Qualification", "Discovery", "Proposal", "Negotiation", "Contracting", "Won"];
      const prev = opp.stage;
      if (prev === "Won" || prev === "Lost") return { ok: false, status: 409, code: "closed", message: `This opportunity is closed as ${prev}. Closed records are final — create a new opportunity for follow-on business.` };
      if (to === "Won") {
        if (prev !== "Contracting") return { ok: false, status: 409, code: "invalid_transition", message: "Only opportunities in Contracting can be marked Won — move the stage first." };
        if (!opp.quotationId || s.quotations.find((q) => q.id === opp.quotationId)?.status !== "Accepted") {
          return { ok: false, status: 409, code: "quotation_required", message: "Business rule: an opportunity needs an Accepted quotation before it can be Won." };
        }
      }
      if (to === "Lost") {
        if (!["Proposal", "Negotiation", "Contracting", "Discovery", "Qualification", "New"].includes(prev)) return { ok: false, status: 409, code: "invalid_transition", message: "This stage cannot be marked Lost." };
        if (!str(action.input, "lossReason")) return { ok: false, status: 422, code: "reason_required", message: "A loss reason is required — it feeds the win/loss report." };
      }
      if (to !== "Won" && to !== "Lost") {
        const fromIdx = flow.indexOf(prev);
        const toIdx = flow.indexOf(to);
        if (toIdx === -1 || toIdx < fromIdx) return { ok: false, status: 409, code: "invalid_transition", message: `Stage cannot move backwards (${prev} → ${to}). Closed stages are excluded from regression.` };
        if (toIdx - fromIdx > 2) return { ok: false, status: 409, code: "skip_transition", message: "Stages move max two steps at a time — update through intermediate stages." };
        const cfg = s.settings.stages.find((st) => st.name === to);
        if (cfg?.requiresQuotation && !opp.quotationId) return { ok: false, status: 409, code: "quotation_required", message: `The ${to} stage expects a linked quotation — create one from this opportunity first.` };
      }
      opp.stage = to;
      opp.probability = to === "Won" ? 100 : to === "Lost" ? 0 : (s.settings.stages.find((st) => st.name === to)?.probability ?? opp.probability);
      opp.lastStageChangeAt = now();
      if (to === "Won") opp.closedAt = now();
      if (to === "Lost") { opp.lossReason = str(action.input, "lossReason"); opp.closedAt = now(); }
      addActivity({ at: now(), type: "Stage change", actorId: ACTOR_ID, entity: { kind: "opportunity", id: opp.id }, summary: `Stage moved ${prev} → ${to}`, outcome: to === "Lost" ? opp.lossReason : to === "Won" ? "Closed Won" : undefined });
      audit({ action: "Opportunity stage changed", resource: `${opp.name} (${nameOf(opp.ownerId)})`, severity: to === "Won" || to === "Lost" ? "High" : "Info", context: `${prev} → ${to}${to === "Lost" ? ` · reason: ${opp.lossReason}` : ""}` });
      return { ok: true, message: `Stage updated ${prev} → ${to}. The change is audited.`, opportunity: oppWithRefs(opp) };
    }

    case "opportunity.update": {
      const opp = s.opportunities.find((o) => o.id === str(action.input, "id"));
      if (!opp) return { ok: false, status: 404, code: "not_found", message: "Opportunity not found." };
      if (scope === "own" && opp.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only records you own can be changed from this boundary." };
      const changes: string[] = [];
      const valueCr = num(action.input, "valueCr");
      if (valueCr !== undefined) {
        if (valueCr <= 0) return { ok: false, status: 422, code: "invalid_value", message: "Value must be greater than zero." };
        if (valueCr !== opp.valueCr) { changes.push(`value ₹${opp.valueCr} Cr → ₹${valueCr} Cr`); opp.valueCr = valueCr; }
      }
      const expectedClose = str(action.input, "expectedClose");
      if (expectedClose && expectedClose !== opp.expectedClose) { changes.push(`close date ${opp.expectedClose} → ${expectedClose}`); opp.expectedClose = expectedClose; }
      const probability = num(action.input, "probability");
      if (probability !== undefined) {
        if (probability < 0 || probability > 100) return { ok: false, status: 422, code: "invalid_probability", message: "Probability is a percentage between 0 and 100." };
        if (probability !== opp.probability) { changes.push(`probability ${opp.probability}% → ${probability}%`); opp.probability = probability; }
      }
      const nextAction = str(action.input, "nextAction");
      if (nextAction !== undefined && nextAction !== opp.nextAction) { changes.push("next action"); opp.nextAction = nextAction; }
      if (changes.length === 0) return { ok: false, status: 422, code: "no_changes", message: "Nothing changed — update at least one field." };
      addActivity({ at: now(), type: "Status change", actorId: ACTOR_ID, entity: { kind: "opportunity", id: opp.id }, summary: `Updated: ${changes.join(" · ")}` });
      audit({ action: "Opportunity updated", resource: `${opp.name} (${nameOf(opp.ownerId)})`, context: changes.join(" · ") });
      return { ok: true, message: "Opportunity updated — the change is recorded on the timeline and audited.", opportunity: oppWithRefs(opp) };
    }

    // ---------- follow-ups ----------
    case "followup.complete": {
      const fu = s.followups.find((f) => f.id === str(action.input, "id"));
      if (!fu) return { ok: false, status: 404, code: "not_found", message: "Follow-up not found." };
      if (scope === "own" && fu.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own follow-ups can be completed from this boundary." };
      if (fu.state === "Completed") return { ok: false, status: 409, code: "already_done", message: "This follow-up is already completed." };
      if (fu.state === "Cancelled") return { ok: false, status: 409, code: "cancelled", message: "Cancelled follow-ups cannot be completed — reschedule it first." };
      const outcome = str(action.input, "outcome");
      if (!outcome || outcome.length < 3) return { ok: false, status: 422, code: "outcome_required", message: "Record the outcome — completed follow-ups carry it into the customer timeline." };
      fu.state = "Completed";
      fu.outcome = outcome;
      fu.completedAt = now();
      const entity = fu.leadId ? { kind: "lead" as const, id: fu.leadId } : fu.accountId ? { kind: "account" as const, id: fu.accountId } : { kind: "opportunity" as const, id: fu.opportunityId ?? "" };
      addActivity({ at: now(), type: "Follow-up", actorId: ACTOR_ID, entity, summary: `${fu.type} follow-up completed — ${fu.subject}`, outcome });
      audit({ action: "Follow-up completed", resource: fu.subject, context: outcome.slice(0, 120) });
      return { ok: true, message: "Follow-up completed — outcome recorded in the customer timeline." };
    }

    case "followup.reschedule": {
      const fu = s.followups.find((f) => f.id === str(action.input, "id"));
      if (!fu) return { ok: false, status: 404, code: "not_found", message: "Follow-up not found." };
      if (scope === "own" && fu.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own follow-ups can be rescheduled from this boundary." };
      if (fu.state === "Completed") return { ok: false, status: 409, code: "already_done", message: "Completed follow-ups are history — schedule a new one instead." };
      const dueAt = num(action.input, "dueAt");
      if (!dueAt || dueAt < now() - 60_000) return { ok: false, status: 422, code: "invalid_date", message: "Pick a future date and time." };
      const prev = fu.dueAt;
      fu.dueAt = dueAt;
      fu.state = dueAt < today0End() ? "Due Today" : "Upcoming";
      audit({ action: "Follow-up rescheduled", resource: fu.subject, context: `${new Date(prev).toLocaleString("en-IN")} → ${new Date(dueAt).toLocaleString("en-IN")}` });
      return { ok: true, message: "Follow-up rescheduled." };
    }

    // ---------- meetings ----------
    case "meeting.create": {
      const i = action.input;
      const title = str(i, "title");
      const accountId = str(i, "accountId");
      const startAt = num(i, "startAt");
      if (!title || !accountId || !startAt) return { ok: false, status: 422, code: "required", message: "Title, customer and date/time are required." };
      if (!s.accounts.some((a) => a.id === accountId)) return { ok: false, status: 422, code: "unknown_account", message: "That customer is not in the account register." };
      const m: SalesMeeting = { id: nextId("mtg"), title, accountId, contactId: str(i, "contactId"), opportunityId: str(i, "opportunityId"), ownerId: str(i, "ownerId") ?? ACTOR_ID, startAt, durationMin: num(i, "durationMin") ?? 30, location: str(i, "location") ?? "Teams meeting", isLink: !str(i, "location") || (str(i, "location") ?? "").includes("Teams") || (str(i, "location") ?? "").includes("Zoom"), status: "Scheduled", agenda: str(i, "agenda") };
      s.meetings.unshift(m);
      audit({ action: "Sales meeting created", resource: `${m.title} — ${nameOf(m.ownerId)}`, context: new Date(m.startAt).toLocaleString("en-IN") });
      return { ok: true, message: "Meeting created — it also appears in the Meetings module.", meeting: m };
    }
    case "meeting.reschedule": {
      const m = s.meetings.find((x) => x.id === str(action.input, "id"));
      if (!m) return { ok: false, status: 404, code: "not_found", message: "Meeting not found." };
      if (scope === "own" && m.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own meetings can be changed." };
      if (m.status !== "Scheduled") return { ok: false, status: 409, code: "invalid_state", message: `A ${m.status.toLowerCase()} meeting cannot be rescheduled.` };
      const startAt = num(action.input, "startAt");
      if (!startAt || startAt < now()) return { ok: false, status: 422, code: "invalid_date", message: "Pick a future date and time." };
      m.startAt = startAt;
      audit({ action: "Sales meeting rescheduled", resource: m.title, context: new Date(startAt).toLocaleString("en-IN") });
      return { ok: true, message: "Meeting rescheduled." };
    }
    case "meeting.cancel": {
      const m = s.meetings.find((x) => x.id === str(action.input, "id"));
      if (!m) return { ok: false, status: 404, code: "not_found", message: "Meeting not found." };
      if (scope === "own" && m.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own meetings can be cancelled." };
      if (m.status !== "Scheduled") return { ok: false, status: 409, code: "invalid_state", message: `A ${m.status.toLowerCase()} meeting cannot be cancelled.` };
      m.status = "Cancelled";
      audit({ action: "Sales meeting cancelled", resource: m.title, context: `Cancelled by ${nameOf(ACTOR_ID)} — customer notified through the notification architecture` });
      return { ok: true, message: "Meeting cancelled." };
    }
    case "meeting.notes": {
      const m = s.meetings.find((x) => x.id === str(action.input, "id"));
      if (!m) return { ok: false, status: 404, code: "not_found", message: "Meeting not found." };
      if (scope === "own" && m.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own meetings can be annotated." };
      const notes = str(action.input, "notes");
      if (!notes) return { ok: false, status: 422, code: "notes_required", message: "Write the meeting notes first." };
      m.notes = notes;
      addActivity({ at: now(), type: "Meeting", actorId: ACTOR_ID, entity: { kind: "account", id: m.accountId }, summary: `Meeting notes — ${m.title}`, outcome: notes.slice(0, 140) });
      audit({ action: "Sales meeting notes added", resource: m.title, context: notes.slice(0, 120) });
      return { ok: true, message: "Notes saved to the meeting and the customer timeline." };
    }

    // ---------- quotations ----------
    case "quotation.create": {
      const i = action.input;
      const accountId = str(i, "accountId");
      const items = Array.isArray(i.items) ? (i.items as QuoteItemIn[]) : [];
      if (!accountId) return { ok: false, status: 422, code: "account_required", message: "Choose the customer account." };
      if (items.length === 0) return { ok: false, status: 422, code: "items_required", message: "Add at least one line item." };
      for (const it of items) {
        if (!it.productId || !SALES_PRODUCTS.some((p) => p.id === it.productId)) return { ok: false, status: 422, code: "unknown_product", message: "Every line must reference the product catalog — free-text products are not allowed." };
        if (!it.qty || it.qty <= 0) return { ok: false, status: 422, code: "invalid_qty", message: "Quantities must be at least 1." };
      }
      const q: SalesQuotation = {
        id: nextId("qtn"),
        number: `QTN-2026-${String(s.quotations.length + 46).padStart(3, "0")}`,
        accountId,
        contactId: str(i, "contactId"),
        opportunityId: str(i, "opportunityId"),
        ownerId: str(i, "ownerId") ?? ACTOR_ID,
        status: "Draft",
        createdAt: now(),
        validUntil: str(i, "validUntil") ?? "31 Dec 2026",
        items: items.map((it, idx) => {
          const p = SALES_PRODUCTS.find((x) => x.id === it.productId)!;
          return { id: `i${idx + 1}`, productId: it.productId, name: p.name, qty: it.qty, unitPrice: p.unitPrice, discountPct: Math.max(0, Math.min(100, it.discountPct ?? 0)) };
        }),
        taxPct: 18,
        paymentTerms: str(i, "paymentTerms") ?? "30% advance, milestone-based",
        deliveryTerms: str(i, "deliveryTerms") ?? "Standard rollout terms",
        notes: str(i, "notes"),
        versions: [{ at: now(), by: ACTOR_ID === "sagar" ? "Sagar Singh" : nameOf(ACTOR_ID), note: "Draft created" }],
      };
      s.quotations.unshift(q);
      if (q.opportunityId) {
        const opp = s.opportunities.find((o) => o.id === q.opportunityId);
        if (opp && !opp.quotationId) opp.quotationId = q.id;
      }
      addActivity({ at: now(), type: "Quotation", actorId: ACTOR_ID, entity: { kind: "quotation", id: q.id }, summary: `${q.number} created — ${items.length} line items` });
      audit({ action: "Quotation created", resource: `${q.number} · ${s.accounts.find((a) => a.id === q.accountId)?.name}`, context: `Owner ${nameOf(q.ownerId)} · total ${rupees(quoteTotal(q))}` });
      return { ok: true, message: `${q.number} created as a draft.`, quotation: quotationWithRefs(q) };
    }

    case "quotation.update": {
      const q = s.quotations.find((x) => x.id === str(action.input, "id"));
      if (!q) return { ok: false, status: 404, code: "not_found", message: "Quotation not found." };
      if (scope === "own" && q.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own quotations can be edited." };
      if (q.status !== "Draft" && q.status !== "Negotiation") return { ok: false, status: 409, code: "locked", message: `A ${q.status.toLowerCase()} quotation is locked — use Revise to open a new version. Approved and sent documents are never edited in place.` };
      const items = Array.isArray(action.input.items) ? (action.input.items as QuoteItemIn[]) : undefined;
      if (items) {
        if (items.length === 0) return { ok: false, status: 422, code: "items_required", message: "A quotation needs at least one line item." };
        q.items = items.map((it, idx) => {
          const p = SALES_PRODUCTS.find((x) => x.id === it.productId)!;
          return { id: `i${idx + 1}`, productId: it.productId, name: p?.name ?? it.productId, qty: it.qty, unitPrice: p?.unitPrice ?? 0, discountPct: Math.max(0, Math.min(100, it.discountPct ?? 0)) };
        });
      }
      if (str(action.input, "notes") !== undefined) q.notes = str(action.input, "notes");
      if (str(action.input, "paymentTerms") !== undefined) q.paymentTerms = str(action.input, "paymentTerms")!;
      if (str(action.input, "deliveryTerms") !== undefined) q.deliveryTerms = str(action.input, "deliveryTerms")!;
      q.versions.unshift({ at: now(), by: "Sagar Singh", note: `Draft updated — total ${rupees(quoteTotal(q))}` });
      audit({ action: "Quotation updated", resource: q.number, context: `Total ${rupees(quoteTotal(q))} · discount ${quoteOverallDiscountPct(q).toFixed(1)}%` });
      return { ok: true, message: "Draft updated.", quotation: quotationWithRefs(q) };
    }

    case "quotation.submit": {
      const q = s.quotations.find((x) => x.id === str(action.input, "id"));
      if (!q) return { ok: false, status: 404, code: "not_found", message: "Quotation not found." };
      if (scope === "own" && q.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own quotations can be submitted." };
      if (q.status !== "Draft") return { ok: false, status: 409, code: "invalid_state", message: `Only drafts can be submitted (this one is ${q.status.toLowerCase()}).` };
      const discount = quoteOverallDiscountPct(q);
      const total = quoteTotal(q);
      const needsDiscountApproval = discount > 15;
      const needsValueApproval = total > 5_000_000;
      if (!needsDiscountApproval && !needsValueApproval) {
        q.status = "Approved";
        q.approvalNote = "Auto-approved — within standing limits (discount ≤ 15% and total ≤ ₹50 L).";
        q.decidedAt = now();
        addActivity({ at: now(), type: "Status change", actorId: ACTOR_ID, entity: { kind: "quotation", id: q.id }, summary: "Approved within standing limits — ready to send" });
        audit({ action: "Quotation auto-approved", resource: q.number, context: `Discount ${discount.toFixed(1)}% · total ${rupees(total)} — within standing limits` });
        return { ok: true, message: `${q.number} approved within standing limits and ready to send.`, quotation: quotationWithRefs(q) };
      }
      // Route into the ENTERPRISE approval system (My Approvals 46) —
      // one approval engine, not a sales-specific one.
      const approval = pushApproval({
        kind: "Quotation discount",
        title: `${q.number} — ${needsDiscountApproval ? `discount ${discount.toFixed(1)}%` : `value ${rupees(total)}`} requires approval`,
        requesterId: q.ownerId,
        department: "Sales",
        amount: total,
        priority: total > 10_000_000 ? "High" : "Medium",
        rule: needsDiscountApproval ? "Quotation discount > 15% → Sales Head" : "Quotation total > ₹50 L → Sales Head",
        sla: "2 working days",
        stepUpRequired: total > 10_000_000,
        detail: `${s.accounts.find((a) => a.id === q.accountId)?.name ?? "Customer"} · ${q.items.length} line items · discount ${discount.toFixed(1)}% · total ${rupees(total)}. ${q.notes ?? ""}`.trim(),
        history: [{ at: now(), actor: nameOf(q.ownerId), event: `Submitted from Quotation Builder (${q.number})` }],
      });
      q.status = "Pending Approval";
      q.approvalId = approval.id;
      q.versions.unshift({ at: now(), by: "Sagar Singh", note: `Submitted for approval — ${approval.rule}` });
      addActivity({ at: now(), type: "Status change", actorId: ACTOR_ID, entity: { kind: "quotation", id: q.id }, summary: `Submitted for approval — ${approval.rule}` });
      audit({ action: "Quotation submitted for approval", resource: q.number, severity: "Info", context: `Routed via Approval Matrix (${approval.rule}) · total ${rupees(total)}` });
      return { ok: true, message: `${q.number} submitted — routed through the enterprise Approval Matrix (${approval.rule}). Track it in My Approvals.`, quotation: quotationWithRefs(q), approvalId: approval.id };
    }

    case "quotation.decide": {
      const q = s.quotations.find((x) => x.id === str(action.input, "id"));
      if (!q) return { ok: false, status: 404, code: "not_found", message: "Quotation not found." };
      const decision = str(action.input, "decision");
      if (!decision || !["Approved", "Rejected"].includes(decision)) return { ok: false, status: 422, code: "invalid_decision", message: "Decision must be Approved or Rejected." };
      if (role !== "administrator" && role !== "dept-head") {
        audit({ action: "Quotation approval denied", resource: q.number, result: "Blocked", severity: "Warning", context: `Role boundary "${role}" holds no quotation approval authority` });
        return { ok: false, status: 403, code: "authority_required", message: "Quotation approval authority belongs to the Sales Head / administrator boundary — routed via the Approval Matrix." };
      }
      if (q.status !== "Pending Approval") return { ok: false, status: 409, code: "invalid_state", message: `This quotation is ${q.status.toLowerCase()} — no approval is pending.` };
      const total = quoteTotal(q);
      if (total > 10_000_000) {
        const pw = str(action.input, "stepUpPassword");
        if (!pw || pw.length < 8) {
          audit({ action: "Quotation approval step-up failed", resource: q.number, result: "Blocked", severity: "Warning", context: "Reauthentication missing or too short for a > ₹1 Cr decision" });
          return { ok: false, status: 401, code: "step_up_required", message: "Reauthentication is required before recording this approval decision." };
        }
      }
      if (decision === "Rejected" && !str(action.input, "note")) return { ok: false, status: 422, code: "note_required", message: "A reason is required when rejecting — it goes back to the owner." };
      q.status = decision as QuotationStatus;
      q.decidedAt = now();
      q.approvalNote = decision === "Rejected" ? str(action.input, "note") : "Approved via enterprise approval flow.";
      q.versions.unshift({ at: now(), by: "Sagar Singh", note: `${decision}${str(action.input, "note") ? ` — ${str(action.input, "note")}` : ""}` });
      addActivity({ at: now(), type: "Status change", actorId: ACTOR_ID, entity: { kind: "quotation", id: q.id }, summary: `${decision} by approver${str(action.input, "note") ? ` — ${str(action.input, "note")}` : ""}` });
      audit({ action: `Quotation ${decision.toLowerCase()}`, resource: q.number, severity: total > 10_000_000 ? "High" : "Info", context: `Total ${rupees(total)}${total > 10_000_000 ? " · step-up verified" : ""}` });
      return { ok: true, message: `${q.number} ${decision.toLowerCase()}.`, quotation: quotationWithRefs(q) };
    }

    case "quotation.send": {
      const q = s.quotations.find((x) => x.id === str(action.input, "id"));
      if (!q) return { ok: false, status: 404, code: "not_found", message: "Quotation not found." };
      if (scope === "own" && q.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own quotations can be sent." };
      if (q.status !== "Approved") return { ok: false, status: 409, code: "invalid_state", message: `Only Approved quotations can be sent (this one is ${q.status.toLowerCase()}).` };
      q.status = "Sent";
      q.sentAt = now();
      addActivity({ at: now(), type: "Status change", actorId: ACTOR_ID, entity: { kind: "quotation", id: q.id }, summary: "Quotation sent to customer" });
      audit({ action: "Quotation sent", resource: q.number, context: `Sent to ${s.accounts.find((a) => a.id === q.accountId)?.name ?? "customer"}` });
      return { ok: true, message: `${q.number} sent to the customer.`, quotation: quotationWithRefs(q) };
    }

    case "quotation.cancel": {
      const q = s.quotations.find((x) => x.id === str(action.input, "id"));
      if (!q) return { ok: false, status: 404, code: "not_found", message: "Quotation not found." };
      if (scope === "own" && q.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own quotations can be cancelled." };
      if (["Accepted", "Cancelled", "Expired", "Rejected"].includes(q.status)) return { ok: false, status: 409, code: "invalid_state", message: `A ${q.status.toLowerCase()} quotation cannot be cancelled.` };
      if (!str(action.input, "reason")) return { ok: false, status: 422, code: "reason_required", message: "A reason is required to cancel a quotation." };
      q.status = "Cancelled";
      q.notes = `${q.notes ? q.notes + " " : ""}Cancelled: ${str(action.input, "reason")}`;
      q.versions.unshift({ at: now(), by: "Sagar Singh", note: `Cancelled — ${str(action.input, "reason")}` });
      audit({ action: "Quotation cancelled", resource: q.number, context: str(action.input, "reason")! });
      return { ok: true, message: `${q.number} cancelled.`, quotation: quotationWithRefs(q) };
    }

    case "quotation.revise": {
      const src = s.quotations.find((x) => x.id === str(action.input, "id"));
      if (!src) return { ok: false, status: 404, code: "not_found", message: "Quotation not found." };
      if (scope === "own" && src.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own quotations can be revised." };
      if (["Draft", "Pending Approval"].includes(src.status)) return { ok: false, status: 409, code: "invalid_state", message: "Drafts and pending approvals are edited directly — revision copies exist for decided documents." };
      const q: SalesQuotation = {
        ...structuredClone(src),
        id: nextId("qtn"),
        number: `QTN-2026-${String(s.quotations.length + 46).padStart(3, "0")}`,
        status: "Draft",
        createdAt: now(),
        sentAt: undefined,
        viewedAt: undefined,
        decidedAt: undefined,
        approvalId: undefined,
        approvalNote: undefined,
        versions: [{ at: now(), by: "Sagar Singh", note: `Revision of ${src.number}` }],
      };
      s.quotations.unshift(q);
      if (q.opportunityId) {
        const opp = s.opportunities.find((o) => o.id === q.opportunityId);
        if (opp) opp.quotationId = q.id;
      }
      addActivity({ at: now(), type: "Quotation", actorId: ACTOR_ID, entity: { kind: "quotation", id: q.id }, summary: `Revision of ${src.number} created` });
      audit({ action: "Quotation revision created", resource: `${q.number} (from ${src.number})`, context: "Revision copy — original preserved for the record" });
      return { ok: true, message: `Revision ${q.number} created from ${src.number}. The original stays unchanged for the record.`, quotation: quotationWithRefs(q) };
    }

    // ---------- orders ----------
    case "order.create": {
      const q = s.quotations.find((x) => x.id === str(action.input, "quotationId"));
      if (!q) return { ok: false, status: 404, code: "not_found", message: "Quotation not found." };
      if (scope === "own" && q.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own quotations can be ordered." };
      if (q.status !== "Accepted") return { ok: false, status: 409, code: "invalid_state", message: `Orders are created from Accepted quotations (this one is ${q.status.toLowerCase()}).` };
      const existing = s.orders.find((o) => o.quotationId === q.id && o.status !== "Cancelled");
      if (existing) return { ok: false, status: 409, code: "already_ordered", message: `An order already exists for ${q.number} (${existing.number}) — duplicates are blocked.` };
      const total = quoteTotal(q);
      const o: SalesOrder = {
        id: nextId("so"),
        number: `SO-2026-${String(s.orders.length + 39).padStart(3, "0")}`,
        accountId: q.accountId,
        quotationId: q.id,
        opportunityId: q.opportunityId,
        ownerId: q.ownerId,
        status: "Confirmed",
        payment: "Unpaid",
        fulfillment: "Pending",
        items: structuredClone(q.items),
        total,
        createdAt: now(),
        invoiceId: `INV-2026-${1100 + Math.floor(Math.random() * 800)}`,
        deliveryBy: q.deliveryTerms,
      };
      s.orders.unshift(o);
      addActivity({ at: now(), type: "Order", actorId: ACTOR_ID, entity: { kind: "order", id: o.id }, summary: `${o.number} created from ${q.number} — invoice ${o.invoiceId} raised` });
      audit({ action: "Sales order created", resource: `${o.number} · ${s.accounts.find((a) => a.id === o.accountId)?.name}`, severity: "Info", context: `From ${q.number} · ${rupees(total)} · invoice ${o.invoiceId} sent to Finance; fulfillment request sent to Inventory` });
      return { ok: true, message: `${o.number} created — invoice ${o.invoiceId} raised in Finance and fulfillment requested from Inventory.`, order: orderWithRefs(o) };
    }

    case "order.update": {
      const o = s.orders.find((x) => x.id === str(action.input, "id"));
      if (!o) return { ok: false, status: 404, code: "not_found", message: "Order not found." };
      if (scope === "own" && o.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own orders can be updated." };
      const payment = str(action.input, "payment") as PaymentStateIn | undefined;
      const fulfillment = str(action.input, "fulfillment") as FulfillmentStateIn | undefined;
      const payFlow = ["Unpaid", "Partially Paid", "Paid"];
      const fulFlow = ["Pending", "Packed", "Dispatched", "Delivered"];
      if (payment && !payFlow.includes(payment)) return { ok: false, status: 422, code: "invalid_state", message: "Payment state must be Unpaid, Partially Paid or Paid." };
      if (fulfillment && !fulFlow.includes(fulfillment)) return { ok: false, status: 422, code: "invalid_state", message: "Fulfillment must be Pending, Packed, Dispatched or Delivered." };
      if (payment && payFlow.indexOf(payment) < payFlow.indexOf(o.payment)) return { ok: false, status: 409, code: "invalid_transition", message: `Payment cannot move backwards (${o.payment} → ${payment}).` };
      if (fulfillment && fulFlow.indexOf(fulfillment) < fulFlow.indexOf(o.fulfillment)) return { ok: false, status: 409, code: "invalid_transition", message: `Fulfillment cannot move backwards (${o.fulfillment} → ${fulfillment}).` };
      const changes: string[] = [];
      if (payment && payment !== o.payment) { o.payment = payment; changes.push(`payment → ${payment}`); }
      if (fulfillment && fulfillment !== o.fulfillment) {
        o.fulfillment = fulfillment;
        changes.push(`fulfillment → ${fulfillment}`);
        if (fulfillment === "Dispatched" && !o.dispatchId) o.dispatchId = `DSP-2026-${770 + Math.floor(Math.random() * 200)}`;
        if (fulfillment === "Delivered") o.status = o.payment === "Paid" ? "Closed" : "Delivered";
      }
      if (changes.length === 0) return { ok: false, status: 422, code: "no_changes", message: "Nothing changed." };
      addActivity({ at: now(), type: "Status change", actorId: ACTOR_ID, entity: { kind: "order", id: o.id }, summary: changes.join(" · ") });
      audit({ action: "Sales order updated", resource: o.number, context: `${changes.join(" · ")}${o.dispatchId ? ` · dispatch ${o.dispatchId}` : ""}` });
      return { ok: true, message: "Order updated — downstream systems are notified through the workflow layer.", order: orderWithRefs(o) };
    }

    case "order.cancel": {
      const o = s.orders.find((x) => x.id === str(action.input, "id"));
      if (!o) return { ok: false, status: 404, code: "not_found", message: "Order not found." };
      if (scope === "own" && o.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own orders can be cancelled." };
      if (["Dispatched", "Delivered", "Closed", "Cancelled"].includes(o.status)) return { ok: false, status: 409, code: "invalid_state", message: `An order that is ${o.status.toLowerCase()} cannot be cancelled.` };
      if (!str(action.input, "reason")) return { ok: false, status: 422, code: "reason_required", message: "A reason is required — cancellation is audited and Finance is notified." };
      o.status = "Cancelled";
      o.cancelledReason = str(action.input, "reason");
      addActivity({ at: now(), type: "Status change", actorId: ACTOR_ID, entity: { kind: "order", id: o.id }, summary: `Order cancelled — ${o.cancelledReason}` });
      audit({ action: "Sales order cancelled", resource: o.number, severity: "High", context: `${str(action.input, "reason")} · Finance and Inventory notified through the workflow layer` });
      return { ok: true, message: `${o.number} cancelled. Finance and Inventory are notified through the workflow layer.`, order: orderWithRefs(o) };
    }

    // ---------- expenses ----------
    case "expense.create": {
      const i = action.input;
      const amount = num(i, "amount");
      const category = str(i, "category");
      const description = str(i, "description");
      if (!amount || amount <= 0) return { ok: false, status: 422, code: "invalid_amount", message: "Enter a positive amount." };
      if (!category) return { ok: false, status: 422, code: "category_required", message: "Choose a category." };
      if (!description || description.length < 4) return { ok: false, status: 422, code: "description_required", message: "Describe the expense — it travels with the claim to Finance." };
      const e: SalesExpense = {
        id: nextId("exp"),
        employeeId: ACTOR_ID,
        date: num(i, "date") ?? now(),
        category: category as SalesExpense["category"],
        amount,
        description,
        opportunityId: str(i, "opportunityId"),
        visitId: str(i, "visitId"),
        travelId: str(i, "travelId"),
        status: "Draft",
        receiptName: str(i, "receiptName"),
      };
      s.expenses.unshift(e);
      audit({ action: "Sales expense drafted", resource: `${category} — ${rupees(amount)}`, context: description });
      return { ok: true, message: "Expense saved as draft — submit it when ready.", expense: e };
    }

    case "expense.submit": {
      const e = s.expenses.find((x) => x.id === str(action.input, "id"));
      if (!e) return { ok: false, status: 404, code: "not_found", message: "Expense not found." };
      if (e.employeeId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "You can only submit your own expenses." };
      if (e.status !== "Draft") return { ok: false, status: 409, code: "invalid_state", message: `This expense is already ${e.status.toLowerCase()}.` };
      e.status = "Submitted";
      e.submittedAt = now();
      const approval = pushApproval({
        kind: "Expense claim",
        title: `Expense claim — ${e.category} ${rupees(e.amount)}`,
        requesterId: e.employeeId,
        department: "Sales",
        amount: e.amount,
        priority: e.amount > 10_000 ? "High" : "Medium",
        rule: e.amount > 10_000 ? "Expense claim > ₹10,000 → Sales Head" : "Expense claim → reporting manager",
        sla: "3 working days",
        stepUpRequired: false,
        detail: `${e.description}${e.receiptName ? ` · receipt ${e.receiptName}` : ""}${e.visitId ? " · linked to a field visit" : ""}`,
        history: [{ at: now(), actor: nameOf(e.employeeId), event: "Submitted from Sales Expenses" }],
      });
      audit({ action: "Sales expense submitted", resource: `${e.category} — ${rupees(e.amount)}`, context: `Routed via Approval Matrix (${approval.rule}) · Finance remains the financial source of truth` });
      return { ok: true, message: "Expense submitted — routed through the enterprise Approval Matrix. Track the decision in My Approvals.", expense: e };
    }

    case "expense.delete": {
      const e = s.expenses.find((x) => x.id === str(action.input, "id"));
      if (!e) return { ok: false, status: 404, code: "not_found", message: "Expense not found." };
      if (e.employeeId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "You can only delete your own drafts." };
      if (e.status !== "Draft") return { ok: false, status: 409, code: "invalid_state", message: "Only drafts can be deleted — submitted claims are part of the approval record." };
      s.expenses = s.expenses.filter((x) => x.id !== e.id);
      audit({ action: "Sales expense draft deleted", resource: `${e.category} — ${rupees(e.amount)}`, context: "Draft removed before submission" });
      return { ok: true, message: "Draft deleted." };
    }

    // ---------- visits ----------
    case "visit.create": {
      const i = action.input;
      const accountId = str(i, "accountId");
      const plannedAt = num(i, "plannedAt");
      const purpose = str(i, "purpose");
      if (!accountId || !plannedAt || !purpose) return { ok: false, status: 422, code: "required", message: "Customer, date/time and purpose are required." };
      const v: SalesVisit = {
        id: nextId("vis"),
        accountId,
        contactId: str(i, "contactId"),
        ownerId: str(i, "ownerId") ?? ACTOR_ID,
        opportunityId: str(i, "opportunityId"),
        plannedAt,
        durationMin: num(i, "durationMin") ?? 60,
        location: str(i, "location") ?? s.accounts.find((a) => a.id === accountId)?.location ?? "Customer site",
        purpose,
        status: "Planned",
        checklist: [{ label: "Opening discussion", done: false }, { label: "Requirements captured", done: false }, { label: "Next steps agreed", done: false }],
      };
      s.visits.unshift(v);
      audit({ action: "Field visit planned", resource: `${s.accounts.find((a) => a.id === v.accountId)?.name} — ${purpose}`, context: `${nameOf(v.ownerId)} · ${new Date(plannedAt).toLocaleString("en-IN")}` });
      return { ok: true, message: "Visit planned — it appears in the Field Visit Planner.", visit: visitWithRefs(v) };
    }
    case "visit.reschedule": {
      const v = s.visits.find((x) => x.id === str(action.input, "id"));
      if (!v) return { ok: false, status: 404, code: "not_found", message: "Visit not found." };
      if (scope === "own" && v.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own visits can be rescheduled." };
      if (v.status !== "Planned") return { ok: false, status: 409, code: "invalid_state", message: `A ${v.status.toLowerCase()} visit cannot be rescheduled.` };
      const plannedAt = num(action.input, "plannedAt");
      if (!plannedAt || plannedAt < now()) return { ok: false, status: 422, code: "invalid_date", message: "Pick a future date and time." };
      v.plannedAt = plannedAt;
      audit({ action: "Field visit rescheduled", resource: `${s.accounts.find((a) => a.id === v.accountId)?.name}`, context: new Date(plannedAt).toLocaleString("en-IN") });
      return { ok: true, message: "Visit rescheduled." };
    }
    case "visit.cancel": {
      const v = s.visits.find((x) => x.id === str(action.input, "id"));
      if (!v) return { ok: false, status: 404, code: "not_found", message: "Visit not found." };
      if (scope === "own" && v.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own visits can be cancelled." };
      if (v.status !== "Planned") return { ok: false, status: 409, code: "invalid_state", message: `A ${v.status.toLowerCase()} visit cannot be cancelled.` };
      v.status = "Cancelled";
      audit({ action: "Field visit cancelled", resource: `${s.accounts.find((a) => a.id === v.accountId)?.name}`, context: "Cancelled before start" });
      return { ok: true, message: "Visit cancelled." };
    }
    case "visit.start": {
      const v = s.visits.find((x) => x.id === str(action.input, "id"));
      if (!v) return { ok: false, status: 404, code: "not_found", message: "Visit not found." };
      if (scope === "own" && v.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own visits can be started." };
      if (v.status !== "Planned") return { ok: false, status: 409, code: "invalid_state", message: `A ${v.status.toLowerCase()} visit cannot be started.` };
      v.status = "In Progress";
      v.checkedInAt = now();
      audit({ action: "Field visit started", resource: `${s.accounts.find((a) => a.id === v.accountId)?.name}`, context: "Check-in recorded" });
      return { ok: true, message: "Visit started — check-in recorded.", visit: visitWithRefs(v) };
    }
    case "visit.complete": {
      const v = s.visits.find((x) => x.id === str(action.input, "id"));
      if (!v) return { ok: false, status: 404, code: "not_found", message: "Visit not found." };
      if (scope === "own" && v.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own visits can be completed." };
      if (v.status === "Completed") return { ok: false, status: 409, code: "already_done", message: "This visit is already completed." };
      if (v.status === "Cancelled") return { ok: false, status: 409, code: "invalid_state", message: "Cancelled visits cannot be completed." };
      const outcome = str(action.input, "outcome");
      const notes = str(action.input, "notes");
      if (!outcome) return { ok: false, status: 422, code: "outcome_required", message: "Record the visit outcome before completing." };
      if (!notes) return { ok: false, status: 422, code: "notes_required", message: "Add visit notes — they feed the customer timeline." };
      v.status = "Completed";
      v.outcome = outcome;
      v.notes = notes;
      v.nextAction = str(action.input, "nextAction");
      v.completedAt = now();
      v.evidence = Array.isArray(action.input.evidence) ? (action.input.evidence as string[]).slice(0, 6) : v.evidence;
      const followUpSubject = str(action.input, "followUpSubject");
      const followUpDue = num(action.input, "followUpDueAt");
      if (followUpSubject && followUpDue) {
        s.followups.unshift({ id: nextId("fu"), type: "Call", subject: followUpSubject, ownerId: v.ownerId, accountId: v.accountId, opportunityId: v.opportunityId, dueAt: followUpDue, state: "Upcoming", priority: "Medium" });
      }
      addActivity({ at: now(), type: "Visit", actorId: ACTOR_ID, entity: { kind: "visit", id: v.id }, summary: `Visit completed — ${v.purpose}`, outcome });
      audit({ action: "Field visit completed", resource: `${s.accounts.find((a) => a.id === v.accountId)?.name} — ${v.purpose}`, context: `Outcome: ${outcome}${v.nextAction ? ` · next: ${v.nextAction}` : ""}` });
      return { ok: true, message: `Visit completed — notes and outcome recorded.${followUpSubject && followUpDue ? " Follow-up scheduled." : ""}`, visit: visitWithRefs(v) };
    }

    // ---------- travel ----------
    case "travel.create": {
      const i = action.input;
      const destination = str(i, "destination");
      const purpose = str(i, "purpose");
      const startAt = num(i, "startAt");
      const endAt = num(i, "endAt");
      if (!destination || !purpose || !startAt || !endAt) return { ok: false, status: 422, code: "required", message: "Destination, purpose and dates are required." };
      if (endAt < startAt) return { ok: false, status: 422, code: "invalid_dates", message: "The end of the trip cannot be before the start." };
      const t: TravelPlan = { id: nextId("tvl"), ownerId: str(i, "ownerId") ?? ACTOR_ID, destination, purpose, startAt, endAt, estimatedCost: num(i, "estimatedCost") ?? 0, status: "Planned", visitIds: Array.isArray(i.visitIds) ? (i.visitIds as string[]) : [], notes: str(i, "notes") };
      s.travel.unshift(t);
      audit({ action: "Sales travel planned", resource: `${destination} — ${purpose}`, context: `${nameOf(t.ownerId)} · est. ${rupees(t.estimatedCost)}` });
      return { ok: true, message: "Travel plan created — link visits to it from the planner.", travel: t };
    }
    case "travel.cancel": {
      const t = s.travel.find((x) => x.id === str(action.input, "id"));
      if (!t) return { ok: false, status: 404, code: "not_found", message: "Travel plan not found." };
      if (scope === "own" && t.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own travel can be changed." };
      if (t.status === "Completed") return { ok: false, status: 409, code: "invalid_state", message: "Completed travel cannot be cancelled." };
      t.status = "Cancelled";
      audit({ action: "Sales travel cancelled", resource: `${t.destination} — ${t.purpose}`, context: "Plan cancelled — linked visits unaffected" });
      return { ok: true, message: "Travel plan cancelled." };
    }

    // ---------- whatsapp ----------
    case "whatsapp.assign": {
      const c = s.conversations.find((x) => x.id === str(action.input, "id"));
      if (!c) return { ok: false, status: 404, code: "not_found", message: "Conversation not found." };
      const to = str(action.input, "ownerId");
      if (!to || !SALES_OWNERS.some((o) => o.id === to)) return { ok: false, status: 422, code: "owner_required", message: "Choose a valid salesperson." };
      const from = c.ownerId;
      if (scope === "own" && from !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only your own conversations can be reassigned." };
      c.ownerId = to;
      audit({ action: "WhatsApp conversation assigned", resource: `${c.contactName} (${c.waNumber})`, context: `${nameOf(from)} → ${nameOf(to)}` });
      return { ok: true, message: `Conversation assigned to ${nameOf(to)}.` };
    }
    case "whatsapp.link": {
      const c = s.conversations.find((x) => x.id === str(action.input, "id"));
      if (!c) return { ok: false, status: 404, code: "not_found", message: "Conversation not found." };
      const leadId = str(action.input, "leadId");
      const accountId = str(action.input, "accountId");
      const opportunityId = str(action.input, "opportunityId");
      if (!leadId && !accountId && !opportunityId) return { ok: false, status: 422, code: "link_required", message: "Choose a lead, account or opportunity to link." };
      if (leadId) { const l = s.leads.find((x) => x.id === leadId); if (!l) return { ok: false, status: 422, code: "unknown_lead", message: "That lead does not exist." }; c.leadId = leadId; }
      if (accountId) { const a = s.accounts.find((x) => x.id === accountId); if (!a) return { ok: false, status: 422, code: "unknown_account", message: "That account does not exist." }; c.accountId = accountId; }
      if (opportunityId) { const o = s.opportunities.find((x) => x.id === opportunityId); if (!o) return { ok: false, status: 422, code: "unknown_opportunity", message: "That opportunity does not exist." }; c.opportunityId = opportunityId; }
      c.status = c.status === "Open" ? "Pending" : c.status;
      audit({ action: "WhatsApp conversation linked", resource: c.contactName, context: [leadId && `lead ${leadId}`, accountId && `account ${accountId}`, opportunityId && `opportunity ${opportunityId}`].filter(Boolean).join(" · ") });
      return { ok: true, message: "Conversation linked — future messages land on the linked records." };
    }
    case "whatsapp.reply": {
      const c = s.conversations.find((x) => x.id === str(action.input, "id"));
      if (!c) return { ok: false, status: 404, code: "not_found", message: "Conversation not found." };
      if (scope === "own" && c.ownerId !== ACTOR_ID) return { ok: false, status: 403, code: "scope_denied", message: "Only the assigned salesperson replies from this boundary." };
      const body = str(action.input, "body");
      const template = str(action.input, "template");
      if (!body && !template) return { ok: false, status: 422, code: "body_required", message: "Write a message or pick a template." };
      const ct = s.contacts.find((x) => x.phone.replace(/\D/g, "").endsWith(c.waNumber.replace(/\D/g, "").slice(-10)));
      if (ct && !ct.consent.whatsapp) {
        audit({ action: "WhatsApp reply blocked", resource: c.contactName, result: "Blocked", severity: "Warning", context: "Customer has not granted WhatsApp consent (communication policy)" });
        return { ok: false, status: 403, code: "no_consent", message: "This customer has not consented to WhatsApp communication — use email or a call." };
      }
      const msg = { id: nextId("wm"), at: now(), direction: "out" as const, body: body ?? `Template: ${template}`, template: template ?? undefined, state: "sent" as const };
      c.messages.push(msg);
      c.lastMessageAt = now();
      c.unread = 0;
      if (c.status === "Resolved") c.status = "Pending";
      if (c.leadId) addActivity({ at: now(), type: "WhatsApp", actorId: ACTOR_ID, entity: { kind: "lead", id: c.leadId }, summary: `Reply sent via WhatsApp Business${template ? ` (${template})` : ""}`, source: "WhatsApp Business" });
      audit({ action: "WhatsApp message sent", resource: `${c.contactName} (${c.waNumber})`, context: `${template ? `Template ${template}` : "Free-text reply"} · API-based, consent verified` });
      return { ok: true, message: "Message sent through the WhatsApp Business API.", conversationId: c.id };
    }
    case "whatsapp.note": {
      const c = s.conversations.find((x) => x.id === str(action.input, "id"));
      if (!c) return { ok: false, status: 404, code: "not_found", message: "Conversation not found." };
      const body = str(action.input, "body");
      if (!body) return { ok: false, status: 422, code: "note_required", message: "Write the note first." };
      if (c.leadId) addActivity({ at: now(), type: "Note", actorId: ACTOR_ID, entity: { kind: "lead", id: c.leadId }, summary: `WhatsApp note — ${body}` });
      audit({ action: "WhatsApp conversation note", resource: c.contactName, context: body.slice(0, 120) });
      return { ok: true, message: "Note recorded." };
    }
    case "whatsapp.lead": {
      const c = s.conversations.find((x) => x.id === str(action.input, "id"));
      if (!c) return { ok: false, status: 404, code: "not_found", message: "Conversation not found." };
      if (c.leadId) return { ok: false, status: 409, code: "already_linked", message: "This conversation is already linked to a lead." };
      const dup = findDuplicates({ phone: c.waNumber, name: c.contactName.split(" (")[0] });
      if (dup.length > 0 && !bool(action.input, "force")) {
        return { ok: false, status: 409, code: "possible_duplicates", message: "An existing lead/contact matches this number — link it instead of creating a duplicate.", matches: dup };
      }
      const lead: SalesLead = {
        id: nextId("lead"),
        name: c.contactName.split(" (")[0] ?? c.contactName,
        company: c.contactName.match(/\(([^)]+)\)/)?.[1] ?? "Unknown company",
        contactPerson: c.contactName.split(" (")[0] ?? c.contactName,
        phone: c.waNumber,
        email: `${c.waNumber.replace(/\D/g, "").slice(-10)}@wa.leads.qubitone.in`,
        source: "WhatsApp Campaign",
        industry: "Other",
        location: "—",
        ownerId: c.ownerId,
        status: "New",
        priority: "Warm",
        score: 55,
        estimatedValueCr: 0,
        nextFollowUpAt: now() + 86_400_000,
        createdAt: now(),
        lastActivityAt: now(),
        tags: ["whatsapp"],
        notes: "Created from a WhatsApp Business conversation — consent verified at receipt.",
      };
      s.leads.unshift(lead);
      c.leadId = lead.id;
      addActivity({ at: now(), type: "Status change", actorId: ACTOR_ID, entity: { kind: "lead", id: lead.id }, summary: "Lead created from WhatsApp conversation", source: "WhatsApp Business" });
      audit({ action: "Lead created from WhatsApp", resource: `${lead.name} (${lead.phone})`, context: "Conversation linked; source WhatsApp Business API" });
      return { ok: true, message: `Lead created from the conversation and linked.`, leadId: lead.id };
    }

    // ---------- settings & targets ----------
    case "settings.update": {
      if (role !== "administrator") {
        audit({ action: "Sales settings change denied", resource: "Sales settings", result: "Blocked", severity: "Warning", context: `Role boundary "${role}" holds no configuration authority` });
        return { ok: false, status: 403, code: "admin_required", message: "Sales configuration is restricted to the administrator boundary — changes are validated and audited." };
      }
      const area = str(action.input, "area");
      const value = action.input.value;
      if (!area) return { ok: false, status: 422, code: "area_required", message: "Name the configuration area you are changing." };
      const st = s.settings as unknown as Record<string, unknown>;
      if (!(area in st)) return { ok: false, status: 422, code: "unknown_area", message: "That configuration area does not exist." };
      if (area === "stages" && Array.isArray(value)) {
        // stages cannot be removed while opportunities reference them
        const names = (value as { name: OpportunityStage }[]).map((v) => v.name);
        const inUse = s.opportunities.filter((o) => !["Won", "Lost"].includes(o.stage)).map((o) => o.stage);
        const missing = inUse.filter((stg) => !names.includes(stg));
        if (missing.length > 0) return { ok: false, status: 409, code: "stage_in_use", message: `Cannot remove stage(s) ${[...new Set(missing)].join(", ")} — open opportunities still use them. Re-map those opportunities first.` };
      }
      const before = JSON.stringify(st[area]);
      st[area] = structuredClone(value);
      const after = JSON.stringify(st[area]);
      if (before === after) return { ok: false, status: 422, code: "no_changes", message: "Nothing changed in that area." };
      audit({ action: "Sales settings updated", resource: `Sales settings · ${area}`, severity: "High", context: `Change validated and applied; previous value recoverable from the audit trail` });
      return { ok: true, message: `${area} updated — the change is audited and recoverable.`, settings: s.settings };
    }

    case "target.update": {
      if (role !== "administrator") return { ok: false, status: 403, code: "admin_required", message: "Targets are configured by the administrator boundary — managers see team performance, not quota editing." };
      const id = str(action.input, "id");
      const quotaCr = num(action.input, "quotaCr");
      const t = SALES_TARGETS.find((x) => x.id === id);
      if (!t) return { ok: false, status: 404, code: "not_found", message: "Target row not found." };
      if (quotaCr === undefined || quotaCr < 0) return { ok: false, status: 422, code: "invalid_quota", message: "Enter a non-negative quota." };
      const prev = t.quotaCr;
      t.quotaCr = quotaCr;
      audit({ action: "Sales target updated", resource: `${t.label} (${t.kind})`, severity: "High", context: `Q3 FY27 quota ₹${prev} Cr → ₹${quotaCr} Cr` });
      return { ok: true, message: `${t.label} quota updated to ₹${quotaCr} Cr — change audited.` };
    }

    default:
      return { ok: false, status: 400, code: "unknown_action", message: "Unsupported sales action." };
  }
}

// helper types used only inside the server
type QuoteItemIn = { productId: string; qty: number; discountPct?: number };
type PaymentStateIn = SalesOrder["payment"];
type FulfillmentStateIn = SalesOrder["fulfillment"];

function today0End(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

// re-export for the API route
export { SALES_TEAM_MEMBERS };
