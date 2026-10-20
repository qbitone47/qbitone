"use client";

import * as React from "react";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  MobileBadge,
  MobileCard,
  MobileEmpty,
  MobileErrorBanner,
  MobileFrame,
  MobileSection,
  MobileSkeleton,
  MobileRow,
  FilterChips,
  SourceNote,
  mobilePost,
  useMobileSection,
} from "../mobile/parts";

// ============================================================
// Screen 294 · Mobile Approvals — the centralized Approval Matrix
// queue in your pocket. Decisions go through the SAME decideApproval
// enforcement as desktop: authority is checked server-side, rejects
// require a reason, sensitive requests require step-up
// reauthentication (spec §15).
// ============================================================

interface ApprovalBrief {
  id: string; kind: string; title: string; requester: string; department: string;
  amount: number | null; submitted: number; priority: string; status: string;
  sla: string; stepUpRequired: boolean; rule: string;
}
interface ListPayload {
  queue: ApprovalBrief[];
  history: ApprovalBrief[];
  scopeNote: string | null;
  canDecide: boolean;
  sourceNote: string;
}
interface DetailPayload {
  approval: ApprovalBrief & {
    detail: string;
    history: { at: number; actor: string; event: string }[];
    decidedAt: number | null; decidedBy: string | null; decisionNote: string | null;
  };
  canDecide: boolean;
  stepUpRequired: boolean;
  stepUpNote: string | null;
  sourceNote: string;
}

