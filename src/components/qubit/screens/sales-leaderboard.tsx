"use client";

import * as React from "react";
import { RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PageHeader } from "../page-header";
import { Avatar, EmptyState, SectionCard } from "../primitives";
import { DataTable, type Column } from "../data-table";
import { PeriodChip } from "../executive/parts";
import {
  fmtCr,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  ScopeNote,
  useSalesSection,
} from "../sales/parts";

// ============================================================
// Screen 83 · Sales Leaderboard — performance visibility for
// coaching: achievement, conversion and pipeline. This is a
// work tool, not a game — no badges, no streaks, no shaming,
// no podium graphics. Rank is a plain number, nothing else.
// Data: /api/sales?section=leaderboard (server-scoped).
// ============================================================

interface LeaderboardRowT {
  employeeId: string;
  name: string;
  revenueCr: number;
  achievementPct: number;
  oppsWon: number;
  conversionPct: number;
  avgDealCr: number;
  pipelineCr: number;
  followupCompletionPct: number;
  newCustomers: number;
}

interface TeamDefT {
  id: string;
  name: string;
  region: string;
  headId: string;
  memberIds: string[];
}

interface LeaderboardPayload {
  rows: LeaderboardRowT[];
  scope: "company" | "team" | "own";
  teams: TeamDefT[];
  period: { label: string; window: string; asOfLabel: string };
}

type RankedRow = LeaderboardRowT & { rank: number };

/** Coaching chip — word, never color-only. */
function CoachingChip() {
  return (
    <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-[10.5px] font-medium text-amber-700">
      Coaching<span className="sr-only"> — follow-up completion below 70%; coach, don't rank-punish</span>
    </span>
  );
}

