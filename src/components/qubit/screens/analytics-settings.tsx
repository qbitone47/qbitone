"use client";

import * as React from "react";
import { Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard, StatTile } from "../primitives";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  AnalyticsAsOf,
  AnalyticsErrorBanner,
  AnalyticsSkeleton,
  ScopeNote,
  analyticsPost,
  useAnalyticsSection,
} from "../analytics/parts";
import type { AnalyticsSettings, MetricDefinition } from "@/lib/qubit/analytics-data";

// ============================================================
// Screen 284 · Analytics Settings — enterprise analytics
// administration (spec §26). Admin-only (server-enforced);
// metric definitions are governed here so no module can silently
// redefine an enterprise metric. Every change is validated and
// audited.
// ============================================================

interface SettingsPayload {
  asOfLabel: string;
  settings: AnalyticsSettings;
  metrics: MetricDefinition[];
  datasets: { id: string; label: string; system: string; roles: string[]; sensitive: boolean; fields: number }[];
  governanceNote: string;
}

export function AnalyticsSettingsScreen() {
  const { role } = useRole();
  const { data, loading, error, forbidden, reload } = useAnalyticsSection<SettingsPayload>("settings");
  const [auditDays, setAuditDays] = React.useState("");
  const [linkHours, setLinkHours] = React.useState("");
  const [maxRows, setMaxRows] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (data) {
      setAuditDays(String(data.settings.retention.auditTrailDays));
      setLinkHours(String(data.settings.retention.exportLinkHours));
      setMaxRows(String(data.settings.exportPolicy.maxRows));
    }
  }, [data]);

  const saveRetention = async () => {
    setBusy(true);
    try {
      const res = await analyticsPost<{ ok: boolean; message?: string }>(
        "settings.update",
        { retention: { auditTrailDays: Number(auditDays), exportLinkHours: Number(linkHours) }, exportPolicy: { maxRows: Number(maxRows) } },
        role,
      );
      toast({ title: "Settings saved", description: res.message });
      reload();
    } catch (e) {
      toast({ title: "Change rejected", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (forbidden) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader crumbs={[{ label: "Analytics" }, { label: "Analytics Settings" }]} title="Analytics Settings" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-900"><ShieldCheck className="h-4 w-4" aria-hidden /> {error}</p>
          <p className="mt-1 text-xs text-amber-800">Sensitive analytics settings are admin-only. This is enforced by the server, not hidden in the UI.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="mx-auto max-w-6xl"><PageHeader crumbs={[{ label: "Analytics" }, { label: "Analytics Settings" }]} title="Analytics Settings" /> <AnalyticsSkeleton rows={4} /></div>;

  if (error && !loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader crumbs={[{ label: "Analytics" }, { label: "Analytics Settings" }]} title="Analytics Settings" />
        <AnalyticsErrorBanner message={error} onRetry={reload} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Analytics Settings" }]}
        title="Analytics Settings"
        description="Metric governance, source registry, refresh policies, retention and export rules — admin-only, validated, audited."
        meta={
          <span className="text-[11.5px] text-slate-500">
            Last updated {new Date(data.settings.updatedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} by {data.settings.updatedBy}
          </span>
        }
      />

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile value={data.settings.fiscalYearStart} label="Fiscal year start" />
          <StatTile value={data.settings.timezone.replace(" — UTC+05:30", "")} label="Timezone" />
          <StatTile value={data.settings.currency} label="Currency" />
          <StatTile value={String(data.metrics.length)} label="Governed metric definitions" />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SectionCard title="Retention & export policy" description="Changes are validated server-side and written to the audit trail.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="set-audit" className="mb-1 block text-[12px] font-medium text-slate-600">Audit trail retention (days)</label>
                <Input id="set-audit" type="number" min={30} max={3650} value={auditDays} onChange={(e) => setAuditDays(e.target.value)} className="h-9 text-[13px]" />
              </div>
              <div>
                <label htmlFor="set-link" className="mb-1 block text-[12px] font-medium text-slate-600">Export link expiry (hours)</label>
                <Input id="set-link" type="number" min={1} max={168} value={linkHours} onChange={(e) => setLinkHours(e.target.value)} className="h-9 text-[13px]" />
              </div>
              <div>
                <label htmlFor="set-rows" className="mb-1 block text-[12px] font-medium text-slate-600">Max export rows</label>
                <Input id="set-rows" type="number" min={100} max={200000} value={maxRows} onChange={(e) => setMaxRows(e.target.value)} className="h-9 text-[13px]" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <ScopeNote>Valid ranges: 30–3650 days · 1–168 hours · 100–200,000 rows. Sensitive datasets always require a recorded export reason.</ScopeNote>
              <Button size="sm" onClick={saveRetention} disabled={busy} className="h-8 shrink-0">
                <Save className="h-3.5 w-3.5" aria-hidden /> Save
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Report governance & scheduling rules" description="Sharing rules and scheduler policy.">
            <dl className="space-y-2.5 text-[12.5px]">
              <div className="flex flex-wrap justify-between gap-2 border-b border-slate-50 pb-2">
                <dt className="font-medium text-slate-600">Default visibility</dt>
                <dd className="text-slate-900">{data.settings.reportGovernance.defaultVisibility}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-b border-slate-50 pb-2">
                <dt className="font-medium text-slate-600">Company visibility requires admin</dt>
                <dd className="text-slate-900">{data.settings.reportGovernance.companyVisibilityRequiresAdmin ? "Yes" : "No"}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-b border-slate-50 pb-2">
                <dt className="font-medium text-slate-600">Schedules per user</dt>
                <dd className="text-slate-900">{data.settings.scheduledRules.maxPerUser}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="font-medium text-slate-600">Recipients must be directory members</dt>
                <dd className="text-slate-900">{data.settings.scheduledRules.recipientsMustBeDirectory ? "Yes — server-validated" : "No"}</dd>
              </div>
              <p className="text-[11.5px] text-muted-foreground">{data.settings.reportGovernance.sharingNote}</p>
            </dl>
          </SectionCard>
        </div>

        <SectionCard title="Data sources & refresh policies" description="Each source keeps its own cadence; delays surface as freshness states, never as fake numbers.">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[12.5px]">
              <caption className="sr-only">Data sources and refresh policies</caption>
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                  <th scope="col" className="py-2 pr-3 font-semibold">Source</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Refresh cadence</th>
                  <th scope="col" className="pl-3 py-2 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {data.settings.refreshPolicies.map((p) => (
                  <tr key={p.source} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-3 font-medium text-slate-800">{p.source}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">{p.cadence}</td>
                    <td className="pl-3 py-2 text-slate-500">{p.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Metric definitions — governed" description="The enterprise metric catalog. Modules consume these definitions; they cannot silently redefine them.">
          <div className="max-h-96 space-y-0 overflow-y-auto pr-1">
            {data.metrics.map((m) => (
              <details key={m.id} className="group border-b border-slate-50 py-2.5 last:border-0">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-900">{m.name}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-medium text-slate-500">{m.source}</span>
                  <span className="ml-auto text-[11px] text-slate-400 group-open:hidden">Show definition</span>
                </summary>
                <div className="mt-2 space-y-1 rounded-lg bg-slate-50/70 px-3 py-2.5">
                  <p className="text-[12px] text-slate-700">{m.definition}</p>
                  <p className="text-[11px] text-slate-500"><span className="font-medium">Calculation:</span> {m.calc}</p>
                  <p className="text-[11px] text-slate-500"><span className="font-medium">Period:</span> {m.period} · <span className="font-medium">Owner:</span> {m.owner}</p>
                  {m.caution && <p className="text-[11px] font-medium text-amber-700">{m.caution}</p>}
                </div>
              </details>
            ))}
          </div>
          <ScopeNote className="mt-3">{data.governanceNote}</ScopeNote>
        </SectionCard>

        <SectionCard title="Dataset registry" description="The semantic-layer datasets and the roles each serves — dataset permissions live here, enforced at every API call.">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[12.5px]">
              <caption className="sr-only">Dataset registry</caption>
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                  <th scope="col" className="py-2 pr-3 font-semibold">Dataset</th>
                  <th scope="col" className="px-3 py-2 font-semibold">System</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Roles</th>
                  <th scope="col" className="pl-3 py-2 font-semibold">Policy</th>
                </tr>
              </thead>
              <tbody>
                {data.datasets.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-3 font-medium text-slate-800">{d.label}</td>
                    <td className="px-3 py-2 text-slate-600">{d.system}</td>
                    <td className="px-3 py-2 text-slate-600">{d.roles.map((r) => r.replace("-", " ")).join(", ")}</td>
                    <td className="pl-3 py-2">
                      {d.sensitive ? <span className="rounded-full border border-rose-100 bg-rose-50 px-2 py-0.5 text-[10.5px] font-semibold text-rose-600">Sensitive · export reason required</span> : <span className="text-[11.5px] text-slate-400">{d.fields} fields</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <AnalyticsAsOf asOfLabel={data.asOfLabel} />
      </div>
    </div>
  );
}
