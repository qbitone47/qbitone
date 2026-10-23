"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { EnvBadge, FactRow, fmtIST, NotConfiguredCard, OpsError, OpsHealthBadge, OpsSkeleton, OpsTable, SourceLine, opsPost, timeAgo, useOpsSection } from "../ops/parts";
import { HighRiskDialog } from "../platform/parts";

// ============================================================
// P22-19 · Rollback Center
// What to go back to, and exactly what a rollback does and does
// not touch. Rollback is token-gated, confirm-gated and audited
// server-side; the UI never executes anything without an
// explicit confirmation through the high-risk dialog.
// ============================================================

interface RollbackDeployment { deploymentId: string; commit: string | null; timestamp: number; state: string; }

interface RollbackPayload {
  configured: boolean;
  currentRelease: { version: string; commit: string | null; branch: string | null; environment: string | null };
  previousStable: RollbackDeployment | null;
  available: RollbackDeployment[];
  rollbackReadiness: string;
  authorizationNote: string;
  impactNote: string;
  dbWarning: string;
  sourceNote: string;
}

interface ActionResult { ok?: boolean; message?: string; data?: { ok?: boolean; message?: string } }

function stateHealth(state: string): string {
  if (state === "Ready") return "ready";
  if (state === "Failed" || state === "Cancelled") return "unavailable";
  return "unknown";
}

export function P22RollbackCenterScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<RollbackPayload>("rollback");
  const [busy, setBusy] = React.useState(false);
  const [target, setTarget] = React.useState<RollbackDeployment | null>(null);

  const executeRollback = async () => {
    if (!target) return;
    const deploymentId = target.deploymentId;
    setBusy(true);
    try {
      const res = await opsPost<ActionResult>("rollback.execute", { deploymentId }, undefined, true);
      const inner = res.data ?? res;
      if (inner.ok === false) {
        toast({ title: "Rollback not completed", description: inner.message ?? "The provider did not confirm a rollback — nothing is claimed.", variant: "destructive" });
      } else {
        toast({ title: "Rollback requested", description: inner.message ?? "Verify the new Ready deployment in Deployment Status." });
      }
      setTarget(null);
      reload();
    } catch (e) {
      toast({ title: "Rollback failed", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Rollback Center"
        description="What to go back to — and exactly what a rollback does and does not touch. Never executed without explicit confirmation."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <SectionCard title="Current release" description="What production serves right now, measured from the runtime.">
            <div>
              <FactRow label="Version" value={`v${data.currentRelease.version}`} />
              <FactRow
                label="Commit"
                value={data.currentRelease.commit ? <span className="font-mono text-[12px]">{data.currentRelease.commit.slice(0, 12)}</span> : "Unknown"}
              />
              <FactRow label="Branch" value={data.currentRelease.branch ?? "Unknown"} />
              <FactRow
                label="Environment"
                value={data.currentRelease.environment ? <EnvBadge env={data.currentRelease.environment} /> : "Unknown"}
              />
              <FactRow
                label="Previous stable"
                value={
                  data.previousStable
                    ? <span className="font-mono text-[12px]">{data.previousStable.commit ? data.previousStable.commit.slice(0, 7) : data.previousStable.deploymentId}</span>
                    : data.configured
                      ? "None yet — fewer than two deployments are recorded."
                      : "Unknown (enable VERCEL_TOKEN)"
                }
                note="The deployment production served immediately before the current one."
              />
            </div>
          </SectionCard>

          {!data.configured && (
            <NotConfiguredCard
              title="Rollback targets not configured"
              note={data.sourceNote}
              recommendation="Add VERCEL_TOKEN as a server-only environment variable to enable real rollback targets from the Vercel REST API."
            />
          )}

          {data.configured && (
            <SectionCard title="Available rollback targets" description={data.authorizationNote}>
              <OpsTable
                rows={data.available}
                keyOf={(r) => r.deploymentId}
                empty={
                  <p className="py-8 text-center text-[12.5px] text-slate-500">
                    No previous deployments are available — with fewer than two recorded deployments there is nothing to roll back to, and this screen will not pretend otherwise.
                  </p>
                }
                columns={[
                  { header: "Deployment", cell: (r) => <span className="font-mono text-[11.5px] text-slate-600">{r.deploymentId.slice(0, 16)}</span> },
                  { header: "Commit", cell: (r) => (r.commit ? <span className="font-mono text-[12px]">{r.commit.slice(0, 7)}</span> : <span className="text-slate-400">—</span>) },
                  {
                    header: "When",
                    cell: (r) => (
                      <span className="tabular-nums">
                        <span className="whitespace-nowrap">{fmtIST(r.timestamp)}</span>
                        <span className="block text-[10.5px] text-slate-400">{timeAgo(r.timestamp)}</span>
                      </span>
                    ),
                  },
                  { header: "State", cell: (r) => <OpsHealthBadge health={stateHealth(r.state)} /> },
                  {
                    header: "Action",
                    cell: (r) =>
                      data.previousStable?.deploymentId === r.deploymentId ? (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setTarget(r)} className="min-h-[36px]">
                          Roll back to this deployment
                        </Button>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      ),
                  },
                ]}
              />
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                Readiness:{" "}
                {data.rollbackReadiness === "ready"
                  ? "a previous stable deployment exists."
                  : data.rollbackReadiness === "single-deployment"
                    ? "only one deployment is recorded — no rollback target yet."
                    : "not configured."}{" "}
                Only the previous stable deployment exposes a rollback action; older targets are listed for reference.
              </p>
            </SectionCard>
          )}

          <SourceLine>{data.sourceNote}</SourceLine>

          <HighRiskDialog
            open={target !== null}
            title="Roll back production deployment?"
            description={`Affected environment: production. Target deployment ${target?.deploymentId ?? ""}${
              target?.commit ? ` (commit ${target.commit.slice(0, 7)})` : ""
            } will be redeployed as the current production release.${data ? ` ${data.impactNote}` : ""}`}
            confirmPhrase=""
            extra={
              data ? (
                <div className="mt-3 space-y-2">
                  <div className="rounded-lg border border-red-300 bg-red-50 p-3" role="alert">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-red-800">Database warning</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-red-800">{data.dbWarning}</p>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    No confirmation phrase is required for rollback — reviewing the impact above and pressing Confirm is the gate. The server re-validates your role and the confirmation independently.
                  </p>
                </div>
              ) : undefined
            }
            onConfirm={() => { void executeRollback(); }}
            onCancel={() => setTarget(null)}
          />
        </div>
      )}
    </div>
  );
}
