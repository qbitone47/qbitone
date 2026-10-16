"use client";

import * as React from "react";
import {
  Ban,
  Check,
  CornerDownRight,
  Minus,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  rolePermissions,
  selectableRolesForMatrix,
  roles,
  type PermissionCell as CellState,
} from "@/lib/qubit/data";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { SectionCard, ReadOnlyBanner, SearchInput } from "../primitives";
import { ConfirmDialog } from "../dialogs";

const ACTION_LABELS = PERMISSION_ACTIONS;

/** Derive a deterministic, realistic matrix for roles other than the seeded Sales Executive. */
function deriveMatrix(roleId: string): Record<string, CellState> {
  const seeded = rolePermissions.find((p) => p.roleId === roleId);
  if (seeded) return { ...seeded.cells };
  const cells: Record<string, CellState> = {};
  const role = roles.find((r) => r.id === roleId);
  const dept = role?.department ?? "";
  const senior = role?.reportingLevel === "Executive" || role?.reportingLevel === "Level 2";
  for (const mod of PERMISSION_MODULES) {
    const own =
      mod === dept ||
      (roleId === "dept-head") ||
      (roleId === "hr-manager" && mod === "HR & People") ||
      (roleId === "finance-manager" && mod === "Finance") ||
      (roleId === "service-engineer" && mod === "Service");
    const commonView = ["Dashboard", "Meetings", "AI", "Analytics", "Documents", "Marketing", "Inventory"].includes(mod);
    for (const action of ACTION_LABELS) {
      const key = `${mod}::${action}`;
      if (mod === "Administration") {
        cells[key] = action === "View" ? (senior ? "restricted" : "disabled") : "disabled";
      } else if (own) {
        cells[key] =
          action === "Delete" ? (senior ? "enabled" : "restricted") :
          action === "Manage" ? (senior ? "enabled" : "disabled") :
          "enabled";
      } else if (commonView) {
        cells[key] =
          action === "View" ? "enabled" :
          action === "Export" && senior ? "enabled" :
          action === "Create" && (mod === "Meetings" || mod === "Documents") ? "enabled" :
          "disabled";
      } else {
        cells[key] = action === "View" && senior ? "inherited" : "disabled";
      }
    }
  }
  return cells;
}

const CELL_META: Record<CellState, { icon: React.ElementType; cls: string; label: string; hint: string }> = {
  enabled: { icon: Check, cls: "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100", label: "Enabled", hint: "Granted directly" },
  disabled: { icon: Minus, cls: "border-slate-200 bg-white text-slate-300 hover:border-slate-300", label: "Disabled", hint: "Not granted" },
  inherited: { icon: CornerDownRight, cls: "border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100", label: "Inherited", hint: "Inherited from Department Head" },
  restricted: { icon: Ban, cls: "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100", label: "Restricted", hint: "Blocked by security policy" },
};

