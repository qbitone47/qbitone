"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Building2, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SSO_PROVIDERS, type SsoProvider } from "@/lib/qubit/security-data";
import { useQubitNav } from "../nav-context";
import { AuthAlert, AuthFrame, AuthSteps, SimulatePicker, type AuthAlertTone } from "../auth/auth-frame";

// ============================================================
// Screen 33 · SSO Provider Selection
// Only providers actually configured for the organization are
// shown. When just one provider exists, selection is skipped
// with an automatic redirect (see singleProvider note below).
// ============================================================

type Phase = "select" | "redirecting" | "authenticated" | "failed";

const SIM_OPTIONS = [
  { value: "none", label: "Normal redirect" },
  { value: "config-error", label: "Configuration error" },
  { value: "auth-failure", label: "Authentication failure" },
  { value: "timeout", label: "Provider timeout" },
];

export function SsoProviderSelectionScreen() {
  const { navigate } = useQubitNav();
  const { toast } = useToast();

  const [phase, setPhase] = React.useState<Phase>("select");
  const [activeProvider, setActiveProvider] = React.useState<SsoProvider | null>(null);
  const [alert, setAlert] = React.useState<{ tone: AuthAlertTone; title: string; body: string } | null>(null);
  const [simulate, setSimulate] = React.useState("none");

  // Single-provider minimization: with one configured provider the
  // choice is made for the user (auto-redirect with a cancel window).
  const providers = SSO_PROVIDERS;

  const start = (provider: SsoProvider) => {
    setActiveProvider(provider);
    setAlert(null);
    setPhase("redirecting");
    // Simulated OIDC/SAML redirect — real deployments hand off to
    // the provider and return through the configured callback.
    window.setTimeout(() => {
      if (simulate === "config-error") {
        setPhase("failed");
        setAlert({
          tone: "error",
          title: `${provider.name} configuration error`,
          body: "Your organization's identity provider settings couldn't be read. Nothing was sent to the provider — contact IT support.",
        });
        return;
      }
      if (simulate === "timeout") {
        setPhase("failed");
        setAlert({
          tone: "warning",
          title: `${provider.name} took too long to respond`,
          body: "The redirect timed out before authentication completed. You can retry — no partial sign-in was created.",
        });
        return;
      }
      if (simulate === "auth-failure" || provider.status === "Degraded") {
        setPhase("failed");
        setAlert({
          tone: "error",
          title: `${provider.name} couldn't authenticate you`,
          body: "The provider rejected the sign-in request. Try another configured provider, or sign in with your password.",
        });
        return;
      }
      setPhase("authenticated");
      window.setTimeout(() => {
        toast({ title: `Signed in via ${provider.name}`, description: "Organization policy still requires two-step verification." });
        navigate("mfa-verification");
      }, 900);
    }, 1700);
  };

  return (
    <AuthFrame wide>
      <div className="mb-6 space-y-3">
        <AuthSteps current={1} />
        <div>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-slate-900">Sign in with your identity provider</h2>
          <p className="mt-1 text-[13.5px] text-slate-500">
            Your organization provides these enterprise sign-in methods, configured by IT.
          </p>
        </div>
        <p className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1 text-[11.5px] font-medium text-slate-500">
          <Building2 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          Qubit One Pvt Ltd · SSO workspace
        </p>
      </div>

      {alert && (
        <AuthAlert tone={alert.tone} title={alert.title} className="mb-4">
          {alert.body}
        </AuthAlert>
      )}

      {phase === "authenticated" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-6 py-10 text-center" aria-live="polite">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-white">
            <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-900">Authenticated via {activeProvider?.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">Continuing to two-step verification…</p>
        </div>
      ) : phase === "redirecting" && activeProvider ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-6 py-10 text-center" aria-live="polite">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" aria-hidden />
          <p className="mt-4 text-sm font-semibold text-slate-900">Redirecting to {activeProvider.name}…</p>
          <p className="mx-auto mt-1 max-w-[300px] text-xs text-muted-foreground">
            {activeProvider.kind === "SAML 2.0"
              ? "Starting SAML handoff — you'll authenticate on your provider's page and return here."
              : "Starting OpenID Connect handoff — you'll authenticate on your provider's page and return here."}
          </p>
          <Button variant="ghost" size="sm" className="mt-4 h-8" onClick={() => setPhase("select")}>
            Cancel
          </Button>
        </div>
      ) : (
        <>
          <ul className="space-y-2.5" aria-label="Configured identity providers">
            {providers.map((p) => {
              const degraded = p.status === "Degraded";
              return (
                <li key={p.id}>
                  <div
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors duration-150 sm:flex-row sm:items-center",
                      degraded ? "border-amber-200" : "border-slate-200 hover:border-blue-200",
                      phase === "failed" && "opacity-70",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                          degraded ? "bg-amber-50 text-amber-700" : "bg-navy-50 text-navy-700",
                        )}
                        aria-hidden
                      >
                        {p.name.slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                          {p.name}
                          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-medium text-slate-500">{p.kind}</span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
                              degraded ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
                            )}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full", degraded ? "bg-amber-500" : "bg-emerald-500")} aria-hidden />
                            {p.status}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.hint}</p>
                        <p className="mt-0.5 text-[10.5px] text-slate-400">Last used {p.lastUsed}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => start(p)}
                      disabled={phase === "failed"}
                      variant={degraded ? "outline" : "default"}
                      className="h-9 shrink-0 rounded-lg text-[13px]"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          {providers.some((p) => p.status === "Degraded") && (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-hidden />
              Degraded providers may be slow or reject sign-ins. IT has been notified.
            </p>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
            Only providers configured for Qubit One Pvt Ltd appear here. With a single configured provider, Qubit One
            starts the redirect automatically with a short cancel window — this workspace has{" "}
            {providers.length} configured.
          </p>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => navigate("login")}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Sign in with your password instead
            </button>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <SimulatePicker label="Demo states" value={simulate} onChange={setSimulate} options={SIM_OPTIONS} />
            <button
              type="button"
              onClick={() => toast({ title: "SSO help", description: "Provider configuration is managed in Settings → Identity (admin only)." })}
              className="text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700"
            >
              SSO not working?
            </button>
          </div>
        </>
      )}
    </AuthFrame>
  );
}
