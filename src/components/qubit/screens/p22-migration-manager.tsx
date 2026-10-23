"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsSkeleton, OpsTable, SourceLine, useOpsSection } from "../ops/parts";

// ============================================================
// P22-05 · Database Migration Manager
// How schema changes actually reach production (prisma db push —
// no migrations directory exists), the honest empty migration
// history, and the policy that production destructive actions
// are blocked in Operations by design (a statement, not a button).
// ============================================================

interface MigrationsPayload {
  workflow: string;
  migrations: unknown[];
  migrationsNote: string;
  destructiveBlocked: boolean;
  destructiveNote: string;
  safeOperations: string[];
  provider: string;
  sourceNote: string;
}

export function P22MigrationManagerScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<MigrationsPayload>("migrations");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Database Migration Manager"
        description="How schema changes actually reach production, the migration history exactly as recorded (empty), and the by-design block on destructive production actions."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Schema workflow" description="Derived from the repository's real Prisma setup — shown exactly as the backend reports it.">
              <div>
                <FactRow
                  label="Workflow"
                  value={<span className="max-w-sm text-[12px] font-medium leading-relaxed text-slate-700">{data.workflow}</span>}
                />
                <FactRow
                  label="Migrations directory"
                  value="Not present"
                  note="The workflow description states that no migrations directory exists in this repository."
                />
                <FactRow label="Provider" value={<span className="font-mono text-[12px]">{data.provider}</span>} />
              </div>
            </SectionCard>

            <SectionCard title="Safe operations" description="Everything this manager legitimately offers — read-only by design.">
              {data.safeOperations.length ? (
                <div className="flex flex-wrap gap-1.5" role="list" aria-label="Safe operations available">
                  {data.safeOperations.map((op) => (
                    <span
                      key={op}
                      role="listitem"
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10.5px] font-semibold text-slate-600"
                    >
                      {op}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[12.5px] text-slate-500">No safe operations are declared by the backend.</p>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                Schema state and provider configuration are view-only here. Anything that alters production data requires repository-level
                intervention with explicit human authorization.
              </p>
            </SectionCard>
          </div>

          <SectionCard title="Migration history" description="Recorded exactly as it exists — this screen does not invent history.">
            {data.migrations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center" role="status">
                <p className="text-[13px] font-semibold text-slate-700">No migration history is recorded</p>
                <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-slate-500">{data.migrationsNote}</p>
              </div>
            ) : (
              <OpsTable
                rows={data.migrations}
                keyOf={(m) => String(m)}
                empty={
                  <p className="text-[12.5px] leading-relaxed text-slate-500" role="status">
                    {data.migrationsNote}
                  </p>
                }
                columns={[
                  {
                    header: "Migration record",
                    cell: (m) => <span className="font-mono text-[12px]">{String(m)}</span>,
                  },
                ]}
              />
            )}
          </SectionCard>

          {/* Policy statement — intentionally NO action button */}
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5" role="note" aria-label="Destructive actions blocked by policy">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
              <p className="text-[13.5px] font-semibold text-red-900">Production destructive actions are blocked by design</p>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-red-800">{data.destructiveNote}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-red-700">
              This card is a policy statement — the screen intentionally renders no action control for destructive operations, disabled or
              otherwise. The block is enforced by the operations backend, not by a button.
            </p>
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
