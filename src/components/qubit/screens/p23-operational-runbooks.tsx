"use client";

import * as React from "react";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsSkeleton, SourceLine, fmtIST, useObsSection, obsPost } from "../obs/parts";

// ============================================================
// P23-20 · Operational Runbooks — the authored guidance library
// for THIS architecture. Documentation, not telemetry: nothing
// executes automatically. "Mark reviewed" is the only mutation,
// it is audited and versioned server-side.
// ============================================================

interface Runbook {
  id: string;
  title: string;
  incidentType: string;
  symptoms: string[];
  diagnostics: string[];
  safeChecks: string[];
  remediation: string[];
  rollbackProcedure: string;
  escalation: string;
  owner: string;
  version: number;
  lastReviewedAt: number;
  updatedAt: number;
}

interface RunbooksPayload {
  runbooks: Runbook[];
  policy: string;
  sourceNote: string;
}

interface RunbookPostResponse {
  ok: boolean;
  data: { ok: boolean; message?: string };
}

function ListBlock({ heading, items }: { heading: string; items: string[] }) {
  return (
    <div>
      <h4 className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">{heading}</h4>
      {items.length === 0 ? (
        <p className="text-[11.5px] italic text-slate-400">None authored.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((s, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-slate-700">
              <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-300" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function P23OperationalRunbooksScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<RunbooksPayload>("runbooks");
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function markReviewed(rb: Runbook) {
    if (busyId) return;
    setBusyId(rb.id);
    try {
      const res = await obsPost<RunbookPostResponse>("runbook.update", { id: rb.id });
      toast({
        title: res.data?.ok ? "Runbook reviewed" : "Review not completed",
        description: res.data?.message ?? (res.data?.ok ? `Runbook ${rb.id} marked reviewed.` : "The server did not accept the review."),
        variant: res.data?.ok ? undefined : "destructive",
      });
      reload();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Review failed",
        description: e instanceof Error ? e.message : "The runbook review could not be recorded.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Operational Runbooks"
        description="Authored guidance for this specific architecture. Every step references real screens and real signals — nothing executes automatically."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-[12px] leading-relaxed text-amber-900" role="note">
            {data.policy}
          </div>

          {data.runbooks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center" role="status">
              <p className="text-[13px] font-semibold text-slate-700">No runbooks are authored yet.</p>
              <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-slate-500">
                The library ships empty and is filled by the platform team — guidance is never fabricated.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {data.runbooks.map((rb) => (
                <article key={rb.id} className="qubit-card p-5" aria-label={`Runbook ${rb.id}: ${rb.title}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-bold tracking-tight text-slate-900">{rb.title}</h3>
                      <p className="mt-0.5 text-[11.5px] text-slate-500">
                        <span className="font-mono">{rb.id}</span> · incident type <span className="font-medium text-slate-600">{rb.incidentType}</span> · owner {rb.owner}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-bold text-slate-600">v{rb.version}</span>
                      <button
                        type="button"
                        onClick={() => markReviewed(rb)}
                        disabled={busyId !== null}
                        aria-busy={busyId === rb.id}
                        className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyId === rb.id ? "Recording…" : "Mark reviewed"}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 pt-3.5 md:grid-cols-2">
                    <ListBlock heading="Symptoms" items={rb.symptoms} />
                    <ListBlock heading="Diagnostics" items={rb.diagnostics} />
                    <ListBlock heading="Safe checks" items={rb.safeChecks} />
                    <div>
                      <h4 className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Remediation</h4>
                      {rb.remediation.length === 0 ? (
                        <p className="text-[11.5px] italic text-slate-400">None authored.</p>
                      ) : (
                        <ol className="list-decimal space-y-1 pl-4">
                          {rb.remediation.map((s, i) => (
                            <li key={i} className="text-[12.5px] leading-relaxed text-slate-700">{s}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                    <div>
                      <h4 className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Rollback</h4>
                      <p className="text-[12.5px] leading-relaxed text-slate-700">{rb.rollbackProcedure}</p>
                    </div>
                    <div>
                      <h4 className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Escalation</h4>
                      <p className="text-[12.5px] leading-relaxed text-slate-700">{rb.escalation}</p>
                    </div>
                  </div>

                  <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
                    Last reviewed <span className="tabular-nums">{fmtIST(rb.lastReviewedAt)}</span> · last updated <span className="tabular-nums">{fmtIST(rb.updatedAt)}</span> · review increments the version and is recorded in the audit trail.
                  </p>
                </article>
              ))}
            </div>
          )}

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
