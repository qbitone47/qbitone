"use client";

import * as React from "react";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Info,
  Loader2,
  MessageCircle,
  RotateCcw,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import { PageHeader } from "../page-header";
import { Avatar, EmptyState, SectionCard, StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  EntityLink,
  SalesApiError,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  fmtTime,
  relTime,
  salesPost,
  useSalesSection,
} from "../sales/parts";
import { ConfirmDialog, Field } from "../dialogs";

// ============================================================
// Screen 94 · WhatsApp Lead Conversion — turn a WhatsApp enquiry
// into a lead with a clear review step. Duplicate detection runs
// on the SERVER before anything is created; 409 matches are
// rendered as reviewable choices, never bypassed.
// ============================================================

interface ConversationDetail {
  id: string;
  waNumber: string;
  contactName: string;
  accountId?: string;
  leadId?: string;
  opportunityId?: string;
  ownerId: string;
  status: "Open" | "Pending" | "Resolved";
  unread: number;
  lastMessageAt: number;
  messages: { id: string; at: number; direction: "in" | "out"; body: string; template?: string; state?: string }[];
  ownerName: string;
  account: { id: string; name: string; industry: string; location: string; status: string } | null;
  lead: { id: string; name: string; company: string; status: string; priority: string; score: number } | null;
  opportunity: { id: string; name: string; stage: string; valueCr: number } | null;
}

interface ConversationPayload {
  conversation: ConversationDetail;
}

interface FormRefsPayload {
  owners: { id: string; name: string; title: string }[];
}

interface DuplicateMatch {
  kind: string;
  id: string;
  label: string;
  reason: string;
}

const PRIORITIES = ["Hot", "Warm", "Cold"] as const;

const NOTE_PREFILL = "Created from WhatsApp conversation — consent verified at receipt.";

/** Contact name "Deepak Shah (Sunrise Packaging)" → name/company parts. */
const parseName = (contactName: string) => contactName.split(" (")[0] ?? contactName;
const parseCompany = (contactName: string) => contactName.match(/\(([^)]+)\)/)?.[1] ?? "";

