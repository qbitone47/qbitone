"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { FactRow, OpsError, OpsSkeleton, SourceLine, fmtIST, opsPost, timeAgo, useOpsSection } from "../ops/parts";

// ============================================================
// P22-21 · System Configuration
// The values this build actually runs with. Identity reflects
// the real fixture identity and auth constants and stays
// read-only; operational defaults are editable and audited.
// ============================================================

interface SystemConfigView {
  company: string; timezone: string; locale: string; sessionTimeoutHours: number;
  paginationDefault: number; notificationDigest: string;
  updatedBy: string | null; updatedAt: number;
}

interface ConfigPayload {
  config: SystemConfigView;
  editable: string[];
  readOnlyNote: string;
  secretsNote: string;
  sourceNote: string;
}

interface ActionResult { ok?: boolean; message?: string; data?: { ok?: boolean; message?: string } }

/** The ops route returns the Result envelope { ok, data: { ok, message } } — unwrap defensively. */
function messageOf(res: ActionResult): string | undefined {
  return res.data?.message ?? res.message;
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[11.5px] font-medium text-slate-600">{label}</label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-slate-400">{hint}</p>}
    </div>
  );
}

export function P22SystemConfigurationScreen() {
  const { data, loading, error, forbidden, reload } = useOpsSection<ConfigPayload>("config");
  const [busy, setBusy] = React.useState(false);
  const [pagination, setPagination] = React.useState("");
  const [digest, setDigest] = React.useState("daily");

  // Keep the editable form in sync with the server state after each load/reload.
  React.useEffect(() => {
    if (data) {
      setPagination(String(data.config.paginationDefault));
      setDigest(data.config.notificationDigest);
    }
  }, [data]);

  const save = async () => {
    const n = Number(pagination);
    if (!Number.isInteger(n) || n < 10 || n > 200) {
      toast({ title: "Invalid pagination default", description: "Must be an integer between 10 and 200 — the server enforces this too.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await opsPost<ActionResult>("config.update", { paginationDefault: n, notificationDigest: digest });
      toast({ title: "Configuration updated", description: messageOf(res) });
      reload();
    } catch (e) {
      toast({ title: "Could not update configuration", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Operations" }]}
        title="System Configuration"
        description="The values this build actually runs with — identity is read-only reality, operational defaults are editable and audited."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <SectionCard
            title="Identity (read-only)"
            description="These fields reflect what this deployment genuinely is — the screen will not pretend they are editable."
          >
            <div>
              <FactRow label="Company" value={data.config.company} />
              <FactRow label="Timezone" value={data.config.timezone} note="All timestamps across Operations are formatted in this timezone." />
              <FactRow label="Locale" value={data.config.locale} />
              <FactRow label="Session timeout" value={`${data.config.sessionTimeoutHours} h`} note="The real auth constant (SESSION_TTL_MS) this build enforces." />
            </div>
            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] leading-relaxed text-slate-500">
              {data.readOnlyNote}
            </p>
          </SectionCard>

          <SectionCard
            title="Operational defaults (editable)"
            description="Changes are validated server-side, audited through the enterprise audit trail and take effect in this runtime."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="config-pagination" label="Pagination default" hint="Integer between 10 and 200 — the platform's default page size.">
                <Input
                  id="config-pagination"
                  type="number"
                  min={10}
                  max={200}
                  value={pagination}
                  onChange={(e) => setPagination(e.target.value)}
                  className="h-9 rounded-lg border-slate-300 bg-white text-[12.5px] tabular-nums"
                />
              </Field>
              <Field id="config-digest" label="Notification digest" hint="How operational notifications are batched.">
                <Select value={digest} onValueChange={setDigest}>
                  <SelectTrigger id="config-digest" aria-label="Notification digest" className="w-full rounded-lg border-slate-300 bg-white text-[12.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["off", "hourly", "daily"].map((d) => (
                      <SelectItem key={d} value={d} className="text-[12.5px]">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => void save()} disabled={busy} className="min-h-[44px]">
                Save configuration
              </Button>
            </div>
            <div className="mt-3 border-t border-slate-100 pt-1">
              <FactRow
                label="Last updated by"
                value={data.config.updatedBy ?? "—"}
                note={data.config.updatedAt ? `At ${fmtIST(data.config.updatedAt)} (${timeAgo(data.config.updatedAt)})` : undefined}
              />
            </div>
          </SectionCard>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" role="note">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-600">Secrets</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{data.secretsNote}</p>
          </div>

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
