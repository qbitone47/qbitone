"use client";

import * as React from "react";
import {
  AlarmClock,
  ArrowRightLeft,
  CalendarDays,
  FileText,
  Filter,
  GitBranch,
  History,
  ListChecks,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  RefreshCw,
  SearchX,
  StickyNote,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "../page-header";
import { EmptyState, FilterBar, SearchInput, SectionCard } from "../primitives";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import type { SalesContact, SalesVisit } from "@/lib/qubit/sales-data";
import { employees } from "@/lib/qubit/data";
import {
  AuditedHint,
  EntityLink,
  fmtDate,
  fmtDateTime,
  relTime,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  ScopeNote,
  useSalesSection,
  type SalesEntityScreen,
} from "../sales/parts";

// ============================================================
// Screen 91 · Customer Activity — one unified timeline across
// every customer touchpoint. The server resolves the scoped
// rows ({ rows, refs, scope }); this screen adds local filters
// (type chips, entity kind, summary search) and day grouping.
// Entity labels come from the server refs map; each entry gets
// a quiet "on <label>" chip linking to the owning record.
// WhatsApp/email bodies stay in their modules — only audited
// business events are shown here.
// ============================================================

interface ActivityRow {
  id: string;
  at: number;
  type: string;
  actorId: string;
  entity: { kind: "lead" | "account" | "contact" | "opportunity" | "quotation" | "order" | "visit"; id: string };
  summary: string;
  outcome?: string;
  source?: string;
}

interface ActivityRefs {
  accounts: Record<string, string>;
  opportunities: Record<string, string>;
  leads: Record<string, string>;
  quotations: Record<string, string>;
  orders: Record<string, string>;
}

interface ActivityPayload {
  rows: ActivityRow[];
  refs: ActivityRefs;
  scope: "company" | "team" | "own";
}
interface VisitsPayload {
  rows: SalesVisit[];
}
interface ContactsPayload {
  rows: SalesContact[];
}

/** Canonical chip order (server rows may contain a subset). */
const ALL_TYPES = [
  "Call",
  "Email",
  "WhatsApp",
  "Meeting",
  "Visit",
  "Note",
  "Task",
  "Follow-up",
  "Quotation",
  "Order",
  "Stage change",
  "Status change",
  "Lead assigned",
  "Conversion",
];

const KIND_OPTIONS = ["Lead", "Account", "Contact", "Opportunity", "Quotation", "Order", "Visit"];

const KIND_SCREEN: Record<string, SalesEntityScreen | undefined> = {
  lead: "lead-detail",
  account: "account-detail",
  opportunity: "opportunity-detail",
  quotation: "quotation-detail",
  order: "order-detail",
  visit: "visit-detail",
  // contact entries have no dedicated detail screen — chip omitted
};

// Same visual idiom as the shared ActivityTimeline (parts.tsx).
const TYPE_ICON: Record<string, React.ReactNode> = {
  Call: <Phone className="h-3.5 w-3.5" aria-hidden />,
  Email: <Mail className="h-3.5 w-3.5" aria-hidden />,
  WhatsApp: <MessageCircle className="h-3.5 w-3.5" aria-hidden />,
  Meeting: <CalendarDays className="h-3.5 w-3.5" aria-hidden />,
  Visit: <MapPin className="h-3.5 w-3.5" aria-hidden />,
  Note: <StickyNote className="h-3.5 w-3.5" aria-hidden />,
  Task: <ListChecks className="h-3.5 w-3.5" aria-hidden />,
  "Follow-up": <AlarmClock className="h-3.5 w-3.5" aria-hidden />,
  Quotation: <FileText className="h-3.5 w-3.5" aria-hidden />,
  Order: <Package className="h-3.5 w-3.5" aria-hidden />,
  "Stage change": <GitBranch className="h-3.5 w-3.5" aria-hidden />,
  "Status change": <RefreshCw className="h-3.5 w-3.5" aria-hidden />,
  "Lead assigned": <UserPlus className="h-3.5 w-3.5" aria-hidden />,
  Conversion: <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />,
};

const ACTIVITY_TONE: Record<string, string> = {
  Call: "bg-blue-50 text-blue-700",
  Email: "bg-violet-50 text-violet-700",
  WhatsApp: "bg-emerald-50 text-emerald-700",
  Meeting: "bg-cyan-50 text-cyan-700",
  Visit: "bg-amber-50 text-amber-700",
  Note: "bg-slate-100 text-slate-600",
  Task: "bg-slate-100 text-slate-600",
  "Follow-up": "bg-blue-50 text-blue-700",
  Quotation: "bg-violet-50 text-violet-700",
  Order: "bg-emerald-50 text-emerald-700",
  "Stage change": "bg-blue-50 text-blue-700",
  "Status change": "bg-slate-100 text-slate-600",
  "Lead assigned": "bg-blue-50 text-blue-700",
  Conversion: "bg-emerald-50 text-emerald-700",
};

const EMP_NAMES = new Map(employees.map((e) => [e.id, e.name] as const));

const DAY_MS = 86_400_000;
const dayKey = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function groupByDay(rows: ActivityRow[]): { key: number; label: string; rows: ActivityRow[] }[] {
  const today = dayKey(Date.now());
  const groups: { key: number; label: string; rows: ActivityRow[] }[] = [];
  for (const r of [...rows].sort((a, b) => b.at - a.at)) {
    const key = dayKey(r.at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.rows.push(r);
    } else {
      groups.push({
        key,
        label: key === today ? "Today" : key === today - DAY_MS ? "Yesterday" : fmtDate(r.at),
        rows: [r],
      });
    }
  }
  return groups;
}

/** Quiet trailing chip — "on <label>" — linking to the owning record. */
function EntityChip({ kind, id, label }: { kind: string; id: string; label: string }) {
  const screen = KIND_SCREEN[kind];
  if (!screen) return null;
  return (
    <span className="mt-1.5 inline-flex max-w-full items-center rounded-full border border-blue-100 bg-blue-50/60 py-0.5 pl-2 pr-1.5">
      <EntityLink
        screen={screen}
        id={id}
        kind={kind}
        label={<span className="truncate text-[11px] font-normal text-blue-700">on {label}</span>}
      />
    </span>
  );
}

/**
 * Local timeline renderer. Mirrors the shared ActivityTimeline markup
 * exactly, adding the per-entry entity chip — the shared component has
 * no per-entry link slot. Visual parity is kept class-for-class.
 */
function LinkedTimeline({
  entries,
  labelFor,
  actorName,
}: {
  entries: ActivityRow[];
  labelFor: (kind: string, id: string) => string | undefined;
  actorName: (id: string | undefined) => string | undefined;
}) {
  return (
    <ol className="relative space-y-0" aria-label="Activity timeline">
      {entries.map((e, i) => {
        const label = labelFor(e.entity.kind, e.entity.id);
        return (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < entries.length - 1 && (
              <span aria-hidden className="absolute bottom-0 left-[15px] top-8 w-px bg-slate-100" />
            )}
            <span
              className={cn(
                "qubit-icon-tile z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full [&_svg]:h-3.5 [&_svg]:w-3.5",
                ACTIVITY_TONE[e.type] ?? "bg-slate-100 text-slate-600",
              )}
            >
              {TYPE_ICON[e.type] ?? e.type.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13px] font-medium text-slate-800">{e.type}</span>
                <span className="text-[11px] text-slate-400">{relTime(e.at)}</span>
                {e.source && (
                  <span className="rounded border border-slate-200 bg-slate-50 px-1 py-px text-[10px] text-slate-500">
                    {e.source}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{e.summary}</p>
              {label && <EntityChip kind={e.entity.kind} id={e.entity.id} label={label} />}
              {e.outcome && (
                <p className="mt-1 text-xs text-slate-500">
                  <span className="font-medium text-slate-600">Outcome:</span> {e.outcome}
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-slate-400">
                {actorName(e.actorId) ?? "System"} · {fmtDateTime(e.at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function CustomerActivityScreen() {
  const { data, loading, error, reload } = useSalesSection<ActivityPayload>("activity");
  // Secondary loaders only enrich the timeline (visit chips, contact actor
  // names). They degrade quietly — the timeline never blocks on them.
  const visits = useSalesSection<VisitsPayload>("visits");
  const contacts = useSalesSection<ContactsPayload>("contacts");

  const [activeTypes, setActiveTypes] = React.useState<string[]>([]);
  const [kind, setKind] = React.useState("all");
  const [query, setQuery] = React.useState("");

  const rows = data?.rows ?? [];

  const types = React.useMemo(() => {
    const present = ALL_TYPES.filter((t) => rows.some((r) => r.type === t));
    const extra = Array.from(new Set(rows.map((r) => r.type))).filter((t) => !ALL_TYPES.includes(t));
    return [...present, ...extra];
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (activeTypes.length === 0 || activeTypes.includes(r.type)))
      .filter((r) => (kind === "all" || r.entity.kind === kind.toLowerCase()))
      .filter((r) => (!q || r.summary.toLowerCase().includes(q)))
      .sort((a, b) => b.at - a.at);
  }, [rows, activeTypes, kind, query]);

  const groups = React.useMemo(() => groupByDay(filtered), [filtered]);

  const contactNames = React.useMemo(
    () => new Map((contacts.data?.rows ?? []).map((c) => [c.id, c.name] as const)),
    [contacts.data],
  );

  const actorName = React.useCallback(
    (actorId: string | undefined): string | undefined => {
      if (!actorId) return undefined;
      if (EMP_NAMES.has(actorId)) return EMP_NAMES.get(actorId);
      const c = contactNames.get(actorId);
      if (c) return c;
      return actorId.startsWith("wa-") ? "Customer (WhatsApp)" : "Customer";
    },
    [contactNames],
  );

  const labelFor = React.useCallback(
    (entityKind: string, id: string): string | undefined => {
      const refs = data?.refs;
      if (!refs) return undefined;
      switch (entityKind) {
        case "account":
          return refs.accounts[id];
        case "opportunity":
          return refs.opportunities[id];
        case "lead":
          return refs.leads[id];
        case "quotation":
          return refs.quotations[id];
        case "order":
          return refs.orders[id];
        case "visit": {
          const v = (visits.data?.rows ?? []).find((x) => x.id === id);
          if (!v) return undefined;
          return v.purpose.length > 44 ? `${v.purpose.slice(0, 44)}…` : v.purpose;
        }
        default:
          return undefined;
      }
    },
    [data?.refs, visits.data],
  );

  const hasFilters = activeTypes.length > 0 || kind !== "all" || query.trim() !== "";
  const clearFilters = () => {
    setActiveTypes([]);
    setKind("all");
    setQuery("");
  };

  const toggleType = (t: string) =>
    setActiveTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <SalesGate screenName="Customer Activity">
      <div>
        <PageHeader
          crumbs={[{ label: "Sales" }, { label: "Customer Activity" }]}
          title="Customer Activity"
          description="One unified timeline across every customer touchpoint — calls, emails, WhatsApp, meetings, visits, notes, quotations, orders and status changes. Private communications stay within each viewer's authorization."
        />

        {error && <SalesErrorBanner message={error} onRetry={reload} />}
        {loading && <SalesSkeleton rows={4} />}

        {data && !loading && (
          <div className="space-y-4">
            {/* Filters — local refinement of already server-scoped rows */}
            <SectionCard
              title="Filter the timeline"
              description="Filters refine the loaded scope on this page — the server has already resolved what you can see."
            >
              <FilterBar
                left={
                  <Select value={kind} onValueChange={setKind}>
                    <SelectTrigger className="h-9 w-[172px]" aria-label="Filter by entity kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All entities</SelectItem>
                      {KIND_OPTIONS.map((k) => (
                        <SelectItem key={k} value={k.toLowerCase()}>
                          {k}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
                right={
                  hasFilters ? (
                    <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-slate-600" onClick={clearFilters}>
                      <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
                    </Button>
                  ) : undefined
                }
              >
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Search summaries…"
                  className="w-full sm:w-64"
                  ariaLabel="Search activity summaries"
                />
              </FilterBar>
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by activity type">
                {types.map((t) => {
                  const active = activeTypes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleType(t)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                        active
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-slate-400">
                {filtered.length} of {rows.length} events in view · day groups follow your device timezone.
              </p>
              <ScopeNote scope={data.scope} what="customer activity" />
            </SectionCard>

            {/* Grouped timeline */}
            <SectionCard
              title="Unified timeline"
              description="Newest first, grouped by day — every entry links back to the record it belongs to."
            >
              {rows.length === 0 ? (
                <EmptyState
                  icon={<History />}
                  title="No activity yet"
                  message="Calls, emails, WhatsApp messages, meetings, visits, quotations and order events will appear here once recorded."
                />
              ) : groups.length === 0 ? (
                <EmptyState
                  icon={<SearchX />}
                  title="No activity matches these filters"
                  message="Loosen the type, entity or search filters to see more of the timeline."
                  action={
                    <Button size="sm" variant="outline" onClick={clearFilters}>
                      <Filter className="h-3.5 w-3.5" aria-hidden /> Clear filters
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-6">
                  {groups.map((g) => (
                    <section key={g.key} aria-label={g.label}>
                      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        {g.label}
                      </h3>
                      <LinkedTimeline entries={g.rows} labelFor={labelFor} actorName={actorName} />
                    </section>
                  ))}
                </div>
              )}
              <AuditedHint>
                WhatsApp and email contents are visible here only as audited business events — message bodies stay in
                their modules and respect consent.
              </AuditedHint>
            </SectionCard>

            <SalesAsOf
              asOfLabel={SALES_PERIOD.asOfLabel}
              note="Rows are resolved and scoped server-side; entries without a dedicated screen (contacts) render without a link."
            />
          </div>
        )}

        {!loading && !data && !error && (
          <EmptyState
            icon={<History />}
            title="Customer Activity could not load"
            message="The sales service returned no data. Retry, or check the service status."
            action={
              <Button size="sm" onClick={reload}>
                Retry
              </Button>
            }
          />
        )}
      </div>
    </SalesGate>
  );
}
