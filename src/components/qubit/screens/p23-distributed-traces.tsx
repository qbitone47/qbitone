"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, NotConfiguredCard, OpsError, OpsSkeleton, SourceLine, fmtIST, obsPost, useObsSection } from "../obs/parts";
import { toast } from "@/hooks/use-toast";

// ============================================================
// P23-04 · Distributed Traces — honest config state + one REAL
// measured synthetic probe trace on demand. No trace history is
// fabricated (§33): without an APM backend there is none.
// ============================================================

interface TraceSpan {
  name: string;
  startedAt: number;
  durationMs: number;
  status: string;
}

interface TraceResult {
  ok: boolean;
  traceId: string;
  spans: TraceSpan[];
  totalMs: number;
  note: string;
}

interface TracesPayload {
  configured: boolean;
  note: string;
  recommendation: string;
  syntheticProbe: { available: boolean; note: string };
  sourceNote: string;
}

function SpanTimeline({ spans }: { spans: TraceSpan[] }) {
  const t0 = spans[0]?.startedAt ?? 0;
  return (
    <ol className="space-y-0" aria-label="Probe trace spans, in execution order">
      {spans.map((s, i) => (
        <li key={i} className="relative flex items-center justify-between gap-3 py-3 pl-6 last:pb-0">
          {/* timeline rail + dot */}
          {i < spans.length - 1 && <span aria-hidden className="absolute left-[5px] top-6 h-[calc(100%-1rem)] w-px bg-slate-200" />}
          <span
            aria-hidden
            className={`absolute left-0 top-[1.15rem] h-[11px] w-[11px] rounded-full border-2 ${s.status === "ok" ? "border-emerald-500 bg-white" : "border-red-500 bg-white"}`}
          />
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium text-slate-800">{s.name}</p>
            <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
              start +{s.startedAt - t0} ms · <span className={s.status === "ok" ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>{s.status}</span>
            </p>
          </div>
          <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-slate-900">{s.durationMs} ms</span>
        </li>
      ))}
    </ol>
  );
}

export function P23DistributedTracesScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<TracesPayload>("traces");
  const [running, setRunning] = React.useState(false);
  const [trace, setTrace] = React.useState<TraceResult | null>(null);

  async function runProbe() {
    setRunning(true);
    try {
      const res = await obsPost<{ ok: boolean; data?: TraceResult }>("probe.trace");
      const inner = res.data;
      if (inner && Array.isArray(inner.spans)) {
        setTrace(inner);
        toast({ title: "Probe trace complete", description: `${inner.spans.length} spans measured · ${inner.totalMs} ms total.` });
      } else {
        toast({ variant: "destructive", title: "Probe trace failed", description: "The trace probe returned no measurable spans." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Probe trace failed", description: e instanceof Error ? e.message : "The trace probe could not be executed." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Distributed Traces"
        description="Request-tracing configuration state for this deployment — plus one real, measured synthetic probe trace on demand. Trace history is never simulated."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {!data.configured && (
            <NotConfiguredCard
              title="Distributed tracing not configured"
              note={data.note}
              recommendation={data.recommendation}
            />
          )}

          <SectionCard title="Real synthetic probe trace" description={data.syntheticProbe.note}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={runProbe}
                  disabled={running}
                  aria-busy={running}
                  aria-label="Run a real measured synthetic probe trace"
                  className="min-h-[44px] rounded-lg border border-slate-900 bg-slate-900 px-4 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {running ? "Tracing…" : "Run probe trace"}
                </button>
                {trace && (
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    Measured {fmtIST(Date.now(), false)} · {trace.spans.length} spans · {trace.totalMs} ms total
                  </p>
                )}
              </div>

              {trace ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <SpanTimeline spans={trace.spans} />
                  </div>
                  <div>
                    <FactRow label="Total duration" value={`${trace.totalMs} ms`} />
                    <FactRow label="Trace ID" value={<span className="font-mono text-[12px]">{trace.traceId}</span>} />
                    <FactRow label="Nature" value="Synthetic probe — clearly labeled" note={trace.note} />
                  </div>
                </div>
              ) : (
                <p className="text-[12px] leading-relaxed text-slate-500" role="status">
                  No probe trace has been run in this session. &ldquo;Run probe trace&rdquo; executes a real single request — session-plane work, one live SQL query and one live HTTP self-request — and reports only the durations it actually measured.
                </p>
              )}
            </div>
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
