"use client";

import * as React from "react";
import { ArrowUpRight, Check, Clock, Crosshair, Info, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { fmtTime } from "@/lib/qubit/workspace-data";
import { screenMeta, type ScreenId, type ScreenParams } from "@/lib/qubit/screens";
import type { AiInsight, InsightCategory } from "@/lib/qubit/executive-data";
import { PageHeader } from "../page-header";
import { ArrowLink, EmptyState, SectionCard } from "../primitives";
import { ConfirmDialog } from "../dialogs";
import { useRole } from "../role-context";
import {
  AsOfStrip,
  ExecApiError,
  ExecErrorBanner,
  ExecSkeleton,
  ExecutiveGate,
  PeriodChip,
  execPost,
  useExecutiveSection,
  useExecutiveNav,
} from "../executive/parts";

// ============================================================
// Screen 70 · CEO AI Insights — the executive AI interpretation
// layer. Explicitly NOT a chatbot: no input box, no conversation,
// no fake streaming. Every insight follows
// OBSERVATION → EVIDENCE → INTERPRETATION → IMPACT →
// RECOMMENDATION → ACTION. The AI recommends and explains;
// consequential actions require executive confirmation and are
// executed through the authorized workflow layer, then audited
// (spec §11: Recommend → Explain → Confirm → Execute → Audit).
// ============================================================

interface InsightsPayload {
  period: { label: string; window: string };
  asOfLabel: string;
  insights: AiInsight[];
}

const CONFIDENCE_TONE: Record<AiInsight["confidence"], { dot: string; text: string; border: string; bg: string }> = {
  High: { dot: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200", bg: "bg-emerald-50" },
  Medium: { dot: "bg-amber-500", text: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50" },
  Low: { dot: "bg-slate-400", text: "text-slate-600", border: "border-slate-200", bg: "bg-slate-50" },
};

function ConfidenceBadge({ confidence }: { confidence: AiInsight["confidence"] }) {
  const t = CONFIDENCE_TONE[confidence];
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", t.bg, t.text, t.border)}
      title={`Model confidence: ${confidence.toLowerCase()}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", t.dot)} aria-hidden />
      {confidence} confidence
    </span>
  );
}

function LadderLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">{children}</p>;
}

export function CeoAiInsightsScreen() {
  const navigate = useExecutiveNav();
  const { role } = useRole();
  const { toast } = useToast();
  const { data, loading, error, reload } = useExecutiveSection<InsightsPayload>("insights");

  const insights = data?.insights ?? [];
  const [category, setCategory] = React.useState<"All" | InsightCategory>("All");
  const [doneFollowUps, setDoneFollowUps] = React.useState<Set<string>>(new Set());
  const [confirmTarget, setConfirmTarget] = React.useState<{ insight: AiInsight; followUpId: string; label: string } | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  // Categories present in the payload — chips never invent a filter.
  const categories = React.useMemo(() => Array.from(new Set(insights.map((i) => i.category))), [insights]);
  const visible = React.useMemo(
    () => (category === "All" ? insights : insights.filter((i) => i.category === category)),
    [insights, category],
  );

  const runFollowUp = async (insight: AiInsight, followUpId: string, label: string) => {
    const key = `${insight.id}:${followUpId}`;
    setBusyKey(key);
    try {
      await execPost({ action: "insight.followup", id: insight.id, followUpId }, role);
      setDoneFollowUps((prev) => new Set(prev).add(key));
      toast({
        title: "Recorded — AI recommendation accepted; execution is audited",
        description: `${label} · ${insight.category} insight, executed through the authorized workflow layer.`,
      });
    } catch (err) {
      const message = err instanceof ExecApiError ? err.message : "The insight service is unreachable. Nothing was executed.";
      toast({ variant: "destructive", title: "Follow-up not recorded", description: message });
    } finally {
      setBusyKey(null);
    }
  };

  const generatedCaption = insights.length > 0 ? `Generated ${fmtTime(insights[0].generatedAt)} IST · model run over synced domain data` : "Model run over synced domain data";

  return (
    <ExecutiveGate screenName="CEO AI Insights">
      <div>
        <PageHeader
          crumbs={[{ label: "CEO Command Center" }, { label: "CEO AI Insights" }]}
          title="CEO AI Insights"
          description="Evidence-based AI interpretation of the company data you are authorized to see — every claim carries its evidence, confidence and drill path. Not a chatbot: the model publishes findings, you decide."
          meta={data && <PeriodChip label={data.period.label} window={data.period.window} />}
        />

        {/* Governance strip — quiet, precise */}
        <div className="mb-4 flex gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5" role="note">
          <span className="qubit-icon-tile qubit-icon-tile-accent h-9 w-9 shrink-0 [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
            <ShieldCheck />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] leading-relaxed text-slate-600">
              AI analyzes only data the CEO is authorized to see. It recommends and explains — consequential actions always require your
              confirmation and are executed through the authorized workflow layer, then audited.
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Sparkles className="h-3 w-3" aria-hidden />
              {generatedCaption}
            </p>
          </div>
        </div>

        {error && <ExecErrorBanner message={error} onRetry={reload} />}

        {loading ? (
          <ExecSkeleton rows={3} />
        ) : (
          <>
            {/* Category filter chips — only categories present in the payload */}
            {categories.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter insights by category">
                {(["All", ...categories] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={category === c}
                    onClick={() => setCategory(c)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      category === c
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700",
                    )}
                  >
                    {c}
                    <span className="ml-1.5 tabular-nums text-[10.5px] text-slate-400">
                      {c === "All" ? insights.length : insights.filter((i) => i.category === c).length}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {visible.length === 0 ? (
              <SectionCard>
                <EmptyState
                  icon={<Sparkles />}
                  title="No insights in this category right now."
                  message="The model publishes an insight only when a signal clears the evidence bar. Check back after the next run, or switch category."
                />
              </SectionCard>
            ) : (
              <div className="space-y-3">
                {visible.map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    doneFollowUps={doneFollowUps}
                    busyKey={busyKey}
                    onDrill={navigate}
                    onAskConfirm={(followUpId, label) => setConfirmTarget({ insight, followUpId, label })}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Follow-up confirmation — AI recommends, the executive confirms, the workflow layer executes */}
        <ConfirmDialog
          open={Boolean(confirmTarget)}
          onOpenChange={(o) => !o && setConfirmTarget(null)}
          title={confirmTarget ? `Execute “${confirmTarget.label}” through the authorized workflow?` : ""}
          description={
            confirmTarget
              ? `This accepts the AI recommendation from the ${confirmTarget.insight.category} insight. The action runs through the authorized workflow layer — the AI holds no direct write access — and the execution is recorded in the enterprise audit trail.`
              : ""
          }
          confirmLabel="Execute follow-up"
          onConfirm={() => {
            if (confirmTarget) void runFollowUp(confirmTarget.insight, confirmTarget.followUpId, confirmTarget.label);
            setConfirmTarget(null);
          }}
        />

        <AsOfStrip
          asOfLabel={data?.asOfLabel ?? ""}
          note="Each insight carries its own data-as-of line; delayed sources are labelled on the insight, never hidden."
        />
      </div>
    </ExecutiveGate>
  );
}

// ---------- insight card — the fixed interpretation ladder ----------

function InsightCard({
  insight,
  doneFollowUps,
  busyKey,
  onDrill,
  onAskConfirm,
}: {
  insight: AiInsight;
  doneFollowUps: Set<string>;
  busyKey: string | null;
  onDrill: (screen: ScreenId, params?: ScreenParams) => void;
  onAskConfirm: (followUpId: string, label: string) => void;
}) {
  return (
    <article className="qubit-card qubit-card-hover p-4 md:p-5" aria-label={`${insight.category} insight: ${insight.title}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex shrink-0 items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              {insight.category}
            </span>
            <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-slate-900">{insight.title}</h3>
          </div>
        </div>
        <ConfidenceBadge confidence={insight.confidence} />
      </div>

      {/* Uncertainty — communicated whenever confidence is not High */}
      {insight.confidence !== "High" && insight.confidenceNote && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-amber-800" role="note">
          <Info className="mt-px h-3 w-3 shrink-0 text-amber-600" aria-hidden />
          <span>
            <span className="font-semibold">Why {insight.confidence.toLowerCase()} confidence:</span> {insight.confidenceNote}
          </span>
        </p>
      )}

      {/* Observation */}
      <p className="mt-3 text-[13.5px] leading-relaxed text-slate-700">{insight.observation}</p>

      {/* Evidence — always visible, inspectable label/value table */}
      <div className="mt-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-3" aria-label="Evidence behind this insight">
        <LadderLabel>Evidence</LadderLabel>
        <dl className="mt-1.5 divide-y divide-slate-100">
          {insight.evidence.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 py-1.5 first:pt-0 last:pb-0">
              <dt className="shrink-0 text-xs text-slate-500">{row.label}</dt>
              <dd className="text-right text-[12.5px] font-medium tabular-nums text-slate-800">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Interpretation */}
      <div className="mt-3.5">
        <LadderLabel>Interpretation</LadderLabel>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{insight.interpretation}</p>
      </div>

      {/* Impact — quiet emphasis */}
      <div className="mt-3.5 rounded-lg border-l-2 border-blue-200 bg-blue-50/40 px-3.5 py-2.5">
        <LadderLabel>Impact</LadderLabel>
        <p className="mt-1 text-[13px] font-medium leading-relaxed text-slate-800">{insight.impact}</p>
      </div>

      {/* Recommendation */}
      <div className="mt-3.5">
        <LadderLabel>Recommendation</LadderLabel>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{insight.recommendation}</p>
      </div>

      {/* Meta — affected area + data freshness */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Crosshair className="h-3 w-3" aria-hidden /> Affects: {insight.affectedArea}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3 w-3" aria-hidden /> Data as of {insight.dataAsOf}
        </span>
      </div>

      {/* Action row — drill + follow-ups (executed through the authorized workflow layer) */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {insight.drillScreen && (
          <ArrowLink onClick={() => onDrill(insight.drillScreen as ScreenId, insight.drillParams)} ariaLabel={`Open ${screenMeta(insight.drillScreen as ScreenId).title}`}>
            Open {screenMeta(insight.drillScreen as ScreenId).title}
          </ArrowLink>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {insight.followUps.map((fu) => {
            const key = `${insight.id}:${fu.id}`;
            const done = doneFollowUps.has(key);
            if (done) {
              return (
                <span
                  key={fu.id}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden /> {fu.label} — accepted
                </span>
              );
            }
            return (
              <Button
                key={fu.id}
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs"
                disabled={busyKey === key}
                onClick={() => onAskConfirm(fu.id, fu.label)}
              >
                {busyKey === key ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Recording…
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> {fu.label}
                  </>
                )}
              </Button>
            );
          })}
        </div>
      </div>
    </article>
  );
}
