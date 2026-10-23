"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsSkeleton, OpsTable, SourceLine, timeAgo, useObsSection } from "../obs/parts";
import { obsPost } from "../obs/parts";
import { useRole } from "../role-context";

// ============================================================
// P25-21 · Observability Access
// The role → section read matrix over the EXISTING 5-role RBAC.
// Server-enforced (fail-closed), deny-by-default, audited. The
// Logs Explorer is never delegable; all mutations stay
// administrator-only.
// ============================================================

interface AccessEntry {
  role: string;
  read: string | string[];
  updatedAt: number;
  updatedBy: string | null;
}

interface AccessPayload {
  matrix: AccessEntry[];
  delegableSections: string[];
  allSections: string[];
  enforcement: string;
  sensitiveLogsNote: string;
  writePolicy: string;
  persistenceNote: string;
  sourceNote: string;
}

const ROLE_LABEL: Record<string, string> = {
  administrator: "Administrator",
  "dept-head": "Department Head",
  "sales-exec": "Sales Executive",
  "hr-manager": "HR Manager",
  employee: "Employee",
};

const SECTION_LABEL: Record<string, string> = {
  home: "Observability Home", metrics: "Metrics Explorer", logs: "Logs Explorer", traces: "Distributed Traces",
  "service-map": "Service Map", dependencies: "Dependency Health", "api-performance": "API Performance",
  "database-performance": "Database Performance", "web-performance": "Web Performance", errors: "Error Intelligence",
  alerts: "Alert Center", "alert-rules": "Alert Rules", slo: "SLO / SLA", scorecard: "Reliability Scorecard",
  capacity: "Capacity", infrastructure: "Infrastructure", "deployment-impact": "Deployment Impact",
  changes: "Change Intelligence", correlation: "Incident Correlation", runbooks: "Runbooks", oncall: "On-Call",
  reports: "Reliability Reports", "ai-insights": "AI Insights", settings: "Obs Settings",
  availability: "Availability & Uptime", activity: "Operational Activity", access: "Obs Access", retention: "Retention",
};

export function P25AccessScreen() {
  const { role } = useRole();
  const { data, loading, error, forbidden, reload } = useObsSection<AccessPayload>("access");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [grantSections, setGrantSections] = React.useState<Record<string, string[]>>({});

  const toggleSection = (target: string, section: string) => {
    setGrantSections((prev) => {
      const cur = prev[target] ?? [];
      return { ...prev, [target]: cur.includes(section) ? cur.filter((s) => s !== section) : [...cur, section] };
    });
  };

  const run = async (type: string, input: Record<string, unknown>, target: string) => {
    setBusy(target);
    setFeedback(null);
    try {
      const res = await obsPost<{ ok: boolean; message?: string }>(type, input, role);
      setFeedback(res.message ?? "Done.");
      reload();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Observability Access"
        description="Who can see operational data — a server-enforced, audited read matrix over the existing 5-role RBAC. Deny-by-default; the Logs Explorer is never delegable."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <SectionCard title="Enforcement model" description="How access is actually decided.">
            <FactRow label="Authorization source" value="Signed session cookie" note={data.enforcement} />
            <FactRow label="Sensitive logs" value="Administrator-only" note={data.sensitiveLogsNote} />
            <FactRow label="Mutations" value="Administrator-only" note={data.writePolicy} />
            <FactRow label="Cold-start behavior" value="Deny-by-default restored" note={data.persistenceNote} />
          </SectionCard>

          <SectionCard title="Access matrix" description="Administrator always holds every section and cannot be modified. Grants below apply immediately to live sessions (server-side check on every request).">
            <OpsTable
              rows={data.matrix}
              keyOf={(m) => m.role}
              columns={[
                { header: "Role", cell: (m) => <span className="font-semibold">{ROLE_LABEL[m.role] ?? m.role}</span> },
                {
                  header: "Read grants",
                  cell: (m) => m.read === "all"
                    ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">All sections</span>
                    : Array.isArray(m.read) && m.read.length
                      ? <span className="text-[11px] text-slate-600">{m.read.map((s) => SECTION_LABEL[s] ?? s).join(", ")}</span>
                      : <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">None (deny-by-default)</span>,
                },
                { header: "Updated", cell: (m) => <span className="text-[11px] text-slate-500">{timeAgo(m.updatedAt)}{m.updatedBy ? ` · ${m.updatedBy}` : ""}</span> },
                {
                  header: "Actions",
                  cell: (m) => m.role === "administrator" ? <span className="text-[10.5px] text-slate-300">—</span> : (
                    <button
                      type="button"
                      disabled={busy === m.role}
                      onClick={() => run("access.revoke", { role: m.role }, m.role)}
                      className="rounded-md border border-red-200 bg-white px-2 py-1 text-[10.5px] font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      Revoke all
                    </button>
                  ),
                },
              ]}
              empty={<p className="text-[12.5px] text-slate-500">No matrix entries.</p>}
            />
          </SectionCard>

          {data.matrix.filter((m) => m.role !== "administrator").map((m) => (
            <SectionCard
              key={m.role}
              title={`Grant read access — ${ROLE_LABEL[m.role] ?? m.role}`}
              description="Pick the sections this role may view, then apply. Empty selection revokes everything. Every change is written to the audit trail."
            >
              <div className="flex flex-wrap gap-1.5">
                {data.delegableSections.map((s) => {
                  const selected = (grantSections[m.role] ?? (Array.isArray(m.read) ? [...m.read] : [])).includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleSection(m.role, s)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${selected ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                    >
                      {SECTION_LABEL[s] ?? s}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  disabled={busy === m.role}
                  onClick={() => run("access.grant", { role: m.role, sections: grantSections[m.role] ?? (Array.isArray(m.read) ? m.read : []) }, m.role)}
                  className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy === m.role ? "Applying…" : "Apply grants"}
                </button>
                {feedback && busy == null && <p className="text-[11.5px] text-slate-500" role="status">{feedback}</p>}
              </div>
            </SectionCard>
          ))}

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
