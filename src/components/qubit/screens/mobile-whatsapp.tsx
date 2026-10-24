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
  SourceNote,
  mobilePost,
  useMobileSection,
} from "../mobile/parts";

// ============================================================
// Screen 288 · Mobile WhatsApp — the authorized WhatsApp Business
// inbox on mobile. Conversations, lead/customer context, consent-
// enforced replies and follow-ups ride the EXISTING integration
// (int-whatsapp) through the Sales OS. Nothing here simulates
// WhatsApp: replies go through the real API path, consent denials
// surface exactly as the server returns them (spec §9).
// ============================================================

interface ConvRow {
  id: string;
  contactName: string;
  waNumber: string;
  status: string;
  unread: number;
  lastMessageAt: number;
  lastMessage: { body: string; direction: string } | null;
  leadId: string | null;
  leadName: string | null;
  accountName: string | null;
  ownerName: string;
}

interface ListPayload {
  conversations: ConvRow[];
  connected: boolean;
  sourceNote: string;
}

interface Msg { id: string; at: number; direction: "in" | "out"; body: string; template?: string; state: string }
interface ConvPayload {
  conversation: {
    id: string; contactName: string; waNumber: string; status: string; unread: number; ownerName: string;
    lead: { id: string; name: string } | null; account: { id: string; name: string } | null;
    messages: Msg[]; lastMessageAt: number;
  };
  integrationsNote: string;
}

