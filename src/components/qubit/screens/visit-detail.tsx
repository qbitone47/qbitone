"use client";

import * as React from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ClipboardList,
  ClipboardCheck,
  MapPin,
  Paperclip,
  ReceiptText,
  Route,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "../page-header";
import { ArrowLink, EmptyState, KV, SectionCard, StatusBadge } from "../primitives";
import { ConfirmDialog, Field, FormDialog } from "../dialogs";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import {
  ActivityTimeline,
  EntityLink,
  fmtDateTime,
  fmtRupees,
  relTime,
  salesPost,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  useSalesSection,
  type TimelineEntry,
} from "../sales/parts";

// ============================================================
// Screen 98 · Field Visit Detail — visit execution: checklist,
// check-in, outcome, evidence and the follow-up it creates.
// Checklist progress is local (device) until completion; the
// recorded outcome is what the server keeps.
// ============================================================

interface VisitDetail {
  id: string;
  accountId: string;
  contactId?: string;
  ownerId: string;
  ownerName: string;
  opportunityId?: string;
  plannedAt: number;
  durationMin: number;
  location: string;
  purpose: string;
  status: "Planned" | "In Progress" | "Completed" | "Cancelled";
  checklist: { label: string; done: boolean }[];
  notes?: string;
  outcome?: string;
  nextAction?: string;
  evidence?: string[];
  checkedInAt?: number;
  completedAt?: number;
  account?: { id: string; name: string } | null;
  contact?: { id: string; name: string } | null;
  opportunity?: { id: string; name: string } | null;
  travel?: { id: string; destination: string; startAt: number; endAt: number; status: string } | null;
  expenses?: { id: string; amount: number; category: string; status: string }[];
  activity?: { id: string; at: number; type: string; actorId: string; summary: string; outcome?: string; source?: string }[];
}

interface VisitPayload {
  visit: VisitDetail;
}

interface FormRefsPayload {
  owners: readonly { id: string; name: string; title: string }[];
  contacts: { id: string; name: string; accountId: string }[];
}

const OUTCOMES = ["Positive", "Neutral", "Follow-up required", "At risk"] as const;

// ---------- datetime-local helpers ----------

const pad2 = (n: number) => String(n).padStart(2, "0");

const toLocalInput = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const fromLocalInput = (v: string): number | undefined => {
  if (!v) return undefined;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : undefined;
};

/** Outcome strings may carry detail after " — "; the badge keeps the leading word. */
const outcomeHead = (outcome: string) => {
  const idx = outcome.indexOf(" — ");
  return idx > 0 ? outcome.slice(0, idx) : outcome;
};

const outcomeTail = (outcome: string) => {
  const idx = outcome.indexOf(" — ");
  return idx > 0 ? outcome.slice(idx + 3) : undefined;
};

// ============================================================

