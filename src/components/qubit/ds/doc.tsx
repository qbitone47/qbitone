"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { screensByModule, type ScreenId } from "@/lib/qubit/screens";
import { useQubitNav } from "../nav-context";

// ============================================================
// Qubit One design-system documentation scaffold (Phase 2).
// One shared "doc voice" so all 18 screens read as ONE system:
// DSSection → demo stage → captioned examples → spec → do/don't.
// ============================================================

/** Section — titled body of the reference with an optional purpose line. */
export function DSSection({
  title,
  purpose,
  actions,
  children,
  className,
  contentClassName,
  noPadding,
}: {
  title: string;
  purpose?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
}) {
  return (
    <section className={cn("qubit-card overflow-hidden", className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 md:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>
          {purpose && <p className="mt-0.5 text-xs text-muted-foreground">{purpose}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className={cn(!noPadding && "p-4 md:p-5", contentClassName)}>{children}</div>
    </section>
  );
}

/** Stage — tinted demo surface so white components are visible against it. */
export function DSStage({
  children,
  className,
  variant = "tinted",
  align = "start",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "tinted" | "plain";
  align?: "start" | "center";
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start rounded-xl border p-4 md:p-6",
        align === "center" && "justify-center",
        variant === "tinted"
          ? "border-slate-200/70 bg-slate-50/80"
          : "border-slate-100 bg-white",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Caption — the small specimen label under a demoed example. */
export function DSCaption({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mt-2 text-[11px] font-medium tracking-wide text-slate-400", className)}>{children}</p>
  );
}

/** Example — one labelled specimen (demo + caption) in a column. */
export function DSExample({
  label,
  children,
  className,
  center,
}: {
  label?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  center?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col", center && "items-center text-center", className)}>
      <div className="min-w-0">{children}</div>
      {label && <DSCaption className={cn(center && "text-center")}>{label}</DSCaption>}
    </div>
  );
}

/** Spec — governance grid: purpose / usage / states / responsive / a11y. */
export function DSSpec({
  rows,
  className,
}: {
  rows: { label: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3.5 sm:grid-cols-2", className)}>
      {rows.map((r) => (
        <div key={r.label} className="min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{r.label}</dt>
          <dd className="mt-1 text-[13px] leading-relaxed text-slate-700">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Inline token chip — monospace reference used inside prose. */
export function DSVar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <code
      className={cn(
        "rounded border border-slate-200/90 bg-slate-50 px-1 py-px font-mono text-[11.5px] text-slate-700",
        className,
      )}
    >
      {children}
    </code>
  );
}

/** TokenTable — the reference table for token values (mono names/values). */
export function DSTokenTable({
  head,
  rows,
  className,
}: {
  head: string[];
  rows: React.ReactNode[][];
  className?: string;
}) {
  return (
    <div className={cn("qubit-scroll overflow-x-auto", className)}>
      <table className="w-full border-collapse text-[13px]" style={{ minWidth: 480 }}>
        <thead>
          <tr className="border-b border-slate-200/90 bg-slate-50/95 text-left">
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className="transition-colors duration-150 hover:bg-slate-50/70">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-3 py-2.5 align-middle",
                    j === 0 ? "font-mono text-[12.5px] text-slate-800" : "text-slate-600",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Do / Don't — paired guidance panels, restrained treatment. */
export function DSGuidance({
  kind,
  title,
  children,
  className,
}: {
  kind: "do" | "dont";
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const isDo = kind === "do";
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4",
        isDo ? "border-emerald-200/80" : "border-red-200/80",
        className,
      )}
    >
      <p className={cn("flex items-center gap-1.5 text-xs font-semibold", isDo ? "text-emerald-700" : "text-red-700")}>
        {isDo ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
        {isDo ? "Do" : "Don't"}
        <span className="font-medium text-slate-700">— {title}</span>
      </p>
      <div className="mt-3 text-[13px] leading-relaxed text-slate-600">{children}</div>
    </div>
  );
}

/** Prev / next screen navigation — ties the 18 references into one linear system. */
export function DSScreenNav({ id, className }: { id: ScreenId; className?: string }) {
  const { navigate } = useQubitNav();
  const list = screensByModule("design-system");
  const idx = list.findIndex((s) => s.id === id);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

  const side = (meta: (typeof list)[number] | null, dir: "prev" | "next") => {
    if (!meta) return <span aria-hidden className="hidden flex-1 md:block" />;
    const Icon = dir === "prev" ? ArrowLeft : ArrowRight;
    return (
      <button
        type="button"
        onClick={() => navigate(meta.id)}
        aria-label={dir === "prev" ? `Previous screen: ${meta.title}` : `Next screen: ${meta.title}`}
        className={cn(
          "group/nav flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors duration-150 hover:border-blue-200 hover:bg-blue-50/40",
          dir === "next" && "flex-row-reverse text-right",
        )}
      >
        <Icon className="h-4 w-4 shrink-0 text-slate-400 transition-colors duration-150 group-hover/nav:text-blue-600" aria-hidden />
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            {dir === "prev" ? "Previous" : "Next"}
          </span>
          <span className="block truncate text-[13px] font-medium text-slate-700 group-hover/nav:text-blue-700">
            {meta.title}
          </span>
        </span>
      </button>
    );
  };

  return (
    <nav aria-label="Design system screens" className={cn("mt-8 flex flex-col gap-3 sm:flex-row", className)}>
      {side(prev, "prev")}
      {side(next, "next")}
    </nav>
  );
}
