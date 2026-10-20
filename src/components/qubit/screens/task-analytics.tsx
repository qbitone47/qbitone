"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard, StatTile } from "../primitives";
import { useQubitNav } from "../nav-context";
import {
  AnalyticsAsOf,
  AnalyticsErrorBanner,
  AnalyticsSkeleton,
  BarList,
  ColumnChart,
  MetricDef,
  ScopeNote,
  SourceLine,
  useAnalyticsSection,
} from "../analytics/parts";
import { metricById } from "@/lib/qubit/analytics-data";

// ============================================================
// Screen 276 · Task Analytics — analytics over the ONE Qubit task
// system (spec §18). No second task database exists or is created
// here; the workspace store is the source, scoped server-side.
// ============================================================

interface TasksPayload {
  asOfLabel: string;
  scope: string;
  scopeNote: string;
  totals: { total: number; open: number; completed: number; overdue: number; blocked: number; cancelled: number };
  completionRatePct: number | null;
  turnaroundNote: string;
  byStatus: { label: string; count: number }[];
  byPriority: { label: string; count: number }[];
  byDept: { label: string; count: number }[];
  workload: { label: string; count: number }[];
  overdueTrend: { label: string; count: number }[];
  freshness: { status: string; updatedAt: number; label: string; detail?: string };
  sourceNote: string;
}

export function TaskAnalyticsScreen() {
  const nav = useQubitNav();
  const { data, loading, error, reload } = useAnalyticsSection<TasksPayload>("tasks");
  const go = (screen: Parameters<typeof nav.navigate>[0], params?: Parameters<typeof nav.navigate>[1]) => () => nav.navigate(screen, params);

  if (loading) return <div className="mx-auto max-w-6xl"><PageHeader crumbs={[{ label: "Analytics" }, { label: "Task Analytics" }]} title="Task Analytics" /> <AnalyticsSkeleton rows={4} /></div>;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader crumbs={[{ label: "Analytics" }, { label: "Task Analytics" }]} title="Task Analytics" />
        <AnalyticsErrorBanner message={error} onRetry={reload} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Task Analytics" }]}
        title="Task Analytics"
        description="Status, priority, workload and overdue trends over the ONE workspace task store — scoped to your authorization."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11.5px] font-medium capitalize text-slate-600">{data.scope} scope · server-enforced</span>
            <SourceLine system="Workspace · task system" freshness={undefined} />
          </div>
        }
        actions={<button type="button" onClick={reload} className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700">Refresh</button>}
      />

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile value={String(data.totals.total)} label="Total tasks in scope" />
          <StatTile value={String(data.totals.open)} label="Open" onClick={go("my-tasks")} />
          <StatTile value={String(data.totals.completed)} label="Completed" />
          <StatTile value={String(data.totals.overdue)} label="Overdue" />
          <StatTile value={String(data.totals.blocked)} label="Blocked" />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SectionCard title="Due-date pressure" description="Where the open work sits relative to today.">
            <BarList
              ariaLabel={`Due pressure: ${data.overdueTrend.map((o) => `${o.label} ${o.count}`).join(", ")}`}
              items={data.overdueTrend.map((o) => ({ label: o.label, value: o.count, tone: o.label === "Overdue now" ? "bg-rose-500" : o.label === "Due today" ? "bg-amber-500" : "bg-blue-500" }))}
              unit="tasks"
            />
            <ScopeNote className="mt-3">Overdue = due date passed and not completed/cancelled. The completion-rate definition is governed and shown beside the headline tile.</ScopeNote>
          </SectionCard>

          <SectionCard title="Status distribution" description="Full lifecycle vocabulary — no extra states invented.">
            <BarList
              ariaLabel={`By status: ${data.byStatus.map((s) => `${s.label} ${s.count}`).join(", ")}`}
              items={data.byStatus.map((s) => ({ label: s.label, value: s.count, tone: s.label === "Blocked" ? "bg-rose-500" : s.label === "Completed" ? "bg-emerald-500" : s.label === "Cancelled" ? "bg-slate-300" : "bg-blue-500" }))}
              unit="tasks"
            />
          </SectionCard>

          <SectionCard title="Department comparison" description="Tasks by the assignee's department (cross-module join, computed at read time).">
            {data.byDept.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tasks in scope.</p>
            ) : (
              <ColumnChart
                points={data.byDept.slice(0, 8).map((d) => ({ label: d.label.slice(0, 10), value: d.count }))}
                unit="tasks"
                ariaLabel={`By department: ${data.byDept.map((d) => `${d.label} ${d.count}`).join(", ")}`}
                summary={`${data.byDept.slice(0, 5).map((d) => `${d.label}: ${d.count}`).join("; ")}. Departments are resolved from the employee registry at read time — the task store holds no duplicate org data.`}
              />
            )}
          </SectionCard>

          <SectionCard title="Workload by assignee" description={data.scope === "own" ? "Your own task count — team workload needs a manager boundary." : "Top assignees within your scope."}>
            {data.workload.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tasks in scope.</p>
            ) : (
              <BarList
                ariaLabel={`Workload: ${data.workload.map((w) => `${w.label} ${w.count}`).join(", ")}`}
                items={data.workload.map((w) => ({ label: w.label, value: w.count }))}
                unit="tasks"
              />
            )}
            <ScopeNote className="mt-3">{data.scopeNote}</ScopeNote>
          </SectionCard>
        </div>

        <SectionCard title="Definitions & source" description="Metric governance for this screen.">
          <div className="space-y-2.5">
            <MetricDef metric={metricById("task-completion")} />
            <ScopeNote>{data.sourceNote}</ScopeNote>
            <ScopeNote>{data.turnaroundNote}</ScopeNote>
          </div>
        </SectionCard>

        <AnalyticsAsOf asOfLabel={data.asOfLabel} />
      </div>
    </div>
  );
}
