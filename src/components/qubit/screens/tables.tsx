"use client";

import * as React from "react";
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronRight,
  Columns3,
  Download,
  Eye,
  Inbox,
  MoreHorizontal,
  UserCog,
} from "lucide-react";
import { PageHeader } from "../page-header";
import {
  DSCaption,
  DSExample,
  DSGuidance,
  DSScreenNav,
  DSSection,
  DSSpec,
  DSVar,
} from "../ds/doc";
import { DataTable, type Column } from "../data-table";
import { Avatar, EmptyState, FilterBar, SearchInput, StatusBadge } from "../primitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { employees, getEmployee, type Employee } from "@/lib/qubit/data";
import { cn } from "@/lib/utils";

// ============================================================
// Screen 18 — Tables. The enterprise data-table system:
// densities, sort & filter, selection, column visibility,
// sticky headers, expandable rows and every governed state.
// ============================================================

const TH_CLS =
  "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 md:px-4";

const DENSITY_ROWS: Employee[] = ["anita", "divya", "deepak", "pooja", "rameshp", "sneha"]
  .map((id) => getEmployee(id))
  .filter((e): e is Employee => Boolean(e));

const LAST_UPDATED: Record<string, string> = {
  anita: "18 Mar 2026",
  divya: "02 Mar 2026",
  deepak: "21 Mar 2026",
  pooja: "14 Mar 2026",
  rameshp: "09 Mar 2026",
  sneha: "19 Mar 2026",
};

const EMPLOYEE_DEPARTMENTS = Array.from(new Set(employees.map((e) => e.department))).sort();
const EMPLOYEE_STATUSES = ["Active", "Probation", "On Leave", "Notice Period", "Exit Initiated"];

const SELECTION_ROWS = employees.slice(9, 17); // sales + finance mix
const DIRECTORY_ROWS = employees.slice(0, 10); // leadership directory
const EXPAND_ROWS: Employee[] = ["sagar", "rahul", "priya", "neha", "amit", "sanjay"]
  .map((id) => getEmployee(id))
  .filter((e): e is Employee => Boolean(e));

function EmployeeCell({ e }: { e: Employee }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={e.name} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-slate-900">{e.name}</p>
        <p className="truncate text-xs text-slate-500">{e.title}</p>
      </div>
    </div>
  );
}

function MiniKV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-medium text-slate-800">{value}</dd>
    </div>
  );
}

const DENSITY_COLUMNS: Column<Employee>[] = [
  { key: "employee", header: "Employee", render: (e) => <EmployeeCell e={e} />, minWidth: 220 },
  { key: "department", header: "Department", render: (e) => <span className="text-slate-600">{e.department}</span> },
  { key: "role", header: "Role", hideBelow: "md", render: (e) => <span className="text-slate-600">{e.title}</span> },
  { key: "status", header: "Status", render: (e) => <StatusBadge status={e.status} size="sm" /> },
  {
    key: "updated",
    header: "Last updated",
    hideBelow: "lg",
    render: (e) => <span className="tabular-nums text-slate-500">{LAST_UPDATED[e.id] ?? "—"}</span>,
  },
];

const FILTER_COLUMNS: Column<Employee>[] = [
  {
    key: "employee",
    header: "Employee",
    sortable: true,
    sortValue: (e) => e.name,
    render: (e) => <EmployeeCell e={e} />,
    minWidth: 220,
  },
  {
    key: "department",
    header: "Department",
    sortable: true,
    sortValue: (e) => e.department,
    render: (e) => <span className="text-slate-600">{e.department}</span>,
  },
  { key: "role", header: "Role", hideBelow: "md", render: (e) => <span className="text-slate-600">{e.title}</span> },
  {
    key: "location",
    header: "Location",
    hideBelow: "xl",
    render: (e) => <span className="text-slate-500">{e.location}</span>,
  },
  { key: "status", header: "Status", render: (e) => <StatusBadge status={e.status} size="sm" /> },
];

