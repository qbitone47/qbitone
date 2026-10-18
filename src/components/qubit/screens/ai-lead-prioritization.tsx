"use client";

import * as React from "react";
import { ChevronDown, CircleHelp, Info, ListChecks, RefreshCw, ShieldQuestion, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "../page-header";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, EmptyState, StatTile } from "../primitives";
import { FormDialog, Field } from "../dialogs";
import { useToast } from "@/hooks/use-toast";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { cn } from "@/lib/utils";
import {
  AiGovernanceStrip,
  AiMetaLine,
  AiScopeNote,
  AiSkeleton,
  AiUnavailableBanner,
  SalesAiGate,
  aiPost,
  useSalesAiSection,
} from "../ai/parts";
import type { AiSourceRef } from "@/lib/qubit/sales-ai-data";
import { EntityLink, fmtDateTime, fmtRupees, relTime, salesPost } from "../sales/parts";
import { PriorityBadge, ScoreBar } from "../sales/parts";

// ============================================================
// Screen 104 · AI Lead Prioritization — which leads deserve
// attention first. The ranking is a transparent weighted signal
// model: every factor, weight and contribution is inspectable
// ("Why this ranking?"). Leads with too few signals get
// "Insufficient data" — never a fabricated score. Ranking never
// overrides the lead's actual business status.
// ============================================================

interface PriorRow {
  leadId: string;
  name: string;
  company: string;
  ownerName: string;
  ownerId: string;
  isMine: boolean;
  status: string;
  priority: string;
  aiScore?: number;
  confidence: string;
  urgency: "High" | "Medium" | "Low";
  reason: string;
  factors: { key: string; label: string; contribution: number; max: number; note: string }[];
  lastActivityAt?: number;
  nextFollowUpAt?: number;
  estimatedValueCr: number;
  evidence: AiSourceRef[];
  recommendedAction: { label: string; verb: string; screen: string; param?: string; id?: string };
  dismissed?: boolean;
}

interface PriorPayload {
  scope: "company" | "team" | "own";
  methodology: { model: string; updated: string; factors: { key: string; label: string; weight: number; description: string }[]; note: string };
  rows: PriorRow[];
  counts: { high: number; medium: number; low: number; insufficient: number };
  generatedAt: number;
  freshnessLabel: string;
  modelLabel: string;
}

type FilterKey = "all" | "high" | "mine" | "insufficient";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All ranked leads" },
  { key: "high", label: "High priority" },
  { key: "mine", label: "Owned by me" },
  { key: "insufficient", label: "Insufficient data" },
];

