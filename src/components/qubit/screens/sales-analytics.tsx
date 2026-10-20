"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard, StatTile } from "../primitives";
import { useQubitNav } from "../nav-context";
import {
  AnalyticsAsOf,
  AnalyticsErrorBanner,
  AnalyticsSkeleton,
  BarList,
  ColumnChart,
  FunnelView,
  MetricDef,
  ScopeNote,
  SourceLine,
  TrendChart,
  useAnalyticsSection,
} from "../analytics/parts";
import { metricById } from "@/lib/qubit/analytics-data";
import type { Freshness } from "@/lib/qubit/executive-data";

// ============================================================
// Screen 269 · Sales Analytics — the centralized sales view over
// the AUTHORITATIVE Sales OS. Rows are read through sales-server
// at the caller's scope (company / team / own) — analytics never
// touches the sales store directly. Opportunity values are
// labelled as bookings; the revenue trend is the Finance ledger
// view and is labelled separately (spec §11, §6).
// ============================================================

interface SalesAnalyticsPayload {
  asOfLabel: string;
  salesScope: string;
  leadVolume: number;
  leadsByStatus: { label: string; count: number }[];
  leadsBySource: { label: string; count: number; converted: number }[];
  leadConversionPct: number | null;
  opportunityVolume: number;
  openOpportunities: number;
  byStage: { stage: string; count: number; value: number; weighted: number; avgDays: number }[];
  pipelineValue: number;
  weightedPipeline: number;
  winRatePct: number | null;
  avgDealCr: number | null;
  avgCycleDays: number | null;
  quotation: { total: number; accepted: number; pending: number; acceptancePct: number };
  orders: { count: number; bookedValueCr: number; byStatus: { label: string; count: number }[] };
  followups: { overdue: number; dueToday: number; upcoming: number; completed: number };
  leaderboard: { name: string; achievementPct: number; achieved: number; quota: number; conversionPct: number }[];
  forecast: { commit: number; bestCase: number; weighted: number; target: number } | null;
  revenueTrend: { month: string; actual: number | null; target: number; forecast?: number | null }[];
  freshness: Freshness;
  notes: string[];
}

