"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, fmtIST, useOpsSection } from "../ops/parts";

// ============================================================
// P22-24 · System Health Dashboard
// The consolidated operational command center. Every signal is
// measured or derived at request time and drills into its source
// screen. One degraded dependency never implies a down platform.
// ============================================================

interface HealthPayload {
  overall: "healthy" | "degraded" | "unavailable" | "maintenance";
  overallLabel: string;
  environment: string;
  components: { id: string; label: string; health: string; screen: string; note: string; latencyMs?: number | null }[];
  rule: string;
  sourceNote: string;
}

const tone: Record<string, string> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-800",
  degraded: "border-amber-200 bg-amber-50 text-amber-800",
  unavailable: "border-red-200 bg-red-50 text-red-800",
  maintenance: "border-blue-200 bg-blue-50 text-blue-800",
};

export function P22SystemHealthDashboardScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<HealthPayload>("health");
  // Drill-down uses the existing global navigation (nav-context is
  // provided by the app shell; screens navigate via useQubitNav).
  const nav = useNavSafe();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="System Health Dashboard"
        description="The consolidated operational command center — live signals, honest gaps, one drill away from every source."
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
          {/* Overall banner */}
          <div className={`rounded-2xl border p-5 ${tone[data.overall] ?? tone.degraded}`} role="status">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">Overall system health</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{data.overallLabel}</p>
                <p className="mt-1 text-[12px] opacity-80">Environment: {data.environment} · measured {fmtIST(Date.now(), false)}</p>
              </div>
              <OpsHealthBadge health={data.overall} className="h-fit" />
            </div>
          </div>

          <SectionCard title="Signals" description={data.rule}>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {data.components.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => nav(c.screen)}
                  className="group rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-slate-300 hover:shadow-[0_2px_6px_rgba(15,23,42,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                  aria-label={`${c.label}: ${c.health}. Open ${c.screen.replace("p22-", "").replace(/-/g, " ")}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12.5px] font-semibold text-slate-800">{c.label}</p>
                    <OpsHealthBadge health={c.health} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-slate-500">{c.note}</p>
                  {c.latencyMs != null && <p className="mt-1 text-[10.5px] font-medium tabular-nums text-slate-400">{c.latencyMs} ms (live)</p>}
                  <p className="mt-1.5 text-[10px] font-semibold text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">Open source screen →</p>
                </button>
              ))}
            </div>
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}

// Import last for readability; navigation helper kept tiny.
import { useQubitNav } from "../nav-context";
function useNavSafe(): (screen: string) => void {
  const { navigate } = useQubitNav();
  return (screen: string) => navigate(screen as Parameters<typeof navigate>[0]);
}
