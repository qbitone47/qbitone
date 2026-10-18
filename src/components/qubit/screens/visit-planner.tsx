"use client";

import * as React from "react";
import {
  CalendarClock,
  CalendarDays,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  ListFilter,
  MapPin,
  Plus,
  Route,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard, StatusBadge } from "../primitives";
import { ConfirmDialog, Field, FormDialog } from "../dialogs";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import {
  EntityLink,
  fmtDateTime,
  fmtTime,
  relTime,
  salesPost,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  ScopeNote,
  useSalesSection,
} from "../sales/parts";

// ============================================================
// Screen 97 · Field Visit Planner — plan, assign and run
// customer visits. Location is only the visit address (no covert
// tracking). List + week views over the same server-owned states.
// ============================================================

interface VisitRow {
  id: string;
  accountId: string;
  contactId?: string;
  ownerId: string;
  ownerName: string;
  opportunityId?: string;
  plannedAt: number;
  durationMin: number;
  location: string;
  purpose: string;
  status: "Planned" | "In Progress" | "Completed" | "Cancelled";
  notes?: string;
  outcome?: string;
  account?: { id: string; name: string } | null;
  contact?: { id: string; name: string } | null;
  opportunity?: { id: string; name: string } | null;
  travel?: { id: string; destination: string; status: string } | null;
  expenses?: { id: string; amount: number }[];
}

interface VisitsPayload {
  rows: VisitRow[];
  scope: "company" | "team" | "own" | null;
}

interface FormRefsPayload {
  owners: readonly { id: string; name: string; title: string }[];
  accounts: { id: string; name: string; ownerId: string }[];
  contacts: { id: string; name: string; accountId: string }[];
  opportunities: { id: string; name: string; accountId: string }[];
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
const DURATIONS = ["60", "90", "120", "150"] as const;

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// ---------- one visit row ----------

interface VisitActions {
  onOpen: (v: VisitRow) => void;
  onReschedule: (v: VisitRow) => void;
  onCancel: (v: VisitRow) => void;
}

function VisitItem({ v, actions }: { v: VisitRow; actions: VisitActions }) {
  const planned = v.status === "Planned";
  const cancelled = v.status === "Cancelled";
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-lg border px-3.5 py-3 sm:flex-row sm:items-start",
        cancelled ? "border-slate-200/70 bg-slate-50/40" : "border-slate-200/80 bg-white",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg",
          planned ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500",
        )}
        aria-hidden
      >
        <CalendarCheck className="h-4 w-4" />
        <span className="mt-0.5 text-[10px] font-semibold leading-none tabular-nums">
          {new Date(v.plannedAt).getDate()}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {v.account ? (
            <EntityLink screen="account-detail" id={v.account.id} label={v.account.name} kind="account" />
          ) : (
            <span className="text-[13px] font-medium text-slate-700">Customer site</span>
          )}
          {v.contact && (
            <>
              <span className="text-slate-300" aria-hidden>·</span>
              <span className="truncate text-xs text-slate-500">{v.contact.name}</span>
            </>
          )}
          <StatusBadge status={v.status} size="sm" />
        </div>
        <p className={cn("mt-0.5 line-clamp-1 text-[13px]", cancelled ? "text-slate-400" : "text-slate-600")}>{v.purpose}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-400">
          <span>
            {fmtDateTime(v.plannedAt)} <span className="text-slate-300">({relTime(v.plannedAt)})</span>
          </span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{v.durationMin} min</span>
          <span aria-hidden>·</span>
          <span>{v.ownerName}</span>
          {v.opportunity && (
            <>
              <span aria-hidden>·</span>
              <EntityLink screen="opportunity-detail" id={v.opportunity.id} label={v.opportunity.name} kind="opportunity" />
            </>
          )}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {v.travel && <TravelChip travelId={v.travel.id} destination={v.travel.destination} />}
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            {v.location}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
        <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => actions.onOpen(v)}>
          Open
        </Button>
        {planned && (
          <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => actions.onReschedule(v)}>
            <CalendarClock className="h-3 w-3" aria-hidden /> Reschedule
          </Button>
        )}
        {planned && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => actions.onCancel(v)}
          >
            <XCircle className="h-3 w-3" aria-hidden /> Cancel
          </Button>
        )}
      </div>
    </li>
  );
}

