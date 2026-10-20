"use client";

import * as React from "react";
import { Plus, Save, Trash2 } from "lucide-react";
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
  DatasetView,
  ScopeNote,
  useAnalyticsSection,
  analyticsPost,
} from "../analytics/parts";
import type { DatasetResult } from "@/lib/qubit/analytics-server";
import { DATASETS, type ReportViz } from "@/lib/qubit/analytics-data";

// ============================================================
// Screen 279 · Custom Report Builder — a GOVERNED builder over
// the semantic layer (spec §21). There is no SQL surface: the
// caller picks a dataset, its whitelisted dimensions/measures,
// filters and a visualization; the server re-validates every
// field against the caller's dataset permissions, computes the
// grouping and returns only authorized rows. Save/duplicate/
// preview/validate are real; visibility rules are server-side.
// ============================================================

interface CatalogPayload {
  asOfLabel: string;
  datasets: { id: string; label: string; description: string; system: string; fields: number; sensitive: boolean; defaultViz: ReportViz }[];
  reports: { id: string; name: string; description: string; visibility: string; ownerName: string; viz: string; datasetId: string }[];
}

interface FieldDef {
  id: string;
  label: string;
  kind: "dimension" | "measure";
  type: string;
  description: string;
  sensitive?: boolean;
}

