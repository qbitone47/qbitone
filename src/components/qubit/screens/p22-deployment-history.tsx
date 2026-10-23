"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { EnvBadge, FactRow, fmtIST, NotConfiguredCard, OpsError, OpsHealthBadge, OpsSkeleton, OpsTable, SourceLine, timeAgo, useOpsSection } from "../ops/parts";

// ============================================================
// P22-17 · Deployment History
// Real deployments reported by the provider (Vercel REST when
// VERCEL_TOKEN is configured) plus the runtime's own injected
// identity. An empty history is shown as empty — never seeded,
// never fabricated between builds.
// ============================================================

interface HistoryEntry {
  version: string;
  deploymentId: string;
  commit: string | null;
  branch: string | null;
  author: string;
  timestamp: number;
  environment: string;
  status: string;
  durationSec: number | null;
  provider: string;
  rollbackAvailable: boolean;
  url: string | null;
}

interface DeploymentHistoryPayload {
  configured: boolean;
  history: HistoryEntry[];
  currentFromRuntime: { commit: string; branch: string | null; environment: string | null; url: string | null } | null;
  note: string;
  sourceNote: string;
}

/** Deployment state → honest health vocabulary (Ready is the only good terminal state). */
function statusHealth(status: string): string {
  if (status === "Ready") return "ready";
  if (status === "Failed" || status === "Cancelled") return "unavailable";
  return "unknown"; // Building / Queued / Deploying — genuinely in flight or unknown
}

export function P22DeploymentHistoryScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<DeploymentHistoryPayload>("deployment-history");
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.history;
    return data.history.filter((d) =>
      [d.commit, d.branch, d.author].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [data, query]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Deployment History"
        description="Every production deployment the provider reports, plus the runtime's own identity — nothing is inferred between builds."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {!data.configured && (
            <NotConfiguredCard
              title="Provider deployment telemetry not configured"
              note={data.note}
              recommendation="Add VERCEL_TOKEN as a server-only environment variable to enable live deployment history from the Vercel REST API."
            />
          )}

          {data.currentFromRuntime && (
            <SectionCard
              title="Current deployment (from this runtime)"
              description="Facts injected into this very process by the platform — always real, never cached into fiction."
            >
              <div>
                <FactRow label="Commit" value={<span className="font-mono text-[12px]">{data.currentFromRuntime.commit.slice(0, 12)}</span>} />
                <FactRow label="Branch" value={data.currentFromRuntime.branch ?? "Unknown"} />
                <FactRow
                  label="Environment"
                  value={data.currentFromRuntime.environment ? <EnvBadge env={data.currentFromRuntime.environment} /> : "Unknown"}
                />
                <FactRow label="Deployment URL" value={data.currentFromRuntime.url ?? "—"} />
              </div>
            </SectionCard>
          )}

          {data.configured && (
            <SectionCard title="Deployment history" description={data.note}>
              <div className="space-y-3">
                <div className="max-w-sm space-y-1.5">
                  <label htmlFor="deployment-search" className="block text-[11.5px] font-medium text-slate-600">
                    Search deployments
                  </label>
                  <Input
                    id="deployment-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter by commit, branch or author"
                    className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px]"
                  />
                </div>

                <OpsTable
                  rows={filtered}
                  keyOf={(r) => r.deploymentId || r.commit || String(r.timestamp)}
                  empty={
                    <p className="py-8 text-center text-[12.5px] text-slate-500">
                      {query.trim()
                        ? `No deployments match “${query.trim()}” — adjust the filter or clear it.`
                        : "Vercel is configured and returned no deployments yet — the production history is empty, not hidden."}
                    </p>
                  }
                  columns={[
                    { header: "Version", cell: (r) => <span className="font-semibold tabular-nums text-slate-800">v{r.version}</span> },
                    { header: "Commit", cell: (r) => (r.commit ? <span className="font-mono text-[12px]">{r.commit.slice(0, 7)}</span> : <span className="text-slate-400">—</span>) },
                    { header: "Branch", cell: (r) => r.branch ?? <span className="text-slate-400">—</span> },
                    { header: "Author", cell: (r) => r.author },
                    {
                      header: "When",
                      cell: (r) => (
                        <span className="tabular-nums">
                          <span className="whitespace-nowrap">{fmtIST(r.timestamp)}</span>
                          <span className="block text-[10.5px] text-slate-400">{timeAgo(r.timestamp)}</span>
                        </span>
                      ),
                    },
                    { header: "Status", cell: (r) => <OpsHealthBadge health={statusHealth(r.status)} /> },
                    { header: "Duration", cell: (r) => <span className="tabular-nums">{r.durationSec != null ? `${r.durationSec}s` : "—"}</span> },
                    { header: "Provider", cell: (r) => r.provider },
                  ]}
                />

                <p className="text-[11px] text-slate-400">
                  Showing {filtered.length} of {data.history.length} recorded deployments. Rollback actions live in the Rollback Center — this screen only reports.
                </p>
              </div>
            </SectionCard>
          )}

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
