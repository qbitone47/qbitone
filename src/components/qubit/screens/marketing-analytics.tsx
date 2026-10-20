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
  useAnalyticsSection,
} from "../analytics/parts";
import { metricById } from "@/lib/qubit/analytics-data";
import type { Freshness, MarketingData } from "@/lib/qubit/executive-data";

// ============================================================
// Screen 271 · Marketing Analytics — source-aware by design
// (spec §13): platform-reported metrics, Qubit-derived metrics
// and attributed business outcomes are labelled distinctly, and
// attribution is never invented. The delayed source state stays
// visible on the screen.
// ============================================================

interface MarketingAnalyticsPayload {
  asOfLabel: string;
  marketing: MarketingData;
  definitions: { cpl: { id: string; name: string; definition: string; calc: string; source: string; period: string; owner: string; caution?: string } | null; sourcedPipeline: { id: string; name: string; definition: string; calc: string; source: string; period: string; owner: string; caution?: string } | null };
  freshness: Freshness;
  metricLabels: Record<string, string>;
}

export function MarketingAnalyticsScreen() {
  const { data, loading, error, reload } = useAnalyticsSection<MarketingAnalyticsPayload>("marketing");

  if (loading) return <div className="mx-auto max-w-6xl"><PageHeader crumbs={[{ label: "Analytics" }, { label: "Marketing Analytics" }]} title="Marketing Analytics" /> <AnalyticsSkeleton rows={5} /></div>;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader crumbs={[{ label: "Analytics" }, { label: "Marketing Analytics" }]} title="Marketing Analytics" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-sm font-medium text-amber-900">{error}</p>
          <button type="button" onClick={reload} className="mt-3 text-[12.5px] font-medium text-amber-900 underline">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const m = data.marketing;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Marketing Analytics" }]}
        title="Marketing Analytics"
        description="Campaigns, channels and sourced pipeline — every figure labelled by its metric class, attribution only where configured."
        meta={<SourceLine system="Marketing Automation connector" freshness={data.freshness} />}
        actions={<button type="button" onClick={reload} className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700">Refresh</button>}
      />

      <div className="space-y-5">
        {/* Honest delayed-source state — never fake completeness */}
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[13px] font-medium text-amber-900">Source sync delayed — {m.freshness.label.replace("Delayed — ", "")}</p>
          <p className="mt-0.5 text-xs text-amber-800">{m.freshness.detail ?? "Figures are final as of 31 Oct 2026; November is incomplete, not missing."} {m.insights[m.insights.length - 1]}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="qubit-card p-4">
            <p className="text-[13px] font-medium text-slate-500">Leads QTD</p>
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">{m.qtd.leads.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-[10.5px] font-medium uppercase tracking-wide text-blue-600">{data.metricLabels.leads}</p>
          </article>
          <article className="qubit-card p-4">
            <p className="text-[13px] font-medium text-slate-500">MQL / SQL QTD</p>
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">{m.qtd.mql.toLocaleString("en-IN")} <span className="text-slate-300">/</span> {m.qtd.sql.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-[10.5px] font-medium uppercase tracking-wide text-teal-600">{data.metricLabels.mqls}</p>
          </article>
          <article className="qubit-card p-4">
            <MetricDef metric={data.definitions.cpl} label="CPL QTD" />
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">₹{m.qtd.cpl.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Spend ₹{m.qtd.spend.toFixed(2)} Cr · {m.qtd.cpl > 0 ? "calculated, not reported" : "—"}</p>
          </article>
          <article className="qubit-card p-4">
            <MetricDef metric={data.definitions.sourcedPipeline} label="Sourced pipeline" />
            <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-900">₹{m.qtd.sourcedPipeline.toFixed(2)} Cr</p>
            <p className="mt-1 text-[10.5px] font-medium uppercase tracking-wide text-violet-600">{data.metricLabels.sourcedPipeline}</p>
          </article>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SectionCard title="Channel performance" description="Platform-reported leads and MQLs; CPL is Qubit-derived; pipeline is attributed where configured.">
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[460px] text-left text-[12.5px]">
                <caption className="sr-only">Marketing channel performance</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                    <th scope="col" className="py-2 pr-3 font-semibold">Channel</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Leads</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">MQLs</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">CPL</th>
                    <th scope="col" className="pl-3 py-2 text-right font-semibold">Pipeline</th>
                  </tr>
                </thead>
                <tbody>
                  {m.channels.map((c) => (
                    <tr key={c.channel} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-800">{c.channel}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.leads.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.mqls.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">₹{c.cpl.toLocaleString("en-IN")}</td>
                      <td className="pl-3 py-2 text-right font-semibold tabular-nums text-slate-900">₹{c.sourcedPipeline.toFixed(2)} Cr</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ScopeNote className="mt-3">There is no SEO/keyword table in this source yet — SEO performance is reported through the organic-search channel only. When the SEO system lands, it appears here without a second engine.</ScopeNote>
          </SectionCard>

          <SectionCard title="Leads by channel" description="Accessible chart — the exact figures are in the table.">
            <BarList
              ariaLabel={`Leads by channel: ${m.channels.map((c) => `${c.channel} ${c.leads}`).join(", ")}`}
              items={m.channels.map((c) => ({ label: c.channel, value: c.leads }))}
              unit="leads"
            />
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Month trend (final months only)</p>
              <BarList
                ariaLabel={`Monthly leads: ${m.trend.filter((t) => t.final).map((t) => `${t.month} ${t.leads}`).join(", ")}`}
                items={m.trend.filter((t) => t.final).map((t) => ({ label: t.month, value: t.leads, hint: `${t.mql} MQLs` }))}
                unit="leads"
                tone="slate"
              />
              <ScopeNote className="mt-2">November shows nothing rather than a fake bar — the sync has not delivered final November data.</ScopeNote>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Campaigns" description="Named campaigns with their recorded status and notes — no fabricated ROI.">
          <ul className="space-y-2.5">
            {m.campaigns.map((c) => (
              <li key={c.name} className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${c.status === "Active" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{c.status}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-slate-900">{c.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>
                </div>
                <div className="text-right text-[12px] tabular-nums">
                  <p className="font-semibold text-slate-900">{c.leads.toLocaleString("en-IN")} leads</p>
                  <p className="text-slate-400">₹{c.pipeline.toFixed(2)} Cr pipeline</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <AnalyticsAsOf asOfLabel={data.asOfLabel} />
      </div>
    </div>
  );
}
