"use client";

import * as React from "react";
import {
  Archive,
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  Clock,
  ExternalLink,
  LineChart,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getEmployee } from "@/lib/qubit/data";
import { fmtDateTime, relTime } from "@/lib/qubit/workspace-data";
import {
  DOMAIN_FRESHNESS,
  EXEC_PERIOD,
  type AlertSeverity,
  type DomainId,
  type ExecAlert,
} from "@/lib/qubit/executive-data";
import { screenMeta } from "@/lib/qubit/screens";
import {
  AsOfStrip,
  ExecApiError,
  ExecErrorBanner,
  ExecSkeleton,
  ExecutiveGate,
  execPost,
  FreshnessBadge,
  PeriodChip,
  SeverityBadge,
  useExecutiveNav,
  useExecutiveSection,
} from "../executive/parts";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { Avatar, EmptyState, SectionCard, StatTile, StatusBadge } from "../primitives";
import { DetailDrawer } from "../drawers";
import { ConfirmDialog, FormDialog, Field } from "../dialogs";

// ============================================================
// Screen 68 · Executive Alerts — the high-signal exception
// center. NOT employee notifications: eight curated alerts,
// each answering what happened / when / why it matters / what
// is affected / the recommended next step. Every action
// (acknowledge, assign, dismiss, reopen) is a server-side
// mutation with an honest error path and an audit record.
// ============================================================

interface AlertsPayload {
  period: typeof EXEC_PERIOD;
  asOfLabel: string;
  alerts: ExecAlert[];
}

/** Session principal — matches workspace-server SESSION_USER_ID (the signed-in CEO). */
const EXEC_NAME = "Sagar Singh";

/** Senior leaders an executive alert can be assigned to (directory-backed). */
const LEADER_IDS = ["rahul", "priya", "neha", "amit", "vikramj", "karan", "arjun", "sanjay"] as const;

/** Investigation path per domain — KPI Drilldown (71) carries the definition-to-records depth. */
const DOMAIN_KPI: Record<DomainId, string> = {
  revenue: "kpi-revenue",
  sales: "kpi-pipeline",
  finance: "kpi-cash",
  people: "kpi-attrition",
  marketing: "kpi-mkt",
  service: "kpi-sla",
  inventory: "kpi-dispatch",
  field: "kpi-field",
};

const SEV_RANK: Record<AlertSeverity, number> = { Critical: 0, High: 1, Attention: 2, Info: 3 };
const SEVERITIES: AlertSeverity[] = ["Critical", "High", "Attention", "Info"];

type AlertView = "active" | "dismissed";

