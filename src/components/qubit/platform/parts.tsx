"use client";

// ============================================================
// Qubit One — Platform hardening UI system (Phase 18, 301–308)
// ============================================================
// Shared presentation for the enterprise hardening screens: honest
// status vocabulary (icon + text, never color alone), live probes,
// the real browser-vitals collector, and the high-risk restore
// confirmation contract. Data always comes from /api/platform.
// ============================================================

import * as React from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2, CircleSlash, MinusCircle, RefreshCcw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRole } from "../role-context";

// ---------- API helpers ----------

export class PlatformApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "PlatformApiError";
    this.status = status;
    this.code = code;
  }
}

export async function platformGet<T>(section: string, role: string): Promise<T> {
  const res = await fetch(`/api/platform?section=${encodeURIComponent(section)}`, {
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
    } catch {
      /* keep generic */
    }
    throw new PlatformApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export async function platformPost<T = { ok: boolean; message?: string }>(
  type: string,
  input?: Record<string, unknown>,
  role?: string,
  confirm?: boolean,
): Promise<T> {
  const res = await fetch("/api/platform", {
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
    } catch {
      /* keep generic */
    }
    throw new PlatformApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

// ---------- section loader ----------

export interface PlatformSectionState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  forbidden: boolean;
  reload: () => void;
}

export function usePlatformSection<T>(section: string): PlatformSectionState<T> {
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
    platformGet<T>(section, role)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof PlatformApiError) {
          setError(e.message);
          setForbidden(e.status === 403);
        } else {
          setError("The platform endpoint could not be reached.");
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

// ---------- honest status vocabulary (icon + text, not color-only) ----------

export type Health = "healthy" | "degraded" | "unavailable" | "maintenance";

export function StatusDot({ health, className }: { health: Health; className?: string }) {
  const map: Record<Health, { cls: string; icon: React.ElementType; label: string }> = {
    healthy: { cls: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: CheckCircle2, label: "Healthy" },
    degraded: { cls: "text-amber-700 bg-amber-50 border-amber-200", icon: AlertTriangle, label: "Degraded" },
    unavailable: { cls: "text-red-700 bg-red-50 border-red-200", icon: CircleSlash, label: "Unavailable" },
    maintenance: { cls: "text-slate-600 bg-slate-100 border-slate-200", icon: Wrench, label: "Maintenance" },
  };
  const m = map[health];
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold", m.cls, className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {m.label}
    </span>
  );
}

export function StatusWord({ status }: { status: string }) {
  const map: Record<string, { health: Health }> = {
    Operational: { health: "healthy" },
    Degraded: { health: "degraded" },
    "Partial Outage": { health: "unavailable" },
    "Major Outage": { health: "unavailable" },
    Maintenance: { health: "maintenance" },
    healthy: { health: "healthy" },
    Pass: { health: "healthy" },
    PASS: { health: "healthy" },
  };
  return <StatusDot health={map[status]?.health ?? "degraded"} />;
}

// ---------- content atoms ----------

export function PlatformCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)}>{children}</div>;
}

export function ProbeRow({ label, value, health, note, latency }: { label: string; value?: React.ReactNode; health?: Health; note?: string; latency?: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-slate-900">{label}</p>
        {note && <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">{note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {latency && <span className="text-[12px] font-medium tabular-nums text-slate-500">{latency}</span>}
        {value !== undefined && <span className="text-[12.5px] font-semibold tabular-nums text-slate-800">{value}</span>}
        {health && <StatusDot health={health} />}
      </div>
    </div>
  );
}

export function MetricTile({ label, value, unit, tone = "slate", note }: { label: string; value: React.ReactNode; unit?: string; tone?: "slate" | "green" | "amber" | "red"; note?: string }) {
  const tones: Record<string, string> = { slate: "text-slate-900", green: "text-emerald-700", amber: "text-amber-700", red: "text-red-700" };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10.5px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums leading-tight", tones[tone])}>
        {value}
        {unit && <span className="ml-0.5 text-[12px] font-normal text-slate-400">{unit}</span>}
      </p>
      {note && <p className="mt-0.5 text-[10.5px] leading-snug text-slate-400">{note}</p>}
    </div>
  );
}

export function PlatformNote({ tone = "info", title, children }: { tone?: "info" | "warn"; title?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border p-3.5", tone === "warn" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50/70")} role="note">
      {title && <p className={cn("text-[12.5px] font-semibold", tone === "warn" ? "text-amber-900" : "text-slate-800")}>{title}</p>}
      <p className={cn("mt-0.5 text-[12px] leading-relaxed", tone === "warn" ? "text-amber-800" : "text-slate-600")}>{children}</p>
    </div>
  );
}

