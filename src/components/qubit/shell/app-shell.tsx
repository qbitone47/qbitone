"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AUTH_SCREENS, SCREENS, type ScreenId } from "@/lib/qubit/screens";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard } from "../primitives";
import { useQubitNav } from "../nav-context";
import { SidebarContent, SIDEBAR_MODULES, MODULE_PHASE } from "./sidebar";
import { TopBar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { ModulePlaceholder } from "./module-placeholder";
import { SCREEN_COMPONENTS } from "../screen-registry";
import { TelemetryReporter } from "../obs/telemetry-reporter";

function ShellFooter({ phase }: { phase: string }) {
  return (
    <footer className="mt-auto border-t border-slate-200/70 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1 text-[11px] text-slate-400">
        <p>© 2026 Qubit One Pvt Ltd · Enterprise Business Operating System</p>
        <p className="flex items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            {phase}
          </span>
          <span>v1.0.0</span>
        </p>
      </div>
    </footer>
  );
}

/** Defense-in-depth: a registered screen whose implementation failed to load
 * renders an honest error card — never a React crash, never a blank area.
 * After registry wiring this should never trigger. */
function ScreenLoadError({ screen, title }: { screen: ScreenId; title: string }) {
  const { navigate } = useQubitNav();
  return (
    <div>
      <PageHeader
        crumbs={[{ label: "System" }, { label: "Screen unavailable" }]}
        title={title}
        description="This screen is registered but its implementation failed to load. The rest of Qubit One is unaffected."
      />
      <SectionCard>
        <EmptyState
          icon={<TriangleAlert />}
          title="Screen could not be loaded"
          message={`The “${title}” screen (${screen}) is registered but its implementation failed to load. Navigation, the command palette and every other module continue to work.`}
          action={
            <Button type="button" onClick={() => navigate("employee-home")}>
              Back to Home
            </Button>
          }
        />
      </SectionCard>
    </div>
  );
}

export function AppShell() {
  const { screen, navKey } = useQubitNav();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [previewModule, setPreviewModule] = React.useState<string | null>(null);

  const meta = SCREENS.find((s) => s.id === screen)!;
  const ScreenComp = SCREEN_COMPONENTS[screen];
  const phaseLabel = MODULE_PHASE[meta.module] ?? "Qubit One Enterprise OS";
  const previewModuleName = previewModule
    ? SIDEBAR_MODULES.find((m) => m.id === previewModule)?.label ?? ""
    : "";

  // Authentication screens (31–33) render standalone — the real
  // sign-in experience has no workspace chrome around it.
  if (AUTH_SCREENS.includes(screen)) {
    if (!ScreenComp) return <ScreenLoadError screen={screen} title={meta.title} />;
    return (
      <div key={`${screen}-${navKey}`} className="h-dvh overflow-hidden">
        <ScreenComp />
      </div>
    );
  }

  const content = previewModule ? (
    <ModulePlaceholder moduleId={previewModule} moduleName={previewModuleName} />
  ) : ScreenComp ? (
    <div key={`${screen}-${navKey}`} className="qubit-screen-enter">
      <ScreenComp />
    </div>
  ) : (
    <ScreenLoadError screen={screen} title={meta.title} />
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-workspace">
      {/* Desktop sidebar */}
      <aside
        className={cnSidebar(collapsed)}
        aria-label="Sidebar navigation"
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onPreviewModule={(m) => setPreviewModule(m)}
          onNavigate={() => setPreviewModule(null)}
        />
      </aside>

      {/* Right column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          onPreviewModuleCleared={() => setPreviewModule(null)}
        />
        <main id="main-scroll" className="qubit-scroll flex-1 overflow-y-auto" tabIndex={-1}>
          <div className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col px-4 py-6 md:px-6 lg:px-8">
            <div className="flex-1">{content}</div>
            <ShellFooter phase={phaseLabel} />
          </div>
        </main>
      </div>

      {/* Phase 25 — global client telemetry collector (headless, fire-and-forget) */}
      <TelemetryReporter screen={screen} />

      {/* Mobile navigation */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 border-0 bg-white p-0 [&>button]:text-slate-400">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SidebarContent
            collapsed={false}
            onPreviewModule={(m) => {
              setPreviewModule(m);
              setMobileNavOpen(false);
            }}
            onNavigate={() => {
              setPreviewModule(null);
              setMobileNavOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function cnSidebar(collapsed: boolean) {
  return [
    "relative z-20 hidden shrink-0 border-r border-slate-200/80 bg-white transition-[width] duration-200 md:block",
    collapsed ? "w-[68px]" : "w-[264px]",
  ].join(" ");
}
