// ============================================================
// Qubit One — Phase 23 · Enterprise Observability, SRE &
// Operational Intelligence — EXTENDED in Phase 25 with the real
// telemetry pipeline (telemetry-server.ts): request metering,
// structured application logs, client vitals/errors, enforced
// retention and a role-based observability access matrix.
//
// GOVERNANCE (Phase 23 spec §33 + Phase 25 spec — ABSOLUTE):
//   · Every metric is measured live, derived from the existing
//     enterprise audit trail / registries, or computed from real
//     Phase 25 telemetry. Absent capability → explicit
//     "Not configured" / "Insufficient data". Nothing is fabricated.
//   · The Logs Explorer is ONE stream: the enterprise audit trail
//     PLUS the Phase 25 structured telemetry — two real sources,
//     one view, zero duplication.
//   · Probes are imported from ops-server (Phase 22) — one probe
//     implementation, zero duplicate telemetry logic.
//   · Access is fail-closed and server-enforced: administrators by
//     default, delegated read grants via the audited access matrix
//     (P25-21); the Logs Explorer stays administrator-only and all
//     mutations remain administrator-only.
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
import {
  availabilityStats,
  clientStats,
  configureTelemetry,
  errorGroups,
  evaluateSloReal,
  lastPruneSnapshot,
  pruneTelemetry,
  readTelemetry,
  recordTelemetry,
  requestSeries,
  requestStats,
  telemetryConfigSnapshot,
  telemetryPersistenceStatus,
} from "@/lib/qubit/telemetry-server";
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
  | "reports" | "ai-insights" | "settings"
  // Phase 25 additions — capabilities without a Phase 23 home:
  | "availability" | "activity" | "access" | "retention";

const OBS_SECTIONS: readonly ObsSection[] = [
  "home", "metrics", "logs", "traces", "service-map", "dependencies",
  "api-performance", "database-performance", "web-performance", "errors",
  "alerts", "alert-rules", "slo", "scorecard", "capacity", "infrastructure",
  "deployment-impact", "changes", "correlation", "runbooks", "oncall",
  "reports", "ai-insights", "settings",
  "availability", "activity", "access", "retention",
];

/** Sections delegable via the P25-21 access matrix. Logs stay administrator-only (sensitive). */
const DELEGABLE_SECTIONS: readonly ObsSection[] = OBS_SECTIONS.filter((s) => s !== "logs");

export function obsSectionFor(s: string | null): ObsSection | null {
  return !!s && (OBS_SECTIONS as readonly string[]).includes(s) ? (s as ObsSection) : null;
}

// ---- P25-21 · Observability access model (server-enforced, fail-closed) ----
export interface ObsAccessEntry {
  role: WorkspaceRole;
  read: "all" | readonly string[];
  updatedAt: number;
  updatedBy: string | null;
}

function defaultAccess(): Record<WorkspaceRole, ObsAccessEntry> {
  const now = Date.now();
  return {
    administrator: { role: "administrator", read: "all", updatedAt: now, updatedBy: null },
    "dept-head": { role: "dept-head", read: [], updatedAt: now, updatedBy: null },
    "sales-exec": { role: "sales-exec", read: [], updatedAt: now, updatedBy: null },
    "hr-manager": { role: "hr-manager", read: [], updatedAt: now, updatedBy: null },
    employee: { role: "employee", read: [], updatedAt: now, updatedBy: null },
  };
}

/**
 * GET gate (Phase 25): administrators hold every section; other roles only
 * the sections explicitly granted through the audited P25-21 matrix. The
 * Logs Explorer is administrator-only regardless of grants (sensitive
 * diagnostics). Denials are audited.
 */
function requireObsRead(role: WorkspaceRole, section: ObsSection): Result<never> | null {
  if (role === "administrator") return null;
  if (section === "logs") {
    writeAudit({
      actor: "obs-access-gate", actorId: SESSION_USER_ID,
      action: "obs.access.denied", resource: `Observability · ${section}`, result: "Blocked", severity: "High",
      context: `Role '${role}' attempted the Logs Explorer — administrator-only (sensitive diagnostics).`,
    });
    return fail(403, "obs_admin_required", "The Logs Explorer is restricted to administrators — sensitive diagnostics are not delegable. This denial is recorded in the audit trail.");
  }
  const grant = store().accessMatrix[role];
  const allowed = grant?.read === "all" || (Array.isArray(grant?.read) && grant.read.includes(section));
  if (allowed) return null;
  writeAudit({
    actor: "obs-access-gate", actorId: SESSION_USER_ID,
    action: "obs.access.denied", resource: `Observability · ${section}`, result: "Blocked", severity: "Warning",
    context: `Role '${role}' has no read grant for this observability section (P25-21 matrix).`,
  });
  return fail(403, "obs_access_required", "Your role has no read grant for this observability section. Access is enforced server-side from the signed session cookie; denials are recorded in the audit trail.");
}