/** Quiet chip linking the visit to its trip on Sales Travel (96). */
function TravelChip({ travelId, destination }: { travelId: string; destination: string }) {
  const nav = useQubitNav();
  return (
    <button
      type="button"
      onClick={() => nav.navigate("sales-travel", { travelId })}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-blue-200 hover:text-blue-700"
      aria-label={`Open trip ${destination} on Sales Travel`}
    >
      <Route className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">Trip: {destination}</span>
    </button>
  );
}

/** Week-view visit chip — opens the visit detail. */
function WeekChip({ v }: { v: VisitRow }) {
  const nav = useQubitNav();
  return (
    <button
      type="button"
      onClick={() => nav.navigate("visit-detail", { visitId: v.id })}
      className={cn(
        "block w-full rounded-md border px-2 py-1.5 text-left transition-colors",
        v.status === "Cancelled"
          ? "border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300"
          : "border-blue-100 bg-blue-50/60 text-slate-700 hover:border-blue-200 hover:bg-blue-50",
      )}
      aria-label={`Open visit — ${v.account?.name ?? "Customer site"}, ${fmtDateTime(v.plannedAt)}`}
    >
      <span className="flex items-center justify-between gap-1.5">
        <span className="truncate text-[11px] font-medium">{fmtTime(v.plannedAt)}</span>
        <span className="tabular-nums text-[10px] text-slate-400">{v.durationMin}m</span>
      </span>
      <span className="mt-0.5 block truncate text-[11.5px] font-medium">{v.account?.name ?? "Customer site"}</span>
      <span className="block truncate text-[10.5px] text-slate-400">{v.ownerName}</span>
    </button>
  );
}

function GroupEmpty({ title, message }: { title: string; message: string }) {
  return <EmptyState icon={<Users className="h-5 w-5" />} title={title} message={message} className="py-7" />;
}

// ============================================================

const EMPTY_VISIT = {
  accountId: "",
  contactId: NONE,
  opportunityId: NONE,
  ownerId: NONE,
  plannedAt: "",
  durationMin: "60",
  purpose: "",
};

