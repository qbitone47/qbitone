"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsSkeleton, SourceLine, fmtIST, timeAgo, useObsSection } from "../obs/parts";

// ============================================================
// P23-19 · Incident Correlation — one window over the real
// audit trail, governance registries and Phase 25 telemetry
// (server + client error events). Relationships shown are
// temporal co-occurrence in real data — causality is never
// asserted. Empty groups are honest results.
// ============================================================

interface CorrelatedIncident { id: string; severity: string; title: string; startedAt: number; status: string }
interface CorrelatedAlert { id: string; ruleName: string; severity: string; triggeredAt: number; status: string }
interface CorrelatedChange { ts: number; who: string; action: string; resource: string }
interface CorrelatedError { ts: number; action: string; resource: string; severity: string }
interface TimelineItem { at: number; kind: string; text: string }

interface CorrelationPayload {
  windowMs: number;
  incidents: CorrelatedIncident[];
  alerts: CorrelatedAlert[];
  changes: CorrelatedChange[];
  errors: CorrelatedError[];
  timeline: TimelineItem[];
  rule: string;
  sourceNote: string;
}

const sevTone: Record<string, string> = {
  "SEV-1": "border-red-200 bg-red-50 text-red-800",
  "SEV-2": "border-amber-200 bg-amber-50 text-amber-800",
  Critical: "border-red-200 bg-red-50 text-red-800",
  High: "border-orange-200 bg-orange-50 text-orange-800",
  Warning: "border-amber-200 bg-amber-50 text-amber-800",
  Info: "border-slate-200 bg-slate-50 text-slate-600",
};

const kindTone: Record<string, string> = {
  incident: "border-red-200 bg-red-50 text-red-800",
  alert: "border-amber-200 bg-amber-50 text-amber-800",
  change: "border-blue-200 bg-blue-50 text-blue-800",
  "telemetry-error": "border-red-200 bg-red-50 text-red-800",
};

const kindDot: Record<string, string> = {
  incident: "bg-red-500 ring-red-300",
  alert: "bg-amber-500 ring-amber-300",
  change: "bg-blue-500 ring-blue-300",
  "telemetry-error": "bg-red-400 ring-red-300",
};

