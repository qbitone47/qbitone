"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsHealthBadge, OpsSkeleton, OpsTable, SourceLine, fmtIST, timeAgo, useObsSection } from "../obs/parts";

// ============================================================
// P25-20 · Operational Activity
// ONE operational timeline assembled from REAL sources: the
// enterprise audit trail (config changes, releases, migrations),
// governance registries (incidents, alerts, recoveries), Phase 25
// telemetry (server/client errors) and retention actions.
// ============================================================

interface ActivityEvent {
  at: number;
  kind: string;
  text: string;
  who: string;
  severity: string;
}

interface ActivityPayload {
  windowMs: number;
  timeline: ActivityEvent[];
  counts: Record<string, number>;
  note: string;
  sourceNote: string;
}

const kindTone: Record<string, string> = {
  "config-change": "border-slate-200 bg-white text-slate-700",
  deployment: "border-sky-200 bg-sky-50 text-sky-800",
  migration: "border-violet-200 bg-violet-50 text-violet-800",
  incident: "border-red-200 bg-red-50 text-red-800",
  alert: "border-amber-200 bg-amber-50 text-amber-800",
  recovery: "border-emerald-200 bg-emerald-50 text-emerald-800",
  retention: "border-slate-200 bg-slate-50 text-slate-600",
  "client-error": "border-amber-200 bg-amber-50/60 text-amber-800",
  error: "border-red-200 bg-red-50/60 text-red-800",
};

const WINDOWS: { label: string; ms: number }[] = [
  { label: "Last 24 hours", ms: 86_400_000 },
  { label: "Last 7 days", ms: 7 * 86_400_000 },
  { label: "Last 30 days", ms: 30 * 86_400_000 },
];

export function P25ActivityScreen() {
  const [windowMs, setWindowMs] = React.useState<number>(86_400_000);
  const [kindFilter, setKindFilter] = React.useState<string>("all");
  const { data, loading, error, forbidden, reload } = useObsSection<ActivityPayload>("activity", { windowMs });

  const kinds = data ? Object.keys(data.counts).sort() : [];
  const visible = data ? (kindFilter === "all" ? data.timeline : data.timeline.filter((t) => t.kind === kindFilter)) : [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Operational Activity"
        description="The unified operational timeline — deployments, configuration changes, incidents, alerts, recoveries, errors and retention actions — every entry from a real source."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="activity-window">Time window</label>
            <select
              id="activity-window"
              value={windowMs}
              onChange={(e) => setWindowMs(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 shadow-sm"
            >
              {WINDOWS.map((w) => <option key={w.ms} value={w.ms}>{w.label}</option>)}
            </select>
            <button type="button" onClick={reload} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
              Refresh
            </button>
          </div>
        }
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <SectionCard title="Event mix" description={`Counts within the selected window (${Math.round(data.windowMs / 3_600_000)}h).`}>
            {kinds.length === 0 ? (
              <p className="text-[12.5px] text-slate-500">No operational events recorded in this window — an empty timeline is a real state, not a gap.</p>
            ) : (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by event kind">
                <button
                  type="button"
                  onClick={() => setKindFilter("all")}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${kindFilter === "all" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  All ({data.timeline.length})
                </button>
                {kinds.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKindFilter(k)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold capitalize transition-colors ${kindFilter === k ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    {k} ({data.counts[k]})
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Timeline" description="Newest first — up to 100 real events.">
            {visible.length === 0 ? (
              <p className="text-[12.5px] text-slate-500">Nothing matches the current filter in this window.</p>
            ) : (
              <ol className="relative space-y-2.5 border-l border-slate-200 pl-4" aria-label="Operational timeline">
                {visible.slice(0, 100).map((t, i) => (
                  <li key={`${t.at}-${i}`} className="relative">
                    <span className="absolute -left-[21px] top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-300" aria-hidden="true" />
                    <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border px-3.5 py-2.5 ${kindTone[t.kind] ?? kindTone["config-change"]}`}>
                      <span className="tabular-nums text-[11px] font-medium opacity-70">{fmtIST(t.at)}</span>
                      <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide opacity-80">{t.kind}</span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{t.text}</span>
                      <span className="text-[10.5px] opacity-60">{t.who}</span>
                      <span className="text-[10px] uppercase tracking-wide opacity-50">{t.severity}</span>
                      <span className="text-[10.5px] opacity-50">{timeAgo(t.at)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
