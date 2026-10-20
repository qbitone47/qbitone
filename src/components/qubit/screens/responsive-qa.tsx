"use client";

import * as React from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { useRole } from "../role-context";
import {
  MetricTile,
  PlatformCard,
  PlatformError,
  PlatformNote,
  PlatformSkeleton,
  SourceLine,
  StatusWord,
  platformPost,
  usePlatformSection,
} from "../platform/parts";

// ============================================================
// Screen 301 · Responsive QA Dashboard — internal QA over the whole
// product. Registry integrity is computed live from the actual
// screen registry; QA runs and findings are recorded server-side
// with audit. Internal governance surface — not customer-facing.
// ============================================================

interface QaPayload {
  registry: {
    totalScreens: number; totalModules: number; duplicateIds: number; duplicateNums: string[];
    phase18Missing: string[]; integrity: string;
    modules: { module: string; count: number }[];
  };
  breakpoints: { id: string; label: string; width: number; height: number }[];
  coverage: { area: string; status: string; note: string }[];
  findings: { id: string; severity: string; screen: string; component: string; issue: string; status: string; owner: string }[];
  qaRuns: { id: string; at: number; screensChecked: number; issuesFound: number; result: string }[];
  a11ySummary: { open: number; resolved: number; link: string };
  sourceNote: string;
}

export function ResponsiveQaScreen() {
  const { role } = useRole();
  const { data, loading, error, forbidden, reload } = usePlatformSection<QaPayload>("qa");
  const [busy, setBusy] = React.useState(false);

  const runQa = async () => {
    setBusy(true);
    try {
      const res = await platformPost<{ message: string }>("qa.run", {}, role);
      toast({ title: "QA run recorded", description: res.message });
      reload();
    } catch (e) {
      toast({ title: "QA run failed", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Platform Ops" }]}
        title="Responsive QA Dashboard"
        description="Internal QA over the whole product — registry integrity, breakpoint coverage and recorded findings. Not a customer-facing feature."
        actions={
          <Button onClick={runQa} disabled={busy} className="min-h-[44px]">
            <Play className="mr-1.5 h-4 w-4" aria-hidden /> Run QA check
          </Button>
        }
      />

      {loading && <PlatformSkeleton />}
      {error && !loading && <PlatformError message={error} onRetry={forbidden ? undefined : reload} />}
      {forbidden && !loading && (
        <PlatformNote tone="warn" title="Administrator boundary">
          This is an internal platform-operations surface. The server enforces the administrator boundary — your preview role is recorded with the denial.
        </PlatformNote>
      )}
      {data && !loading && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile label="Screens in registry" value={data.registry.totalScreens} />
            <MetricTile label="Modules" value={data.registry.totalModules} />
            <MetricTile label="Duplicate ids/nums" value={data.registry.duplicateIds + data.registry.duplicateNums.length} tone={data.registry.duplicateIds + data.registry.duplicateNums.length ? "red" : "green"} />
            <MetricTile label="Integrity" value={<StatusWord status={data.registry.integrity} />} />
          </div>

          <SectionCard title="Registry integrity" description="Computed live from screens.ts — the same source the sidebar and navigation render from.">
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-3">
              {data.registry.modules.map((m) => (
                <li key={m.module} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1">
                  <span className="truncate text-slate-600">{m.module}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{m.count}</span>
                </li>
              ))}
            </ul>
            {data.registry.phase18Missing.length > 0 && (
              <PlatformNote tone="warn" title="Phase 18 screens missing">
                {data.registry.phase18Missing.join(", ")}
              </PlatformNote>
            )}
          </SectionCard>

          <SectionCard title="Breakpoint matrix" description="The viewport contract QA validates against (spec §22).">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {data.breakpoints.map((b) => (
                <PlatformCard key={b.id} className="p-3 text-center">
                  <p className="text-[12.5px] font-semibold text-slate-900">{b.label}</p>
                  <p className="text-[11.5px] tabular-nums text-slate-500">{b.width}×{b.height}</p>
                </PlatformCard>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Coverage" description="What has genuinely been exercised — and what has not.">
            <ul className="divide-y divide-slate-100">
              {data.coverage.map((c) => (
                <li key={c.area} className="flex items-start gap-3 py-2.5">
                  <span className="mt-0.5 shrink-0"><StatusWord status={c.status} /></span>
                  <div>
                    <p className="text-[13px] font-medium text-slate-900">{c.area}</p>
                    <p className="text-[11.5px] leading-snug text-slate-500">{c.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="QA findings" description="Server-recorded; resolving one is an audited action.">
              {data.findings.length ? (
                <ul className="space-y-2.5">
                  {data.findings.map((f) => (
                    <li key={f.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-slate-900">{f.screen} · {f.component}</span>
                        <span className={f.severity === "critical" ? "text-[10.5px] font-bold uppercase text-red-700" : f.severity === "major" ? "text-[10.5px] font-bold uppercase text-amber-700" : "text-[10.5px] font-bold uppercase text-slate-500"}>{f.severity}</span>
                      </div>
                      <p className="mt-1 text-[12px] leading-snug text-slate-600">{f.issue}</p>
                      <p className="mt-1 text-[10.5px] text-slate-400">Owner {f.owner} · {f.status}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-slate-500">No QA findings recorded.</p>
              )}
            </SectionCard>

            <SectionCard title="Recent QA runs" description="Each run re-computes registry integrity and records the result.">
              {data.qaRuns.length ? (
                <ul className="space-y-2">
                  {data.qaRuns.map((r) => (
                    <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span className="text-[12px] tabular-nums text-slate-500">{new Date(r.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                      <span className="text-[12.5px] font-medium text-slate-800">{r.screensChecked} screens · {r.result}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-slate-500">No runs recorded yet — use “Run QA check”.</p>
              )}
              <PlatformNote>
                {data.a11ySummary.link} Currently {data.a11ySummary.open} open, {data.a11ySummary.resolved} resolved.
              </PlatformNote>
            </SectionCard>
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
