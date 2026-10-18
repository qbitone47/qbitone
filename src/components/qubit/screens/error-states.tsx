"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileQuestion,
  Info,
  Loader2,
  LogOut,
  RefreshCw,
  Server,
  ShieldAlert,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useQubitNav } from "../nav-context";
import { PageHeader } from "../page-header";
import {
  DSCaption,
  DSGuidance,
  DSExample,
  DSScreenNav,
  DSSection,
  DSStage,
  DSTokenTable,
  DSVar,
} from "../ds/doc";

// ============================================================
// Screen 27 · Error States
// Every error answers two questions: WHAT HAPPENED? + WHAT CAN THE USER DO?
// ============================================================

/** Retry simulation — 1s busy window, then toast + recovered state. Replayable. */
function useRetrySim(description: string) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [ok, setOk] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const retry = () => {
    if (busy) return;
    setBusy(true);
    timer.current = setTimeout(() => {
      setBusy(false);
      setOk(true);
      toast({ title: "Back online (demo)", description });
    }, 1000);
  };
  const reset = () => setOk(false);

  return { busy, ok, retry, reset };
}

/** Shared "Go back" — real in-app history when available. */
function useGoBack() {
  const { back, canBack } = useQubitNav();
  const { toast } = useToast();
  return () => {
    if (canBack) back();
    else toast({ title: "Navigated back (demo)", description: "Returns to the previous screen in the workspace history." });
  };
}

/** Retry button with live 1s spinner window. */
function RetryButton({ busy, onClick, label = "Retry" }: { busy: boolean; onClick: () => void; label?: string }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={busy} aria-label={busy ? "Retrying" : label}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
      {busy ? "Retrying…" : label}
    </Button>
  );
}

/** Recovered chip + reset, so every simulate can be replayed. */
function RecoveredBar({ reset, note, className }: { reset: () => void; note: string; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3.5 py-3", className)}>
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      <p className="text-[13px] font-medium text-emerald-800">{note}</p>
      <Button size="sm" variant="ghost" className="ml-auto h-8 text-emerald-700 hover:text-emerald-800" onClick={reset} aria-label="Reset error demo">
        Reset demo
      </Button>
    </div>
  );
}

