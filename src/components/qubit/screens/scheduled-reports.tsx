"use client";

import * as React from "react";
import { CalendarClock, Pause, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  AnalyticsAsOf,
  AnalyticsErrorBanner,
  AnalyticsSkeleton,
  ScheduleStatusChip,
  ScopeNote,
  analyticsPost,
  useAnalyticsSection,
} from "../analytics/parts";
import type { ReportSchedule } from "@/lib/qubit/analytics-data";

// ============================================================
// Screen 283 · Scheduled Reports — scheduled deliveries ride the
// EXISTING Qubit scheduling/automation infrastructure (spec §25):
// no second scheduling engine. Recipients are validated against
// the company directory server-side; sensitive reports cannot
// reach unauthorized recipients; every delivery is auditable.
// ============================================================

interface SchedulesPayload {
  asOfLabel: string;
  schedules: ReportSchedule[];
  eligibleReports: { id: string; name: string }[];
  rules: { maxPerUser: number; recipientsMustBeDirectory: boolean; deliveryAudit: string };
  canCreate: boolean;
  integrationNote: string;
  directory: { name: string; email: string }[];
}

export function ScheduledReportsScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { data, loading, error, reload } = useAnalyticsSection<SchedulesPayload>("schedules");
  const prefill = nav.params.reportId;

  const [open, setOpen] = React.useState(Boolean(prefill));
  const [reportId, setReportId] = React.useState(prefill ?? "");
  const [recipients, setRecipients] = React.useState("");
  const [frequency, setFrequency] = React.useState<"Daily" | "Weekly" | "Monthly">("Weekly");
  const [detail, setDetail] = React.useState("Monday 08:00 IST");
  const [channel, setChannel] = React.useState<"Email" | "In-app">("Email");
  const [format, setFormat] = React.useState<"CSV" | "XLSX" | "PDF">("PDF");
  const [busy, setBusy] = React.useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const list = recipients.split(",").map((r) => r.trim()).filter(Boolean);
      const res = await analyticsPost<{ ok: boolean; message?: string }>(
        "schedule.save",
        { reportId, recipients: list, frequency, detail, channel, format },
        role,
      );
      toast({ title: "Schedule created", description: res.message });
      setOpen(false);
      setRecipients("");
      reload();
    } catch (e) {
      toast({ title: "Schedule not created", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: string) => {
    try {
      const res = await analyticsPost<{ ok: boolean; message?: string }>("schedule.toggle", { id }, role);
      toast({ title: res.message ?? "Schedule updated" });
      reload();
    } catch (e) {
      toast({ title: "Could not update schedule", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Scheduled Reports" }]}
        title="Scheduled Reports"
        description="Report deliveries on the Qubit scheduler — directory-validated recipients, pausable schedules, every delivery audited."
        meta={<span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11.5px] font-medium text-slate-600">Reuses the Qubit scheduling infrastructure — no second engine</span>}
        actions={
          data?.canCreate ? (
            <Button size="sm" onClick={() => setOpen((o) => !o)}>
              <Plus className="h-4 w-4" aria-hidden /> New schedule
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-5">
        {open && data?.canCreate && (
          <SectionCard title="New schedule" description="Recipients must be company-directory members — the server rejects anyone else (no sensitive reports to unverified addresses).">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label htmlFor="sch-report" className="mb-1 block text-[12px] font-medium text-slate-600">Report</label>
                  <select id="sch-report" value={reportId} onChange={(e) => setReportId(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700">
                    <option value="">Select a saved report…</option>
                    {data.eligibleReports.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="sch-recipients" className="mb-1 block text-[12px] font-medium text-slate-600">Recipients (comma-separated names or directory emails)</label>
                  <Input id="sch-recipients" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="e.g. meera.iyer@qubitone.in, Sagar Singh" className="h-9 text-[13px]" />
                  <p className="mt-1 text-[11px] text-slate-400">Validated against the directory server-side · max 10 recipients.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="mb-1.5 block text-[12px] font-medium text-slate-600">Frequency</span>
                    <div className="flex gap-1.5">
                      {(["Daily", "Weekly", "Monthly"] as const).map((f) => (
                        <button key={f} type="button" onClick={() => setFrequency(f)} aria-pressed={frequency === f} className={`rounded-lg border px-2 py-1 text-[11px] font-medium ${frequency === f ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}>{f}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="mb-1.5 block text-[12px] font-medium text-slate-600">Channel</span>
                    <div className="flex gap-1.5">
                      {(["Email", "In-app"] as const).map((c) => (
                        <button key={c} type="button" onClick={() => setChannel(c)} aria-pressed={channel === c} className={`rounded-lg border px-2 py-1 text-[11px] font-medium ${channel === c ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}>{c}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="sch-detail" className="mb-1 block text-[12px] font-medium text-slate-600">Schedule detail</label>
                    <Input id="sch-detail" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="e.g. Monday 08:00 IST" className="h-9 text-[13px]" />
                  </div>
                  <div>
                    <span className="mb-1.5 block text-[12px] font-medium text-slate-600">Format</span>
                    <div className="flex gap-1.5">
                      {(["CSV", "XLSX", "PDF"] as const).map((f) => (
                        <button key={f} type="button" onClick={() => setFormat(f)} aria-pressed={format === f} className={`rounded-lg border px-2 py-1 text-[11px] font-medium ${format === f ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}>{f}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <ul className="space-y-1.5 text-[12px] text-slate-600">
                  <li>· Timezone: Asia/Kolkata (IST) from Analytics Settings.</li>
                  <li>· Policy limit: {data.rules.maxPerUser} schedules per user.</li>
                  <li>· {data.rules.deliveryAudit}</li>
                  <li>· A failed delivery is shown as failed — with its recorded reason (see the paused marketing schedule below).</li>
                </ul>
                <Button onClick={save} disabled={!reportId || recipients.trim().length === 0 || busy} className="h-10 w-full">
                  <CalendarClock className="h-4 w-4" aria-hidden /> Create schedule
                </Button>
              </div>
            </div>
          </SectionCard>
        )}

        {loading && <AnalyticsSkeleton rows={3} />}
        {error && !loading && <AnalyticsErrorBanner message={error} onRetry={reload} />}

        {data && !loading && (
          <SectionCard title="Schedules" description="Last run, next run and delivery result — honest failure states included.">
            {data.schedules.length === 0 ? (
              <EmptyState icon={<CalendarClock aria-hidden />} title="No schedules yet" message={data.canCreate ? "Create the first schedule above." : "Scheduling requires an authorized boundary; the server enforces this permission."} />
            ) : (
              <ul className="space-y-3">
                {data.schedules.map((s) => (
                  <li key={s.id} className="rounded-xl border border-slate-100 bg-white p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13.5px] font-semibold text-slate-900">{s.reportName}</p>
                          <ScheduleStatusChip active={s.active} />
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] font-medium text-slate-600">{s.frequency} · {s.detail}</span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] font-medium text-slate-600">{s.channel} · {s.format}</span>
                        </div>
                        <p className="mt-1 text-[11.5px] text-slate-500">
                          Recipients: {s.recipients.join(", ")} · Owner {s.ownerName} · TZ {s.timezone}
                        </p>
                        <p className="mt-1 text-[11.5px] tabular-nums text-slate-600">
                          Last run: {s.lastRun ? new Date(s.lastRun).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "never"} · Next: {s.nextRun}
                        </p>
                        {s.lastResult && (
                          <p className={`mt-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] ${s.lastResult.outcome === "Delivered" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800"}`}>
                            <span className="font-semibold">{s.lastResult.outcome}:</span> {s.lastResult.detail}
                          </p>
                        )}
                      </div>
                      {(s.ownerId === "sagar" || role === "administrator") && (
                        <Button variant="outline" size="sm" className="h-8" onClick={() => toggle(s.id)}>
                          {s.active ? <><Pause className="h-3.5 w-3.5" aria-hidden /> Pause</> : <><Play className="h-3.5 w-3.5" aria-hidden /> Activate</>}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <ScopeNote className="mt-4">{data.integrationNote}</ScopeNote>
          </SectionCard>
        )}

        <AnalyticsAsOf />
      </div>
    </div>
  );
}
