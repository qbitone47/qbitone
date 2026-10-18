"use client";

import * as React from "react";
import { Check, ChevronDown, Copy, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
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
} from "../ds/doc";

// ============================================================
// Screen 16 · Buttons — every variant, state and usage rule.
// Live specimens above; the state matrix below uses forced
// classes so all states are visible at once.
// ============================================================

/** Specimen label: variant name + quiet usage line. */
function SpecLabel({ name, usage }: { name: string; usage: string }) {
  return (
    <span className="block">
      {name}
      <span className="mt-1 block text-[11px] font-normal tracking-normal text-slate-500">{usage}</span>
    </span>
  );
}

/** Column header cell for the state matrix. */
function MatrixHead({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-3 pb-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
      {children}
    </th>
  );
}

/** Row header cell for the state matrix. */
function MatrixRowHead({ name, note }: { name: string; note: string }) {
  return (
    <th scope="row" className="px-3 py-3.5 text-left align-middle">
      <span className="block text-[13px] font-medium text-slate-800">{name}</span>
      <span className="block text-[11px] text-slate-400">{note}</span>
    </th>
  );
}

const MATRIX_STATES = ["Default", "Hover", "Pressed", "Focused", "Disabled", "Loading", "Success"] as const;

export function ButtonsScreen() {
  const { toast } = useToast();

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Buttons"
        description="Every button variant, state and usage rule in one reference."
      />

      <div className="space-y-6">
        {/* ------------------------------------------------ */}
        {/* 1 · Variants                                      */}
        {/* ------------------------------------------------ */}
        <DSSection
          title="Variants"
          purpose="Seven sanctioned expressions of an action — every button in the product is exactly one of these."
        >
          <DSStage>
            <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <DSExample label={<SpecLabel name="Primary · Add Department" usage="The ONE main action per view — never destructive." />}>
                <Button
                  onClick={() =>
                    toast({ title: "Add Department", description: "Primary — the single main action on a view." })
                  }
                >
                  <Plus />
                  Add Department
                </Button>
              </DSExample>

              <DSExample label={<SpecLabel name="Secondary · View Details" usage="Supporting actions beside a primary." />}>
                <Button
                  variant="secondary"
                  onClick={() => toast({ title: "View Details", description: "Secondary — supporting emphasis." })}
                >
                  View Details
                </Button>
              </DSExample>

              <DSExample label={<SpecLabel name="Outline · Cancel" usage="Low emphasis on white surfaces; pairs with a primary." />}>
                <Button variant="outline" onClick={() => toast({ title: "Cancelled", description: "No changes were made." })}>
                  Cancel
                </Button>
              </DSExample>

              <DSExample label={<SpecLabel name="Tertiary / Ghost · Dismiss" usage="Toolbars, row actions, low emphasis." />}>
                <Button
                  variant="ghost"
                  onClick={() => toast({ title: "Dismissed", description: "Ghost — quietest treatment; never the main action." })}
                >
                  Dismiss
                </Button>
              </DSExample>

              <DSExample label={<SpecLabel name="Destructive · Delete department" usage="Irreversible only — always confirmed (Screen 23)." />}>
                <Button
                  variant="destructive"
                  onClick={() =>
                    toast({
                      title: "Confirmation required",
                      description: "Delete opens a confirm dialog first — Screen 23 · Modal & Drawer.",
                    })
                  }
                >
                  Delete department
                </Button>
              </DSExample>

              <DSExample label={<SpecLabel name="Text / Link · Learn more about roles" usage="Inline and navigational actions." />}>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => toast({ title: "Learn more about roles", description: "Link — reads as navigation, not a command." })}
                >
                  Learn more about roles
                </Button>
              </DSExample>

              <DSExample label={<SpecLabel name="Icon-only · Edit role" usage="Dense toolbars — always aria-label + tooltip." />}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Edit role"
                      onClick={() => toast({ title: "Edit role", description: "Announced via aria-label; tooltip appears on focus and hover." })}
                    >
                      <Pencil />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit role</TooltipContent>
                </Tooltip>
              </DSExample>
            </div>
          </DSStage>

          <DSSpec
            className="mt-6"
            rows={[
              {
                label: "Primary (default)",
                value: "The one main action per view. Never used for destructive actions, and never repeated twice on one screen.",
              },
              {
                label: "Secondary",
                value: "Supporting actions that sit next to a primary — View Details, Preview, Export. Use when outline feels too quiet.",
              },
              {
                label: "Ghost / Tertiary",
                value: "Toolbars, table row actions and repeated low-emphasis controls. It must never carry a view's main action.",
              },
              {
                label: "Destructive",
                value: "Irreversible actions only — always paired with a confirmation dialog (Screen 23 · Modal & Drawer).",
              },
              {
                label: "Text / Link",
                value: "Inline and navigational styling inside prose, empty states and footers — underline appears on hover.",
              },
              {
                label: "Icon-only",
                value: "Dense toolbars where labels don't fit. Always ships aria-label plus a tooltip that shows on focus and hover.",
              },
            ]}
          />
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 2 · States                                        */}
        {/* ------------------------------------------------ */}
        <DSSection
          title="States"
          purpose="All interactive states at a glance, for the three action-bearing variants. The live specimens above demonstrate real hover and focus."
        >
          <DSStage variant="plain" className="block">
            <div className="qubit-scroll overflow-x-auto">
              {/*
                Static matrix — forced classes so every state renders at once.
                pointer-events-none keeps forced colors stable; tabIndex -1 keeps
                illustrations out of the tab order (live controls are above).
              */}
              <table className="pointer-events-none w-full border-collapse text-left text-[13px]" style={{ minWidth: 840 }}>
                <thead>
                  <tr>
                    <th scope="col" className="px-3 pb-2.5">
                      <span className="sr-only">Variant</span>
                    </th>
                    {MATRIX_STATES.map((s) => (
                      <MatrixHead key={s}>{s}</MatrixHead>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Primary */}
                  <tr className="border-b border-slate-100">
                    <MatrixRowHead name="Primary" note="default variant" />
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1}>Add Department</Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} className="bg-blue-700 hover:bg-blue-700">
                        Add Department
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} className="bg-blue-800 hover:bg-blue-800">
                        Add Department
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} className="ring-2 ring-blue-200 ring-offset-2">
                        Add Department
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} disabled className="pointer-events-none opacity-50">
                        Add Department
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} aria-busy="true" className="pointer-events-none">
                        <Loader2 className="animate-spin" />
                        Saving…
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} className="pointer-events-none bg-emerald-600 text-white hover:bg-emerald-600">
                        <Check />
                        Saved
                      </Button>
                    </td>
                  </tr>

                  {/* Secondary */}
                  <tr className="border-b border-slate-100">
                    <MatrixRowHead name="Secondary" note="secondary variant" />
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} variant="secondary">
                        View Details
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} variant="secondary" className="bg-slate-200 hover:bg-slate-200">
                        View Details
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} variant="secondary" className="bg-slate-300 hover:bg-slate-300">
                        View Details
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} variant="secondary" className="ring-2 ring-blue-200 ring-offset-2">
                        View Details
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} variant="secondary" disabled className="pointer-events-none opacity-50">
                        View Details
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} variant="secondary" aria-busy="true" className="pointer-events-none">
                        <Loader2 className="animate-spin" />
                        Saving…
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} variant="secondary" className="pointer-events-none text-emerald-700 hover:text-emerald-700">
                        <Check className="text-emerald-600" />
                        Saved
                      </Button>
                    </td>
                  </tr>

                  {/* Destructive */}
                  <tr>
                    <MatrixRowHead name="Destructive" note="destructive variant" />
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} variant="destructive">
                        Delete
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} variant="destructive" className="bg-red-700 hover:bg-red-700">
                        Delete
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} variant="destructive" className="bg-red-800 hover:bg-red-800">
                        Delete
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} variant="destructive" className="ring-2 ring-blue-200 ring-offset-2">
                        Delete
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Button tabIndex={-1} variant="destructive" disabled className="pointer-events-none opacity-50">
                        Delete
                      </Button>
                    </td>
                    <td className="px-3 py-3.5 text-center" colSpan={2}>
                      <span className="text-[11px] text-slate-300">n/a — destructive ends at confirmation (Screen 23)</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <DSCaption className="mt-4">
              One focus ring across every variant. Loading disables interaction; success is solid emerald on primary, quiet emerald text on
              secondary — never a new hue.
            </DSCaption>
          </DSStage>
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 3 · Sizes                                         */}
        {/* ------------------------------------------------ */}
        <DSSection title="Sizes" purpose="Three heights cover the product; icon buttons follow the density around them.">
          <DSStage>
            <div className="flex flex-wrap items-end gap-x-10 gap-y-8">
              <DSExample label="sm · h-8 — dense tables & toolbars">
                <Button
                  size="sm"
                  className="text-xs"
                  onClick={() => toast({ title: "Add Department", description: "sm size — h-8, text-xs, icon 14px." })}
                >
                  <Plus className="size-3.5" />
                  Add Department
                </Button>
              </DSExample>

              <DSExample label="default · h-9 — most product UI">
                <Button onClick={() => toast({ title: "Save Changes", description: "Default size — h-9. This is the workhorse." })}>
                  Save Changes
                </Button>
              </DSExample>

              <DSExample label="lg · h-10 — page-level primary actions">
                <Button size="lg" onClick={() => toast({ title: "Create Role", description: "lg size — reserved for page-level primary actions." })}>
                  <Plus />
                  Create Role
                </Button>
              </DSExample>

              <DSExample label="icon-only · h-9 standard / h-8 dense">
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Edit role"
                        onClick={() => toast({ title: "Edit role", description: "Icon-only at h-9 (36px)." })}
                      >
                        <Pencil />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit role</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8! w-8!"
                        aria-label="Copy invite link"
                        onClick={() => toast({ title: "Invite link copied", description: "Dense icon-only at h-8 (32px)." })}
                      >
                        <Copy />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy invite link</TooltipContent>
                  </Tooltip>
                </div>
              </DSExample>
            </div>
          </DSStage>
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 4 · With icons & counts                           */}
        {/* ------------------------------------------------ */}
        <DSSection title="With icons & counts" purpose="Icons and count chips extend a button without changing its contract.">
          <DSStage>
            <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              <DSExample label="Leading icon · creation actions">
                <Button onClick={() => toast({ title: "Add Department", description: "Leading icon — 16px, matches label weight." })}>
                  <Plus />
                  Add Department
                </Button>
              </DSExample>

              <DSExample label="Trailing chevron · opens a menu">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      Bulk actions
                      <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem>Move to department</DropdownMenuItem>
                    <DropdownMenuItem>Export selected</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-600">Deactivate selected</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </DSExample>

              <DSExample label="Count chip · queued work waiting on you">
                <Button
                  variant="outline"
                  onClick={() => toast({ title: "Approvals", description: "3 requests are waiting for your review." })}
                >
                  Approvals
                  <Badge className="ml-0.5 h-5 rounded-full bg-blue-50 px-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50">
                    3
                  </Badge>
                </Button>
              </DSExample>

              <DSExample label="Full-width CTA · mobile primary action">
                <div className="w-full max-w-[230px]">
                  <Button className="w-full" onClick={() => toast({ title: "Create Role", description: "Full-width on mobile, auto width from sm up." })}>
                    Create Role
                  </Button>
                </div>
              </DSExample>
            </div>
          </DSStage>
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 5 · Behavior                                      */}
        {/* ------------------------------------------------ */}
        <DSSection title="Behavior" purpose="The rules every button obeys, wherever it renders.">
          <DSSpec
            rows={[
              {
                label: "Motion",
                value: (
                  <>
                    Transitions run <DSVar>150–200ms</DSVar> on color and elevation only — buttons never move layout, scale or bounce.
                  </>
                ),
              },
              {
                label: "Loading",
                value: (
                  <>
                    Loading swaps the icon for a spinner (<DSVar>Loader2</DSVar>) and the label for an active verb — “Saving…” — and disables
                    interaction until it resolves.
                  </>
                ),
              },
              {
                label: "Destructive",
                value: "Reserved for irreversible actions and always opened through a confirmation dialog (Screen 23 · Modal & Drawer). Never rendered as ghost or link.",
              },
              {
                label: "Focus",
                value: "Focus is visible on every button and returns to the trigger after menus and dialogs close — focus is never lost.",
              },
              {
                label: "One primary per view",
                value: "Exactly one default-variant button per screen; every other action steps down to secondary, outline or ghost.",
              },
              {
                label: "Labels",
                value: "Verbs first, specific and honest: “Save Changes”, “Add Department”. Never “OK”, “Yes” or “Submit”.",
              },
            ]}
          />
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 6 · Guidance                                      */}
        {/* ------------------------------------------------ */}
        <DSSection title="Guidance" purpose="The two calls reviewers make on every screen.">
          <div className="grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="one primary per view; verbs first">
              <p>Exactly one default button per screen, with a specific verb-object label.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm">Save Changes</Button>
                <Button size="sm" variant="outline">
                  Discard
                </Button>
                <span className="text-[11px] text-slate-400">“Save Changes” — not “Changes saving”, “OK” or “Submit”.</span>
              </div>
            </DSGuidance>
            <DSGuidance kind="dont" title="pill mega-buttons, colored button soup, ghost as the main action">
              <div className="flex flex-wrap items-center gap-2">
                <Button tabIndex={-1} className="h-11 rounded-full px-8">
                  Giant pill CTA
                </Button>
                <Button tabIndex={-1} className="pointer-events-none bg-emerald-600 text-white hover:bg-emerald-600">
                  Save
                </Button>
                <Button tabIndex={-1} className="pointer-events-none bg-amber-500 text-white hover:bg-amber-500">
                  Preview
                </Button>
                <Button tabIndex={-1} className="pointer-events-none bg-violet-600 text-white hover:bg-violet-600">
                  Share
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button tabIndex={-1} variant="ghost">
                  Publish changes
                </Button>
                <span className="text-[11px] text-slate-400">Giant pills, invented action colors, and a ghost carrying the main action — all fail review.</span>
              </div>
            </DSGuidance>
          </div>
        </DSSection>
      </div>

      <DSScreenNav id="buttons" />
    </>
  );
}
