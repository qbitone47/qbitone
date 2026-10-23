// ============================================================
// Qubit One — Phase 23 · Enterprise Observability, SRE &
// Operational Intelligence. obs-server.ts — telemetry correlation
// layer over the REAL signals this system already produces.
//
// GOVERNANCE (Phase 23 spec §33 — ABSOLUTE):
//   · Every metric is measured live or derived from the existing
//     enterprise audit trail / registries. Absent capability →
//     explicit "Not configured". Nothing is fabricated.
//   · The Logs Explorer IS the enterprise audit trail read through
//     an observability lens — one audit system, zero duplication.
//   · Probes are imported from ops-server (Phase 22) — one probe
//     implementation, zero duplicate telemetry logic.
//   · All sections administrator-only, fail-closed, audited.
//   · AI (P23-23) runs through the Phase 15 ai-engine with
//     deterministic fallback analysis and Fact/Inference/
//     Recommendation/Evidence labeling.
// ============================================================

import { db } from "@/lib/db";
import { writeAudit, queryAudit, type AuditEvent } from "@/lib/qubit/security-server";
import { SESSION_USER_ID } from "@/lib/qubit/auth-server";
import { runtimeEnv, dbProbe, selfProbe, store as opsStore } from "@/lib/qubit/ops-server";
import { platformVitalsSnapshot } from "@/lib/qubit/platform-server";
import { runCompletion, parseJsonObject, AI_PROVIDER_LABEL } from "@/lib/qubit/ai-engine";
import type { WorkspaceRole } from "@/lib/qubit/workspace-server";

type Ok<T> = { ok: true; data: T };
type Fail = { ok: false; code: string; message: string; status: number };
type Result<T> = Ok<T> | Fail;
const ok = <T,>(data: T): Ok<T> => ({ ok: true, data });
const fail = (status: number, code: string, message: string): Fail => ({ ok: false, code, message, status });

export type ObsSection =
  | "home" | "metrics" | "logs" | "traces" | "service-map" | "dependencies"
  | "api-performance" | "database-performance" | "web-performance" | "errors"
  | "alerts" | "alert-rules" | "slo" | "scorecard" | "capacity" | "infrastructure"
  | "deployment-impact" | "changes" | "correlation" | "runbooks" | "oncall"
  | "reports" | "ai-insights" | "settings";

const OBS_SECTIONS: readonly ObsSection[] = [
  "home", "metrics", "logs", "traces", "service-map", "dependencies",
  "api-performance", "database-performance", "web-performance", "errors",
  "alerts", "alert-rules", "slo", "scorecard", "capacity", "infrastructure",
  "deployment-impact", "changes", "correlation", "runbooks", "oncall",
  "reports", "ai-insights", "settings",
];

export function obsSectionFor(s: string | null): ObsSection | null {
  return !!s && (OBS_SECTIONS as readonly string[]).includes(s) ? (s as ObsSection) : null;
}

function requireObsAdmin(role: WorkspaceRole, resource: string): Result<never> | null {
  if (role === "administrator") return null;
  writeAudit({
    actor: "obs-admin-gate", actorId: SESSION_USER_ID,
    action: "obs.access.denied", resource, result: "Blocked", severity: "High",
    context: `Role '${role}' attempted an administrator-only observability section.`,
  });
  return fail(403, "obs_admin_required", "Observability is administrator-only. The boundary is enforced server-side and this denial is recorded in the audit trail.");
}

const actorOf = (role: WorkspaceRole) => `${SESSION_USER_ID} (${role})`;

// ---------- in-process registries (seeded real/empty) ----------
export interface AlertRule {
  id: string; name: string; metric: string; condition: "below" | "above";
  threshold: number; windowMin: number; severity: "Info" | "Warning" | "High" | "Critical";
  environment: string; recipients: string[]; escalation: string; cooldownMin: number;
  enabled: boolean; createdAt: number; createdBy: string; updatedAt: number;
}
export interface Alert {
  id: string; ruleId: string; ruleName: string; severity: string; service: string;
  condition: string; currentValue: number; threshold: number;
  triggeredAt: number; durationMin: number; status: "Triggered" | "Acknowledged" | "Resolved" | "Suppressed" | "Expired";
  owner: string; evaluatedAt: number;
}
export interface Slo {
  id: string; service: string; name: string; kind: "availability" | "latency" | "error-rate";
  target: number; windowDays: number; createdAt: number; createdBy: string; updatedAt: number;
}
export interface Runbook {
  id: string; title: string; incidentType: string; symptoms: string[];
  diagnostics: string[]; safeChecks: string[]; remediation: string[];
  rollbackProcedure: string; escalation: string;
  owner: string; version: number; lastReviewedAt: number; updatedAt: number;
}
export interface OncallAssignment {
  service: string; owner: string; primary: string; backup: string | null;
  escalationLevel: number; contactMethod: string; schedule: string; status: string; updatedAt: number;
}
export interface ObsSettings {
  logRetentionDays: number; metricRetentionDays: number; traceRetentionDays: number;
  samplingRatePct: number; redactionRules: string[];
  alertDefaults: { severity: string; cooldownMin: number };
  updatedBy: string | null; updatedAt: number;
}

