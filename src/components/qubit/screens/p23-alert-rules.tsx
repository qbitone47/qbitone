"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsHealthBadge, OpsSkeleton, OpsTable, SourceLine, fmtIST, obsPost, timeAgo, useObsSection } from "../obs/parts";

// ============================================================
// P23-12 · Alert Rules — the ONLY source of alerts (P23-11).
// Rules evaluate ON DEMAND against real measurements; the metric
// list is restricted to what can actually be measured live.
// ============================================================

interface AlertRuleRow {
  id: string; name: string; metric: string; condition: "below" | "above";
  threshold: number; windowMin: number; severity: "Info" | "Warning" | "High" | "Critical";
  environment: string; recipients: string[]; escalation: string; cooldownMin: number;
  enabled: boolean; createdAt: number; createdBy: string; updatedAt: number;
}

interface AlertRulesPayload {
  rules: AlertRuleRow[];
  metrics: string[];
  metricNote: string;
  evaluationNote: string;
  notificationIntegration: string;
  sourceNote: string;
}

interface ActionResult { ok?: boolean; message?: string; data?: { ok?: boolean; message?: string; evaluated?: number; triggered?: number; measurements?: Record<string, number | null> } }

/** The obs route returns the Result envelope { ok, data: { ok, message, … } } — unwrap defensively. */
function messageOf(res: ActionResult): string | undefined {
  return res.data?.message ?? res.message;
}

const SEVERITIES = ["Info", "Warning", "High", "Critical"] as const;
const CONDITIONS = ["above", "below"] as const;

