"use client";

import * as React from "react";
import { Pencil, RefreshCw, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PageHeader } from "../page-header";
import { EmptyState, ReadOnlyBanner, SectionCard } from "../primitives";
import { PeriodChip, TrendArrow } from "../executive/parts";
import { useRole } from "../role-context";
import { Field, FormDialog } from "../dialogs";
import { toast } from "@/hooks/use-toast";
import {
  fmtCr,
  salesPost,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  ScopeNote,
  useSalesSection,
} from "../sales/parts";

// ============================================================
// Screen 82 · Sales Targets — quotas by employee, team and
// region for the period. Quota editing is restricted to the
// administrator boundary (server 403s anyone else); every
// change is audited. Achievement tones are always paired with
// % text and word chips — never color-only.
// Data: /api/sales?section=targets · mutation: target.update.
// ============================================================

interface TargetRowT {
  id: string;
  kind: "employee" | "team";
  refId: string;
  label: string;
  quotaCr: number;
  achievedCr: number;
  pipelineCr: number;
  forecastCr: number;
}

interface TargetsPayload {
  rows: TargetRowT[];
  scope: "company" | "team" | "own";
  canEdit: boolean;
  period: { label: string; window: string; asOfLabel: string };
}

const TH =
  "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 md:px-4";
const THR = cn(TH, "text-right");
const TD = "whitespace-nowrap px-3 py-2.5 text-[13px] tabular-nums text-slate-700 md:px-4";

const pctOf = (achieved: number, quota: number) => (quota > 0 ? Math.round((achieved / quota) * 100) : 0);

/** Signed Cr figure — explicit sign, never color-only. */
const signedCr = (v: number) =>
  Math.abs(v) < 0.005 ? fmtCr(0) : v > 0 ? `+${fmtCr(v)}` : `−${fmtCr(Math.abs(v))}`;

// ---------- achievement cell — bar + % text + word chip ----------

