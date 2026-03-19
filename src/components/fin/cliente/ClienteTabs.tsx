"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TabId = "resumen" | "legajo";

type ClienteTabItem = {
  id: TabId;
  label: string;
  icon?: ReactNode;
  badge?: string;
};

interface ClienteTabsProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
  items: ClienteTabItem[];
}

export function ClienteTabs({ activeTab, onChange, items }: ClienteTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      {items.map((item) => {
        const active = item.id === activeTab;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge ? (
              <Badge
                variant="outline"
                className={cn(
                  "border-current/20 bg-transparent",
                  active ? "text-white" : "text-slate-600"
                )}
              >
                {item.badge}
              </Badge>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
