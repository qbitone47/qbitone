"use client";

import * as React from "react";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsSkeleton, SourceLine, fmtIST, useObsSection, obsPost } from "../obs/parts";
import { useRole } from "../role-context";

// ============================================================
// P23-24 · Observability Settings — the declarative retention
// and redaction policy registry plus the ENFORCED Phase 25
// telemetry pipeline configuration. Values are real current
// values; 0 means "not configured" and is labeled as such. Every
// change is validated, audited server-side, then reloaded from
// truth.
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
  telemetry: {
    requestEnabled: boolean;
    clientEnabled: boolean;
    samplingRatePct: number;
    telemetryRetentionDays: number;
    hardCapRows: number;
    bufferLen: number;
    persistence: string;
    persistenceLabel: string;
  };
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
  const { role } = useRole();
  const { data, loading, error, forbidden, reload } = useObsSection<SettingsPayload>("settings");
  const [form, setForm] = React.useState<FormState | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [telBusy, setTelBusy] = React.useState(false);
  const [telFeedback, setTelFeedback] = React.useState<string | null>(null);
  const [telRetention, setTelRetention] = React.useState<string>("");

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

  async function updateTelemetry(input: Record<string, unknown>, successVerb: string) {
    if (telBusy) return;
    setTelBusy(true);
    setTelFeedback(null);
    try {
      const res = await obsPost<SettingsPostResponse>("settings.update", input, role);
      const inner = res.data;
      setTelFeedback(inner?.message ?? (inner?.ok ? `Telemetry pipeline ${successVerb} — updated and audited.` : "The server did not accept the update."));
      if (!inner?.ok) {
        toast({ variant: "destructive", title: "Update not completed", description: inner?.message ?? "The server did not accept the update." });
      }
      reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The telemetry settings update could not be recorded.";
      setTelFeedback(msg);
      toast({ variant: "destructive", title: "Update failed", description: msg });
    } finally {
      setTelBusy(false);
    }
  }

  function applyTelemetryRetention() {
    if (telBusy) return;
    const n = Number(telRetention);
    if (!Number.isInteger(n) || n < 1 || n > 365) {
      setTelFeedback("Telemetry retention must be a whole number of days between 1 and 365.");
      return;
    }
    void updateTelemetry({ telemetryRetentionDays: n }, `retention set to ${n} day(s)`);
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
        description="The declarative policy registry for retention, sampling, alerting defaults and redaction, plus the enforced telemetry pipeline — real current values, audited changes."
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

          <SectionCard
            title="Telemetry pipeline"
            description="Enforced configuration of the real telemetry pipeline. Every change below is validated server-side and audited — the feedback line shows the server's returned message."
          >
            <FactRow
              label="Server pipeline (request metering)"
              value={data.telemetry.requestEnabled ? "Enabled" : "Disabled"}
              health={data.telemetry.requestEnabled ? "healthy" : "degraded"}
              note="withMeter records every API request (status, duration, request id) into the telemetry store."
            />
            <FactRow
              label="Client pipeline (vitals + JS errors)"
              value={data.telemetry.clientEnabled ? "Enabled" : "Disabled"}
              health={data.telemetry.clientEnabled ? "healthy" : "degraded"}
              note="The in-browser collector batches vitals, route transitions and error events to POST /api/telemetry."
            />
            <FactRow label="Sampling rate" value={`${data.telemetry.samplingRatePct}%`} note="Applies to request/client kinds — errors and logs are never sampled out." />
            <FactRow label="Enforced retention" value={`${data.telemetry.telemetryRetentionDays} day(s)`} note="Every prune deletes telemetry rows older than this — the value is enforced, not declarative." />
            <FactRow label="Hard row cap" value={data.telemetry.hardCapRows.toLocaleString()} note="The telemetry store can never grow beyond this many rows." />
            <FactRow label="Events in buffer" value={data.telemetry.bufferLen} note="In-process events awaiting a successful database flush." />
            <FactRow
              label="Persistence"
              value={data.telemetry.persistence}
              health={data.telemetry.persistence === "ok" ? "healthy" : data.telemetry.persistence === "degraded" ? "degraded" : "unavailable"}
              note={data.telemetry.persistenceLabel}
            />

            <div className="mt-4 space-y-3 border-t border-slate-100 pt-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-slate-700">Server request telemetry</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400">Toggling sends an audited settings.update; controls are disabled while a change is pending.</p>
                </div>
                <Switch
                  checked={data.telemetry.requestEnabled}
                  disabled={telBusy}
                  onCheckedChange={(v) => void updateTelemetry({ requestTelemetryEnabled: v }, v ? "server pipeline enabled" : "server pipeline disabled")}
                  aria-label="Toggle server request telemetry pipeline"
                  className="data-[state=checked]:bg-slate-900"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-slate-700">Client telemetry (vitals + JS errors)</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400">Toggling sends an audited settings.update; controls are disabled while a change is pending.</p>
                </div>
                <Switch
                  checked={data.telemetry.clientEnabled}
                  disabled={telBusy}
                  onCheckedChange={(v) => void updateTelemetry({ clientTelemetryEnabled: v }, v ? "client pipeline enabled" : "client pipeline disabled")}
                  aria-label="Toggle client telemetry pipeline"
                  className="data-[state=checked]:bg-slate-900"
                />
              </div>
              <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                <div>
                  <label htmlFor="set-tel-retention" className="mb-1 block text-[11px] font-semibold text-slate-600">Telemetry retention (days)</label>
                  <input
                    id="set-tel-retention"
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    value={telRetention}
                    onChange={(e) => setTelRetention(e.target.value)}
                    placeholder={`${data.telemetry.telemetryRetentionDays}`}
                    className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-1 text-[10.5px] text-slate-400">1–365 days · enforced by every retention prune</p>
                </div>
                <button
                  type="button"
                  onClick={applyTelemetryRetention}
                  disabled={telBusy}
                  aria-busy={telBusy}
                  className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Apply &amp; audit
                </button>
              </div>
              <p className="text-[11px] text-slate-400" role="status" aria-live="polite">
                {telFeedback ?? "Every change on this card is an audited obs.settings.update — including pipeline toggles."}
              </p>
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
