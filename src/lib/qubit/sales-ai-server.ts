// ============================================================
// Qubit One — Sales AI orchestration (SERVER ONLY)
// ============================================================
// Phase 7: the intelligence & decision-support layer on top of the
// Sales Operating System. NOT a source of truth.
//
// Architecture (spec-mandated):
//   Qubit Business Data → Authorization → Retrieval/Context →
//   AI Reasoning → Structured Output → Validation/Policy →
//   Human Review → Approved Action → Qubit Business System
//
// Non-negotiables enforced HERE:
//  · Authorization-first retrieval — every piece of context is
//    fetched through sales-server.salesGet with the session role,
//    so scope (company/team/own) and record-level rules apply to
//    the AI exactly as they apply to the user. AI never reads the
//    raw fixtures directly.
//  · Consequential actions never execute silently — mutations go
//    through sales-server.salesPost (the existing workflows), and
//    recommendation acceptance requires an explicit confirm flag.
//  · Every AI operation is audited via the ONE enterprise trail
//    (security-server.writeAudit).
//  · Fact / inference / recommendation are separated; confidence
//    is coarse (High/Medium/Low/Insufficient data) — never fake
//    precision; missing data is reported, never fabricated.
//  · Provider abstraction lives in ai-engine.ts; nothing here or
//    in the UI depends on a vendor.
// ============================================================

import { writeAudit } from "./security-server";
import { SESSION_USER_ID, type WorkspaceRole } from "./workspace-server";
import { salesGet, salesPost, type SalesScope } from "./sales-server";
import {
  runCompletion,
  parseJsonObject,
  untrustedBlock,
  UNTRUSTED_CONTENT_RULE,
  AI_PROVIDER_LABEL,
  clampText,
} from "./ai-engine";
import { SALES_PERIOD } from "./sales-data";
import { employees } from "./data";
import {
  WRITER_CHANNELS,
  WRITER_LANGUAGES,
  WRITER_LENGTHS,
  WRITER_PURPOSES,
  WRITER_TONES,
} from "./sales-ai-data";
import type {
  AiActivityEntry,
  AiConfidence,
  AiFeedbackEntry,
  AiFeedbackKind,
  AiInsight,
  AiRecommendation,
  AiSourceRef,
  AiQuickAction,
  BriefItem,
  BriefSection,
  DailyBrief,
  NbaVerb,
  QaAnswer,
  WriterChannel,
  WriterContext,
  WriterDraft,
  WriterLanguage,
  WriterLength,
  WriterMode,
  WriterPurpose,
  WriterTone,
} from "./sales-ai-data";

// ---------- authorization ----------

type Gate = { ok: true; scope: SalesScope } | { ok: false; status: number; code: string; message: string };

function gate(role: WorkspaceRole, capability: string): Gate {
  // Reuse the Sales OS boundary — the AI inherits EXACTLY the same
  // effective permissions as the user. Denials are audited there.
  const res = salesGet(role, "home", new URLSearchParams());
  if (res.ok) return { ok: true, scope: (res.data.scope as SalesScope) ?? "own" };
  return { ok: false, status: res.status, code: res.code, message: res.message };
}

/** Authorized retrieval through the Sales enforcement layer. */
function fetchSection<T>(role: WorkspaceRole, section: string, params: Record<string, string> = {}): { ok: true; data: T } | { ok: false; status: number; code: string; message: string } {
  const qs = new URLSearchParams(params);
  const res = salesGet(role, section as never, qs);
  if (!res.ok) return { ok: false, status: res.status, code: res.code, message: res.message };
  return { ok: true, data: res.data as T };
}

// ---------- AI metadata store (in-memory, retention-capped) ----------

interface AiStore {
  dismissedInsights: Set<string>;
  recommendationState: Map<string, { status: "accepted" | "dismissed"; at: number; reason?: string }>;
  dismissedPrioritization: Set<string>;
  feedback: AiFeedbackEntry[];
  activity: AiActivityEntry[];
  qaSessions: Map<string, { role: string; turns: { q: string; a: string; at: number }[] }>;
  briefCache: Map<string, { brief: DailyBrief; at: number }>;
  qaCache: Map<string, { answer: QaAnswer; sources: AiSourceRef[]; at: number }>;
  seq: number;
}

// Phase 20 — globalThis singleton (see workspace-server): one AI store
// across route bundles.
const g = globalThis as unknown as { __qubitSalesAiStore?: AiStore };
function aiStore(): AiStore {
  if (!g.__qubitSalesAiStore) {
    g.__qubitSalesAiStore = {
      dismissedInsights: new Set(),
      recommendationState: new Map(),
      dismissedPrioritization: new Set(),
      feedback: [],
      activity: [],
      qaSessions: new Map(),
      briefCache: new Map(),
      qaCache: new Map(),
      seq: 0,
    };
  }
  return g.__qubitSalesAiStore;
}

function nextAiId(prefix: string): string {
  const s = aiStore();
  s.seq += 1;
  return `${prefix}-${1000 + s.seq}`;
}

function recordActivity(entry: Omit<AiActivityEntry, "id" | "at">) {
  const s = aiStore();
  s.activity.unshift({ id: nextAiId("aia"), at: Date.now(), ...entry });
  if (s.activity.length > 40) s.activity.length = 40; // retention cap
}

function auditAi(args: { action: string; resource: string; context: string; severity?: "Info" | "Warning" | "High"; result?: "Success" | "Blocked" }) {
  writeAudit({
    actorId: SESSION_USER_ID,
    action: args.action,
    resource: args.resource,
    result: args.result ?? "Success",
    severity: args.severity ?? "Info",
    source: "Sales AI",
    context: args.context,
  });
}

// ---------- small helpers ----------

const D = 86_400_000;
const H = 3_600_000;
const now = () => Date.now();

const fmtD = (ts: number) => new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtDT = (ts: number) => new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const nameOf = (id: string | undefined) => (id ? (employees.find((e) => e.id === id)?.name ?? id) : "Unassigned");

const ref = (label: string, kind: string, extra: Partial<AiSourceRef> = {}): AiSourceRef => ({ label, kind, ...extra });

const screenParam: Record<string, string> = {
  "lead-detail": "leadId",
  "contact-detail": "contactId",
  "account-detail": "accountId",
  "opportunity-detail": "opportunityId",
  "quotation-detail": "quotationId",
  "order-detail": "orderId",
  "visit-detail": "visitId",
  "sales-pipeline": "filter",
  "sales-forecast": "filter",
  "followup-queue": "filter",
  "customer-meetings": "meetingId",
  "whatsapp-conversation": "waId",
  "sales-targets": "filter",
};

function entityRef(kind: string, id: string | undefined, label: string, detail?: string): AiSourceRef {
  switch (kind) {
    case "lead": return ref(label, "Lead", { screen: "lead-detail", id, param: "leadId", detail });
    case "opportunity": return ref(label, "Opportunity", { screen: "opportunity-detail", id, param: "opportunityId", detail });
    case "account": return ref(label, "Account", { screen: "account-detail", id, param: "accountId", detail });
    case "contact": return ref(label, "Contact", { screen: "contact-detail", id, param: "contactId", detail });
    case "quotation": return ref(label, "Quotation", { screen: "quotation-detail", id, param: "quotationId", detail });
    case "order": return ref(label, "Order", { screen: "order-detail", id, param: "orderId", detail });
    case "followup": return ref(label, "Follow-up", { screen: "followup-queue", detail });
    case "meeting": return ref(label, "Meeting", { screen: "customer-meetings", id, param: "meetingId", detail });
    case "whatsapp": return ref(label, "WhatsApp", { screen: "whatsapp-conversation", id, param: "waId", detail });
    default: return ref(label, kind);
  }
}

// ============================================================
// Deterministic intelligence — explainable signal models
// ============================================================
// Lead prioritization and opportunity risk use a WEIGHTED SIGNAL
// MODEL with published factors. It is deliberately not a black box:
// the user can inspect every factor and its contribution ("Why this
// ranking?"). Where signals are too thin, the model returns
// "Insufficient data" instead of inventing a score.
// ============================================================

export const PRIORITIZATION_METHODOLOGY = {
  model: "Weighted signal model v1 (explainable)",
  updated: "Q3 FY27",
  factors: [
    { key: "engagement", label: "Engagement recency", weight: 25, description: "How recently the lead saw real activity — calls, emails, WhatsApp, notes." },
    { key: "followup", label: "Follow-up state", weight: 20, description: "Overdue or missing follow-ups raise priority; a healthy scheduled cadence keeps it stable." },
    { key: "value", label: "Estimated value", weight: 20, description: "Larger estimated deals move up when other signals are comparable." },
    { key: "qualification", label: "Qualification state", weight: 15, description: "Qualified and actively-worked leads outrank untouched ones." },
    { key: "source", label: "Source quality", weight: 10, description: "Historical conversion pattern by source (referral, existing customer, WhatsApp…)." },
    { key: "response", label: "Response signal", weight: 10, description: "Inbound contact from the lead within the last 14 days." },
  ],
  note: "Scores are computed from authorized sales records only. When a lead has too few signals, Qubit says 'Insufficient data' instead of inventing a score. AI ranking never overrides the lead's actual business status.",
};

interface PriorRow {
  leadId: string;
  name: string;
  company: string;
  ownerName: string;
  ownerId: string;
  isMine: boolean;
  status: string;
  priority: string;
  aiScore?: number;
  confidence: AiConfidence;
  urgency: "High" | "Medium" | "Low";
  reason: string;
  factors: { key: string; label: string; contribution: number; max: number; note: string }[];
  lastActivityAt?: number;
  nextFollowUpAt?: number;
  estimatedValueCr: number;
  evidence: AiSourceRef[];
  recommendedAction: { label: string; verb: NbaVerb; screen: string; param?: string; id?: string };
  dismissed?: boolean;
}

interface ScopedLead {
  id: string; name: string; company: string; contactPerson: string; source: string; industry: string; location: string;
  ownerId: string; status: string; priority: string; score: number; estimatedValueCr: number;
  nextFollowUpAt?: number; createdAt: number; lastActivityAt: number; notes?: string;
}

interface ScopedActivity { id: string; at: number; type: string; summary: string; outcome?: string; entity: { kind: string; id: string } }

