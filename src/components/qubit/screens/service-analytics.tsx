"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard, StatTile } from "../primitives";
import {
  AnalyticsAsOf,
  AnalyticsErrorBanner,
  AnalyticsSkeleton,
  BarList,
  MetricDef,
  ScopeNote,
  SourceLine,
  TrendChart,
  useAnalyticsSection,
} from "../analytics/parts";
import { metricById } from "@/lib/qubit/analytics-data";
import type { Freshness, FieldData, ServiceData } from "@/lib/qubit/executive-data";

// ============================================================
// Screen 273 · Service Analytics — tickets, SLA, response and
// resolution, engineer performance and visit completion, all read
// from the canonical Service and Field blocks (spec §15). The
// service desk stays authoritative; analytics never writes to it.
// ============================================================

interface ServiceAnalyticsPayload {
  asOfLabel: string;
  service: ServiceData;
  field: FieldData;
  definitions: { sla: { id: string; name: string; definition: string; calc: string; source: string; period: string; owner: string; caution?: string } | null };
  freshness: { service: Freshness; field: Freshness };
}

export function ServiceAnalyticsScreen() {
  const { data, loading, error, reload } = useAnalyticsSection<ServiceAnalyticsPayload>("service");

  if (loading) return <div className="mx-auto max-w-6xl"><PageHeader crumbs={[{ label: "Analytics" }, { label: "Service Analytics" }]} title="Service Analytics" /> <AnalyticsSkeleton rows={5} /></div>;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader crumbs={[{ label: "Analytics" }, { label: "Service Analytics" }]} title="Service Analytics" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-sm font-medium text-amber-900">{error}</p>
          <button type="button" onClick={reload} className="mt-3 text-[12.5px] font-medium text-amber-900 underline">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const s = data.service;
  const fl = data.field;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Service Analytics" }]}
        title="Service Analytics"
        description="Service health from the authoritative service desk — SLA, response, resolution and engineer performance."
        meta={<SourceLine system="Service desk · Field operations" freshness={data.freshness.service} />}
        actions={<button type="button" onClick={reload} className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700">Refresh</button>}
      />

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="qubit-card p-4">
            <p className="text-[13px] font-medium text-slate-500">Open tickets</p>
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">{s.tickets.open}</p>
            <p className="mt-1 text-[11px] text-rose-600">{s.tickets.openCritical} critical · {s.tickets.resolved30d} resolved (30d)</p>
          </article>
          <article className="qubit-card p-4">
            <MetricDef metric={data.definitions.sla} />
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">{s.sla.compliancePct}%</p>
            <p className="mt-1 text-[11px] text-amber-600">Target {s.sla.targetPct}% · {s.sla.breachedCritical} breached critical</p>
          </article>
          <article className="qubit-card p-4">
            <p className="text-[13px] font-medium text-slate-500">First response</p>
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">{s.times.firstResponseMin} min</p>
            <p className="mt-1 text-[11px] text-amber-600">Target {s.times.responseTargetMin} min · resolution {s.times.resolutionHours}h</p>
          </article>
          <article className="qubit-card p-4">
            <p className="text-[13px] font-medium text-slate-500">CSAT</p>
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">{s.csat.score}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{s.csat.responses.toLocaleString("en-IN")} responses (30d)</p>
          </article>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SectionCard title="Backlog trend" description="Weekly open tickets — the service desk is live (updated continuously).">
            <TrendChart
              points={s.tickets.backlogTrend.map((t) => ({ label: t.week, value: t.open }))}
              unit="open"
              color="#7C3AED"
              showTarget={false}
              ariaLabel={`Backlog trend: ${s.tickets.backlogTrend.map((t) => `${t.week} ${t.open} open`).join(", ")}`}
              summary={`Open backlog fell from ${s.tickets.backlogTrend[0]?.open ?? 0} (W40) to ${s.tickets.open} (W48) — ${s.tickets.resolved30d} resolved in the trailing 30 days.`}
            />
          </SectionCard>

          <SectionCard title="Field visit completion" description="This week's scheduled visits and completion against target.">
            <div className="mb-4 grid grid-cols-3 gap-2">
              <StatTile value={String(fl.visits.scheduledWeek)} label="Scheduled this week" />
              <StatTile value={String(fl.visits.completed)} label="Completed" />
              <StatTile value={String(fl.visits.delayed)} label="Delayed" />
            </div>
            <BarList
              ariaLabel={`Regional completion: ${fl.regions.map((r) => `${r.region} ${r.completionPct}%`).join(", ")}`}
              items={fl.regions.map((r) => ({ label: r.region, value: r.completionPct, hint: `${r.completed}/${r.visits} visits`, tone: r.completionPct >= fl.visits.targetPct ? "bg-emerald-500" : r.completionPct >= 70 ? "bg-blue-500" : "bg-rose-500" }))}
              unit="%"
              max={100}
            />
            <ScopeNote className="mt-3">Target {fl.visits.targetPct}% completion. North region at {fl.regions.find((r) => r.region === "North")?.completionPct}% is the recorded exception — see the Field Operations screen (67).</ScopeNote>
          </SectionCard>

          <SectionCard title="Engineer performance (30d)" description="Aggregate per engineer — resolved, CSAT, SLA. The service desk remains the system of record.">
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[380px] text-left text-[12.5px]">
                <caption className="sr-only">Engineer performance, trailing 30 days</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                    <th scope="col" className="py-2 pr-3 font-semibold">Engineer</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Resolved</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">CSAT</th>
                    <th scope="col" className="pl-3 py-2 text-right font-semibold">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {s.engineers.map((e) => (
                    <tr key={e.name} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-800">{e.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.resolved30d}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.csat}</td>
                      <td className={`pl-3 py-2 text-right font-semibold tabular-nums ${e.slaPct >= s.sla.targetPct ? "text-emerald-700" : "text-amber-700"}`}>{e.slaPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ScopeNote className="mt-3">First-time-fix and repeat-service rates are not yet retained by this source — they will appear when the service desk records them, not before. No metric is invented.</ScopeNote>
          </SectionCard>

          <SectionCard title="Critical accounts" description="Open issues on high-value accounts — the service health exceptions.">
            <ul className="space-y-2.5">
              {s.criticalAccounts.map((c) => (
                <li key={c.account} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-medium text-slate-900">{c.account}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${c.slaBreached ? "border-rose-100 bg-rose-50 text-rose-700" : "border-amber-100 bg-amber-50 text-amber-700"}`}>
                      {c.slaBreached ? "SLA breached" : "SLA at risk"}
                    </span>
                    <span className="ml-auto text-[11px] tabular-nums text-slate-400">{c.hoursOpen}h open · ₹{c.accountValue.toFixed(2)} Cr account</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.issue} — engineer {c.engineer}</p>
                </li>
              ))}
            </ul>
            <ScopeNote className="mt-3">Parts usage and service resolution categories are held by the service desk reports; they enter analytics when the source exposes them as aggregates.</ScopeNote>
          </SectionCard>
        </div>

        <AnalyticsAsOf asOfLabel={data.asOfLabel} />
      </div>
    </div>
  );
}
