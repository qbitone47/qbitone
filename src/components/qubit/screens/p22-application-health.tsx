"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, useOpsSection } from "../ops/parts";

// ============================================================
// P22-07 · Application Health
// Each runtime dependency reporting its OWN state — measured or
// derived at request time. By explicit design rule there is NO
// overall/aggregate banner: one failed dependency must never
// visually imply that the entire Qubit One system is down.
// ============================================================

interface Dependency {
  id: string;
  label: string;
  health: "healthy" | "degraded" | "unavailable";
  note: string;
}

interface ApplicationPayload {
  dependencies: Dependency[];
  rule: string;
  sourceNote: string;
}

export function P22ApplicationHealthScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<ApplicationPayload>("application");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Application Health"
        description="Every runtime dependency reporting its own measured state — each row stands alone, with no aggregate computed."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {/* Design rule — inline note, deliberately before the rows */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" role="note">
            <p className="text-[12px] leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-700">Design rule: </span>
              {data.rule}
            </p>
          </div>

          <SectionCard title="Dependencies" description="Measured or derived from real runtime configuration at request time. No dependency’s state is inferred from another’s.">
            {data.dependencies.length ? (
              <div className="grid gap-x-8 lg:grid-cols-2">
                {data.dependencies.map((d) => (
                  <div key={d.id} className="border-b border-slate-100 py-2.5 last:border-b-0">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <p className="text-[12.5px] font-medium text-slate-700">{d.label}</p>
                      <OpsHealthBadge health={d.health} />
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-slate-400">{d.note}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-slate-500" role="status">
                The backend reported no dependencies to display — none are invented.
              </p>
            )}
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
