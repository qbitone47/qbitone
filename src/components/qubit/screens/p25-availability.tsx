"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, NotConfiguredCard, OpsError, OpsHealthBadge, OpsSkeleton, OpsTable, SourceLine, fmtIST, timeAgo, useObsSection } from "../obs/parts";

// ============================================================
// P25-10 · Availability & Uptime
// Availability measured from REAL request telemetry (Phase 25):
// success ratio over 24h/7d, hourly error buckets, recent 5xx
// events. No external prober exists — an SLA percentage is never
// claimed without measured data.
// ============================================================

interface AvailabilityPayload {
  current: { successPct: number | null; requests: number; serverErrors: number; label: string };
  window7d: { successPct: number | null; requests: number; serverErrors: number; label: string };
  series: { buckets: { at: number; count: number; errors: number }[]; note: string };
  healthChecks: { ok: number; fail: number; uptimePct: number | null; note: string };
  downtime: { events: { ts: number; route: string | null; status: number | null }[]; note: string };
  externalProber: { configured: boolean; note: string };
  sloLink: string;
  sourceNote: string;
}

const tone = (pct: number | null): string =>
  pct == null ? "border-slate-200 bg-slate-50 text-slate-700" : pct >= 99.5 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : pct >= 95 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-800";

export function P25AvailabilityScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<AvailabilityPayload>("availability");
  const maxBucket = data ? Math.max(1, ...data.series.buckets.map((b) => b.count)) : 1;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Availability & Uptime"
        description="Availability computed from real request telemetry recorded by the request metering layer — every figure is measured, gaps are labeled."
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
          <div className="grid gap-5 lg:grid-cols-2">
            <div className={`rounded-2xl border p-5 ${tone(data.current.successPct)}`} role="status" aria-label={`24 hour request success ${data.current.successPct == null ? "insufficient data" : `${data.current.successPct} percent`}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">Request success · last 24h</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{data.current.successPct == null ? "Insufficient data" : `${data.current.successPct}%`}</p>
              <p className="mt-1 text-[12px] opacity-80">{data.current.requests} request(s) · {data.current.serverErrors} × 5xx</p>
              <p className="mt-1 text-[11px] opacity-70">{data.current.label}</p>
            </div>
            <div className={`rounded-2xl border p-5 ${tone(data.window7d.successPct)}`} role="status" aria-label={`7 day request success ${data.window7d.successPct == null ? "insufficient data" : `${data.window7d.successPct} percent`}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">Request success · last 7 days</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{data.window7d.successPct == null ? "Insufficient data" : `${data.window7d.successPct}%`}</p>
              <p className="mt-1 text-[12px] opacity-80">{data.window7d.requests} request(s) · {data.window7d.serverErrors} × 5xx</p>
              <p className="mt-1 text-[11px] opacity-70">{data.window7d.label}</p>
            </div>
          </div>

          <SectionCard title="Hourly request volume & errors" description={data.series.note}>
            {data.series.buckets.every((b) => b.count === 0) ? (
              <p className="text-[12.5px] text-slate-500">No requests recorded in the last 24h — the chart stays empty rather than showing invented history.</p>
            ) : (
              <div className="flex items-end gap-1.5" role="img" aria-label="Hourly request volume with error overlay for the last 24 hours">
                {data.series.buckets.map((b, i) => (
                  <div key={i} className="group relative flex min-h-16 flex-1 flex-col justify-end" title={`${fmtIST(b.at, false)} — ${b.count} request(s), ${b.errors} error(s)`}>
                    {b.errors > 0 && (
                      <div className="w-full rounded-t bg-red-400" style={{ height: `${Math.max(6, (b.errors / maxBucket) * 100)}%` }} />
                    )}
                    <div className={`w-full ${b.errors > 0 ? "" : "rounded-t"} bg-slate-300 group-hover:bg-slate-400`} style={{ height: `${Math.max(3, ((b.count - b.errors) / maxBucket) * 100)}%` }} />
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 flex flex-wrap gap-4 text-[10.5px] text-slate-400">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-slate-300" /> successful</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-red-400" /> 5xx errors</span>
            </p>
          </SectionCard>

          <SectionCard title="Recent 5xx events (downtime evidence)" description={data.downtime.note}>
            {data.downtime.events.length === 0 ? (
              <p className="text-[12.5px] text-slate-500">No 5xx responses recorded in the window — no downtime events to list.</p>
            ) : (
              <OpsTable
                rows={data.downtime.events}
                keyOf={(e) => `${e.ts}-${e.route ?? ""}-${e.status ?? ""}`}
                columns={[
                  { header: "When", cell: (e) => <span className="tabular-nums">{fmtIST(e.ts)}</span> },
                  { header: "Route", cell: (e) => <span className="font-mono text-[11px]">{e.route ?? "—"}</span> },
                  { header: "Status", cell: (e) => <span className="font-semibold text-red-600">{e.status ?? "—"}</span> },
                  { header: "Age", cell: (e) => timeAgo(e.ts) },
                ]}
                empty={<p className="text-[12.5px] text-slate-500">No events.</p>}
              />
            )}
          </SectionCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Health-check signals" description="Real probe measurements recorded by operational sections + /api/health metering.">
              <FactRow label="Probe checks OK" value={data.healthChecks.ok} />
              <FactRow label="Probe checks failed" value={data.healthChecks.fail} health={data.healthChecks.fail > 0 ? "degraded" : "healthy"} />
              <FactRow label="Probe uptime" value={data.healthChecks.uptimePct == null ? "Insufficient data" : `${data.healthChecks.uptimePct}%`} health={data.healthChecks.uptimePct == null ? "not-configured" : data.healthChecks.uptimePct >= 99 ? "healthy" : "degraded"} note={data.healthChecks.note} />
            </SectionCard>
            <SectionCard title="External prober" description="Honest configuration state.">
              <NotConfiguredCard
                title="No external availability monitor"
                note={data.externalProber.note}
                recommendation={data.sloLink}
              />
            </SectionCard>
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
