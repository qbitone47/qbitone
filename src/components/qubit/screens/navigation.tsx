"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ChevronRight,
  EyeOff,
  Lock,
  Menu,
  PanelLeftOpen,
  ShieldCheck,
  Wallet,
} from "lucide-react";
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
import { ArrowLink } from "../primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { QubitMark, SIDEBAR_MODULES, type SidebarModule } from "../shell/sidebar";

// ============================================================
// Screen 21 — Navigation
// Sidebar states, nested IA, breadcrumbs, tabs, pagination,
// contextual links and the mobile sheet — one navigation voice.
// ============================================================

const ENTERPRISE_SCREENS = screensByModule("enterprise");

/** Group the real shell module list by section (same data as the live sidebar). */
function useSidebarSections(): [string, SidebarModule[]][] {
  return React.useMemo(() => {
    const map = new Map<string, SidebarModule[]>();
    for (const m of SIDEBAR_MODULES) {
      if (!map.has(m.section)) map.set(m.section, []);
      map.get(m.section)!.push(m);
    }
    return Array.from(map.entries());
  }, []);
}

// ------------------------------------------------------------
// Sidebar replica — faithful to the shell sidebar (white panel,
// Q mark brand, section labels, ordered children).
// ------------------------------------------------------------

function SidebarReplica({
  variant,
  showBrand = true,
  onNavigate,
}: {
  variant: "expanded" | "rail";
  showBrand?: boolean;
  onNavigate?: () => void;
}) {
  const { navigate, screen } = useQubitNav();
  const { toast } = useToast();
  const sections = useSidebarSections();
  const collapsed = variant === "rail";

  // Demo state: Enterprise is the active, expanded module. When the visitor
  // has navigated to a real enterprise screen the highlight follows them.
  const activeChild = ENTERPRISE_SCREENS.some((s) => s.id === screen) ? screen : "org-structure";

  const openModuleToast = (label: string) => {
    if (label === "Design System") {
      toast({ title: "Opens Design System module", description: "Open right now — it lives in the System section." });
    } else {
      toast({ title: `Opens ${label} module`, description: "This module is served by the surfaces that already own its capabilities." });
    }
    onNavigate?.();
  };

  const goChild = (id: ScreenId) => {
    navigate(id);
    onNavigate?.();
  };

  return (
    <div
      className={cn(
        "qubit-scroll max-h-[600px] overflow-y-auto rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
        collapsed ? "w-[68px]" : "w-[264px]",
      )}
    >
      {showBrand && (
        <div className={cn("flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-200/80 px-4", collapsed && "justify-center px-0")}>
          <QubitMark />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold leading-tight tracking-tight text-slate-900">Qubit One</span>
              <span className="block text-[10.5px] leading-tight text-slate-400">Enterprise OS</span>
            </span>
          )}
        </div>
      )}

      {collapsed && (
        <div className="flex justify-center border-b border-slate-100 py-2.5">
          <span
            title="Expand sidebar — returns to 264px"
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-600"
            onClick={() => toast({ title: "Expand control", description: "In the live app this restores the 264px sidebar." })}
          >
            <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
      )}

      <nav aria-label="Sidebar replica" className="px-3 pb-3 pt-3">
        {sections.map(([section, mods], si) => (
          <div key={section} className={cn("mb-3", si > 0 && collapsed && "border-t border-slate-100 pt-2")}>
            {!collapsed && (
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{section}</p>
            )}
            <ul className="space-y-0.5">
              {mods.map((m) => {
                const Icon = m.icon;
                const isEnterprise = m.expandableModule === "enterprise";

                if (isEnterprise) {
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        aria-expanded
                        aria-current="true"
                        className="flex w-full items-center gap-2.5 rounded-lg bg-blue-50 px-2.5 py-2 text-[13px] font-medium text-blue-700"
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0 text-blue-600" aria-hidden />
                        {!collapsed && <span className="flex-1 text-left">{m.label}</span>}
                        {!collapsed && (
                          <ChevronRight
                            className={cn("h-3 w-3 shrink-0 text-slate-400 transition-transform duration-150", "rotate-90")}
                            aria-hidden
                          />
                        )}
                      </button>
                      {!collapsed && (
                        <ul className="mt-0.5 space-y-px" role="list">
                          {ENTERPRISE_SCREENS.map((s) => {
                            const active = s.id === activeChild;
                            return (
                              <li key={s.id}>
                                <button
                                  type="button"
                                  aria-current={active ? "page" : undefined}
                                  onClick={() => goChild(s.id)}
                                  className={cn(
                                    "flex w-full items-center gap-2 rounded-md py-1.5 pl-9 pr-2.5 text-left text-[12.5px] transition-colors duration-150",
                                    active
                                      ? "bg-blue-50 font-medium text-blue-700"
                                      : "text-slate-500 hover:bg-slate-100/70 hover:text-slate-800",
                                  )}
                                >
                                  <span className="truncate">{s.shortTitle}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                }

                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      title={collapsed ? m.label : undefined}
                      onClick={() => openModuleToast(m.label)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-600 transition-colors duration-150",
                        "hover:bg-slate-100/80 hover:text-slate-900",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0 text-slate-400" aria-hidden />
                      {!collapsed && <span className="flex-1 text-left">{m.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer — org card (expanded) / Q mark (rail) */}
      <div className={cn("shrink-0 border-t border-slate-200/80 p-3", collapsed && "flex justify-center px-2")}>
        {collapsed ? (
          <QubitMark className="h-7 w-7 rounded-lg text-[13px]" />
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <QubitMark className="h-7 w-7 rounded-lg text-[13px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold leading-tight text-slate-900">Qubit One Pvt Ltd</span>
              <span className="block truncate text-[10.5px] leading-tight text-slate-400">Enterprise Design System</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
          </div>
        )}
      </div>
    </div>
  );
}

/** One annotated navigation state (right column of section 1). */
function StateRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-3 first:pt-0 last:border-0 last:pb-0">
      <p className="text-[13px] font-medium text-slate-800">{title}</p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">{children}</p>
    </div>
  );
}

// ------------------------------------------------------------
// Nested tree row with indent guides (section 2).
// ------------------------------------------------------------

function TreeLine({
  depth,
  icon: Icon,
  label,
  expandable,
  expanded,
  onClick,
  disabled,
  hiddenChip,
  trailing,
}: {
  depth: number;
  icon?: React.ElementType;
  label: string;
  expandable?: boolean;
  expanded?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  hiddenChip?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      role="treeitem"
      aria-selected={false}
      aria-expanded={expandable ? expanded : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      title={disabled ? "Unavailable in preview" : undefined}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (onClick && !disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "relative flex items-center gap-2 rounded-lg py-1.5 pr-2 text-[13px] text-slate-700 transition-colors duration-150",
        onClick && !disabled && "cursor-pointer hover:bg-slate-100/70",
        disabled && "cursor-not-allowed opacity-40",
      )}
      style={{ paddingLeft: depth * 20 + 6 }}
    >
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} aria-hidden className="absolute bottom-0 top-0 border-l border-slate-200" style={{ left: i * 20 + 14 }} />
      ))}
      {expandable ? (
        <ChevronRight
          className={cn("h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150", expanded && "rotate-90")}
          aria-hidden
        />
      ) : (
        <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      {Icon ? (
        <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      ) : (
        <span className="w-4 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hiddenChip && (
        <span title="Hidden for your role" className="rounded border border-slate-200 bg-slate-50 px-1 py-px text-[10px] font-medium text-slate-500">
          Hidden
        </span>
      )}
      {trailing}
    </div>
  );
}

// ------------------------------------------------------------
// Screen
// ------------------------------------------------------------

export function NavigationScreen() {
  const { navigate, canBack, canForward, back, forward } = useQubitNav();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const TOTAL_PAGES = 12;

  const governanceChildren: { id: ScreenId; label: string }[] = [
    { id: "approval-matrix", label: "Approval Matrix" },
    { id: "permission-matrix", label: "Permission Matrix" },
    { id: "data-ownership", label: "Data Ownership" },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Navigation"
        description="Sidebar, breadcrumbs, tabs and mobile navigation patterns."
      />

      <div className="space-y-6">
        {/* 1 — Primary sidebar states */}
        <DSSection
          title="Primary sidebar — states"
          purpose="One sidebar grammar: section labels, module rows, numbered children, a single active state."
        >
          <DSStage>
            <div className="flex w-full flex-col gap-6 lg:flex-row lg:gap-8">
              <div className="flex shrink-0 flex-wrap items-start justify-center gap-5 lg:justify-start">
                <DSExample label="Expanded — 264px">
                  <SidebarReplica variant="expanded" />
                </DSExample>
                <DSExample label="Collapsed rail — 68px">
                  <SidebarReplica variant="rail" />
                </DSExample>
              </div>
              <div className="min-w-0 flex-1 lg:max-w-md">
                <StateRow title="Default">
                  Icons sit in <DSVar>text-slate-400</DSVar>, labels in <DSVar>text-slate-600</DSVar> — the resting state every
                  row shares.
                </StateRow>
                <StateRow title="Hover">
                  The replica rows are live: hover any module to feel <DSVar>bg-slate-100/80</DSVar> with the label deepening to{" "}
                  <DSVar>hover:text-slate-900</DSVar>.
                </StateRow>
                <StateRow title="Active module">
                  Exactly one active module: <DSVar>bg-blue-50 text-blue-700</DSVar> with the icon lifted to{" "}
                  <DSVar>text-blue-600</DSVar>. Here that is <strong className="font-medium text-slate-700">Enterprise</strong>.
                </StateRow>
                <StateRow title="Parent expanded">
                  The chevron rotates <DSVar>rotate-90</DSVar> and children render at{" "}
                  <DSVar>pl-9</DSVar> in 12.5px — order you can scan, depth you can feel.
                </StateRow>
                <StateRow title="Active child">
                  The deepest active level wins: <DSVar>bg-blue-50 font-medium text-blue-700</DSVar> with its label highlighted in blue.
                  Shown on Organization Structure — click any child to make it live.
                </StateRow>
                <StateRow title="Collapsed rail">
                  68px, icons only, section separators replace labels; native tooltips surface the names on hover and the
                  expand control sits at the top.
                </StateRow>
              </div>
            </div>
          </DSStage>
        </DSSection>

        {/* 2 — Nested navigation & permissions */}
        <DSSection
          title="Nested navigation & permission awareness"
          purpose="Depth is capped at three levels; permissions decide what renders at all."
          actions={
            <Button variant="outline" size="sm" className="h-8" onClick={() => navigate("enterprise-navigation")}>
              Master IA · Enterprise Navigation
            </Button>
          }
        >
          <DSStage align="center">
            <DSExample
              className="w-full max-w-md"
              label="Hidden rows are removed for unauthorized roles in production — rendered here only to document the state. Disabled means “exists, unavailable”; hidden means “does not exist for you”."
            >
              <div role="tree" aria-label="Permission-aware navigation replica" className="w-full rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <TreeLine depth={0} icon={Building2} label="Enterprise" expandable expanded />
                <TreeLine depth={1} icon={ShieldCheck} label="Governance" expandable expanded />
                {governanceChildren.map((c) => (
                  <TreeLine key={c.id} depth={2} label={c.label} onClick={() => navigate(c.id)} />
                ))}
                <TreeLine depth={1} icon={Wallet} label="Compensation" expandable expanded />
                <TreeLine
                  depth={2}
                  icon={EyeOff}
                  label="Compensation Structure"
                  hiddenChip
                />
                <TreeLine
                  depth={2}
                  icon={Lock}
                  label="Salary Bands"
                  disabled
                  trailing={
                    <span className="rounded border border-slate-200 bg-white px-1 py-px text-[10px] text-slate-400">
                      Unavailable in preview
                    </span>
                  }
                />
              </div>
            </DSExample>
          </DSStage>
        </DSSection>

        {/* 3 — Breadcrumbs */}
        <DSSection
          title="Breadcrumbs"
          purpose="The topbar owns the trail; in-page breadcrumbs serve deep in-module hierarchies."
        >
          <DSStage>
            <div className="w-full space-y-5">
              <DSExample label="Full path — every ancestor is a live link">
                <Breadcrumb>
                  <BreadcrumbList className="text-[13px]">
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <button type="button" onClick={() => navigate("org-structure")} className="font-medium text-slate-500 transition-colors hover:text-slate-800">
                          Qubit One
                        </button>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <button type="button" onClick={() => navigate("org-structure")} className="font-medium text-slate-500 transition-colors hover:text-slate-800">
                          Enterprise
                        </button>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="font-medium text-slate-800">Organization Structure</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </DSExample>
              <div className="h-px bg-slate-100" />
              <DSExample label="Mobile truncation — middle crumbs drop below sm, the deepest crumb always survives">
                <Breadcrumb>
                  <BreadcrumbList className="text-[13px]">
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <button type="button" onClick={() => navigate("org-structure")} className="font-medium text-slate-500 transition-colors hover:text-slate-800">
                          Qubit One
                        </button>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbItem className="hidden sm:inline-flex">
                      <BreadcrumbLink asChild>
                        <button type="button" onClick={() => navigate("org-structure")} className="font-medium text-slate-500 transition-colors hover:text-slate-800">
                          Enterprise
                        </button>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden sm:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="font-medium text-slate-800">Organization Structure</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </DSExample>
            </div>
          </DSStage>
        </DSSection>

        {/* 4 — Tabs */}
        <DSSection title="Tabs" purpose="Peer views of one object — never a vehicle for moving between modules.">
          <DSStage>
            <DSExample
              className="w-full max-w-xl"
              label="Tabs switch views of the same thing; module changes belong to the sidebar, ⌘ K or breadcrumbs."
            >
              <Tabs defaultValue="details">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="visibility">Role visibility</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <p className="px-1 py-1 text-[13px] text-slate-600">
                    Structure, owner and screen metadata for this node — the default peer view.
                  </p>
                </TabsContent>
                <TabsContent value="visibility">
                  <p className="px-1 py-1 text-[13px] text-slate-600">
                    Which roles see this node — mirrors the IA governance in Enterprise Navigation.
                  </p>
                </TabsContent>
                <TabsContent value="preview">
                  <p className="px-1 py-1 text-[13px] text-slate-600">
                    The sidebar rendered exactly as the selected role would see it.
                  </p>
                </TabsContent>
              </Tabs>
            </DSExample>
          </DSStage>
        </DSSection>

        {/* 5 — Pagination */}
        <DSSection
          title="Pagination"
          purpose="Full pagination bar for content-heavy pages; data tables use the compact pattern."
        >
          <DSStage align="center">
            <DSExample label="Live — click through; tables use the compact “Page x of y” pattern instead">
              <div className="flex flex-col items-center gap-2">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setPage((p) => Math.max(1, p - 1));
                        }}
                        aria-disabled={page === 1}
                        className={cn(page === 1 && "pointer-events-none opacity-40")}
                      />
                    </PaginationItem>
                    {[1, 2, 3].map((n) => (
                      <PaginationItem key={n}>
                        <PaginationLink
                          href="#"
                          isActive={page === n}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(n);
                          }}
                        >
                          {n}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        isActive={page === TOTAL_PAGES}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(TOTAL_PAGES);
                        }}
                      >
                        {TOTAL_PAGES}
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setPage((p) => Math.min(TOTAL_PAGES, p + 1));
                        }}
                        aria-disabled={page === TOTAL_PAGES}
                        className={cn(page === TOTAL_PAGES && "pointer-events-none opacity-40")}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <p aria-live="polite" className="text-xs text-slate-500">
                  Page <span className="font-medium text-slate-700">{page}</span> of {TOTAL_PAGES} · 240 records
                </p>
              </div>
            </DSExample>
          </DSStage>
        </DSSection>

        {/* 6 — Contextual navigation */}
        <DSSection title="Contextual navigation" purpose="Move users along the task, not just through the tree.">
          <DSStage>
            <div className="grid w-full gap-5 md:grid-cols-3">
              <DSExample label="Cross-module link — ArrowLink">
                <div className="flex h-full min-h-[84px] flex-col justify-center rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <p className="mb-1.5 text-xs text-slate-400">Employee drawer · Reporting</p>
                  <ArrowLink onClick={() => navigate("reporting-lines")}>View reporting line</ArrowLink>
                </div>
              </DSExample>
              <DSExample label="History — topbar circular buttons (live)">
                <div className="flex h-full min-h-[84px] items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <button
                    type="button"
                    aria-label="Navigate back"
                    disabled={!canBack}
                    onClick={back}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-colors duration-150 hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="Navigate forward"
                    disabled={!canForward}
                    onClick={forward}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-colors duration-150 hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </DSExample>
              <DSExample label="Module chip — return affordance">
                <div className="flex h-full min-h-[84px] flex-col justify-center rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <p className="mb-2 text-xs text-slate-400">PageHeader chip → module root</p>
                  <button
                    type="button"
                    onClick={() => navigate("design-tokens")}
                    className="self-start rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    Design System
                  </button>
                </div>
              </DSExample>
            </div>
            <DSCaption>
              Back / forward walk the in-app history stack; a new navigation truncates forward history — exactly like a browser.
            </DSCaption>
          </DSStage>
        </DSSection>

        {/* 7 — Mobile navigation */}
        <DSSection
          title="Mobile navigation"
          purpose="Below 768px the sidebar becomes a sheet — same tree, same states, one column of content."
        >
          <DSStage align="center">
            <div className="flex flex-col items-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="Open navigation menu"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <DSCaption className="mt-2 max-w-md text-center">
                Hamburger lives in the topbar below 768px. The sheet <em>is</em> the sidebar — identical hierarchy and active
                states, rendered at w-72 — while page content collapses to a single column.
              </DSCaption>
            </div>
          </DSStage>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-72 gap-0 p-0">
              <div className="flex h-full flex-col">
                <SheetHeader className="border-b border-slate-200/80 px-4 py-4">
                  <SheetTitle className="text-[15px] font-semibold tracking-tight text-slate-900">Qubit One</SheetTitle>
                  <SheetDescription className="text-[11px] text-slate-400">Enterprise OS — mobile navigation demo</SheetDescription>
                </SheetHeader>
                <div className="qubit-scroll flex-1 overflow-y-auto border-none">
                  <SidebarReplica variant="expanded" showBrand={false} onNavigate={() => setMobileOpen(false)} />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </DSSection>

        {/* 8 — Scalability rules */}
        <DSSection title="Scalability rules" purpose="The sidebar must survive ten modules and a hundred screens.">
          <DSTokenTable
            head={["Token", "Value", "Why"]}
            rows={[
              ["sidebar.width", "264px expanded · 68px collapsed", "One constant everywhere — content layouts never reflow on module switch"],
              ["sidebar.sections", "≤ 6", "Section labels beat scrolling; past six groups, split or rethink the IA"],
              ["sidebar.children", "12.5px · pl-9", "Multi-screen modules get scannable children, not nested groups"],
              ["sidebar.overflow", "Internal scroll only", "The nav column scrolls itself; the page never scrolls sideways"],
            ]}
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="section labels + ordered children + one active state">
              Three ingredients carry the whole system: uppercase section labels group at a glance, ordered children give
              scannable structure, and exactly one active state keeps “where am I” unambiguous at any depth.
            </DSGuidance>
            <DSGuidance kind="dont" title="overcrowded sidebar, nested >3 levels, invisible permissions">
              No module lists without groups, no trees deeper than Enterprise › Governance › Permission Matrix, and never
              surface a row a role cannot use — hide it, don&apos;t tease it.
            </DSGuidance>
          </div>
        </DSSection>

        {/* Specification */}
        <DSSection title="Specification">
          <DSSpec
            rows={[
              { label: "Purpose", value: "One predictable grammar for moving between modules, screens and peer views across the OS." },
              { label: "Use when", value: "Every screen — the shell owns sidebar, topbar breadcrumb and ⌘ K; screens compose tabs, pagination and contextual links." },
              { label: "Avoid when", value: "Building a second nav system inside a screen (in-page sidebars, duplicate breadcrumbs) or nesting beyond three levels." },
              { label: "States", value: "Default · hover · active module · parent expanded · active child · collapsed rail · hidden (permission) · disabled (preview)." },
              { label: "Responsive", value: "≥768px persistent sidebar at 264px (68px rail); <768px the same tree opens in a w-72 left sheet from the topbar hamburger." },
              {
                label: "Accessibility",
                value: (
                  <>
                    <DSVar>aria-current="page"</DSVar> on the active child, <DSVar>aria-expanded</DSVar> on parents,{" "}
                    <DSVar>aria-label</DSVar> on icon-only buttons, and a visible focus ring on every interactive row.
                  </>
                ),
              },
            ]}
          />
        </DSSection>
      </div>

      <DSScreenNav id="navigation" />
    </>
  );
}
