"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  House,
  LifeBuoy,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { screenMeta, type ScreenModule } from "@/lib/qubit/screens";
import { shellNotifications } from "@/lib/qubit/data";
import { Avatar } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole, VIEW_AS_ROLES, type ViewAsRole } from "../role-context";
import { QubitMark } from "./sidebar";

const MODULE_LABELS: Record<ScreenModule, string> = {
  enterprise: "Enterprise",
  "design-system": "Design System",
  security: "Security",
  workspace: "Workspace",
  people: "People",
  mail: "Mail",
};

export function TopBar({
  onOpenMobileNav,
  onOpenPalette,
  onPreviewModuleCleared,
}: {
  onOpenMobileNav: () => void;
  onOpenPalette: () => void;
  onPreviewModuleCleared?: () => void;
}) {
  const { screen, navigate, canBack, canForward, back, forward } = useQubitNav();
  const { role, setRole, isAdmin } = useRole();
  const { toast } = useToast();
  const meta = screenMeta(screen);
  const [notifications, setNotifications] = React.useState(shellNotifications);
  const unread = notifications.filter((n) => n.unread).length;

  const applyRole = (r: ViewAsRole) => {
    setRole(r);
    const info = VIEW_AS_ROLES.find((v) => v.id === r)!;
    toast({
      title: `Previewing as ${info.label}`,
      description: `${info.hint}. Governance actions adapt to this role boundary.`,
    });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white px-3 md:px-5">
      {/* Mobile nav */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 md:hidden"
        aria-label="Open navigation menu"
        onClick={onOpenMobileNav}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Back / forward */}
      <div className="hidden items-center gap-1.5 md:flex">
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

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
        <ol className="flex flex-nowrap items-center gap-1.5 text-[13px]">
          <li className="hidden items-center gap-1.5 sm:flex">
            <QubitMark className="h-5 w-5 rounded-md text-[10px]" />
            <span className="font-medium text-slate-500">Qubit One</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden />
          </li>
          <li className="flex items-center gap-1">
            <button
              type="button"
              onClick={onPreviewModuleCleared}
              className="hidden rounded px-1 py-0.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 min-[480px]:block"
            >
              {MODULE_LABELS[meta.module] ?? "Enterprise"}
            </button>
            <ChevronRight className="hidden h-3.5 w-3.5 text-slate-300 min-[480px]:block" aria-hidden />
            <span aria-current="page" className="truncate px-1 py-0.5 font-medium text-slate-800">
              {meta.num}. {meta.title}
            </span>
          </li>
        </ol>
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">
        {/* Global search / command */}
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Search anything (Command palette)"
          className="hidden h-10 items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50/80 pl-4 pr-2.5 text-sm text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 lg:flex lg:w-72 xl:w-80"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1 text-left">Search anything…</span>
          <span className="qubit-kbd">⌘ K</span>
        </button>
        <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" aria-label="Search" onClick={onOpenPalette}>
          <Search className="h-4.5 w-4.5" />
        </Button>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label={`Notifications (${unread} unread)`}>
              <Bell className="h-4.5 w-4.5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white">
                  {unread}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96 p-0">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              <button
                type="button"
                onClick={() => setNotifications((ns) => ns.map((n) => ({ ...n, unread: false })))}
                className="text-xs font-medium text-navy-600 hover:text-navy-800"
              >
                Mark all as read
              </button>
            </div>
            <ul className="max-h-80 overflow-y-auto qubit-scroll">
              {notifications.map((n) => (
                <li key={n.id} className={cn("flex gap-3 border-b px-4 py-3 last:border-0", n.unread && "bg-blue-50/40")}>
                  <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.unread ? "bg-blue-600" : "bg-transparent")} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-900">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      {n.module} · {n.time}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t px-4 py-2">
              <button
                type="button"
                onClick={() => navigate("my-notifications")}
                className="block w-full text-center text-[11px] font-medium text-navy-600 transition-colors hover:text-navy-800"
              >
                Open notification center →
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Help */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Help">
              <CircleHelp className="h-4.5 w-4.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2">
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Help & resources</p>
            {[
              { icon: BookOpen, label: "Qubit One Handbook", hint: "Governance playbooks" },
              { icon: ShieldCheck, label: "Access & security policy", hint: "RBAC guidelines" },
              { icon: LifeBuoy, label: "Contact IT support", hint: "Internal ticket · SLA 4h" },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() =>
                  toast({ title: item.label, description: "Opens in the Documents module (Phase 14)." })
                }
                className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-slate-50"
              >
                <item.icon className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden />
                <span>
                  <span className="block text-[13px] font-medium text-slate-800">{item.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{item.hint}</span>
                </span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="mx-1 hidden h-7 sm:block" />

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-1.5 transition-colors hover:bg-slate-100"
              aria-label="User menu"
            >
              <Avatar name="Sagar Singh" size="sm" />
              <span className="hidden text-left md:block">
                <span className="block text-[13px] font-medium leading-tight text-slate-800">Sagar Singh</span>
                <span className="block text-[11px] leading-tight text-muted-foreground">Administrator</span>
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 md:block" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="flex items-center gap-2.5 py-1">
                <Avatar name="Sagar Singh" size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">Sagar Singh</p>
                  <p className="truncate text-xs text-muted-foreground">sagar.singh@qubitone.in</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                <Check className="h-3 w-3" aria-hidden /> Signed in as Administrator
              </p>
            </div>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <UserRound className="h-4 w-4 text-slate-400" />
                <span>Preview as role</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="w-60">
                  {VIEW_AS_ROLES.map((r) => (
                    <DropdownMenuItem
                      key={r.id}
                      onClick={() => applyRole(r.id)}
                      className="items-start gap-2"
                      disabled={r.id === role}
                    >
                      <span className="mt-1 flex h-3.5 w-3.5 items-center justify-center">
                        {r.id === role && <Check className="h-3.5 w-3.5 text-navy-700" />}
                      </span>
                      <span>
                        <span className="block text-[13px] font-medium">{r.label}</span>
                        <span className="block text-[11px] text-muted-foreground">{r.hint}</span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2"
              onClick={() => navigate("my-profile")}
            >
              <UserRound className="h-4 w-4 text-slate-400" /> My profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2"
              onClick={() => navigate("employee-home")}
            >
              <House className="h-4 w-4 text-slate-400" /> Employee Home
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-red-600 focus:text-red-700"
              onClick={() => navigate("login")}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
