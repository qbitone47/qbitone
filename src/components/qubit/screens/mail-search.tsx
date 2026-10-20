"use client";

import * as React from "react";
import { ArrowUpDown, CalendarRange, Filter, Loader2, Mail, Paperclip, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { authedFetch } from "@/lib/qubit/api";
import type { MailMessage } from "@/lib/qubit/workspace-data";
import { AUTHORIZED_MAIL_COUNT } from "@/lib/qubit/workspace-data";
import { useQubitNav } from "../nav-context";
import { PageHeader } from "../page-header";
import { EmptyState } from "../primitives";
import { MailDetailDrawer, MailRow, senderName } from "../workspace/mail-parts";

// ============================================================
// Screen 58 · Mail Search — powerful, server-enforced search.
// The index can never become an authorization bypass: every
// query is filtered by the caller's authorized mailbox on the
// server before results are returned (spec §58).
// ============================================================

type Scope = "all" | "inbox" | "sent" | "drafts" | "archive";

interface SearchState {
  q: string;
  scope: Scope;
  from: string;
  to: string;
  folder: string;
  hasAttachment: boolean;
  unreadOnly: boolean;
  dateFrom: string;
  dateTo: string;
}

const INITIAL: SearchState = { q: "", scope: "all", from: "", to: "", folder: "any", hasAttachment: false, unreadOnly: false, dateFrom: "", dateTo: "" };

export function MailSearchScreen() {
  const nav = useQubitNav();

  const [state, setState] = React.useState<SearchState>(INITIAL);
  const [advanced, setAdvanced] = React.useState(false);
  const [results, setResults] = React.useState<MailMessage[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [searchedScope, setSearchedScope] = React.useState<string>("");
  const [elapsed, setElapsed] = React.useState<string>("");
  const [selected, setSelected] = React.useState<MailMessage | null>(null);
  const [recent, setRecent] = React.useState<string[]>([]);

  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => inputRef.current?.focus(), []);

  const runSearch = React.useCallback(
    async (s: SearchState) => {
      const q = s.q.trim();
      if (!q && !s.from && !s.to && !s.hasAttachment && !s.unreadOnly && !s.dateFrom && !s.dateTo) {
        setResults(null);
        setSearchedScope("");
        return;
      }
      setSearching(true);
      setSearchError(null);
      const started = performance.now();
      try {
        const scopes: Exclude<Scope, "all">[] = s.scope === "all" ? ["inbox", "sent", "drafts", "archive"] : [s.scope];
        const responses = await Promise.all(
          scopes.map((folder) => {
            const qs = new URLSearchParams({ folder, limit: "200" });
            if (q) qs.set("q", q);
            return authedFetch(`/api/workspace/mail?${qs.toString()}`);
          }),
        );
        if (responses.some((r) => !r.ok)) throw new Error("search failed");
        const lists: MailMessage[] = [];
        for (const r of responses) {
          const data = await r.json();
          lists.push(...(data.items as MailMessage[]));
        }
        // server handles text scope; the advanced attribute filters
        // run over the authorized result set (server-authorized)
        let out = lists;
        if (s.from.trim()) {
          const f = s.from.trim().toLowerCase();
          out = out.filter((m) => senderName(m).toLowerCase().includes(f) || (m.fromExternal?.email ?? "").toLowerCase().includes(f));
        }
        if (s.to.trim()) {
          const t = s.to.trim().toLowerCase();
          out = out.filter((m) => m.to.some((v) => v.toLowerCase().includes(t)));
        }
        if (s.folder !== "any") out = out.filter((m) => m.folder === s.folder);
        if (s.hasAttachment) out = out.filter((m) => (m.attachments?.length ?? 0) > 0);
        if (s.unreadOnly) out = out.filter((m) => !m.read && m.folder === "inbox");
        if (s.dateFrom) out = out.filter((m) => m.ts >= Date.parse(`${s.dateFrom}T00:00:00+05:30`));
        if (s.dateTo) out = out.filter((m) => m.ts <= Date.parse(`${s.dateTo}T23:59:59+05:30`));
        out.sort((a, b) => b.ts - a.ts);

        setResults(out);
        setSearchedScope(s.scope === "all" ? "your entire authorized mailbox" : `your ${s.scope} folder`);
        setElapsed(((performance.now() - started) / 1000).toFixed(2));
        if (q && !recent.includes(q)) setRecent((r) => [q, ...r.filter((x) => x !== q)].slice(0, 5));
      } catch {
        setSearchError("Search could not reach the mail service. Nothing was searched — try again.");
        setResults(null);
      } finally {
        setSearching(false);
      }
    },
    [recent],
  );

  // debounce typing for the main query
  React.useEffect(() => {
    const t = window.setTimeout(() => void runSearch(state), 300);
    return () => window.clearTimeout(t);
  }, [state]);

  const patch = (p: Partial<SearchState>) => setState((s) => ({ ...s, ...p }));

  const activeAdvanced = state.from || state.to || state.folder !== "any" || state.hasAttachment || state.unreadOnly || state.dateFrom || state.dateTo;

  const groupBy = (list: MailMessage[]) => {
    const groups = new Map<string, MailMessage[]>();
    for (const m of list) {
      if (!groups.has(m.folder)) groups.set(m.folder, []);
      groups.get(m.folder)!.push(m);
    }
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  };

  const GROUP_LABEL: Record<string, string> = { inbox: "Inbox", sent: "Sent", drafts: "Drafts", archive: "Archive" };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Mail" }, { label: "Search" }]}
        title="Mail Search"
        description="Search your authorized mailbox — sender, subject, content and attachments. The search index respects the same permissions as the mailbox itself."
      />

      {/* Search hero */}
      <div className="qubit-card mx-auto max-w-3xl p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            role="searchbox"
            aria-label="Search your mailbox"
            placeholder="Search sender, subject or content…"
            value={state.q}
            onChange={(e) => patch({ q: e.target.value })}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-24 text-[15px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-colors focus:border-blue-300"
          />
          {state.q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => patch({ q: "" })}
              className="absolute right-16 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
          <Button size="sm" className="absolute right-1.5 top-1.5 h-9 gap-1.5" onClick={() => void runSearch(state)}>
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Search className="h-3.5 w-3.5" aria-hidden />}
            Search
          </Button>
        </div>

        {/* Scope + advanced toggle */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="qubit-segmented" role="tablist" aria-label="Search scope">
            {(
              [
                { id: "all", label: "All mail" },
                { id: "inbox", label: "Inbox" },
                { id: "sent", label: "Sent" },
                { id: "archive", label: "Archive" },
                { id: "drafts", label: "Drafts" },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={state.scope === s.id}
                onClick={() => patch({ scope: s.id })}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                  state.scope === s.id ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-slate-800",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Button
            variant={advanced || activeAdvanced ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5"
            aria-expanded={advanced}
            onClick={() => setAdvanced((v) => !v)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            Advanced filters{activeAdvanced ? " · active" : ""}
          </Button>
        </div>

        {/* Advanced — progressive disclosure */}
        {advanced && (
          <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="ms-from" className="text-xs font-medium text-slate-700">From</Label>
              <Input id="ms-from" value={state.from} onChange={(e) => patch({ from: e.target.value })} placeholder="Sender name or email" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms-to" className="text-xs font-medium text-slate-700">To</Label>
              <Input id="ms-to" value={state.to} onChange={(e) => patch({ to: e.target.value })} placeholder="Recipient" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Folder</Label>
              <Select value={state.folder} onValueChange={(v) => patch({ folder: v })}>
                <SelectTrigger className="h-9 bg-white" aria-label="Folder"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any folder</SelectItem>
                  <SelectItem value="inbox">Inbox</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="drafts">Drafts</SelectItem>
                  <SelectItem value="archive">Archive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms-date-from" className="text-xs font-medium text-slate-700">From date</Label>
              <Input id="ms-date-from" type="date" value={state.dateFrom} onChange={(e) => patch({ dateFrom: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms-date-to" className="text-xs font-medium text-slate-700">To date</Label>
              <Input id="ms-date-to" type="date" value={state.dateTo} onChange={(e) => patch({ dateTo: e.target.value })} className="h-9" />
            </div>
            <div className="flex flex-col justify-center gap-2.5 pt-1">
              <label className="flex items-center justify-between gap-3 text-xs font-medium text-slate-700">
                <span className="inline-flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5 text-slate-400" aria-hidden /> Has attachment</span>
                <Switch checked={state.hasAttachment} onCheckedChange={(v) => patch({ hasAttachment: v })} aria-label="Has attachment" />
              </label>
              <label className="flex items-center justify-between gap-3 text-xs font-medium text-slate-700">
                <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden /> Unread only</span>
                <Switch checked={state.unreadOnly} onCheckedChange={(v) => patch({ unreadOnly: v })} aria-label="Unread only" />
              </label>
            </div>
            {activeAdvanced && (
              <button
                type="button"
                onClick={() => patch({ from: "", to: "", folder: "any", hasAttachment: false, unreadOnly: false, dateFrom: "", dateTo: "" })}
                className="col-span-full inline-flex items-center gap-1 text-[11.5px] font-medium text-blue-600 hover:text-blue-800"
              >
                <X className="h-3 w-3" aria-hidden /> Clear advanced filters
              </button>
            )}
          </div>
        )}

        {/* Recent searches */}
        {recent.length > 0 && !results && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-400">Recent:</span>
            {recent.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => patch({ q: r })}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="mx-auto mt-4 max-w-4xl">
        {searchError && (
          <div className="qubit-card flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50/60 px-4 py-3" role="alert">
            <p className="text-sm font-medium text-red-700">{searchError}</p>
            <Button size="sm" variant="outline" className="h-8" onClick={() => void runSearch(state)}>
              Retry search
            </Button>
          </div>
        )}

        {searching && !results && (
          <div className="qubit-card space-y-3 p-5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
            <span className="sr-only" role="status">Searching mailbox…</span>
          </div>
        )}

        {results && !searching && (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-xs text-slate-500" aria-live="polite">
                <span className="font-semibold text-slate-800">{results.length} result{results.length === 1 ? "" : "s"}</span>
                {searchedScope && <> in {searchedScope} · {AUTHORIZED_MAIL_COUNT.toLocaleString("en-IN")} messages in scope</>}
                {elapsed && <> · {elapsed}s</>}
              </p>
              <p className="inline-flex items-center gap-1 text-[10.5px] text-slate-400">
                <ArrowUpDown className="h-3 w-3" aria-hidden /> newest first
              </p>
            </div>

            {results.length === 0 ? (
              <div className="qubit-card">
                <EmptyState
                  icon={<Filter />}
                  title="No messages match"
                  message="Try fewer words, or clear the advanced filters. You'll only ever search mail your account is authorized to see."
                  action={
                    activeAdvanced ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                        onClick={() => {
                          patch({ from: "", to: "", folder: "any", hasAttachment: false, unreadOnly: false, dateFrom: "", dateTo: "" });
                          setState((s) => ({ ...s }));
                        }}
                      >
                        Clear advanced filters
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="space-y-4">
                {groupBy(results).map(([folder, items]) => (
                  <section key={folder} aria-label={`${GROUP_LABEL[folder] ?? folder} results`}>
                    <h2 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      {GROUP_LABEL[folder] ?? folder} · {items.length}
                    </h2>
                    <div className="qubit-card overflow-hidden">
                      <div role="list">
                        {items.slice(0, 20).map((m) => (
                          <div key={m.id} role="listitem" className="relative">
                            <MailRow mail={m} variant="search" highlight={state.q.trim() || undefined} onOpen={() => setSelected(m)} />
                          </div>
                        ))}
                        {items.length > 20 && (
                          <p className="border-t border-slate-100 px-4 py-2.5 text-center text-[11.5px] text-slate-400">
                            {items.length - 20} more in {GROUP_LABEL[folder] ?? folder} — refine the search to narrow further
                          </p>
                        )}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        {!results && !searching && !searchError && (
          <div className="qubit-card mt-2 p-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="qubit-icon-tile qubit-icon-tile-accent h-12 w-12">
                <CalendarRange className="hidden" aria-hidden />
                <Mail />
              </span>
              <p className="text-sm font-semibold text-slate-900">Search across {AUTHORIZED_MAIL_COUNT.toLocaleString("en-IN")} messages</p>
              <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                Your query runs server-side over your authorized mailbox only — results can never leak another mailbox's content, and attachments are matched
                by record. Start typing above, or open the advanced filters.
              </p>
            </div>
          </div>
        )}
      </div>

      <MailDetailDrawer mail={selected} onOpenChange={(o) => !o && setSelected(null)} variant={selected?.folder === "sent" ? "sent" : "inbox"} />
    </div>
  );
}
