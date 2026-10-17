"use client";

import * as React from "react";
import {
  BellOff,
  CircleAlert,
  Clock,
  Info,
  Link2,
  Loader2,
  OctagonAlert,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiGet, apiPost } from "@/lib/qubit/api";
import type { SecurityAlert } from "@/lib/qubit/security-data";
import { useRole } from "../role-context";
import { useQubitNav } from "../nav-context";
import { PageHeader } from "../page-header";
import { EmptyState, KV, StatTile, StatusBadge } from "../primitives";
import { ConfirmDialog } from "../dialogs";
import { DetailDrawer } from "../drawers";

// ============================================================
// Screen 40 · Security Alerts
// Precise, actionable security communication — every alert says
// what happened, what it affects, and what to do next. No fear,
// no noise: severity is calibrated, and resolution is audited.
// ============================================================

const SEVERITY_META: Record<
  SecurityAlert["severity"],
  { icon: React.ElementType; chip: string; iconCls: string; ring: string }
> = {
  Info: { icon: Info, chip: "border-blue-200 bg-blue-50 text-blue-700", iconCls: "text-blue-600", ring: "" },
  Warning: { icon: TriangleAlert, chip: "border-amber-200 bg-amber-50 text-amber-700", iconCls: "text-amber-600", ring: "" },
  High: { icon: ShieldAlert, chip: "border-red-200 bg-red-50 text-red-700", iconCls: "text-red-600", ring: "border-l-4 border-l-red-500" },
  Critical: { icon: OctagonAlert, chip: "border-red-300 bg-red-100 text-red-800", iconCls: "text-red-700", ring: "border-l-4 border-l-red-600" },
};