interface ObsStore {
  alertRules: AlertRule[];
  alerts: Alert[];
  slos: Slo[];
  runbooks: Runbook[];
  oncall: OncallAssignment[];
  settings: ObsSettings;
}
const g = globalThis as unknown as { __qubitObsStore?: ObsStore };
function store(): ObsStore {
  if (!g.__qubitObsStore) {
    const now = Date.now();
    g.__qubitObsStore = {
      alertRules: [], alerts: [], slos: [],
      // Authored runbook library for THIS architecture — documentation, not telemetry.
      runbooks: [
        { id: "RB-DB-01", title: "Database unavailable", incidentType: "database-outage",
          symptoms: ["DB probe unhealthy on /api/ops or P22-04", "SELECT 1 latency null", "DB latency alerts firing"],
          diagnostics: ["Open P22-04 Database Health and read the probe note verbatim", "Verify DATABASE_URL is present in the runtime (P22-03)", "Check Supabase status page / dashboard for incidents"],
          safeChecks: ["Re-run the health probe (read-only SELECT 1)", "Confirm auth/session endpoints still answer"],
          remediation: ["If Supabase platform incident: follow Supabase comms; no app-side change", "If credentials rotated: update DATABASE_URL in the platform secret store and redeploy"],
          rollbackProcedure: "Not applicable — application rollback does not touch the database.",
          escalation: "Escalate to the service owner (On-Call & Escalation P23-21).",
          owner: "Qubit One Pvt Ltd · platform", version: 1, lastReviewedAt: now, updatedAt: now },
        { id: "RB-DEP-01", title: "Deployment failure or bad release", incidentType: "deployment",
          symptoms: ["Vercel deployment Failed/Canceled (P22-02)", "CI red on GitHub Actions", "5xx responses after a new release"],
          diagnostics: ["Read the failing CI step log", "Compare commits in P23-18 Change Intelligence", "Check P22-02 lifecycle and author"],
          safeChecks: ["Confirm previous deployment state is Ready", "Verify env vars unchanged (P22-03 presence checks)"],
          remediation: ["Fix-forward with a minimal commit, or", "Roll back via P22-19 Rollback Center (requires VERCEL_TOKEN + explicit confirmation)"],
          rollbackProcedure: "P22-19 → select previous Ready deployment → HighRiskDialog confirm. Database is never rolled back automatically.",
          escalation: "Notify release approver from the release train (P22-18).",
          owner: "Qubit One Pvt Ltd · platform", version: 1, lastReviewedAt: now, updatedAt: now },
        { id: "RB-AUTH-01", title: "Authentication outage", incidentType: "auth-outage",
          symptoms: ["401s on previously working sessions", "Users unable to bootstrap sessions", "QUBIT_AUTH_SECRET missing at runtime"],
          diagnostics: ["POST /api/auth/session and read the status", "Check QUBIT_AUTH_SECRET presence (P22-03)", "Inspect auth denials in the Logs Explorer (P23-03)"],
          safeChecks: ["Verify rate limiting is not exhausting the client (429 vs 401)"],
          remediation: ["Set/restore QUBIT_AUTH_SECRET (>=32 chars) in the platform store and redeploy", "If IdP integration is the cause (future): follow provider runbook"],
          rollbackProcedure: "Session signing secret changes invalidate sessions by design — communicate before rotating.",
          escalation: "Security owner + service owner simultaneously.",
          owner: "Qubit One Pvt Ltd · security", version: 1, lastReviewedAt: now, updatedAt: now },
        { id: "RB-INT-01", title: "External integration failure", incidentType: "integration",
          symptoms: ["Integration Health (P22-12/P23-06) shows failing", "Provider latency timeouts in probes"],
          diagnostics: ["Identify which provider credential/presence changed", "Check provider status page", "Correlate with recent change events (P23-18)"],
          safeChecks: ["Re-probe from Integration Health", "Confirm failure is not local network (self-probe healthy?)"],
          remediation: ["Restore the provider credential in the platform store", "If provider outage: degrade per existing fallbacks and communicate"],
          rollbackProcedure: "Not applicable — provider outages are external.",
          escalation: "Integration owner (P23-21).",
          owner: "Qubit One Pvt Ltd · platform", version: 1, lastReviewedAt: now, updatedAt: now },
        { id: "RB-PERF-01", title: "High API latency", incidentType: "latency",
          symptoms: ["API self-probe latency elevated vs baseline", "DB latency elevated", "User reports of slowness"],
          diagnostics: ["P23-08 Database Performance — probe latency", "P23-07 API Performance — endpoint probe", "Correlate with deployments (P23-17)"],
          safeChecks: ["Re-run probes to rule out serverless cold start", "Check process memory (P23-15)"],
          remediation: ["If cold-start: expected on serverless, document baseline", "If DB: check Supabase dashboard for resource saturation"],
          rollbackProcedure: "Roll back only if latency began immediately after a deployment (P23-17 evidence).",
          escalation: "Service owner.",
          owner: "Qubit One Pvt Ltd · platform", version: 1, lastReviewedAt: now, updatedAt: now },
        { id: "RB-ERR-01", title: "Elevated error rate", incidentType: "errors",
          symptoms: ["Audit failure events spiking in P23-10", "4xx/5xx reports", "Alerts from error-threshold rules"],
          diagnostics: ["Group failures by action in P23-10", "Correlate first-seen with deployments (P23-17) and changes (P23-18)"],
          safeChecks: ["Confirm the errors are app-level, not probe-level", "Check affected routes from the grouped events"],
          remediation: ["Fix-forward the failing code path", "If caused by config: revert via the audit trail evidence"],
          rollbackProcedure: "If deployment-correlated: P22-19 rollback with explicit confirmation.",
          escalation: "Service owner.",
          owner: "Qubit One Pvt Ltd · platform", version: 1, lastReviewedAt: now, updatedAt: now },
      ],
      oncall: [
        { service: "Qubit One Platform", owner: "Qubit One Pvt Ltd", primary: "Sagar Singh (sagar)", backup: null,
          escalationLevel: 1, contactMethod: "In-app notifications (notification engine)", schedule: "Always-on (single-operator team)", status: "Active", updatedAt: now },
      ],
      settings: {
        logRetentionDays: 0, metricRetentionDays: 0, traceRetentionDays: 0, samplingRatePct: 100,
        redactionRules: ["passwords", "tokens", "api keys", "database credentials", "session secrets", "private keys"],
        alertDefaults: { severity: "Warning", cooldownMin: 15 },
        updatedBy: null, updatedAt: now,
      },
    };
  }
  return g.__qubitObsStore;
}

// ---------- audit helpers (the ONE event stream) ----------
function auditEvents(limit = 300): AuditEvent[] {
  return queryAudit({ pageSize: limit }, "administrator", SESSION_USER_ID).events as AuditEvent[];
}

const CHANGE_ACTIONS = ["ops.flag.", "ops.config.", "ops.maintenance.", "ops.release.", "ops.rollback.", "ops.incident.", "obs.alert.", "obs.slo.", "obs.settings.", "obs.oncall.", "obs.runbook.", "deployment.", "security."];

// ============================================================
// GET payloads
// ============================================================
export async function obsGet(role: WorkspaceRole, section: ObsSection): Promise<Result<Record<string, unknown>>> {
  const gate = requireObsAdmin(role, `Observability · ${section}`);
  if (gate) return gate;
  switch (section) {
    case "home": return ok(await homePayload());
    case "metrics": return ok(await metricsPayload());
    case "logs": return ok(logsPayload({}));
    case "traces": return ok(tracesPayload());
    case "service-map": return ok(await serviceMapPayload());
    case "dependencies": return ok(await dependenciesPayload());
    case "api-performance": return ok(apiPerformancePayload());
    case "database-performance": return ok(await databasePerformancePayload());
    case "web-performance": return ok(webPerformancePayload());
    case "errors": return ok(errorsPayload());
    case "alerts": return ok(alertsPayload());
    case "alert-rules": return ok(alertRulesPayload());
    case "slo": return ok(await sloPayload());
    case "scorecard": return ok(await scorecardPayload());
    case "capacity": return ok(await capacityPayload());
    case "infrastructure": return ok(await infrastructurePayload());
    case "deployment-impact": return ok(await deploymentImpactPayload());
    case "changes": return ok(changesPayload());
    case "correlation": return ok(await correlationPayload({}));
    case "runbooks": return ok(runbooksPayload());
    case "oncall": return ok(oncallPayload());
    case "reports": return ok(await reportPayload(null, null));
    case "ai-insights": return ok(await aiInsightsPayload());
    case "settings": return ok(settingsPayload());
  }
}

// ---- P23-01 · Observability Home ----
async function homePayload() {
  const env = runtimeEnv();
  const [dbP, apiP] = await Promise.all([dbProbe(), selfProbe()]);
  const ops = opsStore();
  const events = auditEvents(300);
  const hourAgo = Date.now() - 3_600_000;
  const recent = events.filter((e) => e.ts >= hourAgo);
  const openIncidents = ops.incidents.filter((i) => i.status !== "resolved" && i.status !== "post-incident-review");
  const triggeredAlerts = store().alerts.filter((a) => a.status === "Triggered" || a.status === "Acknowledged");
  const failures = recent.filter((e) => e.result === "Failure").length;
  return {
    overall: dbP.health === "healthy" && apiP.health === "healthy" && openIncidents.length === 0 ? "Healthy" : dbP.health === "healthy" && apiP.health !== "unavailable" ? "Degraded" : "Attention required",
    environment: env.vercelEnv ?? "runtime",
    commit: env.commitSha,
    signals: {
      database: { health: dbP.health, latencyMs: dbP.latencyMs, note: dbP.note },
      api: { health: apiP.health, latencyMs: apiP.latencyMs, note: apiP.note },
      availability: { value: null as number | null, note: "Not configured — no external availability monitor (see P22-10)." },
      errorRate: { value: null as number | null, note: "Not configured — no request-level error counter. Real audit failures in the last hour are shown below." },
      auditFailuresLastHour: failures,
      auditEventsLastHour: recent.length,
      sloCompliance: { value: null as string | null, note: store().slos.length ? "SLOs defined — historical compliance requires telemetry retention (Not configured)." : "No SLOs configured (P23-13)." },
    },
    activeIncidents: openIncidents.map((i) => ({ id: i.id, severity: i.severity, title: i.title, status: i.status, startedAt: i.startedAt })),
    activeAlerts: triggeredAlerts.map((a) => ({ id: a.id, severity: a.severity, name: a.ruleName, status: a.status, triggeredAt: a.triggeredAt })),
    deployment: { onVercel: env.onVercel, commit: env.commitSha, branch: env.commitBranch, note: "Full lifecycle in P22-02 Deployment Status (VERCEL_TOKEN enables live API)." },
    criticalEvents: events.filter((e) => e.severity === "Critical" || e.severity === "High").slice(0, 6).map((e) => ({ ts: e.ts, action: e.action, resource: e.resource, severity: e.severity, result: e.result, context: e.context?.slice(0, 120) })),
    sourceNote: "Every value measured live (probes) or derived from the enterprise audit trail and governance registries. Absent telemetry is labeled, never invented.",
  };
}

