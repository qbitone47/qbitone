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
  StatusWord,
  usePlatformSection,
} from "../platform/parts";

// ============================================================
// Screen 307 · Release Management — current build identity, the
// environment reality, the actual release history of this product,
// the lifecycle, and rollback readiness tied to the backup store.
// No fake deploy buttons: production deployment is not configured
// here and the screen says so (spec §28, §37, §50).
// ============================================================

interface ReleasePayload {
  current: { version: string; channel: string; screens: number; builtWith: string; note: string };
  environments: { id: string; label: string; status: string; note: string }[];
  lifecycle: string[];
  history: { version: string; date: string; scope: string; status: string; owner: string; rollback: string }[];
  safety: { migrations: string; deployGate: string; rollbackReadiness: string; ciNote: string };
  sourceNote: string;
}

export function ReleaseManagementScreen() {
  const { data, loading, error, reload } = usePlatformSection<ReleasePayload>("release");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Platform Ops" }]}
        title="Release Management"
        description="Release history, environments and rollback readiness — safe by default, honest by construction."
      />

      {loading && <PlatformSkeleton />}
      {error && !loading && <PlatformError message={error} onRetry={reload} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricTile label="Version" value={data.current.version.split(" ")[1] ?? data.current.version} note={data.current.channel} />
            <MetricTile label="Environments configured" value={data.environments.filter((e) => e.status === "Current").length} unit={`/${data.environments.length}`} />
            <MetricTile label="Rollback readiness" value={<StatusWord status={data.safety.rollbackReadiness.startsWith("Ready") ? "PASS" : "Degraded"} />} note={data.safety.rollbackReadiness} />
          </div>

          <SectionCard title="Current release" description={data.current.note}>
            <PlatformCard className="bg-slate-50/60">
              <p className="text-[14px] font-semibold text-slate-900">{data.current.version} — {data.current.channel}</p>
              <p className="mt-1 text-[12px] text-slate-500">{data.current.builtWith}</p>
            </PlatformCard>
          </SectionCard>

          <SectionCard title="Environments" description="Deployment infrastructure as it actually exists — including the parts that do not.">
            <ul className="divide-y divide-slate-100">
              {data.environments.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-slate-900">{e.label}</p>
                    <p className="text-[11.5px] leading-snug text-slate-500">{e.note}</p>
                  </div>
                  <StatusWord status={e.status === "Current" ? "PASS" : "Maintenance"} />
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Release lifecycle" description="Draft → Validation → Approved → Deploying → Verification → Released. Failure paths route to Failed → Rollback / Recovery.">
            <ol className="flex flex-wrap items-center gap-1.5">
              {data.lifecycle.map((s, i) => (
                <li key={s} className="flex items-center gap-1.5">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11.5px] font-medium text-slate-700">{s}</span>
                  {i < data.lifecycle.length - 1 && <span aria-hidden className="text-slate-300">→</span>}
                </li>
              ))}
            </ol>
            <PlatformNote>{data.safety.ciNote}</PlatformNote>
          </SectionCard>

          <SectionCard title="Release history" description="The real releases of this codebase — scope as shipped.">
            <ul className="divide-y divide-slate-100">
              {data.history.map((r) => (
                <li key={r.version} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-slate-900">{r.version} <span className="ml-1 font-normal text-slate-400">· {r.date} · {r.owner}</span></p>
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">rollback: {r.rollback}</span>
                      <StatusWord status={r.status === "Released" ? "PASS" : "Degraded"} />
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-snug text-slate-600">{r.scope}</p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Release safety" description="What stands between a change and production.">
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-slate-600">
              <li><span className="font-semibold text-slate-800">Migrations:</span> {data.safety.migrations}</li>
              <li><span className="font-semibold text-slate-800">Deploy gate:</span> {data.safety.deployGate}</li>
            </ul>
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
