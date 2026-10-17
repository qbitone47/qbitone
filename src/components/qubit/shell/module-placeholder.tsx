"use client";

import * as React from "react";
import { CalendarDays, FolderOpen, LayoutList, Mail, Package, Sparkles, TrendingUp, Users, Video, Wallet, Wrench, House, Megaphone, Settings2, UserRound } from "lucide-react";
import { PageHeader } from "../page-header";
import { EmptyState, SectionCard } from "../primitives";
import { MODULE_PHASE } from "./sidebar";

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

/** Quiet, honest state for modules that arrive in later phases. */
export function ModulePlaceholder({ moduleId, moduleName }: { moduleId: string; moduleName: string }) {
  const Icon = MODULE_ICONS[moduleId] ?? Sparkles;
  const phase = MODULE_PHASE[moduleId] ?? "A later phase";
  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Enterprise" }, { label: moduleName }]}
        title={moduleName}
        description={`${moduleName} is part of the Qubit One roadmap and arrives in ${phase}. Phase 1 focuses on the enterprise architecture foundation.`}
      />
      <SectionCard>
        <EmptyState
          icon={<Icon />}
          title={`${moduleName} — coming in ${phase}`}
          message="This area is intentionally quiet in Phase 1. The enterprise foundation being built here — organization, roles, permissions, workflows, approvals and integrations — will power this module."
          action={
            <p className="max-w-md text-xs text-muted-foreground">
              Use the <span className="font-medium text-slate-700">Enterprise</span> module to explore the 12 Phase 1 screens.
            </p>
          }
        />
      </SectionCard>
    </div>
  );
}

// keep CalendarDays referenced for future module icons
void CalendarDays;
