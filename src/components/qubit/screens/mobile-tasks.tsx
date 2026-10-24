"use client";

import * as React from "react";
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
// Screen 290 · Mobile Tasks — My Tasks on the ONE workspace task
// store (assignee-scoped server-side). Status transitions are
// enforced by the task system's transition matrix; comments are
// appended to the same task; reassignment/priority stay on desktop
// and the screen says so honestly (spec §11).
// ============================================================

interface TaskBrief {
  id: string; title: string; detail: string | null; status: string; priority: string;
  due: number | null; dueLabel: string | null; source: string; assigner: string;
}
interface ListPayload {
  overdue: TaskBrief[]; today: TaskBrief[]; upcoming: TaskBrief[]; someday: TaskBrief[]; completed: TaskBrief[];
  counts: { overdue: number; today: number; upcoming: number; completed: number };
  asOfDay: string; sourceNote: string;
}
interface DetailPayload {
  task: TaskBrief;
  allowedTransitions: string[];
  comments: { at: number; by: string; text: string }[];
  actionNote: string;
  attachmentNote: string;
}

export function MobileTasksScreen() {
  const nav = useQubitNav();
  const { params } = nav;
  const { role } = useRole();
  const taskId = params.taskId ?? "";
  const [tab, setTab] = React.useState("Today");
  const list = useMobileSection<ListPayload>("tasks");
  const detail = useMobileSection<DetailPayload>("tasks", { id: taskId });
  const [busy, setBusy] = React.useState(false);
  const [comment, setComment] = React.useState("");

  const setStatus = async (status: string) => {
    setBusy(true);
    try {
      const res = await mobilePost<{ message: string }>("task.status", { id: taskId, status }, role);
      toast({ title: "Task updated", description: res.message });
      detail.reload();
    } catch (e) {
      toast({ title: "Could not update task", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const addComment = async () => {
    if (comment.trim().length < 2) return;
    setBusy(true);
    try {
      await mobilePost("task.comment", { id: taskId, text: comment }, role);
      toast({ title: "Comment added" });
      setComment("");
      detail.reload();
    } catch (e) {
      toast({ title: "Could not comment", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const group = (items: TaskBrief[], emptyTitle: string) =>
    items.length ? (
      items.map((t) => (
        <MobileRow
          key={t.id}
          title={t.title}
          detail={`${t.status}${t.dueLabel ? ` · ${t.dueLabel}` : " · no due date"}${t.assigner ? ` · by ${t.assigner}` : ""}`}
          trailing={
            <div className="flex flex-col items-end gap-1">
              <MobileBadge tone={t.priority === "High" ? "red" : t.priority === "Medium" ? "amber" : "slate"}>{t.priority}</MobileBadge>
              {t.status === "Completed" && <MobileBadge tone="green">Done</MobileBadge>}
            </div>
          }
          onClick={() => nav.navigate("mobile-tasks", { taskId: t.id })}
        />
      ))
    ) : (
      <MobileEmpty title={emptyTitle} />
    );

  return (
    <MobileFrame
      title={taskId ? detail.data?.task.title ?? "Task" : "My Tasks"}
      activeTab="work"
      onBack={taskId ? () => nav.navigate("mobile-tasks") : undefined}
    >
      {taskId ? (
        <>
          {detail.loading && <MobileSkeleton rows={2} />}
          {detail.error && !detail.loading && <MobileErrorBanner message={detail.error} onRetry={detail.reload} />}
          {detail.data && !detail.loading && (
            <>
              <MobileSection title="Task">
                <MobileCard>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[14px] font-semibold leading-snug text-slate-900">{detail.data.task.title}</p>
                    <MobileBadge tone={detail.data.task.priority === "High" ? "red" : "slate"}>{detail.data.task.priority}</MobileBadge>
                  </div>
                  {detail.data.task.detail && <p className="mt-1.5 text-[12.5px] leading-snug text-slate-600">{detail.data.task.detail}</p>}
                  <p className="mt-2 text-[11.5px] text-slate-400">
                    {detail.data.task.status} · {detail.data.task.dueLabel ?? "no due date"} · source {detail.data.task.source}
                  </p>
                </MobileCard>
              </MobileSection>

              <MobileSection title="Actions">
                {detail.data.allowedTransitions.length ? (
                  <div className="grid grid-cols-2 gap-2">
                    {detail.data.allowedTransitions.map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={busy}
                        onClick={() => setStatus(st)}
                        className={cnBtn(st === "Completed")}
                      >
                        {st === "Completed" ? "Mark complete" : `Move to ${st}`}
                      </button>
                    ))}
                  </div>
                ) : (
                  <MobileEmpty title="No transitions available" detail="This task is in a final state." />
                )}
              </MobileSection>

              <MobileSection title="Comments">
                {detail.data.comments.length ? (
                  detail.data.comments.map((c, i) => (
                    <MobileCard key={i}>
                      <p className="text-[12.5px] leading-snug text-slate-700">{c.text}</p>
                      <p className="mt-1 text-[10.5px] text-slate-400">{c.by}</p>
                    </MobileCard>
                  ))
                ) : (
                  <MobileEmpty title="No comments yet" />
                )}
                <MobileCard>
                  <label htmlFor="task-comment" className="text-[12px] font-medium text-slate-600">Add comment</label>
                  <textarea id="task-comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 p-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-600" />
                  <button type="button" disabled={busy || comment.trim().length < 2} onClick={addComment}
                    className="mt-2 min-h-[44px] w-full rounded-lg bg-blue-600 text-[13px] font-semibold text-white disabled:opacity-40">
                    Add comment
                  </button>
                </MobileCard>
              </MobileSection>

              <SourceNote>{detail.data.actionNote} {detail.data.attachmentNote}</SourceNote>
              <p className="px-3 pb-2 text-[10px] text-slate-300">Mobile Tasks</p>
            </>
          )}
        </>
      ) : (
        <>
          {list.loading && <MobileSkeleton rows={3} />}
          {list.error && !list.loading && <MobileErrorBanner message={list.error} onRetry={list.reload} />}
          {list.data && !list.loading && (
            <>
              <FilterChips options={["Today", "Overdue", "Upcoming", "Someday", "Completed"]} value={tab} onChange={setTab} />
              {tab === "Overdue" && (
                <MobileSection title={`Overdue (${list.data.counts.overdue})`}>
                  {group(list.data.overdue, "Nothing overdue — well held.")}
                </MobileSection>
              )}
              {tab === "Today" && (
                <MobileSection title={`Due today (${list.data.counts.today})`}>
                  {group(list.data.today, "Nothing due today.")}
                </MobileSection>
              )}
              {tab === "Upcoming" && (
                <MobileSection title="Upcoming">
                  {group(list.data.upcoming, "No dated work ahead.")}
                </MobileSection>
              )}
              {tab === "Someday" && (
                <MobileSection title="No due date">
                  {group(list.data.someday, "Nothing parked without a date.")}
                </MobileSection>
              )}
              {tab === "Completed" && (
                <MobileSection title={`Completed (${list.data.counts.completed})`}>
                  {group(list.data.completed, "Nothing completed yet.")}
                </MobileSection>
              )}
              <SourceNote>{list.data.sourceNote}</SourceNote>
              <p className="px-3 pb-2 text-[10px] text-slate-300">Mobile Tasks</p>
            </>
          )}
        </>
      )}
    </MobileFrame>
  );
}

function cnBtn(primary: boolean) {
  return primary
    ? "min-h-[48px] rounded-xl bg-blue-600 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
    : "min-h-[48px] rounded-xl border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:border-blue-300 disabled:opacity-40";
}
