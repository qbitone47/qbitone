"use client";

import * as React from "react";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { toast } from "@/hooks/use-toast";
import {
  MobileBadge,
  MobileEmpty,
  MobileErrorBanner,
  MobileFrame,
  MobileSection,
  MobileSkeleton,
  MobileRow,
  FilterChips,
  SourceNote,
  mobilePost,
  useMobileSection,
} from "../mobile/parts";

// ============================================================
// Screen 295 · Mobile Notifications — the centralized notification
// engine on mobile. Categories, unread state (tracked server-side
// so mobile and desktop stay in step) and deep links into the SAME
// operating system (spec §16).
// ============================================================

interface NotifItem {
  id: string; title: string; body: string; category: string; ts: number;
  unread: boolean; priority: string; source: string;
  link: { screen: string; params?: Record<string, string> } | null;
}
interface Payload {
  items: NotifItem[];
  categories: string[];
  unreadCount: number;
  sourceNote: string;
}

const fmtDT = (ts: number) => new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export function MobileNotificationsScreen() {
  const nav = useQubitNav();
  const { role } = useRole();
  const [category, setCategory] = React.useState("All");
  const { data, loading, error, reload } = useMobileSection<Payload>("notifications", { category: category === "All" ? undefined : category });
  const [busy, setBusy] = React.useState(false);

  const markAll = async () => {
    setBusy(true);
    try {
      await mobilePost("notification.readall", {}, role);
      toast({ title: "All notifications marked read" });
      reload();
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const open = async (n: NotifItem) => {
    try {
      if (n.unread) await mobilePost("notification.read", { id: n.id }, role);
    } catch {
      /* read-state failure should not block navigation */
    }
    if (n.link?.screen) nav.navigate(n.link.screen as never, n.link.params as never);
    else reload();
  };

  return (
    <MobileFrame
      title="Notifications"
      activeTab="home"
      right={
        <button type="button" onClick={markAll} disabled={busy || !data || data.unreadCount === 0}
          className="min-h-[44px] rounded-lg px-2 text-[12px] font-medium text-blue-700 disabled:opacity-40">
          Mark all read
        </button>
      }
    >
      {loading && <MobileSkeleton rows={4} />}
      {error && !loading && <MobileErrorBanner message={error} onRetry={reload} />}
      {data && !loading && (
        <>
          <FilterChips options={data.categories} value={category} onChange={setCategory} />
          <MobileSection title={category === "Unread" ? `Unread (${data.unreadCount})` : `${data.items.length} notification(s)`}>
            {data.items.length ? (
              data.items.map((n) => (
                <MobileRow
                  key={n.id}
                  title={n.title}
                  detail={n.body}
                  meta={`${n.category} · ${n.source} · ${fmtDT(n.ts)}`}
                  leading={
                    n.unread ? (
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />
                    ) : (
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-transparent" aria-hidden />
                    )
                  }
                  trailing={<MobileBadge tone={n.priority === "High" ? "red" : n.priority === "Medium" ? "amber" : "slate"}>{n.priority}</MobileBadge>}
                  onClick={() => open(n)}
                />
              ))
            ) : (
              <MobileEmpty title="Nothing here" detail="Notifications land here from every module — approvals, tasks, meetings, sales, service, HR and security." />
            )}
          </MobileSection>
          <SourceNote>{data.sourceNote}</SourceNote>
          <p className="px-3 pb-2 text-[10px] text-slate-300">Mobile Notifications</p>
        </>
      )}
    </MobileFrame>
  );
}
