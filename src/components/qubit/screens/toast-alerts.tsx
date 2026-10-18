"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
// Screen 28 · Toast & Alerts
// Transient feedback vs persistent system messaging.
// All demos fire the app's real toast system (bottom-right stack).
// ============================================================

type Tone = "emerald" | "blue" | "amber" | "red";

const CHIP: Record<Tone, { chip: string; dot: string }> = {
  emerald: { chip: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  blue: { chip: "border-blue-200 bg-blue-50 text-blue-700", dot: "bg-blue-600" },
  amber: { chip: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  red: { chip: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500" },
};

/** Small specimen chip that names the semantic tone (icon/text, never color-only). */
function ToneChip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium", CHIP[tone].chip)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", CHIP[tone].dot)} aria-hidden />
      {children}
    </span>
  );
}

/** Numbered anatomy callout beside the toast specimen. */
function AnatomyCallout({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white"
      >
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{children}</p>
      </div>
    </li>
  );
}

/** A one-off wired toast demo cell: tone chip + firing button + when-to-use line. */
function ToastDemoCell({
  tone,
  chipLabel,
  buttonLabel,
  icon,
  use,
  onFire,
}: {
  tone: Tone;
  chipLabel: string;
  buttonLabel: string;
  icon: React.ReactNode;
  use: string;
  onFire: () => void;
}) {
  const iconColor = tone === "emerald" ? "text-emerald-600" : tone === "blue" ? "text-blue-600" : tone === "amber" ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <ToneChip tone={tone}>{chipLabel}</ToneChip>
      <Button variant="outline" size="sm" className="w-fit" onClick={onFire}>
        <span className={cn("[&_svg]:h-4 [&_svg]:w-4", iconColor)}>{icon}</span>
        {buttonLabel}
      </Button>
      <p className="text-xs leading-relaxed text-slate-400">{use}</p>
    </div>
  );
}

