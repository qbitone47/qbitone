"use client";

import * as React from "react";
import { CalendarRange, MapPin, Plane, Plus, ReceiptText, Route, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard, StatusBadge } from "../primitives";
import { ConfirmDialog, Field, FormDialog } from "../dialogs";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import {
  EntityLink,
  fmtDate,
  fmtDateTime,
  fmtRupees,
  salesPost,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  ScopeNote,
  useSalesSection,
} from "../sales/parts";

// ============================================================
// Screen 96 · Sales Travel — one plan per trip, no separate
// travel identity. Plans connect to Field Visit Planner (97)
// visits and become expenses (99) that route to Finance through
// the enterprise approval matrix. States are server-owned.
// ============================================================

interface TravelVisitRef {
  id: string;
  accountId: string;
  plannedAt: number;
  purpose: string;
  status: string;
}

interface TravelExpenseRef {
  id: string;
  amount: number;
  category: string;
  status: string;
  description: string;
}

interface TravelRow {
  id: string;
  ownerId: string;
  ownerName: string;
  destination: string;
  purpose: string;
  startAt: number;
  endAt: number;
  estimatedCost: number;
  status: "Planned" | "Ongoing" | "Completed" | "Cancelled";
  notes?: string;
  visits: TravelVisitRef[];
  expenses: TravelExpenseRef[];
}

interface TravelPayload {
  rows: TravelRow[];
  scope: "company" | "team" | "own" | null;
}

interface FormRefsPayload {
  owners: readonly { id: string; name: string; title: string }[];
  accounts: { id: string; name: string; ownerId: string }[];
}

// ---------- datetime-local helpers ----------

const pad2 = (n: number) => String(n).padStart(2, "0");

const toLocalInput = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const fromLocalInput = (v: string): number | undefined => {
  if (!v) return undefined;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : undefined;
};

const NONE = "none";

const CATEGORIES = ["Travel", "Fuel", "Hotel", "Client Entertainment", "Communication", "Other"] as const;

// ---------- one travel plan card ----------

interface PlanActions {
  onCancel: (t: TravelRow) => void;
  onExpense: (t: TravelRow) => void;
}

