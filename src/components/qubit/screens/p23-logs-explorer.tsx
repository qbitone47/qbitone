"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsSkeleton, OpsTable, SourceLine, fmtIST, useObsSection } from "../obs/parts";

// ============================================================
// P23-03 · Logs Explorer — the enterprise audit trail read as
// the structured log stream. ONE audit system; sensitive values
// are never present to redact (enforced at the writeAudit source).
// ============================================================

interface LogsPayload {
  stream: { kind: string; note: string };
  events: { id: string; ts: number; time: string; severity: string; service: string; actor: string; action: string; resource: string; result: string; correlationId: string; ipMasked: string; message?: string }[];
  redaction: { active: boolean; rules: string[]; note: string };
  savedViews: unknown[];
  savedViewsNote: string;
  sourceNote: string;
}

const sevTone: Record<string, string> = {
  Critical: "border-red-200 bg-red-50 text-red-800",
  High: "border-orange-200 bg-orange-50 text-orange-800",
  Warning: "border-amber-200 bg-amber-50 text-amber-800",
  Info: "border-slate-200 bg-slate-50 text-slate-600",
};

export function P23LogsExplorerScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<LogsPayload>("logs");
  const [search, setSearch] = React.useState("");
  const [sev, setSev] = React.useState("All");
  const [result, setResult] = React.useState("All");

  const rows = React.useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.events.filter((e) => {
      if (sev !== "All" && e.severity !== sev) return false;
      if (result !== "All" && e.result !== result) return false;
      if (!q) return true;
      return [e.action, e.resource, e.actor, e.message ?? "", e.correlationId].some((v) => v.toLowerCase().includes(q));
    }).slice(0, 120);
  }, [data, search, sev, result]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Logs Explorer"
        description="The system's one structured event stream — the enterprise audit trail. Server-enforced scope, secrets never present."
        actions={
          <button type="button" onClick={reload} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
            Refresh
          </button>
        }
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-[12px] leading-relaxed text-slate-600" role="note">
            {data.stream.note}
          </div>

          <SectionCard title="Filters" description="Client-side filtering over the server-provided window (server-side scope is enforced by the audit system itself).">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="log-search" className="mb-1 block text-[11px] font-semibold text-slate-600">Search (action, resource, actor, message, correlation ID)</label>
                <input id="log-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. ops.flag or INC-"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label htmlFor="log-sev" className="mb-1 block text-[11px] font-semibold text-slate-600">Severity</label>
                <select id="log-sev" value={sev} onChange={(e) => setSev(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px]">
                  {["All", "Critical", "High", "Warning", "Info"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="log-result" className="mb-1 block text-[11px] font-semibold text-slate-600">Result</label>
                <select id="log-result" value={result} onChange={(e) => setResult(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px]">
                  {["All", "Success", "Failure", "Blocked"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{rows.length} of {data.events.length} events shown · first 120 rows rendered (virtualization over larger windows is a Future Extension).</p>
          </SectionCard>

          <SectionCard title={`Events (${rows.length})`} description="Timestamp, severity, service, actor, action, resource, result, correlation — the real record.">
            <OpsTable
              rows={rows}
              keyOf={(e) => e.id}
              empty={<p className="px-3 py-6 text-center text-[12.5px] text-slate-500">No events match the current filters. An empty result is a real result.</p>}
              columns={[
                { header: "Time", cell: (e) => <span className="whitespace-nowrap tabular-nums text-[11.5px] text-slate-500">{fmtIST(e.ts)}</span> },
                { header: "Severity", cell: (e) => <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${sevTone[e.severity] ?? sevTone.Info}`}>{e.severity}</span> },
                { header: "Service", cell: (e) => <span className="text-[11.5px] text-slate-500">{e.service}</span> },
                { header: "Action", cell: (e) => <span className="font-mono text-[11px] text-slate-800">{e.action}</span> },
                { header: "Resource", cell: (e) => <span className="max-w-[16rem] truncate font-mono text-[11px] text-slate-600">{e.resource}</span> },
                { header: "Result", cell: (e) => <span className={`text-[11px] font-bold ${e.result === "Failure" ? "text-red-600" : e.result === "Blocked" ? "text-amber-600" : "text-emerald-600"}`}>{e.result}</span> },
                { header: "Actor", cell: (e) => <span className="text-[11.5px] text-slate-600">{e.actor}</span> },
                { header: "Correlation", cell: (e) => <span className="font-mono text-[10.5px] text-slate-400">{e.correlationId.slice(0, 12)}</span> },
              ]}
            />
          </SectionCard>

          <SectionCard title="Redaction & saved views">
            <p className="text-[12.5px] leading-relaxed text-slate-600">{data.redaction.note}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {data.redaction.rules.map((r) => <li key={r} className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-600">{r}</li>)}
            </ul>
            <p className="mt-3 text-[11.5px] text-slate-400">{data.savedViewsNote}</p>
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
