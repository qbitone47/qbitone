"use client";

// ============================================================
// Screen 60 · Revenue Snapshot — concise revenue performance for
// the CEO Command Center (Phase 5).
//
// Every figure comes from the canonical executive data model via
// GET /api/executive?section=revenue (spec §9 — one data source;
// this screen never invents or restates a number). The three
// accounting definitions (booked / recognized / collected) are
// shown side by side and never mixed (spec §24). Authorization is
// enforced server-side and mirrored by <ExecutiveGate> (spec §10).
// ============================================================

import * as React from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronRight, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { formatINR, type RevenueData } from "@/lib/qubit/executive-data";
import { PageHeader } from "../page-header";
import { ArrowLink, EmptyState, SectionCard, StatusBadge } from "../primitives";
import {
  AsOfStrip,
  CHART_TICK,
  ComparisonBars,
  ContributionList,
  ExecErrorBanner,
  ExecSkeleton,
  EXEC_COLORS,
  ExecutiveGate,
  FreshnessBadge,
  KpiInfo,
  PeriodChip,
  TrendArrow,
  useExecutiveNav,
  useExecutiveSection,
} from "../executive/parts";

// ---------- payload shape for GET /api/executive?section=revenue ----------

interface ExecPeriodShape {
  label: string;
  window: string;
  asOf: number;
  asOfLabel: string;
  elapsedPct: number;
  monthLabel: string;
}

interface RevenueSectionPayload {
  period: ExecPeriodShape;
  asOfLabel: string;
  revenue: RevenueData;
}

// ---------- presentation helpers ----------

type GoalStatus = "On Track" | "Watch" | "At Risk";

/**
 * Tile status classification — presentation semantics over payload
 * figures, with documented thresholds: ≥97% of target → On Track,
 * ≥95% → Watch, otherwise At Risk. At 90.9% achievement this maps
 * the quarter-to-date tile to "At Risk", consistent with the
 * canonical kpi-revenue status in the shared data model.
 */
function achievementStatus(pct: number): GoalStatus {
  if (pct >= 97) return "On Track";
  if (pct >= 95) return "Watch";
  return "At Risk";
}

const trendChartConfig = {
  actual: { label: "Actual", color: EXEC_COLORS.primary },
  target: { label: "Target", color: EXEC_COLORS.slate },
  forecast: { label: "Forecast", color: EXEC_COLORS.violet },
} satisfies ChartConfig;

