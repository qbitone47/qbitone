"use client";

import * as React from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Check,
  ChevronRight,
  Link2,
  Loader2,
  MessageCircle,
  Send,
  StickyNote,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLink, Avatar, EmptyState, SectionCard, StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  AuditedHint,
  EntityLink,
  PriorityBadge,
  SalesApiError,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  ScoreBar,
  fmtCr,
  fmtDate,
  fmtTime,
  relTime,
  salesPost,
  useSalesSection,
} from "../sales/parts";
import { FormDialog, Field } from "../dialogs";

// ============================================================
// Screen 93 · WhatsApp Conversation — one business conversation
// workspace. Slate/blue enterprise bubbles (NOT chat-app green),
// template chips, state ticks as text, consent-checked replies.
// Every mutation rides salesPost; the server enforces consent.
// ============================================================

interface WaMessage {
  id: string;
  at: number;
  direction: "in" | "out";
  body: string;
  template?: string;
  state?: "sent" | "delivered" | "read";
}

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
  messages: WaMessage[];
  ownerName: string;
  account: { id: string; name: string; industry: string; location: string; status: string } | null;
  lead: { id: string; name: string; company: string; status: string; priority: string; score: number; estimatedValueCr?: number } | null;
  opportunity: { id: string; name: string; stage: string; valueCr: number } | null;
}

interface ConversationPayload {
  conversation: ConversationDetail;
}

interface FormRefsPayload {
  owners: { id: string; name: string; title: string }[];
  accounts: { id: string; name: string; ownerId: string }[];
  leads: { id: string; name: string; company: string }[];
  opportunities: { id: string; name: string; accountId: string }[];
}

/** The WhatsApp list section carries the follow-up ref the detail payload omits. */
interface WhatsappListPayload {
  rows: { id: string; followup: { id: string; subject: string; dueAt: number; state: string; priority: string } | null }[];
}

const TEMPLATES = [
  { value: "followup_intro", label: "Follow-up intro", hint: "Re-engage a new enquiry with next steps" },
  { value: "lead_nurture", label: "Lead nurture", hint: "Share progress and keep the lead warm" },
  { value: "visit_reminder", label: "Visit reminder", hint: "Confirm an upcoming visit or call" },
] as const;

const STATE_LABEL: Record<string, string> = { sent: "Sent", delivered: "Delivered", read: "Read" };

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(ts: number): string {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (dayKey(ts) === dayKey(today.getTime())) return "Today";
  if (dayKey(ts) === dayKey(yesterday.getTime())) return "Yesterday";
  return fmtDate(ts);
}

