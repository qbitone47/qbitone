"use client";

import * as React from "react";
import {
  ArrowUpRight,
  Ban,
  Check,
  Copy,
  FileText,
  Pencil,
  Send,
  ShoppingCart,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog, Field, FormDialog, StepUpDialog } from "../dialogs";
import { PageHeader } from "../page-header";
import { ArrowLink, EmptyState, KV, SectionCard, StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import {
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
} from "../sales/parts";

// ============================================================
// Screen 88 · Quotation Detail — the document lifecycle view.
// Items, terms, approval trail and versions, plus state-aware
// actions: every mutation calls salesPost and the server's own
// message is toasted verbatim; 4xx errors (locked, invalid_state,
// reason_required, step_up_required…) surface inline as well.
// ============================================================

interface QuoteItem {
  id: string;
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
}

interface QuoteVersion {
  at: number;
  by: string;
  note: string;
}

interface QuotationRecord {
  id: string;
  number: string;
  accountId: string;
  ownerId: string;
  ownerName: string;
  status: string;
  createdAt: number;
  validUntil: string;
  items: QuoteItem[];
  taxPct: number;
  paymentTerms: string;
  deliveryTerms: string;
  notes?: string;
  approvalId?: string;
  approvalNote?: string;
  sentAt?: number;
  viewedAt?: number;
  decidedAt?: number;
  versions: QuoteVersion[];
  subtotal: number;
  taxAmount: number;
  total: number;
  overallDiscountPct: number;
  account: { id: string; name: string } | null;
  contact: { id: string; name: string; designation: string } | null;
  opportunity: { id: string; name: string } | null;
  order: { id: string; number: string } | null;
}

interface QuotationPayload {
  quotation: QuotationRecord;
  scope: "company" | "team" | "own";
}

/** Same math as the server (sales-server.ts) — display only; the server owns pricing. */
const lineTotal = (it: QuoteItem) => Math.round(it.qty * it.unitPrice * (1 - it.discountPct / 100));

const CANCELLABLE = ["Draft", "Pending Approval", "Approved", "Sent", "Viewed", "Negotiation"];

const STATUS_EXPLAIN: Record<string, string> = {
  Draft: "Draft — edit freely, then submit for approval. Discount and value rules are checked on the server.",
  "Pending Approval": "Awaiting approval — routed by the Approval Matrix.",
  Approved: "Approved and ready to send to the customer.",
  Sent: "Sent — waiting for the customer to open the document.",
  Viewed: "The customer has opened the quotation — follow up while it is fresh.",
  Negotiation: "In commercial negotiation — record outcomes on the opportunity, or revise the document when terms change.",
  Accepted: "Accepted by the customer — create the sales order to raise the invoice in Finance and request fulfillment from Inventory.",
  Rejected: "Rejected — the approval note and version trail below record what happens next.",
  Expired: "Expired unaccepted — revise to open a fresh version if the customer re-engages.",
  Cancelled: "Cancelled — the reason is recorded in the notes and version history.",
};

const msgOf = (err: unknown): string =>
  err instanceof SalesApiError ? err.message : "The sales service is unreachable right now.";

export function QuotationDetailScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const quotationId = nav.params.quotationId;
  const { data, loading, error, forbidden, reload } = useSalesSection<QuotationPayload>("quotation", { id: quotationId });

  const q = data?.quotation ?? null;
  const canDecide = role === "administrator" || role === "dept-head";

  // ---------- header action state ----------
  const [busy, setBusy] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // ---------- step-up approval (total > ₹1 Cr) ----------
  const [stepUpOpen, setStepUpOpen] = React.useState(false);

  // ---------- reject dialog ----------
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectNote, setRejectNote] = React.useState("");
  const [rejectError, setRejectError] = React.useState<string | null>(null);
  const [rejectBusy, setRejectBusy] = React.useState(false);

  // ---------- cancel dialog (required reason) ----------
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = React.useState(false);
  // Radix auto-closes AlertDialog on action click; swallow that close once when
  // client validation fails so the inline error stays reviewable.
  const stayOpenRef = React.useRef(false);

  const runAction = async (
    type: string,
    input: Record<string, unknown>,
    okTitle: string,
    onOk?: (res: { message?: string; quotation?: { id: string }; order?: { id: string } }) => void,
  ) => {
    if (!q) return;
    setBusy(type);
    setActionError(null);
    try {
      const res = await salesPost<{ ok: boolean; message?: string; quotation?: { id: string }; order?: { id: string } }>(type, input, role);
      toast({ title: okTitle, description: res.message });
      onOk?.(res);
    } catch (err) {
      setActionError(msgOf(err));
      toast({ variant: "destructive", title: okTitle + " failed", description: msgOf(err) });
    } finally {
      setBusy(null);
    }
  };

  const approve = async (stepUpPassword?: string) => {
    if (!q) return;
    setBusy("quotation.decide");
    setActionError(null);
    try {
      const res = await salesPost<{ ok: boolean; message?: string }>(
        "quotation.decide",
        stepUpPassword ? { id: q.id, decision: "Approved", stepUpPassword } : { id: q.id, decision: "Approved" },
        role,
      );
      toast({ title: "Approval recorded", description: res.message });
      setStepUpOpen(false);
      reload();
    } catch (err) {
      if (err instanceof SalesApiError && err.status === 401 && err.code === "step_up_required") {
        // Decisions above ₹1 Cr require reauthentication — open the shared StepUpDialog and resubmit with the password.
        setStepUpOpen(true);
        toast({ title: "Reauthentication required", description: err.message });
      } else {
        setStepUpOpen(false);
        setActionError(msgOf(err));
        toast({ variant: "destructive", title: "Could not record the approval", description: msgOf(err) });
      }
    } finally {
      setBusy(null);
    }
  };

  const submitReject = async () => {
    if (!q) return;
    if (rejectNote.trim().length < 3) {
      setRejectError("A reason is required when rejecting — it goes back to the owner.");
      return;
    }
    setRejectBusy(true);
    setRejectError(null);
    try {
      const res = await salesPost<{ ok: boolean; message?: string }>(
        "quotation.decide",
        { id: q.id, decision: "Rejected", note: rejectNote.trim() },
        role,
      );
      toast({ title: "Quotation rejected", description: res.message });
      setRejectOpen(false);
      reload();
    } catch (err) {
      setRejectError(msgOf(err));
    } finally {
      setRejectBusy(false);
    }
  };

  const submitCancel = async () => {
    if (!q) return;
    if (cancelReason.trim().length < 3) {
      stayOpenRef.current = true;
      setCancelError("A reason is required to cancel a quotation — the server rejects the request without one.");
      return;
    }
    setCancelError(null);
    setCancelBusy(true);
    try {
      const res = await salesPost<{ ok: boolean; message?: string }>("quotation.cancel", { id: q.id, reason: cancelReason.trim() }, role);
      toast({ title: "Quotation cancelled", description: res.message });
      setCancelOpen(false);
      setCancelReason("");
      reload();
    } catch (err) {
      // 409 locked / invalid_state, 403 scope_denied — reopen so the message stays reviewable, toast it verbatim too.
      setCancelError(msgOf(err));
      setCancelOpen(true);
      toast({ variant: "destructive", title: "Could not cancel the quotation", description: msgOf(err) });
    } finally {
      setCancelBusy(false);
    }
  };

  if (forbidden) {
    return (
      <SalesGate screenName="Quotation Detail">
        <></>
      </SalesGate>
    );
  }

  if (!quotationId) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Sales" }, { label: "Quotation Detail" }]}
          title="Quotation Detail"
          description="Quotation lifecycle view — items, approvals, versions and state-aware actions."
        />
        <div className="qubit-card">
          <EmptyState
            icon={<FileText />}
            title="Open a quotation from the Quotation List"
            message="Quotation Detail is a deep-linked workspace — pick a document in the Quotation List (86) and its full lifecycle view opens here."
            action={
              <Button size="sm" className="h-9 gap-1.5" onClick={() => nav.navigate("quotation-list")}>
                <FileText className="h-4 w-4" aria-hidden /> Open Quotation List
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
          crumbs={[{ label: "Sales" }, { label: "Quotation Detail" }]}
          title="Quotation Detail"
          description="Loading the quotation…"
        />
        <SalesSkeleton rows={5} />
      </div>
    );
  }

  if (error || !q) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Sales" }, { label: "Quotation Detail" }]}
          title="Quotation Detail"
          description="The quotation could not be opened."
        />
        {error && <SalesErrorBanner message={error} onRetry={reload} />}
        <div className="qubit-card">
          <EmptyState
            icon={<FileText />}
            title="Quotation unavailable"
            message={
              error
                ? "The server refused or could not find this document — the message above is the server's own. Records outside your scope are intentionally indistinguishable from missing ones."
                : "The sales service returned no quotation for this deep link."
            }
            action={
              <Button variant="outline" size="sm" onClick={() => nav.navigate("quotation-list")}>
                Back to Quotation List
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  // ---------- derived display values ----------
  const gross = q.items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
  const discountAmount = Math.round(gross - q.subtotal);
  const highDiscount = q.overallDiscountPct > 15;
  const cancellable = CANCELLABLE.includes(q.status);
  const isDraft = q.status === "Draft";
  const isPending = q.status === "Pending Approval";
  const isApproved = q.status === "Approved";
  const isActiveNegotiation = ["Sent", "Viewed", "Negotiation"].includes(q.status);
  const isAccepted = q.status === "Accepted";

  return (
    <div>
      {/* Clickable "Quotation List" rides as the chip crumb: PageHeader only makes crumbs[0] clickable and renders the h1 as the current page — same pattern as Lead Detail (75). */}
      <PageHeader
        crumbs={[{ label: "Quotation List", onClick: () => nav.navigate("quotation-list") }, { label: q.number }]}
        title={q.number}
        description={`${q.account?.name ?? "Unknown account"} · ${q.opportunity?.name ?? "No linked opportunity"} · owned by ${q.ownerName}`}
        meta={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StatusBadge status={q.status} />
            <span className="text-xs text-slate-500">{STATUS_EXPLAIN[q.status] ?? ""}</span>
          </div>
        }
        actions={
          <>
            {isDraft && (
              <>
                <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => nav.navigate("quotation-builder", { quotationId: q.id })}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit draft
                </Button>
                <Button
                  size="sm"
                  className="h-9 gap-1.5"
                  disabled={busy === "quotation.submit"}
                  onClick={() => void runAction("quotation.submit", { id: q.id }, "Quotation submitted", () => reload())}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  {busy === "quotation.submit" ? "Submitting…" : "Submit for approval"}
                </Button>
              </>
            )}

            {isPending && canDecide && (
              <>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 border-red-200 text-red-600 hover:bg-red-50" onClick={() => { setRejectNote(""); setRejectError(null); setRejectOpen(true); }}>
                  <Ban className="h-3.5 w-3.5" aria-hidden /> Reject
                </Button>
                <Button size="sm" className="h-9 gap-1.5" disabled={busy === "quotation.decide"} onClick={() => void approve()}>
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  {busy === "quotation.decide" ? "Recording…" : "Approve"}
                </Button>
              </>
            )}

            {isApproved && (
              <>
                <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={busy === "quotation.revise"} onClick={() => void runAction("quotation.revise", { id: q.id }, "Revision created", (res) => {
                  if (res.quotation?.id) nav.navigate("quotation-detail", { quotationId: res.quotation.id });
                  else reload();
                })}>
                  <Copy className="h-3.5 w-3.5" aria-hidden /> Revise
                </Button>
                <Button
                  size="sm"
                  className="h-9 gap-1.5"
                  disabled={busy === "quotation.send"}
                  onClick={() => void runAction("quotation.send", { id: q.id }, "Quotation sent", () => reload())}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  {busy === "quotation.send" ? "Sending…" : "Send to customer"}
                </Button>
              </>
            )}

            {isActiveNegotiation && (
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1.5"
                disabled={busy === "quotation.revise"}
                onClick={() => void runAction("quotation.revise", { id: q.id }, "Revision created", (res) => {
                  if (res.quotation?.id) nav.navigate("quotation-detail", { quotationId: res.quotation.id });
                  else reload();
                })}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden /> Revise
              </Button>
            )}

            {isAccepted && (
              <Button
                size="sm"
                className="h-9 gap-1.5"
                disabled={busy === "order.create"}
                onClick={() =>
                  q.order
                    ? nav.navigate("order-detail", { orderId: q.order.id })
                    : void runAction("order.create", { quotationId: q.id }, "Sales order created", (res) => {
                        if (res.order?.id) nav.navigate("order-detail", { orderId: res.order.id });
                        else reload();
                      })
                }
              >
                {q.order ? (
                  <>
                    <FileText className="h-3.5 w-3.5" aria-hidden /> View order
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
                    {busy === "order.create" ? "Creating…" : "Create order"}
                  </>
                )}
              </Button>
            )}

            {cancellable && (
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
          </>
        }
      />

      {/* Inline 4xx surface — the toast carries the same server message verbatim */}
      {actionError && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50/60 px-3.5 py-2.5" role="alert">
          <p className="text-[13px] font-medium text-red-700">{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs font-medium text-red-600 transition-colors hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-4">
        {/* Summary band — the money story of the document */}
        <div className="qubit-card flex flex-wrap items-center gap-x-10 gap-y-4 px-4 py-4 md:px-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Grand total (incl. {q.taxPct}% GST)</p>
            <p className="mt-0.5 text-[24px] font-bold leading-none tracking-tight tabular-nums text-slate-900">{fmtRupees(q.total)}</p>
          </div>
          <dl className="flex flex-wrap items-center gap-x-10 gap-y-3">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Subtotal</dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-800">{fmtRupees(q.subtotal)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Overall discount</dt>
              <dd className="mt-0.5 text-sm tabular-nums">
                {highDiscount ? (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    {q.overallDiscountPct}% · &gt;15%
                  </span>
                ) : (
                  <span className="font-medium text-slate-800">{q.overallDiscountPct}%</span>
                )}
                {discountAmount > 0 && <span className="ml-1.5 text-xs text-slate-400">−{fmtRupees(discountAmount)} vs list</span>}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">GST {q.taxPct}%</dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-800">{fmtRupees(q.taxAmount)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Valid until</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-800">{q.validUntil}</dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {/* Left column — the document itself */}
          <div className="space-y-4">
            <SectionCard
              title="Items"
              description={`${q.items.length} line ${q.items.length === 1 ? "item" : "items"} — server-computed pricing`}
              noPadding
            >
              <div className="qubit-scroll relative overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm" aria-label={`Line items for ${q.number}`}>
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
                    {q.items.map((it) => (
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
                      <td colSpan={4} className="px-4 py-2 text-right text-slate-500 md:px-5">Subtotal</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums text-slate-800 md:px-5">{fmtRupees(q.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right text-slate-500 md:px-5">
                        Overall discount
                        {highDiscount && (
                          <span className="ml-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
                            &gt;15%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600 md:px-5">
                        {q.overallDiscountPct}%
                        {discountAmount > 0 && <span className="ml-1.5 text-slate-400">−{fmtRupees(discountAmount)}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right text-slate-500 md:px-5">GST {q.taxPct}%</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums text-slate-800 md:px-5">{fmtRupees(q.taxAmount)}</td>
                    </tr>
                    <tr className="border-t border-slate-200">
                      <td colSpan={4} className="px-4 py-2.5 text-right font-semibold text-slate-700 md:px-5">Grand total</td>
                      <td className="px-4 py-2.5 text-right text-[15px] font-bold tabular-nums text-slate-900 md:px-5">{fmtRupees(q.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="border-t border-slate-100 px-4 py-3 text-[11px] leading-relaxed text-slate-400 md:px-5">
                Pricing pulls from the product catalog — Inventory remains the source of truth for availability.
              </p>
            </SectionCard>

            <SectionCard title="Terms & notes" description="Printed on the document sent to the customer.">
              <dl className="divide-y divide-slate-100">
                <KV label="Payment terms">{q.paymentTerms}</KV>
                <KV label="Delivery terms">{q.deliveryTerms}</KV>
                <KV label="Notes">{q.notes?.trim() ? q.notes : <span className="text-slate-400">—</span>}</KV>
              </dl>
            </SectionCard>
          </div>

          {/* Right column — trail and links */}
          <div className="space-y-4">
            <SectionCard
              title="Approval & versions"
              description="One enterprise approval trail — decisions recorded in My Approvals (46) land here."
            >
              {q.approvalNote && (
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Approval note</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{q.approvalNote}</p>
                  {q.approvalId && (
                    <ArrowLink className="mt-2" onClick={() => nav.navigate("my-approvals")} ariaLabel="Open My Approvals">
                      Open My Approvals (46)
                    </ArrowLink>
                  )}
                </div>
              )}
              {isPending && !q.approvalNote && (
                <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-[13px] text-amber-800">
                  This document is waiting in the enterprise approval queue — the Sales Head / administrator boundary decides; the decision appears here and in My Approvals.
                </p>
              )}
              <ol className="space-y-3.5" aria-label="Version history, latest first">
                {q.versions.map((v, i) => (
                  <li key={`${v.at}-${i}`} className="relative flex gap-3">
                    {i < q.versions.length - 1 && <span aria-hidden className="absolute left-[3.5px] top-4 bottom-[-14px] w-px bg-slate-100" />}
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-300" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[13px] leading-relaxed text-slate-700">{v.note}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {v.by} · {relTime(v.at)} · {fmtDateTime(v.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </SectionCard>

            <SectionCard title="Customer & links" description="Everything this document is connected to.">
              <dl className="divide-y divide-slate-100">
                <KV label="Account">
                  {q.account ? (
                    <EntityLink screen="account-detail" id={q.account.id} label={q.account.name} kind="account" />
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </KV>
                <KV label="Contact">
                  {q.contact ? (
                    <span className="inline-flex flex-wrap items-center gap-x-2">
                      <EntityLink screen="contact-detail" id={q.contact.id} label={q.contact.name} kind="contact" />
                      <span className="text-xs text-slate-400">{q.contact.designation}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </KV>
                <KV label="Opportunity">
                  {q.opportunity ? (
                    <EntityLink screen="opportunity-detail" id={q.opportunity.id} label={q.opportunity.name} kind="opportunity" />
                  ) : (
                    <span className="text-slate-400">No linked opportunity</span>
                  )}
                </KV>
                <KV label="Order">
                  {q.order ? (
                    <EntityLink screen="order-detail" id={q.order.id} label={q.order.number} kind="order" />
                  ) : isAccepted ? (
                    <span className="text-xs text-slate-400">No order yet — use “Create order” above.</span>
                  ) : (
                    <span className="text-xs text-slate-400">Created from this document once the customer accepts.</span>
                  )}
                </KV>
                <KV label="Owner">{q.ownerName}</KV>
                <KV label="Created">
                  <span className="tabular-nums">
                    {fmtDateTime(q.createdAt)} · {relTime(q.createdAt)}
                  </span>
                </KV>
              </dl>
            </SectionCard>
          </div>
        </div>

        <SalesAsOf asOfLabel={SALES_PERIOD.asOfLabel} note="Lifecycle timestamps are server-recorded and audited — this view never derives state on its own." />
      </div>

      {/* Reject — approval decision with a required note (server 422 note_required mirrors this) */}
      <FormDialog
        open={rejectOpen}
        onOpenChange={(o) => {
          setRejectOpen(o);
          if (!o) setRejectError(null);
        }}
        title={`Reject ${q.number}`}
        description="The quotation returns to the owner with your note. The decision is audited and appears in the version history."
        submitLabel={rejectBusy ? "Recording…" : "Reject quotation"}
        submitting={rejectBusy}
        onSubmit={submitReject}
      >
        <Field label="Rejection note" required hint="Goes back to the quotation owner and into the approval trail.">
          <Textarea
            value={rejectNote}
            onChange={(e) => {
              setRejectNote(e.target.value);
              if (rejectError) setRejectError(null);
            }}
            rows={3}
            placeholder="e.g. Discount exceeds the quarterly delegation — resubmit under 15%."
            aria-invalid={Boolean(rejectError)}
          />
        </Field>
        {rejectError && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {rejectError}
          </p>
        )}
      </FormDialog>

      {/* Cancel — destructive, reason required (server 422 reason_required mirrors this) */}
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
        title={`Cancel ${q.number}?`}
        description="Cancelled quotations cannot be reopened. The reason is recorded in the document notes and version history, and the action is written to the audit trail."
        confirmLabel={cancelBusy ? "Cancelling…" : "Cancel quotation"}
        destructive
        onConfirm={submitCancel}
      >
        <div className="space-y-1.5">
          <label htmlFor="cancel-reason" className="block text-xs font-medium text-slate-700">
            Reason
            <span className="ml-0.5 text-red-500" aria-hidden>
              *
            </span>
          </label>
          <Input
            id="cancel-reason"
            value={cancelReason}
            onChange={(e) => {
              setCancelReason(e.target.value);
              if (cancelError) setCancelError(null);
            }}
            placeholder="e.g. Customer chose a phased rollout instead"
            aria-invalid={Boolean(cancelError)}
          />
          {cancelError && (
            <p role="alert" className="text-[11.5px] font-medium text-red-600">
              {cancelError}
            </p>
          )}
        </div>
      </ConfirmDialog>

      {/* Step-up authentication — server sends 401 step_up_required for decisions above ₹1 Cr */}
      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        title="Reauthenticate to approve"
        description="This decision is above ₹1 Cr — enterprise security policy requires step-up authentication before the approval is recorded."
        confirmLabel="Verify & approve"
        verifying={busy === "quotation.decide" && stepUpOpen}
        onConfirm={(password) => void approve(password)}
      />
    </div>
  );
}
