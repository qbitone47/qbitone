"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Link2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/qubit/api";
import type { AuditEvent } from "@/lib/qubit/security-server";
import { employees } from "@/lib/qubit/data";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { DataTable, type Column } from "../data-table";
import { Avatar, EmptyState, FilterBar, KV, SearchInput, StatusBadge } from "../primitives";
import { DetailDrawer } from "../drawers";

// ============================================================
// Screen 39 · Audit Log
// Trustworthy enterprise security history. Filtering, scoping
// and pagination happen on the server (designed for very large
// datasets); export is privileged and itself audited. Records
// never contain passwords, tokens or secrets.
// ============================================================

const ACTION_TYPES = [
  "Sign in",
  "Sign out",
  "Failed sign-in",
  "MFA verification",
  "MFA factor changed",
  "Password changed",
  "Role changed",
  "Permission updated",
  "Access request submitted",
  "Access request approved",
  "Access request rejected",
  "Session revoked",
  "Network policy changed",
  "Security setting changed",
  "Sign-in blocked",
  "AI query denied",
  "Sensitive AI action requested",
  "Export audit log",
];

interface AuditPage {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  restricted: boolean;
  events: AuditEvent[];
}

const RESULT_TONE: Record<string, string> = {
  Success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Failure: "border-red-200 bg-red-50 text-red-700",
  Blocked: "border-amber-200 bg-amber-50 text-amber-700",
};

const SEV_DOT: Record<string, string> = {
  Info: "bg-slate-400",
  Warning: "bg-amber-500",
  High: "bg-red-500",
  Critical: "bg-red-600",
};

