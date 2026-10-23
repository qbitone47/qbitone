"use client";

import { NotConfiguredCard, OpsError, OpsSkeleton, SourceLine, useObsSection } from "../obs/parts";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";

// ============================================================
// P23-15 · Capacity & Resource Usage — only genuinely measurable
// values are shown. Forecasting needs a historical series; without
// retention it would be fiction, so the forecast card says so.
// ============================================================

interface CapacityResource {
  id: string; label: string; current: string; unit: string;
  trend: null; peak: null; baseline: null; threshold: null; note: string;
}

interface CapacityPayload {
  resources: CapacityResource[];
  forecast: { available: boolean; note: string };
  sourceNote: string;
}

export function P23CapacityUsageScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<CapacityPayload>("capacity");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Capacity & Resource Usage"
        description="Real, current resource readings from this process and the audit window. Values that cannot be measured serverlessly say so — nothing is extrapolated."
        actions={
          <button type="button" onClick={reload} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
            Refresh
          </button>
        }
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <SectionCard title="Resources" description="Current readings — measured in this request or counted from real records.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.resources.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4" role="status" aria-label={`${r.label}: ${r.current}`}>
                  <p className="text-[12px] font-medium text-slate-500">{r.label}</p>
                  <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{r.current}</p>
                  <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{r.unit}</p>
                  <p className="mt-2.5 border-t border-slate-100 pt-2.5 text-[11px] leading-snug text-slate-400">{r.note}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {!data.forecast.available && (
            <NotConfiguredCard
              title="Capacity forecast — not available"
              note={data.forecast.note}
              recommendation="Configure a telemetry store with real retention (Observability Settings P23-24 declares the policy); once historical series exist, forecasts can be computed from them."
            />
          )}

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
