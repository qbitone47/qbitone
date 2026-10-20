"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "../page-header";
import { SectionCard, StatTile } from "../primitives";
import { useQubitNav } from "../nav-context";
import {
  AnalyticsAsOf,
  AnalyticsErrorBanner,
  AnalyticsSkeleton,
  BarList,
  MetricDef,
  ScopeNote,
  SourceLine,
  useAnalyticsSection,
} from "../analytics/parts";
import { metricById } from "@/lib/qubit/analytics-data";

// ============================================================
// Screen 275 · Employee Productivity — privacy-conscious by
// construction (spec §17): metrics come only from work items the
// caller already owns (tasks, meetings, approvals). No efficiency
// scores, no screen-time, no activity tracking — those metrics do
// not exist anywhere in Qubit One, and the screen says so.
// Managers see team aggregates; employees see their own work.
// ============================================================

interface ProductivityPayload {
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
  freshness: { status: string; updatedAt: number; label: string; detail?: string };
  privacyNote: string;
  personal: { meetingsThisWeek: number; meetingHoursThisWeek: number; meetingsDefinition: string };
}

export function EmployeeProductivityScreen() {
  const nav = useQubitNav();
  const { data, loading, error, reload } = useAnalyticsSection<ProductivityPayload>("productivity");
  const go = (screen: Parameters<typeof nav.navigate>[0], params?: Parameters<typeof nav.navigate>[1]) => () => nav.navigate(screen, params);

  if (loading) return <div className="mx-auto max-w-6xl"><PageHeader crumbs={[{ label: "Analytics" }, { label: "Employee Productivity" }]} title="Employee Productivity" /> <AnalyticsSkeleton rows={4} /></div>;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader crumbs={[{ label: "Analytics" }, { label: "Employee Productivity" }]} title="Employee Productivity" />
        <AnalyticsErrorBanner message={error} onRetry={reload} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Employee Productivity" }]}
        title="Employee Productivity"
        description="Task throughput and workload from the ONE workspace task store — scoped to you, or to your team if your boundary allows it."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11.5px] font-medium capitalize text-slate-600">{data.scope} scope · server-enforced</span>
            <SourceLine system="Workspace task store" freshness={undefined} />
          </div>
        }
        actions={<button type="button" onClick={reload} className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700">Refresh</button>}
      />

      <div className="space-y-5">
        {/* The privacy contract — explicit */}
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-[12.5px] leading-relaxed text-emerald-900">{data.privacyNote}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile value={String(data.totals.open)} label="Open tasks" onClick={go("my-tasks")} />
          <StatTile value={String(data.totals.completed)} label="Completed" />
          <StatTile value={String(data.totals.overdue)} label="Overdue" />
          <article className="qubit-card p-4">
            <MetricDef metric={metricById("task-completion")} />
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">{data.completionRatePct !== null ? `${data.completionRatePct}%` : "—"}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">On-time completion (tasks due so far)</p>
          </article>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SectionCard title="Workload distribution" description={data.scope === "own" ? "Your tasks by status and priority." : "Tasks by assignee within your authorized scope — counts only."}>
            {data.workload.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tasks in scope.</p>
            ) : (
              <BarList
                ariaLabel={`Workload: ${data.workload.map((w) => `${w.label} ${w.count} tasks`).join(", ")}`}
                items={data.workload.map((w) => ({ label: w.label, value: w.count }))}
                unit="tasks"
              />
            )}
            <ScopeNote className="mt-3">{data.scopeNote}</ScopeNote>
          </SectionCard>

          <SectionCard title="Status & priority mix" description="The full status vocabulary from the ONE task system.">
            <BarList
              ariaLabel={`By status: ${data.byStatus.map((s) => `${s.label} ${s.count}`).join(", ")}`}
              items={data.byStatus.map((s) => ({ label: s.label, value: s.count, tone: s.label === "Blocked" ? "bg-rose-500" : s.label === "Completed" ? "bg-emerald-500" : "bg-blue-500" }))}
              unit="tasks"
            />
            <div className="mt-4 border-t border-slate-100 pt-3">
              <BarList
                ariaLabel={`By priority: ${data.byPriority.map((s) => `${s.label} ${s.count}`).join(", ")}`}
                items={data.byPriority.map((s) => ({ label: s.label, value: s.count, tone: s.label === "High" ? "bg-amber-500" : "bg-slate-400" }))}
                unit="tasks"
                tone="slate"
              />
            </div>
          </SectionCard>

          <SectionCard title="Turnaround" description="Completion timing against due dates.">
            <p className="text-[13px] leading-relaxed text-slate-700">{data.turnaroundNote}</p>
            <ScopeNote className="mt-3">
              Turnaround uses due dates and completion timestamps already held by the task record — nothing is measured outside the work item itself.
            </ScopeNote>
          </SectionCard>

          <SectionCard title="Meetings this week" description={data.personal.meetingsDefinition}>
            <div className="grid grid-cols-2 gap-2">
              <StatTile value={String(data.personal.meetingsThisWeek)} label="Meetings (±7 days)" onClick={go("my-meetings")} />
              <StatTile value={`${data.personal.meetingHoursThisWeek}h`} label="Scheduled hours" />
            </div>
            <ScopeNote className="mt-3">
              Meeting load is shown for context of the workload above. Action items live on the Meetings module (45) with their own permissions.
            </ScopeNote>
          </SectionCard>
        </div>

        <AnalyticsAsOf asOfLabel={data.asOfLabel} />
      </div>
    </div>
  );
}
