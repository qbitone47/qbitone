"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { OpsError, OpsHealthBadge, OpsSkeleton, OpsTable, SourceLine, fmtIST, obsPost, useObsSection } from "../obs/parts";
import { toast } from "@/hooks/use-toast";

// ============================================================
// P23-07 · API Performance — endpoint manifest from the real
// route tree + REAL on-demand server-side probes. Latencies come
// only from explicit probes; percentiles do not exist (no
// request-level telemetry) and are labeled Not configured.
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

interface ApiPerfPayload {
  endpoints: Endpoint[];
  probeResults: ProbeResult[] | null;
  percentiles: unknown;
  percentilesNote: string;
  probeNote: string;
  lastProbeAt: number | null;
  sourceNote: string;
}

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
        description="The real API endpoint manifest with on-demand latency probes. Protected endpoints answering 401 without a session are healthy — that is auth being enforced."
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

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" role="note">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Percentiles (p50 / p95 / p99) — Not configured</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{data.percentilesNote}</p>
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
