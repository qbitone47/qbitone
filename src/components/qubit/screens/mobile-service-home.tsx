"use client";

import * as React from "react";
import { useQubitNav } from "../nav-context";
import {
  MobileBadge,
  MobileCard,
  MobileEmpty,
  MobileErrorBanner,
  MobileFrame,
  MobileSection,
  MobileSkeleton,
  MobileStat,
  MobileRow,
  SourceNote,
  useMobileSection,
} from "../mobile/parts";

// ============================================================
// Screen 291 · Mobile Service Home — the field-service command
// center. Service canon (tickets / SLA / CSAT / critical accounts)
// comes from the same executive-canonical source the CEO and
// analytics views read; visits are read through the Sales OS gate.
// No duplicate service data is created (spec §12).
// ============================================================

interface ServicePayload {
  tickets: { open: number; openCritical: number; resolved30d: number };
  sla: { compliancePct: number; targetPct: number; breachedCritical: number };
  criticalAccounts: { account: string; issue: string; hoursOpen: number; engineer: string; slaBreached: boolean }[];
  visitsToday: { id: string; plannedAt: number; purpose: string; location: string; status: string; account: string | null }[];
  openVisits: { id: string; plannedAt: number; purpose: string; location: string; status: string; account: string | null }[];
  visitsNote: string | null;
  pendingItems: { reports: string; signatures: string };
  partsPending: { visitId: string; name: string; qty: number }[];
  sourceNote: string;
}

const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

export function MobileServiceHomeScreen() {
  const nav = useQubitNav();
  const { data, loading, error, reload } = useMobileSection<ServicePayload>("service-home");

  return (
    <MobileFrame title="Service" activeTab="business">
      {loading && <MobileSkeleton rows={4} />}
      {error && !loading && <MobileErrorBanner message={error} onRetry={reload} />}
      {data && !loading && (
        <>
          <MobileSection title="Tickets">
            <div className="flex gap-2">
              <MobileStat label="Open" value={data.tickets.open} />
              <MobileStat label="Critical" value={data.tickets.openCritical} tone={data.tickets.openCritical ? "red" : "slate"} />
              <MobileStat label="30d resolved" value={data.tickets.resolved30d} tone="green" />
            </div>
            <MobileCard>
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-medium text-slate-600">SLA compliance</p>
                <p className="text-[13px] font-semibold tabular-nums text-slate-900">
                  {data.sla.compliancePct}% <span className="text-[11px] font-normal text-slate-400">/ target {data.sla.targetPct}%</span>
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`SLA compliance ${data.sla.compliancePct} percent against target ${data.sla.targetPct} percent`}>
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (data.sla.compliancePct / data.sla.targetPct) * 100)}%` }} />
              </div>
              {data.sla.breachedCritical > 0 && (
                <p className="mt-2 text-[12px] font-medium text-red-700" role="status">
                  {data.sla.breachedCritical} critical SLA breach(es) — attention required.
                </p>
              )}
            </MobileCard>
          </MobileSection>

          <MobileSection title="Today's visits">
            {data.visitsToday.length ? (
              data.visitsToday.map((v) => (
                <MobileRow
                  key={v.id}
                  title={v.purpose}
                  detail={`${v.account ?? "Customer"} · ${v.location} · ${fmtTime(v.plannedAt)}`}
                  trailing={<MobileBadge tone={v.status === "In Progress" ? "green" : "blue"}>{v.status}</MobileBadge>}
                  onClick={() => nav.navigate("mobile-service-visit", { visitId: v.id })}
                />
              ))
            ) : (
              <MobileEmpty title="No visits scheduled today" />
            )}
          </MobileSection>

          <MobileSection title="Open visits">
            {data.openVisits.length ? (
              data.openVisits.map((v) => (
                <MobileRow
                  key={v.id}
                  title={v.purpose}
                  detail={`${v.account ?? "Customer"} · ${v.location}`}
                  meta={`Planned ${fmtTime(v.plannedAt)}`}
                  onClick={() => nav.navigate("mobile-service-visit", { visitId: v.id })}
                />
              ))
            ) : (
              <MobileEmpty title="No open visits" />
            )}
            {data.visitsNote && (
              <MobileCard className="border-amber-200 bg-amber-50">
                <p className="text-[12px] leading-snug text-amber-800">{data.visitsNote}</p>
              </MobileCard>
            )}
          </MobileSection>

          <MobileSection title="SLA warnings">
            {data.criticalAccounts.map((c) => (
              <MobileRow
                key={c.account}
                title={c.account}
                detail={`${c.issue} · ${c.hoursOpen}h open · engineer ${c.engineer}`}
                trailing={<MobileBadge tone={c.slaBreached ? "red" : "amber"}>{c.slaBreached ? "SLA breached" : "At risk"}</MobileBadge>}
              />
            ))}
          </MobileSection>

          <MobileSection title="Pending items">
            <MobileCard>
              <p className="text-[12.5px] leading-snug text-slate-600"><span className="font-semibold text-slate-800">Reports:</span> {data.pendingItems.reports}</p>
              <p className="mt-2 text-[12.5px] leading-snug text-slate-600"><span className="font-semibold text-slate-800">Signatures:</span> {data.pendingItems.signatures}</p>
            </MobileCard>
          </MobileSection>

          <MobileSection title="Required parts">
            {data.partsPending.length ? (
              data.partsPending.map((p, i) => (
                <MobileRow key={i} title={p.name} detail={`×${p.qty} · recorded on visit`} onClick={() => nav.navigate("mobile-service-visit", { visitId: p.visitId })} />
              ))
            ) : (
              <MobileEmpty title="No parts recorded against open visits" />
            )}
          </MobileSection>

          <SourceNote>{data.sourceNote}</SourceNote>
          <p className="px-3 pb-2 text-[10px] text-slate-300">Mobile Service Home</p>
        </>
      )}
    </MobileFrame>
  );
}