function CellButton({
  state,
  onChange,
  disabled,
}: {
  state: CellState;
  onChange: (next: CellState) => void;
  disabled: boolean;
}) {
  const meta = CELL_META[state];
  const Icon = meta.icon;

  if (disabled) {
    return (
      <span
        title={`${meta.label} — ${meta.hint}`}
        className={cn("mx-auto flex h-6 w-6 items-center justify-center rounded border", meta.cls, "cursor-not-allowed opacity-80")}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }

  // Enabled/disabled toggle directly; inherited/restricted open a choice menu.
  if (state === "enabled" || state === "disabled") {
    return (
      <button
        type="button"
        title={`${meta.label} — ${meta.hint}. Click to toggle.`}
        aria-label={`${meta.label}. Click to toggle.`}
        onClick={() => onChange(state === "enabled" ? "disabled" : "enabled")}
        className={cn("mx-auto flex h-6 w-6 items-center justify-center rounded border transition-colors", meta.cls)}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`${meta.label} — ${meta.hint}`}
          aria-label={`${meta.label}. Open options.`}
          className={cn("mx-auto flex h-6 w-6 items-center justify-center rounded border transition-colors", meta.cls)}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1.5" align="center">
        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Set permission</p>
        {[
          { v: "enabled" as CellState, label: "Enable", icon: Check },
          { v: "restricted" as CellState, label: "Restrict", icon: Ban },
          { v: "inherited" as CellState, label: "Reset to inherited", icon: RotateCcw },
          { v: "disabled" as CellState, label: "Disable", icon: Minus },
        ].map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-slate-50",
              opt.v === state ? "font-medium text-navy-800" : "text-slate-700",
            )}
          >
            <opt.icon className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            {opt.label}
            {opt.v === state && <Check className="ml-auto h-3.5 w-3.5 text-navy-700" aria-hidden />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function PermissionMatrixScreen() {
  const { can } = useRole();
  const { toast } = useToast();
  const canEdit = can("governance.edit");

  const [roleId, setRoleId] = React.useState(selectableRolesForMatrix[0].id);
  const [query, setQuery] = React.useState("");
  const [cells, setCells] = React.useState<Record<string, CellState>>(() => deriveMatrix(selectableRolesForMatrix[0].id));
  const [baseline, setBaseline] = React.useState<Record<string, CellState>>(() => deriveMatrix(selectableRolesForMatrix[0].id));
  const [confirmSave, setConfirmSave] = React.useState(false);

  const role = selectableRolesForMatrix.find((r) => r.id === roleId)!;
  const roleInfo = roles.find((r) => r.id === roleId);

  const switchRole = (id: string) => {
    setRoleId(id);
    const next = deriveMatrix(id);
    setCells(next);
    setBaseline(next);
  };

  const changedKeys = React.useMemo(
    () => Object.keys(cells).filter((k) => cells[k] !== baseline[k]),
    [cells, baseline],
  );
  const dirty = changedKeys.length > 0;
  const highImpact = changedKeys.filter((k) => {
    const action = k.split("::")[1];
    const mod = k.split("::")[0];
    return ["Delete", "Manage", "Approve"].includes(action) || mod === "Administration";
  });

  const q = query.trim().toLowerCase();
  const visibleModules = React.useMemo(
    () => PERMISSION_MODULES.filter((m) => !q || m.toLowerCase().includes(q)),
    [q],
  );

  const counts = React.useMemo(() => {
    let enabled = 0, inherited = 0, restricted = 0;
    for (const m of visibleModules) {
      for (const a of ACTION_LABELS) {
        const v = cells[`${m}::${a}`];
        if (v === "enabled") enabled++;
        else if (v === "inherited") inherited++;
        else if (v === "restricted") restricted++;
      }
    }
    return { enabled, inherited, restricted, total: visibleModules.length * ACTION_LABELS.length };
  }, [cells, visibleModules]);

  const setState = (key: string, next: CellState) => setCells((c) => ({ ...c, [key]: next }));
  const discard = () => setCells({ ...baseline });

  const save = () => {
    setBaseline({ ...cells });
    setConfirmSave(false);
    toast({
      title: "Permissions saved",
      description: `${changedKeys.length} permission change${changedKeys.length === 1 ? "" : "s"} applied to ${role.label}. Effective after users reload.`,
    });
  };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Enterprise" }, { label: "04. Permission Matrix" }]}
        title="Permission Matrix"
        description="Central RBAC governance — control what each role can view, create, edit, delete, approve, export and manage across Qubit One modules."
        actions={
          canEdit ? (
            <div className="flex items-center gap-2">
              {dirty && (
                <Button variant="outline" size="sm" className="h-9" onClick={discard}>
                  Discard
                </Button>
              )}
              <Button size="sm" className="h-9" disabled={!dirty} onClick={() => setConfirmSave(true)}>
                <Save className="h-4 w-4" /> Save Changes
                {dirty && <span className="ml-1 rounded-full bg-blue-200 px-1.5 text-[10px] font-semibold text-blue-900">{changedKeys.length}</span>}
              </Button>
            </div>
          ) : undefined
        }
      />

      {!canEdit && (
        <div className="mb-4">
          <ReadOnlyBanner message="You have view-only access to the Permission Matrix. Permission changes require an Administrator role boundary." />
        </div>
      )}

      {/* Role selector + legend */}
      <SectionCard className="mb-4" contentClassName="p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-navy-50 text-navy-700">
              <ShieldCheck className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Configuring role</p>
              <Select value={roleId} onValueChange={switchRole}>
                <SelectTrigger className="mt-0.5 h-8 w-52 border-0 bg-slate-50 px-2.5 text-sm font-semibold text-slate-900 shadow-none focus:ring-1" aria-label="Select role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectableRolesForMatrix.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {roleInfo && (
            <p className="max-w-md text-xs text-muted-foreground">
              <span className="font-medium text-slate-700">{roleInfo.department}</span> · {roleInfo.employees} employees assigned · {roleInfo.approvalAuthority}
            </p>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            {(Object.keys(CELL_META) as CellState[]).map((s) => {
              const M = CELL_META[s];
              return (
                <span key={s} className="inline-flex items-center gap-1.5" title={M.hint}>
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded border", M.cls)}>
                    <M.icon className="h-3 w-3" aria-hidden />
                  </span>
                  {M.label}
                </span>
              );
            })}
          </div>
        </div>
        {dirty && (
          <p className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800" role="status">
            <span className="font-semibold">Unsaved changes</span>
            <span>
              {changedKeys.length} permission{changedKeys.length === 1 ? "" : "s"} modified for {role.label}.
              {highImpact.length > 0 && <> {highImpact.length} affect deletion, approval or administration (high impact).</>}
            </span>
          </p>
        )}
      </SectionCard>

      {/* Matrix */}
      <SectionCard noPadding contentClassName="">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-5">
          <h2 className="text-sm font-semibold text-slate-900">Module access — {role.label}</h2>
          <SearchInput value={query} onChange={setQuery} placeholder="Filter modules…" className="w-56" ariaLabel="Filter modules" />
        </div>
        <div className="qubit-scroll max-h-[62vh] overflow-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth: 900 }}>
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 border-b border-slate-200 bg-slate-50/95 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm" style={{ minWidth: 200 }}>
                  Module
                </th>
                {ACTION_LABELS.map((a) => (
                  <th key={a} className="border-b border-slate-200 bg-slate-50/95 px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm">
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleModules.map((mod) => (
                <tr key={mod} className="group hover:bg-slate-50/60">
                  <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-4 py-2 group-hover:bg-slate-50/95">
                    <p className="text-[13px] font-medium text-slate-900">{mod}</p>
                    <p className="text-[11px] text-slate-400">{cells[`${mod}::View`] === "inherited" ? "Access via Department Head" : "Direct permissions"}</p>
                  </td>
                  {ACTION_LABELS.map((a) => {
                    const key = `${mod}::${a}`;
                    return (
                      <td key={key} className="px-2 py-1.5 text-center">
                        <CellButton state={cells[key]} onChange={(next) => setState(key, next)} disabled={!canEdit} />
                      </td>
                    );
                  })}
                </tr>
              ))}
              {visibleModules.length === 0 && (
                <tr>
                  <td colSpan={ACTION_LABELS.length + 1} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No modules match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-[11px] text-muted-foreground md:px-5">
          <p>
            <span className="font-medium text-slate-700">{counts.enabled}</span> of {counts.total} permissions enabled ·{" "}
            <span className="font-medium text-slate-700">{counts.inherited}</span> inherited ·{" "}
            <span className="font-medium text-slate-700">{counts.restricted}</span> restricted by policy
          </p>
          <p className="hidden sm:block">Inherited permissions come from the role&apos;s parent level and cannot be granted directly.</p>
        </div>
      </SectionCard>

      {/* Save confirmation — security-sensitive action */}
      <ConfirmDialog
        open={confirmSave}
        onOpenChange={setConfirmSave}
        title={`Save permission changes for ${role.label}?`}
        confirmLabel="Save permissions"
        description={
          <>
            <p>
              You are about to apply <span className="font-semibold">{changedKeys.length}</span> permission change
              {changedKeys.length === 1 ? "" : "s"} for <span className="font-semibold">{role.label}</span>
              {roleInfo ? ` (${roleInfo.employees} employees)` : ""}.
            </p>
            {highImpact.length > 0 && (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                High impact: {highImpact.length} change{highImpact.length === 1 ? "" : "s"} affect deletion, approval or administration access —{" "}
                {highImpact.slice(0, 4).map((k) => k.replace("::", " → ")).join(", ")}
                {highImpact.length > 4 ? ` and ${highImpact.length - 4} more` : ""}.
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Changes take effect after users reload and are recorded in the audit log.</p>
          </>
        }
        onConfirm={save}
      />
    </div>
  );
}
