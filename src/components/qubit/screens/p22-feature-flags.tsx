"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsError, OpsHealthBadge, OpsSkeleton, OpsTable, SourceLine, fmtIST, opsPost, timeAgo, useOpsSection } from "../ops/parts";

// ============================================================
// P22-20 · Feature Flags
// Operational kill switches and rollout controls. The registry
// is seeded EMPTY: every flag on this screen is one a real
// administrator created. Nothing is demonstrated with fiction.
// ============================================================

interface FlagRow {
  key: string; description: string;
  status: "on" | "off" | "percentage" | "role-based" | "environment-based";
  rolloutPct: number | null; audience: string[]; environment: string; owner: string;
  createdAt: number; createdBy: string; updatedAt: number;
}

interface FlagsPayload {
  flags: FlagRow[];
  supported: string[];
  persistenceNote: string;
  sourceNote: string;
}

interface ActionResult { ok?: boolean; message?: string; data?: { ok?: boolean; message?: string } }

/** The ops route returns the Result envelope { ok, data: { ok, message } } — unwrap defensively. */
function messageOf(res: ActionResult): string | undefined {
  return res.data?.message ?? res.message;
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;

function flagHealth(status: string): string {
  if (status === "on") return "healthy";
  if (status === "off") return "not-configured";
  if (status === "percentage") return "degraded";
  return "unknown"; // role-based / environment-based — evaluation depends on request context
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

export function P22FeatureFlagsScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<FlagsPayload>("flags");
  const [busy, setBusy] = React.useState(false);

  // Create-flag form state.
  const [key, setKey] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState("off");
  const [environment, setEnvironment] = React.useState("production");
  const [rolloutPct, setRolloutPct] = React.useState("0");

  const resetForm = () => {
    setKey(""); setDescription(""); setStatus("off"); setEnvironment("production"); setRolloutPct("0");
  };

  const createFlag = async () => {
    const k = key.trim();
    if (!KEY_PATTERN.test(k)) {
      toast({ title: "Invalid flag key", description: "Use 2–64 characters: lowercase letters, digits, dot, dash or underscore.", variant: "destructive" });
      return;
    }
    const pct = Number(rolloutPct);
    if (status === "percentage" && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
      toast({ title: "Invalid rollout percentage", description: "The rollout percentage must be between 0 and 100.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await opsPost<ActionResult>("flag.create", {
        key: k,
        description,
        status,
        environment: environment.trim() || "production",
        rolloutPct: status === "percentage" ? pct : undefined,
      });
      toast({ title: "Flag created", description: messageOf(res) });
      resetForm();
      reload();
    } catch (e) {
      toast({ title: "Could not create flag", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const toggleFlag = async (flag: FlagRow) => {
    const next = flag.status === "on" ? "off" : "on";
    setBusy(true);
    try {
      const res = await opsPost<ActionResult>("flag.set", { key: flag.key, status: next });
      toast({ title: `Flag ${flag.key} → ${next}`, description: messageOf(res) });
      reload();
    } catch (e) {
      toast({ title: "Could not update flag", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const deleteFlag = async (flag: FlagRow) => {
    if (!window.confirm(`Delete flag '${flag.key}'? This is audited and cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await opsPost<ActionResult>("flag.delete", { key: flag.key });
      toast({ title: "Flag deleted", description: messageOf(res) });
      reload();
    } catch (e) {
      toast({ title: "Could not delete flag", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Feature Flags"
        description="Operational kill switches and rollout controls — created by real administrators, never seeded."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4" role="note">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-amber-800">Persistence</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800">{data.persistenceNote}</p>
          </div>

          <SectionCard
            title="Create flag"
            description="New flags start in the status you choose; every creation, change and deletion is audited."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="flag-key" label="Key" required hint="2–64 chars: a-z, 0–9, dot, dash, underscore (e.g. checkout.new-upsell).">
                <Input
                  id="flag-key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="checkout.new-upsell"
                  className="h-9 rounded-lg border-slate-300 bg-white font-mono text-[12.5px]"
                  autoComplete="off"
                />
              </Field>
              <Field id="flag-desc" label="Description" hint="What the flag gates and who to call when it flips.">
                <Input
                  id="flag-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Gates the new checkout upsell panel"
                  className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px]"
                />
              </Field>
              <Field id="flag-status" label="Status">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="flag-status" aria-label="Flag status" className="w-full rounded-lg border-slate-300 bg-white text-[12.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {data.supported.map((s) => (
                      <SelectItem key={s} value={s} className="text-[12.5px]">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="flag-env" label="Environment" hint="Where this flag applies, e.g. production.">
                <Input
                  id="flag-env"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px]"
                />
              </Field>
              {status === "percentage" && (
                <Field id="flag-pct" label="Rollout percentage" hint="0–100 — the share of traffic the flag is on for.">
                  <Input
                    id="flag-pct"
                    type="number"
                    min={0}
                    max={100}
                    value={rolloutPct}
                    onChange={(e) => setRolloutPct(e.target.value)}
                    className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px] tabular-nums"
                  />
                </Field>
              )}
            </div>
            <div className="mt-4">
              <Button onClick={() => void createFlag()} disabled={busy} className="min-h-[44px]">
                Create flag
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Flags" description="Every listed flag is one a real administrator created — the registry is seeded empty.">
            <OpsTable
              rows={data.flags}
              keyOf={(f) => f.key}
              empty={
                <p className="py-8 text-center text-[12.5px] text-slate-500">
                  No feature flags have been created — the registry is seeded empty, so an empty table means no flag exists yet, not that flags are hidden.
                </p>
              }
              columns={[
                { header: "Key", cell: (f) => <span className="font-mono text-[12px] font-semibold text-slate-800">{f.key}</span> },
                { header: "Description", cell: (f) => <span className="text-slate-600">{f.description || "—"}</span> },
                {
                  header: "Status",
                  cell: (f) => (
                    <span className="inline-flex items-center gap-1.5">
                      <OpsHealthBadge health={flagHealth(f.status)} />
                      {f.status === "percentage" && f.rolloutPct != null && (
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10.5px] font-semibold tabular-nums text-slate-600">{f.rolloutPct}%</span>
                      )}
                    </span>
                  ),
                },
                { header: "Environment", cell: (f) => f.environment },
                { header: "Owner", cell: (f) => <span className="text-slate-600">{f.owner}</span> },
                {
                  header: "Updated",
                  cell: (f) => (
                    <span className="tabular-nums">
                      <span className="whitespace-nowrap">{fmtIST(f.updatedAt)}</span>
                      <span className="block text-[10.5px] text-slate-400">{timeAgo(f.updatedAt)}</span>
                    </span>
                  ),
                },
                {
                  header: "Actions",
                  cell: (f) => (
                    <span className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void toggleFlag(f)}
                        className="min-h-[36px]"
                        title={`Set ${f.key} to ${f.status === "on" ? "off" : "on"}`}
                      >
                        {f.status === "on" ? "Turn off" : "Turn on"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void deleteFlag(f)}
                        className="min-h-[36px] border-red-200 text-red-700 hover:bg-red-50"
                        title={`Delete ${f.key} — audited and irreversible`}
                      >
                        Delete
                      </Button>
                    </span>
                  ),
                },
              ]}
            />
          </SectionCard>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
