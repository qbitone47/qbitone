"use client";

import * as React from "react";
import { ArrowDown, Building2, Copy, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { IconTile } from "../primitives";
import { PageHeader } from "../page-header";
import {
  DSCaption,
  DSExample,
  DSGuidance,
  DSSection,
  DSSpec,
  DSStage,
  DSVar,
  DSTokenTable,
  DSScreenNav,
} from "../ds/doc";

// ============================================================
// Screen 13 — Design Tokens
// The closed vocabulary every Qubit One screen inherits:
// color, spacing, radius, border, elevation, sizing, layout, motion.
// ============================================================

/** Small inline color chip + mono hex used inside token tables. */
function Swatch({ hex, note }: { hex: string; note?: string }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span
        aria-hidden
        className="h-4 w-4 shrink-0 rounded border border-slate-200/80"
        style={{ background: hex }}
      />
      <span className="font-mono text-[12px] text-slate-700">{hex}</span>
      {note && <span className="text-[11px] text-slate-400">{note}</span>}
    </span>
  );
}

/** Group label row rendered inside a DSTokenTable. */
function TokenGroup({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
      {children}
    </span>
  );
}

/** One step of the visual spacing scale. */
function SpaceStep({ px, step }: { px: number; step: number }) {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1.5">
      <span
        aria-hidden
        className="block h-6 rounded-[2px] border border-slate-300/80 bg-slate-200"
        style={{ width: px }}
      />
      <DSVar>{`spacing.${step}`}</DSVar>
      <DSCaption className="mt-0 font-mono">{px}px</DSCaption>
    </div>
  );
}

