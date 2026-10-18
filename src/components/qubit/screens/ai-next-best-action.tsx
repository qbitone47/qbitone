"use client";

import * as React from "react";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "../page-header";
import { ConfirmDialog, FormDialog, Field } from "../dialogs";
import { EmptyState, SectionCard, StatTile } from "../primitives";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "../role-context";
import {
  AiGovernanceStrip,
  AiRecommendationCard,
  AiScopeNote,
  AiSkeleton,
  AiUnavailableBanner,
  SalesAiGate,
  aiPost,
  useSalesAiSection,
} from "../ai/parts";
import type { AiRecommendation } from "@/lib/qubit/sales-ai-data";

// ============================================================
// Screen 107 · AI Next Best Action — "what should I do next?".
// Recommendations carry reason, evidence, urgency, expected
// impact and confidence. Accepting a consequential recommendation
// ALWAYS goes Review → Confirmation → existing Qubit workflow →
// audit. Non-consequential verbs route to the owning workspace —
// acceptance records intent, never a silent mutation.
// ============================================================

interface NbaPayload {
  scope: "company" | "team" | "own";
  recommendations: AiRecommendation[];
  generatedAt: number;
  freshnessLabel: string;
  modelLabel: string;
}

type AcceptFlow =
  | { kind: "schedule"; rec: AiRecommendation }
  | { kind: "outcome"; rec: AiRecommendation }
  | { kind: "route"; rec: AiRecommendation };

