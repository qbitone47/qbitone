"use client";

import * as React from "react";
import { ArrowRight, Fingerprint, KeyRound, Loader2, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ApiError, invalidateSession } from "@/lib/qubit/api";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { AuthAlert, AuthFrame, AuthSteps, type AuthAlertTone } from "../auth/auth-frame";

// ============================================================
// Screen · MFA Verification — IAM second factor → personal session
// Second authentication factor via the EXISTING MFA engine. On
// success POST /api/iam/mfa issues the individual's session (bound
// to their own userId and single role) and the shell routes to the
// server-computed home screen. Attempts are limited and the
// challenge expires on the server.
// ============================================================

type Method = "authenticator-app" | "push" | "recovery-code" | "passkey";

interface MfaOk {
  ok: true;
  userId: string;
  name: string;
  role: string;
  homeScreen: string;
}
interface MfaFail {
  ok: false;
  code: string;
  message: string;
  attemptsRemaining?: number;
}

const METHOD_META: { id: Method; label: string; detail: string; icon: React.ElementType }[] = [
  { id: "authenticator-app", label: "Authenticator app", detail: "6-digit code", icon: Smartphone },
  { id: "push", label: "Push approval", detail: "Approve on your phone", icon: RefreshCw },
  { id: "passkey", label: "Passkey", detail: "Biometric or security key", icon: Fingerprint },
  { id: "recovery-code", label: "Recovery code", detail: "Single-use backup", icon: KeyRound },
];