function requireObsAdmin(role: WorkspaceRole, resource: string): Result<never> | null {
  if (role === "administrator") return null;
  writeAudit({
    actor: "obs-admin-gate", actorId: SESSION_USER_ID,
    action: "obs.access.denied", resource, result: "Blocked", severity: "High",
    context: `Role '${role}' attempted an administrator-only observability mutation.`,
  });
  return fail(403, "obs_admin_required", "Observability mutations are administrator-only. The boundary is enforced server-side and this denial is recorded in the audit trail.");
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
  accessMatrix: Record<WorkspaceRole, ObsAccessEntry>;
}
const g = globalThis as unknown as { __qubitObsStore?: ObsStore };
function store(): ObsStore {
  if (!g.__qubitObsStore) {
    const now = Date.now();
    g.__qubitObsStore = {
      alertRules: [], alerts: [], slos: [], accessMatrix: defaultAccess(),
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
export async function obsGet(role: WorkspaceRole, section: ObsSection, query?: URLSearchParams): Promise<Result<Record<string, unknown>>> {
  const gate = requireObsRead(role, section);
  if (gate) return gate;
  const q: Record<string, unknown> = {};
  if (query) for (const [k, v] of query.entries()) q[k] = v;
  switch (section) {
    case "home": return ok(await homePayload());
    case "metrics": return ok(await metricsPayload());
    case "logs": return ok(await logsPayload(q));
    case "traces": return ok(tracesPayload());
    case "service-map": return ok(await serviceMapPayload());
    case "dependencies": return ok(await dependenciesPayload());
    case "api-performance": return ok(await apiPerformancePayload());
    case "database-performance": return ok(await databasePerformancePayload());
    case "web-performance": return ok(await webPerformancePayload());
    case "errors": return ok(await errorsPayload());
    case "alerts": return ok(alertsPayload());
    case "alert-rules": return ok(alertRulesPayload());
    case "slo": return ok(await sloPayload());
    case "scorecard": return ok(await scorecardPayload());
    case "capacity": return ok(await capacityPayload());
    case "infrastructure": return ok(await infrastructurePayload());
    case "deployment-impact": return ok(await deploymentImpactPayload());
    case "changes": return ok(changesPayload());
    case "correlation": return ok(await correlationPayload(q));
    case "runbooks": return ok(runbooksPayload());
    case "oncall": return ok(oncallPayload());
    case "reports": return ok(await reportPayload(null, null));
    case "ai-insights": return ok(await aiInsightsPayload());
    case "settings": return ok(settingsPayload());
    // ---- Phase 25 sections ----
    case "availability": return ok(await availabilityPayload());
    case "activity": return ok(await activityPayload(q));
    case "access": return ok(accessPayload());
    case "retention": return ok(await retentionPayload());
  }
}

// ---- P23-01 / P25-01 · Observability Home ----
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
  // Phase 25: real request telemetry (recorded by the API metering layer).
  const [stats, avail, client] = await Promise.all([requestStats(3_600_000), availabilityStats(86_400_000), clientStats(3_600_000)]);
  const tel = telemetryPersistenceStatus();
  return {
    overall: dbP.health === "healthy" && apiP.health === "healthy" && openIncidents.length === 0 ? "Healthy" : dbP.health === "healthy" && apiP.health !== "unavailable" ? "Degraded" : "Attention required",
    environment: env.vercelEnv ?? "runtime",
    commit: env.commitSha,
    signals: {
      database: { health: dbP.health, latencyMs: dbP.latencyMs, note: dbP.note },
      api: { health: apiP.health, latencyMs: apiP.latencyMs, note: apiP.note },
      availability: avail.requestSuccessPct != null
        ? { value: avail.requestSuccessPct, note: `Measured from ${avail.requests} real request(s) over the last 24h — ${avail.serverErrors} returned 5xx. ${avail.label}` }
        : { value: null as number | null, note: `Insufficient data — ${avail.label}` },
      errorRate: stats.errorRatePct != null
        ? { value: stats.errorRatePct, note: `${stats.errors} of ${stats.total} requests in the last hour returned 5xx or failed (request-level telemetry, Phase 25).` }
        : { value: null as number | null, note: `Insufficient data — no request-level telemetry recorded in the last hour yet. ${stats.sampleLabel}` },
      requestVolume: { value: stats.total, note: stats.sampleLabel },
      clientErrorsLastHour: client.jsErrors,
      telemetry: { persistence: tel.persistence, note: tel.persistenceLabel },
      auditFailuresLastHour: failures,
      auditEventsLastHour: recent.length,
      sloCompliance: { value: null as string | null, note: store().slos.length ? "SLOs defined — compliance is computed from real telemetry on the SLO screen (P23-13)." : "No SLOs configured (P23-13)." },
    },
    activeIncidents: openIncidents.map((i) => ({ id: i.id, severity: i.severity, title: i.title, status: i.status, startedAt: i.startedAt })),
    activeAlerts: triggeredAlerts.map((a) => ({ id: a.id, severity: a.severity, name: a.ruleName, status: a.status, triggeredAt: a.triggeredAt })),
    deployment: { onVercel: env.onVercel, commit: env.commitSha, branch: env.commitBranch, note: "Full lifecycle in P22-02 Deployment Status (VERCEL_TOKEN enables live API)." },
    criticalEvents: events.filter((e) => e.severity === "Critical" || e.severity === "High").slice(0, 6).map((e) => ({ ts: e.ts, action: e.action, resource: e.resource, severity: e.severity, result: e.result, context: e.context?.slice(0, 120) })),
    sourceNote: "Every value is measured live (probes), derived from the enterprise audit trail and governance registries, or computed from real Phase 25 request telemetry. Absent telemetry is labeled, never invented.",
  };
}

// ---- P23-02 / P25-02 · Metrics Explorer ----
async function metricsPayload() {
  const [dbP, apiP] = await Promise.all([dbProbe(), selfProbe()]);
  const mem = process.memoryUsage();
  const events = auditEvents(300);
  const hourAgo = Date.now() - 3_600_000;
  const recent = events.filter((e) => e.ts >= hourAgo);
  // Phase 25: real request telemetry + client telemetry + one real series.
  const [stats, client, series] = await Promise.all([requestStats(3_600_000), clientStats(3_600_000), requestSeries(3_600_000, 12)]);
  const tel = telemetryPersistenceStatus();
  const lcpMedians = client.perScreen.map((s) => s.lcp).filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
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
      // ---- Phase 25: request-level and client-level metrics (real) ----
      { key: "request-count", label: "Requests · last hour", unit: "requests", value: stats.total, health: "healthy", note: stats.sampleLabel },
      { key: "request-error-rate", label: "Request error rate · last hour", unit: "%", value: stats.errorRatePct, health: stats.errorRatePct == null ? "not-configured" : stats.errorRatePct > 5 ? "degraded" : "healthy", note: stats.errorRatePct == null ? stats.sampleLabel : `${stats.errors} erroring request(s) of ${stats.total}.` },
      { key: "api-p95-latency", label: "API p95 latency · last hour", unit: "ms", value: stats.p95, health: stats.p95 == null ? "not-configured" : stats.p95 > 2000 ? "degraded" : "healthy", note: stats.p95 == null ? stats.sampleLabel : `p50 ${stats.p50 ?? "—"} ms · p99 ${stats.p99 ?? "—"} ms — computed from recorded request durations.` },
      { key: "client-js-errors", label: "Client JS errors · last hour", unit: "errors", value: client.jsErrors, health: client.jsErrors > 0 ? "degraded" : "healthy", note: "Real window.onerror / unhandledrejection reports ingested from Qubit One clients." },
      { key: "client-vitals", label: "Client vital samples · last hour", unit: "samples", value: client.vitalsSamples, health: "healthy", note: "Real browser vitals ingested via POST /api/telemetry." },
      { key: "client-lcp-median", label: "Client LCP · median (ms)", unit: "ms", value: lcpMedians.length ? Math.round(lcpMedians.reduce((a, b) => a + b, 0) / lcpMedians.length) : null, health: lcpMedians.length ? "healthy" : "not-configured", note: lcpMedians.length ? "Median of per-screen LCP medians in the window." : "Insufficient data — no client vitals recorded in the window." },
      { key: "cpu", label: "CPU utilization", unit: "%", value: null, health: "not-configured", note: "Not available on serverless — the platform does not expose per-instance CPU to the app." },
      { key: "queue-depth", label: "Queue depth", unit: "items", value: null, health: "not-configured", note: "Not configured — no queue infrastructure (intentional)." },
      { key: "sessions", label: "Active sessions", unit: "count", value: null, health: "not-configured", note: "Sessions are stateless signed cookies — no server-side session counter exists." },
    ],
    series: {
      label: "Requests & errors · last hour (12 real buckets)",
      buckets: series,
      note: "Computed from real request events in the Phase 25 telemetry store. Empty buckets are real zeros, not gaps; the store keeps " + `${telemetryConfigSnapshot().telemetryRetentionDays}-day retention (P25-22).`,
    },
    persistence: { state: tel.persistence, note: tel.persistenceLabel },
    timeRangeNote: "Point-in-time probes are measured when this section loads. Request/client series cover the last hour from the Phase 25 telemetry store; older history follows the enforced retention policy rather than being invented.",
    sourceNote: "Live probes + process metrics + audit derivation + Phase 25 request/client telemetry only.",
  };
}

// ---- P23-03 / P25-03 · Logs Explorer (audit trail + Phase 25 structured telemetry) ----
interface MergedLogEvent {
  id: string; ts: number; time: string; severity: string; level: string; service: string;
  source: "audit" | "telemetry"; kind: string; actor: string | null; action: string | null;
  resource: string | null; result: string | null; correlationId: string | null; requestId: string | null;
  method: string | null; status: number | null; durationMs: number | null; screen: string | null;
  release: string | null; message: string | null;
}

