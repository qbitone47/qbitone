"use client";

// ============================================================
// Qubit One — Mobile experience system (Phase 18, screens 285–300)
// ============================================================
// A genuine mobile-first presentation layer over the ONE Qubit One
// platform: phone-width canvas inside the enterprise shell, bottom
// navigation, ≥44px touch targets, sheets instead of dialogs, and
// honest connection/degraded states (spec §4, §32, §39).
// All data comes from /api/mobile (server-enforced); this file only
// carries intent and renders what the server returns.
// ============================================================

import * as React from "react";
import { ensureSession } from "@/lib/qubit/api";
import { ChevronLeft, ChevronRight, RefreshCcw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ScreenId } from "@/lib/qubit/screens";
import { VISIT_LIFECYCLE } from "@/lib/qubit/mobile-data";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { Avatar } from "../primitives";

/** Field-visit lifecycle stages (spec §13), re-exported for screens. */
export const VISIT_STAGES = VISIT_LIFECYCLE;

// ---------- API helpers ----------

export class MobileApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "MobileApiError";
    this.status = status;
    this.code = code;
  }
}

function mobileHeaders(role: string): HeadersInit {
  return { "Content-Type": "application/json", "X-Qubit-Role": role };
}

export async function mobileGet<T>(
  section: string,
  role: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  await ensureSession(role ?? "administrator");
  const qs = params
    ? Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const res = await fetch(`/api/mobile?section=${encodeURIComponent(section)}${qs ? `&${qs}` : ""}`, {
    headers: mobileHeaders(role),
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
    throw new MobileApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export async function mobilePost<T = { ok: boolean; message?: string }>(
  type: string,
  input?: Record<string, unknown>,
  role?: string,
): Promise<T> {
  await ensureSession(role ?? "administrator");
  const res = await fetch("/api/mobile", {
    method: "POST",
    headers: mobileHeaders(role ?? "administrator"),
    body: JSON.stringify({ type, input: input ?? {} }),
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
    throw new MobileApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

// ---------- section loader ----------

export interface MobileSectionState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  forbidden: boolean;
  reload: () => void;
}

export function useMobileSection<T>(section: string, params?: Record<string, string | undefined>): MobileSectionState<T> {
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
    mobileGet<T>(section, role, params)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof MobileApiError) {
          setError(e.message);
          setForbidden(e.status === 403);
        } else {
          setError("Connection required — the mobile workspace could not reach Qubit One.");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [section, role, tick, JSON.stringify(params ?? {})]);

  return { data, loading, error, forbidden, reload };
}

// ---------- device frame + bottom navigation ----------

const TABS: { id: string; label: string; screen: ScreenId }[] = [
  { id: "home", label: "Home", screen: "mobile-home" },
  { id: "work", label: "My Work", screen: "mobile-tasks" },
  { id: "business", label: "Business", screen: "mobile-sales-home" },
  { id: "comms", label: "Comms", screen: "mobile-mail" },
  { id: "ai", label: "AI", screen: "mobile-ai" },
  { id: "profile", label: "Profile", screen: "mobile-profile" },
];

function TabIcon({ id, active }: { id: string; active: boolean }) {
  // Minimal geometric glyphs keep the nav lightweight and match the Qubit mark.
  const common = "h-[18px] w-[18px]";
  switch (id) {
    case "home":
      return <span aria-hidden className={cn(common, "rounded-[4px] border-[1.5px]", active ? "border-blue-600 bg-blue-600/10" : "border-slate-400")} />;
    case "work":
      return <span aria-hidden className={cn(common, "rounded-full border-[1.5px]", active ? "border-blue-600 bg-blue-600/10" : "border-slate-400")} />;
    case "business":
      return (
        <span aria-hidden className={cn(common, "grid grid-cols-2 gap-[2px]")}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn("rounded-[1px]", active ? "bg-blue-600" : "bg-slate-400")} />
          ))}
        </span>
      );
    case "comms":
      return <span aria-hidden className={cn(common, "rounded-md rounded-bl-sm border-[1.5px]", active ? "border-blue-600 bg-blue-600/10" : "border-slate-400")} />;
    case "ai":
      return <span aria-hidden className={cn("h-[18px] w-[18px] rounded-[50%_50%_50%_4px] border-[1.5px]", active ? "border-blue-600 bg-blue-600/10" : "border-slate-400")} />;
    default:
      return (
        <span aria-hidden className={cn(common, "rounded-full border-[1.5px] p-[3px]")}>
          <span className={cn("block h-full w-full rounded-full", active ? "bg-blue-600" : "bg-slate-400")} />
        </span>
      );
  }
}