export function MfaVerificationScreen() {
  const { params, navigate } = useQubitNav();
  const { toast } = useToast();
  const { refreshIdentity } = useRole();

  const [challengeId] = React.useState(() => params.challengeId ?? `chl-preview-${Date.now()}`);
  // Phase 21: the simulated authenticator's current code, issued by the
  // server at challenge time — wrong codes now genuinely fail (audit H1).
  const demoCode = typeof params.demoCode === "string" ? params.demoCode : undefined;
  const [method, setMethod] = React.useState<Method>("authenticator-app");
  const [code, setCode] = React.useState("");
  const [recovery, setRecovery] = React.useState("");
  const [phase, setPhase] = React.useState<"waiting" | "verifying" | "success" | "push-waiting">("waiting");
  const [alert, setAlert] = React.useState<{ tone: AuthAlertTone; title: string; body: string } | null>(null);
  const [attemptsLeft, setAttemptsLeft] = React.useState(3);
  const [secondsLeft, setSecondsLeft] = React.useState(292);
  const [resendIn, setResendIn] = React.useState(0);

  // Challenge countdown — mirrors the server-side expiry.
  React.useEffect(() => {
    const t = window.setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, []);

  React.useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [resendIn]);

  React.useEffect(() => {
    if (secondsLeft === 0 && phase !== "success") {
      setAlert({
        tone: "warning",
        title: "This verification request expired",
        body: "Verification requests last 5 minutes. Request a new one to continue — no attempts were wasted.",
      });
    }
  }, [secondsLeft, phase]);

  const verify = async (submitted: string, m: Method) => {
    if (secondsLeft === 0) {
      setAlert({
        tone: "warning",
        title: "This verification request expired",
        body: "Request a new challenge to continue — nothing was charged against your account.",
      });
      return;
    }
    setAlert(null);
    setPhase("verifying");
    try {
      const res = await fetch("/api/iam/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code: submitted, method: m }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => null)) as (MfaOk & { message?: string }) | (MfaFail & { message?: string }) | null;
      if (!res.ok || !body || body.ok !== true) {
        setPhase("waiting");
        const fail: MfaFail = body && body.ok === false ? body : { ok: false, code: "mfa_failed", message: "Verification failed. Try again." };
        setAttemptsLeft(fail.attemptsRemaining ?? Math.max(0, attemptsLeft - 1));
        setAlert({
          tone: fail.code === "too_many_attempts" ? "error" : fail.code === "expired" ? "warning" : "error",
          title: fail.message,
          body: alertBody(fail.code),
        });
        return;
      }
      // Session issued — refresh the identity context, then route to the
      // personalized home screen computed by the server entitlements.
      setPhase("success");
      invalidateSession();
      await refreshIdentity();
      const home = (body.homeScreen || "employee-home") as Parameters<typeof navigate>[0];
      window.setTimeout(() => {
        toast({ title: "Signed in", description: `Welcome back, ${body.name} — your workspace is ready.` });
        navigate(home);
      }, 700);
    } catch (err) {
      setPhase("waiting");
      if (err instanceof ApiError) {
        // Handled server decision (invalid code, expired, rate limited)
        setAttemptsLeft(err.status === 401 ? Math.max(0, attemptsLeft - 1) : attemptsLeft);
        setAlert({
          tone: err.status === 410 ? "warning" : "error",
          title: err.message,
          body: alertBody(err.code ?? ""),
        });
      } else {
        setAlert({
          tone: "warning",
          title: "Verification service unreachable",
          body: "We couldn't reach the verification service. Nothing was verified — check your connection and try again.",
        });
      }
    }
  };

  const startPush = () => {
    setMethod("push");
    setPhase("push-waiting");
    setResendIn(30);
    // Device approval resolves through the same verified MFA endpoint —
    // the session is only issued after the server accepts the factor.
    window.setTimeout(() => {
      void verify("", "push");
    }, 2600);
  };

  const startPasskey = () => {
    setMethod("passkey");
    setPhase("push-waiting");
    // Platform passkey ceremony resolves through the same endpoint.
    window.setTimeout(() => {
      void verify("", "passkey");
    }, 1800);
  };

  const expired = secondsLeft === 0 && phase !== "success";
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <AuthFrame>
      <div className="mb-6 space-y-3">
        <AuthSteps current={2} />
        <div>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-slate-900">Two-step verification</h2>
          <p className="mt-1 text-[13.5px] text-slate-500">
            Confirm it's really you, <span className="font-medium text-slate-700">s•••r.singh@qubitone.in</span>
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-400" aria-live={expired ? "assertive" : "polite"}>
          <span className={cn("inline-block h-1.5 w-1.5 rounded-full", expired ? "bg-amber-500" : "bg-emerald-500")} aria-hidden />
          {expired ? "Request expired" : `Request expires in ${mm}:${ss}`}
        </p>
      </div>

      {alert && (
        <AuthAlert tone={alert.tone} title={alert.title} className="mb-4">
          {alert.body}
          {alert.tone === "warning" && alert.title.startsWith("This verification") && (
            <div className="mt-2">
              <Button size="sm" variant="outline" className="h-8" onClick={() => navigate("login")}>
                Start sign-in again
              </Button>
            </div>
          )}
        </AuthAlert>
      )}

      {phase === "success" ? (
        <div className="flex flex-col items-center rounded-xl border border-emerald-200 bg-emerald-50/60 px-6 py-10 text-center" aria-live="polite">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-white">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-900">Verified</p>
          <p className="mt-1 text-xs text-muted-foreground">Opening your workspace…</p>
        </div>
      ) : phase === "push-waiting" && method === "push" ? (
        <PushWaiting
          onCancel={() => setPhase("waiting")}
          resendIn={resendIn}
          onResend={() => {
            setResendIn(30);
            toast({ title: "Push sent again", description: "Check your iPhone 15 Pro." });
          }}
        />
      ) : phase === "push-waiting" && method === "passkey" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <Fingerprint className="mx-auto h-8 w-8 text-blue-600" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-slate-900">Use your passkey</p>
          <p className="mt-1 text-xs text-muted-foreground">Follow the prompt on your device — Face ID, Touch ID or your security key.</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-400" aria-live="polite">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Waiting for your device…
          </div>
          <Button variant="ghost" size="sm" className="mt-3 h-8" onClick={() => setPhase("waiting")}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {method === "authenticator-app" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length === 6) void verify(code, "authenticator-app");
              }}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
            >
              <Label htmlFor="otp" className="text-xs font-medium text-slate-700">
                Enter the 6-digit code from your authenticator app
              </Label>
              {demoCode && (
                <p className="mt-1.5 rounded-md bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500">
                  Demo authenticator · current code <span className="font-mono font-semibold text-slate-700">{demoCode}</span>
                </p>
              )}
              <div className="mt-3 flex justify-center">
                <InputOTP
                  id="otp"
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  disabled={phase === "verifying" || expired}
                  autoFocus
                  aria-label="6-digit verification code"
                >
                  <InputOTPGroup>
                    {[0, 1, 2].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                  <span className="px-1 text-slate-300" aria-hidden>
                    –
                  </span>
                  <InputOTPGroup>
                    {[3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" disabled={code.length !== 6 || phase === "verifying" || expired} className="mt-4 h-10 w-full rounded-lg text-sm">
                {phase === "verifying" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Verifying…
                  </>
                ) : (
                  "Verify and continue"
                )}
              </Button>
              {attemptsLeft < 3 && attemptsLeft > 0 && (
                <p className="mt-2 text-center text-[11px] font-medium text-amber-600" aria-live="polite">
                  {attemptsLeft} {attemptsLeft === 1 ? "attempt" : "attempts"} remaining before this request is invalidated
                </p>
              )}
            </form>
          )}

          {method === "recovery-code" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (recovery.trim()) void verify(recovery.trim().toUpperCase(), "recovery-code");
              }}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
            >
              <Label htmlFor="recovery" className="text-xs font-medium text-slate-700">
                Enter a single-use recovery code
              </Label>
              <Input
                id="recovery"
                value={recovery}
                onChange={(e) => setRecovery(e.target.value)}
                placeholder="e.g. 4F7A-9K2Q"
                autoComplete="off"
                className="mt-3 h-10 rounded-lg font-mono uppercase tracking-wider"
              />
              <p className="mt-2 text-[11px] text-slate-400">You have 8 of 10 codes remaining. Each code works once.</p>
              <Button type="submit" disabled={!recovery.trim() || phase === "verifying" || expired} className="mt-3 h-10 w-full rounded-lg text-sm">
                {phase === "verifying" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Verifying…
                  </>
                ) : (
                  "Verify recovery code"
                )}
              </Button>
            </form>
          )}

          {(method === "push" || method === "passkey") && phase === "waiting" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
              {method === "push" ? <Smartphone className="mx-auto h-8 w-8 text-blue-600" aria-hidden /> : <Fingerprint className="mx-auto h-8 w-8 text-blue-600" aria-hidden />}
              <p className="mt-3 text-sm font-semibold text-slate-900">{method === "push" ? "Send a push approval" : "Use your passkey"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {method === "push" ? "We'll notify your iPhone 15 Pro. Approve to continue." : "Biometric or security key — phishing-resistant."}
              </p>
              <Button onClick={method === "push" ? startPush : startPasskey} className="mt-4 h-10 w-full rounded-lg text-sm">
                {method === "push" ? "Send push approval" : "Continue with passkey"}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          )}

          {/* Alternative methods */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Verify another way
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {METHOD_META.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMethod(m.id);
                    setAlert(null);
                    setCode("");
                    setRecovery("");
                  }}
                  aria-pressed={method === m.id}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors duration-150",
                    method === m.id ? "border-blue-200 bg-blue-50/60" : "border-transparent bg-white hover:border-slate-200 hover:bg-white",
                  )}
                >
                  <m.icon className={cn("mt-0.5 h-4 w-4 shrink-0", method === m.id ? "text-blue-600" : "text-slate-400")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-medium text-slate-800">{m.label}</span>
                    <span className="block truncate text-[10.5px] text-slate-400">{m.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-[10.5px] text-slate-400">Verification attempts are limited; challenges expire in 5 minutes.</span>
        <button
          type="button"
          onClick={() => toast({ title: "MFA help", description: "Lost your device? IT support can reset your factors after identity proofing." })}
          className="text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          Lost your device?
        </button>
      </div>
    </AuthFrame>
  );
}