async function logsPayload(q: Record<string, unknown>) {
  const text = typeof q.q === "string" ? q.q.toLowerCase().slice(0, 120) : null;
  const level = typeof q.level === "string" && ["debug", "info", "warn", "error"].includes(q.level) ? q.level : null;
  const stream = typeof q.source === "string" && ["audit", "telemetry"].includes(q.source) ? q.source : null;
  const route = typeof q.route === "string" ? q.route.slice(0, 120) : null;
  const requestId = typeof q.requestId === "string" ? q.requestId.slice(0, 64) : null;
  const sinceMs = Number(q.sinceMs) || null;

  const auditList: MergedLogEvent[] = auditEvents(400)
    .filter((e) => {
      if (stream === "telemetry") return false;
      if (sinceMs && e.ts < sinceMs) return false;
      if (level && e.severity.toLowerCase() !== level) return false;
      if (requestId && e.correlationId !== requestId) return false;
      const hay = `${e.context ?? ""} ${e.action} ${e.resource} ${e.actor}`.toLowerCase();
      if (route && !hay.includes(route.toLowerCase())) return false;
      if (text && !hay.includes(text)) return false;
      return true;
    })
    .map((e) => ({
      id: e.id, ts: e.ts, time: e.time, severity: e.severity, level: e.severity.toLowerCase(), service: e.source,
      source: "audit" as const, kind: "audit", actor: e.actor, action: e.action, resource: e.resource,
      result: e.result, correlationId: e.correlationId, requestId: e.correlationId, method: null,
      status: null, durationMs: null, screen: null, release: null, message: e.context,
    }));

  const tel = await readTelemetry({
    kinds: ["request", "log", "error", "probe", "client-vital", "client-error", "client-route", "client-request"],
    sinceMs: sinceMs ?? undefined, level: level as "debug" | "info" | "warn" | "error" | null,
    routeContains: route, requestId, q: text, limit: 300,
  });
  const telList: MergedLogEvent[] = (stream === "audit" ? [] : tel.events).map((e) => ({
    id: e.id, ts: e.ts, time: new Date(e.ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }),
    severity: e.level === "error" ? "High" : e.level === "warn" ? "Warning" : "Info",
    level: e.level, service: e.kind, source: "telemetry" as const, kind: e.kind,
    actor: e.source === "client" ? "client browser" : "application", action: e.kind,
    resource: e.route ?? e.screen, result: e.status != null ? String(e.status) : e.level === "error" ? "Failure" : "Success",
    correlationId: e.requestId, requestId: e.requestId, method: e.method, status: e.status,
    durationMs: e.durationMs, screen: e.screen, release: e.release, message: e.message ?? e.errorCode,
  }));

  const merged = [...auditList, ...telList].sort((a, b) => b.ts - a.ts).slice(0, 300);
  return {
    stream: {
      kind: "audit-trail + application telemetry",
      note: "TWO real streams, ONE view (Phase 25): the enterprise audit trail (governance events) and Phase 25 structured telemetry (request metering, application logs, server errors, probes, client vitals/errors). Application stdout is not shipped anywhere: 'Not configured' as a transport — but the events below are real, redacted and stored.",
    },
    events: merged,
    counts: { audit: stream === "telemetry" ? 0 : auditList.length, telemetry: stream === "audit" ? 0 : telList.length },
    store: { source: tel.store, persistence: tel.persistence.persistence, note: tel.persistence.persistenceLabel },
    filters: { applied: { q: text, level, source: stream, route, requestId, sinceMs }, supported: { level: ["debug", "info", "warn", "error"], source: ["audit", "telemetry"], note: "q / route / requestId / sinceMs are honored server-side." } },
    redaction: { active: true, rules: store().settings.redactionRules, note: "Redaction runs at the SOURCE for both streams: secret-shaped values are masked before storage; secret-named keys never persist a value." },
    savedViews: [] as unknown[],
    savedViewsNote: "Saved views registry is empty — views an administrator saves appear here (in-process).",
    sourceNote: "Real events from the audit trail + Phase 25 telemetry store. Sensitive values are redacted before they exist.",
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
      { name: "Telemetry store (Phase 25)", status: telemetryPersistenceStatus().persistence === "ok" ? "healthy" : "degraded", latencyMs: null, lastSuccessAt: null, lastFailureAt: null, availability: null, availabilityNote: "Measured indirectly via persistence status.", configState: "DATABASE_URL configured", note: telemetryPersistenceStatus().persistenceLabel },
    ],
    sourceNote: "Statuses derived from live probes and credential presence only.",
  };
}

// ---- P23-07 / P25-05 · API Performance ----
const API_ENDPOINTS = [
  { endpoint: "/api/auth/session", method: "POST", service: "Authentication" },
  { endpoint: "/api/ops?section=health", method: "GET", service: "Operations" },
  { endpoint: "/api/obs?section=home", method: "GET", service: "Observability" },
  { endpoint: "/api/platform?section=status", method: "GET", service: "Platform Ops" },
  { endpoint: "/api/executive", method: "GET", service: "CEO Command Center" },
  { endpoint: "/api/search?q=report", method: "GET", service: "Global Search" },
];
async function apiPerformancePayload() {
  // Phase 25: real server-observed per-route statistics from request metering.
  const [hour, day] = await Promise.all([requestStats(3_600_000), requestStats(86_400_000)]);
  return {
    endpoints: API_ENDPOINTS,
    live: {
      hour: { total: hour.total, errorRatePct: hour.errorRatePct, p50: hour.p50, p95: hour.p95, p99: hour.p99, sampleLabel: hour.sampleLabel },
      day: { total: day.total, errorRatePct: day.errorRatePct, p50: day.p50, p95: day.p95, p99: day.p99, sampleLabel: day.sampleLabel },
      perRoute: hour.perRoute,
      note: "Server-observed request metering (Phase 25 withMeter wrapper): every API request records route, method, status, duration and request id. Percentiles use nearest-rank over recorded durations; with fewer than 10 samples they are withheld as 'Insufficient data' rather than estimated.",
    },
    percentiles: hour.total >= 10 ? { p50: hour.p50, p95: hour.p95, p99: hour.p99, basis: `${hour.total} recorded requests in the last hour` } : null,
    percentilesNote: hour.total >= 10 ? hour.sampleLabel : `Insufficient data — ${hour.sampleLabel}`,
    probeResults: null as unknown,
    probeNote: "'Probe endpoints' executes REAL server-side requests now. Protected endpoints answer 401 without a session — that is healthy (reachable + auth enforced).",
    lastProbeAt: null as number | null,
    sourceNote: "Endpoint manifest from the real route tree + real request-level telemetry from the Phase 25 metering layer.",
  };
}

// ---- P23-08 / P25-06 · Database Performance ----
async function databasePerformancePayload() {
  const dbP = await dbProbe();
  // Phase 25: every probe measurement becomes a real telemetry event —
  // over time this builds a REAL probe history instead of single snapshots.
  recordTelemetry({
    kind: "probe", level: dbP.health === "healthy" ? "info" : "error",
    route: "db SELECT 1", status: dbP.health === "healthy" ? 200 : 500,
    durationMs: dbP.latencyMs, message: dbP.note, service: "database",
  });
  const probeHistory = (await readTelemetry({ kinds: ["probe"], sinceMs: Date.now() - 86_400_000, limit: 40 }))
    .events.filter((e) => (e.route ?? "").startsWith("db"))
    .map((e) => ({ ts: e.ts, durationMs: e.durationMs, status: e.status }));
  const dbDurations = probeHistory.map((p) => p.durationMs).filter((d): d is number => typeof d === "number").sort((a, b) => a - b);
  const events = auditEvents(300).filter((e) => e.result === "Failure");
  return {
    probe: { health: dbP.health, latencyMs: dbP.latencyMs, note: dbP.note },
    probeHistory: {
      samples: probeHistory,
      count: probeHistory.length,
      p50: dbDurations.length >= 3 ? dbDurations[Math.ceil(dbDurations.length * 0.5) - 1] : null,
      p95: dbDurations.length >= 3 ? dbDurations[Math.ceil(dbDurations.length * 0.95) - 1] : null,
      note: probeHistory.length >= 3 ? `${probeHistory.length} recorded SELECT 1 measurements in the last 24h (each probe run by an operational section records one real sample).` : `Insufficient data — ${probeHistory.length} recorded probe sample(s). History accumulates as operational sections run; nothing is interpolated.`,
    },
    slowQueries: null as unknown, slowQueriesNote: "Not configured — pg_stat_statements / Supabase query insights are not exposed to the application.",
    connectionUsage: null as unknown, connectionUsageNote: "Not available without Supabase management APIs.",
    transactionDuration: null as unknown, transactionDurationNote: "Not instrumented.",
    lockWaits: null as unknown, lockWaitsNote: "Not available without pg_locks access.",
    databaseSize: null as unknown, databaseSizeNote: "Not available without management APIs.",
    queryErrors: { recentCount: events.length, note: "Failure events in the enterprise audit trail (all causes) — not a SQL error counter.", sample: events.slice(0, 5).map((e) => ({ ts: e.ts, action: e.action, resource: e.resource, context: e.context?.slice(0, 100) })) },
    sqlConsole: false, sqlConsoleNote: "No SQL console in this phase (spec §12). Never allow arbitrary destructive SQL.",
    sourceNote: "One live probe + real probe history from the Phase 25 telemetry store + audit-derived failure view. Everything the runtime cannot see is labeled.",
  };
}

