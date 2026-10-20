"use client";

import * as React from "react";
import {
  Briefcase,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Lock,
  MapPin,
  RefreshCw,
  Users,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getEmployee } from "@/lib/qubit/data";
import { fmtDate, fmtTime, ist, type CalendarEvent, type EventType, type Meeting } from "@/lib/qubit/workspace-data";
import { apiGet, ApiError } from "@/lib/qubit/api";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { AvatarStack, SegmentedToggle } from "../workspace/parts";
import { EmptyState, SectionCard } from "../primitives";
import { FormDialog } from "../dialogs";

// ============================================================
// Screen 44 · My Calendar — unified calendar with structured
// enterprise density. Privacy is real: events marked
// organizer-only render as "Busy" for anyone else.
//
// Events and meetings are served by /api/workspace/meetings and
// scoped server-side; the screen holds no client-only business
// state — new events are recorded through the same API (and the
// enterprise audit trail), never in a local array.
// ============================================================

interface CalendarPayload {
  meetings: Meeting[];
  events: CalendarEvent[];
  scope: "own";
  note: string | null;
  asOf: string;
  now: number;
}

const HOUR_H = 48; // px per hour in week grid
const DAY_START = 8; // 08:00
const DAY_END = 20; // 20:00

const TYPE_STYLES: Record<EventType, { chip: string; dot: string; label: string }> = {
  Meeting: { chip: "border-blue-200 bg-blue-50 text-blue-800", dot: "bg-blue-600", label: "Meetings" },
  Deadline: { chip: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500", label: "Deadlines" },
  "Company event": { chip: "border-violet-200 bg-violet-50 text-violet-800", dot: "bg-violet-500", label: "Company events" },
  Leave: { chip: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500", label: "Approved leave" },
  "Focus time": { chip: "border-slate-200 bg-slate-50 text-slate-700", dot: "bg-slate-400", label: "Focus time" },
};

const TYPE_ORDER: EventType[] = ["Meeting", "Deadline", "Company event", "Leave", "Focus time"];
const DAY_MS = 86_400_000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Midnight IST (epoch) of the given timestamp's IST day. */
const istMidnight = (ts: number) => {
  const d = ist(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 330 * 60_000;
};

export function MyCalendarScreen() {
  const nav = useQubitNav();
  const { toast } = useToast();
  const { role } = useRole();

  const [data, setData] = React.useState<CalendarPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<"day" | "week" | "month">("week");
  const [anchor, setAnchor] = React.useState<number | null>(null);
  const [types, setTypes] = React.useState<EventType[]>(TYPE_ORDER);
  const [selected, setSelected] = React.useState<CalendarEvent | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiGet<CalendarPayload>("/meetings", undefined, role, "/api/workspace");
      setData(payload);
      setAnchor((prev) => prev ?? payload.now);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The calendar service is unreachable right now.");
    } finally {
      setLoading(false);
    }
  }, [role]);

  React.useEffect(() => {
    load();
  }, [load]);

  const createEvent = async (input: { title: string; type: EventType; start: number; end: number; location?: string }) => {
    try {
      const res = await fetch("/api/workspace/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Qubit-Role": role },
        body: JSON.stringify({ action: "create-event", ...input }),
      });
      const resData = await res.json().catch(() => null);
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Event not added",
          description: resData?.message ?? "The calendar service rejected this event. Nothing was changed.",
        });
        return;
      }
      toast({ title: "Event added to your calendar", description: resData?.message ?? "The event was added." });
      await load();
    } catch {
      toast({
        variant: "destructive",
        title: "Event not added",
        description: "The calendar service is unreachable. Nothing was changed — retry when you're back online.",
      });
    }
  };

  if (loading || !data || anchor === null) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Workspace" }, { label: "My time" }]}
          title="My Calendar"
          description="Meetings, deadlines, company events and approved leave in one enterprise calendar — with privacy you can rely on."
          actions={
            <Button className="h-9 gap-1.5" onClick={() => setCreateOpen(true)}>
              <CalendarPlus className="h-4 w-4" aria-hidden /> New event
            </Button>
          }
        />
        {error && (
          <div className="qubit-card mb-3 flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50/60 px-4 py-3" role="alert">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
            </Button>
          </div>
        )}
        {loading && <CalendarSkeleton />}
      </div>
    );
  }

  const now = data.now;
  const allEvents = data.events;
  const visible = allEvents.filter((e) => types.includes(e.type));
  const meetingsById = new Map(data.meetings.map((m) => [m.id, m]));

  const anchorMid = istMidnight(anchor);
  const anchorDow = (ist(anchorMid).getUTCDay() + 6) % 7; // 0 = Monday
  const weekStart = anchorMid - anchorDow * DAY_MS;
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart + i * DAY_MS);

  // month grid: Monday-start weeks covering the anchor's month
  const monthRef = ist(anchorMid);
  const monthStart = Date.UTC(monthRef.getUTCFullYear(), monthRef.getUTCMonth(), 1) - 330 * 60_000;
  const monthDow = (ist(monthStart).getUTCDay() + 6) % 7;
  const monthGridStart = monthStart - monthDow * DAY_MS;
  const monthGrid = Array.from({ length: 42 }, (_, i) => monthGridStart + i * DAY_MS);
  const monthLabel = ist(anchorMid).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  const rangeLabel =
    view === "day"
      ? `${WEEKDAYS[(ist(anchorMid).getUTCDay() + 6) % 7]}, ${fmtDate(anchorMid)}`
      : view === "week"
        ? `${fmtDate(weekStart)} — ${fmtDate(weekStart + 6 * DAY_MS)}`
        : monthLabel;

  const step = (dir: 1 | -1) => {
    if (view === "day") setAnchor((a) => (a === null ? a : istMidnight(a) + dir * DAY_MS));
    else if (view === "week") setAnchor((a) => (a === null ? a : istMidnight(a) + dir * 7 * DAY_MS));
    else {
      setAnchor((a) => {
        if (a === null) return a;
        const d = ist(istMidnight(a));
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1) - 330 * 60_000;
      });
    }
  };

  const eventsOn = (dayMid: number) =>
    visible.filter((e) => {
      const sMid = istMidnight(e.start);
      const eMid = istMidnight(e.end);
      return dayMid >= sMid && dayMid <= eMid;
    });

  const timedOn = (dayMid: number) =>
    eventsOn(dayMid)
      .filter((e) => !e.allDay && istMidnight(e.start) === dayMid)
      .sort((a, b) => a.start - b.start);

  const allDayOn = (dayMid: number) => eventsOn(dayMid).filter((e) => e.allDay || istMidnight(e.start) !== istMidnight(e.end));

  const isToday = (dayMid: number) => dayMid === istMidnight(now);
  const isPast = (dayMid: number) => dayMid < istMidnight(now);

  const toggleType = (t: EventType) => setTypes((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Workspace" }, { label: "My time" }]}
        title="My Calendar"
        description="Meetings, deadlines, company events and approved leave in one enterprise calendar — with privacy you can rely on."
        actions={
          <Button className="h-9 gap-1.5" onClick={() => setCreateOpen(true)}>
            <CalendarPlus className="h-4 w-4" aria-hidden /> New event
          </Button>
        }
      />

      {error && (
        <div className="qubit-card mb-3 flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50/60 px-4 py-3" role="alert">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
          </Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-9" onClick={() => setAnchor(now)}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label={view === "month" ? "Previous month" : view === "week" ? "Previous week" : "Previous day"} onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label={view === "month" ? "Next month" : view === "week" ? "Next week" : "Next day"} onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <p className="min-w-44 text-sm font-semibold text-slate-900" aria-live="polite">{rangeLabel}</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {TYPE_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={types.includes(t)}
              onClick={() => toggleType(t)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                types.includes(t) ? TYPE_STYLES[t].chip : "border-slate-200 bg-white text-slate-400",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", types.includes(t) ? TYPE_STYLES[t].dot : "bg-slate-300")} aria-hidden />
              {TYPE_STYLES[t].label}
            </button>
          ))}
          <SegmentedToggle
            ariaLabel="Calendar view"
            value={view}
            onChange={setView}
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
          />
        </div>
      </div>

      {view === "week" && <WeekGrid days={weekDays} timedOn={timedOn} allDayOn={allDayOn} onOpen={setSelected} now={now} />}

      {view === "day" && (
        <DayView dayMid={anchorMid} timedOn={timedOn} allDayOn={allDayOn} onOpen={setSelected} />
      )}

      {view === "month" && (
        <MonthGrid
          grid={monthGrid}
          anchorMonth={ist(anchorMid).getUTCMonth()}
          eventsOn={eventsOn}
          isToday={isToday}
          onOpenDay={(d) => {
            setAnchor(d);
            setView("day");
          }}
          onOpenEvent={setSelected}
        />
      )}

      {/* Legend + privacy note */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Lock className="h-3 w-3" aria-hidden /> Events marked private show as "Busy" to others
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden /> Times shown in IST (Asia/Kolkata)
        </span>
      </div>

      <EventDrawer event={selected} meetingsById={meetingsById} onClose={() => setSelected(null)} onNavigate={nav.navigate} />

      <NewEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDay={anchorMid}
        onCreate={createEvent}
      />
    </div>
  );
}

// ---------- Week grid ----------

function WeekGrid({
  days,
  timedOn,
  allDayOn,
  onOpen,
  now,
}: {
  days: number[];
  timedOn: (d: number) => CalendarEvent[];
  allDayOn: (d: number) => CalendarEvent[];
  onOpen: (e: CalendarEvent) => void;
  now: number;
}) {
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const todayMid = istMidnight(now);
  const nowOffsetMin = (ist(now).getUTCHours() - DAY_START) * 60 + ist(now).getUTCMinutes();
  const todayIdx = days.findIndex((d) => d === todayMid);

  return (
    <div className="qubit-card overflow-hidden">
      <div className="qubit-scroll overflow-x-auto">
        <div className="min-w-[860px]">
          {/* day headers */}
          <div className="grid border-b border-slate-200/90 bg-slate-50/80" style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))` }}>
            <span aria-hidden />
            {days.map((d) => {
              const today = d === todayMid;
              return (
                <div key={d} className={cn("border-l border-slate-100 px-2 py-2 text-center", today && "bg-blue-50/60")}>
                  <p className={cn("text-[10.5px] font-medium uppercase tracking-wide", today ? "text-blue-700" : "text-slate-400")}>
                    {WEEKDAYS[(ist(d).getUTCDay() + 6) % 7]}
                  </p>
                  <p className={cn("text-[15px] font-semibold tabular-nums", today ? "text-blue-700" : d < todayMid ? "text-slate-400" : "text-slate-800")}>
                    {ist(d).getUTCDate()}
                  </p>
                </div>
              );
            })}
          </div>
          {/* all-day strip */}
          <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))` }}>
            <span className="pt-1.5 text-right pr-1.5 text-[9.5px] font-medium uppercase tracking-wide text-slate-400">All day</span>
            {days.map((d) => (
              <div key={d} className="min-h-9 space-y-1 border-l border-slate-100 p-1">
                {allDayOn(d).map((e) => (
                  <AllDayChip key={e.id} event={e} onOpen={() => onOpen(e)} />
                ))}
              </div>
            ))}
          </div>
          {/* timed grid */}
          <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))` }}>
            <div aria-hidden>
              {hours.map((h) => (
                <div key={h} className="relative" style={{ height: HOUR_H }}>
                  <span className="absolute -top-1.5 right-1.5 text-[10px] tabular-nums text-slate-400">{String(h).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>
            {days.map((d) => (
              <div key={d} className={cn("relative border-l border-slate-100", todayIdx >= 0 && d === days[todayIdx] && "bg-blue-50/25")}>
                {hours.map((h) => (
                  <div key={h} className="border-b border-slate-100/70" style={{ height: HOUR_H }} aria-hidden />
                ))}
                {timedOn(d).map((e) => (
                  <EventBlock key={e.id} event={e} dayMid={d} onOpen={() => onOpen(e)} />
                ))}
                {/* now indicator inside today's column */}
                {d === todayMid &&
                  nowOffsetMin >= 0 &&
                  nowOffsetMin <= (DAY_END - DAY_START) * 60 && (
                    <div aria-hidden className="pointer-events-none absolute left-0 right-0 z-10 flex items-center" style={{ top: (nowOffsetMin / 60) * HOUR_H }}>
                      <span className="h-2 w-2 -translate-x-1 rounded-full bg-red-500" />
                      <span className="h-px flex-1 bg-red-400" />
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function evMinutes(e: CalendarEvent) {
  const d = ist(e.start);
  return (d.getUTCHours() - DAY_START) * 60 + d.getUTCMinutes();
}

function evDurationMin(e: CalendarEvent) {
  return Math.max(30, Math.round((e.end - e.start) / 60_000));
}

function EventBlock({ event: e, dayMid, onOpen }: { event: CalendarEvent; dayMid: number; onOpen: () => void }) {
  const style = TYPE_STYLES[e.type];
  const privateEvent = e.visibleTo === "organizer-only" && e.organizerId !== "sagar";
  const top = (evMinutes(e) / 60) * HOUR_H;
  const height = Math.max(22, (evDurationMin(e) / 60) * HOUR_H - 2);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={privateEvent ? "Private event — Busy" : `${e.title}, ${fmtTime(e.start)} to ${fmtTime(e.end)}`}
      className={cn(
        "absolute left-0.5 right-1 z-[5] overflow-hidden rounded-md border px-1.5 py-0.5 text-left transition-all duration-150 hover:z-20 hover:shadow-md",
        privateEvent ? "border-slate-200 bg-slate-100/90" : style.chip,
      )}
      style={{ top, height }}
    >
      <span className="flex items-center gap-1">
        {privateEvent ? (
          <Lock className="h-2.5 w-2.5 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} aria-hidden />
        )}
        <span className="truncate text-[10.5px] font-semibold leading-tight">{privateEvent ? "Busy" : e.title}</span>
      </span>
      {height > 34 && !privateEvent && (
        <span className="mt-px block truncate text-[9.5px] leading-tight opacity-75">
          {fmtTime(e.start)} · {e.location ?? e.type}
        </span>
      )}
    </button>
  );
}

function AllDayChip({ event: e, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  const privateEvent = e.visibleTo === "organizer-only" && e.organizerId !== "sagar";
  const style = TYPE_STYLES[e.type];
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={privateEvent ? "Private event — Busy" : `${e.title} (all day)`}
      className={cn("block w-full truncate rounded border px-1.5 py-0.5 text-left text-[10px] font-medium", privateEvent ? "border-slate-200 bg-slate-100 text-slate-500" : style.chip)}
    >
      {privateEvent ? "Busy" : e.title}
    </button>
  );
}

// ---------- Day view ----------

function DayView({
  dayMid,
  timedOn,
  allDayOn,
  onOpen,
}: {
  dayMid: number;
  timedOn: (d: number) => CalendarEvent[];
  allDayOn: (d: number) => CalendarEvent[];
  onOpen: (e: CalendarEvent) => void;
}) {
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const timed = timedOn(dayMid);
  const allDay = allDayOn(dayMid);
  return (
    <div className="qubit-card overflow-hidden">
      {allDay.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
          {allDay.map((e) => (
            <AllDayChip key={e.id} event={e} onOpen={() => onOpen(e)} />
          ))}
        </div>
      )}
      <ol className="divide-y divide-slate-100" aria-label="Day schedule">
        {hours.map((h) => {
          const slotEvents = timed.filter((e) => ist(e.start).getUTCHours() === h);
          return (
            <li key={h} className="flex gap-4 px-4 py-2">
              <span className="w-12 shrink-0 pt-0.5 text-right text-[11px] tabular-nums text-slate-400">{String(h).padStart(2, "0")}:00</span>
              <div className="flex-1 space-y-2">
                {slotEvents.length === 0 && <div className="h-6 rounded-md bg-slate-50/60" aria-hidden />}
                {slotEvents.map((e) => {
                  const privateEvent = e.visibleTo === "organizer-only" && e.organizerId !== "sagar";
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onOpen(e)}
                      aria-label={privateEvent ? "Private event — Busy" : `${e.title}, ${fmtTime(e.start)}`}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors hover:shadow-sm",
                        privateEvent ? "border-slate-200 bg-slate-100/80" : TYPE_STYLES[e.type].chip,
                      )}
                    >
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", privateEvent ? "bg-slate-400" : TYPE_STYLES[e.type].dot)} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{privateEvent ? "Busy — private event" : e.title}</span>
                        {!privateEvent && (
                          <span className="block truncate text-[11px] opacity-80">
                            {fmtTime(e.start)}–{fmtTime(e.end)}
                            {e.location ? ` · ${e.location}` : ""}
                          </span>
                        )}
                      </span>
                      {!privateEvent && e.meetingId && <Video className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
        {timed.length === 0 && allDay.length === 0 && (
          <li className="px-4 py-2">
            <EmptyState icon={<CalendarDays />} title="Nothing scheduled" message="This day is clear — a good place for focused work." className="py-8" />
          </li>
        )}
      </ol>
    </div>
  );
}

// ---------- Month grid ----------

function MonthGrid({
  grid,
  anchorMonth,
  eventsOn,
  isToday,
  onOpenDay,
  onOpenEvent,
}: {
  grid: number[];
  anchorMonth: number;
  eventsOn: (d: number) => CalendarEvent[];
  isToday: (d: number) => boolean;
  onOpenDay: (d: number) => void;
  onOpenEvent: (e: CalendarEvent) => void;
}) {
  return (
    <div className="qubit-card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200/90 bg-slate-50/80">
        {WEEKDAYS.map((w) => (
          <span key={w} className="px-2 py-2 text-center text-[10.5px] font-medium uppercase tracking-wide text-slate-400">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((d, i) => {
          const inMonth = ist(d).getUTCMonth() === anchorMonth;
          const dayEvents = eventsOn(d);
          const shown = dayEvents.slice(0, 2);
          const rest = dayEvents.length - shown.length;
          return (
            <div
              key={d}
              className={cn(
                "min-h-24 border-b border-r border-slate-100 p-1.5 [&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-slate-50/50",
                isToday(d) && "bg-blue-50/50",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onOpenDay(d)}
                  aria-label={`Open ${fmtDate(d)}`}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums transition-colors",
                    isToday(d) ? "bg-blue-600 text-white" : inMonth ? "text-slate-700 hover:bg-slate-100" : "text-slate-400",
                  )}
                >
                  {ist(d).getUTCDate()}
                </button>
              </div>
              <div className="space-y-0.5">
                {shown.map((e) => {
                  const privateEvent = e.visibleTo === "organizer-only" && e.organizerId !== "sagar";
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onOpenEvent(e)}
                      aria-label={privateEvent ? "Private event — Busy" : e.title}
                      className={cn("flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-medium", privateEvent ? "bg-slate-100 text-slate-500" : TYPE_STYLES[e.type].chip)}
                    >
                      <span className={cn("h-1 w-1 shrink-0 rounded-full", privateEvent ? "bg-slate-400" : TYPE_STYLES[e.type].dot)} aria-hidden />
                      <span className="truncate">{privateEvent ? "Busy" : e.title}</span>
                    </button>
                  );
                })}
                {rest > 0 && (
                  <button type="button" onClick={() => onOpenDay(d)} className="w-full px-1 text-left text-[10px] font-medium text-slate-500 hover:text-blue-700">
                    +{rest} more
                  </button>
                )}
              </div>
              {i % 7 === 6 && <span className="sr-only">Week {Math.floor(i / 7) + 1} ends</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Event drawer ----------

function EventDrawer({
  event,
  meetingsById,
  onClose,
  onNavigate,
}: {
  event: CalendarEvent | null;
  meetingsById: Map<string, Meeting>;
  onClose: () => void;
  onNavigate: (s: Parameters<ReturnType<typeof useQubitNav>["navigate"]>[0], p?: Parameters<ReturnType<typeof useQubitNav>["navigate"]>[1]) => void;
}) {
  const { toast } = useToast();
  if (!event) return null;
  const privateEvent = event.visibleTo === "organizer-only" && event.organizerId !== "sagar";
  const organizer = getEmployee(event.organizerId);
  const meeting = event.meetingId ? meetingsById.get(event.meetingId) : undefined;
  return (
    <SectionCard className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-lg p-0 shadow-xl md:right-6 md:left-auto md:w-96" noPadding>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" aria-hidden>
            <span className={cn("h-1.5 w-1.5 rounded-full", privateEvent ? "bg-slate-400" : TYPE_STYLES[event.type].dot)} />
            <span className={privateEvent ? "text-slate-500" : ""}>{privateEvent ? "Private event" : event.type}</span>
          </p>
          <h2 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-slate-900">
            {privateEvent ? "Busy" : event.title}
          </h2>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Close event details" onClick={onClose}>
          <Info className="hidden" aria-hidden />
          <span aria-hidden className="text-slate-400">×</span>
        </Button>
      </div>
      <div className="space-y-3 px-4 py-4 text-[13px] text-slate-700">
        {privateEvent ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
            The organizer has marked this event private. You can see when they are unavailable — not why.
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              {event.allDay ? "All day" : `${fmtTime(event.start)} – ${fmtTime(event.end)}`} · {fmtDate(event.start)}
            </p>
            {event.location && (
              <p className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden /> {event.location}
              </p>
            )}
            {organizer && (
              <p className="flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" aria-hidden /> Organized by {organizer.name}
              </p>
            )}
            {meeting && (
              <p className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                <AvatarStack names={meeting.participantIds.map((id) => getEmployee(id)?.name ?? "")} max={5} />
                <span className="text-xs text-slate-500">{meeting.participantIds.length} participants</span>
              </p>
            )}
            {event.related && <p className="text-xs text-slate-500">{event.related}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              {meeting && (
                <Button size="sm" className="h-8 gap-1.5" onClick={() => { onClose(); onNavigate("my-meetings", { meetingId: meeting.id }); }}>
                  <Video className="h-3.5 w-3.5" aria-hidden /> Open meeting
                </Button>
              )}
              {event.type === "Deadline" && (
                <Button size="sm" variant="outline" className="h-8" onClick={() => { onClose(); onNavigate("my-tasks"); }}>
                  Related work in My Tasks
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-slate-500"
                onClick={() => toast({ title: "Reschedule", description: "Rescheduling runs through the Meetings module with organizer permissions." })}
              >
                Reschedule
              </Button>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}

// ---------- New event dialog ----------

function NewEventDialog({
  open,
  onOpenChange,
  defaultDay,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultDay: number;
  onCreate: (input: { title: string; type: EventType; start: number; end: number; location?: string }) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState<EventType>("Meeting");
  const [time, setTime] = React.useState("14:00");
  const [duration, setDuration] = React.useState("30");
  const [location, setLocation] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setType("Meeting");
      setTime("14:00");
      setDuration("30");
      setLocation("");
      setError(null);
    }
  }, [open]);

  const submit = () => {
    if (title.trim().length < 3) {
      setError("Give the event a title (at least 3 characters).");
      return;
    }
    const [h, m] = time.split(":").map(Number);
    const dur = Number(duration);
    const start = defaultDay + h * 3_600_000 + m * 60_000;
    onCreate({
      title: title.trim(),
      type,
      start,
      end: start + dur * 60_000,
      location: location.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="New event" description="Adds to your calendar for this session. Meeting invites with participants run through the Meetings module." submitLabel="Add event" onSubmit={submit}>
      <div className="space-y-1.5">
        <Label htmlFor="ev-title" className="text-xs font-medium text-slate-700">
          Title <span className="text-red-500" aria-hidden>*</span>
        </Label>
        <Input id="ev-title" value={title} onChange={(e) => { setTitle(e.target.value); setError(null); }} placeholder="e.g. Focus time — board deck" autoFocus aria-invalid={Boolean(error)} />
        {error && <p role="alert" className="text-[11.5px] font-medium text-red-600">{error}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs font-medium text-slate-700">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as EventType)}>
            <SelectTrigger aria-label="Event type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Meeting">Meeting</SelectItem>
              <SelectItem value="Deadline">Deadline</SelectItem>
              <SelectItem value="Focus time">Focus time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-time" className="text-xs font-medium text-slate-700">Start (IST)</Label>
          <Input id="ev-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-duration" className="text-xs font-medium text-slate-700">Duration</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger id="ev-duration" aria-label="Duration"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 min</SelectItem>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="45">45 min</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="120">2 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ev-location" className="text-xs font-medium text-slate-700">Location</Label>
        <Input id="ev-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room, link or platform" />
      </div>
    </FormDialog>
  );
}

// ---------- Loading skeleton ----------

function CalendarSkeleton() {
  return (
    <div className="qubit-card overflow-hidden" aria-hidden>
      <div className="grid border-b border-slate-200/90 bg-slate-50/80" style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" }}>
        <span />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="border-l border-slate-100 px-2 py-2">
            <div className="mx-auto h-2.5 w-8 animate-pulse rounded bg-slate-100" />
            <div className="mx-auto mt-1.5 h-4 w-6 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" }}>
        <div className="space-y-3 p-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="ml-auto h-2.5 w-9 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, d) => (
          <div key={d} className="min-h-80 space-y-2 border-l border-slate-100 p-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn("h-9 animate-pulse rounded-md", (d + i) % 3 === 0 ? "bg-blue-50" : (d + i) % 3 === 1 ? "bg-amber-50" : "bg-slate-100")}
                style={{ marginTop: i === 0 ? (d % 3) * 24 : 0 }}
              />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">Loading calendar…</span>
    </div>
  );
}
