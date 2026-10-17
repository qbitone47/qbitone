"use client";

import * as React from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Lock,
  Mail,
  MapPin,
  Network,
  Phone,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { directReports, getEmployee, type Employee } from "@/lib/qubit/data";
import {
  ACTIVITY,
  DOCUMENTS,
  fmtDate,
  MEETINGS,
  relTime,
  TASKS,
  TEAM_TASKS,
  WORKSPACE_NOW,
} from "@/lib/qubit/workspace-data";
import { useQubitNav } from "../nav-context";
import { useRole, type ViewAsRole } from "../role-context";
import { PageHeader } from "../page-header";
import { Avatar, EmptyState, KV, SectionCard, StatTile, StatusBadge } from "../primitives";
import { AvatarStack, DueBadge, LockedFieldHint } from "../workspace/parts";

// ============================================================
// Screen 52 · Employee 360 — the connected employee overview.
// Access is scope-based (self / manager / HR / admin / public);
// sections the caller is not authorized to see are shown as
// locked with an explanation — never silently hidden, never
// exposed. The server enforces the same boundaries for APIs.
// ============================================================

type Scope = "self" | "admin" | "hr" | "manager" | "public";

const SCOPE_META: Record<Scope, { label: string; note: string; tone: string }> = {
  self: { label: "Your own overview", note: "You always see your own full record.", tone: "border-blue-200 bg-blue-50 text-blue-700" },
  admin: { label: "Platform administrator", note: "Administrative scope — every access is logged in the audit trail.", tone: "border-violet-200 bg-violet-50 text-violet-700" },
  hr: { label: "HR scope", note: "People-operations scope for this employee — employment and performance sections are visible to you.", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  manager: { label: "Manager scope", note: "You lead this colleague's department — work context is visible; HR-sensitive sections stay locked.", tone: "border-blue-200 bg-blue-50 text-blue-700" },
  public: { label: "Directory scope", note: "You can see identity, role and work contact. Work context and HR information are restricted by policy.", tone: "border-slate-200 bg-slate-50 text-slate-600" },
};

function accessScope(role: ViewAsRole, target: Employee): Scope {
  if (target.id === "sagar") return "self";
  if (role === "administrator") return "admin";
  if (role === "hr-manager") return "hr";
  if (role === "dept-head") return "manager";
  return "public";
}

export function Employee360Screen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { toast } = useToast();
  const params = nav.params as { employeeId?: string };

  const target = getEmployee(params.employeeId ?? "sagar") ?? getEmployee("sagar")!;
  const scope = accessScope(role, target);
  const meta = SCOPE_META[scope];
  const isSelf = scope === "self";
  const canSeeWork = scope !== "public";
  const canSeeHR = scope === "hr" || scope === "admin" || isSelf;

  const manager = getEmployee(target.managerId);
  const reports = directReports(target.id);
  const chain: Employee[] = [];
  {
    let cur = getEmployee(target.managerId);
    while (cur) {
      chain.push(cur);
      cur = getEmployee(cur.managerId);
    }
  }

  const tasks = [...TASKS, ...(target.id !== "sagar" ? tasksForEmployee(target.id) : [])].filter((t) => t.assigneeId === target.id);
  const meetings = MEETINGS.filter((m) => m.participantIds.includes(target.id)).sort((a, b) => b.start - a.start);
  const docs = DOCUMENTS.filter(
    (d) => d.ownerId === target.id && (d.sensitivity === "Public" || d.sensitivity === "Internal" || isSelf || scope === "hr" || scope === "admin"),
  );

  const openTasks = tasks.filter((t) => t.status !== "Completed" && t.status !== "Cancelled");
  const activity = target.id === "sagar" ? ACTIVITY.slice(0, 5) : deriveActivity(target);

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "People" }, { label: "Employee 360" }]}
        title={isSelf ? "Your overview" : target.name}
        description={
          isSelf
            ? "Everything connected to you — role, reporting, work, meetings and activity in one view."
            : `Connected overview for ${target.name}, assembled from sources your ${role} scope is authorized to see.`
        }
        actions={
          <>
            {!isSelf && (
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => nav.back()}>
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
              </Button>
            )}
            {isSelf && (
              <Button variant="outline" className="h-9 gap-1.5" onClick={() => nav.navigate("my-profile")}>
                Edit profile
              </Button>
            )}
          </>
        }
      />

      {/* Access scope banner */}
      <div className={cn("mb-4 flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5", meta.tone)} role="note">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
        <p className="text-xs">
          <span className="font-semibold">Access scope: {meta.label}.</span> {meta.note}
        </p>
      </div>

      {/* Identity header */}
      <section className="qubit-card mb-4 flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6" aria-label="Identity">
        <Avatar name={target.name} size="xl" className="h-20 w-20 rounded-2xl text-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{target.name}</h2>
            <StatusBadge status={target.status} size="sm" />
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{target.employeeId}</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{target.title} · {target.department}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" aria-hidden /> {target.location} · since {target.since}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => nav.navigate("compose-mail", { to: target.email })}>
            <Mail className="h-3.5 w-3.5" aria-hidden /> Email
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => {
              if (typeof window !== "undefined") window.location.href = `tel:${target.phone.replace(/\s/g, "")}`;
            }}
          >
            <Phone className="h-3.5 w-3.5" aria-hidden /> Call
          </Button>
          {target.id !== "sagar" && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => nav.navigate("organization-chart", { focusNodeId: target.id })}>
              <Network className="h-3.5 w-3.5" aria-hidden /> In org chart
            </Button>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Identity & role */}
          <SectionCard title="Identity & role" description="Public directory record — visible to every colleague.">
            <dl className="divide-y">
              <KV label="Employee ID"><span className="font-mono text-[13px]">{target.employeeId}</span> <LockedFieldHint /></KV>
              <KV label="Designation">{target.title} <LockedFieldHint /></KV>
              <KV label="Department">{target.department} <LockedFieldHint /></KV>
              <KV label="Employment status"><StatusBadge status={target.status} size="sm" /> <LockedFieldHint /></KV>
              <KV label="Work email">{target.email}</KV>
              <KV label="Work phone">{target.phone}</KV>
            </dl>
          </SectionCard>

          {/* Reporting */}
          <SectionCard title="Reporting" description="Position in the live organization structure.">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="font-medium text-slate-500">Reports to</span>
                {chain.length === 0 ? (
                  <span className="font-semibold text-slate-800">Board of Directors</span>
                ) : (
                  <span className="flex flex-wrap items-center gap-1.5">
                    {chain.map((c, i) => (
                      <React.Fragment key={c.id}>
                        {i > 0 && <span className="text-slate-300" aria-hidden>→</span>}
                        <button
                          type="button"
                          onClick={() => nav.navigate("employee-360", { employeeId: c.id })}
                          className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium text-blue-700 transition-colors hover:border-blue-200 hover:bg-blue-50"
                        >
                          {c.name}
                        </button>
                      </React.Fragment>
                    ))}
                  </span>
                )}
              </div>
              {reports.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Direct reports ({reports.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {reports.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => nav.navigate("employee-360", { employeeId: r.id })}
                        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50"
                      >
                        <Avatar name={r.name} size="xs" />
                        {r.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => nav.navigate("reporting-lines", { employeeId: target.id })}>
                <Building2 className="h-3.5 w-3.5" aria-hidden /> View in Reporting Lines
              </Button>
            </div>
          </SectionCard>

          {/* Work context — restricted for public scope */}
          <SectionCard
            title="Work context"
            description={canSeeWork ? "Current tasks and meetings this person is part of." : undefined}
          >
            {canSeeWork ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile icon={<ClipboardCheck />} value={openTasks.length} label="Open tasks" onClick={() => nav.navigate("my-tasks")} />
                <StatTile icon={<Video />} value={meetings.filter((m) => m.start > WORKSPACE_NOW).length} label="Upcoming meetings" onClick={() => nav.navigate("my-meetings")} />
                <StatTile icon={<FileText />} value={docs.length} label="Visible documents" onClick={() => nav.navigate("my-documents")} />
                <div className="sm:col-span-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent & upcoming meetings</p>
                  <ul className="space-y-1.5">
                    {meetings.slice(0, 3).map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => nav.navigate("my-meetings", { meetingId: m.id })}
                          className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-slate-200 hover:bg-slate-50"
                        >
                          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-slate-800">{m.title}</span>
                          <AvatarStack names={m.participantIds.map((id) => getEmployee(id)?.name ?? "")} max={3} />
                          <span className="shrink-0 text-[11px] text-slate-400">{relTime(m.start)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <LockedSection
                title="Work context is restricted"
                body="Tasks, meetings and documents are visible to the employee, their manager and authorized HR only. If you manage this colleague, your role preview will unlock this section."
              />
            )}
          </SectionCard>

          {/* HR-sensitive — employment timeline + performance */}
          <SectionCard title="Employment & performance" description={canSeeHR ? "HR-managed information within your authorized scope." : undefined}>
            {canSeeHR ? (
              <dl className="divide-y">
                <KV label="Joined">{target.since}</KV>
                <KV label="Employment type">Full-time · permanent <LockedFieldHint /></KV>
                <KV label="Performance cycle">
                  {isSelf ? "FY26 · self-assessment open until 30 Nov" : "FY26 · on track (manager summary available in the HR workspace)"}
                </KV>
                <KV label="Compensation">
                  {scope === "hr" || scope === "admin" ? (
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                      <Lock className="h-3 w-3 text-slate-400" aria-hidden /> Visible in the payroll workspace only — never rendered in Employee 360.
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                      <Lock className="h-3 w-3 text-slate-400" aria-hidden /> Managed by HR payroll — not shown here by policy.
                    </span>
                  )}
                </KV>
              </dl>
            ) : (
              <LockedSection
                title="HR information is restricted"
                body="Employment details and performance data are visible to the employee and authorized HR workflows only. This boundary is enforced server-side."
              />
            )}
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <SectionCard title="Recent activity" description={canSeeWork ? "Work events visible in your scope." : undefined}>
            {canSeeWork ? (
              <ul className="space-y-2.5">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <span className="text-[11px] font-semibold text-slate-500">{a.type[0]}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium text-slate-800">{a.title}</span>
                      <span className="block text-[11px] text-muted-foreground">{relTime(a.ts)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <LockedSection title="Activity is private" body="Work activity is visible to the employee and their manager." compact />
            )}
          </SectionCard>

          <SectionCard title="Open tasks" description={canSeeWork ? "Live from the task system." : undefined}>
            {canSeeWork ? (
              openTasks.length === 0 ? (
                <EmptyState icon={<ClipboardCheck />} title="No open tasks" message="Nothing in flight right now." className="py-6" />
              ) : (
                <ul className="space-y-2">
                  {openTasks.slice(0, 4).map((t) => (
                    <li key={t.id} className="rounded-lg border border-slate-200/80 bg-white px-3 py-2">
                      <p className="truncate text-[12.5px] font-medium text-slate-800">{t.title}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <DueBadge due={t.due} />
                        <StatusBadge status={t.status} size="sm" />
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <LockedSection title="Tasks are private" body="Visible to the employee and their manager." compact />
            )}
          </SectionCard>

          <SectionCard title="Privacy & policy" description="How Employee 360 respects boundaries.">
            <ul className="space-y-2 text-xs leading-relaxed text-slate-600">
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden /> Sections render according to your authorized scope — the server enforces the same scope on every API.</li>
              <li className="flex gap-2"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden /> Compensation is never rendered here for anyone — it lives in payroll with its own access model.</li>
              <li className="flex gap-2"><TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden /> Administrative access is functional, not invisible: viewing an employee's 360 as administrator is recorded in the audit trail.</li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function LockedSection({ title, body, compact }: { title: string; body: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/60", compact ? "px-3 py-2.5" : "px-3.5 py-3.5")}>
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      <div>
        <p className="text-xs font-semibold text-slate-700">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{body}</p>
      </div>
    </div>
  );
}

/** Deterministic lightweight activity for non-Sagar employees,
 *  derived from data the viewer's scope already exposes. */
function deriveActivity(target: Employee): { id: string; type: string; title: string; ts: number }[] {
  const out: { id: string; type: string; title: string; ts: number }[] = [];
  const t = tasksForEmployee(target.id);
  for (const task of t.slice(0, 2)) {
    out.push({ id: `der-task-${task.id}`, type: "Task", title: task.status === "Completed" ? `Completed "${task.title}"` : `Working on "${task.title}"`, ts: task.due ?? WORKSPACE_NOW - 86_400_000 });
  }
  const m = MEETINGS.filter((x) => x.participantIds.includes(target.id)).sort((a, b) => b.start - a.start)[0];
  if (m) out.push({ id: `der-mtg-${m.id}`, type: "Meeting", title: `Attended "${m.title}"`, ts: m.end });
  return out.sort((a, b) => b.ts - a.ts).slice(0, 4);
}

function tasksForEmployee(id: string) {
  return TEAM_TASKS.filter((t) => t.assigneeId === id);
}
