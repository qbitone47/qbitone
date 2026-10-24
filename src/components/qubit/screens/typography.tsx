"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPANY_EMPLOYEES, formatCount, getEmployee } from "@/lib/qubit/data";
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
// Screen 14 — Typography
// The type ramp for enterprise data density: 11 styles, strict
// weights, and how the stack assembles on a real Qubit One page.
// ============================================================

interface RampSpec {
  size: number;
  weight: number;
  lineHeight: string;
  tracking: string;
  usage: string;
}

/** One ramp entry — live specimen on the left, specs on the right. */
function RampRow({
  name,
  specimen,
  spec,
  grid,
  className,
}: {
  name: string;
  specimen: React.ReactNode;
  spec: RampSpec;
  grid?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 rounded-xl border border-slate-100 bg-white p-4 md:grid-cols-[minmax(0,1fr)_300px] md:gap-0",
        className,
      )}
    >
      <div
        className="min-w-0 md:pr-6"
        style={
          grid
            ? {
                backgroundImage:
                  "repeating-linear-gradient(to bottom, rgba(37,99,235,0.09) 0, rgba(37,99,235,0.09) 1px, transparent 1px, transparent 8px)",
              }
            : undefined
        }
      >
        {specimen}
      </div>
      <div className="min-w-0 border-t border-slate-100 pt-3 md:border-l md:border-t-0 md:pl-6 md:pt-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{name}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px]">
          {[
            ["Size", `${spec.size}px`],
            ["Weight", `${spec.weight}`],
            ["Line height", spec.lineHeight],
            ["Tracking", spec.tracking],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-2">
              <dt className="text-slate-400">{k}</dt>
              <dd className="font-mono text-slate-700">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{spec.usage}</p>
      </div>
    </div>
  );
}

