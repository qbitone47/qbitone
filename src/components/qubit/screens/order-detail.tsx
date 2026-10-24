"use client";

import * as React from "react";
import { Check, ClipboardList, IndianRupee, PackageCheck, ReceiptText, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog, Field, FormDialog } from "../dialogs";
import { PageHeader } from "../page-header";
import { EmptyState, KV, SectionCard, StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import {
  ActivityTimeline,
  EntityLink,
  fmtDateTime,
  fmtRupees,
  relTime,
  SalesApiError,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  salesPost,
  useSalesSection,
  type TimelineEntry,
} from "../sales/parts";

// ============================================================
// Screen 90 · Order Detail — the fulfillment workspace.
// Payment (Unpaid → Partially Paid → Paid) and fulfillment
// (Pending → Packed → Dispatched → Delivered) move forward only;
// the server validates every transition, assigns the dispatch
// reference when Inventory dispatches, and audits all changes.
// Server messages are toasted verbatim; 4xx surfaces inline too.
// ============================================================

interface OrderItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
}

interface OrderActivity {
  id: string;
  at: number;
  type: string;
  actorId: string;
  summary: string;
  outcome?: string;
  source?: string;
}

interface OrderRecord {
  id: string;
  number: string;
  ownerId: string;
  ownerName: string;
  status: string;
  payment: string;
  fulfillment: string;
  items: OrderItem[];
  total: number;
  createdAt: number;
  invoiceId?: string;
  dispatchId?: string;
  deliveryBy?: string;
  cancelledReason?: string;
  account: { id: string; name: string } | null;
  quotation: { id: string; number: string } | null;
  opportunity: { id: string; name: string } | null;
  activity: OrderActivity[];
}

interface OrderPayload {
  order: OrderRecord;
}

interface FormRefsPayload {
  owners: { id: string; name: string }[];
  contacts: { id: string; name: string }[];
}

const PAY_FLOW = ["Unpaid", "Partially Paid", "Paid"] as const;
const FUL_FLOW = ["Pending", "Packed", "Dispatched", "Delivered"] as const;

/** Only states the order may still move to — the server remains the enforcer. */
const forwardStates = (flow: readonly string[], current: string) => flow.slice(flow.indexOf(current) + 1);

const CANCELLABLE_STATUSES = ["Confirmed", "In Fulfillment"];

/** Same line math as the server (sales-server.ts) — display only; the server owns the document total. */
const lineTotal = (it: OrderItem) => Math.round(it.qty * it.unitPrice * (1 - it.discountPct / 100));

const msgOf = (err: unknown): string =>
  err instanceof SalesApiError ? err.message : "The sales service is unreachable right now.";

function NumberChip({ value }: { value: string }) {
  return <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[11px] font-medium text-slate-600">{value}</span>;
}