const fmtDT = (ts: number) => new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export function MobileWhatsappScreen() {
  const nav = useQubitNav();
  const { params } = nav;
  const { role } = useRole();
  const convId = params.waId ?? "";
  const isDetail = Boolean(convId);
  const list = useMobileSection<ListPayload>("whatsapp");
  const detail = useMobileSection<ConvPayload>("whatsapp", { id: convId });
  const [reply, setReply] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (isDetail && convId && !detail.loading) {
      mobilePost("whatsapp.read", { id: convId }, role).catch(() => undefined);
    }
  }, [isDetail, convId, detail.loading]);

  const send = async () => {
    if (reply.trim().length < 1) return;
    setBusy(true);
    try {
      const res = await mobilePost<{ message: string }>("whatsapp.reply", { id: convId, body: reply }, role);
      toast({ title: "Sent via WhatsApp Business API", description: res.message });
      setReply("");
      detail.reload();
    } catch (e) {
      // Consent denials and API failures surface exactly as the server returns them.
      toast({ title: "Message not sent", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const note = async () => {
    const text = window.prompt("Internal note on this conversation");
    if (!text || text.trim().length < 2) return;
    setBusy(true);
    try {
      await mobilePost("whatsapp.note", { id: convId, text }, role);
      toast({ title: "Note recorded", description: "Added to the conversation record." });
    } catch (e) {
      toast({ title: "Could not add note", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const followup = async (leadId: string) => {
    setBusy(true);
    try {
      await mobilePost("whatsapp.followup", { leadId, subject: "WhatsApp follow-up from mobile", type: "WhatsApp" }, role);
      toast({ title: "Follow-up created", description: "Added to the follow-up queue." });
    } catch (e) {
      toast({ title: "Could not create follow-up", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileFrame
      title={isDetail ? detail.data?.conversation.contactName ?? "Conversation" : "WhatsApp"}
      activeTab="business"
      onBack={isDetail ? () => nav.navigate("mobile-whatsapp") : undefined}
    >
      {isDetail ? (
        <>
          {detail.loading && <MobileSkeleton rows={3} />}
          {detail.error && !detail.loading && <MobileErrorBanner message={detail.error} onRetry={detail.reload} />}
          {detail.data && !detail.loading && (
            <>
              <div className="flex flex-wrap items-center gap-1.5 px-3 pt-3">
                <MobileBadge tone={detail.data.conversation.status === "Open" ? "blue" : detail.data.conversation.status === "Pending" ? "amber" : "green"}>
                  {detail.data.conversation.status}
                </MobileBadge>
                {detail.data.conversation.lead && <MobileBadge>Lead: {detail.data.conversation.lead.name}</MobileBadge>}
                {detail.data.conversation.account && <MobileBadge>Customer: {detail.data.conversation.account.name}</MobileBadge>}
                <MobileBadge>Owner: {detail.data.conversation.ownerName}</MobileBadge>
              </div>

              {/* Message thread */}
              <div className="space-y-2 px-3 pt-3" aria-label="Messages">
                {detail.data.conversation.messages.map((m) => (
                  <div key={m.id} className={m.direction === "out" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={cnBubble(m.direction)}
                      role="listitem"
                    >
                      <p className="whitespace-pre-wrap text-[13px] leading-snug">{m.body}</p>
                      <p className="mt-1 text-[10px] opacity-70">
                        {fmtDT(m.at)}{m.direction === "out" ? ` · ${m.state}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply composer — real transport, consent enforced server-side */}
              <MobileSection title="Reply">
                <MobileCard>
                  <label htmlFor="wa-reply" className="text-[12px] font-medium text-slate-600">Message (WhatsApp Business API)</label>
                  <textarea
                    id="wa-reply"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 p-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="Type the business reply…"
                  />
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={send} disabled={busy || reply.trim().length === 0} className="min-h-[44px] flex-1 rounded-lg bg-blue-600 text-[13px] font-semibold text-white disabled:opacity-40">
                      Send
                    </button>
                    <button type="button" onClick={note} disabled={busy} className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-[13px] font-medium text-slate-700">
                      Add note
                    </button>
                  </div>
                </MobileCard>
              </MobileSection>

              <MobileSection title="Connected actions">
                {detail.data.conversation.lead && (
                  <MobileRow title="Create follow-up" detail="Routes into the follow-up queue for this lead" onClick={() => followup(detail.data!.conversation.lead!.id)} />
                )}
                {detail.data.conversation.lead && (
                  <MobileRow title="Open lead" detail="The connected lead workspace" onClick={() => nav.navigate("mobile-lead-detail", { leadId: detail.data!.conversation.lead!.id })} />
                )}
                {detail.data.conversation.account && (
                  <MobileRow title="Open customer" detail="Customer 360 with full timeline" onClick={() => nav.navigate("account-detail", { accountId: detail.data!.conversation.account!.id })} />
                )}
                {detail.data.conversation.lead && (
                  <MobileRow title="Convert lead" detail="Lead → Contact → Account → Opportunity with duplicate guard" onClick={() => nav.navigate("whatsapp-convert", { waId: detail.data!.conversation.id })} />
                )}
              </MobileSection>

              <SourceNote>{detail.data.integrationsNote}</SourceNote>
              <p className="px-3 pb-2 text-[10px] text-slate-300">Mobile WhatsApp</p>
            </>
          )}
        </>
      ) : (
        <>
          {list.loading && <MobileSkeleton rows={4} />}
          {list.error && !list.loading && <MobileErrorBanner message={list.error} onRetry={list.reload} />}
          {list.data && !list.loading && (
            <>
              <div className="px-3 pt-3">
                <MobileBadge tone={list.data.connected ? "green" : "red"}>{list.data.connected ? "WhatsApp Business · Connected" : "Not connected"}</MobileBadge>
              </div>
              <MobileSection title="Conversations">
                {list.data.conversations.length ? (
                  list.data.conversations.map((c) => (
                    <MobileRow
                      key={c.id}
                      title={c.contactName}
                      detail={c.lastMessage ? `${c.lastMessage.direction === "out" ? "You: " : ""}${c.lastMessage.body}` : c.waNumber}
                      meta={`${c.status} · ${c.ownerName}`}
                      trailing={
                        c.unread > 0 ? (
                          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white" aria-label={`${c.unread} unread`}>
                            {c.unread}
                          </span>
                        ) : undefined
                      }
                      onClick={() => nav.navigate("mobile-whatsapp", { waId: c.id })}
                    />
                  ))
                ) : (
                  <MobileEmpty title="No authorized conversations" detail="Conversations appear here when the WhatsApp Business integration routes them to your scope." />
                )}
              </MobileSection>
              <SourceNote>{list.data.sourceNote}</SourceNote>
              <p className="px-3 pb-2 text-[10px] text-slate-300">Mobile WhatsApp</p>
            </>
          )}
        </>
      )}
    </MobileFrame>
  );
}

function cnBubble(direction: "in" | "out") {
  return direction === "out"
    ? "max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-3 py-2 text-white shadow-sm"
    : "max-w-[85%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm";
}
