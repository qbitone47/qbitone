"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsSkeleton, OpsTable, SourceLine, fmtIST, useObsSection } from "../obs/parts";

// ============================================================
// P23-03 · Logs Explorer — TWO real streams, ONE view (Phase 25):
// the enterprise audit trail + structured application telemetry
// (request metering, logs, server errors, probes, client events).
// Server-side filters (q / level / source) are applied by the obs
// API; sensitive values are never present to redact (enforced at
// the writeAudit / recordTelemetry sources).
// ============================================================

interface LogEvent {
  id: string;
  ts: number;
  time: string;
  severity: string;
  level: string;
  service: string;
  source: "audit" | "telemetry";
  kind: string;
  actor: string | null;
  action: string | null;
  resource: string | null;
  result: string | null;
  correlationId: string | null;
  requestId: string | null;
  method: string | null;
  status: number | null;
  durationMs: number | null;
  screen: string | null;
  release: string | null;
  message: string | null;
}

interface LogsPayload {
  stream: { kind: string; note: string };
  events: LogEvent[];
  counts: { audit: number; telemetry: number };
  store: { source: string; persistence: string; note: string };
  filters: {
    applied: { q: string | null; level: string | null; source: string | null; route: string | null; requestId: string | null; sinceMs: number | null };
    supported: { level: string[]; source: string[]; note: string };
  };
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

const streamTone: Record<LogEvent["source"], string> = {
  audit: "border-slate-200 bg-slate-100 text-slate-600",
  telemetry: "border-sky-200 bg-sky-50 text-sky-700",
};

function resultTone(e: LogEvent): string {
  if (e.result == null) return "text-slate-400";
  const n = Number(e.result);
  if (e.result === "Failure" || (!Number.isNaN(n) && n >= 500)) return "text-red-600";
  if (e.result === "Blocked" || (!Number.isNaN(n) && n >= 400)) return "text-amber-600";
  return "text-emerald-600";
}

export function P23LogsExplorerScreen() {
  const [applied, setApplied] = React.useState<{ q?: string; level?: string; source?: string }>({});
  const { data, loading, error, forbidden, reload } = useObsSection<LogsPayload>("logs", applied);
  const [qDraft, setQDraft] = React.useState("");
  const [levelDraft, setLevelDraft] = React.useState("");
  const [sourceDraft, setSourceDraft] = React.useState("");

  function applyFilters() {
    setApplied({ q: qDraft.trim(), level: levelDraft, source: sourceDraft });
  }
  function clearFilters() {
    setQDraft("");
    setLevelDraft("");
    setSourceDraft("");
    setApplied({});
  }

  const rows = React.useMemo(() => (data ? data.events.slice(0, 120) : []), [data]);
  const appliedActive = Boolean(applied.q || applied.level || applied.source);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Logs Explorer"
        description="Two real streams in one view — the enterprise audit trail + application telemetry. Server-enforced scope, secrets never present."
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
            <p className="mt-2 font-semibold text-slate-700 tabular-nums">
              audit {data.counts.audit} · telemetry {data.counts.telemetry}
              <span className="ml-2 font-normal text-slate-500">event(s) matched in this server window</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Telemetry store: {data.store.source} · persistence {data.store.persistence} — {data.store.note}
            </p>
          </div>

          <SectionCard title="Filters" description="Applied server-side by the /api/obs logs section — the query runs against both streams, not the rendered rows.">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="log-search" className="mb-1 block text-[11px] font-semibold text-slate-600">Search (action, resource, actor, message, correlation ID)</label>
                <input id="log-search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="e.g. ops.flag or INC-"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label htmlFor="log-level" className="mb-1 block text-[11px] font-semibold text-slate-600">Level</label>
                <select id="log-level" value={levelDraft} onChange={(e) => setLevelDraft(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px]">
                  <option value="">All levels</option>
                  {data.filters.supported.level.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="log-stream" className="mb-1 block text-[11px] font-semibold text-slate-600">Stream</label>
                <select id="log-stream" value={sourceDraft} onChange={(e) => setSourceDraft(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px]">
                  <option value="">All streams</option>
                  {data.filters.supported.source.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={applyFilters}
                className="min-h-[32px] rounded-lg border border-slate-900 bg-slate-900 px-4 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-700"
              >
                Apply filters
              </button>
              {appliedActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="min-h-[32px] rounded-lg border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {appliedActive
                ? `Applied — q: ${data.filters.applied.q ?? "—"} · level: ${data.filters.applied.level ?? "—"} · source: ${data.filters.applied.source ?? "—"}`
                : "No filters applied — the full server window is shown."}{" "}
              {data.filters.supported.note}
            </p>
          </SectionCard>

          <SectionCard title={`Events (${rows.length})`} description="Timestamp, severity, stream, service, action, resource, result, actor, correlation, message — the real record.">
            <OpsTable
              rows={rows}
              keyOf={(e) => e.id}
              empty={<p className="px-3 py-6 text-center text-[12.5px] text-slate-500">No events match the current filters. An empty result is a real result.</p>}
              columns={[
                { header: "Time", cell: (e) => <span className="whitespace-nowrap tabular-nums text-[11.5px] text-slate-500">{fmtIST(e.ts)}</span> },
                { header: "Severity", cell: (e) => <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${sevTone[e.severity] ?? sevTone.Info}`}>{e.severity}</span> },
                {
                  header: "Stream",
                  cell: (e) => <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${streamTone[e.source]}`}>{e.source}</span>,
                  className: "whitespace-nowrap",
                },
                { header: "Service", cell: (e) => <span className="text-[11.5px] text-slate-500">{e.service}</span> },
                { header: "Action", cell: (e) => <span className="font-mono text-[11px] text-slate-800">{e.action ?? e.kind ?? "—"}</span> },
                {
                  header: "Resource",
                  cell: (e) => (
                    <div className="min-w-0">
                      <span className="block max-w-[16rem] truncate font-mono text-[11px] text-slate-600">{e.resource ?? "—"}</span>
                      {e.status != null && (
                        <span className="mt-0.5 block whitespace-nowrap font-mono text-[10px] tabular-nums text-slate-400">
                          {e.method ? `${e.method} ` : ""}{e.status}{e.durationMs != null ? ` · ${e.durationMs}ms` : ""}
                        </span>
                      )}
                      {e.status == null && e.screen != null && (
                        <span className="mt-0.5 block max-w-[16rem] truncate text-[10px] text-slate-400">screen {e.screen}</span>
                      )}
                    </div>
                  ),
                },
                { header: "Result", cell: (e) => <span className={`text-[11px] font-bold ${resultTone(e)}`}>{e.result ?? "—"}</span> },
                { header: "Actor", cell: (e) => <span className="text-[11.5px] text-slate-600">{e.actor ?? "—"}</span> },
                { header: "Correlation", cell: (e) => <span className="font-mono text-[10.5px] text-slate-400">{e.correlationId ? e.correlationId.slice(0, 12) : "—"}</span> },
                { header: "Message", cell: (e) => <span className="block max-w-[18rem] truncate text-[11px] text-slate-500" title={e.message ?? undefined}>{e.message ?? "—"}</span> },
              ]}
            />
            <p className="mt-2 text-[11px] text-slate-400">{rows.length} of {data.events.length} events in the filtered server window · first 120 rows rendered (virtualization over larger windows is a Future Extension).</p>
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
