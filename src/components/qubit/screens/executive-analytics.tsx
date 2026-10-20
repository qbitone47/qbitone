"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard, StatTile, StatusBadge } from "../primitives";
import { useRole } from "../role-context";
import { useQubitNav } from "../nav-context";
import {
  AnalyticsAsOf,
  AnalyticsErrorBanner,
  AnalyticsSkeleton,
  BarList,
  FunnelView,
  MetricDef,
  ScopeNote,
  SourceLine,
  TrendChart,
  useAnalyticsSection,
} from "../analytics/parts";
import { ANALYTICS_PERIOD } from "@/lib/qubit/analytics-data";
import type { Freshness, FinanceData, InventoryData, MarketingData, PeopleData, RevenueData, SalesData, ServiceData, FieldData } from "@/lib/qubit/executive-data";
import type { Kpi } from "@/lib/qubit/executive-data";

// ============================================================
// Screen 268 · Executive Analytics — the enterprise executive
// workspace over the canonical executive blocks (spec §10).
// Every KPI carries: definition (governed), source, trend and a
// drilldown. Partial-domain failures (marketing delay) remain
// clearly visible — no fabricated business insights.
// ============================================================

interface ExecPayload {
  asOfLabel: string;
  kpis: Kpi[];
  revenue: RevenueData;
  sales: SalesData;
  finance: FinanceData;
  people: PeopleData;
  marketing: MarketingData;
  service: ServiceData;
  inventory: InventoryData;
  field: FieldData;
  freshness: Record<string, Freshness>;
}

