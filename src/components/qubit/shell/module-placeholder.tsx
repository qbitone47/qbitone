"use client";

import * as React from "react";
import { CalendarDays, FolderOpen, LayoutList, Mail, Package, Sparkles, TrendingUp, Users, Video, Wallet, Wrench, House, Megaphone, Settings2, UserRound } from "lucide-react";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard } from "../primitives";
import { Button } from "@/components/ui/button";
import { useQubitNav } from "../nav-context";
import type { ScreenId } from "@/lib/qubit/screens";

const MODULE_ICONS: Record<string, React.ElementType> = {
  home: House,
  workspace: LayoutList,
  people: UserRound,
  mail: Mail,
  sales: TrendingUp,
  finance: Wallet,
  hr: Users,
  inventory: Package,
  marketing: Megaphone,
  service: Wrench,
  meetings: Video,
  ai: Sparkles,
  analytics: BarChartIcon,
  documents: FolderOpen,
  settings: Settings2,
};

function BarChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 15v2M12 9v8M17 5v12" />
    </svg>
  );
}

/** Honest landing for a sidebar module with no dedicated screens of its own:
 * it states where the module's capabilities are served today and links straight
 * to those real surfaces. No roadmap promises, no phase numbers. */
interface ModuleLanding {
  description: string;
  links: { label: string; detail: string; screen: ScreenId }[];
}

const MODULE_LANDINGS: Record<string, ModuleLanding> = {
  settings: {
    description:
      "Qubit One does not maintain a separate administration area. Every capability usually grouped under Settings is served today by the surface that already owns it — Enterprise for organization, roles, permissions, workflows, approvals and integrations; Security for your account security, sessions, policies and access requests; Platform Ops for backups, quality and monitoring. The most-used surfaces are linked below.",
    links: [
      { label: "Role Matrix", detail: "Enterprise — roles and permissions", screen: "role-matrix" },
      { label: "Approval Matrix", detail: "Enterprise — workflows and approvals", screen: "approval-matrix" },
      { label: "Security Center", detail: "Security — your factors, sessions and access requests", screen: "security-center" },
      { label: "Backup & Recovery", detail: "Platform Ops — backups and monitoring", screen: "backup-recovery" },
    ],
  },
};

export function ModulePlaceholder({ moduleId, moduleName }: { moduleId: string; moduleName: string }) {
  const Icon = MODULE_ICONS[moduleId] ?? Sparkles;
  const { navigate } = useQubitNav();
  const landing = MODULE_LANDINGS[moduleId];

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "System" }, { label: moduleName }]}
        title={moduleName}
        description={
          landing?.description ??
          `Qubit One has no dedicated ${moduleName} screens. The capabilities usually grouped under ${moduleName} are served today by the modules that own them — open them from the sidebar or the command palette.`
        }
      />
      {landing ? (
        <SectionCard
          title={`Where ${moduleName} capabilities live today`}
          description="Each link opens the existing surface that owns this capability."
        >
          <ul className="divide-y divide-slate-100">
            {landing.links.map((link) => (
              <li key={link.screen} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-slate-900">{link.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{link.detail}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => navigate(link.screen)}>
                  Open
                  <span className="sr-only">{link.label}</span>
                </Button>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : (
        <SectionCard>
          <EmptyState
            icon={<Icon />}
            title={`${moduleName} is served by existing modules`}
            message={`Qubit One has no dedicated ${moduleName} screens — the capabilities this area would group already have a home. Use the sidebar or the command palette (⌘K) to open them.`}
          />
        </SectionCard>
      )}
    </div>
  );
}

// keep CalendarDays referenced for future module icons
void CalendarDays;
