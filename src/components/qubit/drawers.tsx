"use client";

import * as React from "react";
import { Building2, Mail, MapPin, Phone, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Avatar, KV, StatusBadge } from "./primitives";
import { directReports, getEmployee, type Employee } from "@/lib/qubit/data";
import { useQubitNav } from "./nav-context";

// ============================================================
// DetailDrawer — right-side drawer for quick details/preview
// ============================================================
export function DetailDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  icon,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex w-full flex-col gap-0 p-0 sm:max-w-md",
          wide && "sm:max-w-lg",
        )}
      >
        <SheetHeader className="border-b border-slate-100 px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            {icon && (
              <span className="qubit-icon-tile qubit-icon-tile-accent mt-0.5 h-10 w-10">{icon}</span>
            )}
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold leading-snug tracking-tight text-slate-900">{title}</SheetTitle>
              {subtitle && <SheetDescription className="mt-0.5 text-xs text-muted-foreground">{subtitle}</SheetDescription>}
            </div>
          </div>
        </SheetHeader>
        <div className="qubit-scroll flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// EmployeeDrawer — lightweight employee preview (shared pattern)
// ============================================================
export function EmployeeDrawer({
  employee,
  open,
  onOpenChange,
}: {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const nav = useQubitNav();
  if (!employee) return null;
  const manager = getEmployee(employee.managerId);
  const reports = directReports(employee.id);

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          {employee.name}
          <StatusBadge status={employee.status} size="sm" />
        </span>
      }
      subtitle={`${employee.title} · ${employee.department}`}
      icon={<Users />}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              onOpenChange(false);
              nav.navigate("reporting-lines", { employeeId: employee.id });
            }}
          >
            View reporting line
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() =>
              toast({
                title: "Full profile",
                description: "The complete employee profile opens in the People module.",
              })
            }
          >
            Open full profile
          </Button>
        </div>
      }
    >
      <div className="flex items-center gap-3 border-b pb-4">
        <Avatar name={employee.name} size="xl" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{employee.name}</p>
          <p className="text-xs text-muted-foreground">{employee.title}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" aria-hidden /> {employee.department}
          </p>
        </div>
      </div>

      <dl className="divide-y pt-1">
        <KV label="Employee ID">{employee.employeeId}</KV>
        <KV label="Manager">{manager ? manager.name : "— (Top level)"}</KV>
        <KV label="Direct reports">{reports.length > 0 ? `${reports.length} people` : "None"}</KV>
        <KV label="Location">{employee.location}</KV>
        <KV label="Status"><StatusBadge status={employee.status} size="sm" /></KV>
        <KV label="With company since">{employee.since}</KV>
        <KV label="Email">
          <span className="inline-flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            {employee.email}
          </span>
        </KV>
        <KV label="Phone">
          <span className="inline-flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            {employee.phone}
          </span>
        </KV>
      </dl>

      {reports.length > 0 && (
        <div className="mt-5 border-t pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-3 w-3" aria-hidden /> Direct reports
          </p>
          <ul className="space-y-1">
            {reports.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => nav.navigate("reporting-lines", { employeeId: r.id })}
                  className="flex w-full items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 text-left text-sm transition-colors hover:border-slate-200 hover:bg-slate-50"
                >
                  <Avatar name={r.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="block truncate text-sm font-medium text-slate-800">{r.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.title}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DetailDrawer>
  );
}
