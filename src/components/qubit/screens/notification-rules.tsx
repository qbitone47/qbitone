"use client";

import * as React from "react";
import { Bell, Mail, MessageCircle, MoreHorizontal, Plus, Smartphone, type LucideIcon } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { departments, notificationRules, type NotificationRule } from "@/lib/qubit/data";
import { useRole } from "../role-context";
import { PageHeader } from "../page-header";
import { DataTable, type Column } from "../data-table";
import { FilterBar, ReadOnlyBanner, SearchInput, StatusBadge } from "../primitives";
import { Field, FormDialog } from "../dialogs";

// Channel → small readable icon (kept minimal on purpose)
const CHANNEL_ICONS: Record<string, LucideIcon> = {
  "In-App": Bell,
  Email: Mail,
  Push: Smartphone,
  WhatsApp: MessageCircle,
};
const ALL_CHANNELS = ["In-App", "Email", "Push", "WhatsApp"];
const TRIGGER_OPTIONS = ["On Submit", "On Create", "On Assign", "On Share", "On Event"];
const FREQUENCY_OPTIONS = ["Immediate", "Immediate + 15 min before", "Hourly digest", "Daily digest"];

function ChannelChip({ label }: { label: string }) {
  const Icon = CHANNEL_ICONS[label] ?? Bell;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200/90 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

function ChannelToggle({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const Icon = CHANNEL_ICONS[label] ?? Bell;
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-2.5 py-2 text-[13px] text-slate-700 transition-colors duration-150 hover:bg-slate-50 has-[[data-state=checked]]:border-blue-200 has-[[data-state=checked]]:bg-blue-50/60">
      <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`Send via ${label}`} />
      <Icon className="h-3.5 w-3.5 text-slate-500" aria-hidden />
      {label}
    </label>
  );
}

const toggleInList = (list: string[], label: string): string[] =>
  list.includes(label) ? list.filter((c) => c !== label) : [...list, label];

