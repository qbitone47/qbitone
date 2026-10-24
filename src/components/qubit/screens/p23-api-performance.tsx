"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsHealthBadge, OpsSkeleton, OpsTable, SourceLine, fmtIST, obsPost, useObsSection } from "../obs/parts";
import { toast } from "@/hooks/use-toast";

// ============================================================
// P23-07 · API Performance — endpoint manifest from the real
// route tree + REAL server-observed request telemetry (Phase 25
// withMeter metering: per-window totals, error rates, p50/p95/p99
// and per-route stats) + on-demand server-side probes. Percentiles
// appear only when ≥10 real samples exist; otherwise they are
// labeled Insufficient data, never estimated.
// ============================================================

interface Endpoint {
  endpoint: string;
  method: string;
  service: string;
}

interface ProbeResult extends Endpoint {
  httpStatus: number | null;
  latencyMs: number | null;
  health: string;
}

interface LiveStat {
  total: number;
  errorRatePct: number | null;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  sampleLabel: string;
}

interface RouteStat {
  route: string;
  count: number;
  errors: number;
  errorRatePct: number | null;
  p50: number | null;
  p95: number | null;
  p99: number | null;
}

interface ApiPerfPayload {
  endpoints: Endpoint[];
  probeResults: ProbeResult[] | null;
  live: { hour: LiveStat; day: LiveStat; perRoute: RouteStat[]; note: string };
  percentiles: { p50: number | null; p95: number | null; p99: number | null; basis: string } | null;
  percentilesNote: string;
  probeNote: string;
  lastProbeAt: number | null;
  sourceNote: string;
}

const msOrInsufficient = (v: number | null): string => (v == null ? "Insufficient data" : `${v} ms`);
const pctOrInsufficient = (v: number | null): string => (v == null ? "Insufficient data" : `${v}%`);
const dash = (v: number | null): string => (v == null ? "—" : String(v));

function methodBadge(method: string): React.ReactNode {
  return method === "POST" ? (
    <span className="inline-flex rounded-full border border-slate-900 bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">{method}</span>
  ) : (
    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">{method}</span>
  );
}

