"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { screensByModule } from "@/lib/qubit/screens";
import { useQubitNav } from "../nav-context";
import { useRole, VIEW_AS_ROLES } from "../role-context";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { navigate } = useQubitNav();
  const { setRole } = useRole();
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => {
    fn();
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search screens, modules and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Enterprise — Phase 1 screens">
          {screensByModule("enterprise").map((s) => (
            <CommandItem
              key={s.id}
              value={`${s.num} ${s.title} ${s.shortTitle}`}
              onSelect={() => run(() => navigate(s.id))}
              className="gap-3"
            >
              <span className="w-6 text-[10px] font-semibold tabular-nums text-slate-400">{s.num}</span>
              <span className="text-[13px] font-medium text-slate-800">{s.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Design System — Phase 2 screens">
          {screensByModule("design-system").map((s) => (
            <CommandItem
              key={s.id}
              value={`${s.num} ${s.title} ${s.shortTitle} design system`}
              onSelect={() => run(() => navigate(s.id))}
              className="gap-3"
            >
              <span className="w-6 text-[10px] font-semibold tabular-nums text-slate-400">{s.num}</span>
              <span className="text-[13px] font-medium text-slate-800">{s.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Security — Phase 3 screens">
          {screensByModule("security").map((s) => (
            <CommandItem
              key={s.id}
              value={`${s.num} ${s.title} ${s.shortTitle} security sign-in login mfa audit`}
              onSelect={() => run(() => navigate(s.id))}
              className="gap-3"
            >
              <span className="w-6 text-[10px] font-semibold tabular-nums text-slate-400">{s.num}</span>
              <span className="text-[13px] font-medium text-slate-800">{s.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          {VIEW_AS_ROLES.map((r) => (
            <CommandItem key={`role-${r.id}`} value={`preview as role ${r.label}`} onSelect={() => run(() => setRole(r.id))}>
              <span className="text-[13px]">Preview as {r.label}</span>
            </CommandItem>
          ))}
          <CommandItem value="toggle sidebar" onSelect={() => run(() => router.refresh())}>
            <span className="text-[13px]">Refresh view</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
