"use client";

import * as React from "react";
import { FileText, Loader2, PackagePlus, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { SALES_PERIOD, type QuoteItem, type QuotationStatus } from "@/lib/qubit/sales-data";
import { PageHeader } from "../page-header";
import { EmptyState, KV, ReadOnlyBanner, SectionCard, StatusBadge } from "../primitives";
import { Field } from "../dialogs";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import {
  EntityLink,
  fmtDate,
  fmtRupees,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  salesPost,
  useSalesSection,
  type SalesSectionState,
} from "../sales/parts";

// ============================================================
// Screen 87 · Quotation Builder — catalog-driven quotation form.
// Two-zone layout: form left, live summary right (stacks on mobile).
// The CLIENT only previews totals; the SERVER re-prices every line
// from the master catalog and enforces the Approval Matrix on submit
// (>15% discount or total > ₹50 L → Sales Head). Draft/Negotiation
// quotations are edited in place; anything else is a locked document
// — Revise from the quotation detail is the only path forward.
// ============================================================

const BUILDER_DESCRIPTION =
  "Catalog-driven quotations with server-side pricing. Discount rules are enforced when you submit — >15% discount or total > ₹50 L routes to the Sales Head via the Approval Matrix.";

const DEFAULT_PAYMENT_TERMS = "30% advance, milestone-based";
const DEFAULT_DELIVERY_TERMS = "Standard rollout terms";
/** date-input form of the canonical "31 Dec 2026" validity default */
const DEFAULT_VALID_UNTIL = "2026-12-31";
const DEFAULT_OWNER_ID = "pankaj";
const DISCOUNT_LIMIT_PCT = 15;
const VALUE_LIMIT = 5_000_000; // ₹50,00,000 — above this the Sales Head decides
const GST_PCT = 18;

interface FormRefsPayload {
  owners: { id: string; name: string; title: string }[];
  accounts: { id: string; name: string; ownerId: string }[];
  contacts: { id: string; name: string; accountId: string }[];
  opportunities: { id: string; name: string; accountId: string }[];
  products: { id: string; name: string; category: string; unitPrice: number; unit: string }[];
}

interface QuotationDoc {
  id: string;
  number: string;
  accountId: string;
  contactId?: string;
  opportunityId?: string;
  ownerId: string;
  ownerName: string;
  status: QuotationStatus;
  createdAt: number;
  validUntil: string;
  items: QuoteItem[];
  taxPct: number;
  paymentTerms: string;
  deliveryTerms: string;
  notes?: string;
  account: { id: string; name: string } | null;
  contact: { id: string; name: string } | null;
  opportunity: { id: string; name: string } | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  overallDiscountPct: number;
}

/** One editable line — qty / discount stay as raw input strings so typing feels natural. */
interface DraftItem {
  key: string;
  productId: string;
  name: string;
  unitPrice: number;
  qty: string;
  discountPct: string;
}

// ---------- local helpers ----------

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** "2026-12-31" → "31 Dec 2026" — the canonical document date format the store persists. */
const toDisplayDate = (iso: string): string | undefined => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const lineNetOf = (it: DraftItem) => {
  const qty = Math.max(0, Number(it.qty) || 0);
  const disc = Math.min(100, Math.max(0, Number(it.discountPct) || 0));
  return it.unitPrice * qty * (1 - disc / 100);
};

/** Client preview only — the server re-prices from the catalog and rounds the tax. */
function computeTotals(items: DraftItem[]) {
  let gross = 0;
  let net = 0;
  for (const it of items) {
    const qty = Math.max(0, Number(it.qty) || 0);
    gross += it.unitPrice * qty;
    net += lineNetOf(it);
  }
  const overallDiscountPct = gross > 0 ? ((gross - net) / gross) * 100 : 0;
  const tax = Math.round(net * (GST_PCT / 100));
  return { gross, net, overallDiscountPct, tax, total: net + tax };
}

const toItemsPayload = (items: DraftItem[]) =>
  items.map((it) => ({
    productId: it.productId,
    qty: Math.max(0, Number(it.qty) || 0),
    discountPct: Math.min(100, Math.max(0, Number(it.discountPct) || 0)),
  }));

// ============================================================
// Screen router — create mode vs edit-draft mode (deep link)
// ============================================================

export function QuotationBuilderScreen() {
  const { params } = useQubitNav();
  const refsState = useSalesSection<FormRefsPayload>("form-refs");

  if (refsState.forbidden) {
    return (
      <SalesGate screenName="Quotation Builder">
        <></>
      </SalesGate>
    );
  }

  return params.quotationId ? (
    <DraftEditor key={params.quotationId} quotationId={params.quotationId} refsState={refsState} />
  ) : (
    <CreateForm refsState={refsState} />
  );
}

// ============================================================
// CREATE MODE — new draft
// ============================================================

function CreateForm({ refsState }: { refsState: SalesSectionState<FormRefsPayload> }) {
  const nav = useQubitNav();
  const { role } = useRole();
  const refs = refsState.data;

  // The server-computed isMine flag on scoped leads is the only honest
  // client-side way to resolve the sales-exec session identity (same
  // pattern as screen 76) — used for the owner default, never hardcoded.
  const leadsState = useSalesSection<{ rows: { ownerId: string; isMine: boolean }[] }>("leads");
  const selfOwnerId = React.useMemo(
    () => leadsState.data?.rows.find((r) => r.isMine)?.ownerId ?? null,
    [leadsState.data],
  );

  const [accountId, setAccountId] = React.useState(() => nav.params.accountId ?? "");
  const [contactId, setContactId] = React.useState("");
  const [oppId, setOppId] = React.useState(() => nav.params.opportunityId ?? "");
  const [ownerId, setOwnerId] = React.useState("");
  const [quotationDate] = React.useState(todayIso); // display metadata — the server stamps the official time
  const [validUntil, setValidUntil] = React.useState(DEFAULT_VALID_UNTIL);
  const [paymentTerms, setPaymentTerms] = React.useState(DEFAULT_PAYMENT_TERMS);
  const [deliveryTerms, setDeliveryTerms] = React.useState(DEFAULT_DELIVERY_TERMS);
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<DraftItem[]>([]);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Deep links may carry only the opportunity — its account resolves the account select.
  const oppAccountId = React.useMemo(
    () => refs?.opportunities.find((o) => o.id === oppId)?.accountId ?? "",
    [refs, oppId],
  );
  const effectiveAccountId = accountId || oppAccountId;

  const contactOptions = React.useMemo(
    () => refs?.contacts.filter((c) => c.accountId === effectiveAccountId) ?? [],
    [refs, effectiveAccountId],
  );
  const oppOptions = React.useMemo(
    () => refs?.opportunities.filter((o) => o.accountId === effectiveAccountId) ?? [],
    [refs, effectiveAccountId],
  );

  // Owner default: sales-exec → self (server-resolved), everyone else → pankaj.
  const effectiveOwner = ownerId || (role === "sales-exec" ? selfOwnerId : null) || DEFAULT_OWNER_ID;

  const accountName = refs?.accounts.find((a) => a.id === effectiveAccountId)?.name ?? "";
  const ownerName = refs?.owners.find((o) => o.id === effectiveOwner)?.name ?? "";
  const totals = computeTotals(items);

  const onItemsChange = (next: DraftItem[]) => {
    setItems(next);
    setSubmitError(null);
  };

  const onAccountChange = (v: string) => {
    setAccountId(v);
    setSubmitError(null);
    if (contactId && !refs?.contacts.some((c) => c.id === contactId && c.accountId === v)) setContactId("");
    if (oppId && refs?.opportunities.find((o) => o.id === oppId)?.accountId !== v) setOppId("");
  };

  const save = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await salesPost<{ ok: boolean; message: string; quotation: { id: string } }>(
        "quotation.create",
        {
          accountId: effectiveAccountId,
          contactId: contactId || undefined,
          opportunityId: oppId || undefined,
          ownerId: effectiveOwner || undefined,
          validUntil: toDisplayDate(validUntil) ?? "31 Dec 2026",
          paymentTerms: paymentTerms.trim() || undefined,
          deliveryTerms: deliveryTerms.trim() || undefined,
          notes: notes.trim() || undefined,
          items: toItemsPayload(items),
        },
        role,
      );
      toast({ title: "Quotation draft created", description: res.message });
      nav.navigate("quotation-detail", { quotationId: res.quotation.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "The server could not save this quotation.";
      setSubmitError(message);
      toast({ variant: "destructive", title: "Draft not saved", description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Quotation Builder" }]}
        title="Quotation Builder"
        description={BUILDER_DESCRIPTION}
        actions={
          <Button variant="ghost" size="sm" className="h-9 text-blue-600" onClick={() => nav.navigate("quotation-list")}>
            Open quotation list
          </Button>
        }
      />

      {refsState.error && <SalesErrorBanner message={refsState.error} onRetry={refsState.reload} />}
      {refsState.loading && <SalesSkeleton rows={3} />}

      {refs && !refsState.loading && (
        <>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px] xl:grid-cols-[minmax(0,1fr)_370px]">
            <div className="min-w-0 space-y-4">
              <SectionCard
                title="Details"
                description="Who the quotation is for and the commercial terms. Required fields are marked *."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Customer account" required>
                    <Select value={effectiveAccountId} onValueChange={onAccountChange}>
                      <SelectTrigger className="h-9 w-full bg-white" aria-label="Customer account">
                        <SelectValue placeholder="Choose the customer account" />
                      </SelectTrigger>
                      <SelectContent>
                        {refs.accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Contact" hint="Optional — people at the chosen account.">
                    <Select
                      value={contactId}
                      onValueChange={(v) => {
                        setContactId(v);
                        setSubmitError(null);
                      }}
                    >
                      <SelectTrigger className="h-9 w-full bg-white" aria-label="Contact at the account">
                        <SelectValue placeholder="Choose a contact" />
                      </SelectTrigger>
                      <SelectContent>
                        {contactOptions.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-slate-400">
                            {effectiveAccountId
                              ? "No contacts on file for this account."
                              : "Choose an account first — contacts are scoped to it."}
                          </p>
                        ) : (
                          contactOptions.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Opportunity" hint="Optional — links the quotation to the pipeline deal.">
                    <Select
                      value={oppId}
                      onValueChange={(v) => {
                        setOppId(v);
                        setSubmitError(null);
                      }}
                    >
                      <SelectTrigger className="h-9 w-full bg-white" aria-label="Linked opportunity">
                        <SelectValue placeholder="No opportunity linked" />
                      </SelectTrigger>
                      <SelectContent>
                        {oppOptions.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-slate-400">
                            {effectiveAccountId
                              ? "No open opportunities for this account in your scope."
                              : "Choose an account first."}
                          </p>
                        ) : (
                          oppOptions.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Owner" required hint="Quotations always have an owner — the server enforces it.">
                    <Select
                      value={effectiveOwner}
                      onValueChange={(v) => {
                        setOwnerId(v);
                        setSubmitError(null);
                      }}
                    >
                      <SelectTrigger className="h-9 w-full bg-white" aria-label="Quotation owner">
                        <SelectValue placeholder="Choose an owner" />
                      </SelectTrigger>
                      <SelectContent>
                        {refs.owners.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name} — {o.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Quotation date" hint="The server stamps the official date and time when the draft is saved.">
                    <Input type="date" value={quotationDate} disabled aria-label="Quotation date" className="h-9 rounded-lg tabular-nums" />
                  </Field>

                  <Field label="Valid until" hint="Defaults to 31 Dec 2026.">
                    <Input
                      type="date"
                      value={validUntil}
                      onChange={(e) => {
                        setValidUntil(e.target.value);
                        setSubmitError(null);
                      }}
                      className="h-9 rounded-lg tabular-nums"
                    />
                  </Field>

                  <Field label="Payment terms">
                    <Input
                      value={paymentTerms}
                      onChange={(e) => {
                        setPaymentTerms(e.target.value);
                        setSubmitError(null);
                      }}
                      className="h-9 rounded-lg"
                    />
                  </Field>

                  <Field label="Delivery terms">
                    <Input
                      value={deliveryTerms}
                      onChange={(e) => {
                        setDeliveryTerms(e.target.value);
                        setSubmitError(null);
                      }}
                      className="h-9 rounded-lg"
                    />
                  </Field>

                  <Field label="Notes" className="sm:col-span-2">
                    <Textarea
                      value={notes}
                      onChange={(e) => {
                        setNotes(e.target.value);
                        setSubmitError(null);
                      }}
                      rows={3}
                      placeholder="Commercial context — delivery expectations, warranty, special conditions…"
                      className="resize-y rounded-lg"
                    />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard
                title="Line items"
                description="Catalog-driven lines — the server re-prices every line from the master catalog on save."
              >
                <ItemsEditor items={items} onChange={onItemsChange} products={refs.products} />
              </SectionCard>
            </div>

            <aside className="lg:sticky lg:top-6" aria-label="Live quotation summary">
              <LiveSummary
                items={items}
                recap={[
                  { label: "Account", value: accountName || "—" },
                  { label: "Owner", value: ownerName || "—" },
                  { label: "Valid until", value: toDisplayDate(validUntil) ?? "31 Dec 2026" },
                ]}
              />
            </aside>
          </div>

          {submitError && (
            <div className="mt-4">
              <ServerErrorCard message={submitError} />
            </div>
          )}

          <SalesAsOf
            asOfLabel={SALES_PERIOD.asOfLabel}
            note="Catalog prices and the Approval Matrix are served live from the sales service."
          />

          <SaveBar itemCount={items.length} total={totals.total} submitting={submitting} onSave={() => void save()} />
        </>
      )}
    </div>
  );
}

// ============================================================
// EDIT-DRAFT MODE — quotation loaded from a deep link.
// Only Draft / Negotiation documents are editable; the server
// rejects everything else with 409 locked.
// ============================================================

function DraftEditor({ quotationId, refsState }: { quotationId: string; refsState: SalesSectionState<FormRefsPayload> }) {
  const nav = useQubitNav();
  const { role } = useRole();
  const refs = refsState.data;
  const qState = useSalesSection<{ quotation: QuotationDoc }>("quotation", { id: quotationId });
  const qDoc = qState.data?.quotation ?? null;

  const [items, setItems] = React.useState<DraftItem[]>([]);
  const [paymentTerms, setPaymentTerms] = React.useState(DEFAULT_PAYMENT_TERMS);
  const [deliveryTerms, setDeliveryTerms] = React.useState(DEFAULT_DELIVERY_TERMS);
  const [notes, setNotes] = React.useState("");
  const [hydratedId, setHydratedId] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Hydrate the form once per loaded quotation (render-phase state
  // adjustment — refetches of the same id keep unsaved local edits).
  if (qDoc && hydratedId !== qDoc.id) {
    setHydratedId(qDoc.id);
    setItems(
      qDoc.items.map((it, i) => ({
        key: it.id || `it-${i + 1}`,
        productId: it.productId,
        name: it.name,
        unitPrice: it.unitPrice,
        qty: String(it.qty),
        discountPct: String(it.discountPct),
      })),
    );
    setPaymentTerms(qDoc.paymentTerms || DEFAULT_PAYMENT_TERMS);
    setDeliveryTerms(qDoc.deliveryTerms || DEFAULT_DELIVERY_TERMS);
    setNotes(qDoc.notes ?? "");
  }

  const editable = qDoc ? qDoc.status === "Draft" || qDoc.status === "Negotiation" : false;
  const totals = computeTotals(items);
  const onItemsChange = (next: DraftItem[]) => {
    setItems(next);
    setSubmitError(null);
  };

  const save = async () => {
    if (!qDoc || !editable || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await salesPost<{ ok: boolean; message: string }>(
        "quotation.update",
        {
          id: qDoc.id,
          items: toItemsPayload(items),
          paymentTerms: paymentTerms.trim(),
          deliveryTerms: deliveryTerms.trim(),
          notes: notes.trim(),
        },
        role,
      );
      toast({ title: `${qDoc.number} updated`, description: res.message });
      nav.navigate("quotation-detail", { quotationId: qDoc.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "The server could not update this quotation.";
      setSubmitError(message);
      toast({ variant: "destructive", title: "Draft not saved", description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const loading = qState.loading || refsState.loading;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Quotation Builder" }]}
        title="Quotation Builder"
        description={BUILDER_DESCRIPTION}
        actions={
          <Button variant="ghost" size="sm" className="h-9 text-blue-600" onClick={() => nav.navigate("quotation-list")}>
            Open quotation list
          </Button>
        }
        meta={
          qDoc ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[11px] font-medium text-slate-600">{qDoc.number}</span>
              <StatusBadge status={qDoc.status} size="sm" />
              <span aria-hidden>·</span>
              <span>Owner {qDoc.ownerName}</span>
              <span aria-hidden>·</span>
              <span>Valid until {qDoc.validUntil}</span>
            </div>
          ) : undefined
        }
      />

      {refsState.error && <SalesErrorBanner message={refsState.error} onRetry={refsState.reload} />}
      {qState.error && <SalesErrorBanner message={qState.error} onRetry={qState.reload} />}
      {loading && <SalesSkeleton rows={3} />}

      {!loading && qState.error && !qDoc && (
        <EmptyState
          icon={<FileText />}
          title="Quotation unavailable"
          message="This deep link only resolves quotations inside your authorized scope — open a draft from the Quotation List instead."
          action={
            <Button size="sm" variant="outline" onClick={() => nav.navigate("quotation-list")}>
              Open quotation list
            </Button>
          }
        />
      )}

      {qDoc && !qState.loading && (
        <>
          {!editable && (
            <div className="mb-4 space-y-1.5">
              <ReadOnlyBanner
                message={`This quotation is ${qDoc.status} — approved and sent documents are never edited in place. Use Revise from the quotation detail.`}
              />
              <p className="text-[11px] text-slate-400">
                <EntityLink screen="quotation-detail" id={qDoc.id} label="Open the quotation detail" kind="quotation" /> to
                submit, revise or send this document.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px] xl:grid-cols-[minmax(0,1fr)_370px]">
            <div className="min-w-0 space-y-4">
              <SectionCard
                title="Details"
                description={
                  editable
                    ? "Document header is fixed on a saved quotation — the server accepts item, terms and note changes only."
                    : "Read-only document — every field is locked for this status."
                }
              >
                <div className="grid gap-x-8 sm:grid-cols-2">
                  <KV label="Account">{qDoc.account?.name ?? "—"}</KV>
                  <KV label="Contact">{qDoc.contact?.name ?? "—"}</KV>
                  <KV label="Opportunity">{qDoc.opportunity?.name ?? "—"}</KV>
                  <KV label="Owner">{qDoc.ownerName}</KV>
                  <KV label="Quotation date">{fmtDate(qDoc.createdAt)}</KV>
                  <KV label="Valid until">{qDoc.validUntil}</KV>
                </div>
                <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                  <Field label="Payment terms">
                    <Input
                      value={paymentTerms}
                      disabled={!editable}
                      onChange={(e) => {
                        setPaymentTerms(e.target.value);
                        setSubmitError(null);
                      }}
                      className="h-9 rounded-lg"
                    />
                  </Field>
                  <Field label="Delivery terms">
                    <Input
                      value={deliveryTerms}
                      disabled={!editable}
                      onChange={(e) => {
                        setDeliveryTerms(e.target.value);
                        setSubmitError(null);
                      }}
                      className="h-9 rounded-lg"
                    />
                  </Field>
                  <Field label="Notes" className="sm:col-span-2">
                    <Textarea
                      value={notes}
                      disabled={!editable}
                      rows={3}
                      onChange={(e) => {
                        setNotes(e.target.value);
                        setSubmitError(null);
                      }}
                      placeholder="Internal notes — visible to the sales team, not the customer."
                      className="resize-y rounded-lg"
                    />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard
                title="Line items"
                description="The server re-prices every line from the master catalog on save."
              >
                <ItemsEditor items={items} onChange={onItemsChange} products={refs?.products} disabled={!editable} />
              </SectionCard>
            </div>

            <aside className="lg:sticky lg:top-6" aria-label="Live quotation summary">
              <LiveSummary
                items={items}
                recap={[
                  { label: "Number", value: <span className="font-mono">{qDoc.number}</span> },
                  { label: "Status", value: <StatusBadge status={qDoc.status} size="sm" /> },
                  { label: "Owner", value: qDoc.ownerName },
                  { label: "Valid until", value: qDoc.validUntil },
                ]}
              />
            </aside>
          </div>

          {submitError && (
            <div className="mt-4">
              <ServerErrorCard message={submitError} />
            </div>
          )}

          <SalesAsOf
            asOfLabel={SALES_PERIOD.asOfLabel}
            note={`Editing ${qDoc.number} — every change lands in the one enterprise audit trail.`}
          />

          {editable && (
            <SaveBar itemCount={items.length} total={totals.total} submitting={submitting} onSave={() => void save()} />
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Shared pieces
// ============================================================

function ItemsEditor({
  items,
  onChange,
  products,
  disabled = false,
}: {
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
  products: FormRefsPayload["products"] | undefined;
  disabled?: boolean;
}) {
  const [addProductId, setAddProductId] = React.useState("");
  const [addQty, setAddQty] = React.useState("1");
  const [addDiscount, setAddDiscount] = React.useState("0");
  const keySeq = React.useRef(0);

  const catalog = products ?? [];
  const catalogReady = catalog.length > 0;
  const canAdd = !disabled && catalogReady && Boolean(addProductId) && Number(addQty) >= 1;
  const totals = computeTotals(items);

  const addLine = () => {
    const p = catalog.find((x) => x.id === addProductId);
    if (disabled || !p || !(Number(addQty) >= 1)) return;
    onChange([
      ...items,
      {
        key: `new-${keySeq.current++}`,
        productId: p.id,
        name: p.name,
        unitPrice: p.unitPrice,
        qty: String(Number(addQty)),
        discountPct: String(Math.min(100, Math.max(0, Number(addDiscount) || 0))),
      },
    ]);
    setAddProductId("");
    setAddQty("1");
    setAddDiscount("0");
  };

  return (
    <div className="space-y-4">
      {!disabled && (
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Add product</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_92px_92px_auto] sm:items-center">
            {catalogReady ? (
              <div className="col-span-2 sm:col-span-1">
                <Select value={addProductId} onValueChange={setAddProductId}>
                  <SelectTrigger className="h-9 w-full bg-white" aria-label="Product from the catalog">
                    <SelectValue placeholder="Choose a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {fmtRupees(p.unitPrice)} · {p.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="col-span-2 self-center text-xs text-slate-400 sm:col-span-3">
                Product catalog could not load — retry the reference data above to add lines.
              </p>
            )}
            <Input
              type="number"
              min={1}
              step={1}
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
              placeholder="Qty"
              aria-label="Quantity"
              className="h-9 rounded-lg bg-white tabular-nums"
            />
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={addDiscount}
              onChange={(e) => setAddDiscount(e.target.value)}
              placeholder="Discount %"
              aria-label="Line discount percent"
              className="h-9 rounded-lg bg-white tabular-nums"
            />
            <Button
              type="button"
              size="sm"
              className="col-span-2 h-9 gap-1.5 sm:col-span-1"
              disabled={!canAdd}
              onClick={addLine}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Prices come from the product catalog — the server rejects free-text lines.
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<PackagePlus />}
          title="No line items yet"
          message="Add your first product — the catalog prices every line and the server re-prices on save."
        />
      ) : (
        <div>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Quotation line items</caption>
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th scope="col" className="py-2 pr-3 font-medium">Product</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Qty</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Unit price</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Discount %</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Line total</th>
                  <th scope="col" className="py-2 font-medium">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.key} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 pr-3 text-[13px] font-medium text-slate-800">{it.name}</td>
                    <td className="py-2.5 pr-3">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={it.qty}
                        disabled={disabled}
                        onChange={(e) => onChange(items.map((x) => (x.key === it.key ? { ...x, qty: e.target.value } : x)))}
                        aria-label={`Quantity for ${it.name}`}
                        className="ml-auto h-8 w-16 rounded-md tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">{fmtRupees(it.unitPrice)}</td>
                    <td className="py-2.5 pr-3">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={it.discountPct}
                        disabled={disabled}
                        onChange={(e) =>
                          onChange(items.map((x) => (x.key === it.key ? { ...x, discountPct: e.target.value } : x)))
                        }
                        aria-label={`Discount percent for ${it.name}`}
                        className="ml-auto h-8 w-16 rounded-md tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 pr-3 text-right text-[13px] font-medium tabular-nums text-slate-900">
                      {fmtRupees(lineNetOf(it))}
                    </td>
                    <td className="py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600"
                        aria-label={`Remove ${it.name}`}
                        disabled={disabled}
                        onClick={() => onChange(items.filter((x) => x.key !== it.key))}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <ApprovalChips overallDiscountPct={totals.overallDiscountPct} total={totals.total} className="mb-3" />
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <p className="max-w-xs flex-1 text-[11px] leading-relaxed text-slate-400">
                Live preview — final pricing is computed server-side on save.
              </p>
              <dl className="w-full max-w-[260px] space-y-1.5 text-[13px] sm:ml-auto sm:w-auto sm:min-w-[240px]">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="tabular-nums text-slate-800">{fmtRupees(totals.net)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-slate-500">Overall discount</dt>
                  <dd className="tabular-nums text-slate-800">{totals.overallDiscountPct.toFixed(1)}%</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-slate-500">GST @ {GST_PCT}%</dt>
                  <dd className="tabular-nums text-slate-800">{fmtRupees(totals.tax)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-t border-slate-100 pt-1.5">
                  <dt className="text-sm font-semibold text-slate-900">Grand total</dt>
                  <dd className="text-[15px] font-bold tabular-nums text-slate-900">{fmtRupees(totals.total)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalChips({
  overallDiscountPct,
  total,
  className,
}: {
  overallDiscountPct: number;
  total: number;
  className?: string;
}) {
  const flags: string[] = [];
  if (overallDiscountPct > DISCOUNT_LIMIT_PCT) flags.push("Approval required: discount above 15%");
  if (total > VALUE_LIMIT) flags.push("Approval required: total above ₹50 L");
  if (flags.length === 0) return null;
  return (
    <div className={className} role="status">
      <ul className="flex flex-wrap gap-1.5">
        {flags.map((f) => (
          <li
            key={f}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800"
          >
            <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden />
            {f}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
        The builder never blocks on these — when the quotation is submitted, the server routes it to the Sales Head
        through the Approval Matrix.
      </p>
    </div>
  );
}

function LiveSummary({ items, recap }: { items: DraftItem[]; recap: { label: string; value: React.ReactNode }[] }) {
  const t = computeTotals(items);
  return (
    <SectionCard title="Live summary" description="Recomputed as you edit — the server is the pricing authority.">
      <ApprovalChips overallDiscountPct={t.overallDiscountPct} total={t.total} className="mb-3" />
      <dl className="space-y-2 text-[13px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500">Line items</dt>
          <dd className="font-medium tabular-nums text-slate-800">{items.length}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500">Subtotal</dt>
          <dd className="tabular-nums text-slate-800">{fmtRupees(t.net)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500">Overall discount</dt>
          <dd className="tabular-nums text-slate-800">{t.overallDiscountPct.toFixed(1)}%</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500">GST @ {GST_PCT}%</dt>
          <dd className="tabular-nums text-slate-800">{fmtRupees(t.tax)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-2.5">
          <dt className="text-sm font-semibold text-slate-900">Grand total</dt>
          <dd className="text-[17px] font-bold tracking-tight tabular-nums text-slate-900">{fmtRupees(t.total)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Live preview — final pricing is computed server-side on save.
      </p>
      {recap.length > 0 && (
        <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
          {recap.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3 text-xs">
              <dt className="shrink-0 text-slate-400">{r.label}</dt>
              <dd className="min-w-0 truncate text-right font-medium text-slate-700">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </SectionCard>
  );
}

function SaveBar({
  itemCount,
  total,
  submitting,
  onSave,
}: {
  itemCount: number;
  total: number;
  submitting: boolean;
  onSave: () => void;
}) {
  const { role } = useRole();
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-slate-200/80 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-700 tabular-nums">
            {itemCount} {itemCount === 1 ? "line item" : "line items"} · grand total {fmtRupees(total)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {role === "sales-exec"
              ? "Own-boundary scope: you only see quotations you own — leave the owner as yourself unless the document belongs to a teammate."
              : "Saved as a Draft — the server re-prices every line; approval rules apply when the quotation is submitted."}
          </p>
        </div>
        <Button type="button" className="h-9 gap-1.5" onClick={onSave} disabled={submitting}>
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {submitting ? "Saving…" : "Save draft"}
        </Button>
      </div>
    </div>
  );
}

function ServerErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/70 px-4 py-3" role="alert">
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-red-800">The server rejected this draft — nothing was saved</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-red-700">{message}</p>
        </div>
      </div>
    </div>
  );
}
