"use client";

import * as React from "react";
import { ArrowRight, BadgeCheck, ListChecks, RefreshCw, Sparkles, Target, TrendingDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "../page-header";
import { SectionCard, StatTile } from "../primitives";
import { useQubitNav } from "../nav-context";
import {
  AiGovernanceStrip,
  AiInsightCard,
  AiRecommendationCard,
  AiScopeNote,
  AiSkeleton,
  AiUnavailableBanner,
  SalesAiGate,
  useSalesAiSection,
} from "../ai/parts";
import type { AiActivityEntry, AiInsight, AiQuickAction, AiRecommendation } from "@/lib/qubit/sales-ai-data";
import { relTime } from "../sales/parts";

// ============================================================
// Screen 103 · Sales AI Home — the sales intelligence command
// center. NOT a chatbot: the model publishes what matters, why,
// on which evidence, with what confidence — the user decides.
// Everything is computed from the authorized Sales OS scope.
// ============================================================

interface HomePayload {
  scope: "company" | "team" | "own";
  period: { label: string; window: string; asOfLabel: string };
  generatedAt: number;
  freshnessLabel: string;
  modelLabel: string;
  overview: {
    highPriorityLeads: number;
    leadsInsufficient: number;
    oppsAtRisk: number;
    overdueFollowups: number;
    pipelineCr: number;
    pipelineCount: number;
    recommendationsOpen: number;
  };
  insights: AiInsight[];
  recommendations: AiRecommendation[];
  quickActions: AiQuickAction[];
  activity: AiActivityEntry[];
}

export function SalesAiHomeScreen() {
  const nav = useQubitNav();
  const { data, loading, error, forbidden, reload } = useSalesAiSection<HomePayload>("home");

  if (forbidden) {
    return (
      <SalesAiGate screenName="Sales AI Home">
        <></>
      </SalesAiGate>
    );
  }

  const o = data?.overview;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Sales AI" }]}
        title="Sales AI"
        description="Your sales intelligence command center — what matters now, why, on which evidence, and what to do next. AI recommends and explains; you decide."
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={reload} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5${loading ? " animate-spin" : ""}`} aria-hidden /> Refresh intelligence
          </Button>
        }
      />

      <AiGovernanceStrip
        note="Sales AI reads only the sales data your role is authorized to see, through the same server-side enforcement as the Sales module. The underlying Sales OS remains the source of truth — AI never silently changes it, and consequential actions always require your confirmation."
        meta={data ? `Generated ${new Date(data.generatedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} IST · ${data.modelLabel}` : undefined}
      />

      {error && <AiUnavailableBanner message={error} onRetry={reload} />}
      {loading && <AiSkeleton rows={4} />}

      {data && !loading && (
        <div className="space-y-4">
          {/* Intelligence overview — four honest counters, each actionable */}
          <section aria-labelledby="ai-overview-h">
            <h2 id="ai-overview-h" className="sr-only">Sales intelligence overview</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                icon={<Target />}
                value={String(o?.highPriorityLeads ?? 0)}
                label={o && o.highPriorityLeads > 0 ? "High-priority leads to act on" : "No high-priority leads — queue is calm"}
                onClick={() => nav.navigate("ai-lead-prioritization")}
              />
              <StatTile
                icon={<TrendingDown />}
                value={String(o?.oppsAtRisk ?? 0)}
                label={o && o.oppsAtRisk > 0 ? "Opportunities with risk signals" : "No risk signals in open pipeline"}
                onClick={() => nav.navigate("ai-pipeline-review")}
              />
              <StatTile
                icon={<ListChecks />}
                value={String(o?.overdueFollowups ?? 0)}
                label={o && o.overdueFollowups > 0 ? "Overdue follow-ups in your scope" : "Follow-ups — all clear"}
                onClick={() => nav.navigate("followup-queue")}
              />
              <StatTile
                icon={<Sparkles />}
                value={String(o?.recommendationsOpen ?? 0)}
                label="Open AI recommendations awaiting your review"
                onClick={() => nav.navigate("ai-next-best-action")}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4">
              <AiScopeNote scope={data.scope} what="leads, opportunities and follow-ups" />
              <p className="text-[11px] text-slate-400">
                Pipeline in scope: ₹{o?.pipelineCr?.toFixed(2) ?? "0.00"} Cr across {o?.pipelineCount ?? 0} open opportunities.
                {o && o.leadsInsufficient > 0 && ` ${o.leadsInsufficient} lead${o.leadsInsufficient === 1 ? " has" : "s have"} too little data to score — the AI says so instead of guessing.`}
              </p>
            </div>
          </section>

          {/* Recommended actions + AI insights */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionCard title="Recommended actions" description={`What to do next — accepted only after your review (${data.recommendations.length})`}>
              {data.recommendations.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-muted-foreground">
                  No open recommendations — your portfolio has no urgent gaps right now.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.recommendations.slice(0, 3).map((r) => (
                    <AiRecommendationCard
                      key={r.id}
                      recommendation={r}
                      acceptLabel="Review & accept"
                      onAccept={() => nav.navigate("ai-next-best-action")}
                    />
                  ))}
                </div>
              )}
              {data.recommendations.length > 3 && (
                <Button variant="ghost" size="sm" className="mt-2 h-8 gap-1.5 text-[12.5px]" onClick={() => nav.navigate("ai-next-best-action")}>
                  View all recommendations <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              )}
            </SectionCard>

            <SectionCard title="AI insights" description={`Evidence-backed signals from your pipeline (${data.insights.length})`}>
              {data.insights.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-muted-foreground">
                  No insight clears the evidence bar right now — the model stays quiet rather than speculate.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.insights.slice(0, 3).map((i) => (
                    <AiInsightCard key={i.id} insight={i} compact />
                  ))}
                </div>
              )}
              <Button variant="ghost" size="sm" className="mt-2 h-8 gap-1.5 text-[12.5px]" onClick={() => nav.navigate("ai-pipeline-review")}>
                Full pipeline review <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </SectionCard>
          </div>

          {/* Quick actions */}
          <SectionCard title="Sales AI quick actions" description="Jump straight into a capability">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.quickActions.map((qa) => (
                <button
                  key={qa.screen}
                  type="button"
                  onClick={() => nav.navigate(qa.screen as never)}
                  className="group flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-semibold tabular-nums text-slate-500 transition-colors group-hover:bg-blue-100 group-hover:text-blue-700" aria-hidden>
                    {qa.num}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-slate-800">{qa.label}</span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-slate-500">{qa.description}</span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" aria-hidden />
                </button>
              ))}
            </div>
          </SectionCard>

          {/* Recent AI activity */}
          <SectionCard title="Recent AI activity" description="What Sales AI generated for you recently — with feedback controls">
            {data.activity.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-muted-foreground">
                Nothing generated yet — summaries, recommendations, drafts and answers will appear here as you use Sales AI.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                    <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-slate-500">{a.kind}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700">{a.summary}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <BadgeCheck className="h-3 w-3" aria-hidden />
                      {a.capability} · {relTime(a.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Users className="h-3 w-3" aria-hidden />
              Activity entries are retained for this session only — sensitive prompt content is not stored permanently.
            </p>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
