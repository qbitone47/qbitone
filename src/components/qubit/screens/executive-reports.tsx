"use client";

import * as React from "react";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  FileDown,
  Files,
  Info,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getEmployee } from "@/lib/qubit/data";
import { fmtDateTime, relTime } from "@/lib/qubit/workspace-data";
import type { ExecReport } from "@/lib/qubit/executive-data";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard, StatTile, StatusBadge } from "../primitives";
import { Field, FormDialog } from "../dialogs";
import { useRole } from "../role-context";
import {
  AsOfStrip,
  ExecApiError,
  ExecErrorBanner,
  ExecSkeleton,
  ExecutiveGate,
  PeriodChip,
  execGet,
  execPost,
  useExecutiveSection,
} from "../executive/parts";

// ============================================================
// Screen 72 · Executive Reports — the executive reporting
// library. Generate, export and schedule authorized reports;
// every action runs through the server (report.generate /
// report.export / report.schedule), is audited, and exports
// respect the same authorization as screen access — data
// masking and the current filter context included (spec §20).
// ============================================================

interface ReportsPayload {
  period: { label: string; window: string };
  asOfLabel: string;
  reports: ExecReport[];
}

const CATEGORY_ORDER = [
  "Company Performance",
  "Revenue",
  "Sales",
  "Finance",
  "People",
  "Marketing",
  "Service",
  "Inventory",
  "Operations",
  "Risk",
];

type ExportFormat = "PDF" | "XLSX";

