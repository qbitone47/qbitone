"use client";

import * as React from "react";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
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
  QuickActionGrid,
  SourceNote,
  mobilePost,
  useMobileSection,
} from "../mobile/parts";

// ============================================================
// Screen 286 · Mobile Sales Home — the field sales workspace over
// the EXISTING Sales Operating System. Every figure and row is
// read through salesGet with the caller's scope re-applied
// server-side (company / team / own). No mobile sales database.
// ============================================================

interface SalesHomePayload {
  scope: string | null;
  counts: { leads: number; leadsNew: number; followupsOverdue: number; followupsToday: number; opportunities: number; openQuotes: number; openOrders: number; visitsToday: number };
  leads: { id: string; name: string; company: string; status: string; priority: string; ownerName: string | null; estimatedValueCr: number | null }[];
  followups: { id: string; type: string; subject: string; state: string; dueAt: number; priority: string; leadId: string | null }[];
  opportunities: { id: string; name: string; stage: string; valueCr: number; probability: number; riskNote: string | null }[];
  pipelineTotals: Record<string, unknown> | null;
  visitsToday: { id: string; plannedAt: number; purpose: string; location: string; status: string; account: string | null }[];
  upcomingVisits: { id: string; plannedAt: number; purpose: string; location: string; status: string; account: string | null }[];
  targets: Record<string, unknown>[];
  quickActions: { id: string; label: string; screen?: string }[];
  sourceNote: string;
}

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

export function MobileSalesHomeScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { data, loading, error, forbidden, reload } = useMobileSection<SalesHomePayload>("sales-home");
  const [busy, setBusy] = React.useState(false);

  const openVisit = async (visitId: string) => {
    setBusy(true);
    try {
      await mobilePost("visit.stage", { id: visitId, stage: "En Route" }, role);
      toast({ title: "En route", description: "Field stage recorded on the visit." });
      nav.navigate("mobile-service-visit", { visitId });
    } catch (e) {
      toast({ title: "Could not record", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileFrame title="Sales" activeTab="business">
      {loading && <MobileSkeleton rows={4} />}
      {error && !loading && (
        <>
          <MobileErrorBanner message={error} onRetry={forbidden ? undefined : reload} />
          {forbidden && (
            <SourceNote>
              Mobile respects the same Sales authorization as desktop: this role boundary does not hold Sales access, so no sales
              data is fetched or shown — the server enforces this before anything is returned.
            </SourceNote>
          )}
        </>
      )}
      {data && !loading && (
        <>
          {data.scope && (
            <div className="px-3 pt-3">
              <MobileBadge tone="blue">Scope: {String(data.scope)}</MobileBadge>
            </div>
          )}

          <MobileSection title="Today">
            <div className="flex gap-2">
              <MobileStat label="Overdue" value={data.counts.followupsOverdue} tone={data.counts.followupsOverdue ? "red" : "slate"} />
              <MobileStat label="Due today" value={data.counts.followupsToday} />
              <MobileStat label="Visits" value={data.counts.visitsToday} />
            </div>
            <div className="flex gap-2">
              <MobileStat label="Leads" value={data.counts.leads} onClick={() => nav.navigate("lead-inbox")} />
              <MobileStat label="Opps" value={data.counts.opportunities} onClick={() => nav.navigate("opportunity-detail")} />
              <MobileStat label="Quotes" value={data.counts.openQuotes} onClick={() => nav.navigate("quotation-list")} />
            </div>
          </MobileSection>

          <MobileSection title="Quick actions">
            <QuickActionGrid
              actions={data.quickActions.map((a) => ({ id: a.id, label: a.label, run: () => a.screen && nav.navigate(a.screen as never) }))}
            />
          </MobileSection>

          <MobileSection title="Follow-ups needing attention">
            {data.followups.length ? (
              data.followups.map((f) => (
                <MobileRow
                  key={f.id}
                  title={f.subject}
                  detail={`${f.type} · due ${fmtTime(f.dueAt)} IST`}
                  trailing={<MobileBadge tone={f.state === "Overdue" ? "red" : "amber"}>{f.state}</MobileBadge>}
                  onClick={() => (f.leadId ? nav.navigate("mobile-lead-detail", { leadId: f.leadId }) : nav.navigate("followup-queue"))}
                />
              ))
            ) : (
              <MobileEmpty title="No overdue or due-today follow-ups" />
            )}
          </MobileSection>

          <MobileSection title="Leads">
            {data.leads.length ? (
              data.leads.map((l) => (
                <MobileRow
                  key={l.id}
                  title={l.name}
                  detail={`${l.company}${l.estimatedValueCr ? ` · ₹${l.estimatedValueCr} Cr` : ""}`}
                  trailing={<MobileBadge tone={l.priority === "Hot" ? "red" : l.priority === "Warm" ? "amber" : "slate"}>{l.priority}</MobileBadge>}
                  onClick={() => nav.navigate("mobile-lead-detail", { leadId: l.id })}
                />
              ))
            ) : (
              <MobileEmpty title="No leads in your scope" />
            )}
          </MobileSection>

          <MobileSection title="Visits">
            {data.visitsToday.length || data.upcomingVisits.length ? (
              <>
                {data.visitsToday.map((v) => (
                  <MobileRow
                    key={v.id}
                    title={v.purpose}
                    detail={`${v.account ?? "Customer"} · ${v.location} · ${fmtTime(v.plannedAt)}`}
                    trailing={<MobileBadge tone={v.status === "In Progress" ? "green" : "blue"}>{v.status}</MobileBadge>}
                    onClick={() => (v.status === "Planned" ? openVisit(v.id) : nav.navigate("mobile-service-visit", { visitId: v.id }))}
                  />
                ))}
                {data.upcomingVisits.map((v) => (
                  <MobileRow
                    key={v.id}
                    title={v.purpose}
                    detail={`${v.account ?? "Customer"} · ${v.location}`}
                    meta="Upcoming"
                    onClick={() => nav.navigate("mobile-service-visit", { visitId: v.id })}
                  />
                ))}
              </>
            ) : (
              <MobileEmpty title="No visits planned" detail="Plan one from the Field Visit Planner." />
            )}
          </MobileSection>

          {data.pipelineTotals && (
            <MobileSection title="Pipeline">
              <MobileCard>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
                  {Object.entries(data.pipelineTotals).slice(0, 6).map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-2">
                      <dt className="truncate text-slate-500">{k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</dt>
                      <dd className="font-semibold tabular-nums text-slate-900">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-[11px] text-slate-400">Live pipeline totals from the Sales OS — never mixed with actuals.</p>
              </MobileCard>
            </MobileSection>
          )}

          <MobileSection title="Opportunities">
            {data.opportunities.length ? (
              data.opportunities.map((o) => (
                <MobileRow
                  key={o.id}
                  title={o.name}
                  detail={`${o.stage} · ₹${o.valueCr} Cr · ${o.probability}%${o.riskNote ? " · risk flagged" : ""}`}
                  onClick={() => nav.navigate("opportunity-detail", { opportunityId: o.id })}
                />
              ))
            ) : (
              <MobileEmpty title="No open opportunities in scope" />
            )}
          </MobileSection>

          <SourceNote>{data.sourceNote}</SourceNote>
          <p className="px-3 pb-2 text-[10px] text-slate-300">Mobile Sales Home</p>
        </>
      )}
      {busy && <p className="px-3 pb-2 text-[11px] text-slate-400" role="status">Recording field stage…</p>}
    </MobileFrame>
  );
}
