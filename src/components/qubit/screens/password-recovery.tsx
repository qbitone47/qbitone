"use client";

import * as React from "react";
import {
  Check,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  RefreshCcw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiPost } from "@/lib/qubit/api";
import {
  PASSWORD_RULES,
  RECENT_SECURITY_EVENTS,
  RECOVERY_METHODS,
  passwordStrength,
} from "@/lib/qubit/security-data";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { SectionCard, StatusBadge } from "../primitives";
import { StepUpDialog } from "../dialogs";

// ============================================================
// Screen 34 · Password & Recovery
// Secure password lifecycle: change (with step-up), forgot
// password, recovery methods and recent security activity.
// The server re-checks policy — the UI never weakens it.
// ============================================================

export function PasswordRecoveryScreen() {
  const { toast } = useToast();
  const { can } = useRole();

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Security" }, { label: "Account" }]}
        title="Password & Recovery"
        description="Manage your password and the ways you can get back into your account. Sensitive changes ask you to confirm your identity first."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            MFA enforced by organization policy
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChangePasswordCard />
        <ForgotPasswordCard />
      </div>

      <RecoveryMethodsCard />

      <SectionCard
        title="Recent security activity"
        description="The latest password and authentication events on your account — the full history lives in the Audit Log."
        className="mt-4"
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Showing the last 6 events
          </span>
        }
      >
        <ul className="divide-y">
          {RECENT_SECURITY_EVENTS.map((ev) => (
            <li key={ev.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <span
                className={cn(
                  "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                  ev.result === "Success" ? "bg-emerald-500" : ev.result === "Failure" ? "bg-red-500" : "bg-amber-500",
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-slate-800">{ev.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{ev.detail}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[11px] tabular-nums text-slate-400">{ev.time}</span>
                <StatusBadge status={ev.result} size="sm" />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
          Viewing your security activity is itself recorded in the audit history{can("audit.export") ? "" : " — your personal view only"}.
        </p>
      </SectionCard>
    </div>
  );
}

// ---------- Change password ----------
function ChangePasswordCard() {
  const { toast } = useToast();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const strength = passwordStrength(next);
  const rulesPassed = PASSWORD_RULES.filter((r) => r.test(next)).length;
  const confirmMismatch = confirm.length > 0 && confirm !== next;
  const canSubmit = current.length > 0 && rulesPassed === PASSWORD_RULES.length && !confirmMismatch && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    if (confirmMismatch) {
      setFieldError("The confirmation doesn't match the new password.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiPost<{ ok: true; message: string }>("/password", { current, next });
      setDone(true);
      toast({ title: "Password changed", description: res.message });
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Couldn't change your password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <SectionCard title="Change password">
        <div className="flex flex-col items-center py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
            <Check className="h-5 w-5 text-emerald-600" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-900">Your password was changed successfully</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Other sessions were signed out automatically and the change is recorded in your security activity.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 h-8"
            onClick={() => {
              setDone(false);
              setCurrent("");
              setNext("");
              setConfirm("");
            }}
          >
            Done
          </Button>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Change password"
      description="Changing your password signs out every other session and is recorded in the audit log."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cur-pw" className="text-xs font-medium text-slate-700">
            Current password
          </Label>
          <div className="relative">
            <Input
              id="cur-pw"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="h-9 rounded-lg pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide passwords" : "Show passwords"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            This is the step-up check that protects the change — the server verifies it before applying anything.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-pw" className="text-xs font-medium text-slate-700">
            New password
          </Label>
          <Input
            id="new-pw"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-describedby="pw-rules"
            className="h-9 rounded-lg"
          />
          {/* Strength meter */}
          <div className="flex items-center gap-2" aria-live="polite">
            <div className="flex flex-1 gap-1" aria-hidden>
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors duration-200",
                    next && strength.score >= i
                      ? strength.score >= 3
                        ? "bg-emerald-500"
                        : strength.score === 2
                          ? "bg-amber-500"
                          : "bg-red-400"
                      : "bg-slate-200",
                  )}
                />
              ))}
            </div>
            <span className="w-16 text-right text-[11px] font-medium text-slate-500">{next ? strength.label : "—"}</span>
          </div>
          {/* Requirement checklist */}
          <ul id="pw-rules" className="grid grid-cols-1 gap-1 pt-1 sm:grid-cols-2">
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(next);
              return (
                <li key={r.id} className={cn("flex items-center gap-1.5 text-[11.5px]", ok ? "text-emerald-700" : "text-slate-400")}>
                  {ok ? <Check className="h-3 w-3" aria-hidden /> : <X className="h-3 w-3" aria-hidden />}
                  {r.label}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="conf-pw" className="text-xs font-medium text-slate-700">
            Confirm new password
          </Label>
          <Input
            id="conf-pw"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={confirmMismatch}
            className="h-9 rounded-lg"
          />
          {confirmMismatch && (
            <p role="alert" className="text-[11.5px] font-medium text-red-600">
              The confirmation doesn't match the new password.
            </p>
          )}
        </div>

        {fieldError && (
          <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <X className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {fieldError}
          </div>
        )}

        <Button type="submit" disabled={!canSubmit} className="h-9 rounded-lg text-sm">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Updating…
            </>
          ) : (
            "Change password"
          )}
        </Button>
      </form>
    </SectionCard>
  );
}

