"use client";

import * as React from "react";
import {
  BadgeCheck,
  Banknote,
  ClipboardCheck,
  NotebookPen,
  Plus,
  Receipt,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PageHeader } from "../page-header";
import { DataTable, type Column } from "../data-table";
import { EmptyState, FilterBar, StatTile, StatusBadge } from "../primitives";
import { ConfirmDialog, Field, FormDialog } from "../dialogs";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import {
  EntityLink,
  fmtDate,
  fmtRupees,
  relTime,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  ScopeNote,
  useSalesSection,
  salesPost,
} from "../sales/parts";

// ============================================================
// Screen 99 · Sales Expenses — expense capture for sales work.
// Claims route through the enterprise Approval Matrix (09) and
// Finance remains the financial source of truth — this screen is
// capture + status, never a second expense ledger. Decisions are
// made in My Approvals (46); this queue mirrors status only.
// Data: /api/sales?section=expenses · mutations: expense.create,
// expense.submit, expense.delete (no edit — drafts only).
// ============================================================

interface ExpenseRow {
  id: string;
  employeeId: string;
  date: number;
  category: string;
  amount: number;
  description: string;
  opportunityId?: string;
  visitId?: string;
  travelId?: string;
  status: string;
  receiptName?: string;
  submittedAt?: number;
  decidedAt?: number;
  decidedBy?: string;
  note?: string;
  employeeName: string;
  opportunity: { id: string; name: string } | null;
  visit: { id: string; purpose: string; account: { id: string; name: string } | null } | null;
  travel: { id: string; destination: string; purpose: string } | null;
}

interface ExpensesPayload {
  rows: ExpenseRow[];
  scope: "company" | "team" | "own";
  canDecide: boolean;
}

// Ref loads for the "Related to" grouped select (scoped server-side)
interface FormRefsPayload {
  opportunities: { id: string; name: string }[];
}
interface VisitOptionRow {
  id: string;
  purpose: string;
  plannedAt: number;
  account: { id: string; name: string } | null;
}
interface TravelOptionRow {
  id: string;
  destination: string;
  purpose: string;
  startAt: number;
}

const EXPENSE_CATEGORIES = ["Travel", "Fuel", "Hotel", "Client Entertainment", "Communication", "Other"] as const;
const EXPENSE_STATUSES = ["Draft", "Submitted", "Approved", "Reimbursed", "Rejected"] as const;
const STATUS_ORDER: Record<string, number> = { Draft: 0, Submitted: 1, Approved: 2, Reimbursed: 3, Rejected: 4 };

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Category chip — quiet neutral treatment; the word itself carries the meaning. */
function CategoryChip({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      {category}
    </span>
  );
}

/** Travel has no EntityLink screen mapping — a quiet nav button with the same visual grammar. */
function TravelLink({ id, label }: { id: string; label: string }) {
  const nav = useQubitNav();
  return (
    <button
      type="button"
      onClick={() => nav.navigate("sales-travel", { travelId: id })}
      className="inline-flex max-w-full items-center gap-1 truncate text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700"
      aria-label={`Open travel plan ${label}`}
    >
      <span className="truncate">{label}</span>
      <span aria-hidden className="text-[11px]">↗</span>
    </button>
  );
}

/** The one linked record per expense — visit, else travel, else opportunity. */
function LinkedRecord({ row }: { row: ExpenseRow }) {
  if (row.visit) {
    return (
      <EntityLink
        screen="visit-detail"
        id={row.visit.id}
        label={`Visit — ${row.visit.account?.name ?? row.visit.purpose}`}
        kind="visit"
      />
    );
  }
  if (row.travel) {
    return <TravelLink id={row.travel.id} label={`Travel — ${row.travel.destination}`} />;
  }
  if (row.opportunity) {
    return <EntityLink screen="opportunity-detail" id={row.opportunity.id} label={row.opportunity.name} kind="opportunity" />;
  }
  return <span className="text-slate-400">—</span>;
}

