// ============================================================
// Qubit One — Phase 25 · Enterprise Observability & Operational
// Visibility. telemetry-server.ts — the REAL telemetry pipeline.
//
// GOVERNANCE (Phase 25 spec — ABSOLUTE):
//   · Every event is a real request, real log line, real error,
//     real probe result or a real client-side observation.
//     Nothing is fabricated; absent data is labeled, not invented.
//   · Redaction happens AT THE SOURCE: secret-shaped values are
//     masked before they ever reach a buffer or the database.
//   · Telemetry failure NEVER breaks the application: every write
//     is fire-and-forget with bounded buffers; every read has an
//     in-process fallback and an honest persistence label.
//   · Persistence is the single Prisma TelemetryEvent table
//     (Supabase PostgreSQL) with enforced retention and a hard
//     row cap — no unbounded telemetry tables (spec §12/§13).
//   · Request IDs correlate request → API → error → deployment
//     (spec §10). traceId === requestId for this deployment: real
//     distributed tracing (OpenTelemetry) is NOT configured and is
//     never claimed.
// ============================================================

import { db } from "@/lib/db";
import { runtimeEnv } from "@/lib/qubit/ops-server";

// ---------- types ----------

export type TelemetryKind =
  | "request"
  | "log"
  | "error"
  | "probe"
  | "client-vital"
  | "client-error"
  | "client-route"
  | "client-request";

export type TelemetryLevel = "debug" | "info" | "warn" | "error";

export interface TelemetryRecord {
  id: string;
  ts: number; // epoch ms
  kind: TelemetryKind;
  level: TelemetryLevel;
  service: string;
  environment: string;
  requestId: string | null;
  traceId: string | null;
  route: string | null;
  method: string | null;
  status: number | null;
  durationMs: number | null;
  actorId: string | null;
  errorCode: string | null;
  message: string | null;
  context: string | null;
  release: string | null;
  source: "server" | "client";
  screen: string | null;
}

export interface TelemetryInput {
  kind: TelemetryKind;
  level?: TelemetryLevel;
  service?: string;
  requestId?: string | null;
  route?: string | null;
  method?: string | null;
  status?: number | null;
  durationMs?: number | null;
  actorId?: string | null;
  errorCode?: string | null;
  message?: string | null;
  context?: Record<string, unknown> | null;
  screen?: string | null;
  source?: "server" | "client";
}

export interface TelemetryConfig {
  requestEnabled: boolean;
  clientEnabled: boolean;
  samplingRatePct: number; // applies to request/client-vital/client-route/client-request; errors and logs are never sampled out
  telemetryRetentionDays: number; // enforced on all telemetry kinds; 0 disables pruning (hard cap still applies)
  hardCapRows: number;
}

export const TELEMETRY_KINDS: readonly TelemetryKind[] = [
  "request", "log", "error", "probe",
  "client-vital", "client-error", "client-route", "client-request",
];

const DEFAULT_CONFIG: TelemetryConfig = {
  requestEnabled: true,
  clientEnabled: true,
  samplingRatePct: 100,
  telemetryRetentionDays: 14,
  hardCapRows: 100_000,
};

const BUFFER_MAX = 5_000; // in-process fallback ring — bounded memory (spec §13)
const FLUSH_THRESHOLD = 20;
const FLUSH_DELAY_MS = 5_000;
const FLUSH_BATCH = 200;
const MESSAGE_CAP = 600;
const CONTEXT_CAP = 2_000;

// ---------- module state (globalThis singleton — one store across route bundles) ----------

interface TelemetryState {
  buffer: TelemetryRecord[];
  config: TelemetryConfig;
  dbReady: boolean;
  dbFailed: boolean;
  provisionAttempted: boolean;
  provisionPromise: Promise<boolean> | null;
  flushPromise: Promise<void> | null;
  flushTimer: ReturnType<typeof setTimeout> | null;
  lastFlushErrorAt: number | null;
  lastFlushError: string | null;
  lastPrune: { at: number; deleted: number; mode: string } | null;
}

const g = globalThis as unknown as { __qubitTelemetryState?: TelemetryState };

function state(): TelemetryState {
  if (!g.__qubitTelemetryState) {
    g.__qubitTelemetryState = {
      buffer: [],
      config: { ...DEFAULT_CONFIG },
      dbReady: false,
      dbFailed: false,
      provisionAttempted: false,
      provisionPromise: null,
      flushPromise: null,
      flushTimer: null,
      lastFlushErrorAt: null,
      lastFlushError: null,
      lastPrune: null,
    };
  }
  return g.__qubitTelemetryState;
}

