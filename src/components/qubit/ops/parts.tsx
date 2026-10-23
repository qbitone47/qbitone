"use client";

// ============================================================
// Qubit One — Phase 22 · Operations shared client primitives.
// Mirrors platform/parts.tsx (same design language, same error
// vocabulary) and adds what operations needs: the honest
// "not configured" state, environment badges and dense tables.
// ============================================================

import * as React from "react";
import { cn } from "@/lib/utils";
import { ensureSession } from "@/lib/qubit/api";
import { useRole } from "../role-context";

export class OpsApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "OpsApiError";
    this.status = status;
    this.code = code;
  }
}

export async function opsGet<T>(section: string, role: string): Promise<T> {
  await ensureSession(role);
  const res = await fetch(`/api/ops?section=${encodeURIComponent(section)}`, {
    headers: { "Content-Type": "application/json", "X-Qubit-Role": role },
    cache: "no-store",
  });
  if (!res.ok) {
    let code: string | undefined;
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      code = body?.code;
      message = body?.message ?? message;
    } catch { /* keep generic */ }
    throw new OpsApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export async function opsPost<T = { ok: boolean; message?: string }>(
  type: string,
  input?: Record<string, unknown>,
  role?: string,
  confirm?: boolean,
): Promise<T> {
  await ensureSession(role ?? "administrator");
  const res = await fetch("/api/ops", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Qubit-Role": role ?? "administrator" },
    body: JSON.stringify({ type, input: input ?? {}, confirm }),
  });
  if (!res.ok) {
    let code: string | undefined;
    let message = `Request failed (${res.status}).`;
    try {
      const json = await res.json();
      code = json?.code;
      message = json?.message ?? message;
    } catch { /* keep generic */ }
    throw new OpsApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

// ---------- section loader ----------
export interface OpsSectionState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  forbidden: boolean;
  reload: () => void;
}

export function useOpsSection<T>(section: string): OpsSectionState<T> {
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
    setForbidden(false);
    opsGet<T>(section, role)
      .then((d) => { if (alive) setData(d); })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof OpsApiError) {
          setError(e.message);
          setForbidden(e.status === 403);
        } else {
          setError("The operations endpoint could not be reached.");
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [section, role, tick]);

  return { data, loading, error, forbidden, reload };
}

// ---------- health vocabulary (icon + text, never color-only) ----------
export type OpsHealth = "healthy" | "degraded" | "unavailable" | "not-configured" | "unknown" | "maintenance";

export function OpsHealthBadge({ health, className }: { health: OpsHealth | string; className?: string }) {
  const map: Record<string, { cls: string; label: string; dot: string }> = {
    healthy: { cls: "border-emerald-200 bg-emerald-50 text-emerald-800", label: "Healthy", dot: "bg-emerald-500" },
    connected: { cls: "border-emerald-200 bg-emerald-50 text-emerald-800", label: "Connected", dot: "bg-emerald-500" },
    ready: { cls: "border-emerald-200 bg-emerald-50 text-emerald-800", label: "Ready", dot: "bg-emerald-500" },
    operational: { cls: "border-emerald-200 bg-emerald-50 text-emerald-800", label: "Operational", dot: "bg-emerald-500" },
    reachable: { cls: "border-emerald-200 bg-emerald-50 text-emerald-800", label: "Reachable", dot: "bg-emerald-500" },
    active: { cls: "border-emerald-200 bg-emerald-50 text-emerald-800", label: "Active", dot: "bg-emerald-500" },
    degraded: { cls: "border-amber-200 bg-amber-50 text-amber-800", label: "Degraded", dot: "bg-amber-500" },
    unknown: { cls: "border-slate-200 bg-slate-50 text-slate-600", label: "Unknown", dot: "bg-slate-400" },
    "not-configured": { cls: "border-slate-300 bg-slate-100 text-slate-600", label: "Not configured", dot: "bg-slate-400" },
    missing: { cls: "border-red-200 bg-red-50 text-red-800", label: "Missing", dot: "bg-red-500" },
    failing: { cls: "border-red-200 bg-red-50 text-red-800", label: "Failing", dot: "bg-red-500" },
    unreachable: { cls: "border-red-200 bg-red-50 text-red-800", label: "Unreachable", dot: "bg-red-500" },
    unavailable: { cls: "border-red-200 bg-red-50 text-red-800", label: "Unavailable", dot: "bg-red-500" },
    maintenance: { cls: "border-blue-200 bg-blue-50 text-blue-800", label: "Maintenance", dot: "bg-blue-500" },
  };
  const v = map[health] ?? map.unknown;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold", v.cls, className)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", v.dot)} />
      {v.label}
    </span>
  );
}

