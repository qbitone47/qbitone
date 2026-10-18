"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  FileText,
  IndianRupee,
  ListChecks,
  PencilLine,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormDialog } from "../dialogs";
import { PageHeader } from "../page-header";
import { ArrowLink, EmptyState, KV, SectionCard, StatTile, StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import {
  ActivityTimeline,
  EntityLink,
  fmtCr,
  fmtDate,
  fmtDateTime,
  fmtRupees,
  ProbabilityBar,
  relTime,
  salesPost,
  SalesApiError,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  StageFlow,
  TimelineEntry,
  useSalesSection,
} from "../sales/parts";

// ============================================================
// Screen 79 · Opportunity Detail — the deal workspace.
// Controlled stage progression (server-governed transitions),
// quotation state, identity, related work and the audited
// timeline. All data from /api/sales?section=opportunity —
// records outside scope return 404, surfaced verbatim.
// ============================================================

// ---------- payload shapes (server contract, client mirrors) ----------

interface OppActivity {
  id: string;
  at: number;
  type: string;
  actorId: string;
  summary: string;
  outcome?: string;
  source?: string;
}

interface OppFollowUp {
  id: string;
  type: string;
  subject: string;
  state: string;
  priority: string;
  dueAt: number;
  outcome?: string;
  completedAt?: number;
}

interface OppMeeting {
  id: string;
  title: string;
  startAt: number;
  durationMin: number;
  location: string;
  isLink?: boolean;
  status: string;
}

interface OppVisit {
  id: string;
  purpose: string;
  plannedAt: number;
  durationMin: number;
  location: string;
  status: string;
}

interface OppQuotation {
  id: string;
  number: string;
  status: string;
  validUntil: string;
  taxPct: number;
  items: { qty: number; unitPrice: number; discountPct: number }[];
}

interface OppAccount {
  id: string;
  name: string;
  industry: string;
  location: string;
}

interface OppContact {
  id: string;
  name: string;
  designation: string;
}

interface OppRecord {
  id: string;
  name: string;
  accountId: string;
  contactId: string;
  ownerId: string;
  ownerName: string;
  stage: string;
  probability: number;
  valueCr: number;
  expectedClose: string;
  source: string;
  products: string[];
  competitors?: string[];
  nextAction?: string;
  nextFollowUpAt?: number;
  quotationId?: string;
  riskNote?: string;
  slippedFrom?: string;
  createdAt: number;
  lastStageChangeAt: number;
  lossReason?: string;
  closedAt?: number;
  account: OppAccount | null;
  contact: OppContact | null;
  quotation: OppQuotation | null;
  followups: OppFollowUp[];
  meetings: OppMeeting[];
  visits: OppVisit[];
  activity: OppActivity[];
  isMine: boolean;
}

interface OppPayload {
  opportunity: OppRecord;
}

interface SettingsPayload {
  settings: {
    stages: { name: string; probability: number; requiresQuotation: boolean }[];
    lossReasons: string[];
  };
}

interface FormRefs {
  owners: { id: string; name: string }[];
  contacts: { id: string; name: string }[];
}

// ---------- helpers ----------

const msgOf = (err: unknown): string =>
  err instanceof SalesApiError ? err.message : "The sales service is unreachable right now.";

/** Open stages, in governed order. Won/Lost are terminal — the server rejects moves out of them. */
const OPEN_FLOW = ["New", "Qualification", "Discovery", "Proposal", "Negotiation", "Contracting"] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n: number) => String(n).padStart(2, "0");

