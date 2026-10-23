"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, NotConfiguredCard, OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, fmtIST, timeAgo, useObsSection } from "../obs/parts";

// ============================================================
// P23-17 · Deployment Impact Analysis — before/after deltas from
// REAL audit-event counts around each deployment timestamp. Where
// telemetry cannot support a delta (latency, incidents), the field
// says so verbatim instead of inventing a number.
// ============================================================

interface ImpactDeployment {
  id: string; sha: string | null; createdAt: number; state: string;
  errorChange: { before: number; after: number };
  eventChange: { before: number; after: number };
  latencyChange: number | null;
  latencyNote: string;
  affectedRoutes: string[];
  incidentChange: number | null;
  incidentNote: string;
}

interface DeploymentImpactPayload {
  configured: boolean;
  current: { commit: string | null; branch: string | null };
  deployments: ImpactDeployment[];
  method: string;
  sourceNote: string;
}

/** readyState → health vocabulary (case-insensitive; unmapped → unknown). */
function stateHealth(state: string): string {
  const s = state.toLowerCase();
  if (s === "ready") return "healthy";
  if (s === "error") return "unavailable";
  return "unknown"; // building / queued / initializing / canceled / unknown
}

function DeltaStat({ label, before, after }: { label: string; before: number; after: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-slate-800">
        {before}
        <span aria-hidden className="mx-1.5 text-slate-400">→</span>
        {after}
      </p>
    </div>
  );
}

export function P23DeploymentImpactScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<DeploymentImpactPayload>("deployment-impact");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Deployment Impact Analysis"
        description="Before/after windows of real audit-event counts around each production deployment. Deltas that telemetry cannot support are labeled — never estimated."
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
          {data.configured === false && (
            <NotConfiguredCard
              title="Deployment list unavailable"
              note="VERCEL_TOKEN not configured — deployment list unavailable; only the current runtime deployment is known."
              recommendation="Set VERCEL_TOKEN as a server-only environment variable in the deployment platform. The production deployment list then flows live from the Vercel REST API and impact deltas are computed around each deployment timestamp."
            />
          )}

          <SectionCard title="Current runtime deployment" description="Real facts read from this runtime — available regardless of the deployment list.">
            <FactRow label="Commit" value={data.current.commit ? data.current.commit.slice(0, 7) : "Unavailable"} note={data.current.commit ?? undefined} />
            <FactRow label="Branch" value={data.current.branch ?? "Unknown"} />
          </SectionCard>

          {data.configured === true && (
            <SectionCard title="Deployments" description="Newest first, from the Vercel REST API — with before/after audit-event deltas.">
              {data.deployments.length === 0 ? (
                <p className="py-8 text-center text-[12.5px] text-slate-500">
                  No deployments returned by the Vercel API for production yet — the list fills as real deployments happen.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {data.deployments.map((d) => (
                    <li key={d.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <OpsHealthBadge health={stateHealth(d.state)} />
                          <span className="font-mono text-[12px] font-semibold text-slate-800">{d.sha ? d.sha.slice(0, 7) : "sha unavailable"}</span>
                          <span className="truncate font-mono text-[10.5px] text-slate-400">{d.id}</span>
                        </div>
                        <span className="text-[11px] tabular-nums text-slate-500">
                          {d.createdAt ? (
                            <>
                              <span className="whitespace-nowrap">{fmtIST(d.createdAt)}</span>
                              <span className="text-slate-400"> · {timeAgo(d.createdAt)}</span>
                            </>
                          ) : "time unavailable"}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <DeltaStat label="Audit failures · 24h before → since" before={d.errorChange.before} after={d.errorChange.after} />
                        <DeltaStat label="Audit events · 24h before → since" before={d.eventChange.before} after={d.eventChange.after} />
                      </div>
                      <div className="mt-3">
                        <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">Affected routes (from real audit records)</p>
                        {d.affectedRoutes.length === 0 ? (
                          <p className="mt-1 text-[12px] text-slate-500">None recorded in the window since this deployment.</p>
                        ) : (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {d.affectedRoutes.map((route) => (
                              <span key={route} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600">{route}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      {d.latencyChange === null && (
                        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] leading-relaxed text-slate-500" role="note">
                          <span className="font-semibold text-slate-600">Latency delta — not computed: </span>{d.latencyNote}
                        </p>
                      )}
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-400" role="note">{d.incidentNote}</p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}

          <SectionCard title="Method" description="How every delta on this screen is computed.">
            <FactRow label="Before/after windows" value="Real audit-event counts" note={data.method} />
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
