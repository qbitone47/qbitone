"use client";

import * as React from "react";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  LifecycleBar,
  MobileBadge,
  MobileCard,
  MobileChecklistItem,
  MobileEmpty,
  MobileErrorBanner,
  MobileFrame,
  MobileSection,
  MobileSkeleton,
  MobileRow,
  SourceNote,
  VISIT_STAGES,
  mobilePost,
  useMobileSection,
} from "../mobile/parts";

// ============================================================
// Screen 292 · Mobile Service Visit — the complete field-visit
// workspace: lifecycle (Scheduled → En Route → Arrived → In
// Progress → Paused → Completed), checklist with critical gating,
// field notes, parts and evidence. The visit record itself lives in
// the ONE field-visit system; mobile adds the audited execution
// layer. GPS, warranty, serials, diagnostics and e-signatures are
// NOT fabricated — each boundary is stated (spec §13).
// ============================================================

interface VisitPayload {
  visit: {
    id: string; account: { name: string } | null; contact: { name: string } | null;
    plannedAt: number; durationMin: number; location: string; purpose: string; status: string;
    outcome: string | null; notes: string | null; nextAction: string | null; checkedInAt: number | null;
    completedAt: number | null; ownerName: string;
  };
  stage: string;
  allowedTransitions: string[];
  checklist: { kind: string; items: { id: string; label: string; critical: boolean; done: boolean }[] };
  criticalBlock: boolean;
  criticalOpen: string[];
  fieldNotes: { at: number; by: string; text: string }[];
  parts: { name: string; qty: number; at: number }[];
  evidence: string[];
  context: { warranty: string; serial: string; diagnosis: string; signature: string; gps: string };
  sourceNote: string;
}