function SevChip({ severity }: { severity: string }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${sevTone[severity] ?? sevTone.Info}`}>{severity}</span>
  );
}

function EmptyGroup({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-[11.5px] text-slate-500" role="status">
      No {label} in the window — an empty group is a real result, not a gap.
    </p>
  );
}

const WINDOW_OPTIONS = [
  { label: "Last 1 hour", ms: 3_600_000 },
  { label: "Last 24 hours", ms: 86_400_000 },
  { label: "Last 7 days", ms: 604_800_000 },
];

export function P23IncidentCorrelationScreen() {
  const [windowSel, setWindowSel] = React.useState("86400000");
  const { data, loading, error, forbidden, reload } = useObsSection<CorrelationPayload>("correlation", { windowMs: windowSel });

  const timeline = React.useMemo(
    () => (data ? [...data.timeline].sort((a, b) => b.at - a.at) : []),
    [data],
  );

  const windowHours = data ? Math.round((data.windowMs / 3_600_000) * 10) / 10 : null;
  const selected = WINDOW_OPTIONS.find((w) => String(w.ms) === windowSel);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Incident Correlation"
        description="Incidents, alerts, changes and errors placed on one real timeline. Co-occurrence is shown; causality is never asserted."
        actions={
          <button type="button" onClick={reload} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
            Refresh
          </button>
        }
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 text-[12px] leading-relaxed text-blue-900" role="note">
            {data.rule}
          </div>

          <SectionCard title="Correlation window" description="Server-side scope — changing the selection refetches this section with the selected window (windowMs).">
            <div className="grid gap-3 sm:grid-cols-[14rem_1fr] sm:items-start">
              <div>
                <label htmlFor="corr-window" className="mb-1 block text-[11px] font-semibold text-slate-600">Window</label>
                <select
                  id="corr-window"
                  value={windowSel}
                  onChange={(e) => setWindowSel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px]"
                >
                  {WINDOW_OPTIONS.map((w) => <option key={w.ms} value={String(w.ms)}>{w.label}</option>)}
                </select>
              </div>
              <p className="text-[11.5px] leading-relaxed text-slate-500 sm:pt-6" role="note">
                The payload below was fetched server-side with a
                {" "}<span className="tabular-nums">{data.windowMs.toLocaleString()} ms{windowHours != null ? ` ≈ ${windowHours} h` : ""}</span>{" "}
                window ({selected?.label ?? "custom"}). All groups and the unified timeline cover exactly this window — the server computes the scope, never the client.
              </p>
            </div>
          </SectionCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title={`Incidents (${data.incidents.length})`} description="From the Phase 22 incident registry within the window.">
              {data.incidents.length === 0 ? (
                <EmptyGroup label="incidents" />
              ) : (
                <ul className="space-y-2.5">
                  {data.incidents.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-semibold text-slate-800">{i.title}</p>
                        <p className="text-[11px] text-slate-500">{i.id} · started {fmtIST(i.startedAt)} ({timeAgo(i.startedAt)})</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <SevChip severity={i.severity} />
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">{i.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title={`Alerts (${data.alerts.length})`} description="Real triggered alerts from live-measured metrics.">
              {data.alerts.length === 0 ? (
                <EmptyGroup label="alerts" />
              ) : (
                <ul className="space-y-2.5">
                  {data.alerts.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/50 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-semibold text-slate-800">{a.ruleName}</p>
                        <p className="text-[11px] text-slate-500">triggered {fmtIST(a.triggeredAt)} ({timeAgo(a.triggeredAt)})</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <SevChip severity={a.severity} />
                        <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-bold text-amber-800">{a.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title={`Changes (${data.changes.length})`} description="Change-class audit events within the window (first 30).">
              {data.changes.length === 0 ? (
                <EmptyGroup label="changes" />
              ) : (
                <ul className="space-y-2.5">
                  {data.changes.map((c, idx) => (
                    <li key={`${c.ts}-${idx}`} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="whitespace-nowrap tabular-nums text-[11px] text-slate-500">{fmtIST(c.ts, false)}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-700">{c.action}</span>
                      </div>
                      <p className="mt-1 truncate text-[12px] text-slate-600">
                        <span className="font-semibold">{c.who}</span> · <span className="font-mono text-[11px] text-slate-500">{c.resource}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title={`Errors (${data.errors.length})`} description="Failure/Blocked audit events + Phase 25 telemetry errors (server + client) merged, most recent first.">
              {data.errors.length === 0 ? (
                <EmptyGroup label="errors" />
              ) : (
                <ul className="space-y-2.5">
                  {data.errors.map((e, idx) => (
                    <li key={`${e.ts}-${idx}`} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="whitespace-nowrap tabular-nums text-[11px] text-slate-500">{fmtIST(e.ts, false)}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-700">{e.action}</span>
                        <span className={`text-[10.5px] font-bold ${e.severity === "Critical" || e.severity === "High" ? "text-red-600" : "text-amber-600"}`}>{e.severity}</span>
                      </div>
                      <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{e.resource}</p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <SectionCard title={`Unified timeline (${timeline.length})`} description="Incidents, alerts, changes and telemetry errors merged, most recent first. Chips are color-coded by kind — telemetry errors carry the amber/red tone.">
            {timeline.length === 0 ? (
              <EmptyGroup label="events in the unified timeline" />
            ) : (
              <ol className="relative ml-1 max-h-96 space-y-0 overflow-y-auto border-l border-slate-200 pl-5 qubit-scroll" aria-label="Unified correlation timeline">
                {timeline.map((t, idx) => (
                  <li key={`${t.at}-${idx}`} className="relative pb-4 last:pb-0">
                    <span aria-hidden="true" className={`absolute -left-[26.5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ring-1 ${kindDot[t.kind] ?? "bg-slate-400 ring-slate-300"}`} />
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${kindTone[t.kind] ?? "border-slate-200 bg-slate-50 text-slate-600"}`}>{t.kind}</span>
                      <span className="min-w-0 flex-1 text-[12.5px] text-slate-700">{t.text}</span>
                      <span className="whitespace-nowrap tabular-nums text-[11px] text-slate-400">{fmtIST(t.at, false)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
