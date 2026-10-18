"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DOMAIN_FRESHNESS, type Kpi } from "@/lib/qubit/executive-data";
import { useQubitNav } from "../nav-context";
import { PageHeader } from "../page-header";
import { ArrowLink, EmptyState, SectionCard, StatusBadge } from "../primitives";
import {
  AsOfStrip,
  CHART_TICK,
  ContributionList,
  ExecErrorBanner,
  ExecSkeleton,
  ExecutiveGate,
  EXEC_COLORS,
  FreshnessBadge,
  TrendArrow,
  formatKpiValue,
  useExecutiveSection,
} from "../executive/parts";

// ============================================================
// Screen 71 · Company KPI Drilldown — focused executive
// investigation behind each KPI (deep-linked from Screen 59 via
// ?kpiId=). NOT a BI tool: definition, headline, trend,
// contributors, drivers and the authorization-aware drill path.
// Restricted drill levels are marked and carry NO fabricated
// data (spec §10). The comparison selector only re-derives the
// caption client-side from payload numbers — it never invents
// new series.
// ============================================================

interface KpisPayload {
  asOfLabel: string;
  kpis: Kpi[];
}

type ComparisonBasis = "prev-quarter" | "plan";

export function KpiDrilldownScreen() {
  return (
    <ExecutiveGate screenName="Company KPI Drilldown">
      <KpiDrilldownBody />
    </ExecutiveGate>
  );
}

