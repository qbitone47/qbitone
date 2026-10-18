"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  CalendarClock,
  Check,
  Inbox,
  StickyNote,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog, Field } from "../dialogs";
import { PageHeader } from "../page-header";
import { ArrowLink, EmptyState, KV, SectionCard, StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  ActivityTimeline,
  EntityLink,
  PriorityBadge,
  ScoreBar,
  SalesApiError,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  fmtCr,
  fmtDate,
  fmtDateTime,
  relTime,
  salesPost,
  useSalesSection,
  type TimelineEntry,
} from "../sales/parts";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import { cn } from "@/lib/utils";

// ============================================================
// Screen 75 · Lead Detail — the complete lead workspace.
// Identity, lifecycle + timeline (the center of the screen),
// qualification notes, and the Lead→Contact→Account→Opportunity
// conversion flow with a review step and duplicate guard.
// All data from /api/sales?section=lead — the server enforces
// scope: records outside it return 404, surfaced verbatim.
// ============================================================

interface LeadActivityRow {
  id: string;
  at: number;
  type: string;
  actorId: string;
  summary: string;
  outcome?: string;
  source?: string;
}

interface LeadRecord {
  id: string;
  name: string;
  company: string;
  contactPerson: string;
  phone: string;
  email: string;
  source: string;
  industry: string;
  location: string;
  ownerId: string;
  ownerName: string;
  status: "New" | "Working" | "Qualified" | "Unqualified" | "Converted";
  priority: "Hot" | "Warm" | "Cold";
  score: number;
  estimatedValueCr: number;
  expectedClose?: string;
  nextFollowUpAt?: number;
  createdAt: number;
  lastActivityAt: number;
  tags: string[];
  notes?: string;
  convertedTo?: { contactId: string; accountId: string; opportunityId?: string; at: number };
  disqualifiedReason?: string;
  relatedOpportunity: { id: string; name: string; stage: string } | null;
  activity: LeadActivityRow[];
}

interface LeadPayload {
  lead: LeadRecord;
  scope: "company" | "team" | "own";
}

interface FormRefs {
  owners: { id: string; name: string; title: string }[];
  accounts: { id: string; name: string; ownerId: string }[];
  contacts: { id: string; name: string; accountId: string }[];
  opportunities: { id: string; name: string; accountId: string }[];
}

interface ConvertResult {
  message: string;
  contactId?: string;
  accountId?: string;
  opportunityId?: string;
}

interface DuplicateMatch {
  kind: string;
  id: string;
  label: string;
  reason: string;
}

const STATUS_OPTIONS = ["Working", "Qualified", "Unqualified"] as const;
const FU_TYPES = ["Call", "Email", "WhatsApp", "Meeting", "Visit", "Send Quote"] as const;
const FU_PRIORITIES = ["High", "Medium", "Low"] as const;
const LIFECYCLE = ["New", "Working", "Qualified", "Converted"] as const;

const msgOf = (err: unknown): string =>
  err instanceof SalesApiError ? err.message : "The sales service is unreachable right now.";

const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Quiet lifecycle strip — lead-shaped (New → Working → Qualified → Converted). Not the opportunity StageFlow. */
function LeadLifecycle({ status }: { status: LeadRecord["status"] }) {
  const unqualified = status === "Unqualified";
  const idx = LIFECYCLE.indexOf(status as (typeof LIFECYCLE)[number]);
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label={`Lead lifecycle: ${status}`}>
      {LIFECYCLE.map((s, i) => {
        const done = !unqualified && idx > i;
        const current = !unqualified && idx === i;
        return (
          <li key={s} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="h-px w-2.5 bg-slate-200" />}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
                current
                  ? status === "Converted"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                  : done
                    ? "border-slate-200 bg-slate-50 text-slate-500"
                    : "border-slate-100 bg-white text-slate-300",
              )}
            >
              {done && <Check className="h-2.5 w-2.5" aria-hidden />}
              {s}
            </span>
          </li>
        );
      })}
      {unqualified && (
        <li className="flex items-center gap-1">
          <span aria-hidden className="h-px w-2.5 bg-slate-200" />
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-medium text-red-700">
            Unqualified
          </span>
        </li>
      )}
    </ol>
  );
}

