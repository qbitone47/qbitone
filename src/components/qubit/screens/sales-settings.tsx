"use client";

import * as React from "react";
import { Check, Pencil, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PageHeader } from "../page-header";
import { ArrowLink, EmptyState, ReadOnlyBanner, SectionCard, StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { ConfirmDialog, Field, FormDialog } from "../dialogs";
import { toast } from "@/hooks/use-toast";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import {
  fmtCr,
  salesPost,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  useSalesSection,
} from "../sales/parts";

// ============================================================
// Screen 102 · Sales Settings — sales configuration. Every
// change is authorized (administrator boundary only, server 403s
// enforce it), validated and audited; the previous value is
// recoverable from the audit trail. Editing flows go through an
// explicit "Apply configuration change?" confirmation.
// Data: /api/sales?section=settings · mutation: settings.update.
// ============================================================

interface StageRow {
  id: string;
  name: string;
  probability: number;
  requiresQuotation: boolean;
}
interface AssignmentRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  active: boolean;
}
interface ApprovalRule {
  id: string;
  trigger: string;
  rule: string;
  approver: string;
  active: boolean;
}
interface SettingsShape {
  stages: StageRow[];
  leadSources: string[];
  lossReasons: string[];
  activityTypes: string[];
  assignmentRules: AssignmentRule[];
  approvalRules: ApprovalRule[];
  quotaTotalCr: number;
}
interface SettingsPayload {
  settings: SettingsShape;
  canEdit: boolean;
}

type ListArea = "leadSources" | "lossReasons" | "activityTypes";

type PendingChange =
  | { area: "stages"; label: string; value: StageRow[] }
  | { area: ListArea; label: string; value: string[] }
  | { area: "assignmentRules"; label: string; value: AssignmentRule[] }
  | { area: "approvalRules"; label: string; value: ApprovalRule[] };

const TH = "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 md:px-4";
const TD = "px-3 py-2.5 align-top text-[13px] text-slate-700 md:px-4";

/** Probability chip — banded tone, always with the number as text. */
function ProbabilityChip({ value }: { value: number }) {
  const tone =
    value >= 65
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : value >= 35
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums", tone)}>
      {value}%
    </span>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-xs text-slate-400">None configured.</p>;
  return (
    <div className="flex flex-wrap gap-1.5" aria-label={`${items.length} entries`}>
      {items.map((item) => (
        <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[12px] font-medium text-slate-600">
          {item}
        </span>
      ))}
    </div>
  );
}

/** Parses a comma-separated textarea into a deduped, non-empty list. */
const parseList = (text: string): string[] => {
  const seen = new Set<string>();
  for (const raw of text.split(",")) {
    const v = raw.trim();
    if (v && !seen.has(v)) seen.add(v);
  }
  return [...seen];
};

