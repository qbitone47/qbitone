"use client";

import * as React from "react";
import { useQubitNav } from "../nav-context";
import { Avatar } from "../primitives";
import {
  MobileBadge,
  MobileCard,
  MobileEmpty,
  MobileErrorBanner,
  MobileFrame,
  MobileProfileChip,
  MobileSection,
  MobileSkeleton,
  MobileStat,
  MobileRow,
  QuickActionGrid,
  SourceNote,
  useMobileSection,
} from "../mobile/parts";

// ============================================================
// Screen 285 · Mobile Home — the Qubit One mobile command center.
// Content is composed server-side from the Workspace, Approvals,
// Mail and Notification systems, scoped to the caller's role; the
// screen renders what the server returns and nothing else.
// ============================================================

interface HomePayload {
  asOf: { label: string; timezone: string };
  identity: { id: string; name: string; title: string; department: string; location: string; employeeId: string; role: string };
  greeting: string;
  offline: { implemented: boolean; message: string; detail: string };
  counts: { tasksOpen: number; tasksOverdue: number; tasksDueToday: number; meetingsToday: number; approvalsPending: number; notificationsUnread: number; mailUnread: number };
  tasks: { overdue: { id: string; title: string; dueLabel: string | null }[]; dueToday: { id: string; title: string; dueLabel: string | null }[] };
  nextMeeting: { id: string; title: string; timeLabel: string; location: string; platform: string } | null;
  meetingsToday: { id: string; title: string; timeLabel: string; location: string }[];
  approvals: { id: string; title: string; kind: string; amount: number | null; sla: string }[];
  notifications: { id: string; title: string; body: string; category: string }[];
  importantMessages: { id: string; from: string; subject: string; preview: string }[];
  attendance: { state: string; record: { checkinAt: number; workedMin?: number } | null };
  quickActions: { id: string; label: string; screen?: string }[];
  businessModules: { id: string; label: string; screen: string; note?: string }[];
  recentActivity: { id: string; type: string; title: string; detail: string }[];
  sourceNote: string;
}

