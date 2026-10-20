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
  ProbeRow,
  SourceLine,
  StatusWord,
  usePlatformSection,
} from "../platform/parts";

// ============================================================
// Screen 304 · Security Hardening — the security posture across
// authentication, authorization, application, infrastructure and
// data. Measured where measurable (headers from a real response,
// session/policy/alert stores), honest "Not configured" where not.
// Never displays a secret, password, token or key (spec §25).
// ============================================================

interface SecPayload {
  domains: { id: string; label: string; checks: string[] }[];
  posture: Record<string, Record<string, { status: string; detail: string }>>;
  headers: { header: string; present: boolean; value: string | null; note: string }[];
  alerts: { open: number; total: number; note: string };
  forbidden: string[];
  sourceNote: string;
}

const DOMAIN_LABELS: Record<string, string> = {
  authentication: "Authentication",
  authorization: "Authorization",
  application: "Application",
  infrastructure: "Infrastructure",
  data: "Data",
};

export function SecurityHardeningScreen() {
  const { data, loading, error, reload } = usePlatformSection<SecPayload>("security");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Platform Ops" }]}
        title="Security Hardening"
        description="Security posture across identity, application, infrastructure and data — precise words only: Enforced means enforced; Not configured means not configured."
      />

      {loading && <PlatformSkeleton />}
      {error && !loading && <PlatformError message={error} onRetry={reload} />}
      {data && !loading && (
        <div className="space-y-5">
          {Object.entries(data.posture).map(([domain, checks]) => (
            <SectionCard key={domain} title={DOMAIN_LABELS[domain] ?? domain} description={`${data.domains.find((d) => d.id === domain)?.checks.length ?? Object.keys(checks).length} checks`}>
              <div>
                {Object.entries(checks).map(([check, v]) => (
                  <ProbeRow
                    key={check}
                    label={check.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}
                    health={v.status === "Enforced" || v.status === "Configured" || v.status === "Active" || v.status === "Managed" || v.status === "Monitored" || v.status === "Reviewed" || v.status === "Measured" ? "healthy" : v.status === "Partial" ? "degraded" : v.status === "Not configured" || v.status === "Not connected" || v.status === "None recorded" ? "unavailable" : "maintenance"}
                    note={v.detail}
                    value={<StatusWord status={v.status} />}
                  />
                ))}
              </div>
            </SectionCard>
          ))}

          <SectionCard title="Security headers (measured from a live response)" description="Read from this server's own HTTP response at request time.">
            <div className="grid gap-2 sm:grid-cols-2">
              {data.headers.map((h) => (
                <PlatformCard key={h.header} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[12px] font-semibold text-slate-800">{h.header}</p>
                    <StatusWord status={h.present ? (h.header === "X-Powered-By" ? "Degraded" : "PASS") : h.header === "X-Powered-By" ? "PASS" : "Degraded"} />
                  </div>
                  <p className="mt-1 truncate font-mono text-[10.5px] text-slate-400">{h.value ?? "not present"}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{h.note}</p>
                </PlatformCard>
              ))}
            </div>
            <PlatformNote tone="warn" title="Reading the header board">
              A present <code className="font-mono">X-Powered-By</code> is a (minor) framework disclosure and is flagged as such. Missing protective headers in this dev environment reflect the gateway's production responsibility — stated, not hidden.
            </PlatformNote>
          </SectionCard>

          <div className="grid gap-5 sm:grid-cols-2">
            <SectionCard title="Security alerts" description="From the existing Security Alerts workflow (screen 40).">
              <div className="grid grid-cols-2 gap-3">
                <MetricTile label="Open alerts" value={data.alerts.open} tone={data.alerts.open ? "amber" : "green"} />
                <MetricTile label="Total tracked" value={data.alerts.total} />
              </div>
              <p className="mt-2 text-[11.5px] text-slate-500">{data.alerts.note}</p>
            </SectionCard>

            <SectionCard title="What this screen will never show" description="Spec §25 is absolute.">
              <ul className="flex flex-wrap gap-2">
                {data.forbidden.map((f) => (
                  <li key={f} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11.5px] font-medium text-red-700">{f}</li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
