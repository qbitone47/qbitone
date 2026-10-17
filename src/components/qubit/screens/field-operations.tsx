"use client";

import * as React from "react";
import {
  ArrowUpRight,
  CalendarCheck,
  Lock,
  RefreshCw,
  Timer,
  TriangleAlert,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EXEC_PERIOD,
  formatPct,
  type FieldData,
} from "@/lib/qubit/executive-data";
import type { ScreenId } from "@/lib/qubit/screens";
import {
  AsOfStrip,
  ExecErrorBanner,
  ExecSkeleton,
  ExecutiveGate,
  formatKpiValue,
  FreshnessBadge,
  KpiInfo,
  MiniTrend,
  PeriodChip,
  SeverityBadge,
  TrendArrow,
  useExecutiveNav,
  useExecutiveSection,
} from "../executive/parts";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard } from "../primitives";

// ============================================================
// Screen 67 · Field Operations — executive field execution.
// A region performance panel, not a map: at CEO altitude the
// honest view is completion vs target by region, the six-week
// visit trend and the two field exceptions with next steps.
// Every number comes from /api/executive?section=field —
// customer-identifying visit detail stays restricted.
// ============================================================

interface FieldPayload {
  period: typeof EXEC_PERIOD;
  asOfLabel: string;
  field: FieldData;
}

export function FieldOperationsScreen() {
  const navigate = useExecutiveNav();
  const { data, loading, error, reload } = useExecutiveSection<FieldPayload>("field");

  const field = data?.field ?? null;

  return (
    <ExecutiveGate screenName="Field Operations">
      <PageHeader
        crumbs={[
          { label: "CEO Command Center", onClick: () => navigate("ceo-overview") },
          { label: "Field Operations" },
        ]}
        title="Field Operations"
        description="Field execution across regions — engineer coverage, visit completion against standard and resolution health. Regional aggregates only; the map view stays with the Operations team."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {data && <PeriodChip label={data.period.label} window={data.period.window} />}
            {field && <FreshnessBadge freshness={field.freshness} />}
          </div>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={reload}
            aria-label="Reload field operations data"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
          </Button>
        }
      />

      {loading ? (
        <ExecSkeleton rows={4} className="max-w-3xl" />
      ) : error ? (
        <ExecErrorBanner message={error} onRetry={reload} />
      ) : !field ? (
        <SectionCard>
          <EmptyState
            icon={<Wrench />}
            title="No field data for this period"
            message="The field service source returned no aggregates for the reporting period. Retry, or check the Field Service connector status."
            action={
              <Button size="sm" variant="outline" className="h-8" onClick={reload}>
                Retry
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <FieldBody field={field} asOfLabel={data!.asOfLabel} onNavigate={navigate} />
      )}
    </ExecutiveGate>
  );
}

// ---------- body (rendered only once the payload is in hand) ----------

