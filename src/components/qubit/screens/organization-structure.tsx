"use client";

import * as React from "react";
import {
  Boxes,
  Building2,
  ChevronDown,
  ChevronUp,
  Megaphone,
  MoreHorizontal,
  Package,
  Plus,
  Server,
  Settings2,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  COMPANY_EMPLOYEES,
  COMPANY_NAME,
  departments,
  employees,
  getEmployee,
  searchEmployees,
  type Department,
  type Employee,
} from "@/lib/qubit/data";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { Avatar, FilterBar, SearchInput, StatusBadge } from "../primitives";
import { EmployeeDrawer } from "../drawers";
import { ConfirmDialog, Field, FormDialog } from "../dialogs";

const DEPT_ICONS: Record<string, React.ElementType> = {
  Sales: TrendingUp,
  Finance: Wallet,
  "HR & People": Users,
  Marketing: Megaphone,
  Service: Wrench,
  Inventory: Package,
  "IT & Technology": Server,
  Operations: Boxes,
};

const DEPT_TONES: Record<string, { bg: string; fg: string }> = {
  Sales: { bg: "bg-blue-50", fg: "text-blue-700" },
  Finance: { bg: "bg-emerald-50", fg: "text-emerald-700" },
  "HR & People": { bg: "bg-violet-50", fg: "text-violet-700" },
  Marketing: { bg: "bg-rose-50", fg: "text-rose-700" },
  Service: { bg: "bg-amber-50", fg: "text-amber-700" },
  Inventory: { bg: "bg-teal-50", fg: "text-teal-700" },
  "IT & Technology": { bg: "bg-cyan-50", fg: "text-cyan-700" },
  Operations: { bg: "bg-slate-100", fg: "text-slate-600" },
};

