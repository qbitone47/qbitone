"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import {
  EnvBadge,
  FactRow,
  fmtIST,
  NotConfiguredCard,
  OpsError,
  OpsHealthBadge,
  OpsSkeleton,
  SourceLine,
  useOpsSection,
} from "../ops/parts";

// ============================================================
// P22-02 · Deployment Status
// The live production deployment as reported by the Vercel REST
// API (when VERCEL_TOKEN is configured), the previous deployment
// (the rollback candidate) and the CI run for the head commit.
// Without the token, runtime facts (commit, branch, environment)
// are still real — everything else is labeled Not configured.
// ============================================================

interface CurrentDeployment {
  id: string | null;
  state: string | null;
  lifecycle: string;
  commit: string | null;
  branch: string | null;
  environment: string | null;
  createdAt: number | null;
  durationSec: number | null;
  author: string | null;
  url: string | null;
  releaseVersion: string;
  rollbackAvailable: boolean | null;
}

interface PreviousDeployment {
  id: string;
  sha: string | null;
  branch: string | null;
  state: string;
  createdAt: number;
  ready?: number;
  creator?: string;
  url: string | null;
  target?: string | null;
}

interface CiRun {
  id: number;
  sha: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
}

interface DeploymentPayload {
  configured: boolean;
  ciConfigured: boolean;
  currentDeployment: CurrentDeployment;
  previousDeployment: PreviousDeployment | null;
  ci: { headRun: CiRun | null; note: string };
  sourceNote: string;
}

/** Ready → ready · Building/Queued/Deploying → degraded (in flux) · Failed/Cancelled → unavailable. */
function lifecycleHealth(lifecycle: string): string {
  switch (lifecycle) {
    case "Ready":
      return "ready";
    case "Building":
    case "Queued":
    case "Deploying":
      return "degraded";
    case "Failed":
    case "Cancelled":
      return "unavailable";
    default:
      return "unknown";
  }
}

function ciRunHealth(run: CiRun): string {
  if (run.status !== "completed") {
    return run.status === "queued" || run.status === "in_progress" ? "degraded" : "unknown";
  }
  if (run.conclusion === "success") return "healthy";
  if (run.conclusion === "failure" || run.conclusion === "timed_out") return "unavailable";
  return "unknown";
}

