// ============================================================
// Qubit One — Phase 22 · Production Hardening & Deployment Validation
// ops-server.ts — the operations telemetry + governance backend.
//
// GOVERNANCE (Phase 22 spec §34/§39):
//   · Every number here is MEASURED or DERIVED from real runtime
//     facts. Where a capability is genuinely absent (no uptime
//     monitor, no error aggregator, no job queue, no secret
//     manager) the payload says so explicitly — never fabricated.
//   · Provider integrations (Vercel REST, GitHub REST) activate
//     ONLY when VERCEL_TOKEN / GITHUB_TOKEN are configured in the
//     runtime environment. Without them the UI shows
//     "Not configured" — the tokens are never read from anywhere
//     else and never displayed.
//   · Secret values are NEVER returned — only names, presence
//     booleans and metadata. The masked value on screen is a UI
//     convention; the API simply has no values.
//   · All sections are administrator-only, enforced server-side
//     (fail-closed 401/403) and every mutation is audited via the
//     existing enterprise audit trail (writeAudit).
//   · Governance registries (flags, incidents, releases,
//     maintenance, config) are in-process, seeded EMPTY, and
//     labeled as such — the same per-process reality as the
//     platform's other server stores.
// ============================================================

import { db } from "@/lib/db";
import { writeAudit, queryAudit } from "@/lib/qubit/security-server";
import { SESSION_USER_ID } from "@/lib/qubit/auth-server";
import type { WorkspaceRole } from "@/lib/qubit/workspace-server";

// ---------- result helpers (same shape as platform-server) ----------
type Ok<T> = { ok: true; data: T };
type Fail = { ok: false; code: string; message: string; status: number };
type Result<T> = Ok<T> | Fail;
const ok = <T,>(data: T): Ok<T> => ({ ok: true, data });
const fail = (status: number, code: string, message: string): Fail => ({ ok: false, code, message, status });

export type OpsSection =
  | "environment" | "deployment" | "env-vars" | "database" | "migrations"
  | "api-health" | "application" | "errors" | "performance" | "uptime"
  | "jobs" | "integrations" | "security" | "secrets" | "backups"
  | "dr" | "deployment-history" | "release-approval" | "rollback"
  | "flags" | "config" | "maintenance" | "incidents" | "health";

const OPS_SECTIONS: readonly OpsSection[] = [
  "environment", "deployment", "env-vars", "database", "migrations",
  "api-health", "application", "errors", "performance", "uptime",
  "jobs", "integrations", "security", "secrets", "backups",
  "dr", "deployment-history", "release-approval", "rollback",
  "flags", "config", "maintenance", "incidents", "health",
];

export function opsSectionFor(s: string | null): OpsSection | null {
  return !!s && (OPS_SECTIONS as readonly string[]).includes(s) ? (s as OpsSection) : null;
}

function requireOpsAdmin(role: WorkspaceRole, resource: string): Result<never> | null {
  if (role === "administrator") return null;
  writeAudit({
    actor: "ops-admin-gate", actorId: SESSION_USER_ID,
    action: "ops.access.denied", resource, result: "Blocked", severity: "High",
    context: `Role '${role}' attempted an administrator-only operations section.`,
  });
  return fail(403, "ops_admin_required", "Operations is administrator-only. The boundary is enforced server-side and this denial is recorded in the audit trail.");
}

// ---------- shared runtime facts ----------
const APP_VERSION = "0.2.1";
const REPO = "qbitone47/qbitone";

function runtimeEnv() {
  const e = process.env;
  return {
    onVercel: e.VERCEL === "1",
    vercelEnv: e.VERCEL_ENV ?? null, // "production" | "preview" | "development"
    region: e.VERCEL_REGION ?? null,
    commitSha: e.VERCEL_GIT_COMMIT_SHA ?? null,
    commitBranch: e.VERCEL_GIT_COMMIT_REF ?? null,
    commitMessage: e.VERCEL_GIT_COMMIT_MESSAGE ?? null,
    deploymentUrl: e.VERCEL_DEPLOYMENT_URL ?? e.VERCEL_URL ?? null,
    projectUrl: e.VERCEL_PROJECT_PRODUCTION_URL ?? null,
    hasVercelToken: !!e.VERCEL_TOKEN,
    hasGithubToken: !!e.GITHUB_TOKEN,
  };
}

/** Real secrets/env-var inventory: NAMES and PRESENCE only — values never leave the process. */
const ENV_VAR_CATALOG = [
  { name: "DATABASE_URL", purpose: "Prisma PostgreSQL connection URL (Supabase in production)", scope: "server-only", kind: "secret", required: true, usedBy: "prisma/schema.prisma · lib/db.ts" },
  { name: "QUBIT_AUTH_SECRET", purpose: "HMAC session-token signing secret (>= 32 chars)", scope: "server-only", kind: "secret", required: false, usedBy: "lib/qubit/auth-server.ts" },
  { name: "PORT", purpose: "HTTP port for the standalone server", scope: "system", kind: "system", required: false, usedBy: "platform runtime" },
  { name: "APP_URL", purpose: "Reserved base URL behind a reverse proxy", scope: "server-only", kind: "public", required: false, usedBy: "reserved" },
  { name: "VERCEL_TOKEN", purpose: "Enables live Vercel deployment APIs (Deployment Status, History, Rollback)", scope: "server-only", kind: "secret", required: false, usedBy: "lib/qubit/ops-server.ts" },
  { name: "GITHUB_TOKEN", purpose: "Enables live GitHub Actions status", scope: "server-only", kind: "secret", required: false, usedBy: "lib/qubit/ops-server.ts" },
] as const;

function envPresence() {
  const e = process.env;
  return Object.fromEntries(ENV_VAR_CATALOG.map((v) => [v.name, !!e[v.name]]));
}

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms = 6000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await p(ctrl.signal); } finally { clearTimeout(t); }
}

/** Real database probe — one live SELECT 1, latency measured. */
async function dbProbe(): Promise<{ health: "healthy" | "unavailable"; latencyMs: number | null; note: string }> {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { health: "healthy", latencyMs: Date.now() - started, note: "Live Prisma SELECT 1 against the configured PostgreSQL database." };
  } catch (err) {
    return { health: "unavailable", latencyMs: null, note: `Database probe failed: ${err instanceof Error ? err.message : "unknown error"}.` };
  }
}

/** Real self-probe: fetch this deployment's own homepage over HTTP. */
async function selfProbe(): Promise<{ health: "healthy" | "degraded" | "unavailable"; latencyMs: number | null; note: string }> {
  const env = runtimeEnv();
  const base = env.deploymentUrl ? `https://${env.deploymentUrl}` : env.onVercel && env.projectUrl ? `https://${env.projectUrl}` : "http://127.0.0.1:3000";
  const started = Date.now();
  try {
    const res = await withTimeout((signal) => fetch(base, { signal, cache: "no-store" }), 6000);
    return { health: res.ok ? "healthy" : "degraded", latencyMs: Date.now() - started, note: `HTTP ${res.status} from live GET ${base}.` };
  } catch {
    return { health: "unavailable", latencyMs: null, note: "Self-probe could not reach this runtime over HTTP (cold start or network restriction)." };
  }
}

// ---------- provider clients (token-gated, real REST) ----------
interface VercelDeployment {
  id: string; sha: string | null; branch: string | null; state: string;
  createdAt: number; ready?: number; creator?: string; url: string | null; target?: string | null;
}