export function SalesAnalyticsScreen() {
  const nav = useQubitNav();
  const { data, loading, error, reload } = useAnalyticsSection<SalesAnalyticsPayload>("sales");
  const go = (screen: Parameters<typeof nav.navigate>[0], params?: Parameters<typeof nav.navigate>[1]) => () => nav.navigate(screen, params);

  if (loading) return <div className="mx-auto max-w-6xl"><PageHeader crumbs={[{ label: "Analytics" }, { label: "Sales Analytics" }]} title="Sales Analytics" /> <AnalyticsSkeleton rows={6} /></div>;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader crumbs={[{ label: "Analytics" }, { label: "Sales Analytics" }]} title="Sales Analytics" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-sm font-medium text-amber-900">{error}</p>
          <p className="mt-1 text-xs text-amber-800">Sales analytics is served only to boundaries with sales authorization — the server re-applies the Sales gate on every request.</p>
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={reload} className="text-[12.5px] font-medium text-amber-900 underline">Retry</button>
            <button type="button" onClick={go("analytics-home")} className="text-[12.5px] font-medium text-amber-900 underline">Back to Analytics Home</button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const funnelStages = [
    { stage: "Leads", count: data.leadVolume, valueCr: null as number | null, note: "Leads in scope" },
    { stage: "Opportunities", count: data.opportunityVolume, valueCr: data.byStage.filter((s) => !["Won", "Lost"].includes(s.stage)).reduce((n, s) => n + s.value, 0), note: "All opportunities created" },
    { stage: "Quotations", count: data.quotation.total, valueCr: null, note: "Proposal basis" },
    { stage: "Orders (Won)", count: data.orders.count, valueCr: data.orders.bookedValueCr, note: "Booked basis — not recognized revenue" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Sales Analytics" }]}
        title="Sales Analytics"
        description="Centralized sales analytics computed from the authoritative Sales OS at your scope — one pipeline, no parallel numbers."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11.5px] font-medium capitalize text-slate-600">{data.salesScope} scope · server-enforced</span>
            <SourceLine system="Sales OS (live store)" freshness={data.freshness} />
          </div>
        }
        actions={<button type="button" onClick={reload} className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700">Refresh</button>}
      />

      <div className="space-y-5">
        {/* Headline metrics with governed definitions */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="qubit-card p-4">
            <MetricDef metric={metricById("pipeline-value")} />
            <p className="mt-2 text-[24px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">₹{data.pipelineValue.toFixed(2)} Cr</p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">{data.openOpportunities} open opportunities</p>
          </article>
          <article className="qubit-card p-4">
            <MetricDef metric={metricById("weighted-pipeline")} />
            <p className="mt-2 text-[24px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">₹{data.weightedPipeline.toFixed(2)} Cr</p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">Forecast construct — never an actual</p>
          </article>
          <article className="qubit-card p-4">
            <MetricDef metric={metricById("win-rate")} />
            <p className="mt-2 text-[24px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">{data.winRatePct !== null ? `${data.winRatePct}%` : "—"}</p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">{data.winRatePct === null ? "No closed opportunities in scope yet" : "Won ÷ (won + lost)"}</p>
          </article>
          <article className="qubit-card p-4">
            <MetricDef metric={metricById("lead-conversion")} />
            <p className="mt-2 text-[24px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">{data.leadConversionPct !== null ? `${data.leadConversionPct}%` : "—"}</p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">{data.leadVolume} leads in scope</p>
          </article>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SectionCard title="Sales funnel" description="Stage counts from the live sales store — orders are the booked basis.">
            <FunnelView stages={funnelStages} ariaLabel={`Sales funnel: ${funnelStages.map((s) => `${s.stage} ${s.count}`).join(", ")}`} />
          </SectionCard>

          <SectionCard title="Pipeline by stage" description="Count, value and weighted value per stage with average days in stage.">
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[12.5px]">
                <caption className="sr-only">Pipeline by stage</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                    <th scope="col" className="py-2 pr-3 font-semibold">Stage</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Count</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Value</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Weighted</th>
                    <th scope="col" className="pl-3 py-2 text-right font-semibold">Avg days</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byStage.map((s) => (
                    <tr key={s.stage} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-800">{s.stage}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.count}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">₹{s.value.toFixed(2)} Cr</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">₹{s.weighted.toFixed(2)} Cr</td>
                      <td className="pl-3 py-2 text-right tabular-nums text-slate-500">{s.avgDays > 0 ? `${s.avgDays}d` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ScopeNote className="mt-3">Average days use each opportunity&apos;s last stage change — duration inside the current stage, not total age.</ScopeNote>
          </SectionCard>

          <SectionCard title="Revenue trend — recognized (Finance ledger)" description="Labelled separately from the bookings above; the two bases are never mixed.">
            <TrendChart
              points={data.revenueTrend.filter((p) => p.actual !== null || p.forecast).map((p) => ({ label: p.month, value: p.actual ?? p.forecast ?? 0, target: p.target }))}
              unit="₹ Cr"
              ariaLabel={`Recognized revenue trend: ${data.revenueTrend.map((p) => `${p.month} ${p.actual ?? "forecast"}`).join(", ")}`}
              summary={`Recognized per accounting policy from the Finance ledger. Nov–Dec are forecasts. Bookings (orders) and recognized revenue are different governed metrics.`}
            />
          </SectionCard>

          <SectionCard title="Win / loss & deal economics" description="Computed from closed opportunities in scope.">
            <div className="grid grid-cols-3 gap-2">
              <StatTile value={data.avgDealCr !== null ? `₹${data.avgDealCr.toFixed(2)} Cr` : "—"} label="Average deal (won)" />
              <StatTile value={data.avgCycleDays !== null ? `${data.avgCycleDays}d` : "—"} label="Average cycle (won)" />
              <StatTile value={`${data.quotation.acceptancePct}%`} label={`Quotation acceptance (${data.quotation.accepted}/${data.quotation.total})`} />
            </div>
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Orders by status</p>
              {data.orders.byStatus.length === 0 ? (
                <p className="text-xs text-muted-foreground">No orders in scope yet.</p>
              ) : (
                <BarList
                  ariaLabel={`Orders by status: ${data.orders.byStatus.map((o) => `${o.label} ${o.count}`).join(", ")}`}
                  items={data.orders.byStatus.map((o) => ({ label: o.label, value: o.count }))}
                  tone="emerald"
                  unit="orders"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Salesperson performance" description="From the leaderboard at your scope — achievement against quota, never gamified.">
            {data.leaderboard.length === 0 ? (
              <EmptyState title="No leaderboard rows in scope" message="Your boundary scopes the leaderboard to the people you are authorized to see." />
            ) : (
              <BarList
                ariaLabel={`Salesperson achievement: ${data.leaderboard.map((r) => `${r.name} ${r.achievementPct}%`).join(", ")}`}
                items={data.leaderboard.map((r) => ({ label: r.name, value: r.achievementPct, hint: `₹${r.achieved.toFixed(2)} Cr won` }))}
                unit="%"
                max={130}
                tone={data.leaderboard[0]?.achievementPct >= 97 ? "emerald" : "blue"}
              />
            )}
            <ScopeNote className="mt-3">Achievement = actual won ÷ quota. Conversion % per person appears on the Sales Leaderboard screen (83).</ScopeNote>
          </SectionCard>

          <SectionCard title="Follow-up activity" description="Live follow-up queue state at your scope.">
            <div className="grid grid-cols-2 gap-2">
              <StatTile value={String(data.followups.overdue)} label="Overdue" onClick={go("followup-queue", { filter: "overdue" })} />
              <StatTile value={String(data.followups.dueToday)} label="Due today" onClick={go("followup-queue", { filter: "today" })} />
              <StatTile value={String(data.followups.upcoming)} label="Upcoming" />
              <StatTile value={String(data.followups.completed)} label="Completed" />
            </div>
            {data.forecast && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Forecast vs target (commit basis)</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <StatTile value={`₹${data.forecast.commit.toFixed(2)} Cr`} label="Commit" />
                  <StatTile value={`₹${data.forecast.bestCase.toFixed(2)} Cr`} label="Best case" />
                  <StatTile value={`₹${data.forecast.target.toFixed(2)} Cr`} label="Target" />
                </div>
                <ScopeNote className="mt-2">Commit and best case are forecasts — they are never mixed with actuals or with the recognized revenue trend.</ScopeNote>
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Leads by source" description="Volume and conversion per source — computed from live leads at your scope.">
          {data.leadsBySource.length === 0 ? (
            <EmptyState title="No leads in scope" message="Leads appear here as soon as they exist within your authorization." />
          ) : (
            <ColumnChart
              points={data.leadsBySource.map((s) => ({ label: s.label, value: s.count }))}
              unit="leads"
              ariaLabel={`Leads by source: ${data.leadsBySource.map((s) => `${s.label} ${s.count}`).join(", ")}`}
              summary={`${data.leadsBySource.map((s) => `${s.label}: ${s.count} leads, ${s.converted} converted`).join("; ")}. The table on the Lead Inbox (74) holds per-lead detail.`}
              height={200}
            />
          )}
        </SectionCard>

        {data.notes.length > 0 && (
          <ul className="space-y-1.5">
            {data.notes.map((n, i) => (
              <li key={i}><ScopeNote>{n}</ScopeNote></li>
            ))}
          </ul>
        )}

        <AnalyticsAsOf asOfLabel={data.asOfLabel} />
      </div>
    </div>
  );
}
