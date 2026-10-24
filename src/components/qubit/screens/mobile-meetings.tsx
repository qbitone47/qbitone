"use client";

import * as React from "react";
import { MapPin, Video } from "lucide-react";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  MobileBadge,
  MobileCard,
  MobileEmpty,
  MobileErrorBanner,
  MobileFrame,
  MobileSection,
  MobileSkeleton,
  MobileRow,
  FilterChips,
  SourceNote,
  mobilePost,
  useMobileSection,
} from "../mobile/parts";

// ============================================================
// Screen 289 · Mobile Meetings — today, upcoming and the record of
// what happened, from the ONE enterprise Meetings module. Notes and
// action items recorded from mobile are appended to the same
// meeting store; Join is an audited handoff to the meeting
// platform (never a simulated call).
// ============================================================

interface Brief {
  id: string; title: string; timeLabel: string; location: string; platform: string; status: string;
  organizer: string; participants: string[]; agenda: string | null; participantCount: number; start: number; end: number;
}
interface ListPayload {
  today: Brief[]; upcoming: Brief[];
  past: (Brief & { notes: string | null; aiSummary: string | null })[];
  asOfDay: string; sourceNote: string;
}
interface DetailPayload {
  meeting: Brief & {
    notes: { at: number; by: string; text: string }[];
    actionItems: { title: string; owner: string; due: number | null; at: number | null }[];
    aiSummary: string | null; joinAvailable: boolean; joinPlatform: string; joinNote: string;
  };
  sourceNote: string;
}

