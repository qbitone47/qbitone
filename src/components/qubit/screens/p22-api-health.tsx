"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { useRole } from "../role-context";
import {
  fmtIST,
  OpsApiError,
  OpsError,
  OpsHealthBadge,
  OpsSkeleton,
  OpsTable,
  opsPost,
  SourceLine,
  useOpsSection,
} from "../ops/parts";

// ============================================================
// P22-06 · API Health
// The real route manifest (src/app/api) plus an on-demand,
// server-side reachability probe (opsPost "probe.apis"). A 401
// from a protected endpoint is healthy behavior — reachable and
// auth-enforced — and is shown as such, not as an error.
// ============================================================

interface ManifestEndpoint {
  endpoint: string;
  method: string;
  service: string;
  authRequired: boolean;
}

interface ProbeResult extends ManifestEndpoint {
  httpStatus: number | null;
  latencyMs: number | null;
  health: "reachable" | "failing" | "unreachable";
  interpretation: string;
}

interface ApiHealthPayload {
  manifest: ManifestEndpoint[];
  probeResults: unknown;
  probeNote: string;
  lastProbeAt: number | null;
  sourceNote: string;
}

/** POST /api/ops wraps its result: { ok, data: { ok, probeResults, lastProbeAt, note } }. */
interface ProbePostResponse {
  ok: boolean;
  data: { ok: boolean; probeResults: ProbeResult[]; lastProbeAt: number; note: string };
}

function MethodBadge({ method }: { method: string }) {
  const filled = method.toUpperCase() !== "GET";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide",
        filled ? "bg-slate-900 text-white" : "border border-slate-300 bg-slate-50 text-slate-600",
      )}
    >
      {method}
    </span>
  );
}

export function P22ApiHealthScreen() {
  const { role } = useRole();
  const { data, loading, error, forbidden, reload } = useOpsSection<ApiHealthPayload>("api-health");
  const [probe, setProbe] = React.useState<{ results: ProbeResult[]; lastProbeAt: number } | null>(null);
  const [probing, setProbing] = React.useState(false);

  async function runProbe() {
    setProbing(true);
    try {
      const body = await opsPost<ProbePostResponse>("probe.apis", {}, role);
      setProbe({ results: body.data.probeResults, lastProbeAt: body.data.lastProbeAt });
      toast({ title: "Reachability probe complete", description: body.data.note });
      reload();
    } catch (e) {
      const message = e instanceof OpsApiError ? e.message : "The probe could not be executed.";
      toast({ variant: "destructive", title: "Probe failed", description: message });
    } finally {
      setProbing(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="API Health"
        description="The real route manifest and an on-demand server-side reachability probe. No synthetic endpoints, no simulated latencies — a probe result only exists after a probe has run."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <SectionCard title="Endpoint manifest" description="Enumerated from the real route manifest (src/app/api). No endpoints are invented.">
            <OpsTable
              rows={data.manifest}
              keyOf={(e) => `${e.method} ${e.endpoint}`}
              empty={
                <p className="text-[12.5px] text-slate-500" role="status">
                  The manifest is empty — no API routes are declared.
                </p>
              }
              columns={[
                {
                  header: "Endpoint",
                  cell: (e) => <span className="whitespace-nowrap font-mono text-[12px] font-semibold text-slate-900">{e.endpoint}</span>,
                  className: "min-w-[200px]",
                },
                { header: "Method", cell: (e) => <MethodBadge method={e.method} /> },
                { header: "Service", cell: (e) => <span className="text-[12.5px] text-slate-700">{e.service}</span> },
                {
                  header: "Auth",
                  cell: (e) =>
                    e.authRequired ? (
                      <span className="text-[12px] font-semibold text-slate-700">Auth required</span>
                    ) : (
                      <span className="text-[12px] text-slate-500">Public</span>
                    ),
                },
              ]}
            />
          </SectionCard>

          <SectionCard
            title="Reachability probe"
            description="A real HTTP probe executed server-side against every manifest endpoint."
            actions={
              <Button
                type="button"
                onClick={runProbe}
                disabled={probing}
                aria-busy={probing}
                className="min-h-[44px] bg-slate-900 text-[12.5px] font-semibold hover:bg-slate-800"
              >
                {probing ? "Probing…" : "Check reachability"}
              </Button>
            }
          >
            {probe ? (
              <div>
                <p className="mb-2 text-[12px] text-slate-500">
                  Last probe: <span className="font-semibold tabular-nums text-slate-700">{fmtIST(probe.lastProbeAt)}</span>
                </p>
                <OpsTable
                  rows={probe.results}
                  keyOf={(r) => `${r.method} ${r.endpoint}`}
                  empty={
                    <p className="text-[12.5px] text-slate-500" role="status">
                      The probe returned no results.
                    </p>
                  }
                  columns={[
                    {
                      header: "Endpoint",
                      cell: (r) => <span className="whitespace-nowrap font-mono text-[12px] font-semibold text-slate-900">{r.endpoint}</span>,
                      className: "min-w-[200px]",
                    },
                    {
                      header: "HTTP status",
                      cell: (r) => <span className="tabular-nums text-[12.5px] font-semibold text-slate-800">{r.httpStatus ?? "—"}</span>,
                    },
                    {
                      header: "Latency",
                      cell: (r) => <span className="tabular-nums text-[12.5px] text-slate-700">{r.latencyMs != null ? `${r.latencyMs} ms` : "—"}</span>,
                    },
                    { header: "Health", cell: (r) => <OpsHealthBadge health={r.health} /> },
                    {
                      header: "Interpretation",
                      cell: (r) => <span className="text-[12px] leading-snug text-slate-600">{r.interpretation}</span>,
                    },
                  ]}
                />
                <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{data.probeNote}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4" role="status">
                <p className="text-[12.5px] font-semibold text-slate-700">No probe has been run</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{data.probeNote}</p>
              </div>
            )}
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