function KpiDrilldownBody() {
  const nav = useQubitNav();
  const { data, loading, error, reload } = useExecutiveSection<KpisPayload>("kpis");

  const [selectedId, setSelectedId] = React.useState<string | null>(nav.params.kpiId ?? null);

  // Deep links re-focus the same screen with a new kpiId — re-apply on navKey bump.
  React.useEffect(() => {
    if (nav.params.kpiId) setSelectedId(nav.params.kpiId);
  }, [nav.params.kpiId, nav.navKey]);

  const kpis = data?.kpis ?? [];
  const kpi = kpis.find((k) => k.id === selectedId) ?? kpis[0] ?? null;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "CEO Command Center" }, { label: "KPI Drilldown" }]}
        title="Company KPI Drilldown"
        description="Focused investigation behind every executive KPI — definition, trend, contributors, drivers and the authorized drill path."
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={reload} aria-label="Reload KPI data">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
          </Button>
        }
      />

      {error && <ExecErrorBanner message={error} onRetry={reload} />}

      {loading && <ExecSkeleton rows={4} />}

      {!loading && !data && !error && (
        <div className="qubit-card">
          <EmptyState
            title="No KPI data available"
            message="The executive KPI catalog returned nothing for this period. Retry to reload it."
          />
        </div>
      )}

      {!loading && data && kpis.length === 0 && (
        <div className="qubit-card">
          <EmptyState
            title="No KPIs published"
            message="The executive KPI catalog is empty for this period — published KPIs appear here with their full drill path."
          />
        </div>
      )}

      {!loading && data && kpis.length > 0 && kpi && (
        <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* ——— KPI selector: vertical tabs on desktop, scroll chips on mobile ——— */}
          <div className="lg:sticky lg:top-4">
            <SectionCard
              title="Executive KPIs"
              description={`${kpis.length} company KPIs`}
              noPadding
              contentClassName="p-2"
            >
              <div
                role="tablist"
                aria-label="Executive KPI selector"
                className="qubit-scroll flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
              >
                {kpis.map((k) => {
                  const selected = k.id === kpi.id;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      role="tab"
                      id={`kpi-tab-${k.id}`}
                      aria-selected={selected}
                      aria-controls="kpi-panel"
                      onClick={() => setSelectedId(k.id)}
                      className={cn(
                        "flex shrink-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 lg:w-full",
                        selected
                          ? "border-blue-200 bg-blue-50 font-medium text-blue-800"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800",
                      )}
                    >
                      <span className="whitespace-nowrap lg:whitespace-normal">{k.name}</span>
                      <StatusBadge status={k.status} size="sm" />
                    </button>
                  );
                })}
              </div>
            </SectionCard>
          </div>

          {/* ——— Investigation panel ——— */}
          <div
            id="kpi-panel"
            role="tabpanel"
            aria-labelledby={`kpi-tab-${kpi.id}`}
            className="min-w-0 space-y-4"
          >
            <HeadlineCard kpi={kpi} />
            <DefinitionCard kpi={kpi} />
            <TrendCard kpi={kpi} />
            <div className="grid gap-4 md:grid-cols-2">
              <SectionCard title="Contributors" description="Latest reported split, in each contributor unit.">
                <ContributionList
                  items={kpi.contributors.map((c) => ({ label: c.label, value: c.value }))}
                  formatValue={(v) => formatKpiValue(kpi.contributors[0]?.unit ?? kpi.unit, v)}
                />
              </SectionCard>
              <SectionCard title="Drivers" description="What is moving this number right now.">
                <ul className="space-y-3">
                  {kpi.drivers.map((d) => (
                    <li key={d.label} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                      <p className="text-[13px] font-medium text-slate-800">{d.label}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{d.detail}</p>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </div>
            <DrillPathCard kpi={kpi} />

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <ArrowLink onClick={() => nav.navigate(kpi.screen)}>Open {kpi.domainLabel} screen</ArrowLink>
              <ArrowLink onClick={() => nav.navigate("ceo-overview")}>Back to CEO Overview</ArrowLink>
            </div>

            <AsOfStrip asOfLabel={data.asOfLabel} note="KPI freshness follows each domain source sync — see the indicator beside the KPI name." />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- headline: value · target · variance · trend · status · comparison ----------

function HeadlineCard({ kpi }: { kpi: Kpi }) {
  const [basis, setBasis] = React.useState<ComparisonBasis>("prev-quarter");

  const variancePct =
    kpi.variancePct ?? (kpi.target !== undefined ? ((kpi.value - kpi.target) / kpi.target) * 100 : null);
  const varianceLabel =
    variancePct === null ? "—" : `${variancePct > 0.05 ? "+" : variancePct < -0.05 ? "-" : "±"}${Math.abs(variancePct).toFixed(1)}%`;

  // Honest, client-side derived caption only — no invented series.
  const comparisonCaption =
    basis === "prev-quarter"
      ? kpi.comparisonText
      : kpi.target === undefined
        ? "No plan baseline is published for this KPI."
        : `${varianceLabel} against plan (${formatKpiValue(kpi.unit, kpi.target)})`;

  return (
    <section className="qubit-card p-4 md:p-5" aria-label={`${kpi.name} headline`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">{kpi.name}</h2>
        <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {kpi.domainLabel}
        </span>
        <FreshnessBadge freshness={DOMAIN_FRESHNESS[kpi.domain]} />
        <span className="ml-auto">
          <StatusBadge status={kpi.status} />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Current · {kpi.period}</p>
          <p className="mt-1 text-[30px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
            {formatKpiValue(kpi.unit, kpi.value)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Target</p>
          <p className="mt-1 text-[20px] font-semibold leading-none text-slate-700 tabular-nums">
            {kpi.target !== undefined ? formatKpiValue(kpi.unit, kpi.target) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Variance vs plan</p>
          <p className="mt-1 text-[20px] font-semibold leading-none text-slate-700 tabular-nums">{varianceLabel}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Trend</p>
          <div className="mt-1.5">
            <TrendArrow trendPct={kpi.trendPct} direction={kpi.direction} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 pt-3.5">
        <span className="text-xs font-medium text-slate-500" id="cmp-basis-label">
          Compare
        </span>
        <Select value={basis} onValueChange={(v) => setBasis(v as ComparisonBasis)}>
          <SelectTrigger
            aria-labelledby="cmp-basis-label"
            className="h-8 w-[236px] rounded-lg border-slate-200 bg-white text-xs shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="prev-quarter" className="text-xs">
              Same point previous quarter
            </SelectItem>
            <SelectItem value="plan" className="text-xs">
              Against plan
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[13px] font-medium text-slate-700 tabular-nums" aria-live="polite">
          {comparisonCaption}
        </p>
      </div>
    </section>
  );
}

// ---------- definition: same layout language as the KpiInfo popover, inline ----------

function DefinitionCard({ kpi }: { kpi: Kpi }) {
  return (
    <SectionCard title="Definition" description="What this number means, how it is calculated and where it comes from.">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Definition</p>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{kpi.definition}</p>
      <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 font-medium text-slate-400">Calc</dt>
          <dd className="text-slate-600">{kpi.calc}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 font-medium text-slate-400">Source</dt>
          <dd className="text-slate-600">{kpi.source}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 font-medium text-slate-400">Period</dt>
          <dd className="text-slate-600">{kpi.period}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 font-medium text-slate-400">Type</dt>
          <dd>
            <StatusBadge status={kpi.kind} size="sm" />
          </dd>
        </div>
      </dl>
    </SectionCard>
  );
}

// ---------- trend: MiniTrend pattern, taller (h-56) ----------

function TrendCard({ kpi }: { kpi: Kpi }) {
  const config: ChartConfig = {
    value: { label: kpi.name, color: EXEC_COLORS.primary },
    target: { label: "Target", color: EXEC_COLORS.slate },
  };
  const hasTarget = kpi.trendSeries.some((p) => p.target !== undefined);

  return (
    <SectionCard title="Trend" description={`${kpi.period} · actual against target`}>
      <ChartContainer
        config={config}
        role="img"
        aria-label={`Area chart: ${kpi.name} across ${kpi.period}, actual value against target`}
        className={cn("h-56 w-full", CHART_TICK)}
      >
        <AreaChart data={kpi.trendSeries} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={18} />
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          <ChartLegend verticalAlign="bottom" content={<ChartLegendContent />} />
          <Area dataKey="value" type="monotone" stroke={EXEC_COLORS.primary} strokeWidth={2} fill={EXEC_COLORS.primary} fillOpacity={0.08} dot={false} />
          {hasTarget && (
            <Area
              dataKey="target"
              type="monotone"
              stroke={EXEC_COLORS.slate}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="transparent"
              dot={false}
            />
          )}
        </AreaChart>
      </ChartContainer>
      <p className="mt-2 text-[11px] text-slate-400">
        Exact values remain available in the tooltip; the dashed series is the reference target for the same points.
      </p>
    </SectionCard>
  );
}

// ---------- drill path: authorization-aware vertical trail (spec §10) ----------

function DrillPathCard({ kpi }: { kpi: Kpi }) {
  return (
    <SectionCard
      title="Drill path"
      description={`Company to underlying records for ${kpi.domainLabel}. Restricted levels are marked and hold no data at executive authority.`}
    >
      <ol className="relative" aria-label={`Drill path for ${kpi.name}`}>
        {kpi.drill.map((level, idx) => {
          const last = idx === kpi.drill.length - 1;
          return (
            <li key={`${level.level}-${idx}`} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && <span aria-hidden className="absolute bottom-0 left-[7px] top-5 w-px bg-slate-200" />}
              <span
                aria-hidden
                className={cn(
                  "mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2",
                  level.authorized ? "border-blue-600 bg-white" : "border-slate-300 bg-slate-100",
                )}
              />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-slate-800">
                  <span>{level.level}</span>
                  {!level.authorized && <StatusBadge status="Restricted" size="sm" />}
                </p>
                <p className="text-[13px] text-slate-600">{level.entity}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{level.note}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}
