"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus-visible:border-amber-400 focus-visible:ring-4 focus-visible:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { Input };
