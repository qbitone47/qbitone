"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "../page-header";
import { FactRow, NotConfiguredCard, OpsError, OpsSkeleton, OpsTable, SourceLine, fmtIST, useObsSection } from "../obs/parts";

// ============================================================
// P23-09 · Web Performance — REAL browser vitals collected by
// the Platform Ops collector. Zero samples → honest empty state;
// samples arrive only as real users browse. Nothing simulated.
// ============================================================

interface VitalsSample {
  at: number;
  screen: string;
  lcpMs: number | null;
  cls: number | null;
  ttfbMs: number | null;
  fcpMs: number | null;
}

interface WebPerfPayload {
  collected: number;
  samples: VitalsSample[];
  note: string;
  inpNote: string;
  routes: unknown;
  routesNote: string;
  jsErrors: unknown;
  jsErrorsNote: string;
  privacy: string;
  sourceNote: string;
}

function num(v: number | null): string {
  return v != null ? String(v) : "—";
}

export function P23WebPerformanceScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<WebPerfPayload>("web-performance");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Web Performance"
        description="Real browser vitals (PerformanceObserver) POSTed by Qubit One clients. Only actually-collected samples are shown — no synthetic page loads, no fabricated scores."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {data.collected === 0 ? (
            <NotConfiguredCard
              title="No web vitals collected yet"
              note={data.note}
              recommendation="Open the application in a browser session — the vitals collector POSTs real samples automatically as users browse. Nothing is simulated."
            />
          ) : (
            <section className="qubit-card overflow-hidden">
              <header className="border-b border-slate-100 px-4 py-3.5 md:px-5">
                <h2 className="text-[13.5px] font-semibold text-slate-800">Collected samples</h2>
                <p className="mt-0.5 text-[11.5px] text-slate-500">{data.note}</p>
              </header>
              <div className="px-4 py-3 md:px-5">
                <OpsTable
                  rows={data.samples}
                  keyOf={(s) => `${s.at}-${s.screen}`}
                  empty={<p className="text-[12.5px] text-slate-500" role="status">No samples are held in memory for this process.</p>}
                  maxH="max-h-96 overflow-y-auto"
                  columns={[
                    {
                      header: "Collected at",
                      cell: (s) => <span className="tabular-nums text-slate-600">{fmtIST(s.at)}</span>,
                      className: "whitespace-nowrap",
                    },
                    {
                      header: "Screen",
                      cell: (s) => <span className="font-medium text-slate-800">{s.screen}</span>,
                    },
                    {
                      header: "LCP (ms)",
                      cell: (s) => <span className="tabular-nums">{num(s.lcpMs)}</span>,
                      className: "whitespace-nowrap text-right",
                    },
                    {
                      header: "CLS",
                      cell: (s) => <span className="tabular-nums">{num(s.cls)}</span>,
                      className: "whitespace-nowrap text-right",
                    },
                    {
                      header: "TTFB (ms)",
                      cell: (s) => <span className="tabular-nums">{num(s.ttfbMs)}</span>,
                      className: "whitespace-nowrap text-right",
                    },
                    {
                      header: "FCP (ms)",
                      cell: (s) => <span className="tabular-nums">{num(s.fcpMs)}</span>,
                      className: "whitespace-nowrap text-right",
                    },
                  ]}
                />
              </div>
            </section>
          )}

          <section className="qubit-card overflow-hidden">
            <header className="border-b border-slate-100 px-4 py-3.5 md:px-5">
              <h2 className="text-[13.5px] font-semibold text-slate-800">Not collected by this deployment</h2>
              <p className="mt-0.5 text-[11.5px] text-slate-500">Signals the current collector does not capture — labeled, never extrapolated.</p>
            </header>
            <div className="px-4 py-2 md:px-5">
              <FactRow label="INP (Interaction to Next Paint)" value="Not collected" health="not-configured" note={data.inpNote} />
              <FactRow label="Per-route aggregation" value="Not configured" health="not-configured" note={data.routesNote} />
              <FactRow label="Browser JS errors" value="Not configured" health="not-configured" note={data.jsErrorsNote} />
            </div>
          </section>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" role="note">
            <div className="flex items-center gap-2">
              <Lock aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Privacy</p>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{data.privacy}</p>
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