function buildPrioritization(role: WorkspaceRole, scope: SalesScope): { rows: PriorRow[]; counts: { high: number; medium: number; low: number; insufficient: number }; generatedAt: number } {
  const leadsRes = fetchSection<{ rows: (ScopedLead & { activity: ScopedActivity[] })[] }>(role, "leads");
  const generatedAt = now();
  if (!leadsRes.ok) return { rows: [], counts: { high: 0, medium: 0, low: 0, insufficient: 0 }, generatedAt };

  const SOURCE_WEIGHT: Record<string, number> = {
    Referral: 10, "Existing Customer": 10, WhatsApp: 8, Website: 6, Event: 5, Campaign: 5, "Inbound Call": 6, Outreach: 3, Other: 4,
  };

  const rows: PriorRow[] = leadsRes.data.rows.map((l) => {
    const acts = (l.activity ?? []) as ScopedActivity[];
    const lastAct = acts[0];
    const hasActivity = acts.length > 0;
    const hasFollowUp = l.nextFollowUpAt != null;
    const hasValue = l.estimatedValueCr > 0;
    const insufficient = !hasActivity && !hasFollowUp && !hasValue && l.status === "New";

    const factors: PriorRow["factors"] = [];
    // f1 engagement recency (25)
    const idleDays = hasActivity ? Math.floor((generatedAt - (lastAct?.at ?? l.lastActivityAt)) / D) : 999;
    const eng = !hasActivity ? { c: 0, note: "No recorded activity yet" } : idleDays <= 2 ? { c: 25, note: `Activity ${idleDays === 0 ? "today" : `${idleDays}d ago`}` } : idleDays <= 7 ? { c: 18, note: `Activity ${idleDays}d ago` } : idleDays <= 14 ? { c: 10, note: `Activity ${idleDays}d ago` } : idleDays <= 30 ? { c: 4, note: `Last activity ${idleDays}d ago` } : { c: 0, note: `Idle ${idleDays}d` };
    factors.push({ key: "engagement", label: "Engagement recency", contribution: eng.c, max: 25, note: eng.note });
    // f2 follow-up state (20)
    let fu = { c: 0, note: "No follow-up scheduled" };
    if (hasFollowUp) {
      const dueIn = (l.nextFollowUpAt ?? 0) - generatedAt;
      if (dueIn < 0) fu = { c: 20, note: "Follow-up overdue" };
      else if (dueIn < D) fu = { c: 16, note: "Follow-up due today" };
      else if (dueIn < 3 * D) fu = { c: 10, note: `Follow-up in ${Math.ceil(dueIn / D)}d` };
      else fu = { c: 6, note: `Follow-up in ${Math.ceil(dueIn / D)}d` };
    } else {
      fu = { c: 14, note: "No follow-up scheduled — gap" };
    }
    factors.push({ key: "followup", label: "Follow-up state", contribution: fu.c, max: 20, note: fu.note });
    // f3 value (20)
    const val = !hasValue ? { c: 0, note: "No estimated value yet" } : l.estimatedValueCr >= 1 ? { c: 20, note: `₹${l.estimatedValueCr} Cr deal` } : l.estimatedValueCr >= 0.5 ? { c: 15, note: `₹${l.estimatedValueCr} Cr deal` } : l.estimatedValueCr >= 0.25 ? { c: 10, note: `₹${l.estimatedValueCr} Cr deal` } : { c: 5, note: `₹${l.estimatedValueCr} Cr deal` };
    factors.push({ key: "value", label: "Estimated value", contribution: val.c, max: 20, note: val.note });
    // f4 qualification (15)
    const qual = l.status === "Qualified" ? { c: 15, note: "Qualified" } : l.status === "Working" ? { c: 10, note: "Being worked" } : l.status === "New" ? { c: 6, note: "Not yet worked" } : { c: 0, note: l.status };
    factors.push({ key: "qualification", label: "Qualification state", contribution: qual.c, max: 15, note: qual.note });
    // f5 source (10)
    const srcC = SOURCE_WEIGHT[l.source] ?? 4;
    factors.push({ key: "source", label: "Source quality", contribution: srcC, max: 10, note: `Source: ${l.source}` });
    // f6 response signal (10)
    const inbound = acts.find((a) => ["WhatsApp", "Email", "Call"].includes(a.type) && generatedAt - a.at < 14 * D);
    const resp = inbound ? (generatedAt - inbound.at < 7 * D ? { c: 10, note: `Inbound ${inbound.type.toLowerCase()} ${Math.floor((generatedAt - inbound.at) / D)}d ago` } : { c: 6, note: `Inbound ${inbound.type.toLowerCase()} ${Math.floor((generatedAt - inbound.at) / D)}d ago` }) : { c: 0, note: "No inbound contact in 14 days" };
    factors.push({ key: "response", label: "Response signal", contribution: resp.c, max: 10, note: resp.note });

    const score = factors.reduce((s, f) => s + f.contribution, 0);
    const confidence: AiConfidence = insufficient ? "Insufficient data" : hasActivity || hasFollowUp ? "High" : "Medium";
    const urgency = insufficient ? "Low" : score >= 70 ? "High" : score >= 45 ? "Medium" : "Low";

    // deterministic reason — built from the top contributing factors, never invented
    const top = [...factors].filter((f) => f.contribution > 0).sort((a, b) => b.contribution - a.contribution).slice(0, 2);
    const reason = insufficient
      ? "Insufficient data for reliable prioritization — no activity history, no scheduled follow-up and no estimated value yet. Work the lead once before the model can rank it."
      : top.length === 0
        ? "All signals are quiet — the lead is not a priority right now."
        : `${top.map((f) => f.note.replace(/^Activity/, "Recent activity").replace(/^Inbound/, "Recent inbound")).join("; ")}.`;

    const recommendedAction = insufficient
      ? { label: "Open lead & qualify first", verb: "contact" as NbaVerb, screen: "lead-detail", param: "leadId", id: l.id }
      : fu.c === 20 || fu.c === 14
        ? { label: "Schedule follow-up", verb: "schedule-followup" as NbaVerb, screen: "lead-detail", param: "leadId", id: l.id }
        : qual.c === 15 && hasValue
          ? { label: "Create opportunity", verb: "update-opportunity" as NbaVerb, screen: "lead-detail", param: "leadId", id: l.id }
          : { label: "Open lead", verb: "contact" as NbaVerb, screen: "lead-detail", param: "leadId", id: l.id };

    return {
      leadId: l.id,
      name: l.name,
      company: l.company,
      ownerName: nameOf(l.ownerId),
      ownerId: l.ownerId,
      isMine: l.ownerId === SESSION_USER_ID,
      status: l.status,
      priority: l.priority,
      aiScore: insufficient ? undefined : score,
      confidence,
      urgency,
      reason,
      factors,
      lastActivityAt: lastAct?.at ?? l.lastActivityAt,
      nextFollowUpAt: l.nextFollowUpAt,
      estimatedValueCr: l.estimatedValueCr,
      evidence: [
        entityRef("lead", l.id, `${l.name} — ${l.company}`, lastAct ? `Last activity ${fmtDT(lastAct.at)}` : "No activity recorded"),
        ...(lastAct ? [{ ...entityRef("lead", l.id, `${lastAct.type}: ${clampText(lastAct.summary, 90)}`, `Recorded ${fmtDT(lastAct.at)}`) }] : []),
      ],
      recommendedAction,
      dismissed: aiStore().dismissedPrioritization.has(l.id) || undefined,
    };
  });

  rows.sort((a, b) => {
    if (a.dismissed !== b.dismissed) return a.dismissed ? 1 : -1;
    const sa = a.aiScore ?? -1;
    const sb = b.aiScore ?? -1;
    return sb - sa;
  });
  const counts = {
    high: rows.filter((r) => r.urgency === "High" && !r.dismissed).length,
    medium: rows.filter((r) => r.urgency === "Medium" && !r.dismissed).length,
    low: rows.filter((r) => r.urgency === "Low" && !r.dismissed).length,
    insufficient: rows.filter((r) => r.confidence === "Insufficient data" && !r.dismissed).length,
  };
  return { rows, counts, generatedAt };
}

// ---------- opportunity intelligence (pipeline review + NBA) ----------

interface ScopedOpp {
  id: string; name: string; accountId: string; ownerId: string; stage: string; probability: number;
  valueCr: number; expectedClose: string; nextAction?: string; nextFollowUpAt?: number; quotationId?: string;
  riskNote?: string; slippedFrom?: string; createdAt: number; lastStageChangeAt: number;
  activity?: ScopedActivity[]; account?: { id: string; name: string };
}

function parseClose(expectedClose: string): number | null {
  // Phase 6 uses display strings like "18 Dec 2026" or "TBD"
  const t = Date.parse(expectedClose);
  return Number.isNaN(t) ? null : t;
}

function oppSignals(o: ScopedOpp, activities: ScopedActivity[]) {
  const idleStageDays = Math.floor((now() - o.lastStageChangeAt) / D);
  const lastAct = activities.find((a) => a.entity.kind === "opportunity" && a.entity.id === o.id);
  const idleActDays = lastAct ? Math.floor((now() - lastAct.at) / D) : null;
  const close = parseClose(o.expectedClose);
  const overdueClose = close != null && close < now();
  const closingSoon = close != null && close > now() && close - now() < 7 * D;
  const stalled = idleStageDays >= 14 || (idleActDays != null && idleActDays >= 14);
  const noNextStep = !o.nextAction && o.nextFollowUpAt == null;
  const lateStage = ["Proposal", "Negotiation", "Contracting"].includes(o.stage);
  return { idleStageDays, idleActDays, close, overdueClose, closingSoon, stalled, noNextStep, lateStage, lastAct };
}

function buildOppInsights(role: WorkspaceRole, scope: SalesScope): { insights: AiInsight[]; opps: ScopedOpp[]; accountNameOf: (id: string) => string } {
  const oppsRes = fetchSection<{ rows: (ScopedOpp & { activity: ScopedActivity[]; account?: { id: string; name: string } })[] }>(role, "opportunities");
  const generatedAt = now();
  if (!oppsRes.ok) return { insights: [], opps: [], accountNameOf: () => "—" };
  const opps = oppsRes.data.rows;
  const accountNameOf = (id: string) => opps.find((o) => o.accountId === id)?.account?.name ?? "—";

  const insights: AiInsight[] = [];
  const freshnessLabel = `Opportunity data as of ${SALES_PERIOD.asOfLabel}`;

  // 1. large deals at risk (highest value first)
  const atRisk = opps
    .filter((o) => o.stage !== "Won" && o.stage !== "Lost")
    .map((o) => ({ o, sig: oppSignals(o, (o.activity ?? []) as ScopedActivity[]) }))
    .filter(({ o, sig }) => o.valueCr >= 0.5 && (sig.stalled || o.slippedFrom || (sig.overdueClose && sig.lateStage)))
    .sort((a, b) => b.o.valueCr - a.o.valueCr)
    .slice(0, 2);
  for (const { o, sig } of atRisk) {
    insights.push({
      id: `ins-risk-${djb2(o.id)}`,
      capability: "Pipeline review",
      kind: "risk",
      title: `${accountNameOf(o.accountId)} — ₹${o.valueCr} Cr deal showing stall signals`,
      statement: `Based on current pipeline data, “${o.name}” may be at risk: no stage movement for ${sig.idleStageDays} days${sig.idleActDays != null ? ` and no recorded activity for ${sig.idleActDays} days` : ""}${o.slippedFrom ? `, and the close date slipped from ${o.slippedFrom}` : ""}.`,
      facts: [
        `Opportunity value is ₹${o.valueCr} Cr at ${o.probability}% probability (stage ${o.stage}).`,
        `Stage last changed ${sig.idleStageDays} days ago${sig.lastAct ? `; last activity ${fmtDT(sig.lastAct.at)}` : "; no activity recorded"}.`,
        o.slippedFrom ? `Expected close moved from ${o.slippedFrom} to ${o.expectedClose}.` : `Expected close ${o.expectedClose}.`,
      ],
      evidence: [
        entityRef("opportunity", o.id, o.name, `Stage ${o.stage} · ₹${o.valueCr} Cr`),
        entityRef("account", o.accountId, accountNameOf(o.accountId)),
      ],
      confidence: sig.idleStageDays >= 21 || o.slippedFrom ? "High" : "Medium",
      generatedAt,
      freshnessLabel,
      entity: { label: o.name, screen: "opportunity-detail", id: o.id, param: "opportunityId" },
      action: { label: "Review opportunity", screen: "opportunity-detail", id: o.id, param: "opportunityId" },
    });
  }

  // 2. unrealistic close dates
  const unrealistic = opps
    .filter((o) => o.stage !== "Won" && o.stage !== "Lost")
    .map((o) => ({ o, sig: oppSignals(o, (o.activity ?? []) as ScopedActivity[]) }))
    .filter(({ o, sig }) => sig.close != null && sig.closingSoon && ["New", "Qualification", "Discovery"].includes(o.stage))
    .slice(0, 1);
  for (const { o } of unrealistic) {
    insights.push({
      id: `ins-close-${djb2(o.id)}`,
      capability: "Pipeline review",
      kind: "attention",
      title: `Close date may be unrealistic — ${accountNameOf(o.accountId)}`,
      statement: `“${o.name}” expects to close ${fmtD(parseClose(o.expectedClose)!)} but is still at ${o.stage}. Deals at this stage historically need 2–3 more gates before contracting.`,
      facts: [`Expected close ${fmtD(parseClose(o.expectedClose)!)} (within 7 days).`, `Current stage: ${o.stage} at ${o.probability}%.`],
      evidence: [entityRef("opportunity", o.id, o.name, `Close ${o.expectedClose} · stage ${o.stage}`)],
      confidence: "Medium",
      generatedAt,
      freshnessLabel,
      entity: { label: o.name, screen: "opportunity-detail", id: o.id, param: "opportunityId" },
    });
  }

  // 3. missing next actions
  const missingNext = opps
    .filter((o) => o.stage !== "Won" && o.stage !== "Lost" && !o.nextAction && o.nextFollowUpAt == null)
    .sort((a, b) => b.valueCr - a.valueCr)
    .slice(0, 1);
  if (missingNext.length > 0) {
    const o = missingNext[0];
    insights.push({
      id: `ins-next-${djb2(o.id)}`,
      capability: "Pipeline review",
      kind: "attention",
      title: `Open deal with no next step — ${accountNameOf(o.accountId)}`,
      statement: `“${o.name}” (₹${o.valueCr} Cr) has no next action and no scheduled follow-up. Deals without a next step are the most common silent-loss pattern in the pipeline.`,
      facts: [`Value ₹${o.valueCr} Cr · stage ${o.stage}.`, `nextAction is empty and no follow-up is scheduled.`],
      evidence: [entityRef("opportunity", o.id, o.name, "No next action recorded")],
      confidence: "High",
      generatedAt,
      freshnessLabel,
      entity: { label: o.name, screen: "opportunity-detail", id: o.id, param: "opportunityId" },
      action: { label: "Open opportunity", screen: "opportunity-detail", id: o.id, param: "opportunityId" },
    });
  }

  // 4. concentration risk
  const open = opps.filter((o) => o.stage !== "Won" && o.stage !== "Lost");
  const totalValue = open.reduce((s, o) => s + o.valueCr, 0);
  const byAccount = new Map<string, number>();
  for (const o of open) byAccount.set(o.accountId, (byAccount.get(o.accountId) ?? 0) + o.valueCr);
  const topAccount = [...byAccount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topAccount && totalValue > 0 && topAccount[1] / totalValue >= 0.4) {
    insights.push({
      id: `ins-conc-${djb2(topAccount[0])}`,
      capability: "Pipeline review",
      kind: "risk",
      title: `Pipeline concentration — ${accountNameOf(topAccount[0])} is ${Math.round((topAccount[1] / totalValue) * 100)}% of open value`,
      statement: `${accountNameOf(topAccount[0])} accounts for ₹${topAccount[1].toFixed(2)} Cr of ₹${totalValue.toFixed(2)} Cr open pipeline. A single decision there would move the quarter materially — in either direction.`,
      facts: [`Top account share: ₹${topAccount[1].toFixed(2)} Cr / ₹${totalValue.toFixed(2)} Cr (${Math.round((topAccount[1] / totalValue) * 100)}%).`, `Open opportunities in scope: ${open.length}.`],
      evidence: [entityRef("account", topAccount[0], accountNameOf(topAccount[0]), `Open value ₹${topAccount[1].toFixed(2)} Cr`), ref("Sales Pipeline", "Pipeline", { screen: "sales-pipeline" })],
      confidence: "High",
      generatedAt,
      freshnessLabel,
    });
  }

  // 5. stage bottleneck
  const stages = ["New", "Qualification", "Discovery", "Proposal", "Negotiation", "Contracting"];
  const bottleneck = stages
    .map((st) => ({ st, n: open.filter((o) => o.stage === st).length }))
    .filter((x) => open.length >= 5 && x.n / open.length >= 0.35)
    .sort((a, b) => b.n - a.n)[0];
  if (bottleneck) {
    insights.push({
      id: `ins-btl-${djb2(bottleneck.st)}`,
      capability: "Pipeline review",
      kind: "attention",
      title: `${bottleneck.st} holds ${Math.round((bottleneck.n / open.length) * 100)}% of open deals`,
      statement: `${bottleneck.n} of ${open.length} open opportunities are sitting in ${bottleneck.st}. Based on stage progression patterns, this looks like the current bottleneck — worth a pass to advance or disqualify.`,
      facts: [`${bottleneck.n}/${open.length} open deals at ${bottleneck.st}.`],
      evidence: [ref("Sales Pipeline", "Pipeline", { screen: "sales-pipeline" })],
      confidence: "Medium",
      generatedAt,
      freshnessLabel,
      action: { label: "Open Pipeline", screen: "sales-pipeline" },
    });
  }

  // 6. overdue follow-up pressure
  const fuRes = fetchSection<{ rows: { id: string; subject: string; state: string; dueAt: number; ownerId: string; leadId?: string; opportunityId?: string }[] }>(role, "followups");
  if (fuRes.ok) {
    const overdue = fuRes.data.rows.filter((f) => f.state === "Overdue");
    if (overdue.length >= 3) {
      insights.push({
        id: `ins-fu-${djb2(overdue.map((f) => f.id).join(","))}`,
        capability: "Sales AI Home",
        kind: "attention",
        title: `${overdue.length} follow-ups are overdue`,
        statement: `Based on the follow-up queue, ${overdue.length} follow-ups in your scope are overdue. Response lag compounds: the longer a customer waits, the colder the thread gets.`,
        facts: [`${overdue.length} overdue follow-ups. Oldest: “${clampText(overdue[0]?.subject ?? "", 60)}” (${fmtD(overdue[0]?.dueAt ?? now())}).`],
        evidence: [ref("Follow-up Queue", "Follow-ups", { screen: "followup-queue" }), ...overdue.slice(0, 2).map((f) => ref(clampText(f.subject, 60), "Follow-up", { screen: "followup-queue", detail: `Due ${fmtD(f.dueAt)}` }))],
        confidence: "High",
        generatedAt,
        freshnessLabel,
        action: { label: "Open Follow-up Queue", screen: "followup-queue" },
      });
    }
  }

  return { insights, opps, accountNameOf };
}

