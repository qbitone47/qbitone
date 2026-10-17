"use client";

import * as React from "react";
import { ArrowRight, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ============================================================
// StatusBadge — dot + label (never color-only), enterprise tones
// ============================================================
type Tone = "emerald" | "amber" | "red" | "blue" | "violet" | "slate";

const TONES: Record<Tone, { dot: string; text: string; bg: string; border: string }> = {
  emerald: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  amber: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  red: { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  blue: { dot: "bg-blue-600", text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  violet: { dot: "bg-violet-500", text: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  slate: { dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" },
};

const STATUS_TONE: Record<string, Tone> = {
  Active: "emerald", Connected: "emerald", Completed: "emerald", Enabled: "emerald", Public: "emerald", Operational: "emerald",
  Resolved: "emerald", Approved: "emerald", Trusted: "emerald",
  Draft: "amber", Pending: "amber", Warning: "amber", "Under Review": "amber", "Notice Period": "amber", Confidential: "amber", "On Hold": "amber",
  "Pending Approval": "amber", Acknowledged: "amber", "Require Verification": "amber",
  Disconnected: "red", Conflict: "red", Restricted: "red", "Exit Initiated": "red", High: "red",
  Revoked: "red", Suspicious: "red", Critical: "red", Rejected: "red", Denied: "red",
  "In Progress": "blue", Probation: "blue", Internal: "blue", Medium: "amber",
  Submitted: "blue", Scheduled: "blue", Info: "blue", New: "blue",
  "Configuration Required": "violet", "On Leave": "violet",
  Inactive: "slate", Archived: "slate", Paused: "slate", Disabled: "slate", Low: "slate",
  Expired: "slate", "Action needed": "amber", Degraded: "amber",
  // Phase 5 — executive vocabulary
  "On Track": "emerald", Watch: "amber", "At Risk": "red", Generating: "blue", Failed: "red",
  Live: "emerald", Delayed: "amber", Stale: "amber", Unavailable: "red", Dismissed: "slate",
  Assigned: "blue", Ready: "emerald", Forecast: "violet", Estimated: "violet", Finalized: "emerald",
  Attention: "amber", Investigating: "blue", Reopened: "blue",
};

export function StatusBadge({
  status,
  className,
  size = "default",
}: {
  status: string;
  className?: string;
  size?: "default" | "sm";
}) {
  const tone = STATUS_TONE[status] ?? "slate";
  const t = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
        t.bg, t.text, t.border,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", t.dot)} aria-hidden />
      {status}
    </span>
  );
}

// ============================================================
// Avatar — initials, deterministic enterprise palette
// ============================================================
const AVATAR_STYLES = [
  "bg-blue-700 text-white",
  "bg-teal-600 text-white",
  "bg-rose-600 text-white",
  "bg-amber-500 text-white",
  "bg-violet-600 text-white",
  "bg-slate-600 text-white",
  "bg-emerald-600 text-white",
  "bg-cyan-700 text-white",
];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({
  name,
  size = "md",
  className,
  ring,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  ring?: boolean;
}) {
  const idx = React.useMemo(() => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return h % AVATAR_STYLES.length;
  }, [name]);
  const sizeCls = {
    xs: "h-5 w-5 text-[9px]",
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-11 w-11 text-sm",
    xl: "h-14 w-14 text-base",
  }[size];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold select-none shrink-0",
        sizeCls, AVATAR_STYLES[idx],
        ring && "ring-2 ring-white",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

// ============================================================
// SectionCard — white surface with quiet header
// ============================================================
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  noPadding,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
}) {
  return (
    <section className={cn("qubit-card overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 md:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-tight text-slate-900 truncate">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn(!noPadding && "p-4 md:p-5", contentClassName)}>{children}</div>
    </section>
  );
}

// ============================================================
// KV — key/value detail row
// ============================================================
export function KV({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5 py-2 sm:flex-row sm:items-start sm:gap-4", className)}>
      <dt className="w-44 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

// ============================================================
// StatTile — compact metric tile for detail panels
// ============================================================
export function StatTile({
  icon,
  value,
  label,
  className,
  onClick,
}: {
  icon?: React.ReactNode;
  value: React.ReactNode;
  label: string;
  className?: string;
  onClick?: () => void;
}) {
  const Comp: React.ElementType = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
        onClick && "transition-all duration-150 hover:border-blue-200 hover:bg-blue-50/40",
        className,
      )}
    >
      {icon && <span className="qubit-icon-tile qubit-icon-tile-accent h-9 w-9 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
      <span className="min-w-0">
        <span className="block text-[17px] font-semibold leading-tight tracking-tight text-slate-900">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </Comp>
  );
}

// ============================================================
// EmptyState
// ============================================================
export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon && (
        <span className="qubit-icon-tile qubit-icon-tile-accent mb-3.5 h-12 w-12">{icon}</span>
      )}
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {message && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ============================================================
// SearchInput
// ============================================================
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
      <Input
        type="text"
        role="searchbox"
        aria-label={ariaLabel ?? placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-lg border-slate-200 bg-white pl-9 pr-8 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================================
// FilterBar — toolbar row above tables/lists
// ============================================================
export function FilterBar({
  left,
  right,
  children,
  className,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {left && <div className="flex flex-wrap items-center gap-2">{left}</div>}
      {children}
      {right && <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

// ============================================================
// TreeRow — indent-guide tree primitive (restrained connectors)
// ============================================================
export function TreeRow({
  depth,
  expandable,
  expanded,
  onToggle,
  selected,
  onClick,
  children,
  trailing,
  className,
  dimmed,
  locked,
}: {
  depth: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  dimmed?: boolean;
  locked?: boolean;
}) {
  return (
    <div
      role="treeitem"
      aria-expanded={expandable ? expanded : undefined}
      aria-selected={selected || undefined}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onClick) {
          e.preventDefault();
          onClick();
        }
        if (e.key === "ArrowRight" && expandable && !expanded) onToggle?.();
        if (e.key === "ArrowLeft" && expandable && expanded) onToggle?.();
      }}
      className={cn(
        "group relative flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-sm outline-none transition-colors duration-150",
        onClick && "cursor-pointer hover:bg-slate-100/70",
        selected ? "bg-blue-50 font-medium text-blue-800" : "text-slate-700",
        dimmed && "opacity-40",
        className,
      )}
      style={{ paddingLeft: depth * 16 + 6 }}
    >
      {/* indent guides */}
      {Array.from({ length: depth }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute top-0 bottom-0 border-l border-slate-200"
          style={{ left: i * 16 + 14 }}
        />
      ))}
      {expandable ? (
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
        </button>
      ) : (
        <span className="h-5 w-5 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {locked && <LockHint />}
      {trailing && <span className="ml-auto flex items-center gap-1.5 shrink-0">{trailing}</span>}
    </div>
  );
}

// ============================================================
// IconTile — soft colored tile behind an icon (unified pattern)
// ============================================================
export function IconTile({
  icon,
  tone = "blue",
  size = "md",
  className,
}: {
  icon: React.ReactNode;
  tone?: "blue" | "emerald" | "violet" | "rose" | "amber" | "teal" | "cyan" | "slate";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    teal: "bg-teal-50 text-teal-700",
    cyan: "bg-cyan-50 text-cyan-700",
    slate: "bg-slate-100 text-slate-600",
  };
  const sizes = {
    sm: "h-8 w-8 rounded-lg [&_svg]:h-4 [&_svg]:w-4",
    md: "h-10 w-10 rounded-xl",
    lg: "h-12 w-12 rounded-xl",
  } as const;
  return (
    <span aria-hidden className={cn("qubit-icon-tile", tones[tone], sizes[size], className)}>
      {icon}
    </span>
  );
}

// ============================================================
// ArrowLink — quiet blue "View X →" affordance (unified pattern)
// ============================================================
export function ArrowLink({
  children,
  onClick,
  className,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "group/link inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-600 transition-colors duration-150 hover:text-blue-700",
        className,
      )}
    >
      {children}
      <ArrowRight
        className="h-3.5 w-3.5 transition-transform duration-150 group-hover/link:translate-x-0.5"
        aria-hidden
      />
    </button>
  );
}

function LockHint() {
  return (
    <span className="rounded border border-slate-200 bg-slate-50 px-1 py-px text-[10px] font-medium text-slate-500" title="Hidden for your role">
      Hidden
    </span>
  );
}

// ============================================================
// Read-only notice (permission-aware UX)
// ============================================================
export function ReadOnlyBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="note">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 fill-amber-500" aria-hidden>
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a.9.9 0 110 1.8A.9.9 0 018 4zm0 3.2c.4 0 .7.3.7.7v3a.7.7 0 11-1.4 0v-3c0-.4.3-.7.7-.7z" />
      </svg>
      {message}
    </div>
  );
}
