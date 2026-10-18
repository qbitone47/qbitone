"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Info,
  Minus,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import {
  formatINR,
  formatPct,
  type DomainStatus,
  type Freshness,
  type Kpi,
  type KpiUnit,
} from "@/lib/qubit/executive-data";
import type { ScreenId, ScreenParams } from "@/lib/qubit/screens";

// ============================================================
// Qubit One · Executive shared parts (Phase 5)
// Reusable executive visualization + state components built on
// the existing Phase 2 design system — no separate visual voice.
// ============================================================

// ---------- RESTRICTED chart palette (spec §13 — no random colors) ----------
export const EXEC_COLORS = {
  primary: "#2563EB",
  teal: "#0D9488",
  violet: "#7C3AED",
  amber: "#F59E0B",
  slate: "#94A3B8",
  red: "#DC2626",
  emerald: "#059669",
} as const;

/** shared recharts chrome — matches the Phase 2 charts language */
export const CHART_TICK =
  "[&_.recharts-cartesian-axis-tick_text]:fill-slate-400 [&_.recharts-cartesian-grid_line]:stroke-slate-100 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-slate-200";

// ---------- typed client for /api/executive ----------

export class ExecApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "ExecApiError";
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
    throw new ExecApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export async function execGet<T>(section: string, role: string): Promise<T> {
  const res = await fetch(`/api/executive?section=${encodeURIComponent(section)}`, {
    headers: { "X-Qubit-Role": role, "Content-Type": "application/json" },
    cache: "no-store",
  });
  return parse<T>(res);
}

export async function execPost<T = { ok: boolean }>(
  body: Record<string, unknown>,
  role: string,
): Promise<T> {
  const res = await fetch("/api/executive", {
    method: "POST",
    headers: { "X-Qubit-Role": role, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parse<T>(res);
}

// ---------- section loader (loading / error / permission states) ----------

export interface SectionState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  forbidden: boolean;
  reload: () => void;
}

export function useExecutiveSection<T>(section: string): SectionState<T> {
  const { role } = useRole();
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [forbidden, setForbidden] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    execGet<T>(section, role)
      .then((d) => {
        if (alive) {
          setData(d);
          setForbidden(false);
        }
      })
      .catch((err) => {
        if (!alive) return;
        if (err instanceof ExecApiError && err.status === 403) {
          setForbidden(true);
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : "The executive data service is unreachable right now.");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [section, role, tick]);

  return { data, loading, error, forbidden, reload };
}

// ---------- ExecutiveGate — authorization is a first-class state ----------

export function ExecutiveGate({
  children,
  screenName,
}: {
  children: React.ReactNode;
  screenName: string;
}) {
  const { role, setRole } = useRole();
  if (role === "administrator") return <>{children}</>;
  return (
    <div className="qubit-card mx-auto mt-6 max-w-xl p-6 text-center" role="alert">
      <span className="qubit-icon-tile qubit-icon-tile-accent mx-auto mb-4 h-12 w-12">
        <ShieldAlert />
      </span>
      <h2 className="text-base font-semibold text-slate-900">Executive access required</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-slate-500">
        {screenName} contains company-wide performance data that is restricted to executive
        authority. You are currently previewing the <span className="font-medium text-slate-700">{role}</span> boundary,
        and the server enforces this restriction — it is not a hidden-UI pattern.
      </p>
      <Button size="sm" className="mt-4 h-9 gap-1.5" onClick={() => setRole("administrator")}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Return to Administrator
      </Button>
    </div>
  );
}

// ---------- FreshnessBadge — never make stale data look live (spec §7) ----------

const FRESH_TONE: Record<DomainStatus, { icon: React.ReactNode; badge: string; text: string }> = {
  live: { icon: <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>, badge: "border-emerald-200 bg-emerald-50 text-emerald-700", text: "text-emerald-700" },
  ok: { icon: <Clock className="h-3 w-3" />, badge: "border-slate-200 bg-slate-50 text-slate-600", text: "text-slate-500" },
  delayed: { icon: <Clock className="h-3 w-3" />, badge: "border-amber-200 bg-amber-50 text-amber-700", text: "text-amber-700" },
  stale: { icon: <Clock className="h-3 w-3" />, badge: "border-amber-200 bg-amber-50 text-amber-700", text: "text-amber-700" },
  unavailable: { icon: <Clock className="h-3 w-3" />, badge: "border-red-200 bg-red-50 text-red-700", text: "text-red-700" },
};

const FRESH_WORD: Record<DomainStatus, string> = {
  live: "Live",
  ok: "Updated",
  delayed: "Delayed",
  stale: "Stale",
  unavailable: "Unavailable",
};

export function FreshnessBadge({
  freshness,
  className,
  short,
}: {
  freshness: Freshness;
  className?: string;
  short?: boolean;
}) {
  const tone = FRESH_TONE[freshness.status];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone.badge,
        className,
      )}
      title={freshness.detail ?? freshness.label}
    >
      {tone.icon}
      <span className="truncate">
        {FRESH_WORD[freshness.status]}
        {!short && freshness.status !== "live" ? ` · ${freshness.label.replace(/^Updated\s*/, "")}` : ""}
      </span>
      {freshness.detail && <span className="sr-only"> — {freshness.detail}</span>}
    </span>
  );
}

