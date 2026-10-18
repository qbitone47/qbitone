"use client";

import * as React from "react";
import { Ban, CheckCircle2, ClipboardList, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "../page-header";
import { DataTable, type Column } from "../data-table";
import { ArrowLink, EmptyState, FilterBar, SearchInput, StatTile, StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
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
// Screen 89 · Order List — sales orders connected end-to-end.
// Invoices are raised in Finance, fulfillment is requested from
// Inventory and dispatch is tracked to delivery — every record
// carries its cross-module references, so no order data is
// disconnected. Orders are created from Accepted quotations;
// this screen renders the server's honest states only.
// ============================================================

interface OrderRow {
  id: string;
  number: string;
  quotationId?: string;
  ownerId: string;
  ownerName: string;
  status: string;
  payment: string;
  fulfillment: string;
  total: number;
  createdAt: number;
  account: { id: string; name: string } | null;
  quotation: { id: string; number: string } | null;
}

interface OrdersPayload {
  rows: OrderRow[];
  scope: "company" | "team" | "own";
}

const ORDER_STATUSES = ["Confirmed", "In Fulfillment", "Dispatched", "Delivered", "Closed", "Cancelled"] as const;
const PAYMENT_STATES = ["Unpaid", "Partially Paid", "Paid"] as const;

const STATUS_ORDER: Record<string, number> = {
  Confirmed: 0,
  "In Fulfillment": 1,
  Dispatched: 2,
  Delivered: 3,
  Closed: 4,
  Cancelled: 5,
};

/** Terminal, non-celebratory documents render muted — still dot+label, never color-only. */
const isMutedStatus = (status: string) => status === "Cancelled";

function NumberChip({ value }: { value: string }) {
  return <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[11px] font-medium text-slate-600">{value}</span>;
}

function DocLinkChip({ id, number }: { id: string; number: string }) {
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <EntityLink
        screen="quotation-detail"
        id={id}
        label={<span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[11px] font-medium text-slate-600">{number}</span>}
        kind="quotation"
      />
    </span>
  );
}

export function OrderListScreen() {
  const nav = useQubitNav();
  const { data, loading, error, forbidden, scope, reload } = useSalesSection<OrdersPayload>("orders");

  const rows = data?.rows ?? [];

  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [payment, setPayment] = React.useState("all");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (payment !== "all" && o.payment !== payment) return false;
      if (q && ![o.number, o.account?.name ?? ""].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, status, payment, query]);

  // Summary band — four honest counters over the scoped rows (never the company aggregate)
  const inFulfillment = rows.filter((o) => o.status === "Confirmed" || o.status === "In Fulfillment").length;
  const deliveredClosed = rows.filter((o) => o.status === "Delivered" || o.status === "Closed").length;
  const cancelled = rows.filter((o) => o.status === "Cancelled").length;

  const hasFilters = status !== "all" || payment !== "all" || query.trim() !== "";
  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setPayment("all");
  };

  const openOrder = (o: OrderRow) => nav.navigate("order-detail", { orderId: o.id });

  if (forbidden) {
    return (
      <SalesGate screenName="Order List">
        <></>
      </SalesGate>
    );
  }

  const columns: Column<OrderRow>[] = [
    {
      key: "number",
      header: "Order",
      sortable: true,
      sortValue: (o) => o.number,
      render: (o) => <NumberChip value={o.number} />,
    },
    {
      key: "customer",
      header: "Customer",
      minWidth: 150,
      render: (o) =>
        o.account ? (
          <span onClick={(e) => e.stopPropagation()}>
            <EntityLink screen="account-detail" id={o.account.id} label={o.account.name} kind="account" />
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "quotation",
      header: "Quotation",
      minWidth: 130,
      render: (o) =>
        o.quotation ? (
          <DocLinkChip id={o.quotation.id} number={o.quotation.number} />
        ) : (
          <span className="text-xs text-slate-400">Direct</span>
        ),
    },
    {
      key: "owner",
      header: "Owner",
      hideBelow: "lg",
      render: (o) => <span className="whitespace-nowrap text-[13px] text-slate-600">{o.ownerName}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      sortValue: (o) => o.total,
      render: (o) => <span className="font-semibold tabular-nums text-slate-900">{fmtRupees(o.total)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (o) => STATUS_ORDER[o.status] ?? 99,
      render: (o) => <StatusBadge status={o.status} size="sm" className={isMutedStatus(o.status) ? "opacity-70" : undefined} />,
    },
    {
      key: "payment",
      header: "Payment",
      render: (o) => <StatusBadge status={o.payment} size="sm" />,
    },
    {
      key: "fulfillment",
      header: "Fulfillment",
      hideBelow: "sm",
      render: (o) => <StatusBadge status={o.fulfillment} size="sm" />,
    },
    {
      key: "created",
      header: "Created",
      sortable: true,
      sortValue: (o) => o.createdAt,
      hideBelow: "xl",
      render: (o) => <span className="whitespace-nowrap text-xs text-slate-400">{relTime(o.createdAt)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Order List" }]}
        title="Order List"
        description="Sales orders connected end-to-end — invoices raised in Finance, fulfillment requested from Inventory, dispatch tracked to delivery. No disconnected order data."
        actions={
          <ArrowLink
            onClick={() => nav.navigate("quotation-list", { filter: "Accepted" })}
            ariaLabel="Open the Quotation List to create an order from an accepted quotation"
          >
            Create from an accepted quotation
          </ArrowLink>
        }
      />

      {error && !forbidden && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={4} />}

      {data && !loading && (
        <div className="space-y-3">
          {/* Summary band */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={<ClipboardList />} value={String(rows.length)} label="Orders in your scope" />
            <StatTile icon={<PackageSearch />} value={String(inFulfillment)} label="In fulfillment — confirmed + in progress" />
            <StatTile icon={<CheckCircle2 />} value={String(deliveredClosed)} label="Delivered / closed" />
            <StatTile icon={<Ban />} value={String(cancelled)} label="Cancelled" />
          </div>

          {/* Filters — status + payment selects, search across number and customer */}
          <FilterBar
            left={
              <>
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Search number or customer…"
                  className="w-full sm:w-64"
                  ariaLabel="Search orders by number or customer"
                />
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-10 w-[11rem] bg-white" aria-label="Filter by order status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {ORDER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={payment} onValueChange={setPayment}>
                  <SelectTrigger className="h-10 w-[11.5rem] bg-white" aria-label="Filter by payment state">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any payment state</SelectItem>
                    {PAYMENT_STATES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            }
            right={
              hasFilters ? (
                <p className="text-xs text-slate-500" aria-live="polite">
                  <span className="font-semibold tabular-nums text-slate-700">{filtered.length}</span> of{" "}
                  <span className="font-semibold tabular-nums text-slate-700">{rows.length}</span> orders in scope after filters
                </p>
              ) : undefined
            }
          />

          {/* Table / empty state */}
          {filtered.length === 0 ? (
            <div className="qubit-card">
              <EmptyState
                icon={<ClipboardList />}
                title={rows.length === 0 ? "No orders in your scope yet" : "No orders match these filters"}
                message={
                  rows.length === 0
                    ? "Orders are created from Accepted quotations — open the Quotation List, filter to Accepted and create the order from the document itself."
                    : "Adjust or clear the filters — fulfillment states and payment states move forward only, so older orders keep their history."
                }
                action={
                  rows.length === 0 ? (
                    <ArrowLink
                      onClick={() => nav.navigate("quotation-list", { filter: "Accepted" })}
                      ariaLabel="Open the Quotation List to create an order from an accepted quotation"
                    >
                      Open the Quotation List
                    </ArrowLink>
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
              rowKey={(o) => o.id}
              onRowClick={openOrder}
              pageSize={10}
              caption="Order list — records in your authorized scope with their Finance and Inventory references"
              mobileCard={(o) => (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <NumberChip value={o.number} />
                    <StatusBadge status={o.status} size="sm" className={isMutedStatus(o.status) ? "opacity-70" : undefined} />
                  </div>
                  <p className="truncate text-[13.5px] font-medium text-slate-900">{o.account?.name ?? "—"}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={o.payment} size="sm" />
                    <StatusBadge status={o.fulfillment} size="sm" />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="min-w-0 truncate">
                      {o.ownerName} · created {relTime(o.createdAt)}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{fmtRupees(o.total)}</span>
                  </div>
                </div>
              )}
            />
          )}

          {/* Honest scope + lifecycle notes */}
          <div className="space-y-1 pt-1">
            <ScopeNote scope={scope} what="orders" />
            <p className="text-[11px] text-slate-400">
              Orders are created from Accepted quotations — the header link opens the Quotation List carrying an Accepted filter hint. Invoices
              (Finance) and dispatch references (Inventory) live on each record; fulfillment moves forward only and every transition is enforced
              and audited on the server.
            </p>
          </div>

          <SalesAsOf asOfLabel={SALES_PERIOD.asOfLabel} note="Payment and fulfillment states are server-recorded — this view never derives state on its own." />
        </div>
      )}

      {!loading && !data && !error && (
        <EmptyState
          icon={<ClipboardList />}
          title="Order List could not load"
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
