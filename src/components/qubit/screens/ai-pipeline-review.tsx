"use client";

import * as React from "react";
import { GitBranch, Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "../page-header";
import { EmptyState, StatTile } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { cn } from "@/lib/utils";
import {
  AiGovernanceStrip,
  AiInsightCard,
  AiMetaLine,
  AiScopeNote,
  AiSkeleton,
  AiUnavailableBanner,
  SalesAiGate,
  aiPost,
  useSalesAiSection,
} from "../ai/parts";
import type { AiInsight } from "@/lib/qubit/sales-ai-data";
import { EntityLink, fmtCr } from "../sales/parts";

// ============================================================
// Screen 108 · AI Pipeline Review — pipeline health, stalled
// deals, forecast risks and stage bottlenecks with drilldown
// Pipeline → Stage → Opportunity → Customer → Activity.
// ACTUAL / FORECAST / AI ESTIMATE are three separate, clearly
// labeled series — never mixed. AI estimates never modify the
// forecast (that stays in Sales Forecast 81).
// ============================================================

interface ReviewPayload {
  scope: "company" | "team" | "own";
  period: { label: string; window: string; asOfLabel: string };
  generatedAt: number;
  freshnessLabel: string;
  modelLabel: string;
  overview: {
    gross: number;
    weighted: number;
    count: number;
    agingMedianDays: number;
    agingOldestDays: number;
    stageDistribution: { stage: string; count: number; value: number }[];
  } | null;
  insights: AiInsight[];
  forecast: {
    commitCr: number | null;
    bestCaseCr: number | null;
    targetCr: number | null;
    aiEstimateCr: number;
    aiModelNote: string;
  };
  opps: { id: string; name: string; accountName: string; stage: string; valueCr: number; probability: number }[];
}

export function AiPipelineReviewScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { data, loading, error, forbidden, reload } = useSalesAiSection<ReviewPayload>("pipeline-review");
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const insights = (data?.insights ?? []).filter((i) => !dismissed.has(i.id));
  const o = data?.overview;

  const dismiss = async (id: string) => {
    try {
      await aiPost("insight.dismiss", { id }, role);
      setDismissed((prev) => new Set(prev).add(id));
    } catch {
      /* the card stays if the service is down — honest */
    }
  };

  if (forbidden) {
    return (
      <SalesAiGate screenName="AI Pipeline Review">
        <></>
      </SalesAiGate>
    );
  }

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Sales AI" }, { label: "Pipeline Review" }]}
        title="AI Pipeline Review"
        description="Pipeline health from your authorized scope — stalled deals, aging, bottlenecks and forecast risks, each with evidence and a drill path. Actual, forecast and AI estimate stay separate, always."
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={reload} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5${loading ? " animate-spin" : ""}`} aria-hidden /> Re-analyze
          </Button>
        }
      />

      <AiGovernanceStrip
        note="Insights are computed from your authorized pipeline only. The AI estimate below is a decayed-probability model — informational, clearly separated, and it never writes back to the forecast. Forecast changes belong in Sales Forecast (81) under the existing controls."
        meta={data ? `${data.modelLabel} · analyzed ${new Date(data.generatedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} IST` : undefined}
      />

      {error && <AiUnavailableBanner message={error} onRetry={reload} />}
      {loading && <AiSkeleton rows={4} />}

      {data && !loading && (
        <div className="space-y-4">
          {/* Pipeline overview */}
          {o && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile icon={<GitBranch />} value={fmtCr(o.gross)} label={`${o.count} open opportunities — actual pipeline value`} onClick={() => nav.navigate("sales-pipeline")} />
                <StatTile value={fmtCr(o.weighted)} label="Weighted pipeline (existing forecast math)" onClick={() => nav.navigate("sales-forecast")} />
                <StatTile value={`${o.agingMedianDays}d`} label={`Median age · oldest ${o.agingOldestDays}d`} onClick={() => nav.navigate("sales-pipeline")} />
                <StatTile value={fmtCr(data.forecast.aiEstimateCr)} label="AI estimate — decayed probability (informational)" onClick={() => setExpanded("ai-estimate")} />
              </div>

              {/* stage distribution — compact bars */}
              <div className="qubit-card p-4">
                <p className="text-[13px] font-semibold text-slate-900">Stage distribution</p>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
                  {o.stageDistribution.map((s) => {
                    const max = Math.max(...o.stageDistribution.map((x) => x.count), 1);
                    return (
                      <div key={s.stage}>
                        <p className="flex items-baseline justify-between text-[12px] font-medium text-slate-600">
                          {s.stage}
                          <span className="tabular-nums text-slate-400">{s.count}</span>
                        </p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${s.stage}: ${s.count} deals, ₹${s.value.toFixed(2)} Cr`}>
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(4, (s.count / max) * 100)}%` }} />
                        </div>
                        <p className="mt-0.5 text-[10.5px] tabular-nums text-slate-400">{fmtCr(s.value)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          <AiScopeNote scope={data.scope} what="opportunities" />

          {/* ACTUAL / FORECAST / AI ESTIMATE — three labeled series, never mixed */}
          <div id="ai-estimate" className={cn("qubit-card p-4", expanded === "ai-estimate" && "ring-1 ring-blue-200")}>
            <p className="text-[13px] font-semibold text-slate-900">Forecast position — three separate series</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Actual (closed)</p>
                <p className="mt-1 text-[15px] font-semibold tabular-nums text-slate-900">{data.forecast.targetCr != null ? `Target ₹${data.forecast.targetCr.toFixed(2)} Cr` : "—"}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">From Sales Targets (82)</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Forecast (commit)</p>
                <p className="mt-1 text-[15px] font-semibold tabular-nums text-slate-900">{data.forecast.commitCr != null ? `₹${data.forecast.commitCr.toFixed(2)} Cr` : "—"}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Existing forecast math · best case {data.forecast.bestCaseCr != null ? `₹${data.forecast.bestCaseCr.toFixed(2)} Cr` : "—"}</p>
              </div>
              <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50/50 px-3.5 py-3">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-violet-600">AI estimate — separate</p>
                <p className="mt-1 text-[15px] font-semibold tabular-nums text-violet-700">₹{data.forecast.aiEstimateCr.toFixed(2)} Cr</p>
                <p className="mt-0.5 text-[11px] text-violet-500">Informational only · dashed = not part of the forecast</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-3">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Model note</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{data.forecast.aiModelNote}</p>
              </div>
            </div>
            <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-slate-400">
              <Info className="h-3 w-3 shrink-0" aria-hidden />
              AI must not silently modify forecasts — any forecast change uses the existing Sales workflow (81) with its own controls and audit.
            </p>
          </div>

          {/* AI insights */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-slate-900">AI insights ({insights.length})</h2>
              <p className="text-[11px] text-slate-400">Pipeline → Stage → Opportunity → Customer → Activity — every card links down the chain.</p>
            </div>
            {insights.length === 0 ? (
              <EmptyState
                icon={<GitBranch />}
                title="No pipeline insights clear the evidence bar"
                message="No stalls, unrealistic dates, concentration or missing next steps were found in your authorized scope. Re-analyze after your next pipeline change."
              />
            ) : (
              <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                {insights.map((i) => (
                  <AiInsightCard key={i.id} insight={i} onDismiss={dismiss} />
                ))}
              </div>
            )}
          </div>

          {/* drilldown helper */}
          {data.opps.length > 0 && (
            <div className="qubit-card p-4">
              <p className="text-[13px] font-semibold text-slate-900">Drilldown — largest open deals in scope</p>
              <ul className="mt-2 divide-y divide-slate-100">
                {data.opps.slice(0, 5).map((op) => (
                  <li key={op.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
                    <EntityLink screen="opportunity-detail" id={op.id} label={op.name} kind="opportunity" />
                    <span className="text-[12px] text-slate-500">{op.accountName}</span>
                    <span className="text-[12px] tabular-nums text-slate-500">{fmtCr(op.valueCr)} · {op.stage} · {op.probability}%</span>
                  </li>
                ))}
              </ul>
              <AiMetaLine generatedAt={data.generatedAt} freshnessLabel={data.freshnessLabel} className="mt-2" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
