"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsSkeleton, SourceLine, fmtIST, useObsSection } from "../obs/parts";

// ============================================================
// P23-22 · Reliability Reports — a document generated from real
// figures only: live probes, the audit trail, governance
// registries and the Phase 25 telemetry store. Export is a
// client-side JSON download of exactly what the server produced —
// nothing is re-computed in the UI.
// ============================================================

interface ReportPayload {
  report: {
    generatedAt: number;
    window: string;
    availability: { probeHealth: string; probeLatencyMs: number | null; requestSuccessPct: number | null; note: string };
    requestTelemetry: { total: number; errorRatePct: number | null; p50: number | null; p95: number | null; p99: number | null; note: string };
    clientTelemetry: { jsErrors: number; vitalsSamples: number; note: string };
    sloCompliance: { slos: number; note: string };
    incidents: { open: number; total: number };
    errorTrend: { failuresInWindow: number; eventsLastHour: number };
    apiPerformance: { probeLatencyMs: number | null; note: string };
    databasePerformance: { probeLatencyMs: number | null; health: string };
    deploymentImpact: { currentCommit: string | null; note: string };
    dependencyHealth: { database: string; note: string };
    alertTrend: { total: number; triggered: number };
    capacity: { rssMb: number };
  };
  exportPolicy: string;
  scheduling: string;
  sourceNote: string;
}

const ms = (v: number | null) => (v != null ? `${v} ms` : "—");

const successTone = (pct: number | null): "healthy" | "degraded" | "not-configured" =>
  pct == null ? "not-configured" : pct >= 99.5 ? "healthy" : "degraded";

export function P23ReliabilityReportsScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<ReportPayload>("reports");
  const r = data?.report;

  function exportJson() {
    if (!r) return;
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qubit-reliability-report.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Reliability Reports"
        description="A generated reliability document whose every figure traces to a live probe, the audit trail, a governance registry or the Phase 25 telemetry store."
        actions={
          <>
            <button type="button" onClick={reload} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
              Refresh
            </button>
            <button
              type="button"
              onClick={exportJson}
              disabled={!r}
              className="min-h-[32px] rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export JSON
            </button>
          </>
        }
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && r && !loading && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5" role="document" aria-label="Reliability report document">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-[16px] font-bold tracking-tight text-slate-900">Reliability report</h2>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Generated <span className="tabular-nums">{fmtIST(r.generatedAt)}</span> · window: {r.window}
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-500">Machine-readable export available</span>
            </div>

            <div className="grid gap-x-8 pt-2 md:grid-cols-2">
              <div>
                <FactRow
                  label="Availability"
                  value={r.availability.probeHealth !== "healthy" ? r.availability.probeHealth : `Healthy · ${ms(r.availability.probeLatencyMs)}`}
                  health={r.availability.probeHealth}
                  note={r.availability.note}
                />
                <FactRow
                  label="SLO compliance"
                  value={`${r.sloCompliance.slos} defined`}
                  health={r.sloCompliance.slos > 0 ? "unknown" : "not-configured"}
                  note={r.sloCompliance.note}
                />
                <FactRow
                  label="Incidents (registry)"
                  value={`${r.incidents.open} open / ${r.incidents.total} total`}
                  health={r.incidents.open > 0 ? "degraded" : "healthy"}
                  note="Live counts from the incident registry — never estimated."
                />
                <FactRow
                  label="Error trend"
                  value={`${r.errorTrend.failuresInWindow} failures · ${r.errorTrend.eventsLastHour} events last hour`}
                  health={r.errorTrend.failuresInWindow > 0 ? "degraded" : "healthy"}
                  note="Derived from real audit results (Failure) in the window."
                />
                <FactRow
                  label="API performance"
                  value={ms(r.apiPerformance.probeLatencyMs)}
                  health="unknown"
                  note={r.apiPerformance.note}
                />
                <FactRow
                  label="Database performance"
                  value={`${ms(r.databasePerformance.probeLatencyMs)} · ${r.databasePerformance.health}`}
                  health={r.databasePerformance.health}
                  note="Measured by the shared SELECT 1 probe on this request."
                />
              </div>
              <div>
                <FactRow
                  label="Deployment impact"
                  value={r.deploymentImpact.currentCommit ? r.deploymentImpact.currentCommit.slice(0, 7) : "Unavailable"}
                  note={r.deploymentImpact.note}
                />
                <FactRow
                  label="Dependency health"
                  value={r.dependencyHealth.database}
                  health={r.dependencyHealth.database}
                  note={r.dependencyHealth.note}
                />
                <FactRow
                  label="Alert trend"
                  value={`${r.alertTrend.total} total · ${r.alertTrend.triggered} triggered`}
                  health={r.alertTrend.triggered > 0 ? "degraded" : "healthy"}
                  note="Live counts from the alerts registry."
                />
                <FactRow
                  label="Capacity"
                  value={`${r.capacity.rssMb} MB RSS`}
                  health="unknown"
                  note="Process memory of this server instance, measured on this request."
                />
              </div>
            </div>
          </div>

          <SectionCard
            title="Telemetry summary (24h)"
            description="Phase 25 telemetry figures over the last 24 hours — every number is measured from the real telemetry store; gaps are labeled."
          >
            <FactRow
              label="Request success %"
              value={r.availability.requestSuccessPct == null ? "Insufficient data" : `${r.availability.requestSuccessPct}%`}
              health={successTone(r.availability.requestSuccessPct)}
              note={r.availability.requestSuccessPct == null ? "No recorded requests in the window — no percentage is computed." : undefined}
            />
            <FactRow label="Requests total" value={r.requestTelemetry.total.toLocaleString()} />
            <FactRow
              label="Request error rate"
              value={r.requestTelemetry.errorRatePct == null ? "Insufficient data" : `${r.requestTelemetry.errorRatePct}%`}
              health={r.requestTelemetry.errorRatePct == null ? "not-configured" : r.requestTelemetry.errorRatePct > 0 ? "degraded" : "healthy"}
            />
            <FactRow
              label="Request latency p50 / p95 / p99"
              value={r.requestTelemetry.p50 == null && r.requestTelemetry.p95 == null && r.requestTelemetry.p99 == null ? "Insufficient data" : `${ms(r.requestTelemetry.p50)} / ${ms(r.requestTelemetry.p95)} / ${ms(r.requestTelemetry.p99)}`}
              health={r.requestTelemetry.p50 == null ? "not-configured" : "healthy"}
            />
            <p className="py-1 text-[11px] leading-relaxed text-slate-400" role="note">{r.requestTelemetry.note}</p>
            <FactRow
              label="Client JS errors"
              value={r.clientTelemetry.jsErrors}
              health={r.clientTelemetry.jsErrors > 0 ? "degraded" : "healthy"}
            />
            <FactRow label="Client vitals samples" value={r.clientTelemetry.vitalsSamples} health={r.clientTelemetry.vitalsSamples > 0 ? "healthy" : "not-configured"} />
            <p className="py-1 text-[11px] leading-relaxed text-slate-400" role="note">{r.clientTelemetry.note}</p>
          </SectionCard>

          <SectionCard title="Report governance" description="How this document may leave the screen.">
            <p className="text-[12.5px] leading-relaxed text-slate-600" role="note">{data.exportPolicy}</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600" role="note">{data.scheduling}</p>
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
