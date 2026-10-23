"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsSkeleton, SourceLine, fmtIST, timeAgo, useObsSection } from "../obs/parts";

// ============================================================
// P23-18 · Change Intelligence — "What changed in this system?"
// A vertical timeline built from the ONE enterprise audit trail.
// Only real recorded change events render; an empty timeline is
// an honest result and is labeled as such. Nothing is invented.
// ============================================================

interface ChangeEvent {
  ts: number;
  who: string;
  action: string;
  environment: string;
  impact: string;
  auditId: string;
  correlationId: string;
}

interface ChangesPayload {
  changes: ChangeEvent[];
  eventTypes: string[];
  note: string;
  sourceNote: string;
}

export function P23ChangeIntelligenceScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<ChangesPayload>("changes");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Change Intelligence"
        description="Every recorded change to this system — deployments, configuration, flags, migrations, rollbacks — read from the single enterprise audit trail."
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
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-[12px] leading-relaxed text-slate-600" role="note">
            {data.note}
          </div>

          <SectionCard
            title={`Change timeline (${data.changes.length})`}
            description="Most recent first. Each entry is a real audit record — actor, action, impact context and correlation ID."
          >
            {data.changes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center" role="status">
                <p className="text-[12.5px] font-semibold text-slate-700">No change events recorded in the current audit window.</p>
                <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-slate-500">
                  An empty timeline is a real result — this deployment has not recorded any change-class events yet. Nothing is fabricated to fill it.
                </p>
              </div>
            ) : (
              <ol className="relative ml-1 space-y-0 border-l border-slate-200 pl-5" aria-label="Change timeline">
                {data.changes.map((c) => (
                  <li key={c.auditId} className="relative pb-5 last:pb-0">
                    <span aria-hidden="true" className="absolute -left-[26.5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-400 ring-1 ring-slate-300" />
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className="whitespace-nowrap tabular-nums text-[11.5px] font-medium text-slate-500">{fmtIST(c.ts)}</span>
                      <span className="whitespace-nowrap text-[11px] text-slate-400">{timeAgo(c.ts)}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-slate-700">{c.action}</span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">{c.environment}</span>
                    </div>
                    <p className="mt-1 text-[12.5px] text-slate-700">
                      <span className="font-semibold">{c.who}</span>
                      {c.impact ? <span> — {c.impact}</span> : <span className="text-slate-400"> — no impact context recorded</span>}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">audit {c.auditId} · correlation {c.correlationId.slice(0, 12)}</p>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <SectionCard title="Event-type vocabulary" description="The change classes this screen recognizes. Anything outside these classes is not a change event.">
            <ul className="flex flex-wrap gap-1.5">
              {data.eventTypes.map((t) => (
                <li key={t} className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-600">{t}</li>
              ))}
            </ul>
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
