"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  onClick?: () => void;
}

/**
 * PageHeader — predictable page structure (per Qubit One visual system):
 * Module chip → Title → Description → Actions → (workspace rendered by screen)
 * The topbar owns the breadcrumb; the page area opens with a module chip,
 * matching the reference layout.
 */
export function PageHeader({
  crumbs,
  title,
  description,
  actions,
  meta,
  className,
}: {
  crumbs?: Crumb[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  const chip = crumbs && crumbs.length > 0 ? crumbs[0] : null;

  return (
    <header className={cn("mb-6", className)}>
      {chip && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {chip.onClick ? (
            <button
              type="button"
              onClick={chip.onClick}
              className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
            >
              {chip.label}
            </button>
          ) : (
            <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{chip.label}</span>
          )}
          {crumbs!.slice(1, -1).map((c, i) => (
            <span key={`mid-${i}`} className="text-xs text-slate-400">
              {c.label}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-slate-900 md:text-[30px]">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-slate-500">{description}</p>
          )}
          {meta && <div className="mt-3">{meta}</div>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 pt-1 md:pt-1.5">{actions}</div>
        )}
      </div>
    </header>
  );
}