export function AuditLogScreen() {
  const { can, role } = useRole();
  const { toast } = useToast();
  const isAdmin = can("audit.export") && can("security.admin");

  const [data, setData] = React.useState<AuditPage | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<AuditEvent | null>(null);

  const [queryInput, setQueryInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [action, setAction] = React.useState("all");
  const [result, setResult] = React.useState("all");
  const [severity, setSeverity] = React.useState("all");
  const [actor, setActor] = React.useState("all");
  const [range, setRange] = React.useState("90d");
  const [page, setPage] = React.useState(1);

  // Debounce the search box (300ms) — server-side filtering.
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(queryInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [queryInput]);

  const fetchPage = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<AuditPage>(
        "/audit",
        {
          query: query || undefined,
          action,
          result,
          severity,
          actor: isAdmin ? actor : "sagar",
          range,
          page,
          pageSize: 12,
        },
        isAdmin ? "administrator" : role,
      );
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} The audit record wasn't modified — retry to load it again.`
          : "The audit service didn't respond.",
      );
    } finally {
      setLoading(false);
    }
  }, [query, action, result, severity, actor, range, page, isAdmin, role]);

  React.useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  const exportCsv = async () => {
    try {
      const res = await fetch(`/api/security/audit?export=csv&range=${range}`, { headers: { "X-Qubit-Role": "administrator" } });
      if (!res.ok) throw new Error("Export requires Security administrator access.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qubit-one-audit-${range}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Audit export downloaded", description: "The export itself is recorded in the audit log." });
    } catch (err) {
      toast({
        title: "Export not available",
        description: err instanceof Error ? err.message : "The export service didn't respond.",
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
    setQueryInput("");
    setAction("all");
    setResult("all");
    setSeverity("all");
    setActor("all");
    setRange("90d");
    setPage(1);
  };

  const filtersActive = query !== "" || action !== "all" || result !== "all" || severity !== "all" || actor !== "all" || range !== "90d";

  const columns: Column<AuditEvent>[] = [
    {
      key: "time",
      header: "Time",
      sortable: false,
      render: (e) => <span className="whitespace-nowrap text-[12.5px] tabular-nums text-slate-600">{e.time}</span>,
    },
    {
      key: "actor",
      header: "Actor",
      render: (e) => (
        <div className="flex items-center gap-2">
          <Avatar name={e.actor} size="xs" />
          <span className="truncate text-[13px] font-medium text-slate-800">{e.actor}</span>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (e) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] text-slate-800">{e.action}</p>
          <p className="truncate text-[11px] text-muted-foreground">{e.resource}</p>
        </div>
      ),
    },
    {
      key: "result",
      header: "Result",
      render: (e) => (
        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", RESULT_TONE[e.result])}>
          <span
            className={cn("h-1.5 w-1.5 rounded-full", e.result === "Success" ? "bg-emerald-500" : e.result === "Failure" ? "bg-red-500" : "bg-amber-500")}
            aria-hidden
          />
          {e.result}
        </span>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      hideBelow: "md",
      render: (e) => (
        <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
          <span className={cn("h-1.5 w-1.5 rounded-full", SEV_DOT[e.severity])} aria-hidden />
          {e.severity}
        </span>
      ),
    },
    {
      key: "source",
      header: "Source",
      hideBelow: "lg",
      render: (e) => <span className="truncate text-[12px] text-slate-500">{e.source}</span>,
    },
    {
      key: "correlation",
      header: "Correlation ID",
      hideBelow: "xl",
      render: (e) => (
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            void navigator.clipboard?.writeText(e.correlationId).catch(() => undefined);
            toast({ title: "Correlation ID copied", description: e.correlationId });
          }}
          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 transition-colors hover:border-blue-200 hover:text-blue-700"
          aria-label={`Copy correlation ID ${e.correlationId}`}
        >
          {e.correlationId}
          <Copy className="h-3 w-3" aria-hidden />
        </button>
      ),
    },
  ];

  const restricted = data?.restricted ?? false;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Security" }, { label: "Governance" }]}
        title="Audit Log"
        description="Trustworthy record of authentication, access and administrative events. Records are immutable, correlated by ID, and never contain passwords, tokens or secrets."
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => void fetchPage()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => void exportCsv()} disabled={!isAdmin}>
              <Download className="h-4 w-4" aria-hidden />
              Export CSV
            </Button>
          </>
        }
      />

      {!isAdmin && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900" role="note">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          You're viewing your own activity only. Organization-wide audit history and CSV export require the Security
          administrator boundary — the server enforces this scoping regardless of what the UI requests.
        </div>
      )}

      <p className="mb-3 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Link2 className="h-3 w-3" aria-hidden />
        Viewing audit records is itself recorded — audit access stays auditable.
      </p>

      {/* Filter toolbar */}
      <FilterBar className="mb-3">
        <SearchInput
          value={queryInput}
          onChange={setQueryInput}
          placeholder="Search actor, action, resource or correlation ID…"
          className="w-full sm:w-80"
          ariaLabel="Search audit events"
        />
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-[150px] rounded-lg bg-white" aria-label="Filter by action">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All actions</SelectItem>
            {ACTION_TYPES.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={result} onValueChange={(v) => { setResult(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-[120px] rounded-lg bg-white" aria-label="Filter by result">
            <SelectValue placeholder="Result" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            <SelectItem value="Success">Success</SelectItem>
            <SelectItem value="Failure">Failure</SelectItem>
            <SelectItem value="Blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={(v) => { setSeverity(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-[130px] rounded-lg bg-white" aria-label="Filter by severity">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="Info">Info</SelectItem>
            <SelectItem value="Warning">Warning</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select value={actor} onValueChange={(v) => { setActor(v); setPage(1); }}>
            <SelectTrigger className="h-10 w-[150px] rounded-lg bg-white" aria-label="Filter by actor">
              <SelectValue placeholder="Actor" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All actors</SelectItem>
              {employees.slice(0, 12).map((e) => (
                <SelectItem key={e.id} value={e.name}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={range} onValueChange={(v) => { setRange(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-[130px] rounded-lg bg-white" aria-label="Filter by date range">
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
        <p className="ml-auto hidden text-xs tabular-nums text-muted-foreground lg:block" aria-live="polite">
          {loading ? "Loading…" : `${(data?.total ?? 0).toLocaleString("en-IN")} events match`}
        </p>
      </FilterBar>

      {/* Server-paginated table */}
      {error ? (
        <div className="qubit-card">
          <EmptyState
            icon={<ShieldAlert />}
            title="Unable to load audit events"
            message={error}
            action={
              <Button size="sm" className="h-8" onClick={() => void fetchPage()}>
                Try again
              </Button>
            }
          />
        </div>
      ) : loading && !data ? (
        <div className="qubit-card space-y-2 p-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className={cn("relative", loading && "opacity-60 transition-opacity")}>
          <DataTable
            columns={columns}
            rows={data?.events ?? []}
            rowKey={(e) => e.id}
            onRowClick={(e) => setDetail(e)}
            pageSize={0}
            emptyTitle="No events match your filters"
            emptyMessage="Try a wider date range or clear a filter — audit history is never deleted."
            caption="Enterprise audit history"
            mobileCard={(e) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-slate-800">{e.action}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {e.actor} · {e.resource}
                  </p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-slate-400">{e.time}</p>
                </div>
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-medium", RESULT_TONE[e.result])}>{e.result}</span>
              </div>
            )}
          />
          {/* Server-side pagination footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 md:rounded-b-[12px]">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Page <span className="font-medium text-slate-700">{data?.page ?? 1}</span> of {data?.pageCount ?? 1} ·{" "}
              <span className="font-medium text-slate-700">{(data?.total ?? 0).toLocaleString("en-IN")}</span> events
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Previous page"
                disabled={(data?.page ?? 1) <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Next page"
                disabled={(data?.page ?? 1) >= (data?.pageCount ?? 1) || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Event detail drawer */}
      <DetailDrawer
        open={detail !== null}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail?.action ?? ""}
        subtitle={detail ? `${detail.time} · ${detail.correlationId}` : undefined}
        icon={<ShieldAlert />}
      >
        {detail && (
          <>
            <dl className="divide-y">
              <KV label="Actor">
                <span className="flex items-center gap-2">
                  <Avatar name={detail.actor} size="sm" />
                  {detail.actor}
                </span>
              </KV>
              <KV label="Action">{detail.action}</KV>
              <KV label="Resource">{detail.resource}</KV>
              <KV label="Result">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium", RESULT_TONE[detail.result])}>
                  {detail.result}
                </span>
              </KV>
              <KV label="Severity">
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", SEV_DOT[detail.severity])} aria-hidden />
                  {detail.severity}
                </span>
              </KV>
              <KV label="Source">{detail.source}</KV>
              <KV label="Network context">{detail.ipMasked}</KV>
              <KV label="Correlation ID">
                <code className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[12px]">{detail.correlationId}</code>
              </KV>
              <KV label="Context">{detail.context}</KV>
            </dl>
            {(detail.action.includes("Password") || detail.action.includes("MFA")) && (
              <p className="mt-4 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
                Authentication records never contain the password, code or token itself — only the outcome and context.
              </p>
            )}
            <div className="mt-4 flex items-start gap-1.5 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
              <Link2 className="mt-0.5 h-3 w-3 shrink-0 text-blue-600" aria-hidden />
              Use the correlation ID to trace this event across security alerts, access requests and AI authorization checks.
            </div>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
