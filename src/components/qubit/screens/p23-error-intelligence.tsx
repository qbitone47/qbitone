"use client";

import * as React from "react";
import { PageHeader } from "../page-header";
import { SectionCard, StatusBadge } from "../primitives";
import { OpsError, OpsSkeleton, SourceLine, fmtIST, timeAgo, useObsSection } from "../obs/parts";

// ============================================================
// P23-10 · Error Intelligence — failure/blocked events grouped
// from the ONE enterprise audit trail PLUS Phase 25 error
// telemetry (server + client). No synthetic groups; an empty
// list genuinely means no failures in the window.
// ============================================================

interface ErrorGroup {
  key: string;
  title: string;
  source: "audit-trail" | "application-error" | "client-error";
  frequency: number;
  affectedRoutes: string[];
  affectedScreens: string[];
  firstSeen: number;
  lastSeen: number;
  severity: string;
  status: string;
  releases: string[];
  deploymentVersion: string | null;
  trend: string;
}

interface ErrorsPayload {
  groups: ErrorGroup[];
  basis: string;
  links: { deployments: string; logs: string; incidents: string };
  sourceNote: string;
}

/** audit-trail → slate, application-error → red tone, client-error → amber tone. */
function sourceChip(source: string): React.ReactNode {
  if (source === "application-error") {
    return <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-800">application-error</span>;
  }
  if (source === "client-error") {
    return <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">client-error</span>;
  }
  return <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">{source}</span>;
}

function trendChip(trend: string): React.ReactNode {
  return trend === "recurring" ? (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">{trend}</span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">{trend}</span>
  );
}

function GroupCard({ group }: { group: ErrorGroup }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]" aria-label={`Error group ${group.title}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 font-mono text-[12px] font-semibold text-slate-800" title={group.title}>{group.title}</p>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {sourceChip(group.source)}
          <span className="rounded-full border border-slate-900 bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums" aria-label={`Occurred ${group.frequency} times`}>×{group.frequency}</span>
          <StatusBadge status={group.severity} size="sm" />
        </div>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-2 text-[12px] sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">First seen</dt>
          <dd className="mt-0.5 tabular-nums text-slate-700">{fmtIST(group.firstSeen)} <span className="text-slate-400">· {timeAgo(group.firstSeen)}</span></dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">Last seen</dt>
          <dd className="mt-0.5 tabular-nums text-slate-700">{fmtIST(group.lastSeen)} <span className="text-slate-400">· {timeAgo(group.lastSeen)}</span></dd>
        </div>
        <div>
          <dt className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">Trend</dt>
          <dd className="mt-0.5">{trendChip(group.trend)}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">Status</dt>
          <dd className="mt-0.5 text-slate-700">{group.status}</dd>
        </div>
      </dl>

      <div className="mt-3">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">Affected routes</p>
        {group.affectedRoutes.length === 0 ? (
          <p className="mt-1 text-[11.5px] text-slate-400">No routes recorded.</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {group.affectedRoutes.map((r) => (
              <li key={r} className="max-w-full truncate rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600" title={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>

      {group.affectedScreens.length > 0 && (
        <div className="mt-3">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">Affected screens</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {group.affectedScreens.map((s) => (
              <li key={s} className="max-w-full truncate rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600" title={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {group.releases.length > 0 && (
        <div className="mt-3">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">Releases</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {group.releases.map((r) => (
              <li key={r} className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10.5px] text-slate-500" title={r}>{r.slice(0, 7)}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export function P23ErrorIntelligenceScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<ErrorsPayload>("errors");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Error Intelligence"
        description="Failure and blocked events grouped from the enterprise audit trail — a deeper correlation view over the same event stream as P22-08. Management workflow stays in the Incident Center."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {data.groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-5" role="status">
              <p className="text-[13px] font-semibold text-slate-700">No failures recorded in the audit window</p>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                No synthetic error groups are created — an empty list genuinely means no Failure/Blocked events exist in the current audit trail.
              </p>
            </div>
          ) : (
            <div className="space-y-3" aria-label="Error groups, sorted by frequency">
              {data.groups.map((g) => (
                <GroupCard key={g.key} group={g} />
              ))}
            </div>
          )}

          <SectionCard title="Basis & cross-links" description={data.basis}>
            <ul className="space-y-2" aria-label="Cross-links to related screens">
              <li className="flex flex-wrap items-baseline gap-2 text-[12px] text-slate-600">
                <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-600">P23-17</span>
                <span>{data.links.deployments}</span>
              </li>
              <li className="flex flex-wrap items-baseline gap-2 text-[12px] text-slate-600">
                <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-600">P23-03</span>
                <span>{data.links.logs}</span>
              </li>
              <li className="flex flex-wrap items-baseline gap-2 text-[12px] text-slate-600">
                <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-600">P22-23</span>
                <span>{data.links.incidents}</span>
              </li>
            </ul>
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
