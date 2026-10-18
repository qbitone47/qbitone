"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Expand, Mail, Minimize2, Network, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { departments, directReports, employees, getEmployee, type Employee } from "@/lib/qubit/data";
import { useQubitNav } from "../nav-context";
import { PageHeader } from "../page-header";
import { Avatar, EmptyState, SectionCard, StatusBadge } from "../primitives";
import { DetailDrawer } from "../drawers";

// ============================================================
// Screen 51 · Organization Chart — the employee-facing view of
// the same structure established in Phase 1 (Organization
// Structure + Reporting Lines). Progressive expansion keeps the
// tree readable at scale; search drives focused navigation.
// ============================================================

/** chain of manager ids from employee up to the root */
const chainToRoot = (id: string): string[] => {
  const chain: string[] = [];
  let cur: string | null = id;
  while (cur) {
    chain.push(cur);
    cur = getEmployee(cur)?.managerId ?? null;
  }
  return chain;
};

export function OrganizationChartScreen() {
  const nav = useQubitNav();
  const { toast } = useToast();
  const params = nav.params as { focusNodeId?: string; employeeId?: string };

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [query, setQuery] = React.useState("");
  const [focusId, setFocusId] = React.useState<string | null>(params.focusNodeId ?? params.employeeId ?? null);
  const [drawer, setDrawer] = React.useState<Employee | null>(null);
  const nodeRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  // Search: locate employee or department head, expand the path, scroll to it.
  const applySearch = (raw: string) => {
    const q = raw.trim().toLowerCase();
    if (!q) {
      setFocusId(null);
      return;
    }
    const emp = employees.find(
      (e) => e.name.toLowerCase().includes(q) || e.title.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q),
    );
    const dept = departments.find((d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase() === q);
    const targetId = emp?.id ?? dept?.headId;
    if (!targetId) {
      setFocusId(null);
      toast({ title: "No match in the organization", description: `Nothing found for "${raw}". Try a name, designation or department.` });
      return;
    }
    const chain = chainToRoot(targetId);
    setExpanded((prev) => {
      const next = { ...prev };
      for (const id of chain) next[id] = true; // expand ancestors so the node is visible
      return next;
    });
    setFocusId(targetId);
    window.setTimeout(() => nodeRefs.current[targetId]?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
  };

  const visibleRoots = focusId ? [getEmployee(focusId)!] : [getEmployee("sagar")!];

  const collapseAll = () => setExpanded({});
  const expandDepartmentHeads = () => {
    const heads = employees.filter((e) => e.department !== "Executive" && e.managerId === "sagar");
    setExpanded((prev) => {
      const next = { ...prev };
      for (const h of heads) next[h.id] = true;
      return next;
    });
  };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "People" }, { label: "Organization" }]}
        title="Organization Chart"
        description="The live structure of Qubit One — reporting lines as they actually are, driven by the same organization data as every governance screen."
        meta={
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" aria-hidden /> {employees.length} people charted</span>
            <span>·</span>
            <span>Progressive expansion keeps the tree readable</span>
          </div>
        }
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={expandDepartmentHeads}>
              <Expand className="h-3.5 w-3.5" aria-hidden /> Expand departments
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={collapseAll}>
              <Minimize2 className="h-3.5 w-3.5" aria-hidden /> Collapse
            </Button>
          </>
        }
      />

      {/* Search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            role="searchbox"
            aria-label="Find a person or department in the chart"
            placeholder="Find a person or department — e.g. Finance, Neha, QO-0115…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch(query)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-20 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-colors focus:border-blue-300"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => { setQuery(""); setFocusId(null); }}
              className="absolute right-14 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          <Button size="sm" className="absolute right-1 top-1 h-8" onClick={() => applySearch(query)}>
            Focus
          </Button>
        </div>
        {focusId && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={() => { setFocusId(null); setQuery(""); }}>
            Show full company
          </Button>
        )}
      </div>

      {focusId && (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700" role="status">
          Focused subtree · {getEmployee(focusId)?.name}
        </p>
      )}

      <SectionCard noPadding className="qubit-scroll overflow-x-auto">
        <div className="min-w-[720px] p-5 md:p-6">
          <div role="tree" aria-label="Organization chart">
            <TreeLevel
              employee={visibleRoots[0]}
              depth={0}
              expanded={expanded}
              onToggle={(id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))}
              focusId={focusId}
              registerRef={(id, el) => (nodeRefs.current[id] = el)}
              onOpen={setDrawer}
              onNavigate={nav.navigate}
              showManagerLine={Boolean(focusId)}
              focusEmployee={focusId ? getEmployee(focusId) : undefined}
            />
          </div>
        </div>
      </SectionCard>

      {visibleRoots.length === 0 || !visibleRoots[0] ? (
        <SectionCard className="mt-3">
          <EmptyState icon={<Network />} title="Person not charted" message="This employee may have exited or the link is stale. Clear the focus to see the full company." />
        </SectionCard>
      ) : null}

      <PersonDrawer
        person={drawer}
        onClose={() => setDrawer(null)}
        on360={(id) => { setDrawer(null); nav.navigate("employee-360", { employeeId: id }); }}
        onMail={(email) => { setDrawer(null); nav.navigate("compose-mail", { to: email }); }}
      />
    </div>
  );
}

function TreeLevel({
  employee,
  depth,
  expanded,
  onToggle,
  focusId,
  registerRef,
  onOpen,
  onNavigate,
  showManagerLine,
  focusEmployee,
}: {
  employee: Employee;
  depth: number;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
  focusId: string | null;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  onOpen: (e: Employee) => void;
  onNavigate: ReturnType<typeof useQubitNav>["navigate"];
  showManagerLine?: boolean;
  focusEmployee?: Employee;
}) {
  const reports = directReports(employee.id);
  const isOpen = Boolean(expanded[employee.id]);
  const isFocused = focusId === employee.id;
  const dept = departments.find((d) => d.headId === employee.id);

  return (
    <div>
      <div ref={(el) => registerRef(employee.id, el)} className={cn("inline-block", isFocused && "rounded-xl ring-2 ring-blue-200 ring-offset-2 ring-offset-white")}>
        <OrgNode
          employee={employee}
          reportCount={reports.length}
          deptName={dept?.name}
          expanded={isOpen}
          hasReports={reports.length > 0}
          onToggle={() => onToggle(employee.id)}
          onOpen={() => onOpen(employee)}
          highlight={isFocused}
        />
      </div>

      {reports.length > 0 && (
        <div className="relative" aria-hidden={false}>
          {/* connector */}
          <span aria-hidden className="ml-[30px] block h-3 w-px bg-slate-200" />
          {isOpen ? (
            <div className="relative space-y-2 border-l border-slate-200 pl-6" role="group" aria-label={`Reports of ${employee.name}`}>
              {reports.map((r) => (
                <TreeLevel
                  key={r.id}
                  employee={r}
                  depth={depth + 1}
                  expanded={expanded}
                  onToggle={onToggle}
                  focusId={focusId}
                  registerRef={registerRef}
                  onOpen={onOpen}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ) : (
            reports.length > 0 && (
              <button
                type="button"
                onClick={() => onToggle(employee.id)}
                className="ml-12 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-blue-200 hover:text-blue-700"
              >
                <Users className="h-3 w-3" aria-hidden />
                {reports.length} report{reports.length === 1 ? "" : "s"} — expand
              </button>
            )
          )}
        </div>
      )}

      {/* In focused mode, offer the path back up */}
      {showManagerLine && focusEmployee && employee.id === focusEmployee.id && focusEmployee.managerId && (
        <div className="mt-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() => onNavigate("organization-chart", { focusNodeId: focusEmployee.managerId! })}
          >
            <ChevronUp className="h-3 w-3" aria-hidden /> Focus on manager
          </Button>
        </div>
      )}
    </div>
  );
}

