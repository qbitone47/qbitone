"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, History, MoreHorizontal, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  approvalRuleHistory,
  approvalRules,
  departments,
  employees,
  getEmployee,
  type ApprovalRule,
  type RuleStatus,
} from "@/lib/qubit/data";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { DataTable, type Column } from "../data-table";
import { EmptyState, KV, ReadOnlyBanner, StatusBadge } from "../primitives";
import { DetailDrawer } from "../drawers";
import { ConfirmDialog, Field, FormDialog } from "../dialogs";

const REQUEST_TYPES = ["Expense", "Purchase", "Quotation Discount", "Employee Advance", "Leave Request"];
const SLA_OPTIONS = ["1 day", "2 days", "3 days", "4 days"];

function NeutralPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      {children}
    </span>
  );
}

export function ApprovalMatrixScreen() {
  const { can } = useRole();
  const { toast } = useToast();
  const canEdit = can("governance.edit");

  // Local copy so reorder / enable / disable are interactive without a backend
  const [items, setItems] = React.useState<ApprovalRule[]>(() =>
    [...approvalRules].sort((a, b) => a.priority - b.priority),
  );
  const [historyRule, setHistoryRule] = React.useState<ApprovalRule | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ApprovalRule | null>(null);
  const [confirmDisable, setConfirmDisable] = React.useState<ApprovalRule | null>(null);

  const conflicts = items.filter((r) => r.status === "Conflict");
  const firstConflict = conflicts[0];

  const history = historyRule ? (approvalRuleHistory[historyRule.id] ?? []) : [];

  const moveRule = (rule: ApprovalRule, dir: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === rule.id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const a = next[idx];
      const b = next[target];
      next[idx] = { ...b, priority: a.priority };
      next[target] = { ...a, priority: b.priority };
      return next;
    });
    toast({
      title: "Priority updated",
      description: `${rule.requestType} ${rule.amountRange} moved ${dir === -1 ? "up" : "down"}. Approvals evaluate in this order.`,
    });
  };

  const setStatusFor = (id: string, next: RuleStatus) =>
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));

  const employeeSelect = (defaultValue?: string, label?: string) => (
    <Select defaultValue={defaultValue}>
      <SelectTrigger>
        <SelectValue placeholder={label ?? "Select employee"} />
      </SelectTrigger>
      <SelectContent>
        {employees.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.name} · {e.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const columns: Column<ApprovalRule>[] = [
    {
      key: "priority",
      header: "Priority",
      minWidth: 96,
      render: (r) => {
        const idx = items.findIndex((x) => x.id === r.id);
        return (
          <div className="flex items-center gap-1.5">
            <span className="w-5 text-center text-sm font-semibold tabular-nums text-slate-800">{r.priority}</span>
            {canEdit && (
              <span className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Move ${r.requestType} ${r.amountRange} up`}
                  disabled={idx <= 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveRule(r, -1);
                  }}
                  className="rounded p-px text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-blue-700 disabled:pointer-events-none disabled:opacity-25"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${r.requestType} ${r.amountRange} down`}
                  disabled={idx < 0 || idx >= items.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveRule(r, 1);
                  }}
                  className="rounded p-px text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-blue-700 disabled:pointer-events-none disabled:opacity-25"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "requestType",
      header: "Request Type",
      sortable: true,
      sortValue: (r) => r.requestType,
      minWidth: 150,
      render: (r) => (
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900">{r.requestType}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{r.department}</p>
        </div>
      ),
    },
    {
      key: "amountRange",
      header: "Amount / Value Range",
      sortable: true,
      sortValue: (r) => r.amountRange,
      minWidth: 170,
      render: (r) => (
        <div className="min-w-0">
          <p className="whitespace-nowrap text-[13px] font-medium tabular-nums text-slate-800">{r.amountRange}</p>
          {r.note && <p className="mt-0.5 max-w-56 text-[11px] leading-snug text-red-600">{r.note}</p>}
        </div>
      ),
    },
    {
      key: "approver",
      header: "Approver",
      render: (r) => (
        <span className="whitespace-nowrap text-[13px]">{getEmployee(r.approverId)?.name ?? "—"}</span>
      ),
    },
    {
      key: "backup",
      header: "Backup Approver",
      hideBelow: "lg",
      render: (r) => (
        <span className="whitespace-nowrap text-[13px] text-slate-600">
          {getEmployee(r.backupApproverId)?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "escalation",
      header: "Escalation",
      hideBelow: "xl",
      render: (r) => (
        <span className="whitespace-nowrap text-[13px] text-slate-600">
          {getEmployee(r.escalationToId)?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "sla",
      header: "SLA",
      render: (r) => <NeutralPill>{r.sla}</NeutralPill>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} size="sm" />,
    },
    {
      key: "actions",
      header: "",
      className: "w-10 text-right",
      headerClassName: "text-right",
      render: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400"
              aria-label={`Actions for ${r.requestType} ${r.amountRange}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setHistoryRule(r)}>View history</DropdownMenuItem>
            {canEdit && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setEditing(r)}>Edit rule</DropdownMenuItem>
                {r.status === "Disabled" ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setStatusFor(r.id, "Active");
                      toast({
                        title: "Approval rule enabled",
                        description: `${r.requestType} ${r.amountRange} is governed again, effective immediately.`,
                      });
                    }}
                  >
                    Enable rule
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setConfirmDisable(r)}>Disable rule</DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Enterprise" }, { label: "09. Approval Matrix" }]}
        title="Approval Matrix"
        description="Who approves what, under which conditions. Rules are evaluated in priority order; overlapping or ambiguous rules are flagged and blocked until resolved."
        actions={
          canEdit && (
            <Button size="sm" className="h-9" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Add Approval Rule
            </Button>
          )
        }
      />

      {!canEdit && (
        <div className="mb-4">
          <ReadOnlyBanner message="Read-only view — approval governance changes require an administrator." />
        </div>
      )}

      {/* Conflict banner — ambiguous rules are surfaced, never silently dropped */}
      {firstConflict && (
        <div
          role="alert"
          className="mb-4 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50/70 p-4 sm:flex-row sm:items-start"
        >
          <span className="qubit-icon-tile h-10 w-10 shrink-0 bg-red-100 text-red-600 [&_svg]:h-5 [&_svg]:w-5">
            <TriangleAlert className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-800">
              {conflicts.length} conflicting approval rule{conflicts.length > 1 ? "s" : ""} detected
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-red-700">
              <span className="font-semibold">
                {firstConflict.requestType} {firstConflict.amountRange}
              </span>{" "}
              overlaps the {firstConflict.requestType} rules at priority 1–2. Ambiguous governance rules are blocked
              until resolved.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0 border-red-200 bg-white text-red-700 hover:bg-red-100 hover:text-red-800"
            onClick={() => setHistoryRule(firstConflict)}
          >
            Review rule
          </Button>
        </div>
      )}

      <div className="mb-3 flex justify-end">
        <p className="text-xs text-muted-foreground">
          {items.length} rules · evaluated in priority order
          {conflicts.length > 0 && <span className="font-medium text-red-600"> · {conflicts.length} conflicting</span>}
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(r) => r.id}
        onRowClick={(r) => setHistoryRule(r)}
        pageSize={10}
        caption="Approval matrix rules"
        emptyTitle="No approval rules"
        emptyMessage="Add a rule so requests know who approves them."
        rowClassName={(r) => (r.status === "Conflict" ? "bg-red-50/50" : "")}
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {r.requestType}
                <span className="ml-1.5 font-normal text-muted-foreground">· P{r.priority}</span>
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{r.amountRange}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {getEmployee(r.approverId)?.name ?? "—"} · SLA {r.sla}
              </p>
            </div>
            <StatusBadge status={r.status} size="sm" />
          </div>
        )}
      />

      {/* Rule history drawer — row click / kebab / conflict banner */}
      <DetailDrawer
        open={!!historyRule}
        onOpenChange={(o) => !o && setHistoryRule(null)}
        title={historyRule ? `${historyRule.requestType} — ${historyRule.amountRange}` : ""}
        subtitle={
          historyRule
            ? `${historyRule.department} · Priority ${historyRule.priority} · SLA ${historyRule.sla}`
            : undefined
        }
        icon={<History />}
        footer={
          historyRule ? (
            canEdit ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => {
                  setEditing(historyRule);
                  setHistoryRule(null);
                }}
              >
                Edit rule
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Read-only — approval governance requires an administrator.</p>
            )
          ) : undefined
        }
      >
        {historyRule && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={historyRule.status} size="sm" />
              <span className="text-xs text-muted-foreground">Last modified {historyRule.lastModified}</span>
            </div>
            <dl className="divide-y">
              <KV label="Approver">{getEmployee(historyRule.approverId)?.name ?? "—"}</KV>
              <KV label="Backup approver">{getEmployee(historyRule.backupApproverId)?.name ?? "—"}</KV>
              <KV label="Escalates to">{getEmployee(historyRule.escalationToId)?.name ?? "—"}</KV>
              <KV label="SLA">{historyRule.sla}</KV>
            </dl>
            <section className="mt-6 border-t pt-4">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Change history</p>
              {history.length === 0 ? (
                <EmptyState
                  icon={<History />}
                  title="No changes recorded"
                  message="This rule has not been modified since it was created."
                />
              ) : (
                <ol className="relative ml-1.5 space-y-5 border-l border-slate-200 pl-5">
                  {history.map((h) => (
                    <li key={`${h.date}-${h.event}`} className="relative">
                      <span
                        aria-hidden
                        className="absolute -left-[25px] top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600 ring-1 ring-slate-200"
                      />
                      <p className="text-[13px] font-medium text-slate-800">{h.event}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {h.date} · by {h.by}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </DetailDrawer>

      {/* Add approval rule */}
      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add Approval Rule"
        description="New rules join the end of the priority order. Overlapping ranges are flagged automatically."
        submitLabel="Add rule"
        wide
        onSubmit={() => {
          toast({
            title: "Approval rule created",
            description: "The rule joins the end of the priority order. Overlapping ranges are flagged automatically.",
          });
          setCreateOpen(false);
        }}
      >
        <Field label="Request type" required>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select request type" />
            </SelectTrigger>
            <SelectContent>
              {REQUEST_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Department" required>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Amount / value range" required hint="Overlapping ranges are flagged automatically.">
          <Input placeholder="e.g. ₹50,001 – ₹2,00,000" />
        </Field>
        <Field label="Approver" required>
          {employeeSelect(undefined, "Select approver")}
        </Field>
        <Field label="Backup approver">{employeeSelect(undefined, "Select backup approver")}</Field>
        <Field label="Escalates to">{employeeSelect(undefined, "Select escalation contact")}</Field>
        <Field label="SLA" required>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select SLA" />
            </SelectTrigger>
            <SelectContent>
              {SLA_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormDialog>

      {/* Edit rule */}
      {editing && (
        <FormDialog
          key={editing.id}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          title={`Edit rule — ${editing.requestType}`}
          description={`${editing.amountRange} · Priority ${editing.priority}. Changes are recorded in the rule history.`}
          submitLabel="Save changes"
          wide
          onSubmit={() => {
            toast({
              title: "Approval rule updated",
              description: `${editing.requestType} ${editing.amountRange} saved. Changes are recorded in the rule history.`,
            });
            setEditing(null);
          }}
        >
          <Field label="Amount / value range" required hint="Overlapping ranges are flagged automatically.">
            <Input defaultValue={editing.amountRange} />
          </Field>
          <Field label="Approver" required>
            {employeeSelect(editing.approverId)}
          </Field>
          <Field label="Backup approver">{employeeSelect(editing.backupApproverId)}</Field>
          <Field label="Escalates to">{employeeSelect(editing.escalationToId)}</Field>
          <Field label="SLA" required>
            <Select defaultValue={editing.sla}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...new Set([...SLA_OPTIONS, editing.sla])].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FormDialog>
      )}

      {/* Disable rule — changes live approval routing, confirm first */}
      <ConfirmDialog
        open={!!confirmDisable}
        onOpenChange={(o) => !o && setConfirmDisable(null)}
        title="Disable approval rule?"
        description={
          confirmDisable
            ? `This changes who approves live requests. ${confirmDisable.requestType} ${confirmDisable.amountRange} will no longer have an active approver and falls back to the backup path.`
            : ""
        }
        confirmLabel="Disable rule"
        destructive
        onConfirm={() => {
          if (confirmDisable) {
            setStatusFor(confirmDisable.id, "Disabled");
            toast({
              title: "Approval rule disabled",
              description: `${confirmDisable.requestType} ${confirmDisable.amountRange} — live requests follow the backup path.`,
            });
          }
          setConfirmDisable(null);
        }}
      />
    </div>
  );
}
