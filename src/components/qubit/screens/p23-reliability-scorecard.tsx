"use client";

import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, useObsSection } from "../obs/parts";

// ============================================================
// P23-14 · Reliability Scorecard — an explainable score.
// Every category carries its own real evidence; the score is a
// plain pass/fail rollup of those checks. No AI, no weighting
// magic, no arbitrary number.
// ============================================================

interface ScorecardCategory {
  id: string; label: string; pass: boolean; evidence: string; weight?: string;
}

interface ScorecardPayload {
  categories: ScorecardCategory[];
  score: number;
  basis: string;
  sourceNote: string;
}

export function P23ReliabilityScorecardScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<ScorecardPayload>("scorecard");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Reliability Scorecard"
        description="One explainable score over live probes, the audit trail and documented platform facts. Every row shows the evidence behind its verdict."
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6" role="status">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Reliability score</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums tracking-tight text-slate-900">{data.score}</span>
              <span className="text-lg font-medium text-slate-400">/ 100</span>
            </div>
            <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-slate-500">{data.basis}</p>
          </div>

          <SectionCard title="Categories" description="Pass/fail per category with the real evidence that decided it — read each note before acting.">
            <div role="list" aria-label="Scorecard categories">
              {data.categories.map((c) => (
                <div key={c.id} role="listitem">
                  <FactRow
                    label={c.label}
                    value={c.pass ? "Pass" : "Not passing"}
                    health={c.pass ? "healthy" : "not-configured"}
                    note={c.weight ? `${c.evidence} · weight: ${c.weight}` : c.evidence}
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="How to read this score" description="Deliberately conservative.">
            <FactRow label="Missing capability" value="Counts as not passing" health="not-configured" note="A category without real telemetry (e.g. backups this process cannot verify) is scored honestly rather than assumed healthy." />
            <FactRow label="Worst signal shown" value="Per-category" note="The overall health rollup on the Observability Home follows the same worst-signal honesty; this score is a plain ratio of the checks above." />
          </SectionCard>

          <div className="flex items-center gap-2 text-[11px] text-slate-400" role="note">
            <OpsHealthBadge health="unknown" />
            <span>Categories are re-computed from live probes and the audit trail on every refresh — nothing is cached as an authoritative history.</span>
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