export function NotificationRulesScreen() {
  const { can } = useRole();
  const { toast } = useToast();
  const canEdit = can("notifications.edit");

  const [items, setItems] = React.useState<NotificationRule[]>(notificationRules);
  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState("all");
  const [priority, setPriority] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [preview, setPreview] = React.useState<NotificationRule | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newEvent, setNewEvent] = React.useState("");
  const [newChannels, setNewChannels] = React.useState<string[]>(["In-App", "Email"]);
  const [editing, setEditing] = React.useState<NotificationRule | null>(null);
  const [editChannels, setEditChannels] = React.useState<string[]>([]);

  const deptOptions = React.useMemo(() => [...new Set(items.map((r) => r.department))], [items]);

  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      items.filter((r) => {
        if (dept !== "all" && r.department !== dept) return false;
        if (priority !== "all" && r.priority !== priority) return false;
        if (status !== "all" && r.status !== status) return false;
        if (!q) return true;
        return (
          r.event.toLowerCase().includes(q) ||
          r.recipients.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q) ||
          r.channels.join(" ").toLowerCase().includes(q)
        );
      }),
    [items, q, dept, priority, status],
  );

  const filtersActive = q !== "" || dept !== "all" || priority !== "all" || status !== "all";
  const clearFilters = () => {
    setQuery("");
    setDept("all");
    setPriority("all");
    setStatus("all");
  };

  const toggleStatus = (rule: NotificationRule) => {
    const next: "Active" | "Paused" = rule.status === "Active" ? "Paused" : "Active";
    setItems((prev) => prev.map((r) => (r.id === rule.id ? { ...r, status: next } : r)));
    toast({
      title: next === "Paused" ? "Notifications paused" : "Notifications enabled",
      description:
        next === "Paused"
          ? `${rule.event} — recipients no longer receive these notifications until re-enabled.`
          : `${rule.event} — notifications resume for ${rule.recipients}.`,
    });
  };

  const columns: Column<NotificationRule>[] = [
    {
      key: "event",
      header: "Event",
      sortable: true,
      sortValue: (r) => r.event,
      minWidth: 190,
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-900">{r.event}</p>
          <p className="mt-0.5 max-w-64 truncate text-[11px] text-muted-foreground">{r.recipients}</p>
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
      key: "channels",
      header: "Channel",
      render: (r) => (
        <span className="flex flex-wrap gap-1">
          {r.channels.map((c) => (
            <ChannelChip key={c} label={c} />
          ))}
        </span>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      sortValue: (r) => r.priority,
      render: (r) => <StatusBadge status={r.priority} size="sm" />,
    },
    {
      key: "trigger",
      header: "Trigger",
      render: (r) => <span className="whitespace-nowrap text-[13px] text-slate-600">{r.trigger}</span>,
    },
    {
      key: "frequency",
      header: "Frequency",
      hideBelow: "lg",
      render: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{r.frequency}</span>,
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
              aria-label={`Actions for ${r.event}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
            {r.preview && (
              <DropdownMenuItem onClick={() => setPreview(r)}>Preview notification</DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() =>
                toast({
                  title: "Change history",
                  description: "History arrives with Audit module (Phase 16).",
                })
              }
            >
              View history
            </DropdownMenuItem>
            {canEdit && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setEditChannels(r.channels);
                    setEditing(r);
                  }}
                >
                  Edit rule
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleStatus(r)}>
                  {r.status === "Active" ? "Pause notifications" : "Enable notifications"}
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
        crumbs={[{ label: "Enterprise" }, { label: "10. Notification Rules" }]}
        title="Notification Rules"
        description="How Qubit One communicates events across in-app, email, push and WhatsApp — recipients, priority, trigger point and delivery frequency for every event."
        actions={
          canEdit && (
            <Button
              size="sm"
              className="h-9"
              onClick={() => {
                setNewEvent("");
                setNewChannels(["In-App", "Email"]);
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add Notification Rule
            </Button>
          )
        }
      />

      {!canEdit && (
        <div className="mb-4">
          <ReadOnlyBanner message="Read-only view — notification rules can be changed by administrators and department heads." />
        </div>
      )}

      <FilterBar
        className="mb-4"
        left={
          <>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search events…"
          className="w-full sm:w-64"
          ariaLabel="Search events"
        />
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="h-10 w-full sm:w-40" aria-label="Filter by department">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {deptOptions.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-10 w-full sm:w-32" aria-label="Filter by priority">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 w-full sm:w-32" aria-label="Filter by status">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Paused">Paused</SelectItem>
          </SelectContent>
        </Select>
          </>
        }
        right={
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {items.length} notification rules
            {filtersActive && (
              <>
                {" · "}
                <button type="button" onClick={clearFilters} className="font-medium text-blue-600 hover:text-blue-700">
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
        rowKey={(r) => r.id}
        pageSize={8}
        caption="Notification rules"
        emptyTitle="No notification rules match"
        emptyMessage="Adjust the search or filters to find notification rules."
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">{r.event}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {r.department} · {r.recipients}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {r.channels.slice(0, 3).map((c) => (
                  <ChannelChip key={c} label={c} />
                ))}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <StatusBadge status={r.status} size="sm" />
              <StatusBadge status={r.priority} size="sm" />
            </div>
          </div>
        )}
      />

      {/* Preview dialog — rendered mock of the recipient's notification */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Preview notification</DialogTitle>
            <DialogDescription>Rendered as the recipient will see it — {preview?.recipients}.</DialogDescription>
          </DialogHeader>
          {preview?.preview && (
            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-sm font-bold text-white"
                >
                  Q
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{preview.preview.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{preview.preview.body}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">just now</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-100 pt-3">
                {preview.channels.map((c) => (
                  <ChannelChip key={c} label={c} />
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add notification rule */}
      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add Notification Rule"
        description="Choose the event, who is notified and on which channels the message is delivered."
        submitLabel="Add rule"
        wide
        onSubmit={() => {
          toast({
            title: "Notification rule created",
            description: `${newEvent.trim() || "New event"} will be delivered via ${
              newChannels.length > 0 ? newChannels.join(", ") : "no channel selected"
            }.`,
          });
          setCreateOpen(false);
        }}
      >
        <Field label="Event" required>
          <Input
            value={newEvent}
            onChange={(e) => setNewEvent(e.target.value)}
            placeholder="e.g. Invoice Overdue"
          />
        </Field>
        <Field label="Department" required>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Recipients" required hint="Who receives this notification — roles, teams or individuals.">
          <Input placeholder="e.g. Finance Head, On-call" />
        </Field>
        <Field label="Channels" required hint="Select every channel this event is delivered on.">
          <div className="grid grid-cols-2 gap-2">
            {ALL_CHANNELS.map((c) => (
              <ChannelToggle
                key={c}
                label={c}
                checked={newChannels.includes(c)}
                onToggle={() => setNewChannels((prev) => toggleInList(prev, c))}
              />
            ))}
          </div>
        </Field>
        <Field label="Priority" required>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Trigger" required>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select trigger" />
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Frequency" required>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormDialog>

      {/* Edit notification rule */}
      {editing && (
        <FormDialog
          key={editing.id}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          title={`Edit — ${editing.event}`}
          submitLabel="Save changes"
          wide
          onSubmit={() => {
            toast({
              title: "Notification rule updated",
              description: `${editing.event} — changes apply to future notifications.`,
            });
            setEditing(null);
          }}
        >
          <Field label="Event" required>
            <Input defaultValue={editing.event} />
          </Field>
          <Field label="Recipients" required>
            <Input defaultValue={editing.recipients} />
          </Field>
          <Field label="Channels" required>
            <div className="grid grid-cols-2 gap-2">
              {ALL_CHANNELS.map((c) => (
                <ChannelToggle
                  key={c}
                  label={c}
                  checked={editChannels.includes(c)}
                  onToggle={() => setEditChannels((prev) => toggleInList(prev, c))}
                />
              ))}
            </div>
          </Field>
          <Field label="Priority" required>
            <Select defaultValue={editing.priority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Trigger" required>
            <Select defaultValue={editing.trigger}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...new Set([...TRIGGER_OPTIONS, editing.trigger])].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Frequency" required>
            <Select defaultValue={editing.frequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...new Set([...FREQUENCY_OPTIONS, editing.frequency])].map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FormDialog>
      )}
    </div>
  );
}