function TravelPlanCard({ t, actions, accountName }: { t: TravelRow; actions: PlanActions; accountName: (id: string) => string }) {
  const past = t.status !== "Planned";
  return (
    <li
      className={cn(
        "rounded-lg border px-3.5 py-3.5",
        t.status === "Cancelled" ? "border-slate-200/70 bg-slate-50/40" : "border-slate-200/80 bg-white",
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <span
          className={cn(
            "qubit-icon-tile mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4",
            past ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-700",
          )}
          aria-hidden
        >
          {t.status === "Cancelled" ? <XCircle className="h-4 w-4" /> : <Plane className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("text-[13.5px] font-semibold", t.status === "Cancelled" ? "text-slate-500" : "text-slate-800")}>
              {t.destination}
            </p>
            <span className="text-xs text-slate-400" aria-hidden>·</span>
            <span className={cn("min-w-0 flex-1 basis-40 truncate text-[13px]", t.status === "Cancelled" ? "text-slate-400" : "text-slate-600")}>
              {t.purpose}
            </span>
            <StatusBadge status={t.status} size="sm" />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-400">
            <span>{fmtDate(t.startAt)} – {fmtDate(t.endAt)}</span>
            <span aria-hidden>·</span>
            <span>{t.ownerName}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">Est. {fmtRupees(t.estimatedCost)}</span>
          </p>

          {t.visits.length > 0 && (
            <div className="mt-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Linked visits</p>
              <ul className="mt-1 space-y-1">
                {t.visits.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                    <Route className="h-3 w-3 shrink-0 text-slate-300" aria-hidden />
                    <EntityLink screen="visit-detail" id={v.id} label={accountName(v.accountId)} kind="visit" />
                    <span className="min-w-0 flex-1 basis-32 truncate">{v.purpose}</span>
                    <span className="tabular-nums text-slate-400">{fmtDateTime(v.plannedAt)}</span>
                    <StatusBadge status={v.status} size="sm" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
            <ReceiptText className="h-3 w-3 shrink-0 text-slate-300" aria-hidden />
            <span className="tabular-nums">
              {t.expenses.length} linked expense{t.expenses.length === 1 ? "" : "s"} · {fmtRupees(t.expenses.reduce((s, e) => s + e.amount, 0))} recorded
            </span>
          </p>

          {t.notes && (
            <p className="mt-2 border-l-2 border-slate-100 pl-2.5 text-xs leading-relaxed text-slate-500">
              <span className="font-medium text-slate-600">Notes:</span> {t.notes}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 lg:shrink-0 lg:justify-end">
          <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => actions.onExpense(t)}>
            <ReceiptText className="h-3 w-3" aria-hidden /> Record expense
          </Button>
          {t.status === "Planned" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => actions.onCancel(t)}
            >
              <XCircle className="h-3 w-3" aria-hidden /> Cancel
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function GroupEmpty({ title, message }: { title: string; message: string }) {
  return <EmptyState icon={<CalendarRange className="h-5 w-5" />} title={title} message={message} className="py-7" />;
}

// ============================================================

const EMPTY_PLAN = {
  destination: "",
  purpose: "",
  startAt: "",
  endAt: "",
  estimatedCost: "",
  ownerId: NONE,
  notes: "",
};

export function SalesTravelScreen() {
  const { role } = useRole();
  const isManager = role === "administrator" || role === "dept-head";
  const { data, loading, error, forbidden, scope, reload } = useSalesSection<TravelPayload>("travel");
  const refs = useSalesSection<FormRefsPayload>("form-refs");

  const combinedError = error ?? refs.error;
  const retryAll = () => {
    reload();
    refs.reload();
  };

  // Plan travel dialog
  const [planOpen, setPlanOpen] = React.useState(false);
  const [plan, setPlan] = React.useState(EMPTY_PLAN);
  const [planError, setPlanError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Cancel confirm
  const [cancelTarget, setCancelTarget] = React.useState<TravelRow | null>(null);
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  // Record expense dialog
  const [expenseTarget, setExpenseTarget] = React.useState<TravelRow | null>(null);
  const [expCategory, setExpCategory] = React.useState<string>("Travel");
  const [expAmount, setExpAmount] = React.useState("");
  const [expDescription, setExpDescription] = React.useState("");
  const [expError, setExpError] = React.useState<string | null>(null);

  // Filters
  const [ownerFilter, setOwnerFilter] = React.useState(NONE);
  const [statusFilter, setStatusFilter] = React.useState(NONE);

  const rows = data?.rows ?? [];
  const accountName = React.useCallback(
    (id: string) => refs.data?.accounts.find((a) => a.id === id)?.name ?? "Customer site",
    [refs.data],
  );

  const filtered = rows.filter(
    (t) =>
      (ownerFilter === NONE || t.ownerId === ownerFilter) &&
      (statusFilter === NONE || t.status === statusFilter),
  );
  const upcoming = filtered.filter((t) => t.status === "Planned").sort((a, b) => a.startAt - b.startAt);
  const past = filtered.filter((t) => t.status !== "Planned").sort((a, b) => b.startAt - a.startAt);
  const isFiltered = ownerFilter !== NONE || statusFilter !== NONE;

  const actions: PlanActions = {
    onCancel: (t) => {
      setCancelError(null);
      setCancelTarget(t);
    },
    onExpense: (t) => {
      setExpCategory("Travel");
      setExpAmount("");
      setExpDescription(`Trip — ${t.destination}`);
      setExpError(null);
      setExpenseTarget(t);
    },
  };

  const openPlan = () => {
    setPlan(EMPTY_PLAN);
    setPlanError(null);
    setPlanOpen(true);
  };

  const submitPlan = async () => {
    const startAt = fromLocalInput(plan.startAt);
    const endAt = fromLocalInput(plan.endAt);
    if (!plan.destination.trim() || !plan.purpose.trim() || !startAt || !endAt) {
      setPlanError("Destination, purpose and both dates are required.");
      return;
    }
    if (endAt < startAt) {
      setPlanError("The end of the trip cannot be before the start.");
      return;
    }
    setSubmitting(true);
    setPlanError(null);
    try {
      const res = await salesPost(
        "travel.create",
        {
          destination: plan.destination.trim(),
          purpose: plan.purpose.trim(),
          startAt,
          endAt,
          estimatedCost: plan.estimatedCost ? Number(plan.estimatedCost) : undefined,
          ownerId: plan.ownerId === NONE ? undefined : plan.ownerId,
          notes: plan.notes.trim() || undefined,
        },
        role,
      );
      toast({ title: res.message ?? "Travel plan created — link visits to it from the planner." });
      setPlanOpen(false);
      setPlan(EMPTY_PLAN);
      reload();
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "The travel plan could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await salesPost("travel.cancel", { id: cancelTarget.id }, role);
      toast({ title: res.message ?? "Travel plan cancelled." });
      setCancelTarget(null);
      reload();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "The travel plan could not be cancelled.");
    } finally {
      setCancelling(false);
    }
  };

  const submitExpense = async () => {
    if (!expenseTarget) return;
    const amount = Number(expAmount);
    if (!expCategory) {
      setExpError("Choose a category.");
      return;
    }
    if (!amount || amount <= 0) {
      setExpError("Enter a positive amount.");
      return;
    }
    if (!expDescription.trim() || expDescription.trim().length < 4) {
      setExpError("Describe the expense — it travels with the claim to Finance.");
      return;
    }
    setSubmitting(true);
    setExpError(null);
    try {
      await salesPost(
        "expense.create",
        {
          category: expCategory,
          amount,
          description: expDescription.trim(),
          travelId: expenseTarget.id,
        },
        role,
      );
      toast({ title: "Expense saved as draft — submit it from Sales Expenses." });
      setExpenseTarget(null);
      reload();
    } catch (err) {
      setExpError(err instanceof Error ? err.message : "The expense could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };

  if (forbidden) {
    return (
      <SalesGate screenName="Sales Travel">
        <></>
      </SalesGate>
    );
  }

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Sales Travel" }]}
        title="Sales Travel"
        description="Travel planning connected to visits, meetings, expenses and opportunities — one plan per trip, no separate travel identity."
        actions={
          <Button size="sm" className="h-9 gap-1.5" onClick={openPlan}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Plan travel
          </Button>
        }
      />

      {combinedError && <SalesErrorBanner message={combinedError} onRetry={retryAll} />}
      {loading && <SalesSkeleton rows={4} />}

      {data && !loading && (
        <div className="space-y-4">
          {/* Filters + scope */}
          <div className="qubit-card space-y-2.5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {isManager && (
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger className="h-9 w-[190px] rounded-lg" aria-label="Filter by owner">
                    <SelectValue placeholder="All salespeople" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>All salespeople</SelectItem>
                    {(refs.data?.owners ?? []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[160px] rounded-lg" aria-label="Filter by status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All statuses</SelectItem>
                  <SelectItem value="Planned">Planned</SelectItem>
                  <SelectItem value="Ongoing">Ongoing</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <p className="ml-auto text-xs tabular-nums text-muted-foreground" role="status">
                {filtered.length} of {rows.length} plan{rows.length === 1 ? "" : "s"} in scope{isFiltered ? " after filters" : ""}
              </p>
            </div>
            <ScopeNote scope={scope} what="travel plans" />
          </div>

          {/* Upcoming */}
          <SectionCard title={`Upcoming (${upcoming.length})`} description="Planned trips, earliest start first.">
            {upcoming.length === 0 ? (
              <GroupEmpty
                title="No travel planned"
                message="No travel planned — plan a trip or link visits from the planner."
              />
            ) : (
              <ul className="space-y-2.5">
                {upcoming.map((t) => (
                  <TravelPlanCard key={t.id} t={t} actions={actions} accountName={accountName} />
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Past */}
          <SectionCard
            title={`Past (${past.length})`}
            description="Ongoing, completed and cancelled trips — kept for the expense trail, newest first."
          >
            {past.length === 0 ? (
              <GroupEmpty title="No past travel" message="Completed and cancelled trips appear here with their expenses." />
            ) : (
              <ul className="space-y-2.5">
                {past.map((t) => (
                  <TravelPlanCard key={t.id} t={t} actions={actions} accountName={accountName} />
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Connection captions — how travel stays one system */}
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>
              Visits are planned in the Field Visit Planner (97) and linked here; travel costs become expenses (99) that
              route to Finance through the approval matrix.
            </span>
          </p>

          <SalesAsOf asOfLabel={SALES_PERIOD.asOfLabel} note="Trip states (Planned → Ongoing → Completed) are owned by the server; the plan is cancelled without touching its linked visits." />
        </div>
      )}

      {/* Plan travel dialog */}
      <FormDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        title="Plan travel"
        description="One plan per trip. Visits are linked from the Field Visit Planner — the trip carries them and their costs."
        onSubmit={submitPlan}
        submitLabel="Create plan"
        submitting={submitting}
        wide
      >
        <Field label="Destination" required>
          <Input
            value={plan.destination}
            onChange={(e) => setPlan((p) => ({ ...p, destination: e.target.value }))}
            placeholder="e.g. Indore"
            className="h-9 rounded-lg"
          />
        </Field>
        <Field label="Purpose" required>
          <Input
            value={plan.purpose}
            onChange={(e) => setPlan((p) => ({ ...p, purpose: e.target.value }))}
            placeholder="e.g. Galaxy Foods qualification visit"
            className="h-9 rounded-lg"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start" required>
            <Input
              type="datetime-local"
              value={plan.startAt}
              onChange={(e) => setPlan((p) => ({ ...p, startAt: e.target.value }))}
              className="h-9 rounded-lg"
            />
          </Field>
          <Field label="End" required>
            <Input
              type="datetime-local"
              value={plan.endAt}
              onChange={(e) => setPlan((p) => ({ ...p, endAt: e.target.value }))}
              className="h-9 rounded-lg"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Estimated cost (₹)" hint="Rough budget for the trip — actuals are recorded as expenses.">
            <Input
              type="number"
              min={0}
              value={plan.estimatedCost}
              onChange={(e) => setPlan((p) => ({ ...p, estimatedCost: e.target.value }))}
              placeholder="0"
              className="h-9 rounded-lg tabular-nums"
            />
          </Field>
          {isManager && (
            <Field label="Owner" hint="Defaults to you when left on Myself.">
              <Select value={plan.ownerId} onValueChange={(v) => setPlan((p) => ({ ...p, ownerId: v }))}>
                <SelectTrigger className="h-9 rounded-lg" aria-label="Trip owner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Myself</SelectItem>
                  {(refs.data?.owners ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
        <Field label="Notes">
          <Textarea
            value={plan.notes}
            onChange={(e) => setPlan((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Travel mode, stay, anything the trip needs to carry"
            rows={2}
            className="rounded-lg"
          />
        </Field>
        {planError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {planError}
          </p>
        )}
      </FormDialog>

      {/* Cancel travel confirm */}
      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title="Cancel this travel plan?"
        description={
          cancelTarget
            ? `${cancelTarget.destination} — ${fmtDate(cancelTarget.startAt)} to ${fmtDate(cancelTarget.endAt)}. Linked visits stay on the planner; only the trip is cancelled.`
            : ""
        }
        confirmLabel="Cancel trip"
        destructive
        onConfirm={submitCancel}
      >
        {cancelError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {cancelError}
          </p>
        )}
      </ConfirmDialog>

      {/* Record expense dialog */}
      <FormDialog
        open={expenseTarget !== null}
        onOpenChange={(open) => {
          if (!open) setExpenseTarget(null);
        }}
        title="Record trip expense"
        description={
          expenseTarget
            ? `Draft expense linked to the ${expenseTarget.destination} trip — submit it from Sales Expenses when the receipt is ready.`
            : undefined
        }
        onSubmit={submitExpense}
        submitLabel="Save draft"
        submitting={submitting}
      >
        <Field label="Category" required>
          <Select value={expCategory} onValueChange={setExpCategory}>
            <SelectTrigger className="h-9 rounded-lg" aria-label="Expense category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Amount (₹)" required>
          <Input
            type="number"
            min={0}
            value={expAmount}
            onChange={(e) => setExpAmount(e.target.value)}
            placeholder="0"
            className="h-9 rounded-lg tabular-nums"
          />
        </Field>
        <Field label="Description" required hint="Prefilled from the trip — adjust if needed.">
          <Input
            value={expDescription}
            onChange={(e) => setExpDescription(e.target.value)}
            className="h-9 rounded-lg"
          />
        </Field>
        {expError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {expError}
          </p>
        )}
      </FormDialog>
    </div>
  );
}