function AchievementCell({ pct }: { pct: number }) {
  const tone =
    pct >= 70
      ? { bar: "bg-emerald-500", text: "text-emerald-700" }
      : pct >= 40
        ? { bar: "bg-blue-600", text: "text-blue-700" }
        : { bar: "bg-amber-500", text: "text-amber-700" };
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Achievement ${pct}% of quota`}>
        <span className={cn("block h-full rounded-full", tone.bar)} style={{ width: `${Math.min(100, Math.max(4, pct))}%` }} />
      </span>
      <span className={cn("text-xs font-medium tabular-nums", tone.text)}>{pct}%</span>
    </span>
  );
}

export function SalesLeaderboardScreen() {
  const { data, loading, error, forbidden, scope, reload } = useSalesSection<LeaderboardPayload>("leaderboard");
  const [teamId, setTeamId] = React.useState("all");

  if (forbidden) {
    return (
      <SalesGate screenName="Sales Leaderboard">
        <></>
      </SalesGate>
    );
  }

  const teams = data?.teams ?? [];
  const activeTeam = teams.find((t) => t.id === teamId) ?? null;
  const filtered = (data?.rows ?? []).filter(
    (r) => !activeTeam || activeTeam.memberIds.includes(r.employeeId),
  );

  // Rank = position by closed-won revenue, descending — computed here because
  // the server sends rows unranked. Ties break alphabetically for stability.
  const ranked: RankedRow[] = [...filtered]
    .sort((a, b) => b.revenueCr - a.revenueCr || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const columns: Column<RankedRow>[] = [
    {
      key: "rank",
      header: "Rank",
      sortable: true,
      sortValue: (r) => r.rank,
      render: (r) => <span className="text-[13px] font-semibold tabular-nums text-slate-500">#{r.rank}</span>,
    },
    {
      key: "name",
      header: "Salesperson",
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={r.name} size="sm" />
          <span className="text-[13px] font-medium text-slate-800">{r.name}</span>
        </span>
      ),
    },
    {
      key: "revenueCr",
      header: "Revenue",
      sortable: true,
      sortValue: (r) => r.revenueCr,
      render: (r) => <span className="text-[13px] font-semibold tabular-nums text-slate-900">{fmtCr(r.revenueCr)}</span>,
    },
    {
      key: "achievementPct",
      header: "Achievement",
      sortable: true,
      sortValue: (r) => r.achievementPct,
      render: (r) => <AchievementCell pct={r.achievementPct} />,
    },
    {
      key: "oppsWon",
      header: "Opps won",
      sortable: true,
      sortValue: (r) => r.oppsWon,
      render: (r) => <span className="tabular-nums">{r.oppsWon}</span>,
    },
    {
      key: "conversionPct",
      header: "Conversion",
      sortable: true,
      sortValue: (r) => r.conversionPct,
      render: (r) => <span className="tabular-nums">{r.conversionPct}%</span>,
    },
    {
      key: "avgDealCr",
      header: "Avg deal",
      sortable: true,
      sortValue: (r) => r.avgDealCr,
      render: (r) => <span className="tabular-nums">{fmtCr(r.avgDealCr)}</span>,
    },
    {
      key: "pipelineCr",
      header: "Pipeline",
      sortable: true,
      sortValue: (r) => r.pipelineCr,
      render: (r) => <span className="tabular-nums">{fmtCr(r.pipelineCr)}</span>,
    },
    {
      key: "followupCompletionPct",
      header: "Follow-up completion",
      sortable: true,
      sortValue: (r) => r.followupCompletionPct,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className={cn("text-xs tabular-nums", r.followupCompletionPct < 70 ? "font-medium text-amber-700" : "text-slate-600")}>
            {r.followupCompletionPct}%
          </span>
          {r.followupCompletionPct < 70 && <CoachingChip />}
        </span>
      ),
    },
    {
      key: "newCustomers",
      header: "New customers",
      sortable: true,
      sortValue: (r) => r.newCustomers,
      render: (r) => <span className="tabular-nums">{r.newCustomers}</span>,
    },
  ];

  const mobileCard = (r: RankedRow) => (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        <span className="w-8 shrink-0 text-center text-[13px] font-semibold tabular-nums text-slate-500">#{r.rank}</span>
        <Avatar name={r.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium text-slate-800">{r.name}</p>
          <p className="text-[11px] text-slate-400">
            {fmtCr(r.revenueCr)} revenue · {r.achievementPct}% of quota
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 pl-11 text-[11.5px]">
        <div className="flex justify-between gap-2"><dt className="text-slate-400">Opps won</dt><dd className="tabular-nums text-slate-700">{r.oppsWon}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-slate-400">Conversion</dt><dd className="tabular-nums text-slate-700">{r.conversionPct}%</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-slate-400">Avg deal</dt><dd className="tabular-nums text-slate-700">{fmtCr(r.avgDealCr)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-slate-400">Pipeline</dt><dd className="tabular-nums text-slate-700">{fmtCr(r.pipelineCr)}</dd></div>
        <div className="col-span-2 flex justify-between gap-2">
          <dt className="text-slate-400">Follow-up completion</dt>
          <dd className="flex items-center gap-1.5 tabular-nums text-slate-700">
            {r.followupCompletionPct}%{r.followupCompletionPct < 70 && <CoachingChip />}
          </dd>
        </div>
        <div className="flex justify-between gap-2"><dt className="text-slate-400">New customers</dt><dd className="tabular-nums text-slate-700">{r.newCustomers}</dd></div>
      </dl>
    </div>
  );

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Sales Leaderboard" }]}
        title="Sales Leaderboard"
        description="Performance visibility for coaching — achievement, conversion and pipeline. This is a work tool, not a game: no badges, no streaks, no shaming."
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={reload} aria-label="Reload leaderboard">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
          </Button>
        }
        meta={data ? <PeriodChip label={data.period.label} window={data.period.window} /> : undefined}
      />

      {error && !forbidden && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={4} />}

      {data && !loading && (
        <div className="space-y-4">
          {/* filters — team membership only; the period is fixed to the reporting quarter */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label htmlFor="lb-team" className="text-xs font-medium text-slate-500">
              Team
            </label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger id="lb-team" className="h-9 w-[220px] rounded-lg">
                <SelectValue placeholder="All teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · {t.region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400">
              Period fixed to {data.period.label} — leaderboards compare like with like.
            </p>
          </div>

          <DataTable<RankedRow>
            columns={columns}
            rows={ranked}
            rowKey={(r) => r.employeeId}
            pageSize={0}
            caption="Sales leaderboard — rank, revenue, achievement, conversion, pipeline and follow-up completion"
            emptyTitle="No salespeople in this view"
            emptyMessage={activeTeam ? `${activeTeam.name} has no leaderboard rows in your scope.` : "Your authorized scope has no leaderboard rows for this period."}
            mobileCard={mobileCard}
          />

          <div className="space-y-1">
            <ScopeNote scope={scope} what="salespeople" />
            {activeTeam && (
              <p className="text-[11px] text-slate-400">
                Filtered to {activeTeam.name} ({activeTeam.memberIds.length} member{activeTeam.memberIds.length === 1 ? "" : "s"} on the team) — rank is recomputed within the filtered view.
              </p>
            )}
          </div>

          {/* how to read this — two quiet definitions, no gamification */}
          <SectionCard title="How to read this" description="Two definitions so the table is used fairly.">
            <ul className="space-y-2.5">
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
                <span className="text-[13px] leading-relaxed text-slate-600">
                  <span className="font-medium text-slate-800">Revenue</span> is closed-won bookings for this quarter — pipeline and
                  recognized revenue are different figures and are never mixed into it.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
                <span className="text-[13px] leading-relaxed text-slate-600">
                  A low <span className="font-medium text-slate-800">follow-up completion %</span> usually predicts next quarter's
                  pipeline problem — coach, don't rank-punish.
                </span>
              </li>
            </ul>
          </SectionCard>

          <SalesAsOf
            asOfLabel={data.period.asOfLabel}
            note="Rank is computed from closed-won revenue within your current view; it is a coaching aid, not a reward system."
          />
        </div>
      )}

      {!loading && !data && !error && (
        <EmptyState
          icon={<Users />}
          title="Sales Leaderboard could not load"
          message="The sales service returned no leaderboard data. Retry, or check the service status."
          action={
            <Button size="sm" onClick={reload}>
              Retry
            </Button>
          }
        />
      )}
    </div>
  );
}
