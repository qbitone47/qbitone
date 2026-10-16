"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./primitives";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render: (row: T, index: number) => React.ReactNode;
  /** hide column below breakpoint (responsive column management) */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  minWidth?: number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** rows per page; 0 disables pagination */
  pageSize?: number;
  emptyTitle?: string;
  emptyMessage?: string;
  /** optional structured list rendering on mobile instead of horizontal scroll */
  mobileCard?: (row: T) => React.ReactNode;
  rowClassName?: (row: T) => string;
  dense?: boolean;
  /** caption for screen readers */
  caption?: string;
}

const HIDE_BELOW_CLS: Record<string, string> = {
  sm: "max-sm:hidden",
  md: "max-md:hidden",
  lg: "max-lg:hidden",
  xl: "max-xl:hidden",
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  pageSize = 8,
  emptyTitle = "No records found",
  emptyMessage = "Try adjusting your search or filters.",
  mobileCard,
  rowClassName,
  dense,
  caption,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = React.useState(0);

  React.useEffect(() => {
    setPage(0);
  }, [rows.length, sort]);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sort, columns]);

  const total = sorted.length;
  const effectivePageSize = pageSize; // 0 = all
  const pageCount = effectivePageSize > 0 ? Math.max(1, Math.ceil(total / effectivePageSize)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const visible = effectivePageSize > 0 ? sorted.slice(safePage * effectivePageSize, safePage * effectivePageSize + effectivePageSize) : sorted;

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));
  };

  const cellPad = dense ? "px-3 py-2" : "px-3 py-2.5 md:px-4 md:py-3";

  return (
    <div className="qubit-card overflow-hidden">
      {/* Mobile: structured cards */}
      {mobileCard && (
        <div className="divide-y divide-slate-100 md:hidden" role="list">
          {visible.length === 0 ? (
            <EmptyState icon={<Inbox />} title={emptyTitle} message={emptyMessage} />
          ) : (
            visible.map((row) => (
              <div
                key={rowKey(row)}
                role="listitem"
                onClick={() => onRowClick?.(row)}
                className={cn("px-4 py-3", onRowClick && "cursor-pointer active:bg-slate-50")}
              >
                {mobileCard(row)}
              </div>
            ))
          )}
        </div>
      )}

      {/* Desktop/tablet: table with controlled horizontal scroll */}
      <div className={cn("qubit-scroll overflow-x-auto", mobileCard && "hidden md:block")}>
        <table className="w-full border-collapse text-sm" style={{ minWidth: columns.length * 110 }} aria-label={caption}>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-200/90 bg-slate-50/95 backdrop-blur-sm">
              {columns.map((col) => {
                const sortedActive = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={sortedActive ? (sort!.dir === "asc" ? "ascending" : "descending") : col.sortable ? "none" : undefined}
                    className={cn(
                      "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 md:px-4",
                      col.headerClassName,
                      col.hideBelow && HIDE_BELOW_CLS[col.hideBelow],
                      col.sortable && "cursor-pointer select-none hover:text-slate-800",
                    )}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                    onKeyDown={col.sortable ? (e) => e.key === "Enter" && toggleSort(col.key) : undefined}
                    tabIndex={col.sortable ? 0 : undefined}
                    style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.sortable && (
                        <span className={cn("text-slate-300", sortedActive && "text-navy-600")}>
                          {sortedActive && sort!.dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className={cn("h-3 w-3", !sortedActive && "opacity-0", sortedActive && sort!.dir === "asc" && "opacity-100")} />}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState icon={<Inbox />} title={emptyTitle} message={emptyMessage} />
                </td>
              </tr>
            ) : (
              visible.map((row, i) => (
                <tr
                  key={rowKey(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter") onRowClick(row);
                        }
                      : undefined
                  }
                  className={cn(
                    "transition-colors duration-150",
                    onRowClick && "cursor-pointer hover:bg-blue-50/40 focus-visible:bg-blue-50/60",
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(cellPad, "align-middle text-slate-700", col.className, col.hideBelow && HIDE_BELOW_CLS[col.hideBelow])}
                    >
                      {col.render(row, i)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {effectivePageSize > 0 && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-2.5">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Showing <span className="font-medium text-slate-700">{safePage * effectivePageSize + 1}–{Math.min((safePage + 1) * effectivePageSize, total)}</span> of{" "}
            <span className="font-medium text-slate-700">{total}</span>
          </p>
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Previous page" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-1.5 text-xs text-slate-600">
                Page {safePage + 1} of {pageCount}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Next page" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