export function VisitDetailScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const visitId = nav.params.visitId;

  const { data, loading, error, forbidden, reload } = useSalesSection<VisitPayload>("visit", { id: visitId });
  const { data: refs } = useSalesSection<FormRefsPayload>("form-refs");

  const visit = data?.visit ?? null;

  // ---------- local checklist (planned/in-progress: device state) ----------
  const [checklist, setChecklist] = React.useState<{ label: string; done: boolean }[]>([]);
  React.useEffect(() => {
    if (visit) setChecklist(visit.checklist.map((c) => ({ ...c })));
  }, [visit]);

  const doneCount = checklist.filter((c) => c.done).length;
  const readOnlyChecklist = visit?.status === "Completed" || visit?.status === "Cancelled";

  // ---------- start visit ----------
  const [starting, setStarting] = React.useState(false);

  const startVisit = async () => {
    if (!visit) return;
    setStarting(true);
    try {
      const res = await salesPost("visit.start", { id: visit.id }, role);
      toast({ title: res.message ?? "Visit started — check-in recorded." });
      reload();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "The visit could not be started.", variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  // ---------- complete visit dialog ----------
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const [cOutcome, setCOutcome] = React.useState("");
  const [cNotes, setCNotes] = React.useState("");
  const [cNextAction, setCNextAction] = React.useState("");
  const [cScheduleFollowUp, setCScheduleFollowUp] = React.useState(false);
  const [cFollowSubject, setCFollowSubject] = React.useState("");
  const [cFollowDue, setCFollowDue] = React.useState("");
  const [completeError, setCompleteError] = React.useState<string | null>(null);
  const [completing, setCompleting] = React.useState(false);

  const openComplete = () => {
    const due = new Date(Date.now() + 2 * 86_400_000);
    due.setHours(10, 0, 0, 0);
    setCOutcome("");
    setCNotes("");
    setCNextAction("");
    setCScheduleFollowUp(false);
    setCFollowSubject(`Follow up on ${visit?.account?.name ?? "the visit"}`);
    setCFollowDue(toLocalInput(due.getTime()));
    setCompleteError(null);
    setCompleteOpen(true);
  };

  const submitComplete = async () => {
    if (!visit) return;
    if (!cOutcome) {
      setCompleteError("Record the visit outcome before completing.");
      return;
    }
    if (!cNotes.trim()) {
      setCompleteError("Add visit notes — they feed the customer timeline.");
      return;
    }
    setCompleting(true);
    setCompleteError(null);
    try {
      const followDueAt = cScheduleFollowUp ? fromLocalInput(cFollowDue) : undefined;
      const res = await salesPost(
        "visit.complete",
        {
          id: visit.id,
          outcome: cOutcome,
          notes: cNotes.trim(),
          nextAction: cNextAction.trim() || undefined,
          followUpSubject: cScheduleFollowUp && cFollowSubject.trim() ? cFollowSubject.trim() : undefined,
          followUpDueAt: cScheduleFollowUp && cFollowSubject.trim() && followDueAt ? followDueAt : undefined,
        },
        role,
      );
      toast({ title: res.message ?? "Visit completed — notes and outcome recorded." });
      setCompleteOpen(false);
      reload();
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : "The visit could not be completed.");
    } finally {
      setCompleting(false);
    }
  };

  // ---------- reschedule ----------
  const [reschedOpen, setReschedOpen] = React.useState(false);
  const [reschedInput, setReschedInput] = React.useState("");
  const [reschedError, setReschedError] = React.useState<string | null>(null);
  const [rescheduling, setRescheduling] = React.useState(false);

  const openReschedule = () => {
    setReschedInput(toLocalInput(Math.max(visit?.plannedAt ?? Date.now(), Date.now() + 3_600_000)));
    setReschedError(null);
    setReschedOpen(true);
  };

  const submitReschedule = async () => {
    if (!visit) return;
    const plannedAt = fromLocalInput(reschedInput);
    if (!plannedAt) {
      setReschedError("Pick a date and time.");
      return;
    }
    setRescheduling(true);
    setReschedError(null);
    try {
      const res = await salesPost("visit.reschedule", { id: visit.id, plannedAt }, role);
      toast({ title: res.message ?? "Visit rescheduled." });
      setReschedOpen(false);
      reload();
    } catch (err) {
      setReschedError(err instanceof Error ? err.message : "The visit could not be rescheduled.");
    } finally {
      setRescheduling(false);
    }
  };

  // ---------- cancel ----------
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  const submitCancel = async () => {
    if (!visit) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await salesPost("visit.cancel", { id: visit.id }, role);
      toast({ title: res.message ?? "Visit cancelled." });
      setCancelOpen(false);
      reload();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "The visit could not be cancelled.");
    } finally {
      setCancelling(false);
    }
  };

  // ---------- no param → guided empty state ----------
  if (!visitId) {
    return (
      <div>
        <PageHeader
          crumbs={[
            { label: "Sales" },
            { label: "Visit Planner", onClick: () => nav.navigate("visit-planner") },
            { label: "Visit Detail" },
          ]}
          title="Field Visit Detail"
          description="Visit execution — checklist, evidence, outcome and the follow-up it creates."
        />
        <div className="qubit-card">
          <EmptyState
            icon={<ClipboardList />}
            title="Open a visit from the Field Visit Planner"
            message="Visit Detail is a deep-linked workspace — pick a visit in the Field Visit Planner (97) and its execution view opens here."
            action={
              <Button size="sm" className="h-9 gap-1.5" onClick={() => nav.navigate("visit-planner")}>
                <ArrowRight className="h-4 w-4" aria-hidden /> Open the Field Visit Planner
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <SalesGate screenName="Field Visit Detail">
        <></>
      </SalesGate>
    );
  }

  // ---------- timeline with resolved actor names ----------
  const resolveActor = (actorId: string): string | undefined =>
    refs?.owners.find((o) => o.id === actorId)?.name ??
    refs?.contacts.find((c) => c.id === actorId)?.name ??
    (actorId.startsWith("wa-") ? "Customer (WhatsApp)" : undefined);

  const timeline: TimelineEntry[] = (visit?.activity ?? []).map((a) => ({
    id: a.id,
    at: a.at,
    type: a.type,
    actorName: resolveActor(a.actorId),
    summary: a.summary,
    outcome: a.outcome,
    source: a.source,
  }));

  const expenseTotal = (visit?.expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const executable = visit?.status === "Planned" || visit?.status === "In Progress";

  return (
    <div>
      <PageHeader
        crumbs={[
          { label: "Sales" },
          { label: "Visit Planner", onClick: () => nav.navigate("visit-planner") },
          { label: "Visit" },
        ]}
        title={visit ? `${visit.account?.name ?? "Customer site"} — visit` : "Field Visit Detail"}
        description={
          visit
            ? `${visit.purpose} · ${visit.ownerName} · ${fmtDateTime(visit.plannedAt)}`
            : undefined
        }
        meta={visit ? <StatusBadge status={visit.status} /> : undefined}
        actions={
          visit && (
            <>
              {visit.status === "Planned" && (
                <Button size="sm" className="h-9 gap-1.5" onClick={startVisit} disabled={starting}>
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> Start visit
                </Button>
              )}
              {visit.status === "In Progress" && (
                <Button size="sm" className="h-9 gap-1.5" onClick={openComplete}>
                  <ClipboardCheck className="h-3.5 w-3.5" aria-hidden /> Complete visit
                </Button>
              )}
              {executable && (
                <>
                  <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={openReschedule}>
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Reschedule
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => {
                      setCancelError(null);
                      setCancelOpen(true);
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden /> Cancel
                  </Button>
                </>
              )}
            </>
          )
        }
      />

      {error && !forbidden && (
        <>
          <SalesErrorBanner message={error} onRetry={reload} />
          <div className="qubit-card">
            <EmptyState
              icon={<ClipboardList />}
              title="Visit unavailable"
              message="The visit could not be opened — it may be outside your authorized scope. Back to the Field Visit Planner."
              action={
                <Button size="sm" variant="outline" onClick={() => nav.navigate("visit-planner")}>
                  Back to Visit Planner
                </Button>
              }
            />
          </div>
        </>
      )}
      {loading && <SalesSkeleton rows={3} />}

      {visit && !loading && (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            {/* Identity */}
            <SectionCard title="Visit" description="The customer context this visit runs against.">
              <dl className="divide-y divide-slate-100">
                <KV label="Customer">
                  {visit.account ? (
                    <EntityLink screen="account-detail" id={visit.account.id} label={visit.account.name} kind="account" />
                  ) : (
                    "—"
                  )}
                </KV>
                <KV label="Contact">
                  {visit.contact ? (
                    <EntityLink screen="contact-detail" id={visit.contact.id} label={visit.contact.name} kind="contact" />
                  ) : (
                    <span className="text-slate-400">No contact on the visit</span>
                  )}
                </KV>
                <KV label="Opportunity">
                  {visit.opportunity ? (
                    <EntityLink screen="opportunity-detail" id={visit.opportunity.id} label={visit.opportunity.name} kind="opportunity" />
                  ) : (
                    <span className="text-slate-400">Not linked</span>
                  )}
                </KV>
                <KV label="Location">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                    {visit.location}
                  </span>
                </KV>
                <KV label="Planned for">
                  <span className="tabular-nums">
                    {fmtDateTime(visit.plannedAt)} <span className="text-slate-400">({relTime(visit.plannedAt)})</span> · {visit.durationMin} min
                  </span>
                </KV>
                <KV label="Salesperson">{visit.ownerName}</KV>
                <KV label="Travel plan">
                  {visit.travel ? (
                    <button
                      type="button"
                      onClick={() => nav.navigate("sales-travel", { travelId: visit.travel!.id })}
                      className="inline-flex max-w-full items-center gap-1.5 text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700"
                      aria-label={`Open trip ${visit.travel.destination} on Sales Travel`}
                    >
                      <Route className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>Trip: {visit.travel.destination}</span>
                    </button>
                  ) : (
                    <span className="text-slate-400">No trip linked to this visit</span>
                  )}
                </KV>
                <KV label="Linked expenses">
                  <span className="tabular-nums">
                    {(visit.expenses ?? []).length} expense{((visit.expenses ?? []).length === 1 ? "" : "s")} ·{" "}
                    {fmtRupees(expenseTotal)} recorded
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    Submit and track claims in Sales Expenses (99) — Finance remains the financial source of truth.
                  </span>
                </KV>
              </dl>
              {visit.checkedInAt && (
                <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  Check-in recorded {fmtDateTime(visit.checkedInAt)} ({relTime(visit.checkedInAt)})
                  {visit.completedAt ? ` · completed ${fmtDateTime(visit.completedAt)}` : ""}
                </p>
              )}
            </SectionCard>

            {/* Checklist */}
            <SectionCard
              title="Visit checklist"
              description={
                readOnlyChecklist
                  ? "Completed visits keep their checklist as recorded."
                  : `${doneCount} of ${checklist.length} items done`
              }
            >
              <ul className="space-y-1.5" aria-label="Visit checklist">
                {checklist.map((item, i) => (
                  <li key={`${item.label}-${i}`}>
                    {readOnlyChecklist ? (
                      <span
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg border border-slate-100 bg-white px-3 py-2 text-[13px]",
                          item.done ? "text-slate-500" : "text-slate-400",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border",
                            item.done ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-slate-200 bg-slate-50 text-transparent",
                          )}
                          role="img"
                          aria-label={item.done ? "Done" : "Not done"}
                        >
                          <Check className="h-3 w-3" aria-hidden />
                        </span>
                        <span className={cn(item.done && "line-through")}>{item.label}</span>
                      </span>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-100 bg-white px-3 py-2 text-[13px] transition-colors hover:border-slate-200 hover:bg-slate-50/60">
                        <Checkbox
                          checked={item.done}
                          onCheckedChange={(checked) =>
                            setChecklist((list) => list.map((c, ci) => (ci === i ? { ...c, done: checked === true } : c)))
                          }
                          aria-label={item.label}
                        />
                        <span className={cn("select-none", item.done ? "text-slate-400 line-through" : "text-slate-700")}>{item.label}</span>
                      </label>
                    )}
                  </li>
                ))}
                {checklist.length === 0 && (
                  <li>
                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-muted-foreground">
                      No checklist items on this visit.
                    </p>
                  </li>
                )}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                Checklist progress is kept on this device until you complete the visit; the outcome below is what&apos;s recorded.
              </p>
            </SectionCard>
          </div>

          {/* Evidence & outcome — completed visits */}
          {visit.status === "Completed" && (
            <SectionCard
              title="Outcome & evidence"
              description="What happened at the visit, what happens next, and the evidence behind it."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  {visit.outcome && (
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={outcomeHead(visit.outcome)} size="sm" />
                      {outcomeTail(visit.outcome) && (
                        <span className="text-[13px] text-slate-600">{outcomeTail(visit.outcome)}</span>
                      )}
                    </div>
                  )}
                  {visit.notes && (
                    <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
                      <span className="font-medium text-slate-700">Notes:</span> {visit.notes}
                    </p>
                  )}
                  {visit.nextAction && (
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                      <span className="font-medium text-slate-700">Next action:</span> {visit.nextAction}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Evidence</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(visit.evidence ?? []).length === 0 ? (
                      <p className="text-xs text-slate-400">No evidence attached</p>
                    ) : (
                      (visit.evidence ?? []).map((e, i) => (
                        <span
                          key={`${e}-${i}`}
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                        >
                          <Paperclip className="h-3 w-3 shrink-0" aria-hidden />
                          <span className="truncate">{e}</span>
                        </span>
                      ))
                    )}
                  </div>
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
                    <ReceiptText className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                    <span>Evidence attachments are captured on mobile and verified by the manager.</span>
                  </p>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Timeline */}
          <SectionCard title="Visit timeline" description="Check-ins, completion and notes from the unified activity feed.">
            <ActivityTimeline
              entries={timeline}
              emptyMessage="No visit activity recorded yet — starting and completing the visit writes to this timeline."
            />
            <div className="mt-3 border-t border-slate-100 pt-3">
              <ArrowLink onClick={() => nav.navigate("visit-planner")} ariaLabel="Back to the Field Visit Planner">
                Field Visit Planner
              </ArrowLink>
            </div>
          </SectionCard>

          <SalesAsOf asOfLabel={SALES_PERIOD.asOfLabel} note="The server owns the visit lifecycle (Planned → In Progress → Completed) and records every transition in the audit trail." />
        </div>
      )}

      {/* Complete visit dialog */}
      <FormDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        title="Complete visit"
        description="Notes and outcome feed the customer timeline; a follow-up can be scheduled into the queue in the same step."
        onSubmit={submitComplete}
        submitLabel="Complete visit"
        submitting={completing}
        wide
      >
        <Field label="Outcome" required>
          <Select value={cOutcome || undefined} onValueChange={setCOutcome}>
            <SelectTrigger className="h-9 rounded-lg" aria-label="Visit outcome">
              <SelectValue placeholder="Choose the outcome" />
            </SelectTrigger>
            <SelectContent>
              {OUTCOMES.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Visit notes" required hint="What was discussed, decided and observed — this is what the customer timeline keeps.">
          <Textarea
            value={cNotes}
            onChange={(e) => setCNotes(e.target.value)}
            rows={4}
            className="rounded-lg"
            placeholder="Discussion summary, decisions, observations…"
          />
        </Field>
        <Field label="Next action" hint="Optional — the concrete next step this visit created.">
          <Input
            value={cNextAction}
            onChange={(e) => setCNextAction(e.target.value)}
            placeholder="e.g. Send revised quotation this week"
            className="h-9 rounded-lg"
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-[13px] text-slate-700">
          <Checkbox checked={cScheduleFollowUp} onCheckedChange={(checked) => setCScheduleFollowUp(checked === true)} aria-label="Schedule follow-up" />
          <span className="select-none font-medium">Schedule follow-up</span>
        </label>
        {cScheduleFollowUp && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Follow-up subject" required>
              <Input
                value={cFollowSubject}
                onChange={(e) => setCFollowSubject(e.target.value)}
                className="h-9 rounded-lg"
              />
            </Field>
            <Field label="Due" required hint="Defaults to two days out.">
              <Input
                type="datetime-local"
                value={cFollowDue}
                onChange={(e) => setCFollowDue(e.target.value)}
                className="h-9 rounded-lg"
              />
            </Field>
          </div>
        )}
        {completeError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {completeError}
          </p>
        )}
      </FormDialog>

      {/* Reschedule dialog */}
      <FormDialog
        open={reschedOpen}
        onOpenChange={setReschedOpen}
        title="Reschedule visit"
        description={visit ? `${visit.account?.name ?? "Customer site"} — ${visit.purpose}` : undefined}
        onSubmit={submitReschedule}
        submitLabel="Reschedule"
        submitting={rescheduling}
      >
        <Field label="New date & time" required hint="The server only accepts a future date and time.">
          <Input
            type="datetime-local"
            value={reschedInput}
            onChange={(e) => setReschedInput(e.target.value)}
            className="h-9 rounded-lg"
          />
        </Field>
        {reschedError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {reschedError}
          </p>
        )}
      </FormDialog>

      {/* Cancel confirm */}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this visit?"
        description={
          visit
            ? `${visit.account?.name ?? "Customer site"} — ${fmtDateTime(visit.plannedAt)}. The visit is kept as Cancelled for the record; any linked trip and expenses stay untouched.`
            : ""
        }
        confirmLabel="Cancel visit"
        destructive
        onConfirm={submitCancel}
      >
        {cancelError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {cancelError}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
