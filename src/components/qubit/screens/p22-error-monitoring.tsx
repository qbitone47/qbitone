"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard, StatusBadge } from "../primitives";
import { NotConfiguredCard, OpsError, OpsSkeleton, SourceLine, useOpsSection } from "../ops/parts";

// ============================================================
// P22-08 · Error Monitoring
// The honest state of error telemetry: no aggregator installed
// (NotConfiguredCard), an in-process register that records
// nothing until its reporting paths are wired, and the real
// high-severity / failure records that DO exist — the one
// enterprise audit trail.
// ============================================================

interface AuditException {
  id: string;
  ts: number;
  time: string;
  actor: string;
  actorId: string;
  action: string;
  resource: string;
  result: string;
  severity: string;
  source: string;
  ipMasked: string;
  correlationId: string;
  context: string;
}

interface ErrorsPayload {
  aggregator: { configured: boolean; provider: string | null; note: string };
  register: unknown[];
  registerNote: string;
  auditExceptions: AuditException[];
  auditNote: string;
  statuses: string[];
  sourceNote: string;
}

export function P22ErrorMonitoringScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<ErrorsPayload>("errors");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Error Monitoring"
        description="Error telemetry in its actual state: no aggregator installed, an empty in-process register, and the real audit-trail exceptions that do exist — nothing simulated in between."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {!data.aggregator.configured && (
            <NotConfiguredCard
              title="Error aggregator not configured"
              note={data.aggregator.note}
              recommendation="Install Sentry (or equivalent) and set its DSN as a server-only environment variable."
            />
          )}

          <SectionCard title="In-process error register" description="An application-level register — it records nothing until reporting code paths are wired.">
            {data.register.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4" role="status">
                <p className="text-[12.5px] font-semibold text-slate-700">Register empty — zero entries recorded</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{data.registerNote}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.register.map((entry, i) => (
                  <p key={i} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-700">
                    {String(entry)}
                  </p>
                ))}
              </div>
            )}
            {data.statuses.length > 0 && (
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">Status vocabulary held by the backend: {data.statuses.join(" · ")}</p>
            )}
          </SectionCard>

          <SectionCard title="From the audit trail" description={data.auditNote}>
            {data.auditExceptions.length ? (
              <div>
                {data.auditExceptions.map((e) => (
                  <div key={e.id} className="border-b border-slate-100 py-2.5 last:border-b-0">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <p className="font-mono text-[12px] font-semibold text-slate-800">{e.action}</p>
                      <StatusBadge status={e.severity} size="sm" />
                    </div>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
                      Resource <span className="font-mono text-slate-600">{e.resource || "—"}</span> · result {e.result} ·{" "}
                      <span className="tabular-nums text-slate-500">{e.time}</span>
                    </p>
                    {e.context && <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{e.context}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-slate-500" role="status">
                No high-severity or failure records exist in the recent audit trail — this screen shows none rather than inventing any.
              </p>
            )}
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
