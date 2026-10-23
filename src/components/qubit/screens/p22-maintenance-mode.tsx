"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsHealthBadge, OpsSkeleton, SourceLine, fmtIST, opsPost, timeAgo, useOpsSection } from "../ops/parts";

// ============================================================
// P22-22 · Maintenance Mode
// Declaring, scheduling and communicating maintenance windows.
// Activation here is governance + communication, NOT a traffic
// switch — and administrator access is never locked out.
// ============================================================

interface MaintenancePayload {
  mode: string; reason: string | null; startAt: number | null; expectedEnd: number | null;
  affectedServices: string[]; message: string | null; authorizedBy: string | null; updatedAt: number;
  modes: string[]; bypass: string; enforcementNote: string; sourceNote: string;
}

interface ActionResult { ok?: boolean; message?: string; data?: { ok?: boolean; message?: string } }

/** The ops route returns the Result envelope { ok, data: { ok, message } } — unwrap defensively. */
function messageOf(res: ActionResult): string | undefined {
  return res.data?.message ?? res.message;
}

const MODE_HEALTH: Record<string, string> = {
  normal: "healthy",
  scheduled: "maintenance",
  active: "maintenance",
  emergency: "unavailable",
};

const MODE_TONE: Record<string, string> = {
  normal: "border-emerald-200 bg-emerald-50",
  scheduled: "border-blue-200 bg-blue-50",
  active: "border-blue-200 bg-blue-50",
  emergency: "border-red-200 bg-red-50",
};

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

export function P22MaintenanceModeScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<MaintenancePayload>("maintenance");
  const [busy, setBusy] = React.useState(false);

  // Transition form state.
  const [mode, setMode] = React.useState("normal");
  const [reason, setReason] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [services, setServices] = React.useState("");
  const [expectedEnd, setExpectedEnd] = React.useState("");

  const applyMode = async () => {
    let endMs: number | undefined;
    if (expectedEnd) {
      const t = new Date(expectedEnd).getTime();
      if (Number.isNaN(t)) {
        toast({ title: "Invalid expected end", description: "Pick a valid date and time, or clear the field.", variant: "destructive" });
        return;
      }
      endMs = t;
    }
    setBusy(true);
    try {
      const res = await opsPost<ActionResult>("maintenance.set", {
        mode,
        reason: reason.trim() || undefined,
        message: message.trim() || undefined,
        affectedServices: services.split(",").map((s) => s.trim()).filter(Boolean),
        expectedEnd: endMs,
      });
      toast({ title: `Maintenance mode → ${mode}`, description: messageOf(res) });
      reload();
    } catch (e) {
      toast({ title: "Could not set maintenance mode", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="Maintenance Mode"
        description="Declare, schedule and communicate maintenance windows. Administrator access is never locked out."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          {/* Current state banner */}
          <div className={cn("rounded-2xl border p-5", MODE_TONE[data.mode] ?? MODE_TONE.normal)} role="status">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">Current maintenance mode</p>
                <p className="mt-1 text-2xl font-semibold capitalize tracking-tight">{data.mode}</p>
              </div>
              <OpsHealthBadge health={MODE_HEALTH[data.mode] ?? "unknown"} className="h-fit" />
            </div>
            {data.message && <p className="mt-2 text-[12.5px] leading-relaxed">{data.message}</p>}
          </div>

          <SectionCard title="Current state" description="Every value is the real recorded state; transitions are audited with actor attribution.">
            <div>
              <FactRow label="Mode" value={<span className="capitalize">{data.mode}</span>} health={MODE_HEALTH[data.mode] ?? "unknown"} />
              <FactRow label="Reason" value={data.reason ?? "—"} />
              <FactRow label="Started at" value={data.startAt ? fmtIST(data.startAt) : "—"} note={data.startAt ? timeAgo(data.startAt) : undefined} />
              <FactRow label="Expected end" value={data.expectedEnd ? fmtIST(data.expectedEnd) : "—"} />
              <FactRow label="Affected services" value={data.affectedServices.length ? data.affectedServices.join(", ") : "—"} />
              <FactRow label="Message" value={data.message ?? "—"} />
              <FactRow label="Authorized by" value={data.authorizedBy ?? "—"} />
            </div>
          </SectionCard>

          <SectionCard
            title="Transition mode"
            description="Setting the mode is recorded and audited immediately. Choose the mode that matches reality — not the one that sounds safest."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="mt-mode" label="Mode" required>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger id="mt-mode" aria-label="Maintenance mode" className="w-full rounded-lg border-slate-300 bg-white text-[12.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {data.modes.map((m) => (
                      <SelectItem key={m} value={m} className="text-[12.5px] capitalize">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="mt-reason" label="Reason" hint="Why this mode is being declared (recorded).">
                <Input
                  id="mt-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Scheduled Supabase maintenance window"
                  className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px]"
                />
              </Field>
              <Field id="mt-message" label="Message" hint="Shown to anyone reviewing the current state.">
                <Textarea
                  id="mt-message"
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="rounded-lg border-slate-300 bg-white text-[12.5px]"
                />
              </Field>
              <div className="grid gap-4">
                <Field id="mt-services" label="Affected services" hint="Comma-separated, e.g. api, dashboard, exports.">
                  <Input
                    id="mt-services"
                    value={services}
                    onChange={(e) => setServices(e.target.value)}
                    placeholder="api, dashboard"
                    className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px]"
                  />
                </Field>
                <Field id="mt-end" label="Expected end" hint="Optional — when the window is expected to close.">
                  <Input
                    id="mt-end"
                    type="datetime-local"
                    value={expectedEnd}
                    onChange={(e) => setExpectedEnd(e.target.value)}
                    className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px] tabular-nums"
                  />
                </Field>
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={() => void applyMode()} disabled={busy} className="min-h-[44px]">
                Set maintenance mode
              </Button>
            </div>
          </SectionCard>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5" role="note">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-700" aria-hidden />
              <p className="text-[13px] font-semibold text-emerald-900">Administrator bypass — invariant</p>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-emerald-800">{data.bypass}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5" role="note">
            <p className="text-[13px] font-semibold text-slate-800">Enforcement in this phase</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">{data.enforcementNote}</p>
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
