"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { EnvBadge, FactRow, fmtIST, OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, useOpsSection } from "../ops/parts";

// ============================================================
// P22-01 · Production Environment Overview
// What is actually running right now — measured from the live
// runtime (Vercel-injected environment, live SQL probe, live
// HTTP self-probe) or honestly labeled Not configured.
// ============================================================

interface EnvironmentPayload {
  environment: string;
  environmentBadge: string;
  deploymentTarget: string;
  appVersion: string;
  gitCommit: string | null;
  gitBranch: string | null;
  deploymentTimestamp: number | null;
  deploymentNote: string;
  databaseStatus: string;
  dbLatencyMs: number | null;
  apiStatus: string;
  apiRttMs: number | null;
  authStatus: string;
  integrationsSummary: string;
  errorRate: number | null;
  errorRateNote: string;
  responseLatencyMs: number | null;
  uptime: { processUptimeMin: number; note: string };
  uptimePct: number | null;
  uptimeNote: string;
  activeIncidents: number;
  lastSuccessfulDeployment: number | null;
  lastDeploymentNote: string;
  currentRelease: string;
  sourceNote: string;
}

export function P22ProductionEnvironmentScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<EnvironmentPayload>("environment");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Production Environment Overview"
        description="The one honest answer to “what is running right now?” — every value measured from the live runtime or labeled Not configured."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {/* Identity banner */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-center gap-3">
              <EnvBadge env={data.environmentBadge === "production" ? "production" : data.environmentBadge === "preview" ? "preview" : "development"} />
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-bold text-slate-600">v{data.appVersion}</span>
              {data.gitCommit && <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-[10.5px] font-semibold text-slate-600">{data.gitCommit.slice(0, 7)}</span>}
              {data.gitBranch && <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-600">{data.gitBranch}</span>}
              <OpsHealthBadge health={data.databaseStatus === "Healthy" ? "healthy" : "unavailable"} />
              <OpsHealthBadge health={data.apiStatus === "Healthy" ? "healthy" : data.apiStatus === "Degraded" ? "degraded" : "unavailable"} />
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
              {data.deploymentTarget} · environment reported as <span className="font-semibold text-slate-800">{data.environment}</span>
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Runtime identity" description={data.deploymentNote}>
              <div>
                <FactRow label="Application version" value={`v${data.appVersion}`} />
                <FactRow label="Git commit" value={data.gitCommit ? <span className="font-mono text-[12px]">{data.gitCommit.slice(0, 12)}</span> : "Unavailable"} note={data.gitCommit ? "Injected by the Vercel runtime for this deployment." : undefined} />
                <FactRow label="Branch" value={data.gitBranch ?? "Unavailable"} />
                <FactRow label="Deployment timestamp" value={data.deploymentTimestamp ? fmtIST(data.deploymentTimestamp) : "Unavailable"} />
                <FactRow label="Current release" value={data.currentRelease} />
                <FactRow label="Last successful deployment" value={data.lastSuccessfulDeployment ? fmtIST(data.lastSuccessfulDeployment) : "Not configured"} note={data.lastDeploymentNote} />
              </div>
            </SectionCard>

            <SectionCard title="Live signals" description="Measured in this request — never cached into fiction.">
              <div>
                <FactRow label="Database status" value={data.dbLatencyMs != null ? `${data.dbLatencyMs} ms` : "—"} health={data.databaseStatus === "Healthy" ? "healthy" : "unavailable"} note="Live SELECT 1 against the configured PostgreSQL database." />
                <FactRow label="API self-probe" value={data.responseLatencyMs != null ? `${data.responseLatencyMs} ms` : "—"} health={data.apiStatus === "Healthy" ? "healthy" : data.apiStatus === "Degraded" ? "degraded" : "unavailable"} note="Real HTTP round-trip against this deployment." />
                <FactRow label="Authentication" value="Session plane active" health="healthy" note={data.authStatus} />
                <FactRow label="Error rate" value="Not configured" health="not-configured" note={data.errorRateNote} />
                <FactRow label="Uptime" value={data.uptimePct != null ? `${data.uptimePct}%` : "Not configured"} health="not-configured" note={data.uptimeNote} />
                <FactRow label="Process uptime" value={`${data.uptime.processUptimeMin} min`} note={data.uptime.note} />
                <FactRow label="Active incidents" value={data.activeIncidents} health={data.activeIncidents ? "degraded" : "healthy"} note="From the Production Incident Center (P22-23)." />
              </div>
            </SectionCard>
          </div>

          <SectionCard title="External integrations" description={data.integrationsSummary}>
            <p className="text-[12.5px] leading-relaxed text-slate-600">
              Integration states are derived from live probes and credential presence on <span className="font-semibold text-slate-800">Integration Health (P22-12)</span>. Core data plane: Supabase PostgreSQL. Management-plane integrations (Vercel REST, GitHub Actions) require their server-only tokens.
            </p>
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
