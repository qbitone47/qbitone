"use client";

import { OpsError, OpsHealthBadge, OpsSkeleton, OpsTable, SourceLine, fmtIST, timeAgo, useObsSection } from "../obs/parts";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";

// ============================================================
// P23-16 · Infrastructure Health — provider-neutral presentation
// over real, detectable facts only: this runtime, live probes,
// token presence. Nothing is assumed on a provider's behalf.
// ============================================================

interface InfraResource {
  resource: string; provider: string; region: string; health: string;
  utilization: string; alerts: number; lastUpdatedAt: number | null; note: string;
}

interface InfrastructurePayload {
  providerNeutral: boolean;
  resources: InfraResource[];
  sourceNote: string;
}

export function P23InfrastructureHealthScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<InfrastructurePayload>("infrastructure");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Infrastructure Health"
        description="Provider-neutral view of the infrastructure this system can actually detect — measured live or labeled honestly when it cannot be."
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
          {data.providerNeutral && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" role="note">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Provider-neutral</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
                Health below reflects only what this runtime can actually detect: live probes, runtime environment facts and token presence. Where a provider state cannot be verified from here, the row says unknown or not-configured — it is never asserted on the provider&rsquo;s behalf.
              </p>
            </div>
          )}

          <SectionCard title="Resources" description="Application runtime, data plane, CI and edge — with the real evidence for each verdict.">
            <OpsTable
              rows={data.resources}
              keyOf={(r) => r.resource}
              empty={
                <p className="py-8 text-center text-[12.5px] text-slate-500">
                  No infrastructure resources detected — this would only happen if the runtime itself could not be inspected.
                </p>
              }
              columns={[
                {
                  header: "Resource",
                  cell: (r) => (
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-800">{r.resource}</span>
                      <span className="block max-w-xs text-[11px] leading-snug text-slate-400">{r.note}</span>
                    </span>
                  ),
                },
                { header: "Provider", cell: (r) => <span className="text-slate-600">{r.provider}</span> },
                { header: "Region", cell: (r) => <span className="text-slate-600">{r.region}</span> },
                { header: "Health", cell: (r) => <OpsHealthBadge health={r.health} /> },
                { header: "Utilization", cell: (r) => <span className="tabular-nums text-slate-700">{r.utilization}</span> },
                {
                  header: "Last updated",
                  cell: (r) =>
                    r.lastUpdatedAt ? (
                      <span className="tabular-nums">
                        <span className="whitespace-nowrap">{fmtIST(r.lastUpdatedAt)}</span>
                        <span className="block text-[10.5px] text-slate-400">{timeAgo(r.lastUpdatedAt)}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">Never measured</span>
                    ),
                },
                { header: "Alerts", cell: (r) => <span className="tabular-nums text-slate-600">{r.alerts}</span> },
              ]}
            />
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
