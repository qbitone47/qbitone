"use client";

import * as React from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard } from "../primitives";
import { useRole } from "../role-context";
import { EXEC_COLORS, MiniTrend, PeriodChip } from "../executive/parts";
import {
  fmtCr,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  useSalesSection,
} from "../sales/parts";

// ============================================================
// Screen 81 · Sales Forecast — commit, best case and weighted
// pipeline against the quarter target. Actual, Forecast and
// Target are three different numbers and are never mixed:
// every figure carries its explicit word, not just a color.
// Data: /api/sales?section=forecast (server-scoped payload).
// ============================================================

interface TargetRowT {
  id: string;
  kind: "employee" | "team";
  refId: string;
  label: string;
  quotaCr: number;
  achievedCr: number;
  pipelineCr: number;
  forecastCr: number;
}

interface ForecastSummary {
  target: number;
  closed: number;
  weighted: number;
  commit: number;
  bestCase: number;
  gap: number;
}

interface ForecastPayload {
  rows: TargetRowT[];
  summary: ForecastSummary;
  history: { week: string; commit: number; bestCase: number; weighted: number }[];
  period: { label: string; window: string; asOfLabel: string };
}

const TH =
  "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 md:px-4";
const THR = cn(TH, "text-right");
const TD = "whitespace-nowrap px-3 py-2.5 text-[13px] tabular-nums text-slate-700 md:px-4";

const pctOf = (achieved: number, quota: number) => (quota > 0 ? Math.round((achieved / quota) * 100) : 0);

/** Signed Cr figure — explicit sign, never color-only. */
const signedCr = (v: number) =>
  Math.abs(v) < 0.005 ? fmtCr(0) : v > 0 ? `+${fmtCr(v)}` : `−${fmtCr(Math.abs(v))}`;

// ---------- achievement cell — bar + % text + word chip ----------

