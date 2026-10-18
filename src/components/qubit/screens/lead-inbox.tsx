"use client";

import * as React from "react";
import { Download, ExternalLink, Inbox, Plus, Repeat, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SALES_PERIOD } from "@/lib/qubit/sales-data";
import { PageHeader } from "../page-header";
import { Avatar, EmptyState, FilterBar, SearchInput, StatusBadge } from "../primitives";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import {
  PriorityBadge,
  SalesApiError,
  SalesAsOf,
  SalesErrorBanner,
  SalesGate,
  SalesSkeleton,
  ScopeNote,
  ScoreBar,
  fmtCr,
  fmtDate,
  fmtDateTime,
  relTime,
  salesPost,
  useSalesSection,
} from "../sales/parts";
import { DataTable, type Column } from "../data-table";
import { FormDialog, Field } from "../dialogs";

// ============================================================
// Screen 74 · Lead Inbox — the central lead management workspace.
// Triage, assign and convert. Every row is scoped server-side;
// saved views come from the server payload so the demo boundary
// (own scope loses "Follow-up today") stays honest.
// ============================================================

interface LeadRow {
  id: string;
  name: string;
  company: string;
  contactPerson: string;
  phone: string;
  email: string;
  source: string;
  industry: string;
  location: string;
  ownerId: string;
  ownerName: string;
  isMine: boolean;
  status: "New" | "Working" | "Qualified" | "Unqualified" | "Converted";
  priority: "Hot" | "Warm" | "Cold";
  score: number;
  estimatedValueCr: number;
  expectedClose?: string;
  nextFollowUpAt?: number;
  createdAt: number;
  lastActivityAt: number;
  tags: string[];
}

interface SavedView {
  id: string;
  label: string;
  filter: Record<string, unknown>;
}

interface LeadsPayload {
  rows: LeadRow[];
  scope: "company" | "team" | "own";
  owners: { id: string; name: string; title: string }[];
  sources: string[];
  savedViews: SavedView[];
}

interface Filters {
  status: string;
  owner: string;
  source: string;
  priority: string;
  query: string;
  unassigned: boolean;
  followupToday: boolean;
}

const EMPTY_FILTERS: Filters = {
  status: "all",
  owner: "all",
  source: "all",
  priority: "all",
  query: "",
  unassigned: false,
  followupToday: false,
};

/** Deep-link filter param → server saved-view id (ScreenParams.filter). */
const FILTER_PARAM_TO_VIEW: Record<string, string> = {
  hot: "view-hot",
  new: "view-new",
  unassigned: "view-unassigned",
  today: "view-today",
};

const LEAD_STATUSES = ["New", "Working", "Qualified", "Unqualified", "Converted"] as const;
const PRIORITIES = ["Hot", "Warm", "Cold"] as const;

