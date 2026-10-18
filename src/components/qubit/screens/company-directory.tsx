"use client";

import * as React from "react";
import {
  LayoutGrid,
  Mail,
  MapPin,
  MessageSquare,
  Network,
  Phone,
  Rows3,
  Send,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { departments, employees, searchEmployees, type Employee } from "@/lib/qubit/data";
import { useQubitNav } from "../nav-context";
import { PageHeader } from "../page-header";
import { Avatar, SearchInput, SectionCard, StatTile, StatusBadge } from "../primitives";
import { DataTable, type Column } from "../data-table";
import { SegmentedToggle } from "../workspace/parts";

// ============================================================
// Screen 50 · Company Directory — global employee discovery.
// Respects employee privacy: work contact only, no sensitive HR
// data. Deep-links into Employee 360, Organization Chart and
// Compose Mail — one identity system everywhere.
// ============================================================

export function CompanyDirectoryScreen() {
  const nav = useQubitNav();
  const { toast } = useToast();

  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState("all");
  const [location, setLocation] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [view, setView] = React.useState<"grid" | "table">("grid");

  const locations = React.useMemo(() => Array.from(new Set(employees.map((e) => e.location))), []);

  const results = React.useMemo(() => {
    let list = employees;
    const q = query.trim().toLowerCase();
    if (q) {
      // searchEmployees covers name/title/department; extend with ID, email, location
      const direct = employees.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.title.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q),
      );
      list = direct.length > 0 ? direct : searchEmployees(q);
    }
    if (dept !== "all") list = list.filter((e) => e.department === dept);
    if (location !== "all") list = list.filter((e) => e.location === location);
    if (status !== "all") list = list.filter((e) => e.status === status);
    return list.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [query, dept, location, status]);

  const openPerson = (e: Employee) => nav.navigate("employee-360", { employeeId: e.id });

  const mailPerson = (e: Employee) => nav.navigate("compose-mail", { to: e.email });

  const columns: Column<Employee>[] = [
    {
      key: "name",
      header: "Employee",
      minWidth: 240,
      sortValue: (e) => e.name,
      render: (e) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={e.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-slate-800">{e.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{e.employeeId} · {e.title}</p>
          </div>
        </div>
      ),
    },
    { key: "department", header: "Department", sortValue: (e) => e.department, render: (e) => <span className="text-[13px] text-slate-600">{e.department}</span> },
    { key: "location", header: "Location", hideBelow: "md", render: (e) => <span className="inline-flex items-center gap-1 text-[13px] text-slate-600"><MapPin className="h-3 w-3 text-slate-400" aria-hidden />{e.location}</span> },
    { key: "email", header: "Email", hideBelow: "xl", render: (e) => <span className="text-[12.5px] text-slate-500">{e.email}</span> },
    { key: "phone", header: "Phone", hideBelow: "lg", render: (e) => <span className="text-[12.5px] tabular-nums text-slate-600">{e.phone}</span> },
    { key: "status", header: "Status", render: (e) => <StatusBadge status={e.status} size="sm" /> },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (e) => (
        <span className="inline-flex items-center justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Email ${e.name}`} onClick={() => mailPerson(e)}>
            <Mail className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Open ${e.name} in Employee 360`} onClick={() => openPerson(e)}>
            <UserRound className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "People" }, { label: "Directory" }]}
        title="Company Directory"
        description="Find anyone at Qubit One — by name, skill, department, designation or location. Built on the same employee identity as every other module."
        actions={
          <Button variant="outline" className="h-9 gap-1.5" onClick={() => nav.navigate("organization-chart")}>
            <Network className="h-4 w-4" aria-hidden /> Organization chart
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={<Users />} value={employees.length} label="People in the directory" onClick={() => { setDept("all"); setLocation("all"); setStatus("all"); }} />
        <StatTile icon={<Network />} value={departments.length} label="Departments" onClick={() => nav.navigate("organization-chart")} />
        <StatTile icon={<MapPin />} value={locations.length} label="Work locations" />
        <StatTile icon={<UserRound />} value={employees.filter((e) => e.status === "Active").length} label="Active colleagues" />
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name, ID, skill, designation, email…" className="w-full sm:w-80" ariaLabel="Search the directory" />
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="h-10 w-44 bg-white" aria-label="Filter by department"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="h-10 w-40 bg-white" aria-label="Filter by location"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 w-36 bg-white" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {["Active", "Probation", "On Leave", "Notice Period", "Exit Initiated"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <SegmentedToggle
            ariaLabel="Directory view"
            value={view}
            onChange={setView}
            options={[
              { value: "grid", label: "Cards", icon: LayoutGrid },
              { value: "table", label: "Table", icon: Rows3 },
            ]}
          />
        </div>
      </div>

      {results.length === 0 ? (
        <SectionCard>
          <EmptyDirectoryState query={query} onClear={() => { setQuery(""); setDept("all"); setLocation("all"); setStatus("all"); }} />
        </SectionCard>
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="list" aria-label="Directory cards">
          {results.map((e) => (
            <article key={e.id} role="listitem" className="qubit-card qubit-card-hover p-4">
              <button type="button" onClick={() => openPerson(e)} className="flex w-full items-start gap-3 text-left" aria-label={`Open ${e.name} in Employee 360`}>
                <Avatar name={e.name} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-semibold text-slate-900">{e.name}</span>
                  </span>
                  <span className="block truncate text-xs text-slate-600">{e.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-medium text-slate-500">{e.department}</span>
                    <StatusBadge status={e.status} size="sm" />
                  </span>
                </span>
              </button>
              <div className="mt-3 space-y-1 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-slate-400" aria-hidden /> {e.location}</p>
                <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 shrink-0 text-slate-400" aria-hidden /> {e.email}</p>
              </div>
              <div className="mt-2.5 flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="h-7 gap-1 px-2.5 text-xs" onClick={() => mailPerson(e)}>
                  <Send className="h-3 w-3" aria-hidden /> Message
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2.5 text-xs text-slate-500"
                  onClick={() => {
                    if (typeof window !== "undefined") window.location.href = `tel:${e.phone.replace(/\s/g, "")}`;
                  }}
                >
                  <Phone className="h-3 w-3" aria-hidden /> Call
                </Button>
                <Button size="sm" variant="ghost" className="ml-auto h-7 gap-1 px-2.5 text-xs text-blue-600" onClick={() => openPerson(e)}>
                  Profile
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={results}
          rowKey={(e) => e.id}
          onRowClick={openPerson}
          pageSize={12}
          emptyTitle="No colleagues match"
          emptyMessage="Try a different spelling, or clear a filter."
          caption="Company directory"
          mobileCard={(e) => (
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <Avatar name={e.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-slate-800">{e.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{e.title} · {e.department}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{e.location}</p>
                </div>
              </div>
              <StatusBadge status={e.status} size="sm" />
            </div>
          )}
        />
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        <MessageSquare className="mr-1 inline h-3 w-3" aria-hidden />
        The directory shows work contact details only. Sensitive HR information, compensation and personal records stay inside authorized HR scopes —
        enforced server-side in Employee 360.
      </p>
    </div>
  );
}

function EmptyDirectoryState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="qubit-icon-tile qubit-icon-tile-accent mb-3.5 h-12 w-12">
        <Users />
      </span>
      <p className="text-sm font-semibold text-slate-900">No colleagues match {query ? `"${query}"` : "these filters"}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">Check the spelling or clear the filters — the directory covers all of Qubit One.</p>
      <Button size="sm" variant="outline" className="mt-4 h-8" onClick={onClear}>
        Clear search & filters
      </Button>
    </div>
  );
}
