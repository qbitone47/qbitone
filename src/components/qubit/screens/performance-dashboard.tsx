"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import {
  MetricTile,
  PlatformCard,
  PlatformError,
  PlatformNote,
  PlatformSkeleton,
  SourceLine,
  StatusDot,
  usePlatformSection,
  useVitalsCollector,
} from "../platform/parts";

// ============================================================
// Screen 302 · Performance Dashboard — real telemetry only. The
// server measures database latency (live SELECT 1), API round-trip
// (self-probe), process and OS resources at request time; the
// browser vitals collector reports this page's actual Core Web
// Vitals via PerformanceObserver. Nothing is estimated.
// ============================================================

interface PerfPayload {
  backend: {
    apiRttMs: number | null; apiNote: string;
    dbLatencyMs: number | null; dbNote: string; dbHealth: string;
    auditReadMs: number; auditRecentEvents: number;
    processUptimeMin: number; rssMb: number; heapUsedMb: number; eventLoopNote: string;
  };
  system: { platform: string; cpus: number; loadAvg: number[]; totalMemMb: number; freeMemMb: number; osUptimeH: number };
  vitals: { samples: number; lcpMs: number | null; cls: number | null; ttfbMs: number | null; fcpMs: number | null; note: string };
  thresholds: { apiMs: number; dbMs: number; lcpMs: number; cls: number; note: string };
  sourceNote: string;
}

const fmt = (v: number | null, unit = "ms") => (v === null ? "—" : `${v} ${unit}`);

export function PerformanceDashboardScreen() {
  const { data, loading, error, reload } = usePlatformSection<PerfPayload>("performance");
  // Real vitals collection from THIS page session (feed: vitals.report)
  useVitalsCollector("performance-dashboard");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Platform Ops" }]}
        title="Performance Dashboard"
        description="Frontend, backend and infrastructure telemetry — measured live at request time, never fabricated."
      />

      {loading && <PlatformSkeleton />}
      {error && !loading && <PlatformError message={error} onRetry={reload} />}
      {data && !loading && (
        <div className="space-y-5">
          <SectionCard title="Backend" description={data.backend.apiNote}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricTile label="API round-trip" value={fmt(data.backend.apiRttMs)} tone={data.backend.apiRttMs !== null && data.backend.apiRttMs > data.thresholds.apiMs ? "amber" : "green"} note={`threshold ${data.thresholds.apiMs} ms`} />
              <MetricTile label="Database latency" value={fmt(data.backend.dbLatencyMs)} tone={data.backend.dbLatencyMs !== null && data.backend.dbLatencyMs > data.thresholds.dbMs ? "amber" : data.backend.dbLatencyMs === null ? "red" : "green"} note={data.backend.dbHealth} />
              <MetricTile label="Audit read (200 ev)" value={`${data.backend.auditReadMs} ms`} note={`${data.backend.auditRecentEvents} recent events in trail`} />
              <MetricTile label="Process uptime" value={data.backend.processUptimeMin} unit="min" note={`RSS ${data.backend.rssMb} MB · heap ${data.backend.heapUsedMb} MB`} />
            </div>
            <p className="mt-3 text-[11.5px] text-slate-500">{data.backend.dbNote}</p>
          </SectionCard>

          <SectionCard title="Browser vitals (this session)" description={data.vitals.note}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricTile label="LCP" value={fmt(data.vitals.lcpMs)} tone={data.vitals.lcpMs !== null && data.vitals.lcpMs > data.thresholds.lcpMs ? "amber" : "green"} note={`threshold ${data.thresholds.lcpMs} ms`} />
              <MetricTile label="CLS" value={data.vitals.cls === null ? "—" : data.vitals.cls} tone={data.vitals.cls !== null && data.vitals.cls > data.thresholds.cls ? "amber" : "green"} note={`threshold ${data.thresholds.cls}`} />
              <MetricTile label="TTFB" value={fmt(data.vitals.ttfbMs)} />
              <MetricTile label="FCP" value={fmt(data.vitals.fcpMs)} />
            </div>
            <PlatformNote>
              {data.vitals.samples === 0
                ? "No vitals have been received yet. As soon as a Qubit One page with the collector reports (including this one, a few seconds after load), the measured values appear here."
                : `${data.vitals.samples} sample(s) received from real page sessions via the PerformanceObserver collector.`}
            </PlatformNote>
          </SectionCard>

          <SectionCard title="Infrastructure" description={data.backend.eventLoopNote}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricTile label="CPU cores" value={data.system.cpus} note={data.system.platform} />
              <MetricTile label="Load average" value={data.system.loadAvg.join(" / ")} />
              <MetricTile label="Memory free" value={Math.round(data.system.freeMemMb / 1024)} unit="GB" note={`of ${Math.round(data.system.totalMemMb / 1024)} GB`} />
              <MetricTile label="OS uptime" value={data.system.osUptimeH} unit="h" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <StatusDot health={data.backend.dbHealth === "healthy" ? "healthy" : data.backend.dbHealth === "degraded" ? "degraded" : "unavailable"} />
              <span className="text-[12px] text-slate-500">Database probe: {data.backend.dbNote}</span>
            </div>
          </SectionCard>

          <PlatformNote title="Thresholds & incidents">
            {data.thresholds.note}
          </PlatformNote>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
