"use client";

import * as React from "react";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  ListChecks,
  Mail,
  MessageCircle,
  Phone,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "../page-header";
import { EmptyState, FilterBar, SectionCard, StatusBadge } from "../primitives";
import { Field, FormDialog } from "../dialogs";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  EntityLink,
  fmtDateTime,
  relTime,
  salesPost,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  ScopeNote,
  useSalesSection,
} from "../sales/parts";

// ============================================================
// Screen 84 · Follow-up Queue — the operational follow-up
// workspace. The server owns the states (Overdue / Due Today /
// Upcoming / Completed); this screen only groups, counts and acts.
// Every completion carries an outcome into the customer timeline;
// rescheduling is honest scheduling, never silent.
// ============================================================

interface FollowUpRow {
  id: string;
  type: "Call" | "Email" | "WhatsApp" | "Meeting" | "Visit" | "Send Quote";
  subject: string;
  ownerId: string;
  leadId?: string;
  accountId?: string;
  contactId?: string;
  opportunityId?: string;
  dueAt: number;
  state: "Overdue" | "Due Today" | "Upcoming" | "Completed" | "Cancelled";
  priority: "High" | "Medium" | "Low";
  lastInteractionAt?: number;
  outcome?: string;
  completedAt?: number;
}

interface FollowupsPayload {
  rows: FollowUpRow[];
  scope: "company" | "team" | "own" | null;
}

interface FormRefsPayload {
  owners: readonly { id: string; name: string; title: string }[];
  accounts: { id: string; name: string; ownerId: string }[];
  contacts: { id: string; name: string; accountId: string }[];
  opportunities: { id: string; name: string; accountId: string }[];
  leads: { id: string; name: string; company: string }[];
}

const TYPE_ICON: Record<FollowUpRow["type"], React.ReactNode> = {
  Call: <Phone className="h-3.5 w-3.5" aria-hidden />,
  Email: <Mail className="h-3.5 w-3.5" aria-hidden />,
  WhatsApp: <MessageCircle className="h-3.5 w-3.5" aria-hidden />,
  Meeting: <CalendarDays className="h-3.5 w-3.5" aria-hidden />,
  Visit: <Users className="h-3.5 w-3.5" aria-hidden />,
  "Send Quote": <FileText className="h-3.5 w-3.5" aria-hidden />,
};

const FU_TYPES: FollowUpRow["type"][] = ["Call", "Email", "WhatsApp", "Meeting", "Visit", "Send Quote"];
const FU_PRIORITIES: FollowUpRow["priority"][] = ["High", "Medium", "Low"];

const PRIORITY_CHIP: Record<FollowUpRow["priority"], string> = {
  High: "border-red-200 bg-red-50 text-red-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-slate-200 bg-slate-50 text-slate-500",
};

function PriorityChip({ priority }: { priority: FollowUpRow["priority"] }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded border px-1.5 py-px text-[10.5px] font-medium", PRIORITY_CHIP[priority])}>
      {priority}
    </span>
  );
}

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

// ---------- one queue row (list row, not a table) ----------

interface RowActions {
  onComplete: (row: FollowUpRow) => void;
  onReschedule: (row: FollowUpRow) => void;
}

