"use client";

import * as React from "react";
import { ensureSession } from "@/lib/qubit/api";
import { AlertTriangle, ArrowRight, BarChart3, CalendarClock, Database, Download, Info, RefreshCw, ShieldCheck } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../primitives";
import { useRole } from "../role-context";
import { FreshnessBadge, CHART_TICK, EXEC_COLORS } from "../executive/parts";
import type { Freshness } from "@/lib/qubit/executive-data";
import type { DatasetResult } from "@/lib/qubit/analytics-server";
import type { ReportViz } from "@/lib/qubit/analytics-data";

// ============================================================
// Qubit One · Analytics shared parts (Phase 17)
// ONE presentation system for the centralized analytics layer —
// built on the Phase 2 design system and the Phase 5/6 loader
// pattern. Every screen consumes /api/analytics; authorization,
// scoping and metric governance live on the server. No neon, no
// decoration — enterprise charts that communicate (spec §1).
// ============================================================

// ---------- typed client for /api/analytics ----------

export class AnalyticsApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "AnalyticsApiError";
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
    throw new AnalyticsApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export async function analyticsGet<T>(section: string, role: string, params?: Record<string, string | undefined>): Promise<T> {
  await ensureSession(role);
  const qs = new URLSearchParams({ section });
  for (const [k, v] of Object.entries(params ?? {})) if (v) qs.set(k, v);
  const res = await fetch(`/api/analytics?${qs.toString()}`, {
    headers: { "X-Qubit-Role": role, "Content-Type": "application/json" },
    cache: "no-store",
  });
  return parse<T>(res);
}

export async function analyticsPost<T = { ok: boolean; message?: string }>(
  type: string,
  input: Record<string, unknown>,
  role: string,
): Promise<T> {
  await ensureSession(role);
  const res = await fetch("/api/analytics", {
    method: "POST",
    headers: { "X-Qubit-Role": role, "Content-Type": "application/json" },
    body: JSON.stringify({ type, input }),
  });
  return parse<T>(res);
}

// ---------- section loader (loading / error / permission states) ----------

export interface AnalyticsSectionState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  errorCode: string | null;
  forbidden: boolean;
  reload: () => void;
}

export function useAnalyticsSection<T>(section: string, params?: Record<string, string | undefined>): AnalyticsSectionState<T> {
  const { role } = useRole();
  const paramKey = JSON.stringify(params ?? {});
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [errorCode, setErrorCode] = React.useState<string | null>(null);
  const [forbidden, setForbidden] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setErrorCode(null);
    analyticsGet<T>(section, role, JSON.parse(paramKey))
      .then((d) => {
        if (alive) {
          setData(d);
          setForbidden(false);
        }
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const err = e as AnalyticsApiError;
        setError(err.message ?? "Analytics request failed.");
        setErrorCode(err.code ?? null);
        setForbidden(err.status === 403);
        setData(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [section, paramKey, role, tick]);

  return { data, loading, error, errorCode, forbidden, reload };
}

// ---------- gates / banners / skeletons ----------

export function AnalyticsGate({ children, screenName }: { children: React.ReactNode; screenName: string }) {
  const { role } = useRole();
  if (role === "employee" || role === "sales-exec" || role === "hr-manager" || role === "dept-head" || role === "administrator") {
    return <>{children}</>;
  }
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <span className="qubit-icon-tile qubit-icon-tile-accent mx-auto mb-4 h-12 w-12">
        <ShieldCheck aria-hidden />
      </span>
      <h1 className="text-lg font-semibold text-slate-900">Analytics access required</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {screenName} requires an authorized analytics role, and the server enforces this restriction — it is not a hidden-UI pattern.
      </p>
    </div>
  );
}

export function AnalyticsErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <p className="min-w-0 flex-1 text-[13px] text-amber-900">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="h-8 shrink-0">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
      </Button>
    </div>
  );
}

export function AnalyticsSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-100 bg-slate-50" />
      ))}
    </div>
  );
}

export function ScopeNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-start gap-1.5 text-[11.5px] leading-relaxed text-slate-500", className)}>
      <Info className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function SourceLine({ system, freshness }: { system: string; freshness?: Freshness }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
      <Database className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
      <span className="font-medium text-slate-600">{system}</span>
      {freshness && <FreshnessBadge freshness={freshness} short />}
    </div>
  );
}

