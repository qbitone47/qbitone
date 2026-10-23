"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, fmtIST, obsPost, timeAgo, useObsSection } from "../obs/parts";

// ============================================================
// P23-11 · Alert Center — alerts that actually fired.
// Alerts are created ONLY by real rule evaluations (P23-12
// "Evaluate now") against live measurements. An empty list
// means nothing has breached — never a seeded demo row.
// ============================================================

interface AlertRow {
  id: string; ruleId: string; ruleName: string; severity: string; service: string;
  condition: string; currentValue: number; threshold: number;
  triggeredAt: number; durationMin: number;
  status: "Triggered" | "Acknowledged" | "Resolved" | "Suppressed" | "Expired";
  owner: string; evaluatedAt: number;
}

interface AlertsPayload {
  alerts: AlertRow[];
  statuses: string[];
  sourceNote: string;
}

interface ActionResult { ok?: boolean; message?: string; data?: { ok?: boolean; message?: string } }

/** The obs route returns the Result envelope { ok, data: { ok, message } } — unwrap defensively. */
function messageOf(res: ActionResult): string | undefined {
  return res.data?.message ?? res.message;
}

const severityChipCls: Record<string, { cls: string; dot: string }> = {
  Critical: { cls: "border-red-300 bg-red-50 text-red-800", dot: "bg-red-500" },
  High: { cls: "border-orange-300 bg-orange-50 text-orange-800", dot: "bg-orange-500" },
  Warning: { cls: "border-amber-300 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  Info: { cls: "border-slate-300 bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

function SeverityChip({ severity }: { severity: string }) {
  const v = severityChipCls[severity] ?? severityChipCls.Info;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${v.cls}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${v.dot}`} />
      {severity}
    </span>
  );
}

/** Triggered→unavailable-ish red, Acknowledged→degraded amber, Resolved→healthy, Suppressed/Expired→unknown. */
function statusHealth(status: string): string {
  switch (status) {
    case "Triggered": return "unavailable";
    case "Acknowledged": return "degraded";
    case "Resolved": return "healthy";
    default: return "unknown";
  }
}

export function P23AlertCenterScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<AlertsPayload>("alerts");
  const [busy, setBusy] = React.useState(false);

  const setStatus = async (alert: AlertRow, status: "Acknowledged" | "Resolved") => {
    setBusy(true);
    try {
      const res = await obsPost<ActionResult>("alert.status", { id: alert.id, status });
      toast({ title: `Alert ${alert.id} → ${status}`, description: messageOf(res) });
      reload();
    } catch (e) {
      toast({ title: "Could not update alert", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Alert Center"
        description="Every alert here was created by a real rule evaluation against live measurements (P23-12). Nothing is seeded or demonstrated — an empty registry means nothing has fired."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <SectionCard
            title="Alerts"
            description="Sorted newest first. Status transitions are audited server-side."
            actions={
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10.5px] font-bold tabular-nums text-slate-600">
                {data.alerts.length} on record
              </span>
            }
          >
            {data.alerts.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-slate-500">
                No alerts have fired — rules evaluate on demand. Create rules in P23-12 and use &ldquo;Evaluate now&rdquo; against live probes; an empty list means nothing has breached, not that alerts are hidden.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {data.alerts.map((a) => (
                  <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <SeverityChip severity={a.severity} />
                        <p className="truncate text-[13px] font-semibold text-slate-900">{a.ruleName}</p>
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px font-mono text-[10.5px] text-slate-600">{a.service}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <OpsHealthBadge health={statusHealth(a.status)} />
                        <span className="text-[10.5px] font-medium text-slate-400">{a.status}</span>
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px] text-slate-600">
                      <span className="font-mono text-[11.5px] text-slate-700">{a.condition}</span>
                      <span className="tabular-nums">
                        Current <span className="font-semibold text-slate-900">{a.currentValue}</span>
                        <span aria-hidden className="mx-1 text-slate-400">vs</span>
                        threshold <span className="font-semibold text-slate-900">{a.threshold}</span>
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                      <p className="text-[11px] text-slate-500">
                        <span className="whitespace-nowrap tabular-nums">Triggered {fmtIST(a.triggeredAt)}</span>
                        <span className="text-slate-400"> · {timeAgo(a.triggeredAt)} · open {a.durationMin} min · {a.id} · by {a.owner}</span>
                      </p>
                      <div className="flex items-center gap-1.5">
                        {a.status === "Triggered" && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => void setStatus(a, "Acknowledged")} className="min-h-[36px]" title={`Set ${a.id} to Acknowledged`}>
                            Acknowledge
                          </Button>
                        )}
                        {(a.status === "Triggered" || a.status === "Acknowledged") && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => void setStatus(a, "Resolved")} className="min-h-[36px] border-emerald-200 text-emerald-700 hover:bg-emerald-50" title={`Set ${a.id} to Resolved`}>
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Status vocabulary" description="The lifecycle an alert can move through — transitions are set from this screen and audited.">
            <div className="flex flex-wrap gap-2" role="list" aria-label="Alert status vocabulary">
              {data.statuses.map((s) => (
                <span key={s} role="listitem" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s === "Triggered" ? "bg-red-500" : s === "Acknowledged" ? "bg-amber-500" : s === "Resolved" ? "bg-emerald-500" : "bg-slate-400"}`} />
                  {s}
                </span>
              ))}
            </div>
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
