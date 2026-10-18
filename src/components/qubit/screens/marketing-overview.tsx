"use client";

import * as React from "react";
import {
  ArrowUpRight,
  CircleDollarSign,
  Filter,
  IndianRupee,
  Megaphone,
  Radar,
  Target,
  TriangleAlert,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard, StatusBadge } from "../primitives";
import {
  AsOfStrip,
  CHART_TICK,
  EXEC_COLORS,
  ExecErrorBanner,
  ExecSkeleton,
  ExecutiveGate,
  FreshnessBadge,
  PeriodChip,
  formatKpiValue,
  useExecutiveSection,
  useExecutiveNav,
} from "../executive/parts";
import { formatINR, formatPct, formatRupees } from "@/lib/qubit/executive-data";
import type { MarketingData } from "@/lib/qubit/executive-data";

// ============================================================
// Screen 64 · Marketing Overview — business impact, not a
// social-media dashboard. CRITICAL data-quality story: the
// marketing source is delayed (sync since 04:00 IST), figures
// are final as of 31 Oct and November is rendered as "pending
// sync", never as a zero that reads like a demand collapse.
// Every number comes from /api/executive?section=marketing.
// ============================================================

interface ExecPeriod {
  label: string;
  window: string;
  asOfLabel: string;
}

interface MarketingPayload {
  period: ExecPeriod;
  asOfLabel: string;
  marketing: MarketingData;
}

export function MarketingOverviewScreen() {
  const navigate = useExecutiveNav();
  const { data, loading, error, forbidden, reload } = useExecutiveSection<MarketingPayload>("marketing");
  const marketing = data?.marketing ?? null;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "CEO Command Center" }, { label: "Marketing Overview" }]}
        title="Marketing Overview"
        description="Marketing as pipeline contribution — leads, MQLs, sourced pipeline and spend against plan."
        meta={
          data ? (
            <div className="flex flex-wrap items-center gap-2">
              <FreshnessBadge freshness={marketing!.freshness} className="px-2.5 py-1 text-xs" />
              <PeriodChip label={data.period.label} window={data.period.window} />
            </div>
          ) : null
        }
      />

      <ExecutiveGate screenName="Marketing Overview">
        {error && !forbidden && <ExecErrorBanner message={error} onRetry={reload} />}

        {loading && !data && <ExecSkeleton rows={4} />}

        {!loading && !error && data && marketing && marketing.channels.length > 0 && (
          <MarketingBody marketing={marketing} asOfLabel={data.asOfLabel} period={data.period} navigate={navigate} />
        )}

        {!loading && !error && data && marketing && marketing.channels.length === 0 && (
          <SectionCard>
            <EmptyState
              icon={<Radar />}
              title="No marketing data for this period"
              message="Channel and campaign figures appear once the marketing source completes its sync."
            />
          </SectionCard>
        )}
      </ExecutiveGate>
    </div>
  );
}