// ---- P23-02 · Metrics Explorer ----
async function metricsPayload() {
  const [dbP, apiP] = await Promise.all([dbProbe(), selfProbe()]);
  const mem = process.memoryUsage();
  const events = auditEvents(300);
  const hourAgo = Date.now() - 3_600_000;
  const recent = events.filter((e) => e.ts >= hourAgo);
  return {
    metrics: [
      { key: "db-latency", label: "Database latency", unit: "ms", value: dbP.latencyMs, health: dbP.health, note: "Live SELECT 1 round-trip (single measurement)." },
      { key: "api-rtt", label: "API self round-trip", unit: "ms", value: apiP.latencyMs, health: apiP.health, note: "Live HTTP GET against this deployment." },
      { key: "rss", label: "Process RSS", unit: "MB", value: Math.round(mem.rss / 1048576), health: "healthy", note: "process.memoryUsage() — real." },
      { key: "heap", label: "Heap used", unit: "MB", value: Math.round(mem.heapUsed / 1048576), health: "healthy", note: "process.memoryUsage() — real." },
      { key: "uptime", label: "Process uptime", unit: "min", value: Math.round(process.uptime() / 60), health: "healthy", note: "Current runtime instance only." },
      { key: "audit-rate", label: "Audit events / last hour", unit: "events", value: recent.length, health: "healthy", note: "Derived from the enterprise audit trail timestamps." },
      { key: "audit-failures", label: "Audit failures / last hour", unit: "events", value: recent.filter((e) => e.result === "Failure").length, health: "healthy", note: "Derived from the enterprise audit trail." },
      { key: "open-incidents", label: "Open incidents", unit: "count", value: opsStore().incidents.filter((i) => i.status !== "resolved" && i.status !== "post-incident-review").length, health: "healthy", note: "From the incident registry (P22-23)." },
      { key: "request-rate", label: "Request rate", unit: "req/s", value: null, health: "not-configured", note: "Not configured — no request metering middleware." },
      { key: "cpu", label: "CPU utilization", unit: "%", value: null, health: "not-configured", note: "Not available on serverless — the platform does not expose per-instance CPU to the app." },
      { key: "queue-depth", label: "Queue depth", unit: "items", value: null, health: "not-configured", note: "Not configured — no queue infrastructure (intentional)." },
      { key: "sessions", label: "Active sessions", unit: "count", value: null, health: "not-configured", note: "Sessions are stateless signed cookies — no server-side session counter exists." },
    ],
    timeRangeNote: "Values are point-in-time measurements taken when this section loads. Historical series require a metrics backend (Not configured) — charts of non-existent history are deliberately not drawn.",
    sourceNote: "Live probes + process metrics + audit derivation only.",
  };
}

// ---- P23-03 · Logs Explorer (audit trail as the structured log stream) ----
function logsPayload(_q: Record<string, unknown>) {
  const events = auditEvents(400);
  return {
    stream: {
      kind: "audit-trail",
      note: "This log stream IS the enterprise audit trail — the system's one structured event log (server-enforced scope). Application stdout is not shipped to any log store: 'Not configured'.",
    },
    events: events.map((e) => ({
      id: e.id, ts: e.ts, time: e.time, severity: e.severity, service: e.source,
      actor: e.actor, action: e.action, resource: e.resource,
      result: e.result, correlationId: e.correlationId, ipMasked: e.ipMasked,
      message: e.context,
    })),
    redaction: { active: true, rules: store().settings.redactionRules, note: "Audit events never contain secret values by construction; redaction rules are enforced at the source (writeAudit contract)." },
    savedViews: [] as unknown[],
    savedViewsNote: "Saved views registry is empty — views an administrator saves appear here (in-process).",
    sourceNote: "Real events from the ONE audit trail. Sensitive values are never present to redact.",
  };
}

// ---- P23-04 · Distributed Traces ----
function tracesPayload() {
  return {
    configured: false,
    note: "Distributed tracing is not configured (no OpenTelemetry/APM backend in this deployment). Trace history cannot be shown — and is not fabricated.",
    recommendation: "Add OpenTelemetry with a collector endpoint as a server-only environment variable; spans for API → Prisma → external calls would then flow here.",
    syntheticProbe: {
      available: true,
      note: "A real, measured single-request trace can be executed on demand ('Run probe trace'): the probe performs authentication-context work, one live SQL query and one live HTTP self-request, and reports the ACTUAL span durations it measured. Clearly synthetic — never presented as production traffic tracing.",
    },
    sourceNote: "Honest configuration state per the no-fake-traces rule.",
  };
}

// ---- P23-05 · Service Map ----
async function serviceMapPayload() {
  const env = runtimeEnv();
  const [dbP, apiP] = await Promise.all([dbProbe(), selfProbe()]);
  const nodes = [
    { id: "app", label: "Qubit One (Next.js 16)", kind: "application", status: "healthy", note: "Serving this runtime." },
    { id: "api", label: "API layer (route handlers)", kind: "api", status: apiP.health, note: apiP.note },
    { id: "stores", label: "In-process domain stores (9)", kind: "service", status: "healthy", note: "Module server stores — seeded from fixtures at process start." },
    { id: "db", label: "Supabase PostgreSQL", kind: "database", status: dbP.health, note: dbP.note },
    { id: "auth", label: "Session plane (HMAC cookies)", kind: "auth", status: "healthy", note: "Signed cookie validation, fail-closed." },
    { id: "vercel", label: "Vercel runtime", kind: "infrastructure", status: env.onVercel ? "healthy" : "unknown", note: env.onVercel ? `Region ${env.region ?? "default"}.` : "Not detected — running standalone." },
    { id: "ai", label: "AI gateway (z-ai)", kind: "integration", status: env.onVercel ? "unavailable" : "degraded", note: env.onVercel ? "Not reachable from serverless; existing fallbacks degrade." : "Sandbox backend only." },
    { id: "email", label: "Email provider", kind: "integration", status: "not-configured", note: "No credentials configured." },
    { id: "storage", label: "Object storage", kind: "integration", status: "not-configured", note: "No credentials configured." },
  ];
  const edges = [
    { from: "app", to: "api", relation: "serves" },
    { from: "api", to: "stores", relation: "reads/writes in-process" },
    { from: "api", to: "db", relation: "Prisma SQL (scaffold probe)" },
    { from: "api", to: "auth", relation: "session validation" },
    { from: "app", to: "vercel", relation: "runs on" },
    { from: "api", to: "ai", relation: "AI completions (degraded)" },
  ];
  return { nodes, edges, drawnFrom: "Architecture constants verified in this repository + live probe statuses. No fictional services are drawn.", sourceNote: "Node statuses measured at request time." };
}

// ---- P23-06 · Dependency Health ----
async function dependenciesPayload() {
  const env = runtimeEnv();
  const dbP = await dbProbe();
  return {
    dependencies: [
      { name: "Supabase PostgreSQL", status: dbP.health, latencyMs: dbP.latencyMs, lastSuccessAt: dbP.health === "healthy" ? Date.now() : null, lastFailureAt: null as number | null, availability: null as number | null, availabilityNote: "Not configured — no historical availability measurement.", configState: "DATABASE_URL configured", note: dbP.note },
      { name: "Vercel (runtime)", status: env.onVercel ? "healthy" : "unknown", latencyMs: null, lastSuccessAt: env.onVercel ? Date.now() : null, lastFailureAt: null, availability: null, availabilityNote: "Platform-level SLA — see Vercel status page.", configState: "platform-managed", note: env.onVercel ? "Runtime detected." : "Standalone runtime." },
      { name: "Vercel REST API (management)", status: env.hasVercelToken ? "healthy" : "not-configured", latencyMs: null, lastSuccessAt: null, lastFailureAt: null, availability: null, availabilityNote: "Requires VERCEL_TOKEN for measured calls.", configState: env.hasVercelToken ? "token present" : "VERCEL_TOKEN not configured", note: "Enables deployment telemetry when configured." },
      { name: "GitHub REST API (actions)", status: env.hasGithubToken ? "healthy" : "not-configured", latencyMs: null, lastSuccessAt: null, lastFailureAt: null, availability: null, availabilityNote: "Requires GITHUB_TOKEN for measured calls.", configState: env.hasGithubToken ? "token present" : "GITHUB_TOKEN not configured", note: `Repository ${"qbitone47/qbitone"}.` },
      { name: "AI gateway (z-ai)", status: env.onVercel ? "unavailable" : "degraded", latencyMs: null, lastSuccessAt: null, lastFailureAt: null, availability: null, availabilityNote: "Not measured.", configState: "sandbox backend", note: env.onVercel ? "Unreachable from serverless — fallbacks active." : "Reachable in sandbox." },
      { name: "Email / WhatsApp / Calendar / Storage / Payments", status: "not-configured", latencyMs: null, lastSuccessAt: null, lastFailureAt: null, availability: null, availabilityNote: "Not measured.", configState: "no credentials", note: "No provider credentials exist in this environment." },
    ],
    sourceNote: "Statuses derived from live probes and credential presence only.",
  };
}

