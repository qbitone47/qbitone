"use client";

import * as React from "react";
import { DatabaseBackup, ShieldCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { useRole } from "../role-context";
import {
  HighRiskDialog,
  MetricTile,
  PlatformCard,
  PlatformError,
  PlatformNote,
  PlatformSkeleton,
  SourceLine,
  StatusWord,
  platformPost,
  usePlatformSection,
} from "../platform/parts";

// ============================================================
// Screen 305 · Backup & Recovery — REAL backups of the platform
// database (file copies with SHA-256 verification), real restore
// TESTS into a staging copy, and high-risk restore REQUESTS that
// are never executed automatically. A backup that has never been
// verified is not treated as recoverable (spec §26, §35).
// ============================================================

interface BackupPayload {
  policy: { rpoTargetMinutes: number; rtoTargetMinutes: number; retentionDays: number; verificationRequired: boolean; policyNote: string };
  database: { path: string; engine: string; note: string };
  backups: { id: string; file: string; createdAt: number; sizeKb: number; sha256: string; verified: boolean; trigger: string }[];
  health: { lastBackupAt: number | null; lastBackupVerified: boolean; verifiedCount: number; retentionKept: number; recoveryReadiness: string };
  restoreTests: { id: string; backupId: string; at: number; result: string; stagingFile: string; detail: string }[];
  restoreRequests: { id: string; backupId: string; reason: string; requestedBy: string; at: number; status: string; note: string }[];
  restoreSafety: { rule: string; rpo: string };
  sourceNote: string;
}

const fmtDT = (ts: number) => new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export function BackupRecoveryScreen() {
  const { role } = useRole();
  const { data, loading, error, reload } = usePlatformSection<BackupPayload>("backup");
  const [busy, setBusy] = React.useState(false);
  const [restoreFor, setRestoreFor] = React.useState<string | null>(null);

  const act = async (fn: () => Promise<{ message?: string }>, done: string) => {
    setBusy(true);
    try {
      const res = await fn();
      toast({ title: done, description: res.message });
      reload();
    } catch (e) {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Platform Ops" }]}
        title="Backup & Recovery"
        description="Encrypted-at-gateway backups of the platform database — created, verified and restore-tested for real. Restore is high-risk and never silent."
        actions={
          <Button onClick={() => act(() => platformPost("backup.run", {}, role), "Backup created")} disabled={busy} className="min-h-[44px]">
            <DatabaseBackup className="mr-1.5 h-4 w-4" aria-hidden /> Create backup now
          </Button>
        }
      />

      {loading && <PlatformSkeleton />}
      {error && !loading && <PlatformError message={error} onRetry={reload} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile label="Backups kept" value={data.health.retentionKept} note={`retention ${data.policy.retentionDays}d / max 10`} />
            <MetricTile label="Verified" value={data.health.verifiedCount} tone={data.health.verifiedCount ? "green" : "amber"} />
            <MetricTile label="Last backup" value={data.health.lastBackupAt ? fmtDT(data.health.lastBackupAt) : "Never"} tone={data.health.lastBackupAt ? "slate" : "amber"} />
            <MetricTile label="Restore tests" value={data.restoreTests.length} tone={data.restoreTests.some((t) => t.result === "Passed") ? "green" : "amber"} />
          </div>

          <PlatformCard>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[12.5px] font-medium text-slate-500">Recovery readiness</p>
                <p className="mt-0.5 text-[15px] font-semibold text-slate-900">{data.health.recoveryReadiness}</p>
              </div>
              <p className="text-[12px] font-medium tabular-nums text-slate-600">{data.restoreSafety.rpo}</p>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">{data.policy.policyNote}</p>
          </PlatformCard>

          <SectionCard title={`Backups (${data.database.engine} · ${data.database.path})`} description="Each row is a real file copy with its SHA-256 checksum. Verification re-hashes the file and checks the SQLite header.">
            {data.backups.length ? (
              <ul className="divide-y divide-slate-100">
                {data.backups.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[12px] text-slate-800">{b.file}</p>
                      <p className="text-[10.5px] text-slate-400">{fmtDT(b.createdAt)} · {b.sizeKb} KB · {b.sha256} · {b.trigger}</p>
                    </div>
                    <StatusWord status={b.verified ? "PASS" : "Degraded"} />
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => platformPost("backup.verify", { id: b.id }, role), "Verification complete")} className="min-h-[36px]">
                        <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden /> Verify
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => platformPost("restore.test", { id: b.id }, role), "Restore test")} className="min-h-[36px]">
                        <Undo2 className="mr-1 h-3.5 w-3.5" aria-hidden /> Restore test
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setRestoreFor(b.id)} className="min-h-[36px] border-red-200 text-red-700 hover:bg-red-50">
                        Restore…
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-slate-500">No backups yet. “Create backup now” makes the first real copy — nothing is assumed until then.</p>
            )}
          </SectionCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Restore tests" description="Backups restored into db/restore-test.db — a staging copy. Production is never touched by a test.">
              {data.restoreTests.length ? (
                <ul className="space-y-2">
                  {data.restoreTests.map((t) => (
                    <li key={t.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-medium text-slate-800">{fmtDT(t.at)} · backup {t.backupId.slice(0, 14)}…</span>
                        <StatusWord status={t.result === "Passed" ? "PASS" : "Degraded"} />
                      </div>
                      <p className="mt-1 text-[11.5px] text-slate-500">{t.detail} → {t.stagingFile}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-slate-500">No restore tests yet — until one passes, readiness stays “Provisional”.</p>
              )}
            </SectionCard>

            <SectionCard title="Restore requests" description={data.restoreSafety.rule}>
              {data.restoreRequests.length ? (
                <ul className="space-y-2">
                  {data.restoreRequests.map((r) => (
                    <li key={r.id} className="rounded-lg border border-red-200 bg-red-50/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-red-800">{fmtDT(r.at)} · {r.requestedBy}</span>
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">{r.status}</span>
                      </div>
                      <p className="mt-1 text-[12px] text-slate-600">“{r.reason}”</p>
                      <p className="mt-1 text-[10.5px] leading-snug text-slate-400">{r.note}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-slate-500">No restore requests on record. The absence of risk is not an achievement — but the presence of the gate is.</p>
              )}
            </SectionCard>
          </div>

          <HighRiskDialog
            open={restoreFor !== null}
            title="Raise a production restore request"
            description="This does NOT restore production. It records a high-risk restore request that enters the disaster-recovery approval flow. Production restores are executed only by authorized operations following the runbook — never from the UI, never automatically."
            confirmPhrase="RESTORE"
            onCancel={() => setRestoreFor(null)}
            onConfirm={({ phrase, reason }) => {
              setRestoreFor(null);
              act(
                () => platformPost("restore.request", { backupId: restoreFor, phrase, reason }, role, true),
                "Restore request recorded",
              );
            }}
          />

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
