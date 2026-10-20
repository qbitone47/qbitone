// ============================================================
// Qubit One — Platform hardening data (client-safe, pure data)
// ============================================================
// Phase 18 · screens 301–308. Static catalogs and policies for the
// enterprise hardening layer. Telemetry, backup files, QA runs and
// findings LIVE in platform-server (server-owned, audited); this
// file never holds measurements — only definitions and policy.
// ============================================================

/** QA viewport matrix (spec §22). */
export const BREAKPOINTS = [
  { id: "mobile", label: "Mobile", width: 390, height: 844 },
  { id: "mobile-lg", label: "Mobile L", width: 430, height: 932 },
  { id: "tablet", label: "Tablet", width: 768, height: 1024 },
  { id: "laptop", label: "Laptop", width: 1280, height: 800 },
  { id: "desktop", label: "Desktop", width: 1440, height: 900 },
] as const;

/** Accessibility checklist definitions (spec §24 / §39). */
export const A11Y_CHECKS = [
  { id: "keyboard", label: "Keyboard navigation", detail: "Every interactive element reachable and operable by keyboard." },
  { id: "focus", label: "Visible focus management", detail: "Focus indicators visible; modals trap and restore focus." },
  { id: "contrast", label: "Contrast", detail: "Text meets WCAG AA contrast on its surface." },
  { id: "labels", label: "Labels & ARIA", detail: "Controls carry accessible names; landmarks labelled." },
  { id: "semantics", label: "Semantic structure", detail: "main/header/nav/section used; one h1 per screen." },
  { id: "screen-reader", label: "Screen-reader compatibility", detail: "Reading order sane; live regions announce async results." },
  { id: "form-errors", label: "Form errors", detail: "Errors are announced and described in text, not color alone." },
  { id: "touch-targets", label: "Touch target size", detail: "Interactive targets ≥ 44px with adequate separation." },
  { id: "motion", label: "Motion preferences", detail: "Animation respects prefers-reduced-motion." },
  { id: "zoom", label: "Zoom behavior", detail: "Layout survives 200% text zoom without loss." },
] as const;

/** Security posture catalog (spec §25). Values/measurements come
 *  from the server; secrets are NEVER included anywhere. */
export const SECURITY_DOMAINS = [
  { id: "authentication", label: "Authentication", checks: ["MFA", "SSO", "Sessions", "Passkeys", "Lockout"] },
  { id: "authorization", label: "Authorization", checks: ["RBAC", "ABAC", "Permission anomalies", "Excessive privileges"] },
  { id: "application", label: "Application", checks: ["Dependency vulnerabilities", "Security headers", "API protection", "Rate limiting", "Input validation"] },
  { id: "infrastructure", label: "Infrastructure", checks: ["TLS", "Secrets", "Network policies", "Container security"] },
  { id: "data", label: "Data", checks: ["Encryption at rest", "Sensitive data policies", "Backup encryption", "Retention"] },
] as const;

/** Monitoring service registry (spec §27). Status values are
 *  computed by the server from real probes; this defines the shape. */
export type ServiceHealth = "healthy" | "degraded" | "unavailable" | "maintenance";

export const MONITOR_CATALOG = [
  { id: "application", label: "Application", dependency: "—" },
  { id: "api", label: "API layer", dependency: "Application · Database" },
  { id: "database", label: "Database", dependency: "—" },
  { id: "stores", label: "Process stores", dependency: "Application" },
  { id: "integrations", label: "Integrations", dependency: "Enterprise integration map" },
  { id: "ai", label: "AI services", dependency: "Qubit AI runtime" },
  { id: "storage", label: "Storage", dependency: "—" },
  { id: "mail", label: "Mail transport", dependency: "Mail integration" },
  { id: "whatsapp", label: "WhatsApp Business", dependency: "Meta API" },
  { id: "jobs", label: "Scheduled jobs", dependency: "Qubit scheduler" },
  { id: "backups", label: "Backups", dependency: "Storage" },
] as const;

/** Release lifecycle (spec §28). */
export const RELEASE_STAGES = ["Draft", "Validation", "Approved", "Deploying", "Verification", "Released"] as const;
export const RELEASE_FAILURE_STAGES = ["Failed", "Rollback / Recovery"] as const;

export const ENVIRONMENTS = ["development", "test", "staging", "production"] as const;

/** DR policy (spec §35) — the targets this environment commits to. */
export const DR_POLICY = {
  rpoTargetMinutes: 15,
  rtoTargetMinutes: 60,
  retentionDays: 14,
  verificationRequired: true,
  policyNote: "A backup that has never been verified does not count as recoverable. Restore tests run against a staging copy — production is never restored silently (spec §26).",
} as const;

/** System status categories (spec §29). */
export const STATUS_CATEGORIES = ["Operational", "Degraded", "Partial Outage", "Major Outage", "Maintenance"] as const;