function AchievementCell({
  pct,
  pipelineCr,
  showBehindPace = true,
}: {
  pct: number;
  pipelineCr?: number;
  showBehindPace?: boolean;
}) {
  const tone =
    pct >= 70
      ? { bar: "bg-emerald-500", text: "text-emerald-700" }
      : pct >= 40
        ? { bar: "bg-blue-600", text: "text-blue-700" }
        : { bar: "bg-amber-500", text: "text-amber-700" };
  const behindPace = showBehindPace && pct === 0 && (pipelineCr ?? 0) > 0;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Achievement ${pct}% of quota`}>
        <span className={cn("block h-full rounded-full", tone.bar)} style={{ width: `${Math.min(100, Math.max(4, pct))}%` }} />
      </span>
      <span className={cn("text-xs font-medium tabular-nums", tone.text)}>{pct}%</span>
      {behindPace && (
        <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-[10.5px] font-medium text-amber-700">
          Behind pace<span className="sr-only"> — no closed revenue yet this quarter</span>
        </span>
      )}
    </span>
  );
}

// ---------- headline band — plain-div 4-marker bar ----------

function ForecastBand({ summary }: { summary: ForecastSummary }) {
  const { target, closed, commit, bestCase, weighted } = summary;
  const scaleMax = Math.max(target, bestCase, commit, closed, weighted, 0.0001);
  const pct = (v: number) => Math.max(0, Math.min(100, (v / scaleMax) * 100));
  const targetPct = pct(target);
  const labelFlushRight = targetPct > 90; // keep the marker label inside the card
  const commitW = Math.max(0, pct(commit) - pct(closed));
  const bestW = Math.max(0, pct(bestCase) - pct(commit));

  const figures: { word: string; value: number; swatch: React.ReactNode }[] = [
    { word: "Actual won", value: closed, swatch: <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-emerald-500" aria-hidden /> },
    { word: "Commit forecast", value: commit, swatch: <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-blue-600" aria-hidden /> },
    { word: "Best case", value: bestCase, swatch: <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-dashed border-blue-400 bg-blue-50" aria-hidden /> },
    { word: "Weighted pipeline", value: weighted, swatch: <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-violet-500" aria-hidden /> },
    { word: "Target", value: target, swatch: <span className="h-3.5 w-0 shrink-0 border-l-2 border-dashed border-slate-500" aria-hidden /> },
  ];

  return (
    <div>
      <div
        className="relative pt-7"
        role="img"
        aria-label={`Forecast versus target for the quarter. Actual won ${fmtCr(closed)}. Commit forecast ${fmtCr(commit)}. Best case ${fmtCr(bestCase)}. Weighted pipeline ${fmtCr(weighted)}. Target ${fmtCr(target)}.`}
      >
        {/* target marker label — distinct dashed marker, always worded */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-6" aria-hidden>
          <span
            className={cn(
              "absolute top-0 whitespace-nowrap rounded border border-slate-200 bg-white px-1.5 py-px text-[10.5px] font-semibold text-slate-600 shadow-sm",
              !labelFlushRight && "-translate-x-1/2",
            )}
            style={{ left: `${targetPct}%` }}
          >
            Target {fmtCr(target)}
          </span>
        </div>

        {/* segmented bar: won → commit → best case, target marker across */}
        <div className="relative h-9 rounded-lg bg-slate-100">
          {pct(closed) > 0 && (
            <div className="absolute inset-y-0 left-0 rounded-l-lg bg-emerald-500" style={{ width: `${pct(closed)}%` }} aria-hidden />
          )}
          {commitW > 0.05 && (
            <div className="absolute inset-y-0 bg-blue-600" style={{ left: `${pct(closed)}%`, width: `${commitW}%` }} aria-hidden />
          )}
          {bestW > 0.05 && (
            <div
              className={cn("absolute inset-y-0 border border-dashed border-blue-300 bg-blue-50", pct(bestCase) > 99 && "rounded-r-lg")}
              style={{ left: `${pct(commit)}%`, width: `${bestW}%` }}
              aria-hidden
            />
          )}
          <div className="absolute -bottom-1.5 -top-1.5 border-l-2 border-dashed border-slate-500" style={{ left: `${targetPct}%` }} aria-hidden />
        </div>

        {/* weighted pipeline — separate slim row, same scale */}
        <div className="mt-3.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
              <span className="h-2 w-2 rounded-sm bg-violet-500" aria-hidden />
              Weighted pipeline
            </span>
            <span className="tabular-nums text-slate-600">{fmtCr(weighted)}</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct(weighted)}%` }} />
          </div>
        </div>
      </div>

      {/* labelled figures — word + number, never color-only */}
      <dl className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {figures.map((f) => (
          <div key={f.word} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
            <dt className="flex items-center gap-1.5 text-[11px] font-medium leading-tight text-slate-500">
              {f.swatch}
              <span className="truncate">{f.word}</span>
            </dt>
            <dd className="mt-1 text-[15px] font-semibold tabular-nums text-slate-900">{fmtCr(f.value)}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Scale runs ₹0 to {fmtCr(scaleMax)} — the larger of best case and target. Closed won is actual bookings; commit and best case
        are forecasts; the dashed marker is the target. Weighted pipeline is drawn on the same scale for context only.
      </p>
    </div>
  );
}

// ---------- gap tile ----------

function GapTile({ summary }: { summary: ForecastSummary }) {
  const { target, commit, bestCase, weighted, gap } = summary;
  const coversPct = target > 0 ? Math.round((commit / target) * 100) : 0;
  return (
    <SectionCard title="Gap to target" description="Target minus commit forecast.">
      <p className="text-[28px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
        {gap > 0 ? fmtCr(gap) : gap < 0 ? `−${fmtCr(Math.abs(gap))}` : fmtCr(0)}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
        Commit covers <span className="font-semibold text-slate-700">{coversPct}%</span> of the {fmtCr(target)} target
        {gap > 0
          ? ` — ${fmtCr(gap)} still to close this quarter.`
          : gap < 0
            ? " — the commit forecast already clears it."
            : " — commit sits exactly on target."}
      </p>
      <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-400">Best case upside over commit</dt>
          <dd className="tabular-nums text-slate-700">{fmtCr(Math.max(0, bestCase - commit))}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-400">Weighted pipeline (context)</dt>
          <dd className="tabular-nums text-slate-700">{fmtCr(weighted)}</dd>
        </div>
      </dl>
    </SectionCard>
  );
}

// ---------- forecast rows table (employees / teams) ----------

function ForecastRowsTable({ rows, entityLabel }: { rows: TargetRowT[]; entityLabel: string }) {
  return (
    <div className="qubit-scroll relative overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm" aria-label={`Forecast by ${entityLabel.toLowerCase()}`}>
        <thead>
          <tr className="border-b border-slate-200/90 bg-slate-50/95">
            <th scope="col" className={TH}>{entityLabel}</th>
            <th scope="col" className={THR}>Quota</th>
            <th scope="col" className={THR}>Achieved (won)</th>
            <th scope="col" className={THR}>Weighted pipeline</th>
            <th scope="col" className={THR}>Forecast</th>
            <th scope="col" className={THR}>Gap to quota</th>
            <th scope="col" className={TH}>Achievement</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const gap = r.quotaCr - r.forecastCr;
            const cleared = gap <= 0.005;
            return (
              <tr key={r.id} className="transition-colors hover:bg-blue-50/30">
                <td className={cn(TD, "font-medium text-slate-800")}>{r.label}</td>
                <td className={TD}>{fmtCr(r.quotaCr)}</td>
                <td className={TD}>{fmtCr(r.achievedCr)}</td>
                <td className={TD}>{fmtCr(r.pipelineCr * 0.55)}</td>
                <td className={cn(TD, "font-medium text-slate-900")}>{fmtCr(r.forecastCr)}</td>
                <td className={TD} title={cleared ? "Forecast covers the quota" : `${fmtCr(gap)} of quota not yet covered by forecast`}>
                  <span className="inline-flex items-center gap-1.5">
                    <span>{signedCr(gap)}</span>
                    {cleared && (
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-px text-[10.5px] font-medium text-emerald-700">
                        Cleared<span className="sr-only"> — forecast covers the quota</span>
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5 md:px-4">
                  <AchievementCell pct={pctOf(r.achievedCr, r.quotaCr)} pipelineCr={r.pipelineCr} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- screen ----------

export function SalesForecastScreen() {
  const { role } = useRole();
  const { data, loading, error, forbidden, reload } = useSalesSection<ForecastPayload>("forecast");

  if (forbidden) {
    return (
      <SalesGate screenName="Sales Forecast">
        <></>
      </SalesGate>
    );
  }

  const summary = data?.summary ?? null;
  const employees = data?.rows.filter((r) => r.kind === "employee") ?? [];
  const teams = data?.rows.filter((r) => r.kind === "team") ?? [];
  const ownScope = role === "sales-exec";
  const lastWeek = data?.history[data.history.length - 1] ?? null;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Sales Forecast" }]}
        title="Sales Forecast"
        description="Commit, best case and weighted pipeline against the quarter target. Actual, Forecast and Target are three different numbers — they are never mixed."
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={reload} aria-label="Reload forecast">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
          </Button>
        }
        meta={data ? <PeriodChip label={data.period.label} window={data.period.window} /> : undefined}
      />

      {error && !forbidden && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={5} />}

      {data && summary && !loading && (
        <div className="space-y-4">
          {/* headline band + gap tile */}
          <div className="grid gap-4 xl:grid-cols-3">
            <SectionCard
              className="xl:col-span-2"
              title="Forecast vs target"
              description={`${data.period.label} — one bar, four markers, three different kinds of number.`}
            >
              <ForecastBand summary={summary} />
            </SectionCard>
            <GapTile summary={summary} />
          </div>

          {/* forecast movement — from the store, not re-derived */}
          <SectionCard
            title="Forecast movement"
            description="Commit tracked week over week — swings become visible before they become misses."
          >
            <MiniTrend
              data={data.history.map((h) => ({ label: h.week, value: h.commit }))}
              color={EXEC_COLORS.primary}
              height={128}
              ariaLabel={
                data.history.length > 0
                  ? `Weekly commit movement, ${data.history[0].week} to ${lastWeek?.week}`
                  : "Weekly commit movement"
              }
            />
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              Weekly commit movement this quarter — from the forecast store, not re-derived in the UI.
              {lastWeek && ` Latest entry ${lastWeek.week}: commit ${fmtCr(lastWeek.commit)}, best case ${fmtCr(lastWeek.bestCase)}.`}
            </p>
          </SectionCard>

          {/* forecast by salesperson */}
          <SectionCard
            title="Forecast by salesperson"
            description="Employee rows from the forecast payload — quota, closed-won, weighted pipeline, commit forecast and the gap to quota."
          >
            {employees.length === 0 ? (
              <EmptyState
                icon={<TrendingUp />}
                title="No employee forecast rows"
                message="Your authorized scope has no target rows for this period."
              />
            ) : (
              <ForecastRowsTable rows={employees} entityLabel="Salesperson" />
            )}
            <div className="mt-3 space-y-1">
              <p className="text-[11px] text-slate-400">
                Per-row weighted pipeline = gross pipeline × 0.55 — the same blended demo weight used for the headline summary above.
              </p>
              {ownScope && <p className="text-[11px] text-slate-400">Scope note for own-boundary: you see your own row only.</p>}
            </div>
          </SectionCard>

          {/* forecast by team */}
          <SectionCard
            title="Forecast by team"
            description="Team rows roll their members' quotas and forecasts up — no re-computation happens in the UI."
          >
            {teams.length === 0 ? (
              <EmptyState
                icon={<TrendingUp />}
                title="No team forecast rows"
                message={ownScope ? "Team roll-ups are outside the own-records boundary." : "No team target rows exist for this period."}
              />
            ) : (
              <ForecastRowsTable rows={teams} entityLabel="Team" />
            )}
          </SectionCard>

          {/* risk & confidence — honest method note */}
          <SectionCard title="Risk & confidence" description="The method is documented, not magic.">
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-4">
              <h3 className="text-[13px] font-semibold text-slate-800">How commit is computed</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                Commit = closed won + 60% of the remaining forecast-to-close; weighted pipeline is shown separately for context.
                The six open stages keep their default probabilities from Sales Settings (New 10% through Contracting 85%), and the
                forecast store applies the blended weight — this screen never re-derives it.
              </p>
            </div>
          </SectionCard>

          <SalesAsOf
            asOfLabel={data.period.asOfLabel}
            note="Closed won is actual bookings; commit, best case and weighted pipeline are forecasts — the lines are never mixed."
          />
        </div>
      )}

      {!loading && !data && !error && (
        <EmptyState
          icon={<TrendingUp />}
          title="Sales Forecast could not load"
          message="The sales service returned no forecast data. Retry, or check the service status."
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