/** Footer strip — freshness + period + governance, one voice per screen. */
export function AnalyticsAsOf({ asOfLabel, fiscalNote }: { asOfLabel?: string; fiscalNote?: string }) {
  return (
    <footer className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-4 text-[11.5px] text-slate-400">
      {asOfLabel && <span>Data as of {asOfLabel}</span>}
      {fiscalNote && <span>{fiscalNote}</span>}
      <span className="ml-auto inline-flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" aria-hidden /> Scoping, permissions and metric governance enforced server-side
      </span>
    </footer>
  );
}

// ---------- metric governance ----------

export interface MetricRef {
  id?: string;
  name?: string;
  definition?: string;
  calc?: string;
  source?: string;
  period?: string;
  owner?: string;
  caution?: string;
}

/** Metric definition disclosure — the UI makes the definition clear (spec §6). */
export function MetricDef({ metric, label }: { metric: MetricRef | null | undefined; label?: string }) {
  const [open, setOpen] = React.useState(false);
  if (!metric?.definition) return label ? <span>{label}</span> : null;
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Definition of ${metric.name ?? label ?? "this metric"}`}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500 underline decoration-slate-300 decoration-dotted underline-offset-2 transition-colors hover:text-slate-700"
      >
        {label ?? metric.name}
        <Info className="h-3 w-3 text-slate-400" aria-hidden />
      </button>
      {open && (
        <span className="absolute left-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-lg">
          <span className="block text-xs font-semibold text-slate-900">{metric.name ?? label}</span>
          <span className="mt-1 block text-[11.5px] leading-relaxed text-slate-600">{metric.definition}</span>
          {metric.calc && <span className="mt-1.5 block text-[11px] text-slate-500"><span className="font-medium">Calculation:</span> {metric.calc}</span>}
          {metric.source && <span className="mt-1 block text-[11px] text-slate-500"><span className="font-medium">Source:</span> {metric.source}</span>}
          {metric.period && <span className="mt-0.5 block text-[11px] text-slate-500"><span className="font-medium">Period:</span> {metric.period}</span>}
          {metric.owner && <span className="mt-0.5 block text-[11px] text-slate-500"><span className="font-medium">Data owner:</span> {metric.owner}</span>}
          {metric.caution && <span className="mt-1.5 block text-[11px] font-medium text-amber-700">{metric.caution}</span>}
          <button type="button" onClick={() => setOpen(false)} className="mt-2 text-[11px] font-medium text-blue-600 hover:text-blue-700">
            Close
          </button>
        </span>
      )}
    </span>
  );
}

// ---------- accessible charts (spec §34 — summaries + table alternatives) ----------

export interface SeriesPoint {
  label: string;
  value: number;
  target?: number | null;
}

/** Horizontal labelled bars — the workhorse chart; accessible via role=img + aria-label. */
export function BarList({
  items,
  unit,
  ariaLabel,
  tone = "blue",
  valueFormat,
  max: maxOverride,
  className,
}: {
  items: { label: string; value: number; hint?: string; tone?: string }[];
  unit?: string;
  ariaLabel: string;
  tone?: "blue" | "emerald" | "amber" | "slate";
  valueFormat?: (v: number) => string;
  max?: number;
  className?: string;
}) {
  const max = maxOverride ?? Math.max(1, ...items.map((i) => Math.abs(i.value)));
  const toneCls = { blue: "bg-blue-500", emerald: "bg-emerald-500", amber: "bg-amber-500", slate: "bg-slate-400" }[tone];
  const fmt = valueFormat ?? ((v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString("en-IN") : Math.round(v * 100) / 100).toString());
  return (
    <div role="img" aria-label={ariaLabel} className={cn("space-y-2.5", className)}>
      {items.map((it) => (
        <div key={it.label} className="grid grid-cols-[minmax(7rem,11rem)_1fr_auto] items-center gap-2.5">
          <span className="truncate text-[12px] font-medium text-slate-600" title={it.label}>{it.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <span className={cn("block h-full rounded-full", it.tone ?? toneCls)} style={{ width: `${Math.min(100, Math.max(2, (Math.abs(it.value) / max) * 100))}%` }} />
          </span>
          <span className="text-right text-[12px] font-semibold tabular-nums text-slate-900">
            {fmt(it.value)}
            {unit ? <span className="ml-0.5 text-[10px] font-normal text-slate-400">{unit}</span> : null}
            {it.hint ? <span className="ml-1.5 text-[10px] font-normal text-slate-400">{it.hint}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Trend chart with target line — accessible summary below. */
export function TrendChart({
  points,
  unit,
  ariaLabel,
  summary,
  height = 220,
  color = EXEC_COLORS.primary,
  showTarget = true,
}: {
  points: SeriesPoint[];
  unit?: string;
  ariaLabel: string;
  summary: string;
  height?: number;
  color?: string;
  showTarget?: boolean;
}) {
  const hasTarget = showTarget && points.some((p) => p.target !== undefined && p.target !== null);
  return (
    <figure className="m-0">
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          {hasTarget ? (
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className={CHART_TICK} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} className={CHART_TICK} />
              <Tooltip formatter={(v: number) => [`${v}${unit ? ` ${unit}` : ""}`, ""]} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2.5 }} name="Actual" />
              <Line type="monotone" dataKey="target" stroke={EXEC_COLORS.slate} strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="Target" />
            </LineChart>
          ) : (
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="an-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className={CHART_TICK} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} className={CHART_TICK} />
              <Tooltip formatter={(v: number) => [`${v}${unit ? ` ${unit}` : ""}`, ""]} />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#an-fill)" name="Value" />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-[11px] leading-relaxed text-slate-400">{summary}</figcaption>
    </figure>
  );
}

/** Column chart — single series; accessible summary below. */
export function ColumnChart({
  points,
  unit,
  ariaLabel,
  summary,
  height = 220,
  color = EXEC_COLORS.primary,
}: {
  points: { label: string; value: number }[];
  unit?: string;
  ariaLabel: string;
  summary: string;
  height?: number;
  color?: string;
}) {
  return (
    <figure className="m-0">
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className={CHART_TICK} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} className={CHART_TICK} />
            <Tooltip formatter={(v: number) => [`${v}${unit ? ` ${unit}` : ""}`, ""]} />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} name="Value" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-[11px] leading-relaxed text-slate-400">{summary}</figcaption>
    </figure>
  );
}

// ---------- funnel view (screen 277 shares this) ----------

export interface FunnelStageRow {
  stage: string;
  count: number | null;
  valueCr: number | null;
  note?: string;
}

export function FunnelView({
  stages,
  ariaLabel,
  valueUnit = "₹ Cr",
}: {
  stages: FunnelStageRow[];
  ariaLabel: string;
  valueUnit?: string;
}) {
  const first = stages.find((s) => s.count !== null && s.count > 0)?.count ?? 0;
  return (
    <div role="img" aria-label={ariaLabel} className="space-y-3">
      {stages.map((s, idx) => {
        const prev = idx > 0 ? stages[idx - 1] : null;
        const conv = prev && prev.count && s.count !== null && prev.count > 0 ? Math.round((s.count / prev.count) * 1000) / 10 : null;
        const drop = conv !== null ? Math.round((100 - conv) * 10) / 10 : null;
        const width = s.count !== null && first > 0 ? Math.max(6, (s.count / first) * 100) : s.valueCr !== null ? 100 : 6;
        return (
          <div key={s.stage} className="grid grid-cols-[minmax(6.5rem,9rem)_1fr_auto] items-center gap-2.5">
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-semibold text-slate-800">{s.stage}</p>
              {s.note && <p className="truncate text-[10.5px] text-slate-400" title={s.note}>{s.note}</p>}
            </div>
            <div className="h-7 overflow-hidden rounded-lg bg-slate-100">
              <div className="flex h-full items-center rounded-lg bg-blue-500/90 px-2.5" style={{ width: `${width}%` }}>
                <span className="text-[11px] font-semibold tabular-nums text-white">
                  {s.count !== null ? s.count.toLocaleString("en-IN") : s.valueCr !== null ? `₹${s.valueCr.toFixed(2)} ${valueUnit}` : "—"}
                </span>
              </div>
            </div>
            <div className="w-28 text-right">
              {conv !== null && (
                <p className="text-[11px] tabular-nums text-slate-500">
                  <span className="font-semibold text-slate-700">{conv}%</span> conv
                  {drop !== null && drop > 0 && <span className="ml-1 text-rose-600">−{drop}% drop</span>}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- dataset result renderer (builder preview + report detail) ----------

const fmtCell = (v: string | number | undefined, type: string): string => {
  if (v === undefined || v === null) return "—";
  if (typeof v === "string") return v;
  switch (type) {
    case "currency-cr":
      return `₹${v.toFixed(2)} Cr`;
    case "currency-inr":
      return `₹${Math.round(v).toLocaleString("en-IN")}`;
    case "pct":
      return `${Math.round(v * 10) / 10}%`;
    case "count":
      return Math.round(v).toLocaleString("en-IN");
    default:
      return Math.round(v * 100) / 100 === Math.round(v) ? Math.round(v).toLocaleString("en-IN") : (Math.round(v * 100) / 100).toString();
  }
};

export function DatasetView({ result, viz, compact }: { result: DatasetResult; viz: ReportViz; compact?: boolean }) {
  const { columns, rows } = result;
  const numericCols = columns.filter((c) => c.kind === "measure");
  const dimCols = columns.filter((c) => c.kind === "dimension");

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 aria-hidden />}
        title="No rows for this configuration"
        message="Adjust the dimensions, measures or filters — the semantic layer returns only what the source holds."
      />
    );
  }

  if (viz === "table" || numericCols.length === 0) {
    return (
      <div className={cn("relative overflow-x-auto", compact && "max-h-80 overflow-y-auto")}>
        <table className="w-full min-w-[480px] text-left text-[12.5px]">
          <caption className="sr-only">Report data — {result.rowCount} rows from {result.system}</caption>
          <thead>
            <tr className="border-b border-slate-200">
              {columns.map((c) => (
                <th key={c.id} scope="col" className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                {columns.map((c) => (
                  <td key={c.id} className={cn("whitespace-nowrap px-3 py-2", c.kind === "measure" ? "text-right font-semibold tabular-nums text-slate-900" : "text-slate-700")}>
                    {fmtCell(r[c.id], c.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (viz === "kpi") {
    const m = numericCols[0];
    const total = rows.reduce((n, r) => n + Number(r[m.id] ?? 0), 0);
    return (
      <div className="space-y-2">
        <p className="text-[28px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">{fmtCell(total, m.type)}</p>
        <p className="text-xs text-muted-foreground">Total {m.label} across {rows.length} {dimCols[0]?.label ?? "rows"} · {result.system}</p>
        <BarList
          ariaLabel={`${m.label} breakdown`}
          items={rows.slice(0, 8).map((r) => ({ label: String(r[dimCols[0]?.id ?? ""] ?? "—"), value: Number(r[m.id] ?? 0) }))}
          valueFormat={(v) => fmtCell(v, m.type)}
        />
      </div>
    );
  }

  // bar / line / area over first dimension × first measure
  const dim = dimCols[0]?.id ?? "label";
  const measure = numericCols[0];
  const points = rows.slice(0, 12).map((r) => ({ label: String(r[dim] ?? "—").slice(0, 14), value: Number(r[measure.id] ?? 0) }));
  const summary = `${measure.label} across ${points.length} ${dimCols[0]?.label ?? "groups"} — first value ${points[0]?.value ?? 0}, largest ${Math.max(...points.map((p) => p.value))}, smallest ${Math.min(...points.map((p) => p.value))}. The table view holds the exact figures.`;

  if (viz === "line" || viz === "area") {
    return <TrendChart points={points} ariaLabel={`${measure.label} trend`} summary={summary} />;
  }
  return (
    <div className="space-y-4">
      <ColumnChart points={points} ariaLabel={`${measure.label} by ${dimCols[0]?.label ?? "group"}`} summary={summary} />
      {rows.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[12px] font-medium text-blue-600 hover:text-blue-700">Show exact figures (accessible table)</summary>
          <div className="mt-3">
            <DatasetView result={{ ...result, rows: rows.slice(0, 20) }} viz="table" compact />
          </div>
        </details>
      )}
    </div>
  );
}

// ---------- status chips ----------

export function ExportStatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    Queued: { cls: "border-slate-200 bg-slate-50 text-slate-600", label: "Queued" },
    Processing: { cls: "border-blue-100 bg-blue-50 text-blue-700", label: "Processing" },
    Ready: { cls: "border-emerald-100 bg-emerald-50 text-emerald-700", label: "Ready" },
    Failed: { cls: "border-rose-100 bg-rose-50 text-rose-700", label: "Failed" },
    Expired: { cls: "border-slate-200 bg-slate-100 text-slate-500", label: "Expired" },
  };
  const it = map[status] ?? map.Queued;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", it.cls)}>
      {status === "Ready" ? <Download className="h-3 w-3" aria-hidden /> : status === "Failed" ? <AlertTriangle className="h-3 w-3" aria-hidden /> : null}
      {it.label}
    </span>
  );
}

export function ScheduleStatusChip({ active }: { active: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", active ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500")}>
      <CalendarClock className="h-3 w-3" aria-hidden />
      {active ? "Active" : "Paused"}
    </span>
  );
}

const VIS_TONE: Record<string, string> = {
  Company: "border-blue-100 bg-blue-50 text-blue-700",
  Department: "border-teal-100 bg-teal-50 text-teal-700",
  Private: "border-slate-200 bg-slate-50 text-slate-600",
};

export function VisibilityChip({ visibility }: { visibility: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium", VIS_TONE[visibility] ?? VIS_TONE.Private)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden />
      {visibility}
    </span>
  );
}

export function NextArrow({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-blue-600">
      {label}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}
