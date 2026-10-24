"use client";

import * as React from "react";
import { ArrowUpRight, ClipboardCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiInsight, ExecutiveOverviewPayload } from "@/lib/qubit/executive-data";
import { PageHeader } from "../page-header";
import { ArrowLink, EmptyState, SectionCard } from "../primitives";
import {
  AsOfStrip,
  AttentionItem,
  DomainCard,
  ExecErrorBanner,
  ExecSkeleton,
  ExecutiveGate,
  KpiCard,
  PeriodChip,
  useExecutiveNav,
  useExecutiveSection,
} from "../executive/parts";

// ============================================================
// Screen 59 · CEO Overview — the primary executive landing page.
// Answers "How is Qubit One performing right now?" with a clear
// hierarchy, not a wall of charts: one health summary band, the
// six company KPIs, executive attention items, the business
// domain band and an AI insight preview. Every number comes from
// /api/executive?section=overview — the same canonical figures
// the domain screens show (spec §9). No AI input box, no fake
// generation: the insight preview is read-only and deep-links
// into Screen 70.
// ============================================================

type OverviewPayload = ExecutiveOverviewPayload & { asOfLabel: string };

export function CeoOverviewScreen() {
  return (
    <ExecutiveGate screenName="CEO Overview">
      <OverviewBody />
    </ExecutiveGate>
  );
}

