"use client";

import * as React from "react";
import { AlertCircle, Bell, Check, Download, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { getEmployee, type Employee } from "@/lib/qubit/data";
import { DataTable, type Column } from "../data-table";
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
import { Avatar, ReadOnlyBanner, StatusBadge, TreeRow } from "../primitives";
import { useRole } from "../role-context";

// ============================================================
// Screen 29 · Accessibility Patterns — inclusive defaults.
// Every demo is live: focus, keyboard, ARIA wiring, live
// regions, permission states. Real Qubit One content.
// ============================================================

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px] font-medium text-slate-600">
      {children}
    </kbd>
  );
}

function GroupLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400", className)}>{children}</p>
  );
}

const TABLE_EMPLOYEES = [getEmployee("priya"), getEmployee("rameshp"), getEmployee("divya")].filter(
  (e): e is Employee => e !== undefined,
);

export function AccessibilityScreen() {
  const { toast } = useToast();
  const { can } = useRole();
  const canEditStructure = can("structure.edit");

  // Section 3 — accessible form field demo
  const [deptName, setDeptName] = React.useState("");
  const [deptError, setDeptError] = React.useState(false);

  // Section 5 — dialog demo
  const [editOpen, setEditOpen] = React.useState(false);
  const [jobTitle, setJobTitle] = React.useState("Finance Head");
  const [dept, setDept] = React.useState("Finance");

  // Section 7 — live region demo
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = React.useRef<number | null>(null);
  React.useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  // Section 8 — permission-aware input
  const [deptValue, setDeptValue] = React.useState("Sales");

  // Section 2 — tree demo
  const [treeSelected, setTreeSelected] = React.useState("inside-sales");
  const [treeExpanded, setTreeExpanded] = React.useState(true);

  const tableColumns: Column<Employee>[] = [
    {
      key: "name",
      header: "Employee",
      sortable: true,
      sortValue: (e) => e.name,
      render: (e) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={e.name} size="sm" />
          <span className="font-medium text-slate-800">{e.name}</span>
        </span>
      ),
    },
    { key: "title", header: "Title", render: (e) => <span className="text-slate-600">{e.title}</span> },
    { key: "status", header: "Status", render: (e) => <StatusBadge status={e.status} size="sm" /> },
  ];

  const submitDepartment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!deptName.trim()) {
      setDeptError(true);
      return;
    }
    toast({ title: "Department created", description: `“${deptName.trim()}” added to the org chart.` });
    setDeptName("");
    setDeptError(false);
  };

  const handleSave = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = window.setTimeout(() => setSaveState("saved"), 1000);
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Accessibility Patterns"
        description="Inclusive defaults — keyboard, focus, ARIA and touch targets."
      />

      <div className="space-y-6">
        {/* ------------------------------------------------ */}
        {/* 1 · Focus ring                                    */}
        {/* ------------------------------------------------ */}
        <DSSection title="Focus ring" purpose="Keyboard focus is always visible — one ring for the whole product.">
          <DSStage className="block">
            <p className="mb-4 text-[13px] text-slate-600">
              Press <Kbd>Tab</Kbd> to move through these controls — the ring marks where you are.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => toast({ title: "Save changes", description: "Focused via Tab — the ring is the global default." })}>
                Save changes
              </Button>
              <Input
                type="text"
                placeholder="Full name"
                aria-label="Full name"
                className="h-10 w-56 rounded-lg border-slate-200 bg-white text-sm shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
              />
              <Button variant="link" className="h-auto p-0" onClick={() => toast({ title: "View policy", description: "Links get the same ring." })}>
                View policy
              </Button>
            </div>
          </DSStage>
          <DSSpec
            className="mt-5"
            rows={[
              {
                label: "Ring",
                value: (
                  <>
                    <DSVar>2px solid #2563EB</DSVar> outline with a <DSVar>2px</DSVar> offset, drawn outside the control on{" "}
                    <DSVar>:focus-visible</DSVar> only.
                  </>
                ),
              },
              {
                label: "Scope",
                value: "Every interactive element: buttons, inputs, links, chips, table rows, tree nodes. No component opts out.",
              },
              {
                label: "Never removed",
                value: "Removing outline:none without a visible replacement fails review — focus styles ship inside every shared component.",
              },
              {
                label: "Contrast",
                value: "The blue ring holds ≥3:1 contrast against the workspace (#F5F7FB), white cards and tinted stages.",
              },
            ]}
          />
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 2 · Keyboard navigation                           */}
        {/* ------------------------------------------------ */}
        <DSSection title="Keyboard navigation" purpose="Trees, lists and menus are fully operable without a pointer.">
          <DSStage>
            <div role="tree" aria-label="Departments" className="w-full max-w-[320px] rounded-lg border border-slate-200/90 bg-white p-2">
              <TreeRow
                depth={0}
                expandable
                expanded={treeExpanded}
                onToggle={() => setTreeExpanded((v) => !v)}
                selected={treeSelected === "sales"}
                onClick={() => setTreeSelected("sales")}
              >
                <span className="font-medium">Sales</span>
                <span className="ml-2 text-xs text-slate-400">243 people</span>
              </TreeRow>
              {treeExpanded && (
                <>
                  <TreeRow depth={1} selected={treeSelected === "inside-sales"} onClick={() => setTreeSelected("inside-sales")}>
                    Inside Sales
                  </TreeRow>
                  <TreeRow depth={1} selected={treeSelected === "field-sales"} onClick={() => setTreeSelected("field-sales")}>
                    Field Sales
                  </TreeRow>
                </>
              )}
            </div>
          </DSStage>
          <DSCaption className="mt-3">Tab to focus · Enter / Space select · ← / → collapse &amp; expand</DSCaption>
          <DSSpec
            className="mt-5"
            rows={[
              {
                label: "Wiring",
                value: "TreeRow ships these handlers built in — Enter and Space select, arrow keys expand and collapse, and aria-expanded tracks the state.",
              },
              {
                label: "Focus",
                value: "Every row is tabbable with the global ring; focus and selection stay independent — you can focus a row without selecting it.",
              },
              {
                label: "Selection",
                value: "Selected rows use tint plus weight (never color alone) and expose aria-selected to assistive technology.",
              },
            ]}
          />
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 3 · Accessible form fields                        */}
        {/* ------------------------------------------------ */}
        <DSSection
          title="Accessible form fields"
          purpose="Labels, hints and errors are programmatically wired — not just visually adjacent."
        >
          <DSStage className="block">
            <form onSubmit={submitDepartment} noValidate className="max-w-sm space-y-1.5">
              <Label htmlFor="ds-dept-name" className="text-xs font-medium text-slate-700">
                Department name <span className="ml-0.5 text-red-500" aria-hidden>*</span>
              </Label>
              <Input
                id="ds-dept-name"
                type="text"
                value={deptName}
                onChange={(e) => {
                  setDeptName(e.target.value);
                  if (deptError) setDeptError(false);
                }}
                placeholder="e.g. Growth Marketing"
                aria-required="true"
                aria-invalid={deptError || undefined}
                aria-describedby={deptError ? "ds-dept-name-hint ds-dept-name-error" : "ds-dept-name-hint"}
                className="h-10 rounded-lg border-slate-200 bg-white text-sm shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
              />
              <p id="ds-dept-name-hint" className="text-[11px] text-muted-foreground">
                Shown across the org chart, exports and connected systems.
              </p>
              {deptError && (
                <p id="ds-dept-name-error" role="alert" className="flex items-center gap-1.5 text-[11px] font-medium text-red-600">
                  <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
                  Department name is required.
                </p>
              )}
              <div className="pt-2">
                <Button type="submit">Create department</Button>
              </div>
            </form>
          </DSStage>
          <DSCaption className="mt-3">Submit empty to trigger the error — typing again clears it.</DSCaption>
          <DSSpec
            className="mt-5"
            rows={[
              {
                label: "Label",
                value: "A visible <label> is associated via htmlFor / id — placeholders never serve as labels.",
              },
              {
                label: "Hint",
                value: "The hint is linked through aria-describedby, so screen readers announce it with the field.",
              },
              {
                label: "Error",
                value: (
                  <>
                    The message mounts with <DSVar>role="alert"</DSVar> (announced on appear), the input gets{" "}
                    <DSVar>aria-invalid</DSVar>, and the required state is marked with a visible * plus <DSVar>aria-required</DSVar>.
                  </>
                ),
              },
              {
                label: "Recovery",
                value: "The error clears as soon as typing resumes; successful submits confirm via toast and reset the form.",
              },
            ]}
          />
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 4 · Accessible tables                             */}
        {/* ------------------------------------------------ */}
        <DSSection
          title="Accessible tables"
          purpose="DataTable ships its accessibility built in — caption, header scope, sort semantics, focusable rows."
        >
          <DataTable
            columns={tableColumns}
            rows={TABLE_EMPLOYEES}
            rowKey={(e) => e.id}
            onRowClick={(e) => toast({ title: e.name, description: `${e.title} — row activated by click or Enter.` })}
            pageSize={0}
            caption="Employees — accessible table demo"
          />
          <DSSpec
            className="mt-5"
            rows={[
              {
                label: "Caption",
                value: (
                  <>
                    The <DSVar>caption</DSVar> prop gives the table a programmatic name announced before its content.
                  </>
                ),
              },
              {
                label: "Headers",
                value: (
                  <>
                    Every header carries <DSVar>scope="col"</DSVar>; sortable columns expose{" "}
                    <DSVar>aria-sort</DSVar> = ascending / descending / none.
                  </>
                ),
              },
              {
                label: "Rows",
                value: "Rows with actions are keyboard-focusable and activate on Enter — identical behavior to click.",
              },
              {
                label: "Sorting",
                value: "Sort headers are tabbable and toggle on Enter; the visible arrow always matches the aria-sort value.",
              },
            ]}
          />
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 5 · Accessible dialogs                            */}
        {/* ------------------------------------------------ */}
        <DSSection title="Accessible dialogs" purpose="Dialogs move focus in, trap it, and hand it back — every time.">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DSStage>
              {/* Trigger lives inside Dialog.Root so Radix registers it and
                  restores focus to it when the dialog closes. */}
              <DialogTrigger asChild>
                <Button>Edit employee</Button>
              </DialogTrigger>
            </DSStage>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit employee — Priya Sharma</DialogTitle>
                <DialogDescription>
                  Changes apply to directory listings, approval routing and reporting lines.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ds-edit-title" className="text-xs font-medium text-slate-700">
                    Job title
                  </Label>
                  <Input
                    id="ds-edit-title"
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="h-10 rounded-lg border-slate-200 bg-white text-sm shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ds-edit-dept" className="text-xs font-medium text-slate-700">
                    Department
                  </Label>
                  <Select value={dept} onValueChange={setDept}>
                    <SelectTrigger id="ds-edit-dept" className="h-10 rounded-lg border-slate-200 bg-white text-sm shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Sales", "Finance", "HR & People", "Marketing", "IT & Technology", "Operations"].map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setEditOpen(false);
                    toast({ title: "Employee updated", description: `Priya Sharma — ${jobTitle || "Finance Head"}, ${dept}.` });
                  }}
                >
                  Save changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <DSSpec
            className="mt-5"
            rows={[
              {
                label: "Focus",
                value: "Focus moves into the dialog on open and returns to the trigger on close — Radix default, never overridden.",
              },
              {
                label: "Tab trap",
                value: "Tab cycles inside the dialog; background content is inert and unreadable to assistive technology.",
              },
              {
                label: "Escape",
                value: "Esc closes the dialog — alongside the visible Cancel button.",
              },
              {
                label: "Semantics",
                value: (
                  <>
                    DialogTitle and DialogDescription wire <DSVar>aria-labelledby</DSVar> / <DSVar>aria-describedby</DSVar> through shadcn
                    defaults.
                  </>
                ),
              },
            ]}
          />
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 6 · Screen reader labels & alternatives           */}
        {/* ------------------------------------------------ */}
        <DSSection title="Screen reader labels & alternatives" purpose="Every control announces itself; visible text beats tooltips.">
          <DSStage>
            <div className="flex flex-wrap items-start gap-x-10 gap-y-8">
              <DSExample label="Icon-only · aria-label + tooltip on focus and hover">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Open notifications"
                      onClick={() => toast({ title: "Notifications", description: "3 unread — would open the notifications panel." })}
                    >
                      <Bell />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Notifications</TooltipContent>
                </Tooltip>
              </DSExample>

              <DSExample label="sr-only context · extends the visible label">
                <Button
                  variant="outline"
                  onClick={() => toast({ title: "Export started", description: "Employee directory — 1,245 rows, CSV." })}
                >
                  Export report
                  <span className="sr-only"> — employee directory, 1,245 rows, CSV format</span>
                  <Download />
                </Button>
              </DSExample>
            </div>
          </DSStage>
          <DSSpec
            className="mt-6"
            rows={[
              {
                label: "Visible text first",
                value: "Prefer visible labels. A tooltip never replaces a label — it confirms an icon-only control's accessible name.",
              },
              {
                label: "Icon-only controls",
                value: "Must carry aria-label. The tooltip appears on focus as well as hover — hover-only reveals are an anti-pattern.",
              },
              {
                label: "sr-only context",
                value: "Extends a visible label with context — hidden from sight, announced in full by screen readers.",
              },
            ]}
          />
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 7 · Non-color status & live regions               */}
        {/* ------------------------------------------------ */}
        <DSSection
          title="Non-color status & live regions"
          purpose="Status survives without color; async outcomes are announced, not just painted."
        >
          <DSStage className="block">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <GroupLabel>Status without color</GroupLabel>
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200/90 bg-white p-4">
                  <StatusBadge status="Disconnected" />
                  <span className="text-[11px] text-slate-400">vs the color-only dot (never ships):</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                  <span className="text-[11px] text-slate-300">announces nothing</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  The badge pairs a decorative dot with text, so meaning survives for screen readers, color-blind users and search.
                </p>
              </div>
              <div>
                <GroupLabel>aria-live polite region</GroupLabel>
                <div className="rounded-lg border border-slate-200/90 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={handleSave} disabled={saveState === "saving"}>
                      {saveState === "saving" ? (
                        <>
                          <Loader2 className="animate-spin" />
                          Saving…
                        </>
                      ) : (
                        "Save changes"
                      )}
                    </Button>
                    <p aria-live="polite" role="status" className="min-h-[20px] text-[13px]">
                      {saveState === "saved" ? (
                        <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Changes saved.
                        </span>
                      ) : saveState === "saving" ? (
                        <span className="text-slate-500">Saving changes…</span>
                      ) : (
                        <span className="text-slate-400">No unsaved changes.</span>
                      )}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Run the save: after ~1s the live region announces “Changes saved.” — and the confirmation is visible text, not a flash of
                  color.
                </p>
              </div>
            </div>
          </DSStage>
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 8 · Touch targets & permission states             */}
        {/* ------------------------------------------------ */}
        <DSSection
          title="Touch targets & permission states"
          purpose="44px on touch, honest disabled states — gray is never the whole message."
        >
          <DSStage className="block">
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <GroupLabel>Touch targets</GroupLabel>
                <div className="flex flex-wrap items-end gap-x-8 gap-y-6 rounded-lg border border-slate-200/90 bg-white p-4">
                  <div>
                    <Button className="h-11 px-5" onClick={() => toast({ title: "Open shift log", description: "h-11 (44px) — comfortable thumb target." })}>
                      Open shift log
                    </Button>
                    <DSCaption className="mt-1.5">h-11 (44px) · touch-first surfaces — mobile nav, settings rows</DSCaption>
                  </div>
                  <div>
                    <Button size="sm" variant="outline" onClick={() => toast({ title: "Quick filter", description: "h-8 (32px) — pointer-driven, dense toolbars only." })}>
                      Quick filter
                    </Button>
                    <DSCaption className="mt-1.5">h-8 (32px) · pointer / dense toolbars only</DSCaption>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Anything a thumb can hit ships at ≥44px — including mobile navigation and list-row actions. Sub-44px sizes are reserved for
                  pointer-driven, dense toolbars.
                </p>
              </div>
              <div>
                <GroupLabel>Permission states</GroupLabel>
                <div className="rounded-lg border border-slate-200/90 bg-white p-4">
                  {!canEditStructure && <ReadOnlyBanner message="Read-only — your role cannot edit departments." />}
                  <div className={cn("space-y-1.5", !canEditStructure && "mt-3")}>
                    <Label htmlFor="ds-ro-dept" className="text-xs font-medium text-slate-700">
                      Department name
                    </Label>
                    <Input
                      id="ds-ro-dept"
                      type="text"
                      value={deptValue}
                      disabled={!canEditStructure}
                      onChange={(e) => setDeptValue(e.target.value)}
                      aria-describedby="ds-ro-help"
                      className="h-10 rounded-lg border-slate-200 bg-white text-sm shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                    />
                    <p id="ds-ro-help" className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      {canEditStructure ? (
                        "You can edit this department."
                      ) : (
                        <>
                          <Lock className="mt-px h-3 w-3 shrink-0" aria-hidden />
                          Read-only — your role cannot edit departments. Preview another role from the top bar.
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Disabled controls explain themselves: banner + lock icon + helper text. Grayed-out styling alone is never the message.
                </p>
              </div>
            </div>
          </DSStage>
        </DSSection>

        {/* ------------------------------------------------ */}
        {/* 9 · Reference + guidance                          */}
        {/* ------------------------------------------------ */}
        <DSSection title="Reference" purpose="The accessibility contract in one grid — then the two review calls.">
          <DSSpec
            rows={[
              {
                label: "Focus ring",
                value: (
                  <>
                    <DSVar>2px solid #2563EB</DSVar>, offset <DSVar>2px</DSVar>, global — never removed or restyled per screen.
                  </>
                ),
              },
              {
                label: "Keyboard map",
                value: (
                  <>
                    <Kbd>Tab</Kbd> / <Kbd>Shift+Tab</Kbd> traverse · <Kbd>Enter</Kbd> &amp; <Kbd>Space</Kbd> activate · <Kbd>←</Kbd>/<Kbd>→</Kbd>{" "}
                    expand trees · <Kbd>Esc</Kbd> closes overlays.
                  </>
                ),
              },
              {
                label: "ARIA patterns",
                value: (
                  <>
                    <DSVar>aria-expanded</DSVar>, <DSVar>aria-selected</DSVar>, <DSVar>aria-sort</DSVar>, <DSVar>aria-invalid</DSVar>,{" "}
                    <DSVar>aria-describedby</DSVar>, <DSVar>role="alert"</DSVar>, <DSVar>aria-live="polite"</DSVar> — pre-wired in shared
                    components.
                  </>
                ),
              },
              {
                label: "Live regions",
                value: "Async outcomes announce via a polite live region and always confirm with visible text.",
              },
              {
                label: "Touch targets",
                value: "44px minimum on touch surfaces; smaller sizes only for pointer-dense toolbars (h-8).",
              },
              {
                label: "Permissions",
                value: "Disabled controls explain themselves — banner, icon and text together, never gray alone.",
              },
            ]}
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="accessible by default — one system">
              <p>
                Shared components ship keyboard, ARIA and focus behavior pre-wired, so every screen is accessible without extra work. Visible
                labels are the primary interface, and no state relies on color alone.
              </p>
            </DSGuidance>
            <DSGuidance kind="dont" title="a separate accessible version">
              <p>
                Never ship a reduced “accessible mode”, strip focus outlines for aesthetics, or encode meaning in color only. If a control
                can't announce itself, it doesn't ship.
              </p>
            </DSGuidance>
          </div>
        </DSSection>
      </div>

      <DSScreenNav id="accessibility" />
    </>
  );
}