export function AiLeadPrioritizationScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { toast } = useToast();
  const { data, loading, error, forbidden, reload } = useSalesAiSection<PriorPayload>("prioritization");
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [methodologyOpen, setMethodologyOpen] = React.useState(false);
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const [followUpTarget, setFollowUpTarget] = React.useState<PriorRow | null>(null);
  const [followUpDue, setFollowUpDue] = React.useState("");
  const [followUpBusy, setFollowUpBusy] = React.useState(false);
  const [followUpError, setFollowUpError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const rows = React.useMemo(() => {
    const base = (data?.rows ?? []).filter((r) => !dismissed.has(r.leadId));
    switch (filter) {
      case "high": return base.filter((r) => r.urgency === "High");
      case "mine": return base.filter((r) => r.isMine);
      case "insufficient": return base.filter((r) => r.confidence === "Insufficient data");
      default: return base;
    }
  }, [data, filter, dismissed]);

  const dismiss = async (row: PriorRow) => {
    setBusyId(row.leadId);
    try {
      await aiPost("prioritization.dismiss", { id: row.leadId }, role);
      setDismissed((prev) => new Set(prev).add(row.leadId));
      toast({ title: "Removed from the AI ranking", description: `${row.name} keeps its actual business status — only the AI view changed.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Not dismissed", description: err instanceof Error ? err.message : "The Sales AI service is unreachable." });
    } finally {
      setBusyId(null);
    }
  };

  if (forbidden) {
    return (
      <SalesAiGate screenName="AI Lead Prioritization">
        <></>
      </SalesAiGate>
    );
  }

  const c = data?.counts;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Sales AI" }, { label: "Lead Prioritization" }]}
        title="AI Lead Prioritization"
        description="Which leads deserve attention first — ranked by an explainable signal model over your authorized leads. Inspect every factor; insufficient data is reported, never scored."
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setMethodologyOpen(true)}>
              <CircleHelp className="h-3.5 w-3.5" aria-hidden /> Why this ranking?
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={reload} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5${loading ? " animate-spin" : ""}`} aria-hidden /> Re-rank
            </Button>
          </>
        }
      />

      <AiGovernanceStrip
        note="Ranking is computed from authorized sales records only — engagement recency, follow-up state, value, qualification, source quality and response signals. AI ranking never overrides a lead's actual business status; actions route into the existing lead workflows."
        meta={data ? `${data.methodology.model} · ${data.modelLabel}` : undefined}
      />

      {error && <AiUnavailableBanner message={error} onRetry={reload} />}
      {loading && <AiSkeleton rows={4} />}

      {data && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={<Sparkles />} value={String(c?.high ?? 0)} label="High priority — act now" onClick={() => setFilter("high")} />
            <StatTile icon={<ListChecks />} value={String(c?.medium ?? 0)} label="Medium priority — this week" onClick={() => setFilter("all")} />
            <StatTile icon={<ShieldQuestion />} value={String(c?.insufficient ?? 0)} label="Insufficient data — honest gap, not a score" onClick={() => setFilter("insufficient")} />
            <StatTile icon={<Info />} value={String(data.rows.length)} label="Leads in your authorized scope" onClick={() => setFilter("all")} />
          </div>
          <AiScopeNote scope={data.scope} what="leads" />

          {/* filter pills */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter ranked leads">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === f.key ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={<Sparkles />}
              title="Nothing in this view"
              message="No leads match this filter in your authorized scope. Switch filters, or work the queue from the Lead Inbox."
            />
          ) : (
            <ol className="space-y-3" aria-label="AI-ranked leads">
              {rows.map((r, idx) => {
                const insufficient = r.confidence === "Insufficient data";
                const isOpen = expanded === r.leadId;
                return (
                  <li key={r.leadId} className="qubit-card p-4">
                    <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[12px] font-semibold tabular-nums text-slate-500" aria-label={`Rank ${idx + 1}`}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <EntityLink screen="lead-detail" id={r.leadId} label={r.name} kind="lead" />
                          <span className="text-[12.5px] text-slate-500">· {r.company}</span>
                          <PriorityBadge priority={(r.priority as "Hot" | "Warm" | "Cold") ?? "Warm"} size="sm" />
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Avatar name={r.ownerName} size="xs" /> {r.ownerName}
                          </span>
                          <span>· Last activity {r.lastActivityAt ? relTime(r.lastActivityAt) : "— none recorded"}</span>
                          <span>· Next follow-up {r.nextFollowUpAt ? fmtDateTime(r.nextFollowUpAt) : "— not scheduled"}</span>
                          <span>· Est. value {r.estimatedValueCr > 0 ? fmtRupees(r.estimatedValueCr) : "not set"}</span>
                        </p>
                        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                          {!insufficient && <span className="mr-1.5 inline-flex items-center rounded border border-violet-200 bg-violet-50 px-1 py-px text-[9.5px] font-bold uppercase tracking-wider text-violet-700">Inference</span>}
                          {r.reason}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {insufficient ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800" title="Too few signals to score honestly">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden /> Insufficient data
                          </span>
                        ) : (
                          <ScoreBar score={r.aiScore ?? 0} />
                        )}
                        <span className="text-[10.5px] uppercase tracking-wide text-slate-400">{r.urgency} priority</span>
                      </div>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setExpanded(isOpen ? null : r.leadId)}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
                      >
                        Why? <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} aria-hidden />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 lg:grid-cols-2">
                        {/* factor breakdown — the model is inspectable */}
                        <div>
                          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Score factors {insufficient && "(scoring withheld)"}</p>
                          <ul className="space-y-2">
                            {r.factors.map((f) => (
                              <li key={f.key} className="flex items-center gap-2.5">
                                <span className="w-36 shrink-0 truncate text-[12px] font-medium text-slate-600">{f.label}</span>
                                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${f.label}: ${f.contribution} of ${f.max}`}>
                                  <span className="block h-full rounded-full bg-blue-500" style={{ width: `${Math.round((f.contribution / f.max) * 100)}%` }} />
                                </span>
                                <span className="w-24 shrink-0 truncate text-[11px] text-slate-400" title={f.note}>{f.note}</span>
                                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-slate-500">{f.contribution}/{f.max}</span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 text-[11px] text-slate-400">Total {r.aiScore ?? "—"}/100 · weights published in “Why this ranking?”.</p>
                        </div>

                        {/* evidence + actions */}
                        <div>
                          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Primary evidence</p>
                          <ul className="space-y-1.5">
                            {r.evidence.map((e, i) => (
                              <li key={i} className="text-[12.5px] text-slate-600">
                                <EntityLink screen={(e.screen ?? "lead-detail") as never} id={e.id ?? r.leadId} label={e.label} kind={e.kind} />
                                {e.detail && <span className="block text-[11px] text-slate-400">{e.detail}</span>}
                              </li>
                            ))}
                          </ul>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => {
                                if (r.recommendedAction.verb === "schedule-followup") setFollowUpTarget(r);
                                else nav.navigate("lead-detail" as never, { leadId: r.leadId });
                              }}
                            >
                              {r.recommendedAction.label}
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => nav.navigate("lead-detail" as never, { leadId: r.leadId })}>
                              Open lead
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-slate-500" disabled={busyId === r.leadId} onClick={() => dismiss(r)}>
                              Dismiss recommendation
                            </Button>
                          </div>
                          <AiMetaLine generatedAt={data.generatedAt} freshnessLabel={data.freshnessLabel} className="mt-2.5" />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {/* Why this ranking? — published methodology */}
      <Dialog open={methodologyOpen} onOpenChange={setMethodologyOpen}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Why this ranking?</DialogTitle>
            <DialogDescription>
              {data?.methodology.model} — every factor, weight and contribution is inspectable on each lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            {(data?.methodology.factors ?? []).map((f) => (
              <div key={f.key} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <p className="flex items-center justify-between text-[13px] font-medium text-slate-800">
                  {f.label}
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-px text-[10.5px] font-semibold tabular-nums text-slate-500">{f.weight} pts</span>
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{f.description}</p>
              </div>
            ))}
            <p className="text-[12px] leading-relaxed text-slate-500">{data?.methodology.note}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* schedule follow-up — routed through the existing lead workflow */}
      <FormDialog
        open={!!followUpTarget}
        onOpenChange={(o) => {
          if (!o) {
            setFollowUpTarget(null);
            setFollowUpError(null);
          }
        }}
        title="Schedule follow-up"
        description={followUpTarget ? `For ${followUpTarget.name} — ${followUpTarget.company}. This runs the existing lead follow-up workflow and appears in the Follow-up Queue (84).` : ""}
        submitLabel="Schedule"
        submitting={followUpBusy}
        onSubmit={async () => {
          if (!followUpTarget) return;
          const ts = followUpDue ? new Date(followUpDue).getTime() : Date.now() + 24 * 3_600_000;
          if (Number.isNaN(ts) || ts < Date.now() - 60_000) {
            setFollowUpError("Pick a future date and time.");
            return;
          }
          setFollowUpBusy(true);
          setFollowUpError(null);
          try {
            const res = await salesPost("lead.followup", { id: followUpTarget.leadId, dueAt: ts, type: "Call", subject: `AI-recommended follow-up — ${followUpTarget.name}`, priority: followUpTarget.urgency === "High" ? "High" : "Medium" }, role);
            toast({ title: res.message ?? "Follow-up scheduled", description: "Routed through the existing lead workflow — visible in the Follow-up Queue and audited." });
            setFollowUpTarget(null);
            reload();
          } catch (err) {
            setFollowUpError(err instanceof Error ? err.message : "The follow-up could not be scheduled.");
          } finally {
            setFollowUpBusy(false);
          }
        }}
      >
        {followUpError && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700" role="alert">{followUpError}</p>
        )}
        <Field label="When" required hint="Defaults to 24 hours from now — the recommendation's suggested window.">
          <Input
            type="datetime-local"
            value={followUpDue}
            onChange={(e) => setFollowUpDue(e.target.value)}
            aria-label="Follow-up date and time"
          />
        </Field>
      </FormDialog>
    </div>
  );
}