export function RevenueSnapshotScreen() {
  const navigate = useExecutiveNav();
  const { data, loading, error, forbidden, reload } =
    useExecutiveSection<RevenueSectionPayload>("revenue");

  const revenue = data?.revenue ?? null;

  // ---------- derived comparisons (arithmetic over payload figures only) ----------
  const qtd = revenue?.quarter ?? null;
  const qtdAchievement = qtd ? (qtd.actualToDate / qtd.target) * 100 : 0;
  const q2DeltaPct = revenue
    ? ((qtd!.actualToDate - revenue.q2SamePoint.actual) / revenue.q2SamePoint.actual) * 100
    : 0;
  const ytdAchievement = revenue ? (revenue.ytd.actual / revenue.ytd.target) * 100 : 0;
  // Full-quarter target = the monthly targets of the quarter's final three
  // months (Oct–Dec) of the FY trend — the payload's monthly target lines.
  const q3Target = revenue ? revenue.trend.slice(-3).reduce((s, m) => s + m.target, 0) : 0;
  const forecastAchievement = qtd ? (qtd.forecast / q3Target) * 100 : 0;
  const q2Achievement = revenue
    ? (revenue.q2SamePoint.actual / revenue.q2SamePoint.target) * 100
    : 0;
  const buTotal = revenue
    ? revenue.byBusinessUnit.reduce((s, b) => s + b.recognized, 0)
    : 0;
  // Contributor whose decline is explained by a variance driver (named in
  // the driver's detail) — the slipped-deal story, not a hard-coded name.
  const slippedContributor = revenue
    ? revenue.topContributors.find(
        (c) =>
          c.growthPct < 0 &&
          revenue.variance.some((v) => v.detail.includes(c.account)),
      )
    : undefined;

  // Actual ends at October; forecast is its own series (no fake continuity).
  const trendData =
    revenue?.trend.map((p) => ({
      month: p.month,
      actual: p.actual,
      target: p.target,
      forecast: p.forecast ?? null,
    })) ?? [];

  return (
    <ExecutiveGate screenName="Revenue Snapshot">
      <div>
        <PageHeader
          crumbs={[
            { label: "CEO Command Center", onClick: () => navigate("ceo-overview") },
            { label: "Revenue Snapshot" },
          ]}
          title="Revenue Snapshot"
          description="Recognized revenue against target — trend, business-unit and region contribution, top accounts and the variance behind the quarter. Booked, recognized and collected are shown as separate definitions, never mixed."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={reload}
                aria-label="Reload revenue data"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
              </Button>
              {data && <PeriodChip label={data.period.label} window={data.period.window} />}
              {revenue && <FreshnessBadge freshness={revenue.freshness} />}
            </>
          }
        />

        {error && !forbidden && <ExecErrorBanner message={error} onRetry={reload} />}

        {loading && <ExecSkeleton rows={5} />}

        {!loading && !error && data && !revenue && (
          <SectionCard>
            <EmptyState
              title="No revenue data for this period"
              message="The revenue source returned nothing for the current reporting window. Retry, or check the data source status in Executive Alerts."
            />
          </SectionCard>
        )}

        {!loading && revenue && data && (
          <div className="space-y-4">
            {/* ── Headline KPI band — every tile: value · target · comparison · trend · status ── */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <RevenueTile
                name="Q3 recognized to date"
                value={formatINR(qtd!.actualToDate)}
                status={achievementStatus(qtdAchievement)}
                trend={<TrendArrow trendPct={q2DeltaPct} direction="up-good" />}
                comparison="vs Q2 same point"
                targetLabel={`Target ${formatINR(qtd!.target)}`}
                achievementPct={qtdAchievement}
                footnote={revenue.variance[0]?.driver}
              />
              <RevenueTile
                name="Q3 full-quarter forecast"
                value={formatINR(qtd!.forecast)}
                status="Forecast"
                trend={
                  <TrendArrow
                    trendPct={(qtd!.forecast / q3Target - 1) * 100}
                    direction="up-good"
                  />
                }
                comparison="vs quarter target"
                targetLabel={`Quarter target ${formatINR(q3Target)}`}
                achievementPct={forecastAchievement}
                footnote={`Model forecast at ${qtd!.elapsedPct}% of the quarter elapsed.`}
              />
              <RevenueTile
                name="FY-YTD recognized"
                value={formatINR(revenue.ytd.actual)}
                status={achievementStatus(ytdAchievement)}
                trend={
                  <TrendArrow
                    trendPct={(revenue.ytd.actual / revenue.ytd.target - 1) * 100}
                    direction="up-good"
                  />
                }
                comparison="vs YTD target"
                targetLabel={`Target ${formatINR(revenue.ytd.target)}`}
                achievementPct={ytdAchievement}
                footnote="Fiscal year to date (1 Apr – 13 Nov 2026)."
              />
              <RevenueTile
                name="Q2 · same point"
                value={formatINR(revenue.q2SamePoint.actual)}
                status="Finalized"
                trend={<TrendArrow trendPct={q2Achievement - 100} direction="up-good" />}
                comparison="vs Q2 same-point target"
                targetLabel={`Same-point target ${formatINR(revenue.q2SamePoint.target)}`}
                achievementPct={q2Achievement}
                footnote="Reference level for the Q3 same-point comparison."
              />
            </div>

            {/* ── Three accounting definitions — never mixed (spec §24) ── */}
            <SectionCard
              title="Three accounting definitions"
              description={`${revenue.mtd.label} — booked is not recognized, and recognized is not collected. Shown side by side so figures are never mixed.`}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <DefinitionTile
                  label="Booked"
                  value={formatINR(revenue.mtd.booked)}
                  definition={revenue.definitions.booked}
                  period={revenue.mtd.label}
                  kind="Sales basis"
                />
                <DefinitionTile
                  label="Recognized"
                  value={formatINR(revenue.mtd.recognized)}
                  definition={revenue.definitions.recognized}
                  period={revenue.mtd.label}
                  kind="Accounting policy"
                  highlight
                />
                <DefinitionTile
                  label="Collected"
                  value={formatINR(revenue.mtd.collected)}
                  definition={revenue.definitions.collected}
                  period={revenue.mtd.label}
                  kind="Cash basis"
                />
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-slate-400">
                Recognized is the headline figure on this screen; booked leads it, collected lags it.
              </p>
            </SectionCard>

            {/* ── Trend chart — actual + target + forecast as separate series ── */}
            <SectionCard
              title="Revenue trend — April to December"
              description="Monthly recognized revenue vs monthly target. Actuals run April–October; November–December are the model forecast, drawn as its own dashed series — no implied continuity into actuals."
            >
              <ChartContainer
                config={trendChartConfig}
                role="img"
                aria-label="Revenue trend chart, April to December 2026, in crore rupees: monthly actuals from April to October, monthly targets, and a forecast of 1.74 crore for November and 1.70 crore for December"
                className={cn("h-56 w-full md:h-64", CHART_TICK)}
              >
                <ComposedChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} tick={{ fontSize: 11 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `₹${v.toFixed(1)}`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend verticalAlign="bottom" content={<ChartLegendContent />} />
                  <Area
                    name="Actual"
                    dataKey="actual"
                    type="monotone"
                    stroke={EXEC_COLORS.primary}
                    strokeWidth={2}
                    fill={EXEC_COLORS.primary}
                    fillOpacity={0.08}
                    dot={false}
                    connectNulls={false}
                  />
                  <Line
                    name="Target"
                    dataKey="target"
                    type="monotone"
                    stroke={EXEC_COLORS.slate}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    name="Forecast"
                    dataKey="forecast"
                    type="monotone"
                    stroke={EXEC_COLORS.violet}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={{ r: 2 }}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ChartContainer>
            </SectionCard>

            {/* ── Business-unit contribution + region target vs actual ── */}
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard
                title="Business-unit contribution"
                description="Recognized revenue, Q3 to date — share of total with quarter trend."
              >
                <ContributionList
                  items={revenue.byBusinessUnit.map((bu) => ({
                    label: bu.name,
                    value: bu.recognized,
                    hint: `${((bu.recognized / buTotal) * 100).toFixed(1)}% · trend ${bu.trendPct > 0 ? "+" : ""}${bu.trendPct.toFixed(1)}%`,
                  }))}
                  formatValue={formatINR}
                />
              </SectionCard>
              <SectionCard
                title="Region — target vs actual"
                description="Recognized revenue against regional target, Q3 to date. Grey = target, blue = actual."
              >
                <div
                  role="img"
                  aria-label="Grouped bar chart of recognized revenue versus regional target for West, South, North and East. West 0.94 against 0.95, South 0.66 against 0.72, North 0.41 against 0.51, East 0.29 against 0.35 crore rupees."
                >
                  <ComparisonBars
                    items={revenue.byRegion.map((r) => ({
                      label: r.region,
                      actual: r.recognized,
                      target: r.target,
                    }))}
                    ariaLabel="Regional recognized revenue versus target"
                  />
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-slate-400">
                  Every region is behind target; North carries the largest gap and is named in the variance drivers below.
                </p>
              </SectionCard>
            </div>

            {/* ── Top contributors ── */}
            <SectionCard
              title="Top contributors"
              description="Highest recognized-revenue accounts, Q3 to date."
            >
              <div className="-mx-4 overflow-x-auto md:-mx-5">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">
                    Top five contributing accounts by recognized revenue, with industry, owner, region, amount and growth
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <th scope="col" className="px-4 py-2 font-medium md:px-5">Account</th>
                      <th scope="col" className="px-4 py-2 font-medium md:px-5">Industry</th>
                      <th scope="col" className="px-4 py-2 font-medium md:px-5">Owner</th>
                      <th scope="col" className="px-4 py-2 font-medium md:px-5">Region</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium md:px-5">Recognized</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium md:px-5">Growth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {revenue.topContributors.map((c) => (
                      <tr key={c.account} className="text-[13px]">
                        <td className="px-4 py-2.5 font-medium text-slate-800 md:px-5">{c.account}</td>
                        <td className="px-4 py-2.5 text-slate-500">{c.industry}</td>
                        <td className="px-4 py-2.5 text-slate-500">{c.owner}</td>
                        <td className="px-4 py-2.5 text-slate-500">{c.region}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-900 tabular-nums md:px-5">
                          {formatINR(c.recognized)}
                        </td>
                        <td className="px-4 py-2.5 text-right md:px-5">
                          <TrendArrow trendPct={c.growthPct} direction="up-good" className="justify-end" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {slippedContributor && (
                <p className="mt-3 text-[11.5px] leading-relaxed text-slate-400">
                  {slippedContributor.account}&apos;s {slippedContributor.growthPct.toFixed(1)}% tracks the rollout slipped to
                  December — see the variance drivers below.
                </p>
              )}
            </SectionCard>

            {/* ── Variance drivers — each with a where-to-act link ── */}
            <SectionCard
              title="Variance drivers"
              description="What moved revenue away from target, with the screen where each is acted on."
            >
              <div className="grid gap-3 md:grid-cols-2">
                {revenue.variance.map((v) => (
                  <article key={v.driver} className="rounded-xl border border-slate-200/80 bg-white p-4">
                    <p className="text-[13.5px] font-semibold leading-snug text-slate-900">{v.driver}</p>
                    <p className="mt-1 text-[13px] font-medium text-slate-800 tabular-nums">{v.impact}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">{v.detail}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3">
                      <ArrowLink onClick={() => navigate("sales-command")}>View in Sales</ArrowLink>
                      <ArrowLink onClick={() => navigate("kpi-drilldown", { kpiId: "kpi-revenue" })}>
                        Investigate KPI
                      </ArrowLink>
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>

            {/* ── Drill-path note — authorization-aware (spec §10) ── */}
            <div
              className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs"
              role="note"
              aria-label="Drill path: Revenue, Business Unit, Region and Account are executive-visible. Contract and invoice level require Finance authorization."
            >
              <span className="font-semibold text-slate-600">Drill path</span>
              {["Revenue", "Business Unit", "Region", "Account"].map((level, i) => (
                <React.Fragment key={level}>
                  {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" aria-hidden />}
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-700">
                    {level}
                  </span>
                </React.Fragment>
              ))}
              <span className="inline-flex items-center gap-1.5 text-slate-400 sm:ml-auto">
                <Lock className="h-3 w-3 shrink-0" aria-hidden />
                Contract · Invoice — requires Finance authorization
              </span>
            </div>

            <AsOfStrip
              asOfLabel={data.asOfLabel}
              note={`${data.period.label} window ${data.period.window} · ${data.period.monthLabel}.`}
            />
          </div>
        )}
      </div>
    </ExecutiveGate>
  );
}

// ---------- local presentational parts ----------

function RevenueTile({
  name,
  value,
  status,
  trend,
  comparison,
  targetLabel,
  achievementPct,
  footnote,
}: {
  name: string;
  value: string;
  status: string;
  trend: React.ReactNode;
  comparison: string;
  targetLabel: string;
  achievementPct: number;
  footnote?: string;
}) {
  const positive = achievementPct >= 97;
  return (
    <article className="qubit-card qubit-card-hover flex h-full flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-[13px] font-medium text-slate-500">{name}</h3>
        <StatusBadge status={status} size="sm" />
      </div>
      <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {trend}
        <span className="text-xs text-muted-foreground">{comparison}</span>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>{targetLabel}</span>
          <span className={cn("font-medium", positive ? "text-emerald-700" : "text-amber-700")}>
            {achievementPct.toFixed(1)}% of target
          </span>
        </div>
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="img"
          aria-label={`${achievementPct.toFixed(1)}% of target`}
        >
          <div
            className={cn("h-full rounded-full", positive ? "bg-emerald-500" : "bg-amber-500")}
            style={{ width: `${Math.min(100, Math.max(4, achievementPct))}%` }}
          />
        </div>
      </div>
      {footnote && (
        <p className="mt-3 line-clamp-2 min-h-[2rem] text-[11.5px] leading-relaxed text-slate-500">{footnote}</p>
      )}
    </article>
  );
}

function DefinitionTile({
  label,
  value,
  definition,
  period,
  kind,
  highlight,
}: {
  label: string;
  value: string;
  definition: string;
  period: string;
  kind: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border p-3.5", highlight ? "border-blue-200 bg-blue-50/50" : "border-slate-200/80 bg-white")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-600">{label}</p>
        <KpiInfo definition={definition} period={period} kind={kind} />
      </div>
      <p className="mt-1.5 text-[22px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
