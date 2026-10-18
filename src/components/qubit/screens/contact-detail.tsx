"use client";

import * as React from "react";
import {
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog, Field } from "../dialogs";
import { PageHeader } from "../page-header";
import { ArrowLink, Avatar, EmptyState, KV, SectionCard, StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  ActivityTimeline,
  ConsentChips,
  EntityLink,
  SalesApiError,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  fmtCr,
  fmtDateTime,
  relTime,
  salesPost,
  useSalesSection,
  type TimelineEntry,
} from "../sales/parts";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";

// ============================================================
// Screen 77 · Contact Detail — the contact-centric workspace.
// Consent-aware communication (Call / Email / WhatsApp / Meeting),
// related records across leads, opportunities, meetings, visits
// and quotations, plus one unified activity timeline.
// All data from /api/sales?section=contact — the server enforces
// scope and blocks outreach channels without consent on file.
// ============================================================

interface ContactActivityRow {
  id: string;
  at: number;
  type: string;
  actorId: string;
  summary: string;
  outcome?: string;
  source?: string;
}

interface ContactRecord {
  id: string;
  name: string;
  designation: string;
  accountId: string;
  phone: string;
  email: string;
  ownerId: string;
  ownerName: string;
  consent: { whatsapp: boolean; email: boolean; call: boolean };
  preferred: "WhatsApp" | "Email" | "Call";
  account: { id: string; name: string; industry: string; status: string } | null;
  leads: { id: string; name: string; company: string; status: string; priority: string; score: number }[];
  opportunities: { id: string; name: string; stage: string; valueCr: number; expectedClose: string }[];
  meetings: { id: string; title: string; startAt: number; durationMin: number; location: string; status: string }[];
  visits: { id: string; purpose: string; plannedAt: number; status: string; location: string }[];
  quotations: { id: string; number: string; status: string }[];
  activity: ContactActivityRow[];
}

interface FormRefs {
  owners: { id: string; name: string; title: string }[];
  contacts: { id: string; name: string; accountId: string }[];
}

const DURATIONS = [15, 30, 45, 60] as const;

const msgOf = (err: unknown): string =>
  err instanceof SalesApiError ? err.message : "The sales service is unreachable right now.";

