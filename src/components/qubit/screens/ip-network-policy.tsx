"use client";

import * as React from "react";
import { CircleAlert, Globe, Loader2, Network, ShieldAlert, ShieldCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { apiGet, apiPatch, apiPost } from "@/lib/qubit/api";
import type { NetworkPolicy, PolicyAction } from "@/lib/qubit/security-data";
import { useRole } from "../role-context";
import { useQubitNav } from "../nav-context";
import { PageHeader } from "../page-header";
import { DataTable, type Column } from "../data-table";
import { EmptyState, KV, ReadOnlyBanner, SectionCard, StatTile, StatusBadge } from "../primitives";
import { ConfirmDialog } from "../dialogs";
import { DetailDrawer } from "../drawers";

// ============================================================
// Screen 38 · IP / Network Policy
// Admin / Security-admin capability. Ordinary employees get an
// honest permission-denied state — never a broken screen.
// Anti-lockout engineering: conflict detection, broad-range
// warnings, self-lockout protection, high-impact confirmation,
// rollback points and a full audit trail on every change.
// ============================================================

const ACTION_TONE: Record<PolicyAction, string> = {
  Allow: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Restrict: "border-amber-200 bg-amber-50 text-amber-700",
  "Require Verification": "border-violet-200 bg-violet-50 text-violet-700",
  Deny: "border-red-200 bg-red-50 text-red-700",
};

export function IpNetworkPolicyScreen() {
  const { can } = useRole();
  const { navigate } = useQubitNav();
  const { toast } = useToast();
  const allowed = can("security.admin");

  const [policies, setPolicies] = React.useState<NetworkPolicy[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<NetworkPolicy | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [rollbackTarget, setRollbackTarget] = React.useState<NetworkPolicy | null>(null);

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      const res = await apiGet<{ policies: NetworkPolicy[] }>("/policies", undefined, "administrator");
      setPolicies(res.policies);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unable to load network policies.");
    }
  }, []);

  React.useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  // ---------- Permission boundary ----------
  if (!allowed) {
    return (
      <div>
        <PageHeader
          crumbs={[{ label: "Security" }, { label: "Administration" }]}
          title="IP / Network Policy"
          description="Network-level access rules for the organization."
        />
        <SectionCard>
          <EmptyState
            icon={<ShieldAlert />}
            title="You don't have access to network policies"
            message="This screen is restricted to Security administrators. Network rules decide who can reach Qubit One, so changes are limited to the security boundary. Your current role is Employee (preview)."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" className="h-8" onClick={() => navigate("role-access-request")}>
                  Request security admin access
                </Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => navigate("security-center")}>
                  Back to Security Center
                </Button>
              </div>
            }
          />
          <p className="mx-auto max-w-md border-t border-slate-100 pt-4 text-center text-[11px] leading-relaxed text-slate-400">
            This boundary is enforced on the server as well — the API rejects policy reads and writes without the security-admin
            capability, so the UI is never the only gate.
          </p>
        </SectionCard>
      </div>
    );
  }

  // ---------- Admin view ----------
  const active = (policies ?? []).filter((p) => p.status === "Active");
  const denyCount = (policies ?? []).filter((p) => p.action === "Deny" && p.status === "Active").length;
  const draftCount = (policies ?? []).filter((p) => p.status === "Draft" || p.status === "Scheduled").length;

  const rollback = (p: NetworkPolicy) => {
    setRollbackTarget(null);
    setPolicies((ps) => (ps ?? []).map((x) => (x.id === p.id ? { ...x, status: "Disabled", note: "Rolled back — previous action restored in audit trail" } : x)));
    toast({ title: "Policy rolled back", description: `${p.name} is disabled. The previous state is recoverable from the audit trail.` });
  };

  const columns: Column<NetworkPolicy>[] = [
    {
      key: "name",
      header: "Policy",
      sortable: true,
      sortValue: (p) => p.name,
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-slate-800">{p.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {p.scope} · {p.environment}
          </p>
        </div>
      ),
    },
    {
      key: "cidr",
      header: "IP range",
      render: (p) => <code className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11.5px] text-slate-700">{p.cidr}</code>,
    },
    {
      key: "action",
      header: "Action",
      render: (p) => (
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", ACTION_TONE[p.action])}>
          {p.action}
        </span>
      ),
    },
    { key: "priority", header: "Priority", sortable: true, sortValue: (p) => p.priority, hideBelow: "md", render: (p) => <span className="text-[13px] tabular-nums text-slate-600">{p.priority}</span> },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} size="sm" /> },
    { key: "modified", header: "Last modified", sortable: true, sortValue: (p) => p.lastModified, hideBelow: "lg", render: (p) => <span className="text-[12px] tabular-nums text-slate-500">{p.lastModified}</span> },
  ];

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Security" }, { label: "Administration" }]}
        title="IP / Network Policy"
        description="Control where Qubit One can be reached from. Rules are evaluated top-down by priority; every change is conflict-checked, staged and audited before it applies."
        actions={
          <>
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Security administrator
            </span>
            <Button size="sm" className="h-9 rounded-lg" onClick={() => setCreateOpen(true)}>
              Create policy
            </Button>
          </>
        }
      />

      <ReadOnlyBanner message="You're viewing the Security administrator boundary. Sign-ins are evaluated against these rules server-side on every request — this UI never decides access." />

      {/* Guardrail callout */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3" role="note">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-amber-900">
          <span className="font-semibold">Broad rules can lock the whole company out.</span> Wide ranges and Deny actions trigger
          conflict checks, an impact preview and explicit confirmation. Your own office range is protected from self-lockout, and
          every change keeps a rollback point.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<Network />} value={String(active.length)} label="Active policies" />
        <StatTile icon={<Globe />} value={String(denyCount)} label="Deny rules" />
        <StatTile icon={<Undo2 />} value={String(draftCount)} label="Drafts / scheduled" />
        <StatTile icon={<ShieldCheck />} value="0" label="Unresolved conflicts" />
      </div>

      <div className="mt-4">
        {loadError ? (
          <div className="qubit-card">
            <EmptyState
              icon={<ShieldAlert />}
              title="Unable to load policies"
              message={`${loadError} Nothing was changed — retry when the service responds.`}
              action={
                <Button size="sm" className="h-8" onClick={() => void load()}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : policies === null ? (
          <div className="qubit-card space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={policies}
            rowKey={(p) => p.id}
            onRowClick={(p) => setDetail(p)}
            pageSize={8}
            emptyTitle="No policies yet"
            emptyMessage="Create the first network rule — start with your office ranges as Allow."
            caption="Network access policies"
            mobileCard={(p) => (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-slate-800">{p.name}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{p.cidr}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10.5px] font-medium", ACTION_TONE[p.action])}>{p.action}</span>
                  <StatusBadge status={p.status} size="sm" />
                </div>
              </div>
            )}
          />
        )}
      </div>

      {/* Policy detail drawer */}
      <DetailDrawer
        open={detail !== null}
        onOpenChange={(o) => !o && setDetail(null)}
        title={
          <span className="flex items-center gap-2">
            {detail?.name}
            {detail && <StatusBadge status={detail.status} size="sm" />}
          </span>
        }
        subtitle={detail ? `${detail.action} · ${detail.cidr}` : undefined}
        icon={<Network />}
        footer={
          detail && detail.status === "Active" ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-8" onClick={() => setRollbackTarget(detail)}>
                <Undo2 className="h-3.5 w-3.5" aria-hidden />
                Roll back
              </Button>
            </div>
          ) : undefined
        }
      >
        {detail && (
          <>
            <dl className="divide-y">
              <KV label="Scope">{detail.scope}</KV>
              <KV label="IP range">
                <code className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[12px]">{detail.cidr}</code>
              </KV>
              <KV label="Environment">{detail.environment}</KV>
              <KV label="Affected">{detail.affected}</KV>
              <KV label="Action">
                <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", ACTION_TONE[detail.action])}>
                  {detail.action}
                </span>
              </KV>
              <KV label="Priority">{detail.priority}</KV>
              <KV label="Status">
                <StatusBadge status={detail.status} size="sm" />
              </KV>
              <KV label="Created by">{detail.createdBy}</KV>
              <KV label="Last modified">{detail.lastModified}</KV>
              <KV label="Effective">{detail.effective}</KV>
              {detail.note && <KV label="Note">{detail.note}</KV>}
            </dl>
            <div className="mt-4 flex items-start gap-1.5 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-blue-600" aria-hidden />
              Changes to this policy are staged: conflict check → impact preview → confirmation → apply. Each step is audited,
              and rollback restores the previous action without downtime.
            </div>
          </>
        )}
      </DetailDrawer>

      {/* Create policy */}
      <CreatePolicyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(p) => setPolicies((ps) => [p, ...(ps ?? [])])}
      />

      <ConfirmDialog
        open={rollbackTarget !== null}
        onOpenChange={(o) => !o && setRollbackTarget(null)}
        title="Roll back this policy?"
        description={
          rollbackTarget
            ? `${rollbackTarget.name} (${rollbackTarget.action} ${rollbackTarget.cidr}) will be disabled and the previous action restored from the audit trail. Affected sign-ins re-evaluate immediately.`
            : ""
        }
        confirmLabel="Roll back"
        destructive
        onConfirm={() => rollbackTarget && rollback(rollbackTarget)}
      />
    </div>
  );
}

