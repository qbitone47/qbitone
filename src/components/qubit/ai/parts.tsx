"use client";

import * as React from "react";
import {
  BookOpenCheck,
  Check,
  Database,
  Frown,
  Lightbulb,
  Loader2,
  Meh,
  Quote,
  RefreshCw,
  ShieldAlert,
  Smile,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "../role-context";
import { useQubitNav } from "../nav-context";
import type { ScreenId, ScreenParams } from "@/lib/qubit/screens";
import type { AiConfidence, AiFeedbackKind, AiInsight, AiRecommendation, AiSourceRef } from "@/lib/qubit/sales-ai-data";
import { SalesGate } from "../sales/parts";

// ============================================================
// Qubit One · Sales AI shared parts (Phase 7)
// The enterprise AI presentation language: same design system,
// same trust contracts as CEO AI Insights (70) — WHAT → WHY →
// SOURCE → CONFIDENCE → RECOMMENDED ACTION. No neon, no chatbot
// decoration. Authorization is server-side; this layer renders
// honestly what the orchestration layer returns.
// ============================================================

// ---------- typed client for /api/sales-ai ----------

export class SalesAiApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "SalesAiApiError";
    this.status = status;
    this.code = code;
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let code: string | undefined;
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      code = body?.code;
      message = body?.message ?? message;
    } catch {
      /* non-JSON failure */
    }
    throw new SalesAiApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export async function aiGet<T>(section: string, role: string, params?: Record<string, string | undefined>): Promise<T> {
  const qs = new URLSearchParams({ section });
  for (const [k, v] of Object.entries(params ?? {})) if (v) qs.set(k, v);
  const res = await fetch(`/api/sales-ai?${qs.toString()}`, {
    headers: { "X-Qubit-Role": role, "Content-Type": "application/json" },
    cache: "no-store",
  });
  return parse<T>(res);
}

export async function aiPost<T = { ok: boolean; message?: string }>(
  type: string,
  input: Record<string, unknown>,
  role: string,
): Promise<T> {
  const res = await fetch("/api/sales-ai", {
    method: "POST",
    headers: { "X-Qubit-Role": role, "Content-Type": "application/json" },
    body: JSON.stringify({ type, input }),
  });
  return parse<T>(res);
}

// ---------- section loader ----------

export interface AiSectionState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  forbidden: boolean;
  scope: "company" | "team" | "own" | null;
  reload: () => void;
}

