"use client";

import * as React from "react";
import {
  Activity,
  Building2,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Plus,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { PageHeader } from "../page-header";
import {
  DSCaption,
  DSExample,
  DSGuidance,
  DSScreenNav,
  DSSection,
  DSSpec,
  DSVar,
} from "../ds/doc";
import { ArrowLink, Avatar, IconTile, KV, StatTile, StatusBadge } from "../primitives";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { COMPANY_EMPLOYEES, formatCount } from "@/lib/qubit/data";
import { cn } from "@/lib/utils";

// ============================================================
// Screen 19 — Cards. Card anatomy, the six canonical variants,
// when to choose a card over a table, and the restrained
// hover/interaction contract.
// ============================================================

function NumDot({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(37,99,235,0.35)]",
        className,
      )}
    >
      {n}
    </span>
  );
}

const ANATOMY_NOTES = [
  {
    title: "Header / title",
    body: "What the card is — one icon or avatar, one title, one quiet subtitle. Identity lives here and nowhere else.",
  },
  {
    title: "Content",
    body: "The payload: a short description plus the primary entity details. This is the reason the card exists.",
  },
  {
    title: "Metadata",
    body: "Supporting facts — counts, locations, freshness. Small, quiet, secondary color; never competing with content.",
  },
  {
    title: "Actions",
    body: "At most one primary and one secondary action. Left-anchored on detail cards, trailing on compact ones.",
  },
  {
    title: "Footer",
    body: "Optional audit strip for ids and timestamps — the smallest type on the card, muted on purpose.",
  },
];