const fmtDT = (ts: number) => new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export function MobileServiceVisitScreen() {
  const nav = useQubitNav();
  const { params } = nav;
  const { role } = useRole();
  const visitId = params.visitId ?? "";
  const { data, loading, error, reload } = useMobileSection<VisitPayload>("visit", { id: visitId });
  const [busy, setBusy] = React.useState(false);
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const [outcome, setOutcome] = React.useState("");

  const act = async (fn: () => Promise<{ message?: string }>, done: string) => {
    setBusy(true);
    try {
      const res = await fn();
      toast({ title: done, description: res.message });
      reload();
    } catch (e) {
      toast({ title: "Action blocked", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const transition = (stage: string) => {
    if (stage === "Completed") {
      setCompleteOpen(true);
      return;
    }
    act(() => mobilePost("visit.stage", { id: visitId, stage }, role), `Stage: ${stage}`);
  };

  const complete = () => {
    act(
      () => mobilePost("visit.stage", { id: visitId, stage: "Completed", outcome: outcome || "Resolved on site" }, role),
      "Visit completed",
    );
    setCompleteOpen(false);
  };

  return (
    <MobileFrame
      title={data?.visit.purpose ?? "Visit"}
      activeTab="business"
      onBack={() => nav.navigate("mobile-service-home")}
    >
      {loading && <MobileSkeleton rows={4} />}
      {error && !loading && <MobileErrorBanner message={error} onRetry={reload} />}
      {data && !loading && (
        <>
          {/* Lifecycle */}
          <LifecycleBar stages={VISIT_STAGES} current={data.stage} />
          {data.allowedTransitions.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-3">
              {data.allowedTransitions.map((st) => (
                <button
                  key={st}
                  type="button"
                  disabled={busy}
                  onClick={() => transition(st)}
                  className={
                    st === "Completed"
                      ? "min-h-[44px] rounded-full bg-emerald-600 px-4 text-[12.5px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                      : "min-h-[44px] rounded-full border border-blue-600 px-4 text-[12.5px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                  }
                >
                  {st === "En Route" ? "Start travel" : st === "Arrived" ? "Mark arrived" : st === "In Progress" ? "Check in & start work" : st === "Paused" ? "Pause" : `Move to ${st}`}
                </button>
              ))}
            </div>
          )}
          {data.criticalBlock && (
            <div className="mx-3 mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3" role="alert">
              <p className="text-[12.5px] font-semibold text-amber-900">Completion blocked — critical checklist open</p>
              <ul className="mt-1 list-disc pl-4 text-[12px] text-amber-800">
                {data.criticalOpen.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          )}

          {/* Visit facts */}
          <MobileSection title="Visit">
            <MobileCard>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[14.5px] font-semibold text-slate-900">{data.visit.account?.name ?? "Customer"}</p>
                  <p className="text-[12.5px] text-slate-500">{data.visit.location}</p>
                </div>
                <MobileBadge tone={data.stage === "Completed" ? "green" : data.stage === "In Progress" ? "blue" : "slate"}>{data.stage}</MobileBadge>
              </div>
              <dl className="mt-3 space-y-1.5 text-[12.5px]">
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Purpose</dt><dd className="font-medium text-slate-800">{data.visit.purpose}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Planned</dt><dd className="font-medium text-slate-800">{fmtDT(data.visit.plannedAt)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Contact</dt><dd className="font-medium text-slate-800">{data.visit.contact?.name ?? "—"}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Engineer</dt><dd className="font-medium text-slate-800">{data.visit.ownerName}</dd></div>
                {data.visit.checkedInAt && <div className="flex justify-between gap-2"><dt className="text-slate-500">Checked in</dt><dd className="font-medium tabular-nums text-slate-800">{fmtDT(data.visit.checkedInAt)}</dd></div>}
              </dl>
            </MobileCard>
          </MobileSection>

          {/* Checklist */}
          <MobileSection title={`Checklist · ${data.checklist.kind}`}>
            {data.checklist.items.map((c) => (
              <MobileChecklistItem
                key={c.id}
                label={c.label}
                critical={c.critical}
                done={c.done}
                onToggle={(done) => act(() => mobilePost("visit.checklist", { id: visitId, itemId: c.id, done }, role), done ? "Checklist item done" : "Item reopened")}
              />
            ))}
          </MobileSection>

          {/* Field notes */}
          <MobileSection title="Field notes & diagnosis">
            {data.fieldNotes.length ? (
              data.fieldNotes.map((n, i) => (
                <MobileCard key={i}>
                  <p className="text-[12.5px] leading-snug text-slate-700">{n.text}</p>
                  <p className="mt-1 text-[10.5px] text-slate-400">{n.by} · {fmtDT(n.at)}</p>
                </MobileCard>
              ))
            ) : (
              <MobileEmpty title="No field notes yet" />
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const text = window.prompt("Field note / diagnosis");
                if (text && text.trim().length >= 2) act(() => mobilePost("visit.note", { id: visitId, text }, role), "Note recorded");
              }}
              className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:border-blue-300"
            >
              Add field note
            </button>
          </MobileSection>

          {/* Parts */}
          <MobileSection title="Parts used">
            {data.parts.length ? (
              data.parts.map((p, i) => <MobileRow key={i} title={p.name} detail={`Qty ${p.qty} · ${fmtDT(p.at)}`} />)
            ) : (
              <MobileEmpty title="No parts recorded" />
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const name = window.prompt("Part name");
                if (name && name.trim().length >= 2) act(() => mobilePost("visit.part", { id: visitId, name }, role), "Part recorded");
              }}
              className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:border-blue-300"
            >
              Record part usage
            </button>
          </MobileSection>

          {/* Evidence */}
          <MobileSection title="Evidence">
            {data.evidence.length ? (
              data.evidence.map((e, i) => <MobileRow key={i} title={e} meta="Referenced item" />)
            ) : (
              <MobileEmpty title="No evidence attached" />
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const e = window.prompt("Evidence reference (e.g. photo id, meter reading)");
                if (e && e.trim().length >= 2) act(() => mobilePost("visit.note", { id: visitId, text: `Evidence: ${e}` }, role), "Evidence referenced");
              }}
              className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:border-blue-300"
            >
              Add evidence reference
            </button>
            <p className="px-1 text-[11px] leading-snug text-slate-400">
              Camera capture is not configured in this environment — evidence is recorded as referenced items, never as fake photos.
            </p>
          </MobileSection>

          {/* Honest boundaries */}
          <MobileSection title="Boundaries (what this screen will not invent)">
            <MobileCard className="border-slate-200 bg-slate-50/60">
              <ul className="space-y-2 text-[11.5px] leading-snug text-slate-600">
                <li><span className="font-semibold text-slate-800">GPS:</span> {data.context.gps}</li>
                <li><span className="font-semibold text-slate-800">Warranty:</span> {data.context.warranty}</li>
                <li><span className="font-semibold text-slate-800">Serial:</span> {data.context.serial}</li>
                <li><span className="font-semibold text-slate-800">Signature:</span> {data.context.signature}</li>
              </ul>
            </MobileCard>
          </MobileSection>

          {data.visit.outcome && (
            <MobileSection title="Outcome">
              <MobileCard className="border-emerald-200 bg-emerald-50/50">
                <p className="text-[12.5px] leading-snug text-emerald-900">{data.visit.outcome}</p>
                {data.visit.nextAction && <p className="mt-1 text-[12px] text-emerald-800">Next: {data.visit.nextAction}</p>}
              </MobileCard>
            </MobileSection>
          )}

          {/* Completion dialog */}
          {completeOpen && (
            <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Complete visit">
              <div className="w-full max-w-[430px] rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
                <p className="text-[14px] font-semibold text-slate-900">Complete visit</p>
                <label htmlFor="visit-outcome" className="mt-2 block text-[12px] font-medium text-slate-600">Outcome (required)</label>
                <textarea
                  id="visit-outcome"
                  rows={3}
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="What was the resolution?"
                />
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setCompleteOpen(false)} className="min-h-[48px] flex-1 rounded-xl border border-slate-300 text-[13px] font-medium text-slate-700">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy || outcome.trim().length < 4 || data.criticalBlock}
                    onClick={complete}
                    className="min-h-[48px] flex-1 rounded-xl bg-emerald-600 text-[13px] font-semibold text-white disabled:opacity-40"
                  >
                    Complete
                  </button>
                </div>
              </div>
            </div>
          )}

          <SourceNote>{data.sourceNote}</SourceNote>
          <p className="px-3 pb-2 text-[10px] text-slate-300">Screen 292 · Mobile Service Visit</p>
        </>
      )}
    </MobileFrame>
  );
}
