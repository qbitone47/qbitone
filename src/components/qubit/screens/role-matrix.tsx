"use client";

import * as React from "react";
import { BadgeCheck, MoreHorizontal, Plus, ShieldCheck } from "lucide-react";
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
import { roles, departments, type Role } from "@/lib/qubit/data";
import { useQubitNav } from "../nav-context";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { DataTable, type Column } from "../data-table";
import { FilterBar, KV, SearchInput, StatusBadge } from "../primitives";
import { DetailDrawer } from "../drawers";
import { Field, FormDialog } from "../dialogs";

const LEVEL_BADGE: Record<string, string> = {
  Executive: "bg-navy-900 text-white",
  "Level 2": "bg-navy-100 text-navy-800",
  "Level 3": "bg-slate-100 text-slate-700",
  "Level 4": "bg-slate-50 text-slate-600 border border-slate-200",
};

export function RoleMatrixScreen() {
  const { navigate } = useQubitNav();
  const { can } = useRole();
  const { toast } = useToast();
  const canEdit = can("governance.edit");

  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [level, setLevel] = React.useState("all");
  const [detail, setDetail] = React.useState<Role | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editRole, setEditRole] = React.useState<Role | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      roles.filter((r) => {
        if (dept !== "all" && r.department !== dept) return false;
        if (status !== "all" && r.status !== status) return false;
        if (level !== "all" && r.reportingLevel !== level) return false;
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q) ||
          r.permissionsSummary.toLowerCase().includes(q)
        );
      }),
    [q, dept, status, level],
  );

  const filtersActive = q !== "" || dept !== "all" || status !== "all" || level !== "all";
  const clearFilters = () => {
    setQuery("");
    setDept("all");
    setStatus("all");
    setLevel("all");
  };

  const columns: Column<Role>[] = [
    {
      key: "name",
      header: "Role Name",
      sortable: true,
      sortValue: (r) => r.name,
      minWidth: 180,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-navy-50 text-navy-700">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-slate-900">{r.name}</p>
            <p className="max-w-64 truncate text-[11px] text-muted-foreground">{r.purpose}</p>
          </div>
        </div>
      ),
    },
    {
      key: "department",
      header: "Department",
      sortable: true,
      sortValue: (r) => r.department,
      render: (r) => <span className="whitespace-nowrap text-[13px]">{r.department}</span>,
    },
    {
      key: "level",
      header: "Reporting Level",
      sortable: true,
      sortValue: (r) => r.reportingLevel,
      render: (r) => (
        <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${LEVEL_BADGE[r.reportingLevel]}`}>
          {r.reportingLevel}
        </span>
      ),
    },
    {
      key: "employees",
      header: "Employees",
      sortable: true,
      sortValue: (r) => r.employees,
      className: "tabular-nums",
      render: (r) => <span className="text-[13px] font-medium text-slate-800">{r.employees}</span>,
    },
    {
      key: "permissions",
      header: "Permission Summary",
      hideBelow: "lg",
      render: (r) => <span className="line-clamp-1 max-w-56 text-xs text-muted-foreground">{r.permissionsSummary}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} size="sm" />,
    },
    {
      key: "modified",
      header: "Last Modified",
      sortable: true,
      sortValue: (r) => r.lastModified,
      hideBelow: "xl",
      render: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{r.lastModified}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "w-10 text-right",
      headerClassName: "text-right",
      render: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400"
              aria-label={`Actions for ${r.name}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setDetail(r)}>View details</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("permission-matrix")}>
              <ShieldCheck className="h-3.5 w-3.5" /> Configure permissions
            </DropdownMenuItem>
            {canEdit && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setEditRole(r)}>Edit role</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    toast({ title: "Role duplicated", description: `${r.name} (copy) created as Draft for editing.` })
                  }
                >
                  Duplicate as draft
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Enterprise" }, { label: "03. Role Matrix" }]}
        title="Role Matrix"
        description="The authoritative catalog of organizational roles — reporting levels, team sizes and permission boundaries. Cell-level permissions live in the Permission Matrix."
        actions={
          canEdit && (
            <Button size="sm" className="h-9" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Create Role
            </Button>
          )
        }
      />

      <FilterBar className="mb-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search roles…"
          className="w-full sm:w-64"
          ariaLabel="Search roles"
        />
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="h-9 w-full sm:w-40" aria-label="Filter by department">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {[...new Set(roles.map((r) => r.department))].map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-full sm:w-32" aria-label="Filter by status">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="h-9 w-full sm:w-36" aria-label="Filter by reporting level">
            <SelectValue placeholder="All levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="Executive">Executive</SelectItem>
            <SelectItem value="Level 2">Level 2</SelectItem>
            <SelectItem value="Level 3">Level 3</SelectItem>
            <SelectItem value="Level 4">Level 4</SelectItem>
          </SelectContent>
        </Select>
        <p className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {roles.length} roles
          {filtersActive && (
            <>
              {" · "}
              <button type="button" onClick={clearFilters} className="font-medium text-navy-600 hover:text-navy-800">
                Clear filters
              </button>
            </>
          )}
        </p>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        onRowClick={(r) => setDetail(r)}
        pageSize={8}
        caption="Organizational roles"
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                {r.name}
                <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${LEVEL_BADGE[r.reportingLevel]}`}>
                  {r.reportingLevel}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {r.department} · {r.employees} employees
              </p>
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{r.permissionsSummary}</p>
            </div>
            <StatusBadge status={r.status} size="sm" />
          </div>
        )}
      />

      {/* Role detail drawer */}
      <DetailDrawer
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail?.name ?? ""}
        subtitle={detail ? `${detail.department} · ${detail.reportingLevel}` : undefined}
        icon={<BadgeCheck />}
        footer={
          canEdit && detail ? (
            <Button size="sm" variant="outline" className="h-8" onClick={() => { setEditRole(detail); setDetail(null); }}>
              Edit role
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Read-only — role changes require an administrator.</p>
          )
        }
      >
        {detail && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} size="sm" />
              <span className="text-xs text-muted-foreground">Last modified {detail.lastModified}</span>
            </div>
            <dl className="divide-y">
              <KV label="Purpose">{detail.purpose}</KV>
              <KV label="Department">{detail.department}</KV>
              <KV label="Reporting level">{detail.reportingLevel}</KV>
              <KV label="Employees assigned">{detail.employees}</KV>
              <KV label="Permissions summary">{detail.permissionsSummary}</KV>
              <KV label="Approval authority">{detail.approvalAuthority}</KV>
              <KV label="Data access boundary">{detail.dataBoundary}</KV>
            </dl>
            <button
              type="button"
              onClick={() => { setDetail(null); navigate("permission-matrix"); }}
              className="mt-4 flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left transition-colors hover:border-navy-300 hover:bg-navy-50/60"
            >
              <span>
                <span className="block text-[13px] font-medium text-slate-800">Open Permission Matrix</span>
                <span className="block text-[11px] text-muted-foreground">Cell-level access for this role</span>
              </span>
              <ShieldCheck className="h-4 w-4 text-navy-600" aria-hidden />
            </button>
          </>
        )}
      </DetailDrawer>

      {/* Create role */}
      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Role"
        description="New roles start as Draft and gain governance rights only after permissions are configured."
        submitLabel="Create role"
        onSubmit={() => {
          toast({ title: "Role created as Draft", description: "Configure its permissions in the Permission Matrix before activation." });
          setCreateOpen(false);
        }}
      >
        <Field label="Role name" required>
          <Input placeholder="e.g. Regional Sales Lead" />
        </Field>
        <Field label="Department" required>
          <Select>
            <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Reporting level" required>
          <Select>
            <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="l2">Level 2</SelectItem>
              <SelectItem value="l3">Level 3</SelectItem>
              <SelectItem value="l4">Level 4</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Role purpose">
          <Textarea rows={3} placeholder="What is this role accountable for?" />
        </Field>
      </FormDialog>

      {/* Edit role */}
      {editRole && (
        <FormDialog
          open={!!editRole}
          onOpenChange={(o) => !o && setEditRole(null)}
          title={`Edit — ${editRole.name}`}
          onSubmit={() => {
            toast({ title: "Role updated", description: `${editRole.name} saved. Changes recorded in audit history.` });
            setEditRole(null);
          }}
        >
          <Field label="Role name" required>
            <Input defaultValue={editRole.name} />
          </Field>
          <Field label="Reporting level" required>
            <Select defaultValue={editRole.reportingLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Executive">Executive</SelectItem>
                <SelectItem value="Level 2">Level 2</SelectItem>
                <SelectItem value="Level 3">Level 3</SelectItem>
                <SelectItem value="Level 4">Level 4</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Role purpose">
            <Textarea rows={3} defaultValue={editRole.purpose} />
          </Field>
        </FormDialog>
      )}
    </div>
  );
}
