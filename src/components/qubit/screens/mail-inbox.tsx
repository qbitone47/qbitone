"use client";

import * as React from "react";
import {
  Archive,
  CheckCheck,
  Inbox,
  Mail,
  PenLine,
  RefreshCw,
  Search,
  Send,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { MailMessage } from "@/lib/qubit/workspace-data";
import { useQubitNav } from "../nav-context";
import { PageHeader } from "../page-header";
import { EmptyState } from "../primitives";
import { MailDetailDrawer, MailReadingPane, MailRow, senderName, useMailStore } from "../workspace/mail-parts";

// ============================================================
// Screen 55 · Company Mail Inbox — high-density enterprise mail.
// One data model, one row language and one reading pane shared
// with Sent (57) and Search (58). Integration-ready: external
// providers plug into the same store (spec §55).
// ============================================================

type QuickFolder = "inbox" | "starred" | "drafts" | "archive";

export function MailInboxScreen() {
  const nav = useQubitNav();
  const { toast } = useToast();
  const store = useMailStore();

  const [quick, setQuick] = React.useState<QuickFolder>("inbox");
  const [filter, setFilter] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [drawerMail, setDrawerMail] = React.useState<MailMessage | null>(null);
  const [checked, setChecked] = React.useState<Set<string>>(new Set());

  const all = store.mail ?? [];

  const list = React.useMemo(() => {
    let items = all.filter((m) => (quick === "starred" ? Boolean(m.starred) && m.folder !== "sent" : m.folder === quick));
    const q = filter.trim().toLowerCase();
    if (q) items = items.filter((m) => `${m.subject} ${m.preview} ${senderName(m)}`.toLowerCase().includes(q));
    return items.sort((a, b) => b.ts - a.ts);
  }, [all, quick, filter]);

  const unread = all.filter((m) => m.folder === "inbox" && !m.read).length;
  const drafts = all.filter((m) => m.folder === "drafts").length;
  const selected = list.find((m) => m.id === selectedId) ?? null;

  const openMail = (m: MailMessage) => {
    setSelectedId(m.id);
    if (window.innerWidth < 1024) setDrawerMail(m);
    if (!m.read) void store.markRead(m.id);
  };

  const toggleCheck = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulkMarkRead = () => {
    for (const id of checked) void store.markRead(id, true);
    toast({ title: `${checked.size} message${checked.size === 1 ? "" : "s"} marked as read` });
    setChecked(new Set());
  };

  const bulkArchive = async () => {
    for (const id of checked) await store.archive(id);
    toast({ title: `${checked.size} message${checked.size === 1 ? "" : "s"} archived`, description: "Archived mail stays searchable in Mail Search." });
    setChecked(new Set());
    setSelectedId(null);
  };

  const reply = (m: MailMessage, mode: "reply" | "reply-all") =>
    nav.navigate("compose-mail", { mailReply: m.id, replyAll: mode === "reply-all" });

  return (
    <div className="flex flex-col">
      <PageHeader
        crumbs={[{ label: "Mail" }, { label: "Inbox" }]}
        title="Company Mail"
        description="Your Qubit One mailbox — high-density, policy-compliant, and connected to approvals, tasks and security."
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={store.reload} aria-label="Reload mailbox">
              <RefreshCw className={cn("h-3.5 w-3.5", store.loading && "animate-spin")} aria-hidden /> Refresh
            </Button>
            <Button className="h-9 gap-1.5" onClick={() => nav.navigate("compose-mail")}>
              <PenLine className="h-4 w-4" aria-hidden /> Compose
            </Button>
          </>
        }
      />

      {store.error && (
        <div className="qubit-card mb-3 flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50/60 px-4 py-3" role="alert">
          <p className="text-sm font-medium text-red-700">{store.error}</p>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={store.reload}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
          </Button>
        </div>
      )}

      <div className="grid flex-1 gap-0 lg:grid-cols-[200px_minmax(320px,380px)_1fr] lg:overflow-hidden lg:rounded-xl lg:border lg:border-slate-200/80 lg:bg-white lg:shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {/* Folder rail (desktop) */}
        <aside className="hidden border-r border-slate-100 bg-slate-50/50 p-2.5 lg:block" aria-label="Mail folders">
          <MailRail quick={quick} setQuick={setQuick} unread={unread} drafts={drafts} starredCount={all.filter((m) => m.starred && m.folder !== "sent").length} archiveCount={all.filter((m) => m.folder === "archive").length} onCompose={() => nav.navigate("compose-mail")} onSearch={() => nav.navigate("mail-search")} onSent={() => nav.navigate("sent-mail")} />
        </aside>

        {/* List column */}
        <section className={cn("flex min-w-0 flex-col border-slate-100 lg:border-r", selected && "hidden lg:flex")} aria-label="Message list">
          <div className="border-b border-slate-100 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter this folder…"
                aria-label="Filter messages in this folder"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition-colors focus:border-blue-300"
              />
            </div>
            <div className="mt-2 flex items-center justify-between lg:hidden">
              <FolderTabs quick={quick} setQuick={setQuick} unread={unread} drafts={drafts} />
              <button type="button" onClick={() => nav.navigate("mail-search")} className="text-[11.5px] font-medium text-blue-600">
                Full search →
              </button>
            </div>
          </div>

          {/* Bulk action bar */}
          {checked.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50/70 px-3 py-2" role="toolbar" aria-label="Bulk actions">
              <span className="text-xs font-medium text-blue-800">{checked.size} selected</span>
              <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={bulkMarkRead}>
                <CheckCheck className="h-3 w-3" aria-hidden /> Mark read
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => void bulkArchive()}>
                <Archive className="h-3 w-3" aria-hidden /> Archive
              </Button>
              <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs text-slate-500" onClick={() => setChecked(new Set())}>
                Clear
              </Button>
            </div>
          )}

          <div className="qubit-scroll min-h-40 flex-1 overflow-y-auto">
            {store.loading && !store.mail ? (
              <MailListSkeleton />
            ) : list.length === 0 ? (
              <EmptyState
                icon={quick === "starred" ? <Star /> : <Inbox />}
                title={quick === "starred" ? "No starred messages" : quick === "drafts" ? "No drafts" : quick === "archive" ? "Archive is empty" : "Inbox zero"}
                message={quick === "inbox" && filter ? `Nothing matches "${filter}" in this folder — try Mail Search for the full mailbox.` : "Nothing here right now."}
                action={
                  quick === "inbox" && filter ? (
                    <Button size="sm" variant="outline" className="h-8" onClick={() => nav.navigate("mail-search")}>
                      Open Mail Search
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div role="list">
                {list.map((m) => (
                  <div key={m.id} role="listitem" className="relative">
                    <MailRow
                      mail={m}
                      variant="inbox"
                      selected={checked.has(m.id) || m.id === selectedId}
                      onOpen={() => openMail(m)}
                      onToggleStar={() => void store.toggleStar(m.id)}
                      onToggleSelect={() => toggleCheck(m.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-3.5 py-2 text-[11px] text-slate-400">
            <span>{list.length} message{list.length === 1 ? "" : "s"} · {unread} unread</span>
            <span>Scoped to your mailbox — server-enforced</span>
          </div>
        </section>

        {/* Reading pane (desktop) */}
        <section className="hidden min-w-0 lg:block" aria-label="Message reading pane" aria-live="polite">
          {selected ? (
            <MailReadingPane
              mail={selected}
              onReply={(mode) => reply(selected, mode)}
              onForward={() => nav.navigate("compose-mail", { mailForward: selected.id })}
              onArchive={() => {
                void store.archive(selected.id);
                setSelectedId(null);
                toast({ title: "Message archived" });
              }}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="qubit-icon-tile qubit-icon-tile-accent h-14 w-14">
                <Mail />
              </span>
              <p className="text-sm font-semibold text-slate-800">Select a message</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Choose a conversation from the list. Unread mail is marked with a blue dot and bold type — never color alone.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Mobile reading drawer */}
      <MailDetailDrawer
        mail={drawerMail}
        onOpenChange={(o) => !o && setDrawerMail(null)}
        onReply={(mode) => {
          if (drawerMail) reply(drawerMail, mode);
          setDrawerMail(null);
        }}
        onForward={() => {
          if (drawerMail) nav.navigate("compose-mail", { mailForward: drawerMail.id });
          setDrawerMail(null);
        }}
      />
    </div>
  );
}

// ---------- shared rail pieces (inbox-scoped) ----------

function MailRail({
  quick,
  setQuick,
  unread,
  drafts,
  starredCount,
  archiveCount,
  onCompose,
  onSearch,
  onSent,
}: {
  quick: QuickFolder;
  setQuick: (q: QuickFolder) => void;
  unread: number;
  drafts: number;
  starredCount: number;
  archiveCount: number;
  onCompose: () => void;
  onSearch: () => void;
  onSent: () => void;
}) {
  const items: { id: QuickFolder | "sent" | "search"; label: string; icon: React.ElementType; count?: number; onClick?: () => void }[] = [
    { id: "inbox", label: "Inbox", icon: Inbox, count: unread },
    { id: "starred", label: "Starred", icon: Star, count: starredCount },
    { id: "sent", label: "Sent", icon: Send, onClick: onSent },
    { id: "drafts", label: "Drafts", icon: PenLine, count: drafts },
    { id: "archive", label: "Archive", icon: Archive, count: archiveCount },
    { id: "search", label: "Mail Search", icon: Search, onClick: onSearch },
  ];
  return (
    <div className="space-y-1">
      <Button size="sm" className="mb-2 w-full justify-start gap-1.5" onClick={onCompose}>
        <PenLine className="h-3.5 w-3.5" aria-hidden /> Compose
      </Button>
      {items.map((it) => {
        const Icon = it.icon;
        const active = it.id === quick;
        const Comp = (
          <>
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-blue-600" : "text-slate-400")} aria-hidden />
            <span className="flex-1 text-left">{it.label}</span>
            {typeof it.count === "number" && it.count > 0 && (
              <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold", active ? "bg-blue-100 text-blue-700" : "bg-slate-200/80 text-slate-600")}>
                {it.count}
              </span>
            )}
          </>
        );
        const cls = cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
          active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900",
        );
        return it.onClick ? (
          <button key={it.id} type="button" className={cls} onClick={it.onClick}>
            {Comp}
          </button>
        ) : (
          <button key={it.id} type="button" className={cls} aria-current={active ? "page" : undefined} onClick={() => setQuick(it.id as QuickFolder)}>
            {Comp}
          </button>
        );
      })}
    </div>
  );
}

function FolderTabs({ quick, setQuick, unread, drafts }: { quick: QuickFolder; setQuick: (q: QuickFolder) => void; unread: number; drafts: number }) {
  const tabs: { id: QuickFolder; label: string; count?: number }[] = [
    { id: "inbox", label: "Inbox", count: unread },
    { id: "starred", label: "Starred" },
    { id: "drafts", label: "Drafts", count: drafts },
    { id: "archive", label: "Archive" },
  ];
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={quick === t.id}
          onClick={() => setQuick(t.id)}
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors",
            quick === t.id ? "bg-blue-50 text-blue-700" : "text-slate-500",
          )}
        >
          {t.label}
          {typeof t.count === "number" && t.count > 0 ? ` (${t.count})` : ""}
        </button>
      ))}
    </div>
  );
}

function MailListSkeleton() {
  return (
    <div aria-hidden className="divide-y">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-3 px-4 py-3.5">
          <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
      <span className="sr-only" role="status">Loading mailbox…</span>
    </div>
  );
}
