"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-slate-900 text-white shadow-sm hover:bg-slate-800 focus-visible:ring-slate-300",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-500 focus-visible:ring-red-300",
        outline:
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        secondary:
          "bg-amber-100 text-amber-900 hover:bg-amber-200",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        link: "text-amber-700 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-6",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ className, size, variant }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