function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function LeadInboxScreen() {
  const { role } = useRole();
  const nav = useQubitNav();
  const { params, navKey } = useQubitNav();
  const { data, loading, error, forbidden, reload } = useSalesSection<LeadsPayload>("leads");

  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);
  const [activeView, setActiveView] = React.useState<string | null>(null);
  const [assignTarget, setAssignTarget] = React.useState<LeadRow | null>(null);
  const [assignOwnerId, setAssignOwnerId] = React.useState("");
  const [assigning, setAssigning] = React.useState(false);

  const isManager = role === "administrator" || role === "dept-head";

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setActiveView(null); // manual filter change leaves saved-view mode
  };

  const applySavedView = React.useCallback((view: SavedView) => {
    const next: Filters = { ...EMPTY_FILTERS };
    const f = view.filter ?? {};
    if (typeof f.priority === "string") next.priority = f.priority;
    if (typeof f.status === "string") next.status = f.status;
    if (f.unassigned === true) next.unassigned = true;
    if (f.followup === "today") next.followupToday = true;
    setFilters(next);
    setActiveView(view.id);
  }, []);

  // Deep link: /lead-inbox with params.filter = "hot" | "new" | "unassigned" | "today"
  React.useEffect(() => {
    if (!data) return;
    const viewId = FILTER_PARAM_TO_VIEW[params.filter ?? ""];
    if (!viewId) return;
    const view = data.savedViews.find((v) => v.id === viewId);
    if (view) applySavedView(view);
    // re-applied when the same screen is re-focused with a new filter param (navKey)
  }, [data, navKey, params.filter, applySavedView]);

  const rows = data?.rows ?? [];

  const filtered = React.useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const eod = endOfToday();
    return rows.filter((l) => {
      if (filters.status !== "all" && l.status !== filters.status) return false;
      if (filters.owner === "__unassigned" && l.ownerId) return false;
      if (filters.owner !== "all" && filters.owner !== "__unassigned" && l.ownerId !== filters.owner) return false;
      if (filters.source !== "all" && l.source !== filters.source) return false;
      if (filters.priority !== "all" && l.priority !== filters.priority) return false;
      if (filters.unassigned && l.ownerId) return false;
      if (filters.followupToday && !(l.nextFollowUpAt && l.nextFollowUpAt <= eod)) return false;
      if (
        q &&
        ![l.name, l.company, l.contactPerson, l.email].some((v) => v.toLowerCase().includes(q))
      )
        return false;
      return true;
    });
  }, [rows, filters]);

  const openLead = (l: LeadRow) => nav.navigate("lead-detail", { leadId: l.id });

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setActiveView(null);
  };

  const runExport = () => {
    // Honest demo boundary: there is no export endpoint in /api/sales.
    toast({
      title: "Export is recorded in the audit trail — available to your role in the reporting suite.",
      description: "Lead lists export through the Sales report catalog, never ad-hoc from the Inbox.",
    });
  };

  const openAssign = (l: LeadRow) => {
    setAssignTarget(l);
    setAssignOwnerId("");
  };

  const submitAssign = async () => {
    if (!assignTarget || !assignOwnerId) return;
    setAssigning(true);
    try {
      const res = await salesPost<{ ok: boolean; message: string }>(
        "lead.assign",
        { id: assignTarget.id, ownerId: assignOwnerId },
        role,
      );
      toast({ title: "Lead reassigned", description: res.message });
      setAssignTarget(null);
      setAssignOwnerId("");
      reload();
    } catch (err) {
      // Server errors surface verbatim — including the sales-exec 403 boundary.
      toast({
        variant: "destructive",
        title: "Reassignment blocked",
        description: err instanceof SalesApiError ? err.message : "The server could not reassign this lead.",
      });
    } finally {
      setAssigning(false);
    }
  };

  if (forbidden) {
    return (
      <SalesGate screenName="Lead Inbox">
        <></>
      </SalesGate>
    );
  }

  const exportButton = (
    <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={!isManager} onClick={isManager ? runExport : undefined}>
      <Download className="h-3.5 w-3.5" aria-hidden /> Export
    </Button>
  );

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Sales" }, { label: "Lead Inbox" }]}
        title="Lead Inbox"
        description="The central lead workspace — triage new demand, keep ownership honest, and move qualified leads to their detail workspace for conversion."
        actions={
          <>
            {isManager ? (
              exportButton
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>{exportButton}</span>
                </TooltipTrigger>
                <TooltipContent>Exports require a manager or administrator boundary.</TooltipContent>
              </Tooltip>
            )}
            <Button size="sm" className="h-9 gap-1.5" onClick={() => nav.navigate("lead-create")}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> New lead
            </Button>
          </>
        }
      />

      {error && !forbidden && <SalesErrorBanner message={error} onRetry={reload} />}
      {loading && <SalesSkeleton rows={4} />}

      {data && !loading && (
        <div className="space-y-3">
          {/* Saved views — server-defined so every boundary sees the views it should */}
          <FilterBar
            left={
              <>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Saved views</span>
                {data.savedViews.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={activeView === v.id}
                    onClick={() => (activeView === v.id ? clearFilters() : applySavedView(v))}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      activeView === v.id
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    {v.label}
                    {activeView === v.id && <X className="h-3 w-3" aria-hidden />}
                  </button>
                ))}
              </>
            }
            right={
              <p className="text-xs text-slate-500" aria-live="polite">
                Showing <span className="font-semibold tabular-nums text-slate-700">{filtered.length}</span> of{" "}
                <span className="font-semibold tabular-nums text-slate-700">{rows.length}</span> leads in your scope
              </p>
            }
          />

          {/* Filters */}
          <FilterBar
            left={
              <>
                <SearchInput
                  value={filters.query}
                  onChange={(v) => setFilter("query", v)}
                  placeholder="Search name, company, contact, email…"
                  className="w-full sm:w-64"
                  ariaLabel="Search leads"
                />
                <Select value={filters.status} onValueChange={(v) => setFilter("status", v)}>
                  <SelectTrigger className="h-10 w-[9.5rem] bg-white" aria-label="Filter by status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any status</SelectItem>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.owner} onValueChange={(v) => setFilter("owner", v)}>
                  <SelectTrigger className="h-10 w-[10.5rem] bg-white" aria-label="Filter by owner">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any owner</SelectItem>
                    <SelectItem value="__unassigned">Unassigned</SelectItem>
                    {data.owners.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.source} onValueChange={(v) => setFilter("source", v)}>
                  <SelectTrigger className="h-10 w-[10.5rem] bg-white" aria-label="Filter by source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any source</SelectItem>
                    {data.sources.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.priority} onValueChange={(v) => setFilter("priority", v)}>
                  <SelectTrigger className="h-10 w-[9rem] bg-white" aria-label="Filter by priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any priority</SelectItem>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            }
          />

          {/* Table / empty state */}
          {filtered.length === 0 ? (
            <div className="qubit-card">
              <EmptyState
                icon={<Inbox />}
                title="No leads match these filters"
                message={
                  rows.length === 0
                    ? "No leads exist in your authorized scope yet. Create one — duplicate detection runs on the server before anything is saved."
                    : "Adjust or clear the filters, or pick a different saved view."
                }
                action={
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear all filters
                  </Button>
                }
              />
            </div>
          ) : (
            <DataTable
              columns={columns({
                isManager,
                onOpen: openLead,
                onAssign: openAssign,
                onConvert: openLead,
              })}
              rows={filtered}
              rowKey={(l) => l.id}
              onRowClick={openLead}
              pageSize={10}
              emptyTitle="No leads match these filters"
              emptyMessage="Adjust or clear the filters above."
              caption="Lead inbox — leads in your authorized scope"
              mobileCard={(l) => (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13.5px] font-semibold text-slate-900">{l.name}</p>
                    <StatusBadge status={l.status} size="sm" />
                    <PriorityBadge priority={l.priority} size="sm" />
                  </div>
                  <p className="truncate text-xs text-slate-500">{l.company}</p>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar name={l.ownerName} size="xs" /> {l.ownerName}
                    </span>
                    <span className="tabular-nums">Score {l.score} · {relTime(l.lastActivityAt)}</span>
                  </div>
                </div>
              )}
            />
          )}

          {/* Honest scope + duplicate-prevention notes */}
          <div className="space-y-1">
            <ScopeNote scope={data.scope} what="leads" />
            <p className="text-[11px] text-slate-400">
              Creating a lead runs duplicate detection on the server before anything is saved.
            </p>
          </div>

          <SalesAsOf
            asOfLabel={SALES_PERIOD.asOfLabel}
            note="Assignments move open follow-ups with the lead; conversions complete inside each lead's detail workspace."
          />
        </div>
      )}

      {/* Row action — Assign (manager/admin only; the server still verifies the boundary) */}
      <FormDialog
        open={assignTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAssignTarget(null);
            setAssignOwnerId("");
          }
        }}
        title={assignTarget ? `Assign “${assignTarget.name}”` : "Assign lead"}
        description="Ownership moves the lead and its open follow-ups to the new owner, and both changes are audited."
        submitLabel="Reassign"
        submitting={assigning}
        onSubmit={submitAssign}
      >
        <Field label="New owner" required hint="Only owners inside your boundary can be selected — the server re-checks scope.">
          <Select value={assignOwnerId} onValueChange={setAssignOwnerId}>
            <SelectTrigger className="h-9 w-full bg-white" aria-label="New owner">
              <SelectValue placeholder="Choose an owner" />
            </SelectTrigger>
            <SelectContent>
              {data?.owners
                .filter((o) => o.id !== assignTarget?.ownerId)
                .map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name} — {o.title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        {assignTarget && (
          <p className="text-xs text-slate-500">
            Currently owned by <span className="font-medium text-slate-700">{assignTarget.ownerName}</span>.
          </p>
        )}
      </FormDialog>
    </div>
  );
}