export function MobileMeetingsScreen() {
  const nav = useQubitNav();
  const { params } = nav;
  const { role } = useRole();
  const meetingId = params.meetingId ?? "";
  const [tab, setTab] = React.useState("Today");
  const list = useMobileSection<ListPayload>("meetings");
  const detail = useMobileSection<DetailPayload>("meetings", { id: meetingId });
  const [busy, setBusy] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [noteText, setNoteText] = React.useState("");
  const [actionOpen, setActionOpen] = React.useState(false);
  const [actionText, setActionText] = React.useState("");

  const act = async (fn: () => Promise<{ message?: string }>, done: string) => {
    setBusy(true);
    try {
      const res = await fn();
      toast({ title: done, description: res.message });
      setNoteOpen(false);
      setActionOpen(false);
      setNoteText("");
      setActionText("");
      detail.reload();
    } catch (e) {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileFrame
      title={meetingId ? detail.data?.meeting.title ?? "Meeting" : "Meetings"}
      activeTab="home"
      onBack={meetingId ? () => nav.navigate("mobile-meetings") : undefined}
    >
      {meetingId ? (
        <>
          {detail.loading && <MobileSkeleton rows={3} />}
          {detail.error && !detail.loading && <MobileErrorBanner message={detail.error} onRetry={detail.reload} />}
          {detail.data && !detail.loading && (
            <>
              <MobileSection title="Details">
                <MobileCard>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13.5px] font-medium text-slate-900">{detail.data.meeting.timeLabel}</p>
                    <MobileBadge tone={detail.data.meeting.status === "In Progress" ? "green" : "blue"}>{detail.data.meeting.status}</MobileBadge>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-slate-500"><MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden />{detail.data.meeting.location}</p>
                  {detail.data.meeting.agenda && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-[12.5px] leading-snug text-slate-600">{detail.data.meeting.agenda}</p>}
                  <p className="mt-2 text-[11.5px] text-slate-400">Organizer: {detail.data.meeting.organizer} · {detail.data.meeting.participantCount} participants</p>
                </MobileCard>
              </MobileSection>

              {detail.data.meeting.joinAvailable && (
                <MobileSection title="Join">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(() => mobilePost("meeting.join", { id: detail.data!.meeting.id }, role), "Handoff recorded")}
                    className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-[14px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    <Video className="h-4 w-4" aria-hidden /> Join via {detail.data.meeting.joinPlatform}
                  </button>
                  <p className="px-1 text-[11px] leading-snug text-slate-400">{detail.data.meeting.joinNote}</p>
                </MobileSection>
              )}

              <MobileSection title="Notes">
                {detail.data.meeting.notes.length ? (
                  detail.data.meeting.notes.map((n, i) => (
                    <MobileCard key={i}>
                      <p className="text-[12.5px] leading-snug text-slate-700">{n.text}</p>
                      <p className="mt-1 text-[10.5px] text-slate-400">{n.by}</p>
                    </MobileCard>
                  ))
                ) : (
                  <MobileEmpty title="No notes yet" />
                )}
                {noteOpen ? (
                  <MobileCard>
                    <label htmlFor="mtg-note" className="text-[12px] font-medium text-slate-600">Add note</label>
                    <textarea id="mtg-note" rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 p-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-600" />
                    <button type="button" disabled={busy || noteText.trim().length < 2}
                      onClick={() => act(() => mobilePost("meeting.note", { id: detail.data!.meeting.id, text: noteText }, role), "Note recorded")}
                      className="mt-2 min-h-[44px] w-full rounded-lg bg-blue-600 text-[13px] font-semibold text-white disabled:opacity-40">
                      Save note
                    </button>
                  </MobileCard>
                ) : (
                  <button type="button" onClick={() => setNoteOpen(true)} className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:border-blue-300">
                    Add note
                  </button>
                )}
              </MobileSection>

              <MobileSection title="Action items">
                {detail.data.meeting.actionItems.length ? (
                  detail.data.meeting.actionItems.map((a, i) => (
                    <MobileRow key={i} title={a.title} detail={`Owner: ${a.owner}${a.due ? ` · due ${new Date(a.due).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : ""}`} />
                  ))
                ) : (
                  <MobileEmpty title="No action items yet" />
                )}
                {actionOpen ? (
                  <MobileCard>
                    <label htmlFor="mtg-action" className="text-[12px] font-medium text-slate-600">Action item</label>
                    <input id="mtg-action" value={actionText} onChange={(e) => setActionText(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 p-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-600"
                      placeholder="What needs to happen next?" />
                    <button type="button" disabled={busy || actionText.trim().length < 4}
                      onClick={() => act(() => mobilePost("meeting.actionitem", { id: detail.data!.meeting.id, title: actionText, ownerId: "sagar" }, role), "Action item recorded")}
                      className="mt-2 min-h-[44px] w-full rounded-lg bg-blue-600 text-[13px] font-semibold text-white disabled:opacity-40">
                      Record action item
                    </button>
                  </MobileCard>
                ) : (
                  <button type="button" onClick={() => setActionOpen(true)} className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:border-blue-300">
                    Add action item
                  </button>
                )}
                <p className="px-1 text-[11px] text-slate-400">Rescheduling runs in the full Meetings module — mobile keeps the record, desktop owns the calendar move.</p>
              </MobileSection>

              {detail.data.meeting.aiSummary && (
                <MobileSection title="AI summary">
                  <MobileCard className="border-blue-200 bg-blue-50/50">
                    <p className="text-[12.5px] leading-relaxed text-slate-700">{detail.data.meeting.aiSummary}</p>
                    <p className="mt-1.5 text-[10.5px] text-slate-400">Generated for the completed meeting — permission-aware.</p>
                  </MobileCard>
                </MobileSection>
              )}

              <SourceNote>{detail.data.sourceNote}</SourceNote>
              <p className="px-3 pb-2 text-[10px] text-slate-300">Mobile Meetings</p>
            </>
          )}
        </>
      ) : (
        <>
          {list.loading && <MobileSkeleton rows={3} />}
          {list.error && !list.loading && <MobileErrorBanner message={list.error} onRetry={list.reload} />}
          {list.data && !list.loading && (
            <>
              <FilterChips options={["Today", "Upcoming", "Past"]} value={tab} onChange={setTab} />
              {tab === "Today" && (
                <MobileSection title={`Today · ${list.data.asOfDay}`}>
                  {list.data.today.length ? (
                    list.data.today.map((m) => (
                      <MobileRow key={m.id} title={m.title} detail={`${m.timeLabel} · ${m.location}`} meta={m.status} onClick={() => nav.navigate("mobile-meetings", { meetingId: m.id })} />
                    ))
                  ) : (
                    <MobileEmpty title="No meetings today" detail="Enjoy the focus time." />
                  )}
                </MobileSection>
              )}
              {tab === "Upcoming" && (
                <MobileSection title="Upcoming">
                  {list.data.upcoming.length ? (
                    list.data.upcoming.map((m) => (
                      <MobileRow key={m.id} title={m.title} detail={`${m.timeLabel} · ${m.location}`} meta={`${m.platform} · ${m.organizer}`} onClick={() => nav.navigate("mobile-meetings", { meetingId: m.id })} />
                    ))
                  ) : (
                    <MobileEmpty title="Nothing scheduled ahead" />
                  )}
                </MobileSection>
              )}
              {tab === "Past" && (
                <MobileSection title="Past meetings">
                  {list.data.past.length ? (
                    list.data.past.map((m) => (
                      <MobileRow key={m.id} title={m.title} detail={m.aiSummary ?? m.notes ?? "Completed"} meta="Record available" onClick={() => nav.navigate("mobile-meetings", { meetingId: m.id })} />
                    ))
                  ) : (
                    <MobileEmpty title="No completed meetings on record" />
                  )}
                </MobileSection>
              )}
              <SourceNote>{list.data.sourceNote}</SourceNote>
              <p className="px-3 pb-2 text-[10px] text-slate-300">Mobile Meetings</p>
            </>
          )}
        </>
      )}
    </MobileFrame>
  );
}
