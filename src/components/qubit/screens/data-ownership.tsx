"use client";

import * as React from "react";
import { Database, MoreHorizontal, Plus, ShieldAlert } from "lucide-react";
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
import {
  dataDomains,
  employees,
  getEmployee,
  type DataDomain,
  type Employee,
  type Sensitivity,
} from "@/lib/qubit/data";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { DataTable, type Column } from "../data-table";
import { Avatar, FilterBar, KV, ReadOnlyBanner, SearchInput, StatusBadge } from "../primitives";
import { DetailDrawer, EmployeeDrawer } from "../drawers";
import { Field, FormDialog } from "../dialogs";

// ============================================================
// Local types & helpers (no shared-file changes needed)
// ============================================================
type DomainRow = DataDomain & { description?: string };
type DomainOverride = Partial<DomainRow>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SENSITIVITY_LEVELS: Sensitivity[] = ["Public", "Internal", "Confidential", "Restricted"];
const DOMAIN_DEPARTMENTS = [...new Set(dataDomains.map((d) => d.ownerDepartment))];

/** Parse the "2 Sep 2025" style dates used across Qubit One data. */
function parseDateStr(s: string): Date | null {
  const m = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/.exec(s.trim());
  if (m) {
    const mi = MONTHS.findIndex((mm) => mm.toLowerCase() === m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) return new Date(Number(m[3]), mi, Number(m[1]));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function addMonths(d: Date, n: number): Date {
  const c = new Date(d);
  c.setMonth(c.getMonth() + n);
  return c;
}

interface DomainFormState {
  name: string;
  ownerDepartment: string;
  ownerRole: string;
  stewardId: string;
  sensitivity: Sensitivity;
  retention: string;
  description: string;
}

const EMPTY_DOMAIN_FORM: DomainFormState = {
  name: "",
  ownerDepartment: "",
  ownerRole: "",
  stewardId: "",
  sensitivity: "Internal",
  retention: "",
  description: "",
};

// ============================================================
// Screen 07 — Data Ownership (governance control center)
// ============================================================
export function DataOwnershipScreen() {
  const { can } = useRole();
  const { toast } = useToast();
  const canEdit = can("governance.edit");

  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState("all");
  const [sens, setSens] = React.useState("all");
  const [overrides, setOverrides] = React.useState<Record<string, DomainOverride>>({});
  const [extraDomains, setExtraDomains] = React.useState<DomainRow[]>([]);
  const [detail, setDetail] = React.useState<DomainRow | null>(null);
  const [previewEmployee, setPreviewEmployee] = React.useState<Employee | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [addForm, setAddForm] = React.useState<DomainFormState>(EMPTY_DOMAIN_FORM);
  const [editDomain, setEditDomain] = React.useState<DomainRow | null>(null);
  const [editForm, setEditForm] = React.useState<DomainFormState>(EMPTY_DOMAIN_FORM);

  // Effective catalog = newly created domains + seeded data + local governance updates
  const merged = React.useMemo<DomainRow[]>(
    () => [...extraDomains, ...dataDomains].map((d) => ({ ...d, ...overrides[d.id] })),
    [extraDomains, overrides],
  );

  const underReview = merged.filter((d) => d.status === "Under Review");

  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      merged.filter((d) => {
        if (dept !== "all" && d.ownerDepartment !== dept) return false;
        if (sens !== "all" && d.sensitivity !== sens) return false;
        if (!q) return true;
        const steward = getEmployee(d.stewardId);
        return (
          d.name.toLowerCase().includes(q) ||
          d.ownerDepartment.toLowerCase().includes(q) ||
          d.ownerRole.toLowerCase().includes(q) ||
          (steward ? steward.name.toLowerCase().includes(q) : false)
        );
      }),
    [merged, dept, sens, q],
  );

  const restrictedCount = filtered.filter((d) => d.sensitivity === "Restricted").length;
  const filtersActive = q !== "" || dept !== "all" || sens !== "all";
  const clearFilters = () => {
    setQuery("");
    setDept("all");
    setSens("all");
  };

  // ---- governance actions (admin only) ----
  const recordReview = (d: DomainRow) => {
    const today = new Date();
    setOverrides((o) => ({
      ...o,
      [d.id]: { ...o[d.id], status: "Active", lastReview: fmtDate(today) },
    }));
    toast({
      title: "Review recorded",
      description: `${d.name} marked reviewed — next review scheduled ${fmtDate(addMonths(today, 6))}.`,
    });
  };

  const reviewNow = () => {
    if (underReview.length === 0) return;
    const today = new Date();
    const anchor = parseDateStr(underReview[0].lastReview) ?? today;
    setOverrides((o) => {
      const patch: Record<string, DomainOverride> = {};
      for (const d of underReview) {
        patch[d.id] = { ...o[d.id], status: "Active", lastReview: fmtDate(today) };
      }
      return { ...o, ...patch };
    });
    toast({
      title: "Review recorded",
      description: `${underReview.length} domain${underReview.length === 1 ? "" : "s"} cleared — next review scheduled ${fmtDate(addMonths(anchor, 6))}.`,
    });
  };

  const openEdit = (d: DomainRow) => {
    setEditForm({
      name: d.name,
      ownerDepartment: d.ownerDepartment,
      ownerRole: d.ownerRole,
      stewardId: d.stewardId,
      sensitivity: d.sensitivity,
      retention: d.retention,
      description: d.description ?? "",
    });
    setEditDomain(d);
  };

  const submitEdit = () => {
    if (!editDomain) return;
    const name = editForm.name.trim() || editDomain.name;
    setOverrides((o) => ({
      ...o,
      [editDomain.id]: { ...o[editDomain.id], ...editForm, name },
    }));
    toast({
      title: "Ownership updated",
      description: `${name} saved — changes recorded in the governance audit history.`,
    });
    setEditDomain(null);
  };

  const submitAdd = () => {
    const name = addForm.name.trim() || "Untitled Domain";
    const steward = getEmployee(addForm.stewardId);
    const created: DomainRow = {
      id: `dd-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name,
      ownerDepartment: addForm.ownerDepartment || "Operations",
      ownerRole: addForm.ownerRole.trim() || "Owner to be assigned",
      stewardId: addForm.stewardId,
      accessLevel: "Permission-based (default)",
      sensitivity: addForm.sensitivity,
      retention: addForm.retention.trim() || "To be defined",
      status: "Active",
      lastReview: fmtDate(new Date()),
      records: "New domain — no records yet",
      systems: [],
      description: addForm.description.trim() || undefined,
    };
    setExtraDomains((x) => [created, ...x]);
    toast({
      title: "Data domain created",
      description: `${name} registered under ${created.ownerDepartment} with steward ${steward ? steward.name : "unassigned"}.`,
    });
    setAddOpen(false);
    setAddForm(EMPTY_DOMAIN_FORM);
  };

  const columns: Column<DomainRow>[] = [
    {
      key: "name",
      header: "Data Domain",
      sortable: true,
      sortValue: (d) => d.name,
      minWidth: 180,
      render: (d) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-slate-900">{d.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{d.records}</p>
        </div>
      ),
    },
    {
      key: "ownerDepartment",
      header: "Owner Department",
      sortable: true,
      sortValue: (d) => d.ownerDepartment,
      render: (d) => <span className="whitespace-nowrap text-[13px]">{d.ownerDepartment}</span>,
    },
    {
      key: "ownerRole",
      header: "Owner Role",
      sortable: true,
      sortValue: (d) => d.ownerRole,
      render: (d) => <span className="whitespace-nowrap text-[13px] text-slate-600">{d.ownerRole}</span>,
    },
    {
      key: "steward",
      header: "Data Steward",
      sortable: true,
      sortValue: (d) => getEmployee(d.stewardId)?.name ?? "",
      render: (d) => {
        const steward = getEmployee(d.stewardId);
        return (
          <span className="flex items-center gap-2">
            {steward && <Avatar name={steward.name} size="xs" />}
            <span className="whitespace-nowrap text-[13px]">{steward ? steward.name : "Unassigned"}</span>
          </span>
        );
      },
    },
    {
      key: "access",
      header: "Access Level",
      hideBelow: "lg",
      render: (d) => (
        <span className="line-clamp-1 max-w-52 text-xs text-muted-foreground" title={d.accessLevel}>
          {d.accessLevel}
        </span>
      ),
    },
    {
      key: "sensitivity",
      header: "Sensitivity",
      sortable: true,
      sortValue: (d) => d.sensitivity,
      render: (d) => <StatusBadge status={d.sensitivity} size="sm" />,
    },
    {
      key: "retention",
      header: "Retention",
      hideBelow: "xl",
      render: (d) => (
        <span className="line-clamp-1 max-w-40 text-xs text-muted-foreground" title={d.retention}>
          {d.retention}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (d) => d.status,
      render: (d) => <StatusBadge status={d.status} size="sm" />,
    },
    {
      key: "lastReview",
      header: "Last Review",
      sortable: true,
      sortValue: (d) => parseDateStr(d.lastReview)?.getTime() ?? 0,
      hideBelow: "md",
      render: (d) => <span className="whitespace-nowrap text-xs text-muted-foreground">{d.lastReview}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "w-10 text-right",
      headerClassName: "text-right",
      render: (d) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400"
              aria-label={`Actions for ${d.name}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setDetail(d)}>View governance details</DropdownMenuItem>
            {canEdit && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openEdit(d)}>Edit ownership</DropdownMenuItem>
                <DropdownMenuItem onClick={() => recordReview(d)}>Record review</DropdownMenuItem>
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
        crumbs={[{ label: "Enterprise" }, { label: "07. Data Ownership" }]}
        title="Data Ownership"
        description="Enterprise data-governance control center — accountable owners, stewards, sensitivity and retention for every governed data domain."
        actions={
          canEdit && (
            <Button size="sm" className="h-9" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add Data Domain
            </Button>
          )
        }
      />

      {!canEdit && <ReadOnlyBanner message="You have view-only access to governance records." />}

      {/* Governance alert */}
      {underReview.length > 0 && (
        <div
          className="mt-4 mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <span className="qubit-icon-tile h-10 w-10 shrink-0 bg-amber-100 text-amber-700 [&_svg]:h-5 [&_svg]:w-5">
              <ShieldAlert className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-[13px] leading-relaxed text-amber-900">
              {underReview.length} data domain{underReview.length === 1 ? " is" : "s are"} pending governance
              review —{" "}
              {underReview.map((d) => `${d.name}, last reviewed ${d.lastReview}`).join("; ")}.
            </p>
          </div>
          {canEdit && (
            <Button size="sm" className="h-8 shrink-0" onClick={reviewNow}>
              Review now
            </Button>
          )}
        </div>
      )}

      <FilterBar
        className={underReview.length > 0 ? "mb-4" : "mt-4 mb-4"}
        left={
          <>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search data domain…"
              className="w-full sm:w-64"
              ariaLabel="Search data domain"
            />
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-10 w-full sm:w-44" aria-label="Filter by owner department">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {DOMAIN_DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sens} onValueChange={setSens}>
              <SelectTrigger className="h-10 w-full sm:w-40" aria-label="Filter by sensitivity">
                <SelectValue placeholder="All sensitivity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sensitivity</SelectItem>
                {SENSITIVITY_LEVELS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        right={
          <p className="text-xs text-muted-foreground">
            {filtered.length} domain{filtered.length === 1 ? "" : "s"} · {restrictedCount} restricted
            {filtersActive && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-medium text-blue-600 hover:text-blue-700"
                >
                  Clear filters
                </button>
              </>
            )}
          </p>
        }
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(d) => d.id}
        onRowClick={(d) => setDetail(d)}
        pageSize={8}
        caption="Governed data domains"
        emptyTitle="No data domains match"
        emptyMessage="Try a different search term or filter combination."
        mobileCard={(d) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{d.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{d.records}</p>
              <p className="mt-1.5 truncate text-xs text-slate-600">
                {d.ownerDepartment} · {d.ownerRole}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <StatusBadge status={d.sensitivity} size="sm" />
              <StatusBadge status={d.status} size="sm" />
            </div>
          </div>
        )}
      />

      {/* Domain governance drawer */}
      <DetailDrawer
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail?.name ?? ""}
        subtitle={detail ? `${detail.ownerDepartment} · ${detail.ownerRole}` : undefined}
        icon={<Database />}
        footer={
          canEdit && detail ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => {
                const d = detail;
                setDetail(null);
                openEdit(d);
              }}
            >
              Edit ownership
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Read-only — data ownership changes require an administrator.
            </p>
          )
        }
      >
        {detail && (
          <dl className="divide-y divide-slate-100">
            <KV label="Owner Department">{detail.ownerDepartment}</KV>
            <KV label="Owner Role">{detail.ownerRole}</KV>
            <KV label="Data Steward">
              {(() => {
                const steward = getEmployee(detail.stewardId);
                if (!steward) return <span className="text-muted-foreground">Unassigned</span>;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      setDetail(null);
                      setPreviewEmployee(steward);
                    }}
                    className="-mx-1.5 inline-flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-slate-100"
                  >
                    <Avatar name={steward.name} size="xs" />
                    <span className="font-medium text-slate-800">{steward.name}</span>
                  </button>
                );
              })()}
            </KV>
            <KV label="Access Level">{detail.accessLevel}</KV>
            <KV label="Sensitivity">
              <StatusBadge status={detail.sensitivity} size="sm" />
            </KV>
            <KV label="Retention">{detail.retention}</KV>
            <KV label="Status">
              <StatusBadge status={detail.status} size="sm" />
            </KV>
            <KV label="Last Review">{detail.lastReview}</KV>
            <KV label="Records">{detail.records}</KV>
            {detail.description && <KV label="Description">{detail.description}</KV>}
            <KV label="Systems">
              {detail.systems.length > 0 ? (
                <span className="flex flex-wrap gap-1.5">
                  {detail.systems.map((s) => (
                    <span
                      key={s}
                      className="rounded-md border bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600"
                    >
                      {s}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-muted-foreground">None connected</span>
              )}
            </KV>
          </dl>
        )}
      </DetailDrawer>

      {/* Steward preview (shared drawer) */}
      <EmployeeDrawer
        employee={previewEmployee}
        open={!!previewEmployee}
        onOpenChange={(o) => !o && setPreviewEmployee(null)}
      />

      {/* Add data domain */}
      <FormDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setAddForm(EMPTY_DOMAIN_FORM);
        }}
        title="Add Data Domain"
        description="Register a governed data domain with an accountable owner department and steward."
        submitLabel="Create domain"
        wide
        onSubmit={submitAdd}
      >
        <Field label="Domain name" required>
          <Input
            value={addForm.name}
            onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Vendor Data"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Owner department" required>
            <Select
              value={addForm.ownerDepartment}
              onValueChange={(v) => setAddForm((f) => ({ ...f, ownerDepartment: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DOMAIN_DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Owner role" required>
            <Input
              value={addForm.ownerRole}
              onChange={(e) => setAddForm((f) => ({ ...f, ownerRole: e.target.value }))}
              placeholder="e.g. Procurement Head"
            />
          </Field>
        </div>
        <Field label="Data steward" required hint="Day-to-day custodian accountable for quality and access.">
          <Select value={addForm.stewardId} onValueChange={(v) => setAddForm((f) => ({ ...f, stewardId: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select steward" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} — {e.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sensitivity" required>
            <Select
              value={addForm.sensitivity}
              onValueChange={(v) => setAddForm((f) => ({ ...f, sensitivity: v as Sensitivity }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SENSITIVITY_LEVELS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Retention">
            <Input
              value={addForm.retention}
              onChange={(e) => setAddForm((f) => ({ ...f, retention: e.target.value }))}
              placeholder="e.g. 7 years after contract end"
            />
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            rows={3}
            value={addForm.description}
            onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What data belongs to this domain?"
          />
        </Field>
      </FormDialog>

      {/* Edit ownership */}
      <FormDialog
        open={!!editDomain}
        onOpenChange={(o) => !o && setEditDomain(null)}
        title={editDomain ? `Edit ownership — ${editDomain.name}` : "Edit ownership"}
        description="Ownership, stewardship and classification are audited. Changes take effect immediately."
        submitLabel="Save changes"
        wide
        onSubmit={submitEdit}
      >
        <Field label="Domain name" required>
          <Input
            value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Owner department" required>
            <Select
              value={editForm.ownerDepartment}
              onValueChange={(v) => setEditForm((f) => ({ ...f, ownerDepartment: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DOMAIN_DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Owner role" required>
            <Input
              value={editForm.ownerRole}
              onChange={(e) => setEditForm((f) => ({ ...f, ownerRole: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Data steward" required>
          <Select
            value={editForm.stewardId}
            onValueChange={(v) => setEditForm((f) => ({ ...f, stewardId: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select steward" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} — {e.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sensitivity" required>
            <Select
              value={editForm.sensitivity}
              onValueChange={(v) => setEditForm((f) => ({ ...f, sensitivity: v as Sensitivity }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SENSITIVITY_LEVELS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Retention">
            <Input
              value={editForm.retention}
              onChange={(e) => setEditForm((f) => ({ ...f, retention: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            rows={3}
            value={editForm.description}
            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
          />
        </Field>
      </FormDialog>
    </div>
  );
}
