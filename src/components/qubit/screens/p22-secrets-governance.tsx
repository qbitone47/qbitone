"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { fmtIST, NotConfiguredCard, OpsError, OpsHealthBadge, OpsSkeleton, OpsTable, SourceLine, useOpsSection } from "../ops/parts";

// ============================================================
// P22-14 · Secrets & Credential Governance
// Metadata-only inventory of the credentials this codebase
// actually reads. The API never receives secret values, so this
// screen cannot leak what it never has — by design.
// ============================================================

interface SecretRow {
  name: string;
  provider: string;
  environment: string;
  scope: string;
  configuredAtRuntime: boolean;
  owner: string;
  createdAt: number | null;
  createdAtNote: string;
  lastRotated: number | null;
  rotationStatus: "healthy" | "expiring" | "expired" | "missing" | "rotation-required" | "unknown" | string;
  rotationNote: string;
  expiration: number | null;
  status: "active" | "missing" | "not-set" | string;
  statusNote: string;
}

interface SecretsPayload {
  secrets: SecretRow[];
  valuesNote: string;
  governanceNote: string;
  sourceNote: string;
  checkedAt: number;
}

function statusToHealth(status: string): string {
  switch (status) {
    case "active":
      return "healthy";
    case "missing":
      return "missing";
    case "not-set":
    default:
      return "not-configured";
  }
}

export function P22SecretsGovernanceScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<SecretsPayload>("secrets");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Secrets & Credential Governance"
        description="Inventory of every credential the codebase reads — presence, owner, rotation state. No values, ever."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {/* Top banner */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]" role="note" aria-label="No secret values by design">
            <p className="text-[14px] font-semibold text-slate-900">This screen has no secret values by design.</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">{data.valuesNote}</p>
          </div>

          <SectionCard
            title="Credential inventory"
            description="Real presence checks (process.env) over the code-usage catalog — metadata only."
            actions={<span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-500">{data.secrets.length} tracked</span>}
          >
            <OpsTable<SecretRow>
              rows={data.secrets}
              keyOf={(r) => r.name}
              columns={[
                { header: "Name", cell: (r) => <span className="font-mono text-[11.5px] font-semibold text-slate-900">{r.name}</span> },
                { header: "Provider", cell: (r) => <span className="text-[11.5px] text-slate-600">{r.provider}</span> },
                { header: "Environment", cell: (r) => <span className="text-[11.5px] font-medium text-slate-600">{r.environment}</span> },
                {
                  header: "Status",
                  cell: (r) => (
                    <div className="flex items-center gap-2">
                      <OpsHealthBadge health={statusToHealth(r.status)} />
                      <span className="max-w-[15rem] text-[10.5px] leading-snug text-slate-400">{r.statusNote}</span>
                    </div>
                  ),
                },
                { header: "Rotation", cell: (r) => <OpsHealthBadge health={r.rotationStatus} /> },
              ]}
              empty={
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center text-[12.5px] text-slate-500">
                  No credentials tracked in the code-usage catalog.
                </p>
              }
            />
            <p className="mt-2 text-[10.5px] leading-relaxed text-slate-400">{data.secrets[0]?.rotationNote ?? ""}</p>
          </SectionCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-[13px] font-semibold text-slate-900">Governance note</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">{data.governanceNote}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-[13px] font-semibold text-slate-900">Metadata the provider withholds</p>
              <div className="mt-1">
                <NotConfiguredCard
                  title="Creation / rotation timestamps not available"
                  note={data.secrets[0]?.createdAtNote ?? "Not available — secret creation timestamps live in the provider (not exposed by design)."}
                />
              </div>
            </div>
          </div>

          <SourceLine>
            {data.sourceNote} · Checked {fmtIST(data.checkedAt)}
          </SourceLine>
        </div>
      )}
    </div>
  );
}
