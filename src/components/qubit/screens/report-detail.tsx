"use client";

import * as React from "react";
import { CalendarClock, Copy, Download, FileText, RefreshCw, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard, KV } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  AnalyticsAsOf,
  AnalyticsErrorBanner,
  AnalyticsSkeleton,
  DatasetView,
  ScopeNote,
  SourceLine,
  VisibilityChip,
  analyticsPost,
  useAnalyticsSection,
} from "../analytics/parts";
import type { DatasetResult } from "@/lib/qubit/analytics-server";

// ============================================================
// Screen 280 · Report Detail — the saved report viewing
// experience (spec §22): title, owner, description, freshness,
// lineage, metric definitions and the visualization — with only
// the actions the caller's role allows (server-enforced behind
// each button). Partial/stale data is surfaced via the dataset
// freshness badge; the audit trail records every consequential
// action.
// ============================================================

interface ReportPayload {
  asOfLabel: string;
  report: {
    id: string;
    name: string;
    description: string;
    ownerName: string;
    visibility: string;
    createdAt: number;
    updatedAt: number;
    lastRun?: number;
    status: string;
    config: { datasetId: string; dimensions: string[]; measures: string[]; filters: { dimension: string; value: string }[]; viz: string };
    favorite: boolean;
  };
  dataset: { id: string; label: string; system: string; sourceNote: string; freshness: { status: string; updatedAt: number; label: string; detail?: string }; sensitive: boolean };
  result: DatasetResult;
  metricDefinitions: { field: string; label: string; description: string; kind: string }[];
  isOwner: boolean;
  canExport: boolean;
  canSchedule: boolean;
}