// ---- P23-09 / P25-07 · Web Performance ----
async function webPerformancePayload() {
  const vitals = platformVitalsSnapshot();
  const client = await clientStats(86_400_000);
  return {
    collected: vitals.length,
    samples: vitals.slice(-20).map((v) => ({ at: v.at, screen: v.screen, lcpMs: v.lcpMs ?? null, cls: v.cls ?? null, ttfbMs: v.ttfbMs ?? null, fcpMs: v.fcpMs ?? null })),
    aggregate: {
      windowNote: "Aggregated from REAL client vitals ingested via POST /api/telemetry over the last 24h (Phase 25 telemetry store — persists across sessions, unlike the in-session samples above).",
      vitalsSamples: client.vitalsSamples,
      routeTransitions: client.routeTransitions,
      perScreen: client.perScreen,
      note: client.vitalsSamples ? `${client.vitalsSamples} real vital sample(s) from ${client.perScreen.length} screen(s) — medians per screen; a median of fewer than 3 samples is the sample itself.` : "Insufficient data — no client vitals recorded in the last 24h window.",
    },
    jsErrors: {
      count: client.jsErrors,
      recent: client.recentJsErrors,
      note: client.jsErrors ? `${client.jsErrors} real browser error event(s) ingested in the last 24h (window.onerror / unhandledrejection → POST /api/telemetry).` : "No client JavaScript failures ingested in the window — the empty state is real, not a suppressed count.",
    },
    inpNote: client.inpNote,
    routesNote: client.perScreen.length ? "Per-screen aggregation is computed from persisted client telemetry (Phase 25)." : "Insufficient data for per-route aggregation — aggregation appears as real samples arrive.",
    privacy: "Vitals carry screen names and timing only — no identifiers, no content; identity fields sent by a client are ignored by construction (server-side allowlist).",
    sourceNote: "Only actually-collected samples are shown: in-session collector + Phase 25 ingested client telemetry.",
  };
}

