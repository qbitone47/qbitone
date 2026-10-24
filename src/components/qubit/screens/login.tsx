"use client";

import * as React from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQubitNav } from "../nav-context";
import { AuthAlert, AuthFrame, AuthSecondary, AuthSteps } from "../auth/auth-frame";

// ============================================================
// Screen · Sign in — IAM credential login (first factor)
// Individual User ID + password. Verification, lockout and rate
// limiting live on the server (/api/iam/login); this form never
// decides whether credentials are good. On success the flow
// continues to MFA (/api/iam/mfa issues the personal session).
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

export function LoginScreen() {
  const { navigate } = useQubitNav();
  const { toast } = useToast();

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [identifierError, setIdentifierError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<{ title: string; body?: string } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setIdentifierError(null);
    setPasswordError(null);

    // Client-side convenience checks only — the server re-validates.
    if (!identifier.trim()) {
      setIdentifierError("Enter your User ID to continue.");
      return;
    }
    if (!password) {
      setPasswordError("Enter your password to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/iam/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => null)) as (LoginResponse & { message?: string }) | { code?: string; message?: string } | null;
      if (!res.ok || !body || !("challengeId" in body)) {
        const message = (body && "message" in body && body.message) || "That User ID or password doesn't match our records.";
        setBanner({ title: message });
        return;
      }
      toast({ title: "Password verified", description: "Complete two-step verification to continue." });
      navigate("mfa-verification", { challengeId: body.challengeId, demoCode: body.demoAuthenticatorCode });
    } catch {
      setBanner({ title: "Sign-in failed. Please try again.", body: "Your request didn't reach the authentication service." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFrame>
      <div className="mb-6 space-y-3">
        <AuthSteps current={1} />
        <div>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-slate-900">Sign in</h2>
          <p className="mt-1 text-[13.5px] text-slate-500">Use your individual work account to continue to Qubit One.</p>
        </div>
      </div>

      {banner && (
        <AuthAlert tone="error" title={banner.title} className="mb-4">
          {banner.body}
        </AuthAlert>
      )}

      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-identifier" className="text-xs font-medium text-slate-700">
            User ID
          </Label>
          <Input
            id="login-identifier"
            type="text"
            autoComplete="username"
            autoFocus
            placeholder="your.id or you@qubitone.in"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              if (identifierError) setIdentifierError(null);
            }}
            aria-invalid={Boolean(identifierError)}
            aria-describedby={identifierError ? "login-identifier-error" : undefined}
            className="h-10 rounded-lg border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
          />
          {identifierError && (
            <p id="login-identifier-error" role="alert" className="text-[11.5px] font-medium text-red-600">
              {identifierError}
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

      <AuthSecondary className="mt-6">
        <p className="text-xs text-slate-500">
          Every employee signs in with an individual account. You&apos;ll verify with MFA before the workspace opens.
        </p>
      </AuthSecondary>

      <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => toast({ title: "IT support", description: "Internal ticket · SLA 4h · support@qubitone.in" })}
          className="text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          Contact IT support
        </button>
        <span className="text-[10.5px] font-medium text-slate-400">Shared department logins are not permitted.</span>
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-slate-400">
        For your protection, Qubit One never reveals whether a User ID has an account. Locked or disabled accounts are handled by IT.
      </p>
    </AuthFrame>
  );
}
