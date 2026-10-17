"use client";

import {
  ClipboardList,
  PackageSearch,
  PackageX,
  RefreshCw,
  Truck,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import {
  EXEC_PERIOD,
  formatINR,
  type InventoryData,
} from "@/lib/qubit/executive-data";
import { PageHeader } from "../page-header";
import { ArrowLink, EmptyState, SectionCard, StatTile } from "../primitives";
import {
  AsOfStrip,
  CHART_TICK,
  ExecErrorBanner,
  ExecSkeleton,
  EXEC_COLORS,
  ExecutiveGate,
  FreshnessBadge,
  PeriodChip,
  useExecutiveSection,
  useExecutiveNav,
} from "../executive/parts";

// ============================================================
// Screen 66 · Inventory Overview — executive stock and supply
// visibility. EXCEPTIONS FIRST: stockouts that block dispatch
// lead the screen; value, movement and utilization follow.
// Every number comes from the canonical INVENTORY block via
// /api/executive?section=inventory (server-gated to executive
// authority). Not a SKU wall — SKU-level operations live in
// the operations workspace.
// ============================================================

interface InventorySectionPayload {
  asOf: number;
  asOfLabel: string;
  period: typeof EXEC_PERIOD;
  inventory: InventoryData;
}

const movementConfig = {
  inbound: { label: "Inbound", color: EXEC_COLORS.primary },
  outbound: { label: "Outbound", color: EXEC_COLORS.teal },
} satisfies ChartConfig;

/** utilization at/above this share of capacity is flagged near-capacity */
const NEAR_CAPACITY_PCT = 85;

export function InventoryOverviewScreen() {
  const navigate = useExecutiveNav();
  const { data, loading, error, reload } = useExecutiveSection<InventorySectionPayload>("inventory");
  const inventory = data?.inventory ?? null;

  return (
    <ExecutiveGate screenName="Inventory Overview">
      <div>
        <PageHeader
          crumbs={[{ label: "CEO Command Center" }, { label: "Inventory Overview" }]}
          title="Inventory Overview"
          description="Stock, dispatch and warehouse health — exceptions first, not a SKU wall."
          actions={
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={reload}
              aria-label="Reload inventory data"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
            </Button>
          }
          meta={
            inventory && data ? (
              <div className="flex flex-wrap items-center gap-2">
                <PeriodChip label={data.period.label} window={data.period.window} />
                <FreshnessBadge freshness={inventory.freshness} />
              </div>
            ) : undefined
          }
        />

        {error && <ExecErrorBanner message={error} onRetry={reload} />}

        {loading ? (
          <ExecSkeleton rows={6} />
        ) : !inventory || !data ? (
          !error && (
            <SectionCard>
              <EmptyState
                icon={<PackageSearch />}
                title="No inventory data available"
                message="The executive inventory section returned no data for this period. Retry the load — if it persists, the inventory source may be offline."
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
            {/* ── Exceptions first — stockouts blocking dispatch ── */}
            <ExceptionsLead inventory={inventory} onNavigate={navigate} />

            {/* ── Headline tiles ── */}
            <HeadlineTiles inventory={inventory} />

            {/* ── Charts: movement + utilization ── */}
            <div className="grid gap-3 lg:grid-cols-2">
              <MovementChart inventory={inventory} />
              <UtilizationBars inventory={inventory} />
            </div>

            {/* ── Warehouse table + purchase pipeline & losses ── */}
            <div className="grid gap-3 xl:grid-cols-2">
              <WarehouseTable inventory={inventory} />
              <PurchasePipeline inventory={inventory} />
            </div>

            <AsOfStrip
              asOfLabel={data.asOfLabel}
              note={`Source freshness: ${inventory.freshness.label}.`}
            />
          </div>
        )}
      </div>
    </ExecutiveGate>
  );
}

// ---------- exceptions lead — stockouts blocking dispatch ----------

/** the stockout blocking the most dispatches — anchors the recommended action */
function topBlockedItem(items: InventoryData["stockoutItems"]) {
  return items.reduce<InventoryData["stockoutItems"][number] | null>(
    (top, item) => (item.blockedDispatches > (top?.blockedDispatches ?? -1) ? item : top),
    null,
  );
}

function ExceptionsLead({
  inventory,
  onNavigate,
}: {
  inventory: InventoryData;
  onNavigate: ReturnType<typeof useExecutiveNav>;
}) {
  const { dispatch, stockoutItems } = inventory;
  const topBlocked = topBlockedItem(stockoutItems);
  return (
    <SectionCard
      title="Exceptions first — stockouts blocking dispatch"
      description="Zero-stock SKUs holding customer orders — review these before the headline numbers."
    >
      <div className="grid gap-3 md:grid-cols-3">
        {stockoutItems.map((item) => (
          <article
            key={item.sku}
            className="rounded-xl border border-red-200 bg-red-50/50 p-3.5"
            aria-label={`Stockout: ${item.name}, ${item.blockedDispatches} dispatches blocked`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                {item.sku}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-red-700 tabular-nums">
                <PackageX className="h-3 w-3" aria-hidden />
                {item.blockedDispatches} blocked
              </span>
            </div>
            <h3 className="mt-2 text-[13.5px] font-semibold text-slate-900">{item.name}</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {item.blockedDispatches} customer dispatch{item.blockedDispatches === 1 ? "" : "es"}{" "}
              cannot ship until stock lands.
            </p>
            <p className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <Truck className="h-3 w-3" aria-hidden /> ETA {item.eta}
            </p>
          </article>
        ))}
      </div>

      <div
        className="mt-3 flex flex-wrap items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3"
        role="note"
      >
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-relaxed text-amber-900">
            <span className="font-semibold tabular-nums">{dispatch.blocked} dispatches blocked</span>{" "}
            — dispatch on-time <span className="font-semibold tabular-nums">{dispatch.onTimePct}%</span>{" "}
            vs <span className="tabular-nums">{dispatch.onTimeTarget}%</span> target.{" "}
            {dispatch.blockedReason}
          </p>
          {topBlocked && (
            <p className="mt-1.5 text-xs leading-relaxed text-amber-800">
              <span className="font-semibold">Recommended:</span> expedite the {topBlocked.name}{" "}
              purchase order (ETA {topBlocked.eta}) and confirm partial-shipment options with
              affected accounts.
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <ArrowLink onClick={() => onNavigate("executive-alerts")}>Executive alerts</ArrowLink>
        <ArrowLink onClick={() => onNavigate("field-operations")}>Field Operations</ArrowLink>
      </div>
    </SectionCard>
  );
}

// ---------- headline tiles: value · stock health · dispatch ----------

function HeadlineTiles({ inventory }: { inventory: InventoryData }) {
  const { health, dispatch } = inventory;
  const flagged = health.lowStock + health.overstock + health.stockouts;
  const share = (n: number) => (flagged > 0 ? (n / flagged) * 100 : 0);
  const dispatchDelta = dispatch.onTimeTarget - dispatch.onTimePct;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <article className="qubit-card p-4 md:p-5" aria-label="Total inventory value">
        <h2 className="text-[12.5px] font-medium text-slate-500">Inventory value</h2>
        <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
          {formatINR(inventory.valueCr)}
        </p>
        <p className="mt-2 text-[13px] text-slate-600 tabular-nums">
          {inventory.skus.toLocaleString("en-IN")} SKUs across {inventory.warehouses.length}{" "}
          warehouses
        </p>
      </article>

      <article className="qubit-card p-4 md:p-5" aria-label="Stock health summary">
        <h2 className="text-[12.5px] font-medium text-slate-500">Stock health</h2>
        <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
          {flagged.toLocaleString("en-IN")}
        </p>
        <p className="mt-2 text-[13px] text-slate-600">
          SKUs flagged of {inventory.skus.toLocaleString("en-IN")}
        </p>
        <div
          className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100"
          role="img"
          aria-label={`Stock health: ${health.lowStock} low stock, ${health.overstock} overstock, ${health.stockouts} stockouts`}
        >
          <span className="h-full bg-amber-400" style={{ width: `${share(health.lowStock)}%` }} />
          <span className="h-full bg-slate-300" style={{ width: `${share(health.overstock)}%` }} />
          <span className="h-full bg-red-500" style={{ width: `${share(health.stockouts)}%` }} />
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[11px] text-slate-600">
          <li className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
            <span className="tabular-nums">{health.lowStock}</span> low stock
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden />
            <span className="tabular-nums">{health.overstock}</span> overstock
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
            <span className="tabular-nums">{health.stockouts}</span> stockouts
          </li>
        </ul>
      </article>

      <article className="qubit-card p-4 md:p-5" aria-label="Dispatch on-time performance">
        <h2 className="text-[12.5px] font-medium text-slate-500">Dispatch on-time</h2>
        <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
          {dispatch.onTimePct}%
        </p>
        <p className="mt-2 text-[13px] text-slate-600 tabular-nums">
          Target {dispatch.onTimeTarget}%
          {dispatchDelta > 0 ? (
            <>
              {" "}
              · <span className="font-medium text-amber-700">{dispatchDelta.toFixed(1)} pts below</span>
            </>
          ) : (
            " · at target"
          )}
        </p>
        <div
          className="relative mt-3.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="img"
          aria-label={`Dispatch on-time ${dispatch.onTimePct}% against ${dispatch.onTimeTarget}% target`}
        >
          <div
            className={cn("h-full rounded-full", dispatchDelta > 0 ? "bg-amber-500" : "bg-emerald-500")}
            style={{ width: `${Math.min(100, Math.max(4, dispatch.onTimePct))}%` }}
          />
          <span
            className="absolute inset-y-0 w-0.5 bg-slate-500"
            style={{ left: `${Math.min(100, dispatch.onTimeTarget)}%` }}
            aria-hidden
          />
        </div>
      </article>
    </div>
  );
}

// ---------- movement chart — inbound vs outbound bars ----------

function MovementChart({ inventory }: { inventory: InventoryData }) {
  const months = inventory.movement;
  const rangeLabel =
    months.length > 0 ? `${months[0].month}–${months[months.length - 1].month}` : "recent months";
  return (
    <SectionCard
      title="Stock movement"
      description={`Inbound vs outbound value (₹ Cr) — ${rangeLabel}`}
    >
      <ChartContainer
        config={movementConfig}
        role="img"
        aria-label={`Bar chart: inbound versus outbound stock movement in ₹ crore, ${rangeLabel}`}
        className={cn("h-48 w-full", CHART_TICK)}
      >
        <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barGap={2}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          <Bar dataKey="inbound" fill={EXEC_COLORS.primary} radius={[3, 3, 0, 0]} maxBarSize={26} />
          <Bar dataKey="outbound" fill={EXEC_COLORS.teal} radius={[3, 3, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ChartContainer>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: EXEC_COLORS.primary }} aria-hidden />
          Inbound
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: EXEC_COLORS.teal }} aria-hidden />
          Outbound
        </span>
      </div>
    </SectionCard>
  );
}

// ---------- warehouse utilization bars ----------

function UtilizationBars({ inventory }: { inventory: InventoryData }) {
  return (
    <SectionCard
      title="Warehouse utilization"
      description="Share of storage capacity in use — near-capacity sites flagged."
    >
      <ul className="space-y-3.5" aria-label="Utilization by warehouse">
        {inventory.warehouses.map((w) => {
          const flagged = w.utilizationPct >= NEAR_CAPACITY_PCT;
          return (
            <li key={w.name}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-[13px] font-medium text-slate-700">
                  {w.name}{" "}
                  <span className="text-[11px] font-normal text-slate-400">· {w.location}</span>
                </span>
                <span className="flex items-center gap-2">
                  {flagged && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
                      Near capacity
                    </span>
                  )}
                  <span className="text-[13px] font-semibold text-slate-900 tabular-nums">
                    {w.utilizationPct}%
                  </span>
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"
                role="img"
                aria-label={`${w.name} utilization ${w.utilizationPct}%`}
              >
                <div
                  className={cn("h-full rounded-full", flagged ? "bg-amber-500" : "bg-blue-600/85")}
                  style={{ width: `${Math.min(100, Math.max(4, w.utilizationPct))}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

// ---------- warehouse table ----------

const TH =
  "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500";
const TH_RIGHT = cn(TH, "text-right");

function WarehouseTable({ inventory }: { inventory: InventoryData }) {
  return (
    <SectionCard
      title="Warehouses"
      description="Capacity and stock value by distribution centre."
    >
      <div className="qubit-scroll overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-sm" aria-label="Warehouses by utilization and value">
          <thead>
            <tr className="border-b border-slate-200/90">
              <th scope="col" className={TH}>Warehouse</th>
              <th scope="col" className={TH}>Location</th>
              <th scope="col" className={TH_RIGHT}>Utilization</th>
              <th scope="col" className={TH_RIGHT}>Stock value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inventory.warehouses.map((w) => {
              const flagged = w.utilizationPct >= NEAR_CAPACITY_PCT;
              return (
                <tr key={w.name} className="transition-colors hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-3 py-2.5 text-[13.5px] font-medium text-slate-900">
                    {w.name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[13px] text-slate-600">
                    {w.location}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="inline-flex items-center justify-end gap-2">
                      {flagged && (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
                          Near capacity
                        </span>
                      )}
                      <span className="text-[13px] font-medium text-slate-700 tabular-nums">
                        {w.utilizationPct}%
                      </span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-[13px] font-medium text-slate-900 tabular-nums">
                    {formatINR(w.valueCr)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ---------- purchase pipeline & losses ----------

function PurchasePipeline({ inventory }: { inventory: InventoryData }) {
  const { purchasePipeline: pos } = inventory;
  return (
    <SectionCard
      title="Purchase pipeline & stock losses"
      description="Open purchasing against inbound need — and value leaking through returns and damage."
    >
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={<ClipboardList />} value={pos.openPOs.toLocaleString("en-IN")} label="Open purchase orders" />
        <StatTile icon={<Truck />} value={pos.awaitingGoods.toLocaleString("en-IN")} label="Awaiting goods receipt" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <span className="text-xs text-slate-500">Purchase pipeline value</span>
        <span className="text-[15px] font-semibold text-slate-900 tabular-nums">
          {formatINR(pos.valueCr)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatTile icon={<Undo2 />} value={formatINR(inventory.returnsCr)} label="Returns value" />
        <StatTile icon={<PackageX />} value={formatINR(inventory.damagedCr)} label="Damaged stock" />
      </div>
    </SectionCard>
  );
}
