"use client";

import * as React from "react";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "../page-header";
import { SectionCard } from "../primitives";
import { OpsHealthBadge, OpsError, OpsSkeleton, SourceLine, fmtIST, timeAgo, useObsSection, obsPost } from "../obs/parts";

// ============================================================
// P23-21 · On-Call & Escalation — the escalation registry.
// Contact methods reference systems, never personal channels;
// responders resolve through the existing identity directory.
// A null backup renders as an honest, labeled gap.
// ============================================================

interface OncallAssignment {
  service: string;
  owner: string;
  primary: string;
  backup: string | null;
  escalationLevel: number;
  contactMethod: string;
  schedule: string;
  status: string;
  updatedAt: number;
}

interface OncallPayload {
  assignments: OncallAssignment[];
  privacy: string;
  identityNote: string;
  sourceNote: string;
}

interface OncallPostResponse {
  ok: boolean;
  data: { ok: boolean; message?: string };
}

interface EditState { backup: string; escalationLevel: string }

export function P23OnCallEscalationScreen() {
  const { data, loading, error, forbidden, reload } = useObsSection<OncallPayload>("oncall");
  const [edits, setEdits] = React.useState<Record<string, EditState>>({});
  const [busyService, setBusyService] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!data) return;
    setEdits((prev) => {
      const next: Record<string, EditState> = {};
      for (const a of data.assignments) {
        next[a.service] = prev[a.service] ?? { backup: a.backup ?? "", escalationLevel: String(a.escalationLevel) };
      }
      return next;
    });
  }, [data]);

  function setEdit(service: string, patch: Partial<EditState>) {
    setEdits((prev) => ({ ...prev, [service]: { ...(prev[service] ?? { backup: "", escalationLevel: "1" }), ...patch } }));
  }

  async function save(a: OncallAssignment) {
    if (busyService) return;
    const edit = edits[a.service];
    if (!edit) return;
    const level = Number(edit.escalationLevel);
    if (!Number.isInteger(level) || level < 1 || level > 5) {
      toast({ variant: "destructive", title: "Invalid escalation level", description: "Escalation level must be a whole number between 1 and 5." });
      return;
    }
    setBusyService(a.service);
    try {
      const res = await obsPost<OncallPostResponse>("oncall.update", {
        service: a.service,
        backup: edit.backup.trim(),
        escalationLevel: level,
      });
      toast({
        title: res.data?.ok ? "Assignment updated" : "Update not completed",
        description: res.data?.message ?? (res.data?.ok ? "On-call assignment updated and audited." : "The server did not accept the update."),
        variant: res.data?.ok ? undefined : "destructive",
      });
      reload();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: e instanceof Error ? e.message : "The on-call update could not be recorded.",
      });
    } finally {
      setBusyService(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[{ label: "Observability" }]}
        title="On-Call & Escalation"
        description="Who responds when signals fire — held in one registry, referencing the existing identity directory and notification engine."
      />

      {loading && <OpsSkeleton />}
      {error && !loading && <OpsError message={error} onRetry={reload} forbidden={forbidden} />}
      {data && !loading && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-[12px] leading-relaxed text-slate-600" role="note">
            {data.privacy}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-[12px] leading-relaxed text-slate-600" role="note">
            {data.identityNote}
          </div>

          {data.assignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center" role="status">
              <p className="text-[13px] font-semibold text-slate-700">No on-call assignments on record.</p>
              <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-slate-500">
                An empty registry is a real result — assignments are never invented.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {data.assignments.map((a) => {
                const edit = edits[a.service] ?? { backup: a.backup ?? "", escalationLevel: String(a.escalationLevel) };
                return (
                  <article key={a.service} className="qubit-card p-5" aria-label={`On-call assignment for ${a.service}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-bold tracking-tight text-slate-900">{a.service}</h3>
                        <p className="mt-0.5 text-[11.5px] text-slate-500">Owner {a.owner}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">Status</span>
                        <OpsHealthBadge health={a.status === "Active" ? "healthy" : "unknown"} />
                      </div>
                    </div>

                    <div className="grid gap-x-6 gap-y-2 pt-3.5 md:grid-cols-2">
                      <div className="flex items-baseline justify-between gap-3 border-b border-slate-50 pb-1.5">
                        <span className="text-[11px] font-semibold text-slate-500">Primary responder</span>
                        <span className="text-[12.5px] font-semibold text-slate-800">{a.primary}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 border-b border-slate-50 pb-1.5">
                        <span className="text-[11px] font-semibold text-slate-500">Backup responder</span>
                        {a.backup ? (
                          <span className="text-[12.5px] font-semibold text-slate-800">{a.backup}</span>
                        ) : (
                          <span className="rounded border border-dashed border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Unassigned — honest gap</span>
                        )}
                      </div>
                      <div className="flex items-baseline justify-between gap-3 border-b border-slate-50 pb-1.5">
                        <span className="text-[11px] font-semibold text-slate-500">Escalation level</span>
                        <span className="tabular-nums text-[12.5px] font-semibold text-slate-800">{a.escalationLevel} / 5</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 border-b border-slate-50 pb-1.5">
                        <span className="text-[11px] font-semibold text-slate-500">Contact method</span>
                        <span className="text-right text-[12.5px] text-slate-700">{a.contactMethod}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 border-b border-slate-50 pb-1.5">
                        <span className="text-[11px] font-semibold text-slate-500">Schedule</span>
                        <span className="text-right text-[12.5px] text-slate-700">{a.schedule}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 border-b border-slate-50 pb-1.5">
                        <span className="text-[11px] font-semibold text-slate-500">Last updated</span>
                        <span className="text-right text-[12px] tabular-nums text-slate-500">{fmtIST(a.updatedAt)} · {timeAgo(a.updatedAt)}</span>
                      </div>
                    </div>

                    <form
                      className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5"
                      onSubmit={(e) => { e.preventDefault(); save(a); }}
                      aria-label={`Edit on-call assignment for ${a.service}`}
                    >
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Edit assignment</p>
                      <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_9rem]">
                        <div>
                          <label htmlFor={`backup-${a.service}`} className="mb-1 block text-[11px] font-semibold text-slate-600">
                            Backup responder <span className="font-normal text-slate-400">(clear to record an honest gap)</span>
                          </label>
                          <input
                            id={`backup-${a.service}`}
                            value={edit.backup}
                            onChange={(e) => setEdit(a.service, { backup: e.target.value })}
                            maxLength={80}
                            placeholder="e.g. responder name from the identity directory"
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                        <div>
                          <label htmlFor={`level-${a.service}`} className="mb-1 block text-[11px] font-semibold text-slate-600">Escalation level (1–5)</label>
                          <input
                            id={`level-${a.service}`}
                            type="number"
                            min={1}
                            max={5}
                            step={1}
                            value={edit.escalationLevel}
                            onChange={(e) => setEdit(a.service, { escalationLevel: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={busyService !== null}
                          aria-busy={busyService === a.service}
                          className="min-h-[36px] rounded-lg bg-slate-900 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busyService === a.service ? "Saving…" : "Save assignment"}
                        </button>
                        <p className="text-[11px] text-slate-400">Saved server-side, audited, then the registry reloads with the real stored values.</p>
                      </div>
                    </form>
                  </article>
                );
              })}
            </div>
          )}

          <SourceLine>{data.sourceNote}</SourceLine>
        </div>
      )}
    </div>
  );
}
