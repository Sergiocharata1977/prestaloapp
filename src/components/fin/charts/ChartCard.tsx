"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChartLegendItem = {
  label: string;
  color: string;
};

export function ChartCard({
  eyebrow,
  title,
  description,
  metricLabel,
  metricValue,
  legend,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  metricLabel?: string;
  metricValue?: string;
  legend?: ChartLegendItem[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("chart-panel", className)}>
      <div className="chart-panel__glow" aria-hidden="true" />

      <div className="flex flex-col gap-4 border-b border-white/60 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          {eyebrow ? (
            <span className="inline-flex rounded-full border border-amber-200/80 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              {eyebrow}
            </span>
          ) : null}
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
            {description ? (
              <p className="max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          {metricValue ? (
            <div className="rounded-2xl border border-amber-200/70 bg-white/80 px-4 py-3 text-right shadow-[0_14px_32px_rgba(180,83,9,0.08)] backdrop-blur-sm">
              {metricLabel ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {metricLabel}
                </p>
              ) : null}
              <p className="mt-1 font-mono text-2xl font-semibold text-slate-950">{metricValue}</p>
            </div>
          ) : null}

          {legend?.length ? (
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {legend.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.85)]"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  {item.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4">{children}</div>
    </section>
  );
}

export function ChartTooltipCard({
  title,
  rows,
}: {
  title?: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div className="chart-tooltip">
      {title ? <p className="chart-tooltip__title">{title}</p> : null}
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-xs text-slate-500">
              {row.color ? (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: row.color }}
                  aria-hidden="true"
                />
              ) : null}
              {row.label}
            </span>
            <span className="font-mono text-sm font-semibold text-slate-950">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