function OrgNode({
  employee,
  reportCount,
  deptName,
  expanded,
  hasReports,
  onToggle,
  onOpen,
  highlight,
}: {
  employee: Employee;
  reportCount: number;
  deptName?: string;
  expanded: boolean;
  hasReports: boolean;
  onToggle: () => void;
  onOpen: () => void;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full max-w-md items-center gap-3 rounded-xl border bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150",
        highlight ? "border-blue-300 shadow-[0_0_0_3px_rgba(37,99,235,0.08)]" : "border-slate-200/90 hover:border-slate-300 hover:shadow-[0_2px_6px_rgba(15,23,42,0.06)]",
      )}
    >
      <Avatar name={employee.name} size="md" />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left" aria-label={`Open ${employee.name}`}>
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px] font-semibold text-slate-900">{employee.name}</span>
          <StatusBadge status={employee.status} size="sm" />
        </span>
        <span className="block truncate text-xs text-slate-500">
          {employee.title}
          {deptName ? ` · ${deptName}` : employee.department !== "Executive" ? ` · ${employee.department}` : ""}
        </span>
      </button>
      <span className="hidden shrink-0 rounded-full bg-slate-50 px-2 py-0.5 text-[10.5px] font-medium text-slate-500 sm:block">
        {reportCount > 0 ? `${reportCount} report${reportCount === 1 ? "" : "s"}` : "Individual"}
      </span>
      {hasReports && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${employee.name}'s reports` : `Expand ${employee.name}'s reports`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:border-blue-200 hover:text-blue-600"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      )}
    </div>
  );
}

function PersonDrawer({
  person,
  onClose,
  on360,
  onMail,
}: {
  person: Employee | null;
  onClose: () => void;
  on360: (id: string) => void;
  onMail: (email: string) => void;
}) {
  if (!person) return null;
  const manager = getEmployee(person.managerId);
  const reports = directReports(person.id);
  const dept = departments.find((d) => d.headId === person.id);
  return (
    <DetailDrawer
      open={Boolean(person)}
      onOpenChange={(o) => !o && onClose()}
      title={
        <span className="flex items-center gap-2">
          {person.name}
          <StatusBadge status={person.status} size="sm" />
        </span>
      }
      subtitle={`${person.title} · ${person.department}`}
      icon={<Users />}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="h-8" onClick={() => on360(person.id)}>
            Open Employee 360
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => onMail(person.email)}>
            <Mail className="h-3.5 w-3.5" aria-hidden /> Message
          </Button>
        </div>
      }
    >
      <div className="flex items-center gap-3 border-b pb-4">
        <Avatar name={person.name} size="xl" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{person.employeeId}</p>
          <p className="text-xs text-muted-foreground">{person.location} · since {person.since}</p>
          {dept && <p className="mt-1 text-xs font-medium text-blue-700">Head of {dept.name}</p>}
        </div>
      </div>
      <dl className="divide-y pt-1 text-sm">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Manager</dt>
          <dd className="text-[13px] font-medium text-slate-800">{manager?.name ?? "Board"}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Direct reports</dt>
          <dd className="text-[13px] font-medium text-slate-800">{reports.length === 0 ? "None" : `${reports.length}`}</dd>
        </div>
        {reports.length > 0 && (
          <div className="py-2.5">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Team</dt>
            <dd className="mt-1.5 space-y-1">
              {reports.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => on360(r.id)}
                  className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left transition-colors hover:border-slate-200 hover:bg-slate-50"
                >
                  <Avatar name={r.name} size="xs" />
                  <span className="truncate text-[12.5px] font-medium text-slate-700">{r.name}</span>
                  <span className="ml-auto truncate text-[11px] text-slate-400">{r.title}</span>
                </button>
              ))}
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400">
        <ChevronUp className="h-3 w-3" aria-hidden /> Reporting lines and department hierarchy stay authoritative in the Enterprise module.
      </p>
    </DetailDrawer>
  );
}