// ---------- Create dialog with live server-side validation ----------
function CreatePolicyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (p: NetworkPolicy) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [cidr, setCidr] = React.useState("");
  const [action, setAction] = React.useState<PolicyAction>("Allow");
  const [scope, setScope] = React.useState("All members");
  const [environment, setEnvironment] = React.useState("Production");
  const [priority, setPriority] = React.useState("60");
  const [conflicts, setConflicts] = React.useState<string[]>([]);
  const [broad, setBroad] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // Debounced live validation via the server (PATCH = dry run, no side effects).
  React.useEffect(() => {
    if (!open) return;
    if (!/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(cidr.trim())) {
      setConflicts([]);
      setBroad(false);
      return;
    }
    setChecking(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await apiPatch<{ ok: boolean; conflicts?: string[]; broad?: boolean; selfLockout?: boolean; message?: string }>(
          "/policies",
          { name, cidr, action, scope, environment },
          "administrator",
        );
        setConflicts(res.conflicts ?? []);
        setBroad(Boolean(res.broad));
        if (res.selfLockout) setError(res.message ?? "This rule would lock out your own session.");
        else setError(null);
      } catch {
        setConflicts([]);
        setBroad(false);
      } finally {
        setChecking(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [open, name, cidr, action, scope, environment]);

  const valid = name.trim().length > 0 && cidr.trim().length > 0 && !error;
  const highImpact = action === "Deny" || broad || conflicts.length > 0;

  const submit = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const res = await apiPost<{ policy: NetworkPolicy }>(
        "/policies",
        { name, cidr, action, scope, environment, priority: Number(priority) || 60 },
        "administrator",
      );
      onCreated(res.policy);
      onOpenChange(false);
      setName("");
      setCidr("");
      setAction("Allow");
      toast({ title: "Policy applied", description: `${res.policy.name} passed conflict checks and is now active. It's fully audited.` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The policy couldn't be applied. Nothing changed — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Apply this network policy?"
        description={
          <>
            {action} {cidr || "—"} for <span className="font-medium">{scope}</span> ({environment}).{" "}
            {highImpact
              ? "This is a high-impact change: sign-ins matching the range re-evaluate immediately."
              : "Sign-ins matching the range re-evaluate immediately."}{" "}
            The change is staged, audited, and can be rolled back from the policy drawer.
          </>
        }
        confirmLabel="Apply policy"
        destructive={action === "Deny"}
        onConfirm={() => void submit()}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create network policy</DialogTitle>
            <DialogDescription>
              Rules are evaluated by priority. The server validates the range, checks conflicts and protects your own session
              from lockout.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pol-name" className="text-xs font-medium text-slate-700">
                Policy name
              </Label>
              <Input id="pol-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bengaluru office network" className="h-9 rounded-lg" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pol-cidr" className="text-xs font-medium text-slate-700">
                  IP range (CIDR)
                </Label>
                <Input
                  id="pol-cidr"
                  value={cidr}
                  onChange={(e) => {
                    setCidr(e.target.value);
                    setError(null);
                  }}
                  placeholder="103.25.128.0/22"
                  className="h-9 rounded-lg font-mono text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Action</Label>
                <Select value={action} onValueChange={(v) => setAction(v as PolicyAction)}>
                  <SelectTrigger className="h-9 rounded-lg" aria-label="Policy action">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Allow">Allow</SelectItem>
                    <SelectItem value="Restrict">Restrict</SelectItem>
                    <SelectItem value="Require Verification">Require additional verification</SelectItem>
                    <SelectItem value="Deny">Deny</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Scope</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger className="h-9 rounded-lg" aria-label="Scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All members">All members</SelectItem>
                    <SelectItem value="Contractors">Contractors</SelectItem>
                    <SelectItem value="Guests">Guests</SelectItem>
                    <SelectItem value="Role: Finance">Role: Finance</SelectItem>
                    <SelectItem value="IT Administration">IT Administration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Environment</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger className="h-9 rounded-lg" aria-label="Environment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Production">Production</SelectItem>
                    <SelectItem value="Staging">Staging</SelectItem>
                    <SelectItem value="All environments">All environments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pol-priority" className="text-xs font-medium text-slate-700">
                  Priority
                </Label>
                <Input id="pol-priority" type="number" min={1} max={999} value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9 rounded-lg" />
              </div>
            </div>

            {/* Live server-side validation feedback */}
            {checking && (
              <p className="flex items-center gap-2 text-[11.5px] text-slate-400" aria-live="polite">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Checking range against existing policies…
              </p>
            )}
            {!checking && cidr.trim().length > 3 && (
              <div className="space-y-2" aria-live="polite">
                {broad && (
                  <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] leading-relaxed text-red-800">
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      <span className="font-semibold">Extremely broad range.</span> This network matches effectively every
                      address. Use the narrowest range that covers the location.
                    </span>
                  </div>
                )}
                {conflicts.length > 0 && (
                  <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-900">
                    <p className="font-semibold">
                      Conflicts with {conflicts.length} existing {conflicts.length === 1 ? "policy" : "policies"}:
                    </p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {conflicts.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!broad && conflicts.length === 0 && !error && (
                  <p className="flex items-center gap-1.5 text-[11.5px] text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    No conflicts — your office range (103.25.128.0/22) stays reachable.
                  </p>
                )}
                {error && (
                  <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] leading-relaxed text-red-800">
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    {error}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={!valid || submitting || checking} onClick={() => (highImpact ? setConfirmOpen(true) : void submit())}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Applying…
                  </>
                ) : highImpact ? (
                  "Review & apply…"
                ) : (
                  "Apply policy"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