/** Runtime configuration hook — called by Observability Settings (audited there). */
export function configureTelemetry(patch: Partial<Pick<TelemetryConfig, "requestEnabled" | "clientEnabled" | "samplingRatePct" | "telemetryRetentionDays">>): void {
  const s = state();
  if (typeof patch.requestEnabled === "boolean") s.config.requestEnabled = patch.requestEnabled;
  if (typeof patch.clientEnabled === "boolean") s.config.clientEnabled = patch.clientEnabled;
  if (Number.isFinite(patch.samplingRatePct)) s.config.samplingRatePct = Math.max(1, Math.min(100, Math.round(patch.samplingRatePct as number)));
  if (Number.isFinite(patch.telemetryRetentionDays)) s.config.telemetryRetentionDays = Math.max(0, Math.min(365, Math.round(patch.telemetryRetentionDays as number)));
}

export function telemetryConfigSnapshot(): TelemetryConfig & { bufferLen: number } {
  const s = state();
  return { ...s.config, bufferLen: s.buffer.length };
}

// ---------- redaction (spec §9/§17/§18) ----------

const SECRET_KEY_RE = /password|passwd|pwd|secret|token|authorization|auth|api[-_]?key|apikey|credential|cookie|session|private[-_]?key|signature|bearer/i;
const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g;
const LONG_SECRET_RE = /\b[A-Fa-f0-9]{32,}\b|\b[A-Za-z0-9+/]{40,}={0,2}\b/g;
const SECRET_ASSIGN_RE = /\b([A-Za-z0-9_-]*(?:password|passwd|secret|token|api[-_]?key|apikey|credential|authorization|bearer)[A-Za-z0-9_-]*)\s*([=:])\s*("[^"]*"|'[^']*'|[^\s,;&}]+)/gi;
const EMAIL_RE = /\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Mask secret-shaped values inside free-form text. Applied before ANY storage. */
export function redactString(input: string): string {
  let s = String(input ?? "");
  s = s.replace(CONTROL_RE, "");
  s = s.replace(SECRET_ASSIGN_RE, (_m, key: string) => `${key}=[redacted]`);
  s = s.replace(JWT_RE, "[redacted-token]");
  s = s.replace(LONG_SECRET_RE, "[redacted-token]");
  s = s.replace(EMAIL_RE, "$1***@$2");
  return s.length > MESSAGE_CAP ? `${s.slice(0, MESSAGE_CAP)}…[truncated]` : s;
}

/** Key-aware redaction: secret-ish keys never store a value at all. */
export function redactKeyValue(key: string, value: unknown): string | null {
  if (value == null) return null;
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  if (SECRET_KEY_RE.test(key)) return "[redacted]";
  return redactString(raw);
}

function redactContext(ctx: Record<string, unknown> | null | undefined): string | null {
  if (!ctx) return null;
  try {
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ctx).slice(0, 12)) safe[k] = redactKeyValue(k, v);
    const json = JSON.stringify(safe);
    return json.length > CONTEXT_CAP ? `${json.slice(0, CONTEXT_CAP)}…[truncated]` : json;
  } catch {
    return null;
  }
}

// ---------- ids / sampling ----------

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const SAMPLED_KINDS: readonly TelemetryKind[] = ["request", "client-vital", "client-route", "client-request"];

function shouldSample(kind: TelemetryKind): boolean {
  if (!SAMPLED_KINDS.includes(kind)) return true; // errors and logs are never sampled out
  const pct = state().config.samplingRatePct;
  return pct >= 100 || Math.random() * 100 < pct;
}

// ---------- recording ----------

function buildRecord(input: TelemetryInput): TelemetryRecord {
  const env = runtimeEnv();
  const ts = Date.now();
  return {
    id: newId(),
    ts,
    kind: input.kind,
    level: input.level ?? (input.kind === "error" || input.kind === "client-error" ? "error" : "info"),
    service: input.service ?? "qubit-one",
    environment: env.vercelEnv ?? process.env.NODE_ENV ?? "runtime",
    requestId: input.requestId ? String(input.requestId).slice(0, 64) : null,
    traceId: input.requestId ? String(input.requestId).slice(0, 64) : null,
    route: input.route ? redactString(String(input.route).slice(0, 160)) : null,
    method: input.method ? String(input.method).slice(0, 10) : null,
    status: typeof input.status === "number" && Number.isFinite(input.status) ? Math.round(input.status) : null,
    durationMs: typeof input.durationMs === "number" && Number.isFinite(input.durationMs) ? Math.round(input.durationMs) : null,
    actorId: input.actorId ? String(input.actorId).slice(0, 80) : null,
    errorCode: input.errorCode ? String(input.errorCode).slice(0, 80) : null,
    message: input.message ? redactString(input.message) : null,
    context: redactContext(input.context),
    release: env.commitSha,
    source: input.source ?? "server",
    screen: input.screen ? String(input.screen).slice(0, 80) : null,
  };
}

/**
 * Record one real telemetry event. Never throws, never awaits the
 * database — telemetry must not be able to break the application.
 */
