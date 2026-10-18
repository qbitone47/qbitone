"use client";

import * as React from "react";
import {
  Building2,
  CalendarPlus,
  FilePlus2,
  FileText,
  MapPin,
  Package,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "../page-header";
import { EmptyState, SearchInput, SectionCard, StatTile, StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import { employees } from "@/lib/qubit/data";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import type {
  SalesAccount,
  SalesActivity,
  SalesContact,
  SalesMeeting,
  SalesOpportunity,
  SalesOrder,
  SalesQuotation,
  SalesVisit,
} from "@/lib/qubit/sales-data";
import {
  ActivityTimeline,
  EntityLink,
  fmtCr,
  fmtDate,
  fmtDateTime,
  fmtRupees,
  ProbabilityBar,
  relTime,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  salesPost,
  useSalesSection,
} from "../sales/parts";
import { FormDialog, Field } from "../dialogs";

// ============================================================
// Screen 78 · Account Detail — the Customer 360 entry point.
// One account, every connected record: contacts, open
// opportunities, quotations, orders, visits & meetings and the
// cross-entity activity timeline (composed server-side).
// Without a deep-link it renders an honest account picker and
// navigates with { accountId } so deep links always work.
// All data comes from /api/sales?section=account / accounts.
// ============================================================

type AccountDetail = SalesAccount & {
  ownerName: string;
  contacts: SalesContact[];
  opportunities: SalesOpportunity[];
  quotations: SalesQuotation[];
  orders: SalesOrder[];
  visits: SalesVisit[];
  meetings: SalesMeeting[];
  activity: SalesActivity[];
};

interface AccountPayload {
  account: AccountDetail;
}
interface AccountsPayload {
  rows: (SalesAccount & { ownerName: string })[];
}

const EMP_NAMES = new Map(employees.map((e) => [e.id, e.name] as const));
const employeeName = (id: string | undefined) => (id ? EMP_NAMES.get(id) : undefined);

/** Quotation statuses that are still "open" (presentation-only grouping). */
const OPEN_QUOTE_STATUSES = ["Draft", "Pending Approval", "Approved", "Sent", "Viewed", "Negotiation"];

/** Quotation totals are pure math on the payload (same formula as the server). */
function quoteTotal(q: Pick<SalesQuotation, "items" | "taxPct">): number {
  const subtotal = q.items.reduce((sum, it) => sum + it.qty * it.unitPrice * (1 - it.discountPct / 100), 0);
  return Math.round(subtotal + subtotal * (q.taxPct / 100));
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const localDate = (ts: number) => isoDate(new Date(ts));

export function AccountDetailScreen() {
  const nav = useQubitNav();
  const accountId = nav.params.accountId;
  return (
    <SalesGate screenName="Account Detail">
      {accountId ? <AccountDetailView key={accountId} accountId={accountId} /> : <AccountPicker />}
    </SalesGate>
  );
}

// ------------------------------------------------------------
// No deep-link → record picker (navigates so deep links work)
// ------------------------------------------------------------

function AccountPicker() {
  const nav = useQubitNav();
  const [query, setQuery] = React.useState("");
  const { data, loading, error, reload } = useSalesSection<AccountsPayload>("accounts");

  const rows = data?.rows ?? [];
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.industry.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Account Detail" }]}
        title="Account Detail"
        description="Customer 360 — contacts, opportunities, quotations, orders and the full activity timeline for one customer."
      />

      {error && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={3} />}

      {data && !loading && (
        <div className="max-w-xl">
          <SectionCard
            title="Open an account"
            description="Every account you are authorized to see — the server resolves the list; scoping is not a client filter."
          >
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search accounts…"
              ariaLabel="Search accounts"
              className="mb-3"
            />
            {filtered.length === 0 ? (
              <EmptyState
                icon={<Building2 />}
                title="No accounts match"
                message="No account in your authorized scope matches that search."
              />
            ) : (
              <>
                <ul
                  className="qubit-scroll max-h-96 space-y-2 overflow-y-auto pr-1"
                  aria-label="Account list"
                >
                  {filtered.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => nav.navigate("account-detail", { accountId: a.id })}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white px-3.5 py-3 text-left transition-colors duration-150 hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                        aria-label={`Open ${a.name} — ${a.industry}, ${a.location}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-medium text-slate-800">{a.name}</span>
                          <span className="block truncate text-xs text-slate-400">
                            {a.industry} · {a.location}
                            {a.annualValueCr != null && <> · {fmtCr(a.annualValueCr)} / yr</>}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <StatusBadge status={a.status} size="sm" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-slate-400">
                  {filtered.length} of {rows.length} accounts shown — select one to open its 360 view.
                </p>
              </>
            )}
          </SectionCard>
        </div>
      )}

      {!loading && !data && !error && (
        <EmptyState
          icon={<Building2 />}
          title="Accounts could not load"
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

// ------------------------------------------------------------
// Deep-link present → the Customer 360 view
// ------------------------------------------------------------

function AccountDetailView({ accountId }: { accountId: string }) {
  const nav = useQubitNav();
  const { role } = useRole();
  const { data, loading, error, reload } = useSalesSection<AccountPayload>("account", { id: accountId });
  const acc = data?.account;

  // --- dialog state ---
  const [meetingOpen, setMeetingOpen] = React.useState(false);
  const [visitOpen, setVisitOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "meeting" | "visit">(null);

  // meeting form
  const [mTitle, setMTitle] = React.useState("");
  const [mDate, setMDate] = React.useState(() => localDate(Date.now() + 86_400_000));
  const [mTime, setMTime] = React.useState("10:00");
  const [mDuration, setMDuration] = React.useState("30");
  const [mLocation, setMLocation] = React.useState("");
  const [mError, setMError] = React.useState<string | null>(null);

  // visit form
  const [vContact, setVContact] = React.useState("none");
  const [vPurpose, setVPurpose] = React.useState("");
  const [vDate, setVDate] = React.useState(() => localDate(Date.now() + 86_400_000));
  const [vTime, setVTime] = React.useState("10:00");
  const [vError, setVError] = React.useState<string | null>(null);

  const openMeeting = () => {
    setMTitle("");
    setMDate(localDate(Date.now() + 86_400_000));
    setMTime("10:00");
    setMDuration("30");
    setMLocation("");
    setMError(null);
    setMeetingOpen(true);
  };
  const openVisit = () => {
    setVContact("none");
    setVPurpose("");
    setVDate(localDate(Date.now() + 86_400_000));
    setVTime("10:00");
    setVError(null);
    setVisitOpen(true);
  };

  const submitMeeting = async () => {
    if (!mTitle.trim() || !mDate || !mTime) {
      setMError("Title, date and time are required.");
      return;
    }
    const startAt = new Date(`${mDate}T${mTime}:00`).getTime();
    if (Number.isNaN(startAt)) {
      setMError("Pick a valid date and time.");
      return;
    }
    setBusy("meeting");
    try {
      const res = await salesPost(
        "meeting.create",
        { title: mTitle.trim(), accountId, startAt, durationMin: Number(mDuration), location: mLocation.trim() || undefined },
        role,
      );
      toast({ title: "Meeting scheduled", description: res.message });
      setMeetingOpen(false);
      reload();
    } catch (err) {
      toast({
        title: "Could not schedule the meeting",
        description: err instanceof Error ? err.message : "Unexpected error.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const submitVisit = async () => {
    if (!vPurpose.trim() || !vDate || !vTime) {
      setVError("Purpose, date and time are required.");
      return;
    }
    const plannedAt = new Date(`${vDate}T${vTime}:00`).getTime();
    if (Number.isNaN(plannedAt)) {
      setVError("Pick a valid date and time.");
      return;
    }
    setBusy("visit");
    try {
      const res = await salesPost(
        "visit.create",
        {
          accountId,
          contactId: vContact === "none" ? undefined : vContact,
          purpose: vPurpose.trim(),
          plannedAt,
        },
        role,
      );
      toast({ title: "Visit planned", description: res.message });
      setVisitOpen(false);
      reload();
    } catch (err) {
      toast({
        title: "Could not plan the visit",
        description: err instanceof Error ? err.message : "Unexpected error.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const resolveActor = (actorId: string | undefined): string | undefined => {
    if (!actorId) return undefined;
    if (EMP_NAMES.has(actorId)) return EMP_NAMES.get(actorId);
    const contact = acc?.contacts.find((c) => c.id === actorId);
    if (contact) return contact.name;
    return actorId.startsWith("wa-") ? "Customer (WhatsApp)" : "Customer";
  };

  // ---- header + skeleton / error states ----
  if (loading && !acc) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Sales" }, { label: "Account Detail" }]}
          title="Account Detail"
          description="Loading the customer record…"
        />
        <SalesSkeleton rows={5} />
      </div>
    );
  }

  if (!acc) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Sales" }, { label: "Account Detail" }]}
          title="Account Detail"
          description="The account could not be opened."
        />
        {error && <SalesErrorBanner message={error} onRetry={reload} />}
        <div className="qubit-card">
          <EmptyState
            icon={<Building2 />}
            title="Account unavailable"
            message={error ?? "This account is not available in your scope."}
            action={
              <Button size="sm" variant="outline" onClick={() => nav.navigate("account-detail")}>
                Choose another account
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const openQuotes = acc.quotations.filter((q) => (OPEN_QUOTE_STATUSES as readonly string[]).includes(q.status));
  const pipelineValue = acc.opportunities.reduce((s, o) => s + o.valueCr, 0);

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Account Detail" }]}
        title={acc.name}
        description={`${acc.industry} · ${acc.location} · owned by ${acc.ownerName}`}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={openMeeting}>
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Schedule meeting
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={openVisit}>
              <MapPin className="h-3.5 w-3.5" aria-hidden /> Plan visit
            </Button>
            <Button size="sm" className="h-9 gap-1.5" onClick={() => nav.navigate("quotation-builder", { accountId: acc.id })}>
              <FilePlus2 className="h-3.5 w-3.5" aria-hidden /> New quotation
            </Button>
          </>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <StatusBadge status={acc.status} size="sm" />
            {acc.customerSince && (
              <span>
                Customer since <span className="font-medium text-slate-600">{acc.customerSince}</span>
              </span>
            )}
            <span aria-hidden>·</span>
            <span>{acc.region} region</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{acc.phone}</span>
            <span aria-hidden>·</span>
            <span>{acc.website}</span>
          </div>
        }
      />

      {/* Headline band — four honest counters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          value={acc.annualValueCr != null ? fmtCr(acc.annualValueCr) : "—"}
          label={acc.annualValueCr != null ? "Annual customer value" : "No annual value on file yet"}
        />
        <StatTile value={String(acc.opportunities.length)} label="Open opportunities" />
        <StatTile value={String(openQuotes.length)} label="Open quotations" />
        <StatTile value={String(acc.orders.length)} label="Orders (all time)" />
      </div>

      <div className="mt-4 space-y-4">
        {/* 1 · Contacts */}
        <SectionCard
          title="Contacts"
          description={`People we know at ${acc.name} — communication consent lives on each contact record.`}
        >
          {acc.contacts.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="No contacts yet"
              message="Contacts are created during lead conversion or added from the contact workspace."
            />
          ) : (
            <>
              <div className="qubit-scroll relative overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm" aria-label={`Contacts at ${acc.name}`}>
                  <thead>
                    <tr className="border-b border-slate-200/90 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                      <th scope="col" className="px-3 py-2.5">Name</th>
                      <th scope="col" className="px-3 py-2.5">Designation</th>
                      <th scope="col" className="px-3 py-2.5">Phone</th>
                      <th scope="col" className="px-3 py-2.5">Email</th>
                      <th scope="col" className="px-3 py-2.5">Preferred</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {acc.contacts.map((c) => (
                      <tr key={c.id} className="transition-colors duration-150 hover:bg-blue-50/30">
                        <td className="px-3 py-2.5">
                          <EntityLink screen="contact-detail" id={c.id} label={c.name} kind="contact" />
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{c.designation}</td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-600">{c.phone}</td>
                        <td className="px-3 py-2.5 text-slate-600">{c.email}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[11px] font-medium text-slate-600">
                            {c.preferred}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                {acc.contacts.length} {acc.contacts.length === 1 ? "contact" : "contacts"} on file.
              </p>
            </>
          )}
        </SectionCard>

        {/* 2 · Open opportunities */}
        <SectionCard
          title="Open opportunities"
          description="Deals in play for this account — Won and Lost deals stay on their own records; stage progression is enforced on the server."
        >
          {acc.opportunities.length === 0 ? (
            <EmptyState
              icon={<TrendingUp />}
              title="No open opportunities"
              message="Convert a qualified lead or create an opportunity to start a deal with this account."
            />
          ) : (
            <>
              <div className="qubit-scroll relative overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm" aria-label={`Open opportunities at ${acc.name}`}>
                  <thead>
                    <tr className="border-b border-slate-200/90 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                      <th scope="col" className="px-3 py-2.5">Opportunity</th>
                      <th scope="col" className="px-3 py-2.5">Stage</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Value</th>
                      <th scope="col" className="px-3 py-2.5">Probability</th>
                      <th scope="col" className="px-3 py-2.5">Close date</th>
                      <th scope="col" className="px-3 py-2.5">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {acc.opportunities.map((o) => (
                      <tr key={o.id} className="transition-colors duration-150 hover:bg-blue-50/30">
                        <td className="px-3 py-2.5">
                          <EntityLink screen="opportunity-detail" id={o.id} label={o.name} kind="opportunity" />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={o.stage} size="sm" />
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-900">{fmtCr(o.valueCr)}</td>
                        <td className="px-3 py-2.5">
                          <ProbabilityBar probability={o.probability} />
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{o.expectedClose}</td>
                        <td className="px-3 py-2.5 text-slate-600">{employeeName(o.ownerId) ?? o.ownerId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                {acc.opportunities.length} open · {fmtCr(pipelineValue)} in play.
              </p>
            </>
          )}
        </SectionCard>

        {/* 3 · Quotations */}
        <SectionCard
          title="Quotations"
          description="Pricing documents for this account — approval routing and validity are enforced on the server."
        >
          {acc.quotations.length === 0 ? (
            <EmptyState
              icon={<FileText />}
              title="No quotations yet"
              message="Build one with New quotation — catalog pricing and discount rules run on the server."
            />
          ) : (
            <>
              <div className="qubit-scroll relative overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-sm" aria-label={`Quotations for ${acc.name}`}>
                  <thead>
                    <tr className="border-b border-slate-200/90 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                      <th scope="col" className="px-3 py-2.5">Number</th>
                      <th scope="col" className="px-3 py-2.5">Status</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Total</th>
                      <th scope="col" className="px-3 py-2.5">Valid until</th>
                      <th scope="col" className="px-3 py-2.5">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {acc.quotations.map((q) => (
                      <tr key={q.id} className="transition-colors duration-150 hover:bg-blue-50/30">
                        <td className="px-3 py-2.5">
                          <EntityLink
                            screen="quotation-detail"
                            id={q.id}
                            label={<span className="font-mono text-[12px]">{q.number}</span>}
                            kind="quotation"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={q.status} size="sm" />
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-900">{fmtRupees(quoteTotal(q))}</td>
                        <td className="px-3 py-2.5 text-slate-600">{q.validUntil}</td>
                        <td className="px-3 py-2.5 text-slate-500">
                          {relTime(q.versions.length > 0 ? q.versions[q.versions.length - 1].at : q.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                {acc.quotations.length} {acc.quotations.length === 1 ? "document" : "documents"} · {openQuotes.length} still open.
              </p>
            </>
          )}
        </SectionCard>

        {/* 4 · Orders */}
        <SectionCard
          title="Orders"
          description="Orders connect to Finance (invoices) and Inventory (dispatch) — references are shown on the order itself."
        >
          {acc.orders.length === 0 ? (
            <EmptyState
              icon={<Package />}
              title="No orders yet"
              message="Orders are created from an accepted quotation — the server opens that path only."
            />
          ) : (
            <>
              <div className="qubit-scroll relative overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm" aria-label={`Orders for ${acc.name}`}>
                  <thead>
                    <tr className="border-b border-slate-200/90 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                      <th scope="col" className="px-3 py-2.5">Number</th>
                      <th scope="col" className="px-3 py-2.5">Status</th>
                      <th scope="col" className="px-3 py-2.5">Payment</th>
                      <th scope="col" className="px-3 py-2.5">Fulfillment</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Total</th>
                      <th scope="col" className="px-3 py-2.5">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {acc.orders.map((o) => (
                      <tr key={o.id} className="transition-colors duration-150 hover:bg-blue-50/30">
                        <td className="px-3 py-2.5">
                          <EntityLink
                            screen="order-detail"
                            id={o.id}
                            label={<span className="font-mono text-[12px]">{o.number}</span>}
                            kind="order"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={o.status} size="sm" />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={o.payment} size="sm" />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={o.fulfillment} size="sm" />
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-900">{fmtRupees(o.total)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{fmtDate(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                {acc.orders.length} {acc.orders.length === 1 ? "order" : "orders"} — payment and fulfillment states move forward only.
              </p>
            </>
          )}
        </SectionCard>

        {/* 5 · Visits & meetings */}
        <SectionCard
          title="Visits & meetings"
          description="Field execution and the calendar — connected to the Field Visit Planner and the enterprise Meetings module."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Field visits</h3>
              {acc.visits.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center text-xs text-muted-foreground">
                  No visits planned — use Plan visit to schedule one.
                </p>
              ) : (
                <ul className="space-y-2">
                  {acc.visits.map((v) => (
                    <li key={v.id} className="rounded-lg border border-slate-200/80 px-3.5 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <EntityLink screen="visit-detail" id={v.id} label={v.purpose} kind="visit" />
                        <StatusBadge status={v.status} size="sm" />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {fmtDateTime(v.plannedAt)} · {v.durationMin} min · {v.location}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Meetings</h3>
              {acc.meetings.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center text-xs text-muted-foreground">
                  No meetings scheduled — use Schedule meeting to book one.
                </p>
              ) : (
                <ul className="space-y-2">
                  {acc.meetings.map((m) => (
                    <li key={m.id} className="rounded-lg border border-slate-200/80 px-3.5 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[13px] font-medium text-slate-800">{m.title}</span>
                        <StatusBadge status={m.status} size="sm" />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {fmtDateTime(m.startAt)} · {m.durationMin} min · {m.location}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SectionCard>

        {/* 6 · Customer activity timeline */}
        <SectionCard
          title="Customer activity timeline"
          description="Cross-entity activity composed by the server — this account, its contacts, opportunities, quotations and orders in one timeline."
        >
          <ActivityTimeline
            entries={acc.activity.map((a) => ({
              id: a.id,
              at: a.at,
              type: a.type,
              summary: a.summary,
              outcome: a.outcome,
              source: a.source,
              actorName: resolveActor(a.actorId),
            }))}
            emptyMessage="No activity recorded for this account yet — calls, meetings, quotations and stage changes will appear here."
          />
        </SectionCard>

        <SalesAsOf
          asOfLabel={SALES_PERIOD.asOfLabel}
          note="Scoping, lifecycle rules and the composed timeline are enforced server-side — the UI only renders what you are authorized to see."
        />
      </div>

      {/* ---- Schedule meeting ---- */}
      <FormDialog
        open={meetingOpen}
        onOpenChange={setMeetingOpen}
        title={`Schedule meeting — ${acc.name}`}
        description="The meeting is created in the enterprise Meetings module and appears on the account timeline."
        submitLabel="Schedule"
        submitting={busy === "meeting"}
        onSubmit={submitMeeting}
      >
        <Field label="Title" required>
          <Input
            value={mTitle}
            onChange={(e) => {
              setMTitle(e.target.value);
              if (mError) setMError(null);
            }}
            placeholder="Quarterly review with procurement"
            className="h-9"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            <Input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} className="h-9" />
          </Field>
          <Field label="Time" required>
            <Input type="time" value={mTime} onChange={(e) => setMTime(e.target.value)} className="h-9" />
          </Field>
        </div>
        <Field label="Duration">
          <Select value={mDuration} onValueChange={setMDuration}>
            <SelectTrigger className="h-9" aria-label="Duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["15", "30", "45", "60", "90"].map((min) => (
                <SelectItem key={min} value={min}>
                  {min} minutes
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Location" hint="Leave blank for a Teams meeting — a join link is assumed automatically.">
          <Input
            value={mLocation}
            onChange={(e) => setMLocation(e.target.value)}
            placeholder="Teams meeting"
            className="h-9"
          />
        </Field>
        {mError && (
          <p role="alert" className="text-[11.5px] font-medium text-red-600">
            {mError}
          </p>
        )}
      </FormDialog>

      {/* ---- Plan visit ---- */}
      <FormDialog
        open={visitOpen}
        onOpenChange={setVisitOpen}
        title={`Plan visit — ${acc.name}`}
        description="Planned visits appear in the Field Visit Planner and on the account timeline. Execution (check-in, outcome) happens on the visit record."
        submitLabel="Plan visit"
        submitting={busy === "visit"}
        onSubmit={submitVisit}
      >
        <Field label="Contact" hint="Optional — the person the visit is for.">
          <Select value={vContact} onValueChange={setVContact}>
            <SelectTrigger className="h-9" aria-label="Contact">
              <SelectValue placeholder="No specific contact" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No specific contact</SelectItem>
              {acc.contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} — {c.designation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Purpose" required>
          <Input
            value={vPurpose}
            onChange={(e) => {
              setVPurpose(e.target.value);
              if (vError) setVError(null);
            }}
            placeholder="Quarterly ops review at the plant"
            className="h-9"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            <Input type="date" value={vDate} onChange={(e) => setVDate(e.target.value)} className="h-9" />
          </Field>
          <Field label="Time" required>
            <Input type="time" value={vTime} onChange={(e) => setVTime(e.target.value)} className="h-9" />
          </Field>
        </div>
        {vError && (
          <p role="alert" className="text-[11.5px] font-medium text-red-600">
            {vError}
          </p>
        )}
      </FormDialog>
    </div>
  );
}
