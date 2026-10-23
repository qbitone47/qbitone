"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { NotConfiguredCard, OpsError, OpsSkeleton, OpsTable, SourceLine, useOpsSection } from "../ops/parts";

// ============================================================
// P22-11 · Background Jobs Monitor
// Honest empty state: no worker/queue layer exists (intentional
// per deployment spec). This screen establishes the status
// vocabulary it WILL use when real jobs exist — no simulated
// workers, queues or rows are ever rendered.
// ============================================================

interface JobsPayload {
  configured: boolean;
  jobs: { id: string; name: string; status: string }[];
  note: string;
  statuses: string[];
  sourceNote: string;
}

interface JobRow {
  id: string;
  name: string;
  status: string;
}

export function P22BackgroundJobsScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<JobsPayload>("jobs");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Background Jobs Monitor"
        description="Worker and queue observability. When job infrastructure exists, this screen monitors it — today it reports, honestly, that none exists."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {!data.configured && (
            <NotConfiguredCard
              title="Background job infrastructure not configured"
              note={data.note}
              recommendation="Introduce a worker/queue layer only when real workloads justify it (spec: Redis intentionally deferred)."
            />
          )}

          {/* Status vocabulary this screen WILL use when jobs exist */}
          <SectionCard title="Status vocabulary" description="The exact job states this monitor will render once a queue layer exists.">
            <div className="flex flex-wrap gap-2" role="list" aria-label="Background job status vocabulary">
              {data.statuses.map((s) => (
                <span
                  key={s}
                  role="listitem"
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11.5px] font-semibold text-slate-600"
                >
                  {s}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              Fixed vocabulary — not live statuses. It is shown so operators can see what will be observable when the layer lands.
            </p>
          </SectionCard>

          <SectionCard title="Jobs" description="Real job rows only — the register is empty because the infrastructure is absent.">
            <OpsTable<JobRow>
              rows={data.jobs as JobRow[]}
              keyOf={(r) => r.id}
              columns={[
                { header: "Job", cell: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
                { header: "Status", cell: (r) => <span className="font-semibold">{r.status}</span> },
                { header: "ID", cell: (r) => <span className="font-mono text-[11.5px] text-slate-500">{r.id}</span> },
              ]}
              empty={
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center">
                  <p className="text-[13px] font-semibold text-slate-700">No jobs recorded</p>
                  <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-slate-500">
                    There is no queue to enqueue into and no worker to process from, so this table is empty by reality — not by filtering. Scheduled reports and notification digests run in-process and are visible in their own modules.
                  </p>
                </div>
              }
            />
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