export function P22DeploymentStatusScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<DeploymentPayload>("deployment");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Deployment Status"
        description="The live production deployment as reported by the Vercel REST API, the previous deployment (the rollback candidate) and the CI run for its head commit — every unconfigured provider labeled honestly."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {!data.configured && (
            <NotConfiguredCard
              title="Vercel deployment API not configured"
              note="VERCEL_TOKEN is not configured in this runtime, so live deployment telemetry (lifecycle, duration, author, previous deployment) cannot be fetched — and is never simulated. Runtime facts below (commit, branch, environment) come from the deployment itself."
              recommendation="Add VERCEL_TOKEN as a server-only environment variable to enable live Vercel deployment telemetry."
            />
          )}

          {/* Identity banner */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]" role="status" aria-label="Current deployment identity">
            <div className="flex flex-wrap items-center gap-3">
              <EnvBadge env={data.currentDeployment.environment ?? "unknown"} />
              <OpsHealthBadge health={lifecycleHealth(data.currentDeployment.lifecycle)} />
              {data.currentDeployment.commit && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-[10.5px] font-semibold text-slate-600">
                  {data.currentDeployment.commit.slice(0, 7)}
                </span>
              )}
              {data.currentDeployment.branch && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-600">
                  {data.currentDeployment.branch}
                </span>
              )}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
              Release <span className="font-semibold text-slate-800">{data.currentDeployment.releaseVersion}</span> · lifecycle reported as{" "}
              <span className="font-semibold text-slate-800">{data.currentDeployment.lifecycle}</span>
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Current deployment" description="Facts about the deployment serving traffic right now.">
              <div>
                <FactRow
                  label="Deployment ID"
                  value={data.currentDeployment.id ? <span className="font-mono text-[12px]">{data.currentDeployment.id}</span> : "Unavailable"}
                />
                <FactRow label="Lifecycle state" value={data.currentDeployment.lifecycle} health={lifecycleHealth(data.currentDeployment.lifecycle)} />
                <FactRow label="Provider state" value={data.currentDeployment.state ?? "Unavailable"} note="Raw readyState as reported by the Vercel API." />
                <FactRow
                  label="Commit"
                  value={data.currentDeployment.commit ? <span className="font-mono text-[12px]">{data.currentDeployment.commit.slice(0, 12)}</span> : "Unavailable"}
                />
                <FactRow label="Branch" value={data.currentDeployment.branch ?? "Unavailable"} />
                <FactRow label="Environment" value={data.currentDeployment.environment ?? "Unavailable"} />
                <FactRow label="Created" value={data.currentDeployment.createdAt ? fmtIST(data.currentDeployment.createdAt) : "Unavailable"} />
                <FactRow
                  label="Build duration"
                  value={data.currentDeployment.durationSec != null ? `${data.currentDeployment.durationSec}s` : "—"}
                  note="Computed from the Vercel ready/created timestamps when both are present."
                />
                <FactRow label="Author" value={data.currentDeployment.author ?? "Unavailable"} />
                <FactRow
                  label="Deployment URL"
                  value={
                    data.currentDeployment.url ? (
                      <a
                        href={`https://${data.currentDeployment.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[12px] font-semibold text-slate-800 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-600"
                      >
                        {data.currentDeployment.url}
                      </a>
                    ) : (
                      "Unavailable"
                    )
                  }
                />
                <FactRow
                  label="Rollback availability"
                  value={data.currentDeployment.rollbackAvailable === null ? "Not configured" : data.currentDeployment.rollbackAvailable ? "Available" : "Not available"}
                  health={data.currentDeployment.rollbackAvailable === null ? "not-configured" : data.currentDeployment.rollbackAvailable ? "ready" : "unavailable"}
                  note={data.configured ? "Available when a prior production deployment exists to roll back to." : "Requires VERCEL_TOKEN to determine."}
                />
              </div>
            </SectionCard>

            <SectionCard title="Previous deployment" description="The prior production deployment visible through the Vercel API — the rollback candidate.">
              {data.previousDeployment ? (
                <div>
                  <FactRow label="Deployment ID" value={<span className="font-mono text-[12px]">{data.previousDeployment.id}</span>} />
                  <FactRow label="State" value={data.previousDeployment.state} />
                  <FactRow
                    label="Commit"
                    value={data.previousDeployment.sha ? <span className="font-mono text-[12px]">{data.previousDeployment.sha.slice(0, 12)}</span> : "Unavailable"}
                  />
                  <FactRow label="Branch" value={data.previousDeployment.branch ?? "Unavailable"} />
                  <FactRow label="Created" value={fmtIST(data.previousDeployment.createdAt)} />
                  <FactRow label="Creator" value={data.previousDeployment.creator ?? "Unknown"} />
                  <FactRow
                    label="Deployment URL"
                    value={
                      data.previousDeployment.url ? (
                        <a
                          href={`https://${data.previousDeployment.url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[12px] font-semibold text-slate-800 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-600"
                        >
                          {data.previousDeployment.url}
                        </a>
                      ) : (
                        "Unavailable"
                      )
                    }
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4" role="status">
                  <p className="text-[12.5px] font-semibold text-slate-700">
                    {data.configured ? "No previous production deployment is visible" : "Previous deployment telemetry is not configured"}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                    {data.configured
                      ? "The Vercel API returned a single production deployment — there is no rollback candidate to show, and none is invented."
                      : "Live previous-deployment telemetry requires VERCEL_TOKEN (see the notice at the top of this screen)."}
                  </p>
                </div>
              )}
            </SectionCard>
          </div>

          {data.ciConfigured ? (
            data.ci.headRun ? (
              <SectionCard title="CI status — head commit" description={data.ci.note}>
                <div>
                  <FactRow label="Run" value={`#${data.ci.headRun.id}`} />
                  <FactRow label="Head SHA" value={<span className="font-mono text-[12px]">{data.ci.headRun.sha}</span>} />
                  <FactRow
                    label="Status"
                    value={`${data.ci.headRun.status}${data.ci.headRun.conclusion ? ` · ${data.ci.headRun.conclusion}` : ""}`}
                    health={ciRunHealth(data.ci.headRun)}
                  />
                  <FactRow label="Created" value={fmtIST(new Date(data.ci.headRun.createdAt).getTime())} />
                </div>
              </SectionCard>
            ) : (
              <SectionCard title="CI status — head commit" description={data.ci.note}>
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4" role="status">
                  <p className="text-[12.5px] font-semibold text-slate-700">No workflow runs returned</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                    The GitHub API returned no runs for this repository — CI status stays empty, never guessed.
                  </p>
                </div>
              </SectionCard>
            )
          ) : (
            <NotConfiguredCard
              title="CI status not configured"
              note={data.ci.note}
              recommendation="Add GITHUB_TOKEN as a server-only environment variable to enable live GitHub Actions status."
            />
          )}

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
