"use client";

import * as React from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  History,
  Inbox,
  IndianRupee,
  KeyRound,
  MessageSquareWarning,
  Percent,
  Receipt,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
  Warehouse,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getEmployee } from "@/lib/qubit/data";
import { fmtDateTime, relTime, WORKSPACE_NOW } from "@/lib/qubit/workspace-data";
import { formatINR, type ExecApproval } from "@/lib/qubit/executive-data";
import { PageHeader } from "../page-header";
import { Avatar, EmptyState, SectionCard, StatTile, StatusBadge } from "../primitives";
import { ArrowLink } from "../primitives";
import { DetailDrawer } from "../drawers";
import { ConfirmDialog, Field, FormDialog, StepUpDialog } from "../dialogs";
import { useRole } from "../role-context";
import {
  AsOfStrip,
  ExecApiError,
  ExecErrorBanner,
  ExecSkeleton,
  ExecutiveGate,
  PeriodChip,
  execPost,
  useExecutiveSection,
  useExecutiveNav,
} from "../executive/parts";

// ============================================================
// Screen 69 · Executive Approvals — decisions that require
// executive authority per the Approval Matrix (screen 09).
// Mirrors the My Approvals (46) decision discipline: every
// decision goes through the server (authority, step-up and
// note rules enforced there) and is written to the SAME
// enterprise audit trail. The UI never decides on its own.
// ============================================================

interface ApprovalsPayload {
  period: { label: string; window: string };
  asOfLabel: string;
  approvals: ExecApproval[];
}

type Decision = "Approved" | "Rejected" | "Changes requested";

const KIND_ICON: Record<ExecApproval["kind"], React.ReactNode> = {
  "Contract renewal": <FileText />,
  "Exception pricing": <Percent />,
  "Strategic hiring": <UserPlus />,
  "Capital purchase": <Warehouse />,
  "Elevated access": <KeyRound />,
  "Major expense": <Receipt />,
};

/** Extract "waiting N days" from the server SLA text (e.g. "3 working days · waiting 4 days"). */
const waitingDays = (sla: string): number => {
  const m = sla.match(/waiting\s+(\d+)\s+days?/i);
  return m ? Number(m[1]) : 0;
};

/** Requests at or beyond the 3-day executive mark. */
const PAST_SLA_DAYS = 3;
const ageDays = (a: ExecApproval) => Math.floor((WORKSPACE_NOW - a.submitted) / 86_400_000);
const isPastSla = (a: ExecApproval) => waitingDays(a.sla) >= PAST_SLA_DAYS;

const valueText = (a: ExecApproval): string | null =>
  a.amount !== undefined ? formatINR(a.amount) : a.annualCost !== undefined ? `${formatINR(a.annualCost)} / yr` : null;

