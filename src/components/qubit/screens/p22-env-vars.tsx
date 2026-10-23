"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsHealthBadge, OpsSkeleton, OpsTable, SourceLine, useOpsSection } from "../ops/parts";

// ============================================================
// P22-03 · Environment Variables Manager
// The real secret inventory: names, purpose, scope, type and
// runtime presence. The API has no secret values by design —
// the Value column renders the masked placeholder returned by
// the payload. Rotation and per-environment editing live in the
// platform secret store, never here.
// ============================================================

interface EnvVarRow {
  name: string;
  purpose: string;
  scope: string;
  type: string;
  required: boolean;
  usedBy: string;
  configuredAtRuntime: boolean;
  value: string;
  source: string;
  providerStatus: string;
}

interface EnvVarsPayload {
  variables: EnvVarRow[];
  maskingNote: string;
  sourceNote: string;
}

/** server-only → filled slate-900 · system → slate outline · public → light outline. */
function ScopeBadge({ scope }: { scope: string }) {
  const cls =
    scope === "server-only"
      ? "border-slate-900 bg-slate-900 text-white"
      : scope === "system"
        ? "border-slate-300 bg-slate-50 text-slate-600"
        : "border-slate-200 bg-white text-slate-500";
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", cls)}>
      {scope.replace("-", " ")}
    </span>
  );
}

export function P22EnvVarsScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<EnvVarsPayload>("env-vars");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Environment Variables Manager"
        description="The real environment-variable inventory: name, purpose, scope and runtime presence. Values never leave the server — this screen governs exposure risk and naming, not secret content."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {/* Header note — masking policy */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" role="note">
            <p className="text-[12px] leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-700">Values never leave the server. </span>
              {data.maskingNote}
            </p>
          </div>

          <SectionCard title="Variable inventory" description="Presence is checked server-side on every view — a variable reported Missing is genuinely absent from this runtime.">
            <OpsTable
              rows={data.variables}
              keyOf={(v) => v.name}
              empty={
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4" role="status">
                  <p className="text-[12.5px] font-semibold text-slate-700">No environment variables are cataloged</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                    The codebase-usage audit found no variables to list — none are invented.
                  </p>
                </div>
              }
              columns={[
                {
                  header: "Variable",
                  cell: (v) => <span className="whitespace-nowrap font-mono text-[12px] font-semibold text-slate-900">{v.name}</span>,
                  className: "min-w-[140px]",
                },
                {
                  header: "Purpose",
                  cell: (v) => (
                    <div className="min-w-[16rem] max-w-[22rem]">
                      <p className="text-[12.5px] leading-snug text-slate-700">{v.purpose}</p>
                      <p className="mt-0.5 font-mono text-[10px] leading-snug text-slate-400">{v.usedBy}</p>
                    </div>
                  ),
                },
                { header: "Scope", cell: (v) => <ScopeBadge scope={v.scope} /> },
                { header: "Type", cell: (v) => <span className="text-[12px] text-slate-600">{v.type}</span> },
                {
                  header: "Runtime status",
                  cell: (v) => <OpsHealthBadge health={v.configuredAtRuntime ? "active" : "missing"} />,
                },
                {
                  header: "Required",
                  cell: (v) =>
                    v.required ? (
                      <span className="text-[12px] font-semibold text-slate-900">Required</span>
                    ) : (
                      <span className="text-[12px] text-slate-500">Optional</span>
                    ),
                },
                {
                  header: "Value",
                  cell: (v) => <span className="font-mono text-[12px] tracking-wider text-slate-400">{v.value}</span>,
                },
              ]}
            />
            {data.variables[0]?.providerStatus && (
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{data.variables[0].providerStatus}</p>
            )}
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