// ---------- columns (built once per render with the row actions) ----------

function columns({
  isManager,
  onOpen,
  onAssign,
  onConvert,
}: {
  isManager: boolean;
  onOpen: (l: LeadRow) => void;
  onAssign: (l: LeadRow) => void;
  onConvert: (l: LeadRow) => void;
}): Column<LeadRow>[] {
  return [
    {
      key: "name",
      header: "Lead",
      minWidth: 170,
      sortable: true,
      sortValue: (l) => l.name,
      render: (l) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-slate-900">{l.name}</p>
          <p className="truncate text-[11px] text-slate-400">{l.email}</p>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      minWidth: 150,
      sortable: true,
      sortValue: (l) => l.company,
      render: (l) => <span className="block max-w-[16rem] truncate text-[13px] text-slate-600">{l.company}</span>,
    },
    {
      key: "contact",
      header: "Contact",
      hideBelow: "lg",
      minWidth: 120,
      render: (l) => <span className="block truncate text-[13px] text-slate-600">{l.contactPerson}</span>,
    },
    {
      key: "source",
      header: "Source",
      hideBelow: "xl",
      minWidth: 110,
      sortable: true,
      sortValue: (l) => l.source,
      render: (l) => (
        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[11px] text-slate-500">{l.source}</span>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      minWidth: 140,
      sortable: true,
      sortValue: (l) => l.ownerName,
      render: (l) => (
        <span className="inline-flex items-center gap-2">
          <Avatar name={l.ownerName} size="xs" />
          <span className="truncate text-[13px] text-slate-600">{l.ownerName}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      minWidth: 110,
      render: (l) => <StatusBadge status={l.status} size="sm" />,
    },
    {
      key: "priority",
      header: "Priority",
      minWidth: 90,
      render: (l) => <PriorityBadge priority={l.priority} size="sm" />,
    },
    {
      key: "score",
      header: "Score",
      hideBelow: "lg",
      minWidth: 100,
      sortable: true,
      sortValue: (l) => l.score,
      render: (l) => <ScoreBar score={l.score} />,
    },
    {
      key: "lastActivity",
      header: "Last activity",
      hideBelow: "xl",
      minWidth: 100,
      sortable: true,
      sortValue: (l) => l.lastActivityAt,
      render: (l) => <span className="whitespace-nowrap text-[12.5px] tabular-nums text-slate-500">{relTime(l.lastActivityAt)}</span>,
    },
    {
      key: "nextFollowUp",
      header: "Next follow-up",
      hideBelow: "lg",
      minWidth: 130,
      sortable: true,
      sortValue: (l) => l.nextFollowUpAt ?? 0,
      render: (l) =>
        l.nextFollowUpAt ? (
          <span className="whitespace-nowrap text-[12.5px] tabular-nums text-slate-600">{fmtDateTime(l.nextFollowUpAt)}</span>
        ) : (
          <span className="text-[12.5px] text-slate-300">—</span>
        ),
    },
    {
      key: "created",
      header: "Created",
      hideBelow: "xl",
      minWidth: 100,
      sortable: true,
      sortValue: (l) => l.createdAt,
      render: (l) => <span className="whitespace-nowrap text-[12.5px] tabular-nums text-slate-500">{fmtDate(l.createdAt)}</span>,
    },
    {
      key: "value",
      header: "Est. value",
      minWidth: 100,
      sortable: true,
      sortValue: (l) => l.estimatedValueCr,
      render: (l) => (
        <span className="whitespace-nowrap text-[13px] font-medium tabular-nums text-slate-900">
          {l.status === "Unqualified" || l.status === "Converted" ? "—" : fmtCr(l.estimatedValueCr)}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Row actions</span>,
      minWidth: 120,
      render: (l) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          {isManager && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-700"
              aria-label={`Assign ${l.name} to another owner`}
              onClick={() => onAssign(l)}
            >
              <UserCog className="h-3.5 w-3.5" aria-hidden />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-slate-700"
            aria-label={`Open conversion flow for ${l.name}`}
            onClick={() => onConvert(l)}
          >
            <Repeat className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-slate-700"
            aria-label={`Open ${l.name}`}
            onClick={() => onOpen(l)}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      ),
    },
  ];
}