export function EnvBadge({ env }: { env: string }) {
  const map: Record<string, string> = {
    production: "border-slate-900 bg-slate-900 text-white",
    preview: "border-amber-200 bg-amber-50 text-amber-800",
    development: "border-slate-200 bg-white text-slate-600",
    staging: "border-blue-200 bg-blue-50 text-blue-800",
  };
  const label = env.charAt(0).toUpperCase() + env.slice(1);
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", map[env] ?? map.development)}>
      {label}
    </span>
  );
}

export function NotConfiguredCard({ title, note, recommendation }: { title: string; note: string; recommendation?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-5" role="note">
      <div className="flex items-center gap-2">
        <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-bold text-slate-500">–</span>
        <p className="text-[13.5px] font-semibold text-slate-800">{title}</p>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">{note}</p>
      {recommendation && (
        <p className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11.5px] leading-relaxed text-slate-500">
          <span className="font-semibold text-slate-600">Recommended next step: </span>{recommendation}
        </p>
      )}
    </div>
  );
}

export function OpsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading operations data">
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
          <div className="h-3.5 w-40 rounded bg-slate-100" />
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full rounded bg-slate-50" />
            <div className="h-3 w-4/5 rounded bg-slate-50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function OpsError({ message, onRetry, forbidden }: { message: string; onRetry?: () => void; forbidden?: boolean }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/70 p-5" role="alert">
      <p className="text-[13.5px] font-semibold text-red-900">{forbidden ? "Administrator access required" : "Operations data unavailable"}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-red-700">{message}</p>
      {onRetry && !forbidden && (
        <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-800 transition-colors hover:bg-red-50">
          Retry
        </button>
      )}
    </div>
  );
}

/** Dense, honest key-fact row used across Operations screens. */
export function FactRow({ label, value, health, note }: { label: string; value: React.ReactNode; health?: OpsHealth | string; note?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b border-slate-100 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium text-slate-700">{label}</p>
        {note && <p className="mt-0.5 max-w-xl text-[11px] leading-snug text-slate-400">{note}</p>}
      </div>
      <div className="flex items-center gap-2 text-right">
        {typeof value === "string" || typeof value === "number" ? <span className="text-[12.5px] font-semibold tabular-nums text-slate-900">{value}</span> : value}
        {health && <OpsHealthBadge health={health} />}
      </div>
    </div>
  );
}

export function SourceLine({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 border-t border-slate-100 pt-3 text-[10.5px] leading-relaxed text-slate-400">{children}</p>;
}

/** Simple dense table shell (client-side over server-provided rows). */
export function OpsTable<T>({ rows, columns, keyOf, empty, maxH }: {
  rows: T[];
  columns: { header: string; cell: (row: T) => React.ReactNode; className?: string }[];
  keyOf: (row: T) => string;
  empty: React.ReactNode;
  maxH?: string;
}) {
  if (!rows.length) return <>{empty}</>;
  return (
    <div className={cn("qubit-scroll overflow-x-auto", maxH ?? "max-h-[26rem] overflow-y-auto")}>
      <table className="w-full border-collapse text-left text-[12.5px]">
        <thead>
          <tr className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
            {columns.map((c) => (
              <th key={c.header} className={cn("border-b border-slate-200 px-3 py-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500", c.className)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={keyOf(r)} className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/70">
              {columns.map((c) => (
                <td key={c.header} className={cn("px-3 py-2.5 align-middle text-slate-700", c.className)}>{c.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function timeAgo(ts: number | null | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} h ago`;
  return `${Math.round(diff / 86_400_000)} d ago`;
}

export function fmtIST(ts: number | null | undefined, withDate = true): string {
  if (!ts) return "—";
  const opts: Intl.DateTimeFormatOptions = withDate
    ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }
    : { hour: "2-digit", minute: "2-digit", hour12: false };
  return new Date(ts).toLocaleString("en-IN", opts) + " IST";
}