/** epoch → "2026-11-14T10:30" for datetime-local inputs (local time). */
const toLocalInput = (ts: number): string => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function Stepper({ phase }: { phase: 1 | 2 }) {
  const steps = ["Review enquiry", "Create lead"];
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Conversion steps">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2;
        const state = phase === n ? "current" : phase > n ? "done" : "todo";
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="h-px w-6 bg-slate-200" />}
            <span
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                state === "current" && "border-blue-200 bg-blue-50 text-blue-700",
                state === "done" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                state === "todo" && "border-slate-200 bg-white text-slate-400",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold",
                  state === "current" && "bg-blue-600 text-white",
                  state === "done" && "bg-emerald-600 text-white",
                  state === "todo" && "bg-slate-200 text-slate-500",
                )}
                aria-hidden
              >
                {state === "done" ? <Check className="h-2.5 w-2.5" /> : n}
              </span>
              {label}
              <span className="sr-only">{state === "current" ? " (current step)" : state === "done" ? " (completed)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function WhatsappConvertScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { params } = useQubitNav();
  const waId = params.waId;

  const { data, loading, error, forbidden, reload } = useSalesSection<ConversationPayload>(
    "whatsapp-conversation",
    { id: waId ?? "" },
  );
  const refs = useSalesSection<FormRefsPayload>("form-refs");

  const conv = data?.conversation ?? null;

  const [phase, setPhase] = React.useState<1 | 2>(1);
  const [name, setName] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [ownerId, setOwnerId] = React.useState("");
  const [priority, setPriority] = React.useState<string>("Warm");
  const [followUp, setFollowUp] = React.useState("");
  const [notes, setNotes] = React.useState(NOTE_PREFILL);

  const [matches, setMatches] = React.useState<DuplicateMatch[] | null>(null);
  const [dupeMessage, setDupeMessage] = React.useState<string | null>(null);
  const [forceOpen, setForceOpen] = React.useState(false);
  const [linkingMatch, setLinkingMatch] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  if (!waId) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Sales" }, { label: "Lead Conversion" }]}
          title="WhatsApp Lead Conversion"
          description="Turn a WhatsApp enquiry into a lead with a clear review step. Duplicate detection runs on the server before anything is created."
        />
        <div className="qubit-card">
          <EmptyState
            icon={<MessageCircle />}
            title="Open a conversation from the WhatsApp Lead Inbox"
            message="Conversion starts from a specific conversation so the new lead links back to the exact enquiry — open one from the inbox or the conversation workspace."
            action={
              <Button size="sm" className="h-9 gap-1.5" onClick={() => nav.navigate("whatsapp-inbox")}>
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Open WhatsApp Lead Inbox
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <SalesGate screenName="WhatsApp Lead Conversion">
        <></>
      </SalesGate>
    );
  }

  const startCreate = () => {
    if (!conv) return;
    setName(parseName(conv.contactName));
    setCompany(parseCompany(conv.contactName));
    setOwnerId(conv.ownerId);
    setPriority("Warm");
    setFollowUp(toLocalInput(Date.now() + 86_400_000));
    setNotes(NOTE_PREFILL);
    setMatches(null);
    setDupeMessage(null);
    setSubmitError(null);
    setPhase(2);
  };

  const submit = async (force: boolean) => {
    if (!conv) return;
    setSubmitting(true);
    setSubmitError(null);
    if (force) {
      setMatches(null);
      setDupeMessage(null);
    }
    try {
      const followUpAt = followUp ? new Date(followUp).getTime() : undefined;
      const res = await salesPost<{ ok: boolean; message: string; leadId: string }>(
        "whatsapp.lead",
        {
          id: conv.id,
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(company.trim() ? { company: company.trim() } : {}),
          ...(ownerId ? { ownerId } : {}),
          ...(priority ? { priority } : {}),
          ...(Number.isFinite(followUpAt as number) ? { nextFollowUpAt: followUpAt } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(force ? { force: true } : {}),
        },
        role,
      );
      toast({ title: "Lead created", description: res.message });
      nav.navigate("lead-detail", { leadId: res.leadId });
    } catch (err) {
      if (err instanceof SalesApiError && err.status === 409 && err.code === "possible_duplicates" && err.matches?.length) {
        setMatches(err.matches as DuplicateMatch[]);
        setDupeMessage(err.message);
        toast({ variant: "destructive", title: "Review possible duplicates", description: err.message });
      } else {
        const message = err instanceof SalesApiError ? err.message : "The lead could not be created.";
        setSubmitError(message);
        toast({ variant: "destructive", title: "Lead not created", description: message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const linkExisting = async () => {
    if (!conv || !matches?.length) return;
    const leadMatch = matches.find((m) => m.kind === "lead");
    if (!leadMatch) return;
    setLinkingMatch(true);
    setSubmitError(null);
    try {
      const res = await salesPost<{ ok: boolean; message: string }>(
        "whatsapp.link",
        { id: conv.id, leadId: leadMatch.id },
        role,
      );
      toast({ title: "Linked to the existing lead", description: res.message });
      nav.navigate("whatsapp-conversation", { waId: conv.id });
    } catch (err) {
      setSubmitError(err instanceof SalesApiError ? err.message : "The conversation could not be linked.");
    } finally {
      setLinkingMatch(false);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Sales" }, { label: "Lead Conversion" }]}
          title="WhatsApp Lead Conversion"
          description="Turn a WhatsApp enquiry into a lead with a clear review step. Duplicate detection runs on the server before anything is created."
        />
        <SalesErrorBanner message={error} onRetry={reload} />
        <div className="mt-3">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => nav.navigate("whatsapp-inbox")}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to the WhatsApp Lead Inbox
          </Button>
        </div>
      </div>
    );
  }

  if (loading || !conv) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Sales" }, { label: "Lead Conversion" }]}
          title="WhatsApp Lead Conversion"
          description="Turn a WhatsApp enquiry into a lead with a clear review step. Duplicate detection runs on the server before anything is created."
        />
        <SalesSkeleton rows={3} />
      </div>
    );
  }

  const lastMessage = conv.messages[conv.messages.length - 1] ?? null;
  const alreadyLinked = Boolean(conv.leadId);
  const leadMatch = matches?.find((m) => m.kind === "lead") ?? null;

  return (
    <div>
      <PageHeader
        // PageHeader only makes crumbs[0] clickable and drops the last crumb — the
        // clickable "WhatsApp Inbox" therefore rides as the chip crumb (same decision
        // as Lead Detail 75 / Quotation Detail 88); the h1 is the current step's page.
        crumbs={[{ label: "WhatsApp Inbox", onClick: () => nav.navigate("whatsapp-inbox") }, { label: "Lead Conversion" }]}
        title="WhatsApp Lead Conversion"
        description="Turn a WhatsApp enquiry into a lead with a clear review step. Duplicate detection runs on the server before anything is created."
        meta={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-blue-600"
            onClick={() => nav.navigate("whatsapp-conversation", { waId: conv.id })}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to conversation
          </Button>
        }
      />

      {!alreadyLinked && (
        <div className="mb-4">
          <Stepper phase={phase} />
        </div>
      )}

      {/* Duplicate review — the server blocked the create; nothing has been saved */}
      {matches && matches.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4" role="alert">
          <div className="flex items-start gap-2.5">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-amber-900">Possible duplicates — review before creating</p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800">{dupeMessage} Nothing has been created yet.</p>
              <ul className="mt-3 space-y-2">
                {matches.map((m, i) => (
                  <li
                    key={`${m.kind}-${m.id}-${i}`}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-200/70 bg-white/80 px-3 py-2"
                  >
                    <span
                      className={cn(
                        "rounded border px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide",
                        m.kind === "lead"
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : m.kind === "contact"
                            ? "border-violet-200 bg-violet-50 text-violet-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {m.kind.charAt(0).toUpperCase() + m.kind.slice(1)}
                    </span>
                    <span className="text-[13px] font-medium text-slate-800">{m.label}</span>
                    <span className="text-xs text-slate-500">{m.reason}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                {leadMatch && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 bg-white"
                    disabled={linkingMatch || submitting}
                    onClick={() => void linkExisting()}
                  >
                    {linkingMatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <LinkIcon />}
                    Link existing instead
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                  disabled={linkingMatch || submitting}
                  onClick={() => setForceOpen(true)}
                >
                  Create anyway
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {submitError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3" role="alert">
          <p className="text-sm font-medium text-red-700">{submitError}</p>
        </div>
      )}

      <div className="mx-auto max-w-2xl space-y-4">
        {/* Phase 1 — review the enquiry */}
        <SectionCard
          title="Review the enquiry"
          description="What arrived, from whom, and where it is linked today."
        >
          <div className="flex items-start gap-3">
            <Avatar name={conv.contactName} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-slate-900">{conv.contactName}</p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">{conv.waNumber}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={conv.status} size="sm" />
                <span className="text-xs text-slate-500">
                  {conv.messages.length} message{conv.messages.length === 1 ? "" : "s"} · last {relTime(conv.lastMessageAt)}
                  {lastMessage ? ` · ${fmtTime(lastMessage.at)}` : ""}
                </span>
              </div>
            </div>
          </div>

          {lastMessage && (
            <div className="mt-4 rounded-lg border border-slate-200/80 bg-slate-50 px-3.5 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Last message</p>
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-slate-700">{lastMessage.body}</p>
            </div>
          )}

          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-slate-500">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
            Consent was verified when the message was received — replies stay server-checked before every send.
          </p>

          {alreadyLinked ? (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-3" role="status">
              <p className="flex items-start gap-2 text-[13px] font-medium text-blue-800">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                This conversation already has a lead
              </p>
              <p className="mt-1 text-xs leading-relaxed text-blue-700">
                There is nothing to convert — the enquiry is already tracked on the lead below.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {conv.lead ? (
                  <EntityLink screen="lead-detail" id={conv.lead.id} label={conv.lead.name} kind="lead" />
                ) : (
                  <span className="text-xs font-medium text-blue-700">Lead {conv.leadId}</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2.5 text-xs"
                  onClick={() => nav.navigate("whatsapp-conversation", { waId: conv.id })}
                >
                  Open conversation
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <Button size="sm" className="h-9 gap-1.5" onClick={startCreate}>
                <UserPlus className="h-3.5 w-3.5" aria-hidden /> Continue
              </Button>
              <p className="text-[11px] text-slate-400">Step 2 pre-fills the lead from this conversation — everything stays editable.</p>
            </div>
          )}
        </SectionCard>

        {/* Phase 2 — create the lead */}
        {phase === 2 && !alreadyLinked && (
          <SectionCard
            title="Create the lead"
            description="Pre-filled from the conversation. The server re-validates everything and runs duplicate detection before saving."
            actions={
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-slate-500" onClick={() => setPhase(1)}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Back to review
              </Button>
            }
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!submitting) void submit(false);
              }}
              className="space-y-4"
              noValidate
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Lead name" required hint="Defaults to the conversation contact.">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 rounded-lg"
                    aria-label="Lead name"
                    required
                  />
                </Field>
                <Field label="Company" hint="Parsed from the conversation contact's company part.">
                  <Input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="h-9 rounded-lg"
                    aria-label="Company"
                  />
                </Field>
                <Field label="Phone (WhatsApp)" hint="From the conversation — the server matches duplicates on this number.">
                  <Input value={conv.waNumber} readOnly disabled className="h-9 rounded-lg font-mono text-[12.5px] tabular-nums" aria-label="Phone from the conversation" />
                </Field>
                <Field label="Source" hint="Fixed — the enquiry arrived through the WhatsApp Business campaign.">
                  <Input value="WhatsApp Campaign" readOnly disabled className="h-9 rounded-lg" aria-label="Source, fixed to WhatsApp Campaign" />
                </Field>
                <Field label="Owner" hint="The server routes the lead to the conversation's owner.">
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger className="h-9 rounded-lg" aria-label="Owner">
                      <SelectValue placeholder="Choose an owner…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(refs.data?.owners ?? []).map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Priority" hint="Warm is the server default for WhatsApp-sourced leads.">
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-9 rounded-lg" aria-label="Priority">
                      <SelectValue placeholder="Choose a priority…" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="First follow-up" hint="+1 day is pre-filled; the server schedules the first follow-up.">
                  <div className="relative">
                    <Input
                      type="datetime-local"
                      value={followUp}
                      onChange={(e) => setFollowUp(e.target.value)}
                      className="h-9 rounded-lg pl-9"
                      aria-label="First follow-up date and time"
                    />
                    <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
                  </div>
                </Field>
                <Field label="Notes" className="sm:col-span-2">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-colors focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-100"
                    aria-label="Notes"
                  />
                </Field>
              </div>

              <p className="text-[11px] leading-relaxed text-slate-400">
                The server derives the lead from the conversation, assigns its owner and schedules the first follow-up —
                the values above are sent with the request and re-checked before anything is saved.
              </p>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <Button type="submit" size="sm" className="h-9 gap-1.5" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Creating…
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5" aria-hidden /> Create lead
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setPhase(1)}>
                  Back to review
                </Button>
              </div>
            </form>
          </SectionCard>
        )}

        <SalesAsOf asOfLabel={SALES_PERIOD.asOfLabel} note="Duplicate detection compares name and phone server-side before the lead is created." />
      </div>

      <ConfirmDialog
        open={forceOpen}
        onOpenChange={setForceOpen}
        title="Create the lead anyway?"
        description="Duplicates split the customer timeline, double-count routing and can send follow-ups to the wrong owner. Only continue if these matches are genuinely different records — the decision is recorded in the audit trail."
        confirmLabel="Create anyway"
        onConfirm={() => {
          setForceOpen(false);
          void submit(true);
        }}
      />
    </div>
  );
}

function LinkIcon() {
  return <Check className="h-3.5 w-3.5" aria-hidden />;
}
