"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  FileText,
  Handshake,
  ListChecks,
  MessageCircle,
  Phone,
  Plus,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "../page-header";
import { Avatar, EmptyState, SectionCard, StatTile, StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  EntityLink,
  fmtCr,
  fmtDateTime,
  fmtRupees,
  relTime,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  useSalesSection,
} from "../sales/parts";

// ============================================================
// Screen 73 · Sales Home — the daily operating center.
// Role-aware: salespeople see their personal work first; managers
// also see team targets. Signal → context → action, no dashboard
// wall. All data comes from /api/sales?section=home (scoped).
// ============================================================

interface HomePayload {
  period: { label: string; window: string; asOfLabel: string };
  scope: "company" | "team" | "own";
  myOpps: { id: string; name: string; accountName: string; stage: string; valueCr: number; probability: number; expectedClose: string; riskNote?: string; nextAction?: string }[];
  pipeline: { gross: number; weighted: number; count: number };
  followups: {
    today: { id: string; type: string; subject: string; state: string; priority: string; dueAt: number; leadId?: string; accountId?: string; opportunityId?: string }[];
    upcoming: { id: string; type: string; subject: string; state: string; priority: string; dueAt: number }[];
  };
  meetings: { id: string; title: string; accountId: string; startAt: number; durationMin: number; location: string; isLink?: boolean }[];
  recentLeads: { id: string; name: string; company: string; contactPerson?: string; status: string; priority: string; score: number; createdAt: number }[];
  recentActivity: { id: string; at: number; type: string; summary: string; outcome?: string }[];
  pendingQuotations: { id: string; number: string; status: string; accountName: string; total: number; ownerName: string }[];
  target: { quotaCr: number; achievedCr: number; pipelineCr: number; forecastCr: number } | null;
  teamTargets: { id: string; label: string; quotaCr: number; achievedCr: number }[];
  counts: { myOpenOpps: number; dueFollowups: number; unreadWhatsApp: number; visitsPlanned: number };
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  Call: <Phone className="h-3.5 w-3.5" aria-hidden />,
  WhatsApp: <MessageCircle className="h-3.5 w-3.5" aria-hidden />,
  Meeting: <CalendarDays className="h-3.5 w-3.5" aria-hidden />,
  Visit: <Users className="h-3.5 w-3.5" aria-hidden />,
  Email: <FileText className="h-3.5 w-3.5" aria-hidden />,
  "Send Quote": <FileText className="h-3.5 w-3.5" aria-hidden />,
};

