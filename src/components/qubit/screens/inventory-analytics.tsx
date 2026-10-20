"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard, StatTile } from "../primitives";
import {
  AnalyticsAsOf,
  AnalyticsErrorBanner,
  AnalyticsSkeleton,
  BarList,
  ColumnChart,
  MetricDef,
  ScopeNote,
  SourceLine,
  TrendChart,
  useAnalyticsSection,
} from "../analytics/parts";
import { metricById } from "@/lib/qubit/analytics-data";
import type { Freshness, InventoryData } from "@/lib/qubit/executive-data";

// ============================================================
// Screen 274 · Inventory Analytics — operational inventory
// metrics (stock levels, movement, dispatch) are kept clearly
// separate from the financial valuation, which remains aligned
// with Finance (spec §16). Source filters (product/warehouse/
// movement type) ride the inventory system's own surfaces.
// ============================================================

interface InventoryAnalyticsPayload {
  asOfLabel: string;
  inventory: InventoryData;
  definitions: { inventoryValue: { id: string; name: string; definition: string; calc: string; source: string; period: string; owner: string; caution?: string } | null };
  freshness: Freshness;
  separationNote: string;
}

export function InventoryAnalyticsScreen() {
  const { data, loading, error, reload } = useAnalyticsSection<InventoryAnalyticsPayload>("inventory");

  if (loading) return <div className="mx-auto max-w-6xl"><PageHeader crumbs={[{ label: "Analytics" }, { label: "Inventory Analytics" }]} title="Inventory Analytics" /> <AnalyticsSkeleton rows={5} /></div>;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader crumbs={[{ label: "Analytics" }, { label: "Inventory Analytics" }]} title="Inventory Analytics" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-sm font-medium text-amber-900">{error}</p>
          <button type="button" onClick={reload} className="mt-3 text-[12.5px] font-medium text-amber-900 underline">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const inv = data.inventory;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Inventory Analytics" }]}
        title="Inventory Analytics"
        description="Stock health, movement and dispatch — operational metrics with the financial valuation clearly separated."
        meta={<SourceLine system="Inventory system" freshness={data.freshness} />}
        actions={<button type="button" onClick={reload} className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700">Refresh</button>}
      />

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="qubit-card p-4">
            <p className="text-[13px] font-medium text-slate-500">SKUs tracked</p>
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">{inv.skus.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Across {inv.warehouses.length} warehouses</p>
          </article>
          <article className="qubit-card p-4">
            <MetricDef metric={data.definitions.inventoryValue} label="Inventory valuation" />
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">₹{inv.valueCr.toFixed(2)} Cr</p>
            <p className="mt-1 text-[10.5px] font-medium uppercase tracking-wide text-violet-600">Finance-aligned — see note below</p>
          </article>
          <article className="qubit-card p-4">
            <p className="text-[13px] font-medium text-slate-500">Stock health</p>
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">{inv.health.lowStock + inv.health.overstock + inv.health.stockouts}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{inv.health.lowStock} low · {inv.health.overstock} overstock · <span className="font-medium text-rose-600">{inv.health.stockouts} stockouts</span></p>
          </article>
          <article className="qubit-card p-4">
            <p className="text-[13px] font-medium text-slate-500">On-time dispatch</p>
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">{inv.dispatch.onTimePct}%</p>
            <p className="mt-1 text-[11px] text-amber-600">Target {inv.dispatch.onTimeTarget}% · {inv.dispatch.blocked} blocked</p>
          </article>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SectionCard title="Stock movement — inbound vs outbound" description="Monthly movement value (₹ Cr) from the inventory system.">
            <TrendChart
              points={inv.movement.map((m) => ({ label: m.month, value: m.outbound, target: m.inbound }))}
              unit="₹ Cr"
              color="#0D9488"
              ariaLabel={`Movement: ${inv.movement.map((m) => `${m.month} in ${m.inbound} out ${m.outbound}`).join(", ")}`}
              summary={`Outbound (solid) vs inbound (dashed) monthly value. October: in ₹${inv.movement[inv.movement.length - 1]?.inbound.toFixed(2) ?? "—"} Cr, out ₹${inv.movement[inv.movement.length - 1]?.outbound.toFixed(2) ?? "—"} Cr. Stock aging and turnover series enter when the source retains them.`}
            />
          </SectionCard>

          <SectionCard title="Warehouse utilization & value" description="Operational utilization per warehouse; valuation shown separately.">
            <BarList
              ariaLabel={`Warehouse utilization: ${inv.warehouses.map((w) => `${w.name} ${w.utilizationPct}%`).join(", ")}`}
              items={inv.warehouses.map((w) => ({ label: w.name, value: w.utilizationPct, hint: `₹${w.valueCr.toFixed(2)} Cr`, tone: w.utilizationPct >= 90 ? "bg-rose-500" : w.utilizationPct >= 80 ? "bg-amber-500" : "bg-blue-500" }))}
              unit="%"
              max={100}
            />
            <ScopeNote className="mt-3">{data.separationNote}</ScopeNote>
          </SectionCard>

          <SectionCard title="Stockout exceptions" description="SKUs blocking dispatch — the operational exceptions, not a SKU wall.">
            <ul className="space-y-2.5">
              {inv.stockoutItems.map((it) => (
                <li key={it.sku} className="flex flex-wrap items-center gap-2.5 rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-slate-900">{it.name} <span className="ml-1 font-mono text-[10.5px] text-slate-400">{it.sku}</span></p>
                    <p className="mt-0.5 text-xs text-muted-foreground">ETA {it.eta}</p>
                  </div>
                  <span className="rounded-full border border-rose-100 bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-rose-700">{it.blockedDispatches} dispatches blocked</span>
                </li>
              ))}
            </ul>
            <ScopeNote className="mt-3">{inv.dispatch.blockedReason}</ScopeNote>
          </SectionCard>

          <SectionCard title="Returns, damage & purchase pipeline" description="Reverse flows and incoming stock — kept operational.">
            <div className="mb-4 grid grid-cols-3 gap-2">
              <StatTile value={`₹${inv.returnsCr.toFixed(2)} Cr`} label="Returns" />
              <StatTile value={`₹${inv.damagedCr.toFixed(2)} Cr`} label="Damaged stock" />
              <StatTile value={String(inv.purchasePipeline.openPOs)} label={`Open POs (${inv.purchasePipeline.awaitingGoods} awaiting goods)`} />
            </div>
            <ColumnChart
              points={inv.warehouses.map((w) => ({ label: w.name.replace(" DC", ""), value: w.valueCr }))}
              unit="₹ Cr"
              color="#7C3AED"
              ariaLabel={`Stock value by warehouse: ${inv.warehouses.map((w) => `${w.name} ₹${w.valueCr} Cr`).join(", ")}`}
              summary={`Finance-aligned valuation by warehouse — Mumbai DC ₹${inv.warehouses[0]?.valueCr.toFixed(2)} Cr leads. This chart is the financial view; utilization above is the operational view.`}
              height={190}
            />
          </SectionCard>
        </div>

        <AnalyticsAsOf asOfLabel={data.asOfLabel} />
      </div>
    </div>
  );
}