/**
 * The mobile canvas: full-bleed on small viewports, a centered
 * phone-width surface on desktop so the mobile experience is
 * demonstrable inside the ONE shell (shared identity/permissions).
 */
export function MobileFrame({
  title,
  children,
  right,
  activeTab,
  onBack,
  offlineNote,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  activeTab?: string;
  onBack?: () => void;
  offlineNote?: string;
}) {
  const { navigate, canBack, back } = useQubitNav();
  const effectiveBack = onBack ?? (canBack ? back : undefined);
  return (
    <div className="mx-auto w-full max-w-[430px] px-0 sm:px-4">
      <div className="relative min-h-[calc(100vh-4rem)] border-x-0 bg-slate-50 sm:border-x sm:border-slate-200/80 sm:shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        {/* Mobile status/header bar — sticks to the top of the app's
            inner scroll container (main#main-scroll), not the window. */}
        <div className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-200/80 bg-white/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          {effectiveBack && (
            <button
              type="button"
              aria-label="Back"
              onClick={effectiveBack}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
          )}
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-900">{title}</p>
          {right}
        </div>

        {/* Offline/degraded note rides INSIDE the sticky unit so it is
            always fully visible, whatever the inner scroll position. */}
        <div className={cn("sticky top-14 z-20", offlineNote ? "block" : "hidden")}>
          {offlineNote && (
            <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2.5" role="status">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
              <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-amber-900">{offlineNote}</p>
            </div>
          )}
        </div>

        <div className="pb-24">{children}</div>

        {/* Bottom navigation — contextual model (spec §30) */}
        <nav
          aria-label="Mobile sections"
          className="sticky bottom-0 z-20 -mx-0 flex h-16 items-stretch justify-around border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-white/90 sm:rounded-b-xl"
        >
          {TABS.map((t) => {
            const active = t.id === activeTab;
            return (
              <button
                key={t.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => navigate(t.screen)}
                className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-1"
              >
                <TabIcon id={t.id} active={active} />
                <span className={cn("text-[10px] font-medium leading-none", active ? "text-blue-700" : "text-slate-500")}>{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// ---------- loading / error / empty ----------

export function MobileSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ))}
    </div>
  );
}

export function MobileErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="m-3 rounded-xl border border-amber-200 bg-amber-50 p-3" role="alert">
      <p className="text-[13px] font-medium text-amber-900">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2 min-h-[44px] border-amber-300 bg-white text-amber-900 hover:bg-amber-100" onClick={onRetry}>
          <RefreshCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Retry
        </Button>
      )}
    </div>
  );
}

export function MobileEmpty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="m-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center">
      <p className="text-[13px] font-medium text-slate-700">{title}</p>
      {detail && <p className="mt-1 text-[12px] leading-snug text-slate-500">{detail}</p>}
    </div>
  );
}

// ---------- content atoms ----------

export function MobileSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="px-3 pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{title}</h2>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function MobileCard({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "block w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        onClick && "min-h-[44px] transition-colors hover:border-slate-300 hover:bg-slate-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600",
        className,
      )}
    >
      {children}
    </Comp>
  );
}

