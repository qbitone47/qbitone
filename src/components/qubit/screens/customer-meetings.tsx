"use client";

import * as React from "react";
import {
  BellRing,
  CalendarDays,
  CalendarClock,
  Link2,
  Plus,
  StickyNote,
  Video,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard, StatusBadge } from "../primitives";
import { ConfirmDialog, Field, FormDialog } from "../dialogs";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  EntityLink,
  fmtDateTime,
  salesPost,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  ScopeNote,
  useSalesSection,
} from "../sales/parts";

// ============================================================
// Screen 85 · Customer Meetings — the sales meeting workspace.
// Connected to the enterprise Meetings & Collaboration module:
// one calendar, one link store, no second calendar. Reminders ride
// the enterprise notification rules. States (Scheduled / Completed /
// Cancelled) are owned by the server; the screen only presents them.
// ============================================================

interface MeetingRow {
  id: string;
  title: string;
  accountId: string;
  contactId?: string;
  opportunityId?: string;
  ownerId: string;
  ownerName?: string;
  startAt: number;
  durationMin: number;
  location: string;
  isLink?: boolean;
  status: "Scheduled" | "Completed" | "Cancelled";
  agenda?: string;
  notes?: string;
  account?: { id: string; name: string } | null;
  contact?: { id: string; name: string; designation?: string } | null;
  opportunity?: { id: string; name: string } | null;
}

interface MeetingsPayload {
  rows: MeetingRow[];
  scope: "company" | "team" | "own" | null;
}

interface FormRefsPayload {
  owners: readonly { id: string; name: string; title: string }[];
  accounts: { id: string; name: string; ownerId: string }[];
  contacts: { id: string; name: string; accountId: string }[];
  opportunities: { id: string; name: string; accountId: string }[];
  leads: { id: string; name: string; company: string }[];
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

const NONE = "none";
const DURATIONS = ["30", "45", "60", "90"];

// ---------- one meeting row ----------

interface MeetingActions {
  onJoin: (m: MeetingRow) => void;
  onReschedule: (m: MeetingRow) => void;
  onCancel: (m: MeetingRow) => void;
  onNotes: (m: MeetingRow) => void;
}

function MeetingItem({ m, actions }: { m: MeetingRow; actions: MeetingActions }) {
  const cancelled = m.status === "Cancelled";
  const done = m.status === "Completed";
  const scheduled = m.status === "Scheduled";
  const d = new Date(m.startAt);

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-lg border px-3.5 py-3 sm:flex-row sm:items-start",
        cancelled ? "border-slate-200/70 bg-slate-50/40" : "border-slate-200/80 bg-white",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg",
          scheduled ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500",
        )}
        aria-hidden
      >
        <span className="text-[10px] font-semibold uppercase leading-none">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
        <span className="text-[15px] font-bold leading-tight tabular-nums">{d.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("min-w-0 flex-1 basis-48 text-[13.5px] font-medium", cancelled ? "text-slate-500" : "text-slate-800")}>
            {m.title}
          </p>
          <StatusBadge status={m.status} size="sm" />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-400">
          <span>{fmtDateTime(m.startAt)}</span>
          {m.account && (
            <>
              <span aria-hidden>·</span>
              <EntityLink screen="account-detail" id={m.account.id} label={m.account.name} kind="account" />
            </>
          )}
          {m.contact && (
            <>
              <span aria-hidden>·</span>
              <span>{m.contact.name}</span>
            </>
          )}
          {m.opportunity && (
            <>
              <span aria-hidden>·</span>
              <EntityLink screen="opportunity-detail" id={m.opportunity.id} label={m.opportunity.name} kind="opportunity" />
            </>
          )}
          <span aria-hidden>·</span>
          <span>{m.ownerName ?? m.ownerId}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{m.durationMin} min</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            {m.location}
            {m.isLink && <Link2 className="h-3 w-3 shrink-0" aria-label="Meeting link" />}
          </span>
        </p>
        {scheduled && m.agenda && (
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            <span className="font-medium text-slate-600">Agenda:</span> {m.agenda}
          </p>
        )}
        {done && m.notes && (
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            <span className="font-medium text-slate-600">Notes:</span> {m.notes}
          </p>
        )}
        {cancelled && m.notes && (
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            <span className="font-medium text-slate-600">Reason note:</span> {m.notes}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
        {scheduled && m.isLink && (
          <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => actions.onJoin(m)}>
            <Video className="h-3 w-3" aria-hidden /> Join
          </Button>
        )}
        {scheduled && (
          <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => actions.onReschedule(m)}>
            <CalendarClock className="h-3 w-3" aria-hidden /> Reschedule
          </Button>
        )}
        {scheduled && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => actions.onCancel(m)}
          >
            <XCircle className="h-3 w-3" aria-hidden /> Cancel
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => actions.onNotes(m)}>
          <StickyNote className="h-3 w-3" aria-hidden /> Notes
        </Button>
      </div>
    </li>
  );
}

