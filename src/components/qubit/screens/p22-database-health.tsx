"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, fmtIST, OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, useOpsSection } from "../ops/parts";

// ============================================================
// P22-04 · Database Health
// One live probe (SELECT 1) plus the provider facts the runtime
// can honestly see. Pool / connections / size introspection needs
// management APIs that are not configured — shown as Not available,
// never estimated.
// ============================================================

interface DatabasePayload {
  health: "healthy" | "unavailable";
  latencyMs: number | null;
  provider: string;
  host: string | null;
  supabaseStatus: string;
  poolStatus: string | null;
  poolNote: string;
  activeConnections: number | null;
  activeConnectionsNote: string;
  databaseSize: string | null;
  databaseSizeNote: string;
  migrationStatus: string;
  models: string[];
  modelsNote: string;
  lastSuccessfulQueryAt: number | null;
  errorCount: number;
  errorCountNote: string;
  checkedAt: number;
  note: string;
  sourceNote: string;
}

export function P22DatabaseHealthScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<DatabasePayload>("database");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Database Health"
        description="The configured PostgreSQL data plane, measured by a real query on every view — with everything the runtime cannot introspect labeled honestly."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {/* Live probe banner */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]" role="status" aria-label={`Database health: ${data.health}`}>
            <div className="flex flex-wrap items-center gap-3">
              <OpsHealthBadge health={data.health === "healthy" ? "healthy" : "unavailable"} />
              <span className="text-[13px] font-semibold text-slate-800">
                {data.health === "healthy" ? "Database responding" : "Database not responding"}
              </span>
              {data.health === "healthy" && data.latencyMs != null && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-bold tabular-nums text-slate-600">{data.latencyMs} ms</span>
              )}
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-slate-600">{data.note}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Provider & connectivity" description="Identity of the configured data plane.">
              <div>
                <FactRow label="Provider" value={data.provider} note="Derived from the DATABASE_URL scheme at request time." />
                <FactRow
                  label="Host"
                  value={data.host ? <span className="font-mono text-[12px]">{data.host}</span> : "Not available"}
                  note={data.host ? "Host only — credentials, ports and query strings are never displayed." : undefined}
                />
                <FactRow label="Supabase status" value={data.supabaseStatus} health={data.supabaseStatus.startsWith("Connected") ? "connected" : "unknown"} note="Recognized by the Supabase pooler endpoint in the host." />
                <FactRow label="Last successful query" value={data.lastSuccessfulQueryAt ? fmtIST(data.lastSuccessfulQueryAt) : "—"} health={data.lastSuccessfulQueryAt ? "healthy" : "unavailable"} note="Timestamp of the SELECT 1 executed for THIS view." />
                <FactRow label="Probe errors" value={data.errorCount} health={data.errorCount === 0 ? "healthy" : "unavailable"} note={data.errorCountNote} />
              </div>
            </SectionCard>

            <SectionCard title="Schema & introspection" description="What Prisma actually sees — and what it cannot.">
              <div>
                <FactRow label="Migration status" value={data.migrationStatus} note="Schema management reality for this repository." />
                <FactRow label="Models" value={data.models.join(", ")} note={data.modelsNote} />
                <FactRow label="Pool status" value="Not available" health="not-configured" note={data.poolNote} />
                <FactRow label="Active connections" value="Not available" health="not-configured" note={data.activeConnectionsNote} />
                <FactRow label="Database size" value="Not available" health="not-configured" note={data.databaseSizeNote} />
              </div>
            </SectionCard>
          </div>

          <SourceLine>
            {data.sourceNote} · Checked {fmtIST(data.checkedAt)}
          </SourceLine>
        </div>
      )}
    </div>
  );
}