/** "15 Dec 2026" (canonical fixture format) → "2026-12-15" for a date input. */
function closeToInput(value: string): string {
  const m = value.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (m) {
    const mi = MONTHS.findIndex((mo) => mo.toLowerCase() === m[2].toLowerCase());
    if (mi >= 0) return `${m[3]}-${pad2(mi + 1)}-${pad2(Number(m[1]))}`;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "2026-12-15" → "15 Dec 2026" (canonical format the server stores). */
function inputToClose(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return value;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? "?"} ${m[1]}`;
}

/** Same math the server applies to quotations (server module is server-only — never imported). */
function quoteTotal(q: OppQuotation): number {
  const subtotal = q.items.reduce((sum, i) => sum + i.qty * i.unitPrice * (1 - i.discountPct / 100), 0);
  return subtotal + Math.round(subtotal * (q.taxPct / 100));
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600", className)}>
      {children}
    </span>
  );
}

// ============================================================
// Screen
// ============================================================

export function OpportunityDetailScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const opportunityId = nav.params.opportunityId;

  const { data, loading, error, forbidden, reload } = useSalesSection<OppPayload>("opportunity", { id: opportunityId });
  const { data: settings } = useSalesSection<SettingsPayload>("settings");
  const { data: refs } = useSalesSection<FormRefs>("form-refs");

  const opp = data?.opportunity ?? null;

  // ---------- actor resolution for the timeline (server returns actorId) ----------
  const resolveActor = React.useCallback(
    (actorId: string): string | undefined =>
      refs?.owners.find((o) => o.id === actorId)?.name ??
      refs?.contacts.find((c) => c.id === actorId)?.name ??
      (actorId.startsWith("wa-") ? "Customer (WhatsApp)" : undefined),
    [refs],
  );

  const timeline: TimelineEntry[] = React.useMemo(
    () =>
      (opp?.activity ?? []).map((a) => ({
        id: a.id,
        at: a.at,
        type: a.type,
        actorName: resolveActor(a.actorId),
        summary: a.summary,
        outcome: a.outcome,
        source: a.source,
      })),
    [opp, resolveActor],
  );

  // ---------- Advance stage dialog ----------
  const [stageOpen, setStageOpen] = React.useState(false);
  const [target, setTarget] = React.useState("");
  const [lossReason, setLossReason] = React.useState("");
  const [stageError, setStageError] = React.useState<string | null>(null);
  const [stageBusy, setStageBusy] = React.useState(false);

  const closed = opp?.stage === "Won" || opp?.stage === "Lost";
  const forwardTargets = React.useMemo(() => {
    if (!opp || closed) return [];
    const idx = OPEN_FLOW.indexOf(opp.stage as (typeof OPEN_FLOW)[number]);
    if (idx === -1) return [];
    return OPEN_FLOW.slice(idx + 1, idx + 3); // server: forward-only, max two steps
  }, [opp, closed]);
  const canWin = opp?.stage === "Contracting"; // server: only Contracting can be marked Won
  const stageTargets = React.useMemo(
    () => [...forwardTargets, ...(canWin ? ["Won"] : []), "Lost"],
    [forwardTargets, canWin],
  );
  const lossReasons = settings?.settings.lossReasons ?? [];
  const targetCfg = settings?.settings.stages.find((s) => s.name === target);

  const openStageDialog = () => {
    setTarget("");
    setLossReason("");
    setStageError(null);
    setStageOpen(true);
  };

  const submitStage = async () => {
    if (!opp) return;
    if (!target) {
      setStageError("Choose the target stage.");
      return;
    }
    if (target === "Lost" && !lossReason) {
      setStageError("A loss reason is required — it feeds the win/loss report.");
      return;
    }
    setStageBusy(true);
    setStageError(null);
    try {
      const res = await salesPost<{ ok: boolean; message: string }>(
        "opportunity.stage",
        { id: opp.id, stage: target, ...(target === "Lost" ? { lossReason } : {}) },
        role,
      );
      toast({ title: "Stage updated", description: res.message });
      setStageOpen(false);
      reload();
    } catch (err) {
      // 409 invalid_transition / quotation_required / skip_transition — inline AND toast, verbatim
      const msg = msgOf(err);
      setStageError(msg);
      toast({ variant: "destructive", title: "Stage change rejected", description: msg });
    } finally {
      setStageBusy(false);
    }
  };

  // ---------- Update details dialog ----------
  const [updateOpen, setUpdateOpen] = React.useState(false);
  const [valueStr, setValueStr] = React.useState("");
  const [closeInput, setCloseInput] = React.useState("");
  const [initialCloseInput, setInitialCloseInput] = React.useState("");
  const [probStr, setProbStr] = React.useState("");
  const [nextAction, setNextAction] = React.useState("");
  const [initialNextAction, setInitialNextAction] = React.useState("");
  const [updateError, setUpdateError] = React.useState<string | null>(null);
  const [updateBusy, setUpdateBusy] = React.useState(false);

  const openUpdateDialog = () => {
    if (!opp) return;
    setValueStr(String(opp.valueCr));
    const input = closeToInput(opp.expectedClose);
    setCloseInput(input);
    setInitialCloseInput(input);
    setProbStr(String(opp.probability));
    setNextAction(opp.nextAction ?? "");
    setInitialNextAction(opp.nextAction ?? "");
    setUpdateError(null);
    setUpdateOpen(true);
  };

  const submitUpdate = async () => {
    if (!opp) return;
    const input: Record<string, unknown> = { id: opp.id };
    if (valueStr.trim() !== "") input.valueCr = Number(valueStr);
    // only send the close date when it actually changed — the canonical string format differs from the input format
    if (closeInput !== initialCloseInput && closeInput) input.expectedClose = inputToClose(closeInput);
    if (probStr.trim() !== "") input.probability = Number(probStr);
    if (nextAction !== initialNextAction) input.nextAction = nextAction;
    setUpdateBusy(true);
    setUpdateError(null);
    try {
      const res = await salesPost<{ ok: boolean; message: string }>("opportunity.update", input, role);
      toast({ title: "Opportunity updated", description: res.message });
      setUpdateOpen(false);
      reload();
    } catch (err) {
      // 422 no_changes / invalid_value / invalid_probability — shown inline, dialog stays open
      setUpdateError(msgOf(err));
    } finally {
      setUpdateBusy(false);
    }
  };

  // ---------- gates ----------
  if (forbidden) {
    return (
      <SalesGate screenName="Opportunity Detail">
        <></>
      </SalesGate>
    );
  }

  if (!opportunityId) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Sales" }, { label: "Sales Pipeline", onClick: () => nav.navigate("sales-pipeline") }, { label: "Opportunity Detail" }]}
          title="Opportunity Detail"
          description="Deal workspace — controlled stage progression, quotations and negotiation history."
        />
        <div className="qubit-card">
          <EmptyState
            icon={<TrendingUp />}
            title="Open an opportunity from the Sales Pipeline"
            message="Opportunity Detail is a deep-linked workspace — pick a deal on the Sales Pipeline board (80) and its full workspace opens here."
            action={
              <Button size="sm" className="h-9 gap-1.5" onClick={() => nav.navigate("sales-pipeline")}>
                <Target className="h-4 w-4" aria-hidden /> Open Sales Pipeline
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        crumbs={[
          { label: "Sales" },
          { label: "Sales Pipeline", onClick: () => nav.navigate("sales-pipeline") },
          { label: opp?.name ?? "Opportunity Detail" },
        ]}
        title={opp?.name ?? "Opportunity Detail"}
        description={
          opp
            ? `${opp.account?.name ?? "Account"} · owned by ${opp.ownerName} · close ${opp.expectedClose}`
            : "Deal workspace — controlled stage progression, quotations and negotiation history."
        }
        meta={
          opp && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <StageFlow stage={opp.stage} />
              <ArrowLink onClick={() => nav.navigate("sales-pipeline")} ariaLabel="Open Sales Pipeline">
                Sales Pipeline
              </ArrowLink>
            </div>
          )
        }
        actions={
          opp && (
            <>
              <span title={closed ? `Closed records are final — this opportunity is closed as ${opp.stage}.` : undefined}>
                <Button size="sm" className="h-9 gap-1.5" onClick={openStageDialog} disabled={closed} aria-label="Advance stage">
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden /> Advance stage
                </Button>
              </span>
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={openUpdateDialog}>
                <PencilLine className="h-3.5 w-3.5" aria-hidden /> Update details
              </Button>
            </>
          )
        }
      />

      {error && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={4} />}

      {!loading && !data && !error && (
        <div className="qubit-card">
          <EmptyState
            icon={<Target />}
            title="Opportunity unavailable"
            message="The server did not return this opportunity. Retry, or return to the Sales Pipeline."
            action={
              <Button variant="outline" size="sm" onClick={() => nav.navigate("sales-pipeline")}>
                Back to Sales Pipeline
              </Button>
            }
          />
        </div>
      )}

      {opp && !loading && (
        <div className="space-y-4">
          {/* ---------- headline band ---------- */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={<IndianRupee />} value={<span className="tabular-nums">{fmtCr(opp.valueCr)}</span>} label="Deal value" />
            <StatTile
              icon={<Target />}
              value={<ProbabilityBar probability={opp.probability} />}
              label="Win probability"
            />
            <StatTile icon={<CalendarDays />} value={<span className="tabular-nums">{opp.expectedClose}</span>} label="Expected close" />
            {opp.quotation ? (
              <StatTile
                icon={<FileText />}
                value={<StatusBadge status={opp.quotation.status} size="sm" />}
                label={`Quotation ${opp.quotation.number}`}
                onClick={() => nav.navigate("quotation-detail", { quotationId: opp.quotation!.id })}
              />
            ) : (
              <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3.5 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="qubit-icon-tile h-9 w-9 shrink-0 bg-slate-100 text-slate-500 [&_svg]:h-4 [&_svg]:w-4">
                    <FileText />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold leading-tight text-slate-800">No quotation yet</span>
                    <span className="block truncate text-xs text-muted-foreground">Pricing rules run on the server</span>
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 sm:ml-auto"
                  onClick={() => nav.navigate("quotation-builder", { accountId: opp.accountId, opportunityId: opp.id })}
                >
                  Create in Quotation Builder
                </Button>
              </div>
            )}
          </div>

          {/* ---------- risk note (server-computed) ---------- */}
          {opp.riskNote && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3" role="note">
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex min-w-0 flex-1 items-start gap-2 text-[13px] leading-relaxed text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    <span className="font-medium">At risk:</span> {opp.riskNote}
                  </span>
                </p>
                {opp.slippedFrom && (
                  <span className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    Slipped from {opp.slippedFrom}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ---------- identity ---------- */}
          <SectionCard title="Opportunity identity" description="Where this deal sits, who owns it and what happens next.">
            <dl className="grid gap-x-10 sm:grid-cols-2">
              <KV label="Account">
                {opp.account ? (
                  <EntityLink screen="account-detail" id={opp.account.id} label={opp.account.name} kind="account" />
                ) : (
                  "—"
                )}
              </KV>
              <KV label="Primary contact">
                {opp.contact ? (
                  <EntityLink screen="contact-detail" id={opp.contact.id} label={`${opp.contact.name} (${opp.contact.designation})`} kind="contact" />
                ) : (
                  "—"
                )}
              </KV>
              <KV label="Owner">{opp.ownerName}</KV>
              <KV label="Source">{opp.source}</KV>
              <KV label="Products">
                {opp.products.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {opp.products.map((p) => (
                      <Chip key={p}>{p}</Chip>
                    ))}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </KV>
              <KV label="Competitors">
                {opp.competitors && opp.competitors.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {opp.competitors.map((c) => (
                      <Chip key={c} className="border-amber-200 bg-amber-50 text-amber-700">
                        {c}
                      </Chip>
                    ))}
                  </span>
                ) : (
                  <span className="text-slate-400">None tracked</span>
                )}
              </KV>
              <KV label="Next action">{opp.nextAction ?? <span className="text-slate-400">Nothing scheduled</span>}</KV>
              <KV label="Stage">
                <StatusBadge status={opp.stage} size="sm" />
              </KV>
              <KV label="Created">
                {fmtDate(opp.createdAt)} <span className="text-xs text-slate-400">({relTime(opp.createdAt)})</span>
              </KV>
              <KV label="Last stage change">
                {fmtDate(opp.lastStageChangeAt)} <span className="text-xs text-slate-400">({relTime(opp.lastStageChangeAt)})</span>
              </KV>
              {opp.lossReason && <KV label="Loss reason">{opp.lossReason}</KV>}
              {opp.closedAt && <KV label="Closed">{fmtDate(opp.closedAt)}</KV>}
            </dl>
          </SectionCard>

          {/* ---------- related work ---------- */}
          <div className="grid gap-4 xl:grid-cols-2">
            {/* Follow-ups — opportunities reuse the enterprise follow-up engine; scheduling happens from the owning lead/account */}
            <SectionCard
              title="Follow-ups"
              description="Follow-ups live on the leads and accounts behind this deal."
              actions={<ArrowLink onClick={() => nav.navigate("followup-queue")}>Open Follow-up Queue</ArrowLink>}
            >
              {opp.followups.length === 0 ? (
                <EmptyState
                  icon={<ListChecks />}
                  title="No follow-ups on this deal"
                  message="Follow-ups are scheduled from the lead or account record and appear here automatically."
                />
              ) : (
                <ul className="space-y-2.5">
                  {opp.followups.map((f) => (
                    <li key={f.id} className="rounded-lg border border-slate-200/80 px-3.5 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-slate-800">{f.subject}</p>
                        <StatusBadge status={f.state} size="sm" />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {f.type} · {f.state === "Completed" && f.completedAt ? `completed ${fmtDateTime(f.completedAt)}` : `due ${fmtDateTime(f.dueAt)} (${relTime(f.dueAt)})`}
                      </p>
                      {f.outcome && (
                        <p className="mt-1 text-xs text-slate-500">
                          <span className="font-medium text-slate-600">Outcome:</span> {f.outcome}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Quotation — the commercial document behind this deal */}
            <SectionCard title="Quotation" description="One commercial document per deal — approval rules run on the server.">
              {opp.quotation ? (
                <div className="rounded-lg border border-slate-200/80 px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[11px] font-medium text-slate-600">{opp.quotation.number}</span>
                    <StatusBadge status={opp.quotation.status} size="sm" />
                  </div>
                  <p className="mt-2 text-[15px] font-semibold tabular-nums text-slate-900">{fmtRupees(quoteTotal(opp.quotation))}</p>
                  <p className="mt-0.5 text-xs text-slate-400">Valid until {opp.quotation.validUntil}</p>
                  <div className="mt-2.5">
                    <EntityLink screen="quotation-detail" id={opp.quotation.id} label="Open quotation" kind="quotation" />
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<FileText />}
                  title="No quotation yet"
                  message="Build one in the Quotation Builder — Proposal and later stages expect a linked quotation (server rule)."
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => nav.navigate("quotation-builder", { accountId: opp.accountId, opportunityId: opp.id })}
                    >
                      Create in Quotation Builder
                    </Button>
                  }
                />
              )}
            </SectionCard>

            {/* Meetings */}
            <SectionCard title="Meetings" description="Connected to the enterprise Meetings module — one calendar.">
              {opp.meetings.length === 0 ? (
                <EmptyState icon={<CalendarDays />} title="No meetings" message="Schedule one from the customer or contact record." />
              ) : (
                <ul className="space-y-2.5">
                  {opp.meetings.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200/80 px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate text-[13.5px] font-medium text-slate-800">{m.title}</p>
                          <StatusBadge status={m.status} size="sm" />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {fmtDateTime(m.startAt)} · {m.durationMin} min · {m.location}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Field visits */}
            <SectionCard title="Field visits" description="On-site work logged against this deal.">
              {opp.visits.length === 0 ? (
                <EmptyState icon={<Users />} title="No visits" message="Plan visits from the account record or the Visit Planner." />
              ) : (
                <ul className="space-y-2.5">
                  {opp.visits.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200/80 px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate text-[13.5px] font-medium text-slate-800">{v.purpose}</p>
                          <StatusBadge status={v.status} size="sm" />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {fmtDateTime(v.plannedAt)} · {v.durationMin} min · {v.location}
                        </p>
                      </div>
                      <EntityLink screen="visit-detail" id={v.id} label="Open" kind="visit" />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {/* ---------- timeline (server-captured: stage changes, status changes, related work) ---------- */}
          <SectionCard
            title="Timeline"
            description="Stage changes and status changes are captured automatically — every transition is audited."
          >
            <ActivityTimeline entries={timeline} />
          </SectionCard>

          <SalesAsOf
            asOfLabel={SALES_PERIOD.asOfLabel}
            note="The opportunity record is scoped server-side — records outside your role return 404, never partial data."
          />
        </div>
      )}

      {/* ---------- Advance stage (server enforces the rules; this dialog only offers them) ---------- */}
      <FormDialog
        open={stageOpen}
        onOpenChange={setStageOpen}
        title="Advance stage"
        description="Transitions are validated server-side — forward-only, max two steps, quotation gates on late stages, Won needs an Accepted quotation."
        submitLabel="Move stage"
        submitting={stageBusy}
        onSubmit={submitStage}
      >
        <Field label="Target stage" required>
          <Select
            value={target}
            onValueChange={(v) => {
              setTarget(v);
              setStageError(null);
            }}
          >
            <SelectTrigger aria-label="Target stage">
              <SelectValue placeholder="Choose the next stage" />
            </SelectTrigger>
            <SelectContent>
              {stageTargets.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {target === "Lost" && (
          <Field label="Loss reason" required hint="Feeds the win/loss report (screen 100).">
            <Select
              value={lossReason}
              onValueChange={(v) => {
                setLossReason(v);
                setStageError(null);
              }}
            >
              <SelectTrigger aria-label="Loss reason">
                <SelectValue placeholder="Why is this deal lost?" />
              </SelectTrigger>
              <SelectContent>
                {lossReasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {opp && target && target !== "Lost" && targetCfg?.requiresQuotation && !opp.quotationId && (
          <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] leading-relaxed text-amber-800" role="note">
            The {target} stage expects a linked quotation — this deal has none yet. The server will reject the move; create one in the Quotation Builder first.
          </p>
        )}
        {opp && target === "Won" && opp.quotation?.status !== "Accepted" && (
          <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] leading-relaxed text-amber-800" role="note">
            Closing Won needs an Accepted quotation — current status: {opp.quotation ? opp.quotation.status : "no quotation"}. The server enforces this rule.
          </p>
        )}

        {stageError && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {stageError}
          </p>
        )}
      </FormDialog>

      {/* ---------- Update details ---------- */}
      <FormDialog
        open={updateOpen}
        onOpenChange={setUpdateOpen}
        title="Update details"
        description="Value, close date, probability and next action — every change lands on the timeline and the audit trail."
        submitLabel="Save changes"
        submitting={updateBusy}
        onSubmit={submitUpdate}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Value (₹ Cr)" hint="Deal values are recorded in ₹ Cr — e.g. 0.84.">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
              aria-label="Opportunity value in crore rupees"
              className="h-9 rounded-lg tabular-nums"
            />
          </Field>
          <Field label="Probability (%)">
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              value={probStr}
              onChange={(e) => setProbStr(e.target.value)}
              aria-label="Win probability percentage"
              className="h-9 rounded-lg tabular-nums"
            />
          </Field>
          <Field label="Expected close date">
            <Input
              type="date"
              value={closeInput}
              onChange={(e) => setCloseInput(e.target.value)}
              aria-label="Expected close date"
              className="h-9 rounded-lg"
            />
          </Field>
          <Field label="Next action">
            <Input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g. Chase legal redlines on DPA"
              aria-label="Next action"
              className="h-9 rounded-lg"
            />
          </Field>
        </div>
        {updateError && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {updateError}
          </p>
        )}
      </FormDialog>
    </div>
  );
}