export function LeadDetailScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const leadId = nav.params.leadId;
  const { data, loading, error, forbidden, reload } = useSalesSection<LeadPayload>("lead", { id: leadId });
  const { data: refs, reload: reloadRefs } = useSalesSection<FormRefs>("form-refs");

  const lead = data?.lead ?? null;

  // ---------- actor resolution for the timeline (server returns actorId) ----------
  const resolveActor = React.useCallback(
    (actorId: string): string | undefined =>
      refs?.owners.find((o) => o.id === actorId)?.name ??
      refs?.contacts.find((c) => c.id === actorId)?.name ??
      (actorId.startsWith("wa-") ? "Customer (WhatsApp)" : undefined),
    [refs],
  );

  const timeline: TimelineEntry[] = React.useMemo(
    () =>
      (lead?.activity ?? []).map((a) => ({
        id: a.id,
        at: a.at,
        type: a.type,
        actorName: resolveActor(a.actorId),
        summary: a.summary,
        outcome: a.outcome,
        source: a.source,
      })),
    [lead, resolveActor],
  );

  // ---------- header actions: status / follow-up / note ----------
  const [statusBusy, setStatusBusy] = React.useState(false);
  const [reasonOpen, setReasonOpen] = React.useState(false);
  const [reasonBody, setReasonBody] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [reasonBusy, setReasonBusy] = React.useState(false);

  const [followUpOpen, setFollowUpOpen] = React.useState(false);
  const [fuType, setFuType] = React.useState<string>("Call");
  const [fuDue, setFuDue] = React.useState("");
  const [fuPriority, setFuPriority] = React.useState<string>("Medium");
  const [fuError, setFuError] = React.useState<string | null>(null);
  const [fuBusy, setFuBusy] = React.useState(false);

  const [noteOpen, setNoteOpen] = React.useState(false);
  const [noteBody, setNoteBody] = React.useState("");
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const [noteBusy, setNoteBusy] = React.useState(false);

  // ---------- conversion flow state ----------
  const [convertOpen, setConvertOpen] = React.useState(false);
  const [accountMode, setAccountMode] = React.useState<"match" | "create">("match");
  const [accountId, setAccountId] = React.useState("");
  const [newAccountName, setNewAccountName] = React.useState("");
  const [contactMode, setContactMode] = React.useState<"match" | "create">("create");
  const [contactId, setContactId] = React.useState("");
  const [createOpp, setCreateOpp] = React.useState(true);
  const [oppValue, setOppValue] = React.useState("");
  const [oppName, setOppName] = React.useState("");
  const [oppOwnerId, setOppOwnerId] = React.useState("");
  const [oppClose, setOppClose] = React.useState("");
  const [convertError, setConvertError] = React.useState<string | null>(null);
  const [convertMatches, setConvertMatches] = React.useState<DuplicateMatch[] | null>(null);
  const [convertResult, setConvertResult] = React.useState<ConvertResult | null>(null);
  const [converting, setConverting] = React.useState(false);

  if (forbidden) {
    return (
      <SalesGate screenName="Lead Detail">
        <></>
      </SalesGate>
    );
  }

  if (!leadId) {
    return (
      <div>
        <PageHeader
          crumbs={[
            { label: "Lead Inbox", onClick: () => nav.navigate("lead-inbox") },
            { label: "Lead Detail" },
          ]}
          title="Lead Detail"
          description="The complete lead workspace — qualification, timeline and conversion path."
        />
        <div className="qubit-card">
          <EmptyState
            icon={<Inbox />}
            title="Open a lead from the Lead Inbox"
            message="Lead Detail is a deep-linked workspace — pick a lead in the Lead Inbox (74) and its full qualification view opens here."
            action={
              <Button size="sm" className="h-9 gap-1.5" onClick={() => nav.navigate("lead-inbox")}>
                <Inbox className="h-4 w-4" aria-hidden /> Open Lead Inbox
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const openFollowUp = () => {
    const d = new Date(Date.now() + 24 * 3_600_000);
    d.setHours(10, 0, 0, 0);
    setFuType("Call");
    setFuDue(toLocalInput(d));
    setFuPriority("Medium");
    setFuError(null);
    setFollowUpOpen(true);
  };

  const postStatus = async (status: string) => {
    if (!lead) return;
    setStatusBusy(true);
    try {
      const res = await salesPost<{ ok: boolean; message: string }>("lead.status", { id: lead.id, status }, role);
      toast({ title: `Lead marked ${status}`, description: res.message });
      reload();
    } catch (err) {
      toast({ variant: "destructive", title: "Could not update status", description: msgOf(err) });
    } finally {
      setStatusBusy(false);
    }
  };

  const onStatusSelect = (value: string) => {
    if (value === "Unqualified") {
      setReasonBody("");
      setReasonError(null);
      setReasonOpen(true);
      return;
    }
    void postStatus(value);
  };

  const submitReason = async () => {
    if (!lead) return;
    if (reasonBody.trim().length < 3) {
      setReasonError("A disqualification reason is required — the server rejects the change without one.");
      return;
    }
    setReasonBusy(true);
    setReasonError(null);
    try {
      const res = await salesPost<{ ok: boolean; message: string }>(
        "lead.status",
        { id: lead.id, status: "Unqualified", reason: reasonBody.trim() },
        role,
      );
      toast({ title: "Lead marked Unqualified", description: res.message });
      setReasonOpen(false);
      reload();
    } catch (err) {
      setReasonError(msgOf(err));
    } finally {
      setReasonBusy(false);
    }
  };

  const submitFollowUp = async () => {
    if (!lead) return;
    const dueAt = fuDue ? new Date(fuDue).getTime() : 0;
    if (!dueAt || dueAt < Date.now() - 60_000) {
      setFuError("Schedule the follow-up for a future date and time — the server rejects past dates.");
      return;
    }
    setFuBusy(true);
    setFuError(null);
    try {
      const res = await salesPost<{ ok: boolean; message: string }>(
        "lead.followup",
        { id: lead.id, type: fuType, dueAt, priority: fuPriority },
        role,
      );
      toast({ title: "Follow-up scheduled", description: res.message });
      setFollowUpOpen(false);
      reload();
    } catch (err) {
      setFuError(msgOf(err));
    } finally {
      setFuBusy(false);
    }
  };

  const submitNote = async () => {
    if (!lead) return;
    if (noteBody.trim().length < 3) {
      setNoteError("Write the note before saving — the server rejects empty notes.");
      return;
    }
    setNoteBusy(true);
    setNoteError(null);
    try {
      const res = await salesPost<{ ok: boolean; message: string }>("lead.note", { id: lead.id, body: noteBody.trim() }, role);
      toast({ title: "Note saved", description: res.message });
      setNoteOpen(false);
      setNoteBody("");
      reload();
    } catch (err) {
      setNoteError(msgOf(err));
    } finally {
      setNoteBusy(false);
    }
  };

  // ---------- convert dialog helpers ----------
  const contactOptions = (accountMode === "match" && accountId ? refs?.contacts.filter((c) => c.accountId === accountId) : []) ?? [];
  const canMatchContact = accountMode === "match" && accountId !== "" && contactOptions.length > 0;
  const effectiveContactMode: "match" | "create" = canMatchContact ? contactMode : "create";

  const accountLabel =
    accountMode === "match"
      ? refs?.accounts.find((a) => a.id === accountId)?.name ?? "—"
      : newAccountName.trim() || "New account";
  const contactLabel =
    effectiveContactMode === "match"
      ? refs?.contacts.find((c) => c.id === contactId)?.name ?? "—"
      : `New contact from lead (${lead?.contactPerson ?? "—"})`;
  const oppLabel = !createOpp
    ? "no opportunity"
    : oppName.trim() || `${accountLabel === "—" ? lead?.company ?? "the account" : accountLabel} — new business`;

  const openConvert = () => {
    if (!lead) return;
    setAccountMode((refs?.accounts.length ?? 0) > 0 ? "match" : "create");
    setAccountId("");
    setNewAccountName("");
    setContactMode("create");
    setContactId("");
    setCreateOpp(true);
    setOppValue(lead.estimatedValueCr > 0 ? String(lead.estimatedValueCr) : "");
    setOppName("");
    setOppOwnerId(lead.ownerId);
    setOppClose(lead.expectedClose ?? "");
    setConvertError(null);
    setConvertMatches(null);
    setConvertResult(null);
    setConvertOpen(true);
  };

  const submitConvert = async () => {
    if (!lead) return;
    if (accountMode === "match" && !accountId) {
      setConvertError("Choose the account this lead belongs to, or switch to creating a new account.");
      return;
    }
    if (accountMode === "create" && !newAccountName.trim()) {
      setConvertError("Enter a name for the new account.");
      return;
    }
    if (effectiveContactMode === "match" && !contactId) {
      setConvertError("Choose the matching contact, or create a new contact from the lead.");
      return;
    }
    if (createOpp && !(Number(oppValue) > 0)) {
      setConvertError("Set an opportunity value greater than zero — or uncheck “Create opportunity”.");
      return;
    }
    setConverting(true);
    setConvertError(null);
    setConvertMatches(null);
    try {
      const input: Record<string, unknown> = { id: lead.id, createOpportunity: createOpp };
      if (accountMode === "match") input.accountId = accountId;
      else input.newAccountName = newAccountName.trim();
      if (effectiveContactMode === "match") input.contactId = contactId;
      if (createOpp) {
        input.valueCr = Number(oppValue);
        if (oppName.trim()) input.opportunityName = oppName.trim();
        input.opportunityOwnerId = oppOwnerId || lead.ownerId;
        if (oppClose.trim()) input.expectedClose = oppClose.trim();
      }
      const res = await salesPost<ConvertResult>("lead.convert", input, role);
      toast({ title: "Lead converted", description: res.message });
      setConvertResult(res);
      reload();
      reloadRefs();
    } catch (err) {
      setConvertError(msgOf(err));
      if (err instanceof SalesApiError && err.status === 409 && err.matches?.length) {
        setConvertMatches(err.matches);
      }
    } finally {
      setConverting(false);
    }
  };

  const convertHint =
    lead?.status === "Converted"
      ? "This lead is already converted — the records it created are linked in the conversion panel."
      : lead?.status === "Unqualified"
        ? "Unqualified leads cannot be converted — re-qualify the lead first via Set status."
        : undefined;

  const statusHint =
    lead?.status === "Converted" ? "Converted leads are final — the lifecycle is closed." : undefined;

  const nameFor = (kind: "contact" | "account" | "opportunity", id?: string) => {
    if (!id || !refs) return undefined;
    if (kind === "contact") return refs.contacts.find((c) => c.id === id)?.name;
    if (kind === "account") return refs.accounts.find((a) => a.id === id)?.name;
    return refs.opportunities.find((o) => o.id === id)?.name;
  };

  // ============================================================
  // Render
  // ============================================================

  const header = lead ? (
    <PageHeader
      crumbs={[
        { label: "Lead Inbox", onClick: () => nav.navigate("lead-inbox") },
        { label: lead.name },
      ]}
      title={lead.name}
      description={`${lead.company} · source: ${lead.source} · owned by ${lead.ownerName}`}
      actions={
        <>
          <span title={convertHint} className="inline-flex">
            <Button size="sm" className="h-9 gap-1.5" onClick={openConvert} disabled={Boolean(convertHint)}>
              <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden /> Convert
            </Button>
          </span>
          <span title={statusHint} className="inline-flex">
            <Select value="" onValueChange={onStatusSelect} disabled={Boolean(statusHint) || statusBusy}>
              <SelectTrigger className="h-9 w-[140px]" aria-label="Set lead status">
                <SelectValue placeholder="Set status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} disabled={lead.status === s}>
                    {s}
                    {lead.status === s ? " (current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={openFollowUp}>
            <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Follow-up
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => {
              setNoteBody("");
              setNoteError(null);
              setNoteOpen(true);
            }}
          >
            <StickyNote className="h-3.5 w-3.5" aria-hidden /> Note
          </Button>
        </>
      }
    />
  ) : (
    <PageHeader
      crumbs={[
        { label: "Lead Inbox", onClick: () => nav.navigate("lead-inbox") },
        { label: "Lead Detail" },
      ]}
      title="Lead Detail"
      description="The complete lead workspace — qualification, timeline and conversion path."
    />
  );

  return (
    <div>
      {header}

      {error && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={4} />}

      {!loading && !data && !error && (
        <div className="qubit-card">
          <EmptyState
            icon={<Users />}
            title="Lead unavailable"
            message="The server did not return this lead. Retry, or return to the Lead Inbox."
            action={
              <Button variant="outline" size="sm" onClick={() => nav.navigate("lead-inbox")}>
                Back to Lead Inbox
              </Button>
            }
          />
        </div>
      )}

      {lead && !loading && (
        <div className="space-y-4">
          {/* Conversion panel — what this lead became */}
          {lead.status === "Converted" && lead.convertedTo && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3.5" role="status">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden />
                Converted {fmtDate(lead.convertedTo.at)} — this lead closed into:
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1.5">
                <span className="flex items-center gap-1.5 text-[13px] text-emerald-900">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/70">Contact</span>
                  <EntityLink screen="contact-detail" id={lead.convertedTo.contactId} label={nameFor("contact", lead.convertedTo.contactId) ?? "View contact"} kind="contact" />
                </span>
                <span className="flex items-center gap-1.5 text-[13px] text-emerald-900">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/70">Account</span>
                  <EntityLink screen="account-detail" id={lead.convertedTo.accountId} label={nameFor("account", lead.convertedTo.accountId) ?? "View account"} kind="account" />
                </span>
                {lead.convertedTo.opportunityId && (
                  <span className="flex items-center gap-1.5 text-[13px] text-emerald-900">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/70">Opportunity</span>
                    <EntityLink screen="opportunity-detail" id={lead.convertedTo.opportunityId} label={nameFor("opportunity", lead.convertedTo.opportunityId) ?? lead.relatedOpportunity?.name ?? "View opportunity"} kind="opportunity" />
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Lead identity */}
          <SectionCard
            title="Lead identity"
            description="One record, shared with the account and contact registers after conversion."
          >
            <dl className="grid gap-x-10 sm:grid-cols-2">
              <KV label="Company">{lead.company}</KV>
              <KV label="Contact person">{lead.contactPerson}</KV>
              <KV label="Phone"><span className="tabular-nums">{lead.phone}</span></KV>
              <KV label="Email">{lead.email}</KV>
              <KV label="Industry">{lead.industry}</KV>
              <KV label="Location">{lead.location}</KV>
              <KV label="Source">{lead.source}</KV>
              <KV label="Owner">{lead.ownerName}</KV>
              <KV label="Status"><StatusBadge status={lead.status} size="sm" /></KV>
              <KV label="Priority"><PriorityBadge priority={lead.priority} /></KV>
              <KV label="Score"><ScoreBar score={lead.score} /></KV>
              <KV label="Estimated value"><span className="font-medium tabular-nums">{fmtCr(lead.estimatedValueCr)}</span></KV>
              <KV label="Expected close">{lead.expectedClose ?? "—"}</KV>
              <KV label="Created">{fmtDate(lead.createdAt)}</KV>
              <KV label="Last activity">{relTime(lead.lastActivityAt)}</KV>
            </dl>
          </SectionCard>

          {/* Timeline & lifecycle — the center of the screen */}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <SectionCard
              title="Timeline & lifecycle"
              description="Every call, note, WhatsApp message and status change — one audited trail."
            >
              <LeadLifecycle status={lead.status} />
              <div className="mt-5">
                <ActivityTimeline entries={timeline} />
              </div>
            </SectionCard>

            {/* Qualification & follow-up */}
            <SectionCard title="Qualification & follow-up" description="Why this lead matters, and what happens next.">
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notes</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-slate-700">
                    {lead.notes ?? <span className="text-slate-400">No qualification notes yet — use Note in the header to record what you learn.</span>}
                  </p>
                </div>

                {lead.disqualifiedReason && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5" role="note">
                    <p className="flex items-start gap-2 text-[13px] leading-relaxed text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span><span className="font-medium">Disqualified:</span> {lead.disqualifiedReason}</span>
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tags</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {lead.tags.length > 0 ? (
                      lead.tags.map((t) => (
                        <span key={t} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <CalendarClock className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
                    <div>
                      <p className="text-[13px] font-medium text-slate-800">
                        {lead.nextFollowUpAt ? `Next follow-up ${relTime(lead.nextFollowUpAt)}` : "No follow-up scheduled"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {lead.nextFollowUpAt ? fmtDateTime(lead.nextFollowUpAt) : "Schedule one from the header actions."}
                      </p>
                    </div>
                  </div>
                  <ArrowLink onClick={() => nav.navigate("followup-queue")}>Open Follow-up Queue</ArrowLink>
                </div>

                {lead.status === "Working" && (
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Working leads need a scheduled follow-up — the Follow-up Queue (84) chases anything overdue.
                  </p>
                )}
              </div>
            </SectionCard>
          </div>

          <SalesAsOf asOfLabel={SALES_PERIOD.asOfLabel} note="The lead record is scoped server-side — records outside your role return 404, never partial data." />
        </div>
      )}

      {/* ---------- Set status → Unqualified (reason required by server) ---------- */}
      <FormDialog
        open={reasonOpen}
        onOpenChange={setReasonOpen}
        title="Mark lead Unqualified"
        description="A disqualification reason is required — it is kept on the lead, its timeline and the audit trail."
        submitLabel="Mark Unqualified"
        submitting={reasonBusy}
        onSubmit={submitReason}
      >
        <Field label="Reason" required>
          <Textarea
            value={reasonBody}
            onChange={(e) => setReasonBody(e.target.value)}
            rows={3}
            placeholder="e.g. No budget cycle until FY28 — revisit next year."
            aria-label="Disqualification reason"
          />
        </Field>
        {reasonError && <p role="alert" className="text-xs font-medium text-red-600">{reasonError}</p>}
      </FormDialog>

      {/* ---------- Schedule follow-up ---------- */}
      <FormDialog
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        title="Schedule follow-up"
        description={`The follow-up is owned by ${lead?.ownerName ?? "the lead owner"} and appears in the Follow-up Queue (84).`}
        submitLabel="Schedule"
        submitting={fuBusy}
        onSubmit={submitFollowUp}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" required>
            <Select value={fuType} onValueChange={setFuType}>
              <SelectTrigger aria-label="Follow-up type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FU_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={fuPriority} onValueChange={setFuPriority}>
              <SelectTrigger aria-label="Follow-up priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FU_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Due date & time" required hint="Server rejects past dates." className="sm:col-span-2">
            <Input
              type="datetime-local"
              value={fuDue}
              onChange={(e) => setFuDue(e.target.value)}
              aria-label="Follow-up due date and time"
              className="h-9 rounded-lg"
            />
          </Field>
        </div>
        {fuError && <p role="alert" className="text-xs font-medium text-red-600">{fuError}</p>}
      </FormDialog>

      {/* ---------- Add note ---------- */}
      <FormDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        title="Add note"
        description={`Recorded on ${lead?.name ?? "the lead"}'s timeline and in the audit trail.`}
        submitLabel="Save note"
        submitting={noteBusy}
        onSubmit={submitNote}
      >
        <Field label="Note" required hint="Minimum 3 characters — visible to everyone with access to this lead.">
          <Textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            rows={4}
            placeholder="What was discussed? Decisions, objections, next steps…"
            aria-label="Note text"
          />
        </Field>
        {noteError && <p role="alert" className="text-xs font-medium text-red-600">{noteError}</p>}
      </FormDialog>

      {/* ---------- Convert lead: Lead → Contact → Account → Opportunity ---------- */}
      <Dialog open={convertOpen} onOpenChange={(o) => !converting && setConvertOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Convert lead</DialogTitle>
            <DialogDescription>
              {lead?.name} → Contact → Account{createOpp ? " → Opportunity" : ""}. Existing records are matched before anything new is created — duplicates are caught by the server.
            </DialogDescription>
          </DialogHeader>

          {convertResult ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4" role="status">
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                  <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden />
                  Conversion complete
                </p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-700">{convertResult.message}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                  {convertResult.contactId && (
                    <EntityLink screen="contact-detail" id={convertResult.contactId} label={nameFor("contact", convertResult.contactId) ?? "Open contact"} kind="contact" />
                  )}
                  {convertResult.accountId && (
                    <EntityLink screen="account-detail" id={convertResult.accountId} label={nameFor("account", convertResult.accountId) ?? "Open account"} kind="account" />
                  )}
                  {convertResult.opportunityId && (
                    <EntityLink screen="opportunity-detail" id={convertResult.opportunityId} label={nameFor("opportunity", convertResult.opportunityId) ?? "Open opportunity"} kind="opportunity" />
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button size="sm" onClick={() => setConvertOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitConvert();
              }}
              className="space-y-4"
            >
              {/* Account */}
              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1.5 text-xs font-semibold text-slate-700">1 · Account</legend>
                <RadioGroup
                  value={accountMode}
                  onValueChange={(v) => {
                    setAccountMode(v as "match" | "create");
                    setContactId("");
                  }}
                  className="gap-2.5"
                >
                  <label htmlFor="conv-acc-match" className="flex cursor-pointer items-start gap-2.5">
                    <RadioGroupItem value="match" id="conv-acc-match" className="mt-0.5" />
                    <span>
                      <span className="block text-[13px] font-medium text-slate-800">Match existing account</span>
                      <span className="block text-[11px] text-slate-400">Pick from the account register — prevents duplicates.</span>
                    </span>
                  </label>
                  {accountMode === "match" && (
                    <Select
                      value={accountId}
                      onValueChange={(v) => {
                        setAccountId(v);
                        setContactId("");
                        if (!refs?.contacts.some((c) => c.accountId === v)) setContactMode("create");
                      }}
                    >
                      <SelectTrigger className="h-9" aria-label="Choose existing account">
                        <SelectValue placeholder="Choose an account…" />
                      </SelectTrigger>
                      <SelectContent>
                        {refs?.accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <label htmlFor="conv-acc-create" className="flex cursor-pointer items-start gap-2.5">
                    <RadioGroupItem value="create" id="conv-acc-create" className="mt-0.5" />
                    <span>
                      <span className="block text-[13px] font-medium text-slate-800">Create new account</span>
                      <span className="block text-[11px] text-slate-400">Industry and location carry over from the lead.</span>
                    </span>
                  </label>
                  {accountMode === "create" && (
                    <Input
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder={`e.g. ${lead?.company ?? "the lead's company"}`}
                      aria-label="New account name"
                      className="h-9 rounded-lg"
                    />
                  )}
                </RadioGroup>
              </fieldset>

              {/* Contact */}
              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1.5 text-xs font-semibold text-slate-700">2 · Contact</legend>
                <RadioGroup
                  value={effectiveContactMode}
                  onValueChange={(v) => setContactMode(v as "match" | "create")}
                  className="gap-2.5"
                >
                  <label
                    htmlFor="conv-ct-match"
                    className={cn("flex items-start gap-2.5", canMatchContact ? "cursor-pointer" : "cursor-not-allowed opacity-50")}
                  >
                    <RadioGroupItem value="match" id="conv-ct-match" className="mt-0.5" disabled={!canMatchContact} />
                    <span>
                      <span className="block text-[13px] font-medium text-slate-800">Match existing contact</span>
                      <span className="block text-[11px] text-slate-400">
                        {canMatchContact
                          ? `${contactOptions.length} contact${contactOptions.length === 1 ? "" : "s"} at ${accountLabel}.`
                          : "Available once an existing account with contacts is selected."}
                      </span>
                    </span>
                  </label>
                  {effectiveContactMode === "match" && (
                    <Select value={contactId} onValueChange={setContactId}>
                      <SelectTrigger className="h-9" aria-label="Choose existing contact">
                        <SelectValue placeholder="Choose a contact…" />
                      </SelectTrigger>
                      <SelectContent>
                        {contactOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <label htmlFor="conv-ct-create" className="flex cursor-pointer items-start gap-2.5">
                    <RadioGroupItem value="create" id="conv-ct-create" className="mt-0.5" />
                    <span>
                      <span className="block text-[13px] font-medium text-slate-800">Create new contact from lead</span>
                      <span className="block text-[11px] text-slate-400">
                        Creates {lead?.contactPerson ?? "the contact"} with the lead&apos;s phone and email.
                      </span>
                    </span>
                  </label>
                </RadioGroup>
              </fieldset>

              {/* Opportunity */}
              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1.5 text-xs font-semibold text-slate-700">3 · Opportunity</legend>
                <div className="flex items-center gap-2">
                  <Checkbox id="conv-create-opp" checked={createOpp} onCheckedChange={(v) => setCreateOpp(v === true)} />
                  <label htmlFor="conv-create-opp" className="text-[13px] font-medium text-slate-700">
                    Create opportunity
                  </label>
                </div>
                {createOpp && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Value (₹ Cr)" required>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={oppValue}
                        onChange={(e) => setOppValue(e.target.value)}
                        aria-label="Opportunity value in crore rupees"
                        className="h-9 rounded-lg tabular-nums"
                      />
                    </Field>
                    <Field label="Owner">
                      <Select value={oppOwnerId} onValueChange={setOppOwnerId}>
                        <SelectTrigger className="h-9" aria-label="Opportunity owner"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {refs?.owners.map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Opportunity name" className="sm:col-span-2">
                      <Input
                        value={oppName}
                        onChange={(e) => setOppName(e.target.value)}
                        placeholder={`${accountLabel === "—" ? lead?.company ?? "Account" : accountLabel} — new business`}
                        aria-label="Opportunity name"
                        className="h-9 rounded-lg"
                      />
                    </Field>
                    <Field label="Expected close" className="sm:col-span-2">
                      <Input
                        value={oppClose}
                        onChange={(e) => setOppClose(e.target.value)}
                        placeholder="e.g. 20 Dec 2026"
                        aria-label="Expected close date"
                        className="h-9 rounded-lg"
                      />
                    </Field>
                  </div>
                )}
              </fieldset>

              {/* Review line — the deliberate pause before records are created */}
              <p className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2.5 text-xs leading-relaxed text-slate-700" role="status">
                Review: <span className="font-semibold text-slate-900">{contactLabel}</span> ·{" "}
                <span className="font-semibold text-slate-900">{accountLabel}</span> ·{" "}
                <span className="font-semibold text-slate-900">{oppLabel}</span>
              </p>

              {convertMatches && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3" role="alert">
                  <p className="text-xs font-semibold text-amber-800">Possible duplicates found — review before continuing</p>
                  <ul className="mt-2 space-y-1.5">
                    {convertMatches.map((m, i) => (
                      <li key={`${m.kind}-${m.id}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-amber-200 bg-white px-2.5 py-2 text-xs">
                        <span className="rounded bg-slate-100 px-1.5 py-px text-[10.5px] font-medium capitalize text-slate-600">{m.kind}</span>
                        <span className="font-medium text-slate-800">{m.label}</span>
                        <span className="text-slate-500">{m.reason}</span>
                        {m.kind === "account" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="ml-auto h-6 px-2 text-[11px]"
                            onClick={() => {
                              setAccountMode("match");
                              setAccountId(m.id);
                              setContactId("");
                              if (!refs?.contacts.some((c) => c.accountId === m.id)) setContactMode("create");
                              setConvertMatches(null);
                              setConvertError(null);
                            }}
                          >
                            Match this account
                          </Button>
                        )}
                        {m.kind === "contact" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="ml-auto h-6 px-2 text-[11px]"
                            onClick={() => {
                              setAccountMode("match");
                              setAccountId(refs?.contacts.find((c) => c.id === m.id)?.accountId ?? accountId);
                              setContactMode("match");
                              setContactId(m.id);
                              setConvertMatches(null);
                              setConvertError(null);
                            }}
                          >
                            Match this contact
                          </Button>
                        )}
                        {m.kind === "lead" && (
                          <EntityLink screen="lead-detail" id={m.id} label="View lead" kind="lead" />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {convertError && <p role="alert" className="text-xs font-medium text-red-600">{convertError}</p>}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConvertOpen(false)} disabled={converting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={converting}>
                  {converting ? "Converting…" : "Convert lead"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
