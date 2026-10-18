// ============================================================
// Qubit One — Sales AI (Phase 7) · shared types & constants
// ============================================================
// CLIENT-SAFE. The AI layer is an intelligence & decision-support
// layer on top of the Sales Operating System (Phase 6) — never a
// source of truth. Types here describe structured AI output only;
// all business facts continue to live in sales-data.ts and are
// retrieved through the SAME authorized enforcement layer the
// Sales screens use (sales-server.salesGet / salesPost).
// ============================================================

import type { ScreenId } from "./screens";

// ---------- model / runtime identity (provider-abstracted) ----------

/**
 * The UI never depends on a vendor name — it renders this label.
 * The backend orchestration layer (ai-engine.ts) owns provider
 * selection; swapping providers changes only that file + label.
 */
export const AI_RUNTIME = {
  id: "qubit-sales-ai",
  version: "v1",
  label: "Qubit AI runtime",
  modelLabel: "GLM (managed)",
} as const;

export type AiConfidence = "High" | "Medium" | "Low" | "Insufficient data";

export type AiOutputKind = "FACT" | "INFERENCE" | "RECOMMENDATION";

export type AiFeedbackKind = "helpful" | "not_helpful" | "incorrect" | "outdated";

/** Deep-link target for a source/evidence reference. */
export type AiEntityScreen =
  | "lead-detail"
  | "contact-detail"
  | "account-detail"
  | "opportunity-detail"
  | "quotation-detail"
  | "order-detail"
  | "visit-detail"
  | "sales-pipeline"
  | "sales-forecast"
  | "followup-queue"
  | "customer-meetings"
  | "whatsapp-conversation"
  | "customer-activity"
  | "sales-home"
  | "sales-targets"
  | "sales-ai-home"
  | "ai-lead-prioritization"
  | "ai-followup-writer"
  | "ai-customer-summary"
  | "ai-next-best-action"
  | "ai-pipeline-review"
  | "ai-daily-brief"
  | "ai-sales-qa";

export interface AiSourceRef {
  /** Human-readable reference, e.g. "Opportunity QO-1024" */
  label: string;
  /** What kind of record it is — shown as a quiet chip */
  kind: string;
  /** Detail line, e.g. "Last activity: 16 Oct 2026" */
  detail?: string;
  /** Deep-link target; omitted → reference only, not navigable */
  screen?: AiEntityScreen;
  /** Deep-link param value (leadId, opportunityId, …) */
  id?: string;
  /** Which ScreenParams key carries the id (defaults per screen) */
  param?: string;
}

// ---------- intelligence primitives ----------

export interface AiInsight {
  id: string;
  capability: string;
  /** visual category — kept restrained, never neon */
  kind: "risk" | "attention" | "change" | "opportunity";
  title: string;
  /** the INFERENCE, with hedged enterprise language */
  statement: string;
  /** the FACTS underneath — one line each, traceable */
  facts: string[];
  evidence: AiSourceRef[];
  confidence: AiConfidence;
  generatedAt: number;
  /** e.g. "Pipeline data refreshed 09:42 IST" */
  freshnessLabel: string;
  entity?: { label: string; screen: AiEntityScreen; id?: string; param?: string };
  action?: { label: string; screen: AiEntityScreen; id?: string; param?: string };
  dismissed?: boolean;
}

export type NbaVerb =
  | "contact"
  | "schedule-followup"
  | "send-quote"
  | "arrange-meeting"
  | "field-visit"
  | "update-opportunity"
  | "escalate"
  | "wait";

export interface AiRecommendation {
  id: string;
  verb: NbaVerb;
  /** short imperative, e.g. "Schedule a follow-up within 24 hours" */
  action: string;
  reason: string;
  evidence: AiSourceRef[];
  facts: string[];
  urgency: "High" | "Medium" | "Low";
  confidence: AiConfidence;
  /** only when reliably computable — omitted otherwise */
  expectedImpact?: string;
  entity: { kind: "lead" | "opportunity" | "followup" | "quotation" | "account"; id: string; label: string; screen: AiEntityScreen; param: string };
  generatedAt: number;
  status: "open" | "accepted" | "dismissed";
  /** existing Qubit workflow this recommendation routes into when accepted */
  routesTo: string;
}

// ---------- follow-up writer ----------

export type WriterChannel = "Email" | "WhatsApp Business" | "Internal note";
export type WriterTone = "Professional" | "Friendly" | "Direct" | "Formal";
export type WriterPurpose =
  | "Post-meeting recap"
  | "Quotation follow-up"
  | "Re-engage inactive lead"
  | "Request a meeting"
  | "Gentle payment reminder"
  | "General check-in";
export type WriterLength = "Short" | "Medium" | "Detailed";
export type WriterLanguage = "English" | "Hindi" | "Marathi" | "Hinglish";
export type WriterMode = "generate" | "shorten" | "expand" | "professionalize" | "simplify" | "translate";