export function ExecutiveApprovalsScreen() {
  const navigate = useExecutiveNav();
  const { role } = useRole();
  const { toast } = useToast();
  const { data, loading, error, reload } = useExecutiveSection<ApprovalsPayload>("approvals");

  const [tab, setTab] = React.useState<"queue" | "history">("queue");
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [detail, setDetail] = React.useState<ExecApproval | null>(null);
  const [approveTarget, setApproveTarget] = React.useState<ExecApproval | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<ExecApproval | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejectError, setRejectError] = React.useState<string | null>(null);
  const [changesTarget, setChangesTarget] = React.useState<ExecApproval | null>(null);
  const [changesNote, setChangesNote] = React.useState("");
  const [changesError, setChangesError] = React.useState<string | null>(null);
  const [stepUpTarget, setStepUpTarget] = React.useState<ExecApproval | null>(null);
  /** stays open when validation fails — Radix fires onOpenChange(false) AFTER onConfirm */
  const rejectBlocked = React.useRef(false);

  const approvals = data?.approvals ?? [];
  const pending = React.useMemo(() => approvals.filter((a) => a.state === "Pending"), [approvals]);
  const decided = React.useMemo(() => approvals.filter((a) => a.state !== "Pending"), [approvals]);
  const pastSla = React.useMemo(() => pending.filter(isPastSla), [pending]);
  const highValue = React.useMemo(
    () => pending.filter((a) => (a.amount ?? 0) >= 0.5 || (a.annualCost ?? 0) >= 0.5),
    [pending],
  );

  const decide = async (target: ExecApproval, decision: Decision, note?: string, stepUpPassword?: string): Promise<boolean> => {
    setBusyId(target.id);
    try {
      await execPost({ action: "approval.decide", id: target.id, decision, note, stepUpPassword }, role);
      toast({
        title: decision === "Approved" ? "Request approved" : decision === "Rejected" ? "Request rejected" : "Changes requested",
        description: `${target.kind} · ${target.title} — the decision and its audit reference are recorded.`,
      });
      reload();
      setDetail(null);
      return true;
    } catch (err) {
      const message = err instanceof ExecApiError ? err.message : "The executive approval service is unreachable. Nothing was changed.";
      toast({ variant: "destructive", title: "Decision not recorded", description: message });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const openApprove = (a: ExecApproval) => (a.stepUpRequired ? setStepUpTarget(a) : setApproveTarget(a));

  return (
    <ExecutiveGate screenName="Executive Approvals">
      <div>
        <PageHeader
          crumbs={[{ label: "CEO Command Center" }, { label: "Executive Approvals" }]}
          title="Executive Approvals"
          description="Decisions only executive authority can make — routed by the Approval Matrix, protected by step-up authentication where required, recorded in the enterprise audit trail."
          actions={
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={reload} aria-label="Reload executive approvals">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
            </Button>
          }
          meta={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {data && <PeriodChip label={data.period.label} window={data.period.window} />}
              <ArrowLink onClick={() => navigate("approval-matrix")} ariaLabel="Open Approval Matrix configuration">
                Approval Matrix configuration
              </ArrowLink>
              <ArrowLink
                onClick={() => navigate("executive-alerts", { correlationId: "alr-07" })}
                ariaLabel="Open the related Executive Alert about decisions pending beyond SLA"
              >
                Related alert · decisions beyond SLA
              </ArrowLink>
            </div>
          }
        />

        {error && <ExecErrorBanner message={error} onRetry={reload} />}

        {pastSla.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5" role="note">
            <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <p className="text-xs text-amber-800">
              <span className="font-semibold">
                {pastSla.length} decision{pastSla.length === 1 ? "" : "s"} past the {PAST_SLA_DAYS}-day mark
              </span>{" "}
              — {pastSla.map((a) => a.kind).join(", ")}. The related alert is tracked in Executive Alerts.
            </p>
          </div>
        )}

        {!loading && approvals.length > 0 && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={<Inbox />} value={pending.length} label="Needs my decision" />
            <StatTile icon={<Clock />} value={pastSla.length} label={`Waiting ${PAST_SLA_DAYS}+ days`} />
            <StatTile icon={<IndianRupee />} value={highValue.length} label="High-value (≥ ₹0.5 Cr)" />
            <StatTile icon={<CheckCircle2 />} value={decided.length} label="Decided" />
          </div>
        )}

        {/* Tabs */}
        <div className="mb-3 flex items-center gap-1" role="tablist" aria-label="Executive approval views">
          {(
            [
              { id: "queue", label: `Needs my decision (${pending.length})` },
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
          <ExecSkeleton rows={3} />
        ) : tab === "queue" ? (
          <ApprovalQueue
            items={pending}
            busyId={busyId}
            onOpen={setDetail}
            onApprove={openApprove}
            onReject={setRejectTarget}
            onChanges={setChangesTarget}
          />
        ) : (
          <SectionCard title="Decision history" description="Executive decisions recorded through this screen — mirrored in the enterprise Audit Log.">
            {decided.length === 0 ? (
              <EmptyState
                icon={<History />}
                title="No decisions recorded yet"
                message="Approve, reject or request changes on a pending decision and it will appear here with its note and audit reference."
              />
            ) : (
              <ul className="divide-y">
                {decided.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                    <button type="button" onClick={() => setDetail(a)} className="min-w-0 flex-1 text-left" aria-label={`Open decision: ${a.title}`}>
                      <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-slate-800">
                        <span className="truncate">{a.title}</span>
                        <StatusBadge status={a.state} size="sm" />
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.kind} · {getEmployee(a.requesterId)?.name ?? "External"} · {a.department}
                        {valueText(a) ? ` · ${valueText(a)}` : ""} · decided {relTime(a.decidedAt ?? a.submitted)}
                        {a.decidedBy ? ` by ${getEmployee(a.decidedBy)?.name ?? a.decidedBy}` : ""}
                      </p>
                      {a.decisionNote && <p className="mt-1 text-[11.5px] italic text-slate-500">“{a.decisionNote}”</p>}
                    </button>
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
            detail?.state === "Pending" ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="h-8 gap-1.5" disabled={busyId === detail.id} onClick={() => openApprove(detail)}>
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
          {detail && <ApprovalDetail detail={detail} />}
        </DetailDrawer>

        {/* Approve confirm */}
        <ConfirmDialog
          open={Boolean(approveTarget)}
          onOpenChange={(o) => !o && setApproveTarget(null)}
          title="Approve this request?"
          description={
            approveTarget
              ? `${approveTarget.kind} from ${getEmployee(approveTarget.requesterId)?.name ?? "an external requester"}${valueText(approveTarget) ? ` · ${valueText(approveTarget)}` : ""}. The decision is final once recorded — it can only be revised through a new request.`
              : ""
          }
          confirmLabel="Record approval"
          onConfirm={() => {
            if (approveTarget) void decide(approveTarget, "Approved");
            setApproveTarget(null);
          }}
        />

        {/* Reject — reason required (client check, server enforces 422) */}
        <ConfirmDialog
          open={Boolean(rejectTarget)}
          onOpenChange={(o) => {
            if (!o) {
              if (rejectBlocked.current) {
                rejectBlocked.current = false;
                return;
              }
              setRejectTarget(null);
              setRejectReason("");
              setRejectError(null);
            }
          }}
          title="Reject this request?"
          description="A short reason is required — it goes to the requester and into the audit record."
          confirmLabel="Record rejection"
          destructive
          onConfirm={() => {
            if (!rejectTarget) return;
            if (rejectReason.trim().length < 4) {
              rejectBlocked.current = true;
              setRejectError("A reason of at least 4 characters is required — the server rejects rejections without one.");
              return;
            }
            const target = rejectTarget;
            setRejectTarget(null);
            setRejectReason("");
            setRejectError(null);
            void decide(target, "Rejected", rejectReason.trim());
          }}
        >
          <div className="space-y-1.5 py-2">
            <Label htmlFor="exec-reject-reason" className="text-xs font-medium text-slate-700">
              Reason <span className="text-red-500" aria-hidden>*</span>
            </Label>
            <Textarea
              id="exec-reject-reason"
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                if (rejectError) setRejectError(null);
              }}
              placeholder="e.g. Below the margin floor — counter at 12% with reduced scope."
              className="min-h-20"
              autoFocus
            />
            {rejectError ? (
              <p role="alert" className="text-[11px] text-red-600">
                {rejectError}
              </p>
            ) : (
              rejectReason.trim().length > 0 &&
              rejectReason.trim().length < 4 && <p className="text-[11px] text-red-600">Give a slightly longer reason (at least 4 characters).</p>
            )}
          </div>
        </ConfirmDialog>

        {/* Request changes — FormDialog with note */}
        <FormDialog
          open={Boolean(changesTarget)}
          onOpenChange={(o) => {
            if (!o) {
              setChangesTarget(null);
              setChangesNote("");
              setChangesError(null);
            }
          }}
          title="Request changes"
          description={
            changesTarget
              ? `${changesTarget.kind} · ${changesTarget.title}. The requester can revise and resubmit; your note explains what is missing.`
              : undefined
          }
          submitLabel="Send change request"
          onSubmit={() => {
            if (!changesTarget) return;
            if (changesNote.trim().length < 4) {
              setChangesError("A note of at least 4 characters is required — it is recorded in the audit trail.");
              return;
            }
            const target = changesTarget;
            const note = changesNote.trim();
            setChangesTarget(null);
            setChangesNote("");
            setChangesError(null);
            void decide(target, "Changes requested", note);
          }}
        >
          <Field label="What needs to change?" required hint="Sent to the requester and recorded with the decision.">
            <Textarea
              value={changesNote}
              onChange={(e) => {
                setChangesNote(e.target.value);
                if (changesError) setChangesError(null);
              }}
              placeholder="e.g. Add the FY28 volume sensitivity before re-submission."
              className="min-h-20"
              autoFocus
            />
          </Field>
          {changesError && (
            <p role="alert" className="text-[11px] text-red-600">
              {changesError}
            </p>
          )}
        </FormDialog>

        {/* Step-up for sensitive executive decisions */}
        <StepUpDialog
          open={Boolean(stepUpTarget)}
          onOpenChange={(o) => {
            if (!o) {
              setStepUpTarget(null);
            }
          }}
          title="Confirm with step-up authentication"
          description={
            stepUpTarget
              ? `This is a high-value or sensitive decision (${stepUpTarget.kind}${valueText(stepUpTarget) ? ` · ${valueText(stepUpTarget)}` : ""}). Verify your password before the approval is recorded.`
              : ""
          }
          confirmLabel="Verify & record approval"
          verifying={Boolean(stepUpTarget && busyId === stepUpTarget.id)}
          onConfirm={(password) => {
            if (!stepUpTarget) return;
            void decide(stepUpTarget, "Approved", undefined, password).then((ok) => {
              if (ok) setStepUpTarget(null);
            });
          }}
        />

        <AsOfStrip asOfLabel={data?.asOfLabel ?? ""} note="Decision states refresh from the executive enforcement store after every recorded action." />
      </div>
    </ExecutiveGate>
  );
}

// ---------- queue ----------

function ApprovalQueue({
  items,
  busyId,
  onOpen,
  onApprove,
  onReject,
  onChanges,
}: {
  items: ExecApproval[];
  busyId: string | null;
  onOpen: (a: ExecApproval) => void;
  onApprove: (a: ExecApproval) => void;
  onReject: (a: ExecApproval) => void;
  onChanges: (a: ExecApproval) => void;
}) {
  if (items.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          icon={<ClipboardCheck />}
          title="The executive queue is clear"
          message="Nothing is waiting on your authority. New requests appear here the moment the Approval Matrix routes a final stage to you."
        />
      </SectionCard>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((a) => {
        const requester = getEmployee(a.requesterId);
        const past = isPastSla(a);
        const value = valueText(a);
        return (
          <article key={a.id} className={cn("qubit-card qubit-card-hover p-4", past && "border-amber-200")}>
            <div className="flex flex-wrap items-start gap-3">
              <span className="qubit-icon-tile qubit-icon-tile-accent h-10 w-10 shrink-0">{KIND_ICON[a.kind]}</span>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onOpen(a)} className="block text-left" aria-label={`Open executive approval: ${a.title}`}>
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-slate-900">
                    <span className="truncate">{a.title}</span>
                    {a.stepUpRequired && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
                        <ShieldCheck className="h-2.5 w-2.5" aria-hidden /> Step-up required
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{a.kind}</span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar name={requester?.name ?? "External"} size="xs" />
                      {requester?.name ?? "External"} · {a.department}
                    </span>
                    {value && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="font-medium tabular-nums text-slate-700">{value}</span>
                      </>
                    )}
                  </p>
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">
                    Stage: <span className="font-medium text-slate-600">{a.stage}</span>
                  </span>
                  <span aria-hidden className="text-slate-200">|</span>
                  <StatusBadge status={a.priority} size="sm" />
                  <span aria-hidden className="text-slate-200">|</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    Risk: <StatusBadge status={a.risk.level} size="sm" />
                  </span>
                  <span aria-hidden className="text-slate-200">|</span>
                  <span className="text-[11px] text-slate-400">
                    Rule: <span className="font-medium text-slate-600">{a.rule}</span>
                  </span>
                  <span aria-hidden className="text-slate-200">|</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      past ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600",
                    )}
                  >
                    <Clock className="h-3 w-3" aria-hidden /> SLA: {a.sla}
                  </span>
                  <span aria-hidden className="text-slate-200">|</span>
                  <span className="text-[11px] text-slate-400">Submitted {relTime(a.submitted)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
                  <span className="font-medium text-slate-700">{a.risk.level} risk:</span> {a.risk.detail}
                </p>
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

// ---------- detail ----------

function ApprovalDetail({ detail: a }: { detail: ExecApproval }) {
  const value = valueText(a);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={a.state} size="sm" />
        <StatusBadge status={a.priority} size="sm" />
        <StatusBadge status={a.risk.level} size="sm" />
        {a.stepUpRequired && (
          <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
            <ShieldCheck className="h-2.5 w-2.5" aria-hidden /> Step-up required
          </span>
        )}
      </div>

      <p className="text-[13.5px] leading-relaxed text-slate-700">{a.detail}</p>

      <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
          <TriangleAlert className="h-3.5 w-3.5 text-amber-600" aria-hidden /> Risk assessment — {a.risk.level}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{a.risk.detail}</p>
      </div>

      <dl className="divide-y rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5">
        <DetailRow
          label="Requester"
          value={
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={getEmployee(a.requesterId)?.name ?? "External"} size="xs" />
              {getEmployee(a.requesterId)?.name ?? "External"} · {a.department}
            </span>
          }
        />
        {value && <DetailRow label={a.annualCost !== undefined ? "Annual cost" : "Value"} value={<span className="tabular-nums">{value}</span>} />}
        <DetailRow label="Stage" value={a.stage} />
        <DetailRow label="Submitted" value={`${fmtDateTime(a.submitted)} (${relTime(a.submitted)})`} />
        <DetailRow label="Approval rule" value={a.rule} />
        <DetailRow label="SLA" value={a.sla} />
      </dl>

      {a.history.length > 0 && (
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

      {a.state !== "Pending" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <MessageSquareWarning className="h-3.5 w-3.5" aria-hidden /> Decision{a.decidedBy ? ` by ${getEmployee(a.decidedBy)?.name ?? a.decidedBy}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-600">{a.decisionNote ?? "No note recorded."}</p>
          {a.decidedAt && <p className="mt-1 text-[11px] text-slate-400">{fmtDateTime(a.decidedAt)} · audit reference recorded</p>}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
        <XCircle className="mt-px h-3 w-3 shrink-0" aria-hidden />
        Recorded in the enterprise audit trail; routed via the Approval Matrix. Decisions are validated server-side — authority, step-up and note rules — the UI cannot approve on your behalf.
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-slate-800">{value}</dd>
    </div>
  );
}
