"use client";

import * as React from "react";
import { Activity, CalendarDays, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ACTIVITY,
  ist,
  relTime,
  WORKSPACE_NOW,
  type ActivityEntry,
  type ActivityType,
} from "@/lib/qubit/workspace-data";
import { useQubitNav } from "../nav-context";
import { PageHeader } from "../page-header";
import { ActivityTypeIcon, Timeline, TimelineItem } from "../workspace/parts";
import { EmptyState, SearchInput, SectionCard } from "../primitives";

// ============================================================
// Screen 49 · My Activity — the personal work timeline.
// Distinct from the enterprise Audit Log (screen 39): this view
// is the employee-facing story of their own work; security
// entries link onward to the authoritative audit record.
// ============================================================

const TYPES: ActivityType[] = [
  "Task completed",
  "Meeting attended",
  "Document uploaded",
  "Approval performed",
  "Workflow action",
  "Comment",
  "Mail sent",
  "Profile change",
  "Access change",
  "Security event",
];

const DAY_MS = 86_400_000;

export function MyActivityScreen() {
  const nav = useQubitNav();

  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [range, setRange] = React.useState<"week" | "month" | "all">("month");
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    let list = ACTIVITY;
    if (typeFilter !== "all") list = list.filter((a) => a.type === typeFilter);
    if (range === "week") list = list.filter((a) => a.ts >= WORKSPACE_NOW - 7 * DAY_MS);
    if (range === "month") list = list.filter((a) => a.ts >= WORKSPACE_NOW - 30 * DAY_MS);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((a) => `${a.title} ${a.detail} ${a.type}`.toLowerCase().includes(q));
    return list.slice().sort((a, b) => b.ts - a.ts);
  }, [typeFilter, range, search]);

  // Group by IST day
  const groups = React.useMemo(() => {
    const map = new Map<string, ActivityEntry[]>();
    for (const a of filtered) {
      const key = ist(a.ts).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const dayLabel = (key: string) => {
    const today = ist(WORKSPACE_NOW).toDateString();
    const yesterday = ist(WORKSPACE_NOW - DAY_MS).toDateString();
    if (key === today) return "Today";
    if (key === yesterday) return "Yesterday";
    return new Date(key).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Workspace" }, { label: "My work" }]}
        title="My Activity"
        description="Your personal work timeline — tasks, meetings, documents, decisions and changes, in one chronological story."
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => nav.navigate("audit-log")}>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Enterprise Audit Log
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search your activity…" className="w-full sm:w-64" ariaLabel="Search activity" />
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by activity type">
          <Chip active={typeFilter === "all"} onClick={() => setTypeFilter("all")} label="All types" />
          {TYPES.filter((t) => ACTIVITY.some((a) => a.type === t)).map((t) => (
            <Chip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)} label={t} />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Range</span>
          <div className="qubit-segmented" role="tablist" aria-label="Date range">
            {(
              [
                { id: "week", label: "7 days" },
                { id: "month", label: "30 days" },
                { id: "all", label: "All" },
              ] as const
            ).map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={range === r.id}
                onClick={() => setRange(r.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                  range === r.id ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-slate-800",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={<Activity />}
            title="No activity in this view"
            message="Adjust the type or range filters — completed work never disappears, it only narrows."
            action={
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => {
                  setTypeFilter("all");
                  setRange("all");
                  setSearch("");
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Reset filters
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {groups.map(([key, entries]) => (
            <section key={key} aria-label={dayLabel(key)}>
              <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                <CalendarDays className="h-3 w-3" aria-hidden />
                {dayLabel(key)}
                <span className="font-normal normal-case tracking-normal text-slate-300">· {entries.length} item{entries.length === 1 ? "" : "s"}</span>
              </h2>
              <SectionCard noPadding className="px-4 py-2">
                <Timeline className="px-1">
                  {entries.map((a) => (
                    <TimelineItem
                      key={a.id}
                      accent={a.security}
                      icon={<ActivityTypeIcon type={a.type} className={a.security ? "text-blue-600" : undefined} />}
                      title={
                        <span className="flex flex-wrap items-center gap-2">
                          {a.title}
                          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wide text-slate-500">
                            {a.type}
                          </span>
                        </span>
                      }
                      detail={a.detail}
                      time={relTime(a.ts)}
                      action={
                        a.related ? (
                          <button
                            type="button"
                            onClick={() => nav.navigate(a.related!.screen, a.related!.params)}
                            className="text-[11.5px] font-medium text-blue-600 transition-colors hover:text-blue-800"
                          >
                            {a.related.label} →
                          </button>
                        ) : undefined
                      }
                    />
                  ))}
                </Timeline>
              </SectionCard>
            </section>
          ))}
        </div>
      )}

      <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-[11.5px] leading-relaxed text-slate-500">
        <span className="font-semibold text-slate-700">My Activity is your personal view.</span> Security and access events are recorded with full
        technical context in the enterprise Audit Log, which remains the single authoritative history for the organization.
      </p>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
        active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:text-slate-800",
      )}
    >
      {label}
    </button>
  );
}
