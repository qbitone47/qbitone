"use client";

import * as React from "react";
import {
  Archive,
  Building2,
  ChevronRight,
  Copy,
  Mail,
  MapPin,
  Network,
  Phone,
  Share2,
  Users,
} from "lucide-react";
import { PageHeader } from "../page-header";
import {
  DSGuidance,
  DSScreenNav,
  DSSection,
  DSSpec,
  DSStage,
  DSExample,
  DSVar,
  DSTokenTable,
} from "../ds/doc";
import { ConfirmDialog, FormDialog, Field } from "../dialogs";
import { DetailDrawer } from "../drawers";
import { Avatar, IconTile, KV, StatTile, StatusBadge } from "../primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { departments, employees, getEmployee } from "@/lib/qubit/data";

// ============================================================
// Screen 23 — Modal & Drawer Patterns
// One overlay per task: confirm, create/edit, rich detail,
// contextual drawer, full-height log, mobile sheet.
// ============================================================

const inputCls = "h-10 rounded-lg border-slate-200 bg-white";
const selectCls = "h-10 w-full rounded-lg border-slate-200 bg-white";

/** Numbered callout badge shared by the anatomy list. */
function Callout({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white"
    >
      {n}
    </span>
  );
}

/** Audit entry row for the full-height drawer. */
function AuditRow({ text, time, system }: { text: string; time: string; system?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className={"mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full " + (system ? "bg-slate-300" : "bg-blue-600")}
      />
      <div className="min-w-0">
        <p className="text-[13px] leading-snug text-slate-700">{text}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{time}</p>
      </div>
    </li>
  );
}

const AUDIT_LOG: { text: string; time: string; system?: boolean }[] = [
  { text: "Priya Sharma approved the Q4 procurement budget", time: "17 Oct 2026 · 14:32" },
  { text: "Neha Patel added 3 roles to HR & People", time: "16 Oct 2026 · 18:05" },
  { text: "Arjun Nair rotated integration API keys", time: "16 Oct 2026 · 11:20" },
  { text: "Sagar Singh updated approval authority for Department Head", time: "15 Oct 2026 · 09:47" },
  { text: "Rahul Mehta archived the Channel Sales sub-department", time: "14 Oct 2026 · 16:12" },
  { text: "System locked Finance ledgers for monthly close", time: "30 Sep 2026 · 23:00", system: true },
];

const SHEET_ACTIONS = [
  { icon: Share2, tone: "blue" as const, label: "Share department link", hint: "Copy a read-only link to this department" },
  { icon: Copy, tone: "slate" as const, label: "Duplicate department", hint: "Create a copy with its full structure" },
  { icon: Archive, tone: "rose" as const, label: "Archive department", hint: "Detaches people; reversible for 30 days", danger: true },
];

