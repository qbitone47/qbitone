"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, NotConfiguredCard, OpsError, OpsSkeleton, SourceLine, useOpsSection } from "../ops/parts";

// ============================================================
// P22-10 · Uptime Monitoring
// No external prober exists, so no uptime percentage, latency
// series or incident history is shown — and none is invented.
// The only real measurement is this instance's process uptime,
// which is explicitly NOT availability.
// ============================================================

interface UptimePayload {
  configured: boolean;
  monitors: unknown[];
  note: string;
  processUptimeMin: number;
  processNote: string;
  sourceNote: string;
}

export function P22UptimeMonitoringScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<UptimePayload>("uptime");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Uptime Monitoring"
        description="Availability monitoring in its actual state: no external monitor is configured, so no percentage is computed, drawn or implied. The one real measurement is process uptime."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {!data.configured && (
            <NotConfiguredCard
              title="Uptime monitoring not configured"
              note={data.note}
              recommendation="Configure an external HTTP monitor (e.g. Better Stack, UptimeRobot) against the production URL."
            />
          )}

          <SectionCard title="The only real measurement" description="One FactRow. No percentage appears anywhere on this screen because none can be measured.">
            <div>
              <FactRow label="Process uptime" value={`${data.processUptimeMin} min`} note={data.processNote} />
            </div>
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