/** Page-level error block — centered tile + copy + recovery actions. */
function PageErrorBlock({
  icon,
  tileCls,
  title,
  message,
  children,
  className,
}: {
  icon: React.ReactNode;
  tileCls: string;
  title: string;
  message: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-slate-200/90 bg-white px-6 py-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      <span className={cn("qubit-icon-tile mb-3.5 h-12 w-12", tileCls)}>{icon}</span>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{message}</p>
      {children && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

export function ErrorStatesScreen() {
  const { toast } = useToast();
  const goBack = useGoBack();
  const apiRetry = useRetrySim("Organization structure reloaded successfully.");
  const netRetry = useRetrySim("Connection restored — syncing your local changes now.");
  const serverRetry = useRetrySim("Service restored — the page can be reloaded now.");

  const [deptName, setDeptName] = React.useState("");
  const deptError = deptName.trim() === "";

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Error States"
        description="Standardized error experiences with clear recovery paths."
      />

      <div className="space-y-6">
        {/* ——— Contract strip ——— */}
        <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 sm:flex-row sm:items-center md:px-5">
          <span className="qubit-icon-tile qubit-icon-tile-accent h-10 w-10 shrink-0">
            <Info />
          </span>
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
            <p className="text-[13px] leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-900">1 · What happened?</span> Name the failure
              in plain language — never just “Error”.
            </p>
            <p className="text-[13px] leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-900">2 · What can the user do?</span> Always
              offer at least one recovery path — retry, go back, or ask for help.
            </p>
          </div>
        </div>

        {/* ——— 1 · Field & validation errors ——— */}
        <DSSection
          title="Field & validation errors"
          purpose="Inline at the control, or summarized when several fields block a save."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <DSExample label="Inline field error — adjacent to the control, aria-invalid set">
              <div className="max-w-sm space-y-1.5">
                <Label htmlFor="demo-dept-name">Department name</Label>
                <Input
                  id="demo-dept-name"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Revenue Operations"
                  aria-invalid={deptError}
                  aria-describedby={deptError ? "dept-name-error" : undefined}
                  className={cn("h-10 rounded-lg", deptError && "border-red-300 focus-visible:ring-red-200")}
                />
                {deptError && (
                  <p id="dept-name-error" role="alert" className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Department name is required.
                  </p>
                )}
                <p className="text-xs text-slate-400">Type to clear the error — inline copy never blocks typing.</p>
              </div>
            </DSExample>
            <DSExample label="Validation summary — every blocker in one place, fields are links">
              <div className="rounded-xl border border-red-200/80 bg-red-50/50 p-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-red-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
                  2 fields need attention
                </p>
                <p className="mt-1 text-xs text-red-700/90">Fix these before saving the approval workflow.</p>
                <ul className="mt-3 space-y-1.5">
                  {[
                    { field: "Role name", issue: "Enter a name for the role." },
                    { field: "Approval limit", issue: "Limit must be between ₹1,000 and ₹10,00,000." },
                  ].map((f) => (
                    <li key={f.field}>
                      <button
                        type="button"
                        onClick={() => toast({ title: `Jumped to ${f.field} (demo)`, description: "The form scrolls to the field and focuses it." })}
                        className="group/field flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-red-100/60"
                      >
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-red-700 underline-offset-2 group-hover/field:underline">{f.field}</span>
                          <span className="block text-xs text-red-600/80">{f.issue}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </DSExample>
          </div>
        </DSSection>

        {/* ——— 2 · Data & API errors ——— */}
        <DSSection
          title="Data & API errors"
          purpose="A section that fails to load keeps its shell and recovers in place — no page takeover."
        >
          <div className="rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 md:px-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Organization structure</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Live snapshot from the HR service</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                hr-service · v2
              </span>
            </div>
            <div className="p-4 md:p-5">
              {apiRetry.ok ? (
                <>
                  <RecoveredBar reset={apiRetry.reset} note="Organization structure is up to date — reloaded just now." />
                  <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      ["Employees", "1,245", "+18 this month"],
                      ["Departments", "8", "All active"],
                      ["Locations", "9", "Mumbai HQ + 8"],
                    ].map(([k, v, note]) => (
                      <div key={k} className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                        <dt className="text-xs text-muted-foreground">{k}</dt>
                        <dd className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">{v}</dd>
                        <dd className="mt-0.5 flex items-center gap-1.5 text-[11px] text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                          {note}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/70 p-4 sm:flex-row sm:items-start" role="alert">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-red-800">Unable to load organization structure</p>
                    <p className="mt-0.5 text-xs text-red-700/90">The data could not be retrieved right now.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <RetryButton busy={apiRetry.busy} onClick={apiRetry.retry} />
                      <Button size="sm" variant="ghost" onClick={goBack}>
                        <ArrowLeft className="h-4 w-4" aria-hidden />
                        Go back
                      </Button>
                    </div>
                  </div>
                  <span className="shrink-0 self-start rounded border border-red-200 bg-white px-1.5 py-0.5 font-mono text-[10.5px] text-red-600">
                    QB-2026-0417
                  </span>
                </div>
              )}
            </div>
          </div>
          <DSCaption className="mt-3">
            The card shell, header and context survive the failure — only the content area swaps to
            the error, so recovery lands in the same place.
          </DSCaption>
        </DSSection>

        {/* ——— 3 · Network & server errors ——— */}
        <DSSection
          title="Network & server errors"
          purpose="Page-level blocks for when the page itself cannot do its job."
        >
          <DSStage className="grid gap-4 lg:grid-cols-2">
            <DSExample label="Network — reassure about local work first">
              {netRetry.ok ? (
                <RecoveredBar reset={netRetry.reset} note="You're back online — local changes are syncing." className="self-stretch" />
              ) : (
                <PageErrorBlock
                  icon={<WifiOff />}
                  tileCls="bg-red-50 text-red-600"
                  title="You're offline"
                  message="Check your connection. Your changes are saved locally."
                  className="self-stretch"
                >
                  <RetryButton busy={netRetry.busy} onClick={netRetry.retry} />
                  <Button size="sm" variant="ghost" onClick={() => toast({ title: "Working offline (demo)", description: "Edits queue locally and sync automatically when the connection returns." })}>
                    Work offline
                  </Button>
                </PageErrorBlock>
              )}
            </DSExample>
            <DSExample label="Server — own the failure, give a reference code, no stack traces">
              {serverRetry.ok ? (
                <RecoveredBar reset={serverRetry.reset} note="Service restored — error rate is back to normal." className="self-stretch" />
              ) : (
                <PageErrorBlock
                  icon={<Server />}
                  tileCls="bg-red-50 text-red-600"
                  title="Something went wrong on our side"
                  message={
                    <>
                      Our team has been notified automatically. Share reference{" "}
                      <DSVar className="border-red-200 bg-red-50 text-red-700">QB-2026-0417</DSVar> if you contact support.
                    </>
                  }
                  className="self-stretch"
                >
                  <RetryButton busy={serverRetry.busy} onClick={serverRetry.retry} />
                  <Button size="sm" variant="ghost" onClick={() => toast({ title: "Contact IT support (demo)", description: "Opens a prefaced support ticket with reference QB-2026-0417 attached." })}>
                    Contact IT support
                  </Button>
                </PageErrorBlock>
              )}
            </DSExample>
          </DSStage>
        </DSSection>

        {/* ——— 4 · Permission & not found ——— */}
        <DSSection
          title="Permission & not found"
          purpose="Access errors name the missing permission; 404s always offer a way home."
        >
          <DSStage className="grid gap-4 lg:grid-cols-2">
            <DSExample label="Permission — say exactly which permission, and how to get it">
              <PageErrorBlock
                icon={<ShieldAlert />}
                tileCls="bg-red-50 text-red-600"
                title="You don't have access to this section"
                message="Ask an administrator to grant the Approvals · Manage permission."
                className="self-stretch"
              >
                <Button size="sm" variant="outline" onClick={() => toast({ title: "Access request sent (demo)", description: "Priya Sharma (Finance Head) will review your request for Approvals · Manage." })}>
                  Request access
                </Button>
                <Button size="sm" variant="ghost" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Go back
                </Button>
              </PageErrorBlock>
            </DSExample>
            <DSExample label="Not found — calm 404 with two exits">
              <PageErrorBlock
                icon={<FileQuestion />}
                tileCls="bg-slate-100 text-slate-600"
                title="This page doesn't exist or was moved"
                message="Check the link or navigate back to your workspace."
                className="self-stretch"
              >
                <Button size="sm" onClick={() => toast({ title: "Going home (demo)", description: "Opens the Organization Structure home screen." })}>
                  Go to Home
                </Button>
                <Button size="sm" variant="ghost" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Go back
                </Button>
              </PageErrorBlock>
            </DSExample>
          </DSStage>
        </DSSection>

        {/* ——— 5 · Session expired ——— */}
        <DSSection
          title="Session expired"
          purpose="Compact, centered, single action — the user never loses work unsaved."
        >
          <DSStage align="center">
            <PageErrorBlock
              icon={<LogOut />}
              tileCls="bg-red-50 text-red-600"
              title="Your session expired"
              message="Sign in again to continue working. Drafts from the last 24 hours are preserved."
              className="w-full max-w-md border-dashed"
            >
              <Button size="sm" onClick={() => toast({ title: "Sign in (demo)", description: "Redirects to the Qubit One single sign-on page." })}>
                Sign in
              </Button>
            </PageErrorBlock>
          </DSStage>
        </DSSection>

        {/* ——— 6 · Rules ——— */}
        <DSSection title="Rules" purpose="Tone mapping, copy contract and the things errors must never do.">
          <DSTokenTable
            head={["Surface", "Treatment", "Notes"]}
            rows={[
              ["Field inline", <>Red text <DSVar>text-red-600</DSVar> + <DSVar>AlertCircle</DSVar> 14px, control gets <DSVar>aria-invalid</DSVar></>, "Adjacent to the field; clears the moment the value is valid."],
              ["Banner (section)", <><DSVar>bg-red-50</DSVar> · <DSVar>border-red-200</DSVar> + <DSVar>AlertTriangle</DSVar></>, "Replaces only the failing content area; keeps retry + secondary exit inline."],
              ["Page-level", "Centered 48px red icon tile + title + one-line message + actions", "Full-region replacement only when nothing else can render."],
              ["Copy contract", "Plain language → what happened → one recovery step → optional reference code", <>Reference codes look like <DSVar>QB-YYYY-NNNN</DSVar> and map to a support ticket.</>],
              ["Never", "Stack traces, HTTP codes as titles, color-only signaling", "Icon + text always pair; engineering detail stays in logs, not UI."],
            ]}
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="Specific, actionable, recoverable">
              Name the failing thing (“Unable to load organization structure”), give the single best
              next step (Retry), and a second path (Go back, Contact IT). Reassure where it matters —
              offline copy says work is saved locally.
            </DSGuidance>
            <DSGuidance kind="dont" title="Generic 'Error!', jargon, dead ends">
              No bare “Error!” or “Oops”, no status codes or stack traces as user-facing copy, and no
              error without an exit — every state above has at least one working button.
            </DSGuidance>
          </div>
        </DSSection>

        <DSScreenNav id="error-states" />
      </div>
    </>
  );
}