export function TypographyScreen() {
  const { toast } = useToast();
  const [grid, setGrid] = React.useState(false);

  const rahul = getEmployee("rahul")!;
  const priya = getEmployee("priya")!;
  const arjun = getEmployee("arjun")!;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Typography"
        description="Complete typographic hierarchy for enterprise data density."
        actions={
          <Button
            variant={grid ? "secondary" : "outline"}
            size="sm"
            className="h-9"
            aria-pressed={grid}
            onClick={() => setGrid((g) => !g)}
          >
            {grid ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            Baseline grid
          </Button>
        }
      />

      <div className="space-y-6">
        {/* ————— 1. Type ramp ————— */}
        <DSSection
          title="Type ramp"
          purpose="The master reference — every text style in the product, live, with exact values."
        >
          <div className="space-y-3">
            <RampRow
              name="Display"
              grid={grid}
              specimen={
                <p className="text-[30px] font-bold leading-[1.25] tracking-[-0.02em] text-slate-900">
                  Organization Structure
                </p>
              }
              spec={{ size: 30, weight: 700, lineHeight: "1.25", tracking: "-0.02em", usage: "Page title — exactly one per screen, rendered as an h1." }}
            />
            <RampRow
              name="Section title"
              grid={grid}
              specimen={<p className="text-[15px] font-semibold leading-snug text-slate-900">Department summary</p>}
              spec={{ size: 15, weight: 600, lineHeight: "1.4", tracking: "0", usage: "Card and panel titles — the top of every content card." }}
            />
            <RampRow
              name="Subsection title"
              grid={grid}
              specimen={<p className="text-[14px] font-semibold text-slate-900">Direct reports</p>}
              spec={{ size: 14, weight: 600, lineHeight: "1.45", tracking: "0", usage: "Group headings inside cards, drawers and detail panes." }}
            />
            <RampRow
              name="Body"
              grid={grid}
              specimen={
                <p className="max-w-xl text-[14px] leading-relaxed text-slate-600">
                  Every department, sub-team and reporting line in one auditable structure — reviewed
                  quarterly by People Ops.
                </p>
              }
              spec={{ size: 14, weight: 400, lineHeight: "1.6", tracking: "0", usage: "Primary reading text: descriptions, explanations, prose." }}
            />
            <RampRow
              name="Body secondary"
              grid={grid}
              specimen={
                <p className="max-w-xl text-[13px] leading-relaxed text-slate-500">
                  Used for supporting copy beneath titles and secondary detail in dense views.
                </p>
              }
              spec={{ size: 13, weight: 400, lineHeight: "1.55", tracking: "0", usage: "Descriptions under titles, helper text, metadata lines." }}
            />
            <RampRow
              name="Label"
              grid={grid}
              specimen={<p className="text-[12px] font-medium text-slate-500">Department Head</p>}
              spec={{ size: 12, weight: 500, lineHeight: "1.4", tracking: "0", usage: "Form field labels and key–value labels in detail panes." }}
            />
            <RampRow
              name="Caption"
              grid={grid}
              specimen={<p className="text-[11px] text-slate-400">Last modified 17 Oct 2026</p>}
              spec={{ size: 11, weight: 400, lineHeight: "1.4", tracking: "0", usage: "Timestamps, footnotes and helper microcopy — the smallest text in the product." }}
            />
            <RampRow
              name="Table text"
              grid={grid}
              specimen={
                <p className="text-[13px] text-slate-700">
                  Accounts Payable <span className="ml-2 text-slate-400">· updated 2 min ago</span>
                </p>
              }
              spec={{ size: 13, weight: 400, lineHeight: "1.45", tracking: "0", usage: "All tabular data cells — sized for 40px rows without crowding." }}
            />
            <RampRow
              name="Button text"
              grid={grid}
              specimen={
                <span className="inline-flex h-9 items-center rounded-lg bg-[#2563EB] px-4 text-[13px] font-medium text-white">
                  Add Department
                </span>
              }
              spec={{ size: 13, weight: 500, lineHeight: "1", tracking: "0", usage: "Every button label — sentence case, never uppercase." }}
            />
            <RampRow
              name="Navigation text"
              grid={grid}
              specimen={
                <span className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[13px] font-medium text-blue-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-hidden />
                  Sales
                </span>
              }
              spec={{ size: 13, weight: 500, lineHeight: "1.4", tracking: "0", usage: "Sidebar items, breadcrumbs, tabs and menu rows." }}
            />
            <RampRow
              name="Numeric"
              grid={grid}
              specimen={
                <p className="text-[14px] font-medium tabular-nums text-slate-900">
                  {formatCount(COMPANY_EMPLOYEES)} employees
                </p>
              }
              spec={{ size: 14, weight: 500, lineHeight: "1.4", tracking: "0", usage: "KPIs, counts and monetary values — always tabular-nums so digits align." }}
            />
          </div>
        </DSSection>

        {/* ————— 2. Realistic context ————— */}
        <DSSection
          title="Realistic context"
          purpose="The Organization Structure page header, rebuilt exactly from the ramp — how the styles work together."
        >
          <DSStage variant="tinted">
            <DSExample className="w-full">
              <div className="qubit-card w-full p-5 md:p-6">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    Enterprise
                  </span>
                  <span className="text-xs text-slate-400">01. Organization Structure</span>
                </div>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-[26px] font-bold leading-[1.25] tracking-[-0.02em] text-slate-900 md:text-[30px]">
                      Organization Structure
                    </h3>
                    <p className="mt-1.5 max-w-xl text-[14.5px] leading-relaxed text-slate-500">
                      Complete view of company hierarchy and reporting structure.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="text-[14px] font-medium tabular-nums text-slate-900">
                        {formatCount(COMPANY_EMPLOYEES)} employees
                      </span>
                      <span className="text-[12px] font-medium text-slate-500">Department Head</span>
                      <span className="text-[11px] text-slate-400">Last modified 17 Oct 2026</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-start gap-2 pt-1 md:pt-1.5">
                    <Button
                      size="sm"
                      className="h-9"
                      onClick={() =>
                        toast({
                          title: "Specimen — Add Department",
                          description:
                            "Button text (13/500) on radius.md — the same action pattern as the Buttons reference.",
                        })
                      }
                    >
                      Add Department
                    </Button>
                  </div>
                </div>
              </div>
            </DSExample>
          </DSStage>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-slate-900" aria-hidden /> Display — title
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-slate-400" aria-hidden /> Body secondary — description
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-blue-600" aria-hidden /> Numeric + Label + Caption — meta row
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-blue-200" aria-hidden /> Button text — action
            </span>
          </div>
        </DSSection>

        {/* ————— 3. Weights & casing ————— */}
        <DSSection
          title="Weights & casing"
          purpose="Four weights, each with a fixed job — plus the only sanctioned use of uppercase."
        >
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { w: 400, label: "Body", job: "Records, descriptions, table text", cls: "font-normal text-slate-700" },
                { w: 500, label: "Medium", job: "Labels, navigation, buttons", cls: "font-medium text-slate-800" },
                { w: 600, label: "Semibold", job: "Section and card titles", cls: "font-semibold text-slate-900" },
                { w: 700, label: "Bold", job: "Display title, key metrics", cls: "font-bold text-slate-900" },
              ].map((row) => (
                <div key={row.w} className="rounded-xl border border-slate-200/90 bg-white p-4">
                  <p className={cn("text-[14px] leading-relaxed", row.cls)}>
                    Qubit One keeps every record auditable.
                  </p>
                  <p className="mt-3 text-[11px] text-slate-400">
                    <span className="font-mono">{row.w}</span> · {row.label} — {row.job}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Governance
                  </p>
                  <p className="mt-0.5 text-[13px] text-slate-600">
                    Uppercase is reserved for 10–11px section labels with 0.06–0.1em tracking —
                    never for content, buttons or table headers.
                  </p>
                </div>
                <span className="shrink-0 rounded-md border border-slate-200/90 bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  System Section
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Never all-bold: a wall of semibold is as unreadable as a wall of body text. Bold is
                a spotlight — one display per page, one semibold title per card.
              </p>
            </div>
          </div>
        </DSSection>

        {/* ————— 4. Data density ————— */}
        <DSSection
          title="Data density"
          purpose="13px table text with disciplined truncation — how type behaves when the dataset is the interface."
        >
          <div className="space-y-5">
            <DSExample label="Table text 13/400 at default 44px row density — real Qubit One records">
              <div className="w-full overflow-hidden rounded-xl border border-slate-200/90">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200/90 bg-slate-50/95 text-left">
                      {["Employee", "Department", "Role"].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { e: rahul, dept: "Sales" },
                      { e: priya, dept: "Finance" },
                      { e: arjun, dept: "IT & Technology" },
                    ].map(({ e, dept }) => (
                      <tr key={e.id} className="transition-colors duration-150 hover:bg-slate-50/70">
                        <td className="px-3 py-2.5 font-medium text-slate-800">{e.name}</td>
                        <td className="px-3 py-2.5 text-slate-600">{dept}</td>
                        <td className="px-3 py-2.5 text-slate-600">{e.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DSExample>

            <div className="grid gap-4 sm:grid-cols-2">
              <DSExample label="truncate — one line, ellipsis; the full name stays in the record">
                <div className="w-full max-w-72 rounded-xl border border-slate-200/90 bg-white p-3">
                  <p className="truncate text-[13px] text-slate-700">
                    Global Strategic Partnerships &amp; Alliances Enablement
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">Sub-department · Marketing</p>
                </div>
              </DSExample>
              <DSExample label="line-clamp-2 — two lines maximum, then ellipsis">
                <div className="w-full max-w-72 rounded-xl border border-slate-200/90 bg-white p-3">
                  <p className="line-clamp-2 text-[13px] leading-relaxed text-slate-600">
                    Owns onboarding, payroll, compliance and engagement programmes for all{" "}
                    {formatCount(COMPANY_EMPLOYEES)} employees across eight departments and nineteen
                    sub-teams.
                  </p>
                </div>
              </DSExample>
            </div>

            <p className="text-xs leading-relaxed text-slate-500">
              Truncation rules: single-line <DSVar>truncate</DSVar> for names and identifiers where
              the row opens a detail view; <DSVar>line-clamp-2</DSVar> for descriptions. Never wrap
              table cells — density dies with a third line.
            </p>
          </div>
        </DSSection>

        {/* ————— Guidance + governance ————— */}
        <div className="grid gap-4 md:grid-cols-2">
          <DSGuidance kind="do" title="one display per page, strategic weights">
            Use Display once — the page title. Let 600 carry card titles, 500 carry labels and
            actions, 400 carry everything else. Weight contrast, not size inflation, is what makes
            dense screens scannable.
          </DSGuidance>
          <DSGuidance kind="dont" title="oversized marketing typography, all-bold walls, decorative fonts">
            No display sizes above 30px, no sentence set entirely in semibold, no second typeface.
            Enterprise users scan for data — decoration that adds a millisecond of parsing cost is a
            defect.
          </DSGuidance>
        </div>

        <DSSection
          title="Governance"
          purpose="The rules reviewers apply to type in every Qubit One screen."
        >
          <DSSpec
            rows={[
              {
                label: "Purpose",
                value:
                  "One typographic hierarchy that stays readable at enterprise data density — 11 styles, four weights, no decorative type.",
              },
              {
                label: "Use when",
                value:
                  "Composing any screen. Take sizes from the ramp above; the realistic-context example shows the full stack assembled on a real page.",
              },
              {
                label: "Avoid when",
                value:
                  "Marketing moments — Qubit One product screens never use display sizes above 30px or fonts outside Geist Sans / Geist Mono.",
              },
              {
                label: "States",
                value:
                  "State is carried by weight and color, not size — links are 13px medium blue, disabled text drops to slate-400, errors add red text, not bigger type.",
              },
              {
                label: "Responsive",
                value:
                  "Display steps 30px → 26px below md. Hierarchy never relies on size alone on mobile — weight, color and spacing reinforce it.",
              },
              {
                label: "Accessibility",
                value:
                  "Minimum sizes: 11px captions, 13px functional text. Body contrast meets AA (slate-600 or darker on white). Headings are real h1–h4 elements, never styled spans.",
              },
            ]}
          />
        </DSSection>

        <DSScreenNav id="typography" />
      </div>
    </>
  );
}