function MarketingBody({
  marketing,
  asOfLabel,
  period,
  navigate,
}: {
  marketing: MarketingData;
  asOfLabel: string;
  period: ExecPeriod;
  navigate: (screen: Parameters<ReturnType<typeof useExecutiveNav>>[0], params?: { kpiId?: string }) => void;
}) {
  const qtd = marketing.qtd;
  const contributionGap = qtd.contributionTarget - qtd.contributionPct;
  const delayed = marketing.freshness.status === "delayed" || marketing.freshness.status === "stale";
  const finalTrend = marketing.trend.filter((t) => t.final);

  return (
    <div className="space-y-5">
      {/* Data-quality note — delayed source surfaced inline, never looks live (spec §7) */}
      {delayed && marketing.freshness.detail && (
        <div
          className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3"
          role="note"
          aria-label="Marketing data freshness warning"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <p className="text-xs leading-relaxed text-amber-800">
            <span className="font-semibold">{marketing.freshness.label}.</span> {marketing.freshness.detail} Read every figure
            below as a 31-Oct baseline.
          </p>
        </div>
      )}

      {/* Business-impact tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={<Radar />} label="Leads (QTD)" value={formatKpiValue("count", qtd.leads)} context="All sources, quarter to date" />
        <Tile icon={<Filter />} label="MQLs" value={formatKpiValue("count", qtd.mql)} context={`${((qtd.mql / Math.max(qtd.leads, 1)) * 100).toFixed(1)}% of leads`} />
        <Tile icon={<Target />} label="SQLs" value={formatKpiValue("count", qtd.sql)} context={`${((qtd.sql / Math.max(qtd.mql, 1)) * 100).toFixed(1)}% of MQLs`} />
        <Tile
          icon={<CircleDollarSign />}
          label="Sourced pipeline"
          value={formatINR(qtd.sourcedPipeline)}
          context="Marketing-sourced qualified pipeline"
          tone="accent"
        />
        <Tile icon={<CircleDollarSign />} label="Spend (QTD)" value={formatINR(qtd.spend)} context="Marketing programs, quarter to date" />
        <Tile icon={<IndianRupee />} label="Cost per lead" value={formatRupees(qtd.cpl)} context="Blended across all channels" />
        <Tile
          icon={<Megaphone />}
          label="Pipeline contribution"
          value={formatPct(qtd.contributionPct, 0)}
          context={`${formatPct(qtd.contributionTarget, 0)} target · ${contributionGap} pts below plan`}
          badge={<StatusBadge status="Watch" size="sm" />}
          tone="alert"
          className="sm:col-span-2 lg:col-span-1"
        >
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${qtd.contributionPct}% of the ${qtd.contributionTarget}% contribution target`}>
            <div
              className="h-full rounded-full bg-amber-500"
              style={{ width: `${Math.min(100, (qtd.contributionPct / Math.max(qtd.contributionTarget, 1)) * 100)}%` }}
            />
          </div>
        </Tile>
      </div>

      {/* Trend — final months only */}
      <SectionCard
        title="Leads and MQL trend"
        description="Final months only. November is pending the marketing source sync and is deliberately not drawn as a zero."
      >
        <TrendChart data={finalTrend} delayed={delayed} />
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          {finalTrend.length > 0
            ? `Showing ${finalTrend.map((t) => t.month).join(" and ")} — the last months with final figures (as of 31 Oct).`
            : "No final months available yet."}{" "}
          {delayed ? "November pending source sync — do not read the gap as a demand drop." : ""}
        </p>
      </SectionCard>

      {/* Channel performance */}
      <SectionCard
        title="Channel performance"
        description="Quarter to date, as of 31 Oct. Callouts mark the channels that matter to the business case."
      >
        <div className="-mx-4 overflow-x-auto md:-mx-5">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <caption className="sr-only">Marketing channel performance: leads, MQLs, cost per lead and sourced pipeline</caption>
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th scope="col" className="px-4 py-2.5 font-semibold md:px-5">Channel</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold md:px-5">Leads</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold md:px-5">MQLs</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold md:px-5">CPL</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold md:px-5">Sourced pipeline</th>
                <th scope="col" className="px-4 py-2.5 font-semibold md:px-5">Read</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const maxCpl = Math.max(...marketing.channels.map((x) => x.cpl));
                const maxPipelinePerLead = Math.max(...marketing.channels.map((x) => x.sourcedPipeline / Math.max(x.leads, 1)));
                return marketing.channels.map((c) => {
                  const highestPipelinePerLead = c.sourcedPipeline / Math.max(c.leads, 1) === maxPipelinePerLead;
                  const volumeEngine = c.leads === Math.max(...marketing.channels.map((x) => x.leads));
                  const callout = volumeEngine
                    ? { tone: "border-blue-200 bg-blue-50 text-blue-700", dot: "bg-blue-600", text: "Volume engine — most leads" }
                    : highestPipelinePerLead
                      ? {
                          tone: "border-violet-200 bg-violet-50 text-violet-700",
                          dot: "bg-violet-500",
                          text: c.cpl === maxCpl ? "Highest pipeline per lead, despite highest CPL" : "Highest pipeline per lead",
                        }
                      : null;
                  return (
                    <tr key={c.channel} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <th scope="row" className="px-4 py-3 text-left font-medium text-slate-800 md:px-5">{c.channel}</th>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700 md:px-5">{c.leads.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700 md:px-5">{c.mqls.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700 md:px-5">{formatRupees(c.cpl)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-800 md:px-5">{formatINR(c.sourcedPipeline)}</td>
                      <td className="px-4 py-3 md:px-5">
                        {callout ? (
                          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", callout.tone)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", callout.dot)} aria-hidden /> {callout.text}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{marketing.insights[0]} {marketing.insights[1]}</p>
      </SectionCard>

      {/* Campaigns */}
      <SectionCard title="Campaigns" description="Named campaigns this quarter — roll-up view, reviewed with the Marketing Head.">
        <div className="grid gap-3 md:grid-cols-3">
          {marketing.campaigns.map((camp) => {
            const underperforming = camp.note.startsWith("Underperforming");
            return (
              <article
                key={camp.name}
                className={cn(
                  "qubit-card flex h-full flex-col p-4",
                  underperforming && "border-amber-300 bg-amber-50/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[13.5px] font-semibold leading-snug text-slate-800">{camp.name}</h3>
                  <StatusBadge status={camp.status} size="sm" />
                </div>
                <dl className="mt-3 flex gap-6">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-slate-400">Leads</dt>
                    <dd className="text-[15px] font-semibold tabular-nums text-slate-900">{camp.leads.toLocaleString("en-IN")}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-slate-400">Pipeline</dt>
                    <dd className="text-[15px] font-semibold tabular-nums text-slate-900">{formatINR(camp.pipeline)}</dd>
                  </div>
                </dl>
                <p className={cn("mt-3 text-xs leading-relaxed", underperforming ? "font-medium text-amber-800" : "text-slate-500")}>
                  {camp.note}
                </p>
              </article>
            );
          })}
        </div>
      </SectionCard>

      {/* Cross-links */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <button
          type="button"
          onClick={() => navigate("kpi-drilldown", { kpiId: "kpi-mkt" })}
          className="group/link inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700"
        >
          Investigate contribution KPI
          <ArrowUpRight
            className="h-3.5 w-3.5 transition-transform duration-150 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={() => navigate("finance-snapshot")}
          className="group/link inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700"
        >
          Finance budget variance
          <ArrowUpRight
            className="h-3.5 w-3.5 transition-transform duration-150 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
            aria-hidden
          />
        </button>
      </div>

      <AsOfStrip
        asOfLabel={asOfLabel}
        note={
          delayed
            ? `Marketing figures are final as of 31 Oct — the source sync has been delayed since 04:00 IST (${period.label}).`
            : `Marketing reporting period: ${period.label} (${period.window}).`
        }
      />
    </div>
  );
}

// ---------- local pieces ----------

function Tile({
  icon,
  label,
  value,
  context,
  badge,
  tone = "default",
  className,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  context: string;
  badge?: React.ReactNode;
  tone?: "default" | "alert" | "accent";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className={cn("qubit-card qubit-card-hover flex h-full flex-col p-4", tone === "alert" && "border-amber-200", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-slate-500">
          <span className="qubit-icon-tile qubit-icon-tile-accent h-5 w-5 shrink-0 [&_svg]:h-3 [&_svg]:w-3" aria-hidden>
            {icon}
          </span>
          <span className="truncate">{label}</span>
        </h3>
        {badge}
      </div>
      <p
        className={cn(
          "mt-2 text-[24px] font-bold leading-none tracking-tight tabular-nums",
          tone === "alert" ? "text-amber-700" : tone === "accent" ? "text-blue-700" : "text-slate-900",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{context}</p>
      {children}
    </article>
  );
}

function TrendChart({ data, delayed }: { data: MarketingData["trend"]; delayed: boolean }) {
  const config = {
    leads: { label: "Leads", color: EXEC_COLORS.primary },
    mql: { label: "MQLs", color: EXEC_COLORS.teal },
  } satisfies ChartConfig;

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Radar />}
        title="No final months to chart"
        message="The marketing source has not reported final figures yet — the trend appears after the sync completes."
        className="py-8"
      />
    );
  }

  return (
    <ChartContainer
      config={config}
      role="img"
      aria-label={`Bar chart of leads and MQLs for the final months ${data.map((t) => t.month).join(" and ")}${delayed ? "; November is pending the source sync and is not shown" : ""}`}
      className={cn("h-56 w-full md:h-64", CHART_TICK)}
    >
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={4}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} interval={0} tick={{ fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend verticalAlign="bottom" content={<ChartLegendContent />} />
        <Bar dataKey="leads" fill="var(--color-leads)" radius={[3, 3, 0, 0]} maxBarSize={44} />
        <Bar dataKey="mql" fill="var(--color-mql)" radius={[3, 3, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ChartContainer>
  );
}
