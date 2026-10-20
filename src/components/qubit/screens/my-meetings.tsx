"use client";

import * as React from "react";
import {
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  FileText,
  ListChecks,
  MapPin,
  RefreshCw,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { employees, getEmployee } from "@/lib/qubit/data";
import { fmtDate, fmtTime, ist, type Meeting } from "@/lib/qubit/workspace-data";
import { apiGet, ApiError } from "@/lib/qubit/api";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { Avatar, EmptyState, SectionCard, StatusBadge } from "../primitives";
import { AvatarStack } from "../workspace/parts";
import { DetailDrawer } from "../drawers";
import { ConfirmDialog, Field, FormDialog } from "../dialogs";
import { SegmentedToggle } from "../workspace/parts";

// ============================================================
// Screen 45 · My Meetings — focused meeting workspace (not a
// calendar clone). Past meetings carry notes, AI summaries and
// action items; those flow onward to My Tasks (integration
// point for the Meetings module).
//
// The list is served by /api/workspace/meetings and scoped
// server-side (participation boundary + organizer-permission
// cancellation); the screen holds no client-only business
// state — every mutation is a server action written to the
// enterprise audit trail, never a local array:
//   · create        — schedule a meeting with participants
//                     (participants are notified server-side)
//   · cancel        — organizer/governance cancellation
//   · add-action    — record a minutes action item, optionally
//                     ALSO creating a task (asTask)
//   · promote-action— push an already-recorded item into My
//                     Tasks (the server flags promoted items so
//                     the affordance disappears)
// ============================================================

interface MeetingsPayload {
  meetings: Meeting[];
  scope: "own";
  note: string | null;
  asOf: string;
  now: number;
}

type Bucket = "today" | "upcoming" | "past";

const DAY_MS = 86_400_000;
const MEETING_PLATFORMS = ["Qubit Meet", "Microsoft Teams", "Google Meet", "Room"] as const;

/** yyyy-mm-dd for a native date input, in IST (the workspace clock's zone). */
const istDateInput = (ts: number) => {
  const d = ist(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

/** IST epoch of a local-ISO date + HH:MM pair (same convention as My Calendar). */
const istEpoch = (date: string, time: string) => Date.parse(`${date}T${time}:00+05:30`);

export function MyMeetingsScreen() {
  const nav = useQubitNav();
  const { toast } = useToast();
  const { role } = useRole();
  const params = nav.params as { meetingId?: string };

  const [data, setData] = React.useState<MeetingsPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [bucket, setBucket] = React.useState<Bucket>("today");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<Meeting | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelling, setCancelling] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [actionTitle, setActionTitle] = React.useState("");
  const [asTask, setAsTask] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [promotingIndex, setPromotingIndex] = React.useState<number | null>(null);

  // The drawer always reads the FRESH materialized record from the store —
  // after a promote/reload the promoted flag appears without extra plumbing.
  const selected = React.useMemo(
    () => (selectedId ? data?.meetings.find((m) => m.id === selectedId) ?? null : null),
    [data, selectedId],
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiGet<MeetingsPayload>("/meetings", undefined, role, "/api/workspace");
      setData(payload);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The meetings service is unreachable right now.");
    } finally {
      setLoading(false);
    }
  }, [role]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (data && params.meetingId) {
      const m = data.meetings.find((x) => x.id === params.meetingId);
      if (m) setSelectedId(m.id);
    }
  }, [data, params.meetingId]);

  const now = data?.now ?? 0;
  const live = data?.meetings ?? [];

  const todays = live
    .filter((m) => ist(m.start).toDateString() === ist(now).toDateString())
    .sort((a, b) => a.start - b.start);
  const upcoming = live.filter((m) => m.start > now).sort((a, b) => a.start - b.start);
  const past = live.filter((m) => m.end < now && !todays.includes(m)).sort((a, b) => b.start - a.start);

  const bucketList = bucket === "today" ? todays : bucket === "upcoming" ? upcoming : past;

  const isOrganizer = (m: Meeting) => m.organizerId === "sagar";

  /** Phase 20 — schedule a meeting through the server. The SERVER message
   *  is toasted verbatim; no optimistic fake success. Returns whether the
   *  meeting was created so the dialog only closes on real success. */
  const doCreate = async (input: {
    title: string;
    agenda?: string;
    start: number;
    end: number;
    location?: string;
    platform: string;
    participantIds: string[];
  }): Promise<boolean> => {
    try {
      const res = await fetch("/api/workspace/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Qubit-Role": role },
        body: JSON.stringify({ action: "create", ...input }),
      });
      const resData = await res.json().catch(() => null);
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Meeting not scheduled",
          description: resData?.message ?? "The meetings service rejected this meeting. Nothing was changed.",
        });
        return false;
      }
      toast({ title: "Meeting scheduled", description: resData?.message ?? "The meeting was scheduled." });
      await load();
      return true;
    } catch {
      toast({
        variant: "destructive",
        title: "Meeting not scheduled",
        description: "The meetings service is unreachable. Nothing was changed — retry when you're back online.",
      });
      return false;
    }
  };

  /** Phase 20 — push an already-recorded action item into My Tasks. */
  const doPromote = async (index: number) => {
    if (!selected) return;
    setPromotingIndex(index);
    try {
      const res = await fetch("/api/workspace/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Qubit-Role": role },
        body: JSON.stringify({ action: "promote-action", id: selected.id, index }),
      });
      const resData = await res.json().catch(() => null);
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Not added to My Tasks",
          description: resData?.message ?? "The meetings service rejected this promotion. Nothing was changed.",
        });
        return;
      }
      toast({ title: "Added to My Tasks", description: resData?.message ?? "The action item is now a task." });
      await load();
    } catch {
      toast({
        variant: "destructive",
        title: "Not added to My Tasks",
        description: "The meetings service is unreachable. Nothing was changed — retry when you're back online.",
      });
    } finally {
      setPromotingIndex(null);
    }
  };

  /** Phase 20 — record a minutes action item, optionally also creating a task. */
  const doAddAction = async () => {
    if (!selected) return;
    setRecording(true);
    try {
      const res = await fetch("/api/workspace/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Qubit-Role": role },
        body: JSON.stringify({ action: "add-action", id: selected.id, title: actionTitle, asTask }),
      });
      const resData = await res.json().catch(() => null);
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Action item not recorded",
          description: resData?.message ?? "The meetings service rejected this action item. Nothing was changed.",
        });
        return;
      }
      toast({ title: "Action item recorded", description: resData?.message ?? "The action item was recorded on the meeting." });
      setActionTitle("");
      setAsTask(false);
      await load();
    } catch {
      toast({
        variant: "destructive",
        title: "Action item not recorded",
        description: "The meetings service is unreachable. Nothing was changed — retry when you're back online.",
      });
    } finally {
      setRecording(false);
    }
  };

  const doCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/workspace/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Qubit-Role": role },
        body: JSON.stringify({ action: "cancel", id: cancelTarget.id, reason: cancelReason }),
      });
      const resData = await res.json().catch(() => null);
      if (!res.ok) {
        // No optimistic fake success — the server owns the lifecycle.
        toast({
          variant: "destructive",
          title: "Meeting not cancelled",
          description: resData?.message ?? "The meetings service rejected this cancellation. The meeting is unchanged.",
        });
        return;
      }
      toast({ title: "Meeting cancelled", description: resData?.message ?? "The meeting was cancelled." });
      setSelectedId(null);
      await load();
    } catch {
      toast({
        variant: "destructive",
        title: "Meeting not cancelled",
        description: "The meetings service is unreachable. Nothing was changed — retry when you're back online.",
      });
    } finally {
      setCancelling(false);
      setCancelTarget(null);
      setCancelReason("");
    }
  };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Workspace" }, { label: "Meetings" }]}
        title="My Meetings"
        description="Your meeting workspace — today's live sessions, what's ahead, and the record of what happened."
        actions={
          <>
            <Button className="h-9 gap-1.5" onClick={() => setCreateOpen(true)}>
              <CalendarPlus className="h-4 w-4" aria-hidden /> New meeting
            </Button>
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => nav.navigate("my-calendar")}>
              <CalendarClock className="h-4 w-4" aria-hidden /> Open calendar
            </Button>
          </>
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

      {loading ? (
        <MeetingsSkeleton />
      ) : (
        <>
          {/* Today strip */}
          {todays.length > 0 && (
            <SectionCard
              className="mb-4"
              title="Today"
              description={`${fmtDate(now)} · ${todays.length} meeting${todays.length === 1 ? "" : "s"}`}
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {todays.map((m) => (
                  <MeetingCard key={m.id} meeting={m} onOpen={() => setSelectedId(m.id)} compact />
                ))}
              </div>
            </SectionCard>
          )}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SegmentedToggle
              ariaLabel="Meeting buckets"
              value={bucket}
              onChange={setBucket}
              options={[
                { value: "today", label: `Today (${todays.length})` },
                { value: "upcoming", label: `Upcoming (${upcoming.length})` },
                { value: "past", label: `Past (${past.length})` },
              ]}
            />
          </div>

          {bucketList.length === 0 ? (
            <SectionCard>
              <EmptyState
                icon={<Video />}
                title={bucket === "past" ? "No past meetings in this range" : "Nothing scheduled here"}
                message={
                  bucket === "past"
                    ? "Completed meetings with notes and summaries will appear here."
                    : "Schedule from the calendar, or propose a time by mail."
                }
                action={
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => nav.navigate("compose-mail")}>
                    Propose a time by mail
                  </Button>
                }
              />
            </SectionCard>
          ) : (
            <div className="space-y-3">
              {bucketList.map((m) => (
                <MeetingCard key={m.id} meeting={m} onOpen={() => setSelectedId(m.id)} isOrganizer={isOrganizer(m)} onCancel={() => setCancelTarget(m)} role={role} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Detail drawer */}
      <DetailDrawer
        open={Boolean(selected)}
        onOpenChange={(o) => !o && setSelectedId(null)}
        wide
        title={selected?.title ?? ""}
        subtitle={
          selected
            ? `${fmtDate(selected.start)} · ${fmtTime(selected.start)}–${fmtTime(selected.end)} · ${selected.platform}`
            : undefined
        }
        icon={<Video />}
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} size="sm" />
              {selected.location && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="h-3 w-3" aria-hidden /> {selected.location}
                </span>
              )}
              {isOrganizer(selected) && <span className="rounded bg-blue-50 px-1.5 py-px text-[10px] font-semibold text-blue-700">You organize</span>}
            </div>

            {selected.agenda && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agenda</p>
                <p className="text-[13.5px] leading-relaxed text-slate-700">{selected.agenda}</p>
              </div>
            )}

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="h-3 w-3" aria-hidden /> Participants ({selected.participantIds.length})
              </p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {selected.participantIds.map((pid) => {
                  const emp = getEmployee(pid);
                  return (
                    <li key={pid}>
                      <button
                        type="button"
                        onClick={() => nav.navigate("employee-360", { employeeId: pid })}
                        className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-slate-200 hover:bg-slate-50"
                      >
                        <Avatar name={emp?.name ?? pid} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium text-slate-800">{emp?.name ?? pid}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{emp?.title}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {selected.notes && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <FileText className="h-3 w-3" aria-hidden /> Meeting notes
                </p>
                <p className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-3.5 py-3 text-[13px] leading-relaxed text-slate-700">{selected.notes}</p>
              </div>
            )}

            {selected.aiSummary && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-600">
                  <Sparkles className="h-3 w-3" aria-hidden /> AI summary
                </p>
                <div className="rounded-lg border border-violet-200/70 bg-violet-50/50 px-3.5 py-3">
                  <p className="text-[13px] leading-relaxed text-slate-700">{selected.aiSummary}</p>
                  <p className="mt-2 text-[10.5px] text-violet-700">
                    Generated from notes and recordings you are authorized to access. Summaries are never a substitute for the official minutes.
                  </p>
                </div>
              </div>
            )}

            {selected.actionItems?.length ? (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ListChecks className="h-3 w-3" aria-hidden /> Action items
                </p>
                <ul className="space-y-1.5">
                  {selected.actionItems.map((ai, idx) => {
                    const owner = getEmployee(ai.ownerId);
                    return (
                      <li key={`${idx}-${ai.title}`} className="flex flex-wrap items-center gap-2.5 rounded-lg border border-slate-200/80 bg-white px-3 py-2">
                        <span className="min-w-0 flex-1 text-[12.5px] font-medium text-slate-800">{ai.title}</span>
                        <span className="shrink-0 text-[11px] text-slate-500">{owner?.name}</span>
                        {ai.promoted ? (
                          <>
                            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-50 px-1.5 py-px text-[10px] font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" aria-hidden /> In My Tasks
                            </span>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-blue-600" onClick={() => nav.navigate("my-tasks")}>
                              View
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-blue-600"
                            disabled={promotingIndex !== null}
                            onClick={() => doPromote(idx)}
                          >
                            {promotingIndex === idx ? "Adding…" : "Add to My Tasks"}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {isOrganizer(selected) && selected.status === "Completed" && (
              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Record an action item</p>
                <div className="flex gap-2">
                  <Input
                    value={actionTitle}
                    onChange={(e) => setActionTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (actionTitle.trim().length >= 4 && !recording) doAddAction();
                      }
                    }}
                    placeholder="e.g. Send the recap to participants"
                    className="h-9"
                    aria-label="Action item title"
                  />
                  <Button size="sm" className="h-9 shrink-0" disabled={recording || actionTitle.trim().length < 4} onClick={doAddAction}>
                    {recording ? "Adding…" : "Add"}
                  </Button>
                </div>
                <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <Checkbox checked={asTask} onCheckedChange={(v) => setAsTask(v === true)} aria-label="Also create a task in My Tasks" />
                  Also create a task in My Tasks
                </label>
              </div>
            )}

            {(selected.status === "Scheduled" || selected.status === "In Progress") && (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Button
                size="sm"
                className="h-8 gap-1.5"
                onClick={() =>
                  toast({
                    title: selected.platform === "In person" ? "This meeting is in person" : `Joining via ${selected.platform}`,
                    description:
                      selected.platform === "In person"
                        ? `${selected.location} — the room calendar shows it as occupied.`
                        : "The meeting link opens in the enterprise meeting client.",
                  })
                }
              >
                <Video className="h-3.5 w-3.5" aria-hidden /> Join
              </Button>
              {isOrganizer(selected) && selected.status === "Scheduled" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => toast({ title: "Reschedule", description: "Propose new times to participants — replies land in your mail and notifications." })}
                  >
                    Reschedule
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-red-600 hover:text-red-700" onClick={() => setCancelTarget(selected)}>
                    Cancel meeting
                  </Button>
                </>
              )}
              {!isOrganizer(selected) && selected.status === "Scheduled" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => nav.navigate("compose-mail")}
                >
                  Message organizer
                </Button>
              )}
            </div>
            )}
          </div>
        )}
      </DetailDrawer>

      {/* Phase 20 — schedule a meeting with participants (server-notified) */}
      <NewMeetingDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDay={data?.now ?? Date.now()}
        onCreate={doCreate}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(o) => {
          if (!o) {
            setCancelTarget(null);
            setCancelReason("");
          }
        }}
        title="Cancel this meeting?"
        description={cancelTarget ? `"${cancelTarget.title}" will be removed from ${cancelTarget.participantIds.length} calendars and participants will be notified.` : ""}
        confirmLabel={cancelling ? "Cancelling…" : "Cancel meeting"}
        destructive
        onConfirm={doCancel}
      >
        <div className="space-y-1.5 py-2">
          <Label htmlFor="cancel-reason" className="text-xs font-medium text-slate-700">
            Reason <span className="text-red-500" aria-hidden>*</span>
          </Label>
          <Textarea
            id="cancel-reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Key stakeholder is unavailable — new times will be proposed by mail."
            className="min-h-20"
            autoFocus
          />
          {cancelReason.trim().length > 0 && cancelReason.trim().length < 4 && (
            <p className="text-[11px] text-red-600">Give a slightly longer reason (at least 4 characters).</p>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}

function MeetingsSkeleton() {
  return (
    <div>
      <div className="qubit-card mb-4 p-4" aria-hidden>
        <div className="h-4 w-44 animate-pulse rounded bg-slate-100" />
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mb-3 h-9 w-72 animate-pulse rounded-lg bg-slate-100" aria-hidden />
      <div className="space-y-3" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="qubit-card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">Loading meetings…</span>
    </div>
  );
}

function MeetingCard({
  meeting: m,
  onOpen,
  compact = false,
  isOrganizer = false,
  onCancel,
  role,
}: {
  meeting: Meeting;
  onOpen: () => void;
  compact?: boolean;
  isOrganizer?: boolean;
  onCancel?: () => void;
  role?: string;
}) {
  const { toast } = useToast();
  const organizer = getEmployee(m.organizerId);
  const live = m.status === "In Progress";

  return (
    <div className={cn("qubit-card qubit-card-hover p-4", live && "border-emerald-200")}>
      <div className="flex items-start gap-3">
        <span className={cn("qubit-icon-tile h-10 w-10 shrink-0", live ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-700")}>
          <Video />
        </span>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Open meeting: ${m.title}`}>
            <p className="truncate text-[14px] font-semibold text-slate-900">{m.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {fmtDate(m.start)} · {fmtTime(m.start)}–{fmtTime(m.end)}
              {!compact && ` · ${m.platform}`}
            </p>
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={m.status} size="sm" />
            {live && (
              <Button size="sm" className="h-7 gap-1.5 rounded-full px-3 text-xs" onClick={onOpen}>
                <span className="relative flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Join now
              </Button>
            )}
            {isOrganizer && !compact && <span className="rounded bg-blue-50 px-1.5 py-px text-[10px] font-semibold text-blue-700">Organizer</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <AvatarStack names={m.participantIds.map((id) => getEmployee(id)?.name ?? "")} max={compact ? 3 : 4} />
          {!compact && (
            <span className="text-[10.5px] text-slate-400">
              {role === "employee" ? "View only" : organizer?.name === "Sagar Singh" ? "" : `by ${organizer?.name?.split(" ")[0] ?? ""}`}
            </span>
          )}
        </div>
      </div>
      {!compact && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
          <p className="truncate text-[11.5px] text-muted-foreground">
            {m.location}
            {m.notes ? " · notes available" : ""}
            {m.aiSummary ? " · AI summary" : ""}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-blue-600" onClick={onOpen}>
              Open
            </Button>
            {isOrganizer && m.status === "Scheduled" && onCancel && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-600" onClick={onCancel} aria-label={`Cancel meeting: ${m.title}`}>
                <CalendarX2 className="h-3.5 w-3.5" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// New meeting dialog (Phase 20) — full creation with participants.
// Participants are checkbox-picked from the employee directory;
// the session user joins as organizer server-side (deduped) and
// every invitee is notified by the workspace store. Date/time are
// native inputs in the workspace clock's zone (IST), same
// convention as My Calendar's New-event dialog.
// ============================================================

function NewMeetingDialog({
  open,
  onOpenChange,
  defaultDay,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultDay: number;
  onCreate: (input: { title: string; agenda?: string; start: number; end: number; location?: string; platform: string; participantIds: string[] }) => Promise<boolean>;
}) {
  const [title, setTitle] = React.useState("");
  const [agenda, setAgenda] = React.useState("");
  const [date, setDate] = React.useState(istDateInput(defaultDay + DAY_MS));
  const [start, setStart] = React.useState("10:00");
  const [end, setEnd] = React.useState("11:00");
  const [location, setLocation] = React.useState("");
  const [platform, setPlatform] = React.useState<string>("Qubit Meet");
  const [participants, setParticipants] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setAgenda("");
      setDate(istDateInput(defaultDay + DAY_MS));
      setStart("10:00");
      setEnd("11:00");
      setLocation("");
      setPlatform("Qubit Meet");
      setParticipants(new Set());
      setError(null);
    }
  }, [open]);

  const toggleParticipant = (id: string) => {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (title.trim().length === 0) {
      setError("Give the meeting a title.");
      return;
    }
    if (!date) {
      setError("Pick a date for the meeting.");
      return;
    }
    const startTs = istEpoch(date, start);
    const endTs = istEpoch(date, end);
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
      setError("Pick a start and end time.");
      return;
    }
    if (endTs <= startTs) {
      setError("The end time must be after the start time.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const created = await onCreate({
      title: title.trim(),
      agenda: agenda.trim() || undefined,
      start: startTs,
      end: endTs,
      location: location.trim() || undefined,
      platform,
      participantIds: Array.from(participants),
    });
    setSubmitting(false);
    // The dialog closes only on a real server success — validation
    // errors keep the form (and the user's input) on screen.
    if (created) onOpenChange(false);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New meeting"
      description="Participants are notified immediately and the meeting lands on their My Meetings surface."
      submitLabel={submitting ? "Scheduling…" : "Schedule meeting"}
      onSubmit={submit}
      submitting={submitting}
      wide
    >
      <Field label="Title" required>
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          placeholder="e.g. Q3 pipeline review"
          autoFocus
          aria-invalid={Boolean(error)}
        />
      </Field>
      <Field label="Agenda">
        <Textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="What is this meeting for?" className="min-h-16" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Meeting date" />
        </Field>
        <Field label="Start (IST)">
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start time" />
        </Field>
        <Field label="End (IST)">
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="End time" />
        </Field>
      </div>
      {error && (
        <p role="alert" className="text-[11.5px] font-medium text-red-600">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Location">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room, floor or link" />
        </Field>
        <Field label="Platform">
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger aria-label="Platform">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEETING_PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Participants" hint="You join as the organizer automatically — everyone else is notified.">
        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200/80 qubit-scroll" role="group" aria-label="Participants">
          <ul className="divide-y divide-slate-100">
            {employees.map((emp) => (
              <li key={emp.id}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-slate-50">
                  <Checkbox checked={participants.has(emp.id)} onCheckedChange={() => toggleParticipant(emp.id)} aria-label={`Invite ${emp.name}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-slate-800">
                      {emp.name}
                      {emp.id === "sagar" && <span className="ml-1.5 text-[10.5px] font-normal text-muted-foreground">(you — organizer)</span>}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">{emp.title}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </Field>
    </FormDialog>
  );
}