function FollowupItem({
  row,
  ownerName,
  leadName,
  accountName,
  opportunityName,
  actions,
}: {
  row: FollowUpRow;
  ownerName: string;
  leadName?: string;
  accountName?: string;
  opportunityName?: string;
  actions: RowActions;
}) {
  const done = row.state === "Completed";
  const overdue = row.state === "Overdue";

  return (
    <li
      className={cn(
        "rounded-lg border bg-white px-3.5 py-3",
        overdue ? "border-l-2 border-l-red-500 border-y-slate-200/80 border-r-slate-200/80" : "border-slate-200/80",
        done && "bg-slate-50/40",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "qubit-icon-tile mt-0.5 h-8 w-8 shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5",
            !done && "qubit-icon-tile-accent",
          )}
        >
          {TYPE_ICON[row.type] ?? <ClipboardList className="h-3.5 w-3.5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("min-w-0 flex-1 basis-48 text-[13.5px] font-medium", done ? "text-slate-500" : "text-slate-800")}>
              {row.subject}
            </p>
            <PriorityChip priority={row.priority} />
            <StatusBadge status={row.state} size="sm" />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-400">
            {row.leadId && (
              <EntityLink screen="lead-detail" id={row.leadId} label={leadName ?? "Lead"} kind="lead" />
            )}
            {row.accountId && (
              <EntityLink screen="account-detail" id={row.accountId} label={accountName ?? "Account"} kind="account" />
            )}
            {row.opportunityId && (
              <EntityLink screen="opportunity-detail" id={row.opportunityId} label={opportunityName ?? "Opportunity"} kind="opportunity" />
            )}
            {!row.leadId && !row.accountId && !row.opportunityId && <span>No linked record</span>}
            <span aria-hidden>·</span>
            <span>{ownerName}</span>
            <span aria-hidden>·</span>
            {done ? (
              <span>
                completed {row.completedAt ? fmtDateTime(row.completedAt) : "—"}
                {row.completedAt ? <span className="tabular-nums"> ({relTime(row.completedAt)})</span> : null}
              </span>
            ) : (
              <span>
                due {fmtDateTime(row.dueAt)} <span className="tabular-nums">({relTime(row.dueAt)})</span>
              </span>
            )}
          </p>
          {done && row.outcome && (
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              <span className="font-medium text-slate-600">Outcome:</span> {row.outcome}
            </p>
          )}
        </div>
      </div>
      {!done && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-11">
          {row.type === "Call" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() =>
                toast({
                  title: "Calling happens from the contact record or Qubit One Mobile (demo)",
                  description: "The desktop workspace keeps the queue honest — dialing stays with the contact.",
                })
              }
            >
              <Phone className="h-3 w-3" aria-hidden /> Call
            </Button>
          )}
          <Button size="sm" className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => actions.onComplete(row)}>
            <CheckCircle2 className="h-3 w-3" aria-hidden /> Complete
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => actions.onReschedule(row)}>
            <CalendarClock className="h-3 w-3" aria-hidden /> Reschedule
          </Button>
        </div>
      )}
    </li>
  );
}

// ---------- group shell ----------

function GroupEmpty({ title, message }: { title: string; message: string }) {
  return (
    <EmptyState icon={<ListChecks className="h-5 w-5" />} title={title} message={message} className="py-7" />
  );
}

// ============================================================

