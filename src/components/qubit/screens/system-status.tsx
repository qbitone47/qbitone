"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { useRole } from "../role-context";
import {
  PlatformError,
  PlatformNote,
  PlatformSkeleton,
  ProbeRow,
  SourceLine,
  usePlatformSection,
} from "../platform/parts";

// ============================================================
// Screen 308 · System Status — the one authoritative health view.
// Calm by design: overall state, component statuses, open incidents
// with their updates, and announced maintenance. Readable by every
// signed-in role; computed from the same live probes as Monitoring.
// ============================================================

interface StatusPayload {
  overall: "Operational" | "Degraded" | "Partial Outage";
  role: string;
  components: { id: string; label: string; status: string; latency: string; lastCheck: string; note: string }[];
  incidents: { id: string; service: string; startedAt: number; impact: string; status: string; updates: { at: number; text: string }[] }[];
  maintenance: { id: string; window: string; impact: string; source: string }[];
  categories: string[];
  calm: string;
  sourceNote: string;
}

const overallTone: Record<string, string> = {
  Operational: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Degraded: "border-amber-200 bg-amber-50 text-amber-800",
  "Partial Outage": "border-red-200 bg-red-50 text-red-800",
  "Major Outage": "border-red-300 bg-red-100 text-red-900",
  Maintenance: "border-slate-200 bg-slate-100 text-slate-700",
};

export function SystemStatusScreen() {
  const { role } = useRole();
  const { data, loading, error, reload } = usePlatformSection<StatusPayload>("status");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Platform Ops" }]}
        title="System Status"
        description="One authoritative view of Qubit One's health — current, honest, and deliberately calm."
      />

      {loading && <PlatformSkeleton />}
      {error && !loading && <PlatformError message={error} onRetry={reload} />}
      {data && !loading && (
        <div className="space-y-5">
          {/* Overall banner */}
          <div className={`rounded-2xl border p-5 ${overallTone[data.overall] ?? overallTone.Degraded}`} role="status">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">Overall status</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{data.overall}</p>
            <p className="mt-1 text-[12.5px] opacity-80">
              Viewing as {data.role} · refreshed {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })} IST
            </p>
          </div>

          <SectionCard title="Components" description="Application, API, database, stores, integrations, AI, storage, mail, WhatsApp, jobs and backups.">
            <div>
              {data.components.map((c) => (
                <ProbeRow
                  key={c.id}
                  label={c.label}
                  health={c.status === "Operational" ? "healthy" : c.status === "Degraded" ? "degraded" : c.status === "Partial Outage" ? "unavailable" : "maintenance"}
                  latency={c.latency !== "—" ? c.latency : undefined}
                  note={`${c.note} · checked ${c.lastCheck}`}
                  value={<span className="text-[12px] font-medium text-slate-600">{c.status}</span>}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Incidents" description="Open and recently resolved incidents with their update history.">
            {data.incidents.length ? (
              <ul className="space-y-3">
                {data.incidents.map((i) => (
                  <li key={i.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13.5px] font-semibold text-slate-900">{i.service}</p>
                      <span className="rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-[10.5px] font-bold text-amber-800">{i.status}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-slate-600">
                      Started {new Date(i.startedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} IST · {i.impact}
                    </p>
                    <ol className="mt-2 space-y-1.5 border-l-2 border-amber-200 pl-3">
                      {i.updates.map((u, idx) => (
                        <li key={idx} className="text-[11.5px] leading-snug text-slate-600">
                          <span className="font-medium tabular-nums text-slate-500">{new Date(u.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}</span> — {u.text}
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-slate-500">No incidents on record. Silence here is computed, not assumed.</p>
            )}
          </SectionCard>

          <SectionCard title="Maintenance" description="Announced windows, sourced from the notification engine.">
            {data.maintenance.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-[13px] font-semibold text-slate-900">{m.window}</p>
                <p className="mt-0.5 text-[12px] text-slate-600">{m.impact}</p>
                <p className="mt-1 text-[10.5px] text-slate-400">{m.source}</p>
              </div>
            ))}
          </SectionCard>

          <PlatformNote title="Reading this page">
            {data.calm}
          </PlatformNote>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
