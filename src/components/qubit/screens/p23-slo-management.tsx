"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsSkeleton, SourceLine, fmtIST, obsPost, useObsSection } from "../obs/parts";

// ============================================================
// P23-13 · SLO / SLA Management — targets are NEVER invented.
// An SLO exists only when an administrator configures it (audited).
// Phase 25: compliance is COMPUTED from real request telemetry
// (Meeting / Breaching / Insufficient data are the only states);
// below the sample minimum the row says "Insufficient data".
// ============================================================

interface SloRow {
  id: string; service: string; name: string; kind: "availability" | "latency" | "error-rate";
  target: number; windowDays: number; createdAt: number; createdBy: string; updatedAt: number;
  current: number | null;
  status: "Meeting" | "Breaching" | "Insufficient data";
  complianceNote: string;
  evidence: { dbHealth: string; dbLatencyMs: number | null; measuredAt: number; sampleCount: number };
}

interface SloPayload {
  slos: SloRow[];
  targetPolicy: string;
  evaluationPolicy: string;
  errorBudget: { note: string };
  sourceNote: string;
}

interface ActionResult { ok?: boolean; message?: string; data?: { ok?: boolean; message?: string } }

/** The obs route returns the Result envelope { ok, data: { ok, message } } — unwrap defensively. */
function messageOf(res: ActionResult): string | undefined {
  return res.data?.message ?? res.message;
}

const KINDS = ["availability", "latency", "error-rate"] as const;

/** Meeting → emerald, Breaching → red, Insufficient data → slate. No other states exist. */
function SloStatusBadge({ status }: { status: SloRow["status"] | string }) {
  const cls =
    status === "Meeting"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "Breaching"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-slate-200 bg-slate-50 text-slate-600";
  const dot = status === "Meeting" ? "bg-emerald-500" : status === "Breaching" ? "bg-red-500" : "bg-slate-400";
  const label = status === "Meeting" || status === "Breaching" ? status : "Insufficient data";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${cls}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

/** availability/error-rate render as %, latency as ms; null → "—". */
function currentLabel(s: SloRow): string {
  if (s.current == null) return "—";
  return s.kind === "latency" ? `${s.current} ms` : `${s.current}%`;
}

/** Error-budget consumption per the server contract: 1 − (current / target), availability & error-rate kinds only. */
function budgetLabel(s: SloRow): string | null {
  if (s.current == null || (s.kind !== "availability" && s.kind !== "error-rate")) return null;
  if (!Number.isFinite(s.target) || s.target === 0) return null;
  const consumed = Math.max(0, Math.round((1 - s.current / s.target) * 1000) / 10);
  return `${consumed}%`;
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

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" role="note">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Evaluation policy</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{data.evaluationPolicy}</p>
          </div>

          <SectionCard title="Create SLO" description="Every creation is audited. Compliance is computed from real request telemetry and reports Meeting / Breaching / Insufficient data — never a synthetic percentage.">
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
              <Field id="slo-window" label="Window (days)" hint="1–90 — evaluation runs against real telemetry; windows are bounded at 30 days by retention.">
                <Input id="slo-window" type="number" min={1} max={90} value={windowDays} onChange={(e) => setWindowDays(e.target.value)} className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px] tabular-nums" />
              </Field>
            </div>
            <div className="mt-4">
              <Button onClick={() => void createSlo()} disabled={busy} className="min-h-[44px]">Create SLO</Button>
            </div>
          </SectionCard>

          <SectionCard title="SLOs" description="Compliance status is computed per the real telemetry state — never interpolated.">
            {data.slos.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-slate-500">
                No SLOs have been defined. An SLO exists only when an administrator configures it — targets are never invented, so an empty list means no objective has been committed yet.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {data.slos.map((s) => {
                  const budget = budgetLabel(s);
                  return (
                    <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold text-slate-900">{s.name}</p>
                        <SloStatusBadge status={s.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px font-mono text-[10.5px] text-slate-600">{s.service}</span>
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] font-semibold text-slate-600">{s.kind}</span>
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] font-semibold tabular-nums text-slate-600">target {s.target}</span>
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] font-semibold tabular-nums text-slate-600">{s.windowDays}-day window</span>
                      </div>
                      <div className="mt-2.5 flex items-baseline justify-between gap-2">
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">Current</p>
                        <p className="text-[15px] font-semibold tabular-nums text-slate-900">{currentLabel(s)}</p>
                      </div>
                      {budget != null && (
                        <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">Error budget consumed: {budget}</p>
                      )}
                      <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{s.complianceNote}</p>
                      <div className="mt-2" role="note" aria-label="Evidence from the live probe">
                        <FactRow
                          label="Evidence · live DB probe"
                          value={s.evidence.dbLatencyMs != null ? `${s.evidence.dbLatencyMs} ms` : "—"}
                          health={s.evidence.dbHealth}
                          note={`Measured ${fmtIST(s.evidence.measuredAt)} · ${s.evidence.sampleCount} request event(s) in window — evidence at review time, not compliance.`}
                        />
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                        <p className="text-[10.5px] text-slate-400">{s.id} · created {fmtIST(s.createdAt)} · by {s.createdBy}</p>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void deleteSlo(s)} className="min-h-[36px] border-red-200 text-red-700 hover:bg-red-50" title={`Delete ${s.id} — audited and irreversible`}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
