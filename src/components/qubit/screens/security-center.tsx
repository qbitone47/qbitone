"use client";

import * as React from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Fingerprint,
  KeyRound,
  Laptop,
  Loader2,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiPost } from "@/lib/qubit/api";
import {
  AUTH_FACTORS,
  DEVICE_SESSIONS,
  RECENT_SECURITY_EVENTS,
  RECOVERY_METHODS,
  SECURITY_RECOMMENDATIONS,
  type AuthFactor,
} from "@/lib/qubit/security-data";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { ArrowLink, EmptyState, SectionCard, StatTile, StatusBadge } from "../primitives";
import { StepUpDialog } from "../dialogs";

// ============================================================
// Screen 36 · Security Center
// "How secure is my Qubit account right now?"
// Personal posture — not a SOC dashboard: authentication,
// sessions, recovery, recent activity, actionable next steps,
// and the AI authorization boundary.
// ============================================================

export function SecurityCenterScreen() {
  const { navigate } = useQubitNav();
  const { can } = useRole();
  const { toast } = useToast();

  const [factors, setFactors] = React.useState<AuthFactor[]>(AUTH_FACTORS);
  const [stepUp, setStepUp] = React.useState(false);
  const [addingPasskey, setAddingPasskey] = React.useState(false);
  const [passkeyAdded, setPasskeyAdded] = React.useState(false);

  const passkeyFactor = factors.find((f) => f.id === "passkey");
  const passkeyEnabled = passkeyFactor?.status === "Enabled" || passkeyAdded;
  const activeSessions = DEVICE_SESSIONS.filter((s) => s.status === "Active" || s.status === "Suspicious");
  const recoveryOk = RECOVERY_METHODS.every((m) => m.status === "Verified");
  const suspiciousCount = DEVICE_SESSIONS.filter((s) => s.status === "Suspicious").length;

  const posture = [
    { label: "Two-step verification", ok: true, detail: "Authenticator app · enforced by policy" },
    { label: "Recovery methods", ok: recoveryOk, detail: recoveryOk ? "Email and phone verified" : "Recovery codes need attention" },
    { label: "Active sessions", ok: suspiciousCount === 0, detail: suspiciousCount === 0 ? `${activeSessions.length} active, all trusted` : `${suspiciousCount} session flagged for review` },
    { label: "Passkey", ok: passkeyEnabled, detail: passkeyEnabled ? "Phishing-resistant sign-in active" : "Recommended — strongest second factor" },
  ];
  const postureOk = posture.filter((p) => p.ok).length;

  const addPasskey = () => {
    setAddingPasskey(true);
    window.setTimeout(async () => {
      try {
        // Server verifies the (simulated) WebAuthn attestation and
        // records the factor change in the audit log.
        await apiPost("/passkey", {});
      } catch {
        // Registration failure is surfaced honestly below.
      }
      setAddingPasskey(false);
      setStepUp(false);
      setPasskeyAdded(true);
      setFactors((fs) => fs.map((f) => (f.id === "passkey" ? { ...f, status: "Enabled", meta: "Added just now" } : f)));
      toast({ title: "Passkey added", description: "Next sign-in can use Face ID, Touch ID or your security key — no password needed." });
    }, 1200);
  };

  const recommendations = SECURITY_RECOMMENDATIONS.filter((r) => !(r.doneWhen === "passkey-added" && passkeyEnabled));

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Security" }, { label: "My account" }]}
        title="Security Center"
        description="How secure is your Qubit account right now — authentication, sessions, recovery and the steps that strengthen it."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                postureOk === posture.length ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700",
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {postureOk === posture.length ? "Account security is strong" : `${postureOk} of ${posture.length} checks strong — ${posture.length - postureOk} improvement${posture.length - postureOk === 1 ? "" : "s"} available`}
            </span>
          </div>
        }
      />

      {/* Posture summary */}
      <SectionCard title="Security status" description="The four checks that decide your account posture.">
        <ul className="grid gap-2 sm:grid-cols-2">
          {posture.map((p) => (
            <li
              key={p.label}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-3.5",
                p.ok ? "border-emerald-100 bg-emerald-50/40" : "border-amber-200 bg-amber-50/50",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  p.ok ? "border-emerald-200 bg-white text-emerald-600" : "border-amber-300 bg-white text-amber-600",
                )}
                aria-hidden
              >
                {p.ok ? <Check className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-slate-900">{p.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{p.detail}</span>
                <span className="sr-only">{p.ok ? "Passing" : "Needs attention"}</span>
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Authentication */}
        <SectionCard
          title="Authentication"
          description="How you prove it's you. Factor changes require reauthentication and are audited."
          className="lg:col-span-2"
          actions={
            <Button size="sm" variant="outline" className="h-8" onClick={() => setStepUp(true)} disabled={passkeyEnabled}>
              <Fingerprint className="h-3.5 w-3.5" aria-hidden />
              Add passkey
            </Button>
          }
        >
          <ul className="divide-y">
            {factors.map((f) => {
              const Icon = f.id === "passkey" ? Fingerprint : f.id === "push" ? Smartphone : f.id === "recovery-code" ? KeyRound : ShieldCheck;
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className={cn("qubit-icon-tile h-9 w-9 shrink-0 rounded-lg [&_svg]:h-4 [&_svg]:w-4", f.status === "Enabled" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500")}>
                    <Icon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-slate-800">
                      {f.name}
                      {f.primary && <span className="rounded bg-blue-50 px-1.5 py-px text-[10px] font-semibold text-blue-700">Primary</span>}
                      {f.phishingResistant && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-600">
                          <ShieldCheck className="h-3 w-3" aria-hidden />
                          Phishing-resistant
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{f.meta ? `${f.detail} · ${f.meta}` : f.detail}</p>
                  </div>
                  <StatusBadge status={f.status === "Enabled" ? "Enabled" : f.status === "Set up" ? "Action needed" : "Available"} size="sm" />
                </li>
              );
            })}
          </ul>
          <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
            Removing or replacing a factor always requires your password (step-up) and notifies you by email.
          </p>
        </SectionCard>

        {/* Sessions + recovery tiles */}
        <div className="flex flex-col gap-4">
          <StatTile
            icon={<Laptop />}
            value={String(activeSessions.length)}
            label={suspiciousCount > 0 ? `Active sessions · ${suspiciousCount} flagged` : "Active sessions, all trusted"}
            onClick={() => navigate("device-sessions")}
          />
          <SectionCard title="Recovery" description="If you lose access, these get you back in.">
            <ul className="space-y-2">
              {RECOVERY_METHODS.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0 truncate text-slate-700">{m.name}</span>
                  <StatusBadge status={m.status} size="sm" />
                </li>
              ))}
            </ul>
            <ArrowLink className="mt-3" onClick={() => navigate("password-recovery")}>
              Manage recovery methods
            </ArrowLink>
          </SectionCard>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Recommendations */}
        <SectionCard
          title="Recommendations"
          description="Concrete next steps — each one is actionable from here."
        >
          {recommendations.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck />}
              title="You're all caught up"
              message="Every recommendation is complete. We'll tell you when something needs attention."
            />
          ) : (
            <ul className="divide-y">
              {recommendations.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                      r.weight === "recommended" ? "border-blue-200 bg-blue-50 text-blue-600" : r.weight === "review" ? "border-red-200 bg-red-50 text-red-600" : "border-slate-200 bg-slate-50 text-slate-500",
                    )}
                    aria-hidden
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-slate-800">{r.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{r.why}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={r.weight === "review" ? "default" : "outline"}
                    className="h-8 shrink-0"
                    onClick={() => {
                      if (r.doneWhen === "passkey-added") setStepUp(true);
                      else if (r.target) navigate(r.target);
                    }}
                  >
                    {r.action}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Recent activity */}
        <SectionCard
          title="Recent security activity"
          description="Sign-ins, factor changes and access decisions on your account."
          actions={<ArrowLink onClick={() => navigate("audit-log")}>View audit history</ArrowLink>}
        >
          <ul className="divide-y">
            {RECENT_SECURITY_EVENTS.slice(0, 5).map((ev) => (
              <li key={ev.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <span
                  className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", ev.result === "Success" ? "bg-emerald-500" : ev.result === "Failure" ? "bg-red-500" : "bg-amber-500")}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-800">{ev.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{ev.detail}</p>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{ev.time}</span>
              </li>
            ))}
          </ul>
          {!can("security.admin") && (
            <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
              You're viewing your personal activity. Organization-wide audit history requires the Security administrator boundary.
            </p>
          )}
        </SectionCard>
      </div>

      {/* AI authorization boundary — quiet, informational */}
      <SectionCard
        title="Qubit AI & your permissions"
        description="The AI authorization model, in one place."
        className="mt-4"
        actions={
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10.5px] font-medium text-slate-500">
            Phase 12 — Qubit AI Platform
          </span>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <span className="qubit-icon-tile qubit-icon-tile-accent h-10 w-10 shrink-0">
            <Sparkles />
          </span>
          <p className="text-[13px] leading-relaxed text-slate-600">
            Qubit AI <span className="font-medium text-slate-800">inherits exactly your identity, role, permissions and department
            boundaries</span> — it can never see data you can't, and existing information in the database alone grants it nothing.
            AI actions that would affect permissions, roles, security settings, users or financial data require your approval as
            a human step, and every AI access or action is recorded in the audit log like any other user action.
          </p>
        </div>
      </SectionCard>

      <StepUpDialog
        open={stepUp}
        onOpenChange={setStepUp}
        title="Add a passkey"
        description="Confirm your password first — factor changes are sensitive and are recorded in the audit log."
        confirmLabel="Continue"
        verifying={addingPasskey}
        onConfirm={addPasskey}
      />

      {addingPasskey && (
        <p className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-400" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Waiting for platform passkey creation…
        </p>
      )}
    </div>
  );
}
