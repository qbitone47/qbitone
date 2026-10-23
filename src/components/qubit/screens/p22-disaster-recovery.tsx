"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, useOpsSection } from "../ops/parts";

// ============================================================
// P22-16 · Disaster Recovery
// Readiness is scored ONLY from real checks — and every check
// currently fails, so the score is an honest low number with its
// basis shown. No RPO/RTO numbers are invented; risks are listed
// in red so they cannot be scrolled past.
// ============================================================

interface DrCheck {
  id: string;
  label: string;
  pass: boolean;
  note: string;
}

interface DrPayload {
  rpo: number | null;
  rto: number | null;
  rpoRtoNote: string;
  checks: DrCheck[];
  readinessScore: number;
  scoreBasis: string;
  dependencies: string[];
  recoveryOwner: string | null;
  lastDrill: number | null;
  risks: string[];
  unresolvedRisks: number;
  sourceNote: string;
}

export function P22DisasterRecoveryScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<DrPayload>("dr");
  const passed = data ? data.checks.filter((c) => c.pass).length : 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Disaster Recovery"
        description="Recovery readiness scored exclusively from real checks. A low score is the honest reading of an early-stage deployment — not a defect of the scoring."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Readiness score */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] lg:col-span-1" role="status" aria-label={`DR readiness score ${data.readinessScore} percent, ${passed} of ${data.checks.length} checks pass`}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-400">Readiness score</p>
              <p className="mt-2 text-5xl font-semibold tabular-nums tracking-tight text-slate-900">
                {data.readinessScore}
                <span className="ml-1 text-lg font-medium text-slate-400">%</span>
              </p>
              <p className="mt-1.5 text-[12.5px] font-semibold text-slate-700">{passed}/{data.checks.length} checks pass</p>
              <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">{data.scoreBasis}</p>
            </div>

            {/* RPO / RTO */}
            <SectionCard title="Recovery objectives" description={data.rpoRtoNote} className="lg:col-span-2">
              <div>
                <FactRow label="RPO (Recovery Point Objective)" value="Not defined" health="not-configured" note="Declaring an RPO would be fiction until platform backup verification exists." />
                <FactRow label="RTO (Recovery Time Objective)" value="Not defined" health="not-configured" note="No recovery drill has measured a real recovery time." />
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Readiness checks" description="Each check reports its own real state — no aggregate optimism.">
              <ul className="space-y-2">
                {data.checks.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-slate-100 py-2.5 last:border-b-0">
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium text-slate-700">{c.label}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{c.note}</p>
                    </div>
                    <OpsHealthBadge health={c.pass ? "healthy" : "not-configured"} />
                  </li>
                ))}
              </ul>
            </SectionCard>

            <div className="space-y-5">
              <SectionCard title="Recovery dependencies" description="What a real recovery would lean on.">
                <ul className="space-y-2">
                  {data.dependencies.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-slate-700">
                      <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                      {d}
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard title="Ownership & drills" description="Accountability facts, reported as unknown when absent.">
                <div>
                  <FactRow label="Recovery owner" value={data.recoveryOwner ?? "Not assigned"} health={data.recoveryOwner ? "healthy" : "not-configured"} note="A named owner is a prerequisite for a drillable DR plan." />
                  <FactRow label="Last DR drill" value={data.lastDrill ? "Recorded" : "Never"} health={data.lastDrill ? "healthy" : "not-configured"} note="No disaster-recovery exercise has been performed." />
                  <FactRow label="Unresolved risks" value={data.unresolvedRisks} health={data.unresolvedRisks > 0 ? "degraded" : "healthy"} note="Counted from the real risk register below." />
                </div>
              </SectionCard>
            </div>
          </div>

          {/* Risks — red-tinted so they cannot be missed */}
          <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5" role="note" aria-label="Open disaster recovery risks">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden />
              <p className="text-[13.5px] font-semibold text-red-900">Open risks ({data.risks.length})</p>
            </div>
            <ul className="mt-2.5 space-y-2">
              {data.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg border border-red-100 bg-white px-3 py-2 text-[12.5px] leading-relaxed text-red-800">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