export function ToastAlertsScreen() {
  const { toast } = useToast();

  const fireSuccess = () =>
    toast({
      title: "Department created successfully.",
      description: "Engineering is now visible in the org structure.",
    });

  const fireInfo = () =>
    toast({
      title: "Changes saved.",
    });

  const fireWarning = () =>
    toast({
      title: "Connection requires attention.",
      description: "Salesforce sync failed 3 times in the last hour.",
    });

  const fireError = () =>
    toast({
      variant: "destructive",
      title: "Unable to save changes.",
      description: "Your network connection was interrupted. Try again.",
    });

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Toast & Alerts"
        description="Transient feedback and persistent system messaging."
      />

      <div className="space-y-6">
        {/* ——— 1 · Toast types ——— */}
        <DSSection
          title="Toast types"
          purpose="Four semantic toasts, wired to the app's real toast system — fire one and watch the stack."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ToastDemoCell
              tone="emerald"
              chipLabel="Success"
              buttonLabel="Success toast"
              icon={<CheckCircle2 />}
              use="After a create, update or delete lands — confirm the object by name."
              onFire={fireSuccess}
            />
            <ToastDemoCell
              tone="blue"
              chipLabel="Information"
              buttonLabel="Info toast"
              icon={<Info />}
              use="Neutral acknowledgements where the title alone is enough."
              onFire={fireInfo}
            />
            <ToastDemoCell
              tone="amber"
              chipLabel="Warning"
              buttonLabel="Warning toast"
              icon={<AlertTriangle />}
              use="Degraded-but-working states worth knowing about — link to the fix."
              onFire={fireWarning}
            />
            <ToastDemoCell
              tone="red"
              chipLabel="Error"
              buttonLabel="Error toast"
              icon={<XCircle />}
              use="A user action just failed — say why and what to try next."
              onFire={fireError}
            />
          </div>

          {/* Anatomy — static specimen matching the real toast chrome */}
          <div className="mt-6 grid gap-5 lg:grid-cols-[340px_1fr]">
            <div className="relative rounded-md border border-slate-200 bg-white p-4 pr-8 shadow-lg">
              <button
                type="button"
                aria-label="Close toast (specimen)"
                onClick={() => toast({ title: "Close (demo)", description: "The real close button dismisses the toast immediately." })}
                className="absolute right-1.5 top-1.5 rounded-md p-1 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
              <p className="flex items-start gap-2 text-sm font-semibold text-slate-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <span>
                  Department created successfully.
                  <span className="mt-1 block text-xs font-normal leading-relaxed text-slate-500">
                    Engineering is now visible in the org structure.
                  </span>
                </span>
              </p>
            </div>
            <ol className="flex flex-col gap-4 rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 md:p-5">
              <AnatomyCallout n={1} title="Type icon">
                Carries the semantic tone — emerald success, blue info, amber warning, red error —
                always with text, never color-only.
              </AnatomyCallout>
              <AnatomyCallout n={2} title="Title">
                One line, outcome-first: “Department created successfully.”, never “Done!”.
              </AnatomyCallout>
              <AnatomyCallout n={3} title="Description">
                Optional supporting detail. Omit when the title is self-sufficient (“Changes saved.”).
              </AnatomyCallout>
              <AnatomyCallout n={4} title="Close">
                Manual dismissal and swipe-away on touch. Auto-dismisses after ~5s.
              </AnatomyCallout>
            </ol>
          </div>
          <DSCaption className="mt-3">
            Placement: stacks bottom-right on desktop, drops from the top on mobile; announced via
            aria-live so screen readers hear it without a focus change.
          </DSCaption>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "Stack limit — newest replaces, never floods",
              "Auto-dismiss ~5s",
              "Swipe / close to dismiss early",
              "Pause while hovered",
            ].map((f) => (
              <span
                key={f}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500"
              >
                {f}
              </span>
            ))}
          </div>
        </DSSection>

        {/* ——— 2 · Alerts ——— */}
        <DSSection
          title="Alerts"
          purpose="Persistent, in-context messaging for conditions the user must remain aware of."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <DSExample label="Inline alert — contextual, sits with its subject inside a section">
              <Alert className="border-blue-200 bg-blue-50/60 text-blue-800">
                <Info className="text-blue-600" />
                <AlertTitle>Integration update available</AlertTitle>
                <AlertDescription className="text-blue-700/90">
                  Salesforce connector v2.1 is ready to install.
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1 border-blue-200 bg-white text-blue-700 hover:bg-blue-100/60 hover:text-blue-800"
                    onClick={() => toast({ title: "Installing Salesforce v2.1 (demo)", description: "The connector updates in place; syncs resume automatically." })}
                  >
                    Install update
                  </Button>
                </AlertDescription>
              </Alert>
            </DSExample>

            <DSExample label="Page alert — one per page, above content, demands attention">
              <Alert variant="destructive" className="border-red-200 bg-red-50/70">
                <AlertTriangle className="text-red-600" />
                <AlertTitle className="text-red-800">Payroll sync failed</AlertTitle>
                <AlertDescription className="text-red-700/90">
                  12 records require review before Friday.
                  <Button
                    size="sm"
                    className="mt-1 bg-red-600 text-white hover:bg-red-700"
                    onClick={() => toast({ title: "Opening payroll review (demo)", description: "Filters payroll records to the 12 that failed validation." })}
                  >
                    Review records
                  </Button>
                </AlertDescription>
              </Alert>
            </DSExample>

            <DSExample label="System alert — platform-wide notice, muted, no urgency">
              <Alert className="border-slate-200 bg-slate-50 text-slate-700">
                <Info className="text-slate-500" />
                <AlertTitle className="text-slate-800">Scheduled maintenance</AlertTitle>
                <AlertDescription className="text-slate-600">
                  Qubit One will be read-only on Sunday 02:00–04:00 IST. Plan exports and approvals
                  around the window.
                </AlertDescription>
              </Alert>
            </DSExample>

            <DSExample label="Critical alert — strong accent, deadline-bound, action inside">
              <Alert variant="destructive" className="border-l-4 border-l-red-600 border-red-200 bg-red-50/70">
                <ShieldAlert className="text-red-600" />
                <AlertTitle className="text-red-800">Security policy violation</AlertTitle>
                <AlertDescription className="text-red-700/90">
                  3 users have unused admin access. Revoke by 24 Oct 2026.
                  <Button
                    size="sm"
                    className="mt-1 bg-red-600 text-white hover:bg-red-700"
                    onClick={() => toast({ title: "Revoking admin access (demo)", description: "Opens the 3 flagged accounts with a one-click revoke per user." })}
                  >
                    Revoke access
                  </Button>
                </AlertDescription>
              </Alert>
            </DSExample>
          </div>
        </DSSection>

        {/* ——— 3 · Toast vs alert ——— */}
        <DSSection
          title="Toast vs alert"
          purpose="Pick by lifetime, not by severity — transient feedback toasts, standing conditions alert."
        >
          <DSTokenTable
            head={["Dimension", "Toast", "Alert"]}
            rows={[
              ["Purpose", "Short-lived confirmation or feedback right after an action", "Must-remain-visible information requiring awareness or action"],
              ["Lifetime", <>Auto-dismisses after ~5s; swipe or <DSVar>Close</DSVar> ends it early</>, "Persists in context until the condition is resolved"],
              ["Action", "None required — at most an optional Undo / View link", "Often carries the exact action that resolves it"],
              ["Placement", "Viewport-level stack, bottom-right (top on mobile)", "Lives inside the page region the condition applies to"],
              ["Announcement", <>Passive <DSVar>aria-live</DSVar> status region</>, <><DSVar>role=alert</DSVar> for immediate; <DSVar>role=note</DSVar> for standing</>],
            ]}
          />
        </DSSection>

        {/* ——— 4 · Rules ——— */}
        <DSSection title="Rules" purpose="What each pattern is for — and where teams usually go wrong.">
          <div className="grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="Toast after success, alert for standing conditions, specific titles">
              Confirm completed actions with toasts (“Department created successfully.”), reserve
              alerts for conditions that persist until someone acts, and make every title specific —
              name the object and the outcome, never “Done!” or “Warning!”.
            </DSGuidance>
            <DSGuidance kind="dont" title="Toast spam, trivial alerts, required actions in toasts">
              Never fire multiple toasts for one action or for every row of a bulk edit; don’t alert
              on things a toast already confirmed; and never put the only path to a required action
              inside a toast — it disappears in ~5 seconds.
            </DSGuidance>
          </div>
          <DSStage align="center" className="mt-4">
            <p className="max-w-2xl text-center text-xs leading-relaxed text-slate-500">
              Rule of thumb: if the user can safely ignore it, it’s a <DSVar>toast</DSVar>; if ignoring
              it has a consequence by a deadline, it’s an <DSVar>alert</DSVar>.
            </p>
          </DSStage>
        </DSSection>

        <DSScreenNav id="toast-alerts" />
      </div>
    </>
  );
}