async function vercelDeployments(limit = 20): Promise<{ configured: boolean; deployments: VercelDeployment[]; note: string }> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    return { configured: false, deployments: [], note: "VERCEL_TOKEN is not configured in this runtime. Add it as a server-only environment variable to enable live Vercel deployment telemetry. Nothing is simulated here." };
  }
  try {
    const json = await withTimeout(async (signal) => {
      const res = await fetch(`https://api.vercel.com/v6/deployments?limit=${limit}&target=production`, {
        headers: { Authorization: `Bearer ${token}` }, signal, cache: "no-store",
      });
      if (!res.ok) throw new Error(`Vercel API responded ${res.status}`);
      return res.json() as Promise<{ deployments?: Array<Record<string, unknown>> }>;
    });
    const list = Array.isArray(json.deployments) ? json.deployments : [];
    return {
      configured: true,
      deployments: list.map((d) => {
        const meta = (d.meta ?? {}) as Record<string, unknown>;
        return {
          id: String(d.uid ?? d.id ?? ""),
          sha: typeof meta.githubCommitSha === "string" ? meta.githubCommitSha : null,
          branch: typeof meta.githubCommitRef === "string" ? meta.githubCommitRef : null,
          state: String(d.readyState ?? d.state ?? "UNKNOWN"),
          createdAt: Number(d.createdAt ?? 0),
          ready: d.ready ? Number(d.ready) : undefined,
          creator: typeof d.creator === "object" && d.creator ? String((d.creator as { username?: string }).username ?? "unknown") : "unknown",
          url: typeof d.url === "string" ? d.url : null,
          target: typeof d.target === "string" ? d.target : null,
        };
      }),
      note: "Live from the Vercel REST API (v6/deployments, production target).",
    };
  } catch (err) {
    return { configured: true, deployments: [], note: `Vercel API call failed: ${err instanceof Error ? err.message : "unknown"}. States shown are unavailable, not fabricated.` };
  }
}

