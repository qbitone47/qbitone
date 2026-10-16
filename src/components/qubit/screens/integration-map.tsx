"use client";

import * as React from "react";
import {
  Activity,
  BarChart3,
  Boxes,
  CreditCard,
  Database,
  HardDrive,
  Mail,
  MessageSquare,
  Plus,
  Radio,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { integrations, type ConnectionStatus, type Integration } from "@/lib/qubit/data";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { KV, ReadOnlyBanner, SectionCard, StatusBadge } from "../primitives";
import { DetailDrawer } from "../drawers";
import { Field, FormDialog } from "../dialogs";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Communication: MessageSquare,
  Productivity: Mail,
  Finance: CreditCard,
  "Core Business": Database,
  Intelligence: Sparkles,
  Infrastructure: HardDrive,
  Analytics: BarChart3,
};

const STATUS_STROKE: Record<ConnectionStatus, { stroke: string; dash?: string }> = {
  Connected: { stroke: "#CBD5E1" },
  Warning: { stroke: "#F59E0B", dash: "6 4" },
  Disconnected: { stroke: "#EF4444", dash: "6 4" },
  "Configuration Required": { stroke: "#A78BFA", dash: "3 4" },
};

const FILTERS: { id: string; label: string; match: (s: ConnectionStatus) => boolean }[] = [
  { id: "all", label: "All integrations", match: () => true },
  { id: "connected", label: "Connected", match: (s) => s === "Connected" },
  { id: "warning", label: "Warning", match: (s) => s === "Warning" },
  { id: "disconnected", label: "Disconnected", match: (s) => s === "Disconnected" },
  { id: "config", label: "Configuration Required", match: (s) => s === "Configuration Required" },
];

interface Line {
  x1: number; y1: number; x2: number; y2: number;
  horizontal: boolean;
  status: ConnectionStatus;
}

function IntegrationCard({
  integration,
  onClick,
  cardRef,
  className,
}: {
  integration: Integration;
  onClick: () => void;
  cardRef?: (el: HTMLButtonElement | null) => void;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[integration.category] ?? Boxes;
  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-navy-300 hover:shadow-[0_2px_6px_rgba(15,23,42,0.08)]",
        integration.status === "Warning" && "border-amber-200",
        integration.status === "Configuration Required" && "border-violet-200",
        integration.status === "Disconnected" && "opacity-75",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-900">{integration.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{integration.provider}</p>
          </div>
        </div>
        <span
          aria-hidden
          className={cn(
            "mt-1 h-2 w-2 shrink-0 rounded-full",
            integration.status === "Connected" && "bg-emerald-500",
            integration.status === "Warning" && "bg-amber-500",
            integration.status === "Disconnected" && "bg-red-500",
            integration.status === "Configuration Required" && "bg-violet-500",
          )}
        />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <StatusBadge status={integration.status} size="sm" />
        <span className="inline-flex items-center gap-1" title="Data direction">
          <Radio className="h-3 w-3" aria-hidden />
          {integration.dataDirection === "Bidirectional" ? "Two-way" : integration.dataDirection}
        </span>
        <span className="hidden sm:inline">Sync: {integration.lastSync}</span>
      </div>
    </button>
  );
}

