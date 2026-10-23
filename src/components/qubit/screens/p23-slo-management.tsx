"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, fmtIST, obsPost, useObsSection } from "../obs/parts";

// ============================================================
// P23-13 · SLO / SLA Management — targets are NEVER invented.
// An SLO exists only when an administrator configures it (audited).
// Compliance is labeled "Insufficient telemetry" until real
// measurement windows exist — the live probe value is evidence,
// never compliance.
// ============================================================

interface SloRow {
  id: string; service: string; name: string; kind: "availability" | "latency" | "error-rate";
  target: number; windowDays: number; createdAt: number; createdBy: string; updatedAt: number;
  current: number | null;
  complianceNote: string;
  evidence: { dbHealth: string; dbLatencyMs: number | null; measuredAt: number };
  status: string;
}

interface SloPayload {
  slos: SloRow[];
  targetPolicy: string;
  errorBudget: { note: string };
  sourceNote: string;
}

interface ActionResult { ok?: boolean; message?: string; data?: { ok?: boolean; message?: string } }

/** The obs route returns the Result envelope { ok, data: { ok, message } } — unwrap defensively. */
function messageOf(res: ActionResult): string | undefined {
  return res.data?.message ?? res.message;
}

const KINDS = ["availability", "latency", "error-rate"] as const;

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

export function P23SloManagementScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<SloPayload>("slo");
  const [busy, setBusy] = React.useState(false);

  // Create-SLO form state.
  const [name, setName] = React.useState("");
  const [service, setService] = React.useState("platform");
  const [kind, setKind] = React.useState<string>("availability");
  const [target, setTarget] = React.useState("");
  const [windowDays, setWindowDays] = React.useState("30");

  const resetForm = () => {
    setName(""); setService("platform"); setKind("availability"); setTarget(""); setWindowDays("30");
  };

  const createSlo = async () => {
    const n = name.trim();
    if (n.length < 3) {
      toast({ title: "Invalid SLO name", description: "An SLO name of at least 3 characters is required.", variant: "destructive" });
      return;
    }
    const t = Number(target);
    if (target === "" || !Number.isFinite(t) || t <= 0) {
      toast({ title: "Invalid target", description: "A concrete positive target value is required — it is never invented.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await obsPost<ActionResult>("slo.create", {
        name: n,
        service: service.trim() || "platform",
        kind,
        target: t,
        windowDays: Math.max(1, Math.min(90, Number(windowDays) || 30)),
      });
      toast({ title: "SLO created", description: messageOf(res) });
      resetForm();
      reload();
    } catch (e) {
      toast({ title: "Could not create SLO", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const deleteSlo = async (slo: SloRow) => {
    if (!window.confirm(`Delete SLO '${slo.name}' (${slo.id})? This is audited and cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await obsPost<ActionResult>("slo.delete", { id: slo.id });
      toast({ title: "SLO deleted", description: messageOf(res) });
      reload();
    } catch (e) {
      toast({ title: "Could not delete SLO", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="SLO / SLA Management"
        description="Define service-level objectives with concrete targets. Compliance is reported only when real measurement windows exist — until then it is labeled honestly."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4" role="note">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-amber-800">Target policy</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800">{data.targetPolicy}</p>
          </div>

          <SectionCard title="Create SLO" description="Every creation is audited. Compliance will report 'Insufficient telemetry' until a real measurement window exists.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="slo-name" label="Name" required hint="Min 3 characters — which user-facing promise this measures.">
                <Input id="slo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Platform availability" className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px]" autoComplete="off" />
              </Field>
              <Field id="slo-service" label="Service" hint="The service this objective applies to.">
                <Input id="slo-service" value={service} onChange={(e) => setService(e.target.value)} className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px]" />
              </Field>
              <Field id="slo-kind" label="Kind" required>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger id="slo-kind" aria-label="SLO kind" className="w-full rounded-lg border-slate-300 bg-white text-[12.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k} className="text-[12.5px]">{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="slo-target" label="Target value — you define it, never invented" required hint="A concrete number in the unit the kind implies (e.g. %, ms, errors per window).">
                <Input id="slo-target" type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="99.9" className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px] tabular-nums" />
              </Field>
              <Field id="slo-window" label="Window (days)" hint="1–90 — the compliance window once real telemetry retention exists.">
                <Input id="slo-window" type="number" min={1} max={90} value={windowDays} onChange={(e) => setWindowDays(e.target.value)} className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px] tabular-nums" />
              </Field>
            </div>
            <div className="mt-4">
              <Button onClick={() => void createSlo()} disabled={busy} className="min-h-[44px]">Create SLO</Button>
            </div>
          </SectionCard>

          <SectionCard title="SLOs" description="Compliance status is labeled per the real telemetry state — never interpolated.">
            {data.slos.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-slate-500">
                No SLOs have been defined. An SLO exists only when an administrator configures it — targets are never invented, so an empty list means no objective has been committed yet.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {data.slos.map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-slate-900">{s.name}</p>
                      <OpsHealthBadge health="unknown" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px font-mono text-[10.5px] text-slate-600">{s.service}</span>
                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] font-semibold text-slate-600">{s.kind}</span>
                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] font-semibold tabular-nums text-slate-600">target {s.target}</span>
                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] font-semibold tabular-nums text-slate-600">{s.windowDays}-day window</span>
                    </div>
                    <p className="mt-2.5 text-[11.5px] font-semibold text-slate-700">{s.status}</p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{s.complianceNote}</p>
                    <div className="mt-2" role="note" aria-label="Evidence from the live probe">
                      <FactRow
                        label="Evidence · live DB probe"
                        value={s.evidence.dbLatencyMs != null ? `${s.evidence.dbLatencyMs} ms` : "—"}
                        health={s.evidence.dbHealth}
                        note={`Measured ${fmtIST(s.evidence.measuredAt)} — evidence at review time, not compliance.`}
                      />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                      <p className="text-[10.5px] text-slate-400">{s.id} · created {fmtIST(s.createdAt)} · by {s.createdBy}</p>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void deleteSlo(s)} className="min-h-[36px] border-red-200 text-red-700 hover:bg-red-50" title={`Delete ${s.id} — audited and irreversible`}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" role="note">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Error budget</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{data.errorBudget.note}</p>
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
