"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCommandState } from "cmdk";
import {
  Building2,
  CalendarClock,
  ClipboardList,
  FileText,
  Loader2,
  Mail,
  ShieldCheck,
  Target,
  TrendingUp,
  User,
  type LucideIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { SCREENS, ScreenId, ScreenParams, screensByModule } from "@/lib/qubit/screens";
import { useQubitNav } from "../nav-context";
import { useRole, VIEW_AS_ROLES } from "../role-context";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { navigate } = useQubitNav();
  const { role, setRole } = useRole();
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
      <CommandInput placeholder="Search screens, records and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <RecordsSection onSelect={(screen, params) => run(() => navigate(screen, params))} />
        <CommandGroup heading="Sales — Phase 6 screens">
          {screensByModule("sales").map((s) => (
            <CommandItem
              key={s.id}
              value={`${s.num} ${s.title} ${s.shortTitle} sales lead customer opportunity pipeline forecast quotation order whatsapp visit expense`}
              onSelect={() => run(() => navigate(s.id))}
              className="gap-3"
            >
              <span className="w-6 text-[10px] font-semibold tabular-nums text-slate-400">{s.num}</span>
              <span className="text-[13px] font-medium text-slate-800">{s.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="CEO Command Center — Phase 5 screens">
          {screensByModule("executive").map((s) => (
            <CommandItem
              key={s.id}
              value={`${s.num} ${s.title} ${s.shortTitle} ceo executive command center revenue sales finance people marketing service inventory field alerts approvals ai kpi reports`}
              onSelect={() => run(() => navigate(s.id))}
              className="gap-3"
            >
              <span className="w-6 text-[10px] font-semibold tabular-nums text-slate-400">{s.num}</span>
              <span className="text-[13px] font-medium text-slate-800">{s.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
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
        <CommandGroup heading="Employee Workspace — Phase 4 screens">
          {screensByModule("workspace").map((s) => (
            <CommandItem
              key={s.id}
              value={`${s.num} ${s.title} ${s.shortTitle} workspace home tasks calendar approvals documents`}
              onSelect={() => run(() => navigate(s.id))}
              className="gap-3"
            >
              <span className="w-6 text-[10px] font-semibold tabular-nums text-slate-400">{s.num}</span>
              <span className="text-[13px] font-medium text-slate-800">{s.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="People & Mail — Phase 4 screens">
          {[...screensByModule("people"), ...screensByModule("mail")].map((s) => (
            <CommandItem
              key={s.id}
              value={`${s.num} ${s.title} ${s.shortTitle} people directory mail inbox compose sent search`}
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

// ============================================================
// Records — Phase 20 §17 global record search
// ============================================================
// Debounced (200 ms), abortable search over /api/search, which
// aggregates only AUTHORIZED enterprise records server-side. The
// existing screen/module/command results above are untouched —
// this section renders above them only once the query is ≥ 2 chars.
// ============================================================

type RecordType =
  | "lead" | "opportunity" | "customer" | "quotation" | "employee"
  | "task" | "meeting" | "mail" | "approval" | "document";

interface RecordItem {
  id: string;
  title: string;
  subtitle?: string;
  /** "" = no verified detail screen → rendered as a plain, non-navigable row. */
  screen: string;
  params?: ScreenParams;
}

interface RecordGroup {
  type: RecordType;
  label: string;
  items: RecordItem[];
  note?: string;
}

interface RecordSearchResponse {
  ok: true;
  q: string;
  groups: RecordGroup[];
  omitted: { type: RecordType; reason: string }[];
  tookMs: number;
}

type RecordSearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; groups: RecordGroup[] };

const RECORD_ICONS: Record<RecordType, LucideIcon> = {
  lead: Target,
  opportunity: TrendingUp,
  customer: Building2,
  quotation: FileText,
  employee: User,
  task: ClipboardList,
  meeting: CalendarClock,
  mail: Mail,
  approval: ShieldCheck,
  document: FileText,
};

// Same registry the screen results use — a screen id that is not in
// SCREENS can never be navigated to from a record row.
const SCREEN_IDS = new Set<string>(SCREENS.map((s) => s.id));

function RecordsSection({ onSelect }: { onSelect: (screen: ScreenId, params?: ScreenParams) => void }) {
  const search = useCommandState((state) => state.search);
  const { role } = useRole();
  const [state, setState] = React.useState<RecordSearchState>({ status: "idle" });
  const latestQuery = React.useRef("");
  const controllerRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const query = search.trim();
    // Every keystroke aborts the in-flight request — a newer query owns the UI.
    if (controllerRef.current) controllerRef.current.abort();
    if (query.length < 2) {
      latestQuery.current = "";
      setState({ status: "idle" });
      return;
    }
    latestQuery.current = query;
    setState({ status: "loading" });
    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
            headers: { "X-Qubit-Role": role }, // demo boundary hint; production derives role from the session
            cache: "no-store",
            signal: controller.signal,
          });
          const data = (await res.json()) as RecordSearchResponse | { ok?: false };
          // Stale-response guard: only the latest query may render results.
          if (controller.signal.aborted || latestQuery.current !== query) return;
          if (!res.ok || !data || data.ok !== true) {
            setState({ status: "error" });
            return;
          }
          setState({ status: "done", groups: data.groups });
        } catch {
          if (controller.signal.aborted || latestQuery.current !== query) return; // superseded keystroke
          setState({ status: "error" });
        }
      })();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, role]);

  // Abort on unmount so a closed palette never completes a fetch.
  React.useEffect(() => () => controllerRef.current?.abort(), []);

  if (search.trim().length < 2) return null;

  if (state.status === "loading") {
    return (
      <>
        <CommandGroup heading="Records">
          <CommandItem disabled value="records-searching" className="gap-3">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden />
            <span className="text-[13px] text-slate-500">Searching records…</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
      </>
    );
  }

  if (state.status === "error") {
    return (
      <>
        <CommandGroup heading="Records">
          <CommandItem disabled value="records-error" className="gap-3">
            <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span className="text-[13px] text-slate-500">Record search unavailable — screen results still apply.</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
      </>
    );
  }

  if (state.status !== "done" || state.groups.length === 0) return null;

  return (
    <>
      {state.groups.map((group) => {
        const Icon = RECORD_ICONS[group.type] ?? FileText;
        return (
          <React.Fragment key={group.type}>
            <CommandGroup heading={`Records · ${group.label}`}>
              {group.items.map((item) => {
                const navigable = item.screen !== "" && SCREEN_IDS.has(item.screen);
                if (!navigable) {
                  // Honest non-navigable row: still informative, never a broken link.
                  return (
                    <div key={item.id} className="flex items-center gap-3 rounded-sm px-2 py-1.5 text-sm">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-slate-800">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[item.subtitle, group.label].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </div>
                  );
                }
                return (
                  <CommandItem
                    key={item.id}
                    value={`${group.type}-${item.id} ${item.title} ${item.subtitle ?? ""}`}
                    onSelect={() => onSelect(item.screen as ScreenId, item.params)}
                    className="gap-3"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-800">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[item.subtitle, group.label].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
              {group.note && (
                <div className="px-2 pb-1 pt-0.5 text-[11px] leading-snug text-slate-400">{group.note}</div>
              )}
            </CommandGroup>
            <CommandSeparator />
          </React.Fragment>
        );
      })}
    </>
  );
}
