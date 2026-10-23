"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { OpsError, OpsHealthBadge, OpsSkeleton, OpsTable, SourceLine, useObsSection } from "../obs/parts";

// ============================================================
// P23-06 · Dependency Health — external dependencies with status
// derived ONLY from live probes and credential presence. No
// availability percentages exist → availabilityNote says so.
// ============================================================

interface Dependency {
  name: string;
  status: string;
  latencyMs: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  availability: number | null;
  availabilityNote: string;
  configState: string;
  note: string;
}

interface DependenciesPayload {
  dependencies: Dependency[];
  sourceNote: string;
}

export function P23DependencyHealthScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<DependenciesPayload>("dependencies");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Dependency Health"
        description="Every external dependency this runtime touches, with status derived only from live probes and credential presence — historical availability is not measured and is labeled as such."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <OpsTable
            rows={data.dependencies}
            keyOf={(d) => d.name}
            empty={<p className="text-[12.5px] text-slate-500" role="status">No dependency checks are defined for this deployment.</p>}
            columns={[
              {
                header: "Dependency",
                cell: (d) => (
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-slate-800">{d.name}</p>
                    <p className="mt-0.5 max-w-xs text-[11px] leading-snug text-slate-400">{d.note}</p>
                  </div>
                ),
              },
              {
                header: "Status",
                cell: (d) => <OpsHealthBadge health={d.status} />,
                className: "whitespace-nowrap",
              },
              {
                header: "Latency",
                cell: (d) => <span className="tabular-nums">{d.latencyMs != null ? `${d.latencyMs} ms` : "—"}</span>,
                className: "whitespace-nowrap text-right",
              },
              {
                header: "Configuration",
                cell: (d) => <span className="text-slate-600">{d.configState}</span>,
              },
              {
                header: "Availability",
                cell: (d) => <span className="block max-w-[16rem] text-[11px] leading-snug text-slate-500">{d.availabilityNote}</span>,
              },
            ]}
          />

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