export function useSalesAiSection<T>(section: string, params?: Record<string, string | undefined>): AiSectionState<T> {
  const { role } = useRole();
  const paramKey = JSON.stringify(params ?? {});
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(section !== "");
  const [error, setError] = React.useState<string | null>(null);
  const [forbidden, setForbidden] = React.useState(false);
  const [scope, setScope] = React.useState<AiSectionState<T>["scope"]>(null);
  const [tick, setTick] = React.useState(0);

  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    if (!section) return; // deferred — the screen decides when to fetch (e.g. awaiting an entity pick)
    let alive = true;
    setLoading(true);
    setError(null);
    aiGet<T>(section, role, JSON.parse(paramKey))
      .then((d) => {
        if (alive) {
          setData(d);
          setForbidden(false);
          const sc = (d as { scope?: AiSectionState<T>["scope"] })?.scope;
          if (sc) setScope(sc);
        }
      })
      .catch((err) => {
        if (!alive) return;
        if (err instanceof SalesAiApiError && (err.status === 403 || err.status === 401)) {
          setForbidden(true);
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : "The Sales AI service is unreachable right now.");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [section, role, paramKey, tick]);

  return { data, loading, error, forbidden, scope, reload };
}

// ---------- gate (same boundary as the Sales module) ----------

export function SalesAiGate({ children, screenName }: { children: React.ReactNode; screenName: string }) {
  return <SalesGate screenName={screenName}>{children}</SalesGate>;
}

// ---------- governance strip (quiet, per screen) ----------

export function AiGovernanceStrip({ note, meta }: { note: string; meta?: string }) {
  return (
    <div className="mb-4 flex gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5" role="note">
      <span className="qubit-icon-tile qubit-icon-tile-accent h-9 w-9 shrink-0 [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
        <ShieldAlert />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] leading-relaxed text-slate-600">{note}</p>
        {meta && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Sparkles className="h-3 w-3" aria-hidden />
            {meta}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- AI-generated tag ----------

export function AiTag({ label = "AI-generated", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10.5px] font-semibold text-violet-700",
        className,
      )}
      title="Generated by Sales AI from authorized Qubit data — review before acting"
    >
      <Sparkles className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

// ---------- confidence (coarse, never fake precision) ----------

const CONFIDENCE_TONE: Record<AiConfidence, { dot: string; text: string; border: string; bg: string }> = {
  High: { dot: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200", bg: "bg-emerald-50" },
  Medium: { dot: "bg-amber-500", text: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50" },
  Low: { dot: "bg-slate-400", text: "text-slate-600", border: "border-slate-200", bg: "bg-slate-50" },
  "Insufficient data": { dot: "bg-amber-400", text: "text-amber-800", border: "border-amber-300", bg: "bg-amber-50" },
};

export function AiConfidenceBadge({ confidence, compact }: { confidence: AiConfidence; compact?: boolean }) {
  const t = CONFIDENCE_TONE[confidence];
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", t.bg, t.text, t.border)}
      title={`Model confidence: ${confidence.toLowerCase()}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", t.dot)} aria-hidden />
      {compact ? confidence : `${confidence} confidence`}
    </span>
  );
}

// ---------- fact / inference / recommendation ladder ----------

export type AiLadderKind = "FACT" | "INFERENCE" | "RECOMMENDATION";

export function AiLadderTag({ kind }: { kind: AiLadderKind }) {
  const tone =
    kind === "FACT"
      ? "border-slate-200 bg-slate-50 text-slate-600"
      : kind === "INFERENCE"
        ? "border-violet-200 bg-violet-50 text-violet-700"
        : "border-blue-200 bg-blue-50 text-blue-700";
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider", tone)}>
      {kind}
    </span>
  );
}

// ---------- evidence / source list ----------

export function AiSourceLink({ source }: { source: AiSourceRef }) {
  const nav = useQubitNav();
  const navigable = !!(source.screen && source.id);
  const go = () => {
    if (!source.screen || !source.id) return;
    const param = source.param ?? "id";
    nav.navigate(source.screen as ScreenId, { [param]: source.id } as ScreenParams);
  };
  return (
    <li className="flex min-w-0 items-start gap-2">
      <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
      <span className="min-w-0">
        {navigable ? (
          <button
            type="button"
            onClick={go}
            className="group/src inline-flex max-w-full items-center gap-1 text-[12.5px] font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            <span className="truncate">{source.label}</span>
            <span className="rounded border border-slate-200 bg-slate-50 px-1 py-px text-[9.5px] font-medium uppercase tracking-wide text-slate-500">{source.kind}</span>
          </button>
        ) : (
          <span className="inline-flex max-w-full flex-wrap items-center gap-1 text-[12.5px] font-medium text-slate-700">
            <span className="truncate">{source.label}</span>
            <span className="rounded border border-slate-200 bg-slate-50 px-1 py-px text-[9.5px] font-medium uppercase tracking-wide text-slate-500">{source.kind}</span>
          </span>
        )}
        {source.detail && <span className="block truncate text-[11px] text-slate-400">{source.detail}</span>}
      </span>
    </li>
  );
}

export function AiSourceList({ sources, title = "Based on" }: { sources: AiSourceRef[]; title?: string }) {
  if (!sources.length) return null;
  return (
    <div className="mt-3 border-t border-slate-100 pt-2.5">
      <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <ul className="space-y-1.5">
        {sources.slice(0, 6).map((s, i) => (
          <AiSourceLink key={`${s.label}-${i}`} source={s} />
        ))}
      </ul>
    </div>
  );
}

// ---------- meta line (model + freshness) ----------

export function AiMetaLine({ modelLabel, generatedAt, freshnessLabel, className }: { modelLabel?: string; generatedAt?: number; freshnessLabel?: string; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400", className)}>
      <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
      {modelLabel && <span>{modelLabel}</span>}
      {generatedAt && <span>· generated {new Date(generatedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>}
      {freshnessLabel && <span>· {freshnessLabel}</span>}
    </p>
  );
}

// ---------- feedback ----------

const FEEDBACK_ITEMS: { kind: AiFeedbackKind; label: string; icon: React.ReactNode }[] = [
  { kind: "helpful", label: "Helpful", icon: <ThumbsUp className="h-3 w-3" aria-hidden /> },
  { kind: "not_helpful", label: "Not helpful", icon: <ThumbsDown className="h-3 w-3" aria-hidden /> },
  { kind: "incorrect", label: "Incorrect", icon: <Frown className="h-3 w-3" aria-hidden /> },
  { kind: "outdated", label: "Outdated", icon: <Meh className="h-3 w-3" aria-hidden /> },
];

export function AiFeedbackBar({ refType, refId, compact }: { refType: string; refId: string; compact?: boolean }) {
  const { role } = useRole();
  const { toast } = useToast();
  const [sent, setSent] = React.useState<AiFeedbackKind | null>(null);
  const [busy, setBusy] = React.useState(false);

  const send = async (kind: AiFeedbackKind) => {
    setBusy(true);
    try {
      await aiPost("feedback", { refType, refId, kind }, role);
      setSent(kind);
      toast({ title: "Feedback recorded", description: "It feeds AI quality review — thank you." });
    } catch {
      toast({ variant: "destructive", title: "Feedback not recorded", description: "The Sales AI service is unreachable right now." });
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Smile className="h-3 w-3" aria-hidden /> Feedback recorded ({sent.replace("_", " ")}).
      </p>
    );
  }
  return (
    <div className={cn("mt-2.5 flex flex-wrap items-center gap-1.5", compact && "mt-2")} role="group" aria-label="Rate this AI output">
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-slate-300">Feedback</span>
      {FEEDBACK_ITEMS.map((f) => (
        <button
          key={f.kind}
          type="button"
          disabled={busy}
          onClick={() => send(f.kind)}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
        >
          {f.icon}
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ---------- insight card ----------

const KIND_TONE: Record<AiInsight["kind"], { icon: React.ReactNode; chip: string }> = {
  risk: { icon: <TriangleAlert className="h-3.5 w-3.5" aria-hidden />, chip: "border-red-200 bg-red-50 text-red-700" },
  attention: { icon: <Lightbulb className="h-3.5 w-3.5" aria-hidden />, chip: "border-amber-200 bg-amber-50 text-amber-700" },
  change: { icon: <RefreshCw className="h-3.5 w-3.5" aria-hidden />, chip: "border-blue-200 bg-blue-50 text-blue-700" },
  opportunity: { icon: <Sparkles className="h-3.5 w-3.5" aria-hidden />, chip: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};

export function AiInsightCard({
  insight,
  onDismiss,
  compact,
}: {
  insight: AiInsight;
  onDismiss?: (id: string) => void;
  compact?: boolean;
}) {
  const nav = useQubitNav();
  const tone = KIND_TONE[insight.kind];
  const [openEvidence, setOpenEvidence] = React.useState(false);

  return (
    <article className="qubit-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className={cn("qubit-icon-tile mt-0.5 h-7 w-7 shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5", tone.chip)}>{tone.icon}</span>
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-semibold leading-snug text-slate-900">{insight.title}</h3>
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <AiLadderTag kind="INFERENCE" />
              <AiConfidenceBadge confidence={insight.confidence} compact />
            </p>
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={() => onDismiss(insight.id)}
            className="shrink-0 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
            aria-label={`Dismiss insight: ${insight.title}`}
          >
            Dismiss
          </button>
        )}
      </div>

      <p className={cn("mt-2.5 text-[13px] leading-relaxed text-slate-600", compact && "line-clamp-3")}>{insight.statement}</p>

      {!compact && insight.facts.length > 0 && (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
          <p className="mb-1 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
            <Quote className="h-3 w-3" aria-hidden /> Facts behind this
          </p>
          <ul className="space-y-1">
            {insight.facts.map((f, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-slate-600">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {openEvidence && <AiSourceList sources={insight.evidence} title="Evidence — open the source records" />}
      {!openEvidence && insight.evidence.length > 0 && (
        <button
          type="button"
          onClick={() => setOpenEvidence(true)}
          className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-blue-600 transition-colors hover:text-blue-700"
        >
          <BookOpenCheck className="h-3.5 w-3.5" aria-hidden /> Inspect evidence ({insight.evidence.length})
        </button>
      )}

      {insight.action && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-[12px]"
            onClick={() => {
              const param = insight.action!.param ?? "id";
              nav.navigate(insight.action!.screen as ScreenId, { [param]: insight.action!.id } as ScreenParams);
            }}
          >
            {insight.action.label}
          </Button>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <AiMetaLine modelLabel="Qubit AI runtime" generatedAt={insight.generatedAt} freshnessLabel={insight.freshnessLabel} />
      </div>
      <AiFeedbackBar refType="insight" refId={insight.id} />
    </article>
  );
}

// ---------- recommendation card ----------

const URGENCY_TONE: Record<AiRecommendation["urgency"], string> = {
  High: "border-red-200 bg-red-50 text-red-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-slate-200 bg-slate-50 text-slate-500",
};

export function AiRecommendationCard({
  recommendation,
  onAccept,
  onDismiss,
  busy,
  acceptLabel = "Accept",
}: {
  recommendation: AiRecommendation;
  onAccept?: (rec: AiRecommendation) => void;
  onDismiss?: (rec: AiRecommendation) => void;
  busy?: boolean;
  acceptLabel?: string;
}) {
  const nav = useQubitNav();
  const rec = recommendation;
  const handled = rec.status !== "open";
  return (
    <article className={cn("qubit-card p-4", handled && "opacity-70")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5">
            <AiLadderTag kind="RECOMMENDATION" />
            <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold", URGENCY_TONE[rec.urgency])}>{rec.urgency} urgency</span>
            <AiConfidenceBadge confidence={rec.confidence} compact />
            {handled && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] font-medium text-slate-500">{rec.status === "accepted" ? "Accepted" : "Dismissed"}</span>}
          </p>
          <h3 className="mt-2 text-[13.5px] font-semibold leading-snug text-slate-900">{rec.action}</h3>
        </div>
      </div>

      <button
        type="button"
        onClick={() => nav.navigate(rec.entity.screen as ScreenId, { [rec.entity.param]: rec.entity.id } as ScreenParams)}
        className="mt-1.5 inline-flex max-w-full items-center gap-1 text-[12.5px] font-medium text-blue-600 transition-colors hover:text-blue-700"
      >
        <span className="truncate">{rec.entity.label}</span>
        <span className="rounded border border-slate-200 bg-slate-50 px-1 py-px text-[9.5px] font-medium uppercase tracking-wide text-slate-500">{rec.entity.kind}</span>
      </button>

      <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{rec.reason}</p>

      {rec.expectedImpact && (
        <p className="mt-2 text-[12.5px] text-slate-500">
          <span className="font-medium text-slate-600">Expected impact:</span> {rec.expectedImpact}
        </p>
      )}

      <AiSourceList sources={rec.evidence} title="Evidence" />

      <p className="mt-2.5 text-[11px] text-slate-400">
        <Check className="mr-1 inline h-3 w-3" aria-hidden />
        Routes into existing workflow: {rec.routesTo}. AI never executes consequential actions without your confirmation.
      </p>

      {!handled && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onAccept && (
            <Button size="sm" className="h-8 gap-1.5" disabled={busy} onClick={() => onAccept(rec)}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
              {acceptLabel}
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={busy} onClick={() => onDismiss(rec)}>
              Dismiss
            </Button>
          )}
        </div>
      )}

      <AiMetaLine generatedAt={rec.generatedAt} />
      {!handled && <AiFeedbackBar refType="recommendation" refId={rec.id} />}
    </article>
  );
}

// ---------- degraded / unavailable states ----------

export function AiUnavailableBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="qubit-card mb-3 flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50/60 px-4 py-3" role="status">
      <p className="text-sm font-medium text-amber-800">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
        </Button>
      )}
    </div>
  );
}

export const AI_UNAVAILABLE_TEXT = "Sales AI is temporarily unavailable. Your Sales workspace is still fully available — this surface will recover on its own.";

// ---------- skeleton ----------

export function AiSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="qubit-card p-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
            <div className="h-5 w-28 animate-pulse rounded-full bg-slate-100" />
          </div>
          <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="mt-2.5 h-3 w-full animate-pulse rounded bg-slate-100" />
          <div className="mt-1.5 h-3 w-4/5 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
      <span className="sr-only" role="status">
        Loading Sales AI…
      </span>
    </div>
  );
}

// ---------- thinking indicator (Q&A / writer) ----------

export function AiThinking({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-[13px] text-slate-500" role="status" aria-live="polite">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden />
      {label}
    </p>
  );
}

// ---------- scope note ----------

export function AiScopeNote({ scope, what }: { scope: string | null | undefined; what: string }) {
  if (!scope) return null;
  const label = scope === "company" ? "Company-wide" : scope === "team" ? "Your teams" : "Your records";
  return (
    <p className="text-[11px] text-slate-400">
      {label} view — the AI only retrieved {what} you are authorized to see. Authorization is enforced by the server before every retrieval; the AI cannot bypass it.
    </p>
  );
}
