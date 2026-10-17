"use client";

import * as React from "react";
import {
  CalendarClock,
  RefreshCw,
  ShieldAlert,
  Target,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EXEC_PERIOD,
  formatINR,
  formatPct,
  type Opportunity,
  type SalesData,
} from "@/lib/qubit/executive-data";
import type { ScreenId, ScreenParams } from "@/lib/qubit/screens";
import { PageHeader } from "../page-header";
import { ArrowLink, EmptyState, SectionCard, StatusBadge } from "../primitives";
import { DetailDrawer } from "../drawers";
import {
  AsOfStrip,
  ExecErrorBanner,
  ExecSkeleton,
  ExecutiveGate,
  FreshnessBadge,
  PeriodChip,
  TrendArrow,
  useExecutiveSection,
  useExecutiveNav,
} from "../executive/parts";

// ============================================================
// Screen 61 · Sales Command Center — the executive sales COMMAND
// view: bookings, forecast confidence, pipeline coverage and the
// deals that move the quarter. Sits above the detailed sales
// workspace; every number comes from the canonical SALES block
// via /api/executive?section=sales (server-gated to executive
// authority). Figures are bookings basis — recognized revenue is
// presented on the Revenue Snapshot (60).
// ============================================================

interface SalesSectionPayload {
  asOf: number;
  asOfLabel: string;
  period: typeof EXEC_PERIOD;
  sales: SalesData;
}

const TH =
  "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500";
const TH_RIGHT = cn(TH, "text-right");

export function SalesCommandScreen() {
  const navigate = useExecutiveNav();
  const { data, loading, error, reload } = useExecutiveSection<SalesSectionPayload>("sales");
  const sales = data?.sales ?? null;

  const [detail, setDetail] = React.useState<Opportunity | null>(null);

  const slipped = React.useMemo(() => sales?.atRisk.filter((o) => o.slippedFrom) ?? [], [sales]);
  const slippedValue = slipped.reduce((s, o) => s + o.value, 0);

  return (
    <ExecutiveGate screenName="Sales Command Center">
      <div>
        <PageHeader
          crumbs={[{ label: "CEO Command Center" }, { label: "Sales Command Center" }]}
          title="Sales Command Center"
          description="Q3 bookings, forecast confidence and pipeline health on a bookings basis — the command view above the detailed sales workspace."
          actions={
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={reload}
              aria-label="Reload sales data"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
            </Button>
          }
          meta={
            sales && data ? (
              <div className="flex flex-wrap items-center gap-2">
                <PeriodChip label={data.period.label} window={data.period.window} />
                <FreshnessBadge freshness={sales.freshness} />
              </div>
            ) : undefined
          }
        />

        {error && <ExecErrorBanner message={error} onRetry={reload} />}

        {loading ? (
          <ExecSkeleton rows={6} />
        ) : !sales || !data ? (
          !error && (
            <SectionCard>
              <EmptyState
                icon={<TrendingUp />}
                title="No sales data available"
                message="The executive sales section returned no data for this period. Retry the load — if it persists, the sales pipeline source may be offline."
                action={
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={reload}>
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
                  </Button>
                }
              />
            </SectionCard>
          )
        ) : (
          <div className="space-y-6">
            {/* ── Headline band: bookings · forecast · pipeline ── */}
            <HeadlineBand sales={sales} elapsedPct={data.period.elapsedPct} />

            {/* ── Efficiency metric tiles ── */}
            <MetricTiles metrics={sales.metrics} />

            {/* ── Pipeline funnel ── */}
            <PipelineFunnel sales={sales} periodLabel={data.period.label} />

            {/* ── Top opportunities ── */}
            <TopOpportunities items={sales.topOpportunities} onOpen={setDetail} />

            {/* ── At-risk opportunities + variance callout ── */}
            <AtRiskOpportunities
              items={sales.atRisk}
              slipped={slipped}
              slippedValue={slippedValue}
              onOpen={setDetail}
              onNavigate={navigate}
            />

            {/* ── Regional performance ── */}
            <RegionalPerformance sales={sales} elapsedPct={data.period.elapsedPct} />

            <AsOfStrip
              asOfLabel={data.asOfLabel}
              note="Figures are bookings basis — recognized revenue appears on the Revenue Snapshot."
            />
          </div>
        )}
      </div>

      {/* Opportunity detail drawer — same detail, progressive disclosure */}
      <DetailDrawer
        open={Boolean(detail)}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail?.name ?? ""}
        subtitle={detail ? `${detail.account} · ${detail.stage}` : undefined}
        icon={<Target />}
        footer={
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              setDetail(null);
              navigate("kpi-drilldown", { kpiId: "kpi-pipeline" });
            }}
          >
            Open pipeline KPI drilldown
          </Button>
        }
      >
        {detail && <OpportunityDetail opp={detail} />}
      </DetailDrawer>
    </ExecutiveGate>
  );
}

