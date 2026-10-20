"use client";

import * as React from "react";
import { BarChart3, Bell, Download, FileText, Plus, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard, StatTile, StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import {
  AnalyticsAsOf,
  AnalyticsErrorBanner,
  AnalyticsSkeleton,
  ScopeNote,
  VisibilityChip,
  analyticsPost,
  useAnalyticsSection,
} from "../analytics/parts";
import { ANALYTICS_PERIOD } from "@/lib/qubit/analytics-data";
import type { Freshness } from "@/lib/qubit/executive-data";

// ============================================================
// Screen 267 · Analytics Home — the central landing page for the
// ONE analytics layer. Role-aware content: the server composes
// the KPI set per boundary (CEO sees enterprise metrics, Sales
// sees authorized sales analytics, HR sees people analytics,
// employees see personal analytics) — never frontend-decided.
// ============================================================

interface HomePayload {
  asOfLabel: string;
  scope: string;
  roleKpis: { id: string; label: string; value: string; metricId?: string; status?: string; source: string; drill: { screen: string; label: string } }[];
  freshness: Record<string, Freshness>;
  alerts: { id: string; severity: string; title: string; detail: string }[];
  savedReports: { id: string; name: string; visibility: string; ownerName: string; updatedAt: number; lastRun?: number; favorite: boolean; status: string }[];
  favoriteReports: { id: string; name: string }[];
  recentReports: { reportId: string; at: number; report: { id: string; name: string } | null }[];
  scheduleCount: number;
  nextScheduled: string | null;
  exportCount: number;
  quickLinks: { id: string; label: string }[];
  canCreate: boolean;
  canExport: boolean;
}

const FRESH_ORDER = ["sales", "revenue", "finance", "people", "marketing", "service", "inventory", "workspace", "audit"];

export function AnalyticsHomeScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { data, loading, error, reload } = useAnalyticsSection<HomePayload>("home");
  const [query, setQuery] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const go = (screen: Parameters<typeof nav.navigate>[0], params?: Parameters<typeof nav.navigate>[1]) => () => nav.navigate(screen, params);

  const toggleFavorite = async (id: string) => {
    setBusyId(id);
    try {
      await analyticsPost("report.favorite", { id }, role);
      reload();
    } catch (e) {
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const filteredReports = (data?.savedReports ?? []).filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }]}
        title="Analytics Home"
        description="One unified entry point into Qubit One analytics — every figure is read from its authoritative system, scoped to your role."
        meta={
          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium capitalize">{data ? `${data.scope} scope` : "…"} · server-enforced</span>
            <span>{ANALYTICS_PERIOD.fiscalNote}</span>
          </div>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={go("data-export")} disabled={!data?.canExport} title={data?.canExport ? "Export workspace" : "Export requires an authorized boundary"}>
              <Download className="h-4 w-4" aria-hidden /> Data Export
            </Button>
            <Button size="sm" onClick={go("report-builder")} disabled={!data?.canCreate}>
              <Plus className="h-4 w-4" aria-hidden /> Create Report
            </Button>
          </>
        }
      />

      {loading && <AnalyticsSkeleton rows={5} />}
      {error && !loading && <AnalyticsErrorBanner message={error} onRetry={reload} />}

      {data && !loading && (
        <div className="space-y-5">
          {/* Analytics alerts — real states only (delayed sources, failed jobs) */}
          {data.alerts.length > 0 && (
            <SectionCard
              title={
                <span className="flex items-center gap-1.5">
                  <Bell className="h-4 w-4 text-amber-500" aria-hidden /> Analytics alerts
                </span>
              }
              description="Freshness and job states the analytics layer can see — never fabricated success."
            >
              <ul className="space-y-2.5">
                {data.alerts.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                    <StatusBadge status={a.severity === "High" ? "High" : a.severity === "Warning" ? "Warning" : "Info"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-slate-900">{a.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* Role-aware KPIs — the server decides what each role sees */}
          <SectionCard
            title="Your enterprise KPIs"
            description={`Composed for your ${role.replace("-", " ")} boundary — each figure carries its source and drilldown.`}
            actions={<Button variant="ghost" size="sm" className="h-7 text-xs" onClick={reload}>Refresh</Button>}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.roleKpis.map((k) => (
                <StatTile
                  key={k.id}
                  value={k.value}
                  label={k.label}
                  onClick={go(k.drill.screen as Parameters<typeof nav.navigate>[0])}
                  className="w-full"
                />
              ))}
            </div>
            <ScopeNote>
              Analytics is never a second source of truth — these tiles link into the department analytics screens, which read the same authoritative systems.
            </ScopeNote>
          </SectionCard>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {/* Reports */}
            <div className="space-y-5 xl:col-span-2">
              <SectionCard
                title="Saved reports"
                description="Built on the governed semantic layer — visibility is enforced server-side."
                actions={
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reports…" aria-label="Search reports" className="h-8 w-44 pl-8 text-xs" />
                  </div>
                }
              >
                {filteredReports.length === 0 ? (
                  <EmptyState
                    icon={<FileText aria-hidden />}
                    title={query ? "No reports match your search" : "No saved reports yet"}
                    message={query ? "Try a different name." : "Create your first report in the governed Report Builder."}
                    action={<Button size="sm" onClick={go("report-builder")}>Create Report</Button>}
                  />
                ) : (
                  <ul className="divide-y divide-slate-50">
                    {filteredReports.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center gap-2.5 py-2.5 first:pt-0 last:pb-0">
                        <button type="button" onClick={() => toggleFavorite(r.id)} disabled={busyId === r.id} aria-label={r.favorite ? `Remove ${r.name} from favorites` : `Add ${r.name} to favorites`} className="shrink-0">
                          <Star className={`h-4 w-4 ${r.favorite ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-300"}`} aria-hidden />
                        </button>
                        <button type="button" onClick={go("report-detail", { reportId: r.id })} className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-[13px] font-medium text-slate-900 hover:text-blue-700">{r.name}</span>
                          <span className="block truncate text-[11px] text-slate-400">{r.ownerName} · updated {new Date(r.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}{r.lastRun ? ` · last run ${new Date(r.lastRun).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}</span>
                        </button>
                        <VisibilityChip visibility={r.visibility} />
                        <StatusBadge status={r.status} size="sm" />
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <SectionCard title="Quick access" description="Department analytics available to your boundary.">
                  <ul className="space-y-1.5">
                    {data.quickLinks.map((l) => (
                      <li key={l.id}>
                        <button type="button" onClick={go(l.id as Parameters<typeof nav.navigate>[0])} className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700">
                          <BarChart3 className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-blue-600" aria-hidden />
                          <span className="flex-1 truncate">{l.label}</span>
                          <span className="text-slate-300 transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </SectionCard>

                <SectionCard title="Recent & schedules" description="Your own report history and delivery schedule.">
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recently viewed</p>
                      {data.recentReports.length === 0 ? (
                        <p className="mt-1.5 text-xs text-muted-foreground">No report views yet.</p>
                      ) : (
                        <ul className="mt-1.5 space-y-1">
                          {data.recentReports.map((r) =>
                            r.report ? (
                              <li key={r.reportId}>
                                <button type="button" onClick={go("report-detail", { reportId: r.report.id })} className="truncate text-[12.5px] text-blue-600 hover:text-blue-700">{r.report.name}</button>
                              </li>
                            ) : null,
                          )}
                        </ul>
                      )}
                    </div>
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Scheduled deliveries</p>
                      <p className="mt-1.5 text-[13px] text-slate-700">
                        {data.scheduleCount > 0 ? (
                          <>{data.scheduleCount} active schedule{data.scheduleCount > 1 ? "s" : ""}{data.nextScheduled ? ` — next: ${data.nextScheduled}` : ""}</>
                        ) : (
                          "No active schedules."
                        )}
                      </p>
                      <button type="button" onClick={go("scheduled-reports")} className="mt-1 text-[12.5px] font-medium text-blue-600 hover:text-blue-700">Manage schedules</button>
                    </div>
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Export jobs</p>
                      <p className="mt-1.5 text-[13px] text-slate-700">{data.exportCount} job{data.exportCount === 1 ? "" : "s"} in your export history.</p>
                      <button type="button" onClick={go("data-export")} className="mt-1 text-[12.5px] font-medium text-blue-600 hover:text-blue-700">Open Data Export</button>
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>

            {/* Data freshness — every source, honest states */}
            <SectionCard
              title="Data freshness"
              description="Last successful sync per source — partial or delayed states are shown, never papered over."
            >
              <ul className="space-y-2.5">
                {FRESH_ORDER.filter((k) => data.freshness[k]).map((k) => {
                  const f = data.freshness[k];
                  return (
                    <li key={k} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[12.5px] font-medium capitalize text-slate-700">{k}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${f.status === "live" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : f.status === "ok" ? "border-blue-100 bg-blue-50 text-blue-700" : f.status === "delayed" || f.status === "stale" ? "border-amber-100 bg-amber-50 text-amber-700" : "border-rose-100 bg-rose-50 text-rose-700"}`} title={f.detail ?? f.label}>
                        {f.label.replace(/^Updated\s*/, "")}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <ScopeNote className="mt-4">
                When a source is delayed, its analytics screens say so — figures are final as of the last sync, and nothing is fabricated to look complete.
              </ScopeNote>
            </SectionCard>
          </div>

          <AnalyticsAsOf asOfLabel={data.asOfLabel} fiscalNote={ANALYTICS_PERIOD.fiscalNote} />
        </div>
      )}
    </div>
  );
}
