"use client";

import * as React from "react";
import { Clock, Plus, Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "../page-header";
import {
  DSCaption,
  DSSection,
  DSScreenNav,
  DSExample,
  DSGuidance,
  DSSpec,
  DSStage,
  DSTokenTable,
  DSVar,
} from "../ds/doc";
import { useQubitNav } from "../nav-context";
import { screensByModule, type ScreenId } from "@/lib/qubit/screens";
import { useToast } from "@/hooks/use-toast";
import { Avatar } from "../primitives";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { employees, type Employee } from "@/lib/qubit/data";

// ============================================================
// Screen 22 — Command Bar
// Global ⌘ K search and quick-action experience: trigger,
// anatomy, live demo, keyboard model and scope boundaries.
// ============================================================

const ENTERPRISE_SCREENS = screensByModule("enterprise");

const RECENT_PAGES: { id: ScreenId; num: string; label: string }[] = [
  { id: "role-matrix", num: "03", label: "Role Matrix" },
  { id: "integration-map", num: "11", label: "Integration Map" },
  { id: "permission-matrix", num: "04", label: "Permission Matrix" },
];

const RECENT_SEARCHES = ["Arjun Mehta", "Approval matrix", "Integration health"];

const RESULT_PEOPLE: Employee[] = ["arjun", "anita"]
  .map((id) => employees.find((e) => e.id === id))
  .filter((e): e is Employee => Boolean(e));

/** Numbered annotation marker used across the anatomy specimen. */
function Marker({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-blue-50 text-[9px] font-semibold text-blue-700"
    >
      {n}
    </span>
  );
}

/** Static replica row (mirrors CommandItem metrics). */
function AnatomyRow({
  icon,
  children,
  hint,
  selected,
  muted,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
  selected?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] text-slate-700",
        selected && "bg-slate-100",
      )}
    >
      {icon}
      <span className={cn("min-w-0 flex-1 truncate", muted && "text-slate-500")}>{children}</span>
      {hint && <span className="qubit-kbd">{hint}</span>}
    </div>
  );
}

function AnatomyHeading({ children, marker }: { children: React.ReactNode; marker?: number }) {
  return (
    <p className="flex items-center gap-2 px-2 pb-1.5 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
      {children}
      {marker != null && <span className="ml-auto"><Marker n={marker} /></span>}
    </p>
  );
}

// ------------------------------------------------------------
// Screen
// ------------------------------------------------------------

