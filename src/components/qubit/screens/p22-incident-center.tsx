"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, fmtIST, opsPost, timeAgo, useOpsSection } from "../ops/parts";

// ============================================================
// P22-23 · Production Incident Center
// Declare, triage and resolve production incidents with a
// complete audited timeline. The registry is seeded EMPTY: an
// empty list means nothing was recorded — never that incidents
// cannot occur.
// ============================================================

interface TimelineEntry { at: number; text: string; by: string; }

interface IncidentRow {
  id: string; severity: string; title: string; services: string[];
  startedAt: number; status: string; owner: string; responders: string[];
  impact: string; timeline: TimelineEntry[]; resolution: string | null;
  createdAt: number; createdBy: string; updatedAt: number;
}

interface IncidentsPayload {
  incidents: IncidentRow[];
  openCount: number;
  severities: string[];
  lifecycle: string[];
  linksNote: string;
  sourceNote: string;
}

interface ActionResult { ok?: boolean; message?: string; data?: { ok?: boolean; message?: string } }

/** The ops route returns the Result envelope { ok, data: { ok, message } } — unwrap defensively. */
function messageOf(res: ActionResult): string | undefined {
  return res.data?.message ?? res.message;
}

function SevChip({ sev }: { sev: string }) {
  const cls =
    sev === "SEV-1" ? "border-red-300 bg-red-50 text-red-800"
      : sev === "SEV-2" ? "border-amber-300 bg-amber-50 text-amber-800"
        : sev === "SEV-3" ? "border-slate-300 bg-slate-100 text-slate-700"
          : "border-slate-200 bg-slate-50 text-slate-500";
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-bold tracking-wide", cls)}>{sev}</span>;
}

function incidentHealth(status: string): string {
  if (status === "resolved" || status === "post-incident-review") return "healthy";
  if (["detected", "investigating", "mitigating", "monitoring"].includes(status)) return "degraded";
  return "unknown";
}

function Field({ id, label, hint, required, children }: { id: string; label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[11.5px] font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-slate-400">{hint}</p>}
    </div>
  );
}

