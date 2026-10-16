"use client";

import * as React from "react";
import { Activity, Copy, MoreHorizontal, Plus, Timer, Workflow as WorkflowIcon } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  departments,
  employees,
  getEmployee,
  workflows,
  type Workflow,
  type WorkflowStatus,
} from "@/lib/qubit/data";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { DataTable, type Column } from "../data-table";
import {
  Avatar,
  FilterBar,
  KV,
  ReadOnlyBanner,
  SearchInput,
  StatTile,
  StatusBadge,
} from "../primitives";
import { DetailDrawer } from "../drawers";
import { ConfirmDialog, Field, FormDialog } from "../dialogs";

// Neutral trigger/version pill — restrained, readable text (no color coding)
function NeutralPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      {children}
    </span>
  );
}

const STATUS_OPTIONS: WorkflowStatus[] = ["Active", "Draft", "Disabled"];

export function WorkflowCatalogScreen() {
  const { can } = useRole();
  const { toast } = useToast();
  const canEdit = can("governance.edit");

  const [items, setItems] = React.useState<Workflow[]>(workflows);
  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [trigger, setTrigger] = React.useState("all");
  const [detail, setDetail] = React.useState<Workflow | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [editing, setEditing] = React.useState<Workflow | null>(null);
  const [confirmDisable, setConfirmDisable] = React.useState<Workflow | null>(null);

  const deptOptions = React.useMemo(() => [...new Set(items.map((w) => w.department))], [items]);
  const triggerOptions = React.useMemo(() => [...new Set(items.map((w) => w.trigger))], [items]);

  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      items.filter((w) => {
        if (dept !== "all" && w.department !== dept) return false;
        if (status !== "all" && w.status !== status) return false;
        if (trigger !== "all" && w.trigger !== trigger) return false;
        if (!q) return true;
        const owner = getEmployee(w.ownerId)?.name.toLowerCase() ?? "";
        return (
          w.name.toLowerCase().includes(q) ||
          w.department.toLowerCase().includes(q) ||
          w.trigger.toLowerCase().includes(q) ||
          w.actionSummary.toLowerCase().includes(q) ||
          owner.includes(q)
        );
      }),
    [items, q, dept, status, trigger],
  );

  const filtersActive = q !== "" || dept !== "all" || status !== "all" || trigger !== "all";
  const clearFilters = () => {
    setQuery("");
    setDept("all");
    setStatus("all");
    setTrigger("all");
  };

  const setStatusFor = (id: string, next: WorkflowStatus) =>
    setItems((prev) => prev.map((w) => (w.id === id ? { ...w, status: next } : w)));

  const columns: Column<Workflow>[] = [
    {
      key: "name",
      header: "Workflow Name",
      sortable: true,
      sortValue: (w) => w.name,
      minWidth: 210,
      render: (w) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-900">{w.name}</p>
          <p className="mt-0.5 max-w-72 truncate text-[11px] text-muted-foreground">{w.actionSummary}</p>
        </div>
      ),
    },
    {
      key: "department",
      header: "Department",
      sortable: true,
      sortValue: (w) => w.department,
      render: (w) => <span className="whitespace-nowrap text-[13px]">{w.department}</span>,
    },
    {
      key: "trigger",
      header: "Trigger",
      render: (w) => <NeutralPill>{w.trigger}</NeutralPill>,
    },
    {
      key: "owner",
      header: "Owner",
      render: (w) => {
        const owner = getEmployee(w.ownerId);
        return (
          <span className="flex items-center gap-2">
            <Avatar name={owner?.name ?? "?"} size="xs" />
            <span className="whitespace-nowrap text-[13px]">{owner?.name ?? "—"}</span>
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (w) => w.status,
      render: (w) => <StatusBadge status={w.status} size="sm" />,
    },
    {
      key: "version",
      header: "Version",
      sortable: true,
      sortValue: (w) => w.version,
      render: (w) => (
        <span className="whitespace-nowrap text-xs font-medium tabular-nums text-slate-600">{w.version}</span>
      ),
    },
    {
      key: "modified",
      header: "Last Modified",
      sortable: true,
      sortValue: (w) => w.lastModified,
      hideBelow: "xl",
      render: (w) => <span className="whitespace-nowrap text-xs text-muted-foreground">{w.lastModified}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "w-10 text-right",
      headerClassName: "text-right",
      render: (w) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400"
              aria-label={`Actions for ${w.name}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setDetail(w)}>View workflow</DropdownMenuItem>
            {canEdit && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setEditing(w)}>Edit workflow</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    toast({
                      title: "Workflow duplicated",
                      description: `“${w.name} (copy)” created as Draft — edit it before activating.`,
                    })
                  }
                >
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </DropdownMenuItem>
                {w.status === "Disabled" ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setStatusFor(w.id, "Active");
                      toast({ title: "Workflow enabled", description: `“${w.name}” resumes for new triggers.` });
                    }}
                  >
                    Enable workflow
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setConfirmDisable(w)}>Disable workflow</DropdownMenuItem>
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
        crumbs={[{ label: "Enterprise" }, { label: "08. Workflow Catalog" }]}
        title="Workflow Catalog"
        description="Central catalog of business workflows — trigger, owner and the fixed five-step flow behind each process. Qubit One keeps automation restrained: flows are curated, not user-built."
        actions={
          canEdit && (
            <Button
              size="sm"
              className="h-9"
              onClick={() => {
                setNewName("");
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Create Workflow
            </Button>
          )
        }
      />

      {!canEdit && (
        <div className="mb-4">
          <ReadOnlyBanner message="Read-only view — creating, editing and disabling workflows requires an administrator." />
        </div>
      )}

      <FilterBar
        className="mb-4"
        left={
          <>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search workflows…"
          className="w-full sm:w-64"
          ariaLabel="Search workflows"
        />
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="h-10 w-full sm:w-40" aria-label="Filter by department">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {deptOptions.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 w-full sm:w-32" aria-label="Filter by status">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={trigger} onValueChange={setTrigger}>
          <SelectTrigger className="h-10 w-full sm:w-44" aria-label="Filter by trigger">
            <SelectValue placeholder="All triggers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All triggers</SelectItem>
            {triggerOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
          </>
        }
        right={
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {items.length} workflows
            {filtersActive && (
              <>
                {" · "}
                <button type="button" onClick={clearFilters} className="font-medium text-blue-600 hover:text-blue-700">
                  Clear filters
                </button>
              </>
            )}
          </p>
        }
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(w) => w.id}
        onRowClick={(w) => setDetail(w)}
        pageSize={8}
        caption="Business workflow catalog"
        emptyTitle="No workflows match"
        emptyMessage="Adjust the search or filters to find workflows."
        mobileCard={(w) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">{w.name}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{w.actionSummary}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {w.department} · <NeutralPill>{w.trigger}</NeutralPill>
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <StatusBadge status={w.status} size="sm" />
              <span className="text-[11px] font-medium tabular-nums text-slate-500">{w.version}</span>
            </div>
          </div>
        )}
      />

      {/* Workflow detail drawer — stats, flow visual, details */}
      <DetailDrawer
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        title={
          detail ? (
            <span className="flex flex-wrap items-center gap-2">
              {detail.name}
              <StatusBadge status={detail.status} size="sm" />
              <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-600">
                {detail.version}
              </span>
            </span>
          ) : (
            ""
          )
        }
        subtitle={detail ? `${detail.department} · Trigger: ${detail.trigger}` : undefined}
        icon={<WorkflowIcon />}
        footer={
          detail ? (
            canEdit ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => {
                  setEditing(detail);
                  setDetail(null);
                }}
              >
                Edit workflow
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Read-only — workflow changes require an administrator.</p>
            )
          ) : undefined
        }
      >
        {detail && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <StatTile icon={<Activity />} value={detail.runsThisMonth.toLocaleString("en-IN")} label="Runs this month" />
              <StatTile icon={<Timer />} value={detail.avgCompletion} label="Avg completion" />
            </div>

            {/* Five-step flow — horizontal rail on md+, vertical guide on mobile */}
            <section className="mt-6 border-t border-slate-100 pt-4">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Flow · {detail.steps.length} steps
              </p>
              <div className="hidden md:block">
                <div className="flex items-center">
                  {detail.steps.map((step, i) => (
                    <React.Fragment key={step.stage}>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[11px] font-semibold text-white">
                        {i + 1}
                      </span>
                      {i < detail.steps.length - 1 && <span aria-hidden className="h-px flex-1 bg-slate-200" />}
                    </React.Fragment>
                  ))}
                </div>
                <div
                  className="mt-3 grid gap-x-3 text-center"
                  style={{ gridTemplateColumns: `repeat(${detail.steps.length}, minmax(0, 1fr))` }}
                >
                  {detail.steps.map((step) => (
                    <div key={step.stage}>
                      <p className="text-xs font-semibold text-slate-800">{step.label}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
              <ol className="md:hidden">
                {detail.steps.map((step, i) => (
                  <li key={step.stage} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < detail.steps.length - 1 && (
                      <span aria-hidden className="absolute bottom-0 left-[13px] top-7 w-px bg-slate-200" />
                    )}
                    <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[11px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-xs font-semibold text-slate-800">{step.label}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <dl className="mt-6 divide-y divide-slate-100 border-t border-slate-100 pt-1">
              <KV label="Department">{detail.department}</KV>
              <KV label="Trigger">{detail.trigger}</KV>
              <KV label="Owner">{getEmployee(detail.ownerId)?.name ?? "—"}</KV>
              <KV label="Action summary">{detail.actionSummary}</KV>
              <KV label="Version">{detail.version}</KV>
              <KV label="Last modified">{detail.lastModified}</KV>
            </dl>
          </>
        )}
      </DetailDrawer>

      {/* Create workflow */}
      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Workflow"
        description="New workflows start as Draft. Define the trigger and owner; the five-step flow is configured after creation."
        submitLabel="Create workflow"
        onSubmit={() => {
          toast({
            title: "Workflow created as Draft",
            description: `“${newName.trim() || "Untitled workflow"}” was added to the catalog. Configure its flow before activation.`,
          });
          setNewName("");
          setCreateOpen(false);
        }}
      >
        <Field label="Workflow name" required>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Vendor Onboarding"
          />
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
        <Field label="Trigger" required hint="The event that starts this workflow.">
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select trigger" />
            </SelectTrigger>
            <SelectContent>
              {triggerOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Owner" required>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select owner" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} · {e.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Description">
          <Textarea rows={3} placeholder="What does this workflow accomplish?" />
        </Field>
      </FormDialog>

      {/* Edit workflow */}
      {editing && (
        <FormDialog
          key={editing.id}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          title={`Edit — ${editing.name}`}
          submitLabel="Save changes"
          onSubmit={() => {
            toast({ title: "Workflow updated", description: `“${editing.name}” saved. Changes are recorded in audit history.` });
            setEditing(null);
          }}
        >
          <Field label="Workflow name" required>
            <Input defaultValue={editing.name} />
          </Field>
          <Field label="Department" required>
            <Select defaultValue={editing.department}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Trigger" required>
            <Select defaultValue={editing.trigger}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...new Set([...triggerOptions, editing.trigger])].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Owner" required>
            <Select defaultValue={editing.ownerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {e.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Description">
            <Textarea rows={3} defaultValue={editing.actionSummary} />
          </Field>
        </FormDialog>
      )}

      {/* Disable workflow — high-impact, confirm first */}
      <ConfirmDialog
        open={!!confirmDisable}
        onOpenChange={(o) => !o && setConfirmDisable(null)}
        title="Disable workflow?"
        description={
          confirmDisable
            ? `“${confirmDisable.name}” will stop running immediately. In-flight runs finish normally, and the workflow can be re-enabled at any time.`
            : ""
        }
        confirmLabel="Disable workflow"
        destructive
        onConfirm={() => {
          if (confirmDisable) {
            setStatusFor(confirmDisable.id, "Disabled");
            toast({
              title: "Workflow disabled",
              description: `“${confirmDisable.name}” no longer runs for new triggers.`,
            });
          }
          setConfirmDisable(null);
        }}
      />
    </div>
  );
}