const fmtDT = (ts: number) => new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function MobileApprovalsScreen() {
  const nav = useQubitNav();
  const { params } = nav;
  const { role } = useRole();
  const approvalId = params.approvalId ?? "";
  const [tab, setTab] = React.useState("Pending");
  const list = useMobileSection<ListPayload>("approvals");
  const detail = useMobileSection<DetailPayload>("approvals", { id: approvalId });
  const [busy, setBusy] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [stepUpOpen, setStepUpOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [password, setPassword] = React.useState("");

  const decide = async (decision: "Approved" | "Rejected" | "Changes requested", opts?: { stepUpPassword?: string }) => {
    setBusy(true);
    try {
      const res = await mobilePost<{ message: string }>(
        "approval.decide",
        { id: approvalId, decision, note: decision === "Approved" ? undefined : note, ...opts },
        role,
      );
      toast({ title: `Request ${decision.toLowerCase()}`, description: res.message });
      setRejectOpen(false);
      setStepUpOpen(false);
      setNote("");
      setPassword("");
      nav.navigate("mobile-approvals");
      list.reload();
    } catch (e) {
      toast({ title: "Decision not accepted", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileFrame
      title={approvalId ? detail.data?.approval.title ?? "Request" : "Approvals"}
      activeTab="work"
      onBack={approvalId ? () => nav.navigate("mobile-approvals") : undefined}
    >
      {approvalId ? (
        <>
          {detail.loading && <MobileSkeleton rows={3} />}
          {detail.error && !detail.loading && <MobileErrorBanner message={detail.error} onRetry={detail.reload} />}
          {detail.data && !detail.loading && (
            <>
              <MobileSection title="Request">
                <MobileCard>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[14px] font-semibold leading-snug text-slate-900">{detail.data.approval.title}</p>
                    <MobileBadge tone={detail.data.approval.priority === "High" ? "red" : "slate"}>{detail.data.approval.priority}</MobileBadge>
                  </div>
                  <dl className="mt-2.5 space-y-1.5 text-[12.5px]">
                    <div className="flex justify-between gap-2"><dt className="text-slate-500">Type</dt><dd className="font-medium text-slate-800">{detail.data.approval.kind}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-slate-500">Requester</dt><dd className="font-medium text-slate-800">{detail.data.approval.requester} · {detail.data.approval.department}</dd></div>
                    {detail.data.approval.amount !== null && (
                      <div className="flex justify-between gap-2"><dt className="text-slate-500">Amount</dt><dd className="font-semibold tabular-nums text-slate-900">{money(detail.data.approval.amount)}</dd></div>
                    )}
                    <div className="flex justify-between gap-2"><dt className="text-slate-500">Submitted</dt><dd className="text-slate-800">{fmtDT(detail.data.approval.submitted)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-slate-500">SLA</dt><dd className="font-medium text-amber-700">{detail.data.approval.sla}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-slate-500">Rule</dt><dd className="max-w-[60%] truncate text-right text-slate-800">{detail.data.approval.rule}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-slate-500">Status</dt><dd><MobileBadge tone={detail.data.approval.status === "Pending" ? "blue" : detail.data.approval.status === "Approved" ? "green" : "red"}>{detail.data.approval.status}</MobileBadge></dd></div>
                  </dl>
                  <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[12px] leading-snug text-slate-600">{detail.data.approval.detail}</p>
                </MobileCard>
              </MobileSection>

              {detail.data.canDecide && detail.data.approval.status === "Pending" && (
                <MobileSection title="Decision">
                  <div className="grid grid-cols-1 gap-2">
                    <button type="button" disabled={busy} onClick={() => (detail.data!.stepUpRequired ? setStepUpOpen(true) : decide("Approved"))}
                      className="min-h-[52px] rounded-xl bg-emerald-600 text-[14px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
                      Approve{detail.data.stepUpRequired ? " · step-up required" : ""}
                    </button>
                    {!rejectOpen ? (
                      <button type="button" disabled={busy} onClick={() => setRejectOpen(true)}
                        className="min-h-[52px] rounded-xl border border-red-300 bg-white text-[14px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40">
                        Reject
                      </button>
                    ) : (
                      <MobileCard className="border-red-200">
                        <label htmlFor="rej-note" className="text-[12px] font-medium text-red-800">Reason (required for the audit trail)</label>
                        <textarea id="rej-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-red-200 p-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-red-500" />
                        <button type="button" disabled={busy || note.trim().length < 4} onClick={() => decide("Rejected")}
                          className="mt-2 min-h-[44px] w-full rounded-lg bg-red-600 text-[13px] font-semibold text-white disabled:opacity-40">
                          Confirm rejection
                        </button>
                      </MobileCard>
                    )}
                    <button type="button" disabled={busy} onClick={() => decide("Changes requested")}
                      className="min-h-[52px] rounded-xl border border-amber-300 bg-white text-[14px] font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-40">
                      Request changes
                    </button>
                    <button type="button" disabled={busy} onClick={() => nav.navigate("my-approvals", { approvalId })}
                      className="min-h-[48px] rounded-xl border border-slate-200 bg-white text-[13px] font-medium text-slate-600 hover:border-slate-300">
                      View full request on desktop
                    </button>
                  </div>
                  {detail.data.stepUpNote && <p className="px-1 pt-1 text-[11px] leading-snug text-slate-400">{detail.data.stepUpNote}</p>}
                </MobileSection>
              )}

              {stepUpOpen && (
                <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40" role="dialog" aria-modal="true" aria-label="Step-up verification">
                  <div className="w-full max-w-[430px] rounded-t-2xl bg-white p-4 shadow-xl">
                    <p className="text-[14px] font-semibold text-slate-900">Reauthentication required</p>
                    <p className="mt-1 text-[12px] text-slate-500">This request is flagged sensitive. Confirm your password to unlock the decision — the server verifies before accepting it.</p>
                    <label htmlFor="stepup-pw" className="mt-3 block text-[12px] font-medium text-slate-600">Password</label>
                    <input id="stepup-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-600" />
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => setStepUpOpen(false)} className="min-h-[48px] flex-1 rounded-xl border border-slate-300 text-[13px] font-medium text-slate-700">Cancel</button>
                      <button type="button" disabled={busy || password.length < 8} onClick={() => decide("Approved", { stepUpPassword: password })}
                        className="min-h-[48px] flex-1 rounded-xl bg-emerald-600 text-[13px] font-semibold text-white disabled:opacity-40">
                        Verify & approve
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <MobileSection title="History">
                {detail.data.approval.history.map((h, i) => (
                  <MobileRow key={i} title={h.event} detail={h.actor} meta={fmtDT(h.at)} />
                ))}
              </MobileSection>

              <SourceNote>{detail.data.sourceNote}</SourceNote>
              <p className="px-3 pb-2 text-[10px] text-slate-300">Screen 294 · Mobile Approvals</p>
            </>
          )}
        </>
      ) : (
        <>
          {list.loading && <MobileSkeleton rows={3} />}
          {list.error && !list.loading && <MobileErrorBanner message={list.error} onRetry={list.reload} />}
          {list.data && !list.loading && (
            <>
              <FilterChips options={["Pending", "History"]} value={tab} onChange={setTab} />
              {tab === "Pending" && (
                <MobileSection title={`Waiting on you (${list.data.queue.length})`}>
                  {list.data.queue.length ? (
                    list.data.queue.map((a) => (
                      <MobileRow
                        key={a.id}
                        title={a.title}
                        detail={`${a.kind} · ${a.requester}${a.amount !== null ? ` · ${money(a.amount)}` : ""}`}
                        meta={`SLA ${a.sla}${a.stepUpRequired ? " · step-up" : ""}`}
                        trailing={<MobileBadge tone={a.priority === "High" ? "red" : "slate"}>{a.priority}</MobileBadge>}
                        onClick={() => nav.navigate("mobile-approvals", { approvalId: a.id })}
                      />
                    ))
                  ) : (
                    <MobileEmpty title="Queue clear" detail={list.data.scopeNote ?? "No approvals are routed to this role."} />
                  )}
                </MobileSection>
              )}
              {tab === "History" && (
                <MobileSection title="Decided">
                  {list.data.history.length ? (
                    list.data.history.map((a) => (
                      <MobileRow
                        key={a.id}
                        title={a.title}
                        detail={`${a.kind} · ${a.requester}`}
                        trailing={<MobileBadge tone={a.status === "Approved" ? "green" : a.status === "Rejected" ? "red" : "amber"}>{a.status}</MobileBadge>}
                        onClick={() => nav.navigate("mobile-approvals", { approvalId: a.id })}
                      />
                    ))
                  ) : (
                    <MobileEmpty title="No decisions on record yet" />
                  )}
                </MobileSection>
              )}
              {!list.data.canDecide && (
                <SourceNote>
                  This role boundary holds no approval authority — the server rejects decisions even if a request renders, matching the desktop contract.
                </SourceNote>
              )}
              <SourceNote>{list.data.sourceNote}</SourceNote>
              <p className="px-3 pb-2 text-[10px] text-slate-300">Screen 294 · Mobile Approvals</p>
            </>
          )}
        </>
      )}
    </MobileFrame>
  );
}
