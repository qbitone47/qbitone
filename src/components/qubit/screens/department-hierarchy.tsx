"use client";

import * as React from "react";
import {
  Boxes,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MapPin,
  Megaphone,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Server,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  COMPANY_EMPLOYEES,
  COMPANY_NAME,
  departments,
  employees,
  formatCount,
  getDepartment,
  getEmployee,
  type Department,
  type Employee,
} from "@/lib/qubit/data";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import {
  Avatar,
  EmptyState,
  KV,
  ReadOnlyBanner,
  SectionCard,
  StatTile,
  StatusBadge,
  TreeRow,
} from "../primitives";
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

export function DepartmentHierarchyScreen() {
  const { params, navigate } = useQubitNav();
  const { can } = useRole();
  const { toast } = useToast();
  const canEdit = can("structure.edit");

  // Preselect from cross-screen params, falling back to the first department.
  const requestedId =
    params.departmentId && departments.some((d) => d.id === params.departmentId)
      ? params.departmentId
      : departments[0].id;

  const [selectedId, setSelectedId] = React.useState<string>(requestedId);
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set([requestedId]));
  const [drawerEmployee, setDrawerEmployee] = React.useState<Employee | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  React.useEffect(() => {
    const id = params.departmentId;
    if (id && departments.some((d) => d.id === id)) {
      setSelectedId(id);
      setExpanded((s) => new Set(s).add(id));
    }
  }, [params.departmentId]);

  const selected = getDepartment(selectedId) ?? departments[0];
  const head = getEmployee(selected.headId);
  const deptPeople = employees.filter((e) => e.department === selected.name);

  const selectDept = (id: string) => {
    setSelectedId(id);
    setExpanded((s) => new Set(s).add(id));
  };

  const toggleDept = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allExpanded = departments.every((d) => expanded.has(d.id));

  const iconTone = DEPT_TONES[selected.name] ?? DEPT_TONES.Operations;
  const SelectedIcon = DEPT_ICONS[selected.name] ?? Building2;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Enterprise" }, { label: "02. Department Hierarchy" }]}
        title="Department Hierarchy"
        description="Manage the department and sub-department structure — select a department to review its details, sub-teams and mapped people."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() =>
              setExpanded(allExpanded ? new Set<string>() : new Set(departments.map((d) => d.id)))
            }
          >
            {allExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {allExpanded ? "Collapse all" : "Expand all"}
          </Button>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* ── Left pane: department tree ─────────────────────────── */}
        <SectionCard
          title="Department tree"
          description={`${departments.length} departments · ${formatCount(COMPANY_EMPLOYEES)} employees`}
          className="w-full shrink-0 lg:w-80"
          noPadding
        >
          <div
            role="tree"
            aria-label="Department hierarchy"
            className="qubit-scroll max-h-64 overflow-y-auto px-2.5 py-2 lg:max-h-[560px]"
          >
            {/* Company root — not selectable, shows total headcount */}
            <TreeRow
              depth={0}
              expandable={false}
              trailing={
                <span className="text-xs tabular-nums text-slate-400">{formatCount(COMPANY_EMPLOYEES)}</span>
              }
            >
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
                <span className="truncate font-medium text-slate-800">{COMPANY_NAME}</span>
              </span>
            </TreeRow>

            {departments.map((dept) => {
              const Icon = DEPT_ICONS[dept.name] ?? Building2;
              const isOpen = expanded.has(dept.id);
              const isSelected = dept.id === selectedId;
              return (
                <React.Fragment key={dept.id}>
                  <TreeRow
                    depth={1}
                    expandable
                    expanded={isOpen}
                    onToggle={() => toggleDept(dept.id)}
                    selected={isSelected}
                    onClick={() => selectDept(dept.id)}
                    trailing={
                      <span className="text-xs tabular-nums text-slate-400">{dept.employeeCount}</span>
                    }
                  >
                    <span className="flex items-center gap-2">
                      <Icon
                        className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-blue-700" : "text-slate-400")}
                        aria-hidden
                      />
                      <span className="truncate">{dept.name}</span>
                    </span>
                  </TreeRow>

                  {isOpen &&
                    dept.subDepartments.map((sub) => (
                      <TreeRow
                        key={sub.id}
                        depth={2}
                        expandable={false}
                        className="text-xs"
                        trailing={
                          <span className="text-xs tabular-nums text-slate-400">{sub.employeeCount}</span>
                        }
                      >
                        <span className="flex items-center gap-2 text-slate-500">
                          <span className="truncate">{sub.name}</span>
                        </span>
                      </TreeRow>
                    ))}
                </React.Fragment>
              );
            })}
          </div>
        </SectionCard>

        {/* ── Right pane: department detail ──────────────────────── */}
        <SectionCard
          className="min-w-0 flex-1"
          title={
            <span className="flex items-center gap-2.5">
              <span className={cn("qubit-icon-tile h-10 w-10", iconTone.bg, iconTone.fg, "[&_svg]:h-5 [&_svg]:w-5")}>
                <SelectedIcon aria-hidden />
              </span>
              <span>{selected.name}</span>
              <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {selected.code}
              </span>
              <StatusBadge status={selected.status} size="sm" />
            </span>
          }
          actions={
            canEdit && (
              <>
                <Button variant="outline" size="sm" className="h-8" onClick={() => setAddOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Child Department
                </Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400"
                      aria-label={`${selected.name} actions`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => navigate("org-structure", { departmentId: selected.id })}>
                      View in Organization Structure
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-700"
                      onClick={() => setArchiveOpen(true)}
                    >
                      Archive department
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )
          }
        >
          {!canEdit && (
            <ReadOnlyBanner message="You have view-only access — department changes require structure edit permission." />
          )}

          <div className={cn("grid gap-4 sm:grid-cols-3", !canEdit && "mt-3")}>
            <StatTile icon={<Users />} value={selected.employeeCount} label="Employees" />
            <StatTile icon={<Building2 />} value={selected.subDepartments.length} label="Sub-departments" />
            <StatTile icon={<MapPin />} value={selected.locations.length} label="Locations" />
          </div>

          <Tabs defaultValue="overview" className="mt-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="sub">
                Sub-departments <span className="ml-1 text-muted-foreground">({selected.subDepartments.length})</span>
              </TabsTrigger>
              <TabsTrigger value="people">
                People <span className="ml-1 text-muted-foreground">({deptPeople.length})</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="mt-4">
              <dl className="divide-y">
                <KV label="Department Code">
                  <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-slate-600">
                    {selected.code}
                  </span>
                </KV>
                <KV label="Department Head">
                  {head ? (
                    <button
                      type="button"
                      onClick={() => setDrawerEmployee(head)}
                      aria-label={`Open preview for ${head.name}`}
                      className="-ml-1 inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-slate-50"
                    >
                      <Avatar name={head.name} size="sm" />
                      <span>
                        <span className="text-sm font-medium text-slate-800">{head.name}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{head.title}</span>
                      </span>
                    </button>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not assigned</span>
                  )}
                </KV>
                <KV label="Parent Department">{selected.parent}</KV>
                <KV label="Created On">{selected.createdAt}</KV>
                <KV label="Locations">
                  <span className="flex flex-wrap gap-1.5">
                    {selected.locations.map((loc) => (
                      <span
                        key={loc}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200/90 bg-white px-2.5 py-0.5 text-xs text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                      >
                        <MapPin className="h-3 w-3 text-slate-400" aria-hidden />
                        {loc}
                      </span>
                    ))}
                  </span>
                </KV>
                <KV label="Description">
                  <span className="leading-relaxed text-slate-700">{selected.description}</span>
                </KV>
              </dl>
            </TabsContent>

            {/* Sub-departments */}
            <TabsContent value="sub" className="mt-4">
              {selected.subDepartments.length === 0 ? (
                <EmptyState
                  icon={<Building2 />}
                  title="No sub-departments"
                  message="This department has no sub-teams yet."
                />
              ) : (
                <ul className="qubit-card divide-y divide-slate-100 overflow-hidden">
                  {selected.subDepartments.map((sub) => {
                    const subHead = getEmployee(sub.headId);
                    const row = (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-slate-800">{sub.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {subHead ? `Head — ${subHead.name}` : "No head assigned"}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-400">
                          {sub.employeeCount} people
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                      </>
                    );
                    return (
                      <li key={sub.id}>
                        {subHead ? (
                          <button
                            type="button"
                            onClick={() => setDrawerEmployee(subHead)}
                            aria-label={`Open preview for ${subHead.name}`}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                          >
                            {row}
                          </button>
                        ) : (
                          <div className="flex w-full items-center gap-3 px-3 py-2.5">{row}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full border-dashed text-blue-600 hover:bg-blue-50/60 hover:text-blue-700"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add sub-department
                </Button>
              )}
            </TabsContent>

            {/* People */}
            <TabsContent value="people" className="mt-4">
              {deptPeople.length === 0 ? (
                <EmptyState
                  icon={<Users />}
                  title="No mapped employees"
                  message="No employee records are mapped to this department yet."
                />
              ) : (
                <ul className="qubit-card divide-y divide-slate-100 overflow-hidden">
                  {deptPeople.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setDrawerEmployee(p)}
                        aria-label={`Open preview for ${p.name}`}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                      >
                        <Avatar name={p.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-slate-800">{p.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{p.title}</span>
                        </span>
                        <StatusBadge status={p.status} size="sm" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                Showing mapped records — full directory in the People module.
              </p>
            </TabsContent>
          </Tabs>
        </SectionCard>
      </div>

      {/* Employee preview */}
      <EmployeeDrawer
        employee={drawerEmployee}
        open={!!drawerEmployee}
        onOpenChange={(o) => !o && setDrawerEmployee(null)}
      />

      {/* Add child / sub-department */}
      <AddChildDepartmentDialog open={addOpen} onOpenChange={setAddOpen} department={selected} />

      {/* Edit department */}
      {canEdit && (
        <FormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          title={`Edit — ${selected.name}`}
          onSubmit={() => {
            toast({
              title: "Department updated",
              description: `${selected.name} saved. Changes propagate across Enterprise screens.`,
            });
            setEditOpen(false);
          }}
        >
          <Field label="Department name" required>
            <Input defaultValue={selected.name} className="h-10" />
          </Field>
          <Field label="Department code" required hint="Short code used across modules (e.g. SAL, FIN).">
            <Input defaultValue={selected.code} maxLength={4} className="h-10" />
          </Field>
          <Field label="Department head" required>
            <Select defaultValue={selected.headId}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
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
            <Textarea rows={3} defaultValue={selected.description} />
          </Field>
        </FormDialog>
      )}

      {/* Archive confirm */}
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive ${selected.name}?`}
        destructive
        confirmLabel="Archive department"
        description={
          <>
            The department will be hidden from the active structure but retained for history and reporting.
            <span className="mt-2 block rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {selected.employeeCount} employees and {selected.subDepartments.length} sub-departments must be
              reassigned first.
            </span>
          </>
        }
        onConfirm={() => {
          toast({
            title: "Archive blocked",
            description: "Reassign employees and sub-departments before archiving.",
          });
          setArchiveOpen(false);
        }}
      />
    </div>
  );
}

function AddChildDepartmentDialog({
  open,
  onOpenChange,
  department,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  department: Department;
}) {
  const { toast } = useToast();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Add child department — ${department.name}`}
      description="Child departments roll up into the parent's headcount and governance."
      submitLabel="Create department"
      onSubmit={() => {
        toast({
          title: "Sub-department created",
          description: `Added to ${department.name}. It now appears in the hierarchy tree and department tabs.`,
        });
        onOpenChange(false);
      }}
    >
      <Field label="Department name" required>
        <Input placeholder="e.g. Channel Partners" className="h-10" />
      </Field>
      <Field label="Department head" hint="Optional — can be assigned later.">
        <Select>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Select an employee" />
          </SelectTrigger>
          <SelectContent>
            {employees.slice(0, 12).map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} — {e.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Employee count" required>
        <Input type="number" min={0} placeholder="0" className="h-10" />
      </Field>
    </FormDialog>
  );
}
