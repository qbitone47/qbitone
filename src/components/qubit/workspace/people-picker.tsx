"use client";

import * as React from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { employees } from "@/lib/qubit/data";
import { Avatar } from "../primitives";

// ============================================================
// PeoplePicker — enterprise contact lookup used by Compose Mail,
// Document sharing and any recipient field. Reads the SAME
// employee registry as the rest of the system (no duplicate
// contact database — spec §16/§54).
// ============================================================

export interface PickedPerson {
  /** employee id, or a raw external email address */
  value: string;
  label: string;
  email: string;
  external?: boolean;
}

export function PeoplePicker({
  selected,
  onChange,
  placeholder = "Search people by name, designation or email…",
  allowExternal = true,
  ariaLabel,
  autoFocus,
  invalid,
}: {
  selected: PickedPerson[];
  onChange: (next: PickedPerson[]) => void;
  placeholder?: string;
  allowExternal?: boolean;
  ariaLabel: string;
  autoFocus?: boolean;
  invalid?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [focusSignal, setFocusSignal] = React.useState(0);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  // focus follows picks without touching refs during render
  React.useEffect(() => {
    if (focusSignal > 0) inputRef.current?.focus();
  }, [focusSignal]);

  const q = query.trim().toLowerCase();
  const matches = React.useMemo(() => {
    if (!q) return [];
    return employees
      .filter(
        (e) =>
          e.status === "Active" &&
          (e.name.toLowerCase().includes(q) ||
            e.title.toLowerCase().includes(q) ||
            e.department.toLowerCase().includes(q) ||
            e.email.toLowerCase().includes(q) ||
            e.employeeId.toLowerCase().includes(q)),
      )
      .filter((e) => !selected.some((s) => s.value === e.id))
      .slice(0, 6);
  }, [q, selected]);

  const externalValid = allowExternal && emailLike(q) && !selected.some((s) => s.value === q.toLowerCase());

  const pick = (p: PickedPerson) => {
    onChange([...selected, p]);
    setQuery("");
    setOpen(false);
    setActiveIdx(0);
    setFocusSignal((n) => n + 1);
  };

  const remove = (value: string) => onChange(selected.filter((s) => s.value !== value));

  const onKeyDown = (e: React.KeyboardEvent) => {
    const optionCount = matches.length + (externalValid ? 1 : 0);
    if (!optionCount) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => (i + 1) % optionCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + optionCount) % optionCount);
    } else if (e.key === "Enter" && open && optionCount > 0) {
      e.preventDefault();
      if (activeIdx < matches.length) {
        const emp = matches[activeIdx];
        pick({ value: emp.id, label: emp.name, email: emp.email });
      } else {
        pick({ value: q.toLowerCase(), label: q, email: q.toLowerCase(), external: true });
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && selected.length > 0) {
      onChange(selected.slice(0, -1));
    }
  };

  const options: { key: string; node: React.ReactNode; onPick: () => void; idx: number }[] = [
    ...matches.map((emp, i) => ({
      key: emp.id,
      node: (
        <>
          <Avatar name={emp.name} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-slate-800">{emp.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {emp.title} · {emp.email}
            </span>
          </span>
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-medium text-slate-500">{emp.department}</span>
        </>
      ),
      onPick: () => pick({ value: emp.id, label: emp.name, email: emp.email }),
      idx: i,
    })),
    ...(externalValid
      ? [
          {
            key: "__external",
            node: (
              <>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">@</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-800">{q.toLowerCase()}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">External address — outside the organization</span>
                </span>
              </>
            ),
            onPick: () => pick({ value: q.toLowerCase(), label: q.toLowerCase(), email: q.toLowerCase(), external: true }),
            idx: matches.length,
          },
        ]
      : []),
  ];

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1 rounded-lg border bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors",
          invalid ? "border-red-300" : "border-slate-200 focus-within:border-blue-300",
        )}
        onClick={() => setFocusSignal((n) => n + 1)}
      >
        {selected.map((s) => (
          <span
            key={s.value}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
              s.external ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-100 bg-blue-50 text-blue-800",
            )}
          >
            <span className="truncate">{s.label}</span>
            <button
              type="button"
              aria-label={`Remove ${s.label}`}
              className="rounded-sm p-px hover:bg-black/5"
              onClick={(e) => {
                e.stopPropagation();
                remove(s.value);
              }}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        <span className="relative flex min-w-32 flex-1 items-center gap-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open && options.length > 0}
            aria-controls="people-picker-listbox"
            aria-label={ariaLabel}
            aria-invalid={invalid}
            autoFocus={autoFocus}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActiveIdx(0);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={selected.length === 0 ? placeholder : ""}
            className="h-7 w-full min-w-24 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
        </span>
      </div>

      {open && options.length > 0 && (
        <ul
          id="people-picker-listbox"
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg qubit-scroll"
        >
          {options.map((o) => (
            <li key={o.key} role="option" aria-selected={o.idx === activeIdx}>
              <button
                type="button"
                onClick={o.onPick}
                onMouseEnter={() => setActiveIdx(o.idx)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                  o.idx === activeIdx ? "bg-blue-50" : "hover:bg-slate-50",
                )}
              >
                {o.node}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function emailLike(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// ============================================================
// CollapsibleFieldToggle — the small "Cc / Bcc" affordance row
// ============================================================

export function FieldToggle({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-500 transition-colors hover:text-blue-700"
    >
      {label}
      <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} aria-hidden />
    </button>
  );
}
