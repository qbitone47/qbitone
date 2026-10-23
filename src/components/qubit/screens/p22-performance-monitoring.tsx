"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, fmtIST, NotConfiguredCard, OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, useOpsSection } from "../ops/parts";

// ============================================================
// P22-09 · Performance Monitoring
// One honest live window (SQL probe, HTTP self-probe, process
// metrics measured in this request). Historical ranges, Web
// Vitals persistence, slow endpoints and slow queries require
// telemetry that is not configured — they render as honest
// disabled/empty states, never as decorative charts.
// ============================================================

interface PerformancePayload {
  live: {
    dbLatencyMs: number | null;
    dbHealth: "healthy" | "unavailable";
    apiRttMs: number | null;
    apiHealth: "healthy" | "degraded" | "unavailable";
    rssMb: number;
    heapUsedMb: number;
    processUptimeMin: number;
    measuredAt: number;
  };
  vitals: { configured: boolean; note: string };
  timeRanges: string[];
  timeRangeNote: string;
  slowEndpoints: unknown[];
  slowEndpointsNote: string;
  slowQueries: unknown[];
  slowQueriesNote: string;
  sourceNote: string;
}

function LiveTile({ label, value, unit, health, note }: { label: string; value: string; unit?: string; health?: string; note: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
        {unit && <span className="ml-1 text-[12px] font-medium text-slate-500">{unit}</span>}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        {health && <OpsHealthBadge health={health} />}
        <p className="text-[10.5px] leading-snug text-slate-400">{note}</p>
      </div>
    </div>
  );
}

export function P22PerformanceMonitoringScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<PerformancePayload>("performance");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Performance Monitoring"
        description="A single live measurement window from this deployment. Nothing historical is drawn or implied — the metrics backend that would make history real is not configured."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {/* Live window */}
          <SectionCard
            title="Live window"
            description="Measured in this request: SQL probe, HTTP self-probe and process metrics."
            actions={
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-500">
                Measured {fmtIST(data.live.measuredAt, false)}
              </span>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <LiveTile label="DB latency" value={data.live.dbLatencyMs != null ? String(data.live.dbLatencyMs) : "—"} unit={data.live.dbLatencyMs != null ? "ms" : undefined} health={data.live.dbHealth} note="Live SELECT 1 round-trip." />
              <LiveTile label="API round-trip" value={data.live.apiRttMs != null ? String(data.live.apiRttMs) : "—"} unit={data.live.apiRttMs != null ? "ms" : undefined} health={data.live.apiHealth} note="Real HTTP self-probe of this deployment." />
              <LiveTile label="RSS memory" value={String(data.live.rssMb)} unit="MB" note="Process resident set (measured)." />
              <LiveTile label="Heap used" value={String(data.live.heapUsedMb)} unit="MB" note="V8 heap in use (measured)." />
              <LiveTile label="Process uptime" value={String(data.live.processUptimeMin)} unit="min" note="This instance only — not availability." />
            </div>
            <p className="mt-3 text-[10.5px] leading-relaxed text-slate-400">
              All values captured {fmtIST(data.live.measuredAt)}. Refresh the view to take a new measurement.
            </p>
          </SectionCard>

          {/* Historical ranges — disabled on purpose */}
          <SectionCard title="Time ranges" description="Disabled by design: only the live window is real.">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Historical time ranges (unavailable)">
              {data.timeRanges.map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Historical metrics backend not configured"
                  className="cursor-not-allowed rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-[11.5px] font-semibold text-slate-400 opacity-70"
                >
                  {r}
                </button>
              ))}
              <span className="sr-only">All historical ranges are disabled because no metrics backend is configured.</span>
            </div>
            <div className="mt-3">
              <NotConfiguredCard
                title="Historical performance data not configured"
                note={data.timeRangeNote}
                recommendation="Introduce a metrics backend (e.g., a hosted APM or a self-hosted time-series store) and wire server-side export before any chart is rendered here."
              />
            </div>
          </SectionCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Slow endpoints" description="Honest empty state — no fabricated latency histograms.">
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center text-[12.5px] text-slate-500">
                No slow-endpoint data. {data.slowEndpointsNote}
              </p>
            </SectionCard>
            <SectionCard title="Slow queries" description="Honest empty state — no fabricated query traces.">
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center text-[12.5px] text-slate-500">
                No slow-query data. {data.slowQueriesNote}
              </p>
            </SectionCard>
          </div>

          <SectionCard title="Web Vitals" description="In-session client collection status.">
            <FactRow label="Browser Web Vitals" value={data.vitals.configured ? "Configured" : "Session-only"} health={data.vitals.configured ? "healthy" : "not-configured"} note={data.vitals.note} />
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