// ---------- headline band: bookings · forecast · pipeline ----------

function HeadlineBand({ sales, elapsedPct }: { sales: SalesData; elapsedPct: number }) {
  const { quarter, forecast, pipeline } = sales;
  const attainedPct = quarter.target > 0 ? (quarter.bookingsToDate / quarter.target) * 100 : 0;
  const coveragePct =
    pipeline.coverageTarget > 0
      ? Math.min(100, (pipeline.coverage / pipeline.coverageTarget) * 100)
      : 0;
  const weakest =
    sales.regions.length > 0
      ? sales.regions.reduce((low, r) => (r.coverage < low.coverage ? r : low), sales.regions[0])
      : null;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {/* Bookings to date */}
      <article className="qubit-card p-4 md:p-5" aria-label="Quarter bookings to date">
        <h2 className="text-[12.5px] font-medium text-slate-500">Q3 bookings to date</h2>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[26px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
          {formatINR(quarter.bookingsToDate)}
          <span className="text-[13px] font-medium text-slate-400">
            of {formatINR(quarter.target)} target
          </span>
        </p>
        <div
          className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="img"
          aria-label={`${attainedPct.toFixed(0)}% of the quarter bookings target booked to date`}
        >
          <div
            className="h-full rounded-full bg-blue-600"
            style={{ width: `${Math.min(100, Math.max(4, attainedPct))}%` }}
          />
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">
          {attainedPct.toFixed(0)}% of the quarter target booked at {elapsedPct.toFixed(0)}% of the
          quarter elapsed.
        </p>
      </article>

      {/* Forecast */}
      <article className="qubit-card p-4 md:p-5" aria-label="Q3 forecast range and model confidence">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[12.5px] font-medium text-slate-500">Q3 forecast</h2>
          <span className="text-[11px] text-slate-400 tabular-nums">
            Target {formatINR(forecast.target)}
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <ForecastStat label="Commit" value={formatINR(forecast.commit)} />
          <ForecastStat label="Model" value={formatINR(forecast.modelForecast)} accent />
          <ForecastStat label="Best case" value={formatINR(forecast.bestCase)} />
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Model confidence</span>
            <span className="font-semibold text-slate-700 tabular-nums">
              {forecast.confidencePct}%
            </span>
          </div>
          <div
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"
            role="img"
            aria-label={`Forecast model confidence ${forecast.confidencePct}%`}
          >
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${Math.min(100, Math.max(4, forecast.confidencePct))}%` }}
            />
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">
            Model confidence {forecast.confidencePct}% — down from 84% last week.
          </p>
        </div>
      </article>

      {/* Pipeline */}
      <article className="qubit-card p-4 md:p-5" aria-label="Open pipeline and coverage">
        <h2 className="text-[12.5px] font-medium text-slate-500">Pipeline</h2>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[26px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
          {formatINR(pipeline.value)}
          <span className="text-[13px] font-medium text-slate-400">gross</span>
        </p>
        <p className="mt-1.5 text-[13px] text-slate-600 tabular-nums">
          {formatINR(pipeline.weighted)} weighted
        </p>
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Coverage</span>
            <span className="font-semibold text-slate-700 tabular-nums">
              {pipeline.coverage.toFixed(1)}x{" "}
              <span className="font-normal text-slate-400">
                vs {pipeline.coverageTarget.toFixed(1)}x standard
              </span>
            </span>
          </div>
          <div
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"
            role="img"
            aria-label={`Pipeline coverage ${pipeline.coverage.toFixed(1)}x against the ${pipeline.coverageTarget.toFixed(1)}x standard`}
          >
            <div
              className={cn(
                "h-full rounded-full",
                pipeline.coverage < pipeline.coverageTarget ? "bg-amber-500" : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(100, Math.max(4, coveragePct))}%` }}
            />
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">
            {pipeline.coverage < pipeline.coverageTarget && weakest
              ? `Coverage below the ${pipeline.coverageTarget.toFixed(1)}x standard — ${weakest.region} lowest at ${weakest.coverage.toFixed(1)}x.`
              : `Coverage at or above the ${pipeline.coverageTarget.toFixed(1)}x standard.`}
          </p>
        </div>
      </article>
    </div>
  );
}

function ForecastStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2",
        accent ? "border-blue-200 bg-blue-50/60" : "border-slate-200/80 bg-white",
      )}
    >
      <p className="text-[10.5px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[14.5px] font-semibold tracking-tight tabular-nums",
          accent ? "text-blue-700" : "text-slate-900",
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ---------- efficiency metric tiles ----------

function MetricTiles({ metrics }: { metrics: SalesData["metrics"] }) {
  const winDelta = metrics.winRate - metrics.winRateTarget;
  const cycleDelta = metrics.cycleDays - metrics.cycleTarget;
  const tiles: { label: string; value: string; sub: React.ReactNode; below: boolean }[] = [
    {
      label: "Win rate",
      value: formatPct(metrics.winRate, 0),
      sub: (
        <>
          Target {formatPct(metrics.winRateTarget, 0)} ·{" "}
          {winDelta === 0
            ? "on target"
            : `${Math.abs(winDelta)} pts ${winDelta < 0 ? "below" : "above"}`}
        </>
      ),
      below: winDelta < 0,
    },
    {
      label: "Avg deal size",
      value: formatINR(metrics.avgDeal),
      sub: <>Bookings basis, open quarter</>,
      below: false,
    },
    {
      label: "Sales cycle",
      value: `${metrics.cycleDays} days`,
      sub: (
        <>
          Target {metrics.cycleTarget} days ·{" "}
          {cycleDelta <= 0 ? "on target" : `${cycleDelta} days slower`}
        </>
      ),
      below: cycleDelta > 0,
    },
    {
      label: "Lead → win",
      value: formatPct(metrics.leadConversionPct, 1),
      sub: <>Leads converting to closed-won</>,
      below: false,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Sales efficiency metrics">
      {tiles.map((t) => (
        <article key={t.label} className="qubit-card p-4">
          <h3 className="text-[12.5px] font-medium text-slate-500">{t.label}</h3>
          <p className="mt-1.5 text-[22px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
            {t.value}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] leading-snug text-slate-500">
            {t.sub}
            {t.below && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
                Below target
              </span>
            )}
          </p>
        </article>
      ))}
    </div>
  );
}

// ---------- pipeline funnel — gross vs weighted, stage bars ----------