export function AiNextBestActionScreen() {
  const { role } = useRole();
  const { toast } = useToast();
  const { data, loading, error, forbidden, reload } = useSalesAiSection<NbaPayload>("nba");
  const [flow, setFlow] = React.useState<AcceptFlow | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [dismissTarget, setDismissTarget] = React.useState<AiRecommendation | null>(null);
  const [dismissReason, setDismissReason] = React.useState("");
  const [dueInput, setDueInput] = React.useState("");
  const [outcomeInput, setOutcomeInput] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  const open = data?.recommendations ?? [];
  const highCount = open.filter((r) => r.urgency === "High").length;
  const mediumCount = open.filter((r) => r.urgency === "Medium").length;

  const accept = (rec: AiRecommendation) => {
    // Every verb gets the flow that matches its consequence level.
    if (rec.verb === "schedule-followup" && rec.entity.kind === "lead") setFlow({ kind: "schedule", rec });
    else if (rec.entity.kind === "followup" && rec.verb === "contact") setFlow({ kind: "outcome", rec });
    else setFlow({ kind: "route", rec });
  };

  const confirmAccept = async () => {
    if (!flow) return;
    setBusyId(flow.rec.id);
    try {
      if (flow.kind === "schedule") {
        const ts = dueInput ? new Date(dueInput).getTime() : Date.now() + 24 * 3_600_000;
        if (Number.isNaN(ts) || ts < Date.now() - 60_000) {
          setFormError("Pick a future date and time.");
          return;
        }
        const res = await aiPost("recommendation.accept", { id: flow.rec.id, confirm: true, dueAt: ts }, role);
        toast({ title: "Accepted — follow-up scheduled", description: res.message });
      } else if (flow.kind === "outcome") {
        if (outcomeInput.trim().length < 3) {
          setFormError("Record a short outcome — the existing Follow-up Queue workflow requires it.");
          return;
        }
        const res = await aiPost("recommendation.accept", { id: flow.rec.id, confirm: true, outcome: outcomeInput.trim() }, role);
        toast({ title: "Accepted — outcome recorded", description: res.message });
      } else {
        const res = await aiPost("recommendation.accept", { id: flow.rec.id, confirm: true }, role);
        toast({ title: "Accepted", description: res.message });
      }
      setFlow(null);
      setFormError(null);
      setOutcomeInput("");
      setDueInput("");
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "The action could not be executed.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDismiss = async () => {
    if (!dismissTarget) return;
    setBusyId(dismissTarget.id);
    try {
      const res = await aiPost("recommendation.dismiss", { id: dismissTarget.id, reason: dismissReason.trim() || undefined }, role);
      toast({ title: "Dismissed", description: res.message });
      setDismissTarget(null);
      setDismissReason("");
      reload();
    } catch (err) {
      toast({ variant: "destructive", title: "Not dismissed", description: err instanceof Error ? err.message : "The Sales AI service is unreachable." });
    } finally {
      setBusyId(null);
    }
  };

  if (forbidden) {
    return (
      <SalesAiGate screenName="AI Next Best Action">
        <></>
      </SalesAiGate>
    );
  }

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Sales AI" }, { label: "Next Best Action" }]}
        title="AI Next Best Action"
        description="What should you do next? Recommendations are grounded in your authorized pipeline, follow-ups and quotations — each carries its reason, evidence and urgency. Accepting never bypasses the existing workflows."
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={reload} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5${loading ? " animate-spin" : ""}`} aria-hidden /> Re-evaluate
          </Button>
        }
      />

      <AiGovernanceStrip
        note="Accepting a recommendation either routes into the existing Qubit workflow (with your confirmation) or records the intent and takes you to the owning workspace. High-impact changes — stage moves, sends, approvals — are never executed by AI alone."
        meta={data ? `Evaluated ${new Date(data.generatedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} IST · ${data.modelLabel}` : undefined}
      />

      {error && <AiUnavailableBanner message={error} onRetry={reload} />}
      {loading && <AiSkeleton rows={4} />}

      {data && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile icon={<Check />} value={String(highCount)} label={highCount > 0 ? "High-urgency actions waiting on you" : "No high-urgency actions"} />
            <StatTile value={String(mediumCount)} label="Medium-urgency recommendations" />
            <StatTile value={String(open.length)} label="Open recommendations in your scope" />
          </div>
          <AiScopeNote scope={data.scope} what="your pipeline, follow-ups and quotations" />

          {open.length === 0 ? (
            <EmptyState
              icon={<Check />}
              title="No open recommendations"
              message="The model found no urgent gaps in your authorized scope. Re-evaluate after your next customer touch, or continue in Sales Home (73)."
            />
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              {open.map((r) => (
                <AiRecommendationCard
                  key={r.id}
                  recommendation={r}
                  busy={busyId === r.id}
                  acceptLabel={r.verb === "schedule-followup" ? "Accept & schedule" : r.entity.kind === "followup" ? "Accept & complete" : "Accept & continue"}
                  onAccept={accept}
                  onDismiss={(rec) => setDismissTarget(rec)}
                />
              ))}
            </div>
          )}

          {open.length === 0 && (
            <SectionCard title="Why so quiet?" description="How recommendations are produced">
              <ul className="space-y-1.5 text-[13px] leading-relaxed text-slate-600">
                <li>· Overdue follow-ups in your scope would appear here immediately.</li>
                <li>· Leads scoring ≥60 on the explainable prioritization model without a scheduled follow-up are proposed.</li>
                <li>· Stalled opportunities, viewed-but-silent quotations and agenda-less meetings are surfaced with their evidence.</li>
                <li>· When nothing clears the bar, the model stays quiet instead of inventing busywork.</li>
              </ul>
            </SectionCard>
          )}
        </div>
      )}

      {/* ---- confirmation flows: Review → Confirm → existing workflow → audit ---- */}

      <ConfirmDialog
        open={flow?.kind === "route"}
        onOpenChange={(o) => {
          if (!o) {
            setFlow(null);
            setFormError(null);
          }
        }}
        title="Accept this recommendation?"
        description={
          flow
            ? `“${flow.rec.action}” continues in the existing workspace — ${flow.rec.routesTo}. Nothing is changed automatically: the accept records your intent, is audited, and takes you to the record.`
            : ""
        }
        confirmLabel={busyId === flow?.rec.id ? "Accepting…" : "Accept & continue"}
        onConfirm={confirmAccept}
      >
        {formError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700" role="alert">{formError}</p>}
      </ConfirmDialog>

      <FormDialog
        open={flow?.kind === "schedule"}
        onOpenChange={(o) => {
          if (!o) {
            setFlow(null);
            setFormError(null);
          }
        }}
        title="Accept & schedule follow-up"
        description={flow ? `For ${flow.rec.entity.label}. The follow-up is created by the existing lead workflow — the same path Sales uses, then audited.` : ""}
        submitLabel="Confirm & schedule"
        submitting={busyId === flow?.rec.id}
        onSubmit={confirmAccept}
      >
        {formError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700" role="alert">{formError}</p>}
        <Field label="When" required hint="The recommendation suggests within 24 hours.">
          <Input type="datetime-local" value={dueInput} onChange={(e) => setDueInput(e.target.value)} aria-label="Follow-up date and time" />
        </Field>
      </FormDialog>

      <FormDialog
        open={flow?.kind === "outcome"}
        onOpenChange={(o) => {
          if (!o) {
            setFlow(null);
            setFormError(null);
          }
        }}
        title="Complete the overdue follow-up"
        description={flow ? `“${flow.rec.entity.label}” — the outcome is written to the customer timeline by the existing Follow-up Queue workflow.` : ""}
        submitLabel="Confirm & complete"
        submitting={busyId === flow?.rec.id}
        onSubmit={confirmAccept}
      >
        {formError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700" role="alert">{formError}</p>}
        <Field label="Outcome" required hint="What happened, what was agreed, what happens next.">
          <Textarea rows={3} value={outcomeInput} onChange={(e) => setOutcomeInput(e.target.value)} aria-label="Outcome" />
        </Field>
      </FormDialog>

      <FormDialog
        open={dismissTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDismissTarget(null);
            setDismissReason("");
          }
        }}
        title="Dismiss recommendation"
        description={dismissTarget ? `“${dismissTarget.action}” — dismissed recommendations stay dismissed for this session and feed AI quality review.` : ""}
        submitLabel="Dismiss"
        submitting={busyId === dismissTarget?.id}
        onSubmit={async () => {
          await confirmDismiss();
        }}
      >
        <Field label="Reason (optional)" hint="Helps the model understand what was wrong.">
          <Input value={dismissReason} onChange={(e) => setDismissReason(e.target.value)} placeholder="e.g. customer asked to pause outreach" aria-label="Dismissal reason" />
        </Field>
      </FormDialog>
    </div>
  );
}
