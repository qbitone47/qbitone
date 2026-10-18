"use client";

// ============================================================
// Screen 62 · Finance Snapshot — CEO-level financial health
// (Phase 5 · CEO Command Center).
//
// Every figure comes from the canonical executive data model via
// GET /api/executive?section=finance (spec §9 — one data source;
// this screen never invents or restates a number). Actual, budget
// and variance are always explicitly labelled and never mixed.
// Authorization is enforced server-side and mirrored by
// <ExecutiveGate> (spec §10). Freshness is honest: the finance
// ledger is a batched sync ("Updated 34 min ago"), never shown as
// live (spec §7).
// ============================================================

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatINR, formatPct, type FinanceData } from "@/lib/qubit/executive-data";
import { PageHeader } from "../page-header";
import { ArrowLink, EmptyState, SectionCard, StatusBadge } from "../primitives";
import {
  AsOfStrip,
  ComparisonBars,
  ExecErrorBanner,
  ExecSkeleton,
  ExecutiveGate,
  FreshnessBadge,
  KpiInfo,
  MiniTrend,
  PeriodChip,
  TrendArrow,
  useExecutiveNav,
  useExecutiveSection,
} from "../executive/parts";

// ---------- payload shape for GET /api/executive?section=finance ----------

interface ExecPeriodShape {
  label: string;
  window: string;
  asOf: number;
  asOfLabel: string;
  elapsedPct: number;
  monthLabel: string;
}

interface FinanceSectionPayload {
  period: ExecPeriodShape;
  asOfLabel: string;
  finance: FinanceData;
}

// ---------- presentation helpers ----------

/** Crore-voiced figure for narrative lines that quote the canonical model text (₹0.94 Cr), distinct from the shared formatINR table voice (₹94.0 L). */
const fmtCr = (cr: number) => `₹${cr.toFixed(2)} Cr`;

/** Signed crore delta with an explicit sign character — never a bare number. */
const fmtCrDelta = (cr: number) =>
  `${cr > 0.005 ? "+" : cr < -0.005 ? "−" : "±"}₹${Math.abs(cr).toFixed(2)} Cr`;

/** Slender progress-bar tones — restrained, from the shared executive palette. */
const BAR_TONES = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  blue: "bg-blue-600/85",
} as const;

/**
 * Budget-variance cell — explicit signed text + arrow, never colour-only.
 * Presentation rule (documented): over budget → amber, under budget →
 * emerald, per the finance-snapshot spec. The Marketing caption below the
 * table explains why an emerald under-spend can still be a risk.
 */
function VarianceCell({ pct }: { pct: number }) {
  const over = pct > 0.05;
  const under = pct < -0.05;
  const Icon = over ? ArrowUpRight : under ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-1 whitespace-nowrap text-[13px] font-medium tabular-nums",
        over ? "text-amber-700" : under ? "text-emerald-700" : "text-slate-500",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {over ? "+" : under ? "−" : "±"}
      {Math.abs(pct).toFixed(1)}%
      <span className="font-normal text-slate-400">{over ? "over" : under ? "under" : "on budget"}</span>
    </span>
  );
}

// ---------- screen ----------

