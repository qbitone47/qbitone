"use client";

import * as React from "react";
import {
  Archive,
  ArrowLeft,
  Flag,
  Forward,
  Inbox,
  MailOpen,
  Paperclip,
  Reply,
  ReplyAll,
  Send,
  Star,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getEmployee } from "@/lib/qubit/data";
import { fmtDate, fmtDateTime, fmtTime, WORKSPACE_NOW, type MailMessage } from "@/lib/qubit/workspace-data";
import { Avatar, StatusBadge } from "../primitives";
import { DetailDrawer } from "../drawers";
import { useQubitNav } from "../nav-context";

// ============================================================
// Shared mail vocabulary for screens 55–58 (one data model,
// one row language, one reading pane — spec §57).
// ============================================================

export function senderName(m: MailMessage): string {
  if (m.fromId) return getEmployee(m.fromId)?.name ?? "Unknown";
  return m.fromExternal?.name ?? "External sender";
}

export function recipientLabel(m: MailMessage): string {
  const resolve = (v: string) => getEmployee(v)?.name ?? v;
  const all = [...m.to.map(resolve), ...(m.cc ?? []).map(resolve)];
  return all.join(", ");
}

export function MailDateLabel({ ts, className }: { ts: number; className?: string }) {
  const sameDay = new Date(ts).toDateString() === new Date(WORKSPACE_NOW).toDateString();
  const yesterday = new Date(ts).toDateString() === new Date(WORKSPACE_NOW - 86_400_000).toDateString();
  return (
    <span className={cn("shrink-0 text-[11px] tabular-nums", className)}>
      {sameDay ? fmtTime(ts) : yesterday ? "Yesterday" : fmtDate(ts)}
    </span>
  );
}

export function MailAttachmentChip({
  name,
  sizeKb,
  onOpen,
}: {
  name: string;
  sizeKb: number;
  onOpen?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${name} — preview and download arrive with the Documents module (Phase 14)`}
      className="inline-flex max-w-[240px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left transition-colors hover:border-slate-300 hover:bg-white"
    >
      <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-medium text-slate-700">{name}</span>
        <span className="block text-[10px] text-slate-400">{sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`}</span>
      </span>
    </button>
  );
}

// ============================================================
// MailRow — the one list-row language for inbox / sent / search
// ============================================================

export function MailRow({
  mail,
  variant = "inbox",
  selected,
  onOpen,
  onToggleStar,
  onToggleSelect,
  highlight,
}: {
  mail: MailMessage;
  variant?: "inbox" | "sent" | "search";
  selected?: boolean;
  onOpen: () => void;
  onToggleStar?: () => void;
  onToggleSelect?: () => void;
  highlight?: string;
}) {
  const primary =
    variant === "sent" ? recipientLabel(mail) : senderName(mail);
  const primaryInitial = primary || "@";
  const failed = mail.sendStatus === "Failed";

  const parts = highlight ? highlightParts(mail.subject, highlight) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open message: ${mail.subject}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      className={cn(
        "group relative flex cursor-pointer gap-3 border-b border-slate-100 px-4 py-3 transition-colors last:border-0 md:px-5",
        selected ? "bg-blue-50/50" : "hover:bg-slate-50/80",
        !mail.read && variant === "inbox" && "bg-blue-50/20",
      )}
    >
      {onToggleSelect && (
        <span className="flex items-center pt-0.5">
          <input
            type="checkbox"
            aria-label={`Select message: ${mail.subject}`}
            checked={Boolean(selected)}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-slate-300 accent-blue-600"
          />
        </span>
      )}

      {/* unread / status rail */}
      <span className="flex w-2 shrink-0 flex-col items-center gap-1 pt-1.5" aria-hidden>
        {variant === "inbox" && !mail.read && <span className="h-2 w-2 rounded-full bg-blue-600" title="Unread" />}
        {variant === "sent" && mail.sendStatus === "Failed" && <TriangleAlert className="h-3.5 w-3.5 text-red-500" />}
        {variant === "sent" && mail.sendStatus === "Pending" && <Send className="h-3 w-3 text-amber-500" />}
      </span>

      <Avatar name={primaryInitial} size="sm" className="mt-0.5 shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-[13px]",
              variant === "inbox" && !mail.read ? "font-semibold text-slate-900" : "font-medium text-slate-800",
            )}
          >
            {primary}
            {mail.fromExternal && <span className="ml-1.5 rounded bg-slate-100 px-1 py-px text-[9.5px] font-medium text-slate-500">External</span>}
          </p>
          <MailDateLabel ts={mail.ts} className="text-slate-400" />
        </div>
        <p className={cn("truncate text-[13px]", !mail.read && variant === "inbox" ? "font-semibold text-slate-900" : "text-slate-700")}>
          {parts ?? mail.subject}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{mail.preview}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {mail.priority === "High" && (
            <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-1.5 py-px text-[10px] font-medium text-red-700">
              <Flag className="h-2.5 w-2.5" aria-hidden /> High
            </span>
          )}
          {failed && (
            <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-1.5 py-px text-[10px] font-medium text-red-700">
              <TriangleAlert className="h-2.5 w-2.5" aria-hidden /> Delivery failed
            </span>
          )}
          {mail.sendStatus === "Pending" && (
            <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
              <Send className="h-2.5 w-2.5" aria-hidden /> Sending
            </span>
          )}
          {mail.attachments?.length ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-400">
              <Paperclip className="h-3 w-3" aria-hidden /> {mail.attachments.length}
            </span>
          ) : null}
          {mail.labels?.map((l) => (
            <span key={l} className="rounded border border-blue-100 bg-blue-50 px-1.5 py-px text-[10px] font-medium text-blue-700">
              {l}
            </span>
          ))}
        </div>
      </div>

      {onToggleStar && (
        <button
          type="button"
          aria-label={mail.starred ? `Unstar: ${mail.subject}` : `Star: ${mail.subject}`}
          aria-pressed={Boolean(mail.starred)}
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar();
          }}
          className="mt-1 shrink-0 self-start rounded p-1 text-slate-300 transition-colors hover:bg-amber-50 hover:text-amber-500"
        >
          <Star className={cn("h-4 w-4", mail.starred && "fill-amber-400 text-amber-400")} aria-hidden />
        </button>
      )}
    </div>
  );
}

