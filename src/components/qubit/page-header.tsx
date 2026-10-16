"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  onClick?: () => void;
}

/**
 * PageHeader — predictable page structure:
 * Breadcrumb → Title → Description → Actions → (workspace rendered by screen)
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
  return (
    <header className={cn("mb-5", className)}>
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2.5">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" aria-hidden />}
                {c.onClick ? (
                  <button
                    type="button"
                    onClick={c.onClick}
                    className="rounded px-1 py-0.5 hover:bg-slate-100 hover:text-slate-700"
                  >
                    {c.label}
                  </button>
                ) : (
                  <span className={cn("px-1 py-0.5", i === crumbs.length - 1 && "font-medium text-slate-600")}>{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
          {meta && <div className="mt-2.5">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
