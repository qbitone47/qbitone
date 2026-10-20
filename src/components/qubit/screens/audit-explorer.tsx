"use client";

import * as React from "react";
import { Download, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard } from "../primitives";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  AnalyticsAsOf,
  AnalyticsErrorBanner,
  AnalyticsSkeleton,
  ScopeNote,
  useAnalyticsSection,
  analyticsPost,
} from "../analytics/parts";

// ============================================================
// Screen 281 · Audit Explorer — an advanced, READ-ONLY view over
// the ONE enterprise Audit Log (spec §23). No second audit
// database exists; every search rides security-server's
// queryAudit with its own scoping (administrators see the whole
// trail, other boundaries see their own activity — enforced
// server-side). Records are never editable here; sensitive
// values stay masked by the audit system's policy.
// ============================================================

interface AuditEventRow {
  id: string;
  ts: number;
  time: string;
  actor: string;
  actorId: string;
  action: string;
  resource: string;
  result: string;
  severity: string;
  source: string;
  ipMasked: string;
  correlationId: string;
  context: string;
}

interface AuditPayload {
  asOfLabel: string;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  events: AuditEventRow[];
  facets: { actions: string[]; actors: string[]; severities: string[]; results: string[]; sources: string[]; ranges: string[] };
  restricted: boolean;
  scopeNote: string;
  canExportCsv: boolean;
  readonlyNote: string;
}

const RESULT_TONE: Record<string, string> = {
  Success: "border-emerald-100 bg-emerald-50 text-emerald-700",
  Failure: "border-rose-100 bg-rose-50 text-rose-700",
  Blocked: "border-amber-100 bg-amber-50 text-amber-700",
};

export function AuditExplorerScreen() {
  const { role } = useRole();
  const [query, setQuery] = React.useState("");
  const [severity, setSeverity] = React.useState("all");
  const [result, setResult] = React.useState("all");
  const [action, setAction] = React.useState("all");
  const [actor, setActor] = React.useState("all");
  const [range, setRange] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const { data, loading, error, reload } = useAnalyticsSection<AuditPayload>("audit", {
    q: query || undefined,
    severity,
    result,
    action,
    actor,
    range,
    page: String(page),
  });

  const applyFacet = (setter: (v: string) => void, resetPage = true) => (v: string) => {
    setter(v);
    if (resetPage) setPage(1);
  };

  const exportCsv = async () => {
    try {
      const res = await analyticsPost<{ ok: boolean; csv: string }>("audit.exportCsv", {}, role);
      const blob = new Blob([res.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qubit-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Audit CSV exported", description: "The export is recorded in the audit trail with Warning severity." });
    } catch (e) {
      toast({ title: "Export not permitted", description: (e as Error).message, variant: "destructive" });
    }
  };

  const selectCls = "h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-700";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Audit Explorer" }]}
        title="Audit Explorer"
        description="Search and filter the ONE enterprise audit trail — read-only, with scoping and masking enforced by the audit system."
        meta={
          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium"><ShieldCheck className="h-3 w-3" aria-hidden /> {data?.restricted ? "Own activity · server-enforced" : "Organization-wide · administrator"}</span>
            {data && <span>{data.total.toLocaleString("en-IN")} matching events</span>}
          </div>
        }
        actions={
          data?.canExportCsv ? (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-5">
        <SectionCard title="Search & filters" description="All filtering executes server-side over the audit store — nothing is filtered client-side.">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search actor, action, resource, correlation ID…"
                aria-label="Search audit events"
                className="h-8 pl-8 text-[12.5px]"
              />
            </div>
            <select aria-label="Severity filter" value={severity} onChange={(e) => applyFacet(setSeverity)(e.target.value)} className={selectCls}>
              <option value="all">All severities</option>
              {data?.facets.severities.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="Result filter" value={result} onChange={(e) => applyFacet(setResult)(e.target.value)} className={selectCls}>
              <option value="all">All results</option>
              {data?.facets.results.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="Action filter" value={action} onChange={(e) => applyFacet(setAction)(e.target.value)} className={selectCls}>
              <option value="all">All actions</option>
              {data?.facets.actions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {data && !data.restricted && (
              <select aria-label="Actor filter" value={actor} onChange={(e) => applyFacet(setActor)(e.target.value)} className={selectCls}>
                <option value="all">All actors</option>
                {data.facets.actors.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <select aria-label="Time range filter" value={range} onChange={(e) => applyFacet(setRange)(e.target.value)} className={selectCls}>
              <option value="all">All time</option>
              {data?.facets.ranges.filter((r) => r !== "all").map((r) => <option key={r} value={r}>{r === "24h" ? "Last 24 hours" : r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : "Last 90 days"}</option>)}
            </select>
          </div>
          {data && <ScopeNote className="mt-3">{data.scopeNote}</ScopeNote>}
        </SectionCard>

        {loading && <AnalyticsSkeleton rows={6} />}
        {error && !loading && <AnalyticsErrorBanner message={error} onRetry={reload} />}

        {data && !loading && (
          <SectionCard
            title={`Events — page ${data.page} of ${data.pageCount}`}
            description="Select a row to see its contextual details. Records cannot be edited here."
          >
            {data.events.length === 0 ? (
              <EmptyState
                icon={<Search aria-hidden />}
                title="No audit events match"
                message="Adjust the search or clear a filter — the trail only reveals events your boundary is authorized to see."
              />
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[12.5px]">
                  <caption className="sr-only">Audit events</caption>
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                      <th scope="col" className="py-2 pr-3 font-semibold">Time</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Actor</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Action</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Target</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Outcome</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Source</th>
                      <th scope="col" className="pl-3 py-2 font-semibold">Correlation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((e) => (
                      <React.Fragment key={e.id}>
                        <tr
                          className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/70"
                          onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                          aria-expanded={expanded === e.id}
                        >
                          <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-slate-500">{e.time}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">{e.actor}</td>
                          <td className="px-3 py-2 text-slate-700">{e.action}</td>
                          <td className="max-w-[220px] truncate px-3 py-2 text-slate-600" title={e.resource}>{e.resource}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${RESULT_TONE[e.result] ?? RESULT_TONE.Success}`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden />
                              {e.result}
                              <span className="sr-only"> — severity {e.severity}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-500">{e.source}</td>
                          <td className="pl-3 py-2 whitespace-nowrap font-mono text-[10.5px] text-slate-400">{e.correlationId}</td>
                        </tr>
                        {expanded === e.id && (
                          <tr className="border-b border-slate-100 bg-slate-50/60">
                            <td colSpan={7} className="px-4 py-3">
                              <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-[12px] sm:grid-cols-2 lg:grid-cols-3">
                                <div><dt className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Event ID</dt><dd className="font-mono text-slate-700">{e.id}</dd></div>
                                <div><dt className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Severity</dt><dd className="text-slate-700">{e.severity}</dd></div>
                                <div><dt className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Device / IP (masked)</dt><dd className="text-slate-700">{e.source} · {e.ipMasked}</dd></div>
                                <div className="sm:col-span-2 lg:col-span-3"><dt className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Contextual details</dt><dd className="text-slate-700">{e.context}</dd></div>
                              </dl>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.pageCount > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <p className="text-[11.5px] text-slate-400">{data.total.toLocaleString("en-IN")} events · {data.pageSize} per page</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                  <Button variant="outline" size="sm" className="h-8" disabled={data.page >= data.pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}

            <ScopeNote className="mt-3">{data.readonlyNote}</ScopeNote>
          </SectionCard>
        )}

        <AnalyticsAsOf />
      </div>
    </div>
  );
}