export function DesignTokensScreen() {
  const { toast } = useToast();
  const [boxShown, setBoxShown] = React.useState(true);

  const copyTokenNames = () => {
    const names =
      "color.primary.600 · color.text.primary · color.surface.default · color.border.default · spacing.4 · radius.md · shadow.level.1 · duration.base · z.modal · breakpoint.md";
    try {
      void navigator.clipboard?.writeText(names);
    } catch {
      /* clipboard unavailable in this context — toast still confirms the list */
    }
    toast({
      title: "10 core tokens copied",
      description: names,
    });
  };

  const replayMotion = () => {
    setBoxShown(false);
    window.setTimeout(() => setBoxShown(true), 110);
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Design Tokens"
        description="Foundational tokens — color, type, spacing, radius, elevation, motion."
        actions={
          <Button variant="outline" size="sm" className="h-9" onClick={copyTokenNames}>
            <Copy className="h-3.5 w-3.5" />
            Copy token names
          </Button>
        }
      />

      <div className="space-y-6">
        {/* ————— Governance grid (top of reference) ————— */}
        <DSSection
          title="Reference governance"
          purpose="What this reference governs, and how every Qubit One screen consumes it."
        >
          <DSSpec
            rows={[
              {
                label: "Purpose",
                value:
                  "One closed vocabulary of color, type, spacing, radius, elevation, motion and layout values shared by all 30 screens — the contract that keeps Qubit One reading as one product.",
              },
              {
                label: "Use when",
                value:
                  "Building or reviewing any screen. Pick values from these tables first; the only acceptable alternative is a token added through design-system review.",
              },
              {
                label: "Avoid when",
                value:
                  "Exploring throwaway concepts — prototype freely, then normalize every value back to tokens before the screen ships.",
              },
              {
                label: "States",
                value:
                  "Tokens are static references. Interactive state colors (hover, pressed, disabled, selected) are demonstrated in Color System (15) and Buttons (16).",
              },
              {
                label: "Responsive",
                value:
                  "Spacing and layout tokens define the mobile-first steps — page gutter moves 16 → 24 → 32 px at sm / md / lg, grids collapse to a single column.",
              },
              {
                label: "Accessibility",
                value:
                  "The focus ring token (2px #2563EB, offset 2) applies globally. Contrast rules for text and status live in Color System (15) and Accessibility (29).",
              },
            ]}
          />
        </DSSection>

        {/* ————— 1. Token architecture ————— */}
        <DSSection
          title="Token architecture"
          purpose="Three layers — primitives, semantic tokens, component tokens — and the naming rule that holds them together."
        >
          <div className="space-y-5">
            <p className="max-w-3xl text-[13.5px] leading-relaxed text-slate-600">
              Qubit One tokens are layered. Designers and engineers never touch raw values in
              screens — they consume semantic tokens, which resolve down to primitives. This keeps
              restyling (for example, deepening the brand blue) a one-file change instead of a
              30-screen sweep.
            </p>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Layer 1 · Primitives
                </p>
                <p className="mt-1.5 text-[13px] font-semibold text-slate-900">Raw scales</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  The full ramps and step scales — slate 50–900, blue 50–900, navy 50–950, the 4px
                  spacing base. Never referenced directly by screens.
                </p>
              </div>
              <div className="relative rounded-xl border border-blue-200/80 bg-blue-50/50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-blue-600">
                  Layer 2 · Semantic
                </p>
                <p className="mt-1.5 text-[13px] font-semibold text-slate-900">Role-based tokens</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  The vocabulary screens use — <DSVar>color.text.primary</DSVar>,{" "}
                  <DSVar>spacing.4</DSVar>, <DSVar>radius.md</DSVar>, <DSVar>shadow.level.1</DSVar>.
                </p>
                <ArrowDown className="absolute -top-3 left-1/2 hidden h-4 w-4 -translate-x-1/2 text-slate-300 md:hidden" aria-hidden />
              </div>
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Layer 3 · Component
                </p>
                <p className="mt-1.5 text-[13px] font-semibold text-slate-900">Component-scoped</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Controlled overrides bound to one component — <DSVar>table.row.density</DSVar>,{" "}
                  <DSVar>control.height</DSVar>, <DSVar>sidebar.width</DSVar>. Change here, not
                  per-screen.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white p-4">
              <p className="text-[13px] font-semibold text-slate-900">Naming pattern</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Tokens are lowercase and dot-delimited:{" "}
                <span className="font-mono">{"{category}.{role}.{step?}"}</span>. The names in use
                across Qubit One:
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <DSVar>color.primary.500</DSVar>
                <DSVar>color.text.primary</DSVar>
                <DSVar>color.surface.default</DSVar>
                <DSVar>color.border.default</DSVar>
                <DSVar>spacing.4</DSVar>
                <DSVar>radius.md</DSVar>
                <DSVar>shadow.level.1</DSVar>
                <DSVar>duration.base</DSVar>
                <DSVar>z.modal</DSVar>
                <DSVar>breakpoint.md</DSVar>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3">
              <p className="text-xs leading-relaxed text-amber-800">
                <span className="font-semibold">Two governance rules:</span> tokens are the only
                allowed values — no one-off magic numbers in screens; and any new value requires a
                design-system review before merge, so the vocabulary stays closed.
              </p>
            </div>

            <DSSpec
              className="border-t border-slate-100 pt-4"
              rows={[
                {
                  label: "Purpose",
                  value:
                    "Give every screen one source of visual truth, so the product ships consistent and restyling stays cheap.",
                },
                {
                  label: "Naming",
                  value:
                    "Category → role → optional step. Role words are fixed (primary, text, surface, border); steps follow the scale (50–900, 1–8, level.0–2).",
                },
                {
                  label: "Governance",
                  value:
                    "A value not in these tables does not ship. Propose it in the Phase 2 review board; it lands as a token or not at all.",
                },
                {
                  label: "Where defined",
                  value:
                    "@theme ramps and the qubit-* surface layer in src/app/globals.css; shadcn/ui CSS variables for controls; content constants in src/lib/qubit/data.ts.",
                },
              ]}
            />
          </div>
        </DSSection>

        {/* ————— 2. Color tokens ————— */}
        <DSSection
          title="Color tokens"
          purpose="The semantic color set every screen consumes — grouped by prefix, with full ramps in Color System (15)."
        >
          <DSTokenTable
            head={["Token", "Value", "Usage"]}
            rows={[
              [<TokenGroup key="g1">Text</TokenGroup>, "", ""],
              [
                "color.text.primary",
                <Swatch key="v" hex="#0F172A" note="slate-900" />,
                "Headings, key values, primary data",
              ],
              [
                "color.text.secondary",
                <Swatch key="v" hex="#475569" note="slate-600" />,
                "Body copy, labels, table text",
              ],
              [
                "color.text.muted",
                <Swatch key="v" hex="#94A3B8" note="slate-400" />,
                "Captions, timestamps, placeholders",
              ],
              [<TokenGroup key="g2">Surface</TokenGroup>, "", ""],
              [
                "color.surface.default",
                <Swatch key="v" hex="#FFFFFF" />,
                "Cards, panels, dialogs, drawers",
              ],
              [
                "color.surface.subtle",
                <Swatch key="v" hex="#F8FAFC" note="slate-50" />,
                "Table headers, wells, hover fills",
              ],
              [
                "color.surface.workspace",
                <Swatch key="v" hex="#F5F7FB" />,
                "The app workspace background",
              ],
              [<TokenGroup key="g3">Border</TokenGroup>, "", ""],
              [
                "color.border.default",
                <Swatch key="v" hex="#E2E8F0" note="slate-200/90" />,
                "Cards, inputs, dividers, chips",
              ],
              [
                "color.border.strong",
                <Swatch key="v" hex="#CBD5E1" note="slate-300" />,
                "Emphasized borders, scrollbars",
              ],
              [<TokenGroup key="g4">Brand · Qubit Blue</TokenGroup>, "", ""],
              [
                "color.primary.50",
                <Swatch key="v" hex="#EFF6FF" />,
                "Selected tints, active row washes",
              ],
              [
                "color.primary.500",
                <Swatch key="v" hex="#3B82F6" />,
                "Charts, secondary data accents",
              ],
              [
                "color.primary.600",
                <Swatch key="v" hex="#2563EB" />,
                "Primary actions, active states, links",
              ],
              [<TokenGroup key="g5">Semantic</TokenGroup>, "", ""],
              [
                "color.success.600",
                <Swatch key="v" hex="#059669" note="emerald-600" />,
                "Success status, confirmations",
              ],
              [
                "color.warning.600",
                <Swatch key="v" hex="#D97706" note="amber-600" />,
                "Pending states, warnings",
              ],
              [
                "color.error.600",
                <Swatch key="v" hex="#DC2626" note="red-600" />,
                "Destructive actions, failures",
              ],
              [
                "color.info.600",
                <Swatch key="v" hex="#2563EB" note="blue-600" />,
                "Informational system messaging",
              ],
            ]}
          />
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Status is never color-only — every semantic color pairs with a dot + label badge, an
            icon or text (see Status System, 24). Full ramps, tints and interactive states: Color
            System (15).
          </p>
        </DSSection>

        {/* ————— 3. Spacing scale ————— */}
        <DSSection
          title="Spacing scale"
          purpose="A single 4px base (spacing.1) — every margin, padding and gap in the product is a multiple of it."
        >
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                Base scale — 4px steps
              </p>
              <div className="qubit-scroll mt-3 flex items-end gap-4 overflow-x-auto pb-1">
                <SpaceStep px={4} step={1} />
                <SpaceStep px={8} step={2} />
                <SpaceStep px={12} step={3} />
                <SpaceStep px={16} step={4} />
                <SpaceStep px={20} step={5} />
                <SpaceStep px={24} step={6} />
                <SpaceStep px={28} step={7} />
                <SpaceStep px={32} step={8} />
              </div>
            </div>

            <DSTokenTable
              head={["Token", "Value", "Usage"]}
              rows={[
                [
                  "layout.page.gutter",
                  "16 / 24 / 32 px",
                  "Page side padding — mobile / tablet / desktop",
                ],
                ["layout.section.gap", "24 px", "Vertical rhythm between page sections"],
                ["layout.card.padding", "16–24 px", "Card inner padding (p-4, md:p-5, p-6)"],
                ["layout.form.gap", "16 px", "Vertical gap between form fields"],
                [
                  "layout.table.row.density",
                  "36 / 44 / 52 px",
                  "Compact / default / comfortable table rows",
                ],
              ]}
            />
          </div>
        </DSSection>

        {/* ————— 4. Radius scale ————— */}
        <DSSection
          title="Radius scale"
          purpose="Four radii cover the entire product — chips, controls, cards and pills. Nothing else."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DSExample label="radius.sm — 6px · chips, tags, kbd">
              <span className="inline-flex items-center rounded-[6px] border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                Sub-department
              </span>
            </DSExample>
            <DSExample label="radius.md — 8px · buttons, inputs, selects">
              <Button variant="outline" size="sm" className="h-9" onClick={copyTokenNames}>
                New invoice
              </Button>
            </DSExample>
            <DSExample label="radius.lg — 12px · cards, panels, tiles">
              <div className="w-full max-w-56 rounded-[12px] border border-slate-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <p className="text-[13px] font-semibold text-slate-900">Sales</p>
                <p className="mt-0.5 text-xs text-slate-500">214 employees · 6 sub-teams</p>
              </div>
            </DSExample>
            <DSExample label="radius.full — pills · status, avatars, filters">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                Active
              </span>
            </DSExample>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Rule of thumb: anything smaller than 32px tall takes <DSVar>radius.sm</DSVar>–
            <DSVar>radius.md</DSVar>; surfaces take <DSVar>radius.lg</DSVar>; only status, avatars
            and filter chips are fully round.
          </p>
        </DSSection>

        {/* ————— 5. Border & elevation ————— */}
        <DSSection
          title="Border & elevation"
          purpose="Hairline borders do the structural work; shadow is a whisper, never a statement."
        >
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <DSExample label="border.default — 1px slate-200/90">
                <div className="w-full max-w-48 rounded-lg border border-slate-200/90 bg-white p-3">
                  <p className="text-[13px] font-medium text-slate-800">Card border</p>
                  <p className="mt-0.5 text-xs text-slate-500">The default on every surface</p>
                </div>
              </DSExample>
              <DSExample label="border.strong — 1px slate-300">
                <div className="w-full max-w-48 rounded-lg border border-slate-300 bg-white p-3">
                  <p className="text-[13px] font-medium text-slate-800">Emphasized border</p>
                  <p className="mt-0.5 text-xs text-slate-500">Scrollbars, selected edges</p>
                </div>
              </DSExample>
              <DSExample label="border.focus — 2px #2563EB, offset 2">
                <button
                  type="button"
                  onClick={copyTokenNames}
                  className="w-full max-w-48 rounded-lg border border-slate-200/90 bg-white p-3 text-left ring-2 ring-[#2563EB] ring-offset-2"
                >
                  <p className="text-[13px] font-medium text-slate-800">Focus ring token</p>
                  <p className="mt-0.5 text-xs text-slate-500">Global — keyboard users only</p>
                </button>
              </DSExample>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                Elevation levels
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="rounded-xl border border-slate-200/90 bg-white p-4">
                    <p className="text-[13px] font-semibold text-slate-900">Flat</p>
                    <p className="mt-0.5 text-xs text-slate-500">Inline wells, table shells</p>
                  </div>
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-slate-500">
                    shadow.level.0 — none (border only)
                  </p>
                </div>
                <div>
                  <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.03)]">
                    <p className="text-[13px] font-semibold text-slate-900">Card</p>
                    <p className="mt-0.5 text-xs text-slate-500">Every .qubit-card on screen</p>
                  </div>
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-slate-500">
                    shadow.level.1 — 0 1px 2px rgb(15 23 42 / .04), 0 1px 3px rgb(15 23 42 / .03)
                  </p>
                </div>
                <div>
                  <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_4px_rgba(15,23,42,0.05),0_10px_24px_-6px_rgba(15,23,42,0.07)]">
                    <p className="text-[13px] font-semibold text-slate-900">Raised</p>
                    <p className="mt-0.5 text-xs text-slate-500">Hovered cards, popovers</p>
                  </div>
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-slate-500">
                    shadow.level.2 — 0 2px 4px rgb(15 23 42 / .05), 0 10px 24px -6px rgb(15 23 42 /
                    .07)
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                Elevation never goes stronger than <DSVar>shadow.level.2</DSVar> in page content.
                Overlays (dropdowns, dialogs, toasts) are the only exception — scrims and the
                z-index ladder in Layout &amp; layers keep them legible.
              </p>
            </div>
          </div>
        </DSSection>

        {/* ————— 6. Sizing & controls ————— */}
        <DSSection
          title="Sizing & controls"
          purpose="Icon steps, control heights and icon-tile sizes — the physical dimensions every screen shares."
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                Icon sizes — 16 / 20 / 24
              </p>
              <div className="mt-3 flex gap-3">
                {[
                  { px: 16, cls: "h-4 w-4" },
                  { px: 20, cls: "h-5 w-5" },
                  { px: 24, cls: "h-6 w-6" },
                ].map((s) => (
                  <div
                    key={s.px}
                    className="flex min-w-24 flex-col items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-3"
                  >
                    <span className="flex items-center gap-2.5 text-slate-600">
                      <Search className={s.cls} aria-hidden />
                      <Building2 className={s.cls} aria-hidden />
                    </span>
                    <DSCaption className="mt-0 font-mono">{s.px}px</DSCaption>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                16px inline with text · 20px in tiles and menus · 24px in empty states and feature
                headers.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                Control heights — 32 / 36 / 40
              </p>
              <div className="mt-3 space-y-2.5">
                <Input
                  placeholder="Search employees…"
                  aria-label="Compact input, 32px"
                  className="h-8 rounded-lg border-slate-200 bg-white text-[13px]"
                />
                <Input
                  placeholder="Filter by department…"
                  aria-label="Medium input, 36px"
                  className="h-9 rounded-lg border-slate-200 bg-white text-[13px]"
                />
                <Input
                  placeholder="Search departments, people…"
                  aria-label="Default input, 40px"
                  className="h-10 rounded-lg border-slate-200 bg-white"
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                40px is the standard control; 36px in dense toolbars; 32px inside headers and
                dialogs. Buttons follow: sm 32 / default 36.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                Icon tiles — 32 / 40 / 48
              </p>
              <div className="mt-3 flex items-end gap-4">
                <div className="flex flex-col items-center gap-2">
                  <IconTile icon={<Building2 aria-hidden />} size="sm" />
                  <DSCaption className="mt-0 font-mono">32px</DSCaption>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <IconTile icon={<Building2 aria-hidden />} size="md" />
                  <DSCaption className="mt-0 font-mono">40px</DSCaption>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <IconTile icon={<Building2 aria-hidden />} size="lg" />
                  <DSCaption className="mt-0 font-mono">48px</DSCaption>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Soft tinted squares (<DSVar>qubit-icon-tile</DSVar>) — sm inline with rows, md in
                card headers, lg for page-level features. 12px radius at every size.
              </p>
            </div>
          </div>
        </DSSection>

        {/* ————— 7. Layout & layers ————— */}
        <DSSection
          title="Layout & layers"
          purpose="Structural dimensions, the z-index ladder and the responsive breakpoints every screen is built on."
        >
          <DSTokenTable
            head={["Token", "Value", "Usage"]}
            rows={[
              [<TokenGroup key="g1">Layout</TokenGroup>, "", ""],
              ["layout.sidebar.expanded", "264 px", "Expanded sidebar with labels"],
              ["layout.sidebar.collapsed", "68 px", "Collapsed, icon-only sidebar"],
              ["layout.content.max", "1440 px", "Maximum content width on wide screens"],
              ["layout.grid.columns", "12", "Base grid for page layout composition"],
              [<TokenGroup key="g2">Z-index ladder</TokenGroup>, "", ""],
              ["z.content", "0", "Static page content"],
              ["z.sticky", "10", "Sticky table headers and toolbars"],
              ["z.topbar", "30", "Global top bar"],
              ["z.dropdown", "50", "Menus, popovers, selects"],
              ["z.overlay", "50", "Dialog and drawer scrims"],
              ["z.toast", "100", "Toast notifications — always on top"],
              [<TokenGroup key="g3">Breakpoints</TokenGroup>, "", ""],
              ["breakpoint.sm", "640 px", "Two-column layouts begin"],
              ["breakpoint.md", "768 px", "Tablet — side-by-side panes"],
              ["breakpoint.lg", "1024 px", "Desktop — three-pane layouts"],
              ["breakpoint.xl", "1280 px", "Wide desktop — content caps at 1440px"],
            ]}
          />
        </DSSection>

        {/* ————— 8. Motion ————— */}
        <DSSection
          title="Motion"
          purpose="Three durations and two easings. Motion confirms cause and effect — it never performs."
        >
          <div className="space-y-5">
            <DSTokenTable
              head={["Token", "Value", "Usage"]}
              rows={[
                ["duration.fast", "120 ms", "Hover, press, control feedback"],
                ["duration.base", "180 ms", "State changes, color and border transitions"],
                ["duration.enter", "220 ms", "Screen enter, drawers, dialogs"],
                ["easing.enter", "cubic-bezier(0.16, 1, 0.3, 1)", "Enter/exit emphasis — ease-out expo"],
                ["easing.standard", "ease", "General property transitions"],
              ]}
            />

            <DSStage variant="tinted" align="center" className="gap-6">
              <div
                aria-hidden
                className={cn(
                  "flex h-16 w-40 items-center justify-center rounded-xl border border-blue-200/80 bg-white text-[13px] font-medium text-blue-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
                  boxShown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                )}
                style={{
                  transition: boxShown
                    ? "opacity 220ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1)"
                    : "opacity 120ms ease, transform 120ms ease",
                }}
              >
                duration.enter
              </div>
              <div className="flex flex-col items-center gap-2">
                <Button size="sm" className="h-9" onClick={replayMotion}>
                  Replay motion
                </Button>
                <DSCaption>Hides with duration.fast · enters with duration.enter + easing.enter</DSCaption>
              </div>
            </DSStage>

            <p className="text-xs leading-relaxed text-slate-500">
              Rules: animate only opacity and transform; respect <DSVar>prefers-reduced-motion</DSVar>{" "}
              (see Accessibility, 29); never animate layout properties like width or top.
            </p>
          </div>
        </DSSection>

        {/* ————— Guidance ————— */}
        <div className="grid gap-4 md:grid-cols-2">
          <DSGuidance kind="do" title="systematize every visual decision through tokens">
            Reach for <DSVar>spacing.4</DSVar>, <DSVar>radius.md</DSVar>,{" "}
            <DSVar>color.text.secondary</DSVar> before typing any raw value. When a needed value is
            missing, propose it through design-system review — the vocabulary grows deliberately and
            all 30 screens inherit the change.
          </DSGuidance>
          <DSGuidance kind="dont" title="introduce screen-specific one-off values">
            No 13px paddings, no screen-only shadows, no local colors. One-off values drift, break
            review, and make the next restyle a manual sweep — exactly what the token system exists
            to prevent.
          </DSGuidance>
        </div>

        <DSScreenNav id="design-tokens" />
      </div>
    </>
  );
}
