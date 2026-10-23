"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, fmtIST, opsPost, timeAgo, useOpsSection } from "../ops/parts";

// ============================================================
// P22-18 · Release Approval
// The human approval train that gates production releases:
// draft → validation → review → approval → deploy → verification
// → completed. The server enforces that a release cannot enter
// approval until its test status is 'passing' — the UI hints at
// that rule but never decides it.
// ============================================================

interface ReleaseRow {
  id: string; version: string; commitSha: string | null; changes: string;
  risk: "low" | "medium" | "high"; testStatus: "not-run" | "passing" | "failing";
  stage: string; reviewer: string | null; decision: string | null;
  deploymentPlan: string; rollbackPlan: string;
  createdAt: number; createdBy: string; updatedAt: number;
}

interface ReleasePayload {
  releases: ReleaseRow[];
  stages: string[];
  engineNote: string;
  sourceNote: string;
}

interface ActionResult { ok?: boolean; message?: string; data?: { ok?: boolean; message?: string } }

/** The ops route returns the Result envelope { ok, data: { ok, message } } — unwrap defensively. */
function messageOf(res: ActionResult): string | undefined {
  return res.data?.message ?? res.message;
}

const RISK_CLS: Record<string, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  high: "border-red-200 bg-red-50 text-red-800",
};

function RiskChip({ risk }: { risk: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-bold capitalize", RISK_CLS[risk] ?? RISK_CLS.medium)}>
      {risk} risk
    </span>
  );
}

function testStatusHealth(status: string): string {
  if (status === "passing") return "healthy";
  if (status === "failing") return "failing";
  return "unknown";
}

