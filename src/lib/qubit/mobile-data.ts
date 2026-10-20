// ============================================================
// Qubit One — Mobile experience data (client-safe, pure data)
// ============================================================
// Phase 18 · screens 285–300. Mobile is NOT a scaled-down desktop
// (spec §4): it is a genuine mobile-first experience over the ONE
// Qubit One platform. This file holds only static configuration —
// every figure and record is served from mobile-server, which
// composes the AUTHORITATIVE existing systems (workspace task
// store, approvals, mail, meetings, Sales OS via salesGet, HR,
// service canon). No mobile database exists (spec §5, §42).
// ============================================================

export const MOBILE_PERIOD = {
  label: "Friday, 13 November 2026",
  timezone: "IST (Asia/Kolkata)",
} as const;

/** §30 — contextual mobile navigation model. Business exposes only
 *  the modules the caller's role actually holds (permission-aware). */
export type MobileTab = "home" | "work" | "business" | "communication" | "ai" | "profile";

export const MOBILE_TABS: { id: MobileTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "work", label: "My Work" },
  { id: "business", label: "Business" },
  { id: "communication", label: "Comms" },
  { id: "ai", label: "AI" },
  { id: "profile", label: "Profile" },
];

/** Which Business modules each role sees on mobile — mirrors the
 *  platform's real authorization, not a mobile-specific grant. */
export const ROLE_BUSINESS_MODULES: Record<string, { id: string; label: string; screen: string; note?: string }[]> = {
  administrator: [
    { id: "sales", label: "Sales", screen: "mobile-sales-home" },
    { id: "service", label: "Service", screen: "mobile-service-home" },
    { id: "finance", label: "Finance", screen: "finance-analytics", note: "Analytics view — Finance OS lives on desktop" },
    { id: "hr", label: "HR", screen: "hr-analytics", note: "Aggregated, privacy-safe" },
    { id: "inventory", label: "Inventory", screen: "inventory-analytics", note: "Analytics view" },
    { id: "marketing", label: "Marketing", screen: "marketing-analytics", note: "Analytics view" },
  ],
  "dept-head": [
    { id: "sales", label: "Sales", screen: "mobile-sales-home" },
    { id: "service", label: "Service", screen: "mobile-service-home" },
    { id: "hr", label: "HR", screen: "hr-analytics", note: "Aggregated, privacy-safe" },
  ],
  "sales-exec": [
    { id: "sales", label: "Sales", screen: "mobile-sales-home" },
    { id: "service", label: "Service", screen: "mobile-service-home" },
  ],
  "hr-manager": [
    { id: "hr", label: "HR", screen: "hr-analytics", note: "Aggregated, privacy-safe" },
    { id: "service", label: "Service", screen: "mobile-service-home" },
  ],
  employee: [
    { id: "service", label: "Service", screen: "mobile-service-home" },
  ],
};

export interface MobileQuickAction {
  id: string;
  label: string;
  /** navigation target (screens are the actions — no duplicate flows) */
  screen?: string;
  params?: Record<string, string>;
  roles: string[]; // roles that see this action
}

/** §6 — quick actions. Every action routes into an EXISTING screen /
 *  workflow. Communication actions use legitimate device links
 *  (tel:, mailto:) or the configured WhatsApp Business integration —
 *  never a simulated channel (spec §8, §287). */
export const QUICK_ACTIONS: MobileQuickAction[] = [
  { id: "create-lead", label: "Create Lead", screen: "lead-create", roles: ["administrator", "dept-head", "sales-exec"] },
  { id: "new-task", label: "New Task", screen: "my-tasks", roles: ["administrator", "dept-head", "sales-exec", "hr-manager", "employee"] },
  { id: "start-meeting", label: "Meetings", screen: "mobile-meetings", roles: ["administrator", "dept-head", "sales-exec", "hr-manager", "employee"] },
  { id: "attendance", label: "Attendance", screen: "mobile-attendance", roles: ["administrator", "dept-head", "sales-exec", "hr-manager", "employee"] },
  { id: "approvals", label: "Approvals", screen: "mobile-approvals", roles: ["administrator", "dept-head", "sales-exec", "hr-manager", "employee"] },
  { id: "mail", label: "Mail", screen: "mobile-mail", roles: ["administrator", "dept-head", "sales-exec", "hr-manager", "employee"] },
  { id: "ai", label: "Open AI", screen: "mobile-ai", roles: ["administrator", "dept-head", "sales-exec", "hr-manager", "employee"] },
  { id: "whatsapp", label: "WhatsApp", screen: "mobile-whatsapp", roles: ["administrator", "dept-head", "sales-exec"] },
  { id: "add-followup", label: "Follow-up", screen: "followup-queue", roles: ["administrator", "dept-head", "sales-exec"] },
  { id: "create-visit", label: "Plan Visit", screen: "visit-planner", roles: ["administrator", "dept-head", "sales-exec"] },
];

/** §13 — field-visit lifecycle. Transitions are enforced server-side. */
export const VISIT_LIFECYCLE = ["Scheduled", "En Route", "Arrived", "In Progress", "Paused", "Completed"] as const;
export type VisitLifecycleStage = (typeof VISIT_LIFECYCLE)[number];

export const VISIT_TRANSITIONS: Record<string, VisitLifecycleStage[]> = {
  Scheduled: ["En Route"],
  "En Route": ["Arrived"],
  Arrived: ["In Progress"],
  "In Progress": ["Paused", "Completed"],
  Paused: ["In Progress", "Completed"],
  Completed: [],
};

/** Checklist templates per visit purpose. Critical items block
 *  completion where configured (spec §13). */
export interface ChecklistItemDef {
  id: string;
  label: string;
  critical: boolean;
}

export const VISIT_CHECKLISTS: Record<string, ChecklistItemDef[]> = {
  service: [
    { id: "ck-safety", label: "Site safety check completed", critical: true },
    { id: "ck-diagnosis", label: "Fault diagnosis recorded", critical: true },
    { id: "ck-parts", label: "Parts used recorded against the asset", critical: false },
    { id: "ck-photos", label: "Evidence photos attached", critical: false },
    { id: "ck-customer", label: "Customer walkthrough of the fix", critical: false },
  ],
  sales: [
    { id: "ck-agenda", label: "Visit agenda shared with customer", critical: false },
    { id: "ck-outcome", label: "Visit outcome recorded", critical: true },
    { id: "ck-next", label: "Next step agreed", critical: false },
  ],
};

/** §32 — offline honesty. Offline queueing is NOT implemented in this
 *  phase; the mobile experience states this truthfully. */
export const OFFLINE_SUPPORT = {
  implemented: false,
  message: "Connection required",
  detail: "Qubit One Mobile requires a connection. Actions are never queued locally or replayed blindly — nothing pretends to have completed offline.",
} as const;

/** Mobile AI quick prompts (§21 / screen 300). Each maps to a
 *  server-composed, permission-scoped context — the AI never reads
 *  the database directly (spec §41). */
export const AI_QUICK_PROMPTS = [
  { id: "summarize-day", label: "Summarize my day", prompt: "Summarize my day" },
  { id: "pending-approvals", label: "Show my pending approvals", prompt: "Show my pending approvals" },
  { id: "leads-followup", label: "Which leads need follow-up?", prompt: "Which leads need follow-up?" },
  { id: "meetings-today", label: "Summarize today's meetings", prompt: "Summarize today's meetings" },
  { id: "service-visits", label: "Show my open service visits", prompt: "Show my open service visits" },
] as const;

export type AiPromptId = (typeof AI_QUICK_PROMPTS)[number]["id"];