// ---------- PeriodChip — one reporting period across every screen ----------

export function PeriodChip({ label, window: win, className }: { label: string; window: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)]", className)}>
      {label}
      <span className="h-3 w-px bg-slate-200" aria-hidden />
      <span className="text-slate-400">{win}</span>
    </span>
  );
}

// ---------- KPI value formatting ----------

export function formatKpiValue(unit: KpiUnit, value: number): string {
  switch (unit) {
    case "INR-cr":
      return formatINR(value);
    case "pct":
      return `${value.toFixed(1)}%`;
    case "x":
      return `${value.toFixed(1)}x`;
    case "count":
      return value.toLocaleString("en-IN");
    case "hours":
      return `${value.toFixed(1)} h`;
    case "days":
      return `${value.toFixed(1)} days`;
    case "min":
      return `${Math.round(value)} min`;
    default:
      return String(value);
  }
}

// ---------- TrendArrow — arrow + text, never color-only ----------

export function TrendArrow({
  trendPct,
  direction,
  suffix = "",
  className,
}: {
  trendPct: number;
  direction: "up-good" | "down-good";
  suffix?: string;
  className?: string;
}) {
  const up = trendPct > 0.05;
  const down = trendPct < -0.05;
  const good = direction === "up-good" ? up : down;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        good ? "text-emerald-700" : trendPct === 0 ? "text-slate-500" : "text-red-600",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {trendPct === 0 ? "Flat" : `${up ? "+" : ""}${trendPct.toFixed(1)}%`}
      {suffix && <span className="font-normal text-slate-400">{suffix}</span>}
    </span>
  );
}

// ---------- KpiInfo — unobtrusive definition (spec §8) ----------

export function KpiInfo({
  definition,
  calc,
  source,
  period,
  kind,
}: {
  definition: string;
  calc?: string;
  source?: string;
  period?: string;
  kind?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="KPI definition"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Definition</p>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{definition}</p>
        <dl className="mt-3 space-y-1.5 border-t pt-3 text-xs">
          {calc && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 font-medium text-slate-400">Calc</dt>
              <dd className="text-slate-600">{calc}</dd>
            </div>
          )}
          {source && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 font-medium text-slate-400">Source</dt>
              <dd className="text-slate-600">{source}</dd>
            </div>
          )}
          {period && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 font-medium text-slate-400">Period</dt>
              <dd className="text-slate-600">{period}</dd>
            </div>
          )}
          {kind && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 font-medium text-slate-400">Type</dt>
              <dd className="text-slate-600">{kind}</dd>
            </div>
          )}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

// ---------- KpiCard — value · comparison · trend · target · status · drilldown ----------

