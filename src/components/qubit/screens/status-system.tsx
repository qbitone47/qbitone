"use client";

import * as React from "react";
import { Check, PlugZap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "../page-header";
import {
  DSCaption,
  DSExample,
  DSGuidance,
  DSScreenNav,
  DSSection,
  DSSpec,
  DSStage,
  DSVar,
  DSTokenTable,
} from "../ds/doc";
import { IconTile, StatusBadge } from "../primitives";

// ============================================================
// Screen 24 · Status System — one unified status vocabulary
// across every module. All specimens render the REAL shared
// StatusBadge / tone map; no local tone overrides.
// ============================================================

/** The canonical vocabulary — meaning + typical usage copy is governed. */
const VOCABULARY: { status: string; meaning: string; usage: string }[] = [
  { status: "Active", meaning: "Entity is live and operating", usage: "Employees, departments, workflows" },
  { status: "Inactive", meaning: "Deactivated but retained for audit", usage: "Offboarded employees, archived records" },
  { status: "Pending", meaning: "Waiting on an action or approval", usage: "Approvals, invitations, joiner requests" },
  { status: "Approved", meaning: "Cleared by the required approver", usage: "Approval requests, expense claims" },
  { status: "Rejected", meaning: "Declined by the approver", usage: "Approval requests, expense claims" },
  { status: "Draft", meaning: "Being composed — not yet live", usage: "Workflows, roles, announcements" },
  { status: "Completed", meaning: "Finished successfully", usage: "Lifecycle stages, workflow runs" },
  { status: "In Progress", meaning: "Actively being worked on", usage: "Lifecycle records, workflow runs" },
  { status: "Blocked", meaning: "Cannot proceed without intervention", usage: "Workflow runs, stalled approvals" },
  { status: "Warning", meaning: "Operating, with issues to resolve", usage: "Integrations, sync health" },
  { status: "Error", meaning: "Failed and needs attention", usage: "Sync jobs, integrations" },
  { status: "Connected", meaning: "Link established and healthy", usage: "Integration map, sync status" },
  { status: "Disconnected", meaning: "Link broken or revoked", usage: "Integration map, sync status" },
  { status: "Configuration Required", meaning: "Setup incomplete — cannot start", usage: "New integrations, modules" },
  { status: "On Hold", meaning: "Intentionally paused by a person", usage: "Lifecycle records, workflows" },
  { status: "Under Review", meaning: "In an active review cycle", usage: "Data domains, policies" },
  { status: "Notice Period", meaning: "Serving exit notice", usage: "Employee records" },
  { status: "On Leave", meaning: "Temporarily away, expected back", usage: "Employee records" },
  { status: "Probation", meaning: "New joiner in a probation window", usage: "Employee records" },
  { status: "Conflict", meaning: "Two rules disagree — resolve first", usage: "Approval rules, permissions" },
  { status: "Restricted", meaning: "Access limited by policy", usage: "Data domains, records" },
  { status: "Confidential", meaning: "Visible to authorized roles only", usage: "Data sensitivity levels" },
];

/** Dense-list demo rows for the "status dot" presentation. */
const DENSE_ROWS = [
  { name: "Payment gateway", status: "Connected", dot: "bg-emerald-500", text: "text-emerald-700" },
  { name: "SMS relay", status: "Disconnected", dot: "bg-red-500", text: "text-red-600" },
  { name: "Email relay", status: "Warning", dot: "bg-amber-500", text: "text-amber-700" },
];

const ANTI_PATTERN_PILLS = [
  { label: "NEW", cls: "bg-fuchsia-500 text-white shadow-sm" },
  { label: "HOT", cls: "bg-lime-400 text-lime-950" },
  { label: "BETA", cls: "bg-cyan-400 text-white" },
  { label: "URGENT", cls: "bg-orange-500 text-white" },
  { label: "TRENDING", cls: "bg-pink-500 text-white" },
  { label: "DRAFT", cls: "bg-yellow-300 text-yellow-950" },
];

export function StatusSystemScreen() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Status System"
        description="One unified status vocabulary across every module."
      />

      <div className="space-y-6">
        {/* ------------------------------------------------ */}
        {/* 1 · Status vocabulary                             */}
        {/* ------------------------------------------------ */}
        <DSSection
          title="Status vocabulary"
          purpose="The complete, governed list. If a screen shows a status, it is one of these — with one of these tones."
        >
          <DSTokenTable
            head={["Status", "Badge", "Meaning", "Typical usage"]}
            rows={VOCABULARY.map((v) => [
              v.status,
              <StatusBadge key={v.status} status={v.status} />,
              v.meaning,
              v.usage,
            ])}
          />
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Approved, Rejected, Blocked and Error currently render with the neutral slate tone — their semantic tone assignment is tracked
            with the approval-module vocabulary (see Governance below). Never alias an existing status to a new color locally; unknown
            statuses fall back to slate by design.
          </p>
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 2 · Presentations                                 */}
        {/* ------------------------------------------------ */}
        <DSSection
          title="Presentations"
          purpose="Four sanctioned forms — pick by density and intent, never by taste."
        >
          <DSStage>
            <div className="grid gap-x-8 gap-y-8 md:grid-cols-2">
              <DSExample
                label={
                  <span className="block">
                    Status badge
                    <span className="mt-1 block text-[11px] font-normal tracking-normal text-slate-500">
                      Dot + tinted pill — the default form for detail panels, list headers and cards.
                    </span>
                  </span>
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status="Connected" />
                  <StatusBadge status="Under Review" />
                  <StatusBadge status="Probation" size="sm" />
                </div>
              </DSExample>

              <DSExample
                label={
                  <span className="block">
                    Status dot
                    <span className="mt-1 block text-[11px] font-normal tracking-normal text-slate-500">
                      h-1.5 dot + plain text — dense tables and mobile lists where pills won't fit.
                    </span>
                  </span>
                }
              >
                <div role="list" aria-label="Integration sync status" className="w-full max-w-[300px] divide-y divide-slate-100 rounded-lg border border-slate-200/90 bg-white">
                  {DENSE_ROWS.map((r) => (
                    <div role="listitem" key={r.name} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                      <span className="truncate text-slate-600">{r.name}</span>
                      <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                        <span className={cn("h-1.5 w-1.5 rounded-full", r.dot)} aria-hidden />
                        <span className={cn("font-medium", r.text)}>{r.status}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </DSExample>

              <DSExample
                label={
                  <span className="block">
                    Status icon + text
                    <span className="mt-1 block text-[11px] font-normal tracking-normal text-slate-500">
                      For “Configuration Required” — an action is implied, so the violet tile + label leads.
                    </span>
                  </span>
                }
              >
                <div className="flex items-center gap-2.5 rounded-lg border border-slate-200/90 bg-white px-3.5 py-2.5">
                  <IconTile tone="violet" size="sm" icon={<PlugZap />} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-800">Razorpay payouts</p>
                    <p className="text-[11px] font-medium text-violet-700">Configuration required — add API keys to start syncing</p>
                  </div>
                </div>
              </DSExample>

              <DSExample
                label={
                  <span className="block">
                    Status text with count
                    <span className="mt-1 block text-[11px] font-normal tracking-normal text-slate-500">
                      Summary line for list footers and dashboard tiles — counts first, statuses aggregated.
                    </span>
                  </span>
                }
              >
                <div className="rounded-lg border border-slate-200/90 bg-white px-3.5 py-2.5">
                  <p className="text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                      8 connected
                    </span>
                    <span className="mx-1.5 text-slate-300" aria-hidden>
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-red-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                      1 disconnected
                    </span>
                    <span className="mx-1.5 text-slate-300" aria-hidden>
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                      2 pending
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">11 integrations · synced 4 minutes ago</p>
                </div>
              </DSExample>
            </div>
          </DSStage>
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 3 · Never color-only                              */}
        {/* ------------------------------------------------ */}
        <DSSection
          title="Never color-only"
          purpose="A hard system rule: color is an accent on a status, never the carrier of its meaning."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <DSGuidance kind="dont" title="a bare dot, alone">
              <div className="rounded-lg border border-slate-200/90 bg-white p-4">
                <div className="flex items-center gap-2 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                  <span className="text-[13px] text-slate-300">— no text —</span>
                </div>
              </div>
              <p className="mt-3">
                A color-only dot announces <em>nothing</em> to screen readers, disappears for color-blind users (~8% of men), and cannot be
                searched or quoted. This fails design review — no exceptions.
              </p>
            </DSGuidance>
            <DSGuidance kind="do" title="dot + text, always — icon optional">
              <div className="rounded-lg border border-slate-200/90 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <StatusBadge status="Disconnected" />
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-red-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                    Disconnected
                  </span>
                </div>
              </div>
              <p className="mt-3">
                The dot is decorative (<DSVar>aria-hidden</DSVar>) — the adjacent text carries the meaning for everyone. Add an icon when an
                action is implied (see Presentations).
              </p>
            </DSGuidance>
          </div>
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 4 · Restraint                                     */}
        {/* ------------------------------------------------ */}
        <DSSection title="Restraint" purpose="Quiet, semantic, few. Statuses guide attention — they don't decorate the page.">
          <div className="grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="quiet tinted pills, dot + text, semantic colors only">
              <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200/70 bg-white p-4">
                <StatusBadge status="Pending" />
                <StatusBadge status="Active" />
                <StatusBadge status="Disconnected" />
                <StatusBadge status="Draft" />
                <StatusBadge status="On Leave" />
                <StatusBadge status="Inactive" />
              </div>
              <p className="mt-3">
                Six statuses, five quiet tones — every color maps to a governed meaning (emerald success, amber pending, red error, blue
                in-progress, violet configuration; Screen 15 · Color System).
              </p>
            </DSGuidance>
            <DSGuidance kind="dont" title="bright oversized pills, invented status colors, undefined statuses">
              <div aria-hidden className="flex flex-wrap gap-2.5 rounded-xl border border-red-200/70 bg-red-50/40 p-4">
                {ANTI_PATTERN_PILLS.map((p) => (
                  <span key={p.label} className={cn("rounded-full px-4 py-1.5 text-xs font-bold", p.cls)}>
                    {p.label}
                  </span>
                ))}
              </div>
              <p className="mt-3">
                Anti-pattern, explicitly: six hues that exist nowhere in the system, shouting at equal volume — none of them map to a meaning,
                and none of them appear in the vocabulary above.
              </p>
            </DSGuidance>
          </div>
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 5 · Governance spec                               */}
        {/* ------------------------------------------------ */}
        <DSSection title="Governance" purpose="How the vocabulary stays one vocabulary.">
          <DSSpec
            rows={[
              {
                label: "States",
                value: "The vocabulary above IS the state list. Screens never invent local statuses — if a state isn't here, it isn't shipped.",
              },
              {
                label: "Adding a status",
                value: (
                  <>
                    Propose name, meaning and typical usage to design-system review; on approval the status and its tone join the shared tone
                    map (<DSVar>primitives.tsx</DSVar>). Local tone overrides are never merged.
                  </>
                ),
              },
              {
                label: "Responsive",
                value: "Badges wrap naturally at narrow widths; dense mobile lists drop to dot + text. Status text never truncates to ellipsis — meaning is never cut.",
              },
              {
                label: "Accessibility",
                value: "Text is always present and the dot is decorative (aria-hidden). Semantic tones only — color is never the sole signal (see Never color-only).",
              },
            ]}
          />
          <DSCaption className="mt-5">
            22 governed statuses · 5 semantic tones + neutral slate fallback · 4 sanctioned presentations · 0 local color overrides.
          </DSCaption>
        </DSSection>
      </div>

      <DSScreenNav id="status-system" />
    </>
  );
}