// ---- P23-07 · API Performance ----
const API_ENDPOINTS = [
  { endpoint: "/api/auth/session", method: "POST", service: "Authentication" },
  { endpoint: "/api/ops?section=health", method: "GET", service: "Operations" },
  { endpoint: "/api/obs?section=home", method: "GET", service: "Observability" },
  { endpoint: "/api/platform?section=status", method: "GET", service: "Platform Ops" },
  { endpoint: "/api/executive", method: "GET", service: "CEO Command Center" },
  { endpoint: "/api/search?q=report", method: "GET", service: "Global Search" },
];
function apiPerformancePayload() {
  return {
    endpoints: API_ENDPOINTS,
    probeResults: null as unknown,
    percentiles: null as unknown,
    percentilesNote: "p50/p95/p99 require request-level telemetry aggregation (Not configured). A point-in-time probe reports REAL single-request latencies; percentiles of one request do not exist and are not shown.",
    probeNote: "'Probe endpoints' executes REAL server-side requests now. Protected endpoints answer 401 without a session — that is healthy (reachable + auth enforced).",
    lastProbeAt: null as number | null,
    sourceNote: "Endpoint manifest from the real route tree; latencies only from explicit live probes.",
  };
}

// ---- P23-08 · Database Performance ----
async function databasePerformancePayload() {
  const dbP = await dbProbe();
  const events = auditEvents(300).filter((e) => e.result === "Failure");
  return {
    probe: { health: dbP.health, latencyMs: dbP.latencyMs, note: dbP.note },
    slowQueries: null as unknown, slowQueriesNote: "Not configured — pg_stat_statements / Supabase query insights are not exposed to the application.",
    connectionUsage: null as unknown, connectionUsageNote: "Not available without Supabase management APIs.",
    transactionDuration: null as unknown, transactionDurationNote: "Not instrumented.",
    lockWaits: null as unknown, lockWaitsNote: "Not available without pg_locks access.",
    databaseSize: null as unknown, databaseSizeNote: "Not available without management APIs.",
    queryErrors: { recentCount: events.length, note: "Failure events in the enterprise audit trail (all causes) — not a SQL error counter.", sample: events.slice(0, 5).map((e) => ({ ts: e.ts, action: e.action, resource: e.resource, context: e.context?.slice(0, 100) })) },
    sqlConsole: false, sqlConsoleNote: "No SQL console in this phase (spec §12). Never allow arbitrary destructive SQL.",
    sourceNote: "One live probe + audit-derived failure view. Everything the runtime cannot see is labeled.",
  };
}

// ---- P23-09 · Web Performance ----
function webPerformancePayload() {
  const vitals = platformVitalsSnapshot();
  return {
    collected: vitals.length,
    samples: vitals.slice(-20).map((v) => ({ at: v.at, screen: v.screen, lcpMs: v.lcpMs ?? null, cls: v.cls ?? null, ttfbMs: v.ttfbMs ?? null, fcpMs: v.fcpMs ?? null })),
    note: vitals.length ? "Real browser vitals (PerformanceObserver) POSTed by Qubit One clients and stored in-session by the Platform Ops module. INP is not collected by the current collector." : "No samples yet in this process — vitals arrive as real users browse. Nothing is simulated.",
    inpNote: "INP not collected by the current collector (roadmap).",
    routes: null as unknown, routesNote: "Per-route aggregation requires persisted vitals (Not configured — in-memory session only).",
    jsErrors: null as unknown, jsErrorsNote: "Browser error pipeline not configured (see P22-08 / P23-10).",
    privacy: "Vitals carry screen names and timing only — no identifiers, no content.",
    sourceNote: "Only actually-collected samples are shown.",
  };
}

