"use client";

import * as React from "react";
import { ensureSession } from "@/lib/qubit/api";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  Clock,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "../primitives";
import { useRole } from "../role-context";
import { useQubitNav } from "../nav-context";
import { formatINR } from "@/lib/qubit/executive-data";
import type { ScreenId, ScreenParams } from "@/lib/qubit/screens";

// ============================================================
// Qubit One · Sales shared parts (Phase 6)
// Built on the Phase 2 design system and the Phase 5 loader
// pattern — no separate visual voice. Every screen consumes
// /api/sales; authorization lives on the server.
// ============================================================

// ---------- typed client for /api/sales ----------

export class SalesApiError extends Error {
  status: number;
  code?: string;
  matches?: { kind: string; id: string; label: string; reason: string }[];
  constructor(status: number, code: string | undefined, message: string, matches?: SalesApiError["matches"]) {
    super(message);
    this.name = "SalesApiError";
    this.status = status;
    this.code = code;
    this.matches = matches;
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let code: string | undefined;
    let message = `Request failed (${res.status}).`;
    let matches: SalesApiError["matches"];
    try {
      const body = await res.json();
      code = body?.code;
      message = body?.message ?? message;
      matches = body?.matches;
    } catch {
      /* non-JSON failure */
    }
    throw new SalesApiError(res.status, code, message, matches);
  }
  return (await res.json()) as T;
}

export async function salesGet<T>(section: string, role: string, params?: Record<string, string | undefined>): Promise<T> {
  await ensureSession(role);
  const qs = new URLSearchParams({ section });
  for (const [k, v] of Object.entries(params ?? {})) if (v) qs.set(k, v);
  const res = await fetch(`/api/sales?${qs.toString()}`, {
    headers: { "X-Qubit-Role": role, "Content-Type": "application/json" },
    cache: "no-store",
  });
  return parse<T>(res);
}

export async function salesPost<T = { ok: boolean; message?: string }>(
  type: string,
  input: Record<string, unknown>,
  role: string,
): Promise<T> {
  await ensureSession(role);
  const res = await fetch("/api/sales", {
    method: "POST",
    headers: { "X-Qubit-Role": role, "Content-Type": "application/json" },
    body: JSON.stringify({ type, input }),
  });
  return parse<T>(res);
}

// ---------- section loader (loading / error / permission states) ----------

export interface SalesSectionState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  forbidden: boolean;
  scope: "company" | "team" | "own" | null;
  reload: () => void;
}

export function useSalesSection<T>(section: string, params?: Record<string, string | undefined>): SalesSectionState<T> {
  const { role } = useRole();
  const paramKey = JSON.stringify(params ?? {});
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [forbidden, setForbidden] = React.useState(false);
  const [scope, setScope] = React.useState<SalesSectionState<T>["scope"]>(null);
  const [tick, setTick] = React.useState(0);

  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    salesGet<T>(section, role, JSON.parse(paramKey))
      .then((d) => {
        if (alive) {
          setData(d);
          setForbidden(false);
          const sc = (d as { scope?: SalesSectionState<T>["scope"] })?.scope;
          if (sc) setScope(sc);
        }
      })
      .catch((err) => {
        if (!alive) return;
        if (err instanceof SalesApiError && (err.status === 403 || err.status === 401)) {
          setForbidden(true);
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : "The sales service is unreachable right now.");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [section, role, paramKey, tick]);

  return { data, loading, error, forbidden, scope, reload };
}

// ---------- SalesGate — authorization is a first-class state ----------

export function SalesGate({ children, screenName }: { children: React.ReactNode; screenName: string }) {
  const { role, setRole } = useRole();
  if (role === "administrator" || role === "dept-head" || role === "sales-exec") return <>{children}</>;
  return (
    <div className="qubit-card mx-auto mt-6 max-w-xl p-6 text-center" role="alert">
      <span className="qubit-icon-tile qubit-icon-tile-accent mx-auto mb-4 h-12 w-12">
        <ShieldAlert />
      </span>
      <h2 className="text-base font-semibold text-slate-900">Sales access required</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-slate-500">
        {screenName} contains business-sensitive customer and revenue data, restricted to sales roles.
        You are previewing the <span className="font-medium text-slate-700">{role}</span> boundary — the server
        enforces this restriction and records the denial in the audit trail; it is not a hidden-UI pattern.
      </p>
      <Button size="sm" className="mt-4 h-9 gap-1.5" onClick={() => setRole("administrator")}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Return to Administrator
      </Button>
    </div>
  );
}

// ---------- scope note — honest about what the list covers ----------

const SCOPE_LABEL: Record<string, string> = {
  company: "Company-wide",
  team: "Your teams",
  own: "Your records",
};

export function ScopeNote({ scope, what }: { scope: string | null | undefined; what: string }) {
  if (!scope) return null;
  return (
    <p className="text-[11px] text-slate-400">
      {SCOPE_LABEL[scope] ?? scope} view — counts include only {what} you are authorized to see. Executive aggregates may differ because they cover the whole company.
    </p>
  );
}

// ---------- states ----------

export function SalesErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="qubit-card mb-3 flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50/60 px-4 py-3" role="alert">
      <p className="text-sm font-medium text-red-700">{message}</p>
      <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
      </Button>
    </div>
  );
}

