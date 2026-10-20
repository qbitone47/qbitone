"use client";

import * as React from "react";
import { Download, RotateCcw } from "lucide-react";
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
  ExportStatusChip,
  ScopeNote,
  analyticsPost,
  useAnalyticsSection,
} from "../analytics/parts";
import type { ExportJob, ExportFormat } from "@/lib/qubit/analytics-data";

// ============================================================
// Screen 282 · Data Export — the secure export workspace
// (spec §24). Exports are permission-controlled SERVER-SIDE
// (never frontend-only); sensitive datasets demand a recorded
// reason; duplicate jobs are prevented; jobs run asynchronously
// with progress/status; download links expire; every request is
// written to the enterprise audit trail.
// ============================================================

interface ExportsPayload {
  asOfLabel: string;
  jobs: ExportJob[];
  eligibleReports: { id: string; name: string }[];
  datasets: { id: string; label: string; sensitive: boolean }[];
  policy: { maxRows: number; reasonRequiredForSensitive: boolean; allowedFormats: string[]; approverForHighVolume: string };
  canCreate: boolean;
  permissionNote: string | null;
}

const FORMATS: ExportFormat[] = ["CSV", "XLSX", "PDF"];

export function DataExportScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { data, loading, error, reload } = useAnalyticsSection<ExportsPayload>("exports");
  const [sourceKind, setSourceKind] = React.useState<"report" | "dataset">("report");
  const [sourceId, setSourceId] = React.useState("");
  const [format, setFormat] = React.useState<ExportFormat>("XLSX");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const prefill = nav.params.reportId;

  React.useEffect(() => {
    if (prefill && data) {
      setSourceKind("report");
      setSourceId(prefill);
    }
  }, [prefill, data]);

  // auto-refresh while any job is queued/processing
  const hasPending = data?.jobs.some((j) => j.status === "Queued" || j.status === "Processing") ?? false;
  React.useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(reload, 1600);
    return () => clearInterval(t);
  }, [hasPending, reload]);

  const selectedDatasetSensitive = data?.datasets.find((d) => d.id === sourceId)?.sensitive ?? false;

  const create = async () => {
    setBusy(true);
    try {
      const res = await analyticsPost<{ ok: boolean; message?: string }>(
        "export.create",
        { sourceKind, sourceId, format, reason: reason || undefined },
        role,
      );
      toast({ title: "Export queued", description: res.message ?? "The job is recorded in the audit trail." });
      setReason("");
      reload();
    } catch (e) {
      toast({ title: "Export not created", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const retry = async (id: string) => {
    try {
      await analyticsPost("export.retry", { id }, role);
      toast({ title: "Export re-queued", description: "Safe retry — recorded in the audit trail." });
      reload();
    } catch (e) {
      toast({ title: "Retry not permitted", description: (e as Error).message, variant: "destructive" });
    }
  };

  const canCreate = Boolean(data?.canCreate && sourceId);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Data Export" }]}
        title="Data Export"
        description="Permission-controlled exports with recorded reasons for sensitive data, async jobs, duplicate prevention and expiring links."
        actions={<Button variant="outline" size="sm" onClick={reload}>Refresh jobs</Button>}
      />

      {loading && <AnalyticsSkeleton rows={4} />}
      {error && !loading && <AnalyticsErrorBanner message={error} onRetry={reload} />}

      {data && !loading && (
        <div className="space-y-5">
          {data.permissionNote && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[13px] font-medium text-amber-900">{data.permissionNote}</p>
            </div>
          )}

          <SectionCard title="New export" description="Report-based or dataset-based; sensitive datasets require a reason that goes to the audit trail.">
            {data.canCreate ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <span className="mb-1.5 block text-[12px] font-medium text-slate-600">Source type</span>
                    <div className="flex gap-1.5">
                      {(["report", "dataset"] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => { setSourceKind(k); setSourceId(""); }}
                          aria-pressed={sourceKind === k}
                          className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-medium capitalize transition-colors ${sourceKind === k ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
                        >
                          {k === "report" ? "Saved report" : "Dataset"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="exp-source" className="mb-1 block text-[12px] font-medium text-slate-600">{sourceKind === "report" ? "Report" : "Dataset (available to your role)"}</label>
                    <select
                      id="exp-source"
                      value={sourceId}
                      onChange={(e) => setSourceId(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700"
                    >
                      <option value="">Select…</option>
                      {(sourceKind === "report" ? data.eligibleReports : data.datasets).map((o) => (
                        <option key={o.id} value={o.id}>{o.name}{sourceKind === "dataset" && (o as { sensitive?: boolean }).sensitive ? " · sensitive" : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="mb-1.5 block text-[12px] font-medium text-slate-600">Format</span>
                    <div className="flex gap-1.5">
                      {FORMATS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFormat(f)}
                          aria-pressed={format === f}
                          className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${format === f ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedDatasetSensitive && (
                    <div>
                      <label htmlFor="exp-reason" className="mb-1 block text-[12px] font-medium text-rose-700">Export reason (required — sensitive dataset)</label>
                      <Input id="exp-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this export needed? (min 10 characters)" className="h-9 text-[13px]" maxLength={300} />
                      <p className="mt-1 text-[11px] text-rose-600">Recorded in the audit trail with Warning severity — policy: {data.policy.reasonRequiredForSensitive ? "reason required" : "reason optional"}.</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <ul className="space-y-1.5 text-[12px] text-slate-600">
                    <li>· Export authorization is enforced <span className="font-medium">server-side</span> — the UI never grants it.</li>
                    <li>· Row limit {data.policy.maxRows.toLocaleString("en-IN")}; larger needs {data.policy.approverForHighVolume} approval.</li>
                    <li>· Duplicate jobs of the same dataset + format are prevented (409).</li>
                    <li>· Jobs run asynchronously — the app never blocks on a large export.</li>
                    <li>· Download links expire after {12} hours; every request is audited.</li>
                  </ul>
                  <Button onClick={create} disabled={!canCreate || busy} className="h-10 w-full">
                    <Download className="h-4 w-4" aria-hidden /> Queue export
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Download aria-hidden />}
                title="Export creation requires an authorized boundary"
                message="Administrators and department heads can create exports. Your export history appears below; the server enforces this permission."
              />
            )}
          </SectionCard>

          <SectionCard title="Export jobs" description="Status, retry and expiry — a failed job is shown as failed, never as success.">
            {data.jobs.length === 0 ? (
              <EmptyState icon={<Download aria-hidden />} title="No export jobs yet" message="Queue your first export above — jobs appear here with live status." />
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-[12.5px]">
                  <caption className="sr-only">Export jobs</caption>
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                      <th scope="col" className="py-2 pr-3 font-semibold">Source</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Format</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Rows</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Requested</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Link expires</th>
                      <th scope="col" className="pl-3 py-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.jobs.map((j) => (
                      <tr key={j.id} className="border-b border-slate-50 last:border-0">
                        <td className="max-w-[240px] py-2 pr-3">
                          <p className="truncate font-medium text-slate-800" title={j.sourceLabel}>{j.sourceLabel}</p>
                          <p className="truncate text-[10.5px] text-slate-400">{j.sourceKind === "report" ? "Saved report" : "Dataset"} · {j.requesterName}{j.reason ? ` · reason recorded` : ""}</p>
                          {j.failureReason && <p className="mt-0.5 max-w-[260px] truncate text-[10.5px] text-rose-600" title={j.failureReason}>{j.failureReason}</p>}
                        </td>
                        <td className="px-3 py-2 font-medium">{j.format}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{j.rowCount > 0 ? j.rowCount.toLocaleString("en-IN") : "—"}</td>
                        <td className="px-3 py-2"><ExportStatusChip status={j.status} /></td>
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums text-slate-500">{new Date(j.requestedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums text-slate-500">{j.expiresAt ? new Date(j.expiresAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                        <td className="pl-3 py-2">
                          {j.status === "Ready" ? (
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => toast({ title: "Secure download", description: "The download link is single-use and expires after the policy window — this demo does not transfer files." })}>
                              <Download className="h-3 w-3" aria-hidden /> Download
                            </Button>
                          ) : j.status === "Failed" || j.status === "Expired" ? (
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => retry(j.id)}>
                              <RotateCcw className="h-3 w-3" aria-hidden /> Retry
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-400">Processing…</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <ScopeNote className="mt-3">Large exports never block normal application requests — jobs progress in the background and the table refreshes automatically while anything is queued.</ScopeNote>
          </SectionCard>

          <AnalyticsAsOf asOfLabel={data.asOfLabel} />
        </div>
      )}
    </div>
  );
}
