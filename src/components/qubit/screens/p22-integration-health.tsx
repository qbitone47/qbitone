"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsHealthBadge, OpsSkeleton, OpsTable, SourceLine, timeAgo, useOpsSection } from "../ops/parts";

// ============================================================
// P22-12 · Integration Health
// Every external system this deployment touches, with status
// derived from live probes and credential presence. Auth columns
// show only the mechanism name (e.g. VERCEL_TOKEN) — token values
// are never stored in this payload and never displayed.
// ============================================================

interface IntegrationRow {
  id: string;
  name: string;
  status: "connected" | "not-applicable" | "not-configured" | "degraded" | "unavailable" | "failing" | string;
  environment: string;
  authStatus: string;
  lastSyncAt: number | null;
  latencyMs: number | null;
  note: string;
  configState: string;
}

interface IntegrationsPayload {
  integrations: IntegrationRow[];
  neverShown: string;
  sourceNote: string;
}

function statusToHealth(status: string): string {
  switch (status) {
    case "connected":
      return "connected";
    case "degraded":
      return "degraded";
    case "failing":
      return "failing";
    case "unavailable":
      return "unavailable";
    case "not-configured":
      return "not-configured";
    case "not-applicable":
    default:
      return "unknown";
  }
}

export function P22IntegrationHealthScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<IntegrationsPayload>("integrations");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Integration Health"
        description="Supabase, Vercel, GitHub, email, AI, storage and messaging — each reporting its own verified state. Nothing is claimed connected without verification."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <SectionCard
            title="Integrations"
            description="Statuses derived from live probes (SQL, runtime environment) and credential presence."
            actions={<span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-500">{data.integrations.length} tracked</span>}
          >
            <OpsTable<IntegrationRow>
              rows={data.integrations}
              keyOf={(r) => r.id}
              columns={[
                {
                  header: "Integration",
                  cell: (r) => (
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{r.name}</p>
                      <p className="mt-0.5 max-w-md text-[11px] leading-snug text-slate-400">{r.note}</p>
                    </div>
                  ),
                },
                { header: "Status", cell: (r) => <OpsHealthBadge health={statusToHealth(r.status)} /> },
                { header: "Auth mechanism", cell: (r) => <span className="font-mono text-[11.5px] text-slate-600">{r.authStatus}</span> },
                { header: "Environment", cell: (r) => <span className="text-[11.5px] font-medium text-slate-600">{r.environment}</span> },
                {
                  header: "Latency",
                  className: "text-right",
                  cell: (r) =>
                    r.latencyMs != null ? (
                      <span className="font-semibold tabular-nums text-slate-900">{r.latencyMs} ms</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    ),
                },
                {
                  header: "Last sync",
                  className: "text-right",
                  cell: (r) => (r.lastSyncAt ? <span className="tabular-nums text-slate-600">{timeAgo(r.lastSyncAt)}</span> : <span className="text-slate-400">never</span>),
                },
              ]}
              empty={
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center text-[12.5px] text-slate-500">
                  No integrations reported by the backend.
                </p>
              }
            />
          </SectionCard>

          <SectionCard title="Credential exposure policy" description={data.neverShown}>
            <p className="text-[12.5px] leading-relaxed text-slate-600">
              The <span className="font-semibold text-slate-800">Auth mechanism</span> column names the credential (for example <span className="font-mono text-[12px]">VERCEL_TOKEN</span>) so operators know what to rotate — but no token, key or connection string is ever included in this payload or rendered on this screen.
            </p>
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