export function CommandBarScreen() {
  const { navigate } = useQubitNav();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);

  const run = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Command Bar"
        description="Global ⌘ K search and quick-action experience."
      />

      <div className="space-y-6">
        {/* 1 — Trigger affordances */}
        <DSSection
          title="Trigger affordances"
          purpose="The pill advertises the shortcut; the shortcut is owned by the app shell."
        >
          <DSStage align="center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-label="Search anything — opens the command bar"
                  className="flex h-10 w-72 items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50/80 pl-4 pr-2.5 text-sm text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 hover:border-slate-300 hover:bg-slate-50"
                >
                  <Search className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1 text-left">Search anything…</span>
                  <span className="qubit-kbd">⌘ K</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  aria-label="Search"
                  onClick={() => setOpen(true)}
                >
                  <Search className="h-4.5 w-4.5" />
                </Button>
              </div>
              <DSCaption className="max-w-md text-center">
                Topbar pill ≥ lg (w-72, h-10, rounded-full) with the ⌘ K chip; below lg it collapses to this ghost icon
                button. Both open the live demo below — the shortcut itself is bound once, at app level.
              </DSCaption>
            </div>
          </DSStage>
        </DSSection>

        {/* 2 — Anatomy */}
        <DSSection
          title="Anatomy"
          purpose="One input, grouped results, footer hints — every row pairs an element with a label and optional kbd."
        >
          <DSStage align="center">
            <div className="w-full max-w-[440px]">
              <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
                {/* input row */}
                <div className="flex h-12 items-center gap-2.5 border-b border-slate-100 px-3">
                  <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-400">Search screens, modules and actions…</span>
                  <span className="qubit-kbd">esc</span>
                  <Marker n={1} />
                </div>

                {/* grouped results */}
                <div className="p-1.5">
                  <AnatomyHeading marker={2}>Recent searches</AnatomyHeading>
                  <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
                    {RECENT_SEARCHES.map((c) => (
                      <span
                        key={c}
                        className="rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                      >
                        {c}
                      </span>
                    ))}
                  </div>

                  <AnatomyHeading>Suggested actions</AnatomyHeading>
                  <AnatomyRow icon={<Plus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />} selected hint="↵">
                    Create role
                  </AnatomyRow>
                  <AnatomyRow icon={<UserPlus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />}>
                    Invite employee
                  </AnatomyRow>

                  <AnatomyHeading>Recent pages</AnatomyHeading>
                  <AnatomyRow
                    icon={<Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="w-4 text-[10px] font-semibold tabular-nums text-slate-400">03</span>
                      Role Matrix
                    </span>
                  </AnatomyRow>
                  <AnatomyRow
                    icon={<Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="w-4 text-[10px] font-semibold tabular-nums text-slate-400">11</span>
                      Integration Map
                    </span>
                  </AnatomyRow>

                  <AnatomyHeading>Search results — people</AnatomyHeading>
                  {RESULT_PEOPLE.map((p) => (
                    <AnatomyRow
                      key={p.id}
                      icon={<Avatar name={p.name} size="xs" />}
                      muted={false}
                    >
                      <span className="flex-1 font-medium text-slate-800">{p.name}</span>
                      <span className="text-xs text-slate-400">{p.department}</span>
                    </AnatomyRow>
                  ))}
                </div>

                {/* footer hints */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 px-3 py-2">
                  <span className="flex items-center gap-1 text-[11.5px] text-slate-500">
                    <span className="qubit-kbd">↑</span>
                    <span className="qubit-kbd">↓</span> navigate
                  </span>
                  <span className="flex items-center gap-1 text-[11.5px] text-slate-500">
                    <span className="qubit-kbd">↵</span> select
                  </span>
                  <span className="flex items-center gap-1 text-[11.5px] text-slate-500">
                    <span className="qubit-kbd">esc</span> close
                  </span>
                  <span className="ml-auto"><Marker n={3} /></span>
                </div>
              </div>

              <ol className="mt-3 space-y-1.5 text-[12.5px] leading-relaxed text-slate-500">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5"><Marker n={1} /></span>
                  <span>
                    <strong className="font-medium text-slate-700">Input</strong> — focus lands here; one query filters every
                    group at once.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5"><Marker n={2} /></span>
                  <span>
                    <strong className="font-medium text-slate-700">Grouped results</strong> — uppercase headings order the
                    answer: recents, actions, pages, people.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5"><Marker n={3} /></span>
                  <span>
                    <strong className="font-medium text-slate-700">Footer hints</strong> — the keyboard model is always
                    visible; nothing depends on hover.
                  </span>
                </li>
              </ol>
            </div>
          </DSStage>
        </DSSection>

        {/* 3 — Live demo */}
        <DSSection
          title="Live demo"
          purpose="A real CommandDialog, screen-scoped — the app shell keeps its single global ⌘ K listener."
        >
          <DSStage align="center">
            <div className="flex flex-col items-center gap-3">
              <Button onClick={() => setOpen(true)} className="h-9">
                Open command bar
                <span className="qubit-kbd">⌘ K</span>
              </Button>
              <DSCaption className="max-w-lg text-center">
                This instance binds <strong className="font-medium text-slate-600">no second document listener</strong> — the
                shell owns ⌘ K globally. Type <span className="qubit-kbd">org</span> to watch cmdk filter down to 01.
                Organization Structure; type gibberish to meet the empty state. Every row runs something real.
              </DSCaption>
            </div>
          </DSStage>

          <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Search screens, modules and actions…" />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Recent pages">
                {RECENT_PAGES.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.num} ${p.label} recent page`}
                    onSelect={() => run(() => navigate(p.id))}
                    className="gap-3"
                  >
                    <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <span className="w-4 text-[10px] font-semibold tabular-nums text-slate-400">{p.num}</span>
                    <span className="text-[13px] font-medium text-slate-800">{p.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Suggested actions">
                <CommandItem
                  value="create role action"
                  onSelect={() =>
                    run(() => toast({ title: "Create role", description: "Opens the Role Matrix create form — action demo." }))
                  }
                >
                  <Plus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  <span className="text-[13px]">Create role</span>
                </CommandItem>
                <CommandItem
                  value="invite employee action"
                  onSelect={() =>
                    run(() => toast({ title: "Invite employee", description: "Opens the invitation flow — action demo." }))
                  }
                >
                  <UserPlus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  <span className="text-[13px]">Invite employee</span>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Go to screen — Enterprise">
                {ENTERPRISE_SCREENS.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={`${s.num} ${s.title} ${s.shortTitle}`}
                    onSelect={() => run(() => navigate(s.id))}
                    className="gap-3"
                  >
                    <span className="w-6 text-[10px] font-semibold tabular-nums text-slate-400">{s.num}</span>
                    <span className="text-[13px] font-medium text-slate-800">{s.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </CommandDialog>
        </DSSection>

        {/* 4 — Keyboard model */}
        <DSSection title="Keyboard hints" purpose="The command bar is keyboard-first; the mouse is the fallback.">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200/90 bg-slate-50/60 px-4 py-3">
            <span className="flex items-center gap-1.5 text-[12.5px] text-slate-600">
              <span className="qubit-kbd">↑</span>
              <span className="qubit-kbd">↓</span> Navigate
            </span>
            <span className="flex items-center gap-1.5 text-[12.5px] text-slate-600">
              <span className="qubit-kbd">↵</span> Select
            </span>
            <span className="flex items-center gap-1.5 text-[12.5px] text-slate-600">
              <span className="qubit-kbd">esc</span> Close
            </span>
            <span className="ml-auto hidden text-[11px] text-slate-400 sm:block">The same hints repeat in the dialog footer</span>
          </div>

          <DSTokenTable
            className="mt-4"
            head={["Key", "Action", "Scope"]}
            rows={[
              ["⌘ K / Ctrl K", "Open the command bar", "Global — the app shell owns the single listener"],
              ["↑ ↓", "Move through results", "Only while the dialog is open; selection follows groups in order"],
              ["↵ Enter", "Run the highlighted item", "Navigate, act or insert — every row does something real"],
              ["esc", "Dismiss", "Closes the dialog and returns focus to the trigger"],
            ]}
          />
        </DSSection>

        {/* 5 — Scope & boundary */}
        <DSSection title="Scope & boundary" purpose="Search is an accelerator — it never replaces the map.">
          <div className="grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="make search the primary interaction">
              Results grouped by type; recent and suggested ahead of raw matches; filtering under 100ms; every row executes
              something real — navigate, act or insert. The command bar is the fastest path for users who already know the
              product.
            </DSGuidance>
            <DSGuidance kind="dont" title="turn ⌘ K into a chatbot">
              No floating AI bubble, no decorative AI buttons, no conversational filler inside the palette. AI assistance may
              join later as an optional extension of results — never the dominant surface, never a second entry point to
              maintain.
            </DSGuidance>
          </div>
        </DSSection>

        {/* Specification */}
        <DSSection title="Specification">
          <DSSpec
            rows={[
              { label: "Purpose", value: "One surface to search screens, people and actions — and run them without learning menu paths." },
              { label: "Use when", value: "Jump-to-screen, quick actions (create, invite), lookup by person or record name." },
              { label: "Avoid when", value: "As the only navigation — the sidebar remains the map; ⌘ K is the shortcut, not the territory." },
              {
                label: "States",
                value: (
                  <>
                    Trigger (idle pill) · open · loading (reuse the skeleton system) · empty · no results (
                    <DSVar>CommandEmpty</DSVar> “No results found.”).
                  </>
                ),
              },
              { label: "Responsive", value: "Pill ≥ lg in the topbar; below lg a ghost search icon opens the same dialog, which renders as a full-width sheet on mobile." },
              {
                label: "Accessibility",
                value: (
                  <>
                    Focus is trapped; <DSVar>role="dialog"</DSVar> with an accessible name; shortcut discoverable in the pill
                    chip and the footer hints.
                  </>
                ),
              },
            ]}
          />
        </DSSection>
      </div>

      <DSScreenNav id="command-bar" />
    </>
  );
}
