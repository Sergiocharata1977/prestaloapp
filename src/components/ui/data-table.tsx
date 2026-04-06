"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  width?: string;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  containerClassName?: string;
  tableClassName?: string;
  headClassName?: string;
  headerCellClassName?: string;
  rowClassName?: string;
  cellClassName?: string;
  emptyClassName?: string;
  skeletonClassName?: string;
};

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading = false,
  emptyMessage = "No hay registros para mostrar.",
  onRowClick,
  containerClassName,
  tableClassName,
  headClassName,
  headerCellClassName,
  rowClassName,
  cellClassName,
  emptyClassName,
  skeletonClassName,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-slate-200/80 bg-white",
          containerClassName
        )}
      >
        <table className={cn("w-full text-sm", tableClassName)}>
          <thead className={cn("border-b border-slate-200/80 bg-slate-50/60", headClassName)}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn("px-4 py-3 text-left font-medium text-slate-500", headerCellClassName)}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className={cn("border-b border-slate-100 last:border-0", rowClassName)}>
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-3", cellClassName)}>
                    <div className={cn("h-4 animate-pulse rounded bg-slate-200", skeletonClassName)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-48 items-center justify-center rounded-2xl border border-slate-200/80 bg-white",
          emptyClassName
        )}
      >
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-slate-200/80 bg-white",
        containerClassName
      )}
    >
      <table className={cn("w-full text-sm", tableClassName)}>
        <thead className={cn("border-b border-slate-200/80 bg-slate-50/60", headClassName)}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn("px-4 py-3 text-left font-medium text-slate-500", headerCellClassName)}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.id}
              className={cn(
                "border-b border-slate-100 last:border-0 transition-colors",
                onRowClick && "cursor-pointer hover:bg-amber-50/40",
                rowClassName
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn("px-4 py-3 text-slate-700", cellClassName, col.className)}
                >
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