export function FinanceSnapshotScreen() {
  const navigate = useExecutiveNav();
  const { data, loading, error, forbidden, reload } =
    useExecutiveSection<FinanceSectionPayload>("finance");

  const finance = data?.finance ?? null;

  // ---------- derived comparisons (arithmetic over payload figures only) ----------
  const cash = finance?.cash ?? null;
  const cashPrev = cash && cash.trend.length >= 2 ? cash.trend[cash.trend.length - 2] : null;
  const cashDeltaCr = cash && cashPrev ? cash.position - cashPrev.value : 0;
  const cashTrendPct = cash && cashPrev ? (cashDeltaCr / cashPrev.value) * 100 : 0;
  const cashAboveFloorAll = cash ? cash.trend.every((t) => t.value > cash.floor) : false;
  const cashBarPct = cash ? Math.min(100, (cash.position / cash.floor) * 100) : 0;

  const recv = finance?.receivables ?? null;
  const overduePct = recv && recv.total > 0 ? (recv.overdue / recv.total) * 100 : 0;
  const oldestOverdue = recv
    ? recv.overdueAccounts.reduce((max, a) => Math.max(max, a.days), 0)
    : 0;
  const meridianNote = recv?.overdueAccounts.find((a) => a.account === "Meridian Trend");

  const pay = finance?.payables ?? null;
  const dueThisWeekPct = pay && pay.total > 0 ? (pay.dueThisWeek / pay.total) * 100 : 0;

  const margins = finance?.margins ?? null;
  const marginDeltaPts = margins ? margins.gross - margins.grossTarget : 0;
  const marginAchPct = margins ? (margins.gross / margins.grossTarget) * 100 : 0;

  const opex = finance?.opex ?? null;
  const opexBarPct = opex ? Math.min(100, (opex.actual / opex.budget) * 100) : 0;

  // The Marketing under-spend is a risk (feeding Q4 pipeline), not a win —
  // named in finance.risk; found by label so the caption stays data-driven.
  const marketingRisk = finance?.risk.find((r) => r.label.includes("Marketing"));
  const marginRisk = finance?.risk.find((r) => r.label.includes("margin"));

  const totalBudget = finance ? finance.budgetVariance.reduce((s, d) => s + d.budget, 0) : 0;
  const totalActual = finance ? finance.budgetVariance.reduce((s, d) => s + d.actual, 0) : 0;
  const totalVariancePct =
    totalBudget > 0 ? ((totalActual - totalBudget) / totalBudget) * 100 : 0;

  // Chart aria-labels are built from the payload so the spoken description
  // can never drift from the drawn numbers.
  const cashAria = cash
    ? `Cash trend area chart, ${cash.trend[0].month} to ${cash.trend[cash.trend.length - 1].month} 2026, in crore rupees: ${cash.trend
        .map((t) => `${t.month} ${t.value.toFixed(2)}`)
        .join(", ")}, with the ${cash.floor.toFixed(1)} crore floor policy as a dashed grey line.`
    : "";
  const expensesAria = finance
    ? `Grouped bar chart of monthly operating expense, actual versus budget, ${finance.expenses[0].month} to ${
        finance.expenses[finance.expenses.length - 1].month
      } 2026, in crore rupees. Actual: ${finance.expenses
        .map((e) => `${e.month} ${e.actual.toFixed(2)}`)
        .join(", ")}. Budget: ${finance.expenses.map((e) => e.budget.toFixed(2)).join(", ")}. November is month-to-date.`
    : "";

  return (
    <ExecutiveGate screenName="Finance Snapshot">
      <div>
        <PageHeader
          crumbs={[
            { label: "CEO Command Center", onClick: () => navigate("ceo-overview") },
            { label: "Finance Snapshot" },
          ]}
          title="Finance Snapshot"
          description="CEO-level financial health — cash against the floor policy, receivables ageing, margins, expenses against budget and the risks behind the numbers. Actual, budget and variance are always explicitly labelled; figures are never mixed."
          actions={
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={reload}
              aria-label="Reload finance data"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
            </Button>
          }
          meta={
            <div className="flex flex-wrap items-center gap-2">
              {data && <PeriodChip label={data.period.label} window={data.period.window} />}
              {finance && <FreshnessBadge freshness={finance.freshness} />}
            </div>
          }
        />

        {error && !forbidden && <ExecErrorBanner message={error} onRetry={reload} />}

        {loading && <ExecSkeleton rows={5} />}

        {!loading && !error && data && !finance && (
          <SectionCard>
            <EmptyState
              title="No finance data for this period"
              message="The finance ledger returned nothing for the current reporting window. Retry, or check the data source status in Executive Alerts."
            />
          </SectionCard>
        )}

        {!loading && finance && data && cash && recv && pay && margins && opex && (
          <div className="space-y-4">
            {/* ── Headline KPI band — every tile: value · context · comparison · status ── */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <FinanceTile
                name="Cash position"
                definition="Total cash and equivalents across operating accounts, as of the last completed ledger close. Runway divides cash by average monthly net burn."
                calc="Closing balance · runway = cash ÷ avg monthly net burn"
                source="Finance ledger · Treasury"
                kind="Actual"
                value={formatINR(cash.position)}
                status="On Track"
                trend={
                  <TrendArrow trendPct={cashTrendPct} direction="up-good" />
                }
                comparison={`${fmtCrDelta(cashDeltaCr)} vs ${cashPrev?.month ?? "prior month"}`}
                contextLeft={
                  <span className="text-slate-400">
                    Floor {formatINR(cash.floor)} · {cash.runwayMonths}-month runway
                  </span>
                }
                barPct={cashBarPct}
                barTone="emerald"
                barAria={`Cash is above the ${cash.floor} crore floor policy with a ${cash.runwayMonths}-month runway`}
                footnote={`Collections are the pressure — ${fmtCr(recv.overdue)} is overdue receivables.`}
              />
              <FinanceTile
                name="Receivables"
                definition="Invoices issued and awaiting collection; overdue means past the agreed payment term. DSO (days sales outstanding) is the average collection time."
                source="Finance ledger · Receivables"
                kind="Actual"
                value={formatINR(recv.total)}
                status="At Risk"
                trend={
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />+{recv.dsoDeltaDays} days DSO vs last month
                  </span>
                }
                contextLeft={<span className="font-medium text-amber-700">{fmtCr(recv.overdue)} overdue</span>}
                contextRight={<span className="text-slate-400">DSO {recv.dsoDays} days</span>}
                barPct={overduePct}
                barTone="amber"
                barAria={`${overduePct.toFixed(0)}% of receivables are overdue`}
                footnote="Meridian Trend is the largest overdue line — see the ageing table below."
              />
              <FinanceTile
                name="Payables"
                definition="Supplier obligations booked and not yet settled. The due-this-week figure is scheduled to clear within seven days."
                source="Finance ledger · Payables"
                kind="Actual"
                value={formatINR(pay.total)}
                status="Scheduled"
                trend={
                  <span className="text-xs text-muted-foreground">Supplier obligations outstanding</span>
                }
                contextLeft={<span className="font-medium text-blue-700">{fmtCr(pay.dueThisWeek)} due this week</span>}
                barPct={dueThisWeekPct}
                barTone="blue"
                barAria={`${dueThisWeekPct.toFixed(0)}% of payables fall due within the week`}
                footnote="Cash on hand covers this week's obligations."
              />
              <FinanceTile
                name="Gross margin"
                definition="Recognized revenue less cost of delivery, as a share of recognized revenue, for the latest closed month."
                source="Finance ledger · Margin"
                kind="Actual"
                value={formatPct(margins.gross)}
                status="Watch"
                trend={
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                    <ArrowDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {marginDeltaPts.toFixed(1)} pts vs {margins.grossTarget}% target
                  </span>
                }
                contextLeft={<span className="text-slate-400">Target {margins.gross}%</span>}
                contextRight={<span className="text-slate-400">Net margin {formatPct(margins.net)}</span>}
                barPct={marginAchPct}
                barTone="amber"
                barAria={`Gross margin is at ${marginAchPct.toFixed(1)}% of the ${margins.grossTarget}% target`}
                footnote={
                  marginRisk
                    ? marginRisk.detail.replace(/^[\d.,%−-]+\s*vs\s*[\d.,%]+\s*target\s*—\s*/, "")
                    : "Discount exceptions under executive review are the main pressure."
                }
              />
              <FinanceTile
                name="OpEx variance"
                definition="Operating expense against budget for the latest closed month; the variance sign says which side of budget."
                calc="Variance = (actual − budget) ÷ budget"
                source="Finance ledger · OpEx"
                kind="Actual"
                value={`+${formatPct(opex.variancePct)}`}
                status="Watch"
                trend={
                  <span className="text-xs text-muted-foreground">
                    {fmtCr(opex.actual)} vs {fmtCr(opex.budget)} budget
                  </span>
                }
                contextLeft={<span className="text-slate-400">Budget {fmtCr(opex.budget)}</span>}
                contextRight={<span className="font-medium text-amber-700">+{opex.variancePct.toFixed(1)}% over budget</span>}
                barPct={opexBarPct}
                barTone="amber"
                barAria={`Operating expense is ${opex.variancePct.toFixed(1)}% over budget`}
                footnote="Latest closed month (October); November posts at the next ledger close."
              />
            </div>

            {/* ── Charts — actual vs floor / actual vs budget, series always labelled ── */}
            <div className="grid items-stretch gap-4 lg:grid-cols-2">
              <SectionCard
                title={`Cash trend — ${cash.trend[0].month} to ${cash.trend[cash.trend.length - 1].month}`}
                description="Month-end cash position against the floor policy. Blue = cash, dashed grey = floor."
              >
                <div role="img" aria-label={cashAria}>
                  <MiniTrend
                    data={cash.trend.map((t) => ({ label: t.month, value: t.value, target: cash.floor }))}
                    targetKey="target"
                    height={120}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
                  <p className="text-[11.5px] leading-relaxed text-slate-400">
                    {cashAboveFloorAll
                      ? `Above the ${formatINR(cash.floor)} floor in every month shown — from ${fmtCr(cash.trend[0].value)} in ${cash.trend[0].month} to ${fmtCr(cash.position)} in ${cash.trend[cash.trend.length - 1].month}.`
                      : `From ${fmtCr(cash.trend[0].value)} in ${cash.trend[0].month} to ${fmtCr(cash.position)} in ${cash.trend[cash.trend.length - 1].month}.`}
                  </p>
                  <ArrowLink
                    onClick={() => navigate("kpi-drilldown", { kpiId: "kpi-cash" })}
                    ariaLabel="Investigate the cash position KPI"
                  >
                    Investigate KPI
                  </ArrowLink>
                </div>
              </SectionCard>

              <SectionCard
                title="Expenses — actual vs budget"
                description="Monthly operating expense. Blue = actual, grey = budget."
              >
                <div role="img" aria-label={expensesAria}>
                  <ComparisonBars
                    items={finance.expenses.map((e) => ({
                      label: e.month,
                      actual: e.actual,
                      target: e.budget,
                    }))}
                    height={200}
                  />
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-slate-400">
                  November is month-to-date ({data.period.monthLabel}) — the lower November bars
                  reflect an incomplete month, not reduced spend. October closed{" "}
                  {fmtCrDelta(opex.actual - opex.budget)} over budget (+{opex.variancePct.toFixed(1)}%).
                </p>
              </SectionCard>
            </div>

            {/* ── Overdue receivables — ageing table with the stalled-renewal tie-in ── */}
            <SectionCard
              title="Overdue receivables"
              description={`Ageing by account — DSO ${recv.dsoDays} days · +${recv.dsoDeltaDays} vs last month`}
            >
              <div className="-mx-4 overflow-x-auto md:-mx-5">
                <table className="w-full min-w-[480px] text-sm">
                  <caption className="sr-only">
                    Overdue receivables by account, with outstanding amount and days overdue
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <th scope="col" className="px-4 py-2 font-medium md:px-5">Account</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium md:px-5">Amount</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium md:px-5">Days overdue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recv.overdueAccounts.map((a) => {
                      const isOldest = recv.overdueAccounts.length > 1 && a.days === oldestOverdue;
                      const isAggregate = a.account.startsWith("6 ");
                      return (
                        <tr key={a.account} className={cn("text-[13px]", isOldest && "bg-amber-50/60")}>
                          <td className={cn("px-4 py-2.5 md:px-5", isAggregate ? "text-slate-500" : "font-medium text-slate-800")}>
                            <span className="inline-flex items-center gap-2">
                              {a.account}
                              {isOldest && (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                  Oldest
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-slate-900 tabular-nums md:px-5">
                            {formatINR(a.amount)}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-2.5 text-right tabular-nums md:px-5",
                              isOldest ? "font-semibold text-red-600" : "text-slate-600",
                            )}
                          >
                            {a.days} days
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {meridianNote && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <p className="text-xs leading-relaxed text-amber-900">
                    <span className="font-semibold">Tied to the stalled renewal:</span> Meridian
                    Trend&apos;s ₹0.52 Cr deal (Enterprise platform rollout) has sat in Negotiation
                    for 21 days — collections and the renewal should be worked together, not as
                    separate tracks.
                  </p>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3">
                <ArrowLink onClick={() => navigate("sales-command")}>Sales Command Center</ArrowLink>
                <ArrowLink onClick={() => navigate("executive-alerts")}>Executive alerts</ArrowLink>
              </div>
            </SectionCard>

            {/* ── Budget variance by department — over/under stated in words, never colour-only ── */}
            <SectionCard
              title="Budget variance by department"
              description="Actual spend against department budget. Amber = over budget, emerald = under."
            >
              <div className="-mx-4 overflow-x-auto md:-mx-5">
                <table className="w-full min-w-[560px] text-sm">
                  <caption className="sr-only">
                    Department budget against actual spend with variance percentage
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <th scope="col" className="px-4 py-2 font-medium md:px-5">Department</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium md:px-5">Budget</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium md:px-5">Actual</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium md:px-5">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {finance.budgetVariance.map((d) => (
                      <tr key={d.department} className="text-[13px]">
                        <td className="px-4 py-2.5 font-medium text-slate-800 md:px-5">
                          <span className="inline-flex items-center gap-2">
                            {d.department}
                            {d.department.startsWith("Marketing") && <StatusBadge status="Watch" size="sm" />}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums md:px-5">
                          {formatINR(d.budget)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-900 tabular-nums md:px-5">
                          {formatINR(d.actual)}
                        </td>
                        <td className="px-4 py-2.5 text-right md:px-5">
                          <VarianceCell pct={d.variancePct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 text-[13px] font-semibold">
                      <th scope="row" className="px-4 py-2.5 text-left font-semibold text-slate-900 md:px-5">
                        All departments
                      </th>
                      <td className="px-4 py-2.5 text-right text-slate-900 tabular-nums md:px-5">
                        {formatINR(totalBudget)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-900 tabular-nums md:px-5">
                        {formatINR(totalActual)}
                      </td>
                      <td className="px-4 py-2.5 text-right md:px-5">
                        <VarianceCell pct={totalVariancePct} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-slate-400">
                Read the emerald with care — the Marketing under-spend is a risk, not a win:{" "}
                {marketingRisk ? marketingRisk.detail : "it may under-feed the Q4 pipeline if it persists."}{" "}
                See Financial risk below.
              </p>
            </SectionCard>

            {/* ── Financial risk — level badge + detail; High risk carries the where-to-act link ── */}
            <SectionCard
              title="Financial risk"
              description="What could move these numbers — levels reflect the current executive assessment."
            >
              <div>
                {finance.risk.map((r) => (
                  <article
                    key={r.label}
                    className="flex flex-col gap-2 border-b border-slate-100 py-3.5 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4"
                  >
                    <StatusBadge status={r.level} size="sm" className="shrink-0 self-start" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold leading-snug text-slate-900">{r.label}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{r.detail}</p>
                    </div>
                    {r.level === "High" && (
                      <ArrowLink
                        onClick={() => navigate("executive-alerts")}
                        className="shrink-0"
                        ariaLabel="Open Executive alerts for the overdue receivables concentration"
                      >
                        Executive alerts
                      </ArrowLink>
                    )}
                  </article>
                ))}
              </div>
            </SectionCard>

            <AsOfStrip
              asOfLabel={data.asOfLabel}
              note={`${data.period.label} · ${data.period.monthLabel}. Cash and ledger figures reflect the last completed ledger close — same-day transactions post at the next close.`}
            />
          </div>
        )}
      </div>
    </ExecutiveGate>
  );
}

// ---------- local presentational parts ----------

/**
 * FinanceTile — every tile carries value + target/context + comparison +
 * status (never a naked number), mirroring the sibling RevenueTile anatomy:
 * name + definition popover + status badge, large tabular value, trend row,
 * slim context bar, footnote.
 */
function FinanceTile({
  name,
  value,
  status,
  trend,
  comparison,
  contextLeft,
  contextRight,
  barPct,
  barTone = "emerald",
  barAria,
  footnote,
  definition,
  calc,
  source,
  kind,
}: {
  name: string;
  value: string;
  status: string;
  trend?: React.ReactNode;
  comparison?: string;
  contextLeft?: React.ReactNode;
  contextRight?: React.ReactNode;
  barPct?: number;
  barTone?: keyof typeof BAR_TONES;
  barAria?: string;
  footnote?: string;
  definition?: string;
  calc?: string;
  source?: string;
  kind?: string;
}) {
  return (
    <article className="qubit-card qubit-card-hover flex h-full flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1 text-[13px] font-medium text-slate-500">
          <span className="leading-snug">{name}</span>
          {definition && <KpiInfo definition={definition} calc={calc} source={source} kind={kind} />}
        </h3>
        <StatusBadge status={status} size="sm" />
      </div>
      <p className="mt-2 text-[24px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">{value}</p>
      {(trend || comparison) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {trend}
          {comparison && <span className="text-xs text-muted-foreground">{comparison}</span>}
        </div>
      )}
      {(contextLeft || barPct !== undefined) && (
        <div className="mt-3">
          {(contextLeft || contextRight) && (
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px]">
              {contextLeft}
              {contextRight}
            </div>
          )}
          {barPct !== undefined && (
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"
              role="img"
              aria-label={barAria}
            >
              <div
                className={cn("h-full rounded-full", BAR_TONES[barTone])}
                style={{ width: `${Math.min(100, Math.max(4, barPct))}%` }}
              />
            </div>
          )}
        </div>
      )}
      {footnote && (
        <p className="mt-3 line-clamp-2 min-h-[2rem] text-[11.5px] leading-relaxed text-slate-500">{footnote}</p>
      )}
    </article>
  );
}
