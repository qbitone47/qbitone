"use client";

import * as React from "react";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CalendarDays,
  Check,
  ClipboardCheck,
  FileUp,
  Plus,
  RefreshCw,
  Send,
  ShieldQuestion,
  Sparkles,
  TriangleAlert,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateTaskDialog } from "../workspace/create-task-dialog";
import { getEmployee } from "@/lib/qubit/data";
import {
  ACTIVITY,
  fmtDate,
  fmtTime,
  MEETINGS,
  NOTIFICATIONS,
  pendingApprovals,
  relTime,
  TASKS,
  WORKSPACE_NOW,
  WORKSPACE_NOW_LABEL,
  type ApprovalRequest,
} from "@/lib/qubit/workspace-data";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { ActivityTypeIcon, AvatarStack, CategoryIcon, DueBadge, Timeline, TimelineItem } from "../workspace/parts";
import { EmptyState, SectionCard, StatTile, StatusBadge } from "../primitives";
import { FormDialog } from "../dialogs";
import { apiGet, apiPost, ApiError } from "@/lib/qubit/api";

// ============================================================
// Screen 41 · Employee Home
// "What do I need to know / do / follow up?" — personalized,
// prioritized, progressive disclosure. Not a giant dashboard.
// ============================================================

export function EmployeeHomeScreen() {
  const nav = useQubitNav();
  const { role } = useRole();

  // Server-backed: the approval queue is the one thing that must
  // always come from the enforcement layer, never from a fixture.
  const [approvals, setApprovals] = React.useState<ApprovalRequest[] | null>(null);
  const [approvalsNote, setApprovalsNote] = React.useState<string | null>(null);
  const [approvalsError, setApprovalsError] = React.useState<string | null>(null);
  const [loadingApprovals, setLoadingApprovals] = React.useState(true);
  const [aiSummary, setAiSummary] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  const loadApprovals = React.useCallback(async () => {
    setLoadingApprovals(true);
    setApprovalsError(null);
    try {
      const data = await apiGet<{ queue: ApprovalRequest[]; history?: ApprovalRequest[]; note: string | null }>("/approvals", undefined, role, "/api/workspace");
      setApprovals(data.queue);
      setApprovalsNote(data.note);
    } catch (err) {
      setApprovalsError(err instanceof ApiError ? err.message : "The approvals service is unreachable right now.");
    } finally {
      setLoadingApprovals(false);
    }
  }, [role]);

  React.useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const myTasks = TASKS.filter((t) => t.assigneeId === "sagar");
  const overdue = myTasks.filter((t) => t.due && t.due < WORKSPACE_NOW && t.status !== "Completed" && t.status !== "Cancelled");
  const openTasks = myTasks.filter((t) => t.status !== "Completed" && t.status !== "Cancelled");
  const todaysMeetings = MEETINGS.filter(
    (m) => new Date(m.start).toDateString() === new Date(WORKSPACE_NOW).toDateString(),
  ).sort((a, b) => a.start - b.start);
  const unread = NOTIFICATIONS.filter((n) => n.unread);
  const pending = approvals ?? [];

  const greeting = WORKSPACE_NOW < Date.parse("2026-11-13T12:00:00+05:30") ? "Good morning" : "Good afternoon";

  const quickActions = [
    { label: "Create task", icon: Plus, onClick: () => setCreateOpen(true) },
    { label: "Schedule meeting", icon: Video, onClick: () => nav.navigate("my-meetings") },
    { label: "Request leave", icon: CalendarDays, onClick: () => nav.navigate("my-approvals") },
    { label: "Upload document", icon: FileUp, onClick: () => nav.navigate("my-documents") },
    { label: "Request access", icon: ShieldQuestion, onClick: () => nav.navigate("role-access-request") },
    { label: "Send mail", icon: Send, onClick: () => nav.navigate("compose-mail") },
  ];

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Workspace" }, { label: "My day" }]}
        title={`${greeting}, Sagar`}
        description={`${WORKSPACE_NOW_LABEL} · 09:42 IST. Here is what needs you today — prioritized across tasks, meetings, approvals and messages.`}
        actions={
          <Button
            variant={aiSummary ? "secondary" : "outline"}
            className="h-9 gap-1.5"
            aria-expanded={aiSummary}
            onClick={() => setAiSummary((v) => !v)}
          >
            <Sparkles className="h-4 w-4 text-violet-500" aria-hidden />
            {aiSummary ? "Hide summary" : "Summarize my day"}
          </Button>
        }
      />

      {/* AI day summary — a quiet contextual entry point (spec §7),
          computed only from data this session is authorized to see. */}
      {aiSummary && (
        <SectionCard
          className="mb-4 border-violet-200/70"
          title={
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" aria-hidden />
              Your day, summarized
            </span>
          }
          description="Qubit AI · generated from your tasks, meetings and approvals. It sees only what you are authorized to see."
          actions={
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10.5px] font-medium text-violet-700">
              Permission-aware
            </span>
          }
        >
          <div className="space-y-2 text-[13px] leading-relaxed text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">3 things need you first:</span> the Acme Corp discount decision (Monday client call),{" "}
              {overdue.length > 0 && (
                <>
                  {overdue.length} overdue task{overdue.length === 1 ? "" : "s"} starting with the Zenith escalation review, and{" "}
                </>
              )}
              the Brightline contract signature before 17 Nov.
            </p>
            <p>
              <span className="font-semibold text-slate-900">Your day:</span> leadership standup (in progress) → preparation window before the 11:30 Acme
              alignment → 1:1 with Neha at 15:00. Board prep with Finance moves to tomorrow 11:00.
            </p>
            <p>
              <span className="font-semibold text-slate-900">Watching quietly:</span> the Q4 board deck is on track; two GST compliance items escalate to
              Finance on 24 Nov if unresolved. Nothing else needs your attention today.
            </p>
          </div>
        </SectionCard>
      )}

      {/* Today's priorities */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<TriangleAlert />}
          value={overdue.length}
          label={overdue.length === 1 ? "Overdue task" : "Overdue tasks"}
          onClick={() => nav.navigate("my-tasks", { filter: "overdue" })}
        />
        <StatTile
          icon={<ClipboardCheck />}
          value={loadingApprovals ? "…" : pending.length}
          label="Pending approvals"
          onClick={() => nav.navigate("my-approvals")}
        />
        <StatTile
          icon={<CalendarClock />}
          value={todaysMeetings.length}
          label="Meetings today"
          onClick={() => nav.navigate("my-meetings")}
        />
        <StatTile icon={<Bell />} value={unread.length} label="Unread notifications" onClick={() => nav.navigate("my-notifications")} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Left column: tasks + approvals */}
        <div className="space-y-4 lg:col-span-2">
          <SectionCard
            title="My tasks"
            description={`${openTasks.length} open · ${overdue.length} overdue`}
            actions={<ArrowLink onClick={() => nav.navigate("my-tasks")}>Open My Tasks</ArrowLink>}
          >
            <ul className="divide-y">
              {openTasks
                .slice()
                .sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity))
                .slice(0, 5)
                .map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      aria-label={`Open task: ${t.title}`}
                      onClick={() => nav.navigate("my-tasks", { taskId: t.id })}
                      className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
                    >
                      <span className="w-full truncate text-[13px] font-medium text-slate-800">{t.title}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <DueBadge due={t.due} completed={t.status === "Completed"} />
                        {t.status !== "Completed" && t.status !== "Cancelled" && <StatusBadge status={t.status} size="sm" />}
                      </span>
                    </button>
                    {t.aiGenerated && (
                      <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700" title="Suggested by Qubit AI">
                        AI
                      </span>
                    )}
                    <StatusBadge status={t.priority} size="sm" />
                  </li>
                ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Pending approvals"
            description="Routed to you by the Approval Matrix — decisions are permission-checked and audited server-side."
            actions={<ArrowLink onClick={() => nav.navigate("my-approvals")}>Open My Approvals</ArrowLink>}
          >
            {loadingApprovals ? (
              <ApprovalSkeleton />
            ) : approvalsError ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center" role="alert">
                <p className="text-sm font-medium text-red-700">{approvalsError}</p>
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={loadApprovals}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
                </Button>
              </div>
            ) : pending.length === 0 ? (
              <EmptyState
                icon={<ClipboardCheck />}
                title="Your approval queue is clear"
                message={approvalsNote ?? "Nothing is waiting on your decision."}
              />
            ) : (
              <ul className="divide-y">
                {pending.slice(0, 4).map((a) => {
                  const requester = getEmployee(a.requesterId);
                  const ageDays = Math.floor((WORKSPACE_NOW - a.submitted) / 86_400_000);
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <button
                        type="button"
                        aria-label={`Open approval: ${a.title}`}
                        onClick={() => nav.navigate("my-approvals", { approvalId: a.id })}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-medium text-slate-800">{a.title}</span>
                          {a.stepUpRequired && (
                            <span className="shrink-0 rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
                              Step-up required
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {requester?.name ?? "External"} · {a.kind}
                          {a.amount ? ` · ₹${a.amount.toLocaleString("en-IN")}` : ""}
                          {ageDays >= 3 && <span className="font-medium text-amber-700">· waiting {ageDays} days</span>}
                        </span>
                      </button>
                      <StatusBadge status={a.priority} size="sm" />
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Right column: meetings, notifications, activity */}
        <div className="space-y-4">
          <SectionCard
            title="Upcoming meetings"
            description="Today and next"
            actions={<ArrowLink onClick={() => nav.navigate("my-meetings")}>All</ArrowLink>}
          >
            <ul className="space-y-2.5">
              {[...todaysMeetings.filter((m) => m.status !== "Completed"), ...MEETINGS.filter((m) => m.start > WORKSPACE_NOW)]
                .slice(0, 3)
                .map((m, i) => (
                  <li key={`${m.id}-${i}`}>
                    <button
                      type="button"
                      aria-label={`Open meeting: ${m.title}`}
                      onClick={() => nav.navigate("my-meetings", { meetingId: m.id })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 text-left transition-all duration-150 hover:border-blue-200 hover:bg-blue-50/30"
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                          <CalendarClock className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-slate-800">{m.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {fmtTime(m.start)}–{fmtTime(m.end)} · {m.platform}
                            {m.status === "In Progress" && <span className="ml-1.5 font-semibold text-emerald-600">· Live now</span>}
                          </span>
                        </span>
                      </span>
                      <span className="mt-2 flex items-center gap-2 pl-10">
                        <AvatarStack names={m.participantIds.map((id) => getEmployee(id)?.name ?? "")} max={4} />
                        <span className="text-[11px] text-slate-400">{m.participantIds.length} participants</span>
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Important notifications"
            description={`${unread.length} unread`}
            actions={<ArrowLink onClick={() => nav.navigate("my-notifications")}>Open center</ArrowLink>}
          >
            <ul className="divide-y">
              {NOTIFICATIONS.filter((n) => n.unread)
                .slice(0, 3)
                .map((n) => (
                  <li key={n.id} className="flex gap-2.5 py-2.5 first:pt-0 last:pb-0">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <CategoryIcon category={n.category} />
                    </span>
                    <button
                      type="button"
                      aria-label={`Open notification: ${n.title}`}
                      onClick={() => n.link && nav.navigate(n.link.screen, n.link.params)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-[12.5px] font-medium text-slate-800">{n.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {n.category} · {relTime(n.ts)}
                      </span>
                    </button>
                    {!n.unread && <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />}
                  </li>
                ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Recent activity"
            description="Your personal timeline"
            actions={<ArrowLink onClick={() => nav.navigate("my-activity")}>All activity</ArrowLink>}
          >
            <Timeline>
              {ACTIVITY.slice(0, 3).map((a) => (
                <TimelineItem
                  key={a.id}
                  icon={<ActivityTypeIcon type={a.type} className={a.security ? "text-blue-600" : undefined} />}
                  title={a.title}
                  time={relTime(a.ts)}
                  accent={a.security}
                />
              ))}
            </Timeline>
          </SectionCard>
        </div>
      </div>

      {/* Quick actions — only actions this identity is authorized to perform */}
      <SectionCard title="Quick actions" description="Everyday actions from your desk — authorized per your role." className="mt-4">
        <div className="flex flex-wrap gap-2">
          {quickActions.map((qa) => (
            <Button key={qa.label} variant="outline" className="h-9 gap-1.5" onClick={qa.onClick}>
              <qa.icon className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              {qa.label}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          Role boundary: <span className="font-medium text-slate-600">{role}</span> · actions are re-validated server-side when invoked.
        </p>
      </SectionCard>

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function ApprovalSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-9 flex-1 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-6 w-14 animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
      <span className="sr-only" role="status">Loading approvals…</span>
    </div>
  );
}

function ArrowLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group/link inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700">
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/link:translate-x-0.5" aria-hidden />
    </button>
  );
}