// ---------- Forgot password ----------
function ForgotPasswordCard() {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("sagar.singh@qubitone.in");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    // Simulated reset dispatch — the response never reveals
    // whether the address has an account.
    window.setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 1100);
  };

  return (
    <SectionCard
      title="Forgot password"
      description="Locked out or changing a forgotten password? Start here — identity is proven before a reset is allowed."
    >
      {sent ? (
        <div className="py-4 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
            <Send className="h-5 w-5 text-emerald-600" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-900">Check your email</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
            If an account exists for <span className="font-medium text-slate-600">{email}</span>, a reset link is on its
            way. The link is single-use and expires in 30 minutes. Setting the new password will also require your MFA.
          </p>
          <Button variant="outline" size="sm" className="mt-4 h-8" disabled={sending} onClick={() => setSent(false)}>
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={send} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="forgot-email" className="text-xs font-medium text-slate-700">
              Work email
            </Label>
            <Input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 rounded-lg"
              required
            />
          </div>
          <ul className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-[11.5px] leading-relaxed text-slate-500">
            <li className="flex items-start gap-1.5">
              <Clock className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
              Reset links are single-use and expire after 30 minutes.
            </li>
            <li className="flex items-start gap-1.5">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
              MFA is required again when setting the new password — a stolen link alone can't take over an account.
            </li>
            <li className="flex items-start gap-1.5">
              <Lock className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
              Requests are rate-limited, and for safety the response never reveals whether an address has an account.
            </li>
          </ul>
          <Button type="submit" disabled={sending} className="h-9 w-full rounded-lg text-sm">
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
      )}
    </SectionCard>
  );
}

// ---------- Recovery methods ----------
function RecoveryMethodsCard() {
  const { toast } = useToast();
  const [methods, setMethods] = React.useState(RECOVERY_METHODS);
  const [stepUpFor, setStepUpFor] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const [regenerated, setRegenerated] = React.useState(false);

  const kindIcon = (kind: string) => (kind === "email" ? Mail : kind === "phone" ? Phone : KeyRound);

  const runAfterStepUp = (kind: string | null) => {
    setVerifying(true);
    window.setTimeout(() => {
      setVerifying(false);
      setStepUpFor(null);
      if (kind === "codes") {
        setRegenerated(true);
        setMethods((ms) => ms.map((m) => (m.id === "rec-codes" ? { ...m, detail: "10 of 10 single-use codes remaining", status: "Verified" } : m)));
        toast({ title: "Recovery codes regenerated", description: "Your old codes no longer work. Store the new codes somewhere safe." });
      } else if (kind === "email") {
        toast({ title: "Recovery email updated", description: "A verification link was sent to the new address." });
      } else if (kind === "phone") {
        toast({ title: "Recovery phone updated", description: "We sent a verification code by SMS." });
      }
    }, 1100);
  };

  return (
    <SectionCard
      title="Recovery methods"
      description="Ways to get back in if you lose your password or device. Changing any recovery method requires reauthentication."
      className="mt-4"
      actions={
        <span className="text-[11px] text-muted-foreground">
          {methods.filter((m) => m.status === "Verified").length} of {methods.length} verified
        </span>
      }
    >
      <ul className="divide-y">
        {methods.map((m) => {
          const Icon = kindIcon(m.kind);
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="qubit-icon-tile qubit-icon-tile-accent h-9 w-9 shrink-0 [&_svg]:h-4 [&_svg]:w-4">
                <Icon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[13px] font-medium text-slate-800">
                  {m.name}
                  <StatusBadge status={regenerated && m.id === "rec-codes" ? "Verified" : m.status} size="sm" />
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {m.detail}
                  {regenerated && m.id === "rec-codes" ? " · regenerated just now" : ` · ${m.meta}`}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setStepUpFor(m.kind)}
              >
                {m.kind === "codes" ? "Regenerate codes" : "Update"}
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-[11.5px] leading-relaxed text-slate-600">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden />
        Recovery can never weaken account security: new methods must be verified, regeneration invalidates old codes,
        and every change requires reauthentication plus a recorded audit event.
      </div>

      <StepUpDialog
        open={stepUpFor !== null}
        onOpenChange={(o) => !o && setStepUpFor(null)}
        title="Confirm your identity"
        description={
          stepUpFor === "codes"
            ? "Regenerating recovery codes invalidates the current ones. Confirm your password to continue."
            : "You're changing a recovery method for your account. Confirm your password to continue."
        }
        confirmLabel={stepUpFor === "codes" ? "Regenerate codes" : "Confirm change"}
        verifying={verifying}
        onConfirm={() => runAfterStepUp(stepUpFor)}
      />

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
        <RefreshCcw className="h-3 w-3" aria-hidden />
        Recovery changes notify you by email and appear in Security Center activity.
      </p>
    </SectionCard>
  );
}