export function MobileHomeScreen() {
  const nav = useQubitNav();
  const { data, loading, error, reload } = useMobileSection<HomePayload>("home");
  const [dateLabel, setDateLabel] = React.useState("");

  React.useEffect(() => {
    if (data) setDateLabel(data.asOf.label);
  }, [data]);

  const quickRun = (screen?: string) => {
    if (screen) nav.navigate(screen as never);
  };

  return (
    <MobileFrame
      title="Qubit One"
      activeTab="home"
      offlineNote={data ? (data.offline.implemented ? undefined : `${data.offline.message} — ${data.offline.detail}`) : undefined}
    >
      {loading && <MobileSkeleton rows={4} />}
      {error && !loading && <MobileErrorBanner message={error} onRetry={reload} />}
      {data && !loading && (
        <>
          {/* Greeting + identity */}
          <section className="px-3 pt-4">
            <MobileCard className="bg-white">
              <div className="flex items-center gap-3">
                <Avatar name={data.identity.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-tight text-slate-900">
                    {data.greeting}, {data.identity.name.split(" ")[0]}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">
                    {data.identity.title} · {data.identity.department}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{dateLabel} · {data.asOf.timezone}</p>
                </div>
              </div>
            </MobileCard>
          </section>

          {/* Today at a glance */}
          <MobileSection title="Today">
            <div className="flex gap-2">
              <MobileStat label="Overdue" value={data.counts.tasksOverdue} tone={data.counts.tasksOverdue > 0 ? "red" : "slate"} onClick={() => nav.navigate("mobile-tasks")} />
              <MobileStat label="Due today" value={data.counts.tasksDueToday} onClick={() => nav.navigate("mobile-tasks")} />
              <MobileStat label="Meetings" value={data.counts.meetingsToday} onClick={() => nav.navigate("mobile-meetings")} />
            </div>
            <div className="flex gap-2">
              <MobileStat label="Approvals" value={data.counts.approvalsPending} tone={data.counts.approvalsPending > 0 ? "blue" : "slate"} onClick={() => nav.navigate("mobile-approvals")} />
              <MobileStat label="Unread" value={data.counts.notificationsUnread} onClick={() => nav.navigate("mobile-notifications")} />
              <MobileStat label="Mail" value={data.counts.mailUnread} onClick={() => nav.navigate("mobile-mail")} />
            </div>
          </MobileSection>

          {/* Quick actions (permission-aware, server-filtered) */}
          <MobileSection title="Quick actions">
            {data.quickActions.length ? (
              <QuickActionGrid actions={data.quickActions.map((a) => ({ id: a.id, label: a.label, run: () => quickRun(a.screen) }))} />
            ) : (
              <MobileEmpty title="No quick actions for this role" />
            )}
          </MobileSection>

          {/* Meetings */}
          <MobileSection title="Meetings today" action={<button type="button" className="min-h-[44px] text-[12px] font-medium text-blue-700" onClick={() => nav.navigate("mobile-meetings")}>All</button>}>
            {data.meetingsToday.length ? (
              data.meetingsToday.map((m) => (
                <MobileRow
                  key={m.id}
                  title={m.title}
                  detail={`${m.timeLabel} · ${m.location}`}
                  meta={data.nextMeeting?.id === m.id ? "Next up" : undefined}
                  onClick={() => nav.navigate("mobile-meetings", { meetingId: m.id })}
                />
              ))
            ) : (
              <MobileEmpty title="No meetings today" detail="Your calendar is clear." />
            )}
          </MobileSection>

          {/* Tasks */}
          <MobileSection title="My tasks" action={<button type="button" className="min-h-[44px] text-[12px] font-medium text-blue-700" onClick={() => nav.navigate("mobile-tasks")}>Open</button>}>
            {data.tasks.overdue.length === 0 && data.tasks.dueToday.length === 0 ? (
              <MobileEmpty title="Nothing overdue or due today" />
            ) : (
              <>
                {data.tasks.overdue.map((t) => (
                  <MobileRow
                    key={t.id}
                    title={t.title}
                    detail={`Was due ${t.dueLabel ?? "earlier"}`}
                    trailing={<MobileBadge tone="red">Overdue</MobileBadge>}
                    onClick={() => nav.navigate("mobile-tasks", { taskId: t.id })}
                  />
                ))}
                {data.tasks.dueToday.map((t) => (
                  <MobileRow key={t.id} title={t.title} detail={`Due ${t.dueLabel ?? "today"}`} onClick={() => nav.navigate("mobile-tasks", { taskId: t.id })} />
                ))}
              </>
            )}
          </MobileSection>

          {/* Approvals */}
          <MobileSection title="Approvals" action={<button type="button" className="min-h-[44px] text-[12px] font-medium text-blue-700" onClick={() => nav.navigate("mobile-approvals")}>Queue</button>}>
            {data.approvals.length ? (
              data.approvals.map((a) => (
                <MobileRow
                  key={a.id}
                  title={a.title}
                  detail={`${a.kind}${a.amount !== null ? ` · ₹${a.amount.toLocaleString("en-IN")}` : ""}`}
                  meta={`SLA ${a.sla}`}
                  onClick={() => nav.navigate("mobile-approvals", { approvalId: a.id })}
                />
              ))
            ) : (
              <MobileEmpty title="No approvals waiting on you" />
            )}
          </MobileSection>

          {/* Notifications */}
          <MobileSection title="Notifications">
            {data.notifications.length ? (
              data.notifications.map((n) => (
                <MobileRow
                  key={n.id}
                  title={n.title}
                  detail={n.body}
                  meta={n.category}
                  trailing={<span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
                  onClick={() => nav.navigate("mobile-notifications")}
                />
              ))
            ) : (
              <MobileEmpty title="You're all caught up" />
            )}
          </MobileSection>

          {/* Important messages */}
          <MobileSection title="Important messages" action={<button type="button" className="min-h-[44px] text-[12px] font-medium text-blue-700" onClick={() => nav.navigate("mobile-mail")}>Mail</button>}>
            {data.importantMessages.length ? (
              data.importantMessages.map((m) => (
                <MobileRow key={m.id} title={m.subject} detail={`${m.from} — ${m.preview}`} onClick={() => nav.navigate("mobile-mail", { mailId: m.id })} />
              ))
            ) : (
              <MobileEmpty title="Inbox zero on unread mail" />
            )}
          </MobileSection>

          {/* Attendance */}
          <MobileSection title="Attendance">
            <MobileRow
              title={data.attendance.state}
              detail={data.attendance.record ? (data.attendance.record.workedMin !== undefined ? `${data.attendance.record.workedMin} min recorded today` : "Checked in — working") : "No check-in yet today"}
              trailing={<MobileBadge tone={data.attendance.state === "Working" ? "green" : "slate"}>{data.attendance.state}</MobileBadge>}
              onClick={() => nav.navigate("mobile-attendance")}
            />
          </MobileSection>

          {/* Role-specific business modules (permission-aware) */}
          <MobileSection title="Business">
            {data.businessModules.length ? (
              data.businessModules.map((m) => (
                <MobileRow
                  key={m.id}
                  title={m.label}
                  detail={m.note ?? "Opens the module's mobile workspace"}
                  onClick={() => nav.navigate(m.screen as never)}
                />
              ))
            ) : (
              <MobileEmpty title="No business modules for this role" />
            )}
          </MobileSection>

          {/* Recent activity */}
          <MobileSection title="Recent activity" action={<button type="button" className="min-h-[44px] text-[12px] font-medium text-blue-700" onClick={() => nav.navigate("my-activity")}>Full timeline</button>}>
            {data.recentActivity.map((a) => (
              <MobileRow key={a.id} title={a.title} detail={a.detail} meta={a.type} />
            ))}
          </MobileSection>

          <SourceNote>{data.sourceNote}</SourceNote>
          <p className="px-3 pb-2 text-[10px] text-slate-300">Mobile Home</p>
        </>
      )}
    </MobileFrame>
  );
}