export function SalesExpensesScreen() {
  const { role } = useRole();
  const { data, loading, error, forbidden, scope, reload } = useSalesSection<ExpensesPayload>("expenses");
  const { data: refs } = useSalesSection<FormRefsPayload>("form-refs");
  const { data: visitsData } = useSalesSection<{ rows: VisitOptionRow[] }>("visits");
  const { data: travelData } = useSalesSection<{ rows: TravelOptionRow[] }>("travel");

  const isManager = role === "administrator" || role === "dept-head";
  const rows = data?.rows ?? [];

  // ---------- filters ----------
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [employeeFilter, setEmployeeFilter] = React.useState("all");

  const employees = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (!seen.has(r.employeeId)) seen.set(r.employeeId, r.employeeName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = React.useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
        if (isManager && employeeFilter !== "all" && r.employeeId !== employeeFilter) return false;
        return true;
      }),
    [rows, statusFilter, categoryFilter, employeeFilter, isManager],
  );

  // ---------- summary band ----------
  const draftCount = rows.filter((r) => r.status === "Draft").length;
  const submittedCount = rows.filter((r) => r.status === "Submitted").length;
  const approvedValue = rows.filter((r) => r.status === "Approved").reduce((s, r) => s + r.amount, 0);
  const reimbursedValue = rows.filter((r) => r.status === "Reimbursed").reduce((s, r) => s + r.amount, 0);

  // ---------- new expense form ----------
  const [formOpen, setFormOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<string>("Travel");
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(todayISO());
  const [description, setDescription] = React.useState("");
  const [related, setRelated] = React.useState("none");
  const [receiptName, setReceiptName] = React.useState("");

  const openForm = () => {
    setCategory("Travel");
    setAmount("");
    setDate(todayISO());
    setDescription("");
    setRelated("none");
    setReceiptName("");
    setFormError(null);
    setFormOpen(true);
  };

  const submitForm = async () => {
    const parsedAmount = Number(amount);
    if (amount.trim() === "" || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError("Enter a positive amount.");
      return;
    }
    if (description.trim().length < 4) {
      setFormError("Describe the expense — it travels with the claim to Finance.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const [kind, id] = related === "none" ? [] : related.split(":");
      const res = await salesPost(
        "expense.create",
        {
          category,
          amount: parsedAmount,
          date: date ? new Date(`${date}T00:00:00`).getTime() : undefined,
          description: description.trim(),
          opportunityId: kind === "opp" ? id : undefined,
          visitId: kind === "vis" ? id : undefined,
          travelId: kind === "tvl" ? id : undefined,
          receiptName: receiptName.trim() || undefined,
        },
        role,
      );
      toast({ title: res.message ?? "Expense saved as draft — submit it when ready." });
      setFormOpen(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "The expense could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- row actions (state-aware; server re-checks ownership) ----------
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [deleteRow, setDeleteRow] = React.useState<ExpenseRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const submitExpense = async (row: ExpenseRow) => {
    setBusyId(row.id);
    try {
      const res = await salesPost("expense.submit", { id: row.id }, role);
      toast({ title: res.message ?? "Expense submitted — routed through the enterprise Approval Matrix." });
      reload();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "The expense could not be submitted.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRow || deleting) return;
    setDeleting(true);
    try {
      const res = await salesPost("expense.delete", { id: deleteRow.id }, role);
      toast({ title: res.message ?? "Draft deleted." });
      setDeleteRow(null);
      reload();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "The draft could not be deleted.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (forbidden) {
    return (
      <SalesGate screenName="Sales Expenses">
        <></>
      </SalesGate>
    );
  }

  const columns: Column<ExpenseRow>[] = [
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortValue: (r) => r.date,
      render: (r) => <span className="whitespace-nowrap text-[13px] tabular-nums text-slate-700">{fmtDate(r.date)}</span>,
    },
    {
      key: "employee",
      header: "Employee",
      hideBelow: "lg",
      render: (r) => <span className="whitespace-nowrap text-[13px] text-slate-600">{r.employeeName}</span>,
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      sortValue: (r) => r.category,
      render: (r) => <CategoryChip category={r.category} />,
    },
    {
      key: "description",
      header: "Description",
      minWidth: 220,
      render: (r) => (
        <div className="min-w-0 max-w-[300px]">
          <p className="line-clamp-1 text-[13px] text-slate-700" title={r.description}>
            {r.description}
          </p>
          {r.note && (
            <p className="mt-0.5 line-clamp-1 text-[11.5px] text-red-700" title={r.note}>
              <span className="font-semibold">Decision note:</span> {r.note}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      sortValue: (r) => r.amount,
      render: (r) => <span className="whitespace-nowrap text-[13px] font-bold tabular-nums text-slate-900">{fmtRupees(r.amount)}</span>,
    },
    {
      key: "linked",
      header: "Linked record",
      minWidth: 160,
      render: (r) => <LinkedRecord row={r} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => STATUS_ORDER[r.status] ?? 99,
      render: (r) => <StatusBadge status={r.status} size="sm" />,
    },
    {
      key: "receipt",
      header: "Receipt",
      hideBelow: "xl",
      render: (r) =>
        r.receiptName ? (
          <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[11px] text-slate-600">{r.receiptName}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "timeline",
      header: "Submitted / decided",
      hideBelow: "xl",
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-slate-400">
          {r.decidedAt ? `Decided ${relTime(r.decidedAt)}` : r.submittedAt ? `Submitted ${relTime(r.submittedAt)}` : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      render: (r) =>
        r.status === "Draft" ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2.5 text-xs"
              disabled={busyId === r.id}
              onClick={() => submitExpense(r)}
              aria-label={`Submit draft — ${r.category} ${fmtRupees(r.amount)}`}
            >
              <Send className="h-3 w-3" aria-hidden /> Submit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={busyId === r.id}
              onClick={() => setDeleteRow(r)}
              aria-label={`Delete draft — ${r.category} ${fmtRupees(r.amount)}`}
            >
              <Trash2 className="h-3 w-3" aria-hidden /> Delete
            </Button>
          </div>
        ) : (
          <span className="text-xs text-slate-300" aria-hidden>
            —
          </span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Sales Expenses" }]}
        title="Sales Expenses"
        description="Expense capture for sales work. Claims route through the enterprise Approval Matrix and Finance remains the financial source of truth — no second expense ledger here."
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={reload} aria-label="Reload expenses">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
            </Button>
            <Button size="sm" className="h-9 gap-1.5" onClick={openForm}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> New expense
            </Button>
          </>
        }
      />

      {error && !forbidden && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={4} />}

      {data && !loading && (
        <div className="space-y-4">
          {/* Summary band — status counters over the scoped rows */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={<NotebookPen />} value={String(draftCount)} label="Drafts — not yet submitted" />
            <StatTile icon={<Send />} value={String(submittedCount)} label="Submitted — pending approval" />
            <StatTile icon={<BadgeCheck />} value={fmtRupees(approvedValue)} label="Approved value" />
            <StatTile icon={<Banknote />} value={fmtRupees(reimbursedValue)} label="Reimbursed value" />
          </div>

          {/* Approvals note — decisions live in My Approvals, never here */}
          {data.canDecide && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3" role="note">
              <ClipboardCheck className="h-4 w-4 shrink-0 text-blue-700" aria-hidden />
              <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-blue-900">
                <span className="font-semibold">Approvals — </span>
                Expense decisions happen in My Approvals (46) routed by the Approval Matrix (09). This queue mirrors status only.
              </p>
            </div>
          )}

          {/* Filters — status, category; employee for manager boundaries */}
          <FilterBar
            left={
              <>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 w-[11rem] bg-white" aria-label="Filter by status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {EXPENSE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-10 w-[12rem] bg-white" aria-label="Filter by category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isManager && (
                  <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                    <SelectTrigger className="h-10 w-[12rem] bg-white" aria-label="Filter by employee">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any employee</SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </>
            }
            right={
              (statusFilter !== "all" || categoryFilter !== "all" || (isManager && employeeFilter !== "all")) && (
                <p className="text-xs text-slate-500" aria-live="polite">
                  <span className="font-semibold tabular-nums text-slate-700">{filtered.length}</span> of{" "}
                  <span className="font-semibold tabular-nums text-slate-700">{rows.length}</span> claims in scope after filters
                </p>
              )
            }
          />

          {filtered.length === 0 ? (
            <div className="qubit-card">
              <EmptyState
                icon={<Receipt />}
                title={rows.length === 0 ? "No expense claims in your scope yet" : "No claims match these filters"}
                message={
                  rows.length === 0
                    ? "Capture the first one with New expense — it starts as a draft you submit when ready."
                    : "Adjust or clear the filters to see the rest of the claims."
                }
                action={
                  rows.length === 0 ? (
                    <Button size="sm" className="h-9 gap-1.5" onClick={openForm}>
                      <Plus className="h-4 w-4" aria-hidden /> New expense
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(r) => r.id}
              pageSize={10}
              caption="Expense claims in your authorized scope"
              mobileCard={(r) => (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.status} size="sm" />
                    <CategoryChip category={r.category} />
                  </div>
                  <p className="line-clamp-2 text-[13.5px] font-medium text-slate-900">{r.description}</p>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="min-w-0 truncate">
                      {r.employeeName} · {fmtDate(r.date)}
                    </span>
                    <span className="shrink-0 text-[13.5px] font-bold tabular-nums text-slate-900">{fmtRupees(r.amount)}</span>
                  </div>
                  <LinkedRecord row={r} />
                  {r.note && (
                    <p className="text-[11.5px] leading-relaxed text-red-700">
                      <span className="font-semibold">Decision note:</span> {r.note}
                    </p>
                  )}
                  {r.status === "Draft" && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-2.5 text-xs"
                        disabled={busyId === r.id}
                        onClick={() => submitExpense(r)}
                      >
                        <Send className="h-3 w-3" aria-hidden /> Submit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={busyId === r.id}
                        onClick={() => setDeleteRow(r)}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden /> Delete
                      </Button>
                    </div>
                  )}
                </div>
              )}
            />
          )}

          <div className="space-y-1 pt-1">
            <ScopeNote scope={scope} what="expense claims" />
            <p className="text-[11px] text-slate-400">
              Drafts can be submitted or deleted — there is no edit step, so wrong drafts are removed and re-captured. Submitted claims become part of
              the approval record and can no longer be changed here.
            </p>
          </div>

          <SalesAsOf
            asOfLabel={SALES_PERIOD.asOfLabel}
            note="Reimbursement accounting lives in Finance — this screen never duplicates the ledger."
          />
        </div>
      )}

      {!loading && !data && !error && (
        <EmptyState
          icon={<Receipt />}
          title="Sales Expenses could not load"
          message="The sales service returned no data. Retry, or check the service status."
          action={
            <Button size="sm" onClick={reload}>
              Retry
            </Button>
          }
        />
      )}

      {/* New expense — creates a draft; submission is a separate, deliberate step */}
      <FormDialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) setFormOpen(false);
        }}
        title="New expense"
        description="Saved as a draft first — submit it when the details are complete. Claims route through the enterprise Approval Matrix on submission."
        onSubmit={submitForm}
        submitting={submitting}
        submitLabel="Save draft"
        wide
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" required>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full bg-white" aria-label="Expense category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
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
              inputMode="decimal"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="e.g. 2400"
              aria-invalid={!!formError && amount.trim() === ""}
            />
          </Field>
        </div>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayISO()} />
        </Field>
        <Field label="Description" required hint="What the spend was for — this travels with the claim to the approver and Finance.">
          <Textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (formError) setFormError(null);
            }}
            rows={3}
            placeholder="e.g. Surat trip — Everest check-in travel"
            aria-invalid={!!formError && description.trim().length < 4}
          />
        </Field>
        <Field label="Related to" hint="Optional — link the claim to the work it supported.">
          <Select value={related} onValueChange={setRelated}>
            <SelectTrigger className="w-full bg-white" aria-label="Related record">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not linked</SelectItem>
              {(refs?.opportunities.length ?? 0) > 0 && (
                <SelectGroup>
                  <SelectLabel>Opportunity</SelectLabel>
                  {refs?.opportunities.map((o) => (
                    <SelectItem key={o.id} value={`opp:${o.id}`}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {(visitsData?.rows.length ?? 0) > 0 && (
                <SelectGroup>
                  <SelectLabel>Visit</SelectLabel>
                  {visitsData?.rows.map((v) => (
                    <SelectItem key={v.id} value={`vis:${v.id}`}>
                      {v.account?.name ?? "Customer visit"} — {v.purpose}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {(travelData?.rows.length ?? 0) > 0 && (
                <SelectGroup>
                  <SelectLabel>Travel</SelectLabel>
                  {travelData?.rows.map((t) => (
                    <SelectItem key={t.id} value={`tvl:${t.id}`}>
                      {t.destination} — {t.purpose}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Receipt reference" hint="Receipt reference — upload happens on mobile.">
          <Input
            type="text"
            value={receiptName}
            onChange={(e) => setReceiptName(e.target.value)}
            placeholder="e.g. fuel-slip-12nov.jpg"
          />
        </Field>
        {formError && (
          <p role="alert" className="text-[12px] font-medium text-red-600">
            {formError}
          </p>
        )}
      </FormDialog>

      {/* Delete — drafts only; the server rejects anything else and the message surfaces verbatim */}
      <ConfirmDialog
        open={!!deleteRow}
        onOpenChange={(open) => {
          if (!open) setDeleteRow(null);
        }}
        title="Delete this draft?"
        description={
          deleteRow
            ? `${deleteRow.category} — ${fmtRupees(deleteRow.amount)} will be removed. Only drafts can be deleted; submitted claims are part of the approval record.`
            : ""
        }
        confirmLabel="Delete draft"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}
