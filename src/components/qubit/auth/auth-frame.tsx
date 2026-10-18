"use client";

import * as React from "react";
import { Check, Fingerprint, Info, OctagonAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPANY_EMPLOYEES, COMPANY_NAME, formatCount } from "@/lib/qubit/data";
import { useQubitNav } from "../nav-context";
import { QubitMark } from "../shell/sidebar";

// ============================================================
// Qubit One authentication frame (Phase 3 — screens 31–33).
// One shared chrome so the sign-in journey reads as the SAME
// product: deep-navy identity panel + calm white workspace.
// ============================================================

export type AuthAlertTone = "error" | "warning" | "info" | "success";

const ALERT_STYLES: Record<AuthAlertTone, { box: string; icon: React.ElementType; iconCls: string; title: string }> = {
  error: { box: "border-red-200 bg-red-50", icon: OctagonAlert, iconCls: "text-red-600", title: "text-red-800" },
  warning: { box: "border-amber-200 bg-amber-50", icon: TriangleAlert, iconCls: "text-amber-600", title: "text-amber-800" },
  info: { box: "border-blue-200 bg-blue-50", icon: Info, iconCls: "text-blue-600", title: "text-blue-800" },
  success: { box: "border-emerald-200 bg-emerald-50", icon: Check, iconCls: "text-emerald-600", title: "text-emerald-800" },
};

/** Accessible state banner — icon + title + body, never color-only. */
export function AuthAlert({
  tone,
  title,
  children,
  action,
  className,
}: {
  tone: AuthAlertTone;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const s = ALERT_STYLES[tone];
  const Icon = s.icon;
  return (
    <div role="alert" className={cn("flex gap-3 rounded-xl border p-3.5", s.box, className)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", s.iconCls)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13px] font-semibold", s.title)}>{title}</p>
        {children && <div className="mt-0.5 text-xs leading-relaxed text-slate-600">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

/** Discreet state simulation picker — the Phase 3 equivalent of the DS "Reload demo" pattern. */
export function SimulatePicker({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[11px] text-slate-400">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors hover:border-slate-300 focus:border-blue-300"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Tiny step indicator across the sign-in journey. */
export function AuthSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Sign in", "Verify", "Workspace"];
  return (
    <ol className="flex items-center gap-2" aria-label="Sign-in progress">
      {steps.map((s, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < current;
        const active = n === current;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                done && "border-emerald-200 bg-emerald-50 text-emerald-600",
                active && "border-blue-600 bg-blue-600 text-white",
                !done && !active && "border-slate-200 bg-white text-slate-400",
              )}
            >
              {done ? <Check className="h-3 w-3" aria-hidden /> : n}
            </span>
            <span className={cn("text-[11.5px] font-medium", active ? "text-slate-900" : done ? "text-slate-500" : "text-slate-400")}>{s}</span>
            {i < steps.length - 1 && <span className="h-px w-5 bg-slate-200" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

const TRUST_POINTS = [
  { icon: ShieldCheck, label: "MFA enforced", detail: "Organization policy v4.2" },
  { icon: Fingerprint, label: "Passkey ready", detail: "Phishing-resistant sign-in" },
];

/**
 * AuthFrame — split sign-in layout.
 * Left: deep navy identity panel (org context, trust points).
 * Right: the calm white form surface owned by each screen.
 */
export function AuthFrame({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  const { navigate, canBack, back } = useQubitNav();
  return (
    <div className="flex min-h-dvh bg-white">
      {/* Identity panel */}
      <aside
        className="relative hidden w-[44%] max-w-[620px] flex-col justify-between overflow-hidden bg-navy-900 p-10 text-white lg:flex"
        aria-label="Qubit One sign-in"
      >
        <div className="relative z-10 flex items-center gap-2.5">
          <QubitMark />
          <div>
            <p className="text-[15px] font-semibold leading-tight tracking-tight">Qubit One</p>
            <p className="text-[11px] leading-tight text-white/50">Enterprise OS</p>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-[26px] font-bold leading-snug tracking-[-0.02em]">
            One secure entrance to your entire enterprise.
          </h1>
          <p className="mt-3 text-[13.5px] leading-relaxed text-white/60">
            Identity, roles, permissions and audit are connected across every Qubit One module — so the right people get the right access, and every action is recorded.
          </p>

          <div className="mt-8 rounded-xl border border-white/15 bg-white/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">Signing in to</p>
            <p className="mt-1 text-sm font-semibold">{COMPANY_NAME}</p>
            <p className="mt-0.5 text-xs text-white/50">Enterprise workspace · {formatCount(COMPANY_EMPLOYEES)} employees</p>
          </div>

          <ul className="mt-6 space-y-3">
            {TRUST_POINTS.map((t) => (
              <li key={t.label} className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5">
                  <t.icon className="h-4 w-4 text-blue-300" aria-hidden />
                </span>
                <span>
                  <span className="block text-[13px] font-medium text-white/90">{t.label}</span>
                  <span className="block text-xs text-white/45">{t.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-[11px] text-white/40">
          Protected by the Qubit One Access & Security Policy · session activity is audited
        </p>

        {/* quiet depth — one restrained gradient, no decoration */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-navy-950/60 via-transparent to-blue-900/20" />
      </aside>

      {/* Form surface */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 px-5 pt-5 md:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <QubitMark className="h-7 w-7 rounded-lg text-[13px]" />
            <span className="text-[14px] font-semibold tracking-tight text-slate-900">Qubit One</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {canBack && (
              <button
                type="button"
                onClick={back}
                className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("org-structure")}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              Exit sign-in preview
            </button>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-5 py-8 md:px-8">
          <div className={cn("w-full", wide ? "max-w-[560px]" : "max-w-[400px]")}>{children}</div>
        </div>

        <footer className="px-5 pb-6 md:px-8">
          <div className="mx-auto flex max-w-[400px] flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <p>© 2026 Qubit One Pvt Ltd</p>
            <p className="flex items-center gap-3">
              <span>Privacy</span>
              <span>Terms</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                Secured session
              </span>
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

/** Secondary action row under the primary submit — "Forgot password" etc. */
export function AuthSecondary({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px]", className)}>{children}</div>;
}

/** Success state used after a completed sensitive step. */
export function AuthSuccess({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
        <Check className="h-5 w-5 text-emerald-600" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