export function VisitPlannerScreen() {
  const { role } = useRole();
  const nav = useQubitNav();
  const isManager = role === "administrator" || role === "dept-head";
  const { data, loading, error, forbidden, scope, reload } = useSalesSection<VisitsPayload>("visits");
  const refs = useSalesSection<FormRefsPayload>("form-refs");

  const combinedError = error ?? refs.error;
  const retryAll = () => {
    reload();
    refs.reload();
  };

  // Plan visit dialog
  const [planOpen, setPlanOpen] = React.useState(false);
  const [plan, setPlan] = React.useState(EMPTY_VISIT);
  const [planError, setPlanError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Reschedule dialog
  const [reschedTarget, setReschedTarget] = React.useState<VisitRow | null>(null);
  const [reschedInput, setReschedInput] = React.useState("");
  const [reschedError, setReschedError] = React.useState<string | null>(null);

  // Cancel confirm
  const [cancelTarget, setCancelTarget] = React.useState<VisitRow | null>(null);
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  // Filters
  const [ownerFilter, setOwnerFilter] = React.useState(NONE);
  const [statusFilter, setStatusFilter] = React.useState(NONE);

  // Cancelled group collapse
  const [showCancelled, setShowCancelled] = React.useState(false);

  const rows = data?.rows ?? [];

  const filtered = React.useMemo(
    () =>
      rows.filter(
        (v) =>
          (ownerFilter === NONE || v.ownerId === ownerFilter) &&
          (statusFilter === NONE || v.status === statusFilter),
      ),
    [rows, ownerFilter, statusFilter],
  );
  const isFiltered = ownerFilter !== NONE || statusFilter !== NONE;

  const planned = filtered.filter((v) => v.status === "Planned").sort((a, b) => a.plannedAt - b.plannedAt);
  const inProgress = filtered.filter((v) => v.status === "In Progress").sort((a, b) => a.plannedAt - b.plannedAt);
  const completedRecently = filtered
    .filter((v) => v.status === "Completed")
    .sort((a, b) => b.plannedAt - a.plannedAt)
    .slice(0, 6);
  const completedTotal = filtered.filter((v) => v.status === "Completed").length;
  const cancelled = filtered.filter((v) => v.status === "Cancelled").sort((a, b) => b.plannedAt - a.plannedAt);

  // Week view: today + the next 6 days
  const weekDays = React.useMemo(() => {
    const t0 = startOfDay(Date.now());
    return Array.from({ length: 7 }, (_, i) => t0 + i * 86_400_000);
  }, []);
  const weekVisits = React.useMemo(() => {
    const map = new Map<number, VisitRow[]>();
    for (const day of weekDays) map.set(day, []);
    for (const v of filtered) {
      const d0 = startOfDay(v.plannedAt);
      if (map.has(d0)) map.get(d0)!.push(v);
    }
    for (const day of weekDays) map.get(day)!.sort((a, b) => a.plannedAt - b.plannedAt);
    return map;
  }, [filtered, weekDays]);

  const contactOptions = plan.accountId ? (refs.data?.contacts ?? []).filter((c) => c.accountId === plan.accountId) : [];
  const oppOptions = plan.accountId ? (refs.data?.opportunities ?? []).filter((o) => o.accountId === plan.accountId) : [];

  const actions: VisitActions = {
    onOpen: (v) => nav.navigate("visit-detail", { visitId: v.id }),
    onReschedule: (v) => {
      setReschedInput(toLocalInput(Math.max(v.plannedAt, Date.now() + 3_600_000)));
      setReschedError(null);
      setReschedTarget(v);
    },
    onCancel: (v) => {
      setCancelError(null);
      setCancelTarget(v);
    },
  };

  const openPlan = () => {
    setPlan(EMPTY_VISIT);
    setPlanError(null);
    setPlanOpen(true);
  };

  const submitPlan = async () => {
    const plannedAt = fromLocalInput(plan.plannedAt);
    if (!plan.accountId || !plannedAt || !plan.purpose.trim()) {
      setPlanError("Customer, date/time and purpose are required.");
      return;
    }
    setSubmitting(true);
    setPlanError(null);
    try {
      const res = await salesPost(
        "visit.create",
        {
          accountId: plan.accountId,
          contactId: plan.contactId === NONE ? undefined : plan.contactId,
          opportunityId: plan.opportunityId === NONE ? undefined : plan.opportunityId,
          ownerId: plan.ownerId === NONE ? undefined : plan.ownerId,
          plannedAt,
          durationMin: Number(plan.durationMin),
          purpose: plan.purpose.trim(),
        },
        role,
      );
      toast({ title: res.message ?? "Visit planned — it appears in the Field Visit Planner." });
      setPlanOpen(false);
      setPlan(EMPTY_VISIT);
      reload();
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "The visit could not be planned.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitReschedule = async () => {
    if (!reschedTarget) return;
    const plannedAt = fromLocalInput(reschedInput);
    if (!plannedAt) {
      setReschedError("Pick a date and time.");
      return;
    }
    setSubmitting(true);
    setReschedError(null);
    try {
      const res = await salesPost("visit.reschedule", { id: reschedTarget.id, plannedAt }, role);
      toast({ title: res.message ?? "Visit rescheduled." });
      setReschedTarget(null);
      reload();
    } catch (err) {
      setReschedError(err instanceof Error ? err.message : "The visit could not be rescheduled.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await salesPost("visit.cancel", { id: cancelTarget.id }, role);
      toast({ title: res.message ?? "Visit cancelled." });
      setCancelTarget(null);
      reload();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "The visit could not be cancelled.");
    } finally {
      setCancelling(false);
    }
  };

  if (forbidden) {
    return (
      <SalesGate screenName="Field Visit Planner">
        <></>
      </SalesGate>
    );
  }

  const renderVisit = (v: VisitRow) => <VisitItem key={v.id} v={v} actions={actions} />;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Field Visit Planner" }]}
        title="Field Visit Planner"
        description="Plan, assign and run customer visits. Location is used only for the visit address — no covert tracking."
        actions={
          <Button size="sm" className="h-9 gap-1.5" onClick={openPlan}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Plan visit
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
                  <SelectTrigger className="h-9 w-[190px] rounded-lg" aria-label="Filter by salesperson">
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
                <SelectTrigger className="h-9 w-[170px] rounded-lg" aria-label="Filter by status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All statuses</SelectItem>
                  <SelectItem value="Planned">Planned</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <p className="ml-auto text-xs tabular-nums text-muted-foreground" role="status">
                {filtered.length} of {rows.length} visit{rows.length === 1 ? "" : "s"} in scope{isFiltered ? " after filters" : ""}
              </p>
            </div>
            <ScopeNote scope={scope} what="visits" />
          </div>

          <Tabs defaultValue="list">
            <TabsList className="h-9 rounded-lg">
              <TabsTrigger value="list" className="gap-1.5 rounded-md px-3 text-xs">
                <ListFilter className="h-3.5 w-3.5" aria-hidden /> List
              </TabsTrigger>
              <TabsTrigger value="week" className="gap-1.5 rounded-md px-3 text-xs">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Week
              </TabsTrigger>
            </TabsList>

            {/* ---------------- List view ---------------- */}
            <TabsContent value="list" className="mt-4 space-y-4">
              <SectionCard title={`Planned (${planned.length})`} description="Scheduled visits, soonest first.">
                {planned.length === 0 ? (
                  <GroupEmpty
                    title="Nothing planned ahead"
                    message="No visits planned — plan one from here or from any account, contact or opportunity record."
                  />
                ) : (
                  <ul className="space-y-2.5">{planned.map(renderVisit)}</ul>
                )}
              </SectionCard>

              <SectionCard title={`In progress (${inProgress.length})`} description="Check-ins recorded — complete them with an outcome when done.">
                {inProgress.length === 0 ? (
                  <GroupEmpty title="No visits in progress" message="Starting a visit from its detail page records the check-in here." />
                ) : (
                  <ul className="space-y-2.5">{inProgress.map(renderVisit)}</ul>
                )}
              </SectionCard>

              <SectionCard
                title={`Completed recently (${completedRecently.length}${completedTotal > 6 ? ` of ${completedTotal}` : ""})`}
                description="The last six completed visits, newest first — outcomes live on the customer timeline."
              >
                {completedRecently.length === 0 ? (
                  <GroupEmpty title="No completed visits yet" message="Completed visits keep their outcome and next action here." />
                ) : (
                  <ul className="space-y-2.5">{completedRecently.map(renderVisit)}</ul>
                )}
              </SectionCard>

              <SectionCard
                title={`Cancelled (${cancelled.length})`}
                description="Cancelled before start — kept for the record."
                actions={
                  cancelled.length > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs text-slate-500"
                      aria-expanded={showCancelled}
                      onClick={() => setShowCancelled((s) => !s)}
                    >
                      {showCancelled ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                      {showCancelled ? "Hide" : "Show"}
                    </Button>
                  ) : undefined
                }
              >
                {cancelled.length === 0 ? (
                  <GroupEmpty title="No cancelled visits" message="Cancelled visits are kept here for the record." />
                ) : showCancelled ? (
                  <ul className="space-y-2.5">{cancelled.map(renderVisit)}</ul>
                ) : (
                  <p className="text-xs text-slate-400">{cancelled.length} cancelled visit{cancelled.length === 1 ? "" : "s"} hidden — use Show to review them.</p>
                )}
              </SectionCard>
            </TabsContent>

            {/* ---------------- Week view ---------------- */}
            <TabsContent value="week" className="mt-4">
              <SectionCard
                title="This week"
                description="Today plus the next 6 days — quiet day columns, no calendar engine. Chips open the visit."
              >
                <div className="-mx-4 relative overflow-x-auto px-4 md:-mx-5 md:px-5 qubit-scroll">
                  <div className="grid min-w-[840px] grid-cols-7 gap-2">
                    {weekDays.map((day, i) => {
                      const d = new Date(day);
                      const items = weekVisits.get(day) ?? [];
                      return (
                        <div
                          key={day}
                          className={cn(
                            "rounded-lg border p-2",
                            i === 0 ? "border-blue-200 bg-blue-50/40" : "border-slate-200/80 bg-slate-50/40",
                          )}
                        >
                          <div className="mb-2 flex items-baseline justify-between gap-1 px-0.5">
                            <span className={cn("text-[10.5px] font-semibold uppercase tracking-wide", i === 0 ? "text-blue-700" : "text-slate-400")}>
                              {i === 0 ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short" })}
                            </span>
                            <span className="text-[13px] font-bold tabular-nums text-slate-700">{d.getDate()}</span>
                          </div>
                          <div className="space-y-1.5">
                            {items.length === 0 ? (
                              <p className="px-0.5 py-2 text-[10.5px] text-slate-300">No visits</p>
                            ) : (
                              items.map((v) => <WeekChip key={v.id} v={v} />)
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </SectionCard>
            </TabsContent>
          </Tabs>

          <SalesAsOf asOfLabel={SALES_PERIOD.asOfLabel} note="Starting, completing and rescheduling happen from the visit or its detail page — the planner reflects server states." />
        </div>
      )}

      {/* Plan visit dialog */}
      <FormDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        title="Plan visit"
        description="Location is used only for the visit address — the visit record carries the address, not anyone's movement."
        onSubmit={submitPlan}
        submitLabel="Plan visit"
        submitting={submitting}
        wide
      >
        <Field label="Customer" required>
          <Select
            value={plan.accountId || undefined}
            onValueChange={(v) => setPlan((p) => ({ ...p, accountId: v, contactId: NONE, opportunityId: NONE }))}
          >
            <SelectTrigger className="h-9 rounded-lg" aria-label="Customer account">
              <SelectValue placeholder="Choose an account" />
            </SelectTrigger>
            <SelectContent>
              {(refs.data?.accounts ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact" hint={plan.accountId ? undefined : "Pick a customer first."}>
            <Select
              value={plan.contactId === NONE ? NONE : plan.contactId}
              onValueChange={(v) => setPlan((p) => ({ ...p, contactId: v }))}
              disabled={!plan.accountId}
            >
              <SelectTrigger className="h-9 rounded-lg" aria-label="Contact">
                <SelectValue placeholder="No contact" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No contact</SelectItem>
                {contactOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Opportunity" hint={plan.accountId ? undefined : "Pick a customer first."}>
            <Select
              value={plan.opportunityId === NONE ? NONE : plan.opportunityId}
              onValueChange={(v) => setPlan((p) => ({ ...p, opportunityId: v }))}
              disabled={!plan.accountId}
            >
              <SelectTrigger className="h-9 rounded-lg" aria-label="Opportunity">
                <SelectValue placeholder="No opportunity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No opportunity</SelectItem>
                {oppOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date & time" required>
            <Input
              type="datetime-local"
              value={plan.plannedAt}
              onChange={(e) => setPlan((p) => ({ ...p, plannedAt: e.target.value }))}
              className="h-9 rounded-lg"
            />
          </Field>
          <Field label="Duration">
            <Select value={plan.durationMin} onValueChange={(v) => setPlan((p) => ({ ...p, durationMin: v }))}>
              <SelectTrigger className="h-9 rounded-lg" aria-label="Duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {isManager && (
          <Field label="Salesperson" hint="Defaults to you when left on Myself — assignment happens at planning time.">
            <Select value={plan.ownerId} onValueChange={(v) => setPlan((p) => ({ ...p, ownerId: v }))}>
              <SelectTrigger className="h-9 rounded-lg" aria-label="Salesperson">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Myself</SelectItem>
                {(refs.data?.owners ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name} — {o.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field label="Purpose" required hint="What the visit is for — it becomes the visit's working title.">
          <Textarea
            value={plan.purpose}
            onChange={(e) => setPlan((p) => ({ ...p, purpose: e.target.value }))}
            placeholder="e.g. Security questionnaire walkthrough with IT risk team"
            rows={3}
            className="rounded-lg"
          />
        </Field>
        {planError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {planError}
          </p>
        )}
      </FormDialog>

      {/* Reschedule dialog */}
      <FormDialog
        open={reschedTarget !== null}
        onOpenChange={(open) => {
          if (!open) setReschedTarget(null);
        }}
        title="Reschedule visit"
        description={reschedTarget ? `${reschedTarget.account?.name ?? "Customer site"} — ${reschedTarget.purpose}` : undefined}
        onSubmit={submitReschedule}
        submitLabel="Reschedule"
        submitting={submitting}
      >
        <Field label="New date & time" required hint="The server only accepts a future date and time.">
          <Input
            type="datetime-local"
            value={reschedInput}
            onChange={(e) => setReschedInput(e.target.value)}
            className="h-9 rounded-lg"
          />
        </Field>
        {reschedError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {reschedError}
          </p>
        )}
      </FormDialog>

      {/* Cancel visit confirm */}
      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title="Cancel this visit?"
        description={
          cancelTarget
            ? `${cancelTarget.account?.name ?? "Customer site"} — ${fmtDateTime(cancelTarget.plannedAt)}. The visit is kept as Cancelled for the record.`
            : ""
        }
        confirmLabel="Cancel visit"
        destructive
        onConfirm={submitCancel}
      >
        {cancelError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {cancelError}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
