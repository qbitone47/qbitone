"use client";

import * as React from "react";
import { ArrowRight, Eye, EyeOff, Fingerprint, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiPost } from "@/lib/qubit/api";
import { useQubitNav } from "../nav-context";
import { AuthAlert, AuthFrame, AuthSecondary, AuthSteps, SimulatePicker } from "../auth/auth-frame";

// ============================================================
// Screen 31 · Login
// Enterprise authentication entry point — password, SSO and
// passkey. Validation, lockout and rate limiting live on the
// server; this form never decides whether credentials are good.
// ============================================================

interface LoginResponse {
  ok: true;
  next: "mfa";
  challengeId: string;
  maskedEmail: string;
  expiresInSeconds: number;
  methods: string[];
  demoAuthenticatorCode?: string;
}

const SIM_OPTIONS = [
  { value: "none", label: "Normal sign-in" },
  { value: "invalid-credentials", label: "Invalid credentials" },
  { value: "account-locked", label: "Account locked" },
  { value: "account-disabled", label: "Account disabled" },
  { value: "rate-limited", label: "Rate limited" },
  { value: "network-failure", label: "Network failure" },
  { value: "service-unavailable", label: "Service unavailable" },
];

export function LoginScreen() {
  const { navigate } = useQubitNav();
  const { toast } = useToast();

  const [email, setEmail] = React.useState("sagar.singh@qubitone.in");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<{ title: string; body: string } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [passkeyWaiting, setPasskeyWaiting] = React.useState(false);
  const [simulate, setSimulate] = React.useState("none");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setEmailError(null);
    setPasswordError(null);

    // Client-side convenience checks only — the server re-validates.
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!emailOk) {
      setEmailError("Enter a valid work email address.");
      return;
    }
    if (!password) {
      setPasswordError("Enter your password to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost<LoginResponse>("/auth/login", { email, password, simulate: simulate === "none" ? undefined : simulate });
      toast({ title: "Password verified", description: "Complete two-step verification to continue." });
      navigate("mfa-verification", { challengeId: res.challengeId, demoCode: res.demoAuthenticatorCode });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      setBanner({ title: message, body: bannerBody(simulate) });
    } finally {
      setSubmitting(false);
    }
  };

  const startPasskey = () => {
    setPasskeyWaiting(true);
    // Simulated platform passkey ceremony — real deployments call
    // the WebAuthn API and the server verifies the assertion.
    window.setTimeout(() => {
      setPasskeyWaiting(false);
      toast({
        title: "Signed in with passkey",
        description: "Passkeys are phishing-resistant and satisfy MFA in one step.",
      });
      navigate("security-center");
    }, 1800);
  };

  return (
    <AuthFrame>
      <div className="mb-6 space-y-3">
        <AuthSteps current={1} />
        <div>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-slate-900">Sign in</h2>
          <p className="mt-1 text-[13.5px] text-slate-500">Use your work account to continue to Qubit One.</p>
        </div>
      </div>

      {banner && (
        <AuthAlert
          tone={simulate === "service-unavailable" || simulate === "network-failure" ? "warning" : "error"}
          title={banner.title}
          className="mb-4"
        >
          {banner.body}
          {simulate === "service-unavailable" && (
            <p className="mt-1 text-[11px] text-slate-500">
              Nothing was verified and no session was created — you can safely retry.
            </p>
          )}
        </AuthAlert>
      )}

      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-email" className="text-xs font-medium text-slate-700">
            Work email
          </Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@qubitone.in"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? "login-email-error" : undefined}
            className="h-10 rounded-lg border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
          />
          {emailError && (
            <p id="login-email-error" role="alert" className="text-[11.5px] font-medium text-red-600">
              {emailError}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" className="text-xs font-medium text-slate-700">
              Password
            </Label>
            <button
              type="button"
              onClick={() => navigate("password-recovery")}
              className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? "login-password-error" : undefined}
              className="h-10 rounded-lg border-slate-200 bg-white pr-10 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
          {passwordError && (
            <p id="login-password-error" role="alert" className="text-[11.5px] font-medium text-red-600">
              {passwordError}
            </p>
          )}
        </div>

        <Button type="submit" disabled={submitting} className="h-10 w-full rounded-lg text-sm">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3" role="separator" aria-label="Or continue with">
        <span className="h-px flex-1 bg-slate-200" aria-hidden />
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">or</span>
        <span className="h-px flex-1 bg-slate-200" aria-hidden />
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("sso-provider-selection")}
          className="h-10 w-full justify-center rounded-lg text-sm"
        >
          <LockKeyhole className="h-4 w-4 text-slate-400" aria-hidden />
          Continue with enterprise SSO
        </Button>
        <Button type="button" variant="outline" onClick={startPasskey} disabled={passkeyWaiting} className="h-10 w-full justify-center rounded-lg text-sm">
          {passkeyWaiting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Follow the prompt on your device…
            </>
          ) : (
            <>
              <Fingerprint className="h-4 w-4 text-slate-400" aria-hidden />
              Use a passkey
            </>
          )}
        </Button>
        {passkeyWaiting && (
          <p className="text-center text-[11px] text-slate-400" aria-live="polite">
            Waiting for your device — no password is shared with Qubit One.
          </p>
        )}
      </div>

      <AuthSecondary className="mt-6">
        <p className="text-xs text-slate-500">
          New device? You'll verify with MFA before the workspace opens.
        </p>
      </AuthSecondary>

      <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-4">
        <SimulatePicker label="Demo states" value={simulate} onChange={setSimulate} options={SIM_OPTIONS} />
        <button
          type="button"
          onClick={() => toast({ title: "IT support", description: "Internal ticket · SLA 4h · support@qubitone.in" })}
          className="text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          Contact IT support
        </button>
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-slate-400">
        For your protection, Qubit One never reveals whether an email address has an account. Locked or disabled accounts are handled by IT.
      </p>
    </AuthFrame>
  );
}

function bannerBody(simulate: string): string {
  switch (simulate) {
    case "account-locked":
      return "Repeated failed attempts locked this account. An administrator can restore access — or reset your password to unlock it.";
    case "account-disabled":
      return "This account is no longer active in the organization. Contact IT support if you believe this is a mistake.";
    case "rate-limited":
      return "Too many attempts from this device. Sign-in is paused for 10 minutes before you can try again.";
    case "network-failure":
      return "Your request didn't reach the authentication service. Nothing was verified — check your connection and retry.";
    case "service-unavailable":
      return "The authentication service is temporarily unavailable. Your credentials were not checked and no session was created.";
    case "invalid-credentials":
    default:
      return "Check that your email and password are correct. Caps Lock and keyboard layout are common causes.";
  }
}
