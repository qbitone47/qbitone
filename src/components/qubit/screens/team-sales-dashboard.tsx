"use client";

import * as React from "react";
import {
  AlertTriangle,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "../page-header";
import { ArrowLink, Avatar, EmptyState, SectionCard, StatTile } from "../primitives";
import { PeriodChip } from "../executive/parts";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import {
  EntityLink,
  fmtCr,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  ScopeNote,
  useSalesSection,
} from "../sales/parts";

// ============================================================
// Screen 101 · Team Sales Dashboard — the manager workspace.
// Risk-first operating order: who needs attention → what is at
// risk → the numbers → the teams behind them → action required.
// Actual won, pipeline and forecast are three different numbers
// and are never mixed. All data comes from /api/sales?section=team
// (server-scoped: administrator = all teams, dept-head = theirs);
// sales-exec gets a 403 manager_required with a real path back to
// Sales Home. Drill path: Team → Salesperson → Opportunity →
// Customer — this screen links into the drill surfaces, it does
// not duplicate them.
// ============================================================

interface TeamMemberT {
  employeeId: string;
  name: string;
  quotaCr: number;
  achievedCr: number;
  pipelineCr: number;
  openOpps: number;
  overdueFollowups: number;
  conversionPct: number;
  attention: string | null;
}

interface TeamRiskT {
  id: string;
  name: string;
  riskNote: string;
  ownerName: string;
  valueCr: number;
}

interface TeamTargetT {
  kind: "team";
  refId: string;
  label: string;
  quotaCr: number;
  achievedCr: number;
  pipelineCr: number;
  forecastCr: number;
}

interface TeamT {
  id: string;
  name: string;
  region: string;
  head: string;
  target: TeamTargetT;
  members: TeamMemberT[];
  risks: TeamRiskT[];
  openOpps: number;
  quotations: number;
}

interface TeamPayload {
  teams: TeamT[];
  totals: { quotaCr: number; achievedCr: number; pipelineCr: number; forecastCr: number };
  overdueTotal: number;
  scope: "company" | "team" | "own";
}

// ---------- shared helpers (same system as Sales Targets / Leaderboard) ----------

const TH =
  "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 md:px-4";
const THR = cn(TH, "text-right");
const TD = "whitespace-nowrap px-3 py-2.5 text-[13px] tabular-nums text-slate-700 md:px-4";

const pctOf = (achieved: number, quota: number) => (quota > 0 ? Math.round((achieved / quota) * 100) : 0);

/** Achievement tone ramp — always paired with % text, never color-only. */
const ACHIEVEMENT_TONE = (pct: number) =>
  pct >= 70
    ? { bar: "bg-emerald-500", text: "text-emerald-700" }
    : pct >= 40
      ? { bar: "bg-blue-600", text: "text-blue-700" }
      : { bar: "bg-amber-500", text: "text-amber-700" };

/** The server's attention string, verbatim, as a word chip. */
function AttentionChip({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-[190px] items-start whitespace-normal rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-[10.5px] font-medium leading-snug text-amber-700">
      {label}
      <span className="sr-only"> — flagged for attention</span>
    </span>
  );
}

/** Team-level achievement bar — echoes the Sales Targets bar system. */
function TeamAchievementBar({ target, teamName }: { target: TeamTargetT; teamName: string }) {
  const pct = pctOf(target.achievedCr, target.quotaCr);
  const tone = ACHIEVEMENT_TONE(pct);
  const behindPace = pct === 0 && target.pipelineCr > 0;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-[13px] tabular-nums text-slate-500">
          <span className="text-[15px] font-semibold tabular-nums text-slate-900">{fmtCr(target.achievedCr)}</span>
          {" "}of {fmtCr(target.quotaCr)} quota — actual won
        </p>
        <p className={cn("text-[13px] font-semibold tabular-nums", tone.text)}>{pct}%</p>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`Achievement ${pct}% of ${teamName} quota`}
      >
        <div
          className={cn("h-full rounded-full", tone.bar)}
          style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
        />
      </div>
      {behindPace && (
        <p className="mt-1.5">
          <span className="inline-flex rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-[10.5px] font-medium text-amber-700">
            Behind pace<span className="sr-only"> — no closed revenue yet this quarter</span>
          </span>
        </p>
      )}
    </div>
  );
}