export const WRITER_CHANNELS: WriterChannel[] = ["Email", "WhatsApp Business", "Internal note"];
export const WRITER_TONES: WriterTone[] = ["Professional", "Friendly", "Direct", "Formal"];
export const WRITER_PURPOSES: WriterPurpose[] = [
  "Post-meeting recap",
  "Quotation follow-up",
  "Re-engage inactive lead",
  "Request a meeting",
  "Gentle payment reminder",
  "General check-in",
];
export const WRITER_LENGTHS: WriterLength[] = ["Short", "Medium", "Detailed"];
export const WRITER_LANGUAGES: WriterLanguage[] = ["English", "Hindi", "Marathi", "Hinglish"];

/** The authorized context the writer was grounded in — shown to the user. */
export interface WriterContext {
  entityKind: "lead" | "opportunity" | "account";
  entityId: string;
  title: string;
  company: string;
  ownerName: string;
  contactName?: string;
  contactDesignation?: string;
  preferredChannel?: string;
  consent?: { whatsapp: boolean; email: boolean; call: boolean };
  channelReady: { email: boolean; whatsapp: boolean; note: boolean };
  /** conversation to route a WhatsApp send into, when one exists */
  whatsapp?: { conversationId: string; contactName: string; waNumber: string };
  stageOrStatus?: string;
  dealValue?: string;
  lastInteraction?: { at: number; type: string; summary: string };
  openQuotation?: { id: string; number: string; status: string; total: string } | null;
  nextAction?: string;
  nextFollowUpAt?: number;
  sourceRefs: AiSourceRef[];
}

export interface WriterDraft {
  id: string;
  mode: WriterMode;
  channel: WriterChannel;
  tone: WriterTone;
  purpose: WriterPurpose;
  length: WriterLength;
  language: WriterLanguage;
  subject?: string;
  body: string;
  generatedAt: number;
  modelLabel: string;
  /** "ai" = model-generated; "template" = deterministic fallback when AI is unavailable */
  origin: "ai" | "template";
  contextRefs: AiSourceRef[];
}

// ---------- structured Q&A answer contract ----------

export interface QaKeyNumber {
  label: string;
  value: string;
}

export interface QaAnswer {
  answer: string;
  keyNumbers: QaKeyNumber[];
  reasoning: string[];
  sources: AiSourceRef[];
  actions: { label: string; screen: AiEntityScreen; id?: string; param?: string }[];
  confidence: AiConfidence;
  /** true when the honest answer is "not enough authorized data" */
  insufficient: boolean;
  insufficientNote?: string;
}

export const QA_SUGGESTED_QUESTIONS: string[] = [
  "What are my highest-priority leads?",
  "Which opportunities have been inactive for more than 14 days?",
  "How is my pipeline performing against target?",
  "Which quotations are waiting for approval?",
  "Which opportunities are at risk?",
  "What should I focus on today?",
  "Show my sales performance this month.",
  "Which follow-ups are overdue?",
];

// ---------- daily brief ----------

export interface BriefItem {
  id: string;
  title: string;
  detail?: string;
  at?: number;
  screen: AiEntityScreen;
  param?: string;
  entityId?: string;
  /** follow-up items can be completed through the EXISTING follow-up workflow */
  completable?: boolean;
  followupId?: string;
  state?: string;
}

export interface BriefSection {
  key: string;
  no: number;
  title: string;
  items: BriefItem[];
  moreScreen?: AiEntityScreen;
  moreLabel?: string;
}

export interface DailyBrief {
  role: string;
  scope: "company" | "team" | "own";
  greeting: string;
  dateLabel: string;
  introLine: string;
  sections: BriefSection[];
  generatedAt: number;
  freshnessLabel: string;
  /** count of items across priority sections — kept concise on purpose */
  totalItems: number;
}

// ---------- AI activity trail (recent generations) ----------

export interface AiActivityEntry {
  id: string;
  at: number;
  capability: string;
  /** what was generated: summary | recommendation | draft | analysis | answer */
  kind: "summary" | "recommendation" | "draft" | "analysis" | "answer";
  summary: string;
  modelLabel: string;
  confidence?: AiConfidence;
  feedback?: AiFeedbackKind;
  entity?: { label: string; screen: AiEntityScreen; id?: string; param?: string };
}

// ---------- feedback ----------

export interface AiFeedbackEntry {
  id: string;
  at: number;
  refType: "insight" | "recommendation" | "draft" | "answer" | "brief" | "summary";
  refId: string;
  kind: AiFeedbackKind;
  reason?: string;
  role: string;
}

// ---------- quick actions (screen 103) ----------

export interface AiQuickAction {
  label: string;
  description: string;
  screen: ScreenId;
  num: string;
}
