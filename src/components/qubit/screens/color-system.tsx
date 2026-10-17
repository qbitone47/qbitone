"use client";

import * as React from "react";
import { Building2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getEmployee } from "@/lib/qubit/data";
import { ArrowLink, Avatar, IconTile, StatusBadge } from "../primitives";
import { PageHeader } from "../page-header";
import {
  DSCaption,
  DSExample,
  DSGuidance,
  DSSection,
  DSSpec,
  DSStage,
  DSVar,
  DSScreenNav,
} from "../ds/doc";

// ============================================================
// Screen 15 — Color System
// Qubit One color language: brand blue, heritage navy, cool
// neutrals, four semantic hues — and the rules that restrain them.
// ============================================================

interface RampStep {
  step: number;
  hex: string;
  role?: string;
}

const BLUE_RAMP: RampStep[] = [
  { step: 50, hex: "#EFF6FF", role: "Selected tints" },
  { step: 100, hex: "#DBEAFE" },
  { step: 200, hex: "#BFDBFE", role: "Hover washes" },
  { step: 300, hex: "#93C5FD" },
  { step: 400, hex: "#60A5FA" },
  { step: 500, hex: "#3B82F6", role: "Charts, accents" },
  { step: 600, hex: "#2563EB", role: "Primary actions · links" },
  { step: 700, hex: "#1D4ED8", role: "Hover text" },
  { step: 800, hex: "#1E40AF", role: "Pressed text" },
  { step: 900, hex: "#1E3A8A" },
];

const NAVY_RAMP: RampStep[] = [
  { step: 50, hex: "#F2F6FB" },
  { step: 100, hex: "#E4EBF5" },
  { step: 200, hex: "#C3D2E8" },
  { step: 300, hex: "#93ABCE" },
  { step: 400, hex: "#5D7FAF" },
  { step: 500, hex: "#3A5E92" },
  { step: 600, hex: "#2B4A78" },
  { step: 700, hex: "#223A60" },
  { step: 800, hex: "#16294A", role: "Executive badges" },
  { step: 900, hex: "#0D1B33", role: "Sidebar · brand mark" },
  { step: 950, hex: "#071122" },
];

const SLATE_RAMP: RampStep[] = [
  { step: 50, hex: "#F8FAFC", role: "Surface subtle" },
  { step: 100, hex: "#F1F5F9", role: "Wells, hovers" },
  { step: 200, hex: "#E2E8F0", role: "Border default" },
  { step: 300, hex: "#CBD5E1", role: "Border strong" },
  { step: 400, hex: "#94A3B8", role: "Text muted" },
  { step: 500, hex: "#64748B" },
  { step: 600, hex: "#475569", role: "Text secondary" },
  { step: 700, hex: "#334155" },
  { step: 800, hex: "#1E293B" },
  { step: 900, hex: "#0F172A", role: "Text primary" },
];

/** One clickable ramp card — block, mono hex, token name, optional role. */
function SwatchCard({
  token,
  hex,
  role,
  onCopy,
}: {
  token: string;
  hex: string;
  role?: string;
  onCopy: (token: string, hex: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(token, hex)}
      aria-label={`Copy ${token} — ${hex}`}
      className="group overflow-hidden rounded-lg border border-slate-200/90 bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors duration-150 hover:border-blue-200 focus-visible:border-blue-300"
    >
      <span aria-hidden className="block h-11 w-full border-b border-slate-100" style={{ backgroundColor: hex }} />
      <span className="block px-2 py-1.5">
        <span className="block font-mono text-[11px] text-slate-700">{hex}</span>
        <span className="block truncate font-mono text-[10px] text-slate-400">{token}</span>
        {role ? (
          <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-500">{role}</span>
        ) : (
          <span className="mt-0.5 block h-[13px]" aria-hidden />
        )}
      </span>
    </button>
  );
}

function Ramp({ prefix, steps, onCopy, cols }: { prefix: string; steps: RampStep[]; onCopy: (token: string, hex: string) => void; cols: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", cols)}>
      {steps.map((s) => (
        <SwatchCard
          key={s.step}
          token={`${prefix}.${s.step}`}
          hex={s.hex}
          role={s.role}
          onCopy={onCopy}
        />
      ))}
    </div>
  );
}

