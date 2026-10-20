"use client";

import * as React from "react";
import { CheckCircle2, CircleDashed, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { useRole } from "../role-context";
import {
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
// Screen 303 · Accessibility Review — accessibility governance:
// the checklist contract, real findings with severity/owner/status,
// and audited updates. Internal quality governance surface.
// ============================================================

interface A11yPayload {
  checks: { id: string; label: string; detail: string; status: string; detailNote: string }[];
  findings: { id: string; severity: string; screen: string; component: string; issue: string; status: string; owner: string; resolution?: string; detectedAt: number }[];
  stats: { open: number; resolved: number; critical: number };
  sourceNote: string;
}

const SEVERITIES = ["All", "critical", "major", "minor"] as const;
const STATES = ["All", "Open", "Resolved"] as const;

export function AccessibilityReviewScreen() {
  const { role } = useRole();
  const { data, loading, error, reload } = usePlatformSection<A11yPayload>("a11y");
  const [sev, setSev] = React.useState<string>("All");
  const [state, setState] = React.useState<string>("All");
  const [busy, setBusy] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [form, setForm] = React.useState({ screen: "", component: "", issue: "", severity: "minor" });

  const findings = (data?.findings ?? []).filter(
    (f) => (sev === "All" || f.severity === sev) && (state === "All" || f.status === state),
  );

  const resolve = async (id: string, status: "Resolved" | "Open") => {
    setBusy(true);
    try {
      await platformPost("a11y.finding.update", { id, status, resolution: status === "Resolved" ? "Verified fixed during Phase 18 review." : undefined }, role);
      toast({ title: `Finding marked ${status.toLowerCase()}` });
      reload();
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const record = async () => {
    setBusy(true);
    try {
      await platformPost("a11y.finding.record", form, role);
      toast({ title: "Finding recorded" });
      setAddOpen(false);
      setForm({ screen: "", component: "", issue: "", severity: "minor" });
      reload();
    } catch (e) {
      toast({ title: "Could not record", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Platform Ops" }]}
        title="Accessibility Review"
        description="Keyboard, focus, contrast, labels, semantics, screen readers, forms, touch targets, motion and zoom — governed here, not left to goodwill."
        actions={
          <Button variant="outline" onClick={() => setAddOpen((v) => !v)} className="min-h-[44px]">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Record finding
          </Button>
        }
      />

      {loading && <PlatformSkeleton />}
      {error && !loading && <PlatformError message={error} onRetry={reload} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <PlatformCard className="text-center">
              <p className="text-2xl font-semibold tabular-nums text-amber-700">{data.stats.open}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Open</p>
            </PlatformCard>
            <PlatformCard className="text-center">
              <p className="text-2xl font-semibold tabular-nums text-red-700">{data.stats.critical}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Critical open</p>
            </PlatformCard>
            <PlatformCard className="text-center">
              <p className="text-2xl font-semibold tabular-nums text-emerald-700">{data.stats.resolved}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Resolved</p>
            </PlatformCard>
          </div>

          {addOpen && (
            <SectionCard title="Record a finding" description="Stored server-side with audit; the record, not the intention, is the governance artifact.">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Affected screen (e.g. 267 Analytics Home)" value={form.screen} onChange={(e) => setForm({ ...form, screen: e.target.value })} className="min-h-[44px]" />
                <Input placeholder="Component (e.g. date picker)" value={form.component} onChange={(e) => setForm({ ...form, component: e.target.value })} className="min-h-[44px]" />
                <Input placeholder="Issue description (8+ chars)" value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} className="min-h-[44px] sm:col-span-2" />
                <select
                  aria-label="Severity"
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-[13px]"
                >
                  <option value="critical">Critical</option>
                  <option value="major">Major</option>
                  <option value="minor">Minor</option>
                </select>
                <Button onClick={record} disabled={busy || form.issue.trim().length < 8 || !form.screen.trim()} className="min-h-[44px]">
                  Save finding
                </Button>
              </div>
            </SectionCard>
          )}

          <SectionCard title="WCAG contract" description="The ten checks every Phase 18 screen is held to (spec §24 / §39).">
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  <div>
                    <p className="text-[12.5px] font-semibold text-slate-900">{c.label}</p>
                    <p className="text-[11.5px] leading-snug text-slate-500">{c.detailNote}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Findings"
            description="Filter by severity and state. Every change is written to the audit trail."
            actions={
              <div className="flex flex-wrap gap-1.5">
                {SEVERITIES.map((s) => (
                  <button key={s} type="button" onClick={() => setSev(s)}
                    className={sev === s ? "min-h-[36px] rounded-full border border-blue-600 bg-blue-600 px-3 text-[12px] font-medium text-white" : "min-h-[36px] rounded-full border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 hover:border-slate-300"}>
                    {s}
                  </button>
                ))}
                <span className="mx-1 w-px bg-slate-200" aria-hidden />
                {STATES.map((s) => (
                  <button key={s} type="button" onClick={() => setState(s)}
                    className={state === s ? "min-h-[36px] rounded-full border border-blue-600 bg-blue-600 px-3 text-[12px] font-medium text-white" : "min-h-[36px] rounded-full border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 hover:border-slate-300"}>
                    {s}
                  </button>
                ))}
              </div>
            }
          >
            {findings.length ? (
              <ul className="space-y-2.5">
                {findings.map((f) => (
                  <li key={f.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-slate-900">{f.screen} · {f.component}</span>
                      <span className="flex items-center gap-2">
                        <span className={f.severity === "critical" ? "text-[10.5px] font-bold uppercase text-red-700" : f.severity === "major" ? "text-[10.5px] font-bold uppercase text-amber-700" : "text-[10.5px] font-bold uppercase text-slate-500"}>{f.severity}</span>
                        <StatusWord status={f.status === "Resolved" ? "PASS" : "Degraded"} />
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-snug text-slate-600">{f.issue}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[10.5px] text-slate-400">Owner {f.owner} · detected {new Date(f.detectedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}{f.resolution ? ` · ${f.resolution}` : ""}</p>
                      {f.status === "Open" && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => resolve(f.id, "Resolved")} className="min-h-[36px]">
                          <CircleDashed className="mr-1 h-3.5 w-3.5" aria-hidden /> Mark resolved
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-slate-500">No findings match the current filters.</p>
            )}
          </SectionCard>

          <PlatformNote title="Scope note">
            Findings seeded here come from this platform's own review passes. The list is never padded with invented issues, and resolved states require a recorded resolution.
          </PlatformNote>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