export function FollowupQueueScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { data, loading, error, forbidden, scope, reload } = useSalesSection<FollowupsPayload>("followups");
  const refs = useSalesSection<FormRefsPayload>("form-refs");

  const [ownerFilter, setOwnerFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [completedOpen, setCompletedOpen] = React.useState(false);

  // dialog state — one pair of dialogs driven by the active row
  const [dialog, setDialog] = React.useState<{ mode: "complete" | "reschedule"; row: FollowUpRow } | null>(null);
  const [outcome, setOutcome] = React.useState("");
  const [dueInput, setDueInput] = React.useState("");
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const combinedLoading = loading || refs.loading;
  const combinedError = error ?? refs.error;
  const retryAll = () => {
    reload();
    refs.reload();
  };

  const nameOf = React.useMemo(() => new Map((refs.data?.owners ?? []).map((o) => [o.id, o.name])), [refs.data]);
  const leadNames = React.useMemo(() => new Map((refs.data?.leads ?? []).map((l) => [l.id, l.name])), [refs.data]);
  const accountNames = React.useMemo(() => new Map((refs.data?.accounts ?? []).map((a) => [a.id, a.name])), [refs.data]);
  const oppNames = React.useMemo(() => new Map((refs.data?.opportunities ?? []).map((o) => [o.id, o.name])), [refs.data]);

  const rows = React.useMemo(() => {
    let r = data?.rows ?? [];
    if (ownerFilter !== "all") r = r.filter((f) => f.ownerId === ownerFilter);
    if (typeFilter !== "all") r = r.filter((f) => f.type === typeFilter);
    if (priorityFilter !== "all") r = r.filter((f) => f.priority === priorityFilter);
    return r;
  }, [data, ownerFilter, typeFilter, priorityFilter]);

  // Cancelled items are excluded from the queue display entirely.
  const overdue = React.useMemo(() => rows.filter((f) => f.state === "Overdue").sort((a, b) => a.dueAt - b.dueAt), [rows]);
  const dueToday = React.useMemo(() => rows.filter((f) => f.state === "Due Today").sort((a, b) => a.dueAt - b.dueAt), [rows]);
  const upcoming = React.useMemo(() => rows.filter((f) => f.state === "Upcoming").sort((a, b) => a.dueAt - b.dueAt), [rows]);
  const completed = React.useMemo(
    () => rows.filter((f) => f.state === "Completed").sort((a, b) => (b.completedAt ?? b.dueAt) - (a.completedAt ?? a.dueAt)),
    [rows],
  );
  const completedShown = completedOpen ? completed.slice(0, 6) : [];

  const filtersActive = ownerFilter !== "all" || typeFilter !== "all" || priorityFilter !== "all";
  const total = data?.rows.length ?? 0;
  const canFilterOwner = role === "administrator" || role === "dept-head";

  const openComplete = (row: FollowUpRow) => {
    setOutcome("");
    setDialogError(null);
    setDialog({ mode: "complete", row });
  };

  const openReschedule = (row: FollowUpRow) => {
    // Prefill with a workable slot: the later of the current due time or one hour from now.
    setDueInput(toLocalInput(Math.max(row.dueAt, Date.now() + 3_600_000)));
    setDialogError(null);
    setDialog({ mode: "reschedule", row });
  };

  const submitComplete = async () => {
    if (!dialog || dialog.mode !== "complete") return;
    setSubmitting(true);
    setDialogError(null);
    try {
      const res = await salesPost("followup.complete", { id: dialog.row.id, outcome: outcome.trim() }, role);
      toast({ title: res.message ?? "Follow-up completed — outcome recorded in the customer timeline." });
      setDialog(null);
      reload();
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "The follow-up could not be completed.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitReschedule = async () => {
    if (!dialog || dialog.mode !== "reschedule") return;
    const dueAt = fromLocalInput(dueInput);
    if (!dueAt) {
      setDialogError("Pick a date and time.");
      return;
    }
    setSubmitting(true);
    setDialogError(null);
    try {
      const res = await salesPost("followup.reschedule", { id: dialog.row.id, dueAt }, role);
      toast({ title: res.message ?? "Follow-up rescheduled." });
      setDialog(null);
      reload();
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "The follow-up could not be rescheduled.");
    } finally {
      setSubmitting(false);
    }
  };

  if (forbidden) {
    return (
      <SalesGate screenName="Follow-up Queue">
        <></>
      </SalesGate>
    );
  }

  const actions: RowActions = { onComplete: openComplete, onReschedule: openReschedule };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Follow-up Queue" }]}
        title="Follow-up Queue"
        description="The operational follow-up workspace — complete with an outcome, reschedule honestly, and the customer timeline stays true."
        actions={
          <Button variant="ghost" size="sm" className="h-9 text-blue-600" onClick={() => nav.navigate("lead-inbox")}>
            Schedule from a lead
          </Button>
        }
      />

      {combinedError && <SalesErrorBanner message={combinedError} onRetry={retryAll} />}
      {combinedLoading && <SalesSkeleton rows={4} />}

      {data && !combinedLoading && (
        <div className="space-y-4">
          {/* Filters — owner only where the role can actually see more than one owner */}
          <div className="qubit-card p-4">
            <FilterBar
              left={
                <>
                  {canFilterOwner && (
                    <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                      <SelectTrigger size="sm" className="w-[168px]" aria-label="Filter by owner">
                        <SelectValue placeholder="Owner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All owners</SelectItem>
                        {(refs.data?.owners ?? []).map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger size="sm" className="w-[140px]" aria-label="Filter by type">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {FU_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger size="sm" className="w-[148px]" aria-label="Filter by priority">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priorities</SelectItem>
                      {FU_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              }
              right={
                <p className="text-xs tabular-nums text-muted-foreground" role="status">
                  {filtersActive ? `${rows.length} of ${total}` : `${total}`} follow-up{total === 1 ? "" : "s"} in scope
                  {filtersActive ? " after filters" : ""}
                </p>
              }
            />
            <div className="mt-2">
              <ScopeNote scope={scope} what="follow-ups" />
            </div>
          </div>

          {/* Overdue — worked first, red accent */}
          <SectionCard
            title={`Overdue (${overdue.length})`}
            description="Past due — work these first. Complete with an outcome, or reschedule to a time you will actually keep."
          >
            {overdue.length === 0 ? (
              <GroupEmpty title="Nothing overdue — well kept" message="Overdue follow-ups appear here the moment a due date passes." />
            ) : (
              <ul className="space-y-2.5">
                {overdue.map((row) => (
                  <FollowupItem
                    key={row.id}
                    row={row}
                    ownerName={nameOf.get(row.ownerId) ?? row.ownerId}
                    leadName={row.leadId ? leadNames.get(row.leadId) : undefined}
                    accountName={row.accountId ? accountNames.get(row.accountId) : undefined}
                    opportunityName={row.opportunityId ? oppNames.get(row.opportunityId) : undefined}
                    actions={actions}
                  />
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Due today */}
          <SectionCard
            title={`Due today (${dueToday.length})`}
            description="Everything the server has marked for today, earliest first."
          >
            {dueToday.length === 0 ? (
              <GroupEmpty title="Nothing due for the rest of today" message="The rest of the queue moves to Upcoming until a due date arrives." />
            ) : (
              <ul className="space-y-2.5">
                {dueToday.map((row) => (
                  <FollowupItem
                    key={row.id}
                    row={row}
                    ownerName={nameOf.get(row.ownerId) ?? row.ownerId}
                    leadName={row.leadId ? leadNames.get(row.leadId) : undefined}
                    accountName={row.accountId ? accountNames.get(row.accountId) : undefined}
                    opportunityName={row.opportunityId ? oppNames.get(row.opportunityId) : undefined}
                    actions={actions}
                  />
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Upcoming */}
          <SectionCard
            title={`Upcoming (${upcoming.length})`}
            description="Scheduled ahead — visible early so preparation is not a surprise."
          >
            {upcoming.length === 0 ? (
              <GroupEmpty title="No upcoming follow-ups" message="New ones are scheduled from leads, contacts, accounts and opportunities." />
            ) : (
              <ul className="space-y-2.5">
                {upcoming.map((row) => (
                  <FollowupItem
                    key={row.id}
                    row={row}
                    ownerName={nameOf.get(row.ownerId) ?? row.ownerId}
                    leadName={row.leadId ? leadNames.get(row.leadId) : undefined}
                    accountName={row.accountId ? accountNames.get(row.accountId) : undefined}
                    opportunityName={row.opportunityId ? oppNames.get(row.opportunityId) : undefined}
                    actions={actions}
                  />
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Completed — collapsed by default, last 6 */}
          <SectionCard
            title={`Completed (${completed.length})`}
            description="History with recorded outcomes — kept for honesty, not for work."
            actions={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-blue-600"
                aria-expanded={completedOpen}
                onClick={() => setCompletedOpen((o) => !o)}
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", completedOpen && "rotate-180")} aria-hidden />
                {completedOpen ? "Hide" : "Show last 6"}
              </Button>
            }
          >
            {!completedOpen ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center text-xs text-muted-foreground">
                Collapsed by default — {completed.length} completed follow-up{completed.length === 1 ? "" : "s"} stay on the customer
                timeline. Expand to review the last 6 with their outcomes.
              </p>
            ) : completedShown.length === 0 ? (
              <GroupEmpty title="No completed follow-ups yet" message="Complete an open follow-up with its outcome and it lands here." />
            ) : (
              <>
                <ul className="space-y-2.5">
                  {completedShown.map((row) => (
                    <FollowupItem
                      key={row.id}
                      row={row}
                      ownerName={nameOf.get(row.ownerId) ?? row.ownerId}
                      leadName={row.leadId ? leadNames.get(row.leadId) : undefined}
                      accountName={row.accountId ? accountNames.get(row.accountId) : undefined}
                      opportunityName={row.opportunityId ? oppNames.get(row.opportunityId) : undefined}
                      actions={actions}
                    />
                  ))}
                </ul>
                {completed.length > completedShown.length && (
                  <p className="mt-3 text-[11px] text-slate-400">
                    Showing the latest {completedShown.length} of {completed.length} completed — older outcomes live on each customer timeline.
                  </p>
                )}
              </>
            )}
          </SectionCard>

          <p className="mt-6 text-[11px] leading-relaxed text-slate-400">
            States are computed by the sales service from due dates — the queue never guesses. Cancelled follow-ups leave the
            queue; outcomes recorded here flow into the customer timeline and the audit trail.
          </p>
        </div>
      )}

      {!combinedLoading && !data && !combinedError && (
        <EmptyState
          icon={<ListChecks />}
          title="The queue could not load"
          message="The sales service returned no data. Retry, or check the service status."
          action={
            <Button size="sm" onClick={reload}>
              Retry
            </Button>
          }
        />
      )}

      {/* Record outcome — 422 outcome_required surfaces inline, verbatim from the server */}
      <FormDialog
        open={dialog?.mode === "complete"}
        onOpenChange={(o) => {
          if (!o) setDialog(null);
        }}
        title="Record outcome"
        description={
          dialog
            ? `"${dialog.row.subject}" — the outcome is written to the customer timeline and audited.`
            : undefined
        }
        onSubmit={submitComplete}
        submitLabel="Complete follow-up"
        submitting={submitting}
      >
        <Field label="Outcome" required hint="What happened, what was agreed, what happens next — this text becomes part of the customer record.">
          <Textarea
            required
            rows={3}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="e.g. Legal confirmed the review date; revised pack to be sent Monday."
            aria-invalid={Boolean(dialogError)}
          />
        </Field>
        {dialogError && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {dialogError}
          </p>
        )}
      </FormDialog>

      {/* Reschedule — server rejects past dates; the error is shown, not hidden */}
      <FormDialog
        open={dialog?.mode === "reschedule"}
        onOpenChange={(o) => {
          if (!o) setDialog(null);
        }}
        title="Reschedule follow-up"
        description={
          dialog
            ? `"${dialog.row.subject}" — currently due ${fmtDateTime(dialog.row.dueAt)}. Rescheduling is honest scheduling: pick a time you will actually work it.`
            : undefined
        }
        onSubmit={submitReschedule}
        submitLabel="Reschedule"
        submitting={submitting}
      >
        <Field label="New date & time" required>
          <Input
            type="datetime-local"
            required
            value={dueInput}
            onChange={(e) => setDueInput(e.target.value)}
            aria-invalid={Boolean(dialogError)}
          />
        </Field>
        {dialogError && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {dialogError}
          </p>
        )}
      </FormDialog>
    </div>
  );
}