export function KpiCard({ kpi, onDrill }: { kpi: Kpi; onDrill?: () => void }) {
  const achieved = kpi.target !== undefined ? (kpi.value / kpi.target) * 100 : null;
  const positiveAchievement = kpi.direction === "up-good" ? (achieved ?? 100) >= 97 : (achieved ?? 100) <= 103;
  return (
    <article className="qubit-card qubit-card-hover flex h-full flex-col p-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1 text-[13px] font-medium text-slate-500">
          <span className="leading-snug">{kpi.name}</span>
          <KpiInfo definition={kpi.definition} calc={kpi.calc} source={kpi.source} period={kpi.period} kind={kpi.kind} />
        </h3>
        <StatusBadge status={kpi.status} size="sm" />
      </div>
      <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
        {formatKpiValue(kpi.unit, kpi.value)}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <TrendArrow trendPct={kpi.trendPct} direction={kpi.direction} />
        <span className="text-xs text-muted-foreground">{kpi.comparisonText}</span>
      </div>
      {kpi.target !== undefined && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Target {formatKpiValue(kpi.unit, kpi.target)}</span>
            <span className={cn("font-medium", positiveAchievement ? "text-emerald-700" : "text-amber-700")}>
              {achieved!.toFixed(0)}% of target
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${achieved!.toFixed(0)}% of target`}>
            <div
              className={cn("h-full rounded-full", positiveAchievement ? "bg-emerald-500" : "bg-amber-500")}
              style={{ width: `${Math.min(100, Math.max(4, achieved!))}%` }}
            />
          </div>
        </div>
      )}
      <p className="mt-3 line-clamp-2 min-h-[2rem] text-[11.5px] leading-relaxed text-slate-500">
        <span className="font-medium text-slate-600">Driver:</span> {kpi.primaryDriver}
      </p>
      {onDrill && (
        <button
          type="button"
          onClick={onDrill}
          className="group/link mt-auto inline-flex items-center gap-1.5 pt-2 text-[12.5px] font-medium text-blue-600 transition-colors hover:text-blue-700"
        >
          Investigate
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" aria-hidden />
        </button>
      )}
    </article>
  );
}

// ---------- MiniTrend — restrained sparkline area (spec §13) ----------

export function MiniTrend({
  data,
  height = 72,
  color = EXEC_COLORS.primary,
  targetKey,
  ariaLabel,
}: {
  data: { label: string; value: number; target?: number }[];
  height?: number;
  color?: string;
  targetKey?: string;
  ariaLabel?: string;
}) {
  const config: ChartConfig = {
    value: { label: "Value", color },
    ...(targetKey ? { target: { label: "Target", color: EXEC_COLORS.slate } } : {}),
  };
  return (
    <ChartContainer config={config} className={cn("w-full", CHART_TICK)} style={{ height }} aria-label={ariaLabel} role="img">
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} minTickGap={18} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Area dataKey="value" type="monotone" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.08} dot={false} />
        {targetKey && <Area dataKey={targetKey} type="monotone" stroke={EXEC_COLORS.slate} strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" dot={false} />}
      </AreaChart>
    </ChartContainer>
  );
}

// ---------- ComparisonBars — target vs actual / regional bars ----------

export function ComparisonBars({
  items,
  height = 200,
  ariaLabel,
}: {
  items: { label: string; actual: number; target: number }[];
  height?: number;
  ariaLabel?: string;
}) {
  const config: ChartConfig = {
    actual: { label: "Actual", color: EXEC_COLORS.primary },
    target: { label: "Target", color: EXEC_COLORS.slate },
  };
  return (
    <ChartContainer config={config} className={cn("w-full", CHART_TICK)} style={{ height }}>
      <BarChart data={items} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Bar dataKey="target" fill={EXEC_COLORS.slate} fillOpacity={0.5} radius={[3, 3, 0, 0]} maxBarSize={26} />
        <Bar dataKey="actual" fill={EXEC_COLORS.primary} radius={[3, 3, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ChartContainer>
  );
}

// ---------- ContributionList — horizontal share-of-total bars ----------

export function ContributionList({
  items,
  formatValue = (v: number) => String(v),
  className,
}: {
  items: { label: string; value: number; hint?: string }[];
  formatValue?: (v: number) => string;
  className?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 0.0001);
  return (
    <ul className={cn("space-y-2.5", className)} aria-label="Contribution breakdown">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate font-medium text-slate-700">{item.label}</span>
            <span className="shrink-0 tabular-nums text-slate-600">
              {formatValue(item.value)}
              {item.hint && <span className="ml-1.5 text-[11px] text-slate-400">{item.hint}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600/85" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- SeverityBadge — Info / Attention / High / Critical ----------

export function SeverityBadge({ severity, size = "default" }: { severity: "Info" | "Attention" | "High" | "Critical"; size?: "default" | "sm" }) {
  const map = {
    Info: { dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
    Attention: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
    High: { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
    Critical: { dot: "bg-white", text: "text-white", bg: "bg-red-600", border: "border-red-600" },
  } as const;
  const t = map[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
        t.bg,
        t.text,
        t.border,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", t.dot)} aria-hidden />
      {severity}
    </span>
  );
}

// ---------- AttentionItem — SIGNAL → CONTEXT → IMPACT → ACTION row ----------

export function AttentionItem({
  severity,
  title,
  context,
  onOpen,
  actionLabel = "Review",
  meta,
}: {
  severity: "Info" | "Attention" | "High" | "Critical";
  title: string;
  context: string;
  onOpen: () => void;
  actionLabel?: string;
  meta?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-3 first:pt-0 last:border-0 last:pb-0">
      <SeverityBadge severity={severity} size="sm" />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[13.5px] font-medium text-slate-800">{title}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{context}</p>
      </button>
      {meta && <span className="hidden shrink-0 text-[11px] text-slate-400 sm:block">{meta}</span>}
      <Button size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs" onClick={onOpen}>
        {actionLabel}
      </Button>
    </div>
  );
}

// ---------- domain card for the overview band ----------

export function DomainCard({
  name,
  headline,
  sub,
  health,
  freshness,
  attention,
  onOpen,
}: {
  name: string;
  headline: string;
  sub: string;
  health: "On Track" | "Watch" | "At Risk";
  freshness: Freshness;
  attention?: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="qubit-card qubit-card-hover flex h-full flex-col p-4 text-left"
      aria-label={`Open ${name} overview`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-slate-800">{name}</span>
        <StatusBadge status={health} size="sm" />
      </div>
      <p className="mt-2 text-[15px] font-semibold leading-tight tracking-tight text-slate-900">{headline}</p>
      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{sub}</p>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
        <FreshnessBadge freshness={freshness} short />
        {attention ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
            {attention} alert{attention === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="text-[11px] text-slate-300">No alerts</span>
        )}
      </div>
    </button>
  );
}

// ---------- states: error banner + skeleton ----------

export function ExecErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="qubit-card mb-3 flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50/60 px-4 py-3" role="alert">
      <p className="text-sm font-medium text-red-700">{message}</p>
      <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
      </Button>
    </div>
  );
}

export function ExecSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="qubit-card p-4">
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
          <div className="mt-3 h-8 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
      <span className="sr-only" role="status">Loading executive data…</span>
    </div>
  );
}

// ---------- freshness strip (data-as-of footer per screen) ----------

export function AsOfStrip({ asOfLabel, note }: { asOfLabel: string; note?: string }) {
  return (
    <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
      <Clock className="h-3 w-3" aria-hidden />
      <span>Data as of {asOfLabel}.</span>
      {note && <span>{note}</span>}
      <span className="sr-only">Each domain carries its own freshness indicator; delayed sources are labelled, never shown as live.</span>
    </p>
  );
}

// ---------- navigation helper for executive drilldowns ----------

export function useExecutiveNav() {
  const nav = useQubitNav();
  return React.useCallback(
    (screen: ScreenId, params?: ScreenParams) => nav.navigate(screen, params),
    [nav],
  );
}