export function P23ApiPerformanceScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<ApiPerfPayload>("api-performance");
  const [probing, setProbing] = React.useState(false);
  const [probeResults, setProbeResults] = React.useState<ProbeResult[] | null>(null);
  const [lastProbeAt, setLastProbeAt] = React.useState<number | null>(null);

  async function runProbe() {
    setProbing(true);
    try {
      const res = await obsPost<{ ok: boolean; data?: { ok?: boolean; probeResults?: ProbeResult[]; lastProbeAt?: number | null; message?: string } }>("probe.apis");
      const inner = res.data;
      if (inner && Array.isArray(inner.probeResults)) {
        setProbeResults(inner.probeResults);
        setLastProbeAt(inner.lastProbeAt ?? null);
        toast({ title: "Endpoint probe complete", description: inner.message ?? `${inner.probeResults.length} endpoints probed with real server-side requests.` });
      } else {
        toast({ variant: "destructive", title: "Probe failed", description: inner?.message ?? "The probe returned no results." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Probe failed", description: e instanceof Error ? e.message : "The probe could not be executed." });
    } finally {
      setProbing(false);
    }
  }

  const showResults = probeResults !== null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="API Performance"
        description="The real API endpoint manifest, server-observed request telemetry from the metering layer, and on-demand latency probes. Protected endpoints answering 401 without a session are healthy — that is auth being enforced."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <section className="qubit-card overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 md:px-5">
              <div>
                <h2 className="text-[13.5px] font-semibold text-slate-800">Endpoint manifest</h2>
                <p className="mt-0.5 text-[11.5px] text-slate-500">{data.probeNote}</p>
              </div>
              <button
                type="button"
                onClick={runProbe}
                disabled={probing}
                aria-busy={probing}
                aria-label="Probe all listed endpoints with real server-side requests"
                className="min-h-[44px] rounded-lg border border-slate-900 bg-slate-900 px-4 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {probing ? "Probing…" : "Probe endpoints"}
              </button>
            </header>
            <div className="px-4 py-3 md:px-5">
              <OpsTable
                rows={data.endpoints}
                keyOf={(e) => `${e.method} ${e.endpoint}`}
                empty={<p className="text-[12.5px] text-slate-500" role="status">No endpoints are registered in the manifest.</p>}
                maxH="max-h-96 overflow-y-auto"
                columns={[
                  {
                    header: "Endpoint",
                    cell: (e) => <span className="font-mono text-[12px] text-slate-800">{e.endpoint}</span>,
                  },
                  {
                    header: "Method",
                    cell: (e) => methodBadge(e.method),
                    className: "whitespace-nowrap",
                  },
                  {
                    header: "Service",
                    cell: (e) => <span className="text-slate-600">{e.service}</span>,
                  },
                ]}
              />
            </div>
          </section>

          <section className="qubit-card overflow-hidden">
            <header className="border-b border-slate-100 px-4 py-3.5 md:px-5">
              <h2 className="text-[13.5px] font-semibold text-slate-800">Probe results</h2>
              <p className="mt-0.5 text-[11.5px] text-slate-500">
                {showResults
                  ? `Real single-request latencies measured ${lastProbeAt ? fmtIST(lastProbeAt) : "just now"}. 401 on protected endpoints is healthy (reachable + auth enforced).`
                  : "No probe has been run in this session — latencies appear only after an explicit probe."}
              </p>
            </header>
            <div className="px-4 py-3 md:px-5">
              {showResults ? (
                <OpsTable
                  rows={probeResults}
                  keyOf={(r) => `${r.method} ${r.endpoint}`}
                  empty={<p className="text-[12.5px] text-slate-500" role="status">The probe returned no endpoint results.</p>}
                  maxH="max-h-96 overflow-y-auto"
                  columns={[
                    {
                      header: "Endpoint",
                      cell: (r) => <span className="font-mono text-[12px] text-slate-800">{r.endpoint}</span>,
                    },
                    {
                      header: "Method",
                      cell: (r) => methodBadge(r.method),
                      className: "whitespace-nowrap",
                    },
                    {
                      header: "HTTP status",
                      cell: (r) => <span className="tabular-nums">{r.httpStatus ?? "—"}</span>,
                      className: "whitespace-nowrap text-right",
                    },
                    {
                      header: "Latency",
                      cell: (r) => <span className="tabular-nums">{r.latencyMs != null ? `${r.latencyMs} ms` : "—"}</span>,
                      className: "whitespace-nowrap text-right",
                    },
                    {
                      header: "Health",
                      cell: (r) => <OpsHealthBadge health={r.health} />,
                      className: "whitespace-nowrap",
                    },
                  ]}
                />
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 text-[12px] leading-relaxed text-slate-500" role="status">
                  Probe results are session-local and are not persisted server-side — run &ldquo;Probe endpoints&rdquo; to execute real requests now.
                </p>
              )}
            </div>
          </section>

          <SectionCard title="Live request telemetry (server-observed)" description={data.live.note}>
            <div className="grid gap-x-8 gap-y-1 lg:grid-cols-2">
              <div aria-label="Request telemetry for the last hour">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Last hour</p>
                <FactRow label="Requests" value={data.live.hour.total} note={data.live.hour.sampleLabel} />
                <FactRow label="Error rate" value={pctOrInsufficient(data.live.hour.errorRatePct)} health={data.live.hour.errorRatePct == null ? "not-configured" : data.live.hour.errorRatePct > 5 ? "degraded" : "healthy"} />
                <FactRow label="p50 latency" value={msOrInsufficient(data.live.hour.p50)} />
                <FactRow label="p95 latency" value={msOrInsufficient(data.live.hour.p95)} />
                <FactRow label="p99 latency" value={msOrInsufficient(data.live.hour.p99)} />
              </div>
              <div aria-label="Request telemetry for the last 24 hours">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Last 24 hours</p>
                <FactRow label="Requests" value={data.live.day.total} note={data.live.day.sampleLabel} />
                <FactRow label="Error rate" value={pctOrInsufficient(data.live.day.errorRatePct)} health={data.live.day.errorRatePct == null ? "not-configured" : data.live.day.errorRatePct > 5 ? "degraded" : "healthy"} />
                <FactRow label="p50 latency" value={msOrInsufficient(data.live.day.p50)} />
                <FactRow label="p95 latency" value={msOrInsufficient(data.live.day.p95)} />
                <FactRow label="p99 latency" value={msOrInsufficient(data.live.day.p99)} />
              </div>
            </div>
            <div className="mt-4">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Per-route · last hour (top {data.live.perRoute.length})</p>
              <OpsTable
                rows={data.live.perRoute}
                keyOf={(r) => r.route}
                empty={<p className="text-[12.5px] text-slate-500" role="status">No requests have been metered yet — the per-route table stays empty until real traffic flows.</p>}
                maxH="max-h-96 overflow-y-auto"
                columns={[
                  { header: "Route", cell: (r) => <span className="font-mono text-[11.5px] text-slate-800">{r.route}</span> },
                  { header: "Requests", cell: (r) => <span className="tabular-nums">{r.count}</span>, className: "text-right whitespace-nowrap" },
                  { header: "Errors", cell: (r) => <span className={`tabular-nums ${r.errors > 0 ? "font-semibold text-red-600" : ""}`}>{r.errors}</span>, className: "text-right whitespace-nowrap" },
                  { header: "Error rate", cell: (r) => <span className="tabular-nums">{dash(r.errorRatePct)}{r.errorRatePct != null ? "%" : ""}</span>, className: "text-right whitespace-nowrap" },
                  { header: "p50", cell: (r) => <span className="tabular-nums">{dash(r.p50)}</span>, className: "text-right whitespace-nowrap" },
                  { header: "p95", cell: (r) => <span className="tabular-nums">{dash(r.p95)}</span>, className: "text-right whitespace-nowrap" },
                  { header: "p99", cell: (r) => <span className="tabular-nums">{dash(r.p99)}</span>, className: "text-right whitespace-nowrap" },
                ]}
              />
            </div>
          </SectionCard>

          {data.percentiles ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" role="note">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Percentiles (p50 / p95 / p99) — Measured</p>
              <p className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-[12.5px] text-slate-800">
                <span className="tabular-nums"><span className="font-semibold">p50</span> {msOrInsufficient(data.percentiles.p50)}</span>
                <span className="tabular-nums"><span className="font-semibold">p95</span> {msOrInsufficient(data.percentiles.p95)}</span>
                <span className="tabular-nums"><span className="font-semibold">p99</span> {msOrInsufficient(data.percentiles.p99)}</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Basis: {data.percentiles.basis}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{data.percentilesNote}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" role="note">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Percentiles (p50 / p95 / p99) — Insufficient data</p>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{data.percentilesNote}</p>
            </div>
          )}

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