export function SalesSettingsScreen() {
  const { role } = useRole();
  const nav = useQubitNav();
  const { data, loading, error, forbidden, reload } = useSalesSection<SettingsPayload>("settings");

  const settings = data?.settings ?? null;
  const canEdit = data?.canEdit ?? false;

  // ---------- pending change → ConfirmDialog → salesPost ----------
  const [pending, setPending] = React.useState<PendingChange | null>(null);
  const [applying, setApplying] = React.useState(false);

  // ---------- stages editor ----------
  const [stagesEditor, setStagesEditor] = React.useState<{ open: boolean; rows: StageRow[]; error: string | null }>({
    open: false,
    rows: [],
    error: null,
  });

  // ---------- list editors (lead sources / loss reasons / activity types) ----------
  const [listEditor, setListEditor] = React.useState<{ area: ListArea; title: string; text: string; error: string | null } | null>(null);

  const applyPending = async () => {
    if (!pending || applying) return;
    setApplying(true);
    try {
      const res = await salesPost("settings.update", { area: pending.area, value: pending.value }, role);
      toast({ title: res.message ?? `${pending.area} updated.` });
      setPending(null);
      setStagesEditor((prev) => ({ ...prev, open: false, error: null }));
      setListEditor(null);
      reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "The configuration change could not be applied.";
      // 403 boundary / 409 stage_in_use / 422 validation — the server message
      // surfaces verbatim: inline in the open editor, or as a toast for toggles.
      if (pending.area === "stages") {
        setStagesEditor((prev) => ({ ...prev, error: message }));
      } else if ((pending.area === "assignmentRules" || pending.area === "approvalRules") || listEditor?.area !== pending.area) {
        toast({ title: message, variant: "destructive" });
      } else {
        setListEditor((prev) => (prev ? { ...prev, error: message } : prev));
      }
      setPending(null);
    } finally {
      setApplying(false);
    }
  };
  const openStagesEditor = () => {
    setStagesEditor({ open: true, rows: (settings?.stages ?? []).map((s) => ({ ...s })), error: null });
  };
  const submitStages = () => {
    const invalid = stagesEditor.rows.find((r) => !Number.isFinite(r.probability) || r.probability < 0 || r.probability > 100);
    if (invalid) {
      setStagesEditor((prev) => ({ ...prev, error: `Default probability for ${invalid.name} must be between 0 and 100.` }));
      return;
    }
    setStagesEditor((prev) => ({ ...prev, error: null }));
    setPending({ area: "stages", label: "Pipeline stages", value: stagesEditor.rows });
  };

  // ---------- list editors — open / submit ----------
  const openListEditor = (area: ListArea, title: string, current: string[]) => {
    setListEditor({ area, title, text: current.join(", "), error: null });
  };
  const submitList = () => {
    if (!listEditor) return;
    const parsed = parseList(listEditor.text);
    if (parsed.length === 0) {
      setListEditor((prev) => (prev ? { ...prev, error: "Enter at least one non-empty, comma-separated value." } : prev));
      return;
    }
    setListEditor((prev) => (prev ? { ...prev, error: null } : prev));
    setPending({ area: listEditor.area, label: listEditor.title, value: parsed });
  };

  // ---------- rule toggles (assignment / approval) ----------
  const toggleRule = (area: "assignmentRules" | "approvalRules", label: string, rules: AssignmentRule[] | ApprovalRule[], id: string) => {
    const updated = (rules as { id: string; active: boolean }[]).map((r) => (r.id === id ? { ...r, active: !r.active } : r));
    setPending({ area, label, value: updated } as PendingChange);
  };

  if (forbidden) {
    return (
      <SalesGate screenName="Sales Settings">
        <></>
      </SalesGate>
    );
  }

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Sales Settings" }]}
        title="Sales Settings"
        description="Sales configuration — stages, sources, statuses, loss reasons, teams, assignment and approval rules. Every change is authorized, validated and audited; the previous value is recoverable from the audit trail."
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={reload} aria-label="Reload settings">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
          </Button>
        }
        meta={
          data ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                canEdit ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", canEdit ? "bg-emerald-500" : "bg-amber-500")} aria-hidden />
              {canEdit ? "Administrator — changes enabled" : "Read-only for your boundary"}
            </span>
          ) : undefined
        }
      />

      {error && !forbidden && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={5} />}

      {data && settings && !loading && (
        <div className="space-y-4">
          {!canEdit && (
            <ReadOnlyBanner message="Sales configuration is restricted to the administrator boundary — you see the live configuration read-only." />
          )}

          {/* 1 · Pipeline stages */}
          <SectionCard
            title="Pipeline stages"
            description="Stage order is fixed by the lifecycle; default probability feeds weighted pipeline and the quotation requirement gates late stages."
            actions={
              canEdit ? (
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={openStagesEditor}>
                  <Pencil className="h-3 w-3" aria-hidden /> Edit stages
                </Button>
              ) : undefined
            }
          >
            <div className="qubit-scroll relative overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm" aria-label="Pipeline stages configuration">
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50/95">
                    <th scope="col" className={TH}>Stage</th>
                    <th scope="col" className={TH}>Default probability</th>
                    <th scope="col" className={TH}>Requires quotation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settings.stages.map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-blue-50/30">
                      <td className={cn(TD, "font-medium text-slate-800")}>{s.name}</td>
                      <td className={TD}>
                        <ProbabilityChip value={s.probability} />
                      </td>
                      <td className={TD}>
                        {s.requiresQuotation ? (
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
                            <Check className="h-3.5 w-3.5" aria-hidden /> Required
                          </span>
                        ) : (
                          <span className="text-[13px] text-slate-400">Not required</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* 2 · Lead sources */}
          <SectionCard
            title="Lead sources"
            description="Values offered in lead creation and conversion forms."
            actions={
              canEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => openListEditor("leadSources", "Lead sources", settings.leadSources)}
                >
                  <Pencil className="h-3 w-3" aria-hidden /> Edit
                </Button>
              ) : undefined
            }
          >
            <ChipList items={settings.leadSources} />
          </SectionCard>

          {/* 3 · Loss reasons */}
          <SectionCard
            title="Loss reasons"
            description="Structured reasons captured when an opportunity is marked Lost — they power the win/loss report."
            actions={
              canEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => openListEditor("lossReasons", "Loss reasons", settings.lossReasons)}
                >
                  <Pencil className="h-3 w-3" aria-hidden /> Edit
                </Button>
              ) : undefined
            }
          >
            <ChipList items={settings.lossReasons} />
          </SectionCard>

          {/* 4 · Activity types */}
          <SectionCard
            title="Activity types"
            description="Types available on the unified customer activity timeline."
            actions={
              canEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => openListEditor("activityTypes", "Activity types", settings.activityTypes)}
                >
                  <Pencil className="h-3 w-3" aria-hidden /> Edit
                </Button>
              ) : undefined
            }
          >
            <ChipList items={settings.activityTypes} />
          </SectionCard>

          {/* 5 · Assignment rules */}
          <SectionCard
            title="Assignment rules"
            description="How new leads route to owners — order matters; the first matching rule wins."
          >
            <div className="qubit-scroll relative overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm" aria-label="Lead assignment rules">
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50/95">
                    <th scope="col" className={TH}>Rule</th>
                    <th scope="col" className={TH}>Trigger</th>
                    <th scope="col" className={TH}>Action</th>
                    <th scope="col" className={TH}>Status</th>
                    {canEdit && (
                      <th scope="col" className={TH}><span className="sr-only">Toggle</span></th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settings.assignmentRules.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-blue-50/30">
                      <td className={cn(TD, "font-medium whitespace-nowrap text-slate-800")}>{r.name}</td>
                      <td className={cn(TD, "min-w-[200px]")}>{r.trigger}</td>
                      <td className={cn(TD, "min-w-[220px] text-slate-600")}>{r.action}</td>
                      <td className={TD}>
                        <StatusBadge status={r.active ? "Active" : "Inactive"} size="sm" />
                      </td>
                      {canEdit && (
                        <td className={cn(TD, "whitespace-nowrap")}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            onClick={() => toggleRule("assignmentRules", "Assignment rules", settings.assignmentRules, r.id)}
                            aria-label={`${r.active ? "Disable" : "Enable"} assignment rule ${r.name}`}
                          >
                            {r.active ? "Disable" : "Enable"}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* 6 · Approval rules */}
          <SectionCard
            title="Approval rules"
            description="Thresholds that route sales requests into the enterprise approval queue."
          >
            <div className="qubit-scroll relative overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm" aria-label="Sales approval rules">
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50/95">
                    <th scope="col" className={TH}>Trigger</th>
                    <th scope="col" className={TH}>Rule</th>
                    <th scope="col" className={TH}>Approver</th>
                    <th scope="col" className={TH}>Status</th>
                    {canEdit && (
                      <th scope="col" className={TH}><span className="sr-only">Toggle</span></th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settings.approvalRules.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-blue-50/30">
                      <td className={cn(TD, "font-medium whitespace-nowrap text-slate-800")}>{r.trigger}</td>
                      <td className={cn(TD, "min-w-[220px] text-slate-600")}>{r.rule}</td>
                      <td className={cn(TD, "whitespace-nowrap")}>{r.approver}</td>
                      <td className={TD}>
                        <StatusBadge status={r.active ? "Active" : "Inactive"} size="sm" />
                      </td>
                      {canEdit && (
                        <td className={cn(TD, "whitespace-nowrap")}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            onClick={() => toggleRule("approvalRules", "Approval rules", settings.approvalRules, r.id)}
                            aria-label={`${r.active ? "Disable" : "Enable"} approval rule for ${r.trigger}`}
                          >
                            {r.active ? "Disable" : "Enable"}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              These rules feed the enterprise Approval Matrix (09) — quotation discounts &gt;15%, totals &gt; ₹50 L and expense claims route
              automatically.
            </p>
          </SectionCard>

          {/* 7 · Quota & targets */}
          <SectionCard title="Quota & targets" description="The company quota total for the period, maintained with the target rows.">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[26px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">{fmtCr(settings.quotaTotalCr)}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">Total quota for {SALES_PERIOD.label} across employees and teams</p>
              </div>
              <ArrowLink onClick={() => nav.navigate("sales-targets")} ariaLabel="Open Sales Targets">
                Sales Targets (82)
              </ArrowLink>
            </div>
          </SectionCard>

          <SalesAsOf
            asOfLabel={SALES_PERIOD.asOfLabel}
            note="Configuration history lives in the audit trail — filter by “Sales settings updated”."
          />
        </div>
      )}

      {!loading && !data && !error && (
        <EmptyState
          icon={<Settings2 />}
          title="Sales Settings could not load"
          message="The sales service returned no configuration data. Retry, or check the service status."
          action={
            <Button size="sm" onClick={reload}>
              Retry
            </Button>
          }
        />
      )}

      {/* ---------- stages editor ---------- */}
      <FormDialog
        open={stagesEditor.open}
        onOpenChange={(open) => setStagesEditor((prev) => ({ ...prev, open }))}
        title="Edit pipeline stages"
        description="Stage names are fixed — open opportunities still use them, and the server blocks removals that would orphan a deal. Probability and the quotation requirement are editable."
        onSubmit={submitStages}
        submitLabel="Review change"
        wide
      >
        <div className="max-h-96 space-y-3 overflow-y-auto pr-1 qubit-scroll">
          {stagesEditor.rows.map((row, i) => (
            <div key={row.id} className="grid items-center gap-3 rounded-lg border border-slate-200/80 p-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
              <div>
                <p className="text-[13px] font-medium text-slate-800">{row.name}</p>
                <p className="text-[11px] text-slate-400">Name is fixed — stage {i + 1} of {stagesEditor.rows.length}</p>
              </div>
              <Field label="Probability %" className="sm:col-span-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={5}
                  value={Number.isFinite(row.probability) ? String(row.probability) : ""}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setStagesEditor((prev) => ({
                      ...prev,
                      rows: prev.rows.map((r) => (r.id === row.id ? { ...r, probability: v } : r)),
                    }));
                  }}
                  aria-label={`Default probability for ${row.name}`}
                />
              </Field>
              <label className="flex items-center gap-2 text-[13px] text-slate-700">
                <Checkbox
                  checked={row.requiresQuotation}
                  onCheckedChange={(checked) => {
                    setStagesEditor((prev) => ({
                      ...prev,
                      rows: prev.rows.map((r) => (r.id === row.id ? { ...r, requiresQuotation: checked === true } : r)),
                    }));
                  }}
                  aria-label={`Requires quotation in ${row.name}`}
                />
                Requires quotation
              </label>
            </div>
          ))}
        </div>
        {stagesEditor.error && (
          <p role="alert" className="text-[12px] font-medium text-red-600">
            {stagesEditor.error}
          </p>
        )}
      </FormDialog>

      {/* ---------- comma-separated list editor (sources / loss reasons / activity types) ---------- */}
      <FormDialog
        open={!!listEditor}
        onOpenChange={(open) => {
          if (!open) setListEditor(null);
        }}
        title={listEditor ? `Edit ${listEditor.title.toLowerCase()}` : "Edit list"}
        description="Comma-separated values. Duplicates are removed and empty entries dropped — the parsed result is shown before you apply it."
        onSubmit={submitList}
        submitLabel="Review change"
      >
        {listEditor && (
          <>
            <Field label={listEditor.title} required>
              <Textarea
                value={listEditor.text}
                onChange={(e) => {
                  const text = e.target.value;
                  setListEditor((prev) => (prev ? { ...prev, text } : prev));
                }}
                rows={5}
                aria-label={`Comma-separated ${listEditor.title.toLowerCase()}`}
              />
            </Field>
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Parsed result — {parseList(listEditor.text).length} {parseList(listEditor.text).length === 1 ? "entry" : "entries"}
              </p>
              <ChipList items={parseList(listEditor.text)} />
            </div>
            {listEditor.error && (
              <p role="alert" className="text-[12px] font-medium text-red-600">
                {listEditor.error}
              </p>
            )}
          </>
        )}
      </FormDialog>

      {/* ---------- universal apply confirmation ---------- */}
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="Apply configuration change?"
        description={
          pending
            ? `${pending.label} will be updated for the whole sales organization. The change is validated on the server and audited — the previous value stays recoverable from the audit trail.`
            : ""
        }
        confirmLabel="Apply change"
        onConfirm={applyPending}
      >
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800" role="note">
          Configuration applies to every sales user immediately. If a stage in use would be removed, the server answers 409 stage_in_use and nothing
          changes.
        </div>
      </ConfirmDialog>
    </div>
  );
}