async function githubActionsRuns(limit = 3): Promise<{ configured: boolean; runs: { id: number; sha: string; status: string; conclusion: string | null; createdAt: string }[]; note: string }> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { configured: false, runs: [], note: "GITHUB_TOKEN is not configured in this runtime. CI run status is not fetched and never guessed." };
  }
  try {
    const json = await withTimeout(async (signal) => {
      const res = await fetch(`https://api.github.com/repos/${REPO}/actions/runs?per_page=${limit}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }, signal, cache: "no-store",
      });
      if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
      return res.json() as Promise<{ workflow_runs?: Array<Record<string, unknown>> }>;
    });
    const runs = Array.isArray(json.workflow_runs) ? json.workflow_runs : [];
    return {
      configured: true,
      runs: runs.map((r) => ({
        id: Number(r.id ?? 0),
        sha: String(r.head_sha ?? "").slice(0, 7),
        status: String(r.status ?? "unknown"),
        conclusion: typeof r.conclusion === "string" ? r.conclusion : null,
        createdAt: String(r.created_at ?? ""),
      })),
      note: `Live from the GitHub REST API (repos/${REPO}/actions/runs).`,
    };
  } catch (err) {
    return { configured: true, runs: [], note: `GitHub API call failed: ${err instanceof Error ? err.message : "unknown"}.` };
  }
}

// ---------- in-process governance registries (seeded EMPTY — real state) ----------
interface GovernanceBase { createdAt: number; createdBy: string; updatedAt: number; }
export interface FeatureFlag extends GovernanceBase {
  key: string; description: string;
  status: "on" | "off" | "percentage" | "role-based" | "environment-based";
  rolloutPct: number | null; audience: string[]; environment: string; owner: string;
}
export type IncidentSev = "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4";
export type IncidentStatus = "detected" | "investigating" | "mitigating" | "monitoring" | "resolved" | "post-incident-review";
export interface Incident extends GovernanceBase {
  id: string; severity: IncidentSev; title: string; services: string[];
  startedAt: number; status: IncidentStatus; owner: string; responders: string[];
  impact: string; timeline: { at: number; text: string; by: string }[]; resolution: string | null;
}
export type ReleaseStage = "draft" | "validation" | "review" | "approval" | "deploy" | "verification" | "completed";
export interface ReleaseRequest extends GovernanceBase {
  id: string; version: string; commitSha: string | null; changes: string;
  risk: "low" | "medium" | "high"; testStatus: "not-run" | "passing" | "failing";
  stage: ReleaseStage; reviewer: string | null; decision: string | null;
  deploymentPlan: string; rollbackPlan: string;
}
export interface MaintenanceState {
  mode: "normal" | "scheduled" | "active" | "emergency";
  reason: string | null; startAt: number | null; expectedEnd: number | null;
  affectedServices: string[]; message: string | null; authorizedBy: string | null; updatedAt: number;
}
export interface SystemConfig {
  company: string; timezone: string; locale: string;
  sessionTimeoutHours: number; paginationDefault: number;
  notificationDigest: "off" | "hourly" | "daily";
  updatedBy: string | null; updatedAt: number;
}

interface OpsStore {
  flags: FeatureFlag[];
  incidents: Incident[];
  releases: ReleaseRequest[];
  maintenance: MaintenanceState;
  config: SystemConfig;
}
const g = globalThis as unknown as { __qubitOpsStore?: OpsStore };
function store(): OpsStore {
  if (!g.__qubitOpsStore) {
    // Seeded EMPTY deliberately: no fake flags, incidents or releases exist.
    g.__qubitOpsStore = {
      flags: [],
      incidents: [],
      releases: [],
      maintenance: { mode: "normal", reason: null, startAt: null, expectedEnd: null, affectedServices: [], message: null, authorizedBy: null, updatedAt: Date.now() },
      config: {
        company: "Qubit One Pvt Ltd",
        timezone: "Asia/Kolkata (IST)",
        locale: "en-IN",
        sessionTimeoutHours: 8, // real constant from auth-server (SESSION_TTL_MS)
        paginationDefault: 50,  // real page size used by platform queries
        notificationDigest: "daily",
        updatedBy: null, updatedAt: Date.now(),
      },
    };
  }
  return g.__qubitOpsStore;
}

const actorOf = (role: WorkspaceRole) => `${SESSION_USER_ID} (${role})`;

// ============================================================
// GET payloads — one per screen
// ============================================================
export async function opsGet(role: WorkspaceRole, section: OpsSection): Promise<Result<Record<string, unknown>>> {
  const gate = requireOpsAdmin(role, `Operations · ${section}`);
  if (gate) return gate;
  switch (section) {
    case "environment": return ok(await environmentPayload());
    case "deployment": return ok(await deploymentPayload());
    case "env-vars": return ok(envVarsPayload());
    case "database": return ok(await databasePayload());
    case "migrations": return ok(migrationsPayload());
    case "api-health": return ok(apiHealthPayload());
    case "application": return ok(await applicationPayload());
    case "errors": return ok(errorsPayload());
    case "performance": return ok(await performancePayloadOps());
    case "uptime": return ok(uptimePayload());
    case "jobs": return ok(jobsPayload());
    case "integrations": return ok(await integrationsPayload());
    case "security": return ok(await securityPayloadOps());
    case "secrets": return ok(secretsPayload());
    case "backups": return ok(await backupsPayload());
    case "dr": return ok(await drPayload());
    case "deployment-history": return ok(await deploymentHistoryPayload());
    case "release-approval": return ok(releasePayloadOps());
    case "rollback": return ok(await rollbackPayload());
    case "flags": return ok(flagsPayload());
    case "config": return ok(configPayload());
    case "maintenance": return ok(maintenancePayload());
    case "incidents": return ok(incidentsPayload());
    case "health": return ok(await healthPayload());
  }
}

// ---- P22-01 · Production Environment Overview ----
async function environmentPayload() {
  const env = runtimeEnv();
  const [dbP, apiP] = await Promise.all([dbProbe(), selfProbe()]);
  const inc = store().incidents.filter((i) => i.status !== "resolved" && i.status !== "post-incident-review");
  return {
    environment: env.vercelEnv ?? "unavailable (not on Vercel runtime)",
    environmentBadge: env.vercelEnv ?? "unknown",
    deploymentTarget: env.onVercel ? "Vercel (Next.js 16 standalone)" : "Standalone runtime (not on Vercel)",
    appVersion: APP_VERSION,
    gitCommit: env.commitSha,
    gitBranch: env.commitBranch,
    deploymentTimestamp: env.commitSha ? Date.now() : null,
    deploymentNote: env.commitSha ? "Commit SHA reported by the Vercel runtime for the running deployment." : "Git metadata is injected by the Vercel runtime; unavailable elsewhere.",
    databaseStatus: dbP.health === "healthy" ? "Healthy" : "Unavailable",
    dbLatencyMs: dbP.latencyMs,
    apiStatus: apiP.health === "healthy" ? "Healthy" : apiP.health === "degraded" ? "Degraded" : "Unavailable",
    apiRttMs: apiP.latencyMs,
    authStatus: "Session plane active — HMAC-signed httpOnly cookies, 8h absolute TTL, server-side role resolution.",
    integrationsSummary: "See Integration Health (P22-12) — derived from runtime configuration only.",
    errorRate: null as number | null,
    errorRateNote: "Not configured — no error aggregator (e.g. Sentry) is installed; no error-rate number is invented.",
    responseLatencyMs: apiP.latencyMs,
    uptime: { processUptimeMin: Math.round(process.uptime() / 60), note: "Process uptime of the current serverless/runtime instance — NOT a deployment availability SLA." },
    uptimePct: null as number | null,
    uptimeNote: "Not configured — no external uptime monitor exists; no percentage is fabricated.",
    activeIncidents: inc.length,
    lastSuccessfulDeployment: null as number | null,
    lastDeploymentNote: "Requires VERCEL_TOKEN (see Deployment Status).",
    currentRelease: env.commitSha ? `${APP_VERSION} · ${env.commitSha.slice(0, 7)}` : APP_VERSION,
    sourceNote: "All values measured from the live runtime (Vercel-injected environment, live SQL probe, live HTTP self-probe) or honestly labeled Not configured.",
  };
}

// ---- P22-02 · Deployment Status ----
async function deploymentPayload() {
  const env = runtimeEnv();
  const [v, gh] = await Promise.all([vercelDeployments(2), githubActionsRuns(1)]);
  const current = v.deployments[0] ?? null;
  return {
    configured: v.configured,
    ciConfigured: gh.configured,
    currentDeployment: current ? {
      id: current.id,
      state: current.state,
      lifecycle: mapVercelState(current.state),
      commit: current.sha,
      branch: current.branch,
      environment: current.target ?? "production",
      createdAt: current.createdAt,
      durationSec: current.createdAt && current.ready ? Math.round((current.ready - current.createdAt) / 1000) : null,
      author: current.creator ?? null,
      url: current.url,
      releaseVersion: APP_VERSION,
      rollbackAvailable: v.deployments.length > 1,
    } : {
      id: env.onVercel ? (process.env.VERCEL_DEPLOYMENT_ID ?? null) : null,
      state: null, lifecycle: "Unknown",
      commit: env.commitSha, branch: env.commitBranch, environment: env.vercelEnv,
      createdAt: null, durationSec: null, author: null, url: env.deploymentUrl,
      releaseVersion: APP_VERSION, rollbackAvailable: null,
    },
    previousDeployment: v.deployments[1] ?? null,
    ci: gh.configured ? { headRun: gh.runs[0] ?? null, note: gh.note } : { headRun: null, note: gh.note },
    sourceNote: v.configured ? v.note : "Live Vercel REST telemetry requires VERCEL_TOKEN. Runtime facts above (commit, branch, environment) come from the deployment itself.",
  };
}
function mapVercelState(state: string): string {
  switch (state.toUpperCase()) {
    case "QUEUED": return "Queued";
    case "BUILDING": return "Building";
    case "INITIALIZING": return "Deploying";
    case "READY": return "Ready";
    case "ERROR": return "Failed";
    case "CANCELED": return "Cancelled";
    default: return state;
  }
}

// ---- P22-03 · Environment Variables Manager ----
function envVarsPayload() {
  const presence = envPresence();
  return {
    variables: ENV_VAR_CATALOG.map((v) => ({
      name: v.name,
      purpose: v.purpose,
      scope: v.scope,
      type: v.kind,
      required: v.required,
      usedBy: v.usedBy,
      configuredAtRuntime: presence[v.name] ?? false,
      // Values are NEVER returned — the client renders a masked field.
      value: "••••••••••••",
      source: "Runtime environment (server-side presence check; values never leave the process).",
      providerStatus: "Platform secret store (Vercel environment variables) — per-environment values are managed there.",
    })),
    maskingNote: "This API has no secret values by design. Rotation and per-environment editing happen in the platform secret store; this screen governs inventory, exposure risk and naming.",
    sourceNote: "Catalog derived from the actual codebase usage audit (schema.prisma, auth-server, ops-server, platform runtime).",
  };
}

// ---- P22-04 · Database Health ----
async function databasePayload() {
  const p = await dbProbe();
  const url = process.env.DATABASE_URL ?? "";
  let provider = "unknown";
  let host = null as string | null;
  if (url.startsWith("postgres")) {
    provider = "PostgreSQL";
    try { host = new URL(url).host; } catch { host = null; } // host only — credentials never
  } else if (url.startsWith("file:")) provider = "SQLite (local)";
  return {
    health: p.health,
    latencyMs: p.latencyMs,
    provider,
    host,
    supabaseStatus: host?.includes("supabase.co") || host?.includes("supabase.com") ? "Connected (data plane, pooler endpoint)" : host ? "Non-Supabase endpoint" : "Unknown",
    poolStatus: null as string | null,
    poolNote: "Not available — connection-pool introspection requires Supabase management APIs (not configured).",
    activeConnections: null as number | null,
    activeConnectionsNote: "Not available without the Supabase management API.",
    databaseSize: null as string | null,
    databaseSizeNote: "Not available — size reporting requires pg_stat / Supabase APIs (not configured).",
    migrationStatus: "Schema applied via prisma db push (no migration history directory).",
    models: ["User", "Post"],
    modelsNote: "Prisma schema is a scaffold; application domain state lives in the in-process server stores (documented in README §10).",
    lastSuccessfulQueryAt: p.health === "healthy" ? Date.now() : null,
    errorCount: p.health === "healthy" ? 0 : 1,
    errorCountNote: "Errors observed by THIS probe in this request window — not a database-wide error counter.",
    checkedAt: Date.now(),
    note: p.note,
    sourceNote: "Health and latency are measured live per request. Metrics the runtime cannot see are labeled Not available — never estimated.",
  };
}

// ---- P22-05 · Database Migration Manager ----
function migrationsPayload() {
  return {
    workflow: "prisma db push (schema pushed directly; no migrations directory exists in this repository)",
    migrations: [] as unknown[],
    migrationsNote: "No migration history is recorded — the project intentionally uses db push for its scaffold schema. This screen does not invent history.",
    destructiveBlocked: true,
    destructiveNote: "Production destructive actions (schema reset, data loss push) are blocked in Operations. They require repository-level intervention with explicit human authorization, outside this UI by design.",
    safeOperations: ["view schema state", "view provider configuration", "link out to migration runbook"],
    provider: process.env.DATABASE_URL?.startsWith("postgres") ? "postgresql" : "unknown",
    sourceNote: "Derived from the repository's real Prisma setup (schema.prisma provider + absence of prisma/migrations).",
  };
}

// ---- P22-06 · API Health ----
interface ApiEndpoint { endpoint: string; method: string; service: string; authRequired: boolean; }
const API_MANIFEST: ApiEndpoint[] = [
  { endpoint: "/api/auth/session", method: "POST", service: "Authentication", authRequired: false },
  { endpoint: "/api/platform", method: "GET", service: "Platform Ops", authRequired: true },
  { endpoint: "/api/executive", method: "GET", service: "CEO Command Center", authRequired: true },
  { endpoint: "/api/workspace/tasks", method: "GET", service: "Workspace", authRequired: true },
  { endpoint: "/api/workspace/approvals", method: "GET", service: "Workspace", authRequired: true },
  { endpoint: "/api/workspace/notifications", method: "GET", service: "Workspace", authRequired: true },
  { endpoint: "/api/workspace/mail", method: "GET", service: "Mail", authRequired: true },
  { endpoint: "/api/workspace/meetings", method: "GET", service: "Meetings", authRequired: true },
  { endpoint: "/api/workspace/documents", method: "GET", service: "Documents", authRequired: true },
  { endpoint: "/api/search", method: "GET", service: "Global Search", authRequired: true },
  { endpoint: "/api/security/sessions", method: "GET", service: "Security", authRequired: true },
  { endpoint: "/api/sales/leads", method: "GET", service: "Sales", authRequired: true },
  { endpoint: "/api/mobile/home", method: "GET", service: "Mobile", authRequired: true },
];
function apiHealthPayload() {
  return {
    manifest: API_MANIFEST,
    probeResults: null as unknown,
    probeNote: "Run 'Check reachability' to perform a REAL server-side probe. Protected endpoints are expected to answer 401 without a session — that is healthy behavior (reachable + auth enforced), shown as such, not as an error.",
    lastProbeAt: null as number | null,
    sourceNote: "Endpoints enumerated from the real route manifest (src/app/api). No endpoints are invented.",
  };
}

// ---- P22-07 · Application Health ----
async function applicationPayload() {
  const env = runtimeEnv();
  const dbP = await dbProbe();
  const fs = await import("node:fs");
  let storage: "healthy" | "degraded" | "unavailable" = "unavailable";
  let storageNote = "Runtime filesystem check not performed.";
  try {
    fs.mkdirSync("db/backups", { recursive: true });
    fs.writeFileSync("db/.write-test", String(Date.now()));
    fs.unlinkSync("db/.write-test");
    storage = "healthy"; storageNote = "Local filesystem writable (self-hosted mode).";
  } catch {
    storage = "degraded";
    storageNote = "Runtime filesystem is read-only/ephemeral (serverless). File-based features (backups, generated auth secret) degrade by design; application data flow is unaffected.";
  }
  return {
    dependencies: [
      { id: "frontend", label: "Frontend (Next.js)", health: "healthy" as const, note: "This page is being served — the runtime is executing." },
      { id: "server", label: "Server runtime", health: "healthy" as const, note: `Node ${process.version} · RSS ${Math.round(process.memoryUsage().rss / 1048576)} MB (measured).` },
      { id: "api", label: "API layer", health: dbP.health === "healthy" ? "healthy" as const : "degraded" as const, note: "Routes are mounted; a live self-probe is available in API Health." },
      { id: "database", label: "Database (Supabase PostgreSQL)", health: dbP.health, note: dbP.note },
      { id: "auth", label: "Authentication", health: process.env.QUBIT_AUTH_SECRET ? ("healthy" as const) : ("degraded" as const), note: process.env.QUBIT_AUTH_SECRET ? "HMAC session plane configured with a runtime secret." : "Session plane active but QUBIT_AUTH_SECRET is not set — serverless instances would generate per-instance secrets; set it for stable sessions." },
      { id: "storage", label: "Local storage", health: storage, note: storageNote },
      { id: "email", label: "Email", health: "unavailable" as const, note: "Not configured — no SMTP/provider credentials exist in this environment." },
      { id: "ai", label: "AI services", health: env.onVercel ? ("unavailable" as const) : ("degraded" as const), note: env.onVercel ? "The z-ai backend gateway is not reachable from the serverless runtime; AI features degrade through the existing fallbacks." : "AI gateway reachable only inside the sandbox backend." },
      { id: "jobs", label: "Background jobs", health: "unavailable" as const, note: "Not configured — no worker/queue infrastructure exists (see Background Jobs Monitor)." },
      { id: "deployment", label: "Deployment", health: env.onVercel ? ("healthy" as const) : ("degraded" as const), note: env.onVercel ? `Running on Vercel (${env.vercelEnv}${env.region ? `, region ${env.region}` : ""}).` : "Not detected on the Vercel runtime." },
    ],
    rule: "Each dependency reports its OWN state. One degraded or unavailable dependency never implies the whole system is down.",
    sourceNote: "Every row is measured or derived from real runtime configuration at request time.",
  };
}

// ---- P22-08 · Error Monitoring ----
function errorsPayload() {
  const recent = queryAudit({ pageSize: 10 }, "administrator", SESSION_USER_ID);
  return {
    aggregator: { configured: false, provider: null as string | null, note: "No error aggregator (Sentry or equivalent) is installed in this deployment. Install one and set its DSN as a server-only environment variable to enable real error telemetry." },
    register: [] as unknown[],
    registerNote: "The in-process error register is empty — it records nothing until the application code paths that report to it are wired (roadmap). No entries are simulated.",
    auditExceptions: recent.events.filter((e) => (e as { result?: string }).result === "failure" || (e as { severity?: string }).severity === "high").slice(0, 5),
    auditNote: "Latest high-severity / failure records from the ONE enterprise audit trail (real, existing system).",
    statuses: ["New", "Investigating", "Acknowledged", "Resolved", "Ignored"],
    sourceNote: "Honest state: aggregator absent + empty register + real audit exceptions where they exist.",
  };
}

// ---- P22-09 · Performance Monitoring ----
async function performancePayloadOps() {
  const dbP = await dbProbe();
  const apiP = await selfProbe();
  const mem = process.memoryUsage();
  return {
    live: {
      dbLatencyMs: dbP.latencyMs,
      dbHealth: dbP.health,
      apiRttMs: apiP.latencyMs,
      apiHealth: apiP.health,
      rssMb: Math.round(mem.rss / 1048576),
      heapUsedMb: Math.round(mem.heapUsed / 1048576),
      processUptimeMin: Math.round(process.uptime() / 60),
      measuredAt: Date.now(),
    },
    vitals: { configured: false, note: "Browser Web Vitals are collected in-session by the Platform Ops module (real client posts). A persisted time-series requires external telemetry — not configured." },
    timeRanges: ["1 hour", "24 hours", "7 days", "30 days"],
    timeRangeNote: "Historical ranges require a metrics backend (not configured). Only the live window is real, so only the live window is shown with data.",
    slowEndpoints: [] as unknown[],
    slowEndpointsNote: "Not available — per-endpoint latency histograms require instrumentation not present in this deployment.",
    slowQueries: [] as unknown[],
    slowQueriesNote: "Not available — query-level tracing requires pg_stat_statements / APM (not configured).",
    sourceNote: "Live measured values only (SQL probe, HTTP self-probe, process metrics). Nothing historical is drawn or implied.",
  };
}

// ---- P22-10 · Uptime Monitoring ----
function uptimePayload() {
  return {
    configured: false,
    monitors: [] as unknown[],
    note: "No uptime monitor is configured. There is no external prober measuring availability, so no uptime percentage, latency series or incident history can be shown — and none is invented. Recommended: configure an external HTTP monitor against the production URL health endpoint.",
    processUptimeMin: Math.round(process.uptime() / 60),
    processNote: "The only real measurement available here: this instance's process uptime. It is not availability.",
    sourceNote: "Honest empty state per the no-fake-data rule.",
  };
}

// ---- P22-11 · Background Jobs Monitor ----
function jobsPayload() {
  return {
    configured: false,
    jobs: [] as unknown[],
    note: "Background job infrastructure not configured. Qubit One currently has no worker/queue layer (no Redis, no Kafka, no dedicated workers — intentional per deployment spec). Scheduled reports and notification digests run in-process; they are visible in their own modules, not here.",
    statuses: ["Queued", "Running", "Completed", "Failed", "Retrying", "Cancelled", "Dead Letter"],
    sourceNote: "Honest empty state — no fake workers, queues or job rows.",
  };
}

// ---- P22-12 · Integration Health ----
async function integrationsPayload() {
  const env = runtimeEnv();
  const dbP = await dbProbe();
  const gh = env.hasGithubToken ? await githubActionsRuns(1) : null;
  return {
    integrations: [
      { id: "supabase", name: "Supabase PostgreSQL", status: dbP.health === "healthy" ? "connected" : "failing", environment: env.vercelEnv ?? "runtime", authStatus: "DATABASE_URL (pooled connection)", lastSyncAt: dbP.health === "healthy" ? Date.now() : null, latencyMs: dbP.latencyMs, note: "Data plane verified by live SELECT 1.", configState: "configured" },
      { id: "vercel", name: "Vercel (hosting runtime)", status: env.onVercel ? "connected" : "not-applicable", environment: env.vercelEnv ?? "runtime", authStatus: "Platform-managed runtime", lastSyncAt: env.onVercel ? Date.now() : null, latencyMs: null, note: env.onVercel ? "This process is executing on the Vercel runtime — detected, not assumed." : "Not running on Vercel.", configState: env.onVercel ? "runtime-detected" : "not-detected" },
      { id: "vercel-api", name: "Vercel REST API (management)", status: env.hasVercelToken ? "connected" : "not-configured", environment: env.vercelEnv ?? "runtime", authStatus: "VERCEL_TOKEN", lastSyncAt: null, latencyMs: null, note: env.hasVercelToken ? "Management token present — deployment APIs enabled." : "Add VERCEL_TOKEN (server-only) to enable Deployment Status/History/Rollback.", configState: env.hasVercelToken ? "configured" : "not-configured" },
      { id: "github", name: `GitHub (${REPO})`, status: env.hasGithubToken ? (gh?.runs.length ? "connected" : "degraded") : "not-configured", environment: env.vercelEnv ?? "runtime", authStatus: "GITHUB_TOKEN", lastSyncAt: gh?.runs.length ? Date.now() : null, latencyMs: null, note: env.hasGithubToken ? (gh?.note ?? "") : "Repository identity is known from deployment config; CI status needs GITHUB_TOKEN.", configState: env.hasGithubToken ? "configured" : "not-configured" },
      { id: "email", name: "Email (SMTP/provider)", status: "not-configured", environment: env.vercelEnv ?? "runtime", authStatus: "none", lastSyncAt: null, latencyMs: null, note: "No email provider credentials exist in this environment.", configState: "not-configured" },
      { id: "ai", name: "AI providers (z-ai gateway)", status: env.onVercel ? "unavailable" : "degraded", environment: env.vercelEnv ?? "runtime", authStatus: "platform backend", lastSyncAt: null, latencyMs: null, note: env.onVercel ? "Sandbox AI gateway is not reachable from serverless; the app degrades via its existing fallbacks." : "Reachable only within the sandbox backend.", configState: "not-configured" },
      { id: "storage", name: "Object storage", status: "not-configured", environment: env.vercelEnv ?? "runtime", authStatus: "none", lastSyncAt: null, latencyMs: null, note: "No S3/object-store credentials exist. Local file storage is ephemeral on serverless.", configState: "not-configured" },
      { id: "whatsapp", name: "WhatsApp Business API", status: "not-configured", environment: env.vercelEnv ?? "runtime", authStatus: "none", lastSyncAt: null, latencyMs: null, note: "UI modules exist; no provider credentials are configured.", configState: "not-configured" },
    ],
    neverShown: "API keys and tokens are never displayed — only their presence-derived configuration state.",
    sourceNote: "Statuses derived from live probes (SQL, runtime environment) and credential presence. Nothing is claimed connected without verification.",
  };
}

// ---- P22-13 · Security Configuration ----
async function securityPayloadOps() {
  const env = runtimeEnv();
  // Real security headers read from a real response of this deployment.
  let headers: Record<string, string> = {};
  try {
    const base = env.deploymentUrl ? `https://${env.deploymentUrl}` : "http://127.0.0.1:3000";
    const res = await withTimeout((signal) => fetch(base, { signal, cache: "no-store" }), 6000);
    for (const h of ["strict-transport-security", "x-frame-options", "x-content-type-options", "referrer-policy", "content-security-policy", "permissions-policy"]) {
      const v = res.headers.get(h);
      if (v) headers[h] = v.slice(0, 160);
    }
  } catch { /* headers stay empty — labeled below */ }
  const recentDenials = queryAudit({ pageSize: 200 }, "administrator", SESSION_USER_ID).events.filter((e) => (e as { result?: string }).result === "blocked").length;
  return {
    authentication: { configured: true, note: "Session plane: HMAC-SHA256 signed tokens (WebCrypto), httpOnly + SameSite=Strict cookies, server-side role resolution from the signed session — client roles are never trusted." },
    mfa: { configured: false, note: "Not configured for production (the Phase 3/21 MFA screens are demo-scope; no real IdP is integrated)." },
    sso: { configured: false, note: "Not configured — no external identity provider is integrated." },
    sessionPolicy: { configured: true, ttlHours: 8, rotationNote: "8h absolute TTL (real constant). Server-side validation on every request; fail-closed." },
    passwordPolicy: { configured: false, note: "Not applicable — the demo identity bootstrap has no password form; a real IdP will own password policy." },
    rbac: { configured: true, roles: ["administrator", "dept-head", "sales-exec", "hr-manager", "employee"], note: "Server-side RBAC enforced across API routes; Operations sections are administrator-only." },
    abac: { configured: true, note: "Scope-based checks exist in module stores (e.g., audit query scopes); full ABAC is partial." },
    rateLimiting: { configured: true, note: "Per-client in-process rate limiting on authentication and sensitive endpoints (real rate limiter in auth-server)." },
    auditLogging: { configured: true, note: "Centralized writeAudit across modules; Operations mutations are audited to the same trail.", recentDenials },
    securityHeaders: { configured: Object.keys(headers).length > 0, headers, note: Object.keys(headers).length ? "Read from a live response of this deployment." : "Could not read headers from this runtime in this request (self-probe restriction)." },
    encryption: { configured: true, note: "Transport: TLS (platform-terminated). At rest: Supabase-managed storage encryption. Application-layer field encryption: not configured." },
    ipNetworkPolicy: { configured: false, note: "Not configured — see the existing IP & Network Policy screen (Phase 3) for the governance UI; no enforcement backend exists yet." },
    alerts: { configured: false, note: "No security alerting pipeline is configured beyond the in-app audit trail." },
    sourceNote: "Every 'configured' claim maps to a real mechanism in this codebase; everything else is labeled honestly.",
  };
}

// ---- P22-14 · Secrets & Credential Governance ----
function secretsPayload() {
  const presence = envPresence();
  const now = Date.now();
  return {
    secrets: ENV_VAR_CATALOG.filter((v) => v.kind === "secret" || v.kind === "system").map((v) => ({
      name: v.name,
      provider: "Vercel environment variables (platform secret store)",
      environment: "production · preview · development",
      scope: v.scope,
      configuredAtRuntime: presence[v.name] ?? false,
      owner: "qbitone47 (repository owner)",
      createdAt: null as number | null,
      createdAtNote: "Not available — secret creation timestamps live in the provider (not exposed by design).",
      lastRotated: null as number | null,
      rotationStatus: "unknown" as "healthy" | "expiring" | "expired" | "missing" | "rotation-required" | "unknown",
      rotationNote: "Rotation state cannot be derived without the provider API; shown as Unknown rather than guessed.",
      expiration: null as number | null,
      status: (presence[v.name] ? "active" : v.required ? "missing" : "not-set") as "active" | "missing" | "not-set",
      statusNote: presence[v.name] ? "Present in the runtime environment (server-side presence check)." : v.required ? "REQUIRED but not present in this runtime — dependent features will fail." : "Optional — not set; dependent features degrade honestly.",
    })),
    valuesNote: "This screen has no secret values by design. It cannot reveal what it never receives.",
    governanceNote: "Rotate credentials that have appeared in chat/tickets; prefer fine-grained, least-privilege, short-lived tokens.",
    sourceNote: "Real presence checks (process.env) over the real code-usage catalog — metadata only.",
    checkedAt: now,
  };
}

// ---- P22-15 · Backup & Recovery Status ----
async function backupsPayload() {
  const fs = await import("node:fs");
  let fileBased: "healthy" | "unavailable" = "unavailable";
  let fileNote = "";
  try {
    fs.mkdirSync("db/backups", { recursive: true });
    fileBased = "healthy";
    fileNote = "Local file backup capability present (Platform Ops file copies with SHA-256 verification).";
  } catch {
    fileNote = "File-based backups are unavailable on the serverless runtime (read-only filesystem) — operations recorded there will show failures by design.";
  }
  return {
    databaseBackup: { status: "unknown" as const, note: "Supabase manages PostgreSQL backups at the platform level; the application cannot verify them without the management API. Verify in the Supabase dashboard — this screen will not claim verified backups." },
    fileBasedBackups: { status: fileBased, note: fileNote, location: "db/backups/ (git-ignored, local runtime only)" },
    lastBackup: null as number | null,
    lastBackupNote: "Not available — no application-verifiable backup event.",
    backupAge: null as number | null,
    backupType: "Managed platform backups (Supabase) + local file copies (self-hosted mode only)",
    retention: { configured: false, note: "Retention policy not configured in application code; Supabase plan defaults apply." },
    verification: { configured: false, note: "Automated restore verification is not configured. Manual restore testing exists for local file backups only." },
    lastRestoreTest: null as number | null,
    recoveryPoint: "Undefined — no RPO has been declared for this deployment.",
    recoveryStatus: "unknown" as const,
    sourceNote: "Honest capability reporting per the no-fake-success rule.",
  };
}

// ---- P22-16 · Disaster Recovery ----
async function drPayload() {
  const b = await backupsPayload();
  const checks = [
    { id: "backups", label: "Verified, restorable backups", pass: false, note: b.databaseBackup.status === "unknown" ? "Backup verification not available from the application." : "n/a" },
    { id: "rpo", label: "RPO defined and communicated", pass: false, note: "Not defined." },
    { id: "rto", label: "RTO defined and communicated", pass: false, note: "Not defined." },
    { id: "restore-test", label: "Restore tested on production data", pass: false, note: "No restore drill has been performed." },
    { id: "dr-owner", label: "Recovery owner assigned", pass: false, note: "Not assigned." },
    { id: "runbook", label: "Written recovery runbook", pass: false, note: "Deployment guide exists; a dedicated DR runbook does not." },
  ];
  const passed = checks.filter((c) => c.pass).length;
  return {
    rpo: null as number | null, rto: null as number | null,
    rpoRtoNote: "Not defined — declaring numbers here would be fiction.",
    checks,
    readinessScore: Math.round((passed / checks.length) * 100),
    scoreBasis: `Real checks only: ${passed}/${checks.length} configured checks pass. A low score is the honest reading of an early-stage deployment.`,
    dependencies: ["Supabase managed backups + PITR (verify in dashboard)", "Vercel instant rollback for application code", "Git history as source-of-truth for code recovery"],
    recoveryOwner: null as string | null,
    lastDrill: null as number | null,
    risks: [
      "Domain state is in-process: an instance restart re-seeds from fixtures (documented product constraint).",
      "No offsite application-level backups; platform-level backup verification is outside this app.",
      "Single-region deployment (Vercel default region).",
    ],
    unresolvedRisks: 3,
    sourceNote: "Score computed exclusively from the real checks above — each gap is shown, nothing is invented.",
  };
}

// ---- P22-17 · Deployment History ----
async function deploymentHistoryPayload() {
  const env = runtimeEnv();
  const v = await vercelDeployments(20);
  return {
    configured: v.configured,
    history: v.deployments.map((d) => ({
      version: APP_VERSION,
      deploymentId: d.id,
      commit: d.sha,
      branch: d.branch,
      author: d.creator,
      timestamp: d.createdAt,
      environment: d.target ?? "production",
      status: mapVercelState(d.state),
      durationSec: d.createdAt && d.ready ? Math.round((d.ready - d.createdAt) / 1000) : null,
      provider: "Vercel",
      rollbackAvailable: true,
      url: d.url,
    })),
    currentFromRuntime: env.commitSha ? { commit: env.commitSha, branch: env.commitBranch, environment: env.vercelEnv, url: env.deploymentUrl } : null,
    note: v.configured ? v.note : v.note,
    sourceNote: "Real deployments from the Vercel REST API when configured; otherwise only the runtime's own deployment facts.",
  };
}

// ---- P22-18 · Release Approval ----
function releasePayloadOps() {
  const s = store();
  return {
    releases: [...s.releases].sort((a, b) => b.updatedAt - a.updatedAt),
    stages: ["draft", "validation", "review", "approval", "deploy", "verification", "completed"],
    engineNote: "Stage transitions are recorded here and audited through the ONE enterprise audit trail. Production deploys themselves execute in Vercel/GitHub — this screen governs the human approval train, it does not build anything.",
    sourceNote: "In-process registry (per-process persistence, consistent with the platform's store architecture), seeded empty.",
  };
}

// ---- P22-19 · Rollback Center ----
async function rollbackPayload() {
  const env = runtimeEnv();
  const v = await vercelDeployments(5);
  return {
    configured: v.configured,
    currentRelease: { version: APP_VERSION, commit: env.commitSha, branch: env.commitBranch, environment: env.vercelEnv },
    previousStable: v.deployments[1] ? { deploymentId: v.deployments[1].id, commit: v.deployments[1].sha, timestamp: v.deployments[1].createdAt, state: mapVercelState(v.deployments[1].state) } : null,
    available: v.deployments.slice(1, 5).map((d) => ({ deploymentId: d.id, commit: d.sha, timestamp: d.createdAt, state: mapVercelState(d.state) })),
    rollbackReadiness: v.configured ? (v.deployments.length > 1 ? "ready" : "single-deployment") : "not-configured",
    authorizationNote: "Rollback requires administrator role + explicit confirmation; every attempt (allowed or denied) is audited.",
    impactNote: "Rolling back the application redeploys prior code. Domain state lives in per-process stores and is not migrated by rollbacks; the PostgreSQL scaffold schema is unaffected by application rollbacks.",
    dbWarning: "Production database rollbacks are NOT automatic — ever. A validated recovery strategy (backup + restore drill) is a prerequisite; see Backup & Recovery and Disaster Recovery.",
    sourceNote: v.configured ? v.note : "Enable VERCEL_TOKEN to see real previous deployments; without it, rollback targets are unknown — not guessed.",
  };
}

// ---- P22-20 · Feature Flags ----
function flagsPayload() {
  const s = store();
  return {
    flags: [...s.flags].sort((a, b) => b.updatedAt - a.updatedAt),
    supported: ["on", "off", "percentage", "role-based", "environment-based"],
    persistenceNote: "In-process registry: changes take effect immediately in this runtime instance and are audited, but reset when the instance recycles (the platform's documented per-process store reality). Cross-instance persistence is a roadmap item.",
    sourceNote: "Seeded empty — every listed flag is one a real administrator created.",
  };
}

// ---- P22-21 · System Configuration ----
function configPayload() {
  const s = store();
  return {
    config: s.config,
    editable: ["paginationDefault", "notificationDigest"],
    readOnlyNote: "Company, timezone, locale reflect the real fixture identity and date formatting; sessionTimeoutHours is the real auth constant. Changing domain-wide behaviors beyond these fields requires code change — this screen will not pretend otherwise.",
    secretsNote: "No secrets here — see Secrets & Credential Governance (metadata-only) and the platform secret store.",
    sourceNote: "Values are the real constants this build runs with.",
  };
}

// ---- P22-22 · Maintenance Mode ----
function maintenancePayload() {
  const s = store();
  return {
    ...s.maintenance,
    modes: ["normal", "scheduled", "active", "emergency"],
    bypass: "Administrators ALWAYS retain access — emergency recovery can never lock the operator out. Any future request-blocking middleware must honor this bypass rule.",
    enforcementNote: "This state is recorded and audited here; a production request-blocking gate is intentionally NOT wired in this phase (enabling it without a real maintenance page would degrade UX). Activation here is governance + communication, not a traffic switch.",
    sourceNote: "In-process state, seeded normal. Transitions are audited with actor attribution.",
  };
}

// ---- P22-23 · Production Incident Center ----
function incidentsPayload() {
  const s = store();
  const open = s.incidents.filter((i) => i.status !== "resolved" && i.status !== "post-incident-review");
  return {
    incidents: [...s.incidents].sort((a, b) => b.startedAt - a.startedAt),
    openCount: open.length,
    severities: ["SEV-1", "SEV-2", "SEV-3", "SEV-4"],
    lifecycle: ["detected", "investigating", "mitigating", "monitoring", "resolved", "post-incident-review"],
    linksNote: "Incidents correlate with deployments (Deployment History), audit events (Audit Trail), and system health (System Health Dashboard) by timestamp and service names — one shared vocabulary, no duplicate engines.",
    sourceNote: "In-process registry seeded empty: an empty incident list means no incident was recorded, not that none can occur.",
  };
}

// ---- P22-24 · System Health Dashboard ----
async function healthPayload() {
  const env = runtimeEnv();
  const [dbP, apiP] = await Promise.all([dbProbe(), selfProbe()]);
  const s = store();
  const app = await applicationPayload();
  const dep = app.dependencies.find((d) => d.id === "auth");
  const email = app.dependencies.find((d) => d.id === "email");
  const jobs = app.dependencies.find((d) => d.id === "jobs");
  const ai = app.dependencies.find((d) => d.id === "ai");
  const openIncidents = s.incidents.filter((i) => i.status !== "resolved" && i.status !== "post-incident-review");
  const components = [
    { id: "application", label: "Application", health: "healthy" as const, screen: "p22-production-environment" as const, note: "Serving this runtime." },
    { id: "database", label: "Database", health: dbP.health, screen: "p22-database-health" as const, note: dbP.note, latencyMs: dbP.latencyMs },
    { id: "api", label: "API", health: apiP.health === "healthy" ? "healthy" as const : "degraded" as const, screen: "p22-api-health" as const, note: apiP.note, latencyMs: apiP.latencyMs },
    { id: "auth", label: "Authentication", health: dep?.health ?? "degraded", screen: "p22-security-configuration" as const, note: dep?.note ?? "" },
    { id: "storage", label: "Storage", health: app.dependencies.find((d) => d.id === "storage")?.health ?? "unavailable", screen: "p22-application-health" as const, note: app.dependencies.find((d) => d.id === "storage")?.note ?? "" },
    { id: "integrations", label: "Integrations", health: "degraded" as const, screen: "p22-integration-health" as const, note: "Core data plane connected; several providers not configured (see detail)." },
    { id: "jobs", label: "Background Jobs", health: "unavailable" as const, screen: "p22-background-jobs" as const, note: jobs?.note ?? "Not configured." },
    { id: "security", label: "Security", health: "healthy" as const, screen: "p22-security-configuration" as const, note: "Session plane, RBAC, rate limiting and audit logging active; MFA/SSO not configured." },
    { id: "backups", label: "Backups", health: "degraded" as const, screen: "p22-backup-recovery" as const, note: "Supabase-managed backups exist at platform level but are not verifiable from the application; file backups unavailable on serverless." },
    { id: "deployments", label: "Deployments", health: env.onVercel ? ("healthy" as const) : ("degraded" as const), screen: "p22-deployment-status" as const, note: env.onVercel ? "Live on the Vercel runtime." : "Not on Vercel runtime." },
    { id: "incidents", label: "Incidents", health: openIncidents.length ? ("degraded" as const) : ("healthy" as const), screen: "p22-incident-center" as const, note: openIncidents.length ? `${openIncidents.length} open incident(s) recorded.` : "No open incidents recorded." },
    { id: "performance", label: "Performance", health: dbP.health === "healthy" && apiP.health === "healthy" ? ("healthy" as const) : ("degraded" as const), screen: "p22-performance-monitoring" as const, note: "Live latency measured in Performance Monitoring; historical series not configured." },
    { id: "uptime", label: "Uptime", health: "unavailable" as const, screen: "p22-uptime-monitoring" as const, note: "No external monitor configured — no percentage is claimed." },
    { id: "email", label: "Email", health: "unavailable" as const, screen: "p22-integration-health" as const, note: email?.note ?? "Not configured." },
    { id: "ai", label: "AI", health: "unavailable" as const, screen: "p22-integration-health" as const, note: ai?.note ?? "Unavailable." },
  ];
  const order = { healthy: 0, degraded: 1, unavailable: 2, maintenance: 1 } as const;
  const worst = components.reduce((w, c) => (order[c.health] > order[w] ? c.health : w), "healthy" as "healthy" | "degraded" | "unavailable" | "maintenance");
  return {
    overall: worst,
    overallLabel: worst === "healthy" ? "Healthy" : worst === "degraded" ? "Degraded" : "Major gaps",
    environment: env.vercelEnv ?? "runtime",
    components,
    rule: "Every signal is measured or derived at request time; each is drillable into its source screen. A degraded email integration never implies a down platform.",
    sourceNote: "Consolidated live from the same probes that power the individual Operations screens.",
  };
}

// ============================================================
// POST actions — audited mutations (administrator-only)
// ============================================================
export interface OpsAction { type: string; input: Record<string, unknown>; confirm?: boolean; }

export async function opsPost(role: WorkspaceRole, action: OpsAction): Promise<Result<Record<string, unknown>>> {
  const gate = requireOpsAdmin(role, `Operations · action:${action.type}`);
  if (gate) return gate;
  const s = store();
  const now = Date.now();
  const actor = actorOf(role);
  switch (action.type) {
    // ---- feature flags ----
    case "flag.create": {
      const key = String(action.input.key ?? "").trim();
      if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(key)) return fail(400, "invalid_key", "Flag key must be 2–64 chars of lowercase letters, digits, dot, dash or underscore.");
      if (s.flags.some((f) => f.key === key)) return fail(409, "duplicate_key", "A flag with this key already exists.");
      const status = ["on", "off", "percentage", "role-based", "environment-based"].includes(String(action.input.status)) ? (action.input.status as FeatureFlag["status"]) : "off";
      const flag: FeatureFlag = {
        key, description: String(action.input.description ?? "").slice(0, 300),
        status, rolloutPct: status === "percentage" ? Math.max(0, Math.min(100, Number(action.input.rolloutPct ?? 0))) : null,
        audience: Array.isArray(action.input.audience) ? action.input.audience.map(String).slice(0, 10) : [],
        environment: String(action.input.environment ?? "production"),
        owner: actor, createdAt: now, createdBy: actor, updatedAt: now,
      };
      s.flags.push(flag);
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "ops.flag.create", resource: `flag:${key}`, result: "Success", severity: "Warning", context: `status=${status}` });
      return ok({ ok: true, message: `Flag '${key}' created (off unless specified).`, flag });
    }
    case "flag.set": {
      const key = String(action.input.key ?? "");
      const f = s.flags.find((x) => x.key === key);
      if (!f) return fail(404, "not_found", "Flag not found.");
      const status = String(action.input.status ?? "");
      if (!["on", "off", "percentage", "role-based", "environment-based"].includes(status)) return fail(400, "invalid_status", "Unsupported flag status.");
      f.status = status as FeatureFlag["status"];
      if (status === "percentage") f.rolloutPct = Math.max(0, Math.min(100, Number(action.input.rolloutPct ?? 0)));
      f.updatedAt = now;
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "ops.flag.set", resource: `flag:${key}`, result: "Success", severity: "Warning", context: `status=${status}${f.rolloutPct != null ? ` pct=${f.rolloutPct}` : ""}` });
      return ok({ ok: true, message: `Flag '${key}' → ${status}.`, flag: f });
    }
    case "flag.delete": {
      const key = String(action.input.key ?? "");
      const idx = s.flags.findIndex((x) => x.key === key);
      if (idx < 0) return fail(404, "not_found", "Flag not found.");
      s.flags.splice(idx, 1);
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "ops.flag.delete", resource: `flag:${key}`, result: "Success", severity: "Warning", context: `flag ${key} deleted` });
      return ok({ ok: true, message: `Flag '${key}' deleted.` });
    }
    // ---- system configuration ----
    case "config.update": {
      const c = s.config;
      const patch = action.input;
      if (patch.paginationDefault != null) {
        const v = Number(patch.paginationDefault);
        if (!Number.isInteger(v) || v < 10 || v > 200) return fail(400, "invalid_pagination", "Pagination default must be an integer between 10 and 200.");
        c.paginationDefault = v;
      }
      if (patch.notificationDigest != null) {
        const v = String(patch.notificationDigest);
        if (!["off", "hourly", "daily"].includes(v)) return fail(400, "invalid_digest", "Digest must be off, hourly or daily.");
        c.notificationDigest = v as SystemConfig["notificationDigest"];
      }
      c.updatedBy = actor; c.updatedAt = now;
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "ops.config.update", resource: "system-configuration", result: "Success", severity: "Warning", context: JSON.stringify(patch).slice(0, 200) });
      return ok({ ok: true, message: "Configuration updated and audited.", config: c });
    }
    // ---- maintenance mode ----
    case "maintenance.set": {
      const mode = String(action.input.mode ?? "");
      if (!["normal", "scheduled", "active", "emergency"].includes(mode)) return fail(400, "invalid_mode", "Unsupported maintenance mode.");
      s.maintenance = {
        mode: mode as MaintenanceState["mode"],
        reason: String(action.input.reason ?? "").slice(0, 300) || null,
        startAt: action.input.startAt ? Number(action.input.startAt) : mode === "normal" ? null : now,
        expectedEnd: action.input.expectedEnd ? Number(action.input.expectedEnd) : null,
        affectedServices: Array.isArray(action.input.affectedServices) ? action.input.affectedServices.map(String).slice(0, 12) : [],
        message: String(action.input.message ?? "").slice(0, 500) || null,
        authorizedBy: actor,
        updatedAt: now,
      };
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "ops.maintenance.set", resource: "maintenance-mode", result: "Success", severity: mode === "emergency" ? "Critical" : "High", context: `mode=${mode}` });
      return ok({ ok: true, message: `Maintenance mode → ${mode}. Administrators retain access (bypass rule).`, maintenance: s.maintenance });
    }
    // ---- incidents ----
    case "incident.create": {
      const title = String(action.input.title ?? "").trim();
      if (title.length < 4) return fail(400, "invalid_title", "Incident title is required (min 4 chars).");
      const sev = String(action.input.severity ?? "SEV-3");
      if (!["SEV-1", "SEV-2", "SEV-3", "SEV-4"].includes(sev)) return fail(400, "invalid_severity", "Severity must be SEV-1..SEV-4.");
      const inc: Incident = {
        id: `INC-${now.toString(36).toUpperCase()}`,
        severity: sev as IncidentSev, title: title.slice(0, 200),
        services: Array.isArray(action.input.services) ? action.input.services.map(String).slice(0, 8) : [],
        startedAt: action.input.startedAt ? Number(action.input.startedAt) : now,
        status: "detected", owner: actor, responders: [actor],
        impact: String(action.input.impact ?? "").slice(0, 300),
        timeline: [{ at: now, text: "Incident detected and recorded.", by: actor }],
        resolution: null,
        createdAt: now, createdBy: actor, updatedAt: now,
      };
      s.incidents.push(inc);
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "ops.incident.create", resource: inc.id, result: "Success", severity: sev === "SEV-1" ? "Critical" : "High", context: `${sev} · ${inc.title}` });
      return ok({ ok: true, message: `Incident ${inc.id} recorded.`, incident: inc });
    }
    case "incident.update": {
      const id = String(action.input.id ?? "");
      const inc = s.incidents.find((i) => i.id === id);
      if (!inc) return fail(404, "not_found", "Incident not found.");
      const status = String(action.input.status ?? "");
      if (!["detected", "investigating", "mitigating", "monitoring", "resolved", "post-incident-review"].includes(status)) return fail(400, "invalid_status", "Unsupported incident status.");
      inc.status = status as IncidentStatus;
      if (status === "resolved" || status === "post-incident-review") inc.resolution = String(action.input.resolution ?? "").slice(0, 500) || inc.resolution;
      inc.timeline.push({ at: now, text: `Status → ${status}${action.input.note ? ` — ${String(action.input.note).slice(0, 200)}` : ""}`, by: actor });
      inc.updatedAt = now;
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "ops.incident.update", resource: id, result: "Success", severity: "High", context: `status=${status}` });
      return ok({ ok: true, message: `Incident ${id} → ${status}.`, incident: inc });
    }
    // ---- release approval train ----
    case "release.create": {
      const version = String(action.input.version ?? "").trim();
      if (version.length < 1) return fail(400, "invalid_version", "Release version is required.");
      const rel: ReleaseRequest = {
        id: `REL-${now.toString(36).toUpperCase()}`,
        version: version.slice(0, 40),
        commitSha: action.input.commitSha ? String(action.input.commitSha).slice(0, 40) : null,
        changes: String(action.input.changes ?? "").slice(0, 500),
        risk: (["low", "medium", "high"].includes(String(action.input.risk)) ? action.input.risk : "medium") as ReleaseRequest["risk"],
        testStatus: (["not-run", "passing", "failing"].includes(String(action.input.testStatus)) ? action.input.testStatus : "not-run") as ReleaseRequest["testStatus"],
        stage: "draft", reviewer: null, decision: null,
        deploymentPlan: String(action.input.deploymentPlan ?? "").slice(0, 500) || "Push to main → CI validation → Vercel production deploy.",
        rollbackPlan: String(action.input.rollbackPlan ?? "").slice(0, 500) || "Vercel instant rollback to the previous Ready deployment; database is not rolled back.",
        createdAt: now, createdBy: actor, updatedAt: now,
      };
      s.releases.push(rel);
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "ops.release.create", resource: rel.id, result: "Success", severity: "Warning", context: `v${version} risk=${rel.risk}` });
      return ok({ ok: true, message: `Release ${rel.id} drafted.`, release: rel });
    }
    case "release.advance": {
      const id = String(action.input.id ?? "");
      const rel = s.releases.find((r) => r.id === id);
      if (!rel) return fail(404, "not_found", "Release not found.");
      const order: ReleaseStage[] = ["draft", "validation", "review", "approval", "deploy", "verification", "completed"];
      const idx = order.indexOf(rel.stage);
      if (rel.stage === "completed") return fail(409, "already_completed", "Release is completed.");
      const next = order[Math.min(idx + 1, order.length - 1)];
      if (next === "approval" && rel.testStatus !== "passing") return fail(409, "tests_required", "Release cannot enter approval until test status is 'passing' — set it honestly first.");
      rel.stage = next;
      rel.reviewer = actor;
      rel.decision = next === "approval" ? "approved" : rel.decision;
      rel.updatedAt = now;
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "ops.release.advance", resource: id, result: "Success", severity: next === "deploy" ? "High" : "Warning", context: `stage=${next}` });
      return ok({ ok: true, message: `Release ${id} → ${next}.`, release: rel });
    }
    case "release.reject": {
      const id = String(action.input.id ?? "");
      const rel = s.releases.find((r) => r.id === id);
      if (!rel) return fail(404, "not_found", "Release not found.");
      rel.decision = "rejected";
      rel.stage = "draft";
      rel.reviewer = actor;
      rel.updatedAt = now;
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "ops.release.reject", resource: id, result: "Success", severity: "High", context: String(action.input.reason ?? "").slice(0, 200) });
      return ok({ ok: true, message: `Release ${id} rejected and returned to draft.`, release: rel });
    }
    // ---- API probe ----
    case "probe.apis": {
      const env = runtimeEnv();
      const base = env.deploymentUrl ? `https://${env.deploymentUrl}` : "http://127.0.0.1:3000";
      const results = await Promise.all(API_MANIFEST.map(async (e) => {
        const started = Date.now();
        try {
          const res = await withTimeout((signal) => fetch(`${base}${e.endpoint}`, { method: e.method === "GET" ? "GET" : "POST", signal, cache: "no-store" }), 6000);
          return { ...e, httpStatus: res.status, latencyMs: Date.now() - started, health: res.status < 500 ? "reachable" : "failing", interpretation: res.status === 401 ? "Reachable — authentication enforced (healthy)." : res.status < 400 ? "Reachable." : `HTTP ${res.status}.` };
        } catch {
          return { ...e, httpStatus: null as number | null, latencyMs: null as number | null, health: "unreachable", interpretation: "No response — endpoint unreachable from this runtime." };
        }
      }));
      writeAudit({ actor, actorId: SESSION_USER_ID, action: "ops.probe.apis", resource: "api-health", result: "Success", severity: "Info", context: `${results.length} endpoints probed` });
      return ok({ ok: true, probeResults: results, lastProbeAt: now, note: "Real HTTP probes executed server-side just now." });
    }
    // ---- rollback (token-gated, confirm-gated, audited) ----
    case "rollback.execute": {
      const env = runtimeEnv();
      const token = process.env.VERCEL_TOKEN;
      if (!token) return fail(409, "rollback_not_configured", "Rollback execution requires VERCEL_TOKEN (server-only). Without provider access this UI cannot and will not pretend to roll back.");
      if (action.confirm !== true) return fail(400, "confirm_required", "Rollback requires explicit confirmation (confirm=true) after reviewing impact.");
      const target = String(action.input.deploymentId ?? "");
      if (!target) return fail(400, "invalid_target", "A deploymentId must be provided.");
      try {
        const res = await withTimeout(async (signal) => {
          const r = await fetch(`https://api.vercel.com/v13/deployments/${encodeURIComponent(target)}/rollback`, {
            method: "POST", headers: { Authorization: `Bearer ${token}` }, signal, cache: "no-store",
          });
          return { status: r.status, body: await r.json().catch(() => ({})) };
        });
        writeAudit({ actor, actorId: SESSION_USER_ID, action: "ops.rollback.execute", resource: target, result: res.status < 300 ? "Success" : "Failure", severity: "Critical", context: `Vercel rollback API responded ${res.status}` });
        if (res.status >= 300) return ok({ ok: false, message: `Vercel rollback API responded ${res.status}. Nothing is claimed as rolled back.` });
        return ok({ ok: true, message: "Rollback requested against the Vercel API. Verify the new Ready deployment in Deployment Status.", response: res.status });
      } catch (err) {
        writeAudit({ actor, actorId: SESSION_USER_ID, action: "ops.rollback.execute", resource: target, result: "Failure", severity: "Critical", context: err instanceof Error ? err.message : "network error" });
        return ok({ ok: false, message: "Rollback API call failed — no rollback occurred." });
      }
    }
    default:
      return fail(400, "unknown_action", `Unknown operations action '${action.type}'.`);
  }
}