function IncidentCard({ inc, lifecycle, busy, onUpdate }: {
  inc: IncidentRow;
  lifecycle: string[];
  busy: boolean;
  onUpdate: (inc: IncidentRow, status: string, note: string, resolution: string) => Promise<boolean>;
}) {
  const [nextStatus, setNextStatus] = React.useState(inc.status);
  const [note, setNote] = React.useState("");
  const [resolution, setResolution] = React.useState("");
  const needsResolution = nextStatus === "resolved" || nextStatus === "post-incident-review";
  const changed = nextStatus !== inc.status;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        <SevChip sev={inc.severity} />
        <span className="font-mono text-[11px] font-semibold text-slate-400">{inc.id}</span>
        <span className="text-[13px] font-semibold text-slate-900">{inc.title}</span>
        <OpsHealthBadge health={incidentHealth(inc.status)} />
      </div>

      <div className="mt-2 grid gap-x-6 gap-y-1 text-[12px] text-slate-600 sm:grid-cols-2">
        <p>
          <span className="font-medium text-slate-700">Started:</span>{" "}
          <span className="tabular-nums">{fmtIST(inc.startedAt)}</span>{" "}
          <span className="text-slate-400">({timeAgo(inc.startedAt)})</span>
        </p>
        <p><span className="font-medium text-slate-700">Owner:</span> {inc.owner}</p>
        <p className="sm:col-span-2"><span className="font-medium text-slate-700">Impact:</span> {inc.impact || "—"}</p>
        {inc.services.length > 0 && (
          <p className="sm:col-span-2">
            <span className="font-medium text-slate-700">Services:</span>{" "}
            {inc.services.map((s) => (
              <span key={s} className="mr-1.5 inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] font-medium text-slate-600">{s}</span>
            ))}
          </p>
        )}
        {inc.resolution && (
          <p className="sm:col-span-2"><span className="font-medium text-slate-700">Resolution:</span> {inc.resolution}</p>
        )}
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Timeline</p>
        <ol className="mt-1.5 space-y-1.5 border-l border-slate-200 pl-3">
          {inc.timeline.map((t, i) => (
            <li key={`${t.at}-${i}`} className="text-[12px] leading-snug text-slate-600">
              <span className="font-medium tabular-nums text-slate-500">{fmtIST(t.at)}</span> — {t.text}{" "}
              <span className="text-slate-400">· {t.by}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
        <div className="w-44 space-y-1.5">
          <label htmlFor={`inc-status-${inc.id}`} className="block text-[11.5px] font-medium text-slate-600">Transition to</label>
          <Select value={nextStatus} onValueChange={setNextStatus}>
            <SelectTrigger id={`inc-status-${inc.id}`} aria-label={`Status transition for ${inc.id}`} className="w-full rounded-lg border-slate-300 bg-white text-[12.5px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lifecycle.map((s) => (
                <SelectItem key={s} value={s} className="text-[12.5px]">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-48 flex-1 space-y-1.5">
          <label htmlFor={`inc-note-${inc.id}`} className="block text-[11.5px] font-medium text-slate-600">Note (optional, recorded)</label>
          <Input
            id={`inc-note-${inc.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was observed or done"
            className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px]"
          />
        </div>
        {needsResolution && (
          <div className="min-w-48 flex-1 space-y-1.5">
            <label htmlFor={`inc-resolution-${inc.id}`} className="block text-[11.5px] font-medium text-slate-600">Resolution</label>
            <Input
              id={`inc-resolution-${inc.id}`}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="What resolved it"
              className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px]"
            />
          </div>
        )}
        <Button
          size="sm"
          disabled={busy || !changed}
          title={changed ? `Move ${inc.id} to ${nextStatus}` : "Choose a different status to record a transition"}
          onClick={() => { void onUpdate(inc, nextStatus, note, resolution).then((ok) => { if (ok) { setNote(""); setResolution(""); } }); }}
          className="min-h-[36px]"
        >
          Apply transition
        </Button>
      </div>
    </div>
  );
}

export function P22IncidentCenterScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<IncidentsPayload>("incidents");
  const [busy, setBusy] = React.useState(false);

  // Declare-incident form state.
  const [title, setTitle] = React.useState("");
  const [severity, setSeverity] = React.useState("SEV-3");
  const [services, setServices] = React.useState("");
  const [impact, setImpact] = React.useState("");

  const declareIncident = async () => {
    if (title.trim().length < 4) {
      toast({ title: "Title is required", description: "Use at least 4 characters describing what is wrong.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await opsPost<ActionResult>("incident.create", {
        title: title.trim(),
        severity,
        services: services.split(",").map((s) => s.trim()).filter(Boolean),
        impact,
      });
      toast({ title: "Incident recorded", description: messageOf(res) });
      setTitle(""); setSeverity("SEV-3"); setServices(""); setImpact("");
      reload();
    } catch (e) {
      toast({ title: "Could not record incident", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const updateIncident = async (inc: IncidentRow, status: string, note: string, resolution: string): Promise<boolean> => {
    setBusy(true);
    try {
      const res = await opsPost<ActionResult>("incident.update", {
        id: inc.id,
        status,
        note: note.trim() || undefined,
        resolution: resolution.trim() || undefined,
      });
      toast({ title: `Incident ${inc.id} updated`, description: messageOf(res) });
      reload();
      return true;
    } catch (e) {
      toast({ title: "Transition failed", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Production Incident Center"
        description="Declare, triage and resolve production incidents with a complete audited timeline."
        actions={
          data ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-semibold tabular-nums",
                data.openCount > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700",
              )}
            >
              {data.openCount} open
            </span>
          ) : undefined
        }
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <SectionCard
            title="Declare incident"
            description="Declaring records the incident with severity, owner and an audited timeline entry — immediately."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="inc-title" label="Title" required hint="What is wrong, stated plainly.">
                <Input
                  id="inc-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="API latency spike after deploy"
                  className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px]"
                />
              </Field>
              <Field id="inc-sev" label="Severity" hint="SEV-1 is the most severe.">
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger id="inc-sev" aria-label="Incident severity" className="w-full rounded-lg border-slate-300 bg-white text-[12.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {data.severities.map((s) => (
                      <SelectItem key={s} value={s} className="text-[12.5px]">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="inc-services" label="Services" hint="Comma-separated, e.g. api, dashboard.">
                <Input
                  id="inc-services"
                  value={services}
                  onChange={(e) => setServices(e.target.value)}
                  placeholder="api, dashboard"
                  className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px]"
                />
              </Field>
              <Field id="inc-impact" label="Impact" hint="Who or what is affected, and how.">
                <Textarea
                  id="inc-impact"
                  rows={2}
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                  className="rounded-lg border-slate-300 bg-white text-[12.5px]"
                />
              </Field>
            </div>
            <div className="mt-4">
              <Button onClick={() => void declareIncident()} disabled={busy} className="min-h-[44px]">
                Declare incident
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Incidents" description="Sorted by most recently started. Every transition is appended to the timeline and audited.">
            {data.incidents.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-slate-500">
                No incidents recorded — an empty list means nothing was recorded, not that incidents cannot occur.
              </p>
            ) : (
              <div className="space-y-3">
                {data.incidents.map((inc) => (
                  <IncidentCard key={inc.id} inc={inc} lifecycle={data.lifecycle} busy={busy} onUpdate={updateIncident} />
                ))}
              </div>
            )}
          </SectionCard>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" role="note">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-600">Correlations</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{data.linksNote}</p>
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
