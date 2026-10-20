"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "../page-header";
import { SectionCard, StatTile } from "../primitives";
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
import type { Freshness, PeopleData } from "@/lib/qubit/executive-data";

// ============================================================
// Screen 272 · HR Analytics — permission-controlled, privacy-safe
// (spec §14). Aggregated counts only: salary, payroll, bank data,
// performance details, personal documents and candidate data are
// excluded from the analytics layer by policy — enforced on the
// server, stated on the screen. Never a surveillance dashboard.
// ============================================================

interface HrAnalyticsPayload {
  asOfLabel: string;
  people: PeopleData;
  definitions: { headcount: { id: string; name: string; definition: string; calc: string; source: string; period: string; owner: string; caution?: string } | null; attrition: { id: string; name: string; definition: string; calc: string; source: string; period: string; owner: string; caution?: string } | null };
  freshness: Freshness;
  privacyNotice: string;
  excludedFields: string[];
}

export function HrAnalyticsScreen() {
  const { data, loading, error, reload } = useAnalyticsSection<HrAnalyticsPayload>("hr");

  if (loading) return <div className="mx-auto max-w-6xl"><PageHeader crumbs={[{ label: "Analytics" }, { label: "HR Analytics" }]} title="HR Analytics" /> <AnalyticsSkeleton rows={5} /></div>;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader crumbs={[{ label: "Analytics" }, { label: "HR Analytics" }]} title="HR Analytics" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-sm font-medium text-amber-900">{error}</p>
          <button type="button" onClick={reload} className="mt-3 text-[12.5px] font-medium text-amber-900 underline">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const p = data.people;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "HR Analytics" }]}
        title="HR Analytics"
        description="Aggregated, privacy-safe people analytics — workforce health without exposing any individual."
        meta={<SourceLine system="HR registry (aggregated)" freshness={data.freshness} />}
        actions={<button type="button" onClick={reload} className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700">Refresh</button>}
      />

      <div className="space-y-5">
        {/* Privacy contract — explicit, not implied */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900"><Lock className="h-3.5 w-3.5 text-slate-500" aria-hidden /> Privacy-safe aggregation only</p>
          <p className="mt-1 text-xs text-muted-foreground">{data.privacyNotice}</p>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Never present in analytics</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {data.excludedFields.map((x) => (
              <li key={x} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-medium text-slate-500">{x}</li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="qubit-card p-4">
            <MetricDef metric={data.definitions.headcount} />
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">{p.headcount.total.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Net added since April: +{p.headcount.netAdded}</p>
          </article>
          <article className="qubit-card p-4">
            <MetricDef metric={data.definitions.attrition} label="Attrition (annualized)" />
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">{p.attrition.annualizedPct}%</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Target {p.attrition.targetPct}% — above target</p>
          </article>
          <article className="qubit-card p-4">
            <p className="text-[13px] font-medium text-slate-500">Attendance</p>
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">{p.attendancePct}%</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Aggregated company-wide</p>
          </article>
          <article className="qubit-card p-4">
            <p className="text-[13px] font-medium text-slate-500">Hiring</p>
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">{p.hiring.openPositions}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Open positions · {p.hiring.offersInFlight} offers in flight</p>
          </article>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SectionCard title="Headcount & movement trend" description="Monthly headcount with hires and exits (aggregate counts only).">
            <TrendChart
              points={p.trend.map((t) => ({ label: t.month, value: t.headcount }))}
              unit="employees"
              color="#059669"
              ariaLabel={`Headcount trend: ${p.trend.map((t) => `${t.month} ${t.headcount}`).join(", ")}`}
              summary={`Headcount grew from ${p.trend[0]?.headcount ?? 0} (Apr) to ${p.headcount.total.toLocaleString("en-IN")} (Nov). Monthly hires ${Math.min(...p.trend.map((t) => t.hires))}–${Math.max(...p.trend.map((t) => t.hires))}; monthly exits ${Math.min(...p.trend.map((t) => t.exits))}–${Math.max(...p.trend.map((t) => t.exits))}.`}
            />
            <ScopeNote className="mt-2">Exits rose from {p.trend[0]?.exits ?? 0} (Apr) to {p.trend[p.trend.length - 1]?.exits ?? 0} (Nov) while hires held flat — the same observation recorded in the People insights.</ScopeNote>
          </SectionCard>

          <SectionCard title="Recruitment funnel" description="Aggregate stage counts — candidate identities never enter analytics.">
            <FunnelView
              stages={p.hiring.funnel.map((s) => ({ stage: s.stage, count: s.count, valueCr: null, note: "Aggregate" }))}
              ariaLabel={`Recruitment funnel: ${p.hiring.funnel.map((s) => `${s.stage} ${s.count}`).join(", ")}`}
            />
            <ScopeNote className="mt-3">Time-to-fill {p.hiring.avgTimeToFillDays} days vs {p.hiring.timeToFillTarget}-day target. This is an aggregated operational metric — not linked to any candidate record.</ScopeNote>
          </SectionCard>

          <SectionCard title="Attrition by department" description="Annualized % with FYTD exits — department-level aggregates only.">
            <BarList
              ariaLabel={`Attrition by department: ${p.attrition.byDept.map((d) => `${d.department} ${d.pct}%`).join(", ")}`}
              items={p.attrition.byDept.map((d) => ({ label: d.department, value: d.pct, hint: `${d.exitsQtd} exits FYTD`, tone: d.pct > p.attrition.targetPct ? "bg-amber-500" : "bg-emerald-500" }))}
              unit="%"
              max={20}
            />
            <ScopeNote className="mt-3">Departments above the {p.attrition.targetPct}% target are amber. Small exit counts (n &lt; 3) make percentages volatile — read them with the FYTD exit counts, not alone.</ScopeNote>
          </SectionCard>

          <SectionCard title="Headcount distribution" description="Employees on roll by department.">
            <ColumnChart
              points={p.distribution.map((d) => ({ label: d.department.slice(0, 10), value: d.count }))}
              unit="employees"
              ariaLabel={`Distribution: ${p.distribution.map((d) => `${d.department} ${d.count}`).join(", ")}`}
              summary={`${p.distribution.map((d) => `${d.department}: ${d.count}`).join("; ")}. Individual-level detail lives in the People module (50–54), scoped by role — never here.`}
              height={230}
            />
          </SectionCard>
        </div>

        <SectionCard title="Recorded people insights" description="From the canonical HR review — stated observations, not fabricated scores.">
          <ul className="space-y-2.5">
            {p.insights.map((i) => (
              <li key={i.title} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <p className="text-[13px] font-medium text-slate-900">{i.title} <span className={`ml-1.5 rounded-full border px-1.5 py-px text-[10px] font-semibold ${i.level === "High" ? "border-rose-100 bg-rose-50 text-rose-700" : "border-amber-100 bg-amber-50 text-amber-700"}`}>{i.level}</span></p>
                <p className="mt-0.5 text-xs text-muted-foreground">{i.detail}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <AnalyticsAsOf asOfLabel={data.asOfLabel} />
      </div>
    </div>
  );
}