export function recordTelemetry(input: TelemetryInput): void {
  try {
    const s = state();
    if (input.source === "client" && !s.config.clientEnabled) return;
    if (input.source !== "client" && input.kind === "request" && !s.config.requestEnabled) return;
    if (!shouldSample(input.kind)) return;
    s.buffer.push(buildRecord(input));
    if (s.buffer.length > BUFFER_MAX) s.buffer.splice(0, s.buffer.length - BUFFER_MAX);
    if (s.buffer.length >= FLUSH_THRESHOLD) void flushTelemetry();
    else if (!s.flushTimer) s.flushTimer = setTimeout(() => { s.flushTimer = null; void flushTelemetry(); }, FLUSH_DELAY_MS);
  } catch {
    /* telemetry must never throw into application code */
  }
}

/** Structured application log (spec §9 field contract). */
export function logServerEvent(input: {
  level?: TelemetryLevel;
  service?: string;
  message: string;
  route?: string | null;
  requestId?: string | null;
  errorCode?: string | null;
  context?: Record<string, unknown> | null;
}): void {
  recordTelemetry({ kind: "log", source: "server", ...input });
}

/** Server error hook — used by instrumentation.ts onRequestError. */
export function recordServerError(err: unknown, req: { path?: string; method?: string; headers?: Record<string, string | undefined> }, ctx?: { routerKind?: string; routePath?: string; routeType?: string }): void {
  const e = err as { name?: string; message?: string } | null;
  recordTelemetry({
    kind: "error",
    level: "error",
    route: req?.path ?? ctx?.routePath ?? null,
    method: req?.method ?? null,
    requestId: req?.headers?.["x-request-id"] ?? null,
    errorCode: e?.name ?? "UnknownError",
    message: e?.message ?? "Unhandled server error",
    context: { routerKind: ctx?.routerKind ?? null, routeType: ctx?.routeType ?? null },
  });
}

