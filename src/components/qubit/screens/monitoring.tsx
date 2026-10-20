"use client";

import * as React from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import {
  MetricTile,
  PlatformError,
  PlatformSkeleton,
  ProbeRow,
  SourceLine,
  StatusDot,
  type Health,
  usePlatformSection,
} from "../platform/parts";

// ============================================================
// Screen 306 · Monitoring — one centralized health view over the
// application, API, database, stores, integrations, AI, storage,
// mail, WhatsApp, scheduled jobs and backups. Computed live from
// real probes and the enterprise integration map at request time.
// ============================================================

interface MonPayload {
  services: { id: string; label: string; health: Health; latency: string; uptime: string; lastCheck: string; dependency: string; note: string }[];
  summary: { healthy: number; degraded: number; unavailable: number; maintenance: number };
  integrationFeed: { id: string; name: string; status: string; apiStatus: string; lastSync: string; latest: string | null }[];
  sourceNote: string;
}

export function MonitoringScreen() {
  const { data, loading, error, reload } = usePlatformSection<MonPayload>("monitoring");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Platform Ops" }]}
        title="Monitoring"
        description="Application, API, database, cache, integrations, AI services, storage, mail, WhatsApp, jobs and backups — one view, real probes only."
        actions={
          <Button variant="outline" onClick={reload} className="min-h-[44px]">
            <RefreshCcw className="mr-1.5 h-4 w-4" aria-hidden /> Re-probe now
          </Button>
        }
      />

      {loading && <PlatformSkeleton />}
      {error && !loading && <PlatformError message={error} onRetry={reload} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile label="Healthy" value={data.summary.healthy} tone="green" />
            <MetricTile label="Degraded" value={data.summary.degraded} tone={data.summary.degraded ? "amber" : "slate"} />
            <MetricTile label="Unavailable" value={data.summary.unavailable} tone={data.summary.unavailable ? "red" : "slate"} />
            <MetricTile label="Maintenance" value={data.summary.maintenance} />
          </div>

          <SectionCard title="Services" description="Latency, uptime, last check, dependency and health — as measured, with the probe method stated on each row.">
            <div>
              {data.services.map((s) => (
                <ProbeRow
                  key={s.id}
                  label={s.label}
                  health={s.health}
                  latency={s.latency !== "—" ? s.latency : undefined}
                  note={`${s.note} · dependency: ${s.dependency} · last check: ${s.lastCheck}${s.uptime !== "—" ? ` · uptime: ${s.uptime}` : ""}`}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Integration feed" description="Latest events from the enterprise integration map (screen 11) — the same source of truth, surfaced for operations.">
            <ul className="space-y-2.5">
              {data.integrationFeed.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900">{i.name}</p>
                    <p className="text-[11.5px] text-slate-500">{i.apiStatus} · synced {i.lastSync}</p>
                    {i.latest && <p className="mt-0.5 truncate text-[11px] text-slate-400">Latest: {i.latest}</p>}
                  </div>
                  <StatusDot health={i.status === "Connected" ? "healthy" : i.status === "Warning" ? "degraded" : "unavailable"} />
                </li>
              ))}
            </ul>
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
