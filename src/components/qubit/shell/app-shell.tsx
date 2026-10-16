"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SCREENS } from "@/lib/qubit/screens";
import { useQubitNav } from "../nav-context";
import { SidebarContent, SIDEBAR_MODULES } from "./sidebar";
import { TopBar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { ModulePlaceholder } from "./module-placeholder";
import { SCREEN_COMPONENTS } from "../screen-registry";

function ShellFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200/80 pt-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1 text-[11px] text-muted-foreground">
        <p>© 2026 Qubit One Pvt Ltd · Enterprise Business Operating System</p>
        <p className="flex items-center gap-2">
          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-medium text-slate-500">Phase 1 — Enterprise Architecture</span>
          <span>v1.0.0</span>
        </p>
      </div>
    </footer>
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
  const previewModuleName = previewModule
    ? SIDEBAR_MODULES.find((m) => m.id === previewModule)?.label ?? ""
    : "";

  const content = previewModule ? (
    <ModulePlaceholder moduleId={previewModule} moduleName={previewModuleName} />
  ) : (
    <div key={`${screen}-${navKey}`} className="qubit-screen-enter">
      <ScreenComp />
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <aside
        className={cnSidebar(collapsed)}
        aria-label="Sidebar navigation"
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onPreviewModule={(m) => setPreviewModule(m)}
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
          <div className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col px-4 py-5 md:px-6 lg:px-8">
            <div className="flex-1">{content}</div>
            <ShellFooter />
          </div>
        </main>
      </div>

      {/* Mobile navigation */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 border-0 bg-navy-900 p-0 [&>button]:text-slate-400">
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
    "relative z-20 hidden shrink-0 border-r border-navy-950/40 transition-[width] duration-200 md:block",
    collapsed ? "w-16" : "w-60",
  ].join(" ");
}
