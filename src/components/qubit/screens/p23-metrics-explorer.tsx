"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, useObsSection } from "../obs/parts";

// ============================================================
// P23-02 · Metrics Explorer — point-in-time, measured-only cards.
// Every value is a real live probe / process measurement / audit
// derivation. Not-configured metrics render as honest dashed
// cards. NO charts — no historical series exists to draw (§33).
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
  timeRangeNote: string;
  sourceNote: string;
}

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

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Metrics Explorer"
        description="Point-in-time system metrics measured live by this runtime — probes, process stats and audit derivations. Metrics the runtime cannot see are labeled Not configured, never invented."
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