/** Member achieved cell — ₹ Cr value with the same bar + % idiom underneath. */
function AchievedCell({ achievedCr, quotaCr }: { achievedCr: number; quotaCr: number }) {
  const pct = pctOf(achievedCr, quotaCr);
  const tone = ACHIEVEMENT_TONE(pct);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="font-medium text-slate-800">{fmtCr(achievedCr)}</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1 w-12 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Achievement ${pct}% of personal quota`}>
          <span className={cn("block h-full rounded-full", tone.bar)} style={{ width: `${Math.min(100, Math.max(4, pct))}%` }} />
        </span>
        <span className={cn("text-[11px] font-medium tabular-nums", tone.text)}>{pct}%</span>
      </span>
    </span>
  );
}

// ---------- screen ----------

export function TeamSalesDashboardScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { data, loading, error, forbidden, scope, reload } = useSalesSection<TeamPayload>("team");
  const [expanded, setExpanded] = React.useState<ReadonlySet<string>>(() => new Set<string>());

  const go = (screen: Parameters<typeof nav.navigate>[0], params?: Parameters<typeof nav.navigate>[1]) => () =>
    nav.navigate(screen, params);

  const toggleMember = (employeeId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });

  // ---- forbidden: two different 403s get two honest presentations ----
  if (forbidden) {
    // sales-exec → 403 manager_required: surface the server message verbatim + a real path back.
    if (role === "sales-exec") {
      return (
        <div>
          <PageHeader
            crumbs={[{ label: "Sales" }, { label: "Team Sales Dashboard" }]}
            title="Team Sales Dashboard"
            description="A manager workspace — your boundary is a sales workspace, so the server does not disclose team data to it."
            meta={<PeriodChip label={SALES_PERIOD.label} window={SALES_PERIOD.window} />}
          />
          <SalesErrorBanner
            message={error ?? "The team dashboard requires a manager boundary. Sales executives see their own workspace on Sales Home."}
            onRetry={reload}
          />
          <div className="qubit-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="min-w-0 flex-1 text-[13px] text-slate-600">
              Your own target, pipeline, follow-ups and activity live on Sales Home — the team view needs a manager or administrator boundary.
            </p>
            <ArrowLink onClick={go("sales-home")} className="shrink-0">Open Sales Home</ArrowLink>
          </div>
        </div>
      );
    }
    // employee / hr-manager → the shared sales gate.
    return (
      <SalesGate screenName="Team Sales Dashboard">
        <></>
      </SalesGate>
    );
  }

  const teams = data?.teams ?? [];
  const totals = data?.totals ?? { quotaCr: 0, achievedCr: 0, pipelineCr: 0, forecastCr: 0 };
  const overdueTotal = data?.overdueTotal ?? 0;

  // "Who needs attention" — the server's attention flags across every team, heaviest first.
  const flagged = teams
    .flatMap((t) => t.members.filter((m) => m.attention).map((m) => ({ ...m, teamName: t.name })))
    .sort(
      (a, b) =>
        b.overdueFollowups - a.overdueFollowups ||
        pctOf(a.achievedCr, a.quotaCr) - pctOf(b.achievedCr, b.quotaCr) ||
        a.name.localeCompare(b.name),
    );

  // "What is at risk" — every team's flagged opportunities, heaviest first.
  const risks = teams
    .flatMap((t) => t.risks.map((r) => ({ ...r, teamName: t.name })))
    .sort((a, b) => b.valueCr - a.valueCr);
  const riskValueCr = risks.reduce((s, r) => s + r.valueCr, 0);

  const totalOpenOpps = teams.reduce((s, t) => s + t.openOpps, 0);
  const targetPct = pctOf(totals.achievedCr, totals.quotaCr);

  // "Action required" — three quiet moves, derived from the same numbers above.
  const actions: { key: string; text: string; linkLabel: string; onClick: () => void }[] = [];
  if (overdueTotal > 0) {
    actions.push({
      key: "overdue",
      text: `${overdueTotal} overdue follow-ups — clear them in the Follow-up Queue.`,
      linkLabel: "Follow-up Queue",
      onClick: go("followup-queue"),
    });
  }
  if (flagged.length > 0) {
    actions.push({
      key: "flagged",
      text: `${flagged.length} flagged ${flagged.length === 1 ? "member" : "members"} — coaching notes due at the weekly review.`,
      linkLabel: "Leaderboard",
      onClick: go("sales-leaderboard"),
    });
  }
  if (risks.length > 0) {
    actions.push({
      key: "risks",
      text: `${risks.length} at-risk ${risks.length === 1 ? "opportunity" : "opportunities"} worth ${fmtCr(riskValueCr)} — review them in the pipeline.`,
      linkLabel: "Sales Pipeline",
      onClick: go("sales-pipeline"),
    });
  }

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Team Sales Dashboard" }]}
        title="Team Sales Dashboard"
        description="A live read on the four questions a manager opens with — what is happening across the teams, what is at risk in the pipeline, who needs attention this week, and what action to take first; risk and overdue work lead, and actual won is never mixed with forecast."
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={reload} aria-label="Reload team dashboard">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
          </Button>
        }
        meta={<PeriodChip label={SALES_PERIOD.label} window={SALES_PERIOD.window} />}
      />

      {error && !forbidden && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={4} />}

      {data && !loading && (
        <div className="space-y-4">
          {/* 1 · WHO NEEDS ATTENTION — the server's flags, verbatim, heaviest first */}
          <SectionCard
            title="Needs attention"
            description="Members flagged by the server's attention rules — overdue follow-ups piling up, achievement below pace, or follow-up completion needing coaching. Heaviest cases lead."
            actions={<ArrowLink onClick={go("sales-leaderboard")}>Coaching view — Leaderboard</ArrowLink>}
          >
            {flagged.length === 0 ? (
              <p className="text-[13px] text-slate-400">No one is flagged for attention this week.</p>
            ) : (
              <ul className="space-y-2.5">
                {flagged.map((m) => (
                  <li
                    key={m.employeeId}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200/80 px-3.5 py-3"
                  >
                    <Avatar name={m.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13.5px] font-medium text-slate-800">{m.name}</p>
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] text-slate-500">{m.teamName}</span>
                        <AttentionChip label={m.attention ?? ""} />
                      </div>
                      <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                        {m.overdueFollowups} overdue follow-ups · {m.openOpps} open opportunities · {m.conversionPct}% conversion
                      </p>
                    </div>
                    <AchievedCell achievedCr={m.achievedCr} quotaCr={m.quotaCr} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* 2 · WHAT IS AT RISK — flagged opportunities, heaviest first */}
          <SectionCard
            title="Risks in the pipeline"
            description="Open opportunities carrying a risk note, heaviest first — the deal-level view of what could miss the number."
            actions={<ArrowLink onClick={go("sales-pipeline")}>Open Sales Pipeline</ArrowLink>}
          >
            {risks.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck />}
                title="No deal risks flagged"
                message="No open opportunity in your teams carries a risk note right now. Stage-by-stage health lives in the Sales Pipeline."
              />
            ) : (
              <ul className="space-y-2.5">
                {risks.map((r) => (
                  <li key={r.id} className="rounded-lg border border-slate-200/80 px-3.5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <EntityLink screen="opportunity-detail" id={r.id} label={r.name} kind="opportunity" />
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] text-slate-500">{r.teamName}</span>
                      </div>
                      <p className="text-[13px] font-semibold tabular-nums text-slate-900">{fmtCr(r.valueCr)}</p>
                    </div>
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-slate-600">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-hidden />
                      <span className="line-clamp-2">{r.riskNote}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">Owner: {r.ownerName}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* 3 · THE NUMBERS — actual won, pipeline and forecast kept separate */}
          <div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatTile
                icon={<Target />}
                value={fmtCr(totals.quotaCr)}
                label="Team target — all teams combined"
                onClick={go("sales-targets")}
              />
              <StatTile
                icon={<CircleCheck />}
                value={fmtCr(totals.achievedCr)}
                label={`Actual won · ${targetPct}% of target`}
                onClick={go("sales-targets")}
              />
              <StatTile
                icon={<TrendingUp />}
                value={fmtCr(totals.pipelineCr)}
                label={`Open pipeline · ${totalOpenOpps} open opportunities`}
                onClick={go("sales-pipeline")}
              />
              <StatTile
                icon={<ClipboardList />}
                value={fmtCr(totals.forecastCr)}
                label="Commit forecast"
                onClick={go("sales-forecast")}
              />
              <div className="flex flex-col gap-1.5">
                <StatTile
                  icon={<ListChecks />}
                  value={<span className={cn(overdueTotal > 0 && "text-red-700")}>{overdueTotal}</span>}
                  label="Overdue follow-ups across teams"
                  onClick={go("followup-queue")}
                  className={cn(overdueTotal > 0 && "border-red-200 bg-red-50/40")}
                />
                <ArrowLink onClick={go("followup-queue")} className="px-1 text-xs">Open Follow-up Queue</ArrowLink>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              Forecast — never mixed with actuals. Achievement is actual won ÷ team quota; the pipeline figure is unweighted and shown
              for context; the commit forecast comes from the forecast model, not from summing actuals.
            </p>
          </div>

          {/* 4 · THE TEAMS — one card per team with the expandable member drilldown */}
          {teams.length === 0 ? (
            <SectionCard title="Teams" description="Teams in your authorized boundary.">
              <EmptyState
                icon={<Users />}
                title="No teams in your scope"
                message="Your boundary resolves to no teams for this period — the server returns only what your role is authorized to see."
              />
            </SectionCard>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {teams.map((t) => (
                <SectionCard
                  key={t.id}
                  title={t.name}
                  description={`${t.region} region · Led by ${t.head}`}
                  className="h-full min-w-0"
                >
                  <TeamAchievementBar target={t.target} teamName={t.name} />

                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <span className="tabular-nums">
                      <span className="text-slate-400">Open opportunities</span> {t.openOpps}
                    </span>
                    <span className="tabular-nums">
                      <span className="text-slate-400">Open quotations</span> {t.quotations}
                    </span>
                    <ArrowLink onClick={go("quotation-list")} className="text-xs">Quotations</ArrowLink>
                  </div>

                  {t.members.length === 0 ? (
                    <p className="mt-3 text-[13px] text-slate-400">No members in this team.</p>
                  ) : (
                    <div className="qubit-scroll relative mt-3 overflow-x-auto">
                      <table className="w-full min-w-[720px] border-collapse text-sm" aria-label={`${t.name} — salespeople`}>
                        <thead>
                          <tr className="border-b border-slate-200/90 bg-slate-50/95">
                            <th scope="col" className={cn(TH, "w-9")}><span className="sr-only">Expand row</span></th>
                            <th scope="col" className={TH}>Salesperson</th>
                            <th scope="col" className={THR}>Quota</th>
                            <th scope="col" className={THR}>Achieved</th>
                            <th scope="col" className={THR}>Pipeline</th>
                            <th scope="col" className={THR}>Open opps</th>
                            <th scope="col" className={THR}>Overdue</th>
                            <th scope="col" className={THR}>Conv.</th>
                            <th scope="col" className={TH}>Attention</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {t.members.map((m) => {
                            const isOpen = expanded.has(m.employeeId);
                            return (
                              <React.Fragment key={m.employeeId}>
                                <tr className="transition-colors hover:bg-blue-50/30">
                                  <td className="px-2 py-2 md:px-3">
                                    <button
                                      type="button"
                                      onClick={() => toggleMember(m.employeeId)}
                                      aria-expanded={isOpen}
                                      aria-controls={`drill-${m.employeeId}`}
                                      aria-label={`${isOpen ? "Hide" : "Show"} drill paths for ${m.name}`}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                    >
                                      <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} aria-hidden />
                                    </button>
                                  </td>
                                  <td className={cn(TD, "font-medium text-slate-800")}>{m.name}</td>
                                  <td className={TD}>{fmtCr(m.quotaCr)}</td>
                                  <td className="px-3 py-2.5 md:px-4">
                                    <AchievedCell achievedCr={m.achievedCr} quotaCr={m.quotaCr} />
                                  </td>
                                  <td className={TD}>{fmtCr(m.pipelineCr)}</td>
                                  <td className={TD}>{m.openOpps}</td>
                                  <td className={TD}>
                                    <span className={cn(m.overdueFollowups > 0 ? "font-medium text-red-600" : "text-slate-400")}>
                                      {m.overdueFollowups}
                                    </span>
                                    {m.overdueFollowups > 0 && <span className="sr-only"> — overdue follow-ups need clearing</span>}
                                  </td>
                                  <td className={TD}>{m.conversionPct}%</td>
                                  <td className="px-3 py-2.5 md:px-4">
                                    {m.attention ? <AttentionChip label={m.attention} /> : <span className="text-slate-300">—</span>}
                                  </td>
                                </tr>
                                {isOpen && (
                                  <tr>
                                    <td colSpan={9} id={`drill-${m.employeeId}`} className="bg-slate-50/70 px-3 py-3 md:px-4">
                                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                                          Drill down — {m.name}
                                        </span>
                                        <ArrowLink onClick={go("sales-pipeline")} className="text-xs">Opportunities</ArrowLink>
                                        <ArrowLink onClick={go("customer-activity")} className="text-xs">Customer activity</ArrowLink>
                                        <ArrowLink onClick={go("sales-leaderboard")} className="text-xs">Leaderboard</ArrowLink>
                                      </div>
                                      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                                        Per-member opportunity and customer lists are not duplicated here — the pipeline, activity timeline and
                                        leaderboard are the drill surfaces. From an opportunity, its customer record is one link away
                                        (Team → Salesperson → Opportunity → Customer).
                                      </p>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <ScopeNote scope={scope} what="team sales" />
            <p className="text-[11px] leading-relaxed text-slate-400">
              Achievement tones: 70%+ on track, 40–69% building, below 40% behind — every bar carries its percentage, so color is never
              the only signal. The server scopes every figure to your boundary; this screen renders what it returns without re-filtering.
            </p>
          </div>

          {/* 5 · ACTION REQUIRED — derived from the same numbers, no manufactured urgency */}
          <SectionCard
            title="Action required"
            description="The moves this dashboard asks of you, derived from the same numbers above — nothing manufactured."
          >
            {actions.length === 0 ? (
              <p className="text-[13px] text-slate-400">No action required today.</p>
            ) : (
              <ul className="space-y-2.5">
                {actions.map((a) => (
                  <li
                    key={a.key}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-lg border border-slate-200/80 px-3.5 py-2.5"
                  >
                    <p className="min-w-0 flex-1 text-[13px] text-slate-700">{a.text}</p>
                    <ArrowLink onClick={a.onClick} className="shrink-0">{a.linkLabel}</ArrowLink>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SalesAsOf
            asOfLabel={SALES_PERIOD.asOfLabel}
            note="Team, member, risk and overdue figures are computed by the sales server for your boundary — the drill Team → Salesperson → Opportunity → Customer runs through the links on this screen."
          />
        </div>
      )}

      {!loading && !data && !error && (
        <EmptyState
          icon={<ShieldAlert />}
          title="Team Sales Dashboard could not load"
          message="The sales service returned no team data. Retry, or check the service status."
          action={<Button size="sm" onClick={reload}>Retry</Button>}
        />
      )}
    </div>
  );
}