export function TablesScreen() {
  const { toast } = useToast();

  // ── Sort & filter ──────────────────────────────────────────
  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState("all");
  const [status, setStatus] = React.useState("all");

  const filteredEmployees = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (dept !== "all" && e.department !== dept) return false;
      if (status !== "all" && e.status !== status) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
      );
    });
  }, [query, dept, status]);

  const filtersActive = query.trim() !== "" || dept !== "all" || status !== "all";

  const clearFilters = () => {
    setQuery("");
    setDept("all");
    setStatus("all");
  };

  // ── Row selection & bulk actions ───────────────────────────
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(["pankaj", "meera", "kavita"]),
  );

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = SELECTION_ROWS.length > 0 && SELECTION_ROWS.every((e) => selected.has(e.id));
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    setSelected((prev) => (allSelected ? new Set<string>() : new Set(SELECTION_ROWS.map((e) => e.id))));
  };

  // ── Column visibility ──────────────────────────────────────
  const [visibleCols, setVisibleCols] = React.useState({ role: true, location: true, status: true });

  const pagingColumns: Column<Employee>[] = React.useMemo(() => {
    const cols: Column<Employee>[] = [
      {
        key: "employee",
        header: "Employee",
        sortable: true,
        sortValue: (e) => e.name,
        render: (e) => <EmployeeCell e={e} />,
        minWidth: 220,
      },
      {
        key: "department",
        header: "Department",
        sortable: true,
        sortValue: (e) => e.department,
        render: (e) => <span className="text-slate-600">{e.department}</span>,
      },
    ];
    if (visibleCols.role)
      cols.push({ key: "role", header: "Role", hideBelow: "lg", render: (e) => <span className="text-slate-600">{e.title}</span> });
    if (visibleCols.location)
      cols.push({ key: "location", header: "Location", hideBelow: "xl", render: (e) => <span className="text-slate-500">{e.location}</span> });
    if (visibleCols.status)
      cols.push({ key: "status", header: "Status", render: (e) => <StatusBadge status={e.status} size="sm" /> });
    return cols;
  }, [visibleCols]);

  // ── Expandable rows ────────────────────────────────────────
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set(["rahul"]));

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Tables"
        description="Core enterprise data-table system for large datasets."
      />

      <div className="space-y-6">
        {/* ── 1. Anatomy & densities ─────────────────────────── */}
        <DSSection
          title="Anatomy & densities"
          purpose="One component, three paddings. Density is a dial — turn it down as the dataset grows."
        >
          <div className="space-y-7">
            <DSExample label="Comfortable — default cell padding; review screens with ≤ 10 visible rows">
              <DataTable
                columns={DENSITY_COLUMNS}
                rows={DENSITY_ROWS}
                rowKey={(e) => e.id}
                pageSize={0}
                caption="Comfortable density employee table"
              />
            </DSExample>

            <DSExample label="Standard — dense; the default for admin lists and directory views">
              <DataTable
                columns={DENSITY_COLUMNS}
                rows={DENSITY_ROWS}
                rowKey={(e) => e.id}
                pageSize={0}
                dense
                caption="Standard density employee table"
              />
            </DSExample>

            <DSExample label="Dense — dense padding + 13px text; audit logs and datasets in the thousands">
              <DataTable
                columns={DENSITY_COLUMNS}
                rows={DENSITY_ROWS}
                rowKey={(e) => e.id}
                pageSize={0}
                dense
                rowClassName={() => "text-[13px]"}
                caption="Dense density employee table"
              />
            </DSExample>

            <DSCaption>
              Density is the same component with one padding class — it must hold up at thousands of records. Keep rows
              compact: readable beats pretty at enterprise scale.
            </DSCaption>
          </div>
        </DSSection>

        {/* ── 2. Sort & filter ───────────────────────────────── */}
        <DSSection
          title="Sort & filter"
          purpose="Client-side sorting on column headers, filtering in a toolbar above the table — never below it."
        >
          <div className="space-y-3">
            <FilterBar
              left={
                <>
                  <SearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder="Search name, role, email…"
                    ariaLabel="Search employees"
                    className="w-full sm:w-64"
                  />
                  <Select value={dept} onValueChange={setDept}>
                    <SelectTrigger className="w-[170px]" aria-label="Filter by department">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      {EMPLOYEE_DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-[150px]" aria-label="Filter by status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {EMPLOYEE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              }
              right={
                <>
                  <p className="hidden text-xs text-slate-500 sm:block" aria-live="polite">
                    {filteredEmployees.length} of {employees.length} employees
                  </p>
                  {filtersActive && (
                    <Button variant="link" size="sm" className="h-8 px-1" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )}
                </>
              }
            />

            <DataTable
              columns={FILTER_COLUMNS}
              rows={filteredEmployees}
              rowKey={(e) => e.id}
              pageSize={8}
              caption="Sortable and filterable employee table"
              emptyTitle="No employees found"
              emptyMessage="Try adjusting your search or filters."
            />
          </div>
        </DSSection>

        {/* ── 3. Row selection & bulk actions ────────────────── */}
        <DSSection
          title="Row selection & bulk actions"
          purpose="Checkbox selection with a contextual bulk bar. Destructive actions always sit last, in red."
        >
          <div className="space-y-3">
            {selected.size > 0 ? (
              <div
                role="status"
                className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2"
              >
                <p className="text-[13px] font-medium text-blue-800">
                  {selected.size} selected
                </p>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-blue-200 bg-white hover:bg-blue-50"
                    onClick={() =>
                      toast({
                        title: "Assign role",
                        description: `Role assignment started for ${selected.size} employee${selected.size > 1 ? "s" : ""}.`,
                      })
                    }
                  >
                    <UserCog className="h-3.5 w-3.5" aria-hidden />
                    Assign role
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-blue-200 bg-white hover:bg-blue-50"
                    onClick={() =>
                      toast({
                        title: "Export queued",
                        description: `${selected.size} employee record${selected.size > 1 ? "s" : ""} will be emailed to you as CSV.`,
                      })
                    }
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Export
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={() =>
                      toast({
                        title: "Disable requested",
                        description: `${selected.size} employee${selected.size > 1 ? "s" : ""} will be disabled after review.`,
                      })
                    }
                  >
                    <Ban className="h-3.5 w-3.5" aria-hidden />
                    Disable
                  </Button>
                </div>
              </div>
            ) : (
              <p role="status" className="sr-only">
                No rows selected
              </p>
            )}

            <div className="qubit-card overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">
                  Employee selection example — toggle rows to reveal bulk actions
                </caption>
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50/95 text-left">
                    <th scope="col" className="w-12 py-2.5 pl-4 pr-1 md:pl-5">
                      <Checkbox
                        checked={someSelected ? "indeterminate" : allSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all employees"
                      />
                    </th>
                    <th scope="col" className={cn(TH_CLS, "pl-2")}>
                      Employee
                    </th>
                    <th scope="col" className={cn(TH_CLS, "max-md:hidden")}>
                      Department
                    </th>
                    <th scope="col" className={cn(TH_CLS, "max-sm:hidden")}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {SELECTION_ROWS.map((e) => {
                    const isSel = selected.has(e.id);
                    return (
                      <tr
                        key={e.id}
                        tabIndex={0}
                        aria-label={`${e.name} — ${isSel ? "deselect" : "select"} row`}
                        onClick={() => toggleRow(e.id)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault();
                            toggleRow(e.id);
                          }
                        }}
                        className={cn(
                          "cursor-pointer transition-colors duration-150",
                          isSel ? "bg-blue-50/60" : "hover:bg-blue-50/40",
                        )}
                      >
                        <td className="py-2.5 pl-4 pr-1 md:pl-5">
                          <Checkbox
                            checked={isSel}
                            onCheckedChange={() => toggleRow(e.id)}
                            onClick={(ev) => ev.stopPropagation()}
                            onKeyDown={(ev) => ev.stopPropagation()}
                            aria-label={`Select ${e.name}`}
                          />
                        </td>
                        <td className="py-2.5 pl-2 pr-3">
                          <EmployeeCell e={e} />
                        </td>
                        <td className="max-md:hidden px-3 py-2.5 text-slate-600">{e.department}</td>
                        <td className="max-sm:hidden px-3 py-2.5">
                          <StatusBadge status={e.status} size="sm" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <DSCaption>
              The bulk bar appears only when rows are selected — it never occupies space at rest. Selection survives
              pagination.
            </DSCaption>
          </div>
        </DSSection>

        {/* ── 4. Pagination & column visibility ──────────────── */}
        <DSSection
          title="Pagination & column visibility"
          purpose="Beyond one screen of rows: page through them. Beyond one screen of columns: park them."
        >
          <div className="space-y-3">
            <FilterBar
              left={
                <p className="text-[13px] text-slate-500">
                  All employees · <span className="font-medium text-slate-700">{employees.length} records</span>
                </p>
              }
              right={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      <Columns3 className="h-3.5 w-3.5" aria-hidden />
                      Columns
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuCheckboxItem
                      checked={visibleCols.role}
                      onCheckedChange={(v) => setVisibleCols((s) => ({ ...s, role: v === true }))}
                    >
                      Role
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleCols.location}
                      onCheckedChange={(v) => setVisibleCols((s) => ({ ...s, location: v === true }))}
                    >
                      Location
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleCols.status}
                      onCheckedChange={(v) => setVisibleCols((s) => ({ ...s, status: v === true }))}
                    >
                      Status
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />

            <DataTable
              columns={pagingColumns}
              rows={employees}
              rowKey={(e) => e.id}
              pageSize={8}
              caption="All employees with pagination and toggleable columns"
              onRowClick={(e) =>
                toast({ title: e.name, description: `${e.title} · ${e.department} — record opens in a drawer.` })
              }
              mobileCard={(e) => (
                <div className="flex items-center gap-3">
                  <Avatar name={e.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-900">{e.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {e.title} · {e.department}
                    </p>
                  </div>
                  <StatusBadge status={e.status} size="sm" />
                </div>
              )}
            />

            <DSCaption>
              Columns toggle without resetting the page or sort state. On mobile the table swaps to structured cards via{" "}
              <DSVar>mobileCard</DSVar>.
            </DSCaption>
          </div>
        </DSSection>

        {/* ── 5. Sticky header & row actions ─────────────────── */}
        <DSSection
          title="Sticky header & row actions"
          purpose="Tall lists scroll under a pinned header; row actions live in a quiet trailing column."
        >
          <div className="space-y-3">
            <div className="qubit-card qubit-scroll max-h-64 overflow-y-auto overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Employee directory with sticky header and row actions</caption>
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200/90 bg-slate-50/95 text-left backdrop-blur-sm">
                    <th scope="col" className={TH_CLS}>
                      Employee
                    </th>
                    <th scope="col" className={cn(TH_CLS, "max-md:hidden")}>
                      Department
                    </th>
                    <th scope="col" className={cn(TH_CLS, "max-sm:hidden")}>
                      Status
                    </th>
                    <th scope="col" className={cn(TH_CLS, "text-right")}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {DIRECTORY_ROWS.map((e) => (
                    <tr key={e.id} className="transition-colors duration-150 hover:bg-slate-50/70">
                      <td className="px-3 py-2 md:px-4">
                        <EmployeeCell e={e} />
                      </td>
                      <td className="max-md:hidden px-3 py-2 text-slate-600 md:px-4">{e.department}</td>
                      <td className="max-sm:hidden px-3 py-2 md:px-4">
                        <StatusBadge status={e.status} size="sm" />
                      </td>
                      <td className="px-3 py-2 text-right md:px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-700"
                            aria-label={`View employee ${e.name}`}
                            onClick={() =>
                              toast({ title: "View employee", description: `${e.name} — ${e.title}.` })
                            }
                          >
                            <Eye className="h-4 w-4" aria-hidden />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-slate-700"
                                aria-label={`More actions for ${e.name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" aria-hidden />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                onClick={() =>
                                  toast({ title: "Edit employee", description: `Opening editor for ${e.name}.` })
                                }
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  toast({ title: "Deactivate requested", description: `${e.name} will be deactivated.` })
                                }
                              >
                                Deactivate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DSCaption>
              Scroll inside the container — the header row stays pinned (<DSVar>sticky top-0</DSVar>). Row actions: one
              visible affordance, the rest in the overflow menu.
            </DSCaption>
          </div>
        </DSSection>

        {/* ── 6. Expandable rows ─────────────────────────────── */}
        <DSSection
          title="Expandable rows"
          purpose="One level of drill-down, inline. Details open as a quiet strip — never a nested table."
        >
          <div className="space-y-3">
            <div className="qubit-card overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Employee table with expandable detail rows</caption>
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50/95 text-left">
                    <th scope="col" className="w-12 py-2.5 pl-4 pr-1 md:pl-5">
                      <span className="sr-only">Expand</span>
                    </th>
                    <th scope="col" className={cn(TH_CLS, "pl-2")}>
                      Employee
                    </th>
                    <th scope="col" className={cn(TH_CLS, "max-md:hidden")}>
                      Department
                    </th>
                    <th scope="col" className={cn(TH_CLS, "max-sm:hidden")}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {EXPAND_ROWS.map((e) => {
                    const open = expanded.has(e.id);
                    const manager = e.managerId ? getEmployee(e.managerId) : undefined;
                    return (
                      <React.Fragment key={e.id}>
                        <tr className={cn("transition-colors duration-150", open ? "bg-slate-50/70" : "hover:bg-slate-50/70")}>
                          <td className="py-2.5 pl-4 pr-1 md:pl-5">
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-label={`${open ? "Collapse" : "Expand"} details for ${e.name}`}
                              onClick={() => toggleExpand(e.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <ChevronRight
                                className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-90")}
                                aria-hidden
                              />
                            </button>
                          </td>
                          <td className="py-2.5 pl-2 pr-3">
                            <EmployeeCell e={e} />
                          </td>
                          <td className="max-md:hidden px-3 py-2.5 text-slate-600">{e.department}</td>
                          <td className="max-sm:hidden px-3 py-2.5">
                            <StatusBadge status={e.status} size="sm" />
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-50/60">
                            <td colSpan={4} className="px-4 py-4 md:pl-14">
                              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                                <MiniKV label="Email" value={e.email} />
                                <MiniKV label="Location" value={e.location} />
                                <MiniKV label="Manager" value={manager?.name ?? "—"} />
                                <MiniKV label="Phone" value={e.phone} />
                              </dl>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <DSCaption>
              The chevron rotates 90° and the strip opens without animation theatrics. Only one detail level — expanding
              a row never changes the rows around it.
            </DSCaption>
          </div>
        </DSSection>

        {/* ── 7. States ──────────────────────────────────────── */}
        <DSSection
          title="States"
          purpose="Every table has four governed states. Each one explains what happened and offers a way forward."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <DSExample label="Loading — skeleton rows preserve the final layout">
              <div className="qubit-card overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50/95 px-4 py-2.5">
                  <div className="h-2.5 w-28 animate-pulse rounded bg-slate-200" aria-hidden />
                </div>
                <div className="space-y-2 p-3" aria-hidden>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
                <p className="sr-only" role="status">
                  Loading employees…
                </p>
              </div>
            </DSExample>

            <DSExample label="Empty — say what was searched and offer a recovery path">
              <div className="qubit-card overflow-hidden">
                <EmptyState
                  icon={<Inbox />}
                  title="No employees found"
                  message="Try adjusting your search or filters."
                  className="py-10"
                />
              </div>
            </DSExample>

            <DSExample label="Error — one inline banner, one retry, no dead ends">
              <div className="qubit-card overflow-hidden">
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-2 border-b border-red-100 bg-red-50/80 px-4 py-2.5"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
                  <p className="text-[13px] font-medium text-red-700">Unable to load employees</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto h-8 border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => toast({ title: "Retrying…", description: "Fetching employees again." })}
                  >
                    Retry
                  </Button>
                </div>
                <div className="flex items-center justify-center px-6 py-9 text-xs text-slate-400">
                  No rows to display
                </div>
              </div>
            </DSExample>

            <DSExample label="Selected — blue tint plus ring; state is never color-only">
              <div className="qubit-card space-y-2 p-3">
                <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2.5 ring-1 ring-blue-100">
                  <Avatar name={DENSITY_ROWS[0]?.name ?? ""} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-900">{DENSITY_ROWS[0]?.name}</p>
                    <p className="truncate text-xs text-slate-500">{DENSITY_ROWS[0]?.title}</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    Selected
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                  <Avatar name={DENSITY_ROWS[1]?.name ?? ""} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-900">{DENSITY_ROWS[1]?.name}</p>
                    <p className="truncate text-xs text-slate-500">{DENSITY_ROWS[1]?.title}</p>
                  </div>
                  <span className="text-[11px] text-slate-400">Default</span>
                </div>
              </div>
            </DSExample>
          </div>
        </DSSection>

        {/* ── 8. Guidance ────────────────────────────────────── */}
        <DSSection title="Guidance" purpose="What keeps a thousand tables reading as one system.">
          <div className="grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="keep tables quiet and scannable">
              <ul className="list-inside space-y-1.5">
                <li>
                  One hover tone (<DSVar>blue-50/40</DSVar>) and thin dividers (<DSVar>slate-100</DSVar>) — no zebra
                  striping.
                </li>
                <li>
                  Control column widths (<DSVar>minWidth</DSVar>); truncate text, never wrap headers.
                </li>
                <li>Paginate beyond 50 rows and always show the row count and page position.</li>
                <li>Sticky headers on tall or scrollable lists.</li>
              </ul>
            </DSGuidance>
            <DSGuidance kind="dont" title="decorate data or hide the exits">
              <ul className="list-inside space-y-1.5">
                <li>Colored row soup — tint is for selection and status, never decoration.</li>
                <li>12+ visible columns; park the rest behind the Columns menu.</li>
                <li>Toolbars of dense icon buttons — group secondary row actions in an overflow menu.</li>
                <li>Hiding the row count — users must always know how much data they are looking at.</li>
              </ul>
            </DSGuidance>
          </div>
        </DSSection>

        {/* ── Specification ──────────────────────────────────── */}
        <DSSection title="Specification" purpose="The contract this table system follows across Qubit One.">
          <DSSpec
            rows={[
              {
                label: "Purpose",
                value: (
                  <>The default system for scanning, sorting and acting on structured records — anywhere a dataset can outgrow a list.</>
                ),
              },
              {
                label: "Use when",
                value: (
                  <>Comparing records on shared columns, bulk operations, audit and admin lists — anything beyond ~10 rows.</>
                ),
              },
              {
                label: "Avoid when",
                value: (
                  <>Content is narrative or mixed-media (use cards — Screen 19) or the story is a trend over time (use a chart — Screen 20).</>
                ),
              },
              {
                label: "States",
                value: (
                  <>
                    Loading (skeleton rows), empty (<DSVar>EmptyState</DSVar> with recovery copy), error (inline banner +
                    Retry), selected (<DSVar>bg-blue-50 ring-blue-100</DSVar>), hover (
                    <DSVar>bg-blue-50/40</DSVar> on interactive rows only).
                  </>
                ),
              },
              {
                label: "Responsive",
                value: (
                  <>
                    Columns drop progressively via <DSVar>hideBelow</DSVar> (sm → xl); on mobile swap to structured{" "}
                    <DSVar>mobileCard</DSVar> lists; keep 2–3 anchor columns at every width.
                  </>
                ),
              },
              {
                label: "Accessibility",
                value: (
                  <>
                    <DSVar>caption</DSVar> for context, <DSVar>scope=&quot;col&quot;</DSVar> on every header,{" "}
                    <DSVar>aria-sort</DSVar> on the sorted column, keyboard-operable sort headers and rows, 44px minimum
                    row hit targets.
                  </>
                ),
              },
            ]}
          />
        </DSSection>

        <DSScreenNav id="tables" />
      </div>
    </>
  );
}
