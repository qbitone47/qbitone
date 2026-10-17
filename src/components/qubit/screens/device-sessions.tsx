"use client";

import * as React from "react";
import { Laptop, Loader2, MapPin, Monitor, RefreshCw, ShieldAlert, ShieldCheck, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiGet, apiPost } from "@/lib/qubit/api";
import type { UserSession } from "@/lib/qubit/security-data";
import { PageHeader } from "../page-header";
import { DataTable, type Column } from "../data-table";
import { EmptyState, KV, SearchInput, StatusBadge } from "../primitives";
import { ConfirmDialog, StepUpDialog } from "../dialogs";
import { DetailDrawer } from "../drawers";

// ============================================================
// Screen 35 · Device Sessions
// Understand and control every active session. Revocation is
// enforced server-side; approximate location only — precise
// location is never exposed.
// ============================================================

const DEVICE_ICON: Record<UserSession["deviceKind"], React.ElementType> = {
  laptop: Laptop,
  phone: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

export function DeviceSessionsScreen() {
  const { toast } = useToast();

  const [sessions, setSessions] = React.useState<UserSession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [detail, setDetail] = React.useState<UserSession | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<UserSession | null>(null);
  const [revokeAllOpen, setRevokeAllOpen] = React.useState(false);
  const [stepUpOpen, setStepUpOpen] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ sessions: UserSession[] }>("/sessions");
      setSessions(res.sessions);
    } catch {
      setError("We couldn't load your sessions. Nothing was changed — check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const current = sessions.find((s) => s.current);
  const others = sessions.filter((s) => !s.current && (s.status === "Active" || s.status === "Suspicious"));

  const q = query.trim().toLowerCase();
  const filtered = sessions.filter((s) =>
    q ? `${s.device} ${s.browser} ${s.os} ${s.location} ${s.status}`.toLowerCase().includes(q) : true,
  );

  const revokeSession = async (session: UserSession) => {
    setBusyId(session.id);
    setRevokeTarget(null);
    try {
      await apiPost("/sessions", { sessionId: session.id });
      setSessions((ss) =>
        ss.map((s) => (s.id === session.id ? { ...s, status: "Revoked", lastActive: "Just now", note: "Signed out by you just now" } : s)),
      );
      toast({
        title: "Session signed out",
        description: `${session.device} (${session.location}) can no longer access your account.`,
      });
      setDetail((d) => (d && d.id === session.id ? { ...d, status: "Revoked" } : d));
    } catch {
      toast({
        title: "Couldn't sign out the session",
        description: "The security service didn't confirm the revocation. The session may still be active — try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const revokeAllOthers = () => {
    setStepUpOpen(true);
  };

  const confirmRevokeAll = () => {
    setVerifying(true);
    window.setTimeout(async () => {
      setVerifying(false);
      setStepUpOpen(false);
      setRevokeAllOpen(false);
      try {
        const res = await apiPost<{ revoked: number }>("/sessions", { all: true });
        setSessions((ss) =>
          ss.map((s) =>
            !s.current && (s.status === "Active" || s.status === "Suspicious")
              ? { ...s, status: "Revoked", lastActive: "Just now", note: "Signed out everywhere just now" }
              : s,
          ),
        );
        toast({
          title: `Signed out ${res.revoked} ${res.revoked === 1 ? "session" : "sessions"}`,
          description: "Every other device must sign in again. This action is recorded in the audit log.",
        });
      } catch {
        toast({
          title: "Sign out everywhere failed",
          description: "The security service didn't confirm the revocation. Your sessions were not changed — try again.",
          variant: "destructive",
        });
      }
    }, 1000);
  };

  const columns: Column<UserSession>[] = [
    {
      key: "device",
      header: "Device",
      sortable: true,
      sortValue: (s) => s.device,
      render: (s) => {
        const Icon = DEVICE_ICON[s.deviceKind];
        return (
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "qubit-icon-tile h-8 w-8 rounded-lg [&_svg]:h-4 [&_svg]:w-4",
                s.status === "Suspicious" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600",
              )}
            >
              <Icon />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800">
                <span className="truncate">{s.device}</span>
                {s.current && <span className="shrink-0 rounded bg-blue-50 px-1.5 py-px text-[10px] font-semibold text-blue-700">This device</span>}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {s.browser} · {s.os}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "location",
      header: "Location",
      hideBelow: "md",
      render: (s) => (
        <div>
          <p className="text-[13px] text-slate-700">{s.location}</p>
          <p className="text-[11px] tabular-nums text-slate-400">{s.ipMasked}</p>
        </div>
      ),
    },
    {
      key: "lastActive",
      header: "Last active",
      sortable: true,
      sortValue: (s) => s.lastActive,
      render: (s) => (
        <div>
          <p className={cn("text-[13px]", s.status === "Active" && !s.current ? "text-slate-700" : "text-slate-600")}>{s.lastActive}</p>
          <p className="text-[11px] text-slate-400">Started {s.started}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (s) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={s.status} size="sm" />
          {s.trusted && s.status === "Active" && (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-600">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              Trusted
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-10",
      render: (s) =>
        s.status === "Active" || s.status === "Suspicious" ? (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-7 px-2 text-xs", s.status === "Suspicious" ? "font-semibold text-red-600 hover:text-red-700" : "text-slate-500")}
              disabled={busyId === s.id}
              onClick={(e) => {
                e.stopPropagation();
                setRevokeTarget(s);
              }}
            >
              {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Sign out
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Security" }, { label: "Account" }]}
        title="Device Sessions"
        description="Every device signed in to your account. Sign out anything you don't recognize — sessions stay valid until you revoke them."
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setRevokeAllOpen(true)}
              disabled={loading || others.length === 0}
            >
              Sign out all other sessions
            </Button>
          </>
        }
      />

      {/* Current session */}
      {loading ? (
        <div className="qubit-card p-4 md:p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      ) : current ? (
        <div className="qubit-card qubit-card-hover flex flex-col gap-3 p-4 md:flex-row md:items-center md:p-5">
          <span className="qubit-icon-tile qubit-icon-tile-accent h-10 w-10 shrink-0">
            <Laptop />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
              {current.device}
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Current session</span>
              <StatusBadge status={current.status} size="sm" />
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {current.browser} · {current.os} · {current.location} · {current.ipMasked}
            </p>
          </div>
          <p className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
            {current.lastActive}
          </p>
        </div>
      ) : null}

      {/* Sessions table */}
      <div className="mt-4">
        {error ? (
          <div className="qubit-card">
            <EmptyState
              icon={<ShieldAlert />}
              title="Unable to load sessions"
              message={error}
              action={
                <Button size="sm" className="h-8" onClick={() => void load()}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {loading
                  ? "Loading sessions…"
                  : `${others.filter((s) => s.status === "Active" || s.status === "Suspicious").length} other active ${
                      others.length === 1 ? "session" : "sessions"
                    } · locations are approximate`}
              </p>
              <SearchInput value={query} onChange={setQuery} placeholder="Search devices…" className="w-full sm:w-64" ariaLabel="Search sessions" />
            </div>
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(s) => s.id}
              onRowClick={(s) => setDetail(s)}
              pageSize={8}
              emptyTitle="No sessions match your search"
              emptyMessage="Try a different device name, browser or location."
              caption="Active device sessions"
              rowClassName={(s) => (s.status === "Suspicious" ? "bg-red-50/40 hover:bg-red-50/60" : "")}
              mobileCard={(s) => (
                <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setDetail(s)}>
                  {(() => {
                    const Icon = DEVICE_ICON[s.deviceKind];
                    return (
                      <span
                        className={cn(
                          "qubit-icon-tile h-9 w-9 rounded-lg [&_svg]:h-4 [&_svg]:w-4",
                          s.status === "Suspicious" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600",
                        )}
                      >
                        <Icon />
                      </span>
                    );
                  })()}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13px] font-medium text-slate-800">{s.device}</span>
                      <StatusBadge status={s.status} size="sm" />
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {s.browser} · {s.os} · {s.location}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{s.lastActive}</span>
                  </span>
                </button>
              )}
            />
          </>
        )}
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
        <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        Locations are approximate, derived from network ranges — Qubit One never tracks precise device location.
        Session sign-outs and suspicious flags are recorded in the audit log.
      </p>

      {/* Investigate drawer */}
      <DetailDrawer
        open={detail !== null}
        onOpenChange={(o) => !o && setDetail(null)}
        title={
          <span className="flex items-center gap-2">
            {detail?.device}
            {detail && <StatusBadge status={detail.status} size="sm" />}
          </span>
        }
        subtitle={detail ? `${detail.browser} · ${detail.os}` : undefined}
        icon={detail ? React.createElement(DEVICE_ICON[detail.deviceKind]) : undefined}
        footer={
          detail && (detail.status === "Active" || detail.status === "Suspicious") && !detail.current ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="destructive" className="h-8" onClick={() => setRevokeTarget(detail)}>
                Sign out session
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => {
                  setDetail(null);
                  toast({ title: "Flagged for review", description: "IT security will take a closer look at this session." });
                }}
              >
                Report as not me
              </Button>
            </div>
          ) : undefined
        }
      >
        {detail && (
          <>
            {detail.status === "Suspicious" && (
              <div role="alert" className="mb-4 flex gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                <p className="text-xs leading-relaxed text-red-800">
                  <span className="font-semibold">Flagged as suspicious.</span> {detail.note ?? "This device isn't recognized."} If
                  this wasn't you, sign it out and change your password.
                </p>
              </div>
            )}
            <dl className="divide-y">
              <KV label="Location">{detail.location}</KV>
              <KV label="Network">{detail.ipMasked}</KV>
              <KV label="Started">{detail.started}</KV>
              <KV label="Last active">{detail.lastActive}</KV>
              <KV label="Status">
                <StatusBadge status={detail.status} size="sm" />
              </KV>
              <KV label="Trusted">{detail.trusted ? "Yes — remembered for this device" : "No — verification required on new activity"}</KV>
              {detail.note && <KV label="Note">{detail.note}</KV>}
            </dl>
            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Recent activity in this session</p>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                <li>Read Organization Structure · 12 min ago</li>
                <li>Opened Employee Lifecycle · 41 min ago</li>
                <li>Signed in · {detail.started}</li>
              </ul>
            </div>
          </>
        )}
      </DetailDrawer>

      {/* Single revoke */}
      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title="Sign out this session?"
        description={
          revokeTarget
            ? `${revokeTarget.device} (${revokeTarget.location}) will be signed out immediately and must sign in again to access your account.`
            : ""
        }
        confirmLabel="Sign out session"
        destructive
        onConfirm={() => revokeTarget && void revokeSession(revokeTarget)}
      />

      {/* Revoke all — step-up first */}
      <ConfirmDialog
        open={revokeAllOpen && !stepUpOpen}
        onOpenChange={(o) => !o && setRevokeAllOpen(false)}
        title="Sign out all other sessions?"
        description={
          <>
            Every device except this one will be signed out — including {others.length} active{" "}
            {others.length === 1 ? "session" : "sessions"}. You'll stay signed in here. This is a sensitive security action and
            is recorded in the audit log.
          </>
        }
        confirmLabel="Continue"
        onConfirm={() => setStepUpOpen(true)}
      />
      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        title="Confirm sign out everywhere"
        description="Confirm your password to sign out every other device. Step-up authentication keeps this action yours alone."
        confirmLabel="Sign out all"
        verifying={verifying}
        onConfirm={confirmRevokeAll}
      />
    </div>
  );
}