export function SalesHomeScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { data, loading, error, forbidden, reload } = useSalesSection<HomePayload>("home");

  const go = (screen: Parameters<typeof nav.navigate>[0], params?: Parameters<typeof nav.navigate>[1]) => () => nav.navigate(screen, params);

  if (forbidden) {
    return (
      <SalesGate screenName="Sales Home">
        <></>
      </SalesGate>
    );
  }

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Sales Home" }]}
        title="Sales Home"
        description="Your daily sales operating center — what needs attention now, what is moving, and what comes next."
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={go("lead-create")}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> New lead
            </Button>
            <Button size="sm" className="h-9 gap-1.5" onClick={go("followup-queue")}>
              <ListChecks className="h-3.5 w-3.5" aria-hidden /> Work follow-ups
            </Button>
          </>
        }
      />

      {error && !forbidden && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={4} />}

      {data && !loading && (
        <div className="space-y-4">
          {/* Operating snapshot — four honest counters, each actionable */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              icon={<Handshake />}
              value={String(data.counts.myOpenOpps)}
              label="Open opportunities in your scope"
              onClick={go("sales-pipeline")}
            />
            <StatTile
              icon={<ListChecks />}
              value={String(data.counts.dueFollowups)}
              label={data.counts.dueFollowups > 0 ? "Follow-ups due or overdue" : "Follow-ups — all clear"}
              onClick={go("followup-queue")}
            />
            <StatTile
              icon={<MessageCircle />}
              value={String(data.counts.unreadWhatsApp)}
              label="Unread WhatsApp conversations"
              onClick={go("whatsapp-inbox")}
            />
            <StatTile
              icon={<CalendarClock />}
              value={String(data.counts.visitsPlanned)}
              label="Field visits planned ahead"
              onClick={go("visit-planner")}
            />
          </div>

          {/* Target progress — personal for sellers, team rows for managers */}
          {data.target && (
            <SectionCard
              title={role === "sales-exec" ? "Your Q3 target" : "Your Q3 target — and the teams behind it"}
              description={`${data.period.label} · ${data.period.window}. Actual, forecast and target are kept separate — never mixed.`}
              actions={
                <Button variant="outline" size="sm" className="h-8" onClick={go("sales-targets")}>
                  Target detail
                </Button>
              }
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[26px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">{fmtCr(data.target.achievedCr)}</p>
                    <p className="text-xs text-muted-foreground">of {fmtCr(data.target.quotaCr)} quota</p>
                  </div>
                  <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${Math.round((data.target.achievedCr / Math.max(0.0001, data.target.quotaCr)) * 100)}% of quota achieved`}>
                    <div
                      className={data.target.achievedCr / Math.max(0.0001, data.target.quotaCr) >= 0.5 ? "h-full rounded-full bg-emerald-500" : "h-full rounded-full bg-amber-500"}
                      style={{ width: `${Math.min(100, Math.max(3, (data.target.achievedCr / Math.max(0.0001, data.target.quotaCr)) * 100))}%` }}
                    />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="flex justify-between gap-2"><dt className="text-slate-400">Weighted pipeline</dt><dd className="tabular-nums text-slate-700">{fmtCr(data.target.pipelineCr)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-slate-400">Forecast</dt><dd className="tabular-nums text-slate-700">{fmtCr(data.target.forecastCr)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-slate-400">Closed won</dt><dd className="tabular-nums text-slate-700">{fmtCr(data.target.achievedCr)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-slate-400">Gap to quota</dt><dd className="tabular-nums text-slate-700">{fmtCr(Math.max(0, data.target.quotaCr - data.target.forecastCr))}</dd></div>
                  </dl>
                  <p className="mt-2 text-[11px] text-slate-400">Forecast is commit-weighted; the pipeline figure is unweighted and shown for context only.</p>
                </div>
                {data.teamTargets.length > 0 && (
                  <ul className="space-y-2.5 border-t border-slate-100 pt-3 lg:border-l lg:pl-5 lg:border-t-0 lg:pt-0" aria-label="Team target progress">
                    {data.teamTargets.map((t) => {
                      const pct = Math.round((t.achievedCr / Math.max(0.0001, t.quotaCr)) * 100);
                      return (
                        <li key={t.id}>
                          <div className="flex items-baseline justify-between gap-2 text-[13px]">
                            <span className="truncate font-medium text-slate-700">{t.label}</span>
                            <span className="shrink-0 tabular-nums text-slate-500">
                              {fmtCr(t.achievedCr)} / {fmtCr(t.quotaCr)} · {pct}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className={pct >= 50 ? "h-full rounded-full bg-blue-600/85" : "h-full rounded-full bg-amber-500"} style={{ width: `${Math.min(100, Math.max(3, pct))}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </SectionCard>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            {/* Today's follow-ups — the operational lead list */}
            <SectionCard
              title="Today's follow-ups"
              description="Overdue first. Complete them with an outcome so the customer timeline stays honest."
              actions={
                <Button variant="ghost" size="sm" className="h-8 text-blue-600" onClick={go("followup-queue")}>
                  Open queue
                </Button>
              }
            >
              {data.followups.today.length === 0 ? (
                <EmptyState icon={<ListChecks />} title="Nothing due today" message="Your follow-up queue is clear. Upcoming items are listed below." />
              ) : (
                <ul className="space-y-2.5">
                  {data.followups.today.map((f) => (
                    <li key={f.id} className="flex items-start gap-3 rounded-lg border border-slate-200/80 bg-white px-3.5 py-3">
                      <span className="qubit-icon-tile qubit-icon-tile-accent mt-0.5 h-8 w-8 shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">{TYPE_ICON[f.type] ?? <Phone className="h-3.5 w-3.5" />}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate text-[13.5px] font-medium text-slate-800">{f.subject}</p>
                          <StatusBadge status={f.state} size="sm" />
                          {f.priority === "High" && <span className="rounded border border-red-200 bg-red-50 px-1.5 py-px text-[10.5px] font-medium text-red-700">High</span>}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">{f.type} · {relTime(f.dueAt)} · {fmtDateTime(f.dueAt)}</p>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs" onClick={go("followup-queue")}>
                        Work it
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {data.followups.upcoming.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Next up</p>
                  <ul className="space-y-1.5">
                    {data.followups.upcoming.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="min-w-0 truncate text-slate-600">{f.subject}</span>
                        <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{relTime(f.dueAt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>

            {/* Meetings + pending quotations */}
            <div className="space-y-4">
              <SectionCard
                title="Upcoming customer meetings"
                description="Connected to the enterprise Meetings module — one calendar, not two."
                actions={
                  <Button variant="ghost" size="sm" className="h-8 text-blue-600" onClick={go("customer-meetings")}>
                    All meetings
                  </Button>
                }
              >
                {data.meetings.length === 0 ? (
                  <EmptyState icon={<CalendarDays />} title="No meetings scheduled" message="Schedule one from a customer, contact or opportunity." />
                ) : (
                  <ul className="space-y-2.5">
                    {data.meetings.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 rounded-lg border border-slate-200/80 px-3.5 py-2.5">
                        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50 text-blue-700" aria-hidden>
                          <span className="text-[10px] font-semibold uppercase leading-none">{new Date(m.startAt).toLocaleDateString("en-IN", { month: "short" })}</span>
                          <span className="text-[15px] font-bold leading-tight tabular-nums">{new Date(m.startAt).getDate()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium text-slate-800">{m.title}</p>
                          <p className="truncate text-xs text-slate-400">{fmtDateTime(m.startAt)} · {m.durationMin} min · {m.location}</p>
                        </div>
                        {m.isLink && (
                          <Button size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs" onClick={() => toast({ title: "This demo does not open external meeting links.", description: "The link would open the enterprise Meetings module in production." })}>
                            Join
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard
                title="Pending quotations"
                description="Drafts and documents waiting on approval or the customer."
                actions={
                  <Button variant="ghost" size="sm" className="h-8 text-blue-600" onClick={go("quotation-list")}>
                    Quotation list
                  </Button>
                }
              >
                {data.pendingQuotations.length === 0 ? (
                  <EmptyState icon={<FileText />} title="No pending quotations" message="Build one from the Quotation Builder — pricing rules run on the server." />
                ) : (
                  <ul className="space-y-2.5">
                    {data.pendingQuotations.map((q) => (
                      <li key={q.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[11px] font-medium text-slate-600">{q.number}</span>
                            <StatusBadge status={q.status} size="sm" />
                          </div>
                          <p className="mt-1 truncate text-[13px] text-slate-600">{q.accountName} · {fmtRupees(q.total)}</p>
                        </div>
                        <EntityLink screen="quotation-detail" id={q.id} label="Open" kind="quotation" />
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {/* Active opportunities */}
            <SectionCard
              title="Active opportunities"
              description={`Open deals in your scope · ${fmtCr(data.pipeline.gross)} gross · ${fmtCr(data.pipeline.weighted)} weighted`}
              actions={
                <Button variant="ghost" size="sm" className="h-8 text-blue-600" onClick={go("sales-pipeline")}>
                  Pipeline
                </Button>
              }
            >
              {data.myOpps.length === 0 ? (
                <EmptyState icon={<TrendingUp />} title="No open opportunities" message="Convert a qualified lead or create an opportunity to get started." />
              ) : (
                <ul className="space-y-2.5">
                  {data.myOpps.map((o) => (
                    <li key={o.id} className="rounded-lg border border-slate-200/80 px-3.5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <EntityLink screen="opportunity-detail" id={o.id} label={o.name} kind="opportunity" />
                            <StatusBadge status={o.stage} size="sm" />
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-400">{o.accountName} · close {o.expectedClose}</p>
                        </div>
                        <p className="text-[13px] font-semibold tabular-nums text-slate-900">{fmtCr(o.valueCr)}</p>
                      </div>
                      {(o.riskNote || o.nextAction) && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500">
                          {o.riskNote ? <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-hidden /> : null}
                          <span>{o.riskNote ?? o.nextAction}</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Recent leads + customer activity */}
            <div className="space-y-4">
              <SectionCard
                title="Recent leads"
                description="Newest first — triage before they go cold."
                actions={
                  <Button variant="ghost" size="sm" className="h-8 text-blue-600" onClick={go("lead-inbox")}>
                    Lead Inbox
                  </Button>
                }
              >
                {data.recentLeads.length === 0 ? (
                  <EmptyState icon={<Users />} title="No leads yet" message="Create one — duplicate detection runs before anything is saved." />
                ) : (
                  <ul className="space-y-2.5">
                    {data.recentLeads.map((l) => (
                      <li key={l.id} className="flex items-center gap-3">
                        <Avatar name={l.contactPerson ?? l.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <EntityLink screen="lead-detail" id={l.id} label={l.name} kind="lead" />
                            <StatusBadge status={l.status} size="sm" />
                            <StatusBadge status={l.priority} size="sm" />
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-400">{l.company} · added {relTime(l.createdAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard
                title="Recent customer activity"
                description="One timeline across leads, accounts, quotations and orders."
                actions={
                  <Button variant="ghost" size="sm" className="h-8 text-blue-600" onClick={go("customer-activity")}>
                    Full timeline
                  </Button>
                }
              >
                {data.recentActivity.length === 0 ? (
                  <EmptyState icon={<CalendarDays />} title="No recent activity" message="Calls, emails, WhatsApp messages and stage changes will appear here." />
                ) : (
                  <ul className="space-y-2.5">
                    {data.recentActivity.map((a) => (
                      <li key={a.id} className="border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[12.5px] font-medium text-slate-700">{a.type}</span>
                          <span className="shrink-0 text-[11px] text-slate-400">{relTime(a.at)}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-600">{a.summary}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          </div>

          {/* WhatsApp alert line — only when unread exists */}
          {data.counts.unreadWhatsApp > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3" role="status">
              <p className="flex items-center gap-2 text-sm text-emerald-800">
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                {data.counts.unreadWhatsApp} unread WhatsApp {data.counts.unreadWhatsApp === 1 ? "conversation needs" : "conversations need"} a reply — leads cool down fast.
              </p>
              <Button size="sm" variant="outline" className="h-8 border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100" onClick={go("whatsapp-inbox")}>
                Open WhatsApp Inbox
              </Button>
            </div>
          )}

          <SalesAsOf asOfLabel={data.period.asOfLabel} note="Counts reflect your authorized scope; company-wide aggregates live in the Sales Command Center (screen 61)." />
        </div>
      )}

      {!loading && !data && !error && (
        <EmptyState
          icon={<Target />}
          title="Sales Home could not load"
          message="The sales service returned no data. Retry, or check the service status."
          action={<Button size="sm" onClick={reload}>Retry</Button>}
        />
      )}
    </div>
  );
}
