"use client";

import * as React from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Gauge,
  ShieldAlert,
  Smile,
  Timer,
  Ticket,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
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
  MiniTrend,
  PeriodChip,
  formatKpiValue,
  useExecutiveSection,
  useExecutiveNav,
} from "../executive/parts";
import { formatINR, formatPct } from "@/lib/qubit/executive-data";
import type { Kpi, ServiceData } from "@/lib/qubit/executive-data";

// ============================================================
// Screen 65 · Service Overview — exceptions prioritized. The
// critical-accounts panel leads the screen because service
// failures inside active renewals carry commercial risk. Every
// number comes from /api/executive (sections: service + kpis
// for the by-priority SLA split, which lives on kpi-sla).
// ============================================================

interface ExecPeriod {
  label: string;
  window: string;
  asOfLabel: string;
}

interface ServicePayload {
  period: ExecPeriod;
  asOfLabel: string;
  service: ServiceData;
}

interface KpisPayload {
  period: ExecPeriod;
  asOfLabel: string;
  kpis: Kpi[];
}

export function ServiceOverviewScreen() {
  const navigate = useExecutiveNav();
  const { data, loading, error, forbidden, reload } = useExecutiveSection<ServicePayload>("service");
  const kpis = useExecutiveSection<KpisPayload>("kpis");
  const service = data?.service ?? null;
  const slaKpi = kpis.data?.kpis.find((k) => k.id === "kpi-sla") ?? null;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "CEO Command Center" }, { label: "Service Overview" }]}
        title="Service Overview"
        description="Customer service health — critical exceptions first, then SLA, backlog and team performance, aggregated."
        meta={
          data ? (
            <div className="flex flex-wrap items-center gap-2">
              <FreshnessBadge freshness={service!.freshness} />
              <PeriodChip label={data.period.label} window={data.period.window} />
            </div>
          ) : null
        }
      />

      <ExecutiveGate screenName="Service Overview">
        {(error || (kpis.error && !kpis.data)) && !forbidden && (
          <ExecErrorBanner message={error ?? kpis.error ?? "The executive data service is unreachable right now."} onRetry={() => { reload(); kpis.reload(); }} />
        )}

        {(loading || (kpis.loading && !kpis.data)) && !data && <ExecSkeleton rows={4} />}

        {!loading && !error && data && service && (service.criticalAccounts.length > 0 || service.tickets.open > 0) && (
          <ServiceBody service={service} slaKpi={slaKpi} asOfLabel={data.asOfLabel} period={data.period} navigate={navigate} />
        )}

        {!loading && !error && data && service && service.criticalAccounts.length === 0 && service.tickets.open === 0 && (
          <SectionCard>
            <EmptyState
              icon={<CheckCircle2 />}
              title="No open service exceptions"
              message="There are no open tickets and no critical accounts in the current window — the detail views appear once the service desk reports activity."
            />
          </SectionCard>
        )}
      </ExecutiveGate>
    </div>
  );
}

