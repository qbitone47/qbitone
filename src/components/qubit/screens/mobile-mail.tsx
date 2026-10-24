"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  MobileBadge,
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
// Screen 299 · Mobile Mail — the enterprise mailbox on mobile.
// Inbox / unread / sent / drafts + server-enforced search, message
// detail, quick compose and replies that route through the SAME
// mail system (sendMail / saveDraft / markMail). No fake transport:
// delivery states come from the mail system as-is (spec §20).
// ============================================================

interface MailItem {
  id: string; subject: string; preview: string; ts: number; read: boolean; starred: boolean;
  from: string; to: string[]; attachments: number; sendStatus: string | null;
}
interface ListPayload {
  folder: string;
  items: MailItem[];
  counts: { inbox: number; inboxUnread: number; sent: number; drafts: number };
  total: number;
  sourceNote: string;
}
interface DetailPayload {
  message: {
    id: string; subject: string; body: string; ts: number; from: string; fromEmail: string | null;
    to: string[]; cc: string[]; attachments: { name: string; sizeKb: number; type: string }[]; sendStatus: string | null;
  };
  sourceNote: string;
}

const fmtDT = (ts: number) => new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export function MobileMailScreen() {
  const nav = useQubitNav();
  const { params } = nav;
  const { role } = useRole();
  const mailId = params.mailId ?? "";
  const [folder, setFolder] = React.useState("inbox");
  const [q, setQ] = React.useState("");
  const list = useMobileSection<ListPayload>("mail", { folder: folder === "unread" ? "inbox" : folder, q: q || undefined, unreadOnly: folder === "unread" ? "1" : undefined });
  const detail = useMobileSection<DetailPayload>("mail", { id: mailId });
  const [busy, setBusy] = React.useState(false);
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [to, setTo] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");

  const send = async () => {
    setBusy(true);
    try {
      const res = await mobilePost<{ message: string }>(
        "mail.send",
        { to: to.split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean), subject, body },
        role,
      );
      toast({ title: "Message sent", description: res.message });
      setComposeOpen(false);
      setTo("");
      setSubject("");
      setBody("");
    } catch (e) {
      toast({ title: "Send failed", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const quickReply = async () => {
    if (!detail.data) return;
    setBusy(true);
    try {
      const res = await mobilePost<{ message: string }>(
        "mail.send",
        { to: detail.data.message.fromEmail ? [detail.data.message.fromEmail] : [], subject: `Re: ${detail.data.message.subject}`, body: body || "Received — will respond in full shortly." },
        role,
      );
      toast({ title: "Reply sent", description: res.message });
      nav.navigate("mobile-mail");
    } catch (e) {
      toast({ title: "Reply failed", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileFrame
      title={mailId ? detail.data?.message.subject ?? "Message" : "Mail"}
      activeTab="comms"
      onBack={mailId ? () => nav.navigate("mobile-mail") : undefined}
      right={
        !mailId ? (
          <button type="button" onClick={() => setComposeOpen((v) => !v)} aria-expanded={composeOpen}
            className="min-h-[36px] rounded-full bg-blue-600 px-3 text-[12px] font-semibold text-white hover:bg-blue-700">
            Compose
          </button>
        ) : undefined
      }
    >
      {mailId ? (
        <>
          {detail.loading && <MobileSkeleton rows={2} />}
          {detail.error && !detail.loading && <MobileErrorBanner message={detail.error} onRetry={detail.reload} />}
          {detail.data && !detail.loading && (
            <>
              <MobileSection title="Message">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[14.5px] font-semibold leading-snug text-slate-900">{detail.data.message.subject}</p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {detail.data.message.from}{detail.data.message.fromEmail ? ` · ${detail.data.message.fromEmail}` : ""} · {fmtDT(detail.data.message.ts)}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-slate-400">To: {detail.data.message.to.join(", ") || "—"}</p>
                  {detail.data.message.sendStatus && (
                    <div className="mt-1.5"><MobileBadge tone={detail.data.message.sendStatus === "Failed" ? "red" : "green"}>Delivery: {detail.data.message.sendStatus}</MobileBadge></div>
                  )}
                  <div className="mt-3 whitespace-pre-wrap border-t border-slate-100 pt-3 text-[13px] leading-relaxed text-slate-700">
                    {detail.data.message.body}
                  </div>
                  {detail.data.message.attachments.length > 0 && (
                    <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                      {detail.data.message.attachments.map((a, i) => (
                        <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 text-[12px]">
                          <span className="truncate font-medium text-slate-700">{a.name}</span>
                          <span className="ml-2 shrink-0 text-slate-400">{a.type} · {a.sizeKb} KB</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </MobileSection>

              <MobileSection title="Actions">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  aria-label="Quick reply"
                  placeholder="Quick reply…"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy} onClick={quickReply} className="min-h-[48px] rounded-xl bg-blue-600 text-[13px] font-semibold text-white disabled:opacity-40">Send reply</button>
                  <button
                    type="button"
                    onClick={() => nav.navigate("compose-mail", { mailReply: detail.data!.message.id })}
                    className="min-h-[48px] rounded-xl border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:border-blue-300"
                  >
                    Full reply on desktop
                  </button>
                </div>
              </MobileSection>

              <SourceNote>{detail.data.sourceNote}</SourceNote>
              <p className="px-3 pb-2 text-[10px] text-slate-300">Mobile Mail</p>
            </>
          )}
        </>
      ) : (
        <>
          {list.loading && <MobileSkeleton rows={4} />}
          {list.error && !list.loading && <MobileErrorBanner message={list.error} onRetry={list.reload} />}
          {list.data && !list.loading && (
            <>
              {/* Search */}
              <div className="px-3 pt-3">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                  <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    aria-label="Search mail"
                    placeholder="Search your mailbox…"
                    className="min-h-[44px] w-full bg-transparent text-[13px] outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <FilterChips
                options={["Inbox", "Unread", "Sent", "Drafts"]}
                value={folder === "inbox" ? "Inbox" : folder === "unread" ? "Unread" : folder === "sent" ? "Sent" : "Drafts"}
                onChange={(label) => setFolder(label.toLowerCase())}
              />

              {composeOpen && (
                <MobileSection title="New message">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <label htmlFor="m-to" className="text-[12px] font-medium text-slate-600">To</label>
                    <input id="m-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@qubitone.in"
                      className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-600" />
                    <label htmlFor="m-subject" className="mt-2 block text-[12px] font-medium text-slate-600">Subject</label>
                    <input id="m-subject" value={subject} onChange={(e) => setSubject(e.target.value)}
                      className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-600" />
                    <label htmlFor="m-body" className="mt-2 block text-[12px] font-medium text-slate-600">Message</label>
                    <textarea id="m-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-600" />
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={busy || to.trim().length < 5} onClick={send}
                        className="min-h-[44px] flex-1 rounded-lg bg-blue-600 text-[13px] font-semibold text-white disabled:opacity-40">Send</button>
                      <button type="button" disabled={busy}
                        onClick={() => mobilePost("mail.draft", { to: [to], subject, body }, role).then(() => toast({ title: "Draft saved" })).catch(() => undefined)}
                        className="min-h-[44px] flex-1 rounded-lg border border-slate-300 text-[13px] font-medium text-slate-700">Save draft</button>
                    </div>
                  </div>
                </MobileSection>
              )}

              <MobileSection title={folder === "unread" ? "Unread" : folder}>
                {list.data.items.length ? (
                  list.data.items.map((m) => (
                    <MobileRow
                      key={m.id}
                      title={
                        <span className={m.read ? "" : "font-semibold text-slate-900"}>
                          {m.subject}
                        </span>
                      }
                      detail={`${folder === "sent" || folder === "drafts" ? `To ${m.to.join(", ") || "—"}` : m.from} — ${m.preview}`}
                      meta={fmtDT(m.ts)}
                      trailing={
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          {!m.read && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" aria-label="Unread" />}
                          {m.attachments > 0 && <span className="text-[10px] text-slate-400">{m.attachments} att.</span>}
                          {m.sendStatus === "Failed" && <MobileBadge tone="red">Failed</MobileBadge>}
                        </span>
                      }
                      onClick={() => nav.navigate("mobile-mail", { mailId: m.id })}
                    />
                  ))
                ) : (
                  <MobileEmpty title={q ? `No matches for “${q}”` : "Nothing here"} detail="Search is scoped to your authorized mailbox server-side." />
                )}
              </MobileSection>

              <SourceNote>{list.data.sourceNote}</SourceNote>
              <p className="px-3 pb-2 text-[10px] text-slate-300">Mobile Mail</p>
            </>
          )}
        </>
      )}
    </MobileFrame>
  );
}