export function ModalDrawerScreen() {
  const { toast } = useToast();

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [formName, setFormName] = React.useState("");
  const [formDept, setFormDept] = React.useState<string | undefined>(undefined);
  const [formCreating, setFormCreating] = React.useState(false);
  const [largeOpen, setLargeOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [auditOpen, setAuditOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const employee = getEmployee("meera") ?? employees[0];
  const manager = getEmployee(employee.managerId);

  const submitFormRole = () => {
    setFormCreating(true);
    window.setTimeout(() => {
      setFormCreating(false);
      setFormOpen(false);
      toast({
        title: "Role created successfully.",
        description: `${formName.trim()} was added to ${formDept ?? "the organization"} (demo).`,
      });
      setFormName("");
      setFormDept(undefined);
    }, 900);
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Modal & Drawer Patterns"
        description="Overlays for secondary workflows and contextual detail."
      />

      <div className="space-y-6">
        {/* ————————————————— 1 · Pattern picker ————————————————— */}
        <DSSection
          title="Pattern picker"
          purpose="Seven overlay patterns — pick by task, not by habit."
        >
          <DSTokenTable
            head={["Pattern", "Surface", "When to use"]}
            rows={[
              ["modal.sm", "Dialog · sm:max-w-sm", "A focused single decision or tiny input — one question, one answer."],
              ["modal.confirm", "AlertDialog", "Destructive or high-impact actions — consequence spelled out, confirm explicit."],
              ["modal.form", "Dialog · sm:max-w-md", "Short create or edit — five fields or fewer, one submit."],
              ["modal.lg", "Dialog · sm:max-w-lg", "Rich secondary content — summaries with stats and detail rows."],
              ["drawer.right", "Sheet · right", "Contextual detail next to the page; the page stays in place."],
              ["drawer.full", "Sheet · right · h-full", "Deep detail — audit logs, histories, long scrollable lists."],
              ["sheet.mobile", "Sheet · bottom · rounded-t-2xl", "Mobile-only quick actions; on sm+ the same flow renders as a dialog."],
            ]}
          />
        </DSSection>

        {/* ————————————————— 2 · Confirmation modal ————————————————— */}
        <DSSection
          title="Confirmation modal"
          purpose="High-impact actions pause for an explicit, spelled-out choice."
        >
          <DSStage>
            <div className="grid w-full gap-x-6 gap-y-7 sm:grid-cols-2">
              <DSExample label="Destructive — red confirm, no accidental clicks">
                <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Delete department
                </Button>
              </DSExample>
              <DSExample label="Non-destructive — standard confirm">
                <Button type="button" variant="outline" onClick={() => setApproveOpen(true)}>
                  Approve request
                </Button>
              </DSExample>
            </div>
          </DSStage>

          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title="Delete department?"
            description="This will remove Engineering and detach 248 employees. This action cannot be undone."
            confirmLabel="Delete department"
            destructive
            onConfirm={() =>
              toast({
                title: "Engineering scheduled for deletion (demo)",
                description: "248 employees will be detached. Restoration stays available for 30 days.",
              })
            }
          />

          <ConfirmDialog
            open={approveOpen}
            onOpenChange={setApproveOpen}
            title="Approve request?"
            description="Approve the ₹2,40,000 procurement request from Operations? Finance is notified immediately."
            confirmLabel="Approve"
            onConfirm={() =>
              toast({
                title: "Request approved (demo)",
                description: "Finance has been notified of the ₹2,40,000 approval.",
              })
            }
          />
        </DSSection>

        {/* ————————————————— 3 · Form modal ————————————————— */}
        <DSSection
          title="Form modal"
          purpose="Short create/edit flows — five fields or fewer, then back to work."
        >
          <DSStage>
            <DSExample label="Form modal — Create role (≤ 5 fields)">
              <Button type="button" onClick={() => setFormOpen(true)}>
                Create role
              </Button>
            </DSExample>
          </DSStage>

          <FormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            title="Create role"
            description="Roles group permissions and approval authority."
            submitLabel="Create role"
            submitting={formCreating}
            onSubmit={() => {
              if (formName.trim() && !formCreating) submitFormRole();
            }}
          >
            <Field label="Role name" required hint="Shown in permission and approval views.">
              <Input
                aria-label="Role name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Finance Manager"
                className={inputCls}
              />
            </Field>
            <Field label="Department" required hint="Inherits the department data boundary.">
              <Select value={formDept} onValueChange={setFormDept}>
                <SelectTrigger aria-label="Department" className={selectCls}>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormDialog>
        </DSSection>

        {/* ————————————————— 4 · Large modal ————————————————— */}
        <DSSection
          title="Large modal"
          purpose="Rich secondary content — readable without leaving the page."
        >
          <DSStage>
            <DSExample label="Large modal — summary, stats and detail rows">
              <Button type="button" variant="outline" onClick={() => setLargeOpen(true)}>
                View organization details
              </Button>
            </DSExample>
          </DSStage>

          <Dialog open={largeOpen} onOpenChange={setLargeOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Organization details</DialogTitle>
                <DialogDescription>Legal entity summary — read-only.</DialogDescription>
              </DialogHeader>
              <div className="qubit-scroll max-h-[55vh] space-y-5 overflow-y-auto pr-1">
                <p className="text-[13px] leading-relaxed text-slate-600">
                  Qubit One Pvt Ltd operates as a single legal entity with 1,245 employees across 8
                  departments and 6 locations. Four approval levels govern spending, and 14 active
                  roles map permissions through the RBAC matrix.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatTile icon={<Users />} value="1,245" label="Employees" />
                  <StatTile icon={<Building2 />} value="8" label="Departments" />
                  <StatTile icon={<Network />} value="6" label="Locations" />
                </div>
                <dl className="divide-y border-t">
                  <KV label="Legal entity">Qubit One Pvt Ltd</KV>
                  <KV label="Headquarters">Mumbai HQ, Mumbai</KV>
                  <KV label="Managing director">Sagar Singh — Chief Executive Officer</KV>
                  <KV label="Approval ceiling">₹10,00,000 (CEO final authority)</KV>
                  <KV label="Fiscal year">April – March</KV>
                </dl>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setLargeOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => setLargeOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </DSSection>

        {/* ————————————————— 5 · Right-side drawer ————————————————— */}
        <DSSection
          title="Right-side drawer"
          purpose="Contextual detail without losing the page — people, records, previews."
        >
          <DSStage>
            <DSExample label="Detail drawer — wide variant">
              <Button type="button" variant="outline" onClick={() => setDrawerOpen(true)}>
                View employee details
              </Button>
            </DSExample>
          </DSStage>

          <DetailDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            wide
            title={
              <span className="flex items-center gap-2">
                {employee.name}
                <StatusBadge status={employee.status} size="sm" />
              </span>
            }
            subtitle={`${employee.title} · ${employee.department}`}
            icon={<Users />}
            footer={
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() =>
                    toast({
                      title: "Reporting line",
                      description: `${employee.name} reports to ${manager ? manager.name : "—"} (demo).`,
                    })
                  }
                >
                  View reporting line
                </Button>
                <Button
                  size="sm"
                  className="h-8"
                  onClick={() =>
                    toast({
                      title: "Full profile",
                      description: "The complete profile opens in the People module.",
                    })
                  }
                >
                  Open full profile
                </Button>
              </div>
            }
          >
            <div className="flex items-center gap-3 border-b pb-4">
              <Avatar name={employee.name} size="xl" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{employee.name}</p>
                <p className="text-xs text-muted-foreground">{employee.title}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" aria-hidden /> {employee.department}
                </p>
              </div>
            </div>
            <dl className="divide-y pt-1">
              <KV label="Email">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  {employee.email}
                </span>
              </KV>
              <KV label="Phone">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  {employee.phone}
                </span>
              </KV>
              <KV label="Manager">
                {manager ? `${manager.name} — ${manager.title}` : "— (Top level)"}
              </KV>
              <KV label="Location">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  {employee.location}
                </span>
              </KV>
            </dl>
          </DetailDrawer>
        </DSSection>

        {/* ————————————————— 6 · Full-height drawer & mobile sheet ————————————————— */}
        <DSSection
          title="Full-height drawer & mobile sheet"
          purpose="Deep detail gets the full column; thumb-reachable actions get the bottom sheet."
        >
          <DSStage>
            <div className="grid w-full gap-x-6 gap-y-7 sm:grid-cols-2">
              <DSExample label="Full-height drawer — audit log">
                <Button type="button" variant="outline" onClick={() => setAuditOpen(true)}>
                  Open full-height drawer
                </Button>
              </DSExample>
              <DSExample label="Mobile sheet — bottom actions">
                <Button type="button" variant="outline" onClick={() => setSheetOpen(true)}>
                  Open mobile sheet
                </Button>
              </DSExample>
            </div>
          </DSStage>

          {/* Full-height drawer */}
          <Sheet open={auditOpen} onOpenChange={setAuditOpen}>
            <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
              <SheetHeader className="border-b border-slate-100 px-5 py-4 text-left">
                <SheetTitle className="text-base font-semibold tracking-tight text-slate-900">
                  Audit log — Organization
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Changes to departments, roles and approval authority.
                </SheetDescription>
              </SheetHeader>
              <div className="qubit-scroll flex-1 overflow-y-auto px-5 py-4">
                <ol className="space-y-4">
                  {AUDIT_LOG.map((entry) => (
                    <AuditRow key={entry.time} {...entry} />
                  ))}
                </ol>
              </div>
              <SheetFooter className="flex-row justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() =>
                    toast({
                      title: "Audit log export started (demo)",
                      description: "The CSV will be emailed to you when it is ready.",
                    })
                  }
                >
                  Export log
                </Button>
                <Button size="sm" className="h-8" onClick={() => setAuditOpen(false)}>
                  Close
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          {/* Mobile bottom sheet */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent side="bottom" className="rounded-t-2xl px-5 pb-7 pt-3">
              <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-slate-200" />
              <SheetHeader className="px-0 pb-1 pt-3 text-left">
                <SheetTitle className="text-base font-semibold tracking-tight text-slate-900">
                  Finance department
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Quick actions — on sm+ this flow renders as a dialog.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-1">
                {SHEET_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => {
                        if (action.label === "Share department link") {
                          toast({
                            title: "Link copied (demo)",
                            description: "A read-only link to Finance was copied to your clipboard.",
                          });
                        } else if (action.label === "Duplicate department") {
                          toast({
                            title: "Duplicate queued (demo)",
                            description: "A copy of Finance will be created as Draft.",
                          });
                        } else {
                          toast({
                            title: "Archive requires confirmation (demo)",
                            description: "Destructive actions always confirm first.",
                          });
                        }
                        setSheetOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 hover:bg-slate-50"
                    >
                      <IconTile icon={<Icon />} tone={action.tone} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span
                          className={
                            "block text-sm font-medium " + (action.danger ? "text-red-600" : "text-slate-800")
                          }
                        >
                          {action.label}
                        </span>
                        <span className="block text-xs text-slate-400">{action.hint}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                    </button>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </DSSection>

        {/* ————————————————— 7 · Anatomy & behavior ————————————————— */}
        <DSSection
          title="Anatomy & behavior"
          purpose="Every overlay is built from the same five parts and obeys the same five rules."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                Anatomy
              </p>
              <ol className="space-y-3.5">
                <li className="flex items-start gap-3">
                  <Callout n={1} />
                  <p className="text-[13px] leading-relaxed text-slate-600">
                    <span className="font-semibold text-slate-900">Overlay</span> —{" "}
                    <DSVar>bg-black/50</DSVar> scrim; clicking it closes, except destructive confirms
                    where the choice must be explicit.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <Callout n={2} />
                  <p className="text-[13px] leading-relaxed text-slate-600">
                    <span className="font-semibold text-slate-900">Header</span> — title plus a
                    one-line description and a close <DSVar>X</DSVar> button (aria-label
                    &quot;Close&quot;).
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <Callout n={3} />
                  <p className="text-[13px] leading-relaxed text-slate-600">
                    <span className="font-semibold text-slate-900">Content</span> — scrollable and
                    padded; long bodies scroll internally instead of growing the overlay.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <Callout n={4} />
                  <p className="text-[13px] leading-relaxed text-slate-600">
                    <span className="font-semibold text-slate-900">Footer</span> — actions
                    right-aligned, primary action last; destructive actions sit separated.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <Callout n={5} />
                  <p className="text-[13px] leading-relaxed text-slate-600">
                    <span className="font-semibold text-slate-900">Close</span> —{" "}
                    <DSVar>Esc</DSVar> key, <DSVar>X</DSVar> button and overlay click all dismiss;
                    focus returns to the trigger.
                  </p>
                </li>
              </ol>
            </div>
            <div>
              <p className="mb-3.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                Behavior
              </p>
              <ul className="space-y-3.5">
                <li className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                  <p className="text-[13px] leading-relaxed text-slate-600">
                    Focus moves into the overlay on open and restores to the trigger on close —
                    Radix built-in, no custom code.
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                  <p className="text-[13px] leading-relaxed text-slate-600">
                    <DSVar>Esc</DSVar> always closes — suppressed only while a form is submitting.
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                  <p className="text-[13px] leading-relaxed text-slate-600">
                    Submit buttons show a spinner with a progress label while working; actions
                    disable in the meantime.
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                  <p className="text-[13px] leading-relaxed text-slate-600">
                    Errors render inside the form body — never as browser dialogs.
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                  <p className="text-[13px] leading-relaxed text-slate-600">
                    Body scroll is locked while any overlay is open.
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </DSSection>

        {/* ————————————————— 8 · Guidance ————————————————— */}
        <DSSection title="Choosing the right overlay" purpose="Match the surface to the task — restraint reads as confidence.">
          <div className="grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="match overlay to task">
              <ul className="list-disc space-y-1 pl-4">
                <li>Modals for focused decisions, drawers for contextual detail, sheets on mobile.</li>
                <li>One primary action per overlay — everything else is secondary or cancel.</li>
                <li>Always a visible escape: X, Cancel and Esc together.</li>
              </ul>
            </DSGuidance>
            <DSGuidance kind="dont" title="overlay misuse">
              <ul className="list-disc space-y-1 pl-4">
                <li>Don't reach for a modal for every interaction — pages and drawers exist.</li>
                <li>Never stack modals on modals; replace the content instead.</li>
                <li>No overlay without an escape, and no drawers nested inside modals.</li>
              </ul>
            </DSGuidance>
          </div>
        </DSSection>

        {/* ————————————————— Specification ————————————————— */}
        <DSSection title="Specification">
          <DSSpec
            rows={[
              {
                label: "Purpose",
                value: "Overlay patterns — modals for focused decisions, drawers for contextual detail, sheets for mobile.",
              },
              {
                label: "Use when",
                value: "Short secondary workflows — confirm, create/edit, quick detail — without losing the page context.",
              },
              {
                label: "Avoid when",
                value: "The work is multi-step or long-form — use a full page or a dedicated screen instead.",
              },
              {
                label: "States",
                value: "Open, submitting (loading on the confirm button), closed; destructive confirms ignore overlay clicks.",
              },
              {
                label: "Responsive",
                value: "Modals stay centered at sm:max-w sizes; drawers go full-width on mobile; sheets are a mobile-only pattern.",
              },
              {
                label: "Accessibility",
                value: (
                  <>
                    <DSVar>role=&quot;dialog&quot;</DSVar> with <DSVar>aria-labelledby</DSVar> title,
                    focus trap and restore, <DSVar>Esc</DSVar> to close, body scroll locked.
                  </>
                ),
              },
            ]}
          />
        </DSSection>

        <DSScreenNav id="modal-drawer" />
      </div>
    </>
  );
}