function StageTrack({ stages, current }: { stages: string[]; current: string }) {
  const idx = stages.indexOf(current);
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label={current ? `Release stage: ${current}` : "Release lifecycle stages"}>
      {stages.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={s} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="h-px w-3 bg-slate-300" />}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold capitalize",
                done && "border-emerald-200 bg-emerald-50 text-emerald-700",
                active && "border-slate-900 bg-slate-900 text-white",
                !done && !active && "border-slate-200 bg-white text-slate-400",
              )}
            >
              {done && <Check className="h-3 w-3" aria-hidden />}
              {s}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ReleaseCard({ rel, stages, busy, onAdvance, onReject }: {
  rel: ReleaseRow;
  stages: string[];
  busy: boolean;
  onAdvance: (rel: ReleaseRow) => Promise<boolean>;
  onReject: (rel: ReleaseRow, reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = React.useState("");
  const idx = stages.indexOf(rel.stage);
  const completed = rel.stage === "completed";
  const next = completed ? null : stages[Math.min(idx + 1, stages.length - 1)];
  const blocked = next === "approval" && rel.testStatus !== "passing";
  const advanceTitle = completed
    ? "Release is completed — there is nothing left to advance."
    : blocked
      ? "Blocked: a release cannot enter approval until its test status is “passing” — set it honestly first."
      : next
        ? `Advance stage → ${next}`
        : "";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-slate-400">{rel.id}</span>
        <span className="text-[13px] font-semibold text-slate-900">v{rel.version}</span>
        <RiskChip risk={rel.risk} />
        <OpsHealthBadge health={testStatusHealth(rel.testStatus)} />
        {rel.decision === "rejected" && (
          <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-bold text-red-700">Rejected</span>
        )}
      </div>

      <div className="mt-3">
        <StageTrack stages={stages} current={rel.stage} />
      </div>

      <div className="mt-3 grid gap-x-6 gap-y-1 text-[12px] text-slate-600 sm:grid-cols-2">
        <p>
          <span className="font-medium text-slate-700">Commit:</span>{" "}
          {rel.commitSha ? <span className="font-mono">{rel.commitSha.slice(0, 12)}</span> : "—"}
        </p>
        <p><span className="font-medium text-slate-700">Reviewer:</span> {rel.reviewer ?? "—"}</p>
        <p className="sm:col-span-2"><span className="font-medium text-slate-700">Changes:</span> {rel.changes || "—"}</p>
        <p className="sm:col-span-2"><span className="font-medium text-slate-700">Deployment plan:</span> {rel.deploymentPlan}</p>
        <p className="sm:col-span-2"><span className="font-medium text-slate-700">Rollback plan:</span> {rel.rollbackPlan}</p>
        <p className="text-[11px] text-slate-400 sm:col-span-2">
          Created {fmtIST(rel.createdAt)} ({timeAgo(rel.createdAt)}) by {rel.createdBy} · last update {timeAgo(rel.updatedAt)}
        </p>
      </div>

      {!completed && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <Button size="sm" disabled={busy || blocked} title={advanceTitle} onClick={() => void onAdvance(rel)} className="min-h-[36px]">
            Advance stage{next ? ` → ${next}` : ""}
          </Button>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <label htmlFor={`reject-reason-${rel.id}`} className="sr-only">Rejection reason for {rel.id}</label>
            <Input
              id={`reject-reason-${rel.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Rejection reason (recorded)"
              className="h-9 w-56 rounded-lg border-slate-300 bg-white text-[12.5px]"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => { void onReject(rel, reason).then((ok) => { if (ok) setReason(""); }); }}
              className="min-h-[36px]"
            >
              Reject to draft
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ id, label, hint, required, children }: { id: string; label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[11.5px] font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-slate-400">{hint}</p>}
    </div>
  );
}

export function P22ReleaseApprovalScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<ReleasePayload>("release-approval");
  const [busy, setBusy] = React.useState(false);

  // New-release form state.
  const [version, setVersion] = React.useState("");
  const [commitSha, setCommitSha] = React.useState("");
  const [changes, setChanges] = React.useState("");
  const [risk, setRisk] = React.useState("medium");
  const [testStatus, setTestStatus] = React.useState("not-run");

  const resetForm = () => {
    setVersion(""); setCommitSha(""); setChanges(""); setRisk("medium"); setTestStatus("not-run");
  };

  const createRelease = async () => {
    if (!version.trim()) {
      toast({ title: "Version is required", description: "Give the release a version label (e.g. 0.2.2).", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await opsPost<ActionResult>("release.create", {
        version: version.trim(),
        commitSha: commitSha.trim() || undefined,
        changes,
        risk,
        testStatus,
      });
      toast({ title: "Release drafted", description: messageOf(res) });
      resetForm();
      reload();
    } catch (e) {
      toast({ title: "Could not create release", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const advance = async (rel: ReleaseRow): Promise<boolean> => {
    setBusy(true);
    try {
      const res = await opsPost<ActionResult>("release.advance", { id: rel.id });
      toast({ title: "Stage advanced", description: messageOf(res) });
      reload();
      return true;
    } catch (e) {
      toast({ title: "Advance rejected", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const reject = async (rel: ReleaseRow, reason: string): Promise<boolean> => {
    if (!reason.trim()) {
      toast({ title: "A rejection reason is required", description: "The reason is recorded in the enterprise audit trail.", variant: "destructive" });
      return false;
    }
    setBusy(true);
    try {
      const res = await opsPost<ActionResult>("release.reject", { id: rel.id, reason: reason.trim() });
      toast({ title: "Release rejected", description: messageOf(res) });
      reload();
      return true;
    } catch (e) {
      toast({ title: "Reject failed", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Release Approval"
        description="The human approval train that gates production releases — draft to completed, one honest stage at a time. The server enforces the rules; the UI only hints."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <SectionCard
            title="Lifecycle stages"
            description="Every release walks these stages in order; the approval gate requires a real “passing” test status."
          >
            <StageTrack stages={data.stages} current="" />
          </SectionCard>

          <SectionCard
            title="New release request"
            description="Drafts are recorded immediately and audited. Be honest about test status — the approval gate reads it."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="rel-version" label="Version" required hint="A short version label, e.g. 0.2.2.">
                <Input
                  id="rel-version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="0.2.2"
                  className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px]"
                />
              </Field>
              <Field id="rel-commit" label="Commit SHA" hint="Optional — the commit this release ships.">
                <Input
                  id="rel-commit"
                  value={commitSha}
                  onChange={(e) => setCommitSha(e.target.value)}
                  placeholder="e.g. ede1fdb"
                  className="h-9 rounded-lg border-slate-300 bg-white font-mono text-[12.5px]"
                />
              </Field>
              <Field id="rel-changes" label="Changes" hint="What this release changes, in one or two sentences.">
                <Textarea
                  id="rel-changes"
                  rows={3}
                  value={changes}
                  onChange={(e) => setChanges(e.target.value)}
                  className="rounded-lg border-slate-300 bg-white text-[12.5px]"
                />
              </Field>
              <div className="grid gap-4">
                <Field id="rel-risk" label="Risk">
                  <Select value={risk} onValueChange={setRisk}>
                    <SelectTrigger id="rel-risk" aria-label="Risk" className="w-full rounded-lg border-slate-300 bg-white text-[12.5px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["low", "medium", "high"].map((r) => (
                        <SelectItem key={r} value={r} className="text-[12.5px] capitalize">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="rel-tests" label="Test status" hint="“passing” is required before the approval stage.">
                  <Select value={testStatus} onValueChange={setTestStatus}>
                    <SelectTrigger id="rel-tests" aria-label="Test status" className="w-full rounded-lg border-slate-300 bg-white text-[12.5px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["not-run", "passing", "failing"].map((t) => (
                        <SelectItem key={t} value={t} className="text-[12.5px]">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={() => void createRelease()} disabled={busy} className="min-h-[44px]">
                Draft release request
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Releases" description={data.engineNote}>
            {data.releases.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-slate-500">
                No release requests exist yet — the registry is seeded empty, so nothing is pretended. Draft the first release above.
              </p>
            ) : (
              <div className="space-y-3">
                {data.releases.map((rel) => (
                  <ReleaseCard key={rel.id} rel={rel} stages={data.stages} busy={busy} onAdvance={advance} onReject={reject} />
                ))}
              </div>
            )}
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