/** Quiet rule strip used under each ramp. */
function RuleStrip({
  tone,
  children,
}: {
  tone: "blue" | "navy" | "slate";
  children: React.ReactNode;
}) {
  const tones = {
    blue: "border-blue-200/80 bg-blue-50/60 text-blue-800",
    navy: "border-navy-200 bg-navy-50 text-navy-800",
    slate: "border-slate-200/90 bg-slate-50 text-slate-700",
  } as const;
  return (
    <p className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed", tones[tone])}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function ColorSystemScreen() {
  const { toast } = useToast();
  const financeHead = getEmployee("priya")!;

  const copyColor = (token: string, hex: string) => {
    try {
      void navigator.clipboard?.writeText(hex);
    } catch {
      /* clipboard unavailable in this context — the toast still confirms the value */
    }
    toast({
      title: `${token} copied`,
      description: `${hex} — paste into specs, review notes or theme files.`,
    });
  };

  const demoAction = (what: string) =>
    toast({
      title: `Specimen — ${what}`,
      description: "Live component rendered with system tokens. See Buttons (16) for full states.",
    });

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Color System"
        description="Qubit One color language — brand, neutrals and semantics."
      />

      <div className="space-y-6">
        {/* ————— 1. Qubit Blue ————— */}
        <DSSection
          title="Qubit Blue — brand"
          purpose="color.primary.* — one hue owns interaction: actions, active states, links and selection."
        >
          <div className="space-y-4">
            <Ramp prefix="color.primary" steps={BLUE_RAMP} onCopy={copyColor} cols="md:grid-cols-5" />
            <RuleStrip tone="blue">
              <span className="font-semibold">Blue marks interaction and hierarchy</span> — 600 for
              primary actions, active states and links; 50 for selected tints; 700–800 for hover and
              pressed text. Never a decorative wash, never a large background area.
            </RuleStrip>
            <p className="text-xs leading-relaxed text-slate-500">
              On any screen there is exactly one solid blue-600 surface: the primary action. If
              everything is blue, nothing is actionable.
            </p>
          </div>
        </DSSection>

        {/* ————— 2. Deep Navy ————— */}
        <DSSection
          title="Deep Navy — brand heritage"
          purpose="color.navy.* — the brand's dark neutral for identity moments, not for interaction."
        >
          <div className="space-y-4">
            <Ramp prefix="color.navy" steps={NAVY_RAMP} onCopy={copyColor} cols="md:grid-cols-6" />
            <RuleStrip tone="navy">
              <span className="font-semibold">Navy is the brand's dark neutral</span> — the brand
              mark, executive badges, sidebar surfaces and preview chrome. It is not the default
              accent; when a choice exists, reach for blue first.
            </RuleStrip>
          </div>
        </DSSection>

        {/* ————— 3. Neutrals ————— */}
        <DSSection
          title="Neutrals"
          purpose="color.gray.* on a cool slate undertone — surfaces, borders and text that carry 90% of every screen."
        >
          <div className="space-y-4">
            <Ramp prefix="color.gray" steps={SLATE_RAMP} onCopy={copyColor} cols="md:grid-cols-5" />

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                Surface roles
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200/90 p-3" style={{ backgroundColor: "#F5F7FB" }}>
                  <p className="font-mono text-[11px] text-slate-600">#F5F7FB · color.surface.workspace</p>
                  <p className="mt-1 text-xs text-slate-600">App background behind every card</p>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-white p-3">
                  <p className="font-mono text-[11px] text-slate-600">#FFFFFF · color.surface.default</p>
                  <p className="mt-1 text-xs text-slate-600">Cards, panels, dialogs, drawers</p>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-slate-50 p-3">
                  <p className="font-mono text-[11px] text-slate-600">#F8FAFC · color.surface.subtle</p>
                  <p className="mt-1 text-xs text-slate-600">Table headers, wells, hover fills</p>
                </div>
                <div className="rounded-xl border-2 border-slate-200/90 bg-white p-3">
                  <p className="font-mono text-[11px] text-slate-600">1px slate-200/90 · color.border.default</p>
                  <p className="mt-1 text-xs text-slate-600">Cards, inputs, dividers, chips</p>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-white p-3">
                  <p className="text-[13px] font-semibold text-slate-900">Primary · slate-900</p>
                  <p className="text-[13px] text-slate-600">Secondary · slate-600</p>
                  <p className="text-[13px] text-slate-400">Muted · slate-400</p>
                </div>
              </div>
            </div>

            <RuleStrip tone="slate">
              <span className="font-semibold">Cool-gray undertone</span> — every neutral leans
              slightly blue (slate, never warm gray) so white cards sit naturally on the{" "}
              <DSVar>#F5F7FB</DSVar> workspace without visible seams.
            </RuleStrip>
          </div>
        </DSSection>

        {/* ————— 4. Semantic colors ————— */}
        <DSSection
          title="Semantic colors"
          purpose="Four hues with fixed meanings — success, warning, error, information — never used decoratively."
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex flex-col rounded-xl border border-slate-200/90 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <span aria-hidden className="h-9 w-9 shrink-0 rounded-lg bg-emerald-600" />
                  <div className="min-w-0 text-right">
                    <p className="text-[13px] font-semibold text-slate-900">Success</p>
                    <p className="font-mono text-[10px] text-slate-400">color.success.600</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-600">
                  Completed, active, connected — confirmation that a state is good.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <StatusBadge status="Active" />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  Use sparingly — success is the absence of problems, not decoration.
                </p>
              </div>

              <div className="flex flex-col rounded-xl border border-slate-200/90 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <span aria-hidden className="h-9 w-9 shrink-0 rounded-lg bg-amber-500" />
                  <div className="min-w-0 text-right">
                    <p className="text-[13px] font-semibold text-slate-900">Warning</p>
                    <p className="font-mono text-[10px] text-slate-400">color.warning.600</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-600">
                  Needs attention without being a failure — pending review, nearing a limit.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <StatusBadge status="Warning" />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  Always pair with the next action or an explanation of the risk.
                </p>
              </div>

              <div className="flex flex-col rounded-xl border border-slate-200/90 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <span aria-hidden className="h-9 w-9 shrink-0 rounded-lg bg-red-600" />
                  <div className="min-w-0 text-right">
                    <p className="text-[13px] font-semibold text-slate-900">Error</p>
                    <p className="font-mono text-[10px] text-slate-400">color.error.600</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-600">
                  Failure states and destructive actions — nothing else.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <Button variant="destructive" size="sm" className="h-8" onClick={() => demoAction("Reject")}>
                    Reject
                  </Button>
                  <StatusBadge status="Disconnected" size="sm" />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  Never for emphasis. Irreversible actions confirm first (Alert Dialog).
                </p>
              </div>

              <div className="flex flex-col rounded-xl border border-slate-200/90 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <span aria-hidden className="h-9 w-9 shrink-0 rounded-lg bg-blue-600" />
                  <div className="min-w-0 text-right">
                    <p className="text-[13px] font-semibold text-slate-900">Information</p>
                    <p className="font-mono text-[10px] text-slate-400">color.info.600</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-600">
                  Neutral system messaging the user should notice but not act on.
                </p>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="flex items-start gap-2 rounded-lg border border-blue-200/80 bg-blue-50/60 px-3 py-2 text-xs text-blue-800">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    Integration sync completed 2 minutes ago.
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  Shares the brand hue — keep info tints quieter than primary actions.
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-500">
              Status is never color-only: badges pair a dot with a label, alerts carry an icon and
              text. See Status System (24) for the full vocabulary.
            </p>
          </div>
        </DSSection>

        {/* ————— 5. Interactive states ————— */}
        <DSSection
          title="Interactive states"
          purpose="One button, six states — the blue ramp stepped by interaction, never recolored."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
              <DSExample label="Default" center>
                <span
                  aria-hidden
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                >
                  Save
                </span>
              </DSExample>
              <DSExample label="Hover — blue-700" center>
                <span
                  aria-hidden
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-700 px-4 text-[13px] font-medium text-white"
                >
                  Save
                </span>
              </DSExample>
              <DSExample label="Pressed — blue-800" center>
                <span
                  aria-hidden
                  className="inline-flex h-9 translate-y-px items-center justify-center rounded-lg bg-blue-800 px-4 text-[13px] font-medium text-white"
                >
                  Save
                </span>
              </DSExample>
              <DSExample label="Focused — 2px ring, offset 2" center>
                <span
                  aria-hidden
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white ring-2 ring-blue-200 ring-offset-2"
                >
                  Save
                </span>
              </DSExample>
              <DSExample label="Disabled — opacity-50" center>
                <span
                  aria-hidden
                  className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white opacity-50"
                >
                  Save
                </span>
              </DSExample>
              <DSExample label="Tint selected — blue-50/700" center>
                <span
                  aria-hidden
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 text-[13px] font-medium text-blue-700"
                >
                  Save
                </span>
              </DSExample>
            </div>

            <DSStage variant="tinted" align="center" className="gap-4">
              <Button size="sm" className="h-9" onClick={() => demoAction("Save changes (live)")}>
                Save changes
              </Button>
              <DSCaption className="mt-0">Live — hover, press and tab through it</DSCaption>
            </DSStage>

            <p className="text-xs leading-relaxed text-slate-500">
              Disabled keeps the brand hue at 50% opacity rather than switching to gray — the button
              must still read as itself. Focus is always the global 2px{" "}
              <DSVar>#2563EB</DSVar> ring with offset 2, never a shadow substitute.
            </p>
          </div>
        </DSSection>

        {/* ————— 6. Color in context ————— */}
        <DSSection
          title="Color in context"
          purpose="One strip, every role — color as hierarchy, not decoration."
        >
          <DSStage variant="tinted">
            <DSExample
              className="w-full"
              label="One primary action, one link, meaning-carrying badges, quiet identity surfaces — nothing decorative."
            >
              <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <Button size="sm" className="h-9" onClick={() => demoAction("Save Changes")}>
                  Save Changes
                </Button>
                <ArrowLink onClick={() => demoAction("View details")}>View details</ArrowLink>
                <StatusBadge status="Pending" />
                <Badge
                  variant="outline"
                  className="rounded-full border-amber-200 bg-amber-50 font-medium text-amber-700"
                >
                  Confidential
                </Badge>
                <span className="flex items-center gap-2.5">
                  <IconTile icon={<Building2 aria-hidden />} tone="blue" size="md" />
                  <span className="text-[13px] font-medium text-slate-800">Finance</span>
                </span>
                <span className="flex items-center gap-2.5">
                  <Avatar name={financeHead.name} size="md" />
                  <span className="text-[13px] text-slate-600">{financeHead.name}</span>
                </span>
              </div>
            </DSExample>
          </DSStage>
        </DSSection>

        {/* ————— Guidance + governance ————— */}
        <div className="grid gap-4 md:grid-cols-2">
          <DSGuidance kind="do" title="meaning-driven color, 90% neutral surfaces">
            Neutral slate and white carry the layout; color appears only where it means something —
            an action, a status, an identity moment. When unsure whether a surface needs color, it
            doesn't.
          </DSGuidance>
          <DSGuidance kind="dont" title="colorful sections, rainbow badges, orange as brand, status pills brighter than primary actions">
            Never tint whole sections to &quot;add life&quot;, never stack multicolor badges on one
            row, and never let a status pill outshine the primary button — hierarchy is the whole
            point of the system.
          </DSGuidance>
        </div>

        <DSSection
          title="Governance"
          purpose="The rules reviewers apply to color in every Qubit One screen."
        >
          <DSSpec
            rows={[
              {
                label: "Purpose",
                value:
                  "One color language — brand blue for interaction, navy for heritage identity, cool neutrals for surfaces and text, four semantic hues for state.",
              },
              {
                label: "Use when",
                value:
                  "Choosing any color: interaction → blue, identity/heritage → navy, surfaces and text → slate, state → the semantic four. Token names only, never raw hex in screens.",
              },
              {
                label: "Avoid when",
                value:
                  "Decorating. Color is never filler — if a surface carries no meaning, it stays neutral. No new hues without design-system review.",
              },
              {
                label: "States",
                value:
                  "Hover/pressed step down the blue ramp (600 → 700 → 800); disabled is brand hue at 50% opacity; selected surfaces use blue-50 tints with blue-200 borders.",
              },
              {
                label: "Responsive",
                value:
                  "Color meaning never changes with breakpoint — dots, labels and icons travel with color at every size, and touch targets stay ≥ 44px.",
              },
              {
                label: "Accessibility",
                value:
                  "Text meets AA contrast minimums (slate-600 or darker on white; white on blue-600). Meaning is never color-only — every status pairs color with a label or icon. Focus is the visible 2px #2563EB ring.",
              },
            ]}
          />
        </DSSection>

        <DSScreenNav id="color-system" />
      </div>
    </>
  );
}
