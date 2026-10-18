"use client";

import * as React from "react";
import { Building2, Check, Loader2, RefreshCw, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  COMPANY_EMPLOYEES,
  departmentByName,
  departments,
  employees,
  formatCount,
} from "@/lib/qubit/data";
import { Avatar, SearchInput, StatTile } from "../primitives";
import { PageHeader } from "../page-header";
import {
  DSCaption,
  DSGuidance,
  DSExample,
  DSScreenNav,
  DSSection,
  DSStage,
  DSTokenTable,
  DSVar,
} from "../ds/doc";

// ============================================================
// Screen 26 · Loading States
// Skeletons and progress patterns that feel fast and controlled.
// One shared demo: "Reload demo" toggles a 1.4s loading window.
// ============================================================

/** Registers timeouts that are cleaned up if the demo unmounts. */
function useDemoTimers() {
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  React.useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);
  return React.useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
}

// ——— Skeleton specimens (structure-matched) ————————————————

/** Page skeleton — mirrors the Organization Structure page exactly. */
function OrgPageSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div>
        <Skeleton className="h-7 w-72 rounded-md" />
        <Skeleton className="mt-2.5 h-4 w-96 max-w-full rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-16 rounded-md" />
              <Skeleton className="h-3 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 px-4 py-3">
          <Skeleton className="h-4 w-40 rounded-md" />
        </div>
        <div className="divide-y divide-slate-100">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-3.5 w-40 rounded-md" />
              <Skeleton className="ml-auto h-3 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Table skeleton — header bar + five 40px row bars. */
function TableSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4" aria-hidden>
      <Skeleton className="h-9 w-44 rounded-lg" />
      <div className="mt-3 space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Person-card skeleton — avatar circle + two lines. */
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)} aria-hidden>
      <Skeleton className="h-11 w-11 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-32 rounded-md" />
        <Skeleton className="h-3 w-24 rounded-md" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

/** Detail-drawer skeleton — header row + key/value line pairs. */
function DrawerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)} aria-hidden>
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-40 rounded-md" />
          <Skeleton className="h-3 w-24 rounded-md" />
        </div>
      </div>
      <div className="space-y-3.5 px-4 py-4">
        {[64, 96, 80, 112].map((w, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-3 w-20 shrink-0 rounded-md" />
            <Skeleton className="h-3 rounded-md" style={{ width: w }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ——— Live micro-demos ————————————————————————————————

/** Button loading — idle → saving (1.2s) → saved (0.8s) → idle. */
function SaveButtonDemo() {
  const [phase, setPhase] = React.useState<"idle" | "saving" | "saved">("idle");
  const at = useDemoTimers();

  const save = () => {
    if (phase !== "idle") return;
    setPhase("saving");
    at(() => setPhase("saved"), 1200);
    at(() => setPhase("idle"), 2000);
  };

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={phase !== "idle"} aria-live="polite">
          {phase === "saving" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {phase === "saved" ? <Check className="h-4 w-4" aria-hidden /> : null}
          {phase === "idle" ? "Save changes" : phase === "saving" ? "Saving…" : "Saved"}
        </Button>
        <span
          className={cn(
            "text-xs font-medium transition-colors duration-150",
            phase === "saved" ? "text-emerald-700" : "text-slate-400",
          )}
        >
          {phase === "saving" ? "Writing to Organization Structure…" : phase === "saved" ? "Department updated just now" : "3 unsaved edits on Finance"}
        </span>
      </div>
    </div>
  );
}

/** Search loading — spinner replaces the clear affordance while "searching". */
function SearchLoadingDemo() {
  const [value, setValue] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const at = useDemoTimers();

  const onChange = (v: string) => {
    setValue(v);
    setSearching(v.trim().length > 0);
    if (v.trim()) at(() => setSearching(false), 900);
  };

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4">
      <div className="relative max-w-xs">
        <SearchInput value={value} onChange={onChange} placeholder="Search employees…" ariaLabel="Search employees demo" />
        {searching && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white p-1"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
          </span>
        )}
      </div>
      <p aria-live="polite" className="mt-2.5 text-xs text-slate-500">
        {searching ? "Searching employees…" : value ? `${employees.length} of 1,245 employees shown` : "Type to search the employee directory."}
      </p>
    </div>
  );
}

/** Inline loading — persistent, non-blocking spinner with status text. */
function InlineSpinnerDemo() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-4">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" aria-hidden />
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-800">Syncing integrations…</p>
        <p className="text-xs text-muted-foreground">Salesforce · 1,208 of 1,245 employee records</p>
      </div>
      <span className="ml-auto shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
        In progress
      </span>
    </div>
  );
}