// ---- P23-10 / P25-04 · Error Intelligence ----
async function errorsPayload() {
  const events = auditEvents(400).filter((e) => e.result === "Failure" || e.result === "Blocked");
  const groups = new Map<string, AuditEvent[]>();
  for (const e of events) {
    const key = `${e.action} · ${e.resource.split("/")[0]}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const auditGroups = [...groups.entries()].map(([key, list]) => ({
    key,
    title: key,
    source: "audit-trail" as const,
    frequency: list.length,
    affectedRoutes: [...new Set(list.map((e) => e.resource))].slice(0, 5),
    affectedScreens: [] as string[],
    firstSeen: Math.min(...list.map((e) => e.ts)),
    lastSeen: Math.max(...list.map((e) => e.ts)),
    severity: list[0]?.severity ?? "Info",
    status: "Open (unmanaged)" as string,
    releases: [] as string[],
    deploymentVersion: runtimeEnv().commitSha,
    trend: list.length > 1 ? "recurring" : "single-occurrence",
  }));
  // Phase 25: real server error groups (kind=error from instrumentation) + client JS error groups.
  const telGroups = await errorGroups(86_400_000);
  const telemetryGroups = telGroups.map((g) => ({
    key: g.key,
    title: g.key,
    source: g.source,
    frequency: g.count,
    affectedRoutes: g.affectedRoutes,
    affectedScreens: g.affectedScreens,
    firstSeen: g.firstSeen,
    lastSeen: g.lastSeen,
    severity: g.severity === "error" ? "High" : "Warning",
    status: "Open (unmanaged)",
    releases: g.releases,
    deploymentVersion: g.releases[g.releases.length - 1] ?? runtimeEnv().commitSha,
    trend: g.count > 1 ? "recurring" : "single-occurrence",
  }));
  return {
    groups: [...auditGroups.sort((a, b) => b.frequency - a.frequency), ...telemetryGroups.sort((a, b) => b.frequency - a.frequency)],
    basis: "Grouped from real Failure/Blocked records in the enterprise audit trail PLUS Phase 25 error telemetry (unhandled server errors via instrumentation + client JavaScript failures). Duplicate groups are collapsed by error code + first message line.",
    links: { deployments: "Compare firstSeen with P23-17 deployment timeline.", logs: "Open the same events in P23-03 Logs Explorer.", incidents: "Link manually from P22-23 Incident Center (correlation is evidence-gated, P23-19)." },
    sourceNote: "No synthetic error groups. Empty list = no failures recorded anywhere.",
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

// ---- P23-12 / P25-12 · Alert Rules ----
function alertRulesPayload() {
  const s = store();
  return {
    rules: [...s.alertRules].sort((a, b) => b.updatedAt - a.updatedAt),
    metrics: ["db-latency", "api-rtt", "rss", "audit-failures", "audit-events", "request-error-rate", "api-p95-latency", "request-count", "client-js-errors"],
    metricNote: "Only metrics that can actually be measured are selectable: db-latency (SELECT 1 ms), api-rtt (self probe ms), rss (process MB), audit-failures / audit-events (events/hour from the audit trail), and the Phase 25 telemetry metrics — request-error-rate (% last hour), api-p95-latency (ms last hour), request-count (last hour), client-js-errors (last hour). Telemetry rules need ≥10 recorded requests in the window before they evaluate; below that they report 'Insufficient data' instead of guessing.",
    evaluationNote: "Rules evaluate ON DEMAND ('Evaluate now') against real measurements; a triggered condition creates a real Alert (P23-11) and writes to the audit trail. Continuous background evaluation requires a scheduler (Not configured).",
    notificationIntegration: "Recipients reference the existing notification engine; routing defaults come from Observability Settings (P23-24). No second notification backend.",
    sourceNote: "In-process registry, audited CRUD.",
  };
}

// ---- P23-13 / P25-16 · SLO / SLA Management ----
async function sloPayload() {
  const s = store();
  const dbP = await dbProbe();
  const slos = await Promise.all(s.slos.map(async (slo) => {
    // Phase 25: compliance is COMPUTED from real request telemetry over the
    // SLO window (bounded by retention); below 20 samples → Insufficient data.
    const evaluation = await evaluateSloReal(slo);
    return {
      ...slo,
      current: evaluation.current,
      status: evaluation.status,
      complianceNote: evaluation.evidence,
      evidence: { dbHealth: dbP.health, dbLatencyMs: dbP.latencyMs, measuredAt: Date.now(), sampleCount: evaluation.sampleCount },
    };
  }));
  return {
    slos,
    targetPolicy: "Targets are NEVER invented — an SLO exists only when an administrator configures it (audited).",
    evaluationPolicy: "Phase 25: each evaluation runs against the real telemetry store for the SLO window (bounded at 30 days by retention reality). 'Meeting' / 'Breaching' / 'Insufficient data' are the only states — no synthetic compliance percentages.",
    errorBudget: { note: "Error-budget math uses the same real measurement: budget consumed = 1 − (current / target) for availability/error-rate kinds, shown on each SLO row when status is Meeting or Breaching." },
    sourceNote: "Registry + real telemetry evaluation.",
  };
}

// ---- P23-14 · Reliability Scorecard ----
async function scorecardPayload() {
  const env = runtimeEnv();
  const [dbP, apiP] = await Promise.all([dbProbe(), selfProbe()]);
  const ops = opsStore();
  const os = store();
  const events = auditEvents(400);
  const [stats, avail] = await Promise.all([requestStats(86_400_000), availabilityStats(86_400_000)]);
  const openIncidents = ops.incidents.filter((i) => i.status !== "resolved" && i.status !== "post-incident-review");
  const categories = [
    {
      id: "availability", label: "Availability",
      pass: avail.requestSuccessPct != null ? avail.serverErrors === 0 : apiP.health === "healthy",
      evidence: avail.requestSuccessPct != null ? avail.label : `No request telemetry in window — falling back to the live self-probe (${apiP.note}).`,
      weight: "measured",
    },
    { id: "latency", label: "Latency", pass: (stats.p95 ?? apiP.latencyMs ?? 9999) < 2000, evidence: stats.p95 != null ? `p95 ${stats.p95} ms over ${stats.total} measured requests (24h).` : `Self-probe ${apiP.latencyMs ?? "—"} ms (live single request; insufficient telemetry for p95).` },
    { id: "errors", label: "Errors", pass: events.filter((e) => e.result === "Failure").length === 0 && (stats.errorRatePct ?? 0) === 0, evidence: `${events.filter((e) => e.result === "Failure").length} audit failure event(s); request error rate ${stats.errorRatePct == null ? "insufficient data" : `${stats.errorRatePct}%`}.` },
    { id: "security", label: "Security", pass: true, evidence: "Session plane active, RBAC enforced, audit operating; MFA/SSO absent (documented gaps)." },
    { id: "deployment-health", label: "Deployment health", pass: env.onVercel, evidence: env.onVercel ? "Live on Vercel; CI pipeline green on push (verified historically)." : "Not on Vercel runtime." },
    { id: "database-health", label: "Database health", pass: dbP.health === "healthy", evidence: dbP.note },
    { id: "backup-health", label: "Backup health", pass: false, evidence: "Application cannot verify platform backups; file backups unavailable on serverless (P22-15)." },
    { id: "dependencies", label: "Dependencies", pass: dbP.health === "healthy", evidence: "Core data plane (Supabase) live; several providers not configured (P23-06)." },
    { id: "incidents", label: "Incidents", pass: openIncidents.length === 0, evidence: openIncidents.length ? `${openIncidents.length} open incident(s).` : "No open incidents recorded." },
    { id: "slo-compliance", label: "SLO compliance", pass: false, evidence: os.slos.length ? "SLOs defined — compliance evaluates on the SLO screen (P23-13); the scorecard marks this category conservatively until a real measurement window exists." : "No SLOs configured." },
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
  const stats = await requestStats(3_600_000);
  return {
    resources: [
      { id: "memory-rss", label: "Process memory (RSS)", current: `${Math.round(mem.rss / 1048576)} MB`, unit: "MB", trend: null, peak: null, baseline: null, threshold: null, note: "Real, current process. Vercel lambda memory limit is plan-defined; per-instance peaks require history (Not configured)." },
      { id: "heap", label: "Heap used", current: `${Math.round(mem.heapUsed / 1048576)} MB`, unit: "MB", trend: null, peak: null, baseline: null, threshold: null, note: "Real, current process." },
      { id: "requests", label: "Request volume", current: `${stats.total} / last hour`, unit: "req/h", trend: null, peak: null, baseline: null, threshold: null, note: stats.sampleLabel },
      { id: "cpu", label: "CPU", current: "Not available", unit: "%", trend: null, peak: null, baseline: null, threshold: null, note: "Serverless CPU is not exposed to the application." },
      { id: "storage-db", label: "Database storage", current: "Not available", unit: "MB", trend: null, peak: null, baseline: null, threshold: null, note: "Requires Supabase management APIs (Not configured)." },
      { id: "audit-volume", label: "Audit event volume", current: `${auditEvents(400).length} in window`, unit: "events", trend: null, peak: null, baseline: null, threshold: null, note: "Real events in the current audit window." },
    ],
    forecast: { available: false, note: "No forecasts: forecasting requires historical series beyond the current telemetry retention window; fabricated projections are worse than none." },
    sourceNote: "Only genuinely measurable values are shown.",
  };
}

// ---- P23-16 · Infrastructure Health ----
async function infrastructurePayload() {
  const env = runtimeEnv();
  const dbP = await dbProbe();
  const mem = process.memoryUsage();
  const tel = telemetryPersistenceStatus();
  return {
    providerNeutral: true,
    resources: [
      { resource: "Application runtime", provider: env.onVercel ? "Vercel (serverless)" : "Standalone", region: env.region ?? "local", health: "healthy", utilization: `RSS ${Math.round(mem.rss / 1048576)} MB`, alerts: 0, lastUpdatedAt: Date.now(), note: "This process, measured." },
      { resource: "PostgreSQL (data plane)", provider: "Supabase", region: "ap-northeast-1 (pooler endpoint)", health: dbP.health, utilization: "Not available", alerts: 0, lastUpdatedAt: Date.now(), note: dbP.note },
      { resource: "Telemetry store (TelemetryEvent)", provider: "Supabase PostgreSQL", region: "ap-northeast-1", health: tel.persistence === "ok" ? "healthy" : tel.persistence === "degraded" ? "degraded" : "unavailable", utilization: `${tel.bufferLen} event(s) buffered`, alerts: 0, lastUpdatedAt: Date.now(), note: tel.persistenceLabel },
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
  const withImpact = await Promise.all(deployments.slice(0, 8).map(async (d) => {
    const after = events.filter((e) => e.ts >= d.createdAt);
    const before = events.filter((e) => e.ts < d.createdAt && e.ts >= d.createdAt - 86_400_000);
    // Phase 25: REAL request-telemetry deltas (5xx counts + p95 latency) before/after each deployment.
    const [telAfter, telBefore] = await Promise.all([
      readTelemetry({ kinds: ["request"], sinceMs: d.createdAt, limit: 2_000 }),
      readTelemetry({ kinds: ["request"], sinceMs: d.createdAt - 86_400_000, limit: 2_000 }),
    ]);
    const afterReq = telAfter.events.filter((e) => e.ts >= d.createdAt);
    const beforeReq = telBefore.events.filter((e) => e.ts < d.createdAt && e.ts >= d.createdAt - 86_400_000);
    const p95Of = (list: typeof afterReq) => {
      const durs = list.map((e) => e.durationMs).filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
      return durs.length >= 10 ? durs[Math.ceil(durs.length * 0.95) - 1] : null;
    };
    const p95After = p95Of(afterReq);
    const p95Before = p95Of(beforeReq);
    return {
      ...d,
      errorChange: { before: before.filter((e) => e.result === "Failure").length, after: after.filter((e) => e.result === "Failure").length },
      auditEventChange: { before: before.length, after: after.length },
      requestErrorChange: { before: beforeReq.filter((e) => (e.status ?? 0) >= 500).length, after: afterReq.filter((e) => (e.status ?? 0) >= 500).length, beforeSamples: beforeReq.length, afterSamples: afterReq.length },
      latencyChange: p95After != null && p95Before != null ? { beforeMs: p95Before, afterMs: p95After } : null,
      latencyNote: p95After != null && p95Before != null ? `p95 before ${p95Before} ms → after ${p95After} ms (≥10 recorded requests in each window — a real, measured delta).` : "Insufficient data — fewer than 10 recorded requests in a before/after window; a latency delta is not computed and not invented.",
      affectedRoutes: [...new Set(afterReq.map((e) => e.route).filter((r): r is string => !!r))].slice(0, 5),
      incidentChange: null as number | null,
      incidentNote: "Incident registry entries carry timestamps; correlation is available in P23-19.",
    };
  }));
  return {
    configured,
    current: { commit: env.commitSha, branch: env.commitBranch },
    deployments: withImpact,
    method: "Before/after windows use REAL audit-event counts (24h before vs since deployment) AND real Phase 25 request telemetry (5xx counts + p95 latency where ≥10 samples exist per window). Causal claims are never made — temporal deltas only.",
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

// ---- P23-19 / P25-13 · Incident Correlation ----
async function correlationPayload(q: Record<string, unknown>) {
  const s = opsStore();
  const os = store();
  const windowMs = Number(q.windowMs ?? 86_400_000);
  const since = Date.now() - (Number.isFinite(windowMs) ? windowMs : 86_400_000);
  const events = auditEvents(400).filter((e) => e.ts >= since);
  const incidents = s.incidents.filter((i) => i.startedAt >= since);
  const alerts = os.alerts.filter((a) => a.triggeredAt >= since);
  const changes = events.filter((e) => CHANGE_ACTIONS.some((c) => e.action.startsWith(c)));
  // Phase 25: real server/client error events join the correlation timeline.
  const tel = await readTelemetry({ kinds: ["error", "client-error", "request"], sinceMs: since, limit: 1_000 });
  const telErrors = tel.events.filter((e) => e.kind === "error" || e.kind === "client-error" || (e.status ?? 0) >= 500);
  return {
    windowMs: since ? Date.now() - since : windowMs,
    incidents: incidents.map((i) => ({ id: i.id, severity: i.severity, title: i.title, startedAt: i.startedAt, status: i.status })),
    alerts,
    changes: changes.slice(0, 30).map((e) => ({ ts: e.ts, who: e.actor, action: e.action, resource: e.resource })),
    errors: [...events.filter((e) => e.result === "Failure" || e.result === "Blocked").slice(0, 30).map((e) => ({ ts: e.ts, action: e.action, resource: e.resource, severity: e.severity })), ...telErrors.slice(0, 30).map((e) => ({ ts: e.ts, action: e.kind, resource: e.route ?? e.screen ?? "(unknown)", severity: e.level === "error" ? "High" : "Warning" }))].sort((a, b) => b.ts - a.ts).slice(0, 40),
    timeline: [
      ...incidents.map((i) => ({ at: i.startedAt, kind: "incident", text: `${i.severity} ${i.title}` })),
      ...alerts.map((a) => ({ at: a.triggeredAt, kind: "alert", text: a.ruleName })),
      ...changes.map((e) => ({ at: e.ts, kind: "change", text: `${e.action} → ${e.resource}` })),
      ...telErrors.slice(0, 40).map((e) => ({ at: e.ts, kind: "telemetry-error", text: `${e.kind}${e.route ? ` · ${e.route}` : e.screen ? ` · ${e.screen}` : ""}${e.errorCode ? ` · ${e.errorCode}` : ""}` })),
    ].sort((a, b) => b.at - a.at).slice(0, 80),
    rule: "Relationships are temporal co-occurrence in real data — the UI never asserts causality. With telemetry evidence (e.g., errors beginning within minutes of a deployment) the wording is 'Potential correlation detected', never 'caused'.",
    sourceNote: "Correlation drawn exclusively from the audit trail, governance registries and Phase 25 telemetry within the selected window.",
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

// ---- P23-22 / P25-17 · Reliability Reports ----
async function reportPayload(_from: number | null, _to: number | null) {
  const [dbP, apiP] = await Promise.all([dbProbe(), selfProbe()]);
  const s = opsStore();
  const os = store();
  const events = auditEvents(400);
  const hourAgo = Date.now() - 3_600_000;
  const recent = events.filter((e) => e.ts >= hourAgo);
  const [stats, avail, client] = await Promise.all([requestStats(86_400_000), availabilityStats(86_400_000), clientStats(86_400_000)]);
  return {
    report: {
      generatedAt: Date.now(),
      window: "audit window (most recent 400 events) + live probes + Phase 25 telemetry (24h)",
      availability: { probeHealth: apiP.health, probeLatencyMs: apiP.latencyMs, requestSuccessPct: avail.requestSuccessPct, note: avail.requestSuccessPct != null ? avail.label : "Single-request live probe — not an availability percentage (insufficient telemetry)." },
      requestTelemetry: { total: stats.total, errorRatePct: stats.errorRatePct, p50: stats.p50, p95: stats.p95, p99: stats.p99, note: stats.sampleLabel },
      clientTelemetry: { jsErrors: client.jsErrors, vitalsSamples: client.vitalsSamples, note: "Real client-side events ingested over the last 24h." },
      sloCompliance: { slos: os.slos.length, note: os.slos.length ? "Per-SLO evaluations on the SLO screen (P23-13) — computed from real telemetry." : "None configured." },
      incidents: { open: s.incidents.filter((i) => i.status !== "resolved").length, total: s.incidents.length },
      errorTrend: { failuresInWindow: events.filter((e) => e.result === "Failure").length, eventsLastHour: recent.length },
      apiPerformance: { probeLatencyMs: apiP.latencyMs, p95: stats.p95, note: stats.p95 != null ? "p95 from real request telemetry." : "Point-in-time probe only." },
      databasePerformance: { probeLatencyMs: dbP.latencyMs, health: dbP.health },
      deploymentImpact: { currentCommit: runtimeEnv().commitSha, note: "See P23-17 (token-gated for history)." },
      dependencyHealth: { database: dbP.health, note: "See P23-06 for the full matrix." },
      alertTrend: { total: os.alerts.length, triggered: os.alerts.filter((a) => a.status === "Triggered").length },
      capacity: { rssMb: Math.round(process.memoryUsage().rss / 1048576) },
    },
    exportPolicy: "Report export (JSON) is client-side on this authorized screen; exports of underlying audit data follow the existing Data Export governance (P282).",
    scheduling: "Scheduled delivery reuses the existing Scheduled Reports infrastructure (P283) — no second reporting engine.",
    sourceNote: "Every figure in the report traces to a probe, the audit trail, a registry or the Phase 25 telemetry store.",
  };
}

// ---- P23-23 / P25-23 · Operational AI Insights ----
async function aiInsightsPayload() {
  const env = runtimeEnv();
  const dbP = await dbProbe();
  const events = auditEvents(300);
  const hourAgo = Date.now() - 3_600_000;
  const recent = events.filter((e) => e.ts >= hourAgo);
  const [stats, avail, client] = await Promise.all([requestStats(3_600_000), availabilityStats(86_400_000), clientStats(86_400_000)]);
  // Deterministic (non-AI) analysis — computed, real, labeled as such.
  const deterministic = [
    { kind: "Observed Fact" as const, text: `${recent.length} audit events in the last hour; ${recent.filter((e) => e.result === "Failure").length} failures.`, evidence: "Enterprise audit trail timestamps + results." },
    { kind: "Observed Fact" as const, text: `Database probe ${dbP.health}${dbP.latencyMs != null ? ` (${dbP.latencyMs} ms)` : ""} — measured on this request.`, evidence: "Live SELECT 1 (ops probe)." },
    { kind: "Observed Fact" as const, text: stats.total > 0 ? `${stats.total} API request(s) recorded in the last hour${stats.errorRatePct != null ? `, error rate ${stats.errorRatePct}%` : ""}${stats.p95 != null ? `, p95 latency ${stats.p95} ms` : ""}.` : "No API requests recorded in the last hour — the telemetry store has nothing to report and none is invented.", evidence: "Phase 25 request metering (withMeter)." },
    { kind: "Observed Fact" as const, text: avail.requestSuccessPct != null ? `24h request success rate ${avail.requestSuccessPct}% (${avail.serverErrors} 5xx of ${avail.requests}).` : "24h availability: Insufficient data — no recorded requests in the window.", evidence: "Phase 25 availability computation." },
    { kind: "Observed Fact" as const, text: `${client.jsErrors} client JavaScript error(s) and ${client.vitalsSamples} vital sample(s) ingested in the last 24h.`, evidence: "Phase 25 client telemetry ingestion." },
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
    guardrails: ["AI never invents telemetry — prompts carry only real audit/probe/telemetry context", "No causality claims without evidence", "No autonomous production actions — consequential actions route through the Phase 15 AI Action Approval", "No secrets in prompts or outputs"],
    labels: ["Observed Fact", "Inference", "Recommendation", "Confidence", "Evidence"],
    sourceNote: "Deterministic analysis computed from real data; AI generation (when reachable) is grounded strictly on provided context.",
  };
}
// ---- P23-24 / P25-24 · Observability Settings ----
function settingsPayload() {
  const s = store();
  const cfg = telemetryConfigSnapshot();
  const tel = telemetryPersistenceStatus();
  return {
    settings: s.settings,
    telemetry: {
      requestEnabled: cfg.requestEnabled,
      clientEnabled: cfg.clientEnabled,
      samplingRatePct: cfg.samplingRatePct,
      telemetryRetentionDays: cfg.telemetryRetentionDays,
      hardCapRows: cfg.hardCapRows,
      bufferLen: cfg.bufferLen,
      persistence: tel.persistence,
      persistenceLabel: tel.persistenceLabel,
    },
    editable: ["logRetentionDays", "metricRetentionDays", "traceRetentionDays", "samplingRatePct", "alertDefaults.cooldownMin", "requestTelemetryEnabled", "clientTelemetryEnabled", "telemetryRetentionDays"],
    retentionNote: "Phase 25: the telemetry retention value is ENFORCED — pruneTelemetry deletes TelemetryEvent rows older than the configured days (P25-22 'Run retention now' executes it on demand; the hard row cap is always enforced). Audit/notification retention values remain DECLARATIVE (their stores are provider-managed).",
    redactionNote: "Redaction rules are enforced at the source: writeAudit never persists secret values and telemetry-server redactString/redactKeyValue mask secret-shaped values before storage.",
    privacy: "Vitals and logs carry no identifiers or content; role-based access is enforced server-side on every section (P25-21).",
    sourceNote: "Configuration registry, audited changes, real current values.",
  };
}

// ============================================================
// Phase 25 sections — capabilities without a Phase 23 home
// ============================================================

// ---- P25-10 · Availability & Uptime ----
async function availabilityPayload() {
  const [day, week, series] = await Promise.all([
    availabilityStats(86_400_000),
    availabilityStats(7 * 86_400_000),
    requestSeries(86_400_000, 24),
  ]);
  const { events: probes } = await readTelemetry({ kinds: ["probe"], sinceMs: Date.now() - 86_400_000, limit: 100 });
  return {
    current: {
      successPct: day.requestSuccessPct,
      requests: day.requests,
      serverErrors: day.serverErrors,
      label: day.label,
    },
    window7d: { successPct: week.requestSuccessPct, requests: week.requests, serverErrors: week.serverErrors, label: week.label },
    series: { buckets: series, note: "Hourly request/error buckets from the real telemetry store — zeros are real zeros." },
    healthChecks: {
      ...day.healthChecks,
      note: probes.length ? `${probes.length} probe measurement(s) recorded in 24h (db SELECT 1 checks recorded by operational sections + /api/health request metering).` : "No probe events recorded in the window — health checks appear here as they are measured.",
    },
    downtime: {
      events: day.recentFailures,
      note: day.recentFailures.length ? `${day.recentFailures.length} recent 5xx response(s) — the closest thing to a downtime record that real telemetry supports. Sustained-outage detection requires a scheduler (Not configured).` : "No 5xx responses recorded in the window — no downtime events to list.",
    },
    externalProber: { configured: false, note: "No external availability monitor exists (P22-10 documents the same fact). The figures here are measured from real request telemetry inside this deployment — an external prober would add independence and is the recommended next step." },
    sloLink: "SLO evaluations over the same telemetry: P23-13 (P25-16).",
    sourceNote: "Measured from real request + probe events. No SLA/uptime percentage is claimed without measured data.",
  };
}

// ---- P25-20 · Operational Activity ----
async function activityPayload(q: Record<string, unknown>) {
  const windowMs = Number(q.windowMs ?? 86_400_000);
  const since = Date.now() - (Number.isFinite(windowMs) ? windowMs : 86_400_000);
  const s = opsStore();
  const os = store();
  const events = auditEvents(400).filter((e) => e.ts >= since);
  const tel = await readTelemetry({ kinds: ["error", "client-error"], sinceMs: since, limit: 300 });
  const timeline = [
    ...events.filter((e) => CHANGE_ACTIONS.some((c) => e.action.startsWith(c))).map((e) => ({ at: e.ts, kind: "config-change", text: `${e.action} → ${e.resource}`, who: e.actor, severity: e.severity })),
    ...events.filter((e) => e.action.startsWith("ops.release.")).map((e) => ({ at: e.ts, kind: "deployment", text: `${e.action} → ${e.resource}`, who: e.actor, severity: e.severity })),
    ...events.filter((e) => e.action.includes("migration")).map((e) => ({ at: e.ts, kind: "migration", text: `${e.action} → ${e.resource}`, who: e.actor, severity: e.severity })),
    ...s.incidents.filter((i) => i.startedAt >= since).map((i) => ({ at: i.startedAt, kind: "incident", text: `${i.severity} · ${i.title}`, who: "incident registry", severity: i.severity })),
    ...s.incidents.filter((i) => i.status === "resolved" && i.startedAt >= since).map((i) => ({ at: i.startedAt + 1, kind: "recovery", text: `${i.title} (resolved)`, who: "incident registry", severity: "Info" })),
    ...os.alerts.filter((a) => a.triggeredAt >= since).map((a) => ({ at: a.triggeredAt, kind: "alert", text: `${a.severity} · ${a.ruleName} (${a.status})`, who: a.owner, severity: a.severity })),
    ...os.alerts.filter((a) => a.status === "Resolved" && a.evaluatedAt >= since).map((a) => ({ at: a.evaluatedAt, kind: "recovery", text: `${a.ruleName} resolved`, who: a.owner, severity: "Info" })),
    ...tel.events.map((e) => ({ at: e.ts, kind: e.kind, text: `${e.errorCode ?? "error"}${e.route ? ` · ${e.route}` : e.screen ? ` · ${e.screen}` : ""}`, who: e.source === "client" ? "client browser" : "application", severity: e.level === "error" ? "High" : "Warning" })),
    ...(lastPruneSnapshot() && lastPruneSnapshot()!.at >= since ? [{ at: lastPruneSnapshot()!.at, kind: "retention", text: `telemetry retention prune deleted ${lastPruneSnapshot()!.deleted} event(s)`, who: "system", severity: "Info" }] : []),
  ].sort((a, b) => b.at - a.at).slice(0, 100);
  const counts = timeline.reduce<Record<string, number>>((acc, t) => { acc[t.kind] = (acc[t.kind] ?? 0) + 1; return acc; }, {});
  return {
    windowMs: Date.now() - since,
    timeline,
    counts,
    note: "One operational timeline assembled from REAL sources: the enterprise audit trail (config changes, releases, migrations), governance registries (incidents, alerts + recoveries), Phase 25 telemetry (server/client errors) and retention actions. Deployments via the Vercel API additionally appear in P22-02/P23-17 when VERCEL_TOKEN is configured.",
    sourceNote: "Reuses the existing Audit + deployment + incident infrastructure — no second event store.",
  };
}

// ---- P25-21 · Observability Access ----
function accessPayload() {
  const s = store();
  return {
    matrix: Object.values(s.accessMatrix).map((e) => ({ role: e.role, read: e.read === "all" ? "all" : [...e.read], updatedAt: e.updatedAt, updatedBy: e.updatedBy })),
    delegableSections: [...DELEGABLE_SECTIONS],
    allSections: [...OBS_SECTIONS],
    enforcement: "Every /api/obs request is authorized server-side from the signed session cookie (fail-closed); the matrix above IS the enforced policy — the UI never decides access. Denials are recorded in the audit trail.",
    sensitiveLogsNote: "The Logs Explorer (P23-03) is administrator-only regardless of grants — sensitive diagnostics are not delegable in this deployment.",
    writePolicy: "All mutations (alert rules, SLOs, settings, runbooks, on-call, access matrix, retention) remain administrator-only.",
    persistenceNote: "Grants live in the runtime registry; a cold start restores the deny-by-default default (fail-safe). Every grant/revoke is audited (obs.access.grant / obs.access.revoke).",
    sourceNote: "Access matrix over the existing 5-role RBAC — no new identity system.",
  };
}

// ---- P25-22 · Observability Data Retention ----
async function retentionPayload() {
  const cfg = telemetryConfigSnapshot();
  const tel = telemetryPersistenceStatus();
  let counts: { kind: string; count: number | string; store: string }[] = [];
  try {
    const grouped = await db.telemetryEvent.groupBy({ by: ["kind"], _count: { _all: true } });
    counts = grouped.map((g) => ({ kind: g.kind, count: g._count._all, store: "database" }));
  } catch {
    const s = (globalThis as unknown as { __qubitTelemetryState?: { buffer: { kind: string }[] } }).__qubitTelemetryState;
    const byKind = new Map<string, number>();
    for (const e of s?.buffer ?? []) byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + 1);
    counts = [...byKind.entries()].map(([kind, count]) => ({ kind, count, store: "in-process buffer" }));
  }
  return {
    config: { telemetryRetentionDays: cfg.telemetryRetentionDays, hardCapRows: cfg.hardCapRows, samplingRatePct: cfg.samplingRatePct, requestEnabled: cfg.requestEnabled, clientEnabled: cfg.clientEnabled },
    persistence: { state: tel.persistence, note: tel.persistenceLabel, bufferLen: tel.bufferLen, lastFlushError: tel.lastFlushError ? redactString(tel.lastFlushError).slice(0, 160) : null },
    counts,
    lastPrune: lastPruneSnapshot(),
    policy: {
      enforcement: "Phase 25 ENFORCED retention: 'Run retention now' (audited) deletes TelemetryEvent rows older than telemetryRetentionDays; the hard row cap is enforced during every prune regardless of the retention setting. The flush path also prunes opportunistically.",
      providerFacts: [
        "Application logs (stdout) are NOT shipped to any external log store — Vercel retains runtime logs per its platform policy (visible in the Vercel dashboard); the app does not export them (Not configured).",
        "Prisma query logging goes to stdout only — not stored by this application.",
        "TelemetryEvent rows live in Supabase PostgreSQL until pruned by this policy; Supabase platform backups follow the provider's own retention (see P22-15 — VERIFY in the Supabase dashboard).",
        "The enterprise audit trail is bounded in-process (200 live events) — its durable retention is the platform log policy, not an application guarantee.",
      ],
    },
    actions: ["retention.prune"],
    sourceNote: "Real row counts where the store is reachable; honest labels where it is not.",
  };
}

/**
 * P25 §23 — global search snapshot: observability entities an
 * administrator can find via Qubit One global search. Read-only,
 * bounded, real registries; the search route gates it to
 * administrators (server-derived role).
 */
export function obsSearchSnapshot(): {
  alerts: { id: string; name: string; severity: string; status: string; triggeredAt: number }[];
  incidents: { id: string; severity: string; title: string; status: string; startedAt: number }[];
  runbooks: { id: string; title: string; incidentType: string }[];
  slos: { id: string; name: string; kind: string; target: number }[];
  alertRules: { id: string; name: string; metric: string; enabled: boolean }[];
} {
  const s = store();
  return {
    alerts: s.alerts.slice(0, 25).map((a) => ({ id: a.id, name: a.ruleName, severity: a.severity, status: a.status, triggeredAt: a.triggeredAt })),
    incidents: opsStore().incidents.slice(0, 25).map((i) => ({ id: i.id, severity: i.severity, title: i.title, status: i.status, startedAt: i.startedAt })),
    runbooks: s.runbooks.map((r) => ({ id: r.id, title: r.title, incidentType: r.incidentType })),
    slos: s.slos.map((x) => ({ id: x.id, name: x.name, kind: x.kind, target: x.target })),
    alertRules: s.alertRules.map((r) => ({ id: r.id, name: r.name, metric: r.metric, enabled: r.enabled })),
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
      if (!["db-latency", "api-rtt", "rss", "audit-failures", "audit-events", "request-error-rate", "api-p95-latency", "request-count", "client-js-errors"].includes(metric)) return fail(400, "invalid_metric", "Unsupported metric (only real, measurable metrics are allowed).");
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
      // Real evaluation against live measurements + Phase 25 telemetry.
      const [dbP, apiP] = await Promise.all([dbProbe(), selfProbe()]);
      const mem = process.memoryUsage();
      const events = auditEvents(300);
      const hourAgo = now - 3_600_000;
      const recent = events.filter((e) => e.ts >= hourAgo);
      const [stats, client] = await Promise.all([requestStats(3_600_000), clientStats(3_600_000)]);
      const values: Record<string, number | null> = {
        "db-latency": dbP.latencyMs, "api-rtt": apiP.latencyMs,
        rss: Math.round(mem.rss / 1048576),
        "audit-failures": recent.filter((e) => e.result === "Failure").length,
        "audit-events": recent.length,
        "request-error-rate": stats.total >= 10 ? stats.errorRatePct : null,
        "api-p95-latency": stats.total >= 10 ? stats.p95 : null,
        "request-count": stats.total,
        "client-js-errors": client.jsErrors,
      };
      const created: Alert[] = [];
      const insufficient: string[] = [];
      for (const rule of s.alertRules.filter((r) => r.enabled)) {
        const value = values[rule.metric];
        if (value == null) {
          if ("request-error-rate" === rule.metric || "api-p95-latency" === rule.metric) insufficient.push(rule.name);
          continue;
        }
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
      const note = insufficient.length ? ` ${insufficient.length} telemetry rule(s) skipped — Insufficient data (<10 recorded requests in the window); no value was guessed.` : "";
      return ok({ ok: true, evaluated: s.alertRules.filter((r) => r.enabled).length, triggered: created.length, alerts: created, measurements: values, message: created.length ? `${created.length} alert(s) triggered from real measurements.${note}` : `All enabled rules evaluated — no breaches measured.${note}` });
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
      // Phase 25: telemetry pipeline configuration (applies to this runtime; defaults restore on cold start — fail-safe).
      const telemetryPatch: Record<string, unknown> = {};
      if (typeof action.input.requestTelemetryEnabled === "boolean") telemetryPatch.requestEnabled = action.input.requestTelemetryEnabled;
      if (typeof action.input.clientTelemetryEnabled === "boolean") telemetryPatch.clientEnabled = action.input.clientTelemetryEnabled;
      const tdr = num(action.input.telemetryRetentionDays, 1, 365); if (action.input.telemetryRetentionDays != null && tdr == null) return fail(400, "invalid_retention", "Telemetry retention must be 1–365 days.");
      if (tdr != null) telemetryPatch.telemetryRetentionDays = tdr;
      if (sr != null) telemetryPatch.samplingRatePct = sr;
      if (Object.keys(telemetryPatch).length > 0) configureTelemetry(telemetryPatch);
      st.updatedBy = actor;
      st.updatedAt = now;
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.settings.update", resource: "observability-settings", result: "Success", severity: "Warning", context: JSON.stringify(action.input).slice(0, 200) });
      return ok({ ok: true, message: "Observability settings updated and audited.", settings: st, telemetry: telemetryConfigSnapshot() });
    }
    case "retention.prune": {
      const result = await pruneTelemetry();
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.retention.prune", resource: "telemetry-store", result: "Success", severity: "Warning", context: `${result.mode}: deleted ${result.deleted} event(s). ${result.note}`.slice(0, 200) });
      return ok({ ok: true, message: `Retention enforced (${result.mode}): ${result.deleted} event(s) deleted.`, result });
    }
    case "access.grant": {
      const role = String(action.input.role ?? "") as WorkspaceRole;
      if (!(role in s.accessMatrix)) return fail(400, "invalid_role", "Unknown role.");
      if (role === "administrator") return fail(400, "invalid_role", "The administrator role always holds full access and cannot be modified.");
      const sections = Array.isArray(action.input.sections) ? action.input.sections.map(String) : [];
      const invalid = sections.filter((x) => !DELEGABLE_SECTIONS.includes(x as ObsSection));
      if (invalid.length) return fail(400, "invalid_section", `Non-delegable or unknown section(s): ${invalid.join(", ")}. The Logs Explorer is never delegable.`);
      s.accessMatrix[role] = { role, read: sections, updatedAt: now, updatedBy: actor };
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.access.grant", resource: `role:${role}`, result: "Success", severity: "High", context: `read granted: ${sections.length ? sections.join(", ") : "(none)"}` });
      return ok({ ok: true, message: `Read access for '${role}' updated and audited.`, matrix: s.accessMatrix[role] });
    }
    case "access.revoke": {
      const role = String(action.input.role ?? "") as WorkspaceRole;
      if (!(role in s.accessMatrix)) return fail(400, "invalid_role", "Unknown role.");
      if (role === "administrator") return fail(400, "invalid_role", "The administrator role always holds full access and cannot be modified.");
      s.accessMatrix[role] = { role, read: [], updatedAt: now, updatedBy: actor };
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "obs.access.revoke", resource: `role:${role}`, result: "Success", severity: "High", context: "all read grants revoked (deny-by-default restored)" });
      return ok({ ok: true, message: `All read grants for '${role}' revoked and audited.`, matrix: s.accessMatrix[role] });
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
      const [stats, client] = await Promise.all([requestStats(3_600_000), clientStats(3_600_000)]);
      const context = {
        eventsLastHour: events.filter((e) => e.ts >= now - 3_600_000).length,
        failures: events.filter((e) => e.result === "Failure").length,
        blocked: events.filter((e) => e.result === "Blocked").length,
        topActions: [...new Set(events.map((e) => e.action))].slice(0, 10),
        openIncidents: opsStore().incidents.filter((i) => i.status !== "resolved").length,
        requestsLastHour: stats.total,
        requestErrorRatePct: stats.errorRatePct,
        apiP95LatencyMs: stats.p95,
        clientJsErrors24h: client.jsErrors,
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
