"use client";

import * as React from "react";
import { Archive, Inbox, PenLine, RefreshCw, Search, Send, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ALL_MAIL, type MailMessage } from "@/lib/qubit/workspace-data";
import { useQubitNav } from "../nav-context";
import { PageHeader } from "../page-header";
import { EmptyState, StatTile } from "../primitives";
import { MailDetailDrawer, MailReadingPane, MailRow, recipientLabel, useMailStore } from "../workspace/mail-parts";

// ============================================================
// Screen 57 · Sent Mail — same data model and components as the
// Inbox (spec §57). Delivery status is honest: Failed messages
// expose the reason and a server-validated Retry.
// ============================================================

export function SentMailScreen() {
  const nav = useQubitNav();
  const { toast } = useToast();
  const store = useMailStore();
  const params = nav.params as { sentId?: string };

  const [selectedId, setSelectedId] = React.useState<string | null>(params.sentId ?? null);
  const [drawerMail, setDrawerMail] = React.useState<MailMessage | null>(null);
  const [filter, setFilter] = React.useState("");
  const [retryingId, setRetryingId] = React.useState<string | null>(null);

  const all = store.mail ?? [];
  const sent = React.useMemo(() => {
    let items = all.filter((m) => m.folder === "sent");
    const q = filter.trim().toLowerCase();
    if (q) items = items.filter((m) => `${m.subject} ${m.preview} ${recipientLabel(m)}`.toLowerCase().includes(q));
    return items.sort((a, b) => b.ts - a.ts);
  }, [all, filter]);

  const failed = sent.filter((m) => m.sendStatus === "Failed").length;
  const pending = sent.filter((m) => m.sendStatus === "Pending").length;

  const selected = sent.find((m) => m.id === selectedId) ?? null;

  const openMail = (m: MailMessage) => {
    setSelectedId(m.id);
    if (window.innerWidth < 1024) setDrawerMail(m);
  };

  const retry = async (m: MailMessage) => {
    setRetryingId(m.id);
    const result = await store.retry(m.id);
    setRetryingId(null);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Retry failed", description: result.message ?? "The mail service could not complete the retry." });
      return;
    }
    toast({ title: "Message sent on retry", description: `Delivery to ${recipientLabel(m)} succeeded.` });
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        crumbs={[{ label: "Mail" }, { label: "Sent" }]}
        title="Sent Mail"
        description="Every message you've sent, with honest delivery status — including the ones that failed and why."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile icon={<Send />} value={sent.length} label="Messages sent" />
        <StatTile icon={<Send />} value={pending} label="Awaiting delivery" />
        <StatTile icon={<RefreshCw />} value={failed} label="Failed — retry available" />
      </div>

      <div className="grid flex-1 gap-0 lg:grid-cols-[minmax(320px,420px)_1fr] lg:overflow-hidden lg:rounded-xl lg:border lg:border-slate-200/80 lg:bg-white lg:shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {/* List */}
        <section className={cn("flex min-w-0 flex-col border-slate-100 lg:border-r", selected && "hidden lg:flex")} aria-label="Sent messages">
          <div className="border-b border-slate-100 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter sent messages…"
                aria-label="Filter sent messages"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition-colors focus:border-blue-300"
              />
            </div>
          </div>
          <div className="qubit-scroll min-h-40 flex-1 overflow-y-auto">
            {store.loading && !store.mail ? (
              <div aria-hidden className="divide-y">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 px-4 py-3.5">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sent.length === 0 ? (
              <EmptyState
                icon={<Send />}
                title={filter ? "No sent messages match" : "Nothing sent yet"}
                message={filter ? `Nothing matches "${filter}".` : "Messages you compose appear here with their delivery status."}
                action={
                  !filter ? (
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => nav.navigate("compose-mail")}>
                      <PenLine className="h-3.5 w-3.5" aria-hidden /> Compose
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div role="list">
                {sent.map((m) => (
                  <div key={m.id} role="listitem" className="relative">
                    <MailRow mail={m} variant="sent" selected={m.id === selectedId} onOpen={() => openMail(m)} onToggleStar={() => void store.toggleStar(m.id)} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-3.5 py-2 text-[11px] text-slate-400">
            <span>{sent.length} message{sent.length === 1 ? "" : "s"}</span>
            <button type="button" onClick={() => nav.navigate("mail-search")} className="font-medium text-blue-600 hover:text-blue-800">
              Search all mail →
            </button>
          </div>
        </section>

        {/* Reading pane */}
        <section className="hidden min-w-0 lg:block" aria-label="Sent message reading pane">
          {selected ? (
            <MailReadingPane
              mail={selected}
              variant="sent"
              onForward={() => nav.navigate("compose-mail", { mailForward: selected.id })}
              onRetry={() => void retry(selected)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="qubit-icon-tile qubit-icon-tile-accent h-14 w-14">
                <Send />
              </span>
              <p className="text-sm font-semibold text-slate-800">Select a sent message</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Delivery status shows for every message. Failed deliveries keep the full content so you can retry or correct the address.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Mobile reading drawer */}
      <MailDetailDrawer
        mail={drawerMail}
        variant="sent"
        onOpenChange={(o) => !o && setDrawerMail(null)}
        onForward={() => {
          if (drawerMail) nav.navigate("compose-mail", { mailForward: drawerMail.id });
          setDrawerMail(null);
        }}
        onRetry={() => {
          if (drawerMail) void retry(drawerMail);
          setDrawerMail(null);
        }}
      />
    </div>
  );
}

// keep tree-shaking honest about icons used only in the rail variant
void Archive;
void Inbox;
void Star;
void ALL_MAIL;