export function ExecutiveAlertsScreen() {
  const navigate = useExecutiveNav();
  const { role } = useRole();
  const { toast } = useToast();
  const { data, loading, error, reload } = useExecutiveSection<AlertsPayload>("alerts");

  const [view, setView] = React.useState<AlertView>("active");
  const [severity, setSeverity] = React.useState<AlertSeverity | "All">("All");
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [detail, setDetail] = React.useState<ExecAlert | null>(null);
  const [assignTarget, setAssignTarget] = React.useState<ExecAlert | null>(null);
  const [assigneeId, setAssigneeId] = React.useState<string>("");
  const [assignError, setAssignError] = React.useState<string | null>(null);
  const [dismissTarget, setDismissTarget] = React.useState<ExecAlert | null>(null);
  const [dismissReason, setDismissReason] = React.useState("");
  const [dismissError, setDismissError] = React.useState<string | null>(null);

  const alerts = data?.alerts ?? [];
  const active = alerts.filter((a) => a.state !== "Dismissed");
  const dismissed = alerts.filter((a) => a.state === "Dismissed");
  const base = view === "active" ? active : dismissed;
  const filtered = base
    .filter((a) => severity === "All" || a.severity === severity)
    .slice()
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.raisedAt - a.raisedAt);

  const criticalHigh = active.filter((a) => a.severity === "Critical" || a.severity === "High").length;
  const assignedOthers = active.filter((a) => a.assignee && a.assignee !== EXEC_NAME).length;

  // ---------- honest mutation path: server decides, the UI only reports ----------
  const runAction = async (
    alert: ExecAlert,
    body: { action: "alert.acknowledge" | "alert.assign" | "alert.dismiss" | "alert.reopen"; assigneeId?: string; reason?: string },
    success: { title: string; description: string },
  ): Promise<boolean> => {
    setBusyId(alert.id);
    try {
      await execPost({ action: body.action, id: alert.id, assigneeId: body.assigneeId, reason: body.reason }, role);
      toast(success);
      reload();
      return true;
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Action not recorded",
        description:
          err instanceof ExecApiError
            ? err.message
            : "The executive service is unreachable. Nothing was changed — retry when you're back online.",
      });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const acknowledge = (alert: ExecAlert) =>
    runAction(alert, { action: "alert.acknowledge" }, {
      title: "Alert acknowledged",
      description: `${alert.title} — acknowledged and recorded in the enterprise audit trail.`,
    });

  const assign = (alert: ExecAlert, id: string) =>
    runAction(alert, { action: "alert.assign", assigneeId: id }, {
      title: "Alert assigned",
      description: `${alert.title} — assigned to ${getEmployee(id)?.name ?? "the selected leader"}.`,
    });

  const dismiss = (alert: ExecAlert, reason: string) =>
    runAction(alert, { action: "alert.dismiss", reason }, {
      title: "Alert dismissed",
      description: `${alert.title} — the reason is recorded in the audit trail. Find it under the Dismissed tab.`,
    });

  const reopen = (alert: ExecAlert) =>
    runAction(alert, { action: "alert.reopen" }, {
      title: "Alert reopened",
      description: `${alert.title} — back in the active queue with state reset to New.`,
    });

  const confirmDismiss = () => {
    if (!dismissTarget) return;
    const reason = dismissReason.trim();
    if (reason.length < 4) {
      // client-enforced — the server enforces the same rule (422)
      setDismissError("A reason of at least 4 characters is required — it is recorded in the audit trail.");
      return;
    }
    const target = dismissTarget;
    setDismissTarget(null);
    setDismissReason("");
    setDismissError(null);
    void dismiss(target, reason);
  };

  const openAssign = (alert: ExecAlert) => {
    setAssignTarget(alert);
    setAssigneeId("");
    setAssignError(null);
  };

  const submitAssign = () => {
    if (!assignTarget) return;
    if (!assigneeId) {
      setAssignError("Choose a person to assign this alert to.");
      return;
    }
    const target = assignTarget;
    const id = assigneeId;
    setAssignTarget(null);
    setAssigneeId("");
    setAssignError(null);
    void assign(target, id);
  };

  return (
    <ExecutiveGate screenName="Executive Alerts">
      <PageHeader
        crumbs={[
          { label: "CEO Command Center", onClick: () => navigate("ceo-overview") },
          { label: "Executive Alerts" },
        ]}
        title="Executive Alerts"
        description="Exceptions that clear the executive signal bar — each answers what happened, when, why it matters, what is affected and the recommended next step. Curated for signal, not a notification feed."
        meta={
          data && <PeriodChip label={data.period.label} window={data.period.window} />
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={reload}
            aria-label="Reload executive alerts"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
          </Button>
        }
      />

      {loading ? (
        <ExecSkeleton rows={4} className="max-w-3xl" />
      ) : error ? (
        <ExecErrorBanner message={error} onRetry={reload} />
      ) : alerts.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={<Bell />}
            title="No alerts in the queue"
            message="The exception center is calibrated to stay quiet — alerts appear here only when they clear the executive signal bar."
          />
        </SectionCard>
      ) : (
        <div>
          {/* ---------- signal tiles ---------- */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={<BellRing />} value={active.length.toLocaleString("en-IN")} label="Active alerts" />
            <StatTile
              icon={<ShieldAlert />}
              value={criticalHigh.toLocaleString("en-IN")}
              label="Critical & High severity"
            />
            <StatTile
              icon={<UserCheck />}
              value={assignedOthers.toLocaleString("en-IN")}
              label="Assigned outside the CEO office"
            />
            <StatTile icon={<Archive />} value={dismissed.length.toLocaleString("en-IN")} label="Dismissed" />
          </div>

          {/* ---------- view tabs ---------- */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1" role="tablist" aria-label="Alert views">
              {(
                [
                  { id: "active", label: `Active (${active.length})` },
                  { id: "dismissed", label: `Dismissed (${dismissed.length})` },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={view === t.id}
                  onClick={() => setView(t.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                    view === t.id ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ---------- severity filter chips ---------- */}
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by severity">
              {(["All", ...SEVERITIES] as const).map((s) => {
                const count = s === "All" ? base.length : base.filter((a) => a.severity === s).length;
                const selected = severity === s;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSeverity(s)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11.5px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                      selected
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {s} <span className="text-slate-400">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mb-3 text-xs text-slate-400" role="status" aria-live="polite">
            Showing {filtered.length} of {base.length} {view === "active" ? "active" : "dismissed"} alerts
            {severity !== "All" ? ` · ${severity} severity` : ""}
          </p>

          {/* ---------- alert cards ---------- */}
          {filtered.length === 0 ? (
            <SectionCard>
              <EmptyState
                icon={view === "active" ? <BellOff /> : <Archive />}
                title={view === "active" ? "No alerts at this severity" : "Nothing dismissed here"}
                message={
                  view === "active"
                    ? "The exception center is calibrated to stay quiet — new exceptions appear here the moment they clear the signal bar."
                    : "Dismissed alerts are kept here with their reason. Reopen one to put it back in the active queue."
                }
              />
            </SectionCard>
          ) : (
            <div className="space-y-3">
              {filtered.map((alert) =>
                view === "active" ? (
                  <ActiveAlertCard
                    key={alert.id}
                    alert={alert}
                    busy={busyId === alert.id}
                    onReview={() => setDetail(alert)}
                    onDrill={() => navigate(alert.drillScreen, alert.drillParams)}
                    onInvestigate={() => navigate("kpi-drilldown", { kpiId: DOMAIN_KPI[alert.domain] })}
                    onAssign={() => openAssign(alert)}
                    onAcknowledge={() => void acknowledge(alert)}
                    onDismiss={() => {
                      setDismissTarget(alert);
                      setDismissReason("");
                      setDismissError(null);
                    }}
                  />
                ) : (
                  <DismissedAlertCard
                    key={alert.id}
                    alert={alert}
                    busy={busyId === alert.id}
                    onReview={() => setDetail(alert)}
                    onReopen={() => void reopen(alert)}
                  />
                ),
              )}
            </div>
          )}

          <AsOfStrip
            asOfLabel={data!.asOfLabel}
            note="Each alert carries its source-domain freshness — delayed sources are labelled, never shown as live."
          />
        </div>
      )}

      {/* ---------- review drawer ---------- */}
      <DetailDrawer
        open={Boolean(detail)}
        onOpenChange={(o) => !o && setDetail(null)}
        wide
        title={detail?.title ?? ""}
        subtitle={detail ? `${detail.domainLabel} · raised ${relTime(detail.raisedAt)}` : undefined}
        icon={<BellRing />}
        footer={
          detail && detail.state === "New" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="h-8 gap-1.5"
                disabled={busyId === detail.id}
                onClick={() => {
                  const target = detail;
                  void acknowledge(target).then((ok) => ok && setDetail(null));
                }}
              >
                {busyId === detail.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                )}
                Acknowledge
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => navigate(detail.drillScreen, detail.drillParams)}>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open linked view
              </Button>
            </div>
          ) : detail ? (
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => navigate(detail.drillScreen, detail.drillParams)}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open linked view
            </Button>
          ) : undefined
        }
      >
        {detail && <AlertDetail alert={detail} onInvestigate={() => navigate("kpi-drilldown", { kpiId: DOMAIN_KPI[detail.domain] })} />}
      </DetailDrawer>

      {/* ---------- assign dialog ---------- */}
      <FormDialog
        open={Boolean(assignTarget)}
        onOpenChange={(o) => {
          if (!o) {
            setAssignTarget(null);
            setAssigneeId("");
            setAssignError(null);
          }
        }}
        title="Assign this alert"
        description={assignTarget?.title}
        submitLabel="Assign alert"
        onSubmit={submitAssign}
      >
        <Field label="Assign to" hint="Senior leaders with company-wide ownership — the assignment is recorded in the audit trail." required>
          <Select value={assigneeId} onValueChange={(v) => { setAssigneeId(v); if (assignError) setAssignError(null); }}>
            <SelectTrigger id="alert-assignee" aria-label="Assign alert to a senior leader" className="w-full">
              <SelectValue placeholder="Select a senior leader" />
            </SelectTrigger>
            <SelectContent>
              {LEADER_IDS.map((id) => {
                const e = getEmployee(id);
                return e ? (
                  <SelectItem key={id} value={id}>
                    {e.name} — {e.title}
                  </SelectItem>
                ) : null;
              })}
            </SelectContent>
          </Select>
        </Field>
        {assignError && (
          <p role="alert" className="text-[11.5px] font-medium text-red-600">
            {assignError}
          </p>
        )}
      </FormDialog>

      {/* ---------- dismiss confirm (reason required) ---------- */}
      <ConfirmDialog
        open={Boolean(dismissTarget)}
        onOpenChange={(o) => {
          if (!o) {
            setDismissTarget(null);
            setDismissReason("");
            setDismissError(null);
          }
        }}
        title="Dismiss this alert?"
        description="Dismissing removes the alert from the active queue. A short reason is required — it goes into the enterprise audit trail, and the alert stays reachable under the Dismissed tab."
        confirmLabel="Dismiss alert"
        destructive
        onConfirm={confirmDismiss}
      >
        <div className="space-y-1.5 py-2">
          <Label htmlFor="dismiss-reason" className="text-xs font-medium text-slate-700">
            Reason <span className="text-red-500" aria-hidden>*</span>
          </Label>
          <Textarea
            id="dismiss-reason"
            value={dismissReason}
            onChange={(e) => {
              setDismissReason(e.target.value);
              if (dismissError) setDismissError(null);
            }}
            placeholder="e.g. Covered by the standing review — track it in the Finance collection meeting instead."
            className="min-h-20"
            autoFocus
            aria-invalid={Boolean(dismissError)}
          />
          {dismissError ? (
            <p role="alert" className="text-[11px] text-red-600">
              {dismissError}
            </p>
          ) : (
            dismissReason.trim().length > 0 && dismissReason.trim().length < 4 && (
              <p className="text-[11px] text-red-600">Give a slightly longer reason (at least 4 characters).</p>
            )
          )}
        </div>
      </ConfirmDialog>
    </ExecutiveGate>
  );
}

// ---------- active alert card ----------

function ActiveAlertCard({
  alert,
  busy,
  onReview,
  onDrill,
  onInvestigate,
  onAssign,
  onAcknowledge,
  onDismiss,
}: {
  alert: ExecAlert;
  busy: boolean;
  onReview: () => void;
  onDrill: () => void;
  onInvestigate: () => void;
  onAssign: () => void;
  onAcknowledge: () => void;
  onDismiss: () => void;
}) {
  const freshness = DOMAIN_FRESHNESS[alert.domain];
  return (
    <article className="qubit-card qubit-card-hover p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={alert.severity} size="sm" />
        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600">
          {alert.domainLabel}
        </span>
        <StatusBadge status={alert.state} size="sm" />
        {alert.assignee && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <Avatar name={alert.assignee} size="xs" />
            {alert.assignee}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <FreshnessBadge freshness={freshness} short />
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Clock className="h-3 w-3" aria-hidden />
            {relTime(alert.raisedAt)}
          </span>
        </span>
      </div>

      <h3 className="mt-2 text-[15px] font-semibold leading-snug tracking-tight text-slate-900">{alert.title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-700">{alert.whatHappened}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
        <span className="font-medium text-slate-600">Why it matters:</span> {alert.whyItMatters}
      </p>

      <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5 text-[12px]">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
          <dt className="w-24 shrink-0 font-medium text-slate-400">Affected</dt>
          <dd className="text-slate-700">{alert.affected}</dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
          <dt className="w-24 shrink-0 font-medium text-slate-400">Recommended</dt>
          <dd className="text-slate-700">{alert.recommended}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 border-t border-slate-100 pt-3">
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2.5 text-xs" onClick={onReview}>
          <Bell className="h-3 w-3" aria-hidden /> Review
        </Button>
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2.5 text-xs" onClick={onDrill}>
          <ExternalLink className="h-3 w-3" aria-hidden /> Drill down
        </Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2.5 text-xs" onClick={onInvestigate}>
          <LineChart className="h-3 w-3" aria-hidden /> Investigate
        </Button>

        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {busy ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" aria-hidden />
              Recording…
            </span>
          ) : (
            <>
              {alert.state === "New" && (
                <Button size="sm" className="h-7 gap-1 px-2.5 text-xs" onClick={onAcknowledge}>
                  <CheckCheck className="h-3 w-3" aria-hidden /> Acknowledge
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 gap-1 px-2.5 text-xs" onClick={onAssign}>
                <UserPlus className="h-3 w-3" aria-hidden /> Assign
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2.5 text-xs text-red-600 hover:text-red-700"
                onClick={onDismiss}
              >
                <XCircle className="h-3 w-3" aria-hidden /> Dismiss
              </Button>
            </>
          )}
        </span>
      </div>
    </article>
  );
}

// ---------- dismissed alert card ----------

function DismissedAlertCard({
  alert,
  busy,
  onReview,
  onReopen,
}: {
  alert: ExecAlert;
  busy: boolean;
  onReview: () => void;
  onReopen: () => void;
}) {
  const freshness = DOMAIN_FRESHNESS[alert.domain];
  return (
    <article className="qubit-card p-4 opacity-90">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={alert.severity} size="sm" />
        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600">
          {alert.domainLabel}
        </span>
        <StatusBadge status={alert.state} size="sm" />
        {alert.assignee && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <Avatar name={alert.assignee} size="xs" />
            {alert.assignee}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <FreshnessBadge freshness={freshness} short />
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Clock className="h-3 w-3" aria-hidden />
            {relTime(alert.raisedAt)}
          </span>
        </span>
      </div>

      <h3 className="mt-2 text-[15px] font-semibold leading-snug tracking-tight text-slate-900">{alert.title}</h3>
      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-[12px] leading-relaxed text-slate-600">
        <span className="font-medium text-slate-700">Dismissed:</span> {alert.dismissedReason ?? "No reason recorded."}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2.5 text-xs" onClick={onReview}>
          <Bell className="h-3 w-3" aria-hidden /> Review
        </Button>
        <span className="ml-auto">
          {busy ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" aria-hidden />
              Recording…
            </span>
          ) : (
            <Button size="sm" variant="outline" className="h-7 gap-1 px-2.5 text-xs" onClick={onReopen}>
              <RotateCcw className="h-3 w-3" aria-hidden /> Reopen
            </Button>
          )}
        </span>
      </div>
    </article>
  );
}

// ---------- review drawer body ----------

function AlertDetail({ alert, onInvestigate }: { alert: ExecAlert; onInvestigate: () => void }) {
  const drill = screenMeta(alert.drillScreen);
  const freshness = DOMAIN_FRESHNESS[alert.domain];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={alert.severity} size="sm" />
        <StatusBadge status={alert.state} size="sm" />
        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600">
          {alert.domainLabel}
        </span>
        <FreshnessBadge freshness={freshness} />
      </div>

      <section aria-labelledby="alert-what">
        <h3 id="alert-what" className="text-xs font-semibold uppercase tracking-wide text-slate-400">What happened</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-700">{alert.whatHappened}</p>
      </section>

      <dl className="divide-y rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5">
        <DetailRow label="When" value={`${alert.whenText} · ${fmtDateTime(alert.raisedAt)} (${relTime(alert.raisedAt)})`} />
        <DetailRow label="Why it matters" value={alert.whyItMatters} />
        <DetailRow label="Affected" value={alert.affected} />
        <DetailRow label="Recommended" value={alert.recommended} />
        {alert.assignee && <DetailRow label="Owner" value={alert.assignee} />}
        {alert.state === "Dismissed" && (
          <DetailRow label="Dismissed" value={alert.dismissedReason ?? "No reason recorded."} />
        )}
      </dl>

      <section aria-labelledby="alert-linked">
        <h3 id="alert-linked" className="text-xs font-semibold uppercase tracking-wide text-slate-400">Linked view</h3>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 px-3.5 py-2.5">
          <p className="text-[13px] text-slate-700">
            {drill.title}
          </p>
          <Button size="sm" variant="outline" className="h-7 gap-1 px-2.5 text-xs" onClick={onInvestigate}>
            <LineChart className="h-3 w-3" aria-hidden /> Investigate in KPI Drilldown
          </Button>
        </div>
      </section>

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
        <ShieldCheck className="mt-px h-3 w-3 shrink-0" aria-hidden />
        Actions on this alert are recorded in the enterprise audit trail.
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-[13px] leading-relaxed text-slate-800">{value}</dd>
    </div>
  );
}