export function IntegrationMapScreen() {
  const { can } = useRole();
  const { toast } = useToast();
  const canManage = can("integrations.manage");

  const [filter, setFilter] = React.useState("all");
  const [detail, setDetail] = React.useState<Integration | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const hubRef = React.useRef<HTMLDivElement>(null);
  const analyticsRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const [lines, setLines] = React.useState<Line[]>([]);

  const active = FILTERS.find((f) => f.id === filter)!;
  const shown = React.useMemo(() => integrations.filter((i) => active.match(i.status)), [active]);
  const sideCards = React.useMemo(() => shown.filter((i) => i.id !== "int-analytics"), [shown]);
  const leftCards = React.useMemo(() => sideCards.slice(0, Math.ceil(sideCards.length / 2)), [sideCards]);
  const rightCards = React.useMemo(() => sideCards.slice(Math.ceil(sideCards.length / 2)), [sideCards]);
  const analytics = React.useMemo(() => shown.find((i) => i.id === "int-analytics"), [shown]);

  const measure = React.useCallback(() => {
    const container = containerRef.current;
    const hub = hubRef.current;
    if (!container || !hub) return;
    const c = container.getBoundingClientRect();
    const h = hub.getBoundingClientRect();
    const hubL = { x: h.left - c.left, y: h.top - c.top + h.height / 2 };
    const hubR = { x: h.right - c.left, y: h.top - c.top + h.height / 2 };
    const hubB = { x: h.left - c.left + h.width / 2, y: h.bottom - c.top };
    const next: Line[] = [];

    const sideAnchor = (el: HTMLButtonElement, side: "left" | "right") => {
      const r = el.getBoundingClientRect();
      return side === "left"
        ? { x: r.right - c.left, y: r.top - c.top + r.height / 2 }
        : { x: r.left - c.left, y: r.top - c.top + r.height / 2 };
    };

    for (const [, el] of cardRefs.current) {
      const id = el.dataset.intId;
      if (!id) continue;
      const integration = integrations.find((i) => i.id === id);
      if (!integration || !shown.some((s) => s.id === id)) continue;
      const isLeft = leftCards.some((l) => l.id === id);
      const a = sideAnchor(el, isLeft ? "left" : "right");
      const hubPt = isLeft ? hubL : hubR;
      next.push({ x1: a.x, y1: a.y, x2: hubPt.x, y2: hubPt.y, horizontal: true, status: integration.status });
    }
    if (analytics && analyticsRef.current) {
      const r = analyticsRef.current.getBoundingClientRect();
      const a = { x: r.left - c.left + r.width / 2, y: r.top - c.top };
      next.push({ x1: a.x, y1: a.y, x2: hubB.x, y2: hubB.y, horizontal: false, status: analytics.status });
    }
    setLines((prev) => {
      if (prev.length === next.length && JSON.stringify(prev) === JSON.stringify(next)) return prev;
      return next;
    });
  }, [leftCards, rightCards, analytics, shown]);

  React.useLayoutEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const counts = FILTERS.slice(1).map((f) => ({ label: f.label, n: integrations.filter((i) => f.match(i.status)).length }));
  const connectedAvg = Math.round(
    integrations.filter((i) => i.status === "Connected").reduce((a, i) => a + i.health, 0) /
      Math.max(1, integrations.filter((i) => i.status === "Connected").length),
  );

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Enterprise" }, { label: "11. Integration Map" }]}
        title="Integration Map"
        description="Central operational view of every system connected to Qubit One — connection health, synchronization and data flow."
        actions={
          canManage && (
            <Button size="sm" className="h-9" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add Integration
            </Button>
          )
        }
      />

      {!canManage && (
        <div className="mb-4">
          <ReadOnlyBanner message="Integration configuration requires an IT Administrator. You can view health and logs." />
        </div>
      )}

      {/* Status filter chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter integrations by status">
        {FILTERS.map((f) => {
          const n = f.id === "all" ? integrations.length : integrations.filter((i) => f.match(i.status)).length;
          const isActive = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isActive ? "border-navy-700 bg-navy-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              {f.label}
              <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Hub visualization (desktop) */}
      <div ref={containerRef} className="relative hidden lg:block">
        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" aria-hidden>
          {lines.map((l, i) => {
            const s = STATUS_STROKE[l.status];
            const midX = (l.x1 + l.x2) / 2;
            const midY = (l.y1 + l.y2) / 2;
            const d = l.horizontal
              ? `M ${l.x1} ${l.y1} C ${midX} ${l.y1}, ${midX} ${l.y2}, ${l.x2} ${l.y2}`
              : `M ${l.x1} ${l.y1} C ${l.x1} ${midY}, ${l.x2} ${midY}, ${l.x2} ${l.y2}`;
            return <path key={i} d={d} fill="none" stroke={s.stroke} strokeWidth="1.5" strokeDasharray={s.dash} opacity={0.9} />;
          })}
        </svg>

        <div className="relative z-10 grid grid-cols-[1fr_300px_1fr] gap-8 py-2">
          <div className="flex flex-col gap-4">
            {leftCards.map((i) => (
              <IntegrationCard
                key={i.id}
                integration={i}
                cardRef={(el) => {
                  if (el) {
                    el.dataset.intId = i.id;
                    cardRefs.current.set(i.id, el);
                  } else cardRefs.current.delete(i.id);
                }}
                onClick={() => setDetail(i)}
              />
            ))}
          </div>

          <div className="flex flex-col items-center justify-center gap-5">
            <div ref={hubRef} className="w-full rounded-xl border border-navy-200 bg-gradient-to-b from-navy-900 to-navy-950 p-5 text-center text-white shadow-lg">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-800 text-xl font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                Q
              </span>
              <p className="mt-3 text-[15px] font-semibold">Qubit One</p>
              <p className="text-[11px] text-slate-400">Enterprise Integration Core</p>
              <div className="mt-3 flex items-center justify-center gap-4 border-t border-white/10 pt-3 text-[11px] text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <Boxes className="h-3 w-3" aria-hidden /> {integrations.length} systems
                </span>
                <span className="inline-flex items-center gap-1">
                  <Activity className="h-3 w-3" aria-hidden /> {connectedAvg}% avg health
                </span>
              </div>
            </div>
            {analytics && (
              <div ref={analyticsRef} className="w-full">
                <IntegrationCard integration={analytics} onClick={() => setDetail(analytics)} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {rightCards.map((i) => (
              <IntegrationCard
                key={i.id}
                integration={i}
                cardRef={(el) => {
                  if (el) {
                    el.dataset.intId = i.id;
                    cardRefs.current.set(i.id, el);
                  } else cardRefs.current.delete(i.id);
                }}
                onClick={() => setDetail(i)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile / tablet grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
        {shown.map((i) => (
          <IntegrationCard key={i.id} integration={i} onClick={() => setDetail(i)} />
        ))}
        {shown.length === 0 && (
          <p className="col-span-full rounded-lg border bg-white px-6 py-10 text-center text-sm text-muted-foreground">
            No integrations with this status.
          </p>
        )}
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Line style indicates health: solid = healthy, dashed amber = degraded, dashed violet = configuration pending.
        Click any system for details, logs and actions.
      </p>

      {/* Detail drawer */}
      <DetailDrawer
        wide
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail?.name ?? ""}
        subtitle={detail ? `${detail.provider} · ${detail.category}` : undefined}
        icon={detail ? (() => { const I = CATEGORY_ICONS[detail.category] ?? Boxes; return <I />; })() : undefined}
        footer={
          detail && (
            <div className="flex flex-wrap gap-2">
              {canManage && (
                <Button size="sm" variant="outline" className="h-8" onClick={() => toast({ title: "Configuration", description: `Opens the configuration workspace for ${detail.name}.` })}>
                  Configure
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-8" onClick={() => toast({ title: "Integration logs", description: "Full logs are available in Audit (Phase 16)." })}>
                View logs
              </Button>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() =>
                    detail.status === "Connected"
                      ? toast({ title: "Connection test passed", description: `${detail.name} responded in ${detail.latency}.` })
                      : toast({ title: "Connection test failed", description: `${detail.apiStatus}. Check credentials and network policy.` })
                  }
                >
                  Test connection
                </Button>
              )}
            </div>
          )
        }
      >
        {detail && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} />
              <span className="rounded border bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">{detail.environment}</span>
              <span className="text-xs text-muted-foreground">Health {detail.health}%</span>
            </div>
            <p className="mb-4 text-sm text-slate-600">{detail.description}</p>
            <dl className="divide-y">
              <KV label="API status">{detail.apiStatus}</KV>
              <KV label="Last synchronization">{detail.lastSync}</KV>
              <KV label="Data direction">{detail.dataDirection}</KV>
              <KV label="Latency">{detail.latency}</KV>
              <KV label="Scopes">
                <span className="flex flex-wrap gap-1.5">
                  {detail.scopes.map((s) => (
                    <span key={s} className="rounded-full border bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">{s}</span>
                  ))}
                </span>
              </KV>
            </dl>
            <div className="mt-5 border-t pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</p>
              <ul className="space-y-2.5">
                {detail.logs.map((l, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs">
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        l.level === "info" && "bg-slate-400",
                        l.level === "warn" && "bg-amber-500",
                        l.level === "error" && "bg-red-500",
                      )}
                    />
                    <span>
                      <span className="block text-slate-700">{l.event}</span>
                      <span className="block text-[11px] text-slate-400">{l.time} · {l.level}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </DetailDrawer>

      {/* Add integration */}
      <FormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Integration"
        description="New integrations start in Configuration Required until credentials are verified."
        submitLabel="Create integration"
        onSubmit={() => {
          toast({ title: "Integration created", description: "It appears on the map once configuration is complete." });
          setAddOpen(false);
        }}
      >
        <Field label="System name" required>
          <Input placeholder="e.g. Salesforce CRM" />
        </Field>
        <Field label="Provider" required>
          <Input placeholder="e.g. Salesforce" />
        </Field>
        <Field label="Category" required>
          <Select defaultValue="Communication">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(CATEGORY_ICONS).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormDialog>
    </div>
  );
}
