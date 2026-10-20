"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { useRole } from "../role-context";
import {
  AnalyticsAsOf,
  AnalyticsErrorBanner,
  AnalyticsSkeleton,
  FunnelView,
  ScopeNote,
  SourceLine,
  useAnalyticsSection,
} from "../analytics/parts";
import type { Freshness } from "@/lib/qubit/executive-data";

// ============================================================
// Screen 277 · Funnel Analytics — ONE reusable funnel engine
// over Sales, Recruitment, Service and Marketing (spec §19).
// The engine is not hard-coded for Sales: each funnel is a
// definition with server-computed stages from its own
// authoritative source. Period comparison appears only where a
// source provides it — never interpolated.
// ============================================================

interface FunnelPayload {
  asOfLabel: string;
  funnel: { id: string; name: string; domain: string; description: string; stages: string[]; sourceNote: string };
  stages: { stage: string; count: number | null; valueCr: number | null; note?: string }[];
  scopeNote: string;
  comparisonNote: string;
  comparison?: { period: string; leads: number; mql: number }[];
  freshness?: Freshness;
}

const FUNNEL_OPTIONS = [
  { id: "funnel-sales", label: "Sales", roles: ["administrator", "dept-head", "sales-exec"] },
  { id: "funnel-recruitment", label: "Recruitment", roles: ["administrator", "hr-manager"] },
  { id: "funnel-service", label: "Service", roles: ["administrator", "dept-head"] },
  { id: "funnel-marketing", label: "Marketing", roles: ["administrator", "dept-head", "sales-exec"] },
];

export function FunnelAnalyticsScreen() {
  const { role } = useRole();
  const [selected, setSelected] = React.useState<string>(() => FUNNEL_OPTIONS.find((f) => f.roles.includes(role))?.id ?? "funnel-sales");
  const { data, loading, error, reload } = useAnalyticsSection<FunnelPayload>("funnels", { id: selected });

  const available = FUNNEL_OPTIONS.filter((f) => f.roles.includes(role));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Funnel Analytics" }]}
        title="Funnel Analytics"
        description="One funnel engine over configurable stage definitions — each funnel computed from its own authoritative source at your scope."
        actions={<button type="button" onClick={reload} className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700">Refresh</button>}
      />

      <div className="space-y-5">
        <div role="tablist" aria-label="Funnel selection" className="flex flex-wrap gap-2">
          {available.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={selected === f.id}
              type="button"
              onClick={() => setSelected(f.id)}
              className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${selected === f.id ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
            >
              {f.label}
            </button>
          ))}
          {available.length === 1 && <ScopeNote>Funnels beyond your authorization are listed in Analytics Settings by your administrator — the server decides what is served.</ScopeNote>}
        </div>

        {loading && <AnalyticsSkeleton rows={4} />}
        {error && !loading && <AnalyticsErrorBanner message={error} onRetry={reload} />}

        {data && !loading && (
          <>
            <SectionCard
              title={data.funnel.name}
              description={data.funnel.description}
              actions={data.freshness ? <SourceLine system={data.funnel.domain} freshness={data.freshness} /> : undefined}
            >
              <FunnelView
                stages={data.stages}
                ariaLabel={`${data.funnel.name}: ${data.stages.map((s) => `${s.stage} ${s.count ?? "value"}`).join(", ")}`}
              />
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                <ScopeNote><span className="font-medium text-slate-600">Scope:</span> {data.scopeNote}</ScopeNote>
                <ScopeNote><span className="font-medium text-slate-600">Source:</span> {data.funnel.sourceNote}</ScopeNote>
                <ScopeNote><span className="font-medium text-slate-600">Period comparison:</span> {data.comparisonNote}</ScopeNote>
              </div>
            </SectionCard>

            {data.comparison && data.comparison.length > 1 && (
              <SectionCard title="Period comparison (where the source provides it)" description="Final periods only — incomplete months are never drawn.">
                <div className="relative overflow-x-auto">
                  <table className="w-full min-w-[320px] text-left text-[12.5px]">
                    <caption className="sr-only">Funnel period comparison</caption>
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                        <th scope="col" className="py-2 pr-3 font-semibold">Period</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold">Leads</th>
                        <th scope="col" className="pl-3 py-2 text-right font-semibold">MQLs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.comparison.map((c) => (
                        <tr key={c.period} className="border-b border-slate-50 last:border-0">
                          <td className="py-2 pr-3 font-medium text-slate-800">{c.period}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{c.leads.toLocaleString("en-IN")}</td>
                          <td className="pl-3 py-2 text-right tabular-nums">{c.mql.toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            <AnalyticsAsOf asOfLabel={data.asOfLabel} />
          </>
        )}
      </div>
    </div>
  );
}