const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ContactDetailScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const contactId = nav.params.contactId;
  const { data, loading, error, forbidden, reload } = useSalesSection<{ contact: ContactRecord }>("contact", { id: contactId });
  const { data: refs } = useSalesSection<FormRefs>("form-refs");

  const contact = data?.contact ?? null;

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
      (contact?.activity ?? []).map((a) => ({
        id: a.id,
        at: a.at,
        type: a.type,
        actorName: resolveActor(a.actorId),
        summary: a.summary,
        outcome: a.outcome,
        source: a.source,
      })),
    [contact, resolveActor],
  );

  // ---------- schedule meeting dialog ----------
  const [meetingOpen, setMeetingOpen] = React.useState(false);
  const [mTitle, setMTitle] = React.useState("");
  const [mStart, setMStart] = React.useState("");
  const [mDuration, setMDuration] = React.useState<string>("30");
  const [mLocation, setMLocation] = React.useState("");
  const [mError, setMError] = React.useState<string | null>(null);
  const [mBusy, setMBusy] = React.useState(false);

  if (forbidden) {
    return (
      <SalesGate screenName="Contact Detail">
        <></>
      </SalesGate>
    );
  }

  if (!contactId) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Sales" }, { label: "Contact Detail" }]}
          title="Contact Detail"
          description="Contact-centric workspace with consent-aware communication and history."
        />
        <div className="qubit-card">
          <EmptyState
            icon={<Users />}
            title="Open a contact from an Account or a Lead record"
            message="Contact Detail is a deep-linked workspace — open a contact from an Account (78) or from a converted Lead (75) and its consent-aware view opens here."
          />
        </div>
      </div>
    );
  }

  const openMeeting = () => {
    const d = new Date(Date.now() + 24 * 3_600_000);
    d.setHours(11, 0, 0, 0);
    setMTitle("");
    setMStart(toLocalInput(d));
    setMDuration("30");
    setMLocation("");
    setMError(null);
    setMeetingOpen(true);
  };

  const submitMeeting = async () => {
    if (!contact) return;
    if (mTitle.trim().length < 3) {
      setMError("Give the meeting a title — e.g. “Ops review — Bhiwandi hub”.");
      return;
    }
    const startAt = mStart ? new Date(mStart).getTime() : 0;
    if (!startAt || startAt < Date.now() - 60_000) {
      setMError("Pick a future date and time for the meeting.");
      return;
    }
    setMBusy(true);
    setMError(null);
    try {
      const res = await salesPost<{ ok: boolean; message: string }>(
        "meeting.create",
        {
          accountId: contact.accountId,
          contactId: contact.id,
          title: mTitle.trim(),
          startAt,
          durationMin: Number(mDuration) || 30,
          ...(mLocation.trim() ? { location: mLocation.trim() } : {}),
        },
        role,
      );
      toast({ title: "Meeting scheduled", description: res.message });
      setMeetingOpen(false);
      reload();
    } catch (err) {
      setMError(msgOf(err));
    } finally {
      setMBusy(false);
    }
  };

  // Consent-aware communication — the honest states
  const callHint = !contact?.consent.call ? "No call consent on file — use an allowed channel instead." : undefined;
  const emailHint = !contact?.consent.email ? "No email consent on file — the server treats this channel as closed." : undefined;
  const waHint = !contact?.consent.whatsapp ? "No WhatsApp consent on file — the server blocks replies without consent." : undefined;

  const meetings = contact?.meetings ?? [];
  const upcomingMeetings = meetings.filter((m) => m.status === "Scheduled").sort((a, b) => a.startAt - b.startAt);
  const pastMeetings = meetings.filter((m) => m.status !== "Scheduled").sort((a, b) => b.startAt - a.startAt);

  // ============================================================
  // Render
  // ============================================================

  const header = contact ? (
    <PageHeader
      crumbs={[{ label: "Sales" }, { label: "Contact Detail" }]}
      title={contact.name}
      description={`${contact.designation}${contact.account ? ` · ${contact.account.name}` : ""}`}
      meta={
        contact.account && (
          <EntityLink screen="account-detail" id={contact.account.id} label={`Account: ${contact.account.name}`} kind="account" />
        )
      }
      actions={
        <>
          <span title={callHint} className="inline-flex">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              disabled={!contact.consent.call}
              onClick={() =>
                toast({
                  title: "Calling from Qubit One Mobile (demo)",
                  description: "Qubit One does not place real calls — in production the dialer hands off to the mobile app, logged on the contact timeline.",
                })
              }
            >
              <Phone className="h-3.5 w-3.5" aria-hidden /> Call
            </Button>
          </span>
          <span title={emailHint} className="inline-flex">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              disabled={!contact.consent.email}
              onClick={() => nav.navigate("compose-mail", { to: contact.email })}
            >
              <Mail className="h-3.5 w-3.5" aria-hidden /> Email
            </Button>
          </span>
          <span title={waHint} className="inline-flex">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              disabled={!contact.consent.whatsapp}
              onClick={() => {
                toast({
                  title: "WhatsApp replies happen in the WhatsApp Lead Inbox (92)",
                  description: "Conversations are consent-checked and audited there — opening the inbox for you.",
                });
                nav.navigate("whatsapp-inbox");
              }}
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp
            </Button>
          </span>
          <span title={!contact.account ? "This contact has no linked account — meetings are keyed to a customer account." : undefined} className="inline-flex">
            <Button size="sm" className="h-9 gap-1.5" onClick={openMeeting} disabled={!contact.account}>
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Schedule meeting
            </Button>
          </span>
        </>
      }
    />
  ) : (
    <PageHeader
      crumbs={[{ label: "Sales" }, { label: "Contact Detail" }]}
      title="Contact Detail"
      description="Contact-centric workspace with consent-aware communication and history."
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
            title="Contact unavailable"
            message="The server did not return this contact. Retry, or return to Sales Home."
            action={
              <Button variant="outline" size="sm" onClick={() => nav.navigate("sales-home")}>
                Back to Sales Home
              </Button>
            }
          />
        </div>
      )}

      {contact && !loading && (
        <div className="space-y-4">
          {/* Identity & consent */}
          <SectionCard
            title="Identity & consent"
            description="One contact record, shared across Leads, Accounts and Opportunities."
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex items-center gap-3.5">
                <Avatar name={contact.name} size="lg" />
                <div>
                  <p className="text-[15px] font-semibold text-slate-900">{contact.name}</p>
                  <p className="text-xs text-slate-500">
                    {contact.designation}
                    {contact.account ? ` · ${contact.account.name}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">Preferred channel: {contact.preferred}</p>
                </div>
              </div>
              <div className="sm:ml-auto sm:max-w-xs">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Communication consent</p>
                <ConsentChips consent={contact.consent} />
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  Outreach respects these consents — WhatsApp replies are blocked by the server without consent.
                </p>
                <ArrowLink className="mt-2" onClick={() => nav.navigate("whatsapp-inbox")}>
                  Open WhatsApp Inbox
                </ArrowLink>
              </div>
            </div>

            <dl className="mt-4 grid gap-x-10 border-t border-slate-100 pt-2 sm:grid-cols-2">
              <KV label="Phone"><span className="tabular-nums">{contact.phone}</span></KV>
              <KV label="Email">{contact.email}</KV>
              <KV label="Company">
                {contact.account ? (
                  <EntityLink screen="account-detail" id={contact.account.id} label={contact.account.name} kind="account" />
                ) : (
                  "—"
                )}
              </KV>
              <KV label="Industry">{contact.account?.industry ?? "—"}</KV>
              <KV label="Owner">{contact.ownerName}</KV>
              <KV label="Preferred channel">{contact.preferred}</KV>
            </dl>
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-2">
            {/* Related leads — company match */}
            <SectionCard
              title="Related leads"
              description="Leads whose company matches this contact's account — the pre-conversion trail."
            >
              {contact.leads.length === 0 ? (
                <EmptyState icon={<Users />} title="No related leads" message="No lead in your scope matches this company." />
              ) : (
                <ul className="space-y-2.5">
                  {contact.leads.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-slate-200/80 px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <EntityLink screen="lead-detail" id={l.id} label={l.name} kind="lead" />
                          <StatusBadge status={l.status} size="sm" />
                          <StatusBadge status={l.priority} size="sm" />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{l.company} · score {l.score}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Opportunities */}
            <SectionCard
              title="Opportunities"
              description="Deals where this contact is the buyer-side counterpart."
            >
              {contact.opportunities.length === 0 ? (
                <EmptyState icon={<TrendingUp />} title="No opportunities yet" message="Convert a qualified lead or create an opportunity from an account." />
              ) : (
                <ul className="space-y-2.5">
                  {contact.opportunities.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-lg border border-slate-200/80 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <EntityLink screen="opportunity-detail" id={o.id} label={o.name} kind="opportunity" />
                          <StatusBadge status={o.stage} size="sm" />
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">Close {o.expectedClose}</p>
                      </div>
                      <p className="text-[13px] font-semibold tabular-nums text-slate-900">{fmtCr(o.valueCr)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Meetings */}
            <SectionCard
              title="Meetings"
              description="Connected to the enterprise Meetings module — one calendar, not two."
            >
              {meetings.length === 0 ? (
                <EmptyState icon={<CalendarDays />} title="No meetings yet" message="Schedule one with Schedule meeting in the header." />
              ) : (
                <div className="space-y-3">
                  {upcomingMeetings.length > 0 && (
                    <ul className="space-y-2">
                      {upcomingMeetings.map((m) => (
                        <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200/80 px-3.5 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13.5px] font-medium text-slate-800">{m.title}</p>
                            <p className="truncate text-xs text-slate-400">{fmtDateTime(m.startAt)} · {m.durationMin} min · {m.location}</p>
                          </div>
                          <StatusBadge status={m.status} size="sm" />
                        </li>
                      ))}
                    </ul>
                  )}
                  {pastMeetings.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Past & cancelled</p>
                      <ul className="space-y-1.5">
                        {pastMeetings.map((m) => (
                          <li key={m.id} className="flex items-center justify-between gap-2 text-[13px]">
                            <span className="min-w-0 truncate text-slate-600">{m.title}</span>
                            <span className="flex shrink-0 items-center gap-2 text-[11px] tabular-nums text-slate-400">
                              {relTime(m.startAt)}
                              <StatusBadge status={m.status} size="sm" />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>

            {/* Visits */}
            <SectionCard
              title="Field visits"
              description="On-site history from the Visit Planner — execution, not tracking."
            >
              {contact.visits.length === 0 ? (
                <EmptyState icon={<MapPin />} title="No visits recorded" message="Plan one from the Field Visit Planner (97)." />
              ) : (
                <ul className="space-y-2.5">
                  {contact.visits.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-slate-200/80 px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <EntityLink screen="visit-detail" id={v.id} label={v.purpose} kind="visit" />
                          <StatusBadge status={v.status} size="sm" />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{v.location} · {relTime(v.plannedAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Quotations */}
            <SectionCard
              title="Quotations"
              description="Pricing documents sent to this contact — lifecycle lives in the Quotation List (86)."
            >
              {contact.quotations.length === 0 ? (
                <EmptyState icon={<FileText />} title="No quotations yet" message="Build one from the Quotation Builder (87) — pricing rules run on the server." />
              ) : (
                <ul className="space-y-2.5">
                  {contact.quotations.map((q) => (
                    <li key={q.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                      <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[11px] font-medium text-slate-600">{q.number}</span>
                      <StatusBadge status={q.status} size="sm" />
                      <span className="ml-auto">
                        <EntityLink screen="quotation-detail" id={q.id} label="Open" kind="quotation" />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Activity timeline */}
            <SectionCard
              title="Activity timeline"
              description="Calls, emails, WhatsApp messages and stage changes involving this contact — one trail."
            >
              <ActivityTimeline entries={timeline} />
            </SectionCard>
          </div>

          <SalesAsOf asOfLabel={SALES_PERIOD.asOfLabel} note="The contact record is scoped server-side — records outside your role return 404, never partial data." />
        </div>
      )}

      {/* ---------- Schedule meeting (meeting.create — keyed to the account + contact) ---------- */}
      <FormDialog
        open={meetingOpen}
        onOpenChange={setMeetingOpen}
        title="Schedule meeting"
        description={`With ${contact?.name ?? "the contact"}${contact?.account ? ` at ${contact.account.name}` : ""} — it also appears in the enterprise Meetings module.`}
        submitLabel="Schedule"
        submitting={mBusy}
        onSubmit={submitMeeting}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2">
            <Input
              value={mTitle}
              onChange={(e) => setMTitle(e.target.value)}
              placeholder="e.g. Ops review — scope walkthrough"
              aria-label="Meeting title"
              className="h-9 rounded-lg"
            />
          </Field>
          <Field label="Date & time" required>
            <Input
              type="datetime-local"
              value={mStart}
              onChange={(e) => setMStart(e.target.value)}
              aria-label="Meeting date and time"
              className="h-9 rounded-lg"
            />
          </Field>
          <Field label="Duration">
            <Select value={mDuration} onValueChange={setMDuration}>
              <SelectTrigger className="h-9" aria-label="Meeting duration"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>{d} minutes</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Location" hint="Leave blank for a Teams meeting link." className="sm:col-span-2">
            <Input
              value={mLocation}
              onChange={(e) => setMLocation(e.target.value)}
              placeholder="Teams meeting"
              aria-label="Meeting location"
              className="h-9 rounded-lg"
            />
          </Field>
        </div>
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
          <CalendarClock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Meetings are keyed to the customer account — rescheduling and notes happen in Customer Meetings (85).
        </p>
        {mError && <p role="alert" className="text-xs font-medium text-red-600">{mError}</p>}
      </FormDialog>
    </div>
  );
}
