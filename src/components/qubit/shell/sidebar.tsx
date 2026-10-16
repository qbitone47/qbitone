"use client";

import * as React from "react";
import {
  BarChart3,
  Building2,
  FolderClosed,
  House,
  Megaphone,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  Video,
  Wallet,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SCREENS, type ScreenId } from "@/lib/qubit/screens";
import { useQubitNav } from "../nav-context";

export interface SidebarModule {
  id: string;
  label: string;
  icon: React.ElementType;
  section: string;
  screen?: ScreenId; // present = navigable in Phase 1
}

export const SIDEBAR_MODULES: SidebarModule[] = [
  { id: "home", label: "Home", icon: House, section: "Workspace" },
  { id: "enterprise", label: "Enterprise", icon: Building2, section: "Workspace", screen: "org-structure" },
  { id: "people", label: "People", icon: UserRound, section: "Workspace" },
  { id: "sales", label: "Sales", icon: TrendingUp, section: "Business" },
  { id: "finance", label: "Finance", icon: Wallet, section: "Business" },
  { id: "hr", label: "HR & People", icon: Users, section: "Business" },
  { id: "inventory", label: "Inventory", icon: Package, section: "Business" },
  { id: "marketing", label: "Marketing", icon: Megaphone, section: "Business" },
  { id: "service", label: "Service", icon: Wrench, section: "Business" },
  { id: "meetings", label: "Meetings", icon: Video, section: "Intelligence" },
  { id: "ai", label: "AI", icon: Sparkles, section: "Intelligence" },
  { id: "analytics", label: "Analytics", icon: BarChart3, section: "Intelligence" },
  { id: "documents", label: "Documents", icon: FolderClosed, section: "Intelligence" },
  { id: "settings", label: "Settings", icon: Settings2, section: "System" },
];

export const MODULE_PHASE: Record<string, string> = {
  home: "Phase 2 — Core Employee Workspace",
  people: "Phase 2 — People Directory",
  sales: "Phase 4 — Sales Operations",
  finance: "Phase 6 — Finance",
  hr: "Phase 7 — HR & People",
  inventory: "Phase 8 — Inventory",
  marketing: "Phase 9 — Marketing",
  service: "Phase 10 — Service",
  meetings: "Phase 11 — Meetings & Collaboration",
  ai: "Phase 12 — Qubit AI Platform",
  analytics: "Phase 13 — Analytics & Reporting",
  documents: "Phase 14 — Documents & Knowledge",
  settings: "Phase 15 — Administration & Settings",
};

function QubitMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 via-blue-700 to-navy-900 text-[15px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]",
        className,
      )}
    >
      Q
    </span>
  );
}

export function SidebarContent({
  collapsed,
  onToggleCollapse,
  onPreviewModule,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onPreviewModule?: (moduleId: string) => void;
  onNavigate?: () => void;
}) {
  const { screen, navigate } = useQubitNav();
  const [enterpriseOpen, setEnterpriseOpen] = React.useState(true);

  const sections = React.useMemo(() => {
    const map = new Map<string, SidebarModule[]>();
    for (const m of SIDEBAR_MODULES) {
      if (!map.has(m.section)) map.set(m.section, []);
      map.get(m.section)!.push(m);
    }
    return Array.from(map.entries());
  }, []);

  const goScreen = (s: ScreenId) => {
    navigate(s);
    onNavigate?.();
  };

  return (
    <div className="flex h-full flex-col bg-navy-900 text-slate-300">
      {/* Brand */}
      <div className={cn("flex items-center gap-2.5 border-b border-navy-700/60 px-4", collapsed ? "h-14 justify-center px-0" : "h-14")}>
        <QubitMark />
        {!collapsed && (
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold leading-tight text-white">Qubit One</span>
            <span className="block text-[10px] leading-tight text-slate-400">Enterprise Business OS</span>
          </span>
        )}
        {!collapsed && onToggleCollapse && (
          <button
            type="button"
            aria-label="Collapse sidebar"
            onClick={onToggleCollapse}
            className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-navy-800 hover:text-white"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && onToggleCollapse && (
        <div className="flex justify-center py-2">
          <button
            type="button"
            aria-label="Expand sidebar"
            onClick={onToggleCollapse}
            className="rounded-md p-1.5 text-slate-400 hover:bg-navy-800 hover:text-white"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav aria-label="Primary" className="qubit-scroll-dark flex-1 overflow-y-auto px-2.5 py-3">
        {sections.map(([section, modules]) => (
          <div key={section} className="mb-4">
            {!collapsed && (
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{section}</p>
            )}
            <ul className="space-y-0.5">
              {modules.map((m) => {
                const Icon = m.icon;
                const isEnterprise = m.id === "enterprise";
                const enterpriseActive = isEnterprise && SCREENS.some((s) => s.id === screen);
                const isActive = m.screen ? m.screen === screen : false;

                if (isEnterprise) {
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        aria-expanded={enterpriseOpen}
                        onClick={() => (collapsed ? goScreen("org-structure") : setEnterpriseOpen((o) => !o))}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                          enterpriseActive ? "bg-navy-800 text-white" : "text-slate-300 hover:bg-navy-800/70 hover:text-white",
                          collapsed && "justify-center px-0",
                        )}
                        title={collapsed ? "Enterprise" : undefined}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        {!collapsed && <span className="flex-1 text-left">Enterprise</span>}
                        {!collapsed && (
                          <svg
                            viewBox="0 0 12 12"
                            className={cn("h-3 w-3 text-slate-500 transition-transform", enterpriseOpen && "rotate-90")}
                            aria-hidden
                          >
                            <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        )}
                      </button>
                      {!collapsed && enterpriseOpen && (
                        <ul className="mt-0.5 space-y-px" role="list">
                          {SCREENS.map((s) => (
                            <li key={s.id}>
                              <button
                                type="button"
                                aria-current={screen === s.id ? "page" : undefined}
                                onClick={() => goScreen(s.id)}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-md py-1.5 pl-9 pr-2.5 text-[13px] transition-colors",
                                  screen === s.id
                                    ? "bg-primary font-medium text-white"
                                    : "text-slate-400 hover:bg-navy-800/70 hover:text-slate-100",
                                )}
                              >
                                <span
                                  className={cn(
                                    "w-4 shrink-0 text-left text-[10px] font-medium tabular-nums",
                                    screen === s.id ? "text-blue-200" : "text-slate-500",
                                  )}
                                >
                                  {s.num}
                                </span>
                                <span className="truncate">{s.shortTitle}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                }

                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (m.screen) goScreen(m.screen);
                        else onPreviewModule?.(m.id);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                        isActive ? "bg-primary text-white" : "text-slate-300 hover:bg-navy-800/70 hover:text-white",
                        collapsed && "justify-center px-0",
                      )}
                      title={collapsed ? m.label : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {!collapsed && <span className="flex-1 text-left">{m.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={cn("border-t border-navy-700/60 px-4 py-3", collapsed && "px-2 text-center")}>
        {!collapsed ? (
          <p className="text-[10px] leading-relaxed text-slate-500">
            Qubit One Pvt Ltd
            <br />
            Phase 1 · Enterprise Architecture
          </p>
        ) : (
          <span className="text-[10px] text-slate-500">v1.0</span>
        )}
      </div>
    </div>
  );
}

export { QubitMark };
