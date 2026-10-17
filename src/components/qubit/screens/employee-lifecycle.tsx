"use client";

import * as React from "react";
import {
  ArrowUpRight,
  ChevronRight,
  ClipboardList,
  FileText,
  Gauge,
  LogOut,
  UserCheck,
  UserPlus,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  getEmployee,
  lifecycleRecords,
  lifecycleStages,
  type Employee,
  type LifecycleRecord,
} from "@/lib/qubit/data";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { DataTable, type Column } from "../data-table";
import {
  Avatar,
  FilterBar,
  KV,
  ReadOnlyBanner,
  SearchInput,
  SectionCard,
  StatusBadge,
} from "../primitives";
import { DetailDrawer, EmployeeDrawer } from "../drawers";

// ============================================================
// Stage strip helpers
// ============================================================
const STAGE_ICONS: Record<string, React.ElementType> = {
  candidate: UserPlus,
  offer: FileText,
  onboarding: ClipboardList,
  active: UserCheck,
  performance: Gauge,
  promotion: ArrowUpRight,
  exit: LogOut,
};

const STAGE_NAME_BY_ID: Record<string, string> = {};
for (const s of lifecycleStages) STAGE_NAME_BY_ID[s.id] = s.name;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse the "5 Oct 2025" style dates used across Qubit One data. */
function parseDateStr(s: string): Date | null {
  const m = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/.exec(s.trim());
  if (m) {
    const mi = MONTHS.findIndex((mm) => mm.toLowerCase() === m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) return new Date(Number(m[3]), mi, Number(m[1]));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Neutral pill for lifecycle stages — stages are not status tones, so no color coding. */
function StagePill({ stage }: { stage: string }) {
  return (
    <span className="inline-flex max-w-44 items-center truncate rounded-full border bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      {stage}
    </span>
  );
}

/** Pending task counter: amber highlight only when attention is needed (>2). */
function TaskCount({ n }: { n: number }) {
  if (n === 0) return <span className="text-slate-400">—</span>;
  if (n > 2)
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        {n} pending
      </span>
    );
  return <span className="tabular-nums text-[13px] text-slate-700">{n}</span>;
}

function stageChipCls(active: boolean): string {
  return cn(
    "whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150",
    active
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-slate-200/90 bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-blue-200 hover:bg-blue-50/50",
  );
}

// ============================================================
// Screen 06 — Employee Lifecycle
// ============================================================
export function EmployeeLifecycleScreen() {
  const { params } = useQubitNav();
  const { can } = useRole();
  const { toast } = useToast();
  const canEdit = can("governance.edit");

  const [query, setQuery] = React.useState("");
  const [stageFilter, setStageFilter] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<LifecycleRecord | null>(null);
  const [previewEmployee, setPreviewEmployee] = React.useState<Employee | null>(null);

  // Cross-screen: another screen deep-linked into a specific stage.
  React.useEffect(() => {
    if (params.stageId && STAGE_NAME_BY_ID[params.stageId]) {
      setStageFilter(params.stageId);
    }
  }, [params.stageId]);

  const q = query.trim().toLowerCase();
  const activeStageName = stageFilter ? STAGE_NAME_BY_ID[stageFilter] ?? null : null;

  const filtered = React.useMemo(
    () =>
      lifecycleRecords.filter((r) => {
        if (activeStageName && r.stage !== activeStageName) return false;
        if (!q) return true;
        const emp = getEmployee(r.employeeId);
        const owner = getEmployee(r.ownerId);
        return (
          (emp?.name ?? "").toLowerCase().includes(q) ||
          (emp?.title ?? "").toLowerCase().includes(q) ||
          (owner?.name ?? "").toLowerCase().includes(q)
        );
      }),
    [q, activeStageName],
  );

  // Record counts per stage (used by the restrained chip row above the table)
  const stageRecordCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of lifecycleRecords) counts[r.stage] = (counts[r.stage] ?? 0) + 1;
    return counts;
  }, []);

  const totalPeople = lifecycleStages.reduce((a, s) => a + s.count, 0);
  const filtersActive = q !== "" || stageFilter !== null;
  const clearFilters = () => {
    setQuery("");
    setStageFilter(null);
  };

  const columns: Column<LifecycleRecord>[] = [
    {
      key: "employee",
      header: "Employee",
      sortable: true,
      sortValue: (r) => getEmployee(r.employeeId)?.name ?? "",
      minWidth: 190,
      render: (r) => {
        const emp = getEmployee(r.employeeId);
        return (
          <div className="flex items-center gap-2.5">
            <Avatar name={emp?.name ?? "?"} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-slate-900">{emp?.name ?? "Unknown"}</p>
              <p className="truncate text-[11px] text-muted-foreground">{emp?.title ?? "—"}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "stage",
      header: "Current Stage",
      sortable: true,
      sortValue: (r) => r.stage,
      render: (r) => <StagePill stage={r.stage} />,
    },
    {
      key: "owner",
      header: "Owner",
      sortable: true,
      sortValue: (r) => getEmployee(r.ownerId)?.name ?? "",
      render: (r) => {
        const owner = getEmployee(r.ownerId);
        return (
          <span className="flex items-center gap-2">
            <Avatar name={owner?.name ?? "?"} size="xs" />
            <span className="whitespace-nowrap text-[13px]">{owner?.name ?? "—"}</span>
          </span>
        );
      },
    },
    {
      key: "start",
      header: "Start Date",
      sortable: true,
      sortValue: (r) => parseDateStr(r.startDate)?.getTime() ?? 0,
      render: (r) => <span className="whitespace-nowrap text-xs text-slate-600">{r.startDate}</span>,
    },
    {
      key: "tasks",
      header: "Pending Tasks",
      sortable: true,
      sortValue: (r) => r.pendingTasks,
      render: (r) => <TaskCount n={r.pendingTasks} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} size="sm" />,
    },
  ];

  const detailEmployee = detail ? getEmployee(detail.employeeId) : undefined;
  const detailOwner = detail ? getEmployee(detail.ownerId) : undefined;
  const detailManager = detailEmployee ? getEmployee(detailEmployee.managerId) : undefined;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Enterprise" }, { label: "06. Employee Lifecycle" }]}
        title="Employee Lifecycle"
        description="Operational view of the standardized employee lifecycle — every person in flight, their current stage, accountable owner and pending tasks."
      />

      {!canEdit && (
        <div className="mb-4">
          <ReadOnlyBanner message="You have view-only access to employee lifecycle records." />
        </div>
      )}

      {/* Stage strip */}
      <SectionCard
        title="Standardized lifecycle"
        description="Seven governed stages from candidate to exit — select a stage to filter the records below."
        noPadding
        actions={
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-slate-800">{totalPeople.toLocaleString("en-IN")}</span>{" "}
            people in lifecycle
          </p>
        }
      >
        <div className="qubit-scroll overflow-x-auto px-4 py-3 md:px-5">
          <div className="flex min-w-max items-center gap-1.5">
            {lifecycleStages.map((stage, i) => {
              const Icon = STAGE_ICONS[stage.id] ?? UserPlus;
              const active = stageFilter === stage.id;
              return (
                <React.Fragment key={stage.id}>
                  {i > 0 && (
                    <ChevronRight aria-hidden className="hidden h-4 w-4 shrink-0 text-slate-300 md:block" />
                  )}
                  <button
                    type="button"
                    onClick={() => setStageFilter(active ? null : stage.id)}
                    title={stage.description}
                    aria-pressed={active}
                    className={cn(
                      "flex shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors duration-150",
                      active
                        ? "border-navy-800 bg-navy-900 shadow-[0_1px_3px_rgba(13,27,51,0.25)]"
                        : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                        active ? "bg-white/10 text-white" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block whitespace-nowrap text-[13px] font-medium leading-tight",
                          active ? "text-white" : "text-slate-900",
                        )}
                      >
                        {stage.name}
                      </span>
                      <span
                        className={cn(
                          "block text-[11px] leading-tight tabular-nums",
                          active ? "text-navy-300" : "text-muted-foreground",
                        )}
                      >
                        {stage.count.toLocaleString("en-IN")}
                      </span>
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </SectionCard>

      {/* Search + record counts */}
      <FilterBar
        className="mt-4 mb-3"
        left={
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search employee or owner…"
            className="w-full sm:w-72"
            ariaLabel="Search employee or owner"
          />
        }
        right={
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {lifecycleRecords.length} records
            {filtersActive && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-medium text-blue-600 hover:text-blue-700"
                >
                  Clear filters
                </button>
              </>
            )}
          </p>
        }
      />

      {/* Restrained stage count chips (record-derived) */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by lifecycle stage">
        <button
          type="button"
          onClick={() => setStageFilter(null)}
          aria-pressed={stageFilter === null}
          className={stageChipCls(stageFilter === null)}
        >
          All ({lifecycleRecords.length})
        </button>
        {lifecycleStages
          .filter((s) => (stageRecordCounts[s.name] ?? 0) > 0)
          .map((s, i) => (
            <React.Fragment key={s.id}>
              <span aria-hidden className="text-xs text-slate-300">
                ·
              </span>
              <button
                type="button"
                onClick={() => setStageFilter(s.id)}
                aria-pressed={stageFilter === s.id}
                className={stageChipCls(stageFilter === s.id)}
              >
                {s.name} ({stageRecordCounts[s.name] ?? 0})
              </button>
            </React.Fragment>
          ))}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        onRowClick={(r) => setDetail(r)}
        pageSize={8}
        caption="Employee lifecycle records"
        emptyTitle="No lifecycle records"
        emptyMessage="Try a different search term or stage filter."
        mobileCard={(r) => {
          const emp = getEmployee(r.employeeId);
          const owner = getEmployee(r.ownerId);
          return (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{emp?.name ?? "Unknown"}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{emp?.title ?? "—"}</p>
                <div className="mt-1.5">
                  <StagePill stage={r.stage} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Owner: {owner?.name ?? "—"} · Tasks: {r.pendingTasks === 0 ? "none" : r.pendingTasks}
                </p>
              </div>
              <StatusBadge status={r.status} size="sm" />
            </div>
          );
        }}
      />

      {/* Lifecycle record drawer */}
      <DetailDrawer
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detailEmployee?.name ?? "Lifecycle record"}
        subtitle={detailEmployee ? `${detailEmployee.title} · ${detailEmployee.department}` : undefined}
        icon={<Workflow />}
        footer={
          detail ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="h-8"
                onClick={() => {
                  const emp = getEmployee(detail.employeeId);
                  setDetail(null);
                  if (emp) setPreviewEmployee(emp);
                }}
              >
                Open employee preview
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() =>
                  toast({
                    title: "HR module",
                    description: "Arrives in Phase 7 — lifecycle deep-links into the HR module are scheduled there.",
                  })
                }
              >
                View in HR module
              </Button>
            </div>
          ) : undefined
        }
      >
        {detail && (
          <>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <Avatar name={detailEmployee?.name ?? "?"} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {detailEmployee?.name ?? "Unknown employee"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {detailEmployee ? `${detailEmployee.title} · ${detailEmployee.department}` : "—"}
                </p>
                {detailEmployee && (
                  <div className="mt-1.5">
                    <StatusBadge status={detailEmployee.status} size="sm" />
                  </div>
                )}
              </div>
            </div>

            <dl className="divide-y divide-slate-100 pt-1">
              <KV label="Current Stage">
                <StagePill stage={detail.stage} />
              </KV>
              <KV label="Owner">{detailOwner ? detailOwner.name : "—"}</KV>
              <KV label="Start Date">{detail.startDate}</KV>
              <KV label="Pending Tasks">
                {detail.pendingTasks === 0 ? "None" : <TaskCount n={detail.pendingTasks} />}
              </KV>
              <KV label="Employee ID">{detailEmployee?.employeeId ?? "—"}</KV>
              <KV label="Manager">{detailManager ? detailManager.name : "—"}</KV>
            </dl>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lifecycle history
              </p>
              {detail.history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No history recorded yet.</p>
              ) : (
                <ol className="ml-1.5 space-y-4 border-l border-slate-200 pl-4">
                  {detail.history.map((h, i) => (
                    <li key={`${h.date}-${i}`} className="relative">
                      <span
                        aria-hidden
                        className="absolute top-1 -left-[21px] h-[9px] w-[9px] rounded-full bg-blue-600 ring-2 ring-white"
                      />
                      <p className="text-xs font-semibold text-slate-900">{h.date}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{h.event}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </DetailDrawer>

      {/* Employee preview (shared drawer) */}
      <EmployeeDrawer
        employee={previewEmployee}
        open={!!previewEmployee}
        onOpenChange={(o) => !o && setPreviewEmployee(null)}
      />
    </div>
  );
}
