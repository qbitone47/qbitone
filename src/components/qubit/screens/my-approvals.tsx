"use client";

import * as React from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  History,
  Inbox,
  MessageSquareWarning,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { authedFetch } from "@/lib/qubit/api";
import { getEmployee } from "@/lib/qubit/data";
import { fmtDateTime, relTime, WORKSPACE_NOW, type ApprovalRequest } from "@/lib/qubit/workspace-data";
import { apiGet, ApiError } from "@/lib/qubit/api";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { Avatar, EmptyState, SectionCard, StatTile, StatusBadge } from "../primitives";
import { DetailDrawer } from "../drawers";
import { ConfirmDialog, StepUpDialog } from "../dialogs";

// ============================================================
// Screen 46 · My Approvals — the approvals that need THIS user.
// The queue is scoped server-side; decisions are validated
// server-side (authority, step-up, note rules) and written to
// the enterprise audit trail. The Approval Matrix (screen 09)
// remains the configuration authority this queue mirrors.
// ============================================================

export function MyApprovalsScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { toast } = useToast();
  const params = nav.params as { approvalId?: string };

  const [queue, setQueue] = React.useState<ApprovalRequest[] | null>(null);
  const [history, setHistory] = React.useState<ApprovalRequest[]>([]);
  const [note, setNote] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<"queue" | "history">("queue");

  const [detail, setDetail] = React.useState<ApprovalRequest | null>(null);
  const [approveTarget, setApproveTarget] = React.useState<ApprovalRequest | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<ApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [changesTarget, setChangesTarget] = React.useState<ApprovalRequest | null>(null);
  const [changesNote, setChangesNote] = React.useState("");
  const [stepUpTarget, setStepUpTarget] = React.useState<ApprovalRequest | null>(null);
  const [stepUpPassword, setStepUpPassword] = React.useState("");
  const [pendingDecision, setPendingDecision] = React.useState<{ target: ApprovalRequest; decision: "Approved" | "Rejected" | "Changes requested"; note?: string } | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ queue: ApprovalRequest[]; history?: ApprovalRequest[]; note: string | null }>("/approvals", undefined, role, "/api/workspace");
      setQueue(data.queue);
      setHistory(data.history ?? []);
      setNote(data.note);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The approvals service is unreachable right now.");
    } finally {
      setLoading(false);
    }
  }, [role]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (queue && params.approvalId) {
      const a = queue.find((x) => x.id === params.approvalId);
      if (a) setDetail(a);
    }
  }, [queue, params.approvalId]);

  const decide = async (target: ApprovalRequest, decision: "Approved" | "Rejected" | "Changes requested", reqNote?: string, stepUp?: string) => {
    setBusyId(target.id);
    try {
      const res = await authedFetch("/api/workspace/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Qubit-Role": role },
        body: JSON.stringify({ id: target.id, decision, note: reqNote, stepUpPassword: stepUp }),
      }, role);
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "Decision not recorded", description: data?.message ?? "The approval service rejected this decision. The request is unchanged." });
        return false;
      }
      toast({
        title: decision === "Approved" ? "Request approved" : decision === "Rejected" ? "Request rejected" : "Changes requested",
        description: `${target.title} — the decision and its audit reference are recorded.`,
      });
      await load();
      setDetail(null);
      return true;
    } catch {
      toast({ variant: "destructive", title: "Decision not recorded", description: "The approval service is unreachable. Nothing was changed — retry when you're back online." });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const ageDays = (a: ApprovalRequest) => Math.floor((WORKSPACE_NOW - a.submitted) / 86_400_000);
  const aging = (queue ?? []).filter((a) => ageDays(a) >= 3);
  const highValue = (queue ?? []).filter((a) => a.amount && a.amount >= 1_000_000);

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Workspace" }, { label: "Approvals" }]}
        title="My Approvals"
        description="Requests that are waiting on your decision — routed by the Approval Matrix, decided with server-side checks, recorded in the audit trail."
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={load} aria-label="Reload approvals">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
          </Button>
        }
      />

      {error && (
        <div className="qubit-card mb-3 flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50/60 px-4 py-3" role="alert">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
          </Button>
        </div>
      )}

      {aging.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5" role="note">
          <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <p className="text-xs text-amber-800">
            <span className="font-semibold">{aging.length} request{aging.length === 1 ? "" : "s"} past the 3-day mark</span> — {aging.map((a) => a.title.split("—")[0].trim()).slice(0, 2).join(", ")}
            {aging.length > 2 ? ` and ${aging.length - 2} more` : ""}.
          </p>
        </div>
      )}

      {/* Stats */}
      {!loading && queue && queue.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile icon={<Inbox />} value={queue.length} label="Waiting on you" />
          <StatTile icon={<Clock />} value={aging.length} label="Aging past 3 days" />
          <StatTile icon={<ShieldCheck />} value={queue.filter((a) => a.stepUpRequired).length} label="Require step-up" />
          <StatTile icon={<CheckCircle2 />} value={history.filter((a) => a.status === "Approved").length} label="Approved recently" />
        </div>
      )}

      {/* Tabs */}
      <div className="mb-3 flex items-center gap-1" role="tablist" aria-label="Approval views">
        {(
          [
            { id: "queue", label: `Needs my decision (${queue?.length ?? 0})` },
            { id: "history", label: "Decision history" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              tab === t.id ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <ApprovalListSkeleton />
      ) : tab === "queue" ? (
        <ApprovalList
          items={queue ?? []}
          note={note}
          busyId={busyId}
          ageDays={ageDays}
          onOpen={setDetail}
          onApprove={(a) => (a.stepUpRequired ? setStepUpTarget(a) : setApproveTarget(a))}
          onReject={setRejectTarget}
          onChanges={setChangesTarget}
        />
      ) : (
        <SectionCard title="Decision history" description="Your recorded decisions — mirrored in the enterprise Audit Log.">
          {history.length === 0 ? (
            <EmptyState icon={<History />} title="No decisions recorded yet" message="Approve or reject a request and it will appear here with its full context." />
          ) : (
            <ul className="divide-y">
              {history.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <button type="button" onClick={() => setDetail(a)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[13px] font-medium text-slate-800">{a.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.kind} · {getEmployee(a.requesterId)?.name ?? "External"} · decided {relTime(a.decidedAt ?? a.submitted)}
                      {a.amount ? ` · ₹${a.amount.toLocaleString("en-IN")}` : ""}
                    </p>
                  </button>
                  <StatusBadge status={a.status} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {/* Detail drawer */}
      <DetailDrawer
        open={Boolean(detail)}
        onOpenChange={(o) => !o && setDetail(null)}
        wide
        title={detail?.title ?? ""}
        subtitle={detail ? `${detail.kind} · ${detail.rule}` : undefined}
        icon={<ClipboardCheck />}
        footer={
          detail?.status === "Pending" ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="h-8 gap-1.5" disabled={busyId === detail.id} onClick={() => (detail.stepUpRequired ? setStepUpTarget(detail) : setApproveTarget(detail))}>
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Approve
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setChangesTarget(detail)}>
                Request changes
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-red-600 hover:text-red-700" onClick={() => setRejectTarget(detail)}>
                Reject
              </Button>
            </div>
          ) : undefined
        }
      >
        {detail && <ApprovalDetail detail={detail} ageDays={ageDays(detail)} />}
      </DetailDrawer>

      {/* Approve confirm */}
      <ConfirmDialog
        open={Boolean(approveTarget)}
        onOpenChange={(o) => !o && setApproveTarget(null)}
        title="Approve this request?"
        description={
          approveTarget
            ? `${approveTarget.kind} from ${getEmployee(approveTarget.requesterId)?.name ?? "an external requester"}${approveTarget.amount ? ` · ₹${approveTarget.amount.toLocaleString("en-IN")}` : ""}. The decision is final once recorded and cannot be edited here — it can only be revised through a new request.`
            : ""
        }
        confirmLabel="Record approval"
        onConfirm={() => {
          if (approveTarget) void decide(approveTarget, "Approved");
          setApproveTarget(null);
        }}
      />

      {/* Reject with reason */}
      <ConfirmDialog
        open={Boolean(rejectTarget)}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
        title="Reject this request?"
        description="A short reason is required — it goes to the requester and into the audit record."
        confirmLabel="Record rejection"
        destructive
        onConfirm={() => {
          if (rejectTarget) void decide(rejectTarget, "Rejected", rejectReason);
          setRejectTarget(null);
          setRejectReason("");
        }}
      >
        <div className="space-y-1.5 py-2">
          <Label htmlFor="reject-reason" className="text-xs font-medium text-slate-700">
            Reason <span className="text-red-500" aria-hidden>*</span>
          </Label>
          <Textarea
            id="reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Below the margin floor — counter at 8% with reduced scope."
            className="min-h-20"
            autoFocus
          />
          {rejectReason.trim().length > 0 && rejectReason.trim().length < 4 && (
            <p className="text-[11px] text-red-600">Give a slightly longer reason (at least 4 characters).</p>
          )}
        </div>
      </ConfirmDialog>

      {/* Request changes */}
      <ConfirmDialog
        open={Boolean(changesTarget)}
        onOpenChange={(o) => {
          if (!o) {
            setChangesTarget(null);
            setChangesNote("");
          }
        }}
        title="Request changes?"
        description="The requester can revise and resubmit. Your note explains what is missing."
        confirmLabel="Send change request"
        onConfirm={() => {
          if (changesTarget) void decide(changesTarget, "Changes requested", changesNote);
          setChangesTarget(null);
          setChangesNote("");
        }}
      >
        <div className="space-y-1.5 py-2">
          <Label htmlFor="changes-note" className="text-xs font-medium text-slate-700">
            What needs to change?
          </Label>
          <Textarea
            id="changes-note"
            value={changesNote}
            onChange={(e) => setChangesNote(e.target.value)}
            placeholder="e.g. Add the Whitefield comparison before re-submission."
            className="min-h-20"
            autoFocus
          />
        </div>
      </ConfirmDialog>

      {/* Step-up for sensitive approvals */}
      <StepUpDialog
        open={Boolean(stepUpTarget)}
        onOpenChange={(o) => {
          if (!o) {
            setStepUpTarget(null);
            setStepUpPassword("");
          }
        }}
        title="Confirm with step-up authentication"
        description={
          stepUpTarget
            ? `This is a high-value decision (${stepUpTarget.kind}${stepUpTarget.amount ? ` · ₹${stepUpTarget.amount.toLocaleString("en-IN")}` : ""}). Verify your password before the approval is recorded.`
            : ""
        }
        confirmLabel="Verify & record approval"
        verifying={Boolean(stepUpTarget && busyId === stepUpTarget.id)}
        onConfirm={(password) => {
          if (!stepUpTarget) return;
          setStepUpPassword(password);
          void decide(stepUpTarget, "Approved", undefined, password).then((ok) => {
            if (ok) {
              setStepUpTarget(null);
              setStepUpPassword("");
            }
          });
        }}
      />
    </div>
  );
}

function ApprovalList({
  items,
  note,
  busyId,
  ageDays,
  onOpen,
  onApprove,
  onReject,
  onChanges,
}: {
  items: ApprovalRequest[];
  note: string | null;
  busyId: string | null;
  ageDays: (a: ApprovalRequest) => number;
  onOpen: (a: ApprovalRequest) => void;
  onApprove: (a: ApprovalRequest) => void;
  onReject: (a: ApprovalRequest) => void;
  onChanges: (a: ApprovalRequest) => void;
}) {
  if (items.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          icon={<ClipboardCheck />}
          title="Your approval queue is clear"
          message={note ?? "Nothing is waiting on your decision. New requests appear here the moment the Approval Matrix routes them to you."}
        />
      </SectionCard>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((a) => {
        const requester = getEmployee(a.requesterId);
        const age = ageDays(a);
        return (
          <article key={a.id} className={cn("qubit-card qubit-card-hover p-4", age >= 3 && "border-amber-200")}>
            <div className="flex flex-wrap items-start gap-3">
              <span className="qubit-icon-tile qubit-icon-tile-accent h-10 w-10 shrink-0">
                <ClipboardCheck />
              </span>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onOpen(a)} className="block text-left" aria-label={`Open approval: ${a.title}`}>
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-slate-900">
                    <span className="truncate">{a.title}</span>
                    {a.stepUpRequired && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
                        <ShieldCheck className="h-2.5 w-2.5" aria-hidden /> Step-up required
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.kind} · {requester?.name ?? "External"} · {a.department}
                    {a.amount ? ` · ₹${a.amount.toLocaleString("en-IN")}` : ""}
                  </p>
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", age >= 3 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600")}>
                    <Clock className="h-3 w-3" aria-hidden /> Waiting {age === 0 ? "since this morning" : `${age} day${age === 1 ? "" : "s"}`}
                  </span>
                  <StatusBadge status={a.priority} size="sm" />
                  <span className="text-[11px] text-slate-400">SLA: {a.sla}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">{a.detail}</p>
              </div>
              <div className="flex w-full shrink-0 items-center gap-1.5 sm:w-auto sm:flex-col sm:items-end">
                {busyId === a.id ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" aria-hidden /> Recording…
                  </span>
                ) : (
                  <>
                    <Button size="sm" className="h-8 gap-1" onClick={() => onApprove(a)}>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => onChanges(a)}>
                      Changes
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-red-600 hover:text-red-700" onClick={() => onReject(a)}>
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ApprovalDetail({ detail: a, ageDays: age }: { detail: ApprovalRequest; ageDays: number }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={a.status} size="sm" />
        <StatusBadge status={a.priority} size="sm" />
        {a.stepUpRequired && (
          <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
            <ShieldCheck className="h-2.5 w-2.5" aria-hidden /> Step-up required
          </span>
        )}
      </div>

      <p className="text-[13.5px] leading-relaxed text-slate-700">{a.detail}</p>

      <dl className="divide-y rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5">
        <DetailRow label="Requester" value={`${getEmployee(a.requesterId)?.name ?? "External"} · ${a.department}`} />
        {a.amount !== undefined && <DetailRow label="Value" value={`₹${a.amount.toLocaleString("en-IN")}`} />}
        <DetailRow label="Submitted" value={`${fmtDateTime(a.submitted)} (${relTime(a.submitted)})`} />
        <DetailRow label="Waiting" value={age === 0 ? "Since this morning" : `${age} day${age === 1 ? "" : "s"}`} />
        <DetailRow label="Approval rule" value={a.rule} />
        <DetailRow label="SLA" value={a.sla} />
      </dl>

      {a.history && a.history.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</p>
          <ol className="space-y-2">
            {a.history.map((h, i) => (
              <li key={i} className="flex gap-2.5 text-xs">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium text-slate-800">{h.event}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {h.actor} · {fmtDateTime(h.at)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {a.status !== "Pending" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <MessageSquareWarning className="h-3.5 w-3.5" aria-hidden /> Decision{a.decidedBy ? ` by ${getEmployee(a.decidedBy)?.name ?? "approver"}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-600">{a.decisionNote}</p>
          {a.decidedAt && <p className="mt-1 text-[11px] text-slate-400">{fmtDateTime(a.decidedAt)} · audit reference recorded</p>}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
        <XCircle className="mt-px h-3 w-3 shrink-0" aria-hidden />
        Decisions are validated server-side (authority, step-up, note rules) and written to the enterprise audit trail — the UI cannot approve on your behalf.
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function ApprovalListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="qubit-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
      <span className="sr-only" role="status">Loading approvals…</span>
    </div>
  );
}
