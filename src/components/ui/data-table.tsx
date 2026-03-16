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
};

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading = false,
  emptyMessage = "No hay registros para mostrar.",
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200/80 bg-slate-50/60">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left font-medium text-slate-500"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 animate-pulse rounded bg-slate-200" />
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
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-200/80 bg-white">
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200/80 bg-slate-50/60">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left font-medium text-slate-500"
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
                onRowClick && "cursor-pointer hover:bg-amber-50/40"
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn("px-4 py-3 text-slate-700", col.className)}
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
