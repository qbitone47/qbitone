"use client";

import * as React from "react";
import {
  Bell,
  Building2,
  ClipboardCheck,
  FileText,
  Inbox,
  Plug,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, SearchInput } from "../primitives";
import { PageHeader } from "../page-header";
import {
  DSCaption,
  DSGuidance,
  DSExample,
  DSScreenNav,
  DSSection,
  DSSpec,
  DSStage,
  DSVar,
} from "../ds/doc";

// ============================================================
// Screen 25 · Empty States
// What users see when there is no data — and what to do next.
// ============================================================

/** Numbered anatomy callout used beside the enlarged specimen. */
function AnatomyCallout({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
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

/** Bordered white panel that shows the bounds of an EmptyState placement. */
function StatePanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

export function EmptyStatesScreen() {
  const { toast } = useToast();
  const [docQuery, setDocQuery] = React.useState("");

  const clearFilters = (what: string) => toast({ title: `${what} cleared (demo)`, description: "The full, unfiltered list is restored." });

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Empty States"
        description="What users see when there is no data — and what to do next."
      />

      <div className="space-y-6">
        {/* ——— 1 · Anatomy ——— */}
        <DSSection
          title="Anatomy"
          purpose="Four parts, one job: explain the empty state and offer the way out."
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <StatePanel>
              <EmptyState
                icon={<Building2 />}
                title="No departments found"
                message="Try changing your search or department filter."
                action={
                  <Button size="sm" variant="outline" onClick={() => clearFilters("Filters")}>
                    Clear filters
                  </Button>
                }
                className="py-14"
              />
            </StatePanel>
            <ol className="flex flex-col gap-4 rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 md:p-5">
              <AnatomyCallout n={1} title="Icon tile">
                48px soft blue tile (<DSVar>qubit-icon-tile-accent</DSVar>) with a single module-relevant
                icon. It signals the subject, not alarm — never red, never animated.
              </AnatomyCallout>
              <AnatomyCallout n={2} title="Title">
                One short, specific line — “No departments found”, never “Empty” or “Nothing here”.
                Sentence case, semibold, 14px.
              </AnatomyCallout>
              <AnatomyCallout n={3} title="Short explanation">
                One muted line that says why it is empty or what to try next. Optional when the title
                is self-explanatory.
              </AnatomyCallout>
              <AnatomyCallout n={4} title="Next action">
                At most one primary way forward (“Clear filters”, “Add integration”). Omitted when
                there is genuinely nothing to do.
              </AnatomyCallout>
            </ol>
          </div>
          <DSCaption className="mt-3">
            Rendered with the shared <DSVar>EmptyState</DSVar> primitive — py-12 default, py-14 for
            full-panel placement.
          </DSCaption>
        </DSSection>

        {/* ——— 2 · Variants gallery ——— */}
        <DSSection
          title="Variants gallery"
          purpose="Real Qubit One copy for the most common empty collections."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <DSExample
              label={
                <>
                  Task list — assigned work is empty
                  <span className="mt-0.5 block font-normal normal-case tracking-normal text-slate-500">
                    Use for: personal work queues, “My tasks” widgets.
                  </span>
                </>
              }
            >
              <StatePanel>
                <EmptyState
                  icon={<Inbox />}
                  title="You're all caught up"
                  message="New tasks appear here when work is assigned to you."
                  action={
                    <Button size="sm" onClick={() => toast({ title: "Create task (demo)", description: "Opens the new-task dialog with defaults for your role." })}>
                      Create task
                    </Button>
                  }
                />
              </StatePanel>
            </DSExample>

            <DSExample
              label={
                <>
                  Directory — search returned nothing; two ways back
                  <span className="mt-0.5 block font-normal normal-case tracking-normal text-slate-500">
                    Use for: filtered directories — always offer a way back plus a way forward.
                  </span>
                </>
              }
            >
              <StatePanel>
                <EmptyState
                  icon={<Users />}
                  title="No employees match 'arj'."
                  message="Check the spelling or search by email or employee ID."
                  action={
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => clearFilters("Search")}>
                        Clear search
                      </Button>
                      <Button
                        size="sm"
                        variant="link"
                        className="h-8"
                        onClick={() => toast({ title: "Add employee (demo)", description: "Opens the employee creation form in Onboarding." })}
                      >
                        Add employee
                      </Button>
                    </div>
                  }
                />
              </StatePanel>
            </DSExample>

            <DSExample
              label={
                <>
                  Documents — collection not started yet
                  <span className="mt-0.5 block font-normal normal-case tracking-normal text-slate-500">
                    Use for: first-run collections — no action when upload lives in the page header.
                  </span>
                </>
              }
            >
              <StatePanel>
                <EmptyState
                  icon={<FileText />}
                  title="No documents yet"
                  message="Upload your first document to get started."
                />
              </StatePanel>
            </DSExample>

            <DSExample
              label={
                <>
                  Notifications — quiet is a good state; no action offered
                  <span className="mt-0.5 block font-normal normal-case tracking-normal text-slate-500">
                    Use for: feeds — reassure instead of inviting manufactured activity.
                  </span>
                </>
              }
            >
              <StatePanel>
                <EmptyState
                  icon={<Bell />}
                  title="You're up to date"
                  message="New alerts will appear here."
                />
              </StatePanel>
            </DSExample>

            <DSExample
              label={
                <>
                  Global search — no results across any module
                  <span className="mt-0.5 block font-normal normal-case tracking-normal text-slate-500">
                    Use for: ⌘ K and global search — coach toward a broader term.
                  </span>
                </>
              }
            >
              <StatePanel>
                <EmptyState
                  icon={<Search />}
                  title="No results found"
                  message="Nothing matches your query. Check spelling or try a broader term."
                  action={
                    <Button size="sm" variant="outline" onClick={() => clearFilters("Search")}>
                      Clear search
                    </Button>
                  }
                />
              </StatePanel>
            </DSExample>

            <DSExample
              label={
                <>
                  Integrations — first-run state with the primary setup action
                  <span className="mt-0.5 block font-normal normal-case tracking-normal text-slate-500">
                    Use for: empty hubs — the creating action is the whole point of the page.
                  </span>
                </>
              }
            >
              <StatePanel>
                <EmptyState
                  icon={<Plug />}
                  title="No integrations connected"
                  message="Connect your first system to sync data into Qubit One."
                  action={
                    <Button
                      size="sm"
                      onClick={() => toast({ title: "Add integration (demo)", description: "Opens the connector catalog — Salesforce, Tally, Zoho and more." })}
                    >
                      Add integration
                    </Button>
                  }
                />
              </StatePanel>
            </DSExample>

            <DSExample
              label={
                <>
                  Approvals — nothing is waiting on you
                  <span className="mt-0.5 block font-normal normal-case tracking-normal text-slate-500">
                    Use for: duty queues — the secondary action opens history, not pressure.
                  </span>
                </>
              }
              className="md:col-span-2"
            >
              <StatePanel>
                <EmptyState
                  icon={<ClipboardCheck />}
                  title="No approvals are waiting on you"
                  message="Requests routed to your role will appear here with their SLA countdown."
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => toast({ title: "View all requests (demo)", description: "Opens the full request history, including closed items." })}
                    >
                      View all requests
                    </Button>
                  }
                />
              </StatePanel>
            </DSExample>
          </div>
        </DSSection>

        {/* ——— 3 · Filtered vs truly empty ——— */}
        <DSSection
          title="Filtered vs truly empty"
          purpose="Two different situations with deliberately different copy and actions."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <StatePanel>
                <EmptyState
                  icon={<Search />}
                  title="No employees found"
                  message="Try a different name, role or department."
                  action={
                    <Button size="sm" variant="outline" onClick={() => clearFilters("Filters")}>
                      Clear filters
                    </Button>
                  }
                />
              </StatePanel>
              <p className="text-xs leading-relaxed text-slate-500">
                <span className="font-semibold text-slate-700">Filtered empty.</span> The data exists —
                the current view excludes it. Copy references the filters and the one relevant action
                is a way back to the full list.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <StatePanel>
                <EmptyState
                  icon={<Plus />}
                  title="No departments yet"
                  message="Create your first department to start building the org structure."
                  action={
                    <Button
                      size="sm"
                      onClick={() => toast({ title: "Create department (demo)", description: "Opens the same dialog as “Add department” in Org Structure." })}
                    >
                      Create your first department
                    </Button>
                  }
                />
              </StatePanel>
              <p className="text-xs leading-relaxed text-slate-500">
                <span className="font-semibold text-slate-700">Truly empty.</span> Nothing has been
                created yet — “yet” signals the list will grow. The action is the creating action
                itself, phrased as an invitation.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <DSExample
              label={
                <>
                  In situ — the empty state replaces the table rows, not the toolbar
                  <span className="mt-0.5 block font-normal normal-case tracking-normal text-slate-500">
                    Filters and search stay interactive so the user can recover without leaving the card.
                  </span>
                </>
              }
            >
              <StatePanel className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Compliance documents</p>
                  <SearchInput
                    value={docQuery}
                    onChange={setDocQuery}
                    placeholder="Filter documents…"
                    ariaLabel="Filter compliance documents demo"
                    className="w-56"
                  />
                </div>
                <EmptyState
                  icon={<FileText />}
                  title="No documents match these filters"
                  message="Every document is either archived or outside the selected sensitivity."
                  action={
                    <Button size="sm" variant="ghost" className="h-8 text-blue-600 hover:text-blue-700" onClick={() => { setDocQuery(""); clearFilters("Filters"); }}>
                      Clear filters
                    </Button>
                  }
                  className="py-10"
                />
              </StatePanel>
            </DSExample>
          </div>
        </DSSection>

        {/* ——— 4 · Rules & guidance ——— */}
        <DSSection title="Rules & guidance" purpose="Governance for every empty state in Qubit One.">
          <DSSpec
            rows={[
              { label: "Purpose", value: "Explain why a region has no content and, when possible, offer exactly one relevant next step." },
              { label: "Use when", value: "A list, table, panel or search returns zero items — filtered results and first-run collections alike." },
              { label: "Avoid when", value: "Data is merely loading (use a skeleton), the request failed (use an error state), or the user lacks access (use the permission state)." },
              { label: "States", value: "Filtered empty (offer clear-filters), truly empty (invite first action), quiet feed (reassure, no action). Same anatomy; copy differs." },
              { label: "Responsive", value: "Centered layout holds at every width; message max-width 24rem; on mobile keep total height under one viewport with action reachable without scrolling." },
              { label: "Accessibility", value: "Title is a real heading for the region; hierarchy reads correctly for screen readers; the action is a native button reachable by Tab and Enter." },
            ]}
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="Compact, specific, one step out">
              Keep vertical footprint small (about <DSVar>py-12</DSVar>), write copy about the user’s
              actual context (“No employees match ‘arj’”), and give the single most relevant action.
              Reassure on quiet feeds — “You’re up to date” beats a bare icon.
            </DSGuidance>
            <DSGuidance kind="dont" title="Decorative dead ends and guilt trips">
              No large illustrations or mascots, no empty panels without an explanation, no
              blame-the-user copy (“You haven’t added anything!”), and never more than one competing
              call to action in an empty region.
            </DSGuidance>
          </div>
        </DSSection>

        <DSScreenNav id="empty-states" />
      </div>
    </>
  );
}
