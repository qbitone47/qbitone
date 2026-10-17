"use client";

import * as React from "react";
import { ClipboardCheck, UserRound, Users, Workflow } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { Avatar, StatTile, StatusBadge } from "../primitives";
import { DataTable, type Column } from "../data-table";
import { employees } from "@/lib/qubit/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// Screen 30 — Responsive Grid
// Breakpoints, layout scale, responsive cards / tables / forms,
// and the systematic desktop → mobile mapping.
// ============================================================

const BP_DEFS: { id: "sm" | "md" | "lg" | "xl"; min: number }[] = [
  { id: "sm", min: 640 },
  { id: "md", min: 768 },
  { id: "lg", min: 1024 },
  { id: "xl", min: 1280 },
];

type BpId = "base" | (typeof BP_DEFS)[number]["id"];

/** Live viewport width — SSR-safe, updates on resize. */
function useViewportWidth(): number | null {
  const [width, setWidth] = React.useState<number | null>(null);
  React.useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
}

// ------------------------------------------------------------
// Wireframe helpers (pure slate boxes — content-neutral)
// ------------------------------------------------------------

function WireBar({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded bg-slate-200/80", className)} />;
}

function DesktopWireframe() {
  return (
    <div
      role="img"
      aria-label="Desktop layout wireframe: persistent sidebar, topbar with search pill, three content columns"
      className="w-full max-w-[360px] rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div className="flex h-44 gap-2">
        <div className="flex w-12 shrink-0 flex-col items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50 py-2">
          <span className="grid h-4 w-4 place-items-center rounded-md bg-blue-600 text-[8px] font-bold text-white">Q</span>
          <WireBar className="h-3 w-6 bg-blue-200/80" />
          <WireBar className="h-1.5 w-6" />
          <WireBar className="h-1.5 w-6" />
          <WireBar className="h-1.5 w-6" />
          <span className="h-px w-6 bg-slate-200" />
          <WireBar className="h-1.5 w-6" />
          <WireBar className="h-1.5 w-6" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex h-7 items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2">
            <WireBar className="h-2.5 w-2.5 rounded-full border border-slate-300 bg-white" />
            <WireBar className="h-2.5 w-2.5 rounded-full border border-slate-300 bg-white" />
            <WireBar className="ml-auto h-3 w-16 rounded-full border border-slate-300 bg-white" />
            <WireBar className="h-3 w-3 rounded-full" />
          </div>
          <div className="grid flex-1 grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border border-slate-200/80 bg-slate-50 p-2">
                <WireBar className="h-1.5 w-8" />
                <WireBar className="mt-2 h-2.5 w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileWireframe() {
  return (
    <div
      role="img"
      aria-label="Mobile layout wireframe: topbar with hamburger menu, stacked single column, bottom action bar"
      className="w-[150px] shrink-0 rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div className="flex h-56 flex-col gap-2">
        <div className="flex h-7 items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2">
          <span aria-hidden className="flex flex-col gap-[3px]">
            <span className="h-px w-3.5 rounded bg-slate-400" />
            <span className="h-px w-3.5 rounded bg-slate-400" />
            <span className="h-px w-3.5 rounded bg-slate-400" />
          </span>
          <WireBar className="ml-auto h-3 w-3 rounded-full" />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex-1 rounded-lg border border-slate-200/80 bg-slate-50 p-2">
            <WireBar className="h-1.5 w-16" />
            <WireBar className="mt-2 h-2.5 w-20" />
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-slate-50 p-2">
            <WireBar className="h-1.5 w-12" />
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-slate-50 p-2">
            <WireBar className="h-1.5 w-14" />
          </div>
        </div>
        <div className="flex h-8 items-center justify-around rounded-lg border border-slate-200/80 bg-slate-50">
          <span aria-hidden className="h-2 w-2 rounded-full bg-blue-500" />
          <span aria-hidden className="h-2 w-2 rounded-full bg-slate-300" />
          <span aria-hidden className="h-2 w-2 rounded-full bg-slate-300" />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Demo data
// ------------------------------------------------------------

interface DemoEmployee {
  id: string;
  name: string;
  department: string;
  role: string;
  status: string;
  eid: string;
}

const DEMO_ROWS: DemoEmployee[] = (["pankaj", "kavita", "divya", "deepak", "rameshp"] as const).map((id) => {
  const e = employees.find((x) => x.id === id);
  if (!e) throw new Error(`Missing demo employee: ${id}`);
  return { id: e.id, name: e.name, department: e.department, role: e.title, status: e.status, eid: e.employeeId };
});

const DEMO_COLUMNS: Column<DemoEmployee>[] = [
  {
    key: "employee",
    header: "Employee",
    render: (r) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={r.name} size="sm" />
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-slate-800">{r.name}</span>
          <span className="block text-[11px] text-slate-400">{r.eid}</span>
        </span>
      </div>
    ),
  },
  { key: "department", header: "Department", render: (r) => r.department },
  { key: "role", header: "Role", hideBelow: "lg", render: (r) => r.role },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} size="sm" /> },
];

const DEPARTMENTS = ["Sales", "Finance", "HR & People", "Marketing", "Inventory", "Service"];

// ------------------------------------------------------------
// Screen
// ------------------------------------------------------------

export function ResponsiveGridScreen() {
  const { toast } = useToast();
  const width = useViewportWidth();
  const bp: BpId = width == null ? "base" : BP_DEFS.reduce<BpId>((acc, b) => (width >= b.min ? b.id : acc), "base");

  const [form, setForm] = React.useState({ name: "", department: DEPARTMENTS[0], email: "", phone: "" });

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Responsive Grid"
        description="Layout system from desktop workspace to mobile single column."
      />

      <div className="space-y-6">
        {/* 1 — Breakpoints */}
        <DSSection title="Breakpoints" purpose="Four Tailwind breakpoints carry every layout decision in the product.">
          <DSTokenTable
            head={["Token", "Min width", "Behaviour"]}
            rows={[
              ["sm", "640px", "Two-up cards; the phone-range single column ends"],
              ["md", "768px", "Sidebar returns, the mobile sheet retires, tables replace record cards"],
              ["lg", "1024px", "Full workspace — 4-up stat rows and secondary table columns appear"],
              ["xl", "1280px", "Wider gutters; the command pill expands to w-80"],
            ]}
          />
          <DSStage className="mt-5">
            <div className="w-full">
              <div className="flex flex-wrap items-center gap-2">
                {BP_DEFS.map((b) => {
                  const active = bp === b.id;
                  return (
                    <span
                      key={b.id}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs tabular-nums transition-colors duration-150",
                        active
                          ? "border-blue-200 bg-blue-50 font-medium text-blue-700"
                          : "border-slate-200/90 bg-white text-slate-500",
                      )}
                    >
                      {b.id} · {b.min}px
                    </span>
                  );
                })}
                <span
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors duration-150",
                    bp === "base"
                      ? "border-blue-200 bg-blue-50 font-medium text-blue-700"
                      : "border-slate-200/90 bg-white text-slate-500",
                  )}
                >
                  base · &lt;640px
                </span>
              </div>
              <p aria-live="polite" className="mt-3 text-[12.5px] text-slate-500">
                {width == null
                  ? "Measuring viewport…"
                  : (
                    <>
                      Viewport <span className="font-mono font-medium text-slate-800">{width}px</span> —{" "}
                      {bp === "base" ? (
                        "below sm · single column"
                      ) : (
                        <>
                          breakpoint <span className="font-mono font-medium text-blue-700">{bp}</span> active
                        </>
                      )}
                    </>
                  )}
              </p>
              <DSCaption>Resize the preview panel — the active chip follows the live viewport.</DSCaption>
            </div>
          </DSStage>
        </DSSection>

        {/* 2 — Layout scale */}
        <DSSection title="Layout scale" purpose="The workspace dimensions every screen composes within.">
          <DSTokenTable
            head={["Token", "Value", "Why"]}
            rows={[
              ["content.max", "1440px", "Workspace content width; centered in the viewport"],
              ["sidebar.width", "264px · 68px", "Expanded · collapsed rail (Screen 21)"],
              ["layout.gutter", "16 / 24 / 32px", "Horizontal padding at base / md / lg"],
              ["layout.columns", "12", "Grid columns for content areas"],
              ["layout.sectionGap", <>24px — <DSVar>space-y-6</DSVar></>, "Vertical rhythm between sections"],
            ]}
          />
          <DSStage className="mt-5">
            <div className="w-full">
              <div className="grid grid-cols-12 gap-1 sm:gap-1.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex h-9 items-center justify-center rounded-md text-[10px] font-medium tabular-nums",
                      i % 2 === 0 ? "bg-blue-100 text-blue-800" : "bg-blue-50 text-blue-600",
                    )}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              <DSCaption>The 12-column grid underpins content areas; gutters flex 16 → 24 → 32px by breakpoint.</DSCaption>
            </div>
          </DSStage>
        </DSSection>

        {/* 3 — Responsive cards */}
        <DSSection title="Responsive cards" purpose="Stat rows reflow by breakpoint — never scroll, never squeeze.">
          <DSStage>
            <div className="w-full">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile icon={<Users />} value="1,245" label="Employees" />
                <StatTile icon={<UserRound />} value="18" label="Open roles" />
                <StatTile icon={<ClipboardCheck />} value="8" label="Pending approvals" />
                <StatTile icon={<Workflow />} value="12" label="Active workflows" />
              </div>
              <DSCaption>
                grid-cols-1 → sm:grid-cols-2 → lg:grid-cols-4. Resize the preview panel to watch the reflow — tiles stack,
                then pair up, then sit four across.
              </DSCaption>
            </div>
          </DSStage>
        </DSSection>

        {/* 4 — Responsive tables */}
        <DSSection
          title="Responsive tables"
          purpose="Same data, re-authored: columns drop first, then the table becomes cards."
        >
          <DSStage>
            <div className="w-full">
              <DataTable
                columns={DEMO_COLUMNS}
                rows={DEMO_ROWS}
                rowKey={(r) => r.id}
                pageSize={0}
                caption="Responsive table demo — five employees"
                onRowClick={(r) =>
                  toast({ title: r.name, description: "Employee drawer pattern is documented in Modal & Drawer Patterns (23)." })
                }
                mobileCard={(r) => (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={r.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-slate-800">{r.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {r.role} · {r.department}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={r.status} size="sm" />
                  </div>
                )}
              />
              <DSCaption>
                Role hides below lg (hideBelow); below md the whole table becomes structured cards — the same data, re-authored
                for touch. Resize to see both steps.
              </DSCaption>
            </div>
          </DSStage>
        </DSSection>

        {/* 5 — Responsive forms */}
        <DSSection title="Responsive forms" purpose="Two columns from sm, one below — labels always stay attached.">
          <DSStage>
            <div className="w-full max-w-2xl">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rg-name">Employee name</Label>
                  <Input
                    id="rg-name"
                    className="h-10"
                    placeholder="e.g. Meera Iyer"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rg-dept">Department</Label>
                  <Select value={form.department} onValueChange={(v) => setForm((f) => ({ ...f, department: v }))}>
                    <SelectTrigger id="rg-dept" className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rg-email">Email</Label>
                  <Input
                    id="rg-email"
                    type="email"
                    className="h-10"
                    placeholder="meera.iyer@qubitone.in"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rg-phone">Phone</Label>
                  <Input
                    id="rg-phone"
                    type="tel"
                    className="h-10"
                    placeholder="+91 98210 20012"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button
                  className="h-9"
                  onClick={() =>
                    toast({ title: "Employee draft saved", description: "Layout demo — validation patterns live in Inputs & Forms (17)." })
                  }
                >
                  Save employee
                </Button>
                <Button
                  variant="outline"
                  className="h-9"
                  onClick={() => setForm({ name: "", department: DEPARTMENTS[0], email: "", phone: "" })}
                >
                  Clear
                </Button>
              </div>
              <DSCaption>Below sm the grid stacks to one column; fields keep full width and 44px-class touch targets.</DSCaption>
            </div>
          </DSStage>
        </DSSection>

        {/* 6 — Navigation mapping */}
        <DSSection
          title="Navigation mapping"
          purpose="Desktop and mobile are one product with two chrooms — the mapping is systematic."
        >
          <DSStage>
            <div className="flex w-full flex-wrap items-start justify-center gap-8">
              <DSExample label="Desktop ≥1024px — persistent sidebar + topbar + multi-column content">
                <DesktopWireframe />
              </DSExample>
              <DSExample label="Mobile <768px — hamburger sheet + single column + bottom actions">
                <MobileWireframe />
              </DSExample>
            </div>
            <DSTokenTable
              className="mt-6"
              head={["Desktop pattern", "Mobile translation", "Rule"]}
              rows={[
                ["Sidebar", "Navigation sheet", "Same tree in a w-72 left sheet below 768px (Screen 21)"],
                ["Table", "Structured cards", "DataTable renders record cards instead of horizontal scroll"],
                ["Modal", "Full-screen sheet", "Centered dialogs become edge-to-edge sheets on mobile"],
                ["Drawer", "Full-height panel", "The right drawer keeps its height and gains full width"],
                ["Multi-column", "Single column", "Stack in priority order — primary content first"],
                ["Command bar", "Search icon", "The pill collapses into the topbar; the dialog stays full-width (Screen 22)"],
              ]}
            />
          </DSStage>
        </DSSection>

        {/* 7 — Mobile-first rules */}
        <DSSection title="Mobile-first rules" purpose="Write the small layout first, then enhance upward.">
          <DSSpec
            className="mb-5"
            rows={[
              { label: "Purpose", value: "One layout system that reflows from the desktop workspace to a single mobile column without losing content or hierarchy." },
              { label: "Use when", value: "Composing any new screen — build on the 12-column grid, then collapse by breakpoint (sm → md → lg → xl)." },
              { label: "Avoid when", value: "Pinning absolute positions or fixed pixel widths that cannot reflow; designing desktop first and squeezing later." },
              { label: "Responsive", value: "Gutters 16 → 24 → 32px; stat rows 1 → 2 → 4-up; tables become cards below md; navigation becomes a sheet." },
              { label: "Touch", value: "44px minimum hit targets on touch devices; hover is never the only affordance." },
              { label: "Accessibility", value: "Focus order follows the stacked visual order on mobile; CSS breakpoints drive layout — never viewport-only scripts." },
            ]}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="redesign intentionally on mobile">
              44px touch targets, stacked hierarchy, contextual actions in the bottom bar or a sheet. Mobile is the same
              product re-authored for touch — not a smaller screenshot of desktop.
            </DSGuidance>
            <DSGuidance kind="dont" title="scale the desktop down">
              No shrink-to-fit desktops, no content hidden without a replacement pattern, no horizontal scrolling — the only
              sanctioned exception is wide data tables, which become cards below md anyway.
            </DSGuidance>
          </div>
        </DSSection>
      </div>

      <DSScreenNav id="responsive-grid" />
    </>
  );
}
