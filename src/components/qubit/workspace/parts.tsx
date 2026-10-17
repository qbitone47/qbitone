"use client";

import * as React from "react";
import {
  Bot,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  MessageSquare,
  FileUp,
  Lock,
  Mail,
  PenLine,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  Video,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "../primitives";
import { fmtDate, fmtTime, WORKSPACE_NOW, type TaskSource } from "@/lib/qubit/workspace-data";

// ============================================================
// SourceBadge — where a task came from (Phase 4 vocabulary).
// AI-generated work must always be identifiable (spec §43).
// ============================================================

const SOURCE_ICONS: Record<TaskSource, React.ElementType> = {
  "Meeting action item": Video,
  Workflow: Wrench,
  "Manager assignment": UserRound,
  "Sales activity": TrendingUp,
  "Service activity": Wrench,
  "HR workflow": Users,
  Automation: Bot,
  "AI recommendation": Sparkles,
  "Approval process": ClipboardCheck,
  Manual: PenLine,
};

export function SourceBadge({ source, ai }: { source: TaskSource; ai?: boolean }) {
  const Icon = SOURCE_ICONS[source] ?? PenLine;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        ai ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-slate-50 text-slate-600",
      )}
      title={ai ? "Suggested by Qubit AI — permission-aware and dismissible" : undefined}
    >
      <Icon className={cn("h-3 w-3", ai && "text-violet-500")} aria-hidden />
      {source}
    </span>
  );
}

// ============================================================
// DueBadge — due date with overdue treatment (never color-only)
// ============================================================

export function DueBadge({ due, completed }: { due: number | null; completed?: boolean }) {
  if (due === null) {
    return <span className="text-xs text-slate-400">No due date</span>;
  }
  const overdue = !completed && due < WORKSPACE_NOW;
  const sameDay = new Date(due).toDateString() === new Date(WORKSPACE_NOW).toDateString();
  const tomorrow = new Date(due).toDateString() === new Date(WORKSPACE_NOW + 86_400_000).toDateString();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap",
        overdue ? "rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-700" : "text-slate-600",
      )}
    >
      <CalendarDays className="h-3 w-3" aria-hidden />
      {overdue ? `Overdue · ${fmtDate(due)}` : sameDay ? `Today ${fmtTime(due)}` : tomorrow ? `Tomorrow ${fmtTime(due)}` : fmtDate(due)}
    </span>
  );
}

// ============================================================
// LockedFieldHint — company-controlled profile fields (spec §42)
// ============================================================

export function LockedFieldHint({ label = "Managed by authorized HR workflows" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
      <Lock className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

// ============================================================
// AvatarStack — meeting/document participants
// ============================================================

export function AvatarStack({ names, max = 4, size = "xs" }: { names: string[]; max?: number; size?: "xs" | "sm" }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className="flex items-center">
      <span className="flex -space-x-1.5">
        {shown.map((n) => (
          <Avatar key={n} name={n} size={size} ring />
        ))}
      </span>
      {rest > 0 && <span className="ml-1.5 text-[11px] font-medium text-slate-500">+{rest}</span>}
      <span className="sr-only">{names.join(", ")}</span>
    </span>
  );
}

// ============================================================
// SegmentedToggle — view switch built on .qubit-segmented
// ============================================================

export function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ElementType }[];
  ariaLabel: string;
}) {
  return (
    <div className="qubit-segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => {
        const Icon = o.icon;
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors duration-150",
              active ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-slate-800",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// ActivityTypeIcon — My Activity timeline (Screen 49)
// ============================================================

export const ACTIVITY_TYPE_ICONS: Record<string, React.ElementType> = {
  "Task completed": CalendarCheck,
  "Meeting attended": Video,
  "Document uploaded": FileUp,
  "Approval performed": ClipboardCheck,
  "Profile change": UserRound,
  "Workflow action": Wrench,
  Comment: MessageSquare,
  "Mail sent": Mail,
  "Security event": ShieldCheck,
  "Access change": Briefcase,
};

export function ActivityTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ACTIVITY_TYPE_ICONS[type] ?? PenLine;
  return <Icon className={cn("h-3.5 w-3.5", className)} aria-hidden />;
}

// ============================================================
// CategoryIcon — My Notifications rows (Screen 48)
// ============================================================

export const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Tasks: CalendarCheck,
  Approvals: ClipboardCheck,
  Meetings: Video,
  HR: Users,
  Sales: TrendingUp,
  Finance: Briefcase,
  Service: Wrench,
  System: Bot,
  Security: ShieldCheck,
  Collaboration: MessageSquare,
};

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = CATEGORY_ICONS[category] ?? PenLine;
  return <Icon className={cn("h-3.5 w-3.5", className)} aria-hidden />;
}

// ============================================================
// Timeline — chronological list with quiet rail (Screen 49)
// ============================================================

export function Timeline({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <ol className={cn("relative space-y-1", className)} aria-label="Activity timeline">
      <span aria-hidden className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200" />
      {children}
    </ol>
  );
}

export function TimelineItem({
  icon,
  title,
  detail,
  time,
  action,
  accent = false,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  detail?: React.ReactNode;
  time: string;
  action?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <li className="relative flex gap-3 rounded-lg py-2.5 pr-2 transition-colors hover:bg-slate-50/80">
      <span
        aria-hidden
        className={cn(
          "relative z-10 mt-0.5 flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-full border bg-white",
          accent ? "border-blue-200 text-blue-600" : "border-slate-200 text-slate-500",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="min-w-0 text-[13px] font-medium text-slate-800">{title}</p>
          <span className="ml-auto shrink-0 text-[11px] text-slate-400">{time}</span>
        </div>
        {detail && <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</div>}
        {action && <div className="mt-1.5">{action}</div>}
      </div>
    </li>
  );
}