function ServiceBody({
  service,
  slaKpi,
  asOfLabel,
  period,
  navigate,
}: {
  service: ServiceData;
  slaKpi: Kpi | null;
  asOfLabel: string;
  period: ExecPeriod;
  navigate: (screen: Parameters<ReturnType<typeof useExecutiveNav>>[0], params?: { kpiId?: string }) => void;
}) {
  const breached = service.criticalAccounts.filter((a) => a.slaBreached);
  const combinedValue = service.criticalAccounts.reduce((sum, a) => sum + a.accountValue, 0);
  const backlogFirst = service.tickets.backlogTrend[0]?.open ?? 0;
  const backlogLast = service.tickets.backlogTrend[service.tickets.backlogTrend.length - 1]?.open ?? 0;
  const backlogDelta = backlogLast - backlogFirst;

  return (
    <div className="space-y-5">
      {/* ── EXCEPTIONS FIRST — critical accounts panel ─────────── */}
      <SectionCard
        title="Critical accounts — active exceptions"
        description="Unresolved critical issues on accounts with active renewals or expansion deals. This panel leads the screen on purpose."
        actions={
          <div className="flex flex-wrap items-center gap-4">
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
            <button
              type="button"
              onClick={() => navigate("sales-command")}
              className="group/link inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              Sales Command Center
              <ArrowUpRight
                className="h-3.5 w-3.5 transition-transform duration-150 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
                aria-hidden
              />
            </button>
          </div>
        }
      >
        {service.criticalAccounts.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 />}
            title="No critical accounts right now"
            message="When a high-value account has an unresolved critical issue, it is listed here first."
            className="py-8"
          />
        ) : (
          <>
            <ul className="divide-y" aria-label="Critical accounts with unresolved issues">
              {service.criticalAccounts.map((acc) => (
                <li key={acc.account} className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0 md:flex-row md:items-center md:gap-4">
                  <div className="min-w-0 md:w-56 md:shrink-0">
                    <p className="truncate text-[13.5px] font-semibold text-slate-900">{acc.account}</p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">Account value {formatINR(acc.accountValue)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug text-slate-700">{acc.issue}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Open {acc.hoursOpen} h · assigned to {acc.engineer}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {acc.slaBreached ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                        SLA breached
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden />
                        Within SLA
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3" role="note">
              <p className="flex items-start gap-2 text-[13px] font-medium leading-relaxed text-red-800">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                {formatINR(combinedValue)} combined account value is inside active renewals
                {breached.length > 0 && ` — ${breached.length} of ${service.criticalAccounts.length} have breached SLA`}
                .
              </p>
              <p className="mt-1.5 pl-6 text-xs leading-relaxed text-red-700">
                Recommendation: join the escalation calls and ask the Service Manager for a joint recovery plan before the
                renewal negotiations advance — service failures during commercial discussions carry renewal risk.
              </p>
            </div>
          </>
        )}
      </SectionCard>

      {/* ── Service health tiles ───────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Tile
          icon={<Ticket />}
          label="Open tickets"
          value={formatKpiValue("count", service.tickets.open)}
          context={`${service.tickets.openCritical} critical`}
          tone={service.tickets.openCritical > 0 ? "alert" : "default"}
        />
        <Tile
          icon={<CheckCircle2 />}
          label="Resolved · 30 d"
          value={formatKpiValue("count", service.tickets.resolved30d)}
          context="Last 30 days"
        />
        <Tile
          icon={<Gauge />}
          label="SLA compliance"
          value={formatKpiValue("pct", service.sla.compliancePct)}
          context={`vs ${formatKpiValue("pct", service.sla.targetPct)} target · ${service.sla.breachedCritical} critical breached`}
          badge={<StatusBadge status="Watch" size="sm" />}
          tone="alert"
        />
        <Tile
          icon={<Timer />}
          label="First response"
          value={formatKpiValue("min", service.times.firstResponseMin)}
          context={`vs ${service.times.responseTargetMin} min target`}
        />
        <Tile
          icon={<Timer />}
          label="Resolution time"
          value={formatKpiValue("hours", service.times.resolutionHours)}
          context="Average, last 30 days"
        />
        <Tile
          icon={<Smile />}
          label="CSAT"
          value={`${service.csat.score.toFixed(2)} / 5`}
          context={`${formatKpiValue("count", service.csat.responses)} responses`}
        />
      </div>

      {/* ── Backlog trend + SLA by priority ───────────────────── */}
      <div className="grid gap-3 xl:grid-cols-2">
        <SectionCard
          title="Open-ticket backlog"
          description="Weekly backlog over the last five periods."
        >
          {/* MiniTrend's ariaLabel prop is not rendered by the shared part — label the wrapper for AT users */}
          <div
            role="img"
            aria-label={`Area chart of the open-ticket backlog over five weeks: ${service.tickets.backlogTrend.map((w) => `${w.week} ${w.open}`).join(", ")}`}
          >
            <MiniTrend
              data={service.tickets.backlogTrend.map((w) => ({ label: w.week, value: w.open }))}
              color={EXEC_COLORS.emerald}
              height={160}
            />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            {backlogDelta < 0
              ? `Backlog is down ${Math.abs(backlogDelta)} tickets over five weeks (${backlogFirst} → ${backlogLast}) — falling is good.`
              : backlogDelta === 0
                ? `Backlog held flat at ${backlogLast} tickets over five weeks.`
                : `Backlog rose ${backlogDelta} tickets over five weeks (${backlogFirst} → ${backlogLast}) — watch incoming volume.`}
          </p>
        </SectionCard>

        <SectionCard
          title="SLA compliance by priority"
          description={
            slaKpi
              ? `${slaKpi.period} — explicit percentages against the ${formatPct(service.sla.targetPct, 0)} target.`
              : "By-priority split pending — company compliance shown above."
          }
        >
          {slaKpi && slaKpi.contributors.length > 0 ? (
            <SlaByPriorityChart
              items={slaKpi.contributors.map((c) => ({ label: c.label, actual: c.value }))}
              targetPct={service.sla.targetPct}
            />
          ) : (
            <EmptyState
              icon={<Gauge />}
              title="By-priority split not available"
              message="The KPI drilldown has not reported the P1/P2/P3 split for this period."
              className="py-8"
            />
          )}
        </SectionCard>
      </div>

      {/* ── Engineer performance (aggregated) ─────────────────── */}
      <SectionCard
        title="Engineer performance — top 5"
        description="Aggregated 30-day view: resolutions, CSAT and SLA per engineer. Individual coaching stays with the Service Manager."
      >
        <div className="-mx-4 overflow-x-auto md:-mx-5">
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <caption className="sr-only">Top five engineers by 30-day resolutions, with CSAT and SLA compliance</caption>
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th scope="col" className="px-4 py-2.5 font-semibold md:px-5">Engineer</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold md:px-5">Resolved · 30 d</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold md:px-5">CSAT</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold md:px-5">SLA</th>
              </tr>
            </thead>
            <tbody>
              {service.engineers.map((e) => (
                <tr key={e.name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <th scope="row" className="px-4 py-3 text-left font-medium text-slate-800 md:px-5">{e.name}</th>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 md:px-5">{e.resolved30d.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 md:px-5">{e.csat.toFixed(1)} / 5</td>
                  <td className="px-4 py-3 text-right tabular-nums md:px-5">
                    <span className={cn("font-medium", e.slaPct >= service.sla.targetPct ? "text-emerald-700" : "text-amber-700")}>
                      {formatPct(e.slaPct, 0)}
                    </span>
                    <span className="ml-1.5 text-[11px] text-slate-400">
                      {e.slaPct >= service.sla.targetPct ? "at/above target" : "below target"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <AsOfStrip asOfLabel={asOfLabel} note={`Service reporting period: ${period.label} (${period.window}).`} />
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
    <article className={cn("qubit-card qubit-card-hover flex h-full flex-col p-4", tone === "alert" && "border-amber-200")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-slate-500">
          <span className="qubit-icon-tile qubit-icon-tile-accent h-5 w-5 shrink-0 [&_svg]:h-3 [&_svg]:w-3" aria-hidden>
            {icon}
          </span>
          <span className="truncate">{label}</span>
        </h3>
        {badge}
      </div>
      <p className={cn("mt-2 text-[22px] font-bold leading-none tracking-tight tabular-nums", tone === "alert" ? "text-amber-700" : "text-slate-900")}>
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{context}</p>
    </article>
  );
}

function SlaByPriorityChart({
  items,
  targetPct,
}: {
  items: { label: string; actual: number }[];
  targetPct: number;
}) {
  const config = {
    actual: { label: "SLA compliance", color: EXEC_COLORS.primary },
  } satisfies ChartConfig;

  return (
    <ChartContainer
      config={config}
      role="img"
      aria-label={`SLA compliance by priority: ${items.map((i) => `${i.label} ${formatPct(i.actual)}`).join(", ")} — against a ${formatPct(targetPct, 0)} target`}
      className={cn("h-56 w-full md:h-64", CHART_TICK)}
    >
      <BarChart data={items} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} tick={{ fontSize: 11 }} />
        <YAxis
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          width={38}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `${v}%`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ReferenceLine
          y={targetPct}
          stroke={EXEC_COLORS.slate}
          strokeDasharray="4 4"
          label={{ value: `Target ${formatPct(targetPct, 0)}`, position: "insideTopRight", fontSize: 10, fill: EXEC_COLORS.slate }}
        />
        <Bar dataKey="actual" radius={[3, 3, 0, 0]} maxBarSize={56}>
          <LabelList
            dataKey="actual"
            position="top"
            fontSize={11}
            fill="#64748B"
            formatter={(v: React.ReactNode) => formatPct(Number(v))}
          />
          {items.map((item) => (
            <Cell
              key={item.label}
              fill={item.actual < targetPct ? EXEC_COLORS.amber : EXEC_COLORS.primary}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
