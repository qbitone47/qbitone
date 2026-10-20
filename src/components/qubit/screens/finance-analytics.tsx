"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard, StatTile } from "../primitives";
import {
  AnalyticsAsOf,
  AnalyticsErrorBanner,
  AnalyticsSkeleton,
  BarList,
  MetricDef,
  ScopeNote,
  SourceLine,
  TrendChart,
  useAnalyticsSection,
} from "../analytics/parts";
import type { MetricDefinition, } from "@/lib/qubit/analytics-data";
import type { Freshness, FinanceData, RevenueData } from "@/lib/qubit/executive-data";

// ============================================================
// Screen 270 · Finance Analytics — Finance remains THE financial
// source of truth (spec §12). The three money bases (Booked /
// Recognized / Collected) are explicitly identified at every
// appearance; nothing is silently mixed. Restricted to authorized
// finance/administrator boundaries server-side.
// ============================================================

interface FinanceAnalyticsPayload {
  asOfLabel: string;
  finance: FinanceData;
  revenue: RevenueData;
  definitions: { booked: MetricDefinition | null; recognized: MetricDefinition | null; collected: MetricDefinition | null; dso: MetricDefinition | null; inventoryValue: MetricDefinition | null };
  freshness: { revenue: Freshness; finance: Freshness };
}