function PushWaiting({ onCancel, resendIn, onResend }: { onCancel: () => void; resendIn: number; onResend: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-blue-100 bg-blue-50">
        <Smartphone className="h-6 w-6 text-blue-600" aria-hidden />
        <span className="absolute inset-0 animate-ping rounded-full border border-blue-200 opacity-40" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-900">Check your iPhone 15 Pro</p>
      <p className="mx-auto mt-1 max-w-[260px] text-xs text-muted-foreground">
        Approve the sign-in attempt from Mumbai. The request expires with the challenge countdown.
      </p>
      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-400" aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Waiting for your approval…
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        <Button variant="ghost" size="sm" className="h-8" onClick={onCancel}>
          Use another method
        </Button>
        <Button variant="outline" size="sm" className="h-8" disabled={resendIn > 0} onClick={onResend}>
          {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend push"}
        </Button>
      </div>
    </div>
  );
}

function alertBody(code: string): string {
  switch (code) {
    case "too_many_attempts":
      return "For safety this request was invalidated. Start the sign-in again — your account is protected by rate limiting.";
    case "expired":
      return "Verification requests last 5 minutes. Request a fresh challenge from the sign-in screen.";
    case "invalid_code":
    default:
      return "Codes refresh every 30 seconds. Make sure you're using the current code for Qubit One.";
  }
}
