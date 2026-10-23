"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, useOpsSection } from "../ops/parts";

// ============================================================
// P22-15 · Backup & Recovery Status
// Capability truth-telling: Supabase manages the real database
// backups and the application cannot verify them — so this screen
// shows Unknown with a pointer to the Supabase dashboard, and
// never claims "Backups verified".
// ============================================================

interface BackupsPayload {
  databaseBackup: { status: "unknown" | string; note: string };
  fileBasedBackups: { status: "healthy" | "unavailable" | string; note: string; location: string };
  lastBackup: number | null;
  lastBackupNote: string;
  backupAge: number | null;
  backupType: string;
  retention: { configured: boolean; note: string };
  verification: { configured: boolean; note: string };
  lastRestoreTest: number | null;
  recoveryPoint: string;
  recoveryStatus: "unknown" | string;
  sourceNote: string;
}

export function P22BackupRecoveryScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<BackupsPayload>("backups");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Backup & Recovery Status"
        description="What can be backed up, what is verified, and what is honestly unknown. This screen will never claim verified backups it cannot see."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Database (platform-managed) backups */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[14px] font-semibold text-slate-900">Database backups (platform-managed)</p>
                <OpsHealthBadge health={data.databaseBackup.status === "unknown" ? "unknown" : data.databaseBackup.status} />
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">{data.databaseBackup.note}</p>
              <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] leading-relaxed text-slate-500">
                <span className="font-semibold text-slate-600">Operator action: </span>verify backups in the Supabase dashboard (Backups / PITR for your plan) — this application has no management-API visibility into them.
              </p>
            </div>

            {/* File-based backups */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[14px] font-semibold text-slate-900">File-based backups (self-hosted mode)</p>
                <OpsHealthBadge health={data.fileBasedBackups.status} />
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">{data.fileBasedBackups.note}</p>
              <p className="mt-3 font-mono text-[11.5px] text-slate-500">Location: {data.fileBasedBackups.location}</p>
            </div>
          </div>

          <SectionCard title="Recovery facts" description="Only application-verifiable events are dated — everything else is labeled.">
            <div>
              <FactRow label="Last backup" value="Not available" health="not-configured" note={data.lastBackupNote} />
              <FactRow label="Backup age" value="Not available" health="not-configured" note="Age cannot be computed without an application-verifiable backup event." />
              <FactRow label="Backup type" value={data.backupType} />
              <FactRow label="Retention" value="Not configured" health="not-configured" note={data.retention.note} />
              <FactRow label="Automated verification" value="Not configured" health="not-configured" note={data.verification.note} />
              <FactRow label="Last restore test" value={data.lastRestoreTest ? "Recorded" : "Never"} health={data.lastRestoreTest ? "healthy" : "not-configured"} note="No restore drill has been performed against production data." />
              <FactRow label="Recovery point (RPO)" value={data.recoveryPoint} health="not-configured" />
              <FactRow label="Recovery status" value={data.recoveryStatus === "unknown" ? "Unknown" : data.recoveryStatus} health={data.recoveryStatus} note="No verified restore exists, so recovery readiness is unknown — not assumed good." />
            </div>
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