// ---------- recommendations (Next Best Action) ----------

function buildRecommendations(role: WorkspaceRole, scope: SalesScope): AiRecommendation[] {
  const state = aiStore().recommendationState;
  const generatedAt = now();
  const recs: AiRecommendation[] = [];
  const push = (r: Omit<AiRecommendation, "generatedAt" | "status">) =>
    recs.push({ ...r, generatedAt, status: state.get(r.id)?.status ?? "open" });

  const { opps, accountNameOf } = buildOppInsights(role, scope);
  const fuRes = fetchSection<{ rows: { id: string; type: string; subject: string; state: string; dueAt: number; priority: string; leadId?: string; opportunityId?: string; accountId?: string }[] }>(role, "followups");

  // 1. overdue follow-ups
  if (fuRes.ok) {
    for (const f of fuRes.data.rows.filter((x) => x.state === "Overdue").slice(0, 3)) {
      push({
        id: `nba-fu-${djb2(f.id)}`,
        verb: "contact",
        action: "Complete or reschedule the overdue follow-up",
        reason: `The ${f.type} follow-up “${clampText(f.subject, 60)}” was due ${fmtD(f.dueAt)} and is still open. Overdue follow-ups are the strongest leading indicator of slipping deals.`,
        facts: [`Follow-up due ${fmtD(f.dueAt)} · state Overdue.`, f.opportunityId ? `Linked opportunity: ${f.opportunityId}.` : "Linked to a lead in your scope."],
        evidence: [ref(clampText(f.subject, 60), "Follow-up", { screen: "followup-queue", detail: `Due ${fmtD(f.dueAt)} · overdue` })],
        urgency: "High",
        confidence: "High",
        expectedImpact: "Protects the deal's momentum; overdue threads lose warmth quickly.",
        entity: { kind: "followup", id: f.id, label: clampText(f.subject, 60), screen: "followup-queue", param: "filter" },
        routesTo: "Existing Follow-up Queue workflow (84) — complete with an outcome or reschedule",
      });
    }
  }

  // 2. hot/qualified leads with no follow-up scheduled
  const pr = buildPrioritization(role, scope);
  for (const row of pr.rows.filter((r) => !r.dismissed && r.aiScore != null && r.aiScore >= 60 && r.nextFollowUpAt == null).slice(0, 2)) {
    push({
      id: `nba-lead-${djb2(row.leadId)}`,
      verb: "schedule-followup",
      action: "Schedule a follow-up within 24 hours",
      reason: `${row.name} (${row.company}) scores ${row.aiScore}/100 on the prioritization model and has no follow-up scheduled. ${row.reason}`,
      facts: [`AI priority score ${row.aiScore}/100 (explainable factors on the prioritization screen).`, `No follow-up scheduled.`],
      evidence: row.evidence,
      urgency: "High",
      confidence: row.confidence,
      expectedImpact: row.estimatedValueCr > 0 ? `Keeps a ₹${row.estimatedValueCr} Cr lead engaged.` : undefined,
      entity: { kind: "lead", id: row.leadId, label: `${row.name} — ${row.company}`, screen: "lead-detail", param: "leadId" },
      routesTo: "Existing lead follow-up workflow (75) — schedules into the Follow-up Queue (84)",
    });
  }

  // 3. stalled opportunities
  for (const { o, sig } of opps
    .filter((o) => o.stage !== "Won" && o.stage !== "Lost")
    .map((o) => ({ o, sig: oppSignals(o, (o.activity ?? []) as ScopedActivity[]) }))
    .filter(({ sig }) => sig.stalled)
    .sort((a, b) => b.o.valueCr - a.o.valueCr)
    .slice(0, 2)) {
    push({
      id: `nba-stall-${djb2(o.id)}`,
      verb: "update-opportunity",
      action: "Review the stalled opportunity and set a next step",
      reason: `“${o.name}” (${accountNameOf(o.accountId)}) hasn't moved in ${sig.idleStageDays} days${sig.idleActDays != null ? ` — last activity ${sig.idleActDays} days ago` : ""}. Either re-engage the customer or honestly re-stage the deal.`,
      facts: [`₹${o.valueCr} Cr · stage ${o.stage} · ${o.probability}% probability.`, `No stage change for ${sig.idleStageDays} days.`],
      evidence: [entityRef("opportunity", o.id, o.name, `Stage ${o.stage} · idle ${sig.idleStageDays}d`), entityRef("account", o.accountId, accountNameOf(o.accountId))],
      urgency: o.valueCr >= 0.75 ? "High" : "Medium",
      confidence: "Medium",
      expectedImpact: `₹${o.valueCr} Cr of pipeline either revives or is honestly re-forecast.`,
      entity: { kind: "opportunity", id: o.id, label: o.name, screen: "opportunity-detail", param: "opportunityId" },
      routesTo: "Opportunity Detail (79) — stage changes stay controlled and audited",
    });
  }

  // 4. quotation viewed but no follow-up scheduled
  const qRes = fetchSection<{ rows: { id: string; number: string; status: string; accountName: string; total: number; viewedAt?: number; sentAt?: number }[] }>(role, "quotations");
  if (qRes.ok) {
    const viewed = qRes.data.rows.filter((q) => q.status === "Viewed").slice(0, 1);
    for (const q of viewed) {
      push({
        id: `nba-quote-${djb2(q.id)}`,
        verb: "contact",
        action: "Follow up on the viewed quotation",
        reason: `Quotation ${q.number} for ${q.accountName} (${fmtRupeesShort(q.total)}) was viewed but the customer hasn't responded. A quiet check-in within 48 hours converts noticeably better than waiting.`,
        facts: [`Quotation ${q.number} · status Viewed${q.viewedAt ? ` · viewed ${fmtD(q.viewedAt)}` : ""}.`, `Value ${fmtRupeesShort(q.total)}.`],
        evidence: [entityRef("quotation", q.id, q.number, `Status ${q.status} · ${fmtRupeesShort(q.total)}`)],
        urgency: "High",
        confidence: "Medium",
        expectedImpact: `${fmtRupeesShort(q.total)} sits behind this thread.`,
        entity: { kind: "quotation", id: q.id, label: `${q.number} — ${q.accountName}`, screen: "quotation-detail", param: "quotationId" },
        routesTo: "Quotation Detail (88) — then record the outreach on the timeline",
      });
    }
  }

  // 5. meeting tomorrow without agenda
  const mRes = fetchSection<{ rows: { id: string; title: string; startAt: number; agenda?: string; accountId: string; accountName?: string }[] }>(role, "meetings");
  if (mRes.ok) {
    const soon = mRes.data.rows
      .filter((m) => m.startAt > now() && m.startAt - now() < 26 * H && !m.agenda)
      .sort((a, b) => a.startAt - b.startAt)
      .slice(0, 1);
    for (const m of soon) {
      push({
        id: `nba-meet-${djb2(m.id)}`,
        verb: "arrange-meeting",
        action: "Prepare an agenda for tomorrow's meeting",
        reason: `“${m.title}” starts ${fmtDT(m.startAt)} and has no agenda on record. Meetings with a written agenda produce cleaner next steps.`,
        facts: [`Meeting scheduled ${fmtDT(m.startAt)}.`, `Agenda is empty.`],
        evidence: [entityRef("meeting", m.id, m.title, `Starts ${fmtDT(m.startAt)}`)],
        urgency: "Medium",
        confidence: "High",
        entity: { kind: "account", id: m.accountId, label: m.accountName ?? m.title, screen: "customer-meetings", param: "meetingId" },
        routesTo: "Customer Meetings (85) — set the agenda in the existing workspace",
      });
    }
  }

  // 6. wait — recently completed follow-up with future one scheduled
  if (fuRes.ok) {
    const waiting = fuRes.data.rows.filter((f) => f.state === "Upcoming" && f.dueAt - now() > 2 * D).slice(0, 1);
    if (waiting.length > 0 && recs.filter((r) => r.urgency === "High").length >= 2) {
      const f = waiting[0];
      push({
        id: `nba-wait-${djb2(f.id)}`,
        verb: "wait",
        action: "Wait for the customer — next touch is already scheduled",
        reason: `The next follow-up “${clampText(f.subject, 60)}” is scheduled for ${fmtDT(f.dueAt)}. With high-urgency threads already open, double-touching the same customer now risks noise, not signal.`,
        facts: [`Next scheduled touch ${fmtDT(f.dueAt)}.`],
        evidence: [ref(clampText(f.subject, 60), "Follow-up", { screen: "followup-queue", detail: `Due ${fmtDT(f.dueAt)}` })],
        urgency: "Low",
        confidence: "Medium",
        entity: { kind: "followup", id: f.id, label: clampText(f.subject, 60), screen: "followup-queue", param: "filter" },
        routesTo: "No action — the existing cadence continues",
      });
    }
  }

  const order = { High: 0, Medium: 1, Low: 2 };
  return recs.sort((a, b) => order[a.urgency] - order[b.urgency]);
}

