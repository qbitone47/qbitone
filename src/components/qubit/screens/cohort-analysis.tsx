"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard, StatTile } from "../primitives";
import { useQubitNav } from "../nav-context";
import {
  AnalyticsAsOf,
  AnalyticsErrorBanner,
  AnalyticsSkeleton,
  ScopeNote,
  SourceLine,
  TrendChart,
  useAnalyticsSection,
} from "../analytics/parts";
import type { Freshness } from "@/lib/qubit/executive-data";

// ============================================================
// Screen 278 · Cohort / Trend Analysis — advanced but honest
// (spec §20). Customer acquisition cohorts are computed from the
// live sales store (first-order quarter per account); employee
// joining cohorts come from the aggregated HR trend. Statistically
// weak conclusions are never dressed up as facts: small cohorts
// are flagged, missing history is stated, seasonality is not
// asserted without the data to support it.
// ============================================================

interface CohortRow {
  cohort: string;
  size: number;
  orders?: number;
  valueCr?: number;
  repeatPct?: number | null;
  stillActive?: number;
  retentionPct?: number | null;
  note?: string | null;
}

interface CohortPayload {
  asOfLabel: string;
  scopeNote: string | null;
  cohorts: { id: string; name: string; grain: string; unit: string; rows: CohortRow[]; dataNote: string }[];
  trendSeries: { id: string; name: string; unit: string; points: { label: string; value: number; target?: number | null }[] }[];
  honestyNote: string;
  freshness: Freshness;
}

export function CohortAnalysisScreen() {
  const nav = useQubitNav();
  const { data, loading, error, reload } = useAnalyticsSection<CohortPayload>("cohorts");
  const [seriesId, setSeriesId] = React.useState<string | null>(null);
  const go = (screen: Parameters<typeof nav.navigate>[0], params?: Parameters<typeof nav.navigate>[1]) => () => nav.navigate(screen, params);
  const activeSeries = data?.trendSeries.find((s) => s.id === (seriesId ?? data.trendSeries[0]?.id)) ?? data?.trendSeries[0];

  if (loading) return <div className="mx-auto max-w-6xl"><PageHeader crumbs={[{ label: "Analytics" }, { label: "Cohort / Trend Analysis" }]} title="Cohort / Trend Analysis" /> <AnalyticsSkeleton rows={5} /></div>;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader crumbs={[{ label: "Analytics" }, { label: "Cohort / Trend Analysis" }]} title="Cohort / Trend Analysis" />
        <AnalyticsErrorBanner message={error} onRetry={reload} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Cohort / Trend Analysis" }]}
        title="Cohort / Trend Analysis"
        description="Acquisition cohorts and period trends computed at read time from authoritative sources — with sample sizes and limitations stated."
        meta={<SourceLine system="Sales OS · HR registry · Service · Field" freshness={data.freshness} />}
        actions={<button type="button" onClick={reload} className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700">Refresh</button>}
      />

      <div className="space-y-5">
        {data.scopeNote && <ScopeNote>{data.scopeNote}</ScopeNote>}

        {data.cohorts.map((c) => (
          <SectionCard key={c.id} title={c.name} description={`${c.grain} · measured in ${c.unit}`}>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[12.5px]">
                <caption className="sr-only">{c.name}</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                    <th scope="col" className="py-2 pr-3 font-semibold">Cohort</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">{c.unit === "customers" ? "Customers" : "Joined"}</th>
                    {c.unit === "customers" && <th scope="col" className="px-3 py-2 text-right font-semibold">Orders</th>}
                    {c.unit === "customers" && <th scope="col" className="px-3 py-2 text-right font-semibold">Value</th>}
                    <th scope="col" className="pl-3 py-2 text-right font-semibold">{c.unit === "customers" ? "Repeat %" : "Headcount at month end"}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.rows.length === 0 ? (
                    <tr><td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">No cohort rows yet — cohorts appear as the source accumulates orders.</td></tr>
                  ) : (
                    c.rows.map((r) => (
                      <tr key={r.cohort} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 pr-3 font-medium text-slate-800">
                          {r.cohort}
                          {r.note && <span className="ml-2 rounded-full border border-amber-100 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">{r.note}</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.size}</td>
                        {c.unit === "customers" && <td className="px-3 py-2 text-right tabular-nums">{r.orders ?? "—"}</td>}
                        {c.unit === "customers" && <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{r.valueCr !== undefined ? `₹${r.valueCr.toFixed(2)} Cr` : "—"}</td>}
                        <td className="pl-3 py-2 text-right tabular-nums text-slate-600">{c.unit === "customers" ? (r.repeatPct !== null && r.repeatPct !== undefined ? `${r.repeatPct}%` : "—") : (r.stillActive ?? "—")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <ScopeNote className="mt-3">{c.dataNote}</ScopeNote>
          </SectionCard>
        ))}

        <SectionCard
          title="Trend series"
          description="Granularity follows the source — monthly for revenue, weekly for service and field."
          actions={
            data.trendSeries.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                {data.trendSeries.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSeriesId(s.id)}
                    aria-pressed={(seriesId ?? data.trendSeries[0]?.id) === s.id}
                    className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${(seriesId ?? data.trendSeries[0]?.id) === s.id ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                  >
                    {s.name.split(" (")[0]}
                  </button>
                ))}
              </div>
            ) : undefined
          }
        >
          {activeSeries && (
            <>
              <TrendChart
                points={activeSeries.points.map((p) => ({ label: p.label, value: p.value, target: p.target ?? null }))}
                unit={activeSeries.unit}
                ariaLabel={`${activeSeries.name}: ${activeSeries.points.map((p) => `${p.label} ${p.value}`).join(", ")}`}
                summary={`${activeSeries.name} — ${activeSeries.points.length} periods, from ${activeSeries.points[0]?.label} (${activeSeries.points[0]?.value}) to ${activeSeries.points[activeSeries.points.length - 1]?.label} (${activeSeries.points[activeSeries.points.length - 1]?.value}). Where a target exists it is drawn dashed.`}
                color={activeSeries.id === "backlog" ? "#7C3AED" : activeSeries.id === "field" ? "#0D9488" : "#2563EB"}
              />
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile value={String(activeSeries.points.length)} label="Periods in series" />
                <StatTile value={String(activeSeries.points[0]?.value ?? 0)} label={`First period (${activeSeries.points[0]?.label})`} />
                <StatTile value={String(Math.max(...activeSeries.points.map((p) => p.value)))} label="Series maximum" />
                <StatTile value={String(activeSeries.points[activeSeries.points.length - 1]?.value ?? 0)} label={`Latest (${activeSeries.points[activeSeries.points.length - 1]?.label})`} />
              </div>
            </>
          )}
        </SectionCard>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[12.5px] font-semibold text-slate-900">What this screen will not tell you</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{data.honestyNote}</p>
        </div>

        <AnalyticsAsOf asOfLabel={data.asOfLabel} />
        <button type="button" onClick={go("analytics-home")} className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700">Back to Analytics Home</button>
      </div>
    </div>
  );
}
