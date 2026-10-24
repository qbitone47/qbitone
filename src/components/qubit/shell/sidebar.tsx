"use client";

import * as React from "react";
import {
  Activity,
  BarChart3,
  Building2,
  ChevronRight,
  Crown,
  FolderClosed,
  House,
  LayoutList,
  Mail,
  Megaphone,
  Package,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  ServerCog,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  Video,
  Wallet,
  Wrench,
  Radar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { screensByModule, type ScreenId, type ScreenModule } from "@/lib/qubit/screens";
import { useQubitNav } from "../nav-context";

export interface SidebarModule {
  id: string;
  label: string;
  icon: React.ElementType;
  section: string;
  screen?: ScreenId; // present = navigable directly
  expandableModule?: ScreenModule; // present = collapsible numbered submenu
}

export const SIDEBAR_MODULES: SidebarModule[] = [
  { id: "executive", label: "CEO Command Center", icon: Crown, section: "Workspace", expandableModule: "executive" },
  { id: "home", label: "Home", icon: House, section: "Workspace", screen: "employee-home" },
  { id: "workspace", label: "Workspace", icon: LayoutList, section: "Workspace", expandableModule: "workspace" },
  { id: "mobile", label: "Mobile", icon: Smartphone, section: "Workspace", expandableModule: "mobile" },
  { id: "enterprise", label: "Enterprise", icon: Building2, section: "Workspace", expandableModule: "enterprise" },
  { id: "people", label: "People", icon: UserRound, section: "Workspace", expandableModule: "people" },
  { id: "sales", label: "Sales", icon: TrendingUp, section: "Business", expandableModule: "sales" },
  { id: "finance", label: "Finance", icon: Wallet, section: "Business", screen: "finance-analytics" },
  { id: "hr", label: "HR & People", icon: Users, section: "Business", screen: "hr-analytics" },
  { id: "inventory", label: "Inventory", icon: Package, section: "Business", screen: "inventory-analytics" },
  { id: "marketing", label: "Marketing", icon: Megaphone, section: "Business", screen: "marketing-analytics" },
  { id: "service", label: "Service", icon: Wrench, section: "Business", screen: "service-analytics" },
  { id: "mail", label: "Mail", icon: Mail, section: "Communication", expandableModule: "mail" },
  { id: "meetings", label: "Meetings", icon: Video, section: "Intelligence", screen: "my-meetings" },
  { id: "ai", label: "Sales AI", icon: Sparkles, section: "Intelligence", expandableModule: "sales-ai" },
  { id: "analytics", label: "Analytics", icon: BarChart3, section: "Intelligence", expandableModule: "analytics" },
  { id: "documents", label: "Documents", icon: FolderClosed, section: "Intelligence", screen: "my-documents" },
  { id: "security", label: "Security", icon: ShieldCheck, section: "System", expandableModule: "security" },
  { id: "platform", label: "Platform Ops", icon: ServerCog, section: "System", expandableModule: "platform" },
  { id: "operations", label: "Operations", icon: Activity, section: "System", expandableModule: "operations" },
  { id: "observability", label: "Observability", icon: Radar, section: "System", expandableModule: "observability" },
  { id: "design-system", label: "Design System", icon: Palette, section: "System", expandableModule: "design-system" },
  { id: "settings", label: "Settings", icon: Settings2, section: "System" },
];

/** Human-facing module labels (display only — no internal phase/inventory numbering). */
export const MODULE_LABEL: Record<string, string> = {
  executive: "CEO Command Center",
  workspace: "Core Employee Workspace",
  people: "People & Organization",
  mail: "Company Mail",
  sales: "Sales Operating System",
  "sales-ai": "Sales AI",
  finance: "Finance",
  hr: "HR & People",
  inventory: "Inventory",
  marketing: "Marketing",
  service: "Service",
  meetings: "Meetings & Collaboration",
  ai: "Qubit AI Platform",
  analytics: "Analytics & Audit",
  mobile: "Mobile Experience",
  platform: "Enterprise Hardening",
  operations: "Production Hardening",
  observability: "Observability & SRE",
  documents: "Documents & Knowledge",
  "design-system": "Enterprise Design System",
  security: "Authentication & Security",
  settings: "Administration & Settings",
};

function QubitMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-b from-blue-500 to-blue-700 text-[15px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_1px_2px_rgba(37,99,235,0.35)]",
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
  // Executive module starts expanded (Phase 5); workspace starts collapsed.
  const [open, setOpen] = React.useState<Record<string, boolean>>({ executive: true, workspace: false, enterprise: false, people: false, mail: false, "design-system": false, security: false, sales: false, ai: false, analytics: false, mobile: false, platform: false, operations: false, observability: false });

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
    <div className="flex h-full flex-col bg-white">
      {/* Brand */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-200/80 px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <QubitMark />
        {!collapsed && (
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold leading-tight tracking-tight text-slate-900">Qubit One</span>
            <span className="block text-[10.5px] leading-tight text-slate-400">Enterprise OS</span>
          </span>
        )}
        {!collapsed && onToggleCollapse && (
          <button
            type="button"
            aria-label="Collapse sidebar"
            onClick={onToggleCollapse}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-600"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {collapsed && onToggleCollapse && (
        <div className="flex justify-center py-2.5">
          <button
            type="button"
            aria-label="Expand sidebar"
            onClick={onToggleCollapse}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-600"
          >
            <PanelLeftOpen className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav aria-label="Primary" className="qubit-scroll flex-1 overflow-y-auto px-3 pb-3 pt-3">
        {sections.map(([section, modules]) => (
          <div key={section} className="mb-4">
            {!collapsed && (
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{section}</p>
            )}
            <ul className="space-y-0.5">
              {modules.map((m) => {
                const Icon = m.icon;
                const isActive = m.screen ? m.screen === screen : false;
                const expandableScreens = m.expandableModule
                  ? screensByModule(m.expandableModule)
                  : [];
                const groupActive =
                  m.expandableModule != null && expandableScreens.some((s) => s.id === screen);
                const isOpen = m.expandableModule != null ? (open[m.id] ?? false) : false;

                if (m.expandableModule) {
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => (collapsed ? goScreen(expandableScreens[0].id) : setOpen((o) => ({ ...o, [m.id]: !(o[m.id] ?? false) })))}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-150",
                          groupActive
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
                          collapsed && "justify-center px-0",
                        )}
                        title={collapsed ? m.label : undefined}
                      >
                        <Icon
                          className={cn("h-[18px] w-[18px] shrink-0", groupActive ? "text-blue-600" : "text-slate-400")}
                          aria-hidden
                        />
                        {!collapsed && <span className="flex-1 text-left">{m.label}</span>}
                        {!collapsed && (
                          <svg
                            viewBox="0 0 12 12"
                            className={cn("h-3 w-3 text-slate-400 transition-transform duration-150", isOpen && "rotate-90")}
                            aria-hidden
                          >
                            <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        )}
                      </button>
                      {!collapsed && isOpen && (
                        <ul className="mt-0.5 space-y-px" role="list">
                          {expandableScreens.map((s) => (
                            <li key={s.id}>
                              <button
                                type="button"
                                aria-current={screen === s.id ? "page" : undefined}
                                onClick={() => goScreen(s.id)}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-md py-1.5 pl-9 pr-2.5 text-[12.5px] transition-colors duration-150",
                                  screen === s.id
                                    ? "bg-blue-50 font-medium text-blue-700"
                                    : "text-slate-500 hover:bg-slate-100/70 hover:text-slate-800",
                                )}
                              >
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
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-150",
                        isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
                        collapsed && "justify-center px-0",
                      )}
                      title={collapsed ? m.label : undefined}
                    >
                      <Icon
                        className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-blue-600" : "text-slate-400")}
                        aria-hidden
                      />
                      {!collapsed && <span className="flex-1 text-left">{m.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer — org plan card */}
      <div className={cn("shrink-0 border-t border-slate-200/80 p-3", collapsed && "px-2")}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300">
            <QubitMark className="h-7 w-7 rounded-lg text-[13px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold leading-tight text-slate-900">Qubit One Pvt Ltd</span>
              <span className="block truncate text-[10.5px] leading-tight text-slate-400">
                Enterprise Business Operating System
              </span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
          </div>
        ) : (
          <div className="flex justify-center py-0.5" title="Qubit One Pvt Ltd — Enterprise Business Operating System">
            <QubitMark className="h-7 w-7 rounded-lg text-[13px]" />
          </div>
        )}
      </div>
    </div>
  );
}

export { QubitMark };
