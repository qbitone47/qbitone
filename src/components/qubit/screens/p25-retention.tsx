"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsHealthBadge, OpsSkeleton, OpsTable, SourceLine, fmtIST, timeAgo, useObsSection } from "../obs/parts";
import { obsPost } from "../obs/parts";
import { useRole } from "../role-context";

// ============================================================
// P25-22 · Observability Data Retention
// ENFORCED telemetry retention (no longer declarative): real row
// counts per event kind, audited prune action, hard row cap, and
// the honest provider-retention facts (spec: never claim retention
// guarantees the providers do not support).
// ============================================================

interface RetentionPayload {
  config: { telemetryRetentionDays: number; hardCapRows: number; samplingRatePct: number; requestEnabled: boolean; clientEnabled: boolean };
  persistence: { state: string; note: string; bufferLen: number };
  counts: { kind: string; count: number | string; store: string }[];
  lastPrune: { at: number; deleted: number; mode: string } | null;
  policy: { enforcement: string; providerFacts: string[] };
  actions: string[];
  sourceNote: string;
}

const KIND_LABEL: Record<string, string> = {
  request: "API request events", log: "Application logs", error: "Server errors", probe: "Probe measurements",
  "client-vital": "Client vitals", "client-error": "Client JS errors", "client-route": "Screen transitions", "client-request": "Client-observed requests",
};

export function P25RetentionScreen() {
  const { role } = useRole();
  const { data, loading, error, forbidden, reload } = useObsSection<RetentionPayload>("retention");
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [days, setDays] = React.useState<string>("");

  const prune = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await obsPost<{ ok: boolean; message?: string }>("retention.prune", {}, role);
      setFeedback(res.message ?? "Retention enforced.");
      reload();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Prune failed.");
    } finally {
      setBusy(false);
    }
  };

  const applyRetention = async () => {
    const n = Number(days);
    if (!Number.isFinite(n) || n < 1 || n > 365) {
      setFeedback("Telemetry retention must be between 1 and 365 days.");
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await obsPost<{ ok: boolean; message?: string }>("settings.update", { telemetryRetentionDays: n }, role);
      setFeedback(res.message ?? "Retention policy updated and audited.");
      setDays("");
      reload();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Data Retention"
        description="Enforced retention for the telemetry store — real counts, audited enforcement, and honest facts about what the platform providers do (and do not) retain."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <SectionCard title="Telemetry store" description="Live persistence state of the telemetry pipeline.">
            <FactRow label="Persistence" value={data.persistence.state} health={data.persistence.state === "ok" ? "healthy" : data.persistence.state === "degraded" ? "degraded" : "unavailable"} note={data.persistence.note} />
            <FactRow label="Events in buffer" value={data.persistence.bufferLen} note="In-process events awaiting a successful flush (also the fallback store when the database is unreachable)." />
            <FactRow label="Sampling" value={`${data.config.samplingRatePct}%`} note="Applies to request/client-vital/client-route/client-request kinds — errors and logs are never sampled out." />
            <FactRow label="Pipelines" value={`${data.config.requestEnabled ? "server" : "server off"} · ${data.config.clientEnabled ? "client" : "client off"}`} health={data.config.requestEnabled && data.config.clientEnabled ? "healthy" : "degraded"} note="Toggle in Observability Settings (Observability Settings)." />
          </SectionCard>

          <SectionCard title="Retention policy" description={data.policy.enforcement}>
            <div className="flex flex-wrap items-end gap-3">
              <FactRow label="Current retention" value={`${data.config.telemetryRetentionDays} day(s)`} note="Applies to ALL telemetry kinds; the hard cap below is enforced during every prune regardless." />
              <FactRow label="Hard row cap" value={data.config.hardCapRows.toLocaleString()} note="Oldest rows beyond the cap are trimmed — the store can never grow unbounded." />
              <FactRow label="Last prune" value={data.lastPrune ? `${data.lastPrune.deleted} deleted (${data.lastPrune.mode})` : "Never run"} note={data.lastPrune ? `${timeAgo(data.lastPrune.at)} · ${fmtIST(data.lastPrune.at)}` : undefined} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label htmlFor="retention-days" className="text-[11.5px] font-medium text-slate-600">Retention (days)</label>
              <input
                id="retention-days"
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder={`${data.config.telemetryRetentionDays}`}
                className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[12px] text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none"
              />
              <button type="button" onClick={applyRetention} disabled={busy || !days} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50">
                Update & audit
              </button>
              <button type="button" onClick={prune} disabled={busy} className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50">
                {busy ? "Running…" : "Run retention now"}
              </button>
              {feedback && <p className="text-[11.5px] text-slate-500" role="status">{feedback}</p>}
            </div>
          </SectionCard>

          <SectionCard title="Stored events by kind" description="Real row counts from the telemetry store; the in-process buffer is shown honestly when the database is unreachable.">
            <OpsTable
              rows={data.counts}
              keyOf={(c) => c.kind}
              columns={[
                { header: "Kind", cell: (c) => <span className="font-medium">{KIND_LABEL[c.kind] ?? c.kind}</span> },
                { header: "Events", cell: (c) => <span className="tabular-nums font-semibold">{typeof c.count === "number" ? c.count.toLocaleString() : c.count}</span> },
                { header: "Store", cell: (c) => <OpsHealthBadge health={c.store === "database" ? "healthy" : "degraded"} /> },
              ]}
              empty={<p className="text-[12.5px] text-slate-500">No telemetry recorded yet.</p>}
            />
          </SectionCard>

          <SectionCard title="Provider retention facts" description="What this application can and cannot guarantee.">
            <ul className="list-inside list-disc space-y-1.5 text-[12.5px] leading-relaxed text-slate-600">
              {data.policy.providerFacts.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
