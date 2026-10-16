"use client";

import * as React from "react";
import {
  Banknote,
  BarChart3,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Eye,
  FileText,
  FolderClosed,
  Gauge,
  House,
  LayoutDashboard,
  ListTodo,
  Megaphone,
  MessageSquare,
  Package,
  Plus,
  Receipt,
  Settings2,
  Sparkles,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
  Video,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { navModules, navRoles, type NavModule } from "@/lib/qubit/data";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { EmptyState, KV, ReadOnlyBanner, SectionCard, TreeRow } from "../primitives";
import { ConfirmDialog, Field, FormDialog } from "../dialogs";

const ICONS: Record<string, React.ElementType> = {
  home: House, layout: LayoutDashboard, user: UserRound, check: ListTodo, calendar: Calendar,
  video: Video, "check-circle": CircleCheck, folder: FolderClosed, trending: TrendingUp,
  gauge: Gauge, users: Users, building: Building2, "file-text": FileText, wallet: Wallet,
  receipt: Receipt, "user-plus": UserPlus, banknote: Banknote, package: Package,
  megaphone: Megaphone, wrench: Wrench, sparkles: Sparkles, "bar-chart": BarChart3,
  settings: Settings2, message: MessageSquare,
};

const ModuleIcon = ({ name, className }: { name: string; className?: string }) => {
  const Icon = ICONS[name] ?? CircleCheck;
  return <Icon className={className} aria-hidden />;
};

function roleCanSee(mod: NavModule, roleId: string): boolean {
  if (roleId === "administrator") return true;
  if (!mod.allowedRoles.includes("all") && !mod.allowedRoles.includes(roleId)) return false;
  if (mod.parent) {
    const parent = navModules.find((m) => m.id === mod.parent);
    return parent ? roleCanSee(parent, roleId) : true;
  }
  return true;
}

export function EnterpriseNavigationScreen() {
  const { can } = useRole();
  const { toast } = useToast();
  const canEdit = can("navigation.edit");

  const [modules, setModules] = React.useState<NavModule[]>(() => navModules.map((m) => ({ ...m, allowedRoles: [...m.allowedRoles] })));
  const [baselineModules, setBaselineModules] = React.useState<NavModule[]>(() => navModules.map((m) => ({ ...m, allowedRoles: [...m.allowedRoles] })));
  const dirty = React.useMemo(() => JSON.stringify(modules) !== JSON.stringify(baselineModules), [modules, baselineModules]);

  const [selectedId, setSelectedId] = React.useState<string>("nm-workspace");
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set(["nm-workspace", "nm-sales"]));
  const [previewRole, setPreviewRole] = React.useState("administrator");
  const [renameFor, setRenameFor] = React.useState<NavModule | null>(null);
  const [reparentFor, setReparentFor] = React.useState<NavModule | null>(null);
  const [deleteFor, setDeleteFor] = React.useState<NavModule | null>(null);
  const [addOpen, setAddOpen] = React.useState<{ parent: string | null } | null>(null);
  const [previewTabRole, setPreviewTabRole] = React.useState("sales-exec");

  const selected = modules.find((m) => m.id === selectedId) ?? modules[0];
  const topLevel = React.useMemo(
    () => modules.filter((m) => m.parent === null).sort((a, b) => a.order - b.order),
    [modules],
  );
  const childrenOf = (parentId: string) =>
    modules.filter((m) => m.parent === parentId).sort((a, b) => a.order - b.order);
  const children = selected ? childrenOf(selected.id) : [];

  const mutate = (fn: (draft: NavModule[]) => void) => {
    setModules((prev) => {
      const draft = prev.map((m) => ({ ...m, allowedRoles: [...m.allowedRoles] }));
      fn(draft);
      return draft;
    });
  };

  const move = (mod: NavModule, dir: -1 | 1) => {
    mutate((draft) => {
      const sibs = draft
        .filter((m) => m.parent === mod.parent)
        .sort((a, b) => a.order - b.order);
      const idx = sibs.findIndex((m) => m.id === mod.id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= sibs.length) return;
      const a = draft.find((m) => m.id === sibs[idx].id)!;
      const b = draft.find((m) => m.id === sibs[swapIdx].id)!;
      const tmp = a.order;
      a.order = b.order;
      b.order = tmp;
    });
  };

  const toggleStatus = (mod: NavModule) =>
    mutate((draft) => {
      const m = draft.find((x) => x.id === mod.id)!;
      m.status = m.status === "Active" ? "Disabled" : "Active";
      if (m.status === "Disabled") {
        // disable descendants too — navigation cannot show orphan children
        for (const c of draft.filter((x) => x.parent === m.id)) c.status = "Disabled";
      }
    });

  const save = () => {
    setBaselineModules(modules.map((m) => ({ ...m, allowedRoles: [...m.allowedRoles] })));
    toast({
      title: "Navigation saved",
      description: "Module structure, ordering and visibility updated for the organization.",
    });
  };

  const previewing = previewRole !== "administrator";

  // ---------- tree ----------
  const renderTreeLevel = (parentId: string | null, depth: number) => {
    const items = (parentId === null ? topLevel : childrenOf(parentId));
    return items.map((m) => {
      const kids = childrenOf(m.id);
      const isOpen = expanded.has(m.id);
      const visible = roleCanSee(m, previewRole);
      return (
        <React.Fragment key={m.id}>
          <TreeRow
            depth={depth}
            expandable={kids.length > 0}
            expanded={isOpen}
            onToggle={() =>
              setExpanded((s) => {
                const next = new Set(s);
                if (next.has(m.id)) next.delete(m.id);
                else next.add(m.id);
                return next;
              })
            }
            selected={selectedId === m.id}
            onClick={() => setSelectedId(m.id)}
            dimmed={m.status === "Disabled" || (previewing && !visible)}
          >
            <span className="inline-flex items-center gap-2">
              <ModuleIcon name={m.icon} className="h-3.5 w-3.5 text-slate-500" />
              <span className={cn(m.status === "Disabled" && "line-through decoration-slate-300")}>{m.name}</span>
            </span>
          </TreeRow>
          {isOpen && kids.length > 0 && renderTreeLevel(m.id, depth + 1)}
        </React.Fragment>
      );
    });
  };

  // ---------- derived form state ----------
  const dirtyFields = (patch: Partial<NavModule>) =>
    mutate((draft) => {
      const m = draft.find((x) => x.id === selected.id)!;
      Object.assign(m, patch);
    });

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Enterprise" }, { label: "12. Enterprise Navigation" }]}
        title="Enterprise Navigation"
        description="Master information architecture for Qubit One — module structure, ordering, routes and role-aware visibility across the entire application."
        actions={
          canEdit ? (
            <Button size="sm" className="h-9" disabled={!dirty} onClick={save}>
              Save Changes
              {dirty && <span className="ml-1 rounded-full bg-blue-200 px-1.5 text-[10px] font-semibold text-blue-900">•</span>}
            </Button>
          ) : undefined
        }
      />

      {!canEdit && (
        <div className="mb-4">
          <ReadOnlyBanner message="Navigation architecture changes require an Administrator. You can preview role visibility." />
        </div>
      )}

      {dirty && canEdit && (
        <p className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800" role="status">
          <span className="font-semibold">Unsaved changes</span> — structure, ordering or visibility edits are not live until you save.
        </p>
      )}

      {/* Preview-as bar */}
      <SectionCard className="mb-4" contentClassName="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="qubit-icon-tile qubit-icon-tile-accent h-10 w-10">
            <Eye aria-hidden />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role-aware preview</p>
            <Select value={previewRole} onValueChange={setPreviewRole}>
              <SelectTrigger className="mt-0.5 h-8 w-56 border-0 bg-slate-50 px-2.5 text-sm font-semibold text-slate-900 shadow-none focus:ring-1" aria-label="Preview navigation as role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {navRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="max-w-lg text-xs text-muted-foreground">
            {previewing
              ? "Modules not assigned to this role are marked Hidden in the tree below — exactly what this role experiences in the sidebar."
              : "Preview how the sidebar appears for any role before publishing changes."}
          </p>
        </div>
      </SectionCard>

      {/* Three panes */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT — navigation tree */}
        <SectionCard
          noPadding
          title="Navigation Tree"
          description={`${topLevel.length} top-level modules`}
          className="lg:w-72 lg:shrink-0"
          contentClassName="p-2 max-lg:max-h-72 qubit-scroll max-lg:overflow-y-auto"
        >
          <nav aria-label="Application navigation tree">
            <TreeRow depth={0} expandable expanded onClick={() => setExpanded((s) => new Set(s).add("nm-workspace"))}>
              <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
                <Building2 className="h-4 w-4 text-blue-600" />
                Qubit One
              </span>
            </TreeRow>
            {renderTreeLevel(null, 1)}
          </nav>
        </SectionCard>

        {/* CENTER — structure management */}
        <SectionCard
          noPadding
          title={`Navigation Structure — ${selected?.name ?? ""}`}
          description="Order, enable and organize modules. Structure applies org-wide after save."
          className="min-w-0 flex-1"
          actions={
            canEdit && (
              <>
                <Button variant="outline" size="sm" className="h-8" onClick={() => setAddOpen({ parent: null })}>
                  <Plus className="h-3.5 w-3.5" /> Top-level module
                </Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => setAddOpen({ parent: selected.id })}>
                  <Plus className="h-3.5 w-3.5" /> Submodule
                </Button>
              </>
            )
          }
          contentClassName="p-2"
        >
          {children.length === 0 ? (
            <EmptyState
              icon={<FolderClosed />}
              title="No submodules"
              message={selected?.parent ? "This is a leaf module — it renders directly in the sidebar." : "Add submodules to build this section of the navigation."}
            />
          ) : (
            <ul className="divide-y">
              {children.map((m, idx) => {
                const visible = roleCanSee(m, previewRole);
                return (
                  <li key={m.id} className="flex items-center gap-2 px-1.5 py-2">
                    {canEdit && (
                      <div className="flex flex-col">
                        <button
                          type="button"
                          aria-label={`Move ${m.name} up`}
                          disabled={idx === 0}
                          onClick={() => move(m, -1)}
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${m.name} down`}
                          disabled={idx === children.length - 1}
                          onClick={() => move(m, 1)}
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { setSelectedId(m.id); setExpanded((s) => new Set(s).add(m.parent!)); }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1 text-left transition-colors duration-150 hover:bg-slate-100/70"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <ModuleIcon name={m.icon} className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className={cn("block truncate text-[13px] font-medium", m.status === "Active" ? "text-slate-900" : "text-slate-400 line-through")}>
                          {m.name}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-muted-foreground">{m.route}</span>
                      </span>
                    </button>
                    <span className="hidden shrink-0 rounded-md border border-slate-200/90 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:inline">
                      {m.visibility}
                    </span>
                    {previewing && !visible && (
                      <span className="shrink-0 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Hidden for role</span>
                    )}
                    {canEdit ? (
                      <Switch
                        checked={m.status === "Active"}
                        onCheckedChange={() => toggleStatus(m)}
                        aria-label={`Toggle ${m.name}`}
                        className="scale-90"
                      />
                    ) : (
                      <span className={cn("h-5 w-9 rounded-full p-0.5", m.status === "Active" ? "bg-emerald-100" : "bg-slate-200")}>
                        <span className={cn("block h-4 w-4 rounded-full bg-white shadow", m.status === "Active" && "translate-x-4")} />
                      </span>
                    )}
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" aria-label={`Actions for ${m.name}`}>
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => setRenameFor(m)}>Rename</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setReparentFor(m)}>Set parent module</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-700"
                            onClick={() => {
                              const kidCount = childrenOf(m.id).length;
                              if (kidCount > 0) {
                                toast({ title: "Cannot delete", description: `${m.name} has ${kidCount} submodule${kidCount === 1 ? "" : "s"}. Move or delete them first.` });
                              } else setDeleteFor(m);
                            }}
                          >
                            Delete module
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        {/* RIGHT — module details */}
        <SectionCard noPadding className="lg:w-96 lg:shrink-0">
          <Tabs defaultValue="details">
            <div className="border-b px-4 pt-3">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                <TabsTrigger value="roles" className="text-xs">Role Visibility</TabsTrigger>
                <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="details" className="px-4 pb-4 pt-3">
              {selected && (
                <>
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className="qubit-icon-tile qubit-icon-tile-accent h-10 w-10">
                      <ModuleIcon name={selected.icon} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{selected.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{selected.route}</p>
                    </div>
                  </div>
                  <div className="space-y-3.5">
                    <Field label="Module name">
                      <Input
                        defaultValue={selected.name}
                        key={`name-${selected.id}`}
                        disabled={!canEdit}
                        onBlur={(e) => e.target.value !== selected.name && dirtyFields({ name: e.target.value })}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Icon">
                        <Select
                          value={selected.icon}
                          onValueChange={(v) => dirtyFields({ icon: v })}
                          disabled={!canEdit}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.keys(ICONS).map((k) => (
                              <SelectItem key={k} value={k}>
                                <span className="inline-flex items-center gap-2">
                                  <ModuleIcon name={k} className="h-3.5 w-3.5" /> {k}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Parent module">
                        <Select
                          value={selected.parent ?? "none"}
                          onValueChange={(v) => dirtyFields({ parent: v === "none" ? null : v, order: 99 })}
                          disabled={!canEdit}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None (top level)</SelectItem>
                            {topLevel.filter((m) => m.id !== selected.id).map((m) => (
                              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <Field label="Route" hint="Application route this module opens.">
                      <Input
                        key={`route-${selected.id}`}
                        defaultValue={selected.route}
                        disabled={!canEdit}
                        className="font-mono text-xs"
                        onBlur={(e) => e.target.value !== selected.route && dirtyFields({ route: e.target.value })}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Status">
                        <Select value={selected.status} onValueChange={(v) => dirtyFields({ status: v as NavModule["status"] })} disabled={!canEdit}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Disabled">Disabled</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Visibility">
                        <Select value={selected.visibility} onValueChange={(v) => dirtyFields({ visibility: v as NavModule["visibility"] })} disabled={!canEdit}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="All Roles">All Roles</SelectItem>
                            <SelectItem value="Restricted">Restricted</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <Field label="Description">
                      <Input
                        key={`desc-${selected.id}`}
                        defaultValue={selected.description}
                        disabled={!canEdit}
                        onBlur={(e) => e.target.value !== selected.description && dirtyFields({ description: e.target.value })}
                      />
                    </Field>
                    <dl className="divide-y border-t pt-1">
                      <KV label="Allowed roles">
                        {selected.allowedRoles.includes("all")
                          ? "All employees"
                          : selected.allowedRoles.map((r) => navRoles.find((x) => x.id === r)?.label ?? r).join(", ")}
                      </KV>
                    </dl>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="roles" className="px-4 pb-4 pt-3">
              <p className="mb-3 text-xs text-muted-foreground">
                Choose which roles see <span className="font-medium text-slate-700">{selected?.name}</span> in their sidebar.
              </p>
              <ul className="space-y-1">
                {navRoles.map((r) => {
                  const isAll = selected?.allowedRoles.includes("all");
                  const checked = isAll || selected?.allowedRoles.includes(r.id);
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-slate-50">
                      <label className="flex items-center gap-2.5 text-[13px] text-slate-700">
                        <Checkbox
                          checked={!!checked}
                          disabled={!canEdit || isAll || r.id === "administrator"}
                          onCheckedChange={(v) => {
                            mutate((draft) => {
                              const m = draft.find((x) => x.id === selected.id)!;
                              if (v) m.allowedRoles = [...m.allowedRoles.filter((x) => x !== "all"), r.id];
                              else m.allowedRoles = m.allowedRoles.filter((x) => x !== r.id);
                            });
                          }}
                          aria-label={`${r.label} can see ${selected?.name}`}
                        />
                        {r.label}
                      </label>
                      {isAll && <span className="text-[11px] text-muted-foreground">All-roles module</span>}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-[11px] text-muted-foreground">
                Restricted modules must list explicit roles. Administrators always retain access for governance.
              </p>
            </TabsContent>

            <TabsContent value="preview" className="px-4 pb-4 pt-3">
              <Field label="Preview as role">
                <Select value={previewTabRole} onValueChange={setPreviewTabRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {navRoles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="mt-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Sidebar preview</p>
                <ul className="space-y-0.5">
                  {topLevel
                    .filter((m) => roleCanSee(m, previewTabRole))
                    .map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[13px] font-medium text-slate-600"
                      >
                        <ModuleIcon name={m.icon} className="h-4 w-4 text-slate-400" />
                        {m.name}
                      </li>
                    ))}
                  {topLevel.filter((m) => roleCanSee(m, previewTabRole)).length === 0 && (
                    <li className="px-2 py-4 text-center text-xs text-slate-500">No modules visible for this role.</li>
                  )}
                </ul>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {topLevel.filter((m) => roleCanSee(m, previewTabRole)).length} of {topLevel.length} top-level modules visible to{" "}
                {navRoles.find((r) => r.id === previewTabRole)?.label}.
              </p>
            </TabsContent>
          </Tabs>
        </SectionCard>
      </div>

      {/* Dialogs */}
      {renameFor && (
        <FormDialog
          open
          onOpenChange={(o) => !o && setRenameFor(null)}
          title={`Rename — ${renameFor.name}`}
          submitLabel="Rename"
          onSubmit={() => {
            const input = document.getElementById("rename-input") as HTMLInputElement | null;
            const value = input?.value.trim();
            if (value) mutate((draft) => { draft.find((m) => m.id === renameFor.id)!.name = value; });
            toast({ title: "Module renamed", description: "Remember to save changes to apply navigation updates." });
            setRenameFor(null);
          }}
        >
          <Field label="Module name" required>
            <Input id="rename-input" defaultValue={renameFor.name} autoFocus />
          </Field>
        </FormDialog>
      )}

      {reparentFor && (
        <FormDialog
          open
          onOpenChange={(o) => !o && setReparentFor(null)}
          title={`Set parent — ${reparentFor.name}`}
          submitLabel="Move module"
          onSubmit={() => {
            toast({ title: "Module moved", description: "Parent updated. Save changes to apply." });
            setReparentFor(null);
          }}
        >
          <Field label="New parent" required>
            <Select
              defaultValue={reparentFor.parent ?? "none"}
              onValueChange={(v) =>
                mutate((draft) => {
                  const m = draft.find((x) => x.id === reparentFor.id)!;
                  m.parent = v === "none" ? null : v;
                  m.order = 99;
                })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (top level)</SelectItem>
                {topLevel.filter((m) => m.id !== reparentFor.id).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FormDialog>
      )}

      {addOpen && (
        <FormDialog
          open
          onOpenChange={(o) => !o && setAddOpen(null)}
          title={addOpen.parent ? "Add Submodule" : "Add Top-level Module"}
          submitLabel="Create module"
          onSubmit={() => {
            toast({ title: "Module created", description: "It appears in the tree once saved. Configure route and roles in Details." });
            setAddOpen(null);
          }}
        >
          <Field label="Module name" required>
            <Input placeholder="e.g. Reports" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Icon">
              <Select defaultValue="folder">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(ICONS).slice(0, 12).map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Route" required>
              <Input placeholder="/reports" className="font-mono text-xs" />
            </Field>
          </div>
          {addOpen.parent && (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-[11px] text-muted-foreground">
              Parent: <span className="font-medium text-slate-700">{modules.find((m) => m.id === addOpen.parent)?.name}</span>
            </p>
          )}
        </FormDialog>
      )}

      <ConfirmDialog
        open={!!deleteFor}
        onOpenChange={(o) => !o && setDeleteFor(null)}
        title={`Delete ${deleteFor?.name}?`}
        destructive
        confirmLabel="Delete module"
        description="Users lose access to this navigation entry immediately after save. Routes and permissions are retained for restore."
        onConfirm={() => {
          mutate((draft) => draft.filter((m) => m.id !== deleteFor!.id));
          toast({ title: "Module deleted", description: "Save changes to apply. Restore is available from audit history." });
          setDeleteFor(null);
        }}
      />
    </div>
  );
}