export function SalesSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="qubit-card p-4">
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
          <div className="mt-3 h-8 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
      <span className="sr-only" role="status">Loading sales data…</span>
    </div>
  );
}

export function SalesAsOf({ asOfLabel, note }: { asOfLabel: string; note?: string }) {
  return (
    <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
      <Clock className="h-3 w-3" aria-hidden />
      <span>Sales data as of {asOfLabel}.</span>
      {note && <span>{note}</span>}
    </p>
  );
}

// ---------- formatting helpers ----------

export const fmtCr = (v: number) => formatINR(v);
export const fmtRupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export function relTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) {
    const ahead = -diff;
    if (ahead < 3_600_000) return `in ${Math.round(ahead / 60_000)} min`;
    if (ahead < 86_400_000) return `in ${Math.round(ahead / 3_600_000)} h`;
    return `in ${Math.round(ahead / 86_400_000)} d`;
  }
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} h ago`;
  return `${Math.round(diff / 86_400_000)} d ago`;
}

// ---------- priority / score ----------

export function PriorityBadge({ priority, size = "sm" }: { priority: "Hot" | "Warm" | "Cold"; size?: "sm" | "default" }) {
  return <StatusBadge status={priority} size={size} />;
}

export function ScoreBar({ score, className }: { score: number; className?: string }) {
  const tone = score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-slate-400";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Lead score ${score} of 100`}>
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${Math.max(4, score)}%` }} />
      </span>
      <span className="text-xs tabular-nums text-slate-600">{score}</span>
    </span>
  );
}

export function ProbabilityBar({ probability, className }: { probability: number; className?: string }) {
  const tone = probability >= 75 ? "bg-emerald-500" : probability >= 45 ? "bg-blue-500" : probability >= 25 ? "bg-amber-500" : "bg-slate-400";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Probability ${probability} percent`}>
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${Math.max(4, probability)}%` }} />
      </span>
      <span className="text-xs tabular-nums text-slate-600">{probability}%</span>
    </span>
  );
}

// ---------- stage flow (opportunity lifecycle, spec §79) ----------

const FLOW: { stage: string; short: string }[] = [
  { stage: "New", short: "New" },
  { stage: "Qualification", short: "Qual." },
  { stage: "Discovery", short: "Disc." },
  { stage: "Proposal", short: "Prop." },
  { stage: "Negotiation", short: "Neg." },
  { stage: "Contracting", short: "Contr." },
  { stage: "Won", short: "Won" },
];

export function StageFlow({ stage, className }: { stage: string; className?: string }) {
  const idx = FLOW.findIndex((f) => f.stage === stage);
  const lost = stage === "Lost";
  return (
    <ol className={cn("flex flex-wrap items-center gap-1", className)} aria-label={`Pipeline stage: ${stage}`}>
      {FLOW.map((f, i) => {
        const done = !lost && idx >= i && i < idx;
        const current = !lost && idx === i;
        return (
          <li key={f.stage} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="h-px w-2.5 bg-slate-200" />}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
                current
                  ? stage === "Won"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                  : done
                    ? "border-slate-200 bg-slate-50 text-slate-500"
                    : "border-slate-100 bg-white text-slate-300",
              )}
            >
              {done && <Check className="h-2.5 w-2.5" aria-hidden />}
              {f.short}
            </span>
          </li>
        );
      })}
      {lost && (
        <li className="flex items-center gap-1">
          <span aria-hidden className="h-px w-2.5 bg-slate-200" />
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-medium text-red-700">Lost</span>
        </li>
      )}
    </ol>
  );
}

// ---------- consent chips (communication permissions, spec §77) ----------

export function ConsentChips({ consent }: { consent: { whatsapp: boolean; email: boolean; call: boolean } }) {
  const items = [
    { ok: consent.whatsapp, label: "WhatsApp", icon: <MessageCircle className="h-3 w-3" aria-hidden /> },
    { ok: consent.email, label: "Email", icon: <Mail className="h-3 w-3" aria-hidden /> },
    { ok: consent.call, label: "Call", icon: <Phone className="h-3 w-3" aria-hidden /> },
  ];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" aria-label="Communication consent">
      {items.map((it) => (
        <span
          key={it.label}
          title={it.ok ? `${it.label} — consent granted` : `${it.label} — no consent on file`}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            it.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-400 line-through",
          )}
        >
          {it.icon}
          {it.label}
          <span className="sr-only">{it.ok ? " — consent granted" : " — no consent"}</span>
        </span>
      ))}
    </span>
  );
}

// ---------- unified activity timeline (spec §91) ----------

const ACTIVITY_ICON: Record<string, React.ReactNode> = {
  Call: <Phone className="h-3.5 w-3.5" aria-hidden />,
  Email: <Mail className="h-3.5 w-3.5" aria-hidden />,
  WhatsApp: <MessageCircle className="h-3.5 w-3.5" aria-hidden />,
};

const ACTIVITY_TONE: Record<string, string> = {
  Call: "bg-blue-50 text-blue-700",
  Email: "bg-violet-50 text-violet-700",
  WhatsApp: "bg-emerald-50 text-emerald-700",
  Meeting: "bg-cyan-50 text-cyan-700",
  Visit: "bg-amber-50 text-amber-700",
  Note: "bg-slate-100 text-slate-600",
  Task: "bg-slate-100 text-slate-600",
  "Follow-up": "bg-blue-50 text-blue-700",
  Quotation: "bg-violet-50 text-violet-700",
  Order: "bg-emerald-50 text-emerald-700",
  "Stage change": "bg-blue-50 text-blue-700",
  "Status change": "bg-slate-100 text-slate-600",
  "Lead assigned": "bg-blue-50 text-blue-700",
  Conversion: "bg-emerald-50 text-emerald-700",
};

export interface TimelineEntry {
  id: string;
  at: number;
  type: string;
  actorName?: string;
  summary: string;
  outcome?: string;
  source?: string;
  entityId?: string;
  entityKind?: string;
  entityLabel?: string;
}

export function ActivityTimeline({
  entries,
  className,
  max = 30,
  emptyMessage = "No activity recorded yet — calls, emails, notes and status changes will appear here.",
}: {
  entries: TimelineEntry[];
  className?: string;
  max?: number;
  emptyMessage?: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }
  return (
    <ol className={cn("relative space-y-0", className)} aria-label="Activity timeline">
      {entries.slice(0, max).map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < Math.min(entries.length, max) - 1 && (
            <span aria-hidden className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-100" />
          )}
          <span
            className={cn(
              "qubit-icon-tile z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full [&_svg]:h-3.5 [&_svg]:w-3.5",
              ACTIVITY_TONE[e.type] ?? "bg-slate-100 text-slate-600",
            )}
          >
            {ACTIVITY_ICON[e.type] ?? e.type.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[13px] font-medium text-slate-800">{e.type}</span>
              <span className="text-[11px] text-slate-400">{relTime(e.at)}</span>
              {e.source && (
                <span className="rounded border border-slate-200 bg-slate-50 px-1 py-px text-[10px] text-slate-500">{e.source}</span>
              )}
            </div>
            <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{e.summary}</p>
            {e.outcome && (
              <p className="mt-1 text-xs text-slate-500">
                <span className="font-medium text-slate-600">Outcome:</span> {e.outcome}
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-slate-400">
              {e.actorName ?? "System"} · {fmtDateTime(e.at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---------- contextual entity links (spec: cross-screen requirements) ----------

export type SalesEntityScreen =
  | "lead-detail"
  | "contact-detail"
  | "account-detail"
  | "opportunity-detail"
  | "quotation-detail"
  | "order-detail"
  | "visit-detail"
  | "lead-inbox"
  | "sales-pipeline"
  | "whatsapp-conversation";

const NAV_PARAM: Record<SalesEntityScreen, keyof ScreenParams> = {
  "lead-detail": "leadId",
  "contact-detail": "contactId",
  "account-detail": "accountId",
  "opportunity-detail": "opportunityId",
  "quotation-detail": "quotationId",
  "order-detail": "orderId",
  "visit-detail": "visitId",
  "lead-inbox": "filter",
  "sales-pipeline": "filter",
  "whatsapp-conversation": "waId",
};

export function EntityLink({
  screen,
  id,
  label,
  kind,
}: {
  screen: SalesEntityScreen;
  id?: string;
  label: React.ReactNode;
  kind?: string;
}) {
  const nav = useQubitNav();
  const param = NAV_PARAM[screen];
  return (
    <button
      type="button"
      onClick={() => nav.navigate(screen as ScreenId, { [param]: id } as ScreenParams)}
      className="group/link inline-flex max-w-full items-center gap-1 truncate text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700"
      aria-label={typeof label === "string" ? `Open ${kind ?? screen} ${label}` : undefined}
    >
      <span className="truncate">{label}</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" aria-hidden />
    </button>
  );
}

// ---------- verified / audited hint ----------

export function AuditedHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
      <BadgeCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
