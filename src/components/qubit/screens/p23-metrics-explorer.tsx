"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, fmtIST, useObsSection } from "../obs/parts";

// ============================================================
// P23-02 · Metrics Explorer — point-in-time, measured-only cards
// + the one REAL Phase 25 series (12 request buckets, last hour)
// drawn as a simple bar chart. Every value is a real live probe /
// process measurement / audit derivation / request-or-client
// telemetry. Not-configured metrics render as honest dashed
// cards. Empty buckets are real zeros, never invented history.
// ============================================================

interface Metric {
  key: string;
  label: string;
  unit: string;
  value: number | null;
  health: string;
  note: string;
}

interface MetricsPayload {
  metrics: Metric[];
  series: { label: string; buckets: { at: number; count: number; errors: number }[]; note: string };
  persistence: { state: string; note: string }; // state: "ok" | "degraded" | "unavailable"
  timeRangeNote: string;
  sourceNote: string;
}

const persistenceHealth: Record<string, string> = {
  ok: "healthy",
  degraded: "degraded",
  unavailable: "unavailable",
};

function MetricCard({ metric }: { metric: Metric }) {
  if (metric.health === "not-configured") {
    // NotConfiguredCard-style inline card — dashed, muted, honest.
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4" role="note" aria-label={`${metric.label} not configured`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{metric.label}</p>
          <OpsHealthBadge health="not-configured" />
        </div>
        <p className="mt-2 text-[13px] font-semibold text-slate-500">Not configured</p>
        <p className="mt-1 text-[11px] leading-snug text-slate-400">{metric.note}</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]" role="status" aria-label={`${metric.label} metric`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{metric.label}</p>
        <OpsHealthBadge health={metric.health} />
      </div>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-[26px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">{metric.value ?? "—"}</span>
        <span className="text-[11.5px] font-medium text-slate-400">{metric.unit}</span>
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{metric.note}</p>
    </div>
  );
}

export function P23MetricsExplorerScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<MetricsPayload>("metrics");
  const maxBucket = data ? Math.max(1, ...data.series.buckets.map((b) => b.count)) : 1;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Metrics Explorer"
        description="Point-in-time system metrics measured live by this runtime — probes, process stats, audit derivations and Phase 25 request/client telemetry. Metrics the runtime cannot see are labeled Not configured, never invented."
        actions={
          <button
            type="button"
            onClick={reload}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            Refresh
          </button>
        }
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Metric cards">
            {data.metrics.map((m) => (
              <MetricCard key={m.key} metric={m} />
            ))}
          </div>

          <SectionCard title="Requests & errors — last hour" description={data.series.note}>
            {data.series.buckets.every((b) => b.count === 0) ? (
              <p className="text-[12.5px] text-slate-500">No requests recorded — the chart stays empty rather than showing invented history.</p>
            ) : (
              <div className="flex items-end gap-1.5" role="img" aria-label={`${data.series.label}: request volume with error overlay`}>
                {data.series.buckets.map((b, i) => (
                  <div key={i} className="group relative flex min-h-16 flex-1 flex-col justify-end" title={`${fmtIST(b.at, false)} — ${b.count} request(s), ${b.errors} error(s)`}>
                    {b.errors > 0 && (
                      <div className="w-full rounded-t bg-red-400" style={{ height: `${Math.max(6, (b.errors / maxBucket) * 100)}%` }} />
                    )}
                    <div className={`w-full ${b.errors > 0 ? "" : "rounded-t"} bg-slate-300 group-hover:bg-slate-400`} style={{ height: `${Math.max(3, ((b.count - b.errors) / maxBucket) * 100)}%` }} />
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 flex flex-wrap gap-4 text-[10.5px] text-slate-400">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-slate-300" /> successful</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-red-400" /> 5xx errors</span>
            </p>
          </SectionCard>

          <SectionCard title="Telemetry persistence" description="State of the Phase 25 telemetry store backing the request/client metrics above.">
            <FactRow
              label="Telemetry store persistence"
              value={data.persistence.state}
              health={persistenceHealth[data.persistence.state] ?? "unknown"}
              note={data.persistence.note}
            />
          </SectionCard>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" role="note">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Time range</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{data.timeRangeNote}</p>
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