export function SourceLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 border-t border-slate-200/70 pt-3 text-[11px] leading-relaxed text-slate-400">
      <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function PlatformSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading platform data">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ))}
    </div>
  );
}

export function PlatformError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="alert">
      <p className="text-[13px] font-medium text-amber-900">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2.5 border-amber-300 bg-white text-amber-900 hover:bg-amber-100" onClick={onRetry}>
          <RefreshCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Retry
        </Button>
      )}
    </div>
  );
}

// ---------- real browser vitals collector (PerformanceObserver) ----------

interface VitalsBuffer {
  lcp?: number;
  cls?: number;
  ttfb?: number;
  fcp?: number;
}

/**
 * Collects REAL Core Web Vitals from the current page via the
 * PerformanceObserver API and POSTs them to vitals.report. Nothing
 * is simulated: if the browser does not support an entry type, that
 * metric simply never reports.
 */
export function useVitalsCollector(screen: string, enabled = true) {
  const { role } = useRole();
  React.useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("PerformanceObserver" in window)) return;
    const buf: VitalsBuffer = {};
    let sent = false;
    const push = () => {
      if (sent) return;
      sent = true;
      platformPost("vitals.report", { screen, lcpMs: buf.lcp, cls: buf.cls, ttfbMs: buf.ttfb, fcpMs: buf.fcp }, role).catch(() => undefined);
    };
    const observers: PerformanceObserver[] = [];
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          const entry = e as PerformanceEntry & { value?: number; name?: string; responseStart?: number; startTime?: number; domContentLoadedEventStart?: number };
          if (entry.name === "largest-contentful-paint" && typeof entry.value === "number") buf.lcp = Math.round(entry.value);
          if (entry.name === "first-contentful-paint" && typeof entry.startTime === "number") buf.fcp = Math.round(entry.startTime);
          if (entry.name === "layout-shift" && typeof entry.value === "number") buf.cls = (buf.cls ?? 0) + entry.value;
        }
      });
      po.observe({ type: "largest-contentful-paint", buffered: true } as PerformanceObserverInit);
      po.observe({ type: "layout-shift", buffered: true } as PerformanceObserverInit);
      po.observe({ type: "paint", buffered: true } as PerformanceObserverInit);
      observers.push(po);
      // TTFB from navigation timing
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav) buf.ttfb = Math.round(nav.responseStart);
    } catch {
      /* observer types unsupported — metrics stay absent, honestly */
    }
    const t = setTimeout(push, 3500);
    return () => {
      clearTimeout(t);
      observers.forEach((o) => o.disconnect());
    };
  }, [screen, enabled]);
}

// ---------- high-risk confirmation (restore) ----------

export function HighRiskDialog({
  open,
  title,
  description,
  confirmPhrase,
  onConfirm,
  onCancel,
  extra,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmPhrase: string;
  onConfirm: (input: { phrase: string; reason: string }) => void;
  onCancel: () => void;
  extra?: React.ReactNode;
}) {
  const [phrase, setPhrase] = React.useState("");
  const [reason, setReason] = React.useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden />
          <p className="text-[15px] font-semibold text-slate-900">{title}</p>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">{description}</p>
        {extra}
        <label htmlFor="hr-reason" className="mt-3 block text-[12px] font-medium text-slate-600">Reason (recorded, ≥10 characters)</label>
        <textarea
          id="hr-reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <label htmlFor="hr-phrase" className="mt-3 block text-[12px] font-medium text-slate-600">
          Type <span className="font-mono font-bold text-red-700">{confirmPhrase}</span> to confirm
        </label>
        <input
          id="hr-phrase"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-red-500"
          autoComplete="off"
        />
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="min-h-[44px] flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="min-h-[44px] flex-1 bg-red-600 hover:bg-red-700"
            disabled={phrase !== confirmPhrase || reason.trim().length < 10}
            onClick={() => onConfirm({ phrase, reason })}
          >
            Confirm high-risk action
          </Button>
        </div>
        <p className="mt-2 text-center text-[10.5px] text-slate-400">The server re-validates role, phrase and reason — the dialog alone is never trusted.</p>
      </div>
    </div>
  );
}

export function MinusCircleIcon() {
  return <MinusCircle className="h-3.5 w-3.5" aria-hidden />;
}
