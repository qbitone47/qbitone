"use client";

import * as React from "react";
import { CalendarClock, Check, ChevronRight, Coffee, RefreshCw, Sparkles, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "../page-header";
import { FormDialog, Field } from "../dialogs";
import { EmptyState } from "../primitives";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "../role-context";
import { useQubitNav } from "../nav-context";
import { cn } from "@/lib/utils";
import {
  AiGovernanceStrip,
  AiMetaLine,
  AiScopeNote,
  AiSkeleton,
  AiTag,
  AiUnavailableBanner,
  SalesAiGate,
  aiPost,
  useSalesAiSection,
} from "../ai/parts";
import type { BriefSection, DailyBrief } from "@/lib/qubit/sales-ai-data";
import { relTime } from "../sales/parts";

// ============================================================
// Screen 109 · AI Daily Brief — what matters TODAY, personalized
// by role: salespeople see their own work; managers see team
// exceptions; executives only what their role authorizes.
// Concise by design (max 4 items per section + view-all). Items
// deep-link into the EXISTING Qubit screens — the brief creates
// no separate task or notification system. Completing a follow-up
// routes through the existing Follow-up Queue workflow.
// ============================================================

interface BriefPayload {
  brief: DailyBrief;
  cached: boolean;
  scope: "company" | "team" | "own";
}

export function AiDailyBriefScreen() {
  const { role } = useRole();
  const { toast } = useToast();
  const { data, loading, error, forbidden, reload } = useSalesAiSection<BriefPayload>("brief");
  const [completeTarget, setCompleteTarget] = React.useState<{ followupId: string; title: string } | null>(null);
  const [outcome, setOutcome] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const refresh = async () => {
    // refresh bypasses the server cache via the refresh param
    const res = await fetch("/api/sales-ai?section=brief&refresh=1", {
      headers: { "X-Qubit-Role": role, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      reload();
      toast({ title: "Brief refreshed", description: "Recomputed from your live, authorized sales data." });
    }
  };

  const completeFollowUp = async () => {
    if (!completeTarget) return;
    if (outcome.trim().length < 3) {
      setFormError("Record a short outcome — the existing workflow requires it.");
      return;
    }
    setBusy(true);
    try {
      const res = await aiPost("brief.complete", { followupId: completeTarget.followupId, outcome: outcome.trim() }, role);
      toast({ title: "Marked complete", description: res.message });
      setCompleteTarget(null);
      setOutcome("");
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "The follow-up could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  if (forbidden) {
    return (
      <SalesAiGate screenName="AI Daily Brief">
        <></>
      </SalesAiGate>
    );
  }

  const brief = data?.brief;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Sales AI" }, { label: "Daily Brief" }]}
        title="AI Daily Brief"
        description="A personalized, concise read of what matters today — priorities, meetings, follow-ups, target progress and risks, composed from your authorized sales data."
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5${loading ? " animate-spin" : ""}`} aria-hidden /> Refresh brief
          </Button>
        }
      />

      <AiGovernanceStrip
        note="The brief is generated from live data in your scope and deep-links into the existing Qubit workflows — it does not create a parallel task or notification system. Completing a follow-up here runs the same audited Follow-up Queue workflow."
        meta={brief ? `${brief.freshnessLabel} · personalized for ${brief.role}` : undefined}
      />

      {error && <AiUnavailableBanner message={error} onRetry={reload} />}
      {loading && <AiSkeleton rows={5} />}

      {brief && !loading && (
        <div className="mx-auto max-w-4xl space-y-4">
          {/* header */}
          <div className="qubit-card px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" aria-hidden />
              <h2 className="text-[15px] font-semibold text-slate-900">{brief.greeting} Today's sales brief</h2>
              <AiTag label={data?.cached ? "Brief (cached)" : "AI-generated brief"} />
            </div>
            <p className="mt-1 text-[12.5px] text-slate-500">{brief.dateLabel} · {brief.role} view</p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{brief.introLine}</p>
            {brief.totalItems === 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-emerald-700">
                <Coffee className="h-3.5 w-3.5" aria-hidden /> Nothing urgent in your authorized scope — enjoy the calm.
              </p>
            )}
            <AiMetaLine generatedAt={brief.generatedAt} className="mt-2" />
          </div>

          {/* sections 1–10, numbered per spec */}
          {brief.sections.every((s) => s.items.length === 0) ? (
            <EmptyState
              icon={<Sparkles />}
              title="A clean brief"
              message="Every section came back empty for your scope — no overdue work, no meetings, no risk signals. Check back after your next customer touch."
            />
          ) : (
            <div className="space-y-3">
              {brief.sections.map((s) => (
                <BriefSectionCard key={s.key} section={s} onOpenFollowUpDialog={(f) => setCompleteTarget(f)} />
              ))}
            </div>
          )}

          <AiScopeNote scope={brief.scope} what="today's work" />
          <p className="text-[11px] text-slate-400">
            Items link into Sales Home (73), Follow-up Queue (84), Customer Meetings (85) and the AI surfaces — one system, no shadow queues.
          </p>
        </div>
      )}

      {/* complete follow-up — existing workflow */}
      <FormDialog
        open={completeTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setCompleteTarget(null);
            setFormError(null);
          }
        }}
        title="Mark follow-up complete"
        description={completeTarget ? `“${completeTarget.title}” — the outcome is written to the customer timeline via the existing Follow-up Queue workflow.` : ""}
        submitLabel="Complete follow-up"
        submitting={busy}
        onSubmit={completeFollowUp}
      >
        {formError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700" role="alert">{formError}</p>}
        <Field label="Outcome" required hint="What happened, what was agreed, what happens next.">
          <Textarea rows={3} value={outcome} onChange={(e) => setOutcome(e.target.value)} aria-label="Outcome" />
        </Field>
      </FormDialog>
    </div>
  );
}

function BriefSectionCard({ section, onOpenFollowUpDialog }: { section: BriefSection; onOpenFollowUpDialog: (f: { followupId: string; title: string }) => void }) {
  const nav = useQubitNav();
  if (section.items.length === 0) {
    return (
      <div className="qubit-card flex items-center gap-3 px-4 py-3 opacity-60">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold tabular-nums text-slate-400">{section.no}</span>
        <p className="text-[13px] font-medium text-slate-500">{section.title}</p>
        <span className="ml-auto text-[11.5px] text-slate-400">Nothing today</span>
      </div>
    );
  }
  return (
    <section className="qubit-card px-4 py-3.5" aria-label={section.title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold tabular-nums text-blue-700">{section.no}</span>
          {section.title}
          <span className="text-[11px] font-normal text-slate-400">({section.items.length})</span>
        </h3>
        {section.moreScreen && section.moreLabel && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[12px] text-slate-500" onClick={() => nav.navigate(section.moreScreen as never)}>
            {section.moreLabel} <ChevronRight className="h-3 w-3" aria-hidden />
          </Button>
        )}
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {section.items.map((item) => (
          <li key={item.id} className="group flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 transition-colors hover:border-slate-200 hover:bg-white">
            <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", item.state === "Overdue" ? "bg-red-500" : item.state === "Due Today" ? "bg-amber-500" : "bg-blue-400")} aria-hidden />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => nav.navigate(item.screen as never, item.param && item.entityId ? { [item.param]: item.entityId } : undefined)}
                className="block w-full text-left text-[13px] font-medium leading-snug text-slate-800 transition-colors hover:text-blue-700"
              >
                {item.title}
              </button>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-slate-500">
                {item.detail && <span>{item.detail}</span>}
                {item.at != null && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" aria-hidden /> {relTime(item.at)}
                  </span>
                )}
              </p>
            </div>
            {item.completable && item.followupId && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 gap-1 text-[11.5px] text-slate-500"
                onClick={() => onOpenFollowUpDialog({ followupId: item.followupId!, title: item.title })}
              >
                <Check className="h-3.5 w-3.5" aria-hidden /> Complete
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