function OverviewBody() {
  const navigate = useExecutiveNav();
  const { data, loading, error, reload } = useExecutiveSection<OverviewPayload>("overview");

  const payload = data;
  const criticalAlerts = (payload?.alerts ?? []).filter((a) => a.severity === "Critical").length;
  const pendingDecisions = payload?.approvals.length ?? 0;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "CEO Command Center" }, { label: "CEO Overview" }]}
        title="CEO Overview"
        description="How is Qubit One performing right now — company health, the KPIs that define the quarter, what needs your attention, and the decisions waiting on your authority."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={reload}
            aria-label="Reload executive overview"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
          </Button>
        }
      />

      {error && <ExecErrorBanner message={error} onRetry={reload} />}

      {loading && <ExecSkeleton rows={4} />}

      {!loading && !payload && !error && (
        <div className="qubit-card">
          <EmptyState
            title="No overview data available"
            message="The executive overview returned nothing for this period. Retry, or check the domain freshness indicators on the source screens."
          />
        </div>
      )}

      {!loading && payload && (
        <div className="space-y-4">
          {/* ——— Company health summary ——— */}
          <section className="qubit-card p-4 md:p-5" aria-label="Company health summary">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <PeriodChip label={payload.period.label} window={payload.period.window} />
                  <span className="text-xs text-slate-400">As of {payload.asOfLabel}</span>
                </div>
                <h2 className="mt-3 max-w-2xl text-[17px] font-semibold leading-snug tracking-tight text-slate-900">
                  Resilient H1 with revenue timing the pressure — two enterprise deals slipped into December.
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">{payload.period.monthLabel}</p>
              </div>
              <div className="flex shrink-0 gap-3">
                <HealthCount value={criticalAlerts} label={criticalAlerts === 1 ? "Critical alert" : "Critical alerts"} tone={criticalAlerts > 0 ? "alert" : "calm"} />
                <HealthCount value={pendingDecisions} label={pendingDecisions === 1 ? "Decision pending" : "Decisions pending"} tone="calm" />
              </div>
            </div>
          </section>

          {/* ——— Primary KPI area ——— */}
          <SectionCard
            title="Company KPIs"
            description="The numbers that define the quarter — investigate any KPI down to its underlying records."
          >
            {payload.kpis.length === 0 ? (
              <EmptyState
                title="No KPIs published for this period"
                message="Executive KPIs appear here once the domain sources report for Q3 FY27."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {payload.kpis.map((kpi) => (
                  <KpiCard key={kpi.id} kpi={kpi} onDrill={() => navigate("kpi-drilldown", { kpiId: kpi.id })} />
                ))}
              </div>
            )}
          </SectionCard>

          {/* ——— Executive attention ——— */}
          <SectionCard
            title="Executive attention"
            description="Highest-signal items across domains — each opens the domain view where it is tracked."
            actions={<ArrowLink onClick={() => navigate("executive-alerts")}>View all alerts</ArrowLink>}
          >
            {payload.alerts.length === 0 && payload.approvals.length === 0 ? (
              <EmptyState
                title="Nothing needs your attention"
                message="No active executive alerts and no decisions waiting on your authority."
              />
            ) : (
              <div>
                {payload.alerts.map((alert) => (
                  <AttentionItem
                    key={alert.id}
                    severity={alert.severity}
                    title={alert.title}
                    context={alert.whyItMatters}
                    meta={alert.whenText}
                    onOpen={() => navigate(alert.drillScreen, alert.drillParams)}
                  />
                ))}
                <ApprovalsRow approvals={payload.approvals} onOpen={() => navigate("executive-approvals")} />
              </div>
            )}
          </SectionCard>

          {/* ——— Business domain summary ——— */}
          <SectionCard
            title="Business domains"
            description="One health line per domain — click through to the full domain screen. Delayed sources are labelled, never shown as live."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {payload.domains.map((domain) => (
                <DomainCard
                  key={domain.id}
                  name={domain.name}
                  headline={domain.headline}
                  sub={domain.sub}
                  health={domain.health}
                  freshness={domain.freshness}
                  attention={domain.attention}
                  onOpen={() => navigate(domain.screen)}
                />
              ))}
            </div>
          </SectionCard>

          {/* ——— AI executive insight preview ——— */}
          <SectionCard
            title="AI executive insights"
            description="Evidence-based interpretation of authorized company data — read-only here, opened in full in CEO AI Insights."
            actions={<ArrowLink onClick={() => navigate("ceo-ai-insights")}>Open CEO AI Insights</ArrowLink>}
          >
            {payload.insights.length === 0 ? (
              <EmptyState
                title="No insights generated yet"
                message="AI insights are produced from the authorized company data on a schedule — none are pending for this period."
              />
            ) : (
              <ul className="divide-y" aria-label="AI executive insight preview">
                {payload.insights.map((insight) => (
                  <li key={insight.id}>
                    <InsightPreviewRow insight={insight} onOpen={() => navigate("ceo-ai-insights", { insightId: insight.id })} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <AsOfStrip
            asOfLabel={payload.asOfLabel}
            note="Each domain card carries its own freshness indicator — delayed sources are labelled, never shown as live."
          />
        </div>
      )}
    </div>
  );
}

// ---------- company health count tile ----------

function HealthCount({ value, label, tone }: { value: number; label: string; tone: "alert" | "calm" }) {
  return (
    <div className="min-w-[7.5rem] rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <p
        className={cn(
          "text-[26px] font-bold leading-none tracking-tight tabular-nums",
          tone === "alert" ? "text-red-700" : "text-slate-900",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ---------- compact pending-decisions row inside attention ----------

function ApprovalsRow({
  approvals,
  onOpen,
}: {
  approvals: ExecutiveOverviewPayload["approvals"];
  onOpen: () => void;
}) {
  if (approvals.length === 0) {
    return (
      <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
        No executive decisions are waiting on your authority.
      </p>
    );
  }
  const titles = approvals.slice(0, 2).map((a) => a.title);
  const extra = approvals.length - titles.length;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
      <span className="qubit-icon-tile qubit-icon-tile-accent h-9 w-9 shrink-0 [&_svg]:h-4 [&_svg]:w-4">
        <ClipboardCheck />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="text-[13.5px] font-medium text-slate-800">
          {approvals.length} decision{approvals.length === 1 ? "" : "s"} require{approvals.length === 1 ? "s" : ""} your authority
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {titles.join(" · ")}
          {extra > 0 ? ` · +${extra} more` : ""}
        </p>
      </button>
      <Button size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs" onClick={onOpen}>
        Open decisions
      </Button>
    </div>
  );
}

// ---------- AI insight preview row (read-only, no chat) ----------

function InsightPreviewRow({ insight, onOpen }: { insight: AiInsight; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open insight in CEO AI Insights: ${insight.title}`}
      className="group flex w-full items-start gap-3 py-3 text-left first:pt-0 last:pb-0"
    >
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {insight.category}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-slate-800 transition-colors group-hover:text-blue-700">
          {insight.title}
        </span>
        <span className="mt-0.5 block text-[11px] text-slate-400">
          Confidence {insight.confidence} · data as of {insight.dataAsOf}
        </span>
      </span>
      <ArrowUpRight
        className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-blue-600"
        aria-hidden
      />
    </button>
  );
}