function highlightParts(subject: string, q: string) {
  const idx = subject.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return subject;
  return (
    <>
      {subject.slice(0, idx)}
      <mark className="rounded bg-amber-100 px-0.5 text-slate-900">{subject.slice(idx, idx + q.length)}</mark>
      {subject.slice(idx + q.length)}
    </>
  );
}

// ============================================================
// MailReadingPane — the shared reading surface (desktop column
// and mobile drawer both render this, so Inbox/Sent/Search feel
// like one mail system).
// ============================================================

export function MailReadingPane({
  mail,
  variant = "inbox",
  onReply,
  onForward,
  onRetry,
  onArchive,
  onBack,
}: {
  mail: MailMessage;
  variant?: "inbox" | "sent";
  onReply?: (mode: "reply" | "reply-all") => void;
  onForward?: () => void;
  onRetry?: () => void;
  onArchive?: () => void;
  onBack?: () => void;
}) {
  const { toast } = useToast();
  const fromName = senderName(mail);
  const resolve = (v: string) => getEmployee(v)?.name ?? v;
  const toLabel = mail.to.map(resolve).join(", ");
  const ccLabel = mail.cc?.map(resolve).join(", ");

  const attachmentNote = () =>
    toast({
      title: "Attachment preview",
      description: "Attachment preview and download arrive with the Documents module (Phase 14). The file list stays authoritative here.",
    });

  return (
    <div className="flex h-full flex-col">
      {onBack && (
        <div className="border-b border-slate-100 px-4 py-2 md:hidden">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to list
          </Button>
        </div>
      )}

      <div className="qubit-scroll flex-1 overflow-y-auto px-5 py-5 md:px-6">
        <div className="flex items-start gap-3">
          <Avatar name={fromName} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold leading-snug tracking-tight text-slate-900">{mail.subject}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-slate-700">{fromName}</span>
              {mail.fromExternal?.email && ` <${mail.fromExternal.email}>`} · {fmtDateTime(mail.ts)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              to <span className="font-medium text-slate-600">{toLabel}</span>
              {ccLabel && <> · cc <span className="font-medium text-slate-600">{ccLabel}</span></>}
            </p>
          </div>
          {variant === "sent" && mail.sendStatus && (
            <div className="shrink-0">
              <StatusBadge status={mail.sendStatus === "Delivered" ? "Resolved" : mail.sendStatus === "Sent" ? "Sent" : mail.sendStatus === "Pending" ? "Submitted" : "Rejected"} size="sm" />
              {mail.sendDetail && <p className="mt-1.5 max-w-44 text-[10.5px] leading-snug text-red-600">{mail.sendDetail}</p>}
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3 text-[13.5px] leading-relaxed text-slate-700">
          {mail.body.split("\n").map((line, i) =>
            line.trim() === "" ? <div key={i} className="h-2" /> : <p key={i}>{line}</p>,
          )}
        </div>

        {mail.attachments?.length ? (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {mail.attachments.length} attachment{mail.attachments.length === 1 ? "" : "s"}
            </p>
            <div className="flex flex-wrap gap-2">
              {mail.attachments.map((a) => (
                <MailAttachmentChip key={a.name} name={a.name} sizeKb={a.sizeKb} onOpen={attachmentNote} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 md:px-6">
        {variant === "inbox" && onReply && (
          <>
            <Button size="sm" className="h-8 gap-1.5" onClick={() => onReply("reply")}>
              <Reply className="h-3.5 w-3.5" aria-hidden /> Reply
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => onReply("reply-all")}>
              <ReplyAll className="h-3.5 w-3.5" aria-hidden /> Reply all
            </Button>
          </>
        )}
        {onForward && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onForward}>
            <Forward className="h-3.5 w-3.5" aria-hidden /> Forward
          </Button>
        )}
        {variant === "sent" && (mail.sendStatus === "Failed" || mail.sendStatus === "Pending") && onRetry && (
          <Button size="sm" className="h-8 gap-1.5" onClick={onRetry}>
            <Send className="h-3.5 w-3.5" aria-hidden /> Retry delivery
          </Button>
        )}
        {variant === "inbox" && onArchive && (
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-slate-500" onClick={onArchive}>
            <Archive className="h-3.5 w-3.5" aria-hidden /> Archive
          </Button>
        )}
        {variant === "inbox" && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-8 gap-1.5 text-slate-500"
            onClick={() => toast({ title: "Marked as unread", description: "The message returns to your unread list." })}
          >
            <MailOpen className="h-3.5 w-3.5" aria-hidden /> Mark unread
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MailDetailDrawer — mobile / secondary reading surface
// ============================================================

export function MailDetailDrawer({
  mail,
  onOpenChange,
  variant = "inbox",
  onReply,
  onForward,
  onRetry,
}: {
  mail: MailMessage | null;
  onOpenChange: (open: boolean) => void;
  variant?: "inbox" | "sent";
  onReply?: (mode: "reply" | "reply-all") => void;
  onForward?: () => void;
  onRetry?: () => void;
}) {
  if (!mail) return null;
  return (
    <DetailDrawer
      open={Boolean(mail)}
      onOpenChange={onOpenChange}
      wide
      title={mail.subject}
      subtitle={variant === "sent" ? `To ${recipientLabel(mail)}` : `From ${senderName(mail)}`}
      icon={<Inbox />}
    >
      <MailReadingPane mail={mail} variant={variant} onReply={onReply} onForward={onForward} onRetry={onRetry} />
    </DetailDrawer>
  );
}

// ============================================================
// useMailStore — one client-side view of the server mailbox.
// Screens 55/57/58 share this hook so a send in Compose (56)
// is immediately visible in Inbox/Sent/Search.
// ============================================================

export function useMailStore() {
  const nav = useQubitNav();
  const { toast } = useToast();
  const [mail, setMail] = React.useState<MailMessage[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/mail?folder=all&limit=200", { cache: "no-store" });
      if (!res.ok) throw new Error(`Mail service returned ${res.status}.`);
      const data = await res.json();
      setMail(data.items);
    } catch {
      setError("Mail could not be loaded. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load, nav.navKey]);

  const markRead = React.useCallback(async (id: string, read = true) => {
    setMail((ms) => (ms ? ms.map((m) => (m.id === id ? { ...m, read } : m)) : ms));
    try {
      await fetch("/api/workspace/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark", id, read }),
      });
    } catch {
      /* local view already updated; server sync retries on next load */
    }
  }, []);

  const toggleStar = React.useCallback(async (id: string) => {
    let next = false;
    setMail((ms) => {
      if (!ms) return ms;
      next = !ms.find((m) => m.id === id)?.starred;
      return ms.map((m) => (m.id === id ? { ...m, starred: next } : m));
    });
    try {
      await fetch("/api/workspace/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark", id, starred: next }),
      });
    } catch {
      toast({ variant: "destructive", title: "Could not update the star", description: "Your change is shown locally and will sync when the connection returns." });
    }
  }, [toast]);

  const archive = React.useCallback(async (id: string) => {
    setMail((ms) => (ms ? ms.map((m) => (m.id === id ? { ...m, folder: "archive" } : m)) : ms));
    try {
      await fetch("/api/workspace/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark", id, archive: true }),
      });
    } catch {
      /* same as above */
    }
  }, []);

  const retry = React.useCallback(
    async (id: string): Promise<{ ok: boolean; message?: string }> => {
      try {
        const res = await fetch("/api/workspace/mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "retry", id }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, message: data?.message ?? "Retry failed." };
        setMail((ms) => (ms ? ms.map((m) => (m.id === id ? { ...data.message } : m)) : ms));
        return { ok: true };
      } catch {
        return { ok: false, message: "Network error — the message was not retried." };
      }
    },
    [],
  );

  return { mail, loading, error, reload: load, markRead, toggleStar, archive, retry };
}
