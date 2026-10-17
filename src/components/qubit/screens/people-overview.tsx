"use client";

import * as React from "react";
import {
  ArrowUpRight,
  CalendarCheck,
  DoorOpen,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard, StatusBadge } from "../primitives";
import {
  AsOfStrip,
  CHART_TICK,
  EXEC_COLORS,
  ExecErrorBanner,
  ExecSkeleton,
  ExecutiveGate,
  FreshnessBadge,
  PeriodChip,
  formatKpiValue,
  useExecutiveSection,
  useExecutiveNav,
} from "../executive/parts";
import { formatPct } from "@/lib/qubit/executive-data";
import type { PeopleData } from "@/lib/qubit/executive-data";

// ============================================================
// Screen 63 · People Overview — aggregated workforce health.
// Spec: executive level shows aggregated data only; individual
// sensitive HR records stay in HR systems behind authorization-
// aware drill-down (KPI Drilldown · 71). Every number comes from
// /api/executive?section=people — none are invented here.
// ============================================================

interface ExecPeriod {
  label: string;
  window: string;
  asOfLabel: string;
}

interface PeoplePayload {
  period: ExecPeriod;
  asOfLabel: string;
  people: PeopleData;
}

const FUNNEL_TINTS = [
  "bg-blue-600",
  "bg-blue-600/85",
  "bg-blue-600/70",
  "bg-blue-600/55",
  "bg-blue-600/40",
];

export function PeopleOverviewScreen() {
  const navigate = useExecutiveNav();
  const { data, loading, error, forbidden, reload } = useExecutiveSection<PeoplePayload>("people");
  const people = data?.people ?? null;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "CEO Command Center" }, { label: "People Overview" }]}
        title="People Overview"
        description="Workforce health at the executive level — headcount, hiring, attrition and distribution, aggregated across the company."
        meta={
          data ? (
            <div className="flex flex-wrap items-center gap-2">
              <FreshnessBadge freshness={people!.freshness} />
              <PeriodChip label={data.period.label} window={data.period.window} />
            </div>
          ) : null
        }
      />

      <ExecutiveGate screenName="People Overview">
        {error && !forbidden && <ExecErrorBanner message={error} onRetry={reload} />}

        {loading && !data && <ExecSkeleton rows={4} />}

        {!loading && !error && data && people && people.trend.length > 0 && (
          <PeopleBody people={people} asOfLabel={data.asOfLabel} period={data.period} navigate={navigate} />
        )}

        {!loading && !error && data && people && people.trend.length === 0 && (
          <SectionCard>
            <EmptyState
              icon={<Users />}
              title="No workforce data for this period"
              message="People metrics appear once the HR source reports for the current period."
            />
          </SectionCard>
        )}
      </ExecutiveGate>
    </div>
  );
}