export function ExecutiveReportsScreen() {
  const { role } = useRole();
  const { toast } = useToast();
  const { data, loading, error, reload } = useExecutiveSection<ReportsPayload>("reports");

  const reports = data?.reports ?? [];
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [exportTarget, setExportTarget] = React.useState<ExecReport | null>(null);
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>("PDF");
  const [scheduleTarget, setScheduleTarget] = React.useState<ExecReport | null>(null);
  const [scheduleText, setScheduleText] = React.useState("");
  const [scheduleError, setScheduleError] = React.useState<string | null>(null);

  const stats = React.useMemo(
    () => ({
      total: reports.length,
      ready: reports.filter((r) => r.status === "Ready").length,
      generating: reports.filter((r) => r.status === "Generating").length,
      pending: reports.filter((r) => r.status === "Scheduled" || r.status === "Failed").length,
    }),
    [reports],
  );

  const groups = React.useMemo(() => {
    const present = Array.from(new Set(reports.map((r) => r.category)));
    const ordered = CATEGORY_ORDER.filter((c) => present.includes(c));
    const extras = present.filter((c) => !CATEGORY_ORDER.includes(c));
    return [...ordered, ...extras].map((category) => ({
      category,
      rows: reports.filter((r) => r.category === category),
    }));
  }, [reports]);

  const errorMessage = (err: unknown, fallback: string) =>
    err instanceof ExecApiError ? err.message : fallback;

  const generate = async (r: ExecReport) => {
    setBusyId(r.id);
    try {
      await execPost({ action: "report.generate", id: r.id }, role);
      toast({
        title: "Generation started",
        description: `${r.title} — the run is executing; the library refreshes when it completes.`,
      });
      reload(); // row flips to Generating immediately
      // The server completes the run shortly after — refetch and confirm honestly.
      window.setTimeout(async () => {
        try {
          const fresh = await execGet<ReportsPayload>("reports", role);
          const updated = fresh.reports.find((x) => x.id === r.id);
          reload();
          if (updated?.status === "Ready") {
            toast({
              title: "Report ready",
              description: `${r.title} — the generated run is ready to open or export; recorded in the audit trail.`,
            });
          }
        } catch {
          reload();
        }
      }, 2500);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Generation not started",
        description: errorMessage(err, "The report service is unreachable. Nothing was changed."),
      });
    } finally {
      setBusyId(null);
    }
  };

  const runExport = async (r: ExecReport, format: ExportFormat) => {
    setBusyId(r.id);
    try {
      await execPost({ action: "report.export", id: r.id, format }, role);
      toast({
        title: "Export prepared — recorded in the audit trail",
        description: `${r.title} · ${format} — data masking and the current filter context respected.`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Export not prepared",
        description: errorMessage(err, "The report service is unreachable. Nothing was exported."),
      });
    } finally {
      setBusyId(null);
    }
  };

  const runSchedule = async (r: ExecReport, schedule: string) => {
    setBusyId(r.id);
    try {
      await execPost({ action: "report.schedule", id: r.id, schedule }, role);
      toast({
        title: "Schedule updated",
        description: `${r.title} — ${schedule} · audit reference recorded.`,
      });
      reload();
      return true;
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Schedule not updated",
        description: errorMessage(err, "The report service is unreachable. Nothing was changed."),
      });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const openExportDialog = (r: ExecReport) => {
    if (r.format === "PDF + XLSX") {
      setExportFormat("PDF"); // default per report.format
      setExportTarget(r);
    } else {
      void runExport(r, r.format === "XLSX" ? "XLSX" : "PDF");
    }
  };

  return (
    <ExecutiveGate screenName="Executive Reports">
      <div>
        <PageHeader
          crumbs={[{ label: "CEO Command Center" }, { label: "Executive Reports" }]}
          title="Executive Reports"
          description="The executive reporting library — generate, export and schedule the reports the board and the leadership team rely on. One library, server-enforced authorization, every action audited."
          actions={
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={reload} aria-label="Reload executive reports">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
            </Button>
          }
          meta={data && <PeriodChip label={data.period.label} window={data.period.window} />}
        />

        {/* Export governance caption */}
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white px-4 py-3" role="note">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden />
          <p className="text-xs leading-relaxed text-slate-600">
            Exports respect the same authorization as screen access, record an audit event, and respect data masking and the current filter
            context.
          </p>
        </div>

        {error && <ExecErrorBanner message={error} onRetry={reload} />}

        {!loading && reports.length > 0 && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={<Files />} value={stats.total} label="Reports in the library" />
            <StatTile icon={<CheckCircle2 />} value={stats.ready} label="Ready" />
            <StatTile icon={<Loader2 />} value={stats.generating} label="Generating" />
            <StatTile icon={<CalendarClock />} value={stats.pending} label="Scheduled / Failed" />
          </div>
        )}

        {loading ? (
          <ExecSkeleton rows={4} />
        ) : reports.length === 0 ? (
          <SectionCard>
            <EmptyState
              icon={<Files />}
              title="No reports in the executive library"
              message="Reports appear here when they are registered with the executive reporting service."
            />
          </SectionCard>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <SectionCard
                key={group.category}
                title={group.category}
                description={`${group.rows.length} report${group.rows.length === 1 ? "" : "s"}`}
              >
                <ul className="divide-y">
                  {group.rows.map((r) => (
                    <ReportRow
                      key={r.id}
                      report={r}
                      busyId={busyId}
                      onOpen={() =>
                        toast({
                          title: r.title,
                          description: "The report viewer opens in the Documents module.",
                        })
                      }
                      onGenerate={() => void generate(r)}
                      onExport={() => openExportDialog(r)}
                      onSchedule={() => {
                        setScheduleText(r.schedule);
                        setScheduleError(null);
                        setScheduleTarget(r);
                      }}
                    />
                  ))}
                </ul>
              </SectionCard>
            ))}
          </div>
        )}

        {/* Export format chooser — shown when a report supports both formats */}
        <FormDialog
          open={Boolean(exportTarget)}
          onOpenChange={(o) => !o && setExportTarget(null)}
          title="Export report"
          description={
            exportTarget
              ? `${exportTarget.title} — the export is recorded in the audit trail and respects data masking and the current filter context.`
              : undefined
          }
          submitLabel="Prepare export"
          submitting={Boolean(exportTarget && busyId === exportTarget.id)}
          onSubmit={() => {
            if (!exportTarget) return;
            const target = exportTarget;
            setExportTarget(null);
            void runExport(target, exportFormat);
          }}
        >
          <Field label="Export format" hint={exportTarget ? `Source report format: ${exportTarget.format}` : undefined}>
            <div className="flex gap-2" role="group" aria-label="Choose export format">
              {(["PDF", "XLSX"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={exportFormat === f}
                  onClick={() => setExportFormat(f)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    exportFormat === f
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </Field>
        </FormDialog>

        {/* Schedule editor */}
        <FormDialog
          open={Boolean(scheduleTarget)}
          onOpenChange={(o) => {
            if (!o) {
              setScheduleTarget(null);
              setScheduleText("");
              setScheduleError(null);
            }
          }}
          title="Update schedule"
          description={
            scheduleTarget ? `${scheduleTarget.title} — the schedule drives the automated generation runs and is audited.` : undefined
          }
          submitLabel="Save schedule"
          submitting={Boolean(scheduleTarget && busyId === scheduleTarget.id)}
          onSubmit={() => {
            if (!scheduleTarget) return;
            if (scheduleText.trim().length < 3) {
              setScheduleError("Provide a schedule description (e.g. Monthly · 1st working day).");
              return;
            }
            const target = scheduleTarget;
            const text = scheduleText.trim();
            void runSchedule(target, text).then((ok) => {
              if (ok) {
                setScheduleTarget(null);
                setScheduleText("");
                setScheduleError(null);
              }
            });
          }}
        >
          <Field label="Schedule" required hint="Human-readable cadence, e.g. Weekly · Thursday 07:00.">
            <Input
              value={scheduleText}
              onChange={(e) => {
                setScheduleText(e.target.value);
                if (scheduleError) setScheduleError(null);
              }}
              placeholder="Monthly · 1st working day 06:30"
              aria-invalid={Boolean(scheduleError)}
            />
          </Field>
          {scheduleError && (
            <p role="alert" className="text-[11px] text-red-600">
              {scheduleError}
            </p>
          )}
        </FormDialog>

        <AsOfStrip asOfLabel={data?.asOfLabel ?? ""} note="Generation state refreshes from the report service; a completed run is confirmed by refetch, not assumed." />
      </div>
    </ExecutiveGate>
  );
}

// ---------- report row ----------

function ReportRow({
  report: r,
  busyId,
  onOpen,
  onGenerate,
  onExport,
  onSchedule,
}: {
  report: ExecReport;
  busyId: string | null;
  onOpen: () => void;
  onGenerate: () => void;
  onExport: () => void;
  onSchedule: () => void;
}) {
  const owner = getEmployee(r.ownerId);
  const ready = r.status === "Ready";
  const generating = r.status === "Generating";
  const failed = r.status === "Failed";
  const busy = busyId === r.id;
  const notReadyHint = generating ? "Wait for the current run to finish." : failed ? "Last run failed — regenerate before opening or exporting." : "Scheduled only — generate the report to open or export it.";

  return (
    <li className="flex flex-wrap items-start gap-3 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-[13.5px] font-semibold text-slate-900">{r.title}</h4>
          <StatusBadge status={r.status} size="sm" />
          <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] font-medium text-slate-600">
            {r.format}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{r.description}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-400">
          <span>Period {r.period}</span>
          <span aria-hidden className="text-slate-200">|</span>
          <span>Owner {owner?.name ?? r.ownerId}</span>
          <span aria-hidden className="text-slate-200">|</span>
          <span>
            Last generated{" "}
            <span className="tabular-nums">{r.lastGenerated ? `${fmtDateTime(r.lastGenerated)} (${relTime(r.lastGenerated)})` : "—"}</span>
          </span>
          <span aria-hidden className="text-slate-200">|</span>
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" aria-hidden /> {r.schedule}
          </span>
        </p>
        {generating && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-blue-700">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" aria-hidden />
            Generating — the library refreshes when the run completes.
          </p>
        )}
        {failed && r.dataNote && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-red-700" role="note">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden />
            {r.dataNote}
          </p>
        )}
        {!failed && r.dataNote && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-amber-800" role="note">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
            {r.dataNote}
          </p>
        )}
        {r.recipients.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-400">
            Recipients:
            {r.recipients.map((rec) => (
              <span key={rec} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px font-medium text-slate-500">
                {rec}
              </span>
            ))}
          </p>
        )}
      </div>

      <div className="flex w-full shrink-0 flex-wrap items-center gap-1.5 sm:w-auto sm:flex-col sm:items-end">
        {busy ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" aria-hidden /> Working…
          </span>
        ) : (
          <>
            <Button size="sm" variant="outline" className="h-8 gap-1" disabled={!ready} title={ready ? "Open in the report viewer" : notReadyHint} onClick={onOpen}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1" disabled={!ready} title={ready ? "Export as PDF or XLSX" : notReadyHint} onClick={onExport}>
              <FileDown className="h-3.5 w-3.5" aria-hidden /> Export
            </Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1" title="Update the generation schedule" onClick={onSchedule}>
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Schedule
            </Button>
            {failed ? (
              <Button size="sm" className="h-8 gap-1" title={r.dataNote ?? "Run the report again"} onClick={onGenerate}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Regenerate
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-8 gap-1" disabled={generating} title={generating ? "Already running — wait for the current run." : "Run the report now"} onClick={onGenerate}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Generate
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  );
}