export function SecurityAlertsScreen() {
  const { role, can } = useRole();
  const { navigate } = useQubitNav();
  const { toast } = useToast();

  const [alerts, setAlerts] = React.useState<SecurityAlert[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [severity, setSeverity] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [detail, setDetail] = React.useState<SecurityAlert | null>(null);
  const [resolveTarget, setResolveTarget] = React.useState<SecurityAlert | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const isAdmin = can("security.admin");

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      const res = await apiGet<{ alerts: SecurityAlert[] }>("/alerts", undefined, isAdmin ? "administrator" : role);
      setAlerts(res.alerts);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unable to load security alerts.");
    }
  }, [isAdmin, role]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = (alerts ?? []).filter(
    (a) => (severity === "all" || a.severity === severity) && (status === "all" || a.status === status),
  );

  const counts = {
    new: (alerts ?? []).filter((a) => a.status === "New").length,
    high: (alerts ?? []).filter((a) => (a.severity === "High" || a.severity === "Critical") && a.status !== "Resolved").length,
    critical: (alerts ?? []).filter((a) => a.severity === "Critical" && a.status !== "Resolved").length,
    resolved: (alerts ?? []).filter((a) => a.status === "Resolved").length,
  };

  const act = async (alert: SecurityAlert, action: "acknowledge" | "resolve") => {
    setBusyId(alert.id);
    setResolveTarget(null);
    try {
      const res = await apiPost<{ alert: SecurityAlert }>("/alerts", { id: alert.id, action });
      setAlerts((as) => (as ?? []).map((a) => (a.id === alert.id ? res.alert : a)));
      setDetail((d) => (d && d.id === alert.id ? res.alert : d));
      toast({
        title: action === "resolve" ? "Alert resolved" : "Alert acknowledged",
        description: `${alert.title} — the action is recorded in the audit log.`,
      });
    } catch {
      toast({
        title: "Couldn't update the alert",
        description: "The security service didn't confirm the change. The alert keeps its previous status — try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const primaryNav = (alert: SecurityAlert) => {
    switch (alert.primaryAction.kind) {
      case "review-session":
        navigate("device-sessions");
        break;
      case "password":
        navigate("password-recovery");
        break;
      case "audit":
        navigate("audit-log", { correlationId: alert.correlationId });
        break;
      case "policy":
        navigate("ip-network-policy");
        break;
    }
  };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Security" }, { label: "Monitoring" }]}
        title="Security Alerts"
        description="What needs your attention and why — each alert carries the affected account, the recommended action and an audit reference. Severity is calibrated, never inflated."
        meta={
          <p className="text-xs text-muted-foreground">
            Alerts are generated by authentication, session, policy and access events. Resolving one records who decided, and when.
          </p>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<CircleAlert />} value={String(counts.new)} label="New alerts" />
        <StatTile icon={<OctagonAlert />} value={String(counts.critical)} label="Critical, unresolved" />
        <StatTile icon={<ShieldAlert />} value={String(counts.high)} label="High or critical" />
        <StatTile icon={<ShieldCheck />} value={String(counts.resolved)} label="Resolved" />
      </div>

      <div className="mb-3 mt-4 flex flex-wrap items-center gap-2">
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-9 w-[150px] rounded-lg bg-white" aria-label="Filter by severity">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Warning">Warning</SelectItem>
            <SelectItem value="Info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[150px] rounded-lg bg-white" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="New">New</SelectItem>
            <SelectItem value="Acknowledged">Acknowledged</SelectItem>
            <SelectItem value="Resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        {(severity !== "all" || status !== "all") && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setSeverity("all"); setStatus("all"); }}>
            Clear filters
          </Button>
        )}
        <p className="ml-auto hidden text-xs tabular-nums text-muted-foreground lg:block" aria-live="polite">
          {alerts === null ? "Loading…" : `${filtered.length} ${filtered.length === 1 ? "alert" : "alerts"}`}
        </p>
      </div>

      {/* Alert list */}
      {loadError ? (
        <div className="qubit-card">
          <EmptyState
            icon={<ShieldAlert />}
            title="Unable to load alerts"
            message={`${loadError} Alerts weren't changed — retry to load them again.`}
            action={
              <Button size="sm" className="h-8" onClick={() => void load()}>
                Try again
              </Button>
            }
          />
        </div>
      ) : alerts === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="qubit-card p-4">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="mt-2 h-3 w-full max-w-lg" />
              <Skeleton className="mt-1.5 h-3 w-40" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="qubit-card">
          <EmptyState
            icon={<BellOff />}
            title="No alerts match your filters"
            message={status === "all" && severity === "all" ? "Nothing needs attention right now — new security events will appear here." : "Try a different severity or status filter."}
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => {
            const meta = SEVERITY_META[a.severity];
            const Icon = meta.icon;
            return (
              <li key={a.id}>
                <div
                  className={cn(
                    "qubit-card qubit-card-hover border-l-4 p-4 md:p-5",
                    a.severity === "Critical" ? "border-l-red-600" : a.severity === "High" ? "border-l-red-400" : a.severity === "Warning" ? "border-l-amber-400" : "border-l-blue-300",
                  )}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <span className={cn("qubit-icon-tile h-9 w-9 shrink-0 rounded-lg [&_svg]:h-4 [&_svg]:w-4", meta.chip)}>
                      <Icon />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13.5px] font-semibold text-slate-900">{a.title}</p>
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold", meta.chip)}>
                          {a.severity}
                        </span>
                        <StatusBadge status={a.status} size="sm" />
                        {a.scope === "organization" && isAdmin && (
                          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-medium text-slate-500">
                            Organization
                          </span>
                        )}
                      </div>
                      <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-slate-600">{a.explanation}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden />
                          {a.time}
                        </span>
                        <span>{a.account}</span>
                        <span>{a.resource}</span>
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Link2 className="h-3 w-3" aria-hidden />
                          {a.correlationId}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    <p className="mr-auto max-w-md text-[11.5px] leading-relaxed text-slate-500">
                      <span className="font-semibold text-slate-700">Recommended:</span> {a.recommendedAction}
                    </p>
                    <Button size="sm" className="h-8" onClick={() => primaryNav(a)}>
                      {a.primaryAction.label}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setDetail(a)}>
                      Review
                    </Button>
                    {a.status === "New" && (
                      <Button size="sm" variant="ghost" className="h-8" disabled={busyId === a.id} onClick={() => void act(a, "acknowledge")}>
                        {busyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                        Acknowledge
                      </Button>
                    )}
                    {a.status !== "Resolved" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-emerald-700 hover:text-emerald-800"
                        disabled={busyId === a.id}
                        onClick={() => setResolveTarget(a)}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Detail drawer */}
      <DetailDrawer
        open={detail !== null}
        onOpenChange={(o) => !o && setDetail(null)}
        title={
          <span className="flex items-center gap-2">
            {detail?.title}
            {detail && <StatusBadge status={detail.status} size="sm" />}
          </span>
        }
        subtitle={detail ? `${detail.severity} · ${detail.time}` : undefined}
        icon={detail ? React.createElement(SEVERITY_META[detail.severity].icon) : undefined}
        footer={
          detail && detail.status !== "Resolved" ? (
            <div className="flex flex-wrap gap-2">
              {detail.status === "New" && (
                <Button size="sm" variant="outline" className="h-8" onClick={() => detail && void act(detail, "acknowledge")}>
                  Acknowledge
                </Button>
              )}
              <Button size="sm" className="h-8" onClick={() => detail && (setResolveTarget(detail), setDetail(null))}>
                Resolve alert
              </Button>
            </div>
          ) : undefined
        }
      >
        {detail && (
          <>
            <dl className="divide-y">
              <KV label="Severity">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold", SEVERITY_META[detail.severity].chip)}>
                  {detail.severity}
                </span>
              </KV>
              <KV label="Status">
                <StatusBadge status={detail.status} size="sm" />
              </KV>
              <KV label="Account">{detail.account}</KV>
              <KV label="Resource">{detail.resource}</KV>
              <KV label="Raised">{detail.time}</KV>
              <KV label="Audit reference">
                <code className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[12px]">{detail.correlationId}</code>
              </KV>
            </dl>

            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">What happened</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-700">{detail.explanation}</p>
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Recommended action</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-700">{detail.recommendedAction}</p>
            </div>

            <Button size="sm" className="mt-4 h-8" onClick={() => primaryNav(detail)}>
              {detail.primaryAction.label}
            </Button>

            <div className="mt-4 flex items-start gap-1.5 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-blue-600" aria-hidden />
              Acknowledging or resolving an alert records the decision in the audit log — including who decided and when.
            </div>
          </>
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={resolveTarget !== null}
        onOpenChange={(o) => !o && setResolveTarget(null)}
        title="Resolve this alert?"
        description={
          resolveTarget
            ? `"${resolveTarget.title}" will be marked Resolved. Only resolve when the recommended action is complete — the decision is recorded in the audit log.`
            : ""
        }
        confirmLabel="Resolve alert"
        onConfirm={() => resolveTarget && void act(resolveTarget, "resolve")}
      />
    </div>
  );
}
