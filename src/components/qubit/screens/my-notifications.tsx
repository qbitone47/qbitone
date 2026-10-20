"use client";

import * as React from "react";
import { Bell, BellOff, CheckCheck, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  relTime,
  type NotificationCategory,
  type WorkspaceNotification,
} from "@/lib/qubit/workspace-data";
import { apiGet } from "@/lib/qubit/api";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { CategoryIcon } from "../workspace/parts";
import { EmptyState, SectionCard } from "../primitives";
import { SearchInput } from "../primitives";
import { FormDialog } from "../dialogs";

// ============================================================
// Screen 48 · My Notifications — the personal notification
// center. Every notification deep-links into the SAME operating
// system (approval → approvals, task → tasks, security →
// security center). Channels connect to the Notification Rules
// architecture — no second notification system here.
// ============================================================

const CATEGORIES: NotificationCategory[] = ["Approvals", "Tasks", "Meetings", "Security", "HR", "Sales", "Finance", "Service", "System", "Collaboration"];

export function MyNotificationsScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const { toast } = useToast();

  const [items, setItems] = React.useState<WorkspaceNotification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<string>("all");
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [prefsOpen, setPrefsOpen] = React.useState(false);
  const [channels, setChannels] = React.useState({ inApp: true, email: true, push: false, digest: true });

  /** Phase 20 §16 — the feed comes from the ONE centralized notification
   *  store via /api/workspace/notifications (seed + live meeting
   *  invites/cancellations), the same server state the mobile
   *  notification screen reads. Read-state remains a local convenience
   *  overlay — the list itself is never faked. */
  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ notifications: WorkspaceNotification[]; unreadCount: number; note: string | null }>(
        "/notifications",
        undefined,
        role,
        "/api/workspace",
      );
      setItems(data.notifications);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, [role]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(() => {
    let list = items;
    if (category !== "all") list = list.filter((n) => n.category === category);
    if (unreadOnly) list = list.filter((n) => n.unread);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((n) => `${n.title} ${n.body} ${n.source}`.toLowerCase().includes(q));
    return list.slice().sort((a, b) => b.ts - a.ts);
  }, [items, category, unreadOnly, search]);

  const unreadCount = items.filter((n) => n.unread).length;

  const markRead = (id: string, read = true) => setItems((ns) => ns.map((n) => (n.id === id ? { ...n, unread: !read } : n)));

  const markAllRead = () => {
    setItems((ns) => ns.map((n) => ({ ...n, unread: false })));
    toast({ title: "All notifications marked as read", description: `${unreadCount} item${unreadCount === 1 ? "" : "s"} cleared from your unread list.` });
  };

  const openNotification = (n: WorkspaceNotification) => {
    markRead(n.id);
    if (n.link) nav.navigate(n.link.screen, n.link.params);
  };

  const countsByCategory = (c: NotificationCategory) => items.filter((n) => n.category === c && n.unread).length;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Workspace" }, { label: "Notifications" }]}
        title="My Notifications"
        description="One notification center for the whole operating system — each item links to the object it is about, delivered through the channels your rules define."
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => void load()} disabled={loading} aria-label="Reload notifications">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Reload
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setPrefsOpen(true)}>
              <Settings2 className="h-3.5 w-3.5" aria-hidden /> Preferences
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={markAllRead} disabled={unreadCount === 0}>
              <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Mark all read
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search notifications…" className="w-full sm:w-72" ariaLabel="Search notifications" />
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by category">
          <FilterChip active={category === "all"} onClick={() => setCategory("all")} label={`All (${items.length})`} />
          {CATEGORIES.filter((c) => items.some((n) => n.category === c)).map((c) => (
            <FilterChip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
              label={`${c}${countsByCategory(c) > 0 ? ` · ${countsByCategory(c)}` : ""}`}
              dot={countsByCategory(c) > 0}
            />
          ))}
        </div>
        <Button
          variant={unreadOnly ? "secondary" : "outline"}
          size="sm"
          className="h-9 gap-1.5"
          aria-pressed={unreadOnly}
          onClick={() => setUnreadOnly((v) => !v)}
        >
          <BellOff className="h-3.5 w-3.5" aria-hidden /> Unread only
        </Button>
      </div>

      <SectionCard noPadding>
        {loading ? (
          <ul className="divide-y" aria-label="Loading notifications">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex gap-3 px-4 py-3.5 md:px-5">
                <span className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                <div className="min-w-0 flex-1 space-y-2 py-1">
                  <div className="h-3.5 w-2/5 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                </div>
              </li>
            ))}
          </ul>
        ) : error ? (
          <EmptyState
            icon={<BellOff />}
            title="Notifications could not be loaded"
            message={`${error} No list was fabricated — retry when ready.`}
            action={
              <Button size="sm" variant="outline" className="h-8" onClick={() => void load()}>
                Retry
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Bell />}
            title={unreadOnly ? "No unread notifications" : "No notifications match"}
            message={unreadOnly ? "You're all caught up. New approvals, tasks and alerts will appear here." : "Try clearing the search or choosing another category."}
            action={
              unreadOnly ? (
                <Button size="sm" variant="outline" className="h-8" onClick={() => setUnreadOnly(false)}>
                  Show everything
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y" aria-label="Notification list">
            {filtered.map((n) => (
              <li key={n.id} className={cn("relative", n.unread && "bg-blue-50/30")}>
                <div className="flex gap-3 px-4 py-3.5 md:px-5">
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      n.unread ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    <CategoryIcon category={n.category} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <button
                        type="button"
                        onClick={() => openNotification(n)}
                        className="min-w-0 flex-1 text-left"
                        aria-label={`${n.unread ? "Open" : "View"} notification: ${n.title}`}
                      >
                        <span className={cn("block text-[13.5px] leading-snug", n.unread ? "font-semibold text-slate-900" : "font-medium text-slate-700")}>
                          {n.title}
                        </span>
                      </button>
                      <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{relTime(n.ts)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-medium text-slate-500">{n.category}</span>
                      <span className="text-[10.5px] text-slate-400">{n.source}</span>
                      {n.priority === "High" && (
                        <span className="rounded border border-red-200 bg-red-50 px-1.5 py-px text-[10px] font-medium text-red-700">High priority</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {n.link && (
                        <Button size="sm" variant="outline" className="h-7 gap-1 px-2.5 text-xs" onClick={() => openNotification(n)}>
                          Open {labelFor(n.link.screen)}
                        </Button>
                      )}
                      {n.unread && (
                        <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-slate-500" onClick={() => markRead(n.id)}>
                          Mark as read
                        </Button>
                      )}
                    </div>
                  </div>
                  {n.unread && <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" title="Unread" />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Delivery channels follow the organization's Notification Rules architecture. Security alerts keep their own dedicated center (Security → Alerts) —
        this view mirrors what concerns you personally. Role boundary: <span className="font-medium text-slate-600">{role}</span>.
      </p>

      {/* Channel preferences */}
      <FormDialog
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        title="Notification preferences"
        description="Channels are enabled per the organization's Notification Rules. Turning a channel off here stops personal delivery — it never mutes system-required notices."
        submitLabel="Save preferences"
        onSubmit={() => {
          setPrefsOpen(false);
          toast({ title: "Preferences saved", description: "Your channel settings now follow the enterprise notification rules." });
        }}
      >
        <div className="space-y-1 divide-y">
          {(
            [
              { key: "inApp", label: "In-app notifications", hint: "Always recommended — the center you are using right now." },
              { key: "email", label: "Email", hint: "To sagar.singh@qubitone.in" },
              { key: "push", label: "Mobile push", hint: "Qubit One mobile app · iOS & Android" },
              { key: "digest", label: "Daily digest", hint: "One summary mail at 08:30 IST on working days" },
            ] as const
          ).map((ch) => (
            <div key={ch.key} className="flex items-center justify-between gap-4 py-3 first:pt-1 last:pb-0">
              <div className="min-w-0">
                <Label htmlFor={`pref-${ch.key}`} className="text-[13px] font-medium text-slate-800">
                  {ch.label}
                </Label>
                <p className="text-[11px] text-muted-foreground">{ch.hint}</p>
              </div>
              <Switch
                id={`pref-${ch.key}`}
                checked={channels[ch.key]}
                onCheckedChange={(v) => setChannels((c) => ({ ...c, [ch.key]: v }))}
                aria-label={ch.label}
              />
            </div>
          ))}
        </div>
      </FormDialog>
    </div>
  );
}

function labelFor(screen: string): string {
  const map: Record<string, string> = {
    "my-approvals": "approval",
    "my-tasks": "task",
    "my-meetings": "meeting",
    "my-documents": "document",
    "security-center": "security event",
    "sent-mail": "message",
  };
  return map[screen] ?? "in workspace";
}

function FilterChip({ active, onClick, label, dot }: { active: boolean; onClick: () => void; label: string; dot?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
        active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:text-slate-800",
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-hidden />}
      {label}
    </button>
  );
}