export function OrganizationStructureScreen() {
  const { params, navigate } = useQubitNav();
  const { can } = useRole();
  const { toast } = useToast();
  const canEdit = can("structure.edit");

  const [query, setQuery] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState<string>("all");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [drawerEmployee, setDrawerEmployee] = React.useState<Employee | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [subDeptFor, setSubDeptFor] = React.useState<Department | null>(null);
  const [editDept, setEditDept] = React.useState<Department | null>(null);
  const [archiveDept, setArchiveDept] = React.useState<Department | null>(null);

  React.useEffect(() => {
    if (params.departmentId) {
      setExpanded((s) => new Set(s).add(params.departmentId!));
      setDeptFilter(params.departmentId);
    }
  }, [params.departmentId]);

  const q = query.trim().toLowerCase();
  const visibleDepts = React.useMemo(
    () =>
      departments.filter((d) => {
        if (deptFilter !== "all" && d.id !== deptFilter) return false;
        if (!q) return true;
        const head = getEmployee(d.headId);
        return (
          d.name.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          d.subDepartments.some((s) => s.name.toLowerCase().includes(q)) ||
          (head && head.name.toLowerCase().includes(q))
        );
      }),
    [q, deptFilter],
  );

  const peopleMatches = React.useMemo(() => (q.length >= 2 ? searchEmployees(query) : []), [q, query]);
  const totalSubs = departments.reduce((a, d) => a + d.subDepartments.length, 0);
  const ceo = getEmployee("sagar")!;

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allExpanded = visibleDepts.length > 0 && visibleDepts.every((d) => expanded.has(d.id));

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Enterprise" }, { label: "01. Organization Structure" }]}
        title="Organization Structure"
        description="Complete view of company hierarchy and reporting structure — leadership, departments, sub-departments and team sizes."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() =>
                setExpanded(allExpanded ? new Set() : new Set(visibleDepts.map((d) => d.id)))
              }
              disabled={visibleDepts.length === 0}
            >
              {allExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {allExpanded ? "Collapse all" : "Expand all"}
            </Button>
            {canEdit && (
              <Button size="sm" className="h-9" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add Department
              </Button>
            )}
          </>
        }
      />

      <FilterBar className="mb-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search departments, sub-departments or employees…"
          className="w-full sm:w-80"
          ariaLabel="Search organization"
        />
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Filter by department">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="ml-auto hidden text-xs text-muted-foreground md:block">
          {visibleDepts.length} of {departments.length} departments · {totalSubs} sub-departments
        </p>
      </FilterBar>

      {/* People search results */}
      {peopleMatches.length > 0 && (
        <div className="mb-4 rounded-lg border bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">People matching “{query}”</p>
          <div className="flex flex-wrap gap-2">
            {peopleMatches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDrawerEmployee(p)}
                className="flex items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-3 text-left transition-colors hover:border-navy-300 hover:bg-navy-50/60"
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

      {/* Company root */}
      <div className="mx-auto max-w-md">
        <button
          type="button"
          onClick={() => setDrawerEmployee(ceo)}
          className="group w-full rounded-xl border bg-white p-4 text-center shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-colors hover:border-navy-300"
        >
          <p className="flex items-center justify-center gap-1.5 text-[15px] font-semibold text-slate-900">
            <Building2 className="h-4 w-4 text-navy-600" aria-hidden />
            {COMPANY_NAME}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {COMPANY_EMPLOYEES.toLocaleString("en-IN")} employees · 8 departments · 7 locations
          </p>
          <span className="mt-3 inline-flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 transition-colors group-hover:border-navy-200 group-hover:bg-navy-50">
            <Avatar name={ceo.name} size="md" />
            <span className="text-left">
              <span className="block text-sm font-medium text-slate-900">{ceo.name}</span>
              <span className="block text-xs text-muted-foreground">{ceo.title}</span>
            </span>
          </span>
        </button>
      </div>

      {/* Connector: CEO → rail → first row of departments (lg+) */}
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

      {/* Departments grid */}
      {visibleDepts.length === 0 ? (
        <div className="rounded-lg border bg-white">
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            No departments match “{query}”. Clear the search or filter to see the full structure.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visibleDepts.map((d) => {
            const Icon = DEPT_ICONS[d.name] ?? Building2;
            const tone = DEPT_TONES[d.name] ?? DEPT_TONES.Operations;
            const head = getEmployee(d.headId);
            const isOpen = expanded.has(d.id);
            return (
              <div
                key={d.id}
                className={cn(
                  "flex flex-col rounded-lg border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors",
                  isOpen ? "border-navy-300" : "hover:border-slate-300",
                )}
              >
                <div className="flex items-start justify-between gap-2 px-3.5 pt-3.5">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", tone.bg, tone.fg)}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{d.name}</p>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{d.code}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-slate-400" aria-label={`${d.name} actions`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => { setExpanded((s) => new Set(s).add(d.id)); navigate("dept-hierarchy", { departmentId: d.id }); }}>
                        View in Department Hierarchy
                      </DropdownMenuItem>
                      {canEdit && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setSubDeptFor(d)}>Add sub-department</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditDept(d)}>Edit department</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600 focus:text-red-700" onClick={() => setArchiveDept(d)}>
                            Archive department
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <button
                  type="button"
                  onClick={() => head && setDrawerEmployee(head)}
                  className="mt-3 mx-3.5 flex items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-slate-200 hover:bg-slate-50"
                  aria-label={`Open preview for ${head?.name}`}
                >
                  <Avatar name={head?.name ?? "?"} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-slate-800">{head?.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{head?.title}</span>
                  </span>
                </button>

                <div className="mt-3 flex items-center gap-3 border-t px-3.5 py-2.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" aria-hidden /> {d.employeeCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3" aria-hidden /> {d.subDepartments.length} sub-depts
                  </span>
                  <span className="inline-flex items-center gap-1 truncate">
                    <Settings2 className="h-3 w-3" aria-hidden /> {d.locations.length} locations
                  </span>
                </div>

                {isOpen && (
                  <div className="border-t bg-slate-50/60 px-3.5 py-2.5">
                    <ul className="space-y-1">
                      {d.subDepartments.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-2 text-slate-700">
                            <span aria-hidden className="h-3 w-px bg-slate-300" />
                            <span className="truncate">{s.name}</span>
                          </span>
                          <span className="tabular-nums text-slate-400">{s.employeeCount}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggle(d.id)}
                  aria-expanded={isOpen}
                  className="mt-auto flex items-center justify-center gap-1 border-t py-2 text-[11px] font-medium text-navy-600 transition-colors hover:bg-navy-50"
                >
                  {isOpen ? "Hide sub-departments" : `Show ${d.subDepartments.length} sub-departments`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Headcount mapped to Qubit One org units:{" "}
        <span className="font-medium text-slate-700">{departments.reduce((a, d) => a + d.employeeCount, 0).toLocaleString("en-IN")}</span> of{" "}
        {COMPANY_EMPLOYEES.toLocaleString("en-IN")} employees · remaining staff are in shared corporate functions.
      </p>

      {/* Employee preview */}
      <EmployeeDrawer employee={drawerEmployee} open={!!drawerEmployee} onOpenChange={(o) => !o && setDrawerEmployee(null)} />

      {/* Add department */}
      <AddDepartmentDialog open={addOpen} onOpenChange={setAddOpen} />

      {/* Add sub-department */}
      {subDeptFor && (
        <FormDialog
          open={!!subDeptFor}
          onOpenChange={(o) => !o && setSubDeptFor(null)}
          title={`Add sub-department — ${subDeptFor.name}`}
          description="Sub-departments roll up into the parent department's headcount and governance."
          onSubmit={() => {
            toast({ title: "Sub-department created", description: `Added to ${subDeptFor.name}. It now appears in the hierarchy and Department Hierarchy screen.` });
            setSubDeptFor(null);
          }}
          submitLabel="Create sub-department"
        >
          <Field label="Sub-department name" required>
            <Input placeholder="e.g. Inside Sales" />
          </Field>
          <Field label="Sub-department head" hint="Optional — can be assigned later.">
            <Select>
              <SelectTrigger><SelectValue placeholder="Select an employee" /></SelectTrigger>
              <SelectContent>{employees.slice(0, 12).map((e) => <SelectItem key={e.id} value={e.id}>{e.name} — {e.title}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Employee count" required>
            <Input type="number" min={0} placeholder="0" />
          </Field>
        </FormDialog>
      )}

      {/* Edit department */}
      {editDept && (
        <FormDialog
          open={!!editDept}
          onOpenChange={(o) => !o && setEditDept(null)}
          title={`Edit — ${editDept.name}`}
          onSubmit={() => {
            toast({ title: "Department updated", description: `${editDept.name} changes saved to the org structure.` });
            setEditDept(null);
          }}
        >
          <Field label="Department name" required>
            <Input defaultValue={editDept.name} />
          </Field>
          <Field label="Department code" required>
            <Input defaultValue={editDept.code} maxLength={4} />
          </Field>
          <Field label="Department head" required>
            <Select defaultValue={editDept.headId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{employees.slice(0, 10).map((e) => <SelectItem key={e.id} value={e.id}>{e.name} — {e.title}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Description">
            <Textarea rows={3} defaultValue={editDept.description} />
          </Field>
        </FormDialog>
      )}

      {/* Archive confirm */}
      <ConfirmDialog
        open={!!archiveDept}
        onOpenChange={(o) => !o && setArchiveDept(null)}
        title={`Archive ${archiveDept?.name}?`}
        destructive
        confirmLabel="Archive department"
        description={
          <>
            The department will be hidden from the active structure but retained for history and reporting.
            {archiveDept && (
              <span className="mt-2 block rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                {archiveDept.employeeCount} employees and {archiveDept.subDepartments.length} sub-departments must be reassigned first.
              </span>
            )}
          </>
        }
        onConfirm={() => {
          toast({ title: "Archive blocked", description: "Reassign employees and sub-departments before archiving." });
          setArchiveDept(null);
        }}
      />
    </div>
  );
}

function AddDepartmentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add Department"
      description="New departments report to Qubit One Pvt Ltd and appear across Enterprise screens."
      submitLabel="Create department"
      onSubmit={() => {
        toast({ title: "Department created", description: "It now appears in Organization Structure, Department Hierarchy and governance screens." });
        onOpenChange(false);
      }}
    >
      <Field label="Department name" required>
        <Input placeholder="e.g. Customer Success" />
      </Field>
      <Field label="Department code" required hint="Short code used across modules (e.g. SAL, FIN).">
        <Input placeholder="e.g. CUS" maxLength={4} />
      </Field>
      <Field label="Department head" required>
        <Select>
          <SelectTrigger><SelectValue placeholder="Select a department head" /></SelectTrigger>
          <SelectContent>
            {employees.slice(0, 10).map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} — {e.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Description">
        <Textarea rows={3} placeholder="What does this department own?" />
      </Field>
    </FormDialog>
  );
}