function GroupEmpty({ title, message }: { title: string; message: string }) {
  return <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={title} message={message} className="py-7" />;
}

// ============================================================

const EMPTY_SCHED = {
  title: "",
  accountId: "",
  contactId: NONE,
  opportunityId: NONE,
  startAt: "",
  durationMin: "30",
  location: "",
  agenda: "",
};

export function CustomerMeetingsScreen() {
  const { role } = useRole();
  const { data, loading, error, forbidden, scope, reload } = useSalesSection<MeetingsPayload>("meetings");
  const refs = useSalesSection<FormRefsPayload>("form-refs");

  const combinedLoading = loading || refs.loading;
  const combinedError = error ?? refs.error;
  const retryAll = () => {
    reload();
    refs.reload();
  };

  // Schedule meeting dialog
  const [schedOpen, setSchedOpen] = React.useState(false);
  const [sched, setSched] = React.useState(EMPTY_SCHED);
  const [schedError, setSchedError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Reschedule dialog
  const [reschedTarget, setReschedTarget] = React.useState<MeetingRow | null>(null);
  const [reschedInput, setReschedInput] = React.useState("");
  const [reschedError, setReschedError] = React.useState<string | null>(null);

  // Cancel confirm
  const [cancelTarget, setCancelTarget] = React.useState<MeetingRow | null>(null);
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  // Notes dialog — allowed on any state; outcome lands on the customer timeline
  const [notesTarget, setNotesTarget] = React.useState<MeetingRow | null>(null);
  const [notesText, setNotesText] = React.useState("");
  const [notesError, setNotesError] = React.useState<string | null>(null);

  const rows = data?.rows ?? [];

  const bounds = React.useMemo(() => {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    const e = new Date();
    e.setHours(23, 59, 59, 999);
    return { t0: s.getTime(), t1: e.getTime() };
  }, []);

  const scheduled = rows.filter((m) => m.status === "Scheduled");
  const today = scheduled.filter((m) => m.startAt >= bounds.t0 && m.startAt <= bounds.t1).sort((a, b) => a.startAt - b.startAt);
  const upcoming = scheduled.filter((m) => m.startAt > bounds.t1).sort((a, b) => a.startAt - b.startAt);
  const past = rows
    .filter((m) => m.status === "Completed" || m.status === "Cancelled")
    .sort((a, b) => b.startAt - a.startAt);

  const accountOptions = refs.data?.accounts ?? [];
  const contactOptions = sched.accountId ? (refs.data?.contacts ?? []).filter((c) => c.accountId === sched.accountId) : [];
  const oppOptions = sched.accountId ? (refs.data?.opportunities ?? []).filter((o) => o.accountId === sched.accountId) : [];

  const openSchedule = () => {
    setSched(EMPTY_SCHED);
    setSchedError(null);
    setSchedOpen(true);
  };

  const submitSchedule = async () => {
    const startAt = fromLocalInput(sched.startAt);
    if (!sched.title.trim() || !sched.accountId || !startAt) {
      setSchedError("Title, customer and date/time are required.");
      return;
    }
    setSubmitting(true);
    setSchedError(null);
    try {
      const res = await salesPost(
        "meeting.create",
        {
          title: sched.title.trim(),
          accountId: sched.accountId,
          contactId: sched.contactId === NONE ? undefined : sched.contactId,
          opportunityId: sched.opportunityId === NONE ? undefined : sched.opportunityId,
          startAt,
          durationMin: Number(sched.durationMin),
          location: sched.location.trim() || undefined,
          agenda: sched.agenda.trim() || undefined,
        },
        role,
      );
      toast({ title: res.message ?? "Meeting created — it also appears in the Meetings module." });
      setSchedOpen(false);
      setSched(EMPTY_SCHED);
      reload();
    } catch (err) {
      setSchedError(err instanceof Error ? err.message : "The meeting could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  const openReschedule = (m: MeetingRow) => {
    setReschedInput(toLocalInput(Math.max(m.startAt, Date.now() + 3_600_000)));
    setReschedError(null);
    setReschedTarget(m);
  };

  const submitReschedule = async () => {
    if (!reschedTarget) return;
    const startAt = fromLocalInput(reschedInput);
    if (!startAt) {
      setReschedError("Pick a date and time.");
      return;
    }
    setSubmitting(true);
    setReschedError(null);
    try {
      const res = await salesPost("meeting.reschedule", { id: reschedTarget.id, startAt }, role);
      toast({ title: res.message ?? "Meeting rescheduled." });
      setReschedTarget(null);
      reload();
    } catch (err) {
      setReschedError(err instanceof Error ? err.message : "The meeting could not be rescheduled.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await salesPost("meeting.cancel", { id: cancelTarget.id }, role);
      toast({ title: res.message ?? "Meeting cancelled." });
      setCancelTarget(null);
      reload();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "The meeting could not be cancelled.");
    } finally {
      setCancelling(false);
    }
  };

  const openNotes = (m: MeetingRow) => {
    setNotesText(m.notes ?? "");
    setNotesError(null);
    setNotesTarget(m);
  };

  const submitNotes = async () => {
    if (!notesTarget) return;
    if (!notesText.trim()) {
      setNotesError("Write the meeting notes first.");
      return;
    }
    setSubmitting(true);
    setNotesError(null);
    try {
      const res = await salesPost("meeting.notes", { id: notesTarget.id, notes: notesText.trim() }, role);
      toast({ title: res.message ?? "Notes saved to the meeting and the customer timeline." });
      setNotesTarget(null);
      reload();
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : "The notes could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };

  if (forbidden) {
    return (
      <SalesGate screenName="Customer Meetings">
        <></>
      </SalesGate>
    );
  }

  const actions: MeetingActions = {
    onJoin: () =>
      toast({ title: "The meeting link opens in the enterprise Meetings module (demo)" }),
    onReschedule: openReschedule,
    onCancel: (m) => {
      setCancelError(null);
      setCancelTarget(m);
    },
    onNotes: openNotes,
  };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Customer Meetings" }]}
        title="Customer Meetings"
        description="The sales meeting workspace — connected to the enterprise Meetings & Collaboration module, not a second calendar."
        actions={
          <Button size="sm" className="h-9 gap-1.5" onClick={openSchedule}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Schedule meeting
          </Button>
        }
      />

      {combinedError && <SalesErrorBanner message={combinedError} onRetry={retryAll} />}
      {combinedLoading && <SalesSkeleton rows={4} />}

      {data && !combinedLoading && (
        <div className="space-y-4">
          <div className="qubit-card space-y-1 p-4">
            <p className="text-xs tabular-nums text-muted-foreground" role="status">
              {rows.length} meeting{rows.length === 1 ? "" : "s"} in scope · {scheduled.length} scheduled
            </p>
            <ScopeNote scope={scope} what="meetings" />
          </div>

          {/* Today */}
          <SectionCard title={`Today (${today.length})`} description="Customer meetings scheduled for today, earliest first.">
            {today.length === 0 ? (
              <GroupEmpty
                title="No meetings today"
                message="The calendar is clear — schedule one from a customer, contact or opportunity."
              />
            ) : (
              <ul className="space-y-2.5">
                {today.map((m) => (
                  <MeetingItem key={m.id} m={m} actions={actions} />
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Upcoming */}
          <SectionCard title={`Upcoming (${upcoming.length})`} description="Confirmed meetings after today, soonest first.">
            {upcoming.length === 0 ? (
              <GroupEmpty title="Nothing scheduled ahead" message="New meetings start here or from any account, contact or opportunity record." />
            ) : (
              <ul className="space-y-2.5">
                {upcoming.map((m) => (
                  <MeetingItem key={m.id} m={m} actions={actions} />
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Past & cancelled — history with honesty */}
          <SectionCard
            title={`Past & cancelled (${past.length})`}
            description="Completed meetings keep their notes on the customer timeline; cancelled ones stay visible with their reason."
          >
            {past.length === 0 ? (
              <GroupEmpty title="No meeting history yet" message="Completed and cancelled meetings are kept here for the record." />
            ) : (
              <ul className="space-y-2.5">
                {past.map((m) => (
                  <MeetingItem key={m.id} m={m} actions={actions} />
                ))}
              </ul>
            )}
          </SectionCard>

          <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
            <BellRing className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>Reminders ride the enterprise notification rules (screen 10) — no separate reminder engine.</span>
          </p>
        </div>
      )}

      {!combinedLoading && !data && !combinedError && (
        <EmptyState
          icon={<CalendarDays />}
          title="Customer Meetings could not load"
          message="The sales service returned no data. Retry, or check the service status."
          action={
            <Button size="sm" onClick={reload}>
              Retry
            </Button>
          }
        />
      )}

      {/* Schedule meeting — one calendar; creation is audited server-side */}
      <FormDialog
        open={schedOpen}
        onOpenChange={(o) => {
          if (!o) setSchedOpen(false);
        }}
        title="Schedule meeting"
        description="One calendar — the meeting also appears in the enterprise Meetings & Collaboration module."
        onSubmit={submitSchedule}
        submitLabel="Schedule meeting"
        submitting={submitting}
        wide
      >
        <Field label="Title" required>
          <Input
            required
            value={sched.title}
            onChange={(e) => setSched((s) => ({ ...s, title: e.target.value }))}
            placeholder="e.g. Acme Phase 2 — kickoff planning"
            aria-invalid={Boolean(schedError)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer account" required>
            <Select
              value={sched.accountId}
              onValueChange={(v) => setSched((s) => ({ ...s, accountId: v, contactId: NONE, opportunityId: NONE }))}
            >
              <SelectTrigger className="w-full" aria-label="Customer account">
                <SelectValue placeholder="Choose account" />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.length === 0 && (
                  <SelectItem value="__empty" disabled>
                    No accounts available
                  </SelectItem>
                )}
                {accountOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Contact" hint="Contacts filter to the chosen account.">
            <Select
              value={sched.contactId}
              onValueChange={(v) => setSched((s) => ({ ...s, contactId: v }))}
              disabled={!sched.accountId}
            >
              <SelectTrigger className="w-full" aria-label="Contact">
                <SelectValue placeholder={sched.accountId ? "Optional" : "Choose an account first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No contact</SelectItem>
                {contactOptions.length === 0 && sched.accountId && (
                  <SelectItem value="__empty-ct" disabled>
                    No contacts on file for this account
                  </SelectItem>
                )}
                {contactOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Opportunity" hint="Optional — links the meeting to a deal on the chosen account.">
          <Select
            value={sched.opportunityId}
            onValueChange={(v) => setSched((s) => ({ ...s, opportunityId: v }))}
            disabled={!sched.accountId}
          >
            <SelectTrigger className="w-full" aria-label="Opportunity">
              <SelectValue placeholder={sched.accountId ? "Optional" : "Choose an account first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not linked to a deal</SelectItem>
              {oppOptions.length === 0 && sched.accountId && (
                <SelectItem value="__empty-op" disabled>
                  No opportunities on file for this account
                </SelectItem>
              )}
              {oppOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date & time" required>
            <Input
              type="datetime-local"
              required
              value={sched.startAt}
              onChange={(e) => setSched((s) => ({ ...s, startAt: e.target.value }))}
              aria-invalid={Boolean(schedError)}
            />
          </Field>
          <Field label="Duration" required>
            <Select value={sched.durationMin} onValueChange={(v) => setSched((s) => ({ ...s, durationMin: v }))}>
              <SelectTrigger className="w-full" aria-label="Duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Location" hint="Leave empty for a Teams meeting — the link lives in the enterprise Meetings module.">
          <Input
            value={sched.location}
            onChange={(e) => setSched((s) => ({ ...s, location: e.target.value }))}
            placeholder="Teams meeting"
          />
        </Field>
        <Field label="Agenda">
          <Textarea
            rows={2}
            value={sched.agenda}
            onChange={(e) => setSched((s) => ({ ...s, agenda: e.target.value }))}
            placeholder="What the meeting needs to decide or produce…"
          />
        </Field>
        {schedError && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {schedError}
          </p>
        )}
      </FormDialog>

      {/* Reschedule — only Scheduled meetings; server rejects past times */}
      <FormDialog
        open={Boolean(reschedTarget)}
        onOpenChange={(o) => {
          if (!o) setReschedTarget(null);
        }}
        title="Reschedule meeting"
        description={
          reschedTarget
            ? `"${reschedTarget.title}" — currently ${fmtDateTime(reschedTarget.startAt)}. The customer sees the new slot through the notification architecture.`
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
            value={reschedInput}
            onChange={(e) => setReschedInput(e.target.value)}
            aria-invalid={Boolean(reschedError)}
          />
        </Field>
        {reschedError && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {reschedError}
          </p>
        )}
      </FormDialog>

      {/* Cancel — destructive; confirmed; customer notified server-side */}
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(o) => {
          if (!o) setCancelTarget(null);
        }}
        title="Cancel this meeting?"
        description={
          cancelTarget
            ? `"${cancelTarget.title}" on ${fmtDateTime(cancelTarget.startAt)} will be cancelled. The customer is notified through the enterprise notification architecture — this cannot be undone.`
            : ""
        }
        confirmLabel={cancelling ? "Cancelling…" : "Cancel meeting"}
        destructive
        onConfirm={submitCancel}
      >
        {cancelError && (
          <p role="alert" className="mb-3 text-xs font-medium text-red-600">
            {cancelError}
          </p>
        )}
      </ConfirmDialog>

      {/* Notes — allowed on any state; saved to the meeting and the customer timeline */}
      <FormDialog
        open={Boolean(notesTarget)}
        onOpenChange={(o) => {
          if (!o) setNotesTarget(null);
        }}
        title="Meeting notes"
        description={
          notesTarget
            ? `"${notesTarget.title}" — notes are saved to the meeting and written to the customer timeline.`
            : undefined
        }
        onSubmit={submitNotes}
        submitLabel="Save notes"
        submitting={submitting}
      >
        <Field label="Notes" required hint="Decisions, commitments, follow-ups — what the next person touching this account needs to know.">
          <Textarea
            required
            rows={4}
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="e.g. Divya asked for a phased commercial structure; revision due this week."
            aria-invalid={Boolean(notesError)}
          />
        </Field>
        {notesError && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {notesError}
          </p>
        )}
      </FormDialog>
    </div>
  );
}