/** Quiet lifecycle strip — payment/fulfillment-shaped, like the lead lifecycle. Not the opportunity StageFlow. */
function LifecycleStrip({
  steps,
  current,
  currentTone = "blue",
  ariaLabel,
}: {
  steps: readonly string[];
  current: string;
  currentTone?: "blue" | "emerald";
  ariaLabel: string;
}) {
  const idx = steps.indexOf(current);
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label={ariaLabel}>
      {steps.map((s, i) => {
        const done = idx > i;
        const isCurrent = idx === i;
        return (
          <li key={s} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="h-px w-2.5 bg-slate-200" />}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
                isCurrent
                  ? currentTone === "emerald"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                  : done
                    ? "border-slate-200 bg-slate-50 text-slate-500"
                    : "border-slate-100 bg-white text-slate-300",
              )}
            >
              {done && <Check className="h-2.5 w-2.5" aria-hidden />}
              {s}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderDetailScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const orderId = nav.params.orderId;
  const { data, loading, error, forbidden, reload } = useSalesSection<OrderPayload>("order", { id: orderId });
  // Quiet secondary loader — resolves timeline actor names from canonical refs, never a hardcoded employee map.
  const { data: refs } = useSalesSection<FormRefsPayload>("form-refs");

  const order = data?.order ?? null;

  // ---------- update payment dialog ----------
  const [payOpen, setPayOpen] = React.useState(false);
  const [payValue, setPayValue] = React.useState("");
  const [payError, setPayError] = React.useState<string | null>(null);
  const [payBusy, setPayBusy] = React.useState(false);

  // ---------- update fulfillment dialog ----------
  const [fulOpen, setFulOpen] = React.useState(false);
  const [fulValue, setFulValue] = React.useState("");
  const [fulError, setFulError] = React.useState<string | null>(null);
  const [fulBusy, setFulBusy] = React.useState(false);

  // ---------- cancel dialog (required reason) ----------
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = React.useState(false);
  // Radix auto-closes AlertDialog on action click; swallow that close once when
  // client validation fails so the inline error stays reviewable.
  const stayOpenRef = React.useRef(false);

  const resolveActor = React.useCallback(
    (actorId: string): string | undefined =>
      refs?.owners.find((o) => o.id === actorId)?.name ??
      refs?.contacts.find((c) => c.id === actorId)?.name ??
      (actorId.startsWith("wa-") ? "Customer (WhatsApp)" : undefined),
    [refs],
  );

  const timeline: TimelineEntry[] = React.useMemo(() => {
    if (!order) return [];
    return [...order.activity]
      .sort((a, b) => b.at - a.at)
      .map((a) => ({
        id: a.id,
        at: a.at,
        type: a.type,
        summary: a.summary,
        outcome: a.outcome,
        source: a.source,
        actorName: resolveActor(a.actorId),
      }));
  }, [order, resolveActor]);

  const submitPayment = async () => {
    if (!order || !payValue) return;
    setPayBusy(true);
    setPayError(null);
    try {
      const res = await salesPost<{ ok: boolean; message?: string }>("order.update", { id: order.id, payment: payValue }, role);
      toast({ title: "Payment updated", description: res.message });
      setPayOpen(false);
      setPayValue("");
      reload();
    } catch (err) {
      // 409 invalid_transition and friends surface inline (and toasted verbatim)
      setPayError(msgOf(err));
      toast({ variant: "destructive", title: "Could not update payment", description: msgOf(err) });
    } finally {
      setPayBusy(false);
    }
  };

  const submitFulfillment = async () => {
    if (!order || !fulValue) return;
    setFulBusy(true);
    setFulError(null);
    try {
      const res = await salesPost<{ ok: boolean; message?: string; order?: { dispatchId?: string; fulfillment?: string } }>(
        "order.update",
        { id: order.id, fulfillment: fulValue },
        role,
      );
      // When fulfillment reaches Dispatched the server assigns the dispatch reference — mention it, then reload shows the chip.
      const newDispatchId = fulValue === "Dispatched" ? res.order?.dispatchId : undefined;
      toast({
        title: "Fulfillment updated",
        description: newDispatchId
          ? `${res.message ?? "Order updated."} Dispatch ${newDispatchId} assigned by Inventory.`
          : res.message,
      });
      setFulOpen(false);
      setFulValue("");
      reload();
    } catch (err) {
      setFulError(msgOf(err));
      toast({ variant: "destructive", title: "Could not update fulfillment", description: msgOf(err) });
    } finally {
      setFulBusy(false);
    }
  };

  const submitCancel = async () => {
    if (!order) return;
    if (cancelReason.trim().length < 3) {
      stayOpenRef.current = true;
      setCancelError("A reason is required to cancel an order — the server rejects the request without one.");
      return;
    }
    setCancelError(null);
    setCancelBusy(true);
    try {
      const res = await salesPost<{ ok: boolean; message?: string }>("order.cancel", { id: order.id, reason: cancelReason.trim() }, role);
      toast({ title: "Order cancelled", description: res.message });
      setCancelOpen(false);
      setCancelReason("");
      reload();
    } catch (err) {
      // 409 invalid_state (Dispatched and beyond), 403 scope_denied — keep the message reviewable, toast it verbatim too.
      setCancelError(msgOf(err));
      setCancelOpen(true);
      toast({ variant: "destructive", title: "Could not cancel the order", description: msgOf(err) });
    } finally {
      setCancelBusy(false);
    }
  };

  if (forbidden) {
    return (
      <SalesGate screenName="Order Detail">
        <></>
      </SalesGate>
    );
  }

  if (!orderId) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Order List", onClick: () => nav.navigate("order-list") }, { label: "Order Detail" }]}
          title="Order Detail"
          description="Order fulfillment view — payment, dispatch and delivery with valid transitions only."
        />
        <div className="qubit-card">
          <EmptyState
            icon={<ClipboardList />}
            title="Open an order from the Order List"
            message="Order Detail is a deep-linked workspace — pick an order in the Order List (89) and its payment, fulfillment and dispatch view opens here."
            action={
              <Button size="sm" className="h-9 gap-1.5" onClick={() => nav.navigate("order-list")}>
                <ClipboardList className="h-4 w-4" aria-hidden /> Open Order List
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Order List", onClick: () => nav.navigate("order-list") }, { label: "Order Detail" }]}
          title="Order Detail"
          description="Loading the order…"
        />
        <SalesSkeleton rows={5} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Order List", onClick: () => nav.navigate("order-list") }, { label: "Order Detail" }]}
          title="Order Detail"
          description="The order could not be opened."
        />
        {error && <SalesErrorBanner message={error} onRetry={reload} />}
        <div className="qubit-card">
          <EmptyState
            icon={<ClipboardList />}
            title="Order unavailable"
            message={
              error
                ? "The server refused or could not find this order — the message above is the server's own. Records outside your scope are intentionally indistinguishable from missing ones."
                : "The sales service returned no order for this deep link."
            }
            action={
              <Button variant="outline" size="sm" onClick={() => nav.navigate("order-list")}>
                Back to Order List
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  // ---------- derived display values ----------
  const payForward = forwardStates(PAY_FLOW, order.payment);
  const fulForward = forwardStates(FUL_FLOW, order.fulfillment);
  const isCancelled = order.status === "Cancelled";
  const canCancel = CANCELLABLE_STATUSES.includes(order.status);
  const lineItemsTotal = order.items.reduce((sum, it) => sum + lineTotal(it), 0);

  return (
    <div>
      {/* PageHeader renders only crumbs[0] as clickable and drops the last crumb — same constraint Lead/Quotation Detail documented —
          so "Order List" rides as the clickable chip crumb and the order number is the h1. */}
      <PageHeader
        crumbs={[{ label: "Order List", onClick: () => nav.navigate("order-list") }, { label: order.number }]}
        title={order.number}
        description={`${order.account?.name ?? "Unknown account"} · ${
          order.quotation ? `from quotation ${order.quotation.number}` : "direct order — no quotation on file"
        } · owned by ${order.ownerName}`}
        meta={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StatusBadge status={order.status} className={isCancelled ? "opacity-70" : undefined} />
            {isCancelled && order.cancelledReason && (
              <span className="text-xs text-slate-500">Cancelled — {order.cancelledReason}</span>
            )}
          </div>
        }
        actions={
          <>
            {payForward.length > 0 && !isCancelled && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => {
                  setPayValue("");
                  setPayError(null);
                  setPayOpen(true);
                }}
              >
                <IndianRupee className="h-3.5 w-3.5" aria-hidden /> Update payment
              </Button>
            )}
            {fulForward.length > 0 && !isCancelled && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => {
                  setFulValue("");
                  setFulError(null);
                  setFulOpen(true);
                }}
              >
                <PackageCheck className="h-3.5 w-3.5" aria-hidden /> Update fulfillment
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => {
                  setCancelReason("");
                  setCancelError(null);
                  setCancelOpen(true);
                }}
              >
                <X className="h-3.5 w-3.5" aria-hidden /> Cancel
              </Button>
            )}
            {order.invoiceId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() =>
                  toast({ title: "View invoice", description: `Invoice ${order.invoiceId} opens in the Finance module.` })
                }
              >
                <ReceiptText className="h-3.5 w-3.5" aria-hidden /> View invoice
              </Button>
            )}
            {order.dispatchId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() =>
                  toast({ title: "View dispatch", description: `Dispatch ${order.dispatchId} opens in the Inventory module.` })
                }
              >
                <Truck className="h-3.5 w-3.5" aria-hidden /> View dispatch
              </Button>
            )}
            {order.account && <EntityLink screen="account-detail" id={order.account.id} label="Contact customer" kind="account" />}
          </>
        }
      />

      <div className="space-y-4">
        {/* Headline band — the money and its cross-module references */}
        <div className="qubit-card flex flex-wrap items-center gap-x-10 gap-y-4 px-4 py-4 md:px-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Order total (incl. GST)</p>
            <p className="mt-0.5 text-[24px] font-bold leading-none tracking-tight tabular-nums text-slate-900">{fmtRupees(order.total)}</p>
          </div>
          <dl className="flex flex-wrap items-center gap-x-10 gap-y-3">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Payment</dt>
              <dd className="mt-1">
                <StatusBadge status={order.payment} size="sm" />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fulfillment</dt>
              <dd className="mt-1">
                <StatusBadge status={order.fulfillment} size="sm" />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Invoice</dt>
              <dd className="mt-0.5 flex flex-col">
                {order.invoiceId ? (
                  <>
                    <span className="w-fit rounded bg-slate-100 px-1.5 py-px font-mono text-[11px] font-medium text-slate-600">
                      {order.invoiceId}
                    </span>
                    <span className="mt-0.5 text-[10.5px] text-slate-400">Raised in Finance</span>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </dd>
            </div>
            {order.dispatchId && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Dispatch</dt>
                <dd className="mt-0.5 flex flex-col">
                  <span className="w-fit rounded bg-slate-100 px-1.5 py-px font-mono text-[11px] font-medium text-slate-600">
                    {order.dispatchId}
                  </span>
                  <span className="mt-0.5 text-[10.5px] text-slate-400">Inventory / dispatch reference</span>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {/* Left column — the document itself */}
          <div className="space-y-4">
            <SectionCard
              title="Items"
              description={`${order.items.length} line ${order.items.length === 1 ? "item" : "items"} — pricing mirrors the source quotation`}
              noPadding
            >
              <div className="qubit-scroll relative overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm" aria-label={`Line items for ${order.number}`}>
                  <thead>
                    <tr className="border-b border-slate-200/90 bg-slate-50/95 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                      <th scope="col" className="px-4 py-2.5 text-left font-semibold md:px-5">Product</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Qty</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Unit price</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Disc.</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-semibold md:px-5">Line total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.items.map((it) => (
                      <tr key={it.id}>
                        <td className="px-4 py-2.5 font-medium text-slate-800 md:px-5">{it.name}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{it.qty}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtRupees(it.unitPrice)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{it.discountPct}%</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-900 md:px-5">{fmtRupees(lineTotal(it))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50/60 text-[13px]">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right text-slate-500 md:px-5">Line items subtotal</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums text-slate-800 md:px-5">{fmtRupees(lineItemsTotal)}</td>
                    </tr>
                    <tr className="border-t border-slate-200">
                      <td colSpan={4} className="px-4 py-2.5 text-right font-semibold text-slate-700 md:px-5">Grand total (incl. GST)</td>
                      <td className="px-4 py-2.5 text-right text-[15px] font-bold tabular-nums text-slate-900 md:px-5">
                        {fmtRupees(order.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="border-t border-slate-100 px-4 py-3 text-[11px] leading-relaxed text-slate-400 md:px-5">
                Line pricing mirrors the source quotation; the grand total is the server-settled document total, not a client recomputation.
              </p>
            </SectionCard>

            <SectionCard title="Delivery & links" description="What was promised, and everything this order is connected to.">
              <dl className="divide-y divide-slate-100">
                <KV label="Delivery">
                  {order.deliveryBy?.trim() ? order.deliveryBy : <span className="text-slate-400">—</span>}
                </KV>
                <KV label="Quotation">
                  {order.quotation ? (
                    <EntityLink screen="quotation-detail" id={order.quotation.id} label={order.quotation.number} kind="quotation" />
                  ) : (
                    <span className="text-xs text-slate-400">Direct order — no quotation on file</span>
                  )}
                </KV>
                <KV label="Opportunity">
                  {order.opportunity ? (
                    <EntityLink screen="opportunity-detail" id={order.opportunity.id} label={order.opportunity.name} kind="opportunity" />
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </KV>
                <KV label="Account">
                  {order.account ? (
                    <EntityLink screen="account-detail" id={order.account.id} label={order.account.name} kind="account" />
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </KV>
                <KV label="Owner">{order.ownerName}</KV>
                <KV label="Created">
                  <span className="tabular-nums">
                    {fmtDateTime(order.createdAt)} · {relTime(order.createdAt)}
                  </span>
                </KV>
              </dl>
            </SectionCard>
          </div>

          {/* Right column — lifecycle and trail */}
          <div className="space-y-4">
            <SectionCard
              title="Lifecycle"
              description="Payment and fulfillment move forward only — every transition is validated and audited on the server."
            >
              <div className="space-y-4">
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Payment</p>
                  <LifecycleStrip
                    steps={PAY_FLOW}
                    current={order.payment}
                    currentTone={order.payment === "Paid" ? "emerald" : "blue"}
                    ariaLabel={`Payment lifecycle: ${order.payment}`}
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fulfillment</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <LifecycleStrip
                      steps={FUL_FLOW}
                      current={order.fulfillment}
                      currentTone={order.fulfillment === "Delivered" ? "emerald" : "blue"}
                      ariaLabel={`Fulfillment lifecycle: ${order.fulfillment}`}
                    />
                    {isCancelled && (
                      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-medium text-red-700">
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>
                {isCancelled && order.cancelledReason && (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-700">
                    <span className="font-semibold text-slate-800">Cancellation reason:</span> {order.cancelledReason}
                  </p>
                )}
                {!isCancelled && canCancel && (
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Cancellation is available until dispatch — once an order is dispatched or beyond, the server rejects cancellation and the
                    reason is moot.
                  </p>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Activity" description="Order status changes are recorded by the server and written to the audit trail.">
              <ActivityTimeline
                entries={timeline}
                emptyMessage="No activity recorded yet — creation, payment and fulfillment changes will appear here."
              />
            </SectionCard>
          </div>
        </div>

        <SalesAsOf
          asOfLabel={SALES_PERIOD.asOfLabel}
          note="Invoice references belong to Finance and dispatch references to Inventory — shown here, owned there."
        />
      </div>

      {/* Update payment — forward-only Select (server 409 invalid_transition mirrors this and surfaces inline) */}
      <FormDialog
        open={payOpen}
        onOpenChange={(o) => {
          setPayOpen(o);
          if (!o) setPayError(null);
        }}
        title={`Update payment — ${order.number}`}
        description="Forward only: Unpaid → Partially Paid → Paid. The transition is validated and audited on the server; Finance sees the same state."
        submitLabel={payBusy ? "Updating…" : "Update payment"}
        submitting={payBusy}
        onSubmit={submitPayment}
      >
        <Field label="Payment state" required hint="States already passed are not offered — payment cannot move backwards.">
          <Select
            value={payValue}
            onValueChange={(v) => {
              setPayValue(v);
              if (payError) setPayError(null);
            }}
          >
            <SelectTrigger className="bg-white" aria-label="Choose the next payment state">
              <SelectValue placeholder="Choose the next state…" />
            </SelectTrigger>
            <SelectContent>
              {payForward.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {payError && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {payError}
          </p>
        )}
      </FormDialog>

      {/* Update fulfillment — forward-only Select; Dispatched assigns the dispatch reference server-side */}
      <FormDialog
        open={fulOpen}
        onOpenChange={(o) => {
          setFulOpen(o);
          if (!o) setFulError(null);
        }}
        title={`Update fulfillment — ${order.number}`}
        description="Forward only: Pending → Packed → Dispatched → Delivered. Reaching Dispatched assigns the dispatch reference from Inventory; Delivered closes the order when payment is settled."
        submitLabel={fulBusy ? "Updating…" : "Update fulfillment"}
        submitting={fulBusy}
        onSubmit={submitFulfillment}
      >
        <Field label="Fulfillment state" required hint="States already passed are not offered — fulfillment cannot move backwards.">
          <Select
            value={fulValue}
            onValueChange={(v) => {
              setFulValue(v);
              if (fulError) setFulError(null);
            }}
          >
            <SelectTrigger className="bg-white" aria-label="Choose the next fulfillment state">
              <SelectValue placeholder="Choose the next state…" />
            </SelectTrigger>
            <SelectContent>
              {fulForward.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {fulError && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {fulError}
          </p>
        )}
      </FormDialog>

      {/* Cancel — destructive, reason required (server 422 reason_required mirrors this; 409 for Dispatched+ surfaces verbatim) */}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={(o) => {
          if (!o && stayOpenRef.current) {
            stayOpenRef.current = false;
            return;
          }
          if (!o) setCancelError(null);
          setCancelOpen(o);
        }}
        title={`Cancel ${order.number}?`}
        description="Cancelled orders cannot be reopened. The reason is recorded on the document, Finance and Inventory are notified through the workflow layer, and the action is written to the audit trail."
        confirmLabel={cancelBusy ? "Cancelling…" : "Cancel order"}
        destructive
        onConfirm={submitCancel}
      >
        <div className="space-y-1.5">
          <label htmlFor="order-cancel-reason" className="block text-xs font-medium text-slate-700">
            Reason
            <span className="ml-0.5 text-red-500" aria-hidden>
              *
            </span>
          </label>
          <Input
            id="order-cancel-reason"
            value={cancelReason}
            onChange={(e) => {
              setCancelReason(e.target.value);
              if (cancelError) setCancelError(null);
            }}
            placeholder="e.g. Customer deferred the rollout to Q4 — revised quotation to follow"
            aria-invalid={Boolean(cancelError)}
          />
          {cancelError && (
            <p role="alert" className="text-[11.5px] font-medium text-red-600">
              {cancelError}
            </p>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}