function PeopleBody({
  people,
  asOfLabel,
  period,
  navigate,
}: {
  people: PeopleData;
  asOfLabel: string;
  period: ExecPeriod;
  navigate: (screen: Parameters<ReturnType<typeof useExecutiveNav>>[0], params?: { kpiId?: string }) => void;
}) {
  const attritionAboveTarget = people.attrition.byDept.filter((d) => d.pct > people.attrition.targetPct);
  const attritionOutlier = attritionAboveTarget.reduce<typeof attritionAboveTarget[number] | null>(
    (worst, d) => (worst === null || d.pct > worst.pct ? d : worst),
    null,
  );

  return (
    <div className="space-y-5">
      {/* Aggregation privacy note — quiet, always visible (spec: no individual HR data at exec level) */}
      <p
        className="flex items-start gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500"
        role="note"
      >
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        Executive view uses aggregated data — individual records remain in HR systems (authorization-aware drill-down).
      </p>

      {/* Workforce health tiles */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          icon={<Users />}
          label="Headcount"
          value={formatKpiValue("count", people.headcount.total)}
          context={`+${people.headcount.netAdded.toLocaleString("en-IN")} net since Apr (${formatKpiValue("count", people.headcount.aprTotal)} → ${formatKpiValue("count", people.headcount.total)})`}
        />
        <Tile
          icon={<DoorOpen />}
          label="Annualized attrition"
          value={formatKpiValue("pct", people.attrition.annualizedPct)}
          context={`vs ${formatKpiValue("pct", people.attrition.targetPct)} target`}
          badge={<StatusBadge status="At Risk" size="sm" />}
          tone="alert"
        />
        <Tile
          icon={<UserPlus />}
          label="Open positions"
          value={formatKpiValue("count", people.hiring.openPositions)}
          context={`${people.hiring.offersInFlight} offers in flight · time-to-fill ${people.hiring.avgTimeToFillDays} vs ${people.hiring.timeToFillTarget} days`}
        />
        <Tile
          icon={<CalendarCheck />}
          label="Attendance"
          value={formatKpiValue("pct", people.attendancePct)}
          context="Company-wide, current month"
        />
      </div>

      {/* Trend + hiring funnel */}
      <div className="grid gap-3 xl:grid-cols-3">
        <SectionCard
          title="Headcount trend — hires vs exits"
          description="Monthly hires and exits (bars) with total headcount (line). Exits are visibly rising while hiring holds flat."
          className="xl:col-span-2"
        >
          <HeadcountTrendChart data={people.trend} />
        </SectionCard>

        <SectionCard
          title="Hiring funnel"
          description="Open requisitions this quarter, stage by stage."
        >
          <FunnelBars stages={people.hiring.funnel} />
          <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400">
            Time-to-fill is {people.hiring.avgTimeToFillDays} days against a {people.hiring.timeToFillTarget}-day target —{" "}
            {people.hiring.avgTimeToFillDays > people.hiring.timeToFillTarget
              ? `${people.hiring.avgTimeToFillDays - people.hiring.timeToFillTarget} days slower than plan.`
              : "within plan."}
          </p>
        </SectionCard>
      </div>

      {/* Attrition by department + distribution */}
      <div className="grid gap-3 xl:grid-cols-2">
        <SectionCard
          title="Attrition by department"
          description={`Annualized, vs ${formatPct(people.attrition.targetPct, 0)} company target — ${attritionAboveTarget.length} department${attritionAboveTarget.length === 1 ? "" : "s"} above target.`}
        >
          <AttritionBars
            items={people.attrition.byDept.map((d) => ({ department: d.department, pct: d.pct, exitsQtd: d.exitsQtd }))}
            targetPct={people.attrition.targetPct}
            companyPct={people.attrition.annualizedPct}
          />
          {attritionOutlier && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-xs leading-relaxed text-red-700" role="note">
              <span className="font-semibold">{attritionOutlier.department}</span> is the outlier at {formatPct(attritionOutlier.pct)} —{" "}
              {(attritionOutlier.pct - people.attrition.annualizedPct).toFixed(1)} pts above the company average, with{" "}
              {attritionOutlier.exitsQtd} exits this quarter. A retention review with the HR Head is recommended.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Department distribution"
          description="Where the workforce sits today — aggregated headcount by department."
        >
          <DistributionList items={people.distribution} total={people.headcount.total} />
        </SectionCard>
      </div>

      {/* Insights + cross-links */}
      <SectionCard
        title="What this means"
        description="Aggregated signals that warrant executive attention."
        actions={
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigate("kpi-drilldown", { kpiId: "kpi-attrition" })}
              className="group/link inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              Investigate attrition KPI
              <ArrowUpRight
                className="h-3.5 w-3.5 transition-transform duration-150 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
                aria-hidden
              />
            </button>
            <button
              type="button"
              onClick={() => navigate("executive-alerts")}
              className="group/link inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              Executive alerts
              <ArrowUpRight
                className="h-3.5 w-3.5 transition-transform duration-150 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
                aria-hidden
              />
            </button>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          {people.insights.map((insight) => (
            <article key={insight.title} className="flex h-full flex-col rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[13.5px] font-semibold leading-snug text-slate-800">{insight.title}</h3>
                <StatusBadge status={insight.level} size="sm" />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{insight.detail}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      <AsOfStrip asOfLabel={asOfLabel} note={`People reporting period: ${period.label} (${period.window}).`} />
    </div>
  );
}

// ---------- local pieces ----------

function Tile({
  icon,
  label,
  value,
  context,
  badge,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  context: string;
  badge?: React.ReactNode;
  tone?: "default" | "alert";
}) {
  return (
    <article className={cn("qubit-card qubit-card-hover flex h-full flex-col p-4", tone === "alert" && "border-red-200")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-slate-500">
          <span className="qubit-icon-tile qubit-icon-tile-accent h-5 w-5 shrink-0 [&_svg]:h-3 [&_svg]:w-3" aria-hidden>
            {icon}
          </span>
          <span className="truncate">{label}</span>
        </h3>
        {badge}
      </div>
      <p className={cn("mt-2 text-[24px] font-bold leading-none tracking-tight tabular-nums", tone === "alert" ? "text-red-700" : "text-slate-900")}>
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{context}</p>
    </article>
  );
}

function HeadcountTrendChart({ data }: { data: PeopleData["trend"] }) {
  const config = {
    hires: { label: "Hires", color: EXEC_COLORS.primary },
    exits: { label: "Exits", color: EXEC_COLORS.amber },
    headcount: { label: "Headcount", color: EXEC_COLORS.teal },
  } satisfies ChartConfig;

  return (
    <ChartContainer
      config={config}
      role="img"
      aria-label={`Headcount trend April to November: hires versus exits by month with total headcount rising from ${data[0]?.headcount.toLocaleString("en-IN")} to ${data[data.length - 1]?.headcount.toLocaleString("en-IN")}`}
      className={cn("h-64 w-full", CHART_TICK)}
    >
      <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} interval={0} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="flow" tickLine={false} axisLine={false} width={26} allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="hc"
          orientation="right"
          domain={["dataMin - 30", "dataMax + 15"]}
          tickLine={false}
          axisLine={false}
          width={40}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend verticalAlign="bottom" content={<ChartLegendContent />} />
        <Bar yAxisId="flow" dataKey="hires" fill="var(--color-hires)" radius={[3, 3, 0, 0]} maxBarSize={16} />
        <Bar yAxisId="flow" dataKey="exits" fill="var(--color-exits)" radius={[3, 3, 0, 0]} maxBarSize={16} />
        <Line yAxisId="hc" dataKey="headcount" stroke="var(--color-headcount)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ChartContainer>
  );
}

function FunnelBars({ stages }: { stages: PeopleData["hiring"]["funnel"] }) {
  const top = stages[0]?.count ?? 1;
  return (
    <ol className="space-y-3.5" aria-label="Hiring funnel by stage">
      {stages.map((stage, i) => {
        const prev = i > 0 ? stages[i - 1] : null;
        const conv = prev && prev.count > 0 ? (stage.count / prev.count) * 100 : null;
        return (
          <li key={stage.stage}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium text-slate-700">{stage.stage}</span>
              <span className="tabular-nums text-slate-600">
                {stage.count.toLocaleString("en-IN")}
                {conv !== null && (
                  <span className="ml-1.5 text-[11px] text-slate-400">
                    {conv.toFixed(1)}% from {prev!.stage.toLowerCase()}
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1 h-3 rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full transition-all duration-200", FUNNEL_TINTS[Math.min(i, FUNNEL_TINTS.length - 1)])}
                style={{ width: `${Math.max(4, (stage.count / top) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function AttritionBars({
  items,
  targetPct,
  companyPct,
}: {
  items: PeopleData["attrition"]["byDept"];
  targetPct: number;
  companyPct: number;
}) {
  const max = Math.max(...items.map((d) => d.pct), targetPct);
  return (
    <ul className="space-y-2.5" aria-label="Attrition by department">
      {items.map((d) => {
        const flagged = d.pct > companyPct + 2; // Service-style outlier: well above company average
        const aboveTarget = d.pct > targetPct;
        return (
          <li key={d.department}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate font-medium text-slate-700">{d.department}</span>
              <span className="shrink-0 tabular-nums text-slate-600">
                {formatPct(d.pct)}
                {flagged ? (
                  <span className="ml-1.5 text-[11px] font-medium text-red-600">
                    {(d.pct - companyPct).toFixed(1)} pts above company avg · {d.exitsQtd} exits QTD
                  </span>
                ) : aboveTarget ? (
                  <span className="ml-1.5 text-[11px] text-amber-600">above {formatPct(targetPct, 0)} target</span>
                ) : (
                  <span className="ml-1.5 text-[11px] text-slate-400">{d.exitsQtd} exits QTD</span>
                )}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full", flagged ? "bg-red-500/90" : "bg-blue-600/85")}
                style={{ width: `${(d.pct / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DistributionList({ items, total }: { items: PeopleData["distribution"]; total: number }) {
  const safeTotal = total > 0 ? total : 1;
  return (
    <ul className="space-y-2.5" aria-label="Headcount distribution by department">
      {items.map((d) => (
        <li key={d.department}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate font-medium text-slate-700">{d.department}</span>
            <span className="shrink-0 tabular-nums text-slate-600">
              {d.count.toLocaleString("en-IN")}
              <span className="ml-1.5 text-[11px] text-slate-400">{((d.count / safeTotal) * 100).toFixed(1)}%</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600/85"
              style={{ width: `${Math.max(2, (d.count / items[0].count) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