export function WhatsappConversationScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { params } = useQubitNav();
  const waId = params.waId;

  const { data, loading, error, forbidden, reload } = useSalesSection<ConversationPayload>(
    "whatsapp-conversation",
    { id: waId ?? "" },
  );
  const refs = useSalesSection<FormRefsPayload>("form-refs");
  // The conversation payload omits the follow-up ref — the scoped list section carries it.
  const waList = useSalesSection<WhatsappListPayload>("whatsapp");

  const conv = data?.conversation ?? null;
  const followup = React.useMemo(
    () => waList.data?.rows.find((r) => r.id === conv?.id)?.followup ?? null,
    [waList.data, conv?.id],
  );

  // Composer + action state
  const [body, setBody] = React.useState("");
  const [template, setTemplate] = React.useState<string>("");
  const [sending, setSending] = React.useState(false);
  const [consentError, setConsentError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Dialogs
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignOwnerId, setAssignOwnerId] = React.useState("");
  const [assignError, setAssignError] = React.useState<string | null>(null);
  const [assigning, setAssigning] = React.useState(false);

  const [noteOpen, setNoteOpen] = React.useState(false);
  const [noteBody, setNoteBody] = React.useState("");
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const [noting, setNoting] = React.useState(false);

  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkLead, setLinkLead] = React.useState("");
  const [linkAccount, setLinkAccount] = React.useState("");
  const [linkOpp, setLinkOpp] = React.useState("");
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const [linking, setLinking] = React.useState(false);

  const timelineRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = timelineRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conv?.id, conv?.messages.length]);

  React.useEffect(() => {
    // A different conversation resets the composer and any stale server errors.
    setBody("");
    setTemplate("");
    setConsentError(null);
    setActionError(null);
  }, [conv?.id]);

  if (!waId) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Sales" }, { label: "WhatsApp Conversation" }]}
          title="WhatsApp Conversation"
          description="The business conversation workspace — replies, templates, linking and lead creation."
        />
        <div className="qubit-card">
          <EmptyState
            icon={<MessageCircle />}
            title="Open a conversation from the WhatsApp Lead Inbox"
            message="Conversations are opened by the inbox so the trail stays canonical — pick one there and this workspace loads it."
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
      <SalesGate screenName="WhatsApp Conversation">
        <></>
      </SalesGate>
    );
  }

  const runReply = async (payload: { body?: string; template?: string }) => {
    if (!conv) return;
    setSending(true);
    setConsentError(null);
    setActionError(null);
    try {
      const res = await salesPost<{ ok: boolean; message: string }>(
        "whatsapp.reply",
        { id: conv.id, ...(payload.body ? { body: payload.body } : {}), ...(payload.template ? { template: payload.template } : {}) },
        role,
      );
      toast({ title: "Reply sent", description: res.message });
      setBody("");
      setTemplate("");
      reload();
    } catch (err) {
      if (err instanceof SalesApiError && err.code === "no_consent") {
        setConsentError(err.message);
        toast({ variant: "destructive", title: "Reply blocked — no consent", description: err.message });
      } else {
        const message = err instanceof SalesApiError ? err.message : "The message could not be sent.";
        setActionError(message);
        toast({ variant: "destructive", title: "Message not sent", description: message });
      }
    } finally {
      setSending(false);
    }
  };

  const submitReply = () => {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    void runReply({ body: trimmed });
  };

  const sendTemplate = () => {
    if (!template || sending) return;
    void runReply({ template });
  };

  const submitAssign = async () => {
    if (!conv) return;
    if (!assignOwnerId) {
      setAssignError("Choose a salesperson to assign the conversation to.");
      return;
    }
    setAssigning(true);
    setAssignError(null);
    try {
      const res = await salesPost<{ ok: boolean; message: string }>(
        "whatsapp.assign",
        { id: conv.id, ownerId: assignOwnerId },
        role,
      );
      toast({ title: "Conversation assigned", description: res.message });
      setAssignOpen(false);
      setAssignOwnerId("");
      reload();
    } catch (err) {
      setAssignError(err instanceof SalesApiError ? err.message : "The assignment could not be saved.");
    } finally {
      setAssigning(false);
    }
  };

  const submitNote = async () => {
    if (!conv) return;
    if (!noteBody.trim()) {
      setNoteError("Write the note first.");
      return;
    }
    setNoting(true);
    setNoteError(null);
    try {
      const res = await salesPost<{ ok: boolean; message: string }>(
        "whatsapp.note",
        { id: conv.id, body: noteBody.trim() },
        role,
      );
      toast({ title: "Note recorded", description: res.message });
      setNoteOpen(false);
      setNoteBody("");
      reload();
    } catch (err) {
      setNoteError(err instanceof SalesApiError ? err.message : "The note could not be saved.");
    } finally {
      setNoting(false);
    }
  };

  const submitLink = async () => {
    if (!conv) return;
    if (!linkLead && !linkAccount && !linkOpp) {
      setLinkError("Choose a lead, account or opportunity to link.");
      return;
    }
    setLinking(true);
    setLinkError(null);
    try {
      const res = await salesPost<{ ok: boolean; message: string }>(
        "whatsapp.link",
        {
          id: conv.id,
          ...(linkLead ? { leadId: linkLead } : {}),
          ...(linkAccount ? { accountId: linkAccount } : {}),
          ...(linkOpp ? { opportunityId: linkOpp } : {}),
        },
        role,
      );
      toast({ title: "Conversation linked", description: res.message });
      setLinkOpen(false);
      setLinkLead("");
      setLinkAccount("");
      setLinkOpp("");
      reload();
    } catch (err) {
      setLinkError(err instanceof SalesApiError ? err.message : "The link could not be saved.");
    } finally {
      setLinking(false);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Sales" }, { label: "WhatsApp Conversation" }]}
          title="WhatsApp Conversation"
          description="The business conversation workspace — replies, templates, linking and lead creation."
        />
        <SalesErrorBanner message={error} onRetry={reload} />
        <div className="mt-3">
          <ArrowLink onClick={() => nav.navigate("whatsapp-inbox")}>Back to the WhatsApp Lead Inbox</ArrowLink>
        </div>
      </div>
    );
  }

  if (loading || !conv) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Sales" }, { label: "WhatsApp Conversation" }]}
          title="WhatsApp Conversation"
          description="The business conversation workspace — replies, templates, linking and lead creation."
        />
        <SalesSkeleton rows={4} />
      </div>
    );
  }

  const businessLine = conv.lead
    ? `Linked lead: ${conv.lead.name} — ${conv.lead.status} · ${conv.lead.priority}${conv.lead.company ? ` · ${conv.lead.company}` : ""}`
    : conv.account
      ? `Linked account: ${conv.account.name}${conv.account.industry ? ` · ${conv.account.industry}` : ""}`
      : "No CRM record linked yet — link a lead, account or opportunity from the actions bar.";

  let lastDay = "";

  return (
    <div>
      <PageHeader
        // PageHeader only makes crumbs[0] clickable and drops the last crumb — the
        // clickable "WhatsApp Inbox" therefore rides as the chip crumb (same decision
        // recorded on Lead Detail 75 / Quotation Detail 88); the h1 is the contact.
        crumbs={[{ label: "WhatsApp Inbox", onClick: () => nav.navigate("whatsapp-inbox") }, { label: conv.contactName }]}
        title={conv.contactName}
        description={businessLine}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11.5px] font-medium tabular-nums text-slate-600">
              {conv.waNumber}
            </span>
            <StatusBadge status={conv.status} size="sm" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
              <Avatar name={conv.ownerName} size="xs" />
              {conv.ownerName}
            </span>
            {conv.unread > 0 && (
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 tabular-nums">
                {conv.unread} new
              </span>
            )}
            {conv.lead && (
              <span className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] font-medium text-slate-600">
                <span className="text-slate-400">Lead</span>
                <EntityLink screen="lead-detail" id={conv.lead.id} label={conv.lead.name} kind="lead" />
              </span>
            )}
            {conv.account && (
              <span className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] font-medium text-slate-600">
                <span className="text-slate-400">Account</span>
                <EntityLink screen="account-detail" id={conv.account.id} label={conv.account.name} kind="account" />
              </span>
            )}
            {conv.opportunity && (
              <span className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] font-medium text-slate-600">
                <span className="text-slate-400">Opp</span>
                <EntityLink screen="opportunity-detail" id={conv.opportunity.id} label={conv.opportunity.name} kind="opportunity" />
              </span>
            )}
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Timeline — mobile: first; desktop: left column */}
        <div className="order-1 min-w-0">
          <SectionCard
            title="Messages"
            description="WhatsApp Business API · consent-checked · every message audited"
            actions={
              <span className="text-xs tabular-nums text-slate-400" role="status">
                {conv.messages.length} message{conv.messages.length === 1 ? "" : "s"}
              </span>
            }
          >
            <div ref={timelineRef} className="qubit-scroll max-h-[560px] space-y-1 overflow-y-auto pr-1" aria-label="Message timeline">
              {conv.messages.length === 0 && (
                <EmptyState
                  icon={<MessageCircle />}
                  title="No messages yet"
                  message="Inbound and outbound messages will appear here as the conversation progresses."
                />
              )}
              {conv.messages.map((m) => {
                const showDay = dayKey(m.at) !== lastDay;
                if (showDay) lastDay = dayKey(m.at);
                const isIn = m.direction === "in";
                return (
                  <React.Fragment key={m.id}>
                    {showDay && (
                      <div className="flex justify-center py-2" aria-hidden={false}>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500">
                          {dayLabel(m.at)}
                        </span>
                      </div>
                    )}
                    <div className={cn("flex", isIn ? "justify-start" : "justify-end")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl border px-3.5 py-2.5 sm:max-w-[75%]",
                          isIn
                            ? "rounded-bl-md border-slate-200/80 bg-slate-50 text-slate-800"
                            : "rounded-br-md border-blue-200/70 bg-blue-50 text-slate-800",
                        )}
                      >
                        {m.template && (
                          <p className="mb-1.5">
                            <span className="inline-flex items-center gap-1 rounded border border-blue-200/80 bg-white/80 px-1.5 py-px text-[10px] font-medium text-blue-700">
                              <BadgeCheck className="h-2.5 w-2.5" aria-hidden />
                              Template · {m.template}
                            </span>
                          </p>
                        )}
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.body}</p>
                        <p className="mt-1 flex items-center gap-1 text-[10.5px] tabular-nums text-slate-500">
                          <span>{fmtTime(m.at)}</span>
                          {!isIn && m.state && (
                            <span className="inline-flex items-center gap-0.5">
                              <Check className="h-2.5 w-2.5" aria-hidden />
                              {STATE_LABEL[m.state] ?? "Sent"}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </SectionCard>
        </div>

        {/* Business context — mobile: second; desktop: right rail */}
        <aside className="order-2 min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1" aria-label="Business context">
          <SectionCard title="Business context" description="What this conversation is connected to">
            <div className="space-y-4">
              {conv.lead ? (
                <div className="rounded-lg border border-slate-200/80 bg-white px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Linked lead</p>
                  <div className="mt-1.5">
                    <EntityLink screen="lead-detail" id={conv.lead.id} label={conv.lead.name} kind="lead" />
                  </div>
                  {conv.lead.company && <p className="mt-0.5 truncate text-xs text-slate-500">{conv.lead.company}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={conv.lead.status} size="sm" />
                    <PriorityBadge priority={conv.lead.priority as "Hot" | "Warm" | "Cold"} size="sm" />
                    <ScoreBar score={conv.lead.score} />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Linked lead</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    No lead linked yet — convert this enquiry into a lead from the actions bar when it is ready.
                  </p>
                </div>
              )}

              {conv.account && (
                <div className="rounded-lg border border-slate-200/80 bg-white px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Linked account</p>
                  <div className="mt-1.5">
                    <EntityLink screen="account-detail" id={conv.account.id} label={conv.account.name} kind="account" />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {[conv.account.industry, conv.account.location].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              )}

              {conv.opportunity && (
                <div className="rounded-lg border border-slate-200/80 bg-white px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Linked opportunity</p>
                  <div className="mt-1.5">
                    <EntityLink screen="opportunity-detail" id={conv.opportunity.id} label={conv.opportunity.name} kind="opportunity" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={conv.opportunity.stage} size="sm" />
                    <span className="text-xs font-semibold tabular-nums text-slate-700">{fmtCr(conv.opportunity.valueCr)}</span>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-200/80 bg-white px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Follow-up state</p>
                {followup ? (
                  <>
                    <p className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-relaxed text-slate-700">
                      <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden />
                      <span>
                        Next WhatsApp follow-up: <span className="font-medium">{followup.subject}</span>{" "}
                        <span className="tabular-nums text-slate-500">· {relTime(followup.dueAt)}</span>
                      </span>
                    </p>
                    <ArrowLink className="mt-2" onClick={() => nav.navigate("followup-queue")}>
                      Open Follow-up Queue
                    </ArrowLink>
                  </>
                ) : (
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    No WhatsApp follow-up scheduled for this conversation.
                  </p>
                )}
              </div>

              <AuditedHint>Replies are consent-checked server-side before sending.</AuditedHint>
            </div>
          </SectionCard>
        </aside>

        {/* Actions — mobile: last; desktop: under the timeline */}
        <div className="order-3 min-w-0 xl:col-start-1 xl:row-start-2">
          <SectionCard title="Reply & actions" description="Free-text replies and approved templates — the server verifies consent on every send">
            {consentError && (
              <div
                className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50/70 px-3.5 py-2.5"
                role="alert"
              >
                <p className="text-[13px] font-medium leading-relaxed text-red-700">{consentError}</p>
                <button
                  type="button"
                  aria-label="Dismiss consent error"
                  onClick={() => setConsentError(null)}
                  className="shrink-0 rounded p-0.5 text-red-500 transition-colors hover:bg-red-100 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            )}
            {actionError && (
              <div
                className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5"
                role="alert"
              >
                <p className="text-[13px] font-medium leading-relaxed text-amber-800">{actionError}</p>
                <button
                  type="button"
                  aria-label="Dismiss error"
                  onClick={() => setActionError(null)}
                  className="shrink-0 rounded p-0.5 text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-700"
                >
                  ×
                </button>
              </div>
            )}

            <div className="space-y-3">
              <label htmlFor="wa-reply" className="sr-only">
                Reply message
              </label>
              <Textarea
                id="wa-reply"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a reply — it is sent through the WhatsApp Business API after a server-side consent check…"
                className="min-h-[84px] rounded-lg border-slate-200 text-[13px]"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submitReply();
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className="h-9 gap-1.5"
                  disabled={!body.trim() || sending}
                  onClick={submitReply}
                >
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
                  Send reply
                </Button>
                <p className="text-[11px] text-slate-400">Ctrl+Enter sends. Replies without consent are blocked and audited.</p>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Approved template</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={template} onValueChange={setTemplate}>
                    <SelectTrigger className="h-9 w-full rounded-lg sm:w-[240px]" aria-label="Choose an approved template">
                      <SelectValue placeholder="Choose a template…" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label} · {t.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1.5"
                    disabled={!template || sending}
                    onClick={sendTemplate}
                  >
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
                    Send template
                  </Button>
                </div>
                {template && (
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    {TEMPLATES.find((t) => t.value === template)?.hint} — sent as template “{template}”.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                {(role === "administrator" || role === "dept-head") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => {
                      setAssignError(null);
                      setAssignOpen(true);
                    }}
                  >
                    <UserCog className="h-3.5 w-3.5" aria-hidden /> Assign
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => {
                    setNoteError(null);
                    setNoteOpen(true);
                  }}
                >
                  <StickyNote className="h-3.5 w-3.5" aria-hidden /> Add note
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => {
                    setLinkError(null);
                    setLinkOpen(true);
                  }}
                >
                  <Link2 className="h-3.5 w-3.5" aria-hidden /> Link to record
                </Button>
                {!conv.leadId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={() => nav.navigate("whatsapp-convert", { waId: conv.id })}
                  >
                    Create lead from conversation <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Assign dialog — manager/admin control; the server re-checks scope */}
      <FormDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        title="Assign conversation"
        description="Routing follows the assignment — future replies and follow-ups belong to the new owner."
        submitLabel="Assign"
        submitting={assigning}
        onSubmit={submitAssign}
      >
        {assignError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-xs font-medium text-red-700">
            {assignError}
          </p>
        )}
        <Field label="Owner" required>
          <Select value={assignOwnerId} onValueChange={setAssignOwnerId}>
            <SelectTrigger className="h-9 rounded-lg" aria-label="New owner">
              <SelectValue placeholder="Choose a salesperson…" />
            </SelectTrigger>
            <SelectContent>
              {(refs.data?.owners ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name} — {o.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormDialog>

      {/* Note dialog */}
      <FormDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        title="Add note"
        description="Notes land on the linked lead's timeline when the conversation is linked to one."
        submitLabel="Save note"
        submitting={noting}
        onSubmit={submitNote}
      >
        {noteError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-xs font-medium text-red-700">
            {noteError}
          </p>
        )}
        <Field label="Note" required>
          <Textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="What did you learn from this exchange?"
            className="min-h-[80px] rounded-lg text-[13px]"
            aria-label="Note text"
          />
        </Field>
      </FormDialog>

      {/* Link dialog — options come from the server's form-refs, scoped */}
      <FormDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title="Link to record"
        description="Link the conversation to a lead, account or opportunity — future messages land on the linked records."
        submitLabel="Link"
        submitting={linking}
        onSubmit={submitLink}
        wide
      >
        {linkError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-xs font-medium text-red-700">
            {linkError}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lead">
            <Select value={linkLead} onValueChange={setLinkLead}>
              <SelectTrigger className="h-9 rounded-lg" aria-label="Link a lead">
                <SelectValue placeholder="No lead" />
              </SelectTrigger>
              <SelectContent>
                {(refs.data?.leads ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name} — {l.company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Account">
            <Select value={linkAccount} onValueChange={setLinkAccount}>
              <SelectTrigger className="h-9 rounded-lg" aria-label="Link an account">
                <SelectValue placeholder="No account" />
              </SelectTrigger>
              <SelectContent>
                {(refs.data?.accounts ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Opportunity" className="sm:col-span-2">
            <Select value={linkOpp} onValueChange={setLinkOpp}>
              <SelectTrigger className="h-9 rounded-lg" aria-label="Link an opportunity">
                <SelectValue placeholder="No opportunity" />
              </SelectTrigger>
              <SelectContent>
                {(refs.data?.opportunities ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FormDialog>

      <SalesAsOf asOfLabel={SALES_PERIOD.asOfLabel} note="Message state (Sent / Delivered / Read) is reported by the WhatsApp Business API." />
    </div>
  );
}