const severityChipCls: Record<string, { cls: string; dot: string }> = {
  Critical: { cls: "border-red-300 bg-red-50 text-red-800", dot: "bg-red-500" },
  High: { cls: "border-orange-300 bg-orange-50 text-orange-800", dot: "bg-orange-500" },
  Warning: { cls: "border-amber-300 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  Info: { cls: "border-slate-300 bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

function SeverityChip({ severity }: { severity: string }) {
  const v = severityChipCls[severity] ?? severityChipCls.Info;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${v.cls}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${v.dot}`} />
      {severity}
    </span>
  );
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

export function P23AlertRulesScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<AlertRulesPayload>("alert-rules");
  const [busy, setBusy] = React.useState(false);

  // Create-rule form state.
  const [name, setName] = React.useState("");
  const [metric, setMetric] = React.useState("db-latency");
  const [condition, setCondition] = React.useState<string>("above");
  const [threshold, setThreshold] = React.useState("");
  const [windowMin, setWindowMin] = React.useState("5");
  const [severity, setSeverity] = React.useState<string>("Warning");
  const [environment, setEnvironment] = React.useState("production");
  const [recipients, setRecipients] = React.useState("");
  const [cooldownMin, setCooldownMin] = React.useState("15");
  // Measurements captured by the most recent "Evaluate now" run — rendered generically (no hardcoded metric keys).
  const [lastEval, setLastEval] = React.useState<Record<string, number | null> | null>(null);

  const resetForm = () => {
    setName(""); setMetric("db-latency"); setCondition("above"); setThreshold("");
    setWindowMin("5"); setSeverity("Warning"); setEnvironment("production"); setRecipients(""); setCooldownMin("15");
  };

  const createRule = async () => {
    const n = name.trim();
    if (n.length < 3) {
      toast({ title: "Invalid rule name", description: "A rule name of at least 3 characters is required.", variant: "destructive" });
      return;
    }
    const t = Number(threshold);
    if (threshold === "" || !Number.isFinite(t)) {
      toast({ title: "Invalid threshold", description: "A concrete numeric threshold is required.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await obsPost<ActionResult>("alert-rule.create", {
        name: n,
        metric,
        condition,
        threshold: t,
        windowMin: Math.max(1, Math.min(1440, Number(windowMin) || 5)),
        severity,
        environment: environment.trim() || "production",
        recipients: recipients.split(",").map((s) => s.trim()).filter(Boolean),
        cooldownMin: Math.max(0, Math.min(1440, Number(cooldownMin) || 15)),
      });
      toast({ title: "Alert rule created", description: messageOf(res) });
      resetForm();
      reload();
    } catch (e) {
      toast({ title: "Could not create rule", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const evaluateNow = async () => {
    setBusy(true);
    try {
      const res = await obsPost<ActionResult>("alert.evaluate");
      const triggered = res.data?.triggered ?? 0;
      setLastEval(res.data?.measurements ?? null);
      toast({
        title: triggered > 0 ? `${triggered} alert${triggered === 1 ? "" : "s"} triggered` : "No breaches measured",
        description: [messageOf(res), `${res.data?.evaluated ?? 0} enabled rule(s) evaluated against live probes`].filter(Boolean).join(" · "),
      });
      reload();
    } catch (e) {
      toast({ title: "Evaluation failed", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const deleteRule = async (rule: AlertRuleRow) => {
    if (!window.confirm(`Delete rule '${rule.name}' (${rule.id})? This is audited and cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await obsPost<ActionResult>("alert-rule.delete", { id: rule.id });
      toast({ title: "Rule deleted", description: messageOf(res) });
      reload();
    } catch (e) {
      toast({ title: "Could not delete rule", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="Alert Rules"
        description="Rules compare live measurements against concrete thresholds. Only metrics this system can actually measure are selectable — continuous background evaluation is not configured."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4" role="note">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-amber-800">Evaluation model</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800">{data.evaluationNote}</p>
          </div>

          <SectionCard title="Create rule" description="Every creation is audited. The condition fires when the live measurement crosses the threshold in the chosen direction.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="rule-name" label="Name" required hint="Min 3 characters — what breached and why it matters.">
                <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="DB latency above 1500 ms" className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px]" autoComplete="off" />
              </Field>
              <Field id="rule-metric" label="Metric" required hint="Restricted to live-measurable metrics only.">
                <Select value={metric} onValueChange={setMetric}>
                  <SelectTrigger id="rule-metric" aria-label="Metric" className="w-full rounded-lg border-slate-300 bg-white font-mono text-[12.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {data.metrics.map((m) => (
                      <SelectItem key={m} value={m} className="font-mono text-[12.5px]">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="rule-condition" label="Condition" required>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger id="rule-condition" aria-label="Condition" className="w-full rounded-lg border-slate-300 bg-white text-[12.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c} value={c} className="text-[12.5px]">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="rule-threshold" label="Threshold" required hint="Concrete number — the rule fires above/below it.">
                <Input id="rule-threshold" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="1500" className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px] tabular-nums" />
              </Field>
              <Field id="rule-window" label="Window (minutes)" hint="1–1440. Context for the evaluation, not a background schedule.">
                <Input id="rule-window" type="number" min={1} max={1440} value={windowMin} onChange={(e) => setWindowMin(e.target.value)} className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px] tabular-nums" />
              </Field>
              <Field id="rule-severity" label="Severity" required>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger id="rule-severity" aria-label="Severity" className="w-full rounded-lg border-slate-300 bg-white text-[12.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s} className="text-[12.5px]">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="rule-env" label="Environment" hint="Where this rule applies, e.g. production.">
                <Input id="rule-env" value={environment} onChange={(e) => setEnvironment(e.target.value)} className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px]" />
              </Field>
              <Field id="rule-recipients" label="Recipients" hint="Comma-separated — routed via the existing notification engine.">
                <Input id="rule-recipients" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="platform, sagar" className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px]" />
              </Field>
              <Field id="rule-cooldown" label="Cooldown (minutes)" hint="0–1440. Suppresses duplicate alerts while one is still open.">
                <Input id="rule-cooldown" type="number" min={0} max={1440} value={cooldownMin} onChange={(e) => setCooldownMin(e.target.value)} className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px] tabular-nums" />
              </Field>
            </div>
            <div className="mt-4">
              <Button onClick={() => void createRule()} disabled={busy} className="min-h-[44px]">Create rule</Button>
            </div>
          </SectionCard>

          <SectionCard
            title="Rules"
            description="The registry is seeded empty — every rule here is one a real administrator created."
            actions={
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void evaluateNow()} className="min-h-[36px]" title="Evaluate all enabled rules against live probes">
                Evaluate now
              </Button>
            }
          >
            <OpsTable
              rows={data.rules}
              keyOf={(r) => r.id}
              empty={
                <p className="py-8 text-center text-[12.5px] text-slate-500">
                  No alert rules have been created — the registry is seeded empty, so an empty table means no rule exists yet, not that rules are hidden.
                </p>
              }
              columns={[
                { header: "Name", cell: (r) => <span className="font-semibold text-slate-800">{r.name}</span> },
                { header: "Metric", cell: (r) => <span className="font-mono text-[12px] text-slate-700">{r.metric}</span> },
                {
                  header: "Condition",
                  cell: (r) => (
                    <span className="font-mono text-[12px] tabular-nums text-slate-700">
                      {r.condition} {r.threshold}
                      <span className="ml-1.5 text-[10px] font-sans text-slate-400">{r.windowMin}m win</span>
                    </span>
                  ),
                },
                { header: "Severity", cell: (r) => <SeverityChip severity={r.severity} /> },
                {
                  header: "Enabled",
                  cell: (r) => (
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${r.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${r.enabled ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {r.enabled ? "Enabled" : "Disabled"}
                    </span>
                  ),
                },
                { header: "Recipients", cell: (r) => <span className="tabular-nums text-slate-600">{r.recipients.length}</span> },
                { header: "Environment", cell: (r) => <span className="text-slate-600">{r.environment}</span> },
                {
                  header: "Updated",
                  cell: (r) => (
                    <span className="tabular-nums">
                      <span className="whitespace-nowrap">{fmtIST(r.updatedAt)}</span>
                      <span className="block text-[10.5px] text-slate-400">{timeAgo(r.updatedAt)}</span>
                    </span>
                  ),
                },
                {
                  header: "Actions",
                  cell: (r) => (
                    <span className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void evaluateNow()} className="min-h-[36px]" title={`Evaluate rules against live probes (fires ${r.name} if breached)`}>
                        Evaluate now
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void deleteRule(r)} className="min-h-[36px] border-red-200 text-red-700 hover:bg-red-50" title={`Delete ${r.id} — audited and irreversible`}>
                        Delete
                      </Button>
                    </span>
                  ),
                },
              ]}
            />
          </SectionCard>

          {lastEval && Object.keys(lastEval).length > 0 && (
            <SectionCard title="Last evaluation" description="Measurements captured by the most recent 'Evaluate now' run — every value is real; 'Insufficient data' means the metric could not be measured in the window and no rule using it fired.">
              <dl className="grid gap-x-6 sm:grid-cols-2" aria-label="Last evaluation measurements">
                {Object.entries(lastEval).map(([key, value]) => (
                  <div key={key} className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
                    <dt className="min-w-0 truncate font-mono text-[11.5px] text-slate-600" title={key}>{key}</dt>
                    <dd className={`shrink-0 text-[12.5px] font-semibold tabular-nums ${value == null ? "text-slate-400" : "text-slate-900"}`}>
                      {value == null ? "Insufficient data" : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </SectionCard>
          )}

          <SectionCard title="Metric & notification notes" description="Straight from the server contract — what is measurable and how notifications route.">
            <div className="space-y-2.5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" role="note">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Selectable metrics</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{data.metricNote}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" role="note">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Notification routing</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{data.notificationIntegration}</p>
              </div>
            </div>
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