export function ReportDetailScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const reportId = nav.params.reportId ?? null;
  const { data, loading, error, reload } = useAnalyticsSection<ReportPayload>("report", { id: reportId ?? undefined });
  const [busy, setBusy] = React.useState(false);
  const go = (screen: Parameters<typeof nav.navigate>[0], params?: Parameters<typeof nav.navigate>[1]) => () => nav.navigate(screen, params);

  const act = async (type: string, input: Record<string, unknown>, done?: () => void) => {
    setBusy(true);
    try {
      const res = await analyticsPost<{ ok: boolean; message?: string }>(type, input, role);
      if (res.message) toast({ title: res.message.split(" — ")[0], description: res.message });
      reload();
      done?.();
    } catch (e) {
      toast({ title: "Action failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!reportId) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader crumbs={[{ label: "Analytics" }, { label: "Report Detail" }]} title="Report Detail" />
        <EmptyState
          icon={<FileText aria-hidden />}
          title="No report selected"
          message="Open a report from Analytics Home (267), the catalog, or the Report Builder."
          action={<Button size="sm" onClick={go("analytics-home")}>Analytics Home</Button>}
        />
      </div>
    );
  }

  if (loading) return <div className="mx-auto max-w-6xl"><PageHeader crumbs={[{ label: "Analytics" }, { label: "Report Detail" }]} title="Report Detail" /> <AnalyticsSkeleton rows={4} /></div>;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader crumbs={[{ label: "Analytics" }, { label: "Report Detail" }]} title="Report Detail" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-sm font-medium text-amber-900">{error}</p>
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={reload} className="text-[12.5px] font-medium text-amber-900 underline">Retry</button>
            <button type="button" onClick={go("analytics-home")} className="text-[12.5px] font-medium text-amber-900 underline">Analytics Home</button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const r = data.report;
  const d = data.dataset;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Report Detail" }, { label: r.name }]}
        title={r.name}
        description={r.description || "Saved report on the governed semantic layer."}
        meta={
          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500">
            <VisibilityChip visibility={r.visibility} />
            <span>{r.ownerName}</span>
            <span>· updated {new Date(r.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
            {r.lastRun && <span>· last run {new Date(r.lastRun).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
            <StatusChip status={r.status} />
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8" onClick={() => act("report.favorite", { id: r.id })} disabled={busy} aria-label={r.favorite ? "Remove from favorites" : "Add to favorites"}>
              <Star className={`h-4 w-4 ${r.favorite ? "fill-amber-400 text-amber-400" : ""}`} aria-hidden />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => act("report.run", { id: r.id })} disabled={busy || r.status === "Generating"}>
              <RefreshCw className={`h-3.5 w-3.5 ${r.status === "Generating" ? "animate-spin" : ""}`} aria-hidden /> Refresh
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => act("report.duplicate", { id: r.id })} disabled={busy}>
              <Copy className="h-3.5 w-3.5" aria-hidden /> Duplicate
            </Button>
            {data.canExport && (
              <Button variant="outline" size="sm" className="h-8" onClick={go("data-export", { reportId: r.id })} disabled={busy}>
                <Download className="h-3.5 w-3.5" aria-hidden /> Export
              </Button>
            )}
            {data.canSchedule && (
              <Button variant="outline" size="sm" className="h-8" onClick={go("scheduled-reports", { reportId: r.id })} disabled={busy}>
                <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Schedule
              </Button>
            )}
            {data.isOwner && (
              <Button variant="outline" size="sm" className="h-8 text-rose-600 hover:bg-rose-50" onClick={() => act("report.delete", { id: r.id }, () => nav.navigate("analytics-home"))} disabled={busy}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-5">
        {/* Lineage & freshness — visible before the data */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <SectionCard title="Lineage" description="Where this report's data comes from." className="lg:col-span-2">
            <dl>
              <KV label="Dataset">{d.label}</KV>
              <KV label="Source system">{d.system}</KV>
              <KV label="Source note">{d.sourceNote}</KV>
              <KV label="Filters">{r.config.filters.length > 0 ? r.config.filters.map((f) => `${f.dimension}: ${f.value}`).join(", ") : "None"}</KV>
              <KV label="Grouping">{r.config.dimensions.join(", ") || "—"}</KV>
              <KV label="Measures">{r.config.measures.join(", ") || "—"}</KV>
            </dl>
          </SectionCard>
          <SectionCard title="Freshness & access" description="Stale or partial data is never hidden.">
            <div className="space-y-3">
              <SourceLine system={d.system} freshness={d.freshness as never} />
              {d.freshness.detail && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900">{d.freshness.detail}</p>}
              {d.sensitive && (
                <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-800">
                  Sensitive dataset — exports require a recorded reason and are written to the audit trail with Warning severity.
                </p>
              )}
              <ScopeNote>Report visibility is enforced server-side on every request — sharing changes nothing for boundaries without access.</ScopeNote>
            </div>
          </SectionCard>
        </div>

        {/* The report visualization */}
        <SectionCard
          title="Report data"
          description={`${data.result.rowCount} rows · grouped by ${r.config.dimensions.join(", ") || "no dimension"}`}
          actions={
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={reload} disabled={busy}>
              Re-render
            </Button>
          }
        >
          <DatasetView result={data.result} viz={r.config.viz as never} />
          {data.result.scopeNote && <ScopeNote className="mt-3">{data.result.scopeNote}</ScopeNote>}
          {data.result.totalNote && <ScopeNote className="mt-1.5">{data.result.totalNote}</ScopeNote>}
        </SectionCard>

        {/* Metric definitions — governance travels with the report */}
        <SectionCard title="Metric definitions" description="Field-level definitions from the governed catalog — they travel with the report.">
          <ul className="divide-y divide-slate-50">
            {data.metricDefinitions.map((m) => (
              <li key={m.field} className="py-2.5 first:pt-0 last:pb-0">
                <p className="text-[12.5px] font-semibold text-slate-900">{m.label} <span className="ml-1.5 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-medium text-slate-500">{m.kind}</span></p>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <AnalyticsAsOf asOfLabel={data.asOfLabel} />
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone = status === "Ready" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : status === "Generating" ? "border-blue-100 bg-blue-50 text-blue-700" : "border-rose-100 bg-rose-50 text-rose-700";
  return <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${tone}`}>{status}</span>;
}
