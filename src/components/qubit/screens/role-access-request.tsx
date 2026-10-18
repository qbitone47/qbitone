"use client";

import * as React from "react";
import { CalendarClock, CircleAlert, Clock, Info, Loader2, ShieldCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { apiGet, apiPost } from "@/lib/qubit/api";
import { departments } from "@/lib/qubit/data";
import {
  REQUESTABLE_ROLES,
  type AccessRequest,
} from "@/lib/qubit/security-data";
import { useRole, VIEW_AS_ROLES } from "../role-context";
import { PageHeader } from "../page-header";
import { DataTable, type Column } from "../data-table";
import { EmptyState, KV, SectionCard, StatusBadge } from "../primitives";
import { ConfirmDialog, StepUpDialog } from "../dialogs";
import { DetailDrawer } from "../drawers";

// ============================================================
// Screen 37 · Role Access Request
// Request access you are authorized to request. Grants are
// NEVER self-service: the server evaluates the request, the
// approval follows the reporting line, and everything is
// audited — including the decision to reject.
// ============================================================

export function RoleAccessRequestScreen() {
  const { role } = useRole();
  const { toast } = useToast();

  const roleInfo = VIEW_AS_ROLES.find((r) => r.id === role)!;

  // Current access summary (role-aware)
  const currentAccess: Record<string, { title: string; department: string; scope: string; permissions: string[] }> = {
    administrator: {
      title: "Administrator",
      department: "Executive",
      scope: "Full governance access across Qubit One",
      permissions: ["Manage users & roles", "Edit permission matrix", "Manage security policies", "Export audit records"],
    },
    "dept-head": {
      title: "Department Head",
      department: "Own department",
      scope: "Full department access, cross-module view",
      permissions: ["Approve within department", "Edit workflows", "View shared reports"],
    },
    "hr-manager": {
      title: "HR Manager",
      department: "HR & People",
      scope: "People operations access",
      permissions: ["View employee records", "Initiate lifecycle moves", "Manage notification rules"],
    },
    "sales-exec": {
      title: "Sales Executive",
      department: "Sales",
      scope: "Field sales access only",
      permissions: ["Manage own pipeline", "Create quotations"],
    },
    employee: {
      title: "Employee",
      department: "Self-service",
      scope: "Read-only self-service",
      permissions: ["View own records", "Submit requests"],
    },
  };
  const current = currentAccess[role] ?? currentAccess.employee;

  // New request state
  const [roleId, setRoleId] = React.useState<string>("");
  const [justification, setJustification] = React.useState("");
  const [duration, setDuration] = React.useState("30 days");
  const [submitting, setSubmitting] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [stepUpOpen, setStepUpOpen] = React.useState(false);

  // Requests list
  const [requests, setRequests] = React.useState<AccessRequest[] | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [detail, setDetail] = React.useState<AccessRequest | null>(null);
  const [withdrawTarget, setWithdrawTarget] = React.useState<AccessRequest | null>(null);

  const load = React.useCallback(async () => {
    setLoadError(false);
    try {
      const res = await apiGet<{ requests: AccessRequest[] }>("/access-requests");
      setRequests(res.requests);
    } catch {
      setLoadError(true);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const selectedRole = REQUESTABLE_ROLES.find((r) => r.id === roleId);
  const approvalPath = selectedRole
    ? ["You (requester)", `${selectedRole.approver} — ${selectedRole.approverTitle}`, ...(selectedRole.risk === "High" ? ["Security review (high risk)"] : [])]
    : [];

  const beginSubmit = () => {
    setFieldError(null);
    if (!selectedRole) {
      setFieldError("Select the role you're requesting.");
      return;
    }
    if (justification.trim().length < 30) {
      setFieldError("Add a business justification of at least 30 characters — approvers rely on it.");
      return;
    }
    if (selectedRole.risk === "High") {
      setStepUpOpen(true);
      return;
    }
    void doSubmit();
  };

  const doSubmit = async () => {
    setStepUpOpen(false);
    setSubmitting(true);
    try {
      const res = await apiPost<{ request: AccessRequest }>("/access-requests", { roleId, justification, duration });
      setRequests((rs) => [res.request, ...(rs ?? [])]);
      setJustification("");
      setRoleId("");
      toast({
        title: "Access request submitted",
        description: `${res.request.requestedRole} is now pending approval. You cannot grant yourself access — the approver decides.`,
      });
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "The request couldn't be submitted. Nothing was recorded — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async (req: AccessRequest) => {
    setWithdrawTarget(null);
    setRequests((rs) => (rs ?? []).map((r) => (r.id === req.id ? { ...r, status: "Revoked" } : r)));
    toast({ title: "Request withdrawn", description: `${req.requestedRole} request was withdrawn before a decision.` });
  };

  const columns: Column<AccessRequest>[] = [
    {
      key: "role",
      header: "Requested role",
      sortable: true,
      sortValue: (r) => r.requestedRole,
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-slate-800">{r.requestedRole}</p>
          <p className="truncate text-[11px] text-muted-foreground">{r.duration}</p>
        </div>
      ),
    },
    { key: "submitted", header: "Submitted", sortable: true, sortValue: (r) => r.submitted, hideBelow: "md", render: (r) => <span className="text-[13px] tabular-nums text-slate-600">{r.submitted}</span> },
    { key: "approver", header: "Approver", hideBelow: "lg", render: (r) => <span className="text-[13px] text-slate-600">{r.approver}</span> },
    {
      key: "risk",
      header: "Risk",
      hideBelow: "lg",
      render: (r) => (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[12px] font-medium",
            r.risk === "High" ? "text-red-600" : r.risk === "Medium" ? "text-amber-600" : "text-slate-500",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", r.risk === "High" ? "bg-red-500" : r.risk === "Medium" ? "bg-amber-500" : "bg-slate-400")} aria-hidden />
          {r.risk}
        </span>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} size="sm" /> },
  ];

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Security" }, { label: "Access" }]}
        title="Role Access Request"
        description="Request additional access for a business need. Requests are evaluated server-side, approved along the reporting line, and expire automatically — access is never self-granted."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" aria-hidden />
            Approval path: manager → role owner → security (high risk)
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Left: current access + new request */}
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Your current access" description={`Signed in as ${roleInfo.label} — previewing the ${roleInfo.label} boundary.`}>
            <dl className="divide-y">
              <KV label="Role">{current.title}</KV>
              <KV label="Department">{current.department}</KV>
              <KV label="Scope">{current.scope}</KV>
            </dl>
            <p className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Key permissions</p>
            <div className="flex flex-wrap gap-1.5">
              {current.permissions.map((p) => (
                <span key={p} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                  {p}
                </span>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="New request" description="Approvers see your justification exactly as you write it.">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Requested role</Label>
                <Select value={roleId} onValueChange={(v) => { setRoleId(v); setFieldError(null); }}>
                  <SelectTrigger className="h-9 rounded-lg" aria-label="Requested role">
                    <SelectValue placeholder="Choose a role…" />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUESTABLE_ROLES.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        <span className="flex items-center gap-2">
                          {r.name}
                          <span className="text-[10px] font-medium text-slate-400">
                            {r.risk === "High" ? "High risk" : r.risk === "Medium" ? "Medium" : "Low"}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRole && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">This role would add</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {selectedRole.permissions.map((p) => (
                        <span key={p} className="rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                          {p}
                        </span>
                      ))}
                    </div>
                    {selectedRole.risk === "High" && (
                      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-700">
                        <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                        High-risk grant — requires step-up authentication and security review before approval.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="justification" className="text-xs font-medium text-slate-700">
                    Business justification
                  </Label>
                  <span className={cn("text-[10.5px] tabular-nums", justification.trim().length >= 30 ? "text-emerald-600" : "text-slate-400")}>
                    {justification.trim().length}/30 min
                  </span>
                </div>
                <textarea
                  id="justification"
                  value={justification}
                  onChange={(e) => {
                    setJustification(e.target.value);
                    if (fieldError) setFieldError(null);
                  }}
                  rows={4}
                  placeholder="Why is this access needed, for how long, and what business outcome does it serve?"
                  aria-invalid={Boolean(fieldError)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors placeholder:text-slate-400 focus:border-blue-300"
                />
                <p className="text-[11px] text-muted-foreground">
                  The server rejects requests without a real justification — approval quality depends on it.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="h-9 rounded-lg" aria-label="Grant duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7 days">7 days — audit window</SelectItem>
                    <SelectItem value="30 days">30 days — auto-expires</SelectItem>
                    <SelectItem value="90 days">90 days — with review date</SelectItem>
                  </SelectContent>
                </Select>
                <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarClock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  Time-bound grants expire automatically; extensions need a fresh request.
                </p>
              </div>

              {selectedRole && approvalPath.length > 0 && (
                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Approval path</p>
                  <ol className="mt-2 space-y-1.5">
                    {approvalPath.map((step, i) => (
                      <li key={step} className="flex items-center gap-2 text-[12px] text-slate-600">
                        <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold", i === approvalPath.length - 1 && selectedRole.risk === "High" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500")}>
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {fieldError && (
                <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {fieldError}
                </div>
              )}

              <Button onClick={beginSubmit} disabled={submitting} className="h-9 w-full rounded-lg text-sm">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Submitting…
                  </>
                ) : (
                  "Submit request"
                )}
              </Button>
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
                <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                Submitting creates a Pending Approval record only. You cannot grant yourself access, and every step — request,
                decision, expiry — is audited.
              </p>
            </div>
          </SectionCard>
        </div>

        {/* Right: my requests */}
        <div className="lg:col-span-3">
          <SectionCard
            title="My requests"
            description="Every request you've made, with its decision and expiry."
            noPadding
          >
            {requests === null && !loadError ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-lg" />
                ))}
              </div>
            ) : loadError ? (
              <EmptyState
                icon={<CircleAlert />}
                title="Unable to load your requests"
                message="The access service didn't respond. Nothing was changed — check your connection and retry."
                action={
                  <Button size="sm" className="h-8" onClick={() => void load()}>
                    Try again
                  </Button>
                }
              />
            ) : (requests ?? []).length === 0 ? (
              <EmptyState
                icon={<ShieldCheck />}
                title="No access requests yet"
                message="When you need additional access for a business need, submit it here — approvals usually complete within 2 days."
              />
            ) : (
              <DataTable
                columns={columns}
                rows={requests ?? []}
                rowKey={(r) => r.id}
                onRowClick={(r) => setDetail(r)}
                pageSize={6}
                emptyTitle="No requests"
                caption="Your role access requests"
                mobileCard={(r) => (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-slate-800">{r.requestedRole}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {r.submitted} · {r.approver}
                      </p>
                    </div>
                    <StatusBadge status={r.status} size="sm" />
                  </div>
                )}
              />
            )}
          </SectionCard>
        </div>
      </div>

      {/* Request detail drawer */}
      <DetailDrawer
        open={detail !== null}
        onOpenChange={(o) => !o && setDetail(null)}
        title={
          <span className="flex items-center gap-2">
            {detail?.requestedRole}
            {detail && <StatusBadge status={detail.status} size="sm" />}
          </span>
        }
        subtitle={detail ? `${detail.duration} · submitted ${detail.submitted}` : undefined}
        icon={<ShieldCheck />}
        footer={
          detail && (detail.status === "Pending Approval" || detail.status === "Submitted") ? (
            <Button size="sm" variant="outline" className="h-8" onClick={() => setWithdrawTarget(detail)}>
              <Undo2 className="h-3.5 w-3.5" aria-hidden />
              Withdraw request
            </Button>
          ) : undefined
        }
      >
        {detail && (
          <>
            <dl className="divide-y">
              <KV label="Status">
                <StatusBadge status={detail.status} size="sm" />
              </KV>
              <KV label="Risk">
                <span className={cn("font-medium", detail.risk === "High" ? "text-red-600" : detail.risk === "Medium" ? "text-amber-600" : "text-slate-600")}>
                  {detail.risk}
                </span>
              </KV>
              <KV label="Approver">
                {detail.approver} — {detail.approverTitle}
              </KV>
              {detail.reviewBy && (
                <KV label="Review by">{detail.reviewBy}</KV>
              )}
              {detail.decidedBy && (
                <KV label="Decided by">
                  {detail.decidedBy} · {detail.decidedOn}
                </KV>
              )}
            </dl>

            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Justification</p>
              <p className="mt-1.5 rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-[12.5px] leading-relaxed text-slate-700">
                {detail.justification}
              </p>
            </div>

            {detail.decisionNote && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Decision note</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-700">{detail.decisionNote}</p>
              </div>
            )}

            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Approval path</p>
              <ol className="mt-2 space-y-1.5">
                {detail.approvalPath.map((step, i) => (
                  <li key={step} className="flex items-center gap-2 text-[12px] text-slate-600">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-4 flex items-start gap-1.5 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
              <Clock className="mt-0.5 h-3 w-3 shrink-0 text-blue-600" aria-hidden />
              This request and its decision are recorded in the audit log with correlation IDs for both the request and the approval.
            </div>
          </>
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={withdrawTarget !== null}
        onOpenChange={(o) => !o && setWithdrawTarget(null)}
        title="Withdraw this request?"
        description={withdrawTarget ? `The ${withdrawTarget.requestedRole} request will be withdrawn and marked Revoked. Approvers will see that you withdrew it.` : ""}
        confirmLabel="Withdraw request"
        onConfirm={() => withdrawTarget && void withdraw(withdrawTarget)}
      />

      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        title="Confirm high-risk access request"
        description="This grant is privileged (admin-level access). Confirm your password to submit it for security review."
        confirmLabel="Submit for review"
        verifying={submitting}
        onConfirm={() => void doSubmit()}
      />

      {/* Department context for realistic depth */}
      <p className="mt-4 text-[11px] text-slate-400">
        Roles and approvers follow the organization's Approval Matrix across {departments.length} departments — changes there
        flow into this screen automatically.
      </p>
    </div>
  );
}