export function MobileRow({
  title,
  detail,
  meta,
  leading,
  trailing,
  onClick,
}: {
  title: React.ReactNode;
  detail?: React.ReactNode;
  meta?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left",
        onClick && "min-h-[52px] transition-colors hover:border-slate-300 hover:bg-slate-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600",
      )}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-slate-900">{title}</span>
        {detail && <span className="mt-0.5 block line-clamp-2 text-[12px] leading-snug text-slate-500">{detail}</span>}
        {meta && <span className="mt-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">{meta}</span>}
      </span>
      {trailing ?? (onClick ? <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden /> : null)}
    </Comp>
  );
}

export function MobileBadge({ tone = "slate", children }: { tone?: "slate" | "blue" | "green" | "amber" | "red"; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    slate: "border-slate-200 bg-slate-100 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold", tones[tone])}>{children}</span>;
}

export function QuickActionGrid({ actions }: { actions: { id: string; label: string; run: () => void }[] }) {
  return (
    <div className="grid grid-cols-4 gap-2" role="group" aria-label="Quick actions">
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={a.run}
          className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-1 py-2 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[13px] font-bold text-blue-700" aria-hidden>
            {a.label.slice(0, 1)}
          </span>
          <span className="text-[10.5px] font-medium leading-tight text-slate-700">{a.label}</span>
        </button>
      ))}
    </div>
  );
}

export function MobileStat({ label, value, tone = "slate", onClick }: { label: string; value: React.ReactNode; tone?: "slate" | "red" | "blue" | "green"; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  const tones: Record<string, string> = {
    slate: "text-slate-900",
    red: "text-red-700",
    blue: "text-blue-700",
    green: "text-emerald-700",
  };
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5",
        onClick && "min-h-[56px] transition-colors hover:border-slate-300 hover:bg-slate-50/60",
      )}
    >
      <span className={cn("block text-xl font-semibold tabular-nums leading-tight", tones[tone])}>{value}</span>
      <span className="mt-0.5 block text-[10.5px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
    </Comp>
  );
}

export function FilterChips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 pb-1 pt-3 qubit-scroll" role="tablist" aria-label="Filters">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="tab"
          aria-selected={o === value}
          onClick={() => onChange(o)}
          className={cn(
            "min-h-[36px] shrink-0 rounded-full border px-3 text-[12px] font-medium transition-colors",
            o === value ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function MobileProfileChip({ name, sub }: { name: string; sub?: string }) {
  return (
    <span className="flex items-center gap-2">
      <Avatar name={name} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-medium leading-tight text-slate-800">{name}</span>
        {sub && <span className="block truncate text-[11px] leading-tight text-slate-400">{sub}</span>}
      </span>
    </span>
  );
}

export function SourceNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t border-slate-200/70 px-3 pb-2 pt-3 text-[11px] leading-relaxed text-slate-400">{children}</p>
  );
}

export function LifecycleBar({ stages, current }: { stages: readonly string[]; current: string }) {
  const idx = stages.indexOf(current);
  return (
    <ol className="flex items-center gap-1 px-3 pt-3" aria-label={`Visit stage: ${current}`}>
      {stages.map((s, i) => (
        <li key={s} className="flex-1">
          <div
            className={cn(
              "h-1.5 rounded-full",
              i < idx ? "bg-emerald-500" : i === idx ? "bg-blue-600" : "bg-slate-200",
            )}
            aria-hidden
          />
          <span className={cn("mt-1 block truncate text-center text-[9px] font-medium", i === idx ? "text-blue-700" : "text-slate-400")}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function MobileChecklistItem({
  label,
  critical,
  done,
  onToggle,
}: {
  label: string;
  critical: boolean;
  done: boolean;
  onToggle: (done: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${label}${critical ? " (critical)" : ""}`}
        onClick={() => onToggle(!done)}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-[1.5px] text-[15px] font-bold transition-colors",
          done ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-transparent hover:border-slate-400",
        )}
      >
        ✓
      </button>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[13px] font-medium", done ? "text-slate-400 line-through" : "text-slate-900")}>{label}</span>
        {critical && <span className="mt-0.5 block text-[10.5px] font-semibold uppercase tracking-wide text-amber-700">Critical — blocks completion</span>}
      </span>
    </div>
  );
}