export function FinanceAnalyticsScreen() {
  const { data, loading, error, reload } = useAnalyticsSection<FinanceAnalyticsPayload>("finance");

  if (loading) return <div className="mx-auto max-w-6xl"><PageHeader crumbs={[{ label: "Analytics" }, { label: "Finance Analytics" }]} title="Finance Analytics" /> <AnalyticsSkeleton rows={6} /></div>;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader crumbs={[{ label: "Analytics" }, { label: "Finance Analytics" }]} title="Finance Analytics" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-sm font-medium text-amber-900">{error}</p>
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={reload} className="text-[12.5px] font-medium text-amber-900 underline">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { finance, revenue } = data;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Finance Analytics" }]}
        title="Finance Analytics"
        description="Revenue, collections, receivables, budgets and margins — read from the Finance ledger, never recomputed by analytics."
        meta={<SourceLine system="Finance ledger · canonical Finance block" freshness={data.freshness.finance} />}
        actions={<button type="button" onClick={reload} className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700">Refresh</button>}
      />

      <div className="space-y-5">
        {/* The three definitions — the governance centerpiece */}
        <SectionCard
          title="One period, three money bases — always labelled"
          description={`November 2026 month-to-date (${revenue.mtd.label}). Select any basis to see its governed definition.`}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <MetricDef metric={data.definitions.recognized} />
              <p className="mt-2 text-[22px] font-bold leading-none tabular-nums text-slate-900">₹{revenue.mtd.recognized.toFixed(2)} Cr</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Recognized — the headline figure</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <MetricDef metric={data.definitions.booked} />
              <p className="mt-2 text-[22px] font-bold leading-none tabular-nums text-slate-900">₹{revenue.mtd.booked.toFixed(2)} Cr</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Booked — contract value signed</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <MetricDef metric={data.definitions.collected} />
              <p className="mt-2 text-[22px] font-bold leading-none tabular-nums text-slate-900">₹{revenue.mtd.collected.toFixed(2)} Cr</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Collected — cash received</p>
            </article>
          </div>
          <ScopeNote className="mt-3">
            These are different governed metrics, not views of one number. Analytics never silently substitutes one for another (spec §6).
          </ScopeNote>
        </SectionCard>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SectionCard title="Revenue trend — recognized vs target" description="FY27 by month; Nov–Dec are forecasts.">
            <TrendChart
              points={revenue.trend.filter((p) => p.actual !== null || p.forecast).map((p) => ({ label: p.month, value: p.actual ?? p.forecast ?? 0, target: p.target }))}
              unit="₹ Cr"
              ariaLabel={`Revenue trend: ${revenue.trend.map((p) => `${p.month} ${p.actual ?? "forecast"} target ${p.target}`).join(", ")}`}
              summary={`FYTD recognized ₹${revenue.ytd.actual.toFixed(2)} Cr vs ₹${revenue.ytd.target.toFixed(2)} Cr target (+${(((revenue.ytd.actual - revenue.ytd.target) / revenue.ytd.target) * 100).toFixed(1)}%). Q3 to date ₹${revenue.quarter.actualToDate.toFixed(2)} Cr of ₹${revenue.quarter.target.toFixed(2)} Cr.`}
            />
          </SectionCard>

          <SectionCard title="Cash position" description="Month-end cash against the floor.">
            <TrendChart
              points={finance.cash.trend.map((p) => ({ label: p.month, value: p.value, target: finance.cash.floor }))}
              unit="₹ Cr"
              color="#0D9488"
              ariaLabel={`Cash trend: ${finance.cash.trend.map((p) => `${p.month} ₹${p.value} Cr`).join(", ")}`}
              summary={`Cash ₹${finance.cash.position.toFixed(2)} Cr; runway ${finance.cash.runwayMonths} months; floor ₹${finance.cash.floor.toFixed(1)} Cr (dashed).`}
            />
          </SectionCard>

          <SectionCard
            title="Receivables & aging"
            description={`Total ₹${finance.receivables.total.toFixed(2)} Cr — overdue ₹${finance.receivables.overdue.toFixed(2)} Cr.`}
          >
            <div className="mb-4 grid grid-cols-3 gap-2">
              <StatTile value={`₹${finance.receivables.total.toFixed(2)} Cr`} label="Total receivables" />
              <StatTile value={`${finance.receivables.dsoDays}d`} label={`DSO (Δ ${finance.receivables.dsoDeltaDays > 0 ? "+" : ""}${finance.receivables.dsoDeltaDays}d)`} />
              <StatTile value={`₹${finance.payables.total.toFixed(2)} Cr`} label={`Payables (₹${finance.payables.dueThisWeek.toFixed(2)} Cr due this week)`} />
            </div>
            <BarList
              ariaLabel={`Overdue receivables: ${finance.receivables.overdueAccounts.map((a) => `${a.account} ₹${a.amount} Cr at ${a.days} days`).join(", ")}`}
              items={finance.receivables.overdueAccounts.map((a) => ({ label: a.account, value: a.amount, hint: `${a.days}d`, tone: a.days > 60 ? "bg-rose-500" : a.days > 30 ? "bg-amber-500" : "bg-blue-500" }))}
              valueFormat={(v) => `₹${v.toFixed(2)} Cr`}
            />
            <MetricDef metric={data.definitions.dso} label="What is DSO?" />
          </SectionCard>

          <SectionCard title="Budget vs actual by department" description="Current period — budget ledger, not recomputed.">
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[12.5px]">
                <caption className="sr-only">Budget vs actual by department</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                    <th scope="col" className="py-2 pr-3 font-semibold">Department</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Budget</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Actual</th>
                    <th scope="col" className="pl-3 py-2 text-right font-semibold">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {finance.budgetVariance.map((b) => (
                    <tr key={b.department} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-800">{b.department}</td>
                      <td className="px-3 py-2 text-right tabular-nums">₹{b.budget.toFixed(2)} Cr</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">₹{b.actual.toFixed(2)} Cr</td>
                      <td className={`pl-3 py-2 text-right font-medium tabular-nums ${b.variancePct > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                        {b.variancePct > 0 ? "+" : ""}{b.variancePct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ScopeNote className="mt-3">Positive variance = overspend. Company OPEX variance: {finance.opex.variancePct > 0 ? "+" : ""}{finance.opex.variancePct}% (₹{finance.opex.actual.toFixed(2)} Cr vs ₹{finance.opex.budget.toFixed(2)} Cr budget).</ScopeNote>
          </SectionCard>

          <SectionCard title="Expense trend" description="Monthly actual vs budget (₹ Cr).">
            <TrendChart
              points={finance.expenses.map((e) => ({ label: e.month, value: e.actual, target: e.budget }))}
              unit="₹ Cr"
              color="#DC2626"
              ariaLabel={`Expense trend: ${finance.expenses.map((e) => `${e.month} ₹${e.actual} vs ₹${e.budget} budget`).join(", ")}`}
              summary={`October actual ₹${finance.expenses[finance.expenses.length - 2]?.actual.toFixed(2) ?? "—"} Cr vs ₹${finance.expenses[finance.expenses.length - 2]?.budget.toFixed(2) ?? "—"} Cr budget; November is month-to-date.`}
            />
          </SectionCard>

          <SectionCard title="Margins & financial risk" description="From the Finance ledger — risk items are stated, not scored.">
            <div className="mb-4 grid grid-cols-2 gap-2">
              <StatTile value={`${finance.margins.gross}%`} label={`Gross margin (target ${finance.margins.grossTarget}%)`} />
              <StatTile value={`${finance.margins.net}%`} label="Net margin" />
            </div>
            <ul className="space-y-2">
              {finance.risk.map((r) => (
                <li key={r.label} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                  <p className="text-[13px] font-medium text-slate-900">{r.label} <span className={`ml-1.5 rounded-full border px-1.5 py-px text-[10px] font-semibold ${r.level === "High" ? "border-rose-100 bg-rose-50 text-rose-700" : r.level === "Medium" ? "border-amber-100 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{r.level}</span></p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.detail}</p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <AnalyticsAsOf asOfLabel={data.asOfLabel} />
      </div>
    </div>
  );
}
