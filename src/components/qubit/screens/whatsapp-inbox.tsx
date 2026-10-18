"use client";

import * as React from "react";
import { FilterX, Inbox, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import { PageHeader } from "../page-header";
import { Avatar, EmptyState, FilterBar, SearchInput, StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import {
  AuditedHint,
  EntityLink,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  ScopeNote,
  relTime,
  useSalesSection,
} from "../sales/parts";

// ============================================================
// Screen 92 · WhatsApp Lead Inbox — the WhatsApp Business API
// work queue. Legitimate, consent-checked and auditable: personal
// WhatsApp accounts are never scraped. Rows are scoped server-side;
// replies only happen from the Conversation workspace (93).
// ============================================================

interface WaMessage {
  id: string;
  at: number;
  direction: "in" | "out";
  body: string;
  template?: string;
  state?: "sent" | "delivered" | "read";
}

interface WaRow {
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
  lead: { id: string; name: string; company: string; status: string; priority: string; score: number } | null;
  opportunity: { id: string; name: string; stage: string; valueCr: number } | null;
  followup: { id: string; subject: string; dueAt: number; state: string; priority: string } | null;
}

interface WhatsappPayload {
  rows: WaRow[];
  scope: "company" | "team" | "own";
  connected: boolean;
}

interface Filters {
  status: string;
  owner: string;
  query: string;
  unreadOnly: boolean;
}

const EMPTY_FILTERS: Filters = { status: "all", owner: "all", query: "", unreadOnly: false };

const WA_STATUSES = ["Open", "Pending", "Resolved"] as const;

export function WhatsappInboxScreen() {
  const { navigate, params, navKey } = useQubitNav();
  const { role } = useRole();
  const { data, loading, error, forbidden, reload } = useSalesSection<WhatsappPayload>("whatsapp");

  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);
  /** Deep-link params.filter = a leadId → pre-filter to that lead's conversation. */
  const [leadFilter, setLeadFilter] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(params.waId ?? null);

  const isManager = role === "administrator" || role === "dept-head";

  // Deep links are re-applied when the same screen is re-focused with new params (navKey).
  React.useEffect(() => {
    if (!data) return;
    if (params.waId) setSelectedId(params.waId);
    if (params.filter) setLeadFilter(params.filter);
  }, [data, navKey, params.waId, params.filter]);

  const rows = data?.rows ?? [];

  // Owner filter options derive from the loaded rows — never hardcoded.
  const ownerOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.ownerId, r.ownerName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const leadFilterName = React.useMemo(
    () => rows.find((r) => r.leadId === leadFilter || r.lead?.id === leadFilter)?.lead?.name ?? "the linked lead",
    [rows, leadFilter],
  );

  const sorted = React.useMemo(
    () =>
      [...rows].sort((a, b) => (b.unread - a.unread) || (b.lastMessageAt - a.lastMessageAt)),
    [rows],
  );

  const filtered = React.useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return sorted.filter((c) => {
      if (leadFilter && !(c.leadId === leadFilter || c.lead?.id === leadFilter)) return false;
      if (filters.status !== "all" && c.status !== filters.status) return false;
      if (filters.owner !== "all" && c.ownerId !== filters.owner) return false;
      if (filters.unreadOnly && c.unread === 0) return false;
      if (
        q &&
        ![c.contactName, c.waNumber].some((v) => v.toLowerCase().includes(q))
      )
        return false;
      return true;
    });
  }, [sorted, filters, leadFilter]);

  const hasActiveFilters =
    filters.status !== "all" || filters.owner !== "all" || filters.query.trim() !== "" || filters.unreadOnly || leadFilter !== null;

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setLeadFilter(null);
  };

  /** The context rail previews the selected conversation — or the most recent one. */
  const previewRow = React.useMemo(
    () => filtered.find((r) => r.id === selectedId) ?? sorted[0] ?? null,
    [filtered, selectedId, sorted],
  );

  const openConversation = (id: string) => navigate("whatsapp-conversation", { waId: id });

  const onRowKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openConversation(id);
    }
  };

  const preview = previewRow ? (previewRow.messages[previewRow.messages.length - 1] ?? null) : null;
  const unreadTotal = rows.reduce((n, r) => n + (r.unread > 0 ? 1 : 0), 0);

  if (forbidden) {
    return (
      <SalesGate screenName="WhatsApp Lead Inbox">
        <></>
      </SalesGate>
    );
  }

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "WhatsApp Lead Inbox" }]}
        title="WhatsApp Lead Inbox"
        description="WhatsApp Business API conversations — legitimate, consent-checked and auditable. Personal WhatsApp accounts are never scraped."
        meta={
          data && (
            <div className="flex flex-wrap items-center gap-2">
              {data.connected ? (
                <span
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                  role="status"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                  WhatsApp Business API connected
                  <span className="sr-only"> — replies enabled</span>
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
                  role="status"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                  Disconnected — replies paused, inbound still archived
                </span>
              )}
              {unreadTotal > 0 && (
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 tabular-nums">
                  {unreadTotal} unread conversation{unreadTotal === 1 ? "" : "s"}
                </span>
              )}
            </div>
          )
        }
      />

      {error && !forbidden && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={4} />}

      {data && !loading && (
        <div className="space-y-4">
          {/* Filter bar — status, owner (manager/admin only), unread toggle, search */}
          <div className="qubit-card p-4 md:p-5">
            <FilterBar
              left={
                <>
                  <Select
                    value={filters.status}
                    onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                  >
                    <SelectTrigger className="h-9 w-[150px] rounded-lg" aria-label="Filter by status">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {WA_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isManager && ownerOptions.length > 0 && (
                    <Select
                      value={filters.owner}
                      onValueChange={(v) => setFilters((f) => ({ ...f, owner: v }))}
                    >
                      <SelectTrigger className="h-9 w-[170px] rounded-lg" aria-label="Filter by owner">
                        <SelectValue placeholder="All owners" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All owners</SelectItem>
                        {ownerOptions.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600">
                    <Switch
                      checked={filters.unreadOnly}
                      onCheckedChange={(v) => setFilters((f) => ({ ...f, unreadOnly: v === true }))}
                      aria-label="Unread only"
                    />
                    Unread only
                  </label>
                  <SearchInput
                    value={filters.query}
                    onChange={(v) => setFilters((f) => ({ ...f, query: v }))}
                    placeholder="Search name or number…"
                    className="w-full sm:w-56"
                    ariaLabel="Search conversations by contact name or WhatsApp number"
                  />
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-slate-500" onClick={clearFilters}>
                      <FilterX className="h-3.5 w-3.5" aria-hidden /> Clear filters
                    </Button>
                  )}
                </>
              }
              right={
                <p className="text-xs tabular-nums text-slate-500" role="status">
                  {hasActiveFilters
                    ? `${filtered.length} of ${rows.length} conversations after filters`
                    : `${rows.length} conversation${rows.length === 1 ? "" : "s"} in scope`}
                </p>
              }
            />
            {leadFilter && (
              <div className="mt-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  Filtered to lead: {leadFilterName}
                  <button
                    type="button"
                    aria-label="Clear lead filter"
                    onClick={() => setLeadFilter(null)}
                    className="rounded-full p-0.5 text-blue-500 transition-colors hover:bg-blue-100 hover:text-blue-700"
                  >
                    ×
                  </button>
                </span>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3">
              <ScopeNote scope={data.scope} what="WhatsApp conversations" />
              <p className="text-[11px] text-slate-400">Unread conversations are sorted first.</p>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="qubit-card">
              <EmptyState
                icon={<Inbox />}
                title="No WhatsApp conversations yet"
                message="Inbound WhatsApp Business messages arrive here the moment a campaign reply is received — consent-checked, archived and auditable. Nothing has been received in your scope so far."
              />
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:items-start">
              {/* Conversation list — 2/5 on desktop, full width on mobile */}
              <div
                className="qubit-card qubit-scroll max-h-[640px] space-y-2 overflow-y-auto p-3"
                role="list"
                aria-label="WhatsApp conversations"
              >
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={<MessageCircle />}
                    title="No conversations match these filters"
                    message="Try clearing the status, owner or unread filters — or search a different name or number."
                    action={
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={clearFilters}>
                        <FilterX className="h-3.5 w-3.5" aria-hidden /> Clear all filters
                      </Button>
                    }
                  />
                ) : (
                  filtered.map((c) => {
                    const last = c.messages[c.messages.length - 1];
                    const selected = selectedId === c.id;
                    return (
                      <div
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        aria-current={selected || undefined}
                        aria-label={`Open conversation with ${c.contactName}, ${c.status}${c.unread > 0 ? `, ${c.unread} unread` : ""}`}
                        onClick={() => {
                          setSelectedId(c.id);
                          openConversation(c.id);
                        }}
                        onKeyDown={(e) => onRowKeyDown(e, c.id)}
                        className={cn(
                          "cursor-pointer rounded-xl border px-3.5 py-3 text-left outline-none transition-colors duration-150",
                          selected
                            ? "border-blue-300 bg-blue-50/60 ring-1 ring-blue-200"
                            : "border-slate-200/80 bg-white hover:border-blue-200 hover:bg-blue-50/30",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar name={c.contactName} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="min-w-0 max-w-full truncate text-[13.5px] font-medium text-slate-800">
                                {c.contactName}
                              </p>
                              {c.unread > 0 && (
                                <span className="inline-flex shrink-0 items-center rounded-full border border-blue-200 bg-blue-50 px-1.5 py-px text-[10.5px] font-semibold text-blue-700 tabular-nums">
                                  {c.unread} new
                                </span>
                              )}
                              <span className="ml-auto shrink-0 text-[11px] text-slate-400">{relTime(c.lastMessageAt)}</span>
                            </div>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-slate-500">
                              <span className="font-mono text-[11px] tabular-nums">{c.waNumber}</span>
                              <span aria-hidden>·</span>
                              <StatusBadge status={c.status} size="sm" />
                              <span aria-hidden>·</span>
                              <span>{c.ownerName}</span>
                            </p>
                            <p className="mt-1 line-clamp-1 text-[12.5px] leading-relaxed text-slate-600">
                              {last ? (last.direction === "out" ? "You: " : "") + last.body : "No messages yet"}
                            </p>
                            {(c.lead || c.account || c.opportunity) && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {c.lead && (
                                  <span
                                    className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] font-medium text-slate-600"
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  >
                                    <span className="mr-1 text-slate-400">Lead</span>
                                    <EntityLink screen="lead-detail" id={c.lead.id} label={c.lead.name} kind="lead" />
                                  </span>
                                )}
                                {c.account && (
                                  <span
                                    className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] font-medium text-slate-600"
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  >
                                    <span className="mr-1 text-slate-400">Account</span>
                                    <EntityLink screen="account-detail" id={c.account.id} label={c.account.name} kind="account" />
                                  </span>
                                )}
                                {c.opportunity && (
                                  <span
                                    className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] font-medium text-slate-600"
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  >
                                    <span className="mr-1 text-slate-400">Opp</span>
                                    <EntityLink screen="opportunity-detail" id={c.opportunity.id} label={c.opportunity.name} kind="opportunity" />
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Context rail (desktop) — selected-conversation summary + compliance posture */}
              <aside className="hidden min-w-0 space-y-4 xl:block" aria-label="Conversation context">
                {previewRow ? (
                  <div className="qubit-card p-4 md:p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {selectedId === previewRow.id ? "Selected conversation" : "Latest conversation"}
                    </p>
                    <div className="mt-3 flex items-start gap-3">
                      <Avatar name={previewRow.contactName} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-slate-900">{previewRow.contactName}</p>
                        <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">{previewRow.waNumber}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusBadge status={previewRow.status} size="sm" />
                          {previewRow.unread > 0 && (
                            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 tabular-nums">
                              {previewRow.unread} new
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {preview && (
                      <div className="mt-4 rounded-lg border border-slate-200/80 bg-slate-50 px-3.5 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          Last message · {relTime(preview.at)}
                        </p>
                        <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-slate-700">{preview.body}</p>
                      </div>
                    )}
                    <dl className="mt-4 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-400">Owner</dt>
                        <dd className="font-medium text-slate-700">{previewRow.ownerName}</dd>
                      </div>
                      {previewRow.lead && (
                        <div className="flex items-center justify-between gap-3">
                          <dt className="shrink-0 text-slate-400">Linked lead</dt>
                          <dd className="min-w-0 text-right">
                            <EntityLink screen="lead-detail" id={previewRow.lead.id} label={previewRow.lead.name} kind="lead" />
                          </dd>
                        </div>
                      )}
                      {previewRow.account && (
                        <div className="flex items-center justify-between gap-3">
                          <dt className="shrink-0 text-slate-400">Linked account</dt>
                          <dd className="min-w-0 text-right">
                            <EntityLink screen="account-detail" id={previewRow.account.id} label={previewRow.account.name} kind="account" />
                          </dd>
                        </div>
                      )}
                      {previewRow.opportunity && (
                        <div className="flex items-center justify-between gap-3">
                          <dt className="shrink-0 text-slate-400">Linked opportunity</dt>
                          <dd className="min-w-0 text-right">
                            <EntityLink screen="opportunity-detail" id={previewRow.opportunity.id} label={previewRow.opportunity.name} kind="opportunity" />
                          </dd>
                        </div>
                      )}
                      {previewRow.followup && (
                        <div className="flex items-center justify-between gap-3">
                          <dt className="shrink-0 text-slate-400">Next follow-up</dt>
                          <dd className="min-w-0 truncate text-right font-medium text-slate-700">
                            {previewRow.followup.subject} · {relTime(previewRow.followup.dueAt)}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <Button size="sm" className="mt-4 h-9 w-full gap-1.5" onClick={() => openConversation(previewRow.id)}>
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Open conversation
                    </Button>
                  </div>
                ) : null}

                <div className="qubit-card p-4 md:p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Compliance &amp; connection</p>
                  <ul className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-slate-600">
                    <li className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                      Runs on the WhatsApp Business API only — personal WhatsApp accounts are never scraped or connected.
                    </li>
                    <li className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                      Replies are consent-checked server-side before sending; a blocked reply is audited, never silently dropped.
                    </li>
                    <li className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                      Every message, assignment and link change is recorded in the enterprise audit trail.
                    </li>
                    <li className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                      If the connection drops, replies pause but inbound messages stay archived — nothing is lost.
                    </li>
                  </ul>
                  <AuditedHint>
                    The inbox covers {data.scope === "company" ? "all sales conversations" : data.scope === "team" ? "your teams' conversations" : "your own conversations"} — scoping is enforced by the server, not the interface.
                  </AuditedHint>
                </div>
              </aside>
            </div>
          )}

          <SalesAsOf asOfLabel={SALES_PERIOD.asOfLabel} note="Message bodies live in the WhatsApp Business API store; Qubit One keeps the business timeline." />
        </div>
      )}

      {!loading && !data && !error && (
        <div className="qubit-card">
          <EmptyState
            icon={<MessageCircle />}
            title="WhatsApp inbox could not load"
            message="The sales service returned no data. Retry, or check the service status."
            action={<Button size="sm" onClick={reload}>Retry</Button>}
          />
        </div>
      )}
    </div>
  );
}
