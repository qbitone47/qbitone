"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, fmtIST, timeAgo, useObsSection } from "../obs/parts";

// ============================================================
// P23-01 · Observability Home — "Is Qubit One healthy right now?"
// Live probes + audit-derived signals + Phase 25 real telemetry
// (availability, error rate, request volume, client errors,
// pipeline persistence) + governance registries. Absent telemetry
// is labeled, never invented.
// ============================================================

interface HomePayload {
  overall: string;
  environment: string;
  commit: string | null;
  signals: {
    database: { health: string; latencyMs: number | null; note: string };
    api: { health: string; latencyMs: number | null; note: string };
    availability: { value: number | null; note: string };
    errorRate: { value: number | null; note: string };
    requestVolume: { value: number; note: string };
    clientErrorsLastHour: number;
    telemetry: { persistence: string; note: string }; // "ok" | "degraded" | "unavailable"
    auditFailuresLastHour: number;
    auditEventsLastHour: number;
    sloCompliance: { value: string | null; note: string };
  };
  activeIncidents: { id: string; severity: string; title: string; status: string; startedAt: number }[];
  activeAlerts: { id: string; severity: string; name: string; status: string; triggeredAt: number }[];
  deployment: { onVercel: boolean; commit: string | null; branch: string | null; note: string };
  criticalEvents: { ts: number; action: string; resource: string; severity: string; result: string; context?: string }[];
  sourceNote: string;
}

const overallTone: Record<string, string> = {
  Healthy: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Degraded: "border-amber-200 bg-amber-50 text-amber-800",
  "Attention required": "border-red-200 bg-red-50 text-red-800",
};

const persistenceHealth: Record<string, string> = {
  ok: "healthy",
  degraded: "degraded",
  unavailable: "unavailable",
};

export function P23ObservabilityHomeScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<HomePayload>("home");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Observability Home"
        description="Is Qubit One healthy right now? Every value below is measured live or derived from real system records — the rest is labeled honestly."
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
          <div className={`rounded-2xl border p-5 ${overallTone[data.overall] ?? overallTone.Degraded}`} role="status">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">Overall — is Qubit One healthy?</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{data.overall}</p>
                <p className="mt-1 text-[12px] opacity-80">
                  Environment {data.environment}{data.commit ? ` · commit ${data.commit.slice(0, 7)}` : ""} · measured {fmtIST(Date.now(), false)}
                </p>
              </div>
              {data.activeIncidents.length > 0 && (
                <span className="rounded-full border border-red-300 bg-white px-3 py-1 text-[11px] font-bold text-red-800">
                  {data.activeIncidents.length} active incident{data.activeIncidents.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Live signals" description="Measured in this request — probes imported from the Phase 22 backend.">
              <div>
                <FactRow label="Database" value={data.signals.database.latencyMs != null ? `${data.signals.database.latencyMs} ms` : "—"} health={data.signals.database.health} note={data.signals.database.note} />
                <FactRow label="API self-probe" value={data.signals.api.latencyMs != null ? `${data.signals.api.latencyMs} ms` : "—"} health={data.signals.api.health} note={data.signals.api.note} />
                <FactRow
                  label="Availability"
                  value={data.signals.availability.value == null ? "Insufficient data" : `${data.signals.availability.value}%`}
                  health={data.signals.availability.value == null ? "not-configured" : data.signals.availability.value < 99.5 ? "degraded" : "healthy"}
                  note={data.signals.availability.note}
                />
                <FactRow
                  label="Error rate"
                  value={data.signals.errorRate.value == null ? "Insufficient data" : `${data.signals.errorRate.value}%`}
                  health={data.signals.errorRate.value == null ? "not-configured" : data.signals.errorRate.value > 5 ? "degraded" : "healthy"}
                  note={data.signals.errorRate.note}
                />
                <FactRow label="Request volume · last hour" value={data.signals.requestVolume.value} note={data.signals.requestVolume.note} />
                <FactRow label="Client JS errors · last hour" value={data.signals.clientErrorsLastHour} health={data.signals.clientErrorsLastHour > 0 ? "degraded" : "healthy"} note="Real window.onerror / unhandledrejection reports ingested from clients (Phase 25)." />
                <FactRow label="Telemetry pipeline" value={data.signals.telemetry.persistence} health={persistenceHealth[data.signals.telemetry.persistence] ?? "unknown"} note={data.signals.telemetry.note} />
                <FactRow label="Audit events · last hour" value={data.signals.auditEventsLastHour} note="Derived from real audit timestamps." />
                <FactRow label="Audit failures · last hour" value={data.signals.auditFailuresLastHour} health={data.signals.auditFailuresLastHour ? "degraded" : "healthy"} note="Real Failure records in the window." />
                <FactRow label="SLO compliance" value={data.signals.sloCompliance.value ?? "Not configured"} health="not-configured" note={data.signals.sloCompliance.note} />
              </div>
            </SectionCard>

            <SectionCard title="Active incidents & alerts" description="From the Phase 22 registries — drillable to their source screens.">
              {data.activeIncidents.length === 0 && data.activeAlerts.length === 0 ? (
                <p className="text-[12.5px] text-slate-500">No active incidents or triggered alerts on record.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.activeIncidents.map((i) => (
                    <div key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/50 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-semibold text-slate-800">{i.severity} · {i.title}</p>
                        <p className="text-[11px] text-slate-500">{i.id} · started {timeAgo(i.startedAt)}</p>
                      </div>
                      <OpsHealthBadge health="degraded" />
                    </div>
                  ))}
                  {data.activeAlerts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/50 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-semibold text-slate-800">{a.name}</p>
                        <p className="text-[11px] text-slate-500">{a.id} · triggered {timeAgo(a.triggeredAt)}</p>
                      </div>
                      <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-bold text-amber-800">{a.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Deployment & critical events" description={data.deployment.note}>
            <FactRow label="Current deployment" value={data.deployment.commit ? data.deployment.commit.slice(0, 7) : "Unavailable"} note={data.deployment.branch ? `branch ${data.deployment.branch}` : undefined} />
            {data.criticalEvents.length === 0 ? (
              <p className="mt-2 text-[12px] text-slate-500">No Critical/High severity events in the current audit window.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {data.criticalEvents.map((e, idx) => (
                  <li key={idx} className="flex flex-wrap items-baseline gap-2 text-[12px] text-slate-600">
                    <span className="font-medium tabular-nums text-slate-400">{fmtIST(e.ts, false)}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600">{e.action}</span>
                    <span className="truncate">{e.resource}</span>
                    <span className={`text-[10.5px] font-bold ${e.result === "Failure" ? "text-red-600" : "text-slate-400"}`}>{e.result}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