/** Real request metering with request-id propagation (spec §8/§10). */
export async function withMeter(req: Request, routeLabel: string, handler: () => Promise<Response>): Promise<Response> {
  const started = Date.now();
  const requestId = req.headers.get("x-request-id") || newId();
  const method = req.method ?? "GET";
  let res: Response;
  try {
    res = await handler();
  } catch (err) {
    const e = err as { name?: string; message?: string } | null;
    recordTelemetry({
      kind: "request", level: "error", route: routeLabel, method, status: 500,
      durationMs: Date.now() - started, requestId,
      errorCode: e?.name ?? "HandlerError", message: e?.message ?? "Unhandled route handler error",
    });
    throw err;
  }
  recordTelemetry({
    kind: "request",
    level: res.status >= 500 ? "error" : "info",
    route: routeLabel, method, status: res.status,
    durationMs: Date.now() - started, requestId,
  });
  const headers = new Headers(res.headers);
  headers.set("x-request-id", requestId);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

// ---------- persistence (guarded auto-provision + graceful degradation) ----------

// Matches prisma/schema.prisma TelemetryEvent exactly (TEXT / TIMESTAMP(3) /
// INTEGER / DOUBLE PRECISION, Prisma index naming). CREATE IF NOT EXISTS is
// additive and non-destructive; it runs at most once per process and only
// when the table is missing. This keeps production (Vercel + Supabase)
// self-provisioning without requiring credentials in CI or the sandbox.
const PROVISION_SQL = `
CREATE TABLE IF NOT EXISTS "TelemetryEvent" (
  "id" TEXT NOT NULL,
  "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "kind" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'info',
  "service" TEXT NOT NULL DEFAULT 'qubit-one',
  "environment" TEXT NOT NULL DEFAULT 'runtime',
  "requestId" TEXT,
  "traceId" TEXT,
  "route" TEXT,
  "method" TEXT,
  "status" INTEGER,
  "durationMs" DOUBLE PRECISION,
  "actorId" TEXT,
  "errorCode" TEXT,
  "message" TEXT,
  "context" TEXT,
  "release" TEXT,
  "source" TEXT NOT NULL DEFAULT 'server',
  "screen" TEXT,
  CONSTRAINT "TelemetryEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TelemetryEvent_ts_idx" ON "TelemetryEvent"("ts");
CREATE INDEX IF NOT EXISTS "TelemetryEvent_kind_ts_idx" ON "TelemetryEvent"("kind", "ts");
CREATE INDEX IF NOT EXISTS "TelemetryEvent_route_ts_idx" ON "TelemetryEvent"("route", "ts");
CREATE INDEX IF NOT EXISTS "TelemetryEvent_requestId_idx" ON "TelemetryEvent"("requestId");
`;

async function ensureTable(): Promise<boolean> {
  const s = state();
  if (s.dbReady) return true;
  if (s.provisionPromise) return s.provisionPromise;
  s.provisionPromise = (async () => {
    try {
      if (!s.provisionAttempted) {
        s.provisionAttempted = true;
        await db.$executeRawUnsafe(PROVISION_SQL);
      } else {
        await db.$queryRaw`SELECT 1 FROM "TelemetryEvent" LIMIT 1`;
      }
      s.dbReady = true;
      s.dbFailed = false;
      return true;
    } catch {
      s.dbReady = false;
      s.dbFailed = true;
      // allow a later retry on the next flush cycle
      setTimeout(() => { const st = state(); st.provisionPromise = null; }, 30_000);
      return false;
    }
  })();
  return s.provisionPromise;
}

/** Fire-and-forget batched flush. Guarantees: never throws, dedups by id, keeps failures buffered. */
export async function flushTelemetry(): Promise<void> {
  const s = state();
  if (s.flushPromise) return s.flushPromise;
  if (s.buffer.length === 0) return;
  s.flushPromise = (async () => {
    const batch = s.buffer.slice(0, FLUSH_BATCH);
    try {
      const ready = await ensureTable();
      if (!ready) {
        s.lastFlushErrorAt = Date.now();
        s.lastFlushError = "Telemetry table unavailable — events retained in the in-process buffer (degraded mode).";
        return;
      }
      await db.telemetryEvent.createMany({
        data: batch.map((e) => ({
          id: e.id, ts: new Date(e.ts), kind: e.kind, level: e.level, service: e.service,
          environment: e.environment, requestId: e.requestId, traceId: e.traceId, route: e.route,
          method: e.method, status: e.status, durationMs: e.durationMs, actorId: e.actorId,
          errorCode: e.errorCode, message: e.message, context: e.context, release: e.release,
          source: e.source, screen: e.screen,
        })),
        skipDuplicates: true,
      });
      const ids = new Set(batch.map((e) => e.id));
      const kept = s.buffer.filter((e) => !ids.has(e.id));
      s.buffer.length = 0;
      s.buffer.push(...kept);
      s.dbReady = true;
      s.dbFailed = false;
      s.lastFlushError = null;
    } catch (err) {
      s.dbReady = false;
      s.dbFailed = true;
      s.lastFlushErrorAt = Date.now();
      s.lastFlushError = err instanceof Error ? err.message.slice(0, 200) : "Unknown telemetry persistence failure.";
      // retry later — bounded, never blocks application code
      setTimeout(() => { void flushTelemetry(); }, 30_000);
    } finally {
      s.flushPromise = null;
    }
  })();
  return s.flushPromise;
}

export interface PersistenceStatus {
  persistence: "ok" | "degraded" | "unavailable";
  persistenceLabel: string;
  bufferLen: number;
  lastFlushError: string | null;
  lastFlushErrorAt: number | null;
}

export function telemetryPersistenceStatus(): PersistenceStatus {
  const s = state();
  const persistence = s.dbReady ? "ok" : s.dbFailed ? (s.buffer.length > 0 ? "degraded" : "unavailable") : "degraded";
  const label =
    persistence === "ok"
      ? "Persisting to the TelemetryEvent table (Supabase PostgreSQL)."
      : s.buffer.length > 0
        ? "Database unavailable from this runtime — real events are retained in the bounded in-process buffer and will flush when the database is reachable."
        : "Database unavailable from this runtime — no events buffered yet.";
  return { persistence, persistenceLabel: label, bufferLen: s.buffer.length, lastFlushError: s.lastFlushError, lastFlushErrorAt: s.lastFlushErrorAt };
}

// ---------- reads ----------

export interface TelemetryFilter {
  kinds?: TelemetryKind[];
  sinceMs?: number;
  level?: TelemetryLevel | null;
  routeContains?: string | null;
  requestId?: string | null;
  q?: string | null;
  limit?: number;
}

function bufferFilter(filter: TelemetryFilter): TelemetryRecord[] {
  const s = state();
  const limit = Math.min(filter.limit ?? 300, 1000);
  const q = filter.q?.toLowerCase() ?? null;
  return s.buffer
    .filter((e) => {
      if (filter.kinds && !filter.kinds.includes(e.kind)) return false;
      if (filter.sinceMs && e.ts < filter.sinceMs) return false;
      if (filter.level && e.level !== filter.level) return false;
      if (filter.routeContains && !(e.route ?? "").toLowerCase().includes(filter.routeContains.toLowerCase())) return false;
      if (filter.requestId && e.requestId !== filter.requestId) return false;
      if (q && !(`${e.message ?? ""} ${e.route ?? ""} ${e.errorCode ?? ""}`.toLowerCase().includes(q))) return false;
      return true;
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

function rowToRecord(row: {
  id: string; ts: Date; kind: string; level: string; service: string; environment: string;
  requestId: string | null; traceId: string | null; route: string | null; method: string | null;
  status: number | null; durationMs: number | null; actorId: string | null; errorCode: string | null;
  message: string | null; context: string | null; release: string | null; source: string; screen: string | null;
}): TelemetryRecord {
  return {
    id: row.id, ts: row.ts.getTime(), kind: row.kind as TelemetryKind, level: row.level as TelemetryLevel,
    service: row.service, environment: row.environment, requestId: row.requestId, traceId: row.traceId,
    route: row.route, method: row.method, status: row.status, durationMs: row.durationMs,
    actorId: row.actorId, errorCode: row.errorCode, message: row.message, context: row.context,
    release: row.release, source: row.source as "server" | "client", screen: row.screen,
  };
}

export interface TelemetryReadResult {
  events: TelemetryRecord[];
  store: "database" | "in-process-buffer";
  persistence: PersistenceStatus;
}

/**
 * Read telemetry events. Primary: TelemetryEvent table. Fallback: the
 * in-process buffer — labeled honestly so no view pretends persistence works.
 */
export async function readTelemetry(filter: TelemetryFilter): Promise<TelemetryReadResult> {
  const persistence = telemetryPersistenceStatus();
  const limit = Math.min(filter.limit ?? 300, 1000);
  const kinds = filter.kinds;
  try {
    const ready = await ensureTable();
    if (ready) {
      const rows = await db.telemetryEvent.findMany({
        where: {
          ...(kinds && kinds.length ? { kind: { in: kinds } } : {}),
          ...(filter.sinceMs ? { ts: { gte: new Date(filter.sinceMs) } } : {}),
          ...(filter.level ? { level: filter.level } : {}),
          ...(filter.routeContains ? { route: { contains: filter.routeContains } } : {}),
          ...(filter.requestId ? { requestId: filter.requestId } : {}),
          ...(filter.q ? { OR: [{ message: { contains: filter.q } }, { route: { contains: filter.q } }, { errorCode: { contains: filter.q } }] } : {}),
        },
        orderBy: { ts: "desc" },
        take: limit,
      });
      return { events: rows.map(rowToRecord), store: "database", persistence: { ...persistence, persistence: "ok" } };
    }
  } catch {
    /* fall through to the in-process buffer — labeled below */
  }
  return { events: bufferFilter(filter), store: "in-process-buffer", persistence };
}

// ---------- aggregation (all computed from real stored events) ----------

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export interface RouteStat {
  route: string;
  count: number;
  errors: number;
  errorRatePct: number | null;
  p50: number | null;
  p95: number | null;
  p99: number | null;
}

export interface RequestStats {
  total: number;
  errors: number;
  errorRatePct: number | null;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  truncated: boolean;
  perRoute: RouteStat[];
}

const STATS_MAX_EVENTS = 5_000;

function statsFromEvents(events: TelemetryRecord[]): RequestStats {
  const total = events.length;
  const durations = events.map((e) => e.durationMs).filter((d): d is number => typeof d === "number").sort((a, b) => a - b);
  const errors = events.filter((e) => (e.status ?? 0) >= 500 || e.level === "error").length;
  const byRoute = new Map<string, TelemetryRecord[]>();
  for (const e of events) {
    const key = e.route ?? "(unknown)";
    if (!byRoute.has(key)) byRoute.set(key, []);
    byRoute.get(key)!.push(e);
  }
  const perRoute: RouteStat[] = [...byRoute.entries()]
    .map(([route, list]) => {
      const d = list.map((e) => e.durationMs).filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
      const errs = list.filter((e) => (e.status ?? 0) >= 500 || e.level === "error").length;
      return {
        route,
        count: list.length,
        errors: errs,
        errorRatePct: list.length > 0 ? Math.round((errs / list.length) * 10_000) / 100 : null,
        p50: percentile(d, 50), p95: percentile(d, 95), p99: percentile(d, 99),
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  return {
    total,
    errors,
    errorRatePct: total > 0 ? Math.round((errors / total) * 10_000) / 100 : null,
    p50: percentile(durations, 50), p95: percentile(durations, 95), p99: percentile(durations, 99),
    truncated: total >= STATS_MAX_EVENTS,
    perRoute,
  };
}

export async function requestStats(windowMs: number): Promise<RequestStats & { store: string; sampleLabel: string }> {
  const since = Date.now() - windowMs;
  const { events, store } = await readTelemetry({ kinds: ["request"], sinceMs: since, limit: STATS_MAX_EVENTS });
  const stats = statsFromEvents(events);
  const sampleLabel =
    stats.total < 10
      ? "Insufficient data — fewer than 10 recorded requests in the window; percentiles are withheld rather than invented."
      : `${stats.total} real request${stats.total === 1 ? "" : "s"} recorded in the window${stats.truncated ? " (most recent 5,000 sampled)" : ""}.`;
  return { ...stats, store, sampleLabel };
}

export interface SeriesBucket { at: number; count: number; errors: number }

export async function requestSeries(windowMs: number, bucketCount = 24): Promise<SeriesBucket[]> {
  const since = Date.now() - windowMs;
  const { events } = await readTelemetry({ kinds: ["request"], sinceMs: since, limit: STATS_MAX_EVENTS });
  const bucketMs = Math.max(1, Math.floor(windowMs / bucketCount));
  const buckets: SeriesBucket[] = Array.from({ length: bucketCount }, (_, i) => ({ at: since + (i + 1) * bucketMs, count: 0, errors: 0 }));
  for (const e of events) {
    const idx = Math.floor((e.ts - since) / bucketMs);
    const b = buckets[Math.min(bucketCount - 1, Math.max(0, idx))];
    if (!b) continue;
    b.count += 1;
    if ((e.status ?? 0) >= 500 || e.level === "error") b.errors += 1;
  }
  return buckets;
}

export interface ErrorGroup {
  key: string;
  source: "application-error" | "client-error";
  count: number;
  firstSeen: number;
  lastSeen: number;
  affectedRoutes: string[];
  affectedScreens: string[];
  releases: string[];
  severity: TelemetryLevel;
}

export async function errorGroups(windowMs: number): Promise<ErrorGroup[]> {
  const since = Date.now() - windowMs;
  const { events } = await readTelemetry({ kinds: ["error", "client-error"], sinceMs: since, limit: 2_000 });
  const groups = new Map<string, TelemetryRecord[]>();
  for (const e of events) {
    const key = (e.errorCode ?? "UnknownError") + " · " + (e.message ?? "").split("\n")[0].slice(0, 80);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({
      key,
      source: list.some((e) => e.source === "client") ? ("client-error" as const) : ("application-error" as const),
      count: list.length,
      firstSeen: Math.min(...list.map((e) => e.ts)),
      lastSeen: Math.max(...list.map((e) => e.ts)),
      affectedRoutes: [...new Set(list.map((e) => e.route).filter((r): r is string => !!r))].slice(0, 5),
      affectedScreens: [...new Set(list.map((e) => e.screen).filter((x): x is string => !!x))].slice(0, 5),
      releases: [...new Set(list.map((e) => e.release).filter((r): r is string => !!r))].slice(0, 3),
      severity: list.some((e) => e.level === "error") ? ("error" as const) : ("warn" as const),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

export interface ClientStats {
  vitalsSamples: number;
  jsErrors: number;
  routeTransitions: number;
  clientRequests: number;
  perScreen: { screen: string; samples: number; lcp: number | null; cls: number | null; ttfb: number | null; fcp: number | null; inp: number | null }[];
  recentJsErrors: { ts: number; message: string | null; screen: string | null; errorCode: string | null }[];
  inpNote: string;
}

export async function clientStats(windowMs: number): Promise<ClientStats> {
  const since = Date.now() - windowMs;
  const { events: vitals } = await readTelemetry({ kinds: ["client-vital"], sinceMs: since, limit: 2_000 });
  const { events: jsErrors } = await readTelemetry({ kinds: ["client-error"], sinceMs: since, limit: 500 });
  const { events: transitions } = await readTelemetry({ kinds: ["client-route"], sinceMs: since, limit: 1_000 });
  const { events: clientRequests } = await readTelemetry({ kinds: ["client-request"], sinceMs: since, limit: 2_000 });
  const byScreen = new Map<string, TelemetryRecord[]>();
  for (const v of vitals) {
    const key = v.screen ?? "(unknown)";
    if (!byScreen.has(key)) byScreen.set(key, []);
    byScreen.get(key)!.push(v);
  }
  const median = (list: TelemetryRecord[], field: "lcpMs" | "cls" | "ttfbMs" | "fcpMs" | "inpMs"): number | null => {
    const vals = list.map((v) => (v as unknown as Record<string, number | null>)[field]).filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
    return percentile(vals, 50);
  };
  return {
    vitalsSamples: vitals.length,
    jsErrors: jsErrors.length,
    routeTransitions: transitions.length,
    clientRequests: clientRequests.length,
    perScreen: [...byScreen.entries()].map(([screen, list]) => ({
      screen, samples: list.length,
      lcp: median(list, "lcpMs"), cls: median(list, "cls"), ttfb: median(list, "ttfbMs"), fcp: median(list, "fcpMs"), inp: median(list, "inpMs"),
    })).sort((a, b) => b.samples - a.samples).slice(0, 12),
    recentJsErrors: jsErrors.slice(0, 8).map((e) => ({ ts: e.ts, message: e.message, screen: e.screen, errorCode: e.errorCode })),
    inpNote: "INP is approximated from the Event Timing API (longest interaction duration in the session) and labeled as an approximation — not a web-vitals-library attribution value.",
  };
}

export interface AvailabilityStats {
  requestSuccessPct: number | null;
  requests: number;
  serverErrors: number;
  healthChecks: { ok: number; fail: number; uptimePct: number | null };
  recentFailures: { ts: number; route: string | null; status: number | null }[];
  label: string;
}

export async function availabilityStats(windowMs: number): Promise<AvailabilityStats> {
  const since = Date.now() - windowMs;
  const { events } = await readTelemetry({ kinds: ["request"], sinceMs: since, limit: STATS_MAX_EVENTS });
  const total = events.length;
  const serverErrors = events.filter((e) => (e.status ?? 0) >= 500).length;
  const successPct = total > 0 ? Math.round(((total - serverErrors) / total) * 10_000) / 100 : null;
  const { events: probes } = await readTelemetry({ kinds: ["probe"], sinceMs: since, limit: 500 });
  const okProbes = probes.filter((p) => p.status === 200 || p.level === "info").length;
  const uptimePct = probes.length > 0 ? Math.round((okProbes / probes.length) * 10_000) / 100 : null;
  return {
    requestSuccessPct: successPct,
    requests: total,
    serverErrors,
    healthChecks: { ok: okProbes, fail: probes.length - okProbes, uptimePct },
    recentFailures: events.filter((e) => (e.status ?? 0) >= 500).slice(0, 8).map((e) => ({ ts: e.ts, route: e.route, status: e.status })),
    label:
      total === 0
        ? "Insufficient data — no requests recorded in this window yet. Availability appears as events are recorded; it is never estimated."
        : `Measured from ${total} real request${total === 1 ? "" : "s"} in the window (success = status < 500).`,
  };
}

export interface SloEvaluation {
  current: number | null;
  status: "Meeting" | "Breaching" | "Insufficient data";
  sampleCount: number;
  evidence: string;
}

/** Real SLO evaluation over the telemetry window (spec P25-16 — every number computed, never invented). */
export async function evaluateSloReal(slo: { kind: "availability" | "latency" | "error-rate"; target: number; windowDays: number }): Promise<SloEvaluation> {
  const windowMs = Math.min(slo.windowDays, 30) * 86_400_000; // bounded by retention reality
  const since = Date.now() - windowMs;
  const { events } = await readTelemetry({ kinds: ["request"], sinceMs: since, limit: STATS_MAX_EVENTS });
  const total = events.length;
  if (total < 20) {
    return {
      current: null, status: "Insufficient data", sampleCount: total,
      evidence: `${total} request event${total === 1 ? "" : "s"} recorded in the ${slo.windowDays}-day window — below the 20-event minimum for a defensible measurement. The target is configured and will evaluate as real telemetry accumulates.`,
    };
  }
  if (slo.kind === "availability") {
    const serverErrors = events.filter((e) => (e.status ?? 0) >= 500).length;
    const pct = Math.round(((total - serverErrors) / total) * 10_000) / 100;
    return { current: pct, status: pct >= slo.target ? "Meeting" : "Breaching", sampleCount: total, evidence: `${total - serverErrors}/${total} requests returned status < 500 over the window (measured).` };
  }
  if (slo.kind === "latency") {
    const durations = events.map((e) => e.durationMs).filter((d): d is number => typeof d === "number").sort((a, b) => a - b);
    const p95 = percentile(durations, 95);
    if (p95 == null) return { current: null, status: "Insufficient data", sampleCount: total, evidence: "No request durations recorded." };
    return { current: p95, status: p95 <= slo.target ? "Meeting" : "Breaching", sampleCount: total, evidence: `p95 latency ${p95} ms vs target ≤ ${slo.target} ms over ${total} measured requests.` };
  }
  const errors = events.filter((e) => (e.status ?? 0) >= 500 || e.level === "error").length;
  const errPct = Math.round((errors / total) * 10_000) / 100;
  return { current: errPct, status: errPct <= slo.target ? "Meeting" : "Breaching", sampleCount: total, evidence: `${errors}/${total} requests errored over the window (measured).` };
}

// ---------- retention (spec P25-22 — enforced, not declarative) ----------

export interface PruneResult {
  attempted: boolean;
  mode: "database" | "in-process-buffer";
  deleted: number;
  perKind: { kind: string; deleted: number }[];
  hardCapTrimmed: number;
  note: string;
}

/** Enforce the configured retention policy + hard cap. Safe to call anytime; never throws. */
export async function pruneTelemetry(): Promise<PruneResult> {
  const s = state();
  const perKind: { kind: string; deleted: number }[] = [];
  let deleted = 0;
  let hardCapTrimmed = 0;
  const ready = await ensureTable();
  if (ready) {
    try {
      const cutoff = s.config.telemetryRetentionDays > 0 ? new Date(Date.now() - s.config.telemetryRetentionDays * 86_400_000) : null;
      if (cutoff) {
        for (const kind of TELEMETRY_KINDS) {
          const res = await db.telemetryEvent.deleteMany({ where: { kind, ts: { lt: cutoff } } });
          if (res.count > 0) perKind.push({ kind, deleted: res.count });
          deleted += res.count;
        }
      }
      const total = await db.telemetryEvent.count();
      if (total > s.config.hardCapRows) {
        const excess = total - s.config.hardCapRows;
        const oldest = await db.telemetryEvent.findMany({ orderBy: { ts: "asc" }, take: excess, select: { id: true } });
        const res = await db.telemetryEvent.deleteMany({ where: { id: { in: oldest.map((o) => o.id) } } });
        hardCapTrimmed = res.count;
        deleted += res.count;
      }
      const result: PruneResult = {
        attempted: true, mode: "database", deleted, perKind, hardCapTrimmed,
        note: s.config.telemetryRetentionDays > 0
          ? `Deleted events older than ${s.config.telemetryRetentionDays} day(s)${hardCapTrimmed ? ` and trimmed ${hardCapTrimmed} beyond the ${s.config.hardCapRows.toLocaleString()}-row hard cap` : ""}.`
          : `Retention pruning is disabled (0 days) — the ${s.config.hardCapRows.toLocaleString()}-row hard cap was enforced instead.`,
      };
      s.lastPrune = { at: Date.now(), deleted, mode: "database" };
      return result;
    } catch (err) {
      const result: PruneResult = {
        attempted: true, mode: "database", deleted: 0, perKind: [], hardCapTrimmed: 0,
        note: `Prune against the database failed: ${err instanceof Error ? err.message.slice(0, 160) : "unknown"}. Nothing was deleted.`,
      };
      return result;
    }
  }
  // database unavailable — enforce the policy on the in-process buffer so the control is real everywhere
  const cutoff = Date.now() - Math.max(1, s.config.telemetryRetentionDays) * 86_400_000;
  const kept = s.buffer.filter((e) => e.ts >= cutoff);
  const removed = s.buffer.length - kept.length;
  s.buffer.length = 0;
  s.buffer.push(...kept);
  s.lastPrune = { at: Date.now(), deleted: removed, mode: "in-process-buffer" };
  return {
    attempted: true, mode: "in-process-buffer", deleted: removed,
    perKind: [], hardCapTrimmed: 0,
    note: `Database unavailable — retention enforced on the in-process buffer only (${removed} event(s) removed). Database rows are pruned when persistence is reachable.`,
  };
}

export function lastPruneSnapshot(): { at: number; deleted: number; mode: string } | null {
  return state().lastPrune;
}

// ---------- client ingestion (spec §7/§18 — validated, capped, no PII accepted) ----------

export interface IngestResult { accepted: number; rejected: number; reason?: string }

const CLIENT_VITAL_KEYS = ["lcpMs", "cls", "ttfbMs", "fcpMs", "inpMs"] as const;

function ingestOne(raw: unknown): TelemetryInput | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const kind = typeof e.kind === "string" ? e.kind : "";
  const screen = typeof e.screen === "string" ? e.screen.slice(0, 80) : null;
  if (kind === "vital") {
    const out: TelemetryInput = { kind: "client-vital", source: "client", level: "info", screen };
    for (const k of CLIENT_VITAL_KEYS) {
      const v = e[k];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= (k === "cls" ? 50 : 120_000)) {
        (out as unknown as Record<string, number>)[k] = Math.round(v);
      }
    }
    if (Object.keys(out).some((k) => CLIENT_VITAL_KEYS.includes(k as (typeof CLIENT_VITAL_KEYS)[number]))) return out;
    return null;
  }
  if (kind === "js-error") {
    const message = typeof e.message === "string" ? e.message.slice(0, 400) : "";
    if (!message) return null;
    return {
      kind: "client-error", source: "client", level: "error", screen,
      errorCode: typeof e.errorCode === "string" ? e.errorCode.slice(0, 60) : "ClientError",
      message: typeof e.stack === "string" ? `${message} :: ${e.stack.slice(0, 400)}` : message,
    };
  }
  if (kind === "route-transition") {
    return screen ? { kind: "client-route", source: "client", level: "info", screen } : null;
  }
  if (kind === "client-request") {
    const route = typeof e.route === "string" && e.route.startsWith("/") ? e.route.slice(0, 120) : null;
    const status = typeof e.status === "number" ? Math.round(e.status) : null;
    const durationMs = typeof e.durationMs === "number" ? Math.round(e.durationMs) : null;
    if (!route || status == null || status < 100 || status > 599 || durationMs == null || durationMs < 0 || durationMs > 600_000) return null;
    return {
      kind: "client-request", source: "client", level: status >= 500 ? "error" : "info",
      route,
      method: typeof e.method === "string" ? e.method.slice(0, 10) : null,
      status, durationMs,
      requestId: typeof e.requestId === "string" ? e.requestId.slice(0, 64) : null,
    };
  }
  return null;
}

const rateBucket = new Map<string, { count: number; resetAt: number }>();

/** Strict, rate-limited client ingestion. Any identity-bearing field is ignored by construction. */
export function ingestClientEvents(rawEvents: unknown, clientKey: string): IngestResult {
  const s = state();
  if (!s.config.clientEnabled) return { accepted: 0, rejected: 0, reason: "Client telemetry is disabled in Observability Settings." };
  const now = Date.now();
  const bucket = rateBucket.get(clientKey);
  if (!bucket || bucket.resetAt < now) rateBucket.set(clientKey, { count: 1, resetAt: now + 60_000 });
  else if (bucket.count >= 60) return { accepted: 0, rejected: 0, reason: "Rate limited." };
  else bucket.count += 1;
  if (rateBucket.size > 5_000) rateBucket.clear();

  if (!Array.isArray(rawEvents) || rawEvents.length === 0 || rawEvents.length > 25) {
    return { accepted: 0, rejected: 0, reason: "Batch must be a non-empty array of at most 25 events." };
  }
  let accepted = 0;
  let rejected = 0;
  for (const raw of rawEvents.slice(0, 25)) {
    const input = ingestOne(raw);
    if (input) {
      recordTelemetry(input);
      accepted += 1;
    } else rejected += 1;
  }
  return { accepted, rejected };
}
