"use client";

import * as React from "react";
import {
  CircleCheck,
  LayoutGrid,
  ListTodo,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getEmployee } from "@/lib/qubit/data";
import {
  fmtDate,
  fmtTime,
  TASKS,
  WORKSPACE_NOW,
  type Task,
  type TaskStatus,
} from "@/lib/qubit/workspace-data";
import { useQubitNav } from "../nav-context";
import { PageHeader } from "../page-header";
import { SearchInput } from "../primitives";
import { DataTable, type Column } from "../data-table";
import { DetailDrawer } from "../drawers";
import { ConfirmDialog } from "../dialogs";
import { DueBadge, SegmentedToggle, SourceBadge } from "../workspace/parts";
import { CreateTaskDialog } from "../workspace/create-task-dialog";
import { StatusBadge } from "../primitives";

// ============================================================
// Screen 43 · My Tasks — the task workspace. Higher information
// density. Connected to the Qubit ecosystem through `source`
// and `related`; AI-suggested work is always identifiable.
// Status transitions are validated server-side.
// ============================================================

type DueFilter = "all" | "overdue" | "today" | "week" | "none";
type ViewMode = "list" | "board";

export function MyTasksScreen() {
  const nav = useQubitNav();
  const { toast } = useToast();
  const params = nav.params as { taskId?: string; filter?: string };

  const [tasks, setTasks] = React.useState<Task[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");
  const [dueFilter, setDueFilter] = React.useState<DueFilter>(params.filter === "overdue" ? "overdue" : "all");
  const [sourceFilter, setSourceFilter] = React.useState<string>("all");
  const [view, setView] = React.useState<ViewMode>("list");
  const [detail, setDetail] = React.useState<Task | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [completeTarget, setCompleteTarget] = React.useState<Task | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/workspace/tasks", { cache: "no-store" });
      if (!res.ok) throw new Error(`Task service returned ${res.status}.`);
      const data = await res.json();
      setTasks(data.tasks);
    } catch {
      setLoadError("Tasks could not be loaded. Check your connection and retry.");
    }
  }, []);

  React.useEffect(() => {
    load();
  }, []);

  // Deep-link from Employee Home / Notifications → open the task drawer.
  React.useEffect(() => {
    if (tasks && params.taskId) {
      const t = tasks.find((x) => x.id === params.taskId);
      if (t) setDetail(t);
    }
  }, [tasks, params.taskId]);

  const transition = async (t: Task, next: TaskStatus) => {
    setBusyId(t.id);
    try {
      const res = await fetch("/api/workspace/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "Status not updated", description: data?.message ?? "The task service rejected this transition." });
        return;
      }
      setTasks((ts) => (ts ? ts.map((x) => (x.id === t.id ? data.task : x)) : ts));
      setDetail((d) => (d && d.id === t.id ? data.task : d));
      toast({
        title: next === "Completed" ? "Task completed" : `Task moved to ${next}`,
        description: t.title,
      });
    } catch {
      toast({ variant: "destructive", title: "Status not updated", description: "The task service is unreachable. Your change was not applied." });
    } finally {
      setBusyId(null);
    }
  };

  const filtered = React.useMemo(() => {
    let list = tasks ?? [];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((t) => `${t.title} ${t.detail} ${t.related?.label ?? ""}`.toLowerCase().includes(q));
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
    if (priorityFilter !== "all") list = list.filter((t) => t.priority === priorityFilter);
    if (sourceFilter !== "all") list = list.filter((t) => t.source === sourceFilter);
    if (dueFilter === "overdue") list = list.filter((t) => t.due && t.due < WORKSPACE_NOW && t.status !== "Completed" && t.status !== "Cancelled");
    if (dueFilter === "today") list = list.filter((t) => t.due && new Date(t.due).toDateString() === new Date(WORKSPACE_NOW).toDateString());
    if (dueFilter === "week") list = list.filter((t) => t.due && t.due <= WORKSPACE_NOW + 7 * 86_400_000 && t.status !== "Completed" && t.status !== "Cancelled");
    if (dueFilter === "none") list = list.filter((t) => t.due === null);
    return list;
  }, [tasks, search, statusFilter, priorityFilter, sourceFilter, dueFilter]);

  const overdueCount = (tasks ?? []).filter((t) => t.due && t.due < WORKSPACE_NOW && t.status !== "Completed" && t.status !== "Cancelled").length;

  const columns: Column<Task>[] = [
    {
      key: "title",
      header: "Task",
      minWidth: 260,
      sortValue: (t) => t.title,
      render: (t) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium text-slate-800">
            <span className="truncate">{t.title}</span>
            {t.aiGenerated && (
              <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-px text-[9.5px] font-semibold text-violet-700">AI</span>
            )}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <SourceBadge source={t.source} ai={t.aiGenerated} />
            {t.related && <span className="truncate">{t.related.label}</span>}
          </p>
        </div>
      ),
    },
    {
      key: "due",
      header: "Due",
      minWidth: 150,
      sortValue: (t) => t.due ?? Infinity,
      render: (t) => <DueBadge due={t.due} completed={t.status === "Completed"} />,
    },
    { key: "priority", header: "Priority", sortValue: (t) => t.priority, render: (t) => <StatusBadge status={t.priority} size="sm" /> },
    { key: "status", header: "Status", sortValue: (t) => t.status, render: (t) => <StatusBadge status={t.status} size="sm" /> },
    {
      key: "owner",
      header: "Assigned by",
      hideBelow: "lg",
      render: (t) => (
        <span className="text-[13px] text-slate-600">{t.ownerId === t.assigneeId ? "Self" : getEmployee(t.ownerId)?.name ?? "System"}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (t) => <TaskRowActions task={t} busyId={busyId} onOpen={() => setDetail(t)} onTransition={transition} onComplete={() => setCompleteTarget(t)} />,
    },
  ];

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Workspace" }, { label: "My work" }]}
        title="My Tasks"
        description="Everything assigned to you across meetings, workflows, sales, service and HR — one queue, one source of truth."
        meta={
          overdueCount > 0 ? (
            <button
              type="button"
              onClick={() => setDueFilter("overdue")}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
              {overdueCount} task{overdueCount === 1 ? "" : "s"} overdue — filter the list
            </button>
          ) : undefined
        }
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={load} aria-label="Reload tasks">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
            </Button>
            <Button className="h-9 gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> New task
            </Button>
          </>
        }
      />

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search tasks, related entities…" className="w-full sm:w-72" ariaLabel="Search tasks" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-36 bg-white" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["Not Started", "In Progress", "Blocked", "Waiting", "Completed", "Cancelled"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-10 w-32 bg-white" aria-label="Filter by priority"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="h-10 w-44 bg-white" aria-label="Filter by source"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {["Meeting action item", "Workflow", "Manager assignment", "Sales activity", "Service activity", "HR workflow", "Automation", "AI recommendation", "Approval process", "Manual"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dueFilter} onValueChange={(v) => setDueFilter(v as DueFilter)}>
          <SelectTrigger className="h-10 w-36 bg-white" aria-label="Filter by due date"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any due date</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="today">Due today</SelectItem>
            <SelectItem value="week">Next 7 days</SelectItem>
            <SelectItem value="none">No due date</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <SegmentedToggle
            ariaLabel="Task view"
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: "List", icon: ListTodo },
              { value: "board", label: "Board", icon: LayoutGrid },
            ]}
          />
        </div>
      </div>

      {loadError && (
        <div className="qubit-card mb-3 flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50/60 px-4 py-3" role="alert">
          <p className="text-sm font-medium text-red-700">{loadError}</p>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
          </Button>
        </div>
      )}

      {!tasks && !loadError ? (
        <TaskSkeleton />
      ) : view === "list" ? (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(t) => t.id}
          onRowClick={(t) => setDetail(t)}
          pageSize={10}
          emptyTitle="No tasks match these filters"
          emptyMessage="Clear a filter or two — or celebrate, the queue is clear."
          caption="My task list"
          mobileCard={(t) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-800">{t.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <DueBadge due={t.due} completed={t.status === "Completed"} />
                  <StatusBadge status={t.status} size="sm" />
                  <StatusBadge status={t.priority} size="sm" />
                </div>
              </div>
              <TaskRowActions task={t} busyId={busyId} onOpen={() => setDetail(t)} onTransition={transition} onComplete={() => setCompleteTarget(t)} />
            </div>
          )}
        />
      ) : (
        <TaskBoard tasks={filtered} busyId={busyId} onOpen={setDetail} onTransition={transition} onComplete={(t) => setCompleteTarget(t)} />
      )}

      {/* Task detail drawer */}
      <DetailDrawer
        open={Boolean(detail)}
        onOpenChange={(o) => !o && setDetail(null)}
        wide
        title={
          <span className="flex flex-wrap items-center gap-2">
            {detail?.title}
            {detail?.aiGenerated && <span className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-px text-[10px] font-semibold text-violet-700">AI suggestion</span>}
          </span>
        }
        subtitle={detail ? <span className="flex flex-wrap items-center gap-2"><StatusBadge status={detail.status} size="sm" /><StatusBadge status={detail.priority} size="sm" /></span> : undefined}
        icon={<ListTodo />}
      >
        {detail && (
          <div className="space-y-5">
            <p className="text-[13.5px] leading-relaxed text-slate-700">{detail.detail}</p>
            <dl className="divide-y rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Due</dt>
                <dd><DueBadge due={detail.due} completed={detail.status === "Completed"} /></dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Source</dt>
                <dd><SourceBadge source={detail.source} ai={detail.aiGenerated} /></dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assigned by</dt>
                <dd className="text-[13px] text-slate-700">{detail.ownerId === detail.assigneeId ? "Self" : getEmployee(detail.ownerId)?.name ?? "System"}</dd>
              </div>
              {detail.related && (
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Related</dt>
                  <dd className="text-[13px] font-medium text-blue-700">{detail.related.label} · {detail.related.kind}</dd>
                </div>
              )}
              {detail.completedAt && (
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completed</dt>
                  <dd className="text-[13px] text-slate-700">{fmtDate(detail.completedAt)}, {fmtTime(detail.completedAt)}</dd>
                </div>
              )}
            </dl>

            {detail.aiGenerated && (
              <p className="rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2.5 text-xs leading-relaxed text-violet-800">
                Qubit AI suggested this from your onboarding data. It is permission-aware (based on records you can access) and can be dismissed like any other task.
              </p>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</p>
              <TaskStatusActions task={detail} busy={busyId === detail.id} onTransition={transition} onComplete={() => setCompleteTarget(detail)} />
            </div>
          </div>
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={Boolean(completeTarget)}
        onOpenChange={(o) => !o && setCompleteTarget(null)}
        title="Mark this task as completed?"
        description={completeTarget ? `"${completeTarget.title}" will be recorded as completed with today's timestamp.` : ""}
        confirmLabel="Complete task"
        onConfirm={() => {
          if (completeTarget) transition(completeTarget, "Completed");
          setCompleteTarget(null);
        }}
      />

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function TaskRowActions({
  task,
  busyId,
  onOpen,
  onTransition,
  onComplete,
}: {
  task: Task;
  busyId: string | null;
  onOpen: () => void;
  onTransition: (t: Task, s: TaskStatus) => void;
  onComplete: () => void;
}) {
  const isDone = task.status === "Completed" || task.status === "Cancelled";
  const busy = busyId === task.id;
  return (
    <span className="inline-flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Updating" />
      ) : isDone ? (
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-slate-500" onClick={() => onTransition(task, "In Progress")}>
          <Play className="h-3 w-3" aria-hidden /> Reopen
        </Button>
      ) : (
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-emerald-700 hover:text-emerald-800" onClick={onComplete}>
          <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Complete
        </Button>
      )}
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-slate-500" onClick={onOpen}>
        Details
      </Button>
    </span>
  );
}

function TaskStatusActions({
  task,
  busy,
  onTransition,
  onComplete,
}: {
  task: Task;
  busy: boolean;
  onTransition: (t: Task, s: TaskStatus) => void;
  onComplete: () => void;
}) {
  const isDone = task.status === "Completed" || task.status === "Cancelled";
  return (
    <div className="flex flex-wrap gap-2">
      {busy && <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Updating…</span>}
      {!busy && isDone && (
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => onTransition(task, "In Progress")}>
          <Play className="h-3.5 w-3.5" aria-hidden /> Reopen task
        </Button>
      )}
      {!busy && !isDone && (
        <>
          {task.status === "Not Started" && (
            <Button size="sm" className="h-8 gap-1.5" onClick={() => onTransition(task, "In Progress")}>
              <Play className="h-3.5 w-3.5" aria-hidden /> Start task
            </Button>
          )}
          {task.status === "In Progress" && (
            <>
              <Button size="sm" variant="outline" className="h-8" onClick={() => onTransition(task, "Waiting")}>Move to waiting</Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => onTransition(task, "Blocked")}>Flag blocked</Button>
            </>
          )}
          {(task.status === "Blocked" || task.status === "Waiting") && (
            <Button size="sm" variant="outline" className="h-8" onClick={() => onTransition(task, "In Progress")}>Resume work</Button>
          )}
          <Button size="sm" className="h-8 gap-1.5" onClick={onComplete}>
            <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Mark completed
          </Button>
          {task.status !== "Blocked" && task.status !== "Waiting" && (
            <Button size="sm" variant="ghost" className="h-8 text-slate-500" onClick={() => onTransition(task, "Cancelled")}>
              Cancel task
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function TaskBoard({
  tasks,
  busyId,
  onOpen,
  onTransition,
  onComplete,
}: {
  tasks: Task[];
  busyId: string | null;
  onOpen: (t: Task) => void;
  onTransition: (t: Task, s: TaskStatus) => void;
  onComplete: (t: Task) => void;
}) {
  const groups: { key: string; label: string; statuses: TaskStatus[]; tone: string }[] = [
    { key: "todo", label: "To do", statuses: ["Not Started"], tone: "bg-slate-100 text-slate-600" },
    { key: "active", label: "Active", statuses: ["In Progress"], tone: "bg-blue-50 text-blue-700" },
    { key: "stuck", label: "Blocked / Waiting", statuses: ["Blocked", "Waiting"], tone: "bg-amber-50 text-amber-700" },
    { key: "done", label: "Completed", statuses: ["Completed"], tone: "bg-emerald-50 text-emerald-700" },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" role="list" aria-label="Task board">
      {groups.map((g) => {
        const items = tasks.filter((t) => g.statuses.includes(t.status));
        return (
          <section key={g.key} className="qubit-card flex min-h-40 flex-col overflow-hidden" aria-label={g.label}>
            <header className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
              <h3 className="text-[13px] font-semibold text-slate-800">{g.label}</h3>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", g.tone)}>{items.length}</span>
            </header>
            <div className="qubit-scroll flex-1 space-y-2 overflow-y-auto p-2.5">
              {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-400">Nothing here</p>}
              {items.map((t) => (
                <div key={t.id} role="listitem" className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <button type="button" onClick={() => onOpen(t)} className="w-full text-left">
                    <p className="line-clamp-2 text-[12.5px] font-medium leading-snug text-slate-800">{t.title}</p>
                  </button>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <DueBadge due={t.due} completed={t.status === "Completed"} />
                    <StatusBadge status={t.priority} size="sm" />
                  </div>
                  {t.status !== "Completed" && t.status !== "Cancelled" && busyId !== t.id && (
                    <button
                      type="button"
                      onClick={() => (g.key === "done" ? onTransition(t, "In Progress") : onComplete(t))}
                      className="mt-2 text-[11px] font-medium text-blue-600 hover:text-blue-800"
                    >
                      {g.key === "done" ? "Reopen" : "Mark completed"}
                    </button>
                  )}
                  {busyId === t.id && <Loader2 className="mt-2 h-3.5 w-3.5 animate-spin text-slate-400" aria-label="Updating" />}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TaskSkeleton() {
  return (
    <div className="qubit-card overflow-hidden" aria-hidden>
      <div className="space-y-3 p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-10 flex-1 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">Loading tasks…</span>
    </div>
  );
}
