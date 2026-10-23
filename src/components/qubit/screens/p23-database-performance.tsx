"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsHealthBadge, OpsSkeleton, OpsTable, SourceLine, fmtIST, useObsSection } from "../obs/parts";

// ============================================================
// P23-08 · Database Performance — one real live probe plus the
// audit-derived failure view. Everything the runtime cannot see
// (slow queries, connections, locks, size) is labeled honestly.
// No SQL console exists — by design (spec §12).
// ============================================================

interface QueryErrorSample {
  ts: number;
  action: string;
  resource: string;
  context?: string;
}

interface ProbeSample {
  ts: number;
  durationMs: number | null;
  status: number | null;
}

interface DbPerfPayload {
  probe: { health: string; latencyMs: number | null; note: string };
  probeHistory: { samples: ProbeSample[]; count: number; p50: number | null; p95: number | null; note: string };
  slowQueries: unknown;
  slowQueriesNote: string;
  connectionUsage: unknown;
  connectionUsageNote: string;
  transactionDuration: unknown;
  transactionDurationNote: string;
  lockWaits: unknown;
  lockWaitsNote: string;
  databaseSize: unknown;
  databaseSizeNote: string;
  queryErrors: { recentCount: number; note: string; sample: QueryErrorSample[] };
  sqlConsole: boolean;
  sqlConsoleNote: string;
  sourceNote: string;
}

export function P23DatabasePerformanceScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<DbPerfPayload>("database-performance");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Database Performance"
        description="One real live probe of the production database plus the audit-derived failure view. Metrics that require management APIs or pg_stat access are labeled Not available — never estimated."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {/* Live probe banner */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]" role="status" aria-label="Live database probe">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Live database probe</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                  {data.probe.latencyMs != null ? `${data.probe.latencyMs} ms` : "—"}
                </p>
                <p className="mt-1 text-[12px] text-slate-500">{data.probe.note}</p>
              </div>
              <OpsHealthBadge health={data.probe.health} />
            </div>
          </div>

          {/* Phase 25: real probe history from the telemetry store */}
          <SectionCard
            title="SELECT 1 probe history (24h)"
            description={data.probeHistory.note}
          >
            <div className="grid gap-x-8 md:grid-cols-2">
              <div>
                <FactRow label="Recorded samples (24h)" value={data.probeHistory.count} />
                <FactRow
                  label="p50 duration"
                  value={data.probeHistory.p50 == null ? "Insufficient data" : `${data.probeHistory.p50} ms`}
                  health={data.probeHistory.p50 == null ? "not-configured" : "healthy"}
                />
                <FactRow
                  label="p95 duration"
                  value={data.probeHistory.p95 == null ? "Insufficient data" : `${data.probeHistory.p95} ms`}
                  health={data.probeHistory.p95 == null ? "not-configured" : data.probeHistory.p95 > 1000 ? "degraded" : "healthy"}
                />
              </div>
              <div>
                <p className="pt-2.5 text-[11.5px] leading-relaxed text-slate-500" role="note">
                  Percentiles are computed only once at least 3 real samples exist — below that the honest answer is
                  {" "}<span className="font-semibold text-slate-600">Insufficient data</span>. Nothing is interpolated between probe runs.
                </p>
              </div>
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">Recent samples (most recent first)</p>
              <OpsTable
                rows={[...data.probeHistory.samples].sort((a, b) => b.ts - a.ts).map((s, i) => ({ ...s, rowKey: `${s.ts}-${i}` }))}
                keyOf={(s) => s.rowKey}
                columns={[
                  { header: "When", cell: (s) => <span className="tabular-nums"><span className="whitespace-nowrap">{fmtIST(s.ts)}</span></span> },
                  { header: "Duration", cell: (s) => <span className="tabular-nums font-semibold">{s.durationMs != null ? `${s.durationMs} ms` : "—"}</span> },
                  { header: "Status", cell: (s) => <OpsHealthBadge health={s.status != null && s.status < 500 ? "healthy" : s.status != null ? "unavailable" : "unknown"} /> },
                ]}
                empty={<p className="text-[12.5px] text-slate-500">No probe measurements recorded in the window yet — samples appear as operational sections run.</p>}
                maxH="max-h-56 overflow-y-auto"
              />
            </div>
          </SectionCard>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Runtime-observable facts — honest not-available states */}
            <SectionCard title="Runtime-observable facts" description="Views that require pg_stat_statements, pg_locks or Supabase management APIs are not exposed to this application.">
              <div>
                <FactRow label="Slow queries" value="Not available" health="not-configured" note={data.slowQueriesNote} />
                <FactRow label="Connection usage" value="Not available" health="not-configured" note={data.connectionUsageNote} />
                <FactRow label="Transaction duration" value="Not available" health="not-configured" note={data.transactionDurationNote} />
                <FactRow label="Lock waits" value="Not available" health="not-configured" note={data.lockWaitsNote} />
                <FactRow label="Database size" value="Not available" health="not-configured" note={data.databaseSizeNote} />
              </div>
            </SectionCard>

            {/* Audit-derived query errors */}
            <SectionCard title="Query errors (audit-derived)" description={data.queryErrors.note}>
              <FactRow label="Failure events · audit window" value={data.queryErrors.recentCount} note="All-cause Failure records — not a SQL error counter." />
              {data.queryErrors.sample.length === 0 ? (
                <p className="mt-2 text-[12px] leading-relaxed text-slate-500" role="status">
                  No failure events recorded in the audit window.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5" aria-label="Recent failure event samples">
                  {data.queryErrors.sample.map((e, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-2 text-[12px] text-slate-600">
                      <span className="font-medium tabular-nums text-slate-400">{fmtIST(e.ts, false)}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600">{e.action}</span>
                      <span className="min-w-0 flex-1 truncate" title={e.resource}>{e.resource}</span>
                      {e.context && <span className="w-full truncate text-[11px] text-slate-400" title={e.context}>{e.context}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {/* No SQL console — by design */}
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4" role="note">
            <div className="flex items-center gap-2">
              <ShieldAlert aria-hidden className="h-4 w-4 shrink-0 text-red-700" />
              <p className="text-[12.5px] font-semibold text-red-900">No SQL console</p>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-red-700">{data.sqlConsoleNote}</p>
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