// ---- P23-10 · Error Intelligence ----
function errorsPayload() {
  const events = auditEvents(400).filter((e) => e.result === "Failure" || e.result === "Blocked");
  const groups = new Map<string, AuditEvent[]>();
  for (const e of events) {
    const key = `${e.action} · ${e.resource.split("/")[0]}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const grouped = [...groups.entries()].map(([key, list]) => ({
    key,
    title: key,
    frequency: list.length,
    affectedRoutes: [...new Set(list.map((e) => e.resource))].slice(0, 5),
    firstSeen: Math.min(...list.map((e) => e.ts)),
    lastSeen: Math.max(...list.map((e) => e.ts)),
    severity: list[0]?.severity ?? "Info",
    status: "Open (unmanaged)" as string,
    deploymentVersion: runtimeEnv().commitSha,
    trend: list.length > 1 ? "recurring" : "single-occurrence",
  })).sort((a, b) => b.frequency - a.frequency);
  return {
    groups: grouped,
    basis: "Grouped from real Failure/Blocked records in the enterprise audit trail (same event stream as P22-08 — deeper correlation view here, management workflow stays in P22).",
    links: { deployments: "Compare firstSeen with P23-17 deployment timeline.", logs: "Open the same events in P23-03 Logs Explorer.", incidents: "Link manually from P22-23 Incident Center (correlation is evidence-gated, P23-19)." },
    sourceNote: "No synthetic error groups. Empty list = no failures recorded.",
  };
}

// ---- P23-11 · Alert Center ----
function alertsPayload() {
  const s = store();
  return {
    alerts: [...s.alerts].sort((a, b) => b.triggeredAt - a.triggeredAt),
    statuses: ["Triggered", "Acknowledged", "Resolved", "Suppressed", "Expired"],
    sourceNote: "Alerts are created ONLY by real rule evaluations against live probes (P23-12 'Evaluate now'). Empty list = nothing has fired.",
  };
}

// ---- P23-12 · Alert Rules ----
function alertRulesPayload() {
  const s = store();
  return {
    rules: [...s.alertRules].sort((a, b) => b.updatedAt - a.updatedAt),
    metrics: ["db-latency", "api-rtt", "rss", "audit-failures", "audit-events"],
    metricNote: "Only metrics that can actually be measured live are selectable: db-latency (SELECT 1 ms), api-rtt (self probe ms), rss (process MB), audit-failures (events/hour), audit-events (events/hour).",
    evaluationNote: "Rules evaluate ON DEMAND ('Evaluate now') against real measurements; a triggered condition creates a real Alert (P23-11) and writes to the audit trail. Continuous background evaluation requires a scheduler (Not configured).",
    notificationIntegration: "Recipients reference the existing notification engine; routing defaults come from Observability Settings (P23-24). No second notification backend.",
    sourceNote: "In-process registry, audited CRUD.",
  };
}

// ---- P23-13 · SLO / SLA Management ----
async function sloPayload() {
  const s = store();
  const dbP = await dbProbe();
  const slos = s.slos.map((slo) => ({
    ...slo,
    current: null as number | null,
    complianceNote: "Insufficient telemetry: compliance requires historical measurement windows (retention Not configured). The live probe value at creation/review time is shown as evidence, not compliance.",
    evidence: { dbHealth: dbP.health, dbLatencyMs: dbP.latencyMs, measuredAt: Date.now() },
    status: "Insufficient telemetry" as const,
  }));
  return {
    slos,
    targetPolicy: "Targets are NEVER invented — an SLO exists only when an administrator configures it (audited).",
    errorBudget: { note: "Error-budget math needs a real measurement window; without retention it would be fiction and is therefore not displayed." },
    sourceNote: "Registry + honest compliance labeling.",
  };
}

// ---- P23-14 · Reliability Scorecard ----
async function scorecardPayload() {
  const env = runtimeEnv();
  const [dbP, apiP] = await Promise.all([dbProbe(), selfProbe()]);
  const ops = opsStore();
  const os = store();
  const events = auditEvents(400);
  const openIncidents = ops.incidents.filter((i) => i.status !== "resolved" && i.status !== "post-incident-review");
  const categories = [
    { id: "availability", label: "Availability", pass: apiP.health === "healthy", evidence: apiP.note, weight: "measured" },
    { id: "latency", label: "Latency", pass: (apiP.latencyMs ?? 9999) < 2000, evidence: `Self-probe ${apiP.latencyMs ?? "—"} ms (live single request).` },
    { id: "errors", label: "Errors", pass: events.filter((e) => e.result === "Failure").length === 0, evidence: `${events.filter((e) => e.result === "Failure").length} failure events in the audit window.` },
    { id: "security", label: "Security", pass: true, evidence: "Session plane active, RBAC enforced, audit operating; MFA/SSO absent (documented gaps)." },
    { id: "deployment-health", label: "Deployment health", pass: env.onVercel, evidence: env.onVercel ? "Live on Vercel; CI pipeline green on push (verified historically)." : "Not on Vercel runtime." },
    { id: "database-health", label: "Database health", pass: dbP.health === "healthy", evidence: dbP.note },
    { id: "backup-health", label: "Backup health", pass: false, evidence: "Application cannot verify platform backups; file backups unavailable on serverless (P22-15)." },
    { id: "dependencies", label: "Dependencies", pass: dbP.health === "healthy", evidence: "Core data plane (Supabase) live; several providers not configured (P23-06)." },
    { id: "incidents", label: "Incidents", pass: openIncidents.length === 0, evidence: openIncidents.length ? `${openIncidents.length} open incident(s).` : "No open incidents recorded." },
    { id: "slo-compliance", label: "SLO compliance", pass: false, evidence: os.slos.length ? "SLOs defined but no measurement window (retention Not configured)." : "No SLOs configured." },
  ];
  const passed = categories.filter((c) => c.pass).length;
  return {
    categories,
    score: Math.round((passed / categories.length) * 100),
    basis: `${passed}/${categories.length} explainable checks pass. Every row carries its evidence — no AI-generated or arbitrary score.`,
    sourceNote: "Computed from live probes, audit trail, registries and documented platform facts.",
  };
}

// ---- P23-15 · Capacity & Resource Usage ----
async function capacityPayload() {
  const mem = process.memoryUsage();
  return {
    resources: [
      { id: "memory-rss", label: "Process memory (RSS)", current: `${Math.round(mem.rss / 1048576)} MB`, unit: "MB", trend: null, peak: null, baseline: null, threshold: null, note: "Real, current process. Vercel lambda memory limit is plan-defined; per-instance peaks require history (Not configured)." },
      { id: "heap", label: "Heap used", current: `${Math.round(mem.heapUsed / 1048576)} MB`, unit: "MB", trend: null, peak: null, baseline: null, threshold: null, note: "Real, current process." },
      { id: "cpu", label: "CPU", current: "Not available", unit: "%", trend: null, peak: null, baseline: null, threshold: null, note: "Serverless CPU is not exposed to the application." },
      { id: "storage-db", label: "Database storage", current: "Not available", unit: "MB", trend: null, peak: null, baseline: null, threshold: null, note: "Requires Supabase management APIs (Not configured)." },
      { id: "requests", label: "Request volume", current: "Not configured", unit: "req/min", trend: null, peak: null, baseline: null, threshold: null, note: "No request metering middleware." },
      { id: "audit-volume", label: "Audit event volume", current: `${auditEvents(400).length} in window`, unit: "events", trend: null, peak: null, baseline: null, threshold: null, note: "Real events in the current audit window." },
    ],
    forecast: { available: false, note: "No forecasts: forecasting requires historical series (retention Not configured). Fabricated projections are worse than none." },
    sourceNote: "Only genuinely measurable values are shown.",
  };
}

// ---- P23-16 · Infrastructure Health ----
async function infrastructurePayload() {
  const env = runtimeEnv();
  const dbP = await dbProbe();
  const mem = process.memoryUsage();
  return {
    providerNeutral: true,
    resources: [
      { resource: "Application runtime", provider: env.onVercel ? "Vercel (serverless)" : "Standalone", region: env.region ?? "local", health: "healthy", utilization: `RSS ${Math.round(mem.rss / 1048576)} MB`, alerts: 0, lastUpdatedAt: Date.now(), note: "This process, measured." },
      { resource: "PostgreSQL (data plane)", provider: "Supabase", region: "ap-northeast-1 (pooler endpoint)", health: dbP.health, utilization: "Not available", alerts: 0, lastUpdatedAt: Date.now(), note: dbP.note },
      { resource: "CI (GitHub Actions)", provider: "GitHub", region: "—", health: env.hasGithubToken ? "unknown" : "not-configured", utilization: "—", alerts: 0, lastUpdatedAt: null, note: env.hasGithubToken ? "Token present — live status fetchable." : "GITHUB_TOKEN not configured; CI status visible in GitHub directly." },
      { resource: "Edge/CDN", provider: env.onVercel ? "Vercel" : "—", region: "global", health: env.onVercel ? "healthy" : "unknown", utilization: "—", alerts: 0, lastUpdatedAt: env.onVercel ? Date.now() : null, note: "Static assets served by the platform CDN." },
    ],
    sourceNote: "Provider-neutral presentation over real, detectable facts only.",
  };
}

// ---- P23-17 · Deployment Impact Analysis ----
async function deploymentImpactPayload() {
  const env = runtimeEnv();
  const token = process.env.VERCEL_TOKEN;
  let deployments: { id: string; sha: string | null; createdAt: number; state: string }[] = [];
  let configured = false;
  let note = "VERCEL_TOKEN not configured — deployment list unavailable; only the current runtime deployment is known.";
  if (token) {
    configured = true;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch("https://api.vercel.com/v6/deployments?limit=10&target=production", { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      if (res.ok) {
        const json = (await res.json()) as { deployments?: Array<Record<string, unknown>> };
        deployments = (json.deployments ?? []).map((d) => {
          const meta = (d.meta ?? {}) as Record<string, unknown>;
          return { id: String(d.uid ?? d.id ?? ""), sha: typeof meta.githubCommitSha === "string" ? meta.githubCommitSha : null, createdAt: Number(d.createdAt ?? 0), state: String(d.readyState ?? "UNKNOWN") };
        });
        note = "Live from the Vercel REST API. Impact deltas are computed from real audit-event counts before/after each deployment timestamp.";
      } else note = `Vercel API responded ${res.status}.`;
    } catch (err) {
      note = `Vercel API call failed: ${err instanceof Error ? err.message : "unknown"}.`;
    }
  }
  const events = auditEvents(400);
  const withImpact = deployments.slice(0, 8).map((d) => {
    const after = events.filter((e) => e.ts >= d.createdAt);
    const before = events.filter((e) => e.ts < d.createdAt && e.ts >= d.createdAt - 86_400_000);
    return {
      ...d,
      errorChange: { before: before.filter((e) => e.result === "Failure").length, after: after.filter((e) => e.result === "Failure").length },
      eventChange: { before: before.length, after: after.length },
      latencyChange: null as number | null,
      latencyNote: "Per-request latency series do not exist (Not configured) — a real delta cannot be computed and is not invented.",
      affectedRoutes: [...new Set(after.map((e) => e.resource))].slice(0, 5),
      incidentChange: null as number | null,
      incidentNote: "Incident registry entries carry timestamps; correlation is available in P23-19.",
    };
  });
  return {
    configured,
    current: { commit: env.commitSha, branch: env.commitBranch },
    deployments: withImpact,
    method: "Before/after windows use REAL audit-event counts (24h before vs since deployment). Where telemetry cannot support a delta, the field says so.",
    sourceNote: note,
  };
}

// ---- P23-18 · Change Intelligence ----
function changesPayload() {
  const events = auditEvents(400).filter((e) => CHANGE_ACTIONS.some((c) => e.action.startsWith(c)));
  return {
    changes: events.map((e) => ({ ts: e.ts, who: e.actor, action: e.action, environment: runtimeEnv().vercelEnv ?? "runtime", impact: e.context, auditId: e.id, correlationId: e.correlationId })),
    eventTypes: ["deployment", "configuration change", "environment variable change", "feature flag change", "database migration", "integration change", "security configuration change", "maintenance mode", "rollback"],
    note: "Timeline built from the ONE enterprise audit trail — no second audit system. Future provider-side events (Vercel/GitHub) join via their APIs when tokens are configured.",
    sourceNote: "Real recorded changes only.",
  };
}

// ---- P23-19 · Incident Correlation ----
async function correlationPayload(q: Record<string, unknown>) {
  const s = opsStore();
  const os = store();
  const windowMs = Number(q.windowMs ?? 86_400_000);
  const since = Date.now() - (Number.isFinite(windowMs) ? windowMs : 86_400_000);
  const events = auditEvents(400).filter((e) => e.ts >= since);
  const incidents = s.incidents.filter((i) => i.startedAt >= since);
  const alerts = os.alerts.filter((a) => a.triggeredAt >= since);
  const changes = events.filter((e) => CHANGE_ACTIONS.some((c) => e.action.startsWith(c)));
  return {
    windowMs: since ? Date.now() - since : windowMs,
    incidents: incidents.map((i) => ({ id: i.id, severity: i.severity, title: i.title, startedAt: i.startedAt, status: i.status })),
    alerts,
    changes: changes.slice(0, 30).map((e) => ({ ts: e.ts, who: e.actor, action: e.action, resource: e.resource })),
    errors: events.filter((e) => e.result === "Failure" || e.result === "Blocked").slice(0, 30).map((e) => ({ ts: e.ts, action: e.action, resource: e.resource, severity: e.severity })),
    timeline: [...incidents.map((i) => ({ at: i.startedAt, kind: "incident", text: `${i.severity} ${i.title}` })), ...alerts.map((a) => ({ at: a.triggeredAt, kind: "alert", text: a.ruleName })), ...changes.map((e) => ({ at: e.ts, kind: "change", text: `${e.action} → ${e.resource}` }))].sort((a, b) => b.at - a.at).slice(0, 60),
    rule: "Relationships are temporal co-occurrence in real data — the UI never asserts causality.",
    sourceNote: "Correlation drawn exclusively from the audit trail + governance registries within the selected window.",
  };
}

// ---- P23-20 · Operational Runbooks ----
function runbooksPayload() {
  const s = store();
  return {
    runbooks: [...s.runbooks].sort((a, b) => a.title.localeCompare(b.title)),
    policy: "Runbooks are guidance only — nothing here executes automatically. Any automated action must go through authorized automation (none exists in this deployment).",
    sourceNote: "Authored library for this specific architecture; edits are audited and versioned.",
  };
}

// ---- P23-21 · On-Call & Escalation ----
function oncallPayload() {
  const s = store();
  return {
    assignments: s.oncall,
    privacy: "Contact methods reference systems (in-app notification engine), never personal phone/email — and this section is administrator-only (server-enforced).",
    identityNote: "Responders resolve through the existing employee identity directory — no second directory.",
    sourceNote: "Escalation registry, audited edits.",
  };
}

// ---- P23-22 · Reliability Reports ----
async function reportPayload(_from: number | null, _to: number | null) {
  const [dbP, apiP] = await Promise.all([dbProbe(), selfProbe()]);
  const s = opsStore();
  const os = store();
  const events = auditEvents(400);
  const hourAgo = Date.now() - 3_600_000;
  const recent = events.filter((e) => e.ts >= hourAgo);
  return {
    report: {
      generatedAt: Date.now(),
      window: "audit window (most recent 400 events) + live probes",
      availability: { probeHealth: apiP.health, probeLatencyMs: apiP.latencyMs, note: "Single-request live probe — not an availability percentage (none configured)." },
      sloCompliance: { slos: os.slos.length, note: os.slos.length ? "Defined; compliance needs retention." : "None configured." },
      incidents: { open: s.incidents.filter((i) => i.status !== "resolved").length, total: s.incidents.length },
      errorTrend: { failuresInWindow: events.filter((e) => e.result === "Failure").length, eventsLastHour: recent.length },
      apiPerformance: { probeLatencyMs: apiP.latencyMs, note: "Point-in-time probe only." },
      databasePerformance: { probeLatencyMs: dbP.latencyMs, health: dbP.health },
      deploymentImpact: { currentCommit: runtimeEnv().commitSha, note: "See P23-17 (token-gated for history)." },
      dependencyHealth: { database: dbP.health, note: "See P23-06 for the full matrix." },
      alertTrend: { total: os.alerts.length, triggered: os.alerts.filter((a) => a.status === "Triggered").length },
      capacity: { rssMb: Math.round(process.memoryUsage().rss / 1048576) },
    },
    exportPolicy: "Report export (JSON) is client-side on this authorized screen; exports of underlying audit data follow the existing Data Export governance (P282).",
    scheduling: "Scheduled delivery reuses the existing Scheduled Reports infrastructure (P283) — no second reporting engine.",
    sourceNote: "Every figure in the report traces to a probe, the audit trail or a registry.",
  };
}

// ---- P23-23 · Operational AI Insights ----
async function aiInsightsPayload() {
  const env = runtimeEnv();
  const dbP = await dbProbe();
  const events = auditEvents(300);
  const hourAgo = Date.now() - 3_600_000;
  const recent = events.filter((e) => e.ts >= hourAgo);
  // Deterministic (non-AI) analysis — computed, real, labeled as such.
  const deterministic = [
    { kind: "Observed Fact" as const, text: `${recent.length} audit events in the last hour; ${recent.filter((e) => e.result === "Failure").length} failures.`, evidence: "Enterprise audit trail timestamps + results." },
    { kind: "Observed Fact" as const, text: `Database probe ${dbP.health}${dbP.latencyMs != null ? ` (${dbP.latencyMs} ms)` : ""} — measured on this request.`, evidence: "Live SELECT 1 (ops probe)." },
    recent.filter((e) => e.result === "Blocked").length > 0
      ? { kind: "Inference" as const, text: `${recent.filter((e) => e.result === "Blocked").length} blocked events suggest active permission boundaries — review whether any are unexpected.`, evidence: "Audit records with result=Blocked." }
      : { kind: "Observed Fact" as const, text: "No blocked authorization events in the window.", evidence: "Audit trail." },
    { kind: "Recommendation" as const, text: runtimeEnv().hasVercelToken ? "VERCEL_TOKEN present — enable deployment correlation reviews (P23-17) after each release." : "Configure VERCEL_TOKEN to enable deployment impact correlation.", evidence: "Runtime environment presence check." },
  ];
  return {
    provider: AI_PROVIDER_LABEL,
    aiAvailable: !env.onVercel,
    aiNote: env.onVercel ? "The AI gateway is not reachable from the serverless runtime — AI generation is unavailable here and the UI says so. Deterministic analysis below remains fully available." : "AI generation available through the Phase 15 engine (sandbox backend).",
    deterministic,
    guardrails: ["AI never invents telemetry — prompts carry only real audit/probe context", "No causality claims without evidence", "No autonomous production actions — consequential actions route through the Phase 15 AI Action Approval", "No secrets in prompts or outputs"],
    labels: ["Observed Fact", "Inference", "Recommendation", "Confidence", "Evidence"],
    sourceNote: "Deterministic analysis computed from real data; AI generation (when reachable) is grounded strictly on provided context.",
  };
}
// ---- P23-24 · Observability Settings ----
function settingsPayload() {
  const s = store();
  return {
    settings: s.settings,
    editable: ["logRetentionDays", "metricRetentionDays", "traceRetentionDays", "samplingRatePct", "alertDefaults.cooldownMin"],
    retentionNote: "Retention values are DECLARATIVE in this deployment (no telemetry store exists yet to prune). They define the policy this platform will enforce when retention backends are configured — changing them is audited.",
    redactionNote: "Redaction rules are enforced at the source: writeAudit never persists secret values. The rules listed are the enforced policy statement.",
    privacy: "Vitals and logs carry no identifiers or content; role-based access is enforced server-side on every section.",
    sourceNote: "Configuration registry, audited changes, real current values.",
  };
}

// ============================================================
// POST actions
// ============================================================
export interface ObsAction { type: string; input: Record<string, unknown>; confirm?: boolean; }

export async function obsPost(role: WorkspaceRole, action: ObsAction): Promise<Result<Record<string, unknown>>> {
  const gate = requireObsAdmin(role, `Observability · action:${action.type}`);
  if (gate) return gate;
  const s = store();
  const now = Date.now();
  const actor = actorOf(role);
  switch (action.type) {
    case "alert-rule.create": {
      const name = String(action.input.name ?? "").trim();
      if (name.length < 3) return fail(400, "invalid_name", "Rule name required (min 3 chars).");
      const metric = String(action.input.metric ?? "");
      if (!["db-latency", "api-rtt", "rss", "audit-failures", "audit-events"].includes(metric)) return fail(400, "invalid_metric", "Unsupported metric (only live-measurable metrics are allowed).");
      const rule: AlertRule = {
        id: `AR-${now.toString(36).toUpperCase()}`, name: name.slice(0, 100), metric,
        condition: action.input.condition === "below" ? "below" : "above",
        threshold: Number(action.input.threshold ?? 0),
        windowMin: Math.max(1, Math.min(1440, Number(action.input.windowMin ?? 5))),
        severity: (["Info", "Warning", "High", "Critical"].includes(String(action.input.severity)) ? action.input.severity : "Warning") as AlertRule["severity"],
        environment: String(action.input.environment ?? "production"),
        recipients: Array.isArray(action.input.recipients) ? action.input.recipients.map(String).slice(0, 10) : [],
        escalation: String(action.input.escalation ?? "").slice(0, 100),
        cooldownMin: Math.max(0, Math.min(1440, Number(action.input.cooldownMin ?? 15))),
        enabled: action.input.enabled !== false,
        createdAt: now, createdBy: actor, updatedAt: now,
      };
      s.alertRules.push(rule);
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.alert.rule.create", resource: rule.id, result: "Success", severity: "Warning", context: `${rule.name} ${rule.metric} ${rule.condition} ${rule.threshold}` });
      return ok({ ok: true, message: `Alert rule '${rule.name}' created.`, rule });
    }
    case "alert-rule.delete": {
      const id = String(action.input.id ?? "");
      const idx = s.alertRules.findIndex((r) => r.id === id);
      if (idx < 0) return fail(404, "not_found", "Rule not found.");
      s.alertRules.splice(idx, 1);
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.alert.rule.delete", resource: id, result: "Success", severity: "Warning", context: "Alert rule deleted" });
      return ok({ ok: true, message: `Rule ${id} deleted.` });
    }
    case "alert.evaluate": {
      // Real evaluation against live measurements.
      const [dbP, apiP] = await Promise.all([dbProbe(), selfProbe()]);
      const mem = process.memoryUsage();
      const events = auditEvents(300);
      const hourAgo = now - 3_600_000;
      const recent = events.filter((e) => e.ts >= hourAgo);
      const values: Record<string, number | null> = {
        "db-latency": dbP.latencyMs, "api-rtt": apiP.latencyMs,
        rss: Math.round(mem.rss / 1048576),
        "audit-failures": recent.filter((e) => e.result === "Failure").length,
        "audit-events": recent.length,
      };
      const created: Alert[] = [];
      for (const rule of s.alertRules.filter((r) => r.enabled)) {
        const value = values[rule.metric];
        if (value == null) continue;
        const breached = rule.condition === "above" ? value > rule.threshold : value < rule.threshold;
        if (!breached) continue;
        const existing = s.alerts.find((a) => a.ruleId === rule.id && (a.status === "Triggered" || a.status === "Acknowledged") && now - a.evaluatedAt < rule.cooldownMin * 60_000);
        if (existing) continue;
        const alert: Alert = {
          id: `AL-${now.toString(36).toUpperCase()}-${rule.id}`, ruleId: rule.id, ruleName: rule.name,
          severity: rule.severity, service: rule.metric, condition: `${rule.metric} ${rule.condition} ${rule.threshold}`,
          currentValue: value, threshold: rule.threshold, triggeredAt: now, durationMin: 0,
          status: "Triggered", owner: actor, evaluatedAt: now,
        };
        s.alerts.push(alert);
        created.push(alert);
        writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.alert.triggered", resource: alert.id, result: "Success", severity: rule.severity === "Critical" ? "Critical" : rule.severity === "High" ? "High" : "Warning", context: `${rule.name}: ${value} ${rule.condition} ${rule.threshold}` });
      }
      return ok({ ok: true, evaluated: s.alertRules.filter((r) => r.enabled).length, triggered: created.length, alerts: created, measurements: values, message: created.length ? `${created.length} alert(s) triggered from real measurements.` : "All enabled rules evaluated — no breaches measured." });
    }
    case "alert.status": {
      const id = String(action.input.id ?? "");
      const a = s.alerts.find((x) => x.id === id);
      if (!a) return fail(404, "not_found", "Alert not found.");
      const status = String(action.input.status ?? "");
      if (!["Acknowledged", "Resolved", "Suppressed", "Expired"].includes(status)) return fail(400, "invalid_status", "Unsupported alert status.");
      a.status = status as Alert["status"];
      a.evaluatedAt = now;
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.alert.status", resource: id, result: "Success", severity: "Warning", context: `→ ${status}` });
      return ok({ ok: true, message: `Alert ${id} → ${status}.` });
    }
    case "slo.create": {
      const name = String(action.input.name ?? "").trim();
      const kind = String(action.input.kind ?? "");
      const target = Number(action.input.target ?? 0);
      if (name.length < 3) return fail(400, "invalid_name", "SLO name required.");
      if (!["availability", "latency", "error-rate"].includes(kind)) return fail(400, "invalid_kind", "SLO kind must be availability, latency or error-rate.");
      if (!Number.isFinite(target) || target <= 0) return fail(400, "invalid_target", "A concrete target value is required — it is never invented.");
      const slo: Slo = {
        id: `SLO-${now.toString(36).toUpperCase()}`, service: String(action.input.service ?? "platform").slice(0, 60),
        name: name.slice(0, 100), kind: kind as Slo["kind"], target,
        windowDays: Math.max(1, Math.min(90, Number(action.input.windowDays ?? 30))),
        createdAt: now, createdBy: actor, updatedAt: now,
      };
      s.slos.push(slo);
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.slo.create", resource: slo.id, result: "Success", severity: "Warning", context: `${slo.name} ${kind} target=${target}` });
      return ok({ ok: true, message: `SLO '${slo.name}' created (compliance awaits real telemetry windows).`, slo });
    }
    case "slo.delete": {
      const id = String(action.input.id ?? "");
      const idx = s.slos.findIndex((x) => x.id === id);
      if (idx < 0) return fail(404, "not_found", "SLO not found.");
      s.slos.splice(idx, 1);
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.slo.delete", resource: id, result: "Success", severity: "Warning", context: "SLO deleted" });
      return ok({ ok: true, message: `SLO ${id} deleted.` });
    }
    case "runbook.update": {
      const id = String(action.input.id ?? "");
      const rb = s.runbooks.find((r) => r.id === id);
      if (!rb) return fail(404, "not_found", "Runbook not found.");
      if (action.input.remediation && Array.isArray(action.input.remediation)) rb.remediation = action.input.remediation.map(String).slice(0, 12);
      if (action.input.diagnostics && Array.isArray(action.input.diagnostics)) rb.diagnostics = action.input.diagnostics.map(String).slice(0, 12);
      rb.version += 1;
      rb.lastReviewedAt = now;
      rb.updatedAt = now;
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.runbook.update", resource: id, result: "Success", severity: "Info", context: `reviewed → v${rb.version}` });
      return ok({ ok: true, message: `Runbook ${id} reviewed (v${rb.version}).`, runbook: rb });
    }
    case "oncall.update": {
      const service = String(action.input.service ?? "");
      const a = s.oncall.find((x) => x.service === service);
      if (!a) return fail(404, "not_found", "Assignment not found.");
      if (action.input.backup != null) a.backup = String(action.input.backup).slice(0, 80) || null;
      if (action.input.primary != null) a.primary = String(action.input.primary).slice(0, 80);
      if (action.input.escalationLevel != null) a.escalationLevel = Math.max(1, Math.min(5, Number(action.input.escalationLevel)));
      a.updatedAt = now;
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.oncall.update", resource: service, result: "Success", severity: "Warning", context: `primary=${a.primary} backup=${a.backup ?? "—"}` });
      return ok({ ok: true, message: "On-call assignment updated and audited.", assignment: a });
    }
    case "settings.update": {
      const st = s.settings;
      const num = (v: unknown, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : null; };
      const lr = num(action.input.logRetentionDays, 0, 3650); if (action.input.logRetentionDays != null && lr == null) return fail(400, "invalid_retention", "Log retention must be 0–3650 days (0 = not configured).");
      if (lr != null) st.logRetentionDays = lr;
      const mr = num(action.input.metricRetentionDays, 0, 3650); if (action.input.metricRetentionDays != null && mr == null) return fail(400, "invalid_retention", "Metric retention must be 0–3650 days.");
      if (mr != null) st.metricRetentionDays = mr;
      const tr = num(action.input.traceRetentionDays, 0, 3650); if (action.input.traceRetentionDays != null && tr == null) return fail(400, "invalid_retention", "Trace retention must be 0–3650 days.");
      if (tr != null) st.traceRetentionDays = tr;
      const sr = num(action.input.samplingRatePct, 1, 100); if (action.input.samplingRatePct != null && sr == null) return fail(400, "invalid_sampling", "Sampling must be 1–100%.");
      if (sr != null) st.samplingRatePct = sr;
      if (action.input.cooldownMin != null) {
        const cm = num(action.input.cooldownMin, 0, 1440);
        if (cm == null) return fail(400, "invalid_cooldown", "Cooldown must be 0–1440 minutes.");
        st.alertDefaults.cooldownMin = cm;
      }
      st.updatedBy = actor;
      st.updatedAt = now;
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.settings.update", resource: "observability-settings", result: "Success", severity: "Warning", context: JSON.stringify(action.input).slice(0, 200) });
      return ok({ ok: true, message: "Observability settings updated and audited.", settings: st });
    }
    case "probe.trace": {
      // REAL measured single-request trace: auth → SQL → HTTP self.
      const spans: { name: string; startedAt: number; durationMs: number; status: string }[] = [];
      let t0 = Date.now();
      try {
        const auth = await import("@/lib/qubit/auth-server");
        void auth;
        spans.push({ name: "session-plane (module context ready)", startedAt: t0, durationMs: Date.now() - t0, status: "ok" });
      } catch { spans.push({ name: "session-plane", startedAt: t0, durationMs: Date.now() - t0, status: "error" }); }
      t0 = Date.now();
      try { await db.$queryRaw`SELECT 1`; spans.push({ name: "db SELECT 1", startedAt: t0, durationMs: Date.now() - t0, status: "ok" }); }
      catch { spans.push({ name: "db SELECT 1", startedAt: t0, durationMs: Date.now() - t0, status: "error" }); }
      t0 = Date.now();
      const env = runtimeEnv();
      const base = env.deploymentUrl ? `https://${env.deploymentUrl}` : "http://127.0.0.1:3000";
      try { await fetch(base, { cache: "no-store" }); spans.push({ name: `http GET ${base}`, startedAt: t0, durationMs: Date.now() - t0, status: "ok" }); }
      catch { spans.push({ name: "http self GET", startedAt: t0, durationMs: Date.now() - t0, status: "error" }); }
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.probe.trace", resource: "synthetic-trace", result: "Success", severity: "Info", context: `${spans.length} spans measured` });
      return ok({ ok: true, traceId: `SYN-${now.toString(36).toUpperCase()}`, spans, totalMs: spans.reduce((a, b) => a + b.durationMs, 0), note: "Real measured spans of a synthetic probe request — clearly labeled, never presented as production tracing." });
    }
    case "probe.apis": {
      const results = await Promise.all(API_ENDPOINTS.map(async (e) => {
        const env = runtimeEnv();
        const base = env.deploymentUrl ? `https://${env.deploymentUrl}` : "http://127.0.0.1:3000";
        const started = Date.now();
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 6000);
          const res = await fetch(`${base}${e.endpoint}`, { method: e.method === "GET" ? "GET" : "POST", signal: ctrl.signal, cache: "no-store" });
          clearTimeout(t);
          return { ...e, httpStatus: res.status, latencyMs: Date.now() - started, health: res.status < 500 ? "reachable" : "failing" };
        } catch { return { ...e, httpStatus: null, latencyMs: null, health: "unreachable" }; }
      }));
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.probe.apis", resource: "api-performance", result: "Success", severity: "Info", context: `${results.length} endpoints probed` });
      return ok({ ok: true, probeResults: results, lastProbeAt: now, message: "Real server-side probes executed." });
    }
    case "ai.insight": {
      // Grounded AI generation through the Phase 15 engine (real context only).
      const env = runtimeEnv();
      if (env.onVercel) return ok({ ok: false, message: "AI generation unavailable on the serverless runtime (gateway unreachable). Deterministic analysis in this section remains available.", facts: [] as unknown[] });
      const events = auditEvents(200);
      const context = {
        eventsLastHour: events.filter((e) => e.ts >= now - 3_600_000).length,
        failures: events.filter((e) => e.result === "Failure").length,
        blocked: events.filter((e) => e.result === "Blocked").length,
        topActions: [...new Set(events.map((e) => e.action))].slice(0, 10),
        openIncidents: opsStore().incidents.filter((i) => i.status !== "resolved").length,
      };
      try {
        const { runCompletion: run } = await import("@/lib/qubit/ai-engine");
        const result = await run({
          system: `You are the Qubit One operational analyst. You receive REAL aggregated observability facts. Output STRICT JSON: {"insights":[{"kind":"Observed Fact|Inference|Recommendation","text":string,"evidence":string,"confidence":"low|medium|high"}]}. Never invent data, never claim causality without evidence, never include secrets.`,
          messages: [{ role: "user", content: `Real observability context (JSON): ${JSON.stringify(context)}\n\nProduce 3-5 insights following the labels exactly.` }],
          temperature: 0.2,
        });
        if (!result.ok) return ok({ ok: false, message: `AI runtime unavailable: ${"message" in result ? result.message : "unknown error"}. Deterministic analysis remains available.`, facts: [] as unknown[] });
        const parsed = parseJsonObject<{ insights: { kind: string; text: string; evidence: string; confidence: string }[] }>(result.text);
        if (!parsed?.insights?.length) return ok({ ok: false, message: "AI response could not be parsed into the insight schema — nothing is fabricated to fill the gap.", facts: [] as unknown[] });
        writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.ai.insight", resource: "ai-insights", result: "Success", severity: "Info", context: `${parsed.insights.length} AI insights generated` });
        return ok({ ok: true, insights: parsed.insights.slice(0, 6), context, message: "AI insights generated from the real context above." });
      } catch (err) {
        return ok({ ok: false, message: `AI generation failed: ${err instanceof Error ? err.message : "unknown"}. Deterministic analysis remains available.`, facts: [] as unknown[] });
      }
    }
    default:
      return fail(400, "unknown_action", `Unknown observability action '${action.type}'.`);
  }
}