function fmtRupeesShort(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

// ============================================================
// GET sections
// ============================================================

export type SalesAiSection =
  | "home" | "prioritization" | "writer-entities" | "writer-context" | "customer-summary"
  | "nba" | "pipeline-review" | "brief" | "activity" | "qa-suggestions";

export function salesAiSectionAllowed(s: string | null): s is SalesAiSection {
  return !!s && ["home", "prioritization", "writer-entities", "writer-context", "customer-summary", "nba", "pipeline-review", "brief", "activity", "qa-suggestions"].includes(s);
}

export type SalesAiActionResult =
  | { ok: true; message: string; [k: string]: unknown }
  | { ok: false; status: number; code: string; message: string };

const QUICK_ACTIONS: AiQuickAction[] = [
  { label: "Prioritize my leads", description: "Explainable ranking of the leads you own", screen: "ai-lead-prioritization", num: "104" },
  { label: "Review my pipeline", description: "Stalled deals, aging and forecast risks", screen: "ai-pipeline-review", num: "108" },
  { label: "Prepare today's brief", description: "What matters today, personalized by role", screen: "ai-daily-brief", num: "109" },
  { label: "Summarize a customer", description: "Evidence-based Customer 360 summary", screen: "ai-customer-summary", num: "106" },
  { label: "Draft a follow-up", description: "AI-assisted writing, always reviewed by you", screen: "ai-followup-writer", num: "105" },
  { label: "Ask Sales AI", description: "Grounded answers from authorized sales data", screen: "ai-sales-qa", num: "110" },
];

export function salesAiGet(role: WorkspaceRole, section: SalesAiSection, params: URLSearchParams): { ok: true; data: Record<string, unknown> } | { ok: false; status: number; code: string; message: string } {
  const g = gate(role, `Sales AI · ${section}`);
  if (!g.ok) return g;
  const { scope } = g;
  const id = params.get("id");
  const kind = params.get("kind") ?? "lead";

  switch (section) {
    case "home": {
      const { insights } = buildOppInsights(role, scope);
      const pr = buildPrioritization(role, scope);
      const recs = buildRecommendations(role, scope).filter((r) => r.status === "open").slice(0, 5);
      const fuRes = fetchSection<{ rows: { state: string }[] }>(role, "followups");
      const overdue = fuRes.ok ? fuRes.data.rows.filter((f) => f.state === "Overdue").length : 0;
      const pipeRes = fetchSection<{ totals: { gross: number; weighted: number; count: number } }>(role, "pipeline");
      const s = aiStore();
      return {
        ok: true,
        data: {
          scope,
          period: SALES_PERIOD,
          generatedAt: now(),
          freshnessLabel: SALES_PERIOD.asOfLabel,
          modelLabel: AI_PROVIDER_LABEL,
          overview: {
            highPriorityLeads: pr.counts.high,
            leadsInsufficient: pr.counts.insufficient,
            oppsAtRisk: insights.filter((i) => i.kind === "risk").length,
            overdueFollowups: overdue,
            pipelineCr: pipeRes.ok ? Math.round(pipeRes.data.totals.gross * 100) / 100 : 0,
            pipelineCount: pipeRes.ok ? pipeRes.data.totals.count : 0,
            recommendationsOpen: recs.length,
          },
          insights: insights.filter((i) => !s.dismissedInsights.has(i.id)).slice(0, 4),
          recommendations: recs,
          quickActions: QUICK_ACTIONS,
          activity: s.activity.slice(0, 6),
        },
      };
    }

    case "prioritization": {
      const pr = buildPrioritization(role, scope);
      return { ok: true, data: { scope, methodology: PRIORITIZATION_METHODOLOGY, rows: pr.rows, counts: pr.counts, generatedAt: pr.generatedAt, freshnessLabel: SALES_PERIOD.asOfLabel, modelLabel: AI_PROVIDER_LABEL } };
    }

    case "writer-entities": {
      const leadsRes = fetchSection<{ rows: ScopedLead[] }>(role, "leads");
      const oppsRes = fetchSection<{ rows: (ScopedOpp & { account?: { name: string } })[] }>(role, "opportunities");
      const leads = leadsRes.ok
        ? leadsRes.data.rows
            .filter((l) => ["New", "Working", "Qualified"].includes(l.status))
            .map((l) => ({ kind: "lead" as const, id: l.id, label: `${l.name} — ${l.company}`, meta: `${l.status} · ₹${l.estimatedValueCr} Cr` }))
        : [];
      const opps = oppsRes.ok
        ? oppsRes.data.rows
            .filter((o) => o.stage !== "Won" && o.stage !== "Lost")
            .map((o) => ({ kind: "opportunity" as const, id: o.id, label: o.name, meta: `${o.stage} · ₹${o.valueCr} Cr` }))
        : [];
      return { ok: true, data: { leads: leads.slice(0, 20), opportunities: opps.slice(0, 20), scope } };
    }

    case "writer-context": {
      const ctx = buildWriterContext(role, scope, kind, id);
      if (!ctx.ok) return ctx;
      return { ok: true, data: { context: ctx.context, scope } };
    }

    case "customer-summary": {
      const accId = params.get("accountId");
      const sum = buildCustomerSummary(role, scope, accId);
      if (!sum.ok) return sum;
      return { ok: true, data: { ...sum.data, scope } };
    }

    case "nba": {
      let recs = buildRecommendations(role, scope);
      const entityId = params.get("entityId");
      if (entityId) recs = recs.filter((r) => r.entity.id === entityId);
      return { ok: true, data: { scope, recommendations: recs, generatedAt: now(), freshnessLabel: SALES_PERIOD.asOfLabel, modelLabel: AI_PROVIDER_LABEL } };
    }

    case "pipeline-review": {
      const pipeRes = fetchSection<{ columns: { stage: string; count: number; value: number; weighted: number }[]; totals: { gross: number; weighted: number; count: number } }>(role, "pipeline");
      const { insights, opps, accountNameOf } = buildOppInsights(role, scope);
      const open = opps.filter((o) => o.stage !== "Won" && o.stage !== "Lost");
      const ages = open.map((o) => Math.floor((now() - o.createdAt) / D)).sort((a, b) => a - b);
      const medianAge = ages.length ? ages[Math.floor(ages.length / 2)] : 0;
      const oldestAge = ages.length ? ages[ages.length - 1] : 0;
      // AI estimate — decayed probability model, ALWAYS separate from weighted/actual
      const decayed = open.reduce((s, o) => {
        const sig = oppSignals(o, []);
        const p = sig.idleStageDays >= 21 ? o.probability * 0.7 : sig.idleStageDays >= 14 ? o.probability * 0.85 : o.probability;
        return s + (o.valueCr * p) / 100;
      }, 0);
      const fcRes = fetchSection<{ summary: { commit: number; bestCase: number; gap: number; target: number } }>(role, "forecast");
      return {
        ok: true,
        data: {
          scope,
          period: SALES_PERIOD,
          generatedAt: now(),
          freshnessLabel: SALES_PERIOD.asOfLabel,
          modelLabel: AI_PROVIDER_LABEL,
          overview: pipeRes.ok
            ? { ...pipeRes.data.totals, agingMedianDays: medianAge, agingOldestDays: oldestAge, stageDistribution: pipeRes.data.columns.map((c) => ({ stage: c.stage, count: c.count, value: Math.round(c.value * 100) / 100 })) }
            : null,
          insights: insights.filter((i) => !aiStore().dismissedInsights.has(i.id)),
          forecast: {
            // ACTUAL / FORECAST come from the Sales OS; AI ESTIMATE is separate and informational
            commitCr: fcRes.ok ? Math.round(fcRes.data.summary.commit * 100) / 100 : null,
            bestCaseCr: fcRes.ok ? Math.round(fcRes.data.summary.bestCase * 100) / 100 : null,
            targetCr: fcRes.ok ? Math.round(fcRes.data.summary.target * 100) / 100 : null,
            aiEstimateCr: Math.round(decayed * 100) / 100,
            aiModelNote: "Decayed probability model v1 — open deals idle ≥21 days are weighted at 70% of their stage probability, ≥14 days at 85%. Informational only; it never changes the forecast.",
          },
          drilldown: [
            { label: "Pipeline", screen: "sales-pipeline" },
            { label: "Opportunity", screen: "opportunity-detail" },
            { label: "Customer", screen: "account-detail" },
            { label: "Activity", screen: "customer-activity" as never },
          ],
          accountNameOf: undefined,
          opps: open.slice(0, 8).map((o) => ({ id: o.id, name: o.name, accountName: accountNameOf(o.accountId), stage: o.stage, valueCr: o.valueCr, probability: o.probability })),
        },
      };
    }

    case "brief": {
      const refresh = params.get("refresh") === "1";
      const key = `${role}:${scope}`;
      const cached = aiStore().briefCache.get(key);
      const todayKey = new Date().toDateString();
      if (!refresh && cached && new Date(cached.at).toDateString() === todayKey && now() - cached.at < 5 * 60_000) {
        return { ok: true, data: { brief: cached.brief, cached: true, scope } };
      }
      const brief = buildBrief(role, scope);
      aiStore().briefCache.set(key, { brief, at: now() });
      return { ok: true, data: { brief, cached: false, scope } };
    }

    case "activity": {
      return { ok: true, data: { rows: aiStore().activity, scope } };
    }

    case "qa-suggestions": {
      return { ok: true, data: { questions: QA_SUGGESTIONS, scope, sessions: [...aiStore().qaSessions.keys()].length } };
    }
  }
}

const QA_SUGGESTIONS = [
  "What are my highest-priority leads?",
  "Which opportunities have been inactive for more than 14 days?",
  "How is my pipeline performing against target?",
  "Which quotations are waiting for approval?",
  "Which opportunities are at risk?",
  "What should I focus on today?",
  "Which follow-ups are overdue?",
];

// ============================================================
// Writer context + customer summary builders
// ============================================================

function buildWriterContext(role: WorkspaceRole, scope: SalesScope, kind: string, id: string | null): { ok: true; context: WriterContext } | { ok: false; status: number; code: string; message: string } {
  if (!id) return { ok: false, status: 422, code: "id_required", message: "Select a lead, opportunity or account first." };

  if (kind === "lead") {
    const res = fetchSection<{ lead: ScopedLead & { contactPerson: string; email: string; phone: string; activity: ScopedActivity[] } }>(role, "lead", { id });
    if (!res.ok) return res;
    const l = res.data.lead;
    const waRes = fetchSection<{ rows: { id: string; waNumber: string; contactName: string; leadId?: string; ownerId: string; status: string }[] }>(role, "whatsapp");
    const wa = waRes.ok ? waRes.data.rows.find((c) => c.leadId === l.id) : undefined;
    const lastAct = l.activity?.[0];
    return {
      ok: true,
      context: {
        entityKind: "lead",
        entityId: l.id,
        title: l.name,
        company: l.company,
        ownerName: nameOf(l.ownerId),
        contactName: l.contactPerson,
        channelReady: { email: true, whatsapp: !!wa, note: true },
        whatsapp: wa ? { conversationId: wa.id, contactName: wa.contactName, waNumber: wa.waNumber } : undefined,
        stageOrStatus: l.status,
        dealValue: l.estimatedValueCr > 0 ? `₹${l.estimatedValueCr} Cr` : undefined,
        lastInteraction: lastAct ? { at: lastAct.at, type: lastAct.type, summary: clampText(lastAct.summary, 160) } : undefined,
        nextFollowUpAt: l.nextFollowUpAt,
        sourceRefs: [
          entityRef("lead", l.id, `${l.name} — ${l.company}`, `Status ${l.status}`),
          ...(lastAct ? [entityRef("lead", l.id, `${lastAct.type}: ${clampText(lastAct.summary, 80)}`, fmtDT(lastAct.at))] : []),
        ],
      },
    };
  }

  if (kind === "opportunity") {
    const res = fetchSection<{ opportunity: ScopedOpp & { account?: { id: string; name: string }; contact?: { id: string; name: string; consent?: { whatsapp: boolean; email: boolean; call: boolean }; preferred?: string }; activity: ScopedActivity[] } }>(role, "opportunity", { id });
    if (!res.ok) return res;
    const o = res.data.opportunity;
    const waRes = fetchSection<{ rows: { id: string; waNumber: string; contactName: string; opportunityId?: string; leadId?: string; accountId?: string }[] }>(role, "whatsapp");
    const wa = waRes.ok ? waRes.data.rows.find((c) => c.opportunityId === o.id) : undefined;
    const lastAct = o.activity?.[0];
    return {
      ok: true,
      context: {
        entityKind: "opportunity",
        entityId: o.id,
        title: o.name,
        company: o.account?.name ?? "—",
        ownerName: nameOf(o.ownerId),
        contactName: o.contact?.name,
        preferredChannel: o.contact?.preferred,
        consent: o.contact?.consent,
        channelReady: { email: false, whatsapp: !!wa, note: false }, // non-lead records: WhatsApp routes via conversation; email/note are lead-timeline actions
        whatsapp: wa ? { conversationId: wa.id, contactName: wa.contactName, waNumber: wa.waNumber } : undefined,
        stageOrStatus: o.stage,
        dealValue: `₹${o.valueCr} Cr`,
        lastInteraction: lastAct ? { at: lastAct.at, type: lastAct.type, summary: clampText(lastAct.summary, 160) } : undefined,
        nextAction: o.nextAction,
        nextFollowUpAt: o.nextFollowUpAt,
        sourceRefs: [
          entityRef("opportunity", o.id, o.name, `Stage ${o.stage} · ₹${o.valueCr} Cr`),
          entityRef("account", o.accountId, o.account?.name ?? "Account"),
          ...(lastAct ? [entityRef("opportunity", o.id, `${lastAct.type}: ${clampText(lastAct.summary, 80)}`, fmtDT(lastAct.at))] : []),
        ],
      },
    };
  }

  // account
  const res = fetchSection<{ account: { id: string; name: string; industry: string; status: string; ownerId: string; contacts: { name: string; preferred: string; consent: { whatsapp: boolean; email: boolean; call: boolean } }[]; opportunities: ScopedOpp[]; activity: ScopedActivity[] } }>(role, "account", { id });
  if (!res.ok) return res;
  const a = res.data.account;
  const lastAct = a.activity?.[0];
  const waRes = fetchSection<{ rows: { id: string; waNumber: string; contactName: string; accountId?: string }[] }>(role, "whatsapp");
  const wa = waRes.ok ? waRes.data.rows.find((c) => c.accountId === a.id) : undefined;
  return {
    ok: true,
    context: {
      entityKind: "account",
      entityId: a.id,
      title: a.name,
      company: a.name,
      ownerName: nameOf(a.ownerId),
      contactName: a.contacts?.[0]?.name,
      preferredChannel: a.contacts?.[0]?.preferred,
      consent: a.contacts?.[0]?.consent,
      channelReady: { email: false, whatsapp: !!wa, note: false },
      whatsapp: wa ? { conversationId: wa.id, contactName: wa.contactName, waNumber: wa.waNumber } : undefined,
      stageOrStatus: a.status,
      dealValue: a.opportunities?.length ? `₹${a.opportunities.reduce((s, o) => s + o.valueCr, 0).toFixed(2)} Cr open` : undefined,
      lastInteraction: lastAct ? { at: lastAct.at, type: lastAct.type, summary: clampText(lastAct.summary, 160) } : undefined,
      sourceRefs: [entityRef("account", a.id, a.name, `Status ${a.status}`), ...(lastAct ? [entityRef("account", a.id, `${lastAct.type}: ${clampText(lastAct.summary, 80)}`, fmtDT(lastAct.at))] : [])],
    },
  };
}

interface SummarySectionData { lines: string[]; evidence: AiSourceRef[]; confidence?: AiConfidence; emptyNote?: string }

function buildCustomerSummary(role: WorkspaceRole, scope: SalesScope, accountId: string | null): { ok: true; data: Record<string, unknown> } | { ok: false; status: number; code: string; message: string } {
  if (!accountId) return { ok: false, status: 422, code: "account_required", message: "Choose an account to summarize." };
  const res = fetchSection<{
    account: {
      id: string; name: string; industry: string; location: string; region: string; status: string; customerSince?: string;
      annualValueCr?: number; phone: string; website: string; employees: number; ownerId: string; ownerName?: string;
      contacts: { id: string; name: string; designation: string; email: string; phone: string; preferred: string; consent: { whatsapp: boolean; email: boolean; call: boolean } }[];
      opportunities: (ScopedOpp & { account?: { name: string } })[];
      quotations: { id: string; number: string; status: string; total: number }[];
      orders: { id: string; number: string; status: string; total: number; payment: string; fulfillment: string }[];
      visits: { id: string; plannedAt: number; status: string }[];
      meetings: { id: string; title: string; startAt: number; status: string }[];
      activity: ScopedActivity[];
    };
  }>(role, "account", { id: accountId });
  if (!res.ok) return res;
  const a = res.data.account;
  const generatedAt = now();
  const openOpps = a.opportunities ?? [];
  const openValue = openOpps.reduce((s, o) => s + o.valueCr, 0);
  const lastAct = a.activity?.[0];
  const lastTouchDays = lastAct ? Math.floor((generatedAt - lastAct.at) / D) : null;
  const evidence = (kind: string, id2: string | undefined, label: string, detail?: string) => [entityRef(kind, id2, label, detail)];

  const overview: SummarySectionData = {
    lines: [
      `${a.name} is ${a.status === "Customer" ? `a customer${a.customerSince ? ` since ${a.customerSince}` : ""}` : a.status === "Prospect" ? "a prospect — no closed business yet" : "a churned account"} in ${a.industry}, located in ${a.location}${a.region && a.region !== "—" ? ` (${a.region} region)` : ""}.`,
      `${a.contacts?.length ?? 0} contact${(a.contacts?.length ?? 0) === 1 ? "" : "s"} on record; account owner ${a.ownerName ?? nameOf(a.ownerId)}.`,
      a.annualValueCr ? `Annual value on record: ₹${a.annualValueCr} Cr.` : "No annual value recorded — the account card does not state one.",
    ],
    evidence: evidence("account", a.id, a.name, `${a.industry} · ${a.location}`),
  };

  const currentBusiness: SummarySectionData = {
    lines: [
      openOpps.length
        ? `${openOpps.length} open opportunit${openOpps.length === 1 ? "y" : "ies"} worth ₹${openValue.toFixed(2)} Cr combined — ${openOpps.map((o) => `${o.name.split("—")[0].trim()} (₹${o.valueCr} Cr, ${o.stage})`).join("; ")}.`
        : "No open opportunities right now.",
      a.orders?.length
        ? `${a.orders.length} order${a.orders.length === 1 ? "" : "s"} on record — latest ${a.orders[0].number} (${a.orders[0].status}, payment ${a.orders[0].payment}).`
        : "No orders recorded from this account yet.",
      a.quotations?.length
        ? `${a.quotations.length} quotation${a.quotations.length === 1 ? "" : "s"} — most recent ${a.quotations[0].number} (${a.quotations[0].status}).`
        : "No quotations on record.",
    ],
    evidence: [
      ...openOpps.slice(0, 2).map((o) => entityRef("opportunity", o.id, o.name, `${o.stage} · ₹${o.valueCr} Cr`)),
      ...(a.orders?.[0] ? [entityRef("order", a.orders[0].id, a.orders[0].number, a.orders[0].status)] : []),
      ...(a.quotations?.[0] ? [entityRef("quotation", a.quotations[0].id, a.quotations[0].number, a.quotations[0].status)] : []),
    ],
  };

  const relationship: SummarySectionData = {
    lines: [
      a.status === "Customer" && a.customerSince ? `Customer since ${a.customerSince}.` : a.status === "Prospect" ? "Still a prospect — the relationship is pre-revenue." : "Churned — re-engagement would be a deliberate win-back motion.",
      a.contacts?.[0] ? `Primary contact: ${a.contacts[0].name} (${a.contacts[0].designation}), prefers ${a.contacts[0].preferred}${a.contacts[0].consent?.whatsapp ? ", WhatsApp consent granted" : ", no WhatsApp consent"}.` : "No contacts recorded — relationship mapping is incomplete.",
      a.meetings?.length ? `${a.meetings.length} meeting${a.meetings.length === 1 ? "" : "s"} recorded${a.visits?.length ? `, ${a.visits.length} field visit${a.visits.length === 1 ? "" : "s"}` : ""}.` : "No meetings or visits recorded — engagement has been remote or light.",
    ],
    evidence: [
      ...(a.contacts?.[0] ? [entityRef("contact", a.contacts[0].id, a.contacts[0].name, a.contacts[0].designation)] : []),
      ...(a.meetings?.[0] ? [entityRef("meeting", a.meetings[0].id, a.meetings[0].title)] : []),
      evidence("account", a.id, "Account profile")[0],
    ],
  };

  const recentActivity: SummarySectionData = {
    lines: a.activity?.length
      ? a.activity.slice(0, 4).map((act) => `${fmtD(act.at)} — ${act.type}: ${clampText(act.summary, 110)}`)
      : [],
    emptyNote: a.activity?.length ? undefined : "No activity recorded in the visible window — nothing to summarize.",
    evidence: a.activity?.slice(0, 2).map((act) => entityRef(act.entity.kind, act.entity.id, `${act.type} · ${fmtD(act.at)}`, clampText(act.summary, 80))) ?? [],
  };

  const risks: SummarySectionData = { lines: [], evidence: [], confidence: "Medium" };
  for (const o of openOpps) {
    const sig = oppSignals(o, (o.activity ?? []) as ScopedActivity[]);
    if (sig.stalled) risks.lines.push(`“${o.name}” (₹${o.valueCr} Cr, ${o.stage}) has not moved in ${sig.idleStageDays} days — may be losing momentum.`);
    if (sig.overdueClose) risks.lines.push(`“${o.name}” expected close (${o.expectedClose}) has already passed while still open.`);
    if (o.slippedFrom) risks.lines.push(`“${o.name}” close date slipped from ${o.slippedFrom} to ${o.expectedClose}.`);
  }
  if (lastTouchDays != null && lastTouchDays >= 21) risks.lines.push(`No recorded activity for ${lastTouchDays} days — the relationship is going quiet.`);
  if (a.status === "Churned") risks.lines.push("Account is marked Churned — treat any pipeline here as win-back, not run-rate.");
  if (risks.lines.length === 0) risks.lines.push("No risk signals found in the authorized data for this account.");
  risks.evidence = openOpps.slice(0, 2).map((o) => entityRef("opportunity", o.id, o.name, `Stage ${o.stage}`));

  const importantContext: SummarySectionData = {
    lines: [
      a.contacts?.some((c) => !c.consent?.whatsapp) ? "At least one contact has NOT granted WhatsApp consent — keep that channel off for them." : "All recorded contacts have WhatsApp consent on file.",
      a.orders?.some((o) => o.payment === "Unpaid" || o.payment === "Partially Paid") ? `An order has ${a.orders.find((o) => o.payment !== "Paid")?.payment.toLowerCase()} payment — Finance (62) remains the financial source of truth.` : "No pending payment flags on recorded orders.",
    ],
    evidence: evidence("account", a.id, "Account & contacts"),
  };

  // recommended next action — deterministic, from the strongest signal
  let nextLine = "Open the account and set the next step — the data above does not point at one clear move.";
  let nextReason = "No dominant signal; keep the relationship on a healthy cadence.";
  let nextConfidence: AiConfidence = "Low";
  const stalledOpp = openOpps.map((o) => ({ o, sig: oppSignals(o, (o.activity ?? []) as ScopedActivity[]) })).find(({ sig }) => sig.stalled);
  const viewedQuote = a.quotations?.find((q) => q.status === "Viewed");
  if (viewedQuote) {
    nextLine = `Follow up on quotation ${viewedQuote.number} — the customer has seen it without responding.`;
    nextReason = "Viewed-but-silent quotations are the strongest near-term conversion signal in this account's data.";
    nextConfidence = "Medium";
  } else if (stalledOpp) {
    nextLine = `Re-engage “${stalledOpp.o.name}” — set a next step and confirm the timeline with the customer.`;
    nextReason = `The deal has not moved in ${stalledOpp.sig.idleStageDays} days; re-engagement precedes any stage change.`;
    nextConfidence = "High";
  } else if (lastTouchDays != null && lastTouchDays >= 21) {
    nextLine = "Schedule a relationship check-in — the account has been quiet for three weeks or more.";
    nextReason = `Last recorded activity was ${lastTouchDays} days ago.`;
    nextConfidence = "Medium";
  }

  const meetingPrep: string[] = [
    `Confirm attendees — primary contact ${a.contacts?.[0]?.name ?? "on record"} (${a.contacts?.[0]?.designation ?? "designation on file"}).`,
    openOpps.length ? `Re-read ${openOpps[0].name} (₹${openOpps[0].valueCr} Cr, ${openOpps[0].stage}) before the meeting.` : "There are no open deals — decide the meeting's purpose in advance.",
    a.quotations?.[0] ? `Quotation ${a.quotations[0].number} is ${a.quotations[0].status} — be ready to discuss it.` : "No open quotations — prepare pricing context if commercial topics arise.",
    lastAct ? `Open with the latest thread: ${lastAct.type} on ${fmtD(lastAct.at)}.` : "There is no recent activity to reference — start with discovery.",
    "Check consent before proposing WhatsApp follow-ups.",
  ];

  return {
    ok: true,
    data: {
      accountId: a.id,
      accountName: a.name,
      generatedAt,
      modelLabel: AI_PROVIDER_LABEL,
      freshnessLabel: `Account data as of ${SALES_PERIOD.asOfLabel}`,
      stats: {
        openOpps: openOpps.length,
        openValueCr: Math.round(openValue * 100) / 100,
        orders: a.orders?.length ?? 0,
        quotations: a.quotations?.length ?? 0,
        lastTouchDays,
      },
      sections: {
        overview,
        currentBusiness,
        relationship,
        recentActivity,
        openOpportunities: {
          lines: openOpps.length ? openOpps.map((o) => `${o.name} — ₹${o.valueCr} Cr · ${o.stage} · ${o.probability}% · close ${o.expectedClose}`) : [],
          emptyNote: openOpps.length ? undefined : "No open opportunities — the commercial pipeline for this account is empty.",
          evidence: openOpps.map((o) => entityRef("opportunity", o.id, o.name, `${o.stage} · ₹${o.valueCr} Cr`)),
        },
        risks,
        importantContext,
      },
      nextAction: { line: nextLine, reason: nextReason, confidence: nextConfidence, evidence: evidence("account", a.id, a.name) },
      meetingPrep,
    },
  };
}

// ============================================================
// Daily brief (role-personalized, concise by design)
// ============================================================

function buildBrief(role: WorkspaceRole, scope: SalesScope): DailyBrief {
  const generatedAt = now();
  const roleLabel = role === "sales-exec" ? "Sales Executive" : role === "dept-head" ? "Sales Manager" : "Administrator";
  const homeRes = fetchSection<{
    followups: { today: { id: string; type: string; subject: string; state: string; dueAt: number; leadId?: string; opportunityId?: string }[]; upcoming: { id: string; type: string; subject: string; state: string; dueAt: number }[] };
    meetings: { id: string; title: string; accountId: string; startAt: number; durationMin: number; location: string; isLink?: boolean }[];
    pendingQuotations: { id: string; number: string; status: string; accountName: string; total: number }[];
    target: { quotaCr: number; achievedCr: number; pipelineCr: number; forecastCr: number } | null;
    teamTargets: { id: string; label: string; quotaCr: number; achievedCr: number }[];
    counts: { myOpenOpps: number; dueFollowups: number; unreadWhatsApp: number; visitsPlanned: number };
  }>(role, "home");
  const home = homeRes.ok ? homeRes.data : null;
  const recs = buildRecommendations(role, scope).filter((r) => r.status === "open").slice(0, 4);
  const { insights } = buildOppInsights(role, scope);

  const sections: BriefSection[] = [];
  const dateLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // 1 Today's priorities
  const priorityItems: BriefItem[] = recs.slice(0, 4).map((r) => ({
    id: r.id,
    title: r.action,
    detail: r.entity.label,
    screen: r.entity.screen,
    param: r.entity.param,
    entityId: r.entity.id,
  }));
  sections.push({ key: "priorities", no: 1, title: "Today's priorities", items: priorityItems, moreScreen: "ai-daily-brief" });

  // 2 Meetings today
  const meetings = (home?.meetings ?? []).filter((m) => m.startAt > generatedAt - 12 * H);
  sections.push({
    key: "meetings",
    no: 2,
    title: "Meetings",
    items: meetings.slice(0, 3).map((m) => ({
      id: `m-${m.id}`,
      title: m.title,
      detail: `${fmtDT(m.startAt)} · ${m.isLink ? "Online link" : m.location}`,
      at: m.startAt,
      screen: "customer-meetings",
      param: "meetingId",
      entityId: m.id,
    })),
    moreScreen: "customer-meetings",
    moreLabel: "All meetings",
  });

  // 3 Follow-ups due today
  const dueToday = home?.followups.today ?? [];
  sections.push({
    key: "followups",
    no: 3,
    title: "Follow-ups due",
    items: dueToday.slice(0, 4).map((f) => ({
      id: `f-${f.id}`,
      title: clampText(f.subject, 70),
      detail: `${f.type} · ${f.state}`,
      at: f.dueAt,
      screen: "followup-queue",
      entityId: f.id,
      completable: true,
      followupId: f.id,
      state: f.state,
    })),
    moreScreen: "followup-queue",
    moreLabel: "Follow-up Queue",
  });

  // 4 Overdue actions
  const overdue = dueToday.filter((f) => f.state === "Overdue");
  sections.push({
    key: "overdue",
    no: 4,
    title: "Overdue actions",
    items: overdue.slice(0, 3).map((f) => ({
      id: `o-${f.id}`,
      title: clampText(f.subject, 70),
      detail: `Was due ${fmtD(f.dueAt)}`,
      at: f.dueAt,
      screen: "followup-queue",
      entityId: f.id,
      completable: true,
      followupId: f.id,
      state: f.state,
    })),
    moreScreen: "followup-queue",
    moreLabel: "Follow-up Queue",
  });

  // 5 Important customers (top open value in scope)
  const oppsRes = fetchSection<{ rows: (ScopedOpp & { account?: { name: string } })[] }>(role, "opportunities");
  const openOpps = oppsRes.ok ? oppsRes.data.rows.filter((o) => o.stage !== "Won" && o.stage !== "Lost") : [];
  const topOpps = [...openOpps].sort((a, b) => b.valueCr - a.valueCr).slice(0, 3);
  sections.push({
    key: "customers",
    no: 5,
    title: "Important customers",
    items: topOpps.map((o) => ({
      id: `c-${o.id}`,
      title: o.account?.name ?? "Account",
      detail: `${o.name} · ₹${o.valueCr} Cr · ${o.stage}`,
      screen: "account-detail",
      param: "accountId",
      entityId: o.accountId,
    })),
  });

  // 6 Opportunities needing attention
  const attention = insights.filter((i) => i.kind === "risk" || i.kind === "attention").slice(0, 3);
  sections.push({
    key: "attention",
    no: 6,
    title: "Opportunities needing attention",
    items: attention.map((i) => ({
      id: i.id,
      title: i.title,
      detail: i.statement.length > 110 ? `${i.statement.slice(0, 110)}…` : i.statement,
      screen: i.entity?.screen ?? "sales-pipeline",
      param: i.entity?.param,
      entityId: i.entity?.id,
    })),
    moreScreen: "ai-pipeline-review",
    moreLabel: "AI Pipeline Review",
  });

  // 7 Pipeline changes (recent stage changes in scope)
  const actRes = fetchSection<{ rows: ScopedActivity[] }>(role, "activity");
  const stageChanges = actRes.ok ? actRes.data.rows.filter((a) => a.type === "Stage change").slice(0, 3) : [];
  sections.push({
    key: "pipelineChanges",
    no: 7,
    title: "Pipeline changes",
    items: stageChanges.map((a) => ({
      id: `pc-${a.id}`,
      title: clampText(a.summary, 80),
      detail: fmtDT(a.at),
      at: a.at,
      screen: "sales-pipeline",
    })),
    moreScreen: "sales-pipeline",
    moreLabel: "Sales Pipeline",
  });

  // 8 Target progress
  const target = home?.target ?? null;
  sections.push({
    key: "target",
    no: 8,
    title: "Target progress",
    items:
      scope !== "own" && (home?.teamTargets?.length ?? 0) > 0
        ? home!.teamTargets.slice(0, 3).map((t) => ({
            id: `t-${t.id}`,
            title: t.label,
            detail: `₹${t.achievedCr} Cr of ₹${t.quotaCr} Cr (${Math.round((t.achievedCr / Math.max(t.quotaCr, 0.01)) * 100)}%)`,
            screen: "sales-targets" as never,
          }))
        : target
          ? [
              {
                id: "t-me",
                title: "Your quarter",
                detail: `₹${target.achievedCr} Cr of ₹${target.quotaCr} Cr achieved · forecast ₹${target.forecastCr} Cr`,
                screen: "sales-forecast" as never,
              },
            ]
          : [{ id: "t-none", title: "No target row for your boundary", detail: "Targets are configured in Sales Targets (82).", screen: "sales-targets" as never }],
  });

  // 9 Recommended actions (link out — never auto-executed)
  sections.push({
    key: "recommended",
    no: 9,
    title: "Recommended actions",
    items: recs.slice(0, 3).map((r) => ({
      id: `ra-${r.id}`,
      title: r.action,
      detail: r.entity.label,
      screen: r.entity.screen,
      param: r.entity.param,
      entityId: r.entity.id,
    })),
    moreScreen: "ai-next-best-action",
    moreLabel: "AI Next Best Action",
  });

  // 10 Risks
  sections.push({
    key: "risks",
    no: 10,
    title: "Risks",
    items: insights.filter((i) => i.kind === "risk").slice(0, 2).map((i) => ({
      id: `rk-${i.id}`,
      title: i.title,
      detail: i.confidence ? `${i.confidence} confidence · evidence on the insight card` : undefined,
      screen: i.entity?.screen ?? "sales-pipeline",
      param: i.entity?.param,
      entityId: i.entity?.id,
    })),
  });

  const totalItems = sections.reduce((s, x) => s + x.items.length, 0);
  const firstName = nameOf(SESSION_USER_ID).split(" ")[0];
  const intro =
    overdue.length > 0
      ? `${overdue.length} follow-up${overdue.length === 1 ? " is" : "s are"} overdue — clear ${overdue.length === 1 ? "it" : "them"} before new work.`
      : meetings.length > 0
        ? `${meetings.length} customer meeting${meetings.length === 1 ? "" : "s"} today. The brief below is ordered by urgency.`
        : totalItems === 0
          ? "Nothing urgent in your authorized scope — a clean day. Use it for pipeline you've been postponing."
          : "A calm day in your scope. The brief below is ordered by urgency.";

  return {
    role: roleLabel,
    scope,
    greeting: `Good morning, ${firstName}.`,
    dateLabel,
    introLine: intro,
    sections,
    generatedAt,
    freshnessLabel: `Brief generated from live sales data · ${SALES_PERIOD.asOfLabel}`,
    totalItems,
  };
}

// ============================================================
// Sales Q&A — retrieval → grounded LLM answer
// ============================================================

interface QaRetrieval {
  contextSummary: string;
  sources: AiSourceRef[];
  keyNumbers: QaKeyNumberLike[];
  intent: string;
  deterministic: { answer: string; reasoning: string[]; numbers: { label: string; value: string }[] } | null;
}
interface QaKeyNumberLike { label: string; value: string }

function retrieveForQuestion(role: WorkspaceRole, scope: SalesScope, question: string): QaRetrieval {
  const q = question.toLowerCase();
  const sources: AiSourceRef[] = [];
  const numbers: QaKeyNumberLike[] = [];
  const lines: string[] = [];
  let intent = "overview";

  const pushLines = (s: string) => lines.push(s);

  // intent: leads / priority
  if (/lead|priorit/.test(q)) {
    intent = "leads";
    const pr = buildPrioritization(role, scope);
    const top = pr.rows.filter((r) => r.aiScore != null).slice(0, 5);
    pushLines(`TOP PRIORITIZED LEADS (weighted signal model, authorized scope only):`);
    for (const r of top) pushLines(`- ${r.name} (${r.company}) · score ${r.aiScore}/100 · ${r.status} · ₹${r.estimatedValueCr} Cr · owner ${r.ownerName} · ${r.reason}`);
    for (const r of top.slice(0, 3)) sources.push(entityRef("lead", r.leadId, `${r.name} — ${r.company}`, `Score ${r.aiScore}/100`));
    numbers.push({ label: "Leads ranked", value: String(pr.rows.length) });
    numbers.push({ label: "High priority", value: String(pr.counts.high) });
    return { contextSummary: lines.join("\n"), sources, keyNumbers: numbers, intent, deterministic: null };
  }

  // intent: stalled / inactive / risk opportunities
  if (/inactiv|stall|risk|14 days|opportunit/.test(q)) {
    intent = "opportunities";
    const { opps, accountNameOf, insights } = buildOppInsights(role, scope);
    const open = opps.filter((o) => o.stage !== "Won" && o.stage !== "Lost");
    const stale = open
      .map((o) => ({ o, idle: Math.floor((now() - o.lastStageChangeAt) / D) }))
      .filter((x) => x.idle >= 14)
      .sort((a, b) => b.o.valueCr - a.o.valueCr)
      .slice(0, 6);
    pushLines("OPEN OPPORTUNITIES INACTIVE ≥14 DAYS (authorized scope):");
    for (const { o, idle } of stale) pushLines(`- ${o.name} · ${accountNameOf(o.accountId)} · ₹${o.valueCr} Cr · stage ${o.stage} · idle ${idle}d · probability ${o.probability}%`);
    for (const i of insights.slice(0, 4)) pushLines(`INSIGHT [${i.kind}]: ${i.title} — ${i.statement}`);
    for (const { o } of stale.slice(0, 3)) sources.push(entityRef("opportunity", o.id, o.name, `Idle ${Math.floor((now() - o.lastStageChangeAt) / D)}d`));
    numbers.push({ label: "Inactive ≥14d", value: String(stale.length) });
    numbers.push({ label: "Open pipeline", value: `₹${open.reduce((s, o) => s + o.valueCr, 0).toFixed(2)} Cr` });
    return { contextSummary: lines.join("\n"), sources, keyNumbers: numbers, intent, deterministic: null };
  }

  // intent: pipeline vs target / forecast / performance
  if (/pipeline|target|forecast|perform|month/.test(q)) {
    intent = "pipeline";
    const pipeRes = fetchSection<{ totals: { gross: number; weighted: number; count: number } }>(role, "pipeline");
    const fcRes = fetchSection<{ summary: { target: number; closed: number; commit: number; bestCase: number; gap: number } }>(role, "forecast");
    if (pipeRes.ok) {
      pushLines(`PIPELINE (authorized scope): gross ₹${pipeRes.data.totals.gross.toFixed(2)} Cr across ${pipeRes.data.totals.count} open opportunities; weighted ₹${pipeRes.data.totals.weighted.toFixed(2)} Cr.`);
      numbers.push({ label: "Open pipeline", value: `₹${pipeRes.data.totals.gross.toFixed(2)} Cr` });
      numbers.push({ label: "Weighted", value: `₹${pipeRes.data.totals.weighted.toFixed(2)} Cr` });
      sources.push(ref("Sales Pipeline", "Pipeline", { screen: "sales-pipeline" }));
    }
    if (fcRes.ok) {
      const s = fcRes.data.summary;
      pushLines(`FORECAST: target ₹${s.target.toFixed(2)} Cr · closed ₹${s.closed.toFixed(2)} Cr · commit ₹${s.commit.toFixed(2)} Cr · best case ₹${s.bestCase.toFixed(2)} Cr · gap to commit ₹${s.gap.toFixed(2)} Cr.`);
      numbers.push({ label: "Q3 target", value: `₹${s.target.toFixed(2)} Cr` });
      numbers.push({ label: "Closed", value: `₹${s.closed.toFixed(2)} Cr` });
      numbers.push({ label: "Commit", value: `₹${s.commit.toFixed(2)} Cr` });
      sources.push(ref("Sales Forecast", "Forecast", { screen: "sales-forecast" }));
    }
    return { contextSummary: lines.join("\n"), sources, keyNumbers: numbers, intent, deterministic: null };
  }

  // intent: quotations
  if (/quotation|quote|approv/.test(q)) {
    intent = "quotations";
    const qRes = fetchSection<{ rows: { id: string; number: string; status: string; accountName: string; total: number; ownerName?: string }[] }>(role, "quotations");
    const rows = qRes.ok ? qRes.data.rows.filter((x) => ["Pending Approval", "Sent", "Viewed", "Negotiation", "Draft"].includes(x.status)) : [];
    pushLines("OPEN QUOTATIONS (authorized scope):");
    for (const x of rows.slice(0, 8)) pushLines(`- ${x.number} · ${x.accountName} · ${x.status} · ${fmtRupeesShort(x.total)}`);
    for (const x of rows.slice(0, 4)) sources.push(entityRef("quotation", x.id, x.number, `${x.status} · ${fmtRupeesShort(x.total)}`));
    numbers.push({ label: "Open quotations", value: String(rows.length) });
    numbers.push({ label: "Awaiting approval", value: String(rows.filter((x) => x.status === "Pending Approval").length) });
    return { contextSummary: lines.join("\n"), sources, keyNumbers: numbers, intent, deterministic: null };
  }

  // intent: follow-ups / overdue
  if (/follow.?up|overdue|due/.test(q)) {
    intent = "followups";
    const fuRes = fetchSection<{ rows: { id: string; subject: string; type: string; state: string; dueAt: number; leadId?: string; opportunityId?: string }[] }>(role, "followups");
    const rows = fuRes.ok ? fuRes.data.rows.filter((f) => f.state === "Overdue" || f.state === "Due Today") : [];
    pushLines("FOLLOW-UPS OVERDUE OR DUE TODAY (authorized scope):");
    for (const f of rows.slice(0, 8)) pushLines(`- ${f.subject} · ${f.type} · ${f.state} · due ${fmtD(f.dueAt)}`);
    for (const f of rows.slice(0, 4)) sources.push(ref(clampText(f.subject, 60), "Follow-up", { screen: "followup-queue", detail: `${f.state} · due ${fmtD(f.dueAt)}` }));
    numbers.push({ label: "Overdue", value: String(rows.filter((f) => f.state === "Overdue").length) });
    numbers.push({ label: "Due today", value: String(rows.filter((f) => f.state === "Due Today").length) });
    return { contextSummary: lines.join("\n"), sources, keyNumbers: numbers, intent, deterministic: null };
  }

  // intent: today / focus → brief digest
  if (/today|focus|brief|day/.test(q)) {
    intent = "today";
    const brief = buildBrief(role, scope);
    pushLines("TODAY'S BRIEF DIGEST (authorized scope):");
    for (const s of brief.sections.slice(0, 6)) {
      if (s.items.length) pushLines(`${s.title}: ${s.items.map((i) => i.title).join("; ")}`);
    }
    sources.push(ref("AI Daily Brief", "Brief", { screen: "ai-daily-brief" as never }));
    return { contextSummary: lines.join("\n"), sources, keyNumbers: numbers, intent, deterministic: null };
  }

  // intent: specific customer
  const accRes = fetchSection<{ rows: { id: string; name: string; status: string; industry: string }[] }>(role, "accounts");
  if (accRes.ok) {
    const hit = accRes.data.rows.find((a) => q.includes(a.name.toLowerCase().split(" ")[0]) && a.name.toLowerCase().split(" ")[0].length > 3);
    if (hit) {
      intent = "customer";
      const sum = buildCustomerSummary(role, scope, hit.id);
      if (sum.ok) {
        const d = sum.data as { sections: Record<string, SummarySectionData>; nextAction: { line: string }; stats: { openOpps: number; openValueCr: number } };
        pushLines(`CUSTOMER SUMMARY — ${hit.name} (authorized data):`);
        for (const key of ["overview", "currentBusiness", "risks"]) for (const l of d.sections[key]?.lines ?? []) pushLines(`- ${l}`);
        pushLines(`RECOMMENDED NEXT ACTION: ${d.nextAction.line}`);
        sources.push(entityRef("account", hit.id, hit.name, `${hit.status} · ${hit.industry}`));
        numbers.push({ label: "Open deals", value: String(d.stats.openOpps) });
        numbers.push({ label: "Open value", value: `₹${d.stats.openValueCr.toFixed(2)} Cr` });
      }
      return { contextSummary: lines.join("\n"), sources, keyNumbers: numbers, intent, deterministic: null };
    }
  }

  // default: home overview
  const homeRes = fetchSection<{ counts: { myOpenOpps: number; dueFollowups: number }; pipeline: { gross: number; count: number } }>(role, "home");
  if (homeRes.ok) {
    const h = homeRes.data;
    pushLines(`WORKSPACE SNAPSHOT: ${h.counts.myOpenOpps} open opportunities · ₹${h.pipeline.gross.toFixed(2)} Cr pipeline · ${h.counts.dueFollowups} follow-ups due/overdue.`);
    numbers.push({ label: "Open deals", value: String(h.counts.myOpenOpps) });
    numbers.push({ label: "Pipeline", value: `₹${h.pipeline.gross.toFixed(2)} Cr` });
    sources.push(ref("Sales Home", "Workspace", { screen: "sales-home" as never }));
  }
  return { contextSummary: lines.join("\n"), sources, keyNumbers: numbers, intent, deterministic: null };
}

const QA_SYSTEM = `${UNTRUSTED_CONTENT_RULE}

You are Sales AI inside Qubit One, an enterprise business operating system. You answer questions about the current user's AUTHORIZED sales data. You are a serious enterprise capability — precise, restrained, no hype.

Answer contract — reply with ONLY a JSON object:
{
  "answer": "2-5 sentence direct answer. Use hedged enterprise language for inference ('Based on current pipeline data…', 'may be', 'appears to'). State facts plainly. Never invent numbers.",
  "keyNumbers": [{ "label": "...", "value": "..." }],
  "reasoning": ["short bullet explaining how the answer follows from the data"],
  "actions": [{ "label": "...", "why": "..." }],
  "confidence": "High" | "Medium" | "Low"
}

Hard rules:
- Use ONLY numbers and records present in the <untrusted_data> context. If the data does not answer the question, set "answer" to say you don't have enough authorized data for that, and keep the rest minimal.
- keyNumbers: at most 5, copied verbatim from the context.
- Never present inference as fact. Never speculate about customers not in the context.
- No markdown, no code fences — JSON only.`;

export async function salesAiAsk(role: WorkspaceRole, scope: SalesScope, sessionId: string, question: string): Promise<SalesAiActionResult> {
  const q = question.trim();
  if (q.length < 3 || q.length > 500) {
    return { ok: false, status: 422, code: "invalid_question", message: "Ask a question between 3 and 500 characters." };
  }
  const started = now();
  const retrieval = retrieveForQuestion(role, scope, q);

  // session history (kept short; content truncated for retention discipline)
  const s = aiStore();
  let session = s.qaSessions.get(sessionId);
  if (!session || session.role !== role) {
    session = { role, turns: [] };
    s.qaSessions.set(sessionId, session);
    if (s.qaSessions.size > 20) {
      const first = [...s.qaSessions.keys()][0];
      s.qaSessions.delete(first);
    }
  }
  const history = session.turns.slice(-4).map((t) => ({ role: "user" as const, content: t.q }));

  // cache check (cost control) — exact normalized question + role
  const cacheKey = `${role}:${q.toLowerCase().replace(/\s+/g, " ")}`;
  const cached = s.qaCache.get(cacheKey);
  if (cached && now() - cached.at < 10 * 60_000) {
    return {
      ok: true,
      message: "Answered from cache.",
      answer: cached.answer,
      sources: cached.sources,
      sessionId,
      generatedAt: cached.at,
      modelLabel: AI_PROVIDER_LABEL,
      cached: true,
      retrievalMs: 0,
    };
  }

  const userContent = [
    `Current date: ${fmtD(now())}. User role scope: ${scope}.`,
    `Question: ${q}`,
    untrustedBlock("authorized-sales-data", retrieval.contextSummary || "(no records matched this question in the authorized scope)"),
    retrieval.sources.length ? `You may reference these records as sources: ${retrieval.sources.map((r) => r.label).join("; ")}.` : "No source records matched — if the question needs specific records, say there is insufficient authorized data.",
  ].join("\n\n");

  let answer: QaAnswer = {
    // deterministic fallback first — graceful degradation is the default path,
    // a validated model answer overwrites it below
    answer: retrieval.contextSummary
      ? "Sales AI couldn't complete the language analysis just now, so here is the authorized data your question retrieved — reviewed directly, it should answer most of it."
      : "I don't have enough authorized data to answer that reliably. Try one of the suggested questions, or open the underlying Sales screens.",
    keyNumbers: retrieval.keyNumbers.slice(0, 5).map((k) => ({ label: k.label, value: k.value })),
    reasoning: retrieval.contextSummary ? ["Retrieved via the same authorized scoping as the Sales screens; language generation was unavailable."] : [],
    sources: retrieval.sources.slice(0, 6),
    actions: [],
    confidence: "Low",
    insufficient: !retrieval.contextSummary,
    insufficientNote: retrieval.contextSummary ? undefined : "Rephrase, or pick from the suggested questions.",
  };
  let modelOk = false;

  const result = await runCompletion({ system: QA_SYSTEM, messages: [...history, { role: "user", content: userContent }] });
  if (result.ok) {
    const parsed = parseJsonObject<{ answer?: string; keyNumbers?: { label?: string; value?: string }[]; reasoning?: string[]; actions?: { label?: string; why?: string }[]; confidence?: string; insufficient?: boolean }>(result.text);
    if (parsed && typeof parsed.answer === "string" && parsed.answer.trim().length > 0) {
      modelOk = true;
      // VALIDATION / POLICY LAYER — clamp, whitelist, never trust blindly
      const confidence: AiConfidence = ["High", "Medium", "Low"].includes(parsed.confidence ?? "") ? (parsed.confidence as AiConfidence) : "Medium";
      const insufficient = /don't have enough|do not have enough|insufficient authorized data|no records matched/i.test(parsed.answer) || parsed.insufficient === true;
      const actions = (parsed.actions ?? [])
        .filter((a) => a?.label)
        .slice(0, 3)
        .map((a) => ({ label: clampText(a.label, 80), screen: (retrieval.sources[0]?.screen ?? "sales-pipeline") as QaAnswer["actions"][number]["screen"], id: retrieval.sources[0]?.id, param: retrieval.sources[0]?.param }));
      answer = {
        answer: clampText(parsed.answer, 1400),
        keyNumbers: (parsed.keyNumbers ?? []).filter((k) => k?.label && k?.value).slice(0, 5).map((k) => ({ label: clampText(k.label, 60), value: clampText(k.value, 30) })),
        reasoning: (parsed.reasoning ?? []).filter((r) => typeof r === "string").slice(0, 4).map((r) => clampText(r, 200)),
        sources: retrieval.sources.slice(0, 6),
        actions: retrieval.sources.length ? actions : [],
        confidence: insufficient ? "Low" : confidence,
        insufficient,
        insufficientNote: insufficient ? "Try one of the suggested questions, or open the underlying Sales screens directly." : undefined,
      };
    }
  }

  s.qaCache.set(cacheKey, { answer, sources: answer.sources, at: now() });
  if (s.qaCache.size > 60) {
    const first = [...s.qaCache.keys()][0];
    s.qaCache.delete(first);
  }

  session.turns.push({ q: clampText(q, 200), a: clampText(answer.answer, 300), at: now() });
  if (session.turns.length > 8) session.turns.shift();

  auditAi({
    action: "Sales AI question answered",
    resource: `Q&A · ${retrieval.intent}`,
    context: `Q: ${clampText(q, 120)} · intent ${retrieval.intent} · ${modelOk ? "model answer" : "deterministic fallback"} · ${answer.sources.length} sources · ${now() - started}ms`,
  });
  recordActivity({
    capability: "Sales Q&A",
    kind: "answer",
    summary: clampText(q, 110),
    modelLabel: modelOk ? AI_PROVIDER_LABEL : "Deterministic fallback",
    confidence: answer.confidence,
  });

  return {
    ok: true,
    message: "Answered.",
    answer,
    sources: answer.sources,
    sessionId,
    generatedAt: now(),
    modelLabel: modelOk ? AI_PROVIDER_LABEL : "Deterministic fallback (language model unavailable)",
    cached: false,
    retrievalMs: now() - started,
  };
}

// ============================================================
// Follow-up writer — grounded draft generation
// ============================================================

const WRITER_SYSTEM = `${UNTRUSTED_CONTENT_RULE}

You are the Sales AI writing assistant inside Qubit One. You draft professional follow-up messages for salespeople, grounded ONLY in the authorized context provided. Serious enterprise tone — no hype, no exclamation marks, no invented facts, no fake commitments (never promise discounts, dates or approvals that are not in the context).

Reply with ONLY a JSON object:
{ "subject": "email subject (omit for WhatsApp/notes)", "body": "the message text" }

Rules:
- Ground every specific claim (deal value, product, dates, last interaction) in the <untrusted_data> context; if a detail is unknown, write around it.
- Respect the requested channel conventions: Email = greeting + 2-4 short paragraphs + sign-off as the owner's name; WhatsApp Business = short, polite, 60-120 words, no subject; Internal note = terse internal memo, no greeting.
- Respect the requested tone, length and language.
- Never include placeholders like [Name] — use the real names from context.
- No markdown formatting inside body.`;

const WRITER_REFINE: Record<Exclude<WriterMode, "generate">, string> = {
  shorten: "Rewrite the PREVIOUS DRAFT shorter while keeping every concrete fact.",
  expand: "Rewrite the PREVIOUS DRAFT with more helpful detail, still grounded in context only.",
  professionalize: "Rewrite the PREVIOUS DRAFT in a more professional, polished register.",
  simplify: "Rewrite the PREVIOUS DRAFT in simpler, plainer language — same facts.",
  translate: "Rewrite the PREVIOUS DRAFT in the requested language, keeping facts identical.",
};

const DRAFT_WORD_BUDGET: Record<WriterLength, [number, number]> = { Short: [40, 90], Medium: [90, 160], Detailed: [160, 260] };

function templateFallback(ctx: WriterContext, channel: WriterChannel, tone: WriterTone, purpose: WriterPurpose, length: WriterLength): { subject?: string; body: string } {
  const who = ctx.contactName ?? "there";
  const company = ctx.company;
  const owner = ctx.ownerName;
  const lastTouch = ctx.lastInteraction ? `${ctx.lastInteraction.type.toLowerCase()} on ${fmtD(ctx.lastInteraction.at)}` : "our recent conversation";
  const deal = ctx.dealValue ? ` regarding ${ctx.dealValue}` : "";
  const purposeLine: Record<WriterPurpose, string> = {
    "Post-meeting recap": `Thank you for the time today. Here is a short recap of what we agreed and the next steps for ${company}.`,
    "Quotation follow-up": `I wanted to follow up on the quotation shared with ${company}${deal}. Happy to walk through any line items whenever useful.`,
    "Re-engage inactive lead": `It has been a while since ${lastTouch}. I wanted to check whether the requirement at ${company} is still active and how we can help.`,
    "Request a meeting": `I would like to schedule a short call to discuss the requirement at ${company}${deal}. Please share a convenient slot.`,
    "Gentle payment reminder": `A gentle reminder regarding the outstanding invoice for ${company}. If it has already been processed, kindly ignore this note.`,
    "General check-in": `Checking in to see how things are going at ${company} and whether there is anything we can support with.`,
  };
  if (channel === "Internal note") {
    return {
      body: `Follow-up ${purpose.toLowerCase()} — ${company}${deal}. Last touch: ${lastTouch}. ${ctx.nextAction ? `Planned next step: ${ctx.nextAction}.` : "Next step to be confirmed after outreach."} Prepared by Sales AI from authorized records; edit before relying on it.`,
    };
  }
  if (channel === "WhatsApp Business") {
    return {
      body: `Hello ${who}, this is ${owner} from Qubit One. ${purposeLine[purpose]} ${ctx.nextAction ? `Proposed next step: ${ctx.nextAction}.` : ""} — happy to share details whenever convenient.`,
    };
  }
  return {
    subject: `Following up — ${company}`,
    body: `Hello ${who},\n\n${purposeLine[purpose]}\n\n${ctx.lastInteraction ? `For context, our last interaction was the ${lastTouch}. ` : ""}${ctx.nextAction ? `As discussed, the proposed next step is: ${ctx.nextAction}. ` : ""}Please let me know a convenient time and I will set it up.\n\nBest regards,\n${owner}\nQubit One Pvt Ltd`,
  };
}

export async function salesAiDraft(role: WorkspaceRole, scope: SalesScope, input: Record<string, unknown>): Promise<SalesAiActionResult> {
  const kind = typeof input.kind === "string" ? input.kind : "lead";
  const id = typeof input.id === "string" ? input.id : "";
  const channel = (typeof input.channel === "string" ? input.channel : "Email") as WriterChannel;
  const tone = (typeof input.tone === "string" ? input.tone : "Professional") as WriterTone;
  const purpose = (typeof input.purpose === "string" ? input.purpose : "General check-in") as WriterPurpose;
  const length = (typeof input.length === "string" ? input.length : "Medium") as WriterLength;
  const language = (typeof input.language === "string" ? input.language : "English") as WriterLanguage;
  const mode = (typeof input.mode === "string" ? input.mode : "generate") as WriterMode;
  const previousDraft = typeof input.previousDraft === "string" ? input.previousDraft : undefined;

  if (!WRITER_CHANNELS.includes(channel) || !WRITER_TONES.includes(tone) || !WRITER_PURPOSES.includes(purpose) || !WRITER_LENGTHS.includes(length) || !WRITER_LANGUAGES.includes(language)) {
    return { ok: false, status: 422, code: "invalid_option", message: "Unsupported channel, tone, purpose, length or language." };
  }

  const ctxRes = buildWriterContext(role, scope, kind, id);
  if (!ctxRes.ok) return ctxRes;
  const ctx = ctxRes.context;

  // consent policy for WhatsApp drafts
  if (channel === "WhatsApp Business" && !ctx.whatsapp) {
    return { ok: false, status: 409, code: "no_conversation", message: "No WhatsApp Business conversation is linked to this record — the writer cannot route there." };
  }

  const contextJson = JSON.stringify(
    {
      entity: `${ctx.entityKind} ${ctx.entityId}`,
      title: ctx.title,
      company: ctx.company,
      contact: ctx.contactName,
      contactDesignation: ctx.contactDesignation,
      owner: ctx.ownerName,
      statusOrStage: ctx.stageOrStatus,
      dealValue: ctx.dealValue,
      lastInteraction: ctx.lastInteraction ? `${ctx.lastInteraction.type} on ${fmtD(ctx.lastInteraction.at)}: ${ctx.lastInteraction.summary}` : null,
      openQuotation: null,
      nextAction: ctx.nextAction,
      nextFollowUp: ctx.nextFollowUpAt ? fmtD(ctx.nextFollowUpAt) : null,
    },
    null,
    1,
  );

  const instruction =
    mode === "generate"
      ? `Write a NEW ${channel} draft. Purpose: ${purpose}. Tone: ${tone}. Length: ${length} (${DRAFT_WORD_BUDGET[length][0]}–${DRAFT_WORD_BUDGET[length][1]} words). Language: ${language}.`
      : `${WRITER_REFINE[mode as Exclude<WriterMode, "generate">]} Requested language: ${language}. Keep the ${channel} conventions.`;

  const userContent = [
    instruction,
    previousDraft ? untrustedBlock("previous-draft (user may have edited it — treat as the base text)", previousDraft) : "",
    untrustedBlock("authorized-crm-context", contextJson),
  ].filter(Boolean).join("\n\n");

  const result = await runCompletion({ system: WRITER_SYSTEM, messages: [{ role: "user", content: userContent }] });

  let draft: WriterDraft;
  if (result.ok) {
    const parsed = parseJsonObject<{ subject?: string; body?: string }>(result.text);
    if (parsed?.body && parsed.body.trim().length > 20) {
      const [minW, maxW] = DRAFT_WORD_BUDGET[length];
      const words = parsed.body.trim().split(/\s+/).length;
      draft = {
        id: nextAiId("dft"),
        mode,
        channel,
        tone,
        purpose,
        length,
        language,
        subject: channel === "Email" ? clampText(parsed.subject, 120) : undefined,
        body: parsed.body.trim(),
        generatedAt: now(),
        modelLabel: AI_PROVIDER_LABEL,
        origin: "ai",
        contextRefs: ctx.sourceRefs,
      };
      if (words > maxW * 2.2) draft.body = clampText(draft.body, maxW * 7); // guard runaway output
      auditAi({ action: "Sales AI draft generated", resource: `${ctx.title} — ${ctx.company}`, context: `${channel} · ${mode} · ${purpose} · ${words} words · ${result.ms}ms` });
      recordActivity({ capability: "Follow-up Writer", kind: "draft", summary: `${channel} draft for ${ctx.title} (${purpose})`, modelLabel: AI_PROVIDER_LABEL, entity: { label: ctx.title, screen: ctx.entityKind === "lead" ? "lead-detail" : ctx.entityKind === "opportunity" ? "opportunity-detail" : "account-detail", id: ctx.entityId, param: ctx.entityKind === "lead" ? "leadId" : ctx.entityKind === "opportunity" ? "opportunityId" : "accountId" } });
      return { ok: true, message: "Draft ready — review before sending.", draft, context: ctx };
    }
  }

  // graceful fallback — deterministic template, clearly labeled
  const tpl = templateFallback(ctx, channel, tone, purpose, length);
  draft = {
    id: nextAiId("dft"),
    mode,
    channel,
    tone,
    purpose,
    length,
    language,
    subject: tpl.subject,
    body: tpl.body,
    generatedAt: now(),
    modelLabel: "Rule-based template (AI language model unavailable)",
    origin: "template",
    contextRefs: ctx.sourceRefs,
  };
  auditAi({ action: "Sales AI draft fallback used", resource: `${ctx.title} — ${ctx.company}`, severity: "Warning", context: `${channel} · ${mode} · language model unavailable; deterministic template served` });
  recordActivity({ capability: "Follow-up Writer", kind: "draft", summary: `Template draft for ${ctx.title} (AI unavailable)`, modelLabel: draft.modelLabel });
  return {
    ok: true,
    message: "The language model is temporarily unavailable — a rule-based template built from the authorized context is shown instead. Edit before sending.",
    draft,
    context: ctx,
    degraded: true,
  };
}

/** Record a reviewed draft through the EXISTING Qubit workflow. */
export function salesAiDraftRecord(role: WorkspaceRole, scope: SalesScope, input: Record<string, unknown>): SalesAiActionResult {
  const kind = typeof input.kind === "string" ? input.kind : "";
  const id = typeof input.id === "string" ? input.id : "";
  const channel = typeof input.channel === "string" ? input.channel : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const subject = typeof input.subject === "string" ? input.subject.trim() : undefined;
  const waConversationId = typeof input.waConversationId === "string" ? input.waConversationId : undefined;
  if (!body || body.length < 10) return { ok: false, status: 422, code: "body_required", message: "The final message is too short to record — edit the draft first." };

  if (channel === "WhatsApp Business") {
    if (!waConversationId) return { ok: false, status: 422, code: "conversation_required", message: "No WhatsApp conversation was selected." };
    const res = salesPost(role, { type: "whatsapp.reply", input: { id: waConversationId, body } } as never);
    if (!res.ok) return res;
    auditAi({ action: "AI draft sent via WhatsApp Business", resource: waConversationId, context: `Reviewed by user before sending · ${clampText(body, 100)}` });
    recordActivity({ capability: "Follow-up Writer", kind: "draft", summary: "AI draft sent via WhatsApp Business after user review", modelLabel: AI_PROVIDER_LABEL });
    return { ok: true, message: res.message };
  }

  if (kind !== "lead") {
    return { ok: false, status: 422, code: "record_unsupported", message: "Email and internal notes are recorded on the lead timeline. Open the underlying record to add context there." };
  }
  if (channel !== "Email" && channel !== "Internal note") {
    return { ok: false, status: 422, code: "invalid_channel", message: "Unsupported recording channel." };
  }
  const note = channel === "Email" ? `Follow-up email sent via mail client — ${subject ? `“${subject}”. ` : ""}${body}` : body;
  const res = salesPost(role, { type: "lead.note", input: { id, body: note } } as never);
  if (!res.ok) return res;
  auditAi({ action: channel === "Email" ? "AI draft recorded as sent email" : "AI draft recorded as internal note", resource: id, context: `User-reviewed draft recorded on the lead timeline · ${clampText(body, 100)}` });
  recordActivity({ capability: "Follow-up Writer", kind: "draft", summary: `Draft recorded on lead timeline (${channel.toLowerCase()})`, modelLabel: AI_PROVIDER_LABEL });
  return { ok: true, message: channel === "Email" ? "Recorded on the lead timeline as a sent follow-up email. Qubit does not send external email directly — paste the final text into your mail client." : res.message };
}

// ============================================================
// POST actions — recommendations, insights, feedback, brief
// ============================================================

export async function salesAiPost(role: WorkspaceRole, type: string, input: Record<string, unknown>): Promise<SalesAiActionResult> {
  const g = gate(role, `Sales AI · ${type}`);
  if (!g.ok) return g;
  const { scope } = g;
  const s = aiStore();

  switch (type) {
    case "qa.ask": {
      const sessionId = typeof input.sessionId === "string" && input.sessionId.length >= 6 ? input.sessionId : nextAiId("qa");
      const question = typeof input.question === "string" ? input.question : "";
      return salesAiAsk(role, scope, sessionId, question);
    }

    case "qa.newSession": {
      return { ok: true, message: "New conversation started.", sessionId: nextAiId("qa") };
    }

    case "draft.generate":
      return salesAiDraft(role, scope, input);

    case "draft.record":
      return salesAiDraftRecord(role, scope, input);

    case "recommendation.accept": {
      // CONFIRMATION IS MANDATORY — AI must never execute consequential actions silently
      if (input.confirm !== true) {
        return { ok: false, status: 422, code: "confirmation_required", message: "Review the action in the confirmation dialog first — AI recommendations are never executed without explicit user confirmation." };
      }
      const id = typeof input.id === "string" ? input.id : "";
      const recs = buildRecommendations(role, scope);
      const rec = recs.find((r) => r.id === id);
      if (!rec) return { ok: false, status: 404, code: "not_found", message: "This recommendation is no longer current — the underlying data changed. Refresh and review again." };
      if (rec.status === "dismissed") return { ok: false, status: 409, code: "dismissed", message: "This recommendation was dismissed." };

      if (rec.verb === "schedule-followup" && rec.entity.kind === "lead") {
        const dueAt = typeof input.dueAt === "number" ? input.dueAt : now() + D;
        const res = salesPost(role, { type: "lead.followup", input: { id: rec.entity.id, dueAt, type: "Call", subject: `AI-recommended follow-up — ${rec.entity.label}`, priority: rec.urgency === "High" ? "High" : "Medium" } } as never);
        if (!res.ok) return res;
        s.recommendationState.set(id, { status: "accepted", at: now() });
        auditAi({ action: "AI recommendation accepted", resource: rec.entity.label, context: `Routed to existing lead follow-up workflow · follow-up scheduled ${fmtDT(dueAt)}` });
        recordActivity({ capability: "Next Best Action", kind: "recommendation", summary: `Accepted: ${rec.action} → ${rec.entity.label}`, modelLabel: AI_PROVIDER_LABEL, entity: rec.entity });
        return { ok: true, message: `Follow-up scheduled through the existing lead workflow — ${res.message}` };
      }

      if (rec.verb === "contact" && rec.entity.kind === "followup") {
        // overdue follow-up completion is routed through the existing queue workflow with the provided outcome
        const outcome = typeof input.outcome === "string" ? input.outcome.trim() : "";
        if (outcome.length < 3) return { ok: false, status: 422, code: "outcome_required", message: "Record a short outcome — the existing Follow-up Queue workflow requires it." };
        const res = salesPost(role, { type: "followup.complete", input: { id: rec.entity.id, outcome } } as never);
        if (!res.ok) return res;
        s.recommendationState.set(id, { status: "accepted", at: now() });
        auditAi({ action: "AI recommendation accepted", resource: rec.entity.label, context: `Routed to existing follow-up completion workflow · outcome recorded` });
        recordActivity({ capability: "Next Best Action", kind: "recommendation", summary: `Accepted: ${rec.action} → ${rec.entity.label}`, modelLabel: AI_PROVIDER_LABEL, entity: rec.entity });
        return { ok: true, message: res.message };
      }

      // all other verbs route to the existing workspace — acceptance records intent + audit only
      s.recommendationState.set(id, { status: "accepted", at: now() });
      auditAi({ action: "AI recommendation accepted", resource: rec.entity.label, context: `Routed to ${rec.routesTo}` });
      recordActivity({ capability: "Next Best Action", kind: "recommendation", summary: `Accepted: ${rec.action} → ${rec.entity.label}`, modelLabel: AI_PROVIDER_LABEL, entity: rec.entity });
      return { ok: true, message: `Accepted. Continue in the existing workspace: ${rec.routesTo}.` };
    }

    case "recommendation.dismiss": {
      const id = typeof input.id === "string" ? input.id : "";
      const reason = typeof input.reason === "string" ? clampText(input.reason, 200) : undefined;
      if (!id) return { ok: false, status: 422, code: "id_required", message: "Which recommendation?" };
      s.recommendationState.set(id, { status: "dismissed", at: now(), reason });
      auditAi({ action: "AI recommendation dismissed", resource: id, context: reason ? `Reason: ${reason}` : "No reason given" });
      return { ok: true, message: "Recommendation dismissed — it stays dismissed for this session." };
    }

    case "insight.dismiss": {
      const id = typeof input.id === "string" ? input.id : "";
      if (!id) return { ok: false, status: 422, code: "id_required", message: "Which insight?" };
      s.dismissedInsights.add(id);
      auditAi({ action: "AI insight dismissed", resource: id, context: "Hidden from AI surfaces for this session" });
      return { ok: true, message: "Insight dismissed." };
    }

    case "prioritization.dismiss": {
      const id = typeof input.id === "string" ? input.id : "";
      if (!id) return { ok: false, status: 422, code: "id_required", message: "Which lead?" };
      s.dismissedPrioritization.add(id);
      auditAi({ action: "AI prioritization dismissed", resource: id, context: "Removed from the AI ranking for this session" });
      return { ok: true, message: "Removed from the AI ranking — the lead keeps its actual business status." };
    }

    case "feedback": {
      const refType = typeof input.refType === "string" ? input.refType : "";
      const refId = typeof input.refId === "string" ? input.refId : "";
      const kind = (typeof input.kind === "string" ? input.kind : "") as AiFeedbackKind;
      const reason = typeof input.reason === "string" ? clampText(input.reason, 300) : undefined;
      if (!["insight", "recommendation", "draft", "answer", "brief", "summary"].includes(refType)) {
        return { ok: false, status: 422, code: "invalid_ref", message: "Unknown feedback target." };
      }
      if (!["helpful", "not_helpful", "incorrect", "outdated"].includes(kind)) {
        return { ok: false, status: 422, code: "invalid_kind", message: "Feedback must be helpful, not helpful, incorrect or outdated." };
      }
      const entry: AiFeedbackEntry = { id: nextAiId("fb"), at: now(), refType: refType as AiFeedbackEntry["refType"], refId: clampText(refId, 60), kind, reason, role };
      s.feedback.unshift(entry);
      if (s.feedback.length > 200) s.feedback.length = 200;
      auditAi({ action: "Sales AI feedback recorded", resource: `${refType} ${refId}`, context: `${kind}${reason ? ` · ${reason}` : ""}` });
      const act = s.activity.find((a) => a.id === refId);
      if (act) act.feedback = kind;
      return { ok: true, message: "Feedback recorded — it is used for AI quality review." };
    }

    case "brief.complete": {
      const followupId = typeof input.followupId === "string" ? input.followupId : "";
      const outcome = typeof input.outcome === "string" ? input.outcome.trim() : "";
      if (outcome.length < 3) return { ok: false, status: 422, code: "outcome_required", message: "Record a short outcome — the existing Follow-up Queue workflow requires it." };
      const res = salesPost(role, { type: "followup.complete", input: { id: followupId, outcome } } as never);
      if (!res.ok) return res;
      auditAi({ action: "Follow-up completed from AI Daily Brief", resource: followupId, context: `Outcome: ${clampText(outcome, 120)} · routed through the existing Follow-up Queue workflow` });
      aiStore().briefCache.clear(); // the next view recomputes honestly
      return { ok: true, message: res.message };
    }

    default:
      return { ok: false, status: 400, code: "unknown_action", message: "Unknown Sales AI action." };
  }
}
