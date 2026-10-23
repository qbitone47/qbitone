"use client";

import * as React from "react";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsSkeleton, SourceLine, fmtIST, useObsSection, obsPost } from "../obs/parts";

// ============================================================
// P23-24 · Observability Settings — the declarative retention
// and redaction policy registry. Values are real current values;
// 0 means "not configured" and is labeled as such. Every change
// is validated, audited server-side, then reloaded from truth.
// ============================================================

interface ObsSettings {
  logRetentionDays: number;
  metricRetentionDays: number;
  traceRetentionDays: number;
  samplingRatePct: number;
  redactionRules: string[];
  alertDefaults: { severity: string; cooldownMin: number };
  updatedBy: string | null;
  updatedAt: number;
}

interface SettingsPayload {
  settings: ObsSettings;
  editable: string[];
  retentionNote: string;
  redactionNote: string;
  privacy: string;
  sourceNote: string;
}

interface SettingsPostResponse {
  ok: boolean;
  data: { ok: boolean; message?: string };
}

interface FormState {
  logRetentionDays: string;
  metricRetentionDays: string;
  traceRetentionDays: string;
  samplingRatePct: string;
  cooldownMin: string;
}

function fromSettings(s: ObsSettings): FormState {
  return {
    logRetentionDays: String(s.logRetentionDays),
    metricRetentionDays: String(s.metricRetentionDays),
    traceRetentionDays: String(s.traceRetentionDays),
    samplingRatePct: String(s.samplingRatePct),
    cooldownMin: String(s.alertDefaults.cooldownMin),
  };
}

const RETENTION_BOUNDS = { lo: 0, hi: 3650 };

export function P23ObservabilitySettingsScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<SettingsPayload>("settings");
  const [form, setForm] = React.useState<FormState | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (data?.settings) setForm(fromSettings(data.settings));
  }, [data]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function num(key: keyof FormState): number | null {
    if (!form) return null;
    const n = Number(form[key]);
    return Number.isFinite(n) ? n : null;
  }

  async function save() {
    if (!form || saving) return;
    const logRetentionDays = num("logRetentionDays");
    const metricRetentionDays = num("metricRetentionDays");
    const traceRetentionDays = num("traceRetentionDays");
    const samplingRatePct = num("samplingRatePct");
    const cooldownMin = num("cooldownMin");
    const inBounds = (v: number | null, lo: number, hi: number) => v != null && Number.isInteger(v) && v >= lo && v <= hi;
    if (!inBounds(logRetentionDays, RETENTION_BOUNDS.lo, RETENTION_BOUNDS.hi)
      || !inBounds(metricRetentionDays, RETENTION_BOUNDS.lo, RETENTION_BOUNDS.hi)
      || !inBounds(traceRetentionDays, RETENTION_BOUNDS.lo, RETENTION_BOUNDS.hi)) {
      toast({ variant: "destructive", title: "Invalid retention values", description: "Retention must be a whole number of days between 0 and 3650 (0 = not configured)." });
      return;
    }
    if (!inBounds(samplingRatePct, 1, 100)) {
      toast({ variant: "destructive", title: "Invalid sampling rate", description: "Sampling must be a whole number between 1 and 100." });
      return;
    }
    if (!inBounds(cooldownMin, 0, 1440)) {
      toast({ variant: "destructive", title: "Invalid cooldown", description: "Alert cooldown must be a whole number between 0 and 1440 minutes." });
      return;
    }
    setSaving(true);
    try {
      const res = await obsPost<SettingsPostResponse>("settings.update", {
        logRetentionDays,
        metricRetentionDays,
        traceRetentionDays,
        samplingRatePct,
        cooldownMin,
      });
      toast({
        title: res.data?.ok ? "Settings saved" : "Save not completed",
        description: res.data?.message ?? (res.data?.ok ? "Observability settings updated and audited." : "The server did not accept the update."),
        variant: res.data?.ok ? undefined : "destructive",
      });
      reload();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: e instanceof Error ? e.message : "The settings update could not be recorded.",
      });
    } finally {
      setSaving(false);
    }
  }

  const retention = (label: string, key: "logRetentionDays" | "metricRetentionDays" | "traceRetentionDays") => (
    <div>
      <label htmlFor={`set-${key}`} className="mb-1 block text-[11px] font-semibold text-slate-600">{label} retention (days)</label>
      <input
        id={`set-${key}`}
        type="number"
        min={RETENTION_BOUNDS.lo}
        max={RETENTION_BOUNDS.hi}
        step={1}
        value={form?.[key] ?? ""}
        onChange={(e) => set(key, e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      <p className="mt-1 text-[10.5px] text-slate-400">{num(key) === 0 ? "0 = not configured" : `0–3650 · 0 = not configured`}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Observability Settings"
        description="The declarative policy registry for retention, sampling, alerting defaults and redaction — real current values, audited changes."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && form && !loading && (
        <div className="space-y-5">
          <SectionCard title="Operational settings" description="Declarative policy this platform enforces when retention backends exist. Validated client- and server-side; every change is audited.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {retention("Log", "logRetentionDays")}
              {retention("Metric", "metricRetentionDays")}
              {retention("Trace", "traceRetentionDays")}
              <div>
                <label htmlFor="set-sampling" className="mb-1 block text-[11px] font-semibold text-slate-600">Sampling rate (%)</label>
                <input
                  id="set-sampling"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={form.samplingRatePct}
                  onChange={(e) => set("samplingRatePct", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-[10.5px] text-slate-400">1–100% of events retained</p>
              </div>
              <div>
                <label htmlFor="set-cooldown" className="mb-1 block text-[11px] font-semibold text-slate-600">Alert default cooldown (min)</label>
                <input
                  id="set-cooldown"
                  type="number"
                  min={0}
                  max={1440}
                  step={1}
                  value={form.cooldownMin}
                  onChange={(e) => set("cooldownMin", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-[10.5px] text-slate-400">0–1440 min between repeated alerts · default severity: {data.settings.alertDefaults.severity}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3.5">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                aria-busy={saving}
                className="min-h-[44px] rounded-lg bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
              <p className="text-[11px] text-slate-400">Saving writes the registry server-side (audited) and reloads the real stored values.</p>
            </div>
          </SectionCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Editable fields" description="Exactly what this form may change — everything else is read-only by design.">
              <ul className="flex flex-wrap gap-1.5">
                {data.editable.map((f) => (
                  <li key={f} className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 font-mono text-[10.5px] font-semibold text-slate-600">{f}</li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Redaction rules" description={data.redactionNote}>
              <ul className="flex flex-wrap gap-1.5">
                {data.settings.redactionRules.map((r) => (
                  <li key={r} className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-600">{r}</li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-[12px] leading-relaxed text-slate-600" role="note">
              {data.retentionNote}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-[12px] leading-relaxed text-slate-600" role="note">
              {data.privacy}
            </div>
          </div>

          <SectionCard title="Registry provenance" description="Who last changed these settings, and when.">
            <FactRow label="Last updated by" value={data.settings.updatedBy ?? "—"} note={data.settings.updatedBy ? undefined : "No recorded update since seeding."} />
            <FactRow label="Last updated at" value={data.settings.updatedAt ? fmtIST(data.settings.updatedAt) : "—"} />
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