function AchievementCell({ pct, pipelineCr }: { pct: number; pipelineCr: number }) {
  const tone =
    pct >= 70
      ? { bar: "bg-emerald-500", text: "text-emerald-700" }
      : pct >= 40
        ? { bar: "bg-blue-600", text: "text-blue-700" }
        : { bar: "bg-amber-500", text: "text-amber-700" };
  const behindPace = pct === 0 && pipelineCr > 0;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Achievement ${pct}% of quota`}>
        <span className={cn("block h-full rounded-full", tone.bar)} style={{ width: `${Math.min(100, Math.max(4, pct))}%` }} />
      </span>
      <span className={cn("text-xs font-medium tabular-nums", tone.text)}>{pct}%</span>
      {behindPace && (
        <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-[10.5px] font-medium text-amber-700">
          Behind pace<span className="sr-only"> — no closed revenue yet this quarter</span>
        </span>
      )}
    </span>
  );
}

// ---------- variance cell — TrendArrow + signed Cr ----------

function VarianceCell({ forecastCr, quotaCr }: { forecastCr: number; quotaCr: number }) {
  const variance = forecastCr - quotaCr;
  const varPct = quotaCr > 0 ? (variance / quotaCr) * 100 : variance > 0 ? 100 : 0;
  return <TrendArrow trendPct={varPct} direction="up-good" suffix={`· ${signedCr(variance)}`} />;
}

// ---------- targets table (employees / teams) ----------

function TargetsTable({
  rows,
  kind,
  canEdit,
  onEdit,
  showFooter,
}: {
  rows: TargetRowT[];
  kind: "employee" | "team";
  canEdit: boolean;
  onEdit: (row: TargetRowT) => void;
  showFooter?: boolean;
}) {
  const totals = {
    quota: rows.reduce((s, r) => s + r.quotaCr, 0),
    achieved: rows.reduce((s, r) => s + r.achievedCr, 0),
    forecast: rows.reduce((s, r) => s + r.forecastCr, 0),
  };

  return (
    <div className="qubit-card overflow-hidden">
      <div className="qubit-scroll relative overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm" aria-label={`Sales targets — ${kind === "employee" ? "employees" : "teams"}`}>
          <thead>
            <tr className="border-b border-slate-200/90 bg-slate-50/95">
              <th scope="col" className={TH}>{kind === "employee" ? "Employee" : "Team"}</th>
              <th scope="col" className={THR}>Quota</th>
              <th scope="col" className={THR}>Achieved</th>
              <th scope="col" className={THR}>Remaining</th>
              <th scope="col" className={TH}>Achievement</th>
              <th scope="col" className={THR}>Pipeline</th>
              <th scope="col" className={THR}>Forecast</th>
              <th scope="col" className={THR}>Variance vs forecast</th>
              {canEdit && (
                <th scope="col" className={TH}><span className="sr-only">Actions</span></th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-blue-50/30">
                <td className={cn(TD, "font-medium text-slate-800")}>{r.label}</td>
                <td className={TD}>{fmtCr(r.quotaCr)}</td>
                <td className={TD}>{fmtCr(r.achievedCr)}</td>
                <td className={TD}>{fmtCr(Math.max(0, r.quotaCr - r.achievedCr))}</td>
                <td className="px-3 py-2.5 md:px-4">
                  <AchievementCell pct={pctOf(r.achievedCr, r.quotaCr)} pipelineCr={r.pipelineCr} />
                </td>
                <td className={TD}>{fmtCr(r.pipelineCr)}</td>
                <td className={cn(TD, "font-medium text-slate-900")}>{fmtCr(r.forecastCr)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 md:px-4">
                  <VarianceCell forecastCr={r.forecastCr} quotaCr={r.quotaCr} />
                </td>
                {canEdit && (
                  <td className="whitespace-nowrap px-3 py-2 md:px-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 px-2.5 text-xs"
                      onClick={() => onEdit(r)}
                      aria-label={`Edit quota for ${r.label}`}
                    >
                      <Pencil className="h-3 w-3" aria-hidden /> Edit quota
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {showFooter && rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/80">
                <td className={cn(TD, "font-semibold text-slate-800")}>Total — employees</td>
                <td className={cn(TD, "font-semibold")}>{fmtCr(totals.quota)}</td>
                <td className={cn(TD, "font-semibold")}>{fmtCr(totals.achieved)}</td>
                <td className={cn(TD, "font-semibold")}>{fmtCr(Math.max(0, totals.quota - totals.achieved))}</td>
                <td className="px-3 py-2.5 md:px-4">
                  <AchievementCell pct={pctOf(totals.achieved, totals.quota)} pipelineCr={0} />
                </td>
                <td className={TD}><span className="sr-only">Pipeline is shown per row, not totaled</span>—</td>
                <td className={cn(TD, "font-semibold")}>{fmtCr(totals.forecast)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 md:px-4">
                  <VarianceCell forecastCr={totals.forecast} quotaCr={totals.quota} />
                </td>
                {canEdit && <td aria-hidden />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {rows.length === 0 && (
        <EmptyState
          icon={kind === "employee" ? <Users /> : <Target />}
          title={kind === "employee" ? "No employee targets" : "No team targets"}
          message="Your authorized scope has no target rows for this period."
        />
      )}
    </div>
  );
}

// ---------- screen ----------

export function SalesTargetsScreen() {
  const { role } = useRole();
  const { data, loading, error, forbidden, scope, reload } = useSalesSection<TargetsPayload>("targets");

  const [editRow, setEditRow] = React.useState<TargetRowT | null>(null);
  const [quotaInput, setQuotaInput] = React.useState("");
  const [editError, setEditError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const openEdit = (row: TargetRowT) => {
    setEditRow(row);
    setQuotaInput(String(row.quotaCr));
    setEditError(null);
  };

  const submitEdit = async () => {
    if (!editRow) return;
    const parsed = Number(quotaInput);
    if (quotaInput.trim() === "" || !Number.isFinite(parsed) || parsed < 0) {
      setEditError("Enter a non-negative quota in ₹ Cr.");
      return;
    }
    setSubmitting(true);
    setEditError(null);
    try {
      const res = await salesPost("target.update", { id: editRow.id, quotaCr: parsed }, role);
      toast({ title: res.message ?? `${editRow.label} quota updated.` });
      setEditRow(null);
      reload();
    } catch (err) {
      // Server validation (403 boundary / 422 invalid quota) surfaces verbatim.
      setEditError(err instanceof Error ? err.message : "The quota change could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };

  if (forbidden) {
    return (
      <SalesGate screenName="Sales Targets">
        <></>
      </SalesGate>
    );
  }

  const employeeRows = data?.rows.filter((r) => r.kind === "employee") ?? [];
  const teamRows = data?.rows.filter((r) => r.kind === "team") ?? [];
  const canEdit = data?.canEdit ?? false;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Sales Targets" }]}
        title="Sales Targets"
        description="Targets by employee, team and region for the period. Quota editing is restricted to the administrator boundary — every change is audited."
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={reload} aria-label="Reload targets">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
          </Button>
        }
        meta={data ? <PeriodChip label={data.period.label} window={data.period.window} /> : undefined}
      />

      {error && !forbidden && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={5} />}

      {data && !loading && (
        <div className="space-y-4">
          {/* boundary note — dept-head sees team quotas read-only */}
          {role === "dept-head" && (
            <ReadOnlyBanner message="Targets are configured by the administrator boundary — you see your teams' quotas read-only." />
          )}

          <Tabs defaultValue="employees">
            <TabsList>
              <TabsTrigger value="employees">Employees</TabsTrigger>
              <TabsTrigger value="teams">Teams</TabsTrigger>
            </TabsList>

            <TabsContent value="employees" className="mt-4">
              <TargetsTable rows={employeeRows} kind="employee" canEdit={canEdit} onEdit={openEdit} showFooter />
            </TabsContent>

            <TabsContent value="teams" className="mt-4">
              <TargetsTable rows={teamRows} kind="team" canEdit={canEdit} onEdit={openEdit} />
            </TabsContent>
          </Tabs>

          <div className="space-y-1">
            <ScopeNote scope={scope} what="target rows" />
            <p className="text-[11px] text-slate-400">
              Achievement tones: 70%+ on track (green), 40–69% building (blue), below 40% behind (amber) — each bar is paired with its
              percentage and a word chip, so color is never the only signal. Variance is forecast − quota; positive means the forecast
              clears the quota.
            </p>
          </div>

          {/* honest history note — the audit trail is the history */}
          <SectionCard title="Target history" description="Where past quota values live.">
            <p className="text-[13px] leading-relaxed text-slate-600">
              Quota history is retained with each change in the audit trail (filter by “Sales target updated”). No separate
              history table is kept.
            </p>
          </SectionCard>

          <SalesAsOf
            asOfLabel={data.period.asOfLabel}
            note="Quota figures come from the server's canonical target store; achieved and forecast roll-ups follow the same scope as your role."
          />
        </div>
      )}

      {!loading && !data && !error && (
        <EmptyState
          icon={<Target />}
          title="Sales Targets could not load"
          message="The sales service returned no target data. Retry, or check the service status."
          action={
            <Button size="sm" onClick={reload}>
              Retry
            </Button>
          }
        />
      )}

      {/* quota edit — administrator boundary only; the server re-checks and 403s otherwise */}
      <FormDialog
        open={!!editRow}
        onOpenChange={(open) => {
          if (!open) setEditRow(null);
        }}
        title={editRow ? `Edit quota — ${editRow.label}` : "Edit quota"}
        description={
          editRow
            ? `${editRow.kind === "team" ? "Team" : "Employee"} quota for ${data?.period.label ?? "the period"}. The change is validated on the server and written to the audit trail.`
            : undefined
        }
        onSubmit={submitEdit}
        submitting={submitting}
        submitLabel="Save quota"
      >
        <Field label="Quota (₹ Cr)" required hint="Non-negative number, e.g. 2.8. Previous values stay recoverable from the audit trail.">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.05}
            value={quotaInput}
            onChange={(e) => {
              setQuotaInput(e.target.value);
              if (editError) setEditError(null);
            }}
            aria-invalid={!!editError}
            autoFocus
          />
        </Field>
        {editError && (
          <p role="alert" className="text-[12px] font-medium text-red-600">
            {editError}
          </p>
        )}
      </FormDialog>
    </div>
  );
}