function AnatomyCard({ onAction }: { onAction: (label: string) => void }) {
  return (
    <div className="qubit-card overflow-hidden">
      {/* 1 — Header / title */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 pb-4">
        <div className="flex items-center gap-3.5">
          <IconTile icon={<Building2 />} tone="blue" size="lg" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight text-slate-900">Engineering</h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">QO-DEPT-03 · Mumbai HQ</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <StatusBadge status="Active" size="sm" />
          <NumDot n={1} />
        </div>
      </div>

      {/* 2 — Content */}
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-[13px] leading-relaxed text-slate-600">
            Builds and operates the Qubit One platform — product engineering, platform reliability and internal tooling
            across all regions.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Avatar name="Arjun Mehta" size="md" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-slate-900">Arjun Mehta</p>
              <p className="truncate text-xs text-slate-500">Department Head</p>
            </div>
          </div>
        </div>
        <NumDot n={2} className="mt-1" />
      </div>

      {/* 3 — Metadata */}
      <div className="flex items-center justify-between gap-3 border-y border-slate-100 bg-slate-50/60 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            248 employees
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            5 locations
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            Updated 2h ago
          </span>
        </div>
        <NumDot n={3} />
      </div>

      {/* 4 — Actions */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => onAction("Engineering department")}
            aria-label="View Engineering department"
          >
            View department
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAction("Engineering settings")}>
            Manage
          </Button>
        </div>
        <NumDot n={4} />
      </div>

      {/* 5 — Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-400">
        <span>Created 12 Jan 2022 · Last audited 1 Mar 2026</span>
        <NumDot n={5} />
      </div>
    </div>
  );
}

export function CardsScreen() {
  const { toast } = useToast();

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Cards"
        description="Card patterns and when to choose them over tables."
      />

      <div className="space-y-6">
        {/* ── 1. Anatomy ─────────────────────────────────────── */}
        <DSSection
          title="Anatomy"
          purpose="Five zones, one reading order: identity → payload → metadata → actions → audit. Every card in Qubit One follows it."
        >
          <div className="grid items-start gap-8 lg:grid-cols-2">
            <AnatomyCard
              onAction={(label) => toast({ title: label, description: "Department detail view would open here." })}
            />
            <ol className="relative space-y-5">
              <span aria-hidden className="absolute bottom-2 left-[11.5px] top-2 w-px bg-slate-200" />
              {ANATOMY_NOTES.map((note, i) => (
                <li key={note.title} className="relative flex gap-3.5">
                  <NumDot n={i + 1} className="relative z-10 ring-4 ring-white" />
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[13px] font-semibold text-slate-900">{note.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">{note.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </DSSection>

        {/* ── 2. Variants ────────────────────────────────────── */}
        <DSSection
          title="Variants"
          purpose="Six canonical specimens. If a card doesn't match one of these, it probably wants to be two cards — or a table."
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <DSExample label="Summary — KPI row for a dashboard or module header">
              <div className="qubit-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">Workforce overview</h3>
                    <p className="mt-0.5 text-xs text-slate-500">All departments · FY2026</p>
                  </div>
                  <IconTile icon={<Users />} tone="blue" size="sm" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <StatTile icon={<Users />} value={formatCount(COMPANY_EMPLOYEES)} label="Employees" />
                  <StatTile icon={<Building2 />} value="8" label="Departments" />
                  <StatTile icon={<Activity />} value="96%" label="Active" />
                </div>
              </div>
            </DSExample>

            <DSExample label="Entity — one record with identity, status and a single exit">
              <div className="qubit-card p-5">
                <div className="flex items-center gap-3.5">
                  <Avatar name="Kavita Joshi" size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-slate-900">Kavita Joshi</p>
                    <p className="truncate text-xs text-slate-500">Finance Manager · QO-0189</p>
                    <div className="mt-1.5">
                      <StatusBadge status="Active" size="sm" />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <span className="truncate text-xs text-slate-400">Mumbai HQ · Since Jun 2021</span>
                  <ArrowLink
                    ariaLabel="View details for Kavita Joshi"
                    onClick={() =>
                      toast({ title: "Kavita Joshi", description: "Employee record opens in a drawer." })
                    }
                  >
                    View details
                  </ArrowLink>
                </div>
              </div>
            </DSExample>

            <DSExample label="Action — one primary task, one quiet alternative">
              <div className="qubit-card flex flex-col p-5">
                <IconTile icon={<Zap />} tone="violet" size="md" />
                <h3 className="mt-3.5 text-sm font-semibold text-slate-900">Create workflow</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                  Automate a repeatable approval chain or task sequence in under a minute.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => toast({ title: "New workflow", description: "Workflow builder opens." })}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    New workflow
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast({ title: "Workflow catalog", description: "Showing 12 available workflows." })}
                  >
                    Browse catalog
                  </Button>
                </div>
              </div>
            </DSExample>

            <DSExample label="Information — facts and classification, no actions">
              <div className="qubit-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">Quarterly access review</h3>
                  <IconTile icon={<FileText />} tone="amber" size="sm" />
                </div>
                <dl className="mt-2 divide-y divide-slate-100">
                  <KV label="Owner">Priya Sharma</KV>
                  <KV label="Updated">18 Mar 2026</KV>
                  <KV label="Sensitivity">
                    <StatusBadge status="Confidential" size="sm" />
                  </KV>
                </dl>
              </div>
            </DSExample>

            <DSExample label="Status — current state first, metrics to back it up">
              <div className="qubit-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">Payroll run — March</h3>
                  <StatusBadge status="Active" size="sm" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2.5">
                    <p className="text-[17px] font-semibold tracking-tight text-slate-900">₹1.8 Cr</p>
                    <p className="mt-0.5 text-xs text-slate-500">Net payout</p>
                  </div>
                  <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2.5">
                    <p className="text-[17px] font-semibold tracking-tight text-slate-900">1,197</p>
                    <p className="mt-0.5 text-xs text-slate-500">Payslips issued</p>
                  </div>
                </div>
                <p className="mt-3.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden />+12% this quarter
                  <span className="font-normal text-slate-400">vs Q3 FY2026</span>
                </p>
              </div>
            </DSExample>

            <DSExample label="Preview — compact, horizontal, one tap to the real thing">
              <div
                role="button"
                tabIndex={0}
                aria-label="Open workflow: Employee Onboarding"
                onClick={() => toast({ title: "Employee Onboarding", description: "5 steps · Owned by HR & People." })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toast({ title: "Employee Onboarding", description: "5 steps · Owned by HR & People." });
                  }
                }}
                className="qubit-card qubit-card-hover flex cursor-pointer items-center gap-3.5 p-4"
              >
                <IconTile icon={<FileText />} tone="teal" size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-900">Employee Onboarding</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">5 steps · Owned by HR &amp; People</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              </div>
            </DSExample>
          </div>
        </DSSection>

        {/* ── 3. Card vs table ───────────────────────────────── */}
        <DSSection
          title="Card vs table"
          purpose="The one-line test: if users compare rows, it's a table; if users scan one thing at a time, it's a card."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="use cards for scanned entity summaries">
              <ul className="list-inside space-y-1.5">
                <li>Collections of 1–10 items, each with its own identity and actions.</li>
                <li>Mixed media — avatar plus stats plus buttons don't fit table cells.</li>
                <li>Entity profiles and previews where the user reads one thing, then moves on.</li>
              </ul>
            </DSGuidance>
            <DSGuidance kind="dont" title="use cards for dense comparable data">
              <ul className="list-inside space-y-1.5">
                <li>More than ~10 rows of comparable records — column scanning beats card stacking. That&apos;s a table.</li>
                <li>Grids of identical, action-less tiles — that&apos;s a table wearing a costume.</li>
                <li>Long-form reading — cards are summaries, never documents.</li>
              </ul>
            </DSGuidance>
          </div>
          <p className="mt-4 border-t border-slate-100 pt-4 text-[13px] leading-relaxed text-slate-500">
            Padding is one of <DSVar>p-4</DSVar>, <DSVar>p-5</DSVar> or <DSVar>p-6</DSVar> — pick by prominence and never
            mix within one grid. Everything else (radius, border, shadow) comes from <DSVar>qubit-card</DSVar>; never
            restyle a card surface by hand.
          </p>
        </DSSection>

        {/* ── 4. Hover & interaction ─────────────────────────── */}
        <DSSection
          title="Hover & interaction"
          purpose="One hover treatment for clickable cards: border deepens, shadow lifts, 150–200ms. Nothing else moves."
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <DSExample label="Static — informational card, no hover, no pointer">
              <div className="qubit-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">Access policy</h3>
                  <IconTile icon={<FileText />} tone="slate" size="sm" />
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                  Purely informational — no hover treatment, no pointer cursor, no actions. It reads; it doesn&apos;t
                  invite.
                </p>
              </div>
            </DSExample>

            <DSExample label="Clickable — hover affordance plus one explicit exit">
              <div
                onClick={() => toast({ title: "Access policy", description: "Policy details would open here." })}
                className="qubit-card qubit-card-hover cursor-pointer p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">Data retention policy</h3>
                  <IconTile icon={<FileText />} tone="blue" size="sm" />
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                  Hover deepens the border and lifts the shadow — border deepen plus soft lift only. No scale, no glow,
                  no color flood.
                </p>
                <div className="mt-3.5">
                  <ArrowLink
                    ariaLabel="Open data retention policy"
                    onClick={() => toast({ title: "Data retention policy", description: "Policy details would open here." })}
                  >
                    Open policy
                  </ArrowLink>
                </div>
              </div>
            </DSExample>
          </div>
          <DSCaption>
            If a card is clickable, the hover treatment and the exit link appear together — one affordance story, told
            twice.
          </DSCaption>
        </DSSection>

        {/* ── 5. Guidance & spec ─────────────────────────────── */}
        <DSSection title="Guidance & specification" purpose="The card contract, end to end.">
          <div className="grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="one card, one job">
              <ul className="list-inside space-y-1.5">
                <li>One primary action per card; secondary actions stay outline or link.</li>
                <li>
                  Consistent padding (<DSVar>p-4</DSVar> / <DSVar>p-5</DSVar> / <DSVar>p-6</DSVar>) across a grid.
                </li>
                <li>
                  Heading order: section <DSVar>h2</DSVar> → card title <DSVar>h3</DSVar>; never skip levels for visual
                  size.
                </li>
                <li>Make the whole card a hit area only when nothing inside it is separately interactive.</li>
              </ul>
            </DSGuidance>
            <DSGuidance kind="dont" title="stack surfaces or steal focus">
              <ul className="list-inside space-y-1.5">
                <li>Nested cards — a card inside a card means the inner one wants to be a section.</li>
                <li>Gradients, colored fills or heavy shadows — the surface language is <DSVar>qubit-card</DSVar>, full stop.</li>
                <li>Two competing primary buttons, or a card that is clickable while hiding inner links.</li>
                <li>Action hit areas under 44px — touch targets are a floor, not a nice-to-have.</li>
              </ul>
            </DSGuidance>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <DSSpec
              rows={[
                {
                  label: "Purpose",
                  value: (
                    <>Self-contained summaries of one entity or one action — scannable, actionable, visually lighter than tables.</>
                  ),
                },
                {
                  label: "Use when",
                  value: (
                    <>Entity profiles (employee, department, workflow), dashboard KPIs, previews, and collections of 1–10 items with their own actions.</>
                  ),
                },
                {
                  label: "Avoid when",
                  value: (
                    <>Users must compare many records on shared columns (a table), or the content is a time trend (a chart).</>
                  ),
                },
                {
                  label: "States",
                  value: (
                    <>
                      Rest, hover (border deepen + soft lift), selected (<DSVar>ring-1 ring-blue-100</DSVar> on{" "}
                      <DSVar>bg-blue-50</DSVar>), loading (skeleton card), disabled (opacity + no events).
                    </>
                  ),
                },
                {
                  label: "Responsive",
                  value: (
                    <>
                      Grids step 1 → 2 → 3 columns (base → sm → xl); cards never drop below ~280px; action rows wrap,
                      never truncate.
                    </>
                  ),
                },
                {
                  label: "Accessibility",
                  value: (
                    <>
                      Heading order inside cards (<DSVar>h3</DSVar> under section <DSVar>h2</DSVar>), 44px minimum hit
                      areas for actions, interactive cards get <DSVar>role=&quot;button&quot;</DSVar> and keyboard
                      activation.
                    </>
                  ),
                },
              ]}
            />
          </div>
        </DSSection>

        <DSScreenNav id="cards" />
      </div>
    </>
  );
}
