"use client";

import * as React from "react";
import { Activity, CalendarDays, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/qubit/api";
import type { AuditEvent } from "@/lib/qubit/security-server";
import { ist, type ActivityType } from "@/lib/qubit/workspace-data";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { ActivityTypeIcon, Timeline, TimelineItem } from "../workspace/parts";
import { EmptyState, SearchInput, SectionCard } from "../primitives";

// ============================================================
// Screen 49 · My Activity — the personal work timeline.
// Distinct from the enterprise Audit Log (screen 39): this view
// is the employee-facing story of their own work; security
// entries link onward to the authoritative audit record.
//
// Phase 21 (§58): the timeline is the user's REAL audit trail —
// GET /api/security/audit, which the server scopes to the session
// identity for non-admin viewers. Audit events are mapped onto
// the existing display shape (action → type-ish, resource,
// correlationId, server-formatted time); nothing is fabricated,
// and the empty state stays honest when the trail is empty.
// ============================================================

interface AuditPage {
  events: AuditEvent[];
  total: number;
  page: number;
  pageCount: number;
  restricted: boolean;
}

/** One timeline row — the screen's existing ActivityEntry display shape. */
interface ActivityRow {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  ts: number;
  time: string;
  security: boolean;
}

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

/** Map an audit action onto the timeline's fixed activity types so the
 *  existing icon/badge language applies — honestly coarse ("type-ish"). */
function typeFor(action: string): ActivityType {
  const a = action.toLowerCase();
  if (/task/.test(a)) return "Task completed";
  if (/mail/.test(a)) return "Mail sent";
  if (/approval|approved|decision/.test(a)) return "Approval performed";
  // Order matters: document DENIALS are security events, not uploads.
  if (/denied|blocked|rejected/.test(a) && /document|download|share/.test(a)) return "Security event";
  if (/document/.test(a)) return "Document uploaded";
  if (/meeting|calendar|standup/.test(a)) return "Meeting attended";
  if (/profile/.test(a)) return "Profile change";
  if (/comment/.test(a)) return "Comment";
  if (/access|role|permission/.test(a)) return "Access change";
  if (/sign-in|sign in|signout|session|lockout|mfa|passkey|password|security|export|auth|login|denied|blocked/.test(a)) return "Security event";
  return "Workflow action";
}

const DAY_MS = 86_400_000;

export function MyActivityScreen() {
  const nav = useQubitNav();
  const { role } = useRole();

  const [entries, setEntries] = React.useState<ActivityRow[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [range, setRange] = React.useState<"week" | "month" | "all">("month");
  const [search, setSearch] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The server scopes non-admin viewers to their own events; page 1 at
      // the route's maximum size keeps the personal timeline honest without
      // paging UI this screen never had.
      const data = await apiGet<AuditPage>("/audit", { pageSize: 50, page: 1 }, role);
      setTotal(data.total);
      setEntries(
        data.events.map((ev) => ({
          id: ev.id,
          type: typeFor(ev.action),
          title: ev.action,
          detail: [ev.resource, ev.correlationId].filter(Boolean).join(" · "),
          ts: ev.ts,
          time: ev.time,
          security: typeFor(ev.action) === "Security event",
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, [role]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(() => {
    // Audit events carry real wall-clock timestamps — the range filter
    // anchors to now, never to the workspace demo clock.
    const now = Date.now();
    let list = entries ?? [];
    if (typeFilter !== "all") list = list.filter((a) => a.type === typeFilter);
    if (range === "week") list = list.filter((a) => a.ts >= now - 7 * DAY_MS);
    if (range === "month") list = list.filter((a) => a.ts >= now - 30 * DAY_MS);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((a) => `${a.title} ${a.detail} ${a.type}`.toLowerCase().includes(q));
    return list.slice().sort((a, b) => b.ts - a.ts);
  }, [entries, typeFilter, range, search]);

  // Group by IST day (real clock — audit events are real-time records)
  const groups = React.useMemo(() => {
    const map = new Map<string, ActivityRow[]>();
    for (const a of filtered) {
      const key = ist(a.ts).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const dayLabel = (key: string) => {
    const today = ist(Date.now()).toDateString();
    const yesterday = ist(Date.now() - DAY_MS).toDateString();
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
          {TYPES.filter((t) => (entries ?? []).some((a) => a.type === t)).map((t) => (
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

      {loading ? (
        <SectionCard noPadding className="px-4 py-2">
          <Timeline className="px-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <TimelineItem
                key={i}
                time=""
                icon={<span className="block h-4 w-4 animate-pulse rounded-full bg-slate-200" />}
                title={<span className="block h-3.5 w-2/5 animate-pulse rounded bg-slate-100" />}
                detail={<span className="block h-3 w-3/4 animate-pulse rounded bg-slate-100" />}
              />
            ))}
          </Timeline>
        </SectionCard>
      ) : error ? (
        <SectionCard>
          <EmptyState
            icon={<Activity />}
            title="Activity could not be loaded"
            message={`${error} No events were fabricated — retry when ready.`}
            action={
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => void load()}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
              </Button>
            }
          />
        </SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard>
          {typeFilter === "all" && range === "all" && !search.trim() ? (
            <EmptyState
              icon={<Activity />}
              title="No activity recorded yet"
              message="Your actions — tasks, decisions, documents, sign-ins — appear here as the server records them. Nothing is invented in the meantime."
            />
          ) : (
            <EmptyState
              icon={<Activity />}
              title="No activity in this view"
              message="Adjust the type or range filters — recorded work never disappears, it only narrows."
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
          )}
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {groups.map(([key, dayEntries]) => (
            <section key={key} aria-label={dayLabel(key)}>
              <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                <CalendarDays className="h-3 w-3" aria-hidden />
                {dayLabel(key)}
                <span className="font-normal normal-case tracking-normal text-slate-300">· {dayEntries.length} item{dayEntries.length === 1 ? "" : "s"}</span>
              </h2>
              <SectionCard noPadding className="px-4 py-2">
                <Timeline className="px-1">
                  {dayEntries.map((a) => (
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
                      time={a.time}
                    />
                  ))}
                </Timeline>
              </SectionCard>
            </section>
          ))}
        </div>
      )}

      {!loading && !error && total > (entries ?? []).length && (
        <p className="mt-4 text-[11px] text-slate-400">
          Showing the latest {entries?.length} of {total} recorded events — the full history is in the enterprise Audit Log.
        </p>
      )}

      <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-[11.5px] leading-relaxed text-slate-500">
        <span className="font-semibold text-slate-700">My Activity is your personal view.</span> This timeline is your own audit trail, scoped to your
        identity by the server. Security and access events are recorded with full technical context in the enterprise Audit Log, which remains the single
        authoritative history for the organization.
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
