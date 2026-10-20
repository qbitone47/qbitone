"use client";

import * as React from "react";
import { LogIn, LogOut } from "lucide-react";
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
  SourceNote,
  mobilePost,
  useMobileSection,
} from "../mobile/parts";

// ============================================================
// Screen 293 · Mobile Attendance — check in / out on the
// enterprise attendance record. Device/location verification is
// NOT configured and the screen says so plainly (spec §14); leave
// info comes from the enterprise calendar; corrections run through
// the HR workflow on desktop — mobile never silently edits punches.
// ============================================================

interface AttendancePayload {
  today: { id: string; day: string; checkinAt: number; checkoutAt: number | null; workedMin: number | null; state: string } | null;
  canCheckIn: boolean;
  canCheckOut: boolean;
  history: { id: string; day: string; checkinAt: number; checkoutAt: number | null; workedMin: number | null; method: string }[];
  myLeave: { id: string; title: string; start: number; end: number; related: string | null }[];
  teamLeave: { id: string; title: string; start: number; end: number }[];
  verification: { deviceVerification: boolean; locationVerification: boolean; note: string };
  leaveNote: string;
  sourceNote: string;
}

const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
const fmtDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
};

export function MobileAttendanceScreen() {
  const { role } = useRole();
  const { data, loading, error, reload } = useMobileSection<AttendancePayload>("attendance");
  const [busy, setBusy] = React.useState(false);

  const punch = async (kind: "checkin" | "checkout") => {
    setBusy(true);
    try {
      const res = await mobilePost<{ message: string }>(kind === "checkin" ? "attendance.checkin" : "attendance.checkout", {}, role);
      toast({ title: kind === "checkin" ? "Checked in" : "Checked out", description: res.message });
      reload();
    } catch (e) {
      toast({ title: "Could not record", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileFrame title="Attendance" activeTab="work">
      {loading && <MobileSkeleton rows={3} />}
      {error && !loading && <MobileErrorBanner message={error} onRetry={reload} />}
      {data && !loading && (
        <>
          {/* Punch card */}
          <MobileSection title="Today">
            <MobileCard className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Working status</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{data.today?.state ?? "Not checked in"}</p>
              {data.today ? (
                <p className="mt-1 text-[12.5px] text-slate-500">
                  In {fmtTime(data.today.checkinAt)}
                  {data.today.checkoutAt ? ` · Out ${fmtTime(data.today.checkoutAt)} · ${data.today.workedMin} min` : ""}
                </p>
              ) : (
                <p className="mt-1 text-[12.5px] text-slate-400">Your punch starts the attendance record for today.</p>
              )}
              <div className="mt-3 flex gap-2">
                {data.canCheckIn && (
                  <button type="button" disabled={busy} onClick={() => punch("checkin")}
                    className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[14px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
                    <LogIn className="h-4 w-4" aria-hidden /> Check in
                  </button>
                )}
                {data.canCheckOut && (
                  <button type="button" disabled={busy} onClick={() => punch("checkout")}
                    className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-[14px] font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-40">
                    <LogOut className="h-4 w-4" aria-hidden /> Check out
                  </button>
                )}
                {data.today?.checkoutAt && <MobileBadge tone="green">Day complete · {data.today.workedMin} min</MobileBadge>}
              </div>
            </MobileCard>
          </MobileSection>

          {/* Verification honesty (spec §14) */}
          <MobileSection title="Verification">
            <MobileCard className="border-amber-200 bg-amber-50">
              <div className="flex flex-wrap gap-1.5">
                <MobileBadge tone={data.verification.deviceVerification ? "green" : "amber"}>
                  Device verification: {data.verification.deviceVerification ? "On" : "Not configured"}
                </MobileBadge>
                <MobileBadge tone={data.verification.locationVerification ? "green" : "amber"}>
                  Location: {data.verification.locationVerification ? "On" : "Not configured"}
                </MobileBadge>
              </div>
              <p className="mt-2 text-[12px] leading-snug text-amber-800">{data.verification.note}</p>
            </MobileCard>
          </MobileSection>

          {/* History */}
          <MobileSection title="History">
            {data.history.length ? (
              data.history.map((h) => (
                <MobileRow
                  key={h.id}
                  title={fmtDay(h.day)}
                  detail={`${fmtTime(h.checkinAt)}${h.checkoutAt ? ` – ${fmtTime(h.checkoutAt)}` : " · open"} · ${h.method}`}
                  trailing={h.workedMin !== null ? <span className="text-[12px] font-semibold tabular-nums text-slate-700">{h.workedMin}m</span> : <MobileBadge tone="green">Working</MobileBadge>}
                />
              ))
            ) : (
              <MobileEmpty title="No attendance history yet" detail="Your first check-in creates the record." />
            )}
          </MobileSection>

          {/* Leave */}
          <MobileSection title="Leave">
            {data.myLeave.length ? (
              data.myLeave.map((l) => (
                <MobileRow key={l.id} title={l.title} detail={l.related ?? "Approved leave"} />
              ))
            ) : (
              <MobileEmpty title="No active leave on record for you" />
            )}
            {data.teamLeave.length > 0 && (
              <>
                <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Team leave this week</p>
                {data.teamLeave.map((l) => (
                  <MobileRow key={l.id} title={l.title} detail={`${new Date(l.start).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – ${new Date(l.end).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`} />
                ))}
              </>
            )}
          </MobileSection>

          <SourceNote>{data.leaveNote} {data.sourceNote}</SourceNote>
          <p className="px-3 pb-2 text-[10px] text-slate-300">Screen 293 · Mobile Attendance</p>
        </>
      )}
    </MobileFrame>
  );
}