const VIZ_OPTIONS: { id: ReportViz; label: string }[] = [
  { id: "table", label: "Table" },
  { id: "bar", label: "Bar" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
  { id: "kpi", label: "KPI" },
];

export function ReportBuilderScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { data, loading, error, reload } = useAnalyticsSection<CatalogPayload>("catalog");
  const go = (screen: Parameters<typeof nav.navigate>[0], params?: Parameters<typeof nav.navigate>[1]) => () => nav.navigate(screen, params);

  const [datasetId, setDatasetId] = React.useState<string>("");
  const [dims, setDims] = React.useState<string[]>([]);
  const [measures, setMeasures] = React.useState<string[]>([]);
  const [viz, setViz] = React.useState<ReportViz>("table");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [visibility, setVisibility] = React.useState("Private");
  const [preview, setPreview] = React.useState<DatasetResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  const ds = DATASETS.find((d) => d.id === datasetId) ?? null;

  React.useEffect(() => {
    if (!ds) return;
    setDims(ds.fields.filter((f) => f.kind === "dimension").slice(0, 1).map((f) => f.id));
    setMeasures(ds.fields.filter((f) => f.kind === "measure").slice(0, 2).map((f) => f.id));
    setViz(ds.defaultViz);
    setPreview(null);
  }, [datasetId]);

  const runPreview = async () => {
    setBusy(true);
    setPreviewError(null);
    try {
      const res = await analyticsPost<{ ok: boolean; result: DatasetResult }>(
        "report.preview",
        { datasetId, dimensions: dims, measures, filters: [], viz },
        role,
      );
      setPreview(res.result);
    } catch (e) {
      setPreview(null);
      setPreviewError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = await analyticsPost<{ ok: boolean; report: { id: string } }>(
        "report.save",
        { name, description, datasetId, dimensions: dims, measures, filters: [], viz, visibility },
        role,
      );
      toast({ title: "Report saved", description: `“${name}” is saved with ${visibility.toLowerCase()} visibility and recorded in the audit trail.` });
      nav.navigate("report-detail", { reportId: res.report.id });
    } catch (e) {
      toast({ title: "Could not save report", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const canSave = name.trim().length >= 4 && datasetId && (dims.length > 0 || measures.length > 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Analytics" }, { label: "Report Builder" }]}
        title="Custom Report Builder"
        description="Build reports on the governed semantic layer — no SQL, whitelisted fields only, permissions re-checked on the server for every call."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={runPreview} disabled={!datasetId || busy}>
              Preview
            </Button>
            <Button size="sm" onClick={save} disabled={!canSave || busy}>
              <Save className="h-4 w-4" aria-hidden /> Save Report
            </Button>
          </>
        }
      />

      {loading && <AnalyticsSkeleton rows={4} />}
      {error && !loading && <AnalyticsErrorBanner message={error} onRetry={reload} />}

      {data && !loading && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
          {/* Builder configuration */}
          <div className="space-y-5">
            <SectionCard title="1 · Dataset" description="Only datasets your role is authorized for are listed — the server enforces this.">
              {data.datasets.length === 0 ? (
                <EmptyState title="No datasets available" message="Your boundary has no dataset permissions yet." />
              ) : (
                <ul className="space-y-1.5">
                  {data.datasets.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setDatasetId(d.id)}
                        aria-pressed={datasetId === d.id}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${datasetId === d.id ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                      >
                        <span className="flex items-center gap-2 text-[13px] font-medium text-slate-900">
                          {d.label}
                          {d.sensitive && <span className="rounded-full border border-rose-100 bg-rose-50 px-1.5 py-px text-[10px] font-semibold text-rose-600">Sensitive</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-slate-400">{d.system} · {d.fields} governed fields</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {ds && (
              <SectionCard title="2 · Fields" description="Dimensions group rows; measures aggregate them. Sensitive fields are policy-flagged.">
                <div className="space-y-3">
                  <fieldset>
                    <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Dimensions</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {ds.fields.filter((f) => f.kind === "dimension").map((f: FieldDef) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggle(dims, setDims, f.id)}
                          aria-pressed={dims.includes(f.id)}
                          title={f.description}
                          className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${dims.includes(f.id) ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Measures</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {ds.fields.filter((f) => f.kind === "measure").map((f: FieldDef) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggle(measures, setMeasures, f.id)}
                          aria-pressed={measures.includes(f.id)}
                          title={f.description}
                          className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${measures.includes(f.id) ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Visualization</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {VIZ_OPTIONS.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setViz(v.id)}
                          aria-pressed={viz === v.id}
                          className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${viz === v.id ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </SectionCard>
            )}

            <SectionCard title="3 · Name & sharing" description="Reports are Private by default; Company visibility requires an administrator.">
              <div className="space-y-3">
                <div>
                  <label htmlFor="rpt-name" className="mb-1 block text-[12px] font-medium text-slate-600">Report name</label>
                  <Input id="rpt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pipeline value by region" className="h-9 text-[13px]" maxLength={120} />
                </div>
                <div>
                  <label htmlFor="rpt-desc" className="mb-1 block text-[12px] font-medium text-slate-600">Description (optional)</label>
                  <Input id="rpt-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this report answer?" className="h-9 text-[13px]" maxLength={400} />
                </div>
                <div>
                  <span className="mb-1.5 block text-[12px] font-medium text-slate-600">Visibility</span>
                  <div className="flex gap-1.5">
                    {["Private", "Department", "Company"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVisibility(v)}
                        aria-pressed={visibility === v}
                        className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${visibility === v ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  {visibility === "Company" && role !== "administrator" && (
                    <ScopeNote className="mt-2">Company-wide visibility requires an administrator — the server will reject the save otherwise.</ScopeNote>
                  )}
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Preview */}
          <div className="space-y-5">
            <SectionCard
              title="Preview"
              description="Computed by the semantic layer at your scope — the same result the saved report will serve."
              actions={
                preview && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={runPreview} disabled={busy}>
                    Re-run preview
                  </Button>
                )
              }
            >
              {busy && <AnalyticsSkeleton rows={3} />}
              {!busy && previewError && <AnalyticsErrorBanner message={previewError} onRetry={runPreview} />}
              {!busy && !previewError && !preview && (
                <EmptyState
                  icon={<Plus aria-hidden />}
                  title="Configure a dataset to preview"
                  message="Pick a dataset, at least one dimension or measure, then run the preview. Nothing touches the source until you do."
                />
              )}
              {!busy && !previewError && preview && (
                <>
                  <DatasetView result={preview} viz={viz} />
                  <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                    <ScopeNote><span className="font-medium text-slate-600">Lineage:</span> {preview.system} — {preview.sourceNote}</ScopeNote>
                    {preview.scopeNote && <ScopeNote>{preview.scopeNote}</ScopeNote>}
                    {preview.totalNote && <ScopeNote>{preview.totalNote}</ScopeNote>}
                  </div>
                </>
              )}
            </SectionCard>

            <SectionCard title="Start from a saved report" description="Opening a saved report you can see; duplicates land as Private copies you own.">
              <ul className="divide-y divide-slate-50">
                {data.reports.map((r) => (
                  <li key={r.id} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                    <button type="button" onClick={go("report-detail", { reportId: r.id })} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[13px] font-medium text-slate-900 hover:text-blue-700">{r.name}</span>
                      <span className="block truncate text-[11px] text-slate-400">{r.ownerName} · {r.visibility} · {r.viz}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <AnalyticsAsOf asOfLabel={data.asOfLabel} />
          </div>
        </div>
      )}
    </div>
  );
}