/** Determinate progress — 0→100 over 1.4s with a % label; replayable. */
function ProgressDemo() {
  const [value, setValue] = React.useState(0);
  const running = React.useRef(false);

  const start = React.useCallback(() => {
    if (running.current) return;
    running.current = true;
    setValue(0);
    const step = 100 / (1400 / 40);
    const id = setInterval(() => {
      setValue((v) => {
        const next = Math.min(100, v + step);
        if (next >= 100) {
          clearInterval(id);
          running.current = false;
        }
        return next;
      });
    }, 40);
  }, []);

  React.useEffect(() => {
    start();
  }, [start]);

  const done = value >= 100;

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-800">
          {done ? "Payroll sheet uploaded" : "Uploading payroll sheet…"}
        </p>
        <span className="font-mono text-xs text-slate-500" aria-live="polite">{Math.round(value)}%</span>
      </div>
      <Progress value={value} className="mt-2.5" aria-label="Payroll sheet upload progress" />
      <Button variant="ghost" size="sm" className="mt-2 h-8 text-blue-600 hover:text-blue-700" onClick={start} aria-label="Replay progress demo">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Replay
      </Button>
    </div>
  );
}

// ——— Screen ————————————————————————————————————

export function LoadingStatesScreen() {
  const [reloading, setReloading] = React.useState(false); // shared 1.4s loading window
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const reloadDemo = () => {
    if (timer.current) clearTimeout(timer.current);
    setReloading(true);
    timer.current = setTimeout(() => setReloading(false), 1400);
  };

  const finance = departmentByName("Finance");
  const tableEmployees = employees.slice(0, 5);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Design System" }]}
        title="Loading States"
        description="Skeletons and progress patterns that feel fast and controlled."
        actions={
          <Button variant="outline" onClick={reloadDemo} disabled={reloading} aria-label="Reload loading-state demos">
            <RefreshCw className={cn("h-4 w-4", reloading && "animate-spin")} aria-hidden />
            {reloading ? "Loading…" : "Reload demo"}
          </Button>
        }
      />

      <div className="space-y-6">
        {/* ——— 1 · Page loading ——— */}
        <DSSection
          title="Page loading"
          purpose="The skeleton mirrors the final page structure exactly — press Reload demo to watch the swap."
        >
          {reloading ? (
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 md:p-6">
              <OrgPageSkeleton />
            </div>
          ) : (
            <div className="space-y-6" aria-busy="false">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-slate-900">Organization Structure</h3>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Complete view of company hierarchy and reporting structure for Qubit One Pvt Ltd.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatTile icon={<Users />} value={formatCount(COMPANY_EMPLOYEES)} label="Employees" />
                <StatTile icon={<Building2 />} value={String(departments.length)} label="Departments" />
                <StatTile icon={<UserCheck />} value="96%" label="Actively working" />
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Department heads</p>
                  <span className="text-xs text-slate-400">{tableEmployees.length} of 9</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {tableEmployees.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Avatar name={e.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-slate-800">{e.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{e.title}</p>
                      </div>
                      <span className="ml-auto shrink-0 text-xs text-slate-500">{e.department}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DSCaption className="mt-3">
            Same header width, same three stat tiles, same table rows — the layout never shifts when
            content arrives.
          </DSCaption>
        </DSSection>

        {/* ——— 2 · Table loading ——— */}
        <DSSection
          title="Table loading"
          purpose="Skeleton vs loaded content, side by side — bars sized to the rows they replace."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <DSExample label="Skeleton — header bar + five 40px row bars">
              <TableSkeleton />
            </DSExample>
            <DSExample label="Loaded — five employees, same footprint">
              <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Employees</p>
                  <span className="text-xs text-slate-400">Name · Department</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {tableEmployees.map((e) => (
                    <div key={e.id} className="flex h-10 items-center gap-3 px-4">
                      <Avatar name={e.name} size="xs" />
                      <p className="truncate text-[13px] font-medium text-slate-800">{e.name}</p>
                      <span className="ml-auto shrink-0 text-xs text-slate-500">{e.department}</span>
                    </div>
                  ))}
                </div>
              </div>
            </DSExample>
          </div>
        </DSSection>

        {/* ——— 3 · Card & detail loading ——— */}
        <DSSection
          title="Card & detail loading"
          purpose="Panels keep their exact height while their content streams in."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <DSExample label="Card — skeleton">
              <CardSkeleton />
            </DSExample>
            <DSExample label="Card — loaded">
              {reloading ? (
                <CardSkeleton className="opacity-70" />
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <Avatar name="Priya Sharma" size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">Priya Sharma</p>
                    <p className="truncate text-xs text-muted-foreground">Finance Head · QO-0021</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    Active
                  </span>
                </div>
              )}
            </DSExample>
            <DSExample label="Detail drawer — skeleton">
              <DrawerSkeleton />
            </DSExample>
            <DSExample label="Detail drawer — loaded">
              {reloading ? (
                <DrawerSkeleton className="opacity-70" />
              ) : (
                <div className="rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
                    <span className="qubit-icon-tile qubit-icon-tile-accent h-10 w-10">
                      <Building2 />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">Finance</p>
                      <p className="truncate text-xs text-muted-foreground">{finance?.code} · Department detail</p>
                    </div>
                  </div>
                  <dl className="space-y-2.5 px-4 py-4 text-[13px]">
                    {[
                      ["Head", "Priya Sharma"],
                      ["Employees", String(finance?.employeeCount ?? 87)],
                      ["Locations", (finance?.locations ?? []).join(", ")],
                      ["Status", "Active since 2022"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex gap-4">
                        <dt className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">{k}</dt>
                        <dd className="min-w-0 flex-1 truncate text-slate-800">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </DSExample>
          </div>
        </DSSection>

        {/* ——— 4 · Button & inline loading ——— */}
        <DSSection
          title="Button & inline loading"
          purpose="Spinner goes where the wait is — in the control, or on the row that is busy."
          actions={
            <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
              <Loader2 className={cn("h-3.5 w-3.5", reloading && "animate-spin")} aria-hidden />
              live demos
            </span>
          }
        >
          <DSStage variant="plain" className="grid gap-4 md:grid-cols-2">
            <DSExample label="Button loading — disabled while saving, then a check, then reset">
              <SaveButtonDemo />
            </DSExample>
            <DSExample label="Search loading — spinner replaces the clear icon while querying">
              <SearchLoadingDemo />
            </DSExample>
            <DSExample label="Inline loading — non-blocking status for background work">
              <InlineSpinnerDemo />
            </DSExample>
            <DSExample label="Determinate progress — 0→100 over 1.4s with a % label">
              <ProgressDemo />
            </DSExample>
          </DSStage>
        </DSSection>

        {/* ——— 5 · Rules ——— */}
        <DSSection title="Rules" purpose="Timing and pattern contracts for every loading experience.">
          <DSTokenTable
            head={["Rule", "Setting", "Why it matters"]}
            rows={[
              [<DSVar key="d">skeleton-delay</DSVar>, "Appear < 300ms after the request", "Prevents a flash of the empty state between request and skeleton."],
              [<DSVar key="m">skeleton-motion</DSVar>, <>Shimmer only — <DSVar>animate-pulse</DSVar></>, "One restrained motion language; no bouncing, spinning or rainbow shimmer."],
              [<DSVar key="s">spinner-scope</DSVar>, "Buttons, inline rows and search fields only", "Full-page spinners hide the structure; skeletons keep it."],
              [<DSVar key="i">min-display</DSVar>, "Skeletons shown ≥ 400ms", "Avoids flicker when cached responses resolve almost instantly."],
              [<DSVar key="b">blocking-scope</DSVar>, "Never block the whole page for a section load", "Independent regions load and finish on their own schedules."],
            ]}
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <DSGuidance kind="do" title="Structure-matched, localized loading">
              Copy the exact geometry of the content that replaces the skeleton (header, tiles, rows),
              keep each region’s loader inside that region, and pair background work with readable
              status text like “Syncing integrations…”.
            </DSGuidance>
            <DSGuidance kind="dont" title="Giant spinners, layout shift, fake delays">
              No full-screen spinners over a rendered page, no skeleton whose heights differ from the
              loaded content (it jumps when content lands), and no artificial delays added to make
              loading “look like it works”.
            </DSGuidance>
          </div>
        </DSSection>

        <DSScreenNav id="loading-states" />
      </div>
    </>
  );
}
