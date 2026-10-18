"use client";

import * as React from "react";
import { FileText, Handshake, PenLine, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "../page-header";
import { DataTable, type Column } from "../data-table";
import { EmptyState, FilterBar, SearchInput, StatTile, StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import {
  EntityLink,
  fmtRupees,
  relTime,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  ScopeNote,
  useSalesSection,
} from "../sales/parts";

// ============================================================
// Screen 86 · Quotation List — every quotation from draft to
// accepted. Discount rules run on the server; approvals route
// through the enterprise Approval Matrix (screen 09) and their
// decisions appear in My Approvals (46). This screen renders the
// server's honest states — it never guesses lifecycle or money.
// ============================================================

interface QuotationRow {
  id: string;
  number: string;
  accountId: string;
  opportunityId?: string;
  ownerId: string;
  ownerName: string;
  status: string;
  createdAt: number;
  validUntil: string;
  taxPct: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  overallDiscountPct: number;
  versions: { at: number; by: string; note: string }[];
  account: { id: string; name: string } | null;
  opportunity: { id: string; name: string } | null;
}

interface QuotationsPayload {
  rows: QuotationRow[];
  scope: "company" | "team" | "own";
}

const QUOTATION_STATUSES = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Sent",
  "Viewed",
  "Negotiation",
  "Accepted",
  "Rejected",
  "Expired",
  "Cancelled",
] as const;

const STATUS_ORDER: Record<string, number> = {
  Draft: 0,
  "Pending Approval": 1,
  Approved: 2,
  Sent: 3,
  Viewed: 4,
  Negotiation: 5,
  Accepted: 6,
  Rejected: 7,
  Expired: 8,
  Cancelled: 9,
};

/** Terminal, non-celebratory documents render muted — still dot+label, never color-only. */
const MUTED_STATUSES = new Set(["Expired", "Rejected", "Cancelled"]);

function NumberChip({ value }: { value: string }) {
  return <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[11px] font-medium text-slate-600">{value}</span>;
}

export function QuotationListScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { data, loading, error, forbidden, reload } = useSalesSection<QuotationsPayload>("quotations");

  const isManager = role === "administrator" || role === "dept-head";
  const rows = data?.rows ?? [];

  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [owner, setOwner] = React.useState("all");

  // Owner options derive from the scoped rows themselves — the server already
  // filtered the list to what this boundary may see.
  const owners = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const q of rows) if (!seen.has(q.ownerId)) seen.set(q.ownerId, q.ownerName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (owner !== "all" && r.ownerId !== owner) return false;
      if (q && ![r.number, r.account?.name ?? ""].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, status, owner, query]);

  const draftPending = rows.filter((r) => r.status === "Draft" || r.status === "Pending Approval").length;
  const inFlight = rows.filter((r) => ["Approved", "Sent", "Viewed", "Negotiation"].includes(r.status)).length;
  const acceptedValue = rows.filter((r) => r.status === "Accepted").reduce((sum, r) => sum + r.total, 0);

  const hasFilters = status !== "all" || owner !== "all" || query.trim() !== "";
  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setOwner("all");
  };

  const openQuotation = (q: QuotationRow) => nav.navigate("quotation-detail", { quotationId: q.id });

  if (forbidden) {
    return (
      <SalesGate screenName="Quotation List">
        <></>
      </SalesGate>
    );
  }

  const columns: Column<QuotationRow>[] = [
    {
      key: "number",
      header: "Quote",
      sortable: true,
      sortValue: (q) => q.number,
      render: (q) => <NumberChip value={q.number} />,
    },
    {
      key: "customer",
      header: "Customer",
      minWidth: 150,
      render: (q) =>
        q.account ? (
          <span onClick={(e) => e.stopPropagation()}>
            <EntityLink screen="account-detail" id={q.account.id} label={q.account.name} kind="account" />
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "opportunity",
      header: "Opportunity",
      minWidth: 170,
      hideBelow: "lg",
      render: (q) =>
        q.opportunity ? (
          <span onClick={(e) => e.stopPropagation()}>
            <EntityLink screen="opportunity-detail" id={q.opportunity.id} label={q.opportunity.name} kind="opportunity" />
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "owner",
      header: "Owner",
      hideBelow: "lg",
      render: (q) => <span className="whitespace-nowrap text-[13px] text-slate-600">{q.ownerName}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      sortValue: (q) => q.total,
      render: (q) => <span className="font-semibold tabular-nums text-slate-900">{fmtRupees(q.total)}</span>,
    },
    {
      key: "discount",
      header: "Disc.",
      sortable: true,
      sortValue: (q) => q.overallDiscountPct,
      render: (q) =>
        q.overallDiscountPct > 15 ? (
          <span className="inline-flex items-center whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-amber-700">
            {q.overallDiscountPct}% · &gt;15%
          </span>
        ) : (
          <span className="tabular-nums text-slate-600">{q.overallDiscountPct}%</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (q) => STATUS_ORDER[q.status] ?? 99,
      render: (q) => <StatusBadge status={q.status} size="sm" className={MUTED_STATUSES.has(q.status) ? "opacity-70" : undefined} />,
    },
    {
      key: "validity",
      header: "Valid until",
      hideBelow: "lg",
      render: (q) => <span className="whitespace-nowrap text-[13px] tabular-nums text-slate-600">{q.validUntil}</span>,
    },
    {
      key: "created",
      header: "Created",
      hideBelow: "xl",
      render: (q) => <span className="whitespace-nowrap text-xs text-slate-400">{relTime(q.createdAt)}</span>,
    },
    {
      key: "updated",
      header: "Updated",
      hideBelow: "xl",
      render: (q) => <span className="whitespace-nowrap text-xs text-slate-400">{relTime(q.versions[0]?.at ?? q.createdAt)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Quotation List" }]}
        title="Quotation List"
        description="Every quotation from draft to accepted. Discount rules run on the server — approvals route through the enterprise Approval Matrix (screen 09), decisions appear in My Approvals (46)."
        actions={
          <Button size="sm" className="h-9 gap-1.5" onClick={() => nav.navigate("quotation-builder")}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> New quotation
          </Button>
        }
      />

      {error && !forbidden && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={4} />}

      {data && !loading && (
        <div className="space-y-3">
          {/* Summary band — four honest counters over the scoped rows */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={<FileText />} value={String(rows.length)} label="Quotations in your scope" />
            <StatTile icon={<PenLine />} value={String(draftPending)} label="Draft + pending approval" />
            <StatTile icon={<Send />} value={String(inFlight)} label="In flight — approved to negotiation" />
            <StatTile icon={<Handshake />} value={fmtRupees(acceptedValue)} label="Accepted value incl. GST" />
          </div>

          {/* Filters — status for everyone; owner for manager boundaries (sales-exec is already own-scoped server-side) */}
          <FilterBar
            left={
              <>
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Search number or account…"
                  className="w-full sm:w-64"
                  ariaLabel="Search quotations by number or account"
                />
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-10 w-[11rem] bg-white" aria-label="Filter by status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {QUOTATION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isManager && (
                  <Select value={owner} onValueChange={setOwner}>
                    <SelectTrigger className="h-10 w-[11rem] bg-white" aria-label="Filter by owner">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any owner</SelectItem>
                      {owners.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </>
            }
            right={
              hasFilters ? (
                <p className="text-xs text-slate-500" aria-live="polite">
                  <span className="font-semibold tabular-nums text-slate-700">{filtered.length}</span> of{" "}
                  <span className="font-semibold tabular-nums text-slate-700">{rows.length}</span> quotations in scope after filters
                </p>
              ) : undefined
            }
          />

          {/* Table / empty state */}
          {filtered.length === 0 ? (
            <div className="qubit-card">
              <EmptyState
                icon={<FileText />}
                title={rows.length === 0 ? "No quotations in your scope yet" : "No quotations match these filters"}
                message={
                  rows.length === 0
                    ? "Build the first one in the Quotation Builder — pricing pulls from the product catalog and discount rules run on the server."
                    : "Adjust or clear the filters to see the rest of the pipeline."
                }
                action={
                  rows.length === 0 ? (
                    <Button size="sm" className="h-9 gap-1.5" onClick={() => nav.navigate("quotation-builder")}>
                      <Plus className="h-4 w-4" aria-hidden /> New quotation
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear all filters
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(q) => q.id}
              onRowClick={openQuotation}
              pageSize={10}
              caption="Quotation list — documents in your authorized scope"
              mobileCard={(q) => (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <NumberChip value={q.number} />
                    <StatusBadge status={q.status} size="sm" className={MUTED_STATUSES.has(q.status) ? "opacity-70" : undefined} />
                  </div>
                  <p className="truncate text-[13.5px] font-medium text-slate-900">{q.account?.name ?? "—"}</p>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="min-w-0 truncate">
                      {q.ownerName} · updated {relTime(q.versions[0]?.at ?? q.createdAt)}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{fmtRupees(q.total)}</span>
                  </div>
                </div>
              )}
            />
          )}

          {/* Honest scope + lifecycle notes */}
          <div className="space-y-1 pt-1">
            <ScopeNote scope={data.scope} what="quotations" />
            <p className="text-[11px] text-slate-400">
              Approval and lifecycle transitions are enforced on the server and audited — Expired, Rejected and Cancelled documents stay muted for
              scanning. Accepted quotations convert to orders from their detail record.
            </p>
          </div>

          <SalesAsOf
            asOfLabel={SALES_PERIOD.asOfLabel}
            note="Updated reflects the latest server-recorded version per document."
          />
        </div>
      )}

      {!loading && !data && !error && (
        <EmptyState
          icon={<FileText />}
          title="Quotation List could not load"
          message="The sales service returned no data. Retry, or check the service status."
          action={
            <Button size="sm" onClick={reload}>
              Retry
            </Button>
          }
        />
      )}
    </div>
  );
}
