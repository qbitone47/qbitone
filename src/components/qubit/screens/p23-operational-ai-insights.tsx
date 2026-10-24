"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsSkeleton, SourceLine, useObsSection, obsPost } from "../obs/parts";

// ============================================================
// P23-23 · Operational AI Insights — deterministic analysis
// renders immediately (computed from real data, labeled as
// such). AI generation is available only when the gateway is
// reachable; when it is not, the UI says so verbatim. The AI
// never invents telemetry — guardrails are shown, not implied.
// ============================================================

interface InsightItem {
  kind: string;
  text: string;
  evidence: string;
  confidence?: string;
}

interface AiInsightsPayload {
  provider: string;
  aiAvailable: boolean;
  aiNote: string;
  deterministic: { kind: string; text: string; evidence: string }[];
  guardrails: string[];
  labels: string[];
  sourceNote: string;
}

interface AiPostResponse {
  ok: boolean;
  data: { ok: boolean; message?: string; insights?: InsightItem[] };
}

const kindTone: Record<string, string> = {
  "Observed Fact": "border-blue-200 bg-blue-50 text-blue-800",
  Inference: "border-amber-200 bg-amber-50 text-amber-800",
  Recommendation: "border-slate-200 bg-slate-50 text-slate-700",
};

const confidenceTone: Record<string, string> = {
  high: "border-emerald-200 bg-emerald-50 text-emerald-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

function KindChip({ kind }: { kind: string }) {
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${kindTone[kind] ?? "border-slate-200 bg-slate-50 text-slate-600"}`}>{kind}</span>
  );
}

function ConfidenceChip({ confidence }: { confidence: string }) {
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${confidenceTone[confidence] ?? confidenceTone.low}`}>confidence: {confidence}</span>
  );
}

function InsightList({ items }: { items: InsightItem[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <KindChip kind={it.kind} />
            {it.confidence ? <ConfidenceChip confidence={it.confidence} /> : null}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-700">{it.text}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Evidence: {it.evidence}</p>
        </li>
      ))}
    </ul>
  );
}

export function P23OperationalAiInsightsScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<AiInsightsPayload>("ai-insights");
  const [generated, setGenerated] = React.useState<InsightItem[] | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function generate() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await obsPost<AiPostResponse>("ai.insight");
      const inner = res.data;
      if (inner?.ok && Array.isArray(inner.insights)) {
        setGenerated(inner.insights);
        toast({ title: "AI insights generated", description: inner.message ?? "Generated from the real context above." });
      } else {
        // Honest path: the server explicitly declined (e.g. serverless runtime) —
        // its message is surfaced verbatim. Nothing is fabricated to fill the gap.
        toast({ variant: "destructive", title: "AI generation unavailable", description: inner?.message ?? "The server did not return insights." });
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "AI generation failed",
        description: e instanceof Error ? e.message : "The AI generation request could not be completed.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Operational AI Insights"
        description="Deterministic analysis computed from real signals, plus optional grounded AI generation — every item labeled by kind, evidence and confidence."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className={`rounded-xl border p-3.5 text-[12px] leading-relaxed ${data.aiAvailable ? "border-slate-200 bg-slate-50/60 text-slate-600" : "border-amber-200 bg-amber-50/60 text-amber-900"}`} role="note">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] opacity-70">Provider · {data.provider}</p>
            <p className="mt-1">{data.aiNote}</p>
          </div>

          <SectionCard title="Guardrails" description="Enforced constraints on any analysis this screen presents.">
            <ul className="space-y-1.5">
              {data.guardrails.map((g, i) => (
                <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-slate-700">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Label vocabulary</p>
              <ul className="flex flex-wrap gap-1.5">
                {data.labels.map((l) => (
                  <li key={l} className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-600">{l}</li>
                ))}
              </ul>
            </div>
          </SectionCard>

          <SectionCard
            title="Deterministic analysis"
            description="Computed on this request from real audit/probe data — no AI involved. Always available."
          >
            {data.deterministic.length === 0 ? (
              <p className="text-[12.5px] text-slate-500" role="status">No deterministic items were produced — the underlying signals may be empty. Nothing is fabricated.</p>
            ) : (
              <InsightList items={data.deterministic} />
            )}
          </SectionCard>

          <SectionCard
            title="AI generation"
            description="Grounded strictly on real aggregated context sent to the AI engine. Output is parsed into the labeled schema or refused."
          >
            {data.aiAvailable ? (
              <>
                <button
                  type="button"
                  onClick={generate}
                  disabled={busy}
                  aria-busy={busy}
                  className="min-h-[44px] rounded-lg bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Generating…" : "Generate AI insights"}
                </button>
                {generated === null ? (
                  <p className="mt-2.5 text-[11.5px] text-slate-400">No AI generation has run in this session. The result appears here only after a successful run — never pre-filled.</p>
                ) : (
                  <div className="mt-3" role="status" aria-label="Generated AI insights">
                    <p className="mb-2 text-[11px] text-slate-400">Generated just now · session-local display of the last successful run.</p>
                    <InsightList items={generated} />
                  </div>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="min-h-[44px] cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2 text-[12.5px] font-semibold text-slate-500"
                >
                  Generate AI insights
                </button>
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-amber-800" role="note">{data.aiNote}</p>
              </>
            )}
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