export function ExecutiveAnalyticsScreen() {
  const { role } = useRole();
  const nav = useQubitNav();
  const { data, loading, error, forbidden, reload } = useAnalyticsSection<ExecPayload>("executive");
  const go = (screen: Parameters<typeof nav.navigate>[0], params?: Parameters<typeof nav.navigate>[1]) => () => nav.navigate(screen, params);

  if (forbidden) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Executive analytics requires executive access</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error} The server enforces this boundary — cross-domain executive data is not served to other roles.</p>
        <button type="button" onClick={reload} className="mt-4 text-[13px] font-medium text-blue-600 hover:text-blue-700">Retry</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Executive Analytics" }]}
        title="Executive Analytics"
        description="Revenue, pipeline, finance, people, marketing, service and inventory in one workspace — each KPI with its definition, source and drilldown."
        actions={<button type="button" onClick={reload} className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700">Refresh</button>}
      />

      {loading && <AnalyticsSkeleton rows={6} />}
      {error && !loading && !forbidden && <AnalyticsErrorBanner message={error} onRetry={reload} />}

      {data && !loading && (
        <div className="space-y-5">
          {/* Executive KPI grid — definitions via MetricDef (governance, spec §6) */}
          <SectionCard title="Executive KPIs" description="Governed metric definitions — select any metric name to see its calculation, source and owner.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.kpis.slice(0, 9).map((k) => (
                <article key={k.id} className="qubit-card qubit-card-hover flex h-full flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <MetricDef
                      metric={{ id: k.id, name: k.name, definition: k.definition, calc: k.calc, source: k.source, period: k.period, caution: k.kind === "Forecast" ? "Forecast construct — never presented as an actual." : undefined }}
                    />
                    <StatusBadge status={k.status} size="sm" />
                  </div>
                  <p className="mt-2 text-[24px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
                    {k.unit === "INR-cr" ? `₹${k.value.toFixed(2)} Cr` : k.unit === "pct" ? `${k.value}%` : k.unit === "x" ? `${k.value}x` : k.value.toLocaleString("en-IN")}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">{k.comparisonText}</p>
                  <div className="mt-2">
                    <SourceLine system={k.source} />
                  </div>
                  <button type="button" onClick={go("kpi-drilldown", { kpiId: k.id })} className="mt-auto pt-3 text-left text-[12.5px] font-medium text-blue-600 hover:text-blue-700">
                    Investigate — definition to underlying records
                  </button>
                </article>
              ))}
            </div>
          </SectionCard>

          {/* Executive charts — each with source + accessible summary */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SectionCard
              title="Revenue trend — recognized basis"
              description="Finance ledger · recognized per accounting policy (labelled separately from bookings)."
              actions={<FreshnessBadgeShort f={data.freshness.revenue} />}
            >
              <TrendChart
                points={data.revenue.trend.filter((p) => p.actual !== null || p.forecast).map((p) => ({ label: p.month, value: p.actual ?? p.forecast ?? 0, target: p.target }))}
                unit="₹ Cr"
                ariaLabel={`Revenue trend: ${data.revenue.trend.map((p) => `${p.month} ${p.actual ?? "forecast"} vs target ${p.target}`).join(", ")}`}
                summary={`FYTD recognized ₹${data.revenue.ytd.actual.toFixed(2)} Cr against ₹${data.revenue.ytd.target.toFixed(2)} Cr target. November and December are forecasts, drawn dashed via the target series — actuals stop at October.`}
              />
            </SectionCard>

            <SectionCard
              title="Sales pipeline — stage funnel"
              description="Sales OS bookings basis · weighted values are a forecast construct."
              actions={<FreshnessBadgeShort f={data.freshness.sales} />}
            >
              <FunnelView
                stages={data.sales.funnel.map((s) => ({ stage: s.stage, count: s.count, valueCr: s.value }))}
                ariaLabel={`Pipeline funnel: ${data.sales.funnel.map((s) => `${s.stage} ${s.count} deals ${s.value}`).join(", ")}`}
              />
              <div className="mt-4 grid grid-cols-3 gap-2">
                <StatTile value={`₹${data.sales.pipeline.value.toFixed(1)} Cr`} label="Open pipeline" />
                <StatTile value={`₹${data.sales.pipeline.weighted.toFixed(1)} Cr`} label="Weighted (forecast)" />
                <StatTile value={`${data.sales.pipeline.coverage}x`} label={`Coverage (target ${data.sales.pipeline.coverageTarget}x)`} />
              </div>
            </SectionCard>

            <SectionCard
              title="Cash position"
              description="Finance ledger · month-end cash against the ₹5.0 Cr floor."
              actions={<FreshnessBadgeShort f={data.freshness.finance} />}
            >
              <TrendChart
                points={data.finance.cash.trend.map((p) => ({ label: p.month, value: p.value, target: data.finance.cash.floor }))}
                unit="₹ Cr"
                color="#0D9488"
                ariaLabel={`Cash trend: ${data.finance.cash.trend.map((p) => `${p.month} ₹${p.value} Cr`).join(", ")}`}
                summary={`Cash ₹${data.finance.cash.position.toFixed(2)} Cr — runway ${data.finance.cash.runwayMonths} months. The dashed series is the ₹5.0 Cr floor, not a target.`}
              />
            </SectionCard>

            <SectionCard
              title="Headcount & service health"
              description="HR registry (aggregated) · service desk live."
              actions={<FreshnessBadgeShort f={data.freshness.people} />}
            >
              <BarList
                ariaLabel={`Headcount by month: ${data.people.trend.map((t) => `${t.month} ${t.headcount}`).join(", ")}`}
                items={data.people.trend.map((t) => ({ label: t.month, value: t.headcount }))}
                tone="emerald"
              />
              <div className="mt-4 grid grid-cols-3 gap-2">
                <StatTile value={data.people.headcount.total.toLocaleString("en-IN")} label="Headcount (aggregated)" />
                <StatTile value={`${data.service.sla.compliancePct}%`} label={`SLA compliance (target ${data.service.sla.targetPct}%)`} />
                <StatTile value={String(data.service.tickets.open)} label="Open tickets" />
              </div>
            </SectionCard>

            <SectionCard
              title="Inventory health"
              description="Operational metrics from the inventory system — valuation stays on Finance Analytics."
              actions={<FreshnessBadgeShort f={data.freshness.inventory} />}
            >
              <div className="grid grid-cols-2 gap-2">
                <StatTile value={String(data.inventory.health.lowStock)} label="Low-stock SKUs" />
                <StatTile value={String(data.inventory.health.overstock)} label="Overstock SKUs" />
                <StatTile value={String(data.inventory.health.stockouts)} label="Stockouts" />
                <StatTile value={`${data.inventory.dispatch.onTimePct}%`} label={`On-time dispatch (target ${data.inventory.dispatch.onTimeTarget}%)`} />
              </div>
              <ScopeNote className="mt-3">{`Inventory valuation ₹${data.inventory.valueCr.toFixed(2)} Cr is Finance-aligned and kept separate from operational stock metrics (spec §16).`}</ScopeNote>
            </SectionCard>

            {/* Partial-domain failure stays visible — no fabricated insight */}
            <SectionCard
              title="Marketing performance"
              description="Platform-reported figures · source sync delayed."
              actions={<FreshnessBadgeShort f={data.freshness.marketing} />}
            >
              <div className="grid grid-cols-2 gap-2">
                <StatTile value={String(data.marketing.qtd.leads)} label="Leads QTD (as of 31 Oct)" />
                <StatTile value={String(data.marketing.qtd.sql)} label="SQLs QTD" />
                <StatTile value={`₹${data.marketing.qtd.cpl.toLocaleString("en-IN")}`} label="CPL (governed definition)" />
                <StatTile value={`₹${data.marketing.qtd.sourcedPipeline.toFixed(2)} Cr`} label="Sourced pipeline (attributed)" />
              </div>
              <div role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
                {data.marketing.freshness.detail ?? "Marketing source sync is delayed — figures are final as of 31 Oct; November is incomplete, not missing."}
              </div>
            </SectionCard>
          </div>

          <AnalyticsAsOf asOfLabel={data.asOfLabel} fiscalNote={ANALYTICS_PERIOD.fiscalNote} />
        </div>
      )}

      {data === null && !loading && !error && (
        <EmptyState icon={<span aria-hidden>📊</span>} title="Executive analytics unavailable" message="The analytics layer could not compose this view. Retry in a moment." />
      )}
    </div>
  );
}

function FreshnessBadgeShort({ f }: { f?: Freshness }) {
  if (!f) return null;
  const tone = f.status === "live" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : f.status === "ok" ? "border-blue-100 bg-blue-50 text-blue-700" : "border-amber-100 bg-amber-50 text-amber-700";
  return (
    <span className={`max-w-[220px] truncate rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${tone}`} title={f.detail ?? f.label}>
      {f.label.replace(/^Updated\s*/, "")}
    </span>
  );
}