function PipelineFunnel({ sales, periodLabel }: { sales: SalesData; periodLabel: string }) {
  const max = Math.max(...sales.funnel.map((f) => f.value), 0.0001);
  const totalGross = sales.funnel.reduce((s, f) => s + f.value, 0);
  const totalWeighted = sales.funnel.reduce((s, f) => s + f.weighted, 0);

  return (
    <SectionCard
      title="Pipeline funnel"
      description={`Open qualified pipeline by stage — gross vs probability-weighted value · ${periodLabel}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-200" aria-hidden /> Gross value
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" aria-hidden /> Weighted
          (probability-adjusted)
        </span>
      </div>

      <div
        className="hidden border-b border-slate-100 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-400 sm:grid sm:grid-cols-[9rem_minmax(0,1fr)_5.5rem_5.5rem] sm:gap-x-5"
        aria-hidden
      >
        <span>Stage</span>
        <span>Value relative to largest stage</span>
        <span className="text-right">Gross</span>
        <span className="text-right">Weighted</span>
      </div>

      <ul className="divide-y divide-slate-100" aria-label="Pipeline by stage">
        {sales.funnel.map((f) => (
          <li
            key={f.stage}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_5.5rem_5.5rem] sm:gap-x-5"
          >
            <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:block">
              <span className="text-[13px] font-medium text-slate-700">{f.stage}</span>
              <span className="text-[11px] text-slate-400 tabular-nums sm:mt-0.5 sm:block">
                {f.count} deals
              </span>
            </div>
            <div
              className="col-span-2 h-4 w-full overflow-hidden rounded-md bg-slate-100 sm:col-span-1"
              role="img"
              aria-label={`${f.stage}: gross ${formatINR(f.value)}, weighted ${formatINR(f.weighted)}, ${f.count} deals`}
            >
              <div className="relative h-full w-full">
                <div
                  className="absolute inset-y-0 left-0 rounded-md bg-blue-200"
                  style={{ width: `${(f.value / max) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-md bg-blue-600"
                  style={{ width: `${(f.weighted / max) * 100}%` }}
                />
              </div>
            </div>
            <p className="text-right text-[13px] font-medium text-slate-800 tabular-nums">
              {formatINR(f.value)}
            </p>
            <p className="text-right text-[13px] font-medium text-blue-700 tabular-nums">
              {formatINR(f.weighted)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-slate-200 pt-3 text-[12.5px]">
        <span className="font-medium text-slate-500">Total open pipeline</span>
        <span className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
          <span className="text-slate-800">{formatINR(totalGross)} gross</span>
          <span className="font-semibold text-blue-700">{formatINR(totalWeighted)} weighted</span>
        </span>
      </div>
    </SectionCard>
  );
}

// ---------- top opportunities table ----------

function TopOpportunities({
  items,
  onOpen,
}: {
  items: Opportunity[];
  onOpen: (o: Opportunity) => void;
}) {
  return (
    <SectionCard
      title="Top opportunities"
      description="Largest open deals by value — select a row for the full detail."
    >
      <div className="qubit-scroll overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-sm" aria-label="Top five open opportunities">
          <thead>
            <tr className="border-b border-slate-200/90">
              <th scope="col" className={TH}>Opportunity</th>
              <th scope="col" className={TH}>Owner</th>
              <th scope="col" className={TH}>Region</th>
              <th scope="col" className={TH_RIGHT}>Value</th>
              <th scope="col" className={TH}>Stage</th>
              <th scope="col" className={TH}>Close date</th>
              <th scope="col" className={TH_RIGHT}>Probability</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((o) => (
              <tr key={o.id} className="group transition-colors hover:bg-slate-50/70">
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => onOpen(o)}
                    className="block max-w-[16rem] rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label={`Open opportunity detail: ${o.name}`}
                  >
                    <span className="block truncate text-[13.5px] font-medium text-slate-900 transition-colors group-hover:text-blue-700">
                      {o.name}
                    </span>
                    <span className="block truncate text-[11.5px] text-slate-500">{o.account}</span>
                  </button>
                </td>
                <td className="px-3 py-2.5 text-[13px] text-slate-700">{o.owner}</td>
                <td className="px-3 py-2.5 text-[13px] text-slate-600">{o.region}</td>
                <td className="px-3 py-2.5 text-right text-[13px] font-medium text-slate-900 tabular-nums">
                  {formatINR(o.value)}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={o.stage} size="sm" />
                </td>
                <td className="px-3 py-2.5 text-[13px] text-slate-600 tabular-nums">{o.closeDate}</td>
                <td className="px-3 py-2.5 text-right text-[13px] font-medium text-slate-700 tabular-nums">
                  {o.probability}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ---------- at-risk opportunities + October variance callout ----------

function AtRiskOpportunities({
  items,
  slipped,
  slippedValue,
  onOpen,
  onNavigate,
}: {
  items: Opportunity[];
  slipped: Opportunity[];
  slippedValue: number;
  onOpen: (o: Opportunity) => void;
  onNavigate: (screen: ScreenId, params?: ScreenParams) => void;
}) {
  return (
    <SectionCard
      title="At-risk opportunities"
      description="Deals with a named risk to close date or value — each carries an owned action."
    >
      <ul className="divide-y divide-slate-100" aria-label="At-risk opportunities">
        {items.map((o) => (
          <li key={o.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
              <button
                type="button"
                onClick={() => onOpen(o)}
                className="min-w-0 flex-1 basis-56 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label={`Open at-risk opportunity detail: ${o.name}`}
              >
                <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-slate-900">
                  <span className="truncate">{o.name}</span>
                  {o.slippedFrom && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-medium text-amber-700">
                      <CalendarClock className="h-3 w-3" aria-hidden /> Slipped from {o.slippedFrom}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[11.5px] text-slate-500">
                  {o.account} · {o.owner} · {o.region} ·{" "}
                  <span className="tabular-nums">{formatINR(o.value)}</span>
                </p>
              </button>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <StatusBadge status={o.stage} size="sm" />
                <span className="text-[11px] text-slate-400 tabular-nums">
                  Close {o.closeDate} · {o.probability}%
                </span>
              </div>
            </div>
            {o.risk && (
              <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-slate-600">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                {o.risk}
              </p>
            )}
          </li>
        ))}
      </ul>

      {slipped.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3" role="note">
          <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-900">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            {slipped.length === 2 ? "Both" : "These"} slipped deals are the October revenue variance
          </p>
          <p className="mt-1 pl-5 text-xs leading-relaxed text-amber-800">
            {slipped.map((o) => o.account).join(" and ")} moved out of October (
            {formatINR(slippedValue)} combined) — the same shortfall behind the October revenue miss
            and the reduced Q3 forecast.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 pl-5">
            <ArrowLink onClick={() => onNavigate("revenue-snapshot")}>Revenue Snapshot</ArrowLink>
            <ArrowLink onClick={() => onNavigate("executive-alerts")}>Executive alerts</ArrowLink>
            <ArrowLink onClick={() => onNavigate("kpi-drilldown", { kpiId: "kpi-pipeline" })}>
              Investigate coverage KPI
            </ArrowLink>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ---------- regional performance ----------

function RegionalPerformance({
  sales,
  elapsedPct,
}: {
  sales: SalesData;
  elapsedPct: number;
}) {
  return (
    <SectionCard
      title="Regional performance"
      description={`Bookings vs quota, paced against the quarter (${elapsedPct.toFixed(0)}% elapsed) · company win-rate target ${formatPct(sales.metrics.winRateTarget, 0)}`}
    >
      <div className="qubit-scroll overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm" aria-label="Regional sales performance">
          <thead>
            <tr className="border-b border-slate-200/90">
              <th scope="col" className={TH}>Region</th>
              <th scope="col" className={TH}>Sales head</th>
              <th scope="col" className={TH_RIGHT}>Bookings vs quota</th>
              <th scope="col" className={TH_RIGHT}>vs pace</th>
              <th scope="col" className={TH_RIGHT}>Coverage</th>
              <th scope="col" className={TH_RIGHT}>Win rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.regions.map((r) => {
              const attainment = r.quota > 0 ? (r.bookings / r.quota) * 100 : 0;
              const paceGap = attainment - elapsedPct;
              const belowStandard = r.coverage < sales.pipeline.coverageTarget;
              return (
                <tr key={r.region} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-medium text-slate-900">{r.region}</span>
                      {belowStandard && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
                          Below {sales.pipeline.coverageTarget.toFixed(1)}x standard
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-slate-700">{r.head}</td>
                  <td className="px-3 py-2.5 text-right text-[13px] tabular-nums">
                    <span className="font-medium text-slate-900">{formatINR(r.bookings)}</span>{" "}
                    <span className="text-slate-400">/ {formatINR(r.quota)}</span>{" "}
                    <span className="ml-1 text-[11px] text-slate-500">
                      {attainment.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <TrendArrow trendPct={paceGap} direction="up-good" suffix="vs pace" />
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] font-medium text-slate-700 tabular-nums">
                    {r.coverage.toFixed(1)}x
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] font-medium text-slate-700 tabular-nums">
                    {formatPct(r.winRate, 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3">
        <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-slate-500">
          <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <span>
            <span className="font-medium text-slate-600">Drill path authorized:</span> Company →
            Region → Team → Salesperson → Opportunity. Buyer contacts —{" "}
            <StatusBadge status="Restricted" size="sm" /> contact-level data is outside executive
            scope and is not shown at this level.
          </span>
        </p>
      </div>
    </SectionCard>
  );
}

// ---------- opportunity detail (drawer body) ----------

function OpportunityDetail({ opp }: { opp: Opportunity }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={opp.stage} size="sm" />
        {opp.slippedFrom && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-medium text-amber-700">
            <CalendarClock className="h-3 w-3" aria-hidden /> Slipped from {opp.slippedFrom}
          </span>
        )}
      </div>

      {opp.risk && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Risk to close
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">{opp.risk}</p>
        </div>
      )}

      <dl className="divide-y rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5">
        <DetailRow label="Account" value={opp.account} />
        <DetailRow label="Value" value={formatINR(opp.value)} />
        <DetailRow label="Stage" value={opp.stage} />
        <DetailRow label="Close date" value={opp.closeDate} />
        <DetailRow label="Probability" value={`${opp.probability}%`} />
        <DetailRow label="Owner" value={opp.owner} />
        <DetailRow label="Region" value={opp.region} />
        <DetailRow
          label="Opportunity ID"
          value={<span className="font-mono text-xs text-slate-600">{opp.id}</span>}
        />
      </dl>

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
        <ShieldAlert className="mt-px h-3 w-3 shrink-0" aria-hidden />
        Buyer contacts for this opportunity are Restricted — contact-level data is outside executive
        scope.
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-slate-800">{value}</dd>
    </div>
  );
}
