"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  departments,
  directReports,
  employees,
  getEmployee,
  type Employee,
} from "@/lib/qubit/data";
import { useQubitNav } from "../nav-context";
import { PageHeader } from "../page-header";
import { Avatar, FilterBar, SearchInput, StatusBadge } from "../primitives";
import { EmployeeDrawer } from "../drawers";

const CEO = getEmployee("sagar")!;
const DEPT_HEADS = employees.filter((e) => e.managerId === "sagar");

/** Manager chain for an employee, walking up via managerId (CEO included, self excluded). */
function managerChainUp(id: string): string[] {
  const chain: string[] = [];
  let cur = getEmployee(id);
  let guard = 0;
  while (cur?.managerId && guard++ < 12) {
    chain.push(cur.managerId);
    cur = getEmployee(cur.managerId);
  }
  return chain;
}

/** Top-most node for an employee: the CEO or the department head whose branch contains them. */
function topAncestorId(id: string): string | null {
  let cur = getEmployee(id);
  let guard = 0;
  while (cur && guard++ < 12) {
    if (cur.managerId === null || cur.managerId === "sagar") return cur.id;
    cur = getEmployee(cur.managerId);
  }
  return null;
}

export function ReportingLinesScreen() {
  const { params } = useQubitNav();

  const [query, setQuery] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState<string>("all");
  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    const init = new Set<string>();
    if (params.employeeId) {
      managerChainUp(params.employeeId).forEach((id) => {
        if (id !== "sagar") init.add(id);
      });
    }
    return init;
  });
  const [drawerEmployee, setDrawerEmployee] = React.useState<Employee | null>(null);
  const highlightRef = React.useRef<HTMLDivElement | null>(null);

  const q = query.trim().toLowerCase();
  const qActive = q.length >= 2;

  const matches = React.useMemo(() => {
    if (!qActive) return [];
    return employees.filter(
      (e) =>
        (deptFilter === "all" || e.department === deptFilter) &&
        (e.name.toLowerCase().includes(q) ||
          e.title.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q)),
    );
  }, [q, qActive, deptFilter]);

  // Search matches auto-expand the branch containing them (manager chain up to CEO).
  React.useEffect(() => {
    if (matches.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      matches.forEach((m) => {
        const top = topAncestorId(m.id);
        if (top && top !== "sagar") next.add(top);
      });
      return next;
    });
  }, [matches]);

  // Department filter opens the matching head card.
  React.useEffect(() => {
    if (deptFilter === "all") return;
    const head = DEPT_HEADS.find((h) => h.department === deptFilter);
    if (head) setExpanded((prev) => new Set(prev).add(head.id));
  }, [deptFilter]);

  // Cross-screen focus (e.g. EmployeeDrawer → "View reporting line"): expand ancestors,
  // then bring the highlighted card into view.
  const focusId = params.employeeId && getEmployee(params.employeeId) ? params.employeeId : null;
  const focusCardId = focusId ? topAncestorId(focusId) : null;

  React.useEffect(() => {
    if (!focusId) return;
    const t = window.setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [focusId]);

  const visibleHeads = DEPT_HEADS.filter((h) => deptFilter === "all" || h.department === deptFilter);
  const allExpanded = visibleHeads.length > 0 && visibleHeads.every((h) => expanded.has(h.id));

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setExpanded((prev) => {
      const next = new Set(prev);
      visibleHeads.forEach((h) => {
        if (allExpanded) next.delete(h.id);
        else next.add(h.id);
      });
      return next;
    });

  const branchHasMatch = (headId: string) =>
    !qActive || matches.some((m) => m.id === headId || topAncestorId(m.id) === headId);

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Enterprise" }, { label: "05. Reporting Lines" }]}
        title="Reporting Lines"
        description="Who reports to whom — the CEO, department heads and their direct teams. Select any person to preview their profile."
      />

      <FilterBar
        className="mb-4"
        left={
          <>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search employee…"
              className="w-full sm:w-72"
              ariaLabel="Search employee"
            />
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="h-10 w-full sm:w-44" aria-label="Filter by department">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        right={
          <>
            {qActive && (
              <p className="text-xs text-muted-foreground">
                {matches.length} {matches.length === 1 ? "person matches" : "people match"} “{query}”
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={toggleAll}
              disabled={visibleHeads.length === 0}
            >
              {allExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {allExpanded ? "Collapse all" : "Expand all"}
            </Button>
          </>
        }
      />

      {/* People search results */}
      {qActive && matches.length > 0 && (
        <div className="qubit-card mb-4 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            People matching “{query}”
          </p>
          <div className="flex flex-wrap gap-2">
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDrawerEmployee(p)}
                className="flex items-center gap-2 rounded-full border border-slate-200/90 bg-white py-1 pl-1 pr-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors duration-150 hover:border-blue-200 hover:bg-blue-50/50"
              >
                <Avatar name={p.name} size="xs" />
                <span className="text-xs">
                  <span className="font-medium text-slate-800">{p.name}</span>
                  <span className="ml-1.5 text-muted-foreground">{p.title}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {qActive && matches.length === 0 && (
        <p className="qubit-card mb-4 px-3.5 py-2.5 text-xs text-muted-foreground">
          No employees match “{query}”. Clear the search to see the full reporting structure.
        </p>
      )}

      {/* CEO */}
      <div className="mx-auto max-w-md">
        <div
          ref={focusCardId === "sagar" ? highlightRef : undefined}
          className={cn(
            "qubit-card qubit-card-hover p-4 text-center",
            focusCardId === "sagar"
              ? "border-blue-300 ring-2 ring-blue-200"
              : "hover:border-blue-200",
          )}
        >
          <button
            type="button"
            onClick={() => setDrawerEmployee(CEO)}
            aria-label={`Open preview for ${CEO.name}`}
            className="flex w-full flex-col items-center gap-2"
          >
            <Avatar name={CEO.name} size="xl" />
            <span>
              <span className="block text-[15px] font-semibold text-slate-900">{CEO.name}</span>
              <span className="block text-xs text-muted-foreground">{CEO.title}</span>
            </span>
          </button>
          <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            <Users className="h-3 w-3 text-slate-400" aria-hidden />
            {directReports(CEO.id).length} direct reports
          </p>
        </div>
      </div>

      {/* Connector: CEO → rail → department head cards (lg+) */}
      <div aria-hidden className="hidden lg:flex justify-center">
        <div className="h-5 w-px bg-slate-200" />
      </div>
      <div aria-hidden className="hidden lg:grid grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex justify-center border-t border-slate-200">
            <div className="h-5 w-px bg-slate-200" />
          </div>
        ))}
      </div>
      <div aria-hidden className="mx-auto hidden h-5 w-px bg-slate-200 sm:max-md:block" />

      {/* Department head cards */}
      {visibleHeads.length === 0 ? (
        <div className="qubit-card">
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            No department heads match the current filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibleHeads.map((h) => {
            const reports = directReports(h.id).filter(
              (r) => deptFilter === "all" || r.department === deptFilter,
            );
            const isOpen = expanded.has(h.id);
            const isFocusCard = focusCardId === h.id;
            return (
              <div
                key={h.id}
                ref={isFocusCard ? highlightRef : undefined}
                className={cn(
                  "qubit-card qubit-card-hover flex flex-col",
                  isOpen && "border-blue-200 ring-1 ring-blue-100",
                  isFocusCard && "border-blue-300 ring-2 ring-blue-200",
                  qActive && !branchHasMatch(h.id) && "opacity-40",
                )}
              >
                <div className="flex items-start justify-between gap-2 px-3.5 pt-3.5">
                  <button
                    type="button"
                    onClick={() => setDrawerEmployee(h)}
                    aria-label={`Open preview for ${h.name}`}
                    className="flex min-w-0 items-start gap-2.5 text-left"
                  >
                    <Avatar name={h.name} size="md" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{h.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{h.title}</span>
                    </span>
                  </button>
                  <StatusBadge status={h.status} size="sm" />
                </div>

                {isOpen && (
                  <div className="mt-3 px-3.5">
                    {reports.length === 0 ? (
                      <p className="rounded-md bg-slate-50 px-2.5 py-2 text-[11px] text-muted-foreground">
                        No direct reports in this department.
                      </p>
                    ) : (
                      <ul className="ml-2 space-y-0.5 border-l border-slate-200 pl-3">
                        {reports.map((r) => (
                          <li key={r.id}>
                            <button
                              type="button"
                              onClick={() => setDrawerEmployee(r)}
                              aria-label={`Open preview for ${r.name}`}
                              className={cn(
                                "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left transition-colors duration-150 hover:bg-slate-50",
                                focusId === r.id && "bg-blue-50 ring-1 ring-blue-200",
                                qActive && !matches.some((m) => m.id === r.id) && "opacity-50",
                              )}
                            >
                              <Avatar name={r.name} size="xs" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-medium text-slate-800">{r.name}</span>
                                <span className="block truncate text-[10px] text-muted-foreground">{r.title}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleExpanded(h.id)}
                  aria-expanded={isOpen}
                  className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 px-3.5 py-2 text-[11px] font-medium text-blue-600 transition-colors duration-150 hover:bg-blue-50/60"
                >
                  <span>
                    {reports.length} {reports.length === 1 ? "report" : "reports"}
                  </span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        3 management levels · {departments.length} departments · average span of control 4
      </p>

      {/* Employee preview */}
      <EmployeeDrawer
        employee={drawerEmployee}
        open={!!drawerEmployee}
        onOpenChange={(o) => !o && setDrawerEmployee(null)}
      />
    </div>
  );
}