function FieldBody({
  field,
  asOfLabel,
  onNavigate,
}: {
  field: FieldData;
  asOfLabel: string;
  onNavigate: (screen: ScreenId) => void;
}) {
  const { visits, jobs } = field;
  const targetPct = visits.targetPct;
  const belowTarget = field.regions.filter((r) => r.completionPct < targetPct).length;
  const otherOpenJobs = jobs.unresolved - jobs.criticalUnresolved;
  const trend = field.travelTrend.map((w) => ({ label: w.week, value: w.visits }));
  const firstVisit = field.travelTrend[0]?.visits;
  const lastVisit = field.travelTrend[field.travelTrend.length - 1]?.visits;
  const currentWeek = field.travelTrend[field.travelTrend.length - 1]?.week;
  const growthPct =
    firstVisit && lastVisit !== undefined && firstVisit > 0
      ? ((lastVisit - firstVisit) / firstVisit) * 100
      : null;
  const onDutyPct =
    field.engineers.total > 0 ? (field.engineers.active / field.engineers.total) * 100 : 0;
  const completionAtRisk = visits.completionPct < targetPct;

  return (
    <div>
      {/* ---------- headline tiles ---------- */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FieldMetric
          icon={<Users />}
          label="Active engineers"
          value={field.engineers.active.toLocaleString("en-IN")}
          sub={
            <span>
              of <span className="tabular-nums">{field.engineers.total}</span> field engineers on roster
            </span>
          }
          footer={
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>On duty this week</span>
                <span className="font-medium tabular-nums text-slate-600">{formatPct(onDutyPct, 0)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600/85"
                  style={{ width: `${Math.min(100, Math.max(4, onDutyPct))}%` }}
                />
              </div>
            </div>
          }
        />

        <FieldMetric
          icon={<CalendarCheck />}
          label="Visits this week"
          value={visits.scheduledWeek.toLocaleString("en-IN")}
          badge={
            completionAtRisk ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden /> At Risk
              </span>
            ) : undefined
          }
          sub={
            <span>
              <span className="font-medium text-slate-700 tabular-nums">{visits.completed}</span> completed ·{" "}
              <span className="font-medium text-slate-700 tabular-nums">{visits.delayed}</span> delayed
            </span>
          }
          footer={
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  Completion vs {targetPct}% target
                  <KpiInfo
                    definition="Share of scheduled field visits completed in the current week, measured against the 90% completion standard."
                    calc={`${visits.completed} completed / ${visits.scheduledWeek} scheduled`}
                    source="Field Service · weekly roll-up"
                    period={currentWeek ? `Week ${currentWeek}` : undefined}
                  />
                </span>
                <span className={cn("font-medium tabular-nums", completionAtRisk ? "text-amber-700" : "text-emerald-700")}>
                  {formatPct(visits.completionPct, 0)}
                </span>
              </div>
              <div
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"
                role="img"
                aria-label={`Completion ${formatPct(visits.completionPct, 0)} against ${targetPct}% target`}
              >
                <div
                  className={cn("h-full rounded-full", completionAtRisk ? "bg-amber-500" : "bg-blue-600/85")}
                  style={{ width: `${Math.min(100, Math.max(4, visits.completionPct))}%` }}
                />
              </div>
            </div>
          }
        />

        <FieldMetric
          icon={<Wrench />}
          label="Unresolved jobs"
          value={jobs.unresolved.toLocaleString("en-IN")}
          sub={
            otherOpenJobs >= 0 ? (
              <span>
                <span className="font-medium text-amber-700 tabular-nums">{jobs.criticalUnresolved} critical</span> ·{" "}
                <span className="tabular-nums">{otherOpenJobs}</span> other open
              </span>
            ) : (
              <span>
                <span className="font-medium text-amber-700 tabular-nums">{jobs.criticalUnresolved} critical</span>
              </span>
            )
          }
        />

        <FieldMetric
          icon={<Timer />}
          label="Avg resolution"
          value={formatKpiValue("days", jobs.avgResolutionDays)}
          sub="Mean time from job raised to closed"
        />
      </div>

      {/* ---------- region performance + six-week trend ---------- */}
      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <SectionCard
          title="Region performance"
          description={`${belowTarget} of ${field.regions.length} regions below the ${targetPct}% completion standard this week`}
          className="lg:col-span-2"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {field.regions.map((r) => {
              const gap = r.completionPct - targetPct;
              const note = field.exceptions.find((e) => e.title.toLowerCase().includes(r.region.toLowerCase()));
              return (
                <article key={r.region} className="rounded-xl border border-slate-200/80 bg-white p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[13.5px] font-semibold text-slate-900">{r.region}</h3>
                    <span className="text-[11px] tabular-nums text-slate-500">
                      {r.engineers.toLocaleString("en-IN")} engineers
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs tabular-nums text-slate-600">
                    <span className="font-medium text-slate-800">{r.visits.toLocaleString("en-IN")}</span> visits ·{" "}
                    <span className="font-medium text-slate-800">{r.completed.toLocaleString("en-IN")}</span> completed ·{" "}
                    <span className={cn(r.delayed > 0 ? "font-medium text-amber-700" : "text-slate-500")}>
                      {r.delayed.toLocaleString("en-IN")} delayed
                    </span>
                  </p>

                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">Completion</span>
                      <span className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold tabular-nums text-slate-900">
                          {formatPct(r.completionPct, 0)}
                        </span>
                        <TrendArrow trendPct={gap} direction="up-good" suffix={`vs ${targetPct}% target`} />
                      </span>
                    </div>
                    <div
                      className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
                      role="img"
                      aria-label={`${r.region} completion ${formatPct(r.completionPct, 0)} against ${targetPct}% target`}
                    >
                      <div
                        className={cn("h-full rounded-full", r.completionPct < targetPct ? "bg-amber-500" : "bg-blue-600/85")}
                        style={{ width: `${Math.min(100, Math.max(4, r.completionPct))}%` }}
                      />
                      {/* target marker — where the standard sits */}
                      <span
                        className="absolute top-[-2px] h-[10px] w-px bg-slate-400"
                        style={{ left: `${Math.min(100, targetPct)}%` }}
                        aria-hidden
                      />
                    </div>
                  </div>

                  {note && (
                    <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800">
                      <TriangleAlert className="mt-px h-3 w-3 shrink-0" aria-hidden />
                      <span>
                        <span className="font-semibold">{note.title}</span> — {note.detail}
                      </span>
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          <p className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
            <Lock className="h-3 w-3 shrink-0" aria-hidden />
            Customer-identifying visit detail is restricted at executive level — regional aggregates only.
          </p>
        </SectionCard>

        <div className="grid gap-3 content-start">
          <SectionCard
            title="Visit volume"
            description={`Scheduled field visits per week${currentWeek ? ` — through week ${currentWeek}` : ""}`}
          >
            <MiniTrend
              data={trend}
              height={96}
              ariaLabel="Scheduled field visits per week over the last six weeks"
            />
            {growthPct !== null && firstVisit !== undefined && lastVisit !== undefined && (
              <p className="mt-2 text-[11.5px] tabular-nums text-slate-500">
                {firstVisit.toLocaleString("en-IN")} → {lastVisit.toLocaleString("en-IN")} visits per week over six
                weeks <span className="font-medium text-emerald-700">(+{formatPct(growthPct, 0)})</span>
              </p>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ---------- exceptions ---------- */}
      <SectionCard
        title="Exceptions"
        description="What needs executive attention this week — each with a recommended next step."
        className="mb-4"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {field.exceptions.map((ex) => {
            const isCritical = /critical/i.test(ex.title);
            const isNorth = /north/i.test(ex.title);
            return (
              <article key={ex.title} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={isCritical ? "High" : "Attention"} size="sm" />
                  <h3 className="text-[13.5px] font-semibold text-slate-900">{ex.title}</h3>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">{ex.detail}</p>
                <p className="mt-2.5 text-[12px] leading-relaxed text-slate-700">
                  <span className="font-semibold text-slate-800">Next step:</span>{" "}
                  {isNorth
                    ? "Commission the regional staffing review and publish a recovery schedule for the rescheduled visits."
                    : "Get a joint service recovery plan for the Zenith rollback before deciding the related pricing exception."}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-200/70 pt-2.5">
                  <ArrowLinkButton label="Executive alerts" onClick={() => onNavigate("executive-alerts")} />
                  {isNorth ? (
                    <ArrowLinkButton label="Sales Command Center" onClick={() => onNavigate("sales-command")} />
                  ) : (
                    <ArrowLinkButton label="Service Overview" onClick={() => onNavigate("service-overview")} />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </SectionCard>

      <AsOfStrip asOfLabel={asOfLabel} />
    </div>
  );
}

// ---------- small local parts ----------

function FieldMetric({
  icon,
  label,
  value,
  sub,
  badge,
  footer,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <article className="qubit-card flex h-full flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-slate-500">
          <span className="qubit-icon-tile qubit-icon-tile-accent h-7 w-7 shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5" aria-hidden>
            {icon}
          </span>
          <span className="truncate">{label}</span>
        </span>
        {badge}
      </div>
      <p className="mt-2.5 text-[26px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-slate-500">{sub}</p>}
      {footer && <div className="mt-auto pt-3.5">{footer}</div>}
    </article>
  );
}

function ArrowLinkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/link inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 transition-colors hover:text-blue-700"
    >
      {label}
      <ArrowUpRight
        className="h-3.5 w-3.5 transition-transform duration-150 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
        aria-hidden
      />
    </button>
  );
}
