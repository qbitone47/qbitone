"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, NotConfiguredCard, OpsError, OpsSkeleton, OpsTable, SourceLine, fmtIST, timeAgo, useObsSection } from "../obs/parts";

// ============================================================
// P23-09 · Web Performance — REAL browser vitals collected by
// the client collector. In-session samples show this process's
// live state; the Phase 25 telemetry store aggregates the same
// events over 24h (persisted across sessions). Zero samples →
// honest empty state; nothing simulated.
// ============================================================

interface VitalsSample {
  at: number;
  screen: string;
  lcpMs: number | null;
  cls: number | null;
  ttfbMs: number | null;
  fcpMs: number | null;
}

interface PerScreenMedian {
  screen: string;
  samples: number;
  lcp: number | null;
  cls: number | null;
  ttfb: number | null;
  fcp: number | null;
  inp: number | null;
}

interface JsErrorItem {
  ts: number;
  message: string | null;
  screen: string | null;
  errorCode: string | null;
}

interface WebPerfPayload {
  collected: number;
  samples: VitalsSample[];
  aggregate: {
    windowNote: string;
    vitalsSamples: number;
    routeTransitions: number;
    perScreen: PerScreenMedian[];
    note: string;
  };
  jsErrors: { count: number; recent: JsErrorItem[]; note: string };
  inpNote: string;
  routesNote: string;
  privacy: string;
  sourceNote: string;
}

function num(v: number | null): string {
  return v != null ? String(v) : "—";
}

/** JS error messages are user-agent text — keep table cells dense, full text on hover. */
function truncate(v: string | null, max = 120): string {
  if (!v) return "—";
  const oneLine = v.split("\n")[0];
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
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
              note={data.aggregate.note}
              recommendation="Open the application in a browser session — the vitals collector POSTs real samples automatically as users browse. Nothing is simulated."
            />
          ) : (
            <section className="qubit-card overflow-hidden">
              <header className="border-b border-slate-100 px-4 py-3.5 md:px-5">
                <h2 className="text-[13.5px] font-semibold text-slate-800">Collected samples</h2>
                <p className="mt-0.5 text-[11.5px] text-slate-500">In-session samples held by this process — the same vitals are POSTed to the persisted Phase 25 telemetry store (24h aggregation below).</p>
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

          <SectionCard title="Client telemetry (last 24h, persisted)" description={data.aggregate.windowNote}>
            <FactRow
              label="Vital samples"
              value={data.aggregate.vitalsSamples}
              health={data.aggregate.vitalsSamples > 0 ? "healthy" : "unknown"}
            />
            <FactRow
              label="Route transitions"
              value={data.aggregate.routeTransitions}
              health={data.aggregate.routeTransitions > 0 ? "healthy" : "unknown"}
            />
            <FactRow
              label="Client JS errors"
              value={data.jsErrors.count}
              health={data.jsErrors.count === 0 ? "healthy" : "degraded"}
              note={data.jsErrors.count === 0 ? "No client JavaScript failures ingested in the window — the count is a real zero, not a suppressed value." : undefined}
            />
            <div className="mt-3">
              <OpsTable
                rows={data.aggregate.perScreen}
                keyOf={(r) => r.screen}
                empty={<p className="text-[12.5px] text-slate-500" role="status">No per-screen medians yet — aggregation appears as real persisted samples arrive.</p>}
                columns={[
                  { header: "Screen", cell: (r) => <span className="font-medium text-slate-800">{r.screen}</span> },
                  { header: "Samples", cell: (r) => <span className="tabular-nums">{r.samples}</span>, className: "text-right" },
                  { header: "LCP (ms)", cell: (r) => <span className="tabular-nums">{num(r.lcp)}</span>, className: "whitespace-nowrap text-right" },
                  { header: "CLS", cell: (r) => <span className="tabular-nums">{num(r.cls)}</span>, className: "whitespace-nowrap text-right" },
                  { header: "TTFB (ms)", cell: (r) => <span className="tabular-nums">{num(r.ttfb)}</span>, className: "whitespace-nowrap text-right" },
                  { header: "FCP (ms)", cell: (r) => <span className="tabular-nums">{num(r.fcp)}</span>, className: "whitespace-nowrap text-right" },
                  { header: "INP (ms)", cell: (r) => <span className="tabular-nums">{num(r.inp)}</span>, className: "whitespace-nowrap text-right" },
                ]}
              />
            </div>
            <div className="mt-3 space-y-1" role="note" aria-label="Aggregation notes">
              <p className="text-[11px] leading-relaxed text-slate-400">{data.aggregate.note}</p>
              <p className="text-[11px] leading-relaxed text-slate-400">{data.routesNote}</p>
              <p className="text-[11px] leading-relaxed text-slate-400">{data.inpNote}</p>
            </div>
          </SectionCard>

          <SectionCard title="Client JavaScript errors (last 24h)" description={data.jsErrors.note}>
            {data.jsErrors.recent.length === 0 ? (
              <p className="text-[12.5px] text-slate-500" role="status">
                No client JavaScript failures ingested in the window — an empty list here is a real zero (window.onerror / unhandledrejection feed this pipeline).
              </p>
            ) : (
              <OpsTable
                rows={data.jsErrors.recent}
                keyOf={(e) => `${e.ts}-${e.errorCode ?? ""}-${truncate(e.message, 40)}`}
                empty={<p className="text-[12.5px] text-slate-500" role="status">No recent client errors.</p>}
                maxH="max-h-72 overflow-y-auto"
                columns={[
                  {
                    header: "When",
                    cell: (e) => (
                      <span className="tabular-nums">
                        <span className="whitespace-nowrap">{fmtIST(e.ts)}</span>
                        <span className="block text-[10.5px] text-slate-400">{timeAgo(e.ts)}</span>
                      </span>
                    ),
                    className: "whitespace-nowrap",
                  },
                  { header: "Code", cell: (e) => <span className="font-mono text-[11px] text-slate-700">{e.errorCode ?? "—"}</span> },
                  { header: "Screen", cell: (e) => <span className="text-slate-700">{e.screen ?? "—"}</span> },
                  {
                    header: "Message",
                    cell: (e) => (
                      <span className="block max-w-md truncate font-mono text-[11px] text-slate-600" title={e.message ?? undefined}>
                        {truncate(e.message)}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </SectionCard>

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
