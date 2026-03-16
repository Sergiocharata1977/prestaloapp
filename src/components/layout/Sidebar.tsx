"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  BriefcaseBusiness,
  CreditCard,
  LayoutDashboard,
  Scale,
  Wallet,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/creditos", label: "Créditos", icon: CreditCard },
  { href: "/cobros", label: "Cobros", icon: Wallet },
  { href: "/cajas", label: "Cajas", icon: BriefcaseBusiness },
  { href: "/plan-cuentas", label: "Plan de Cuentas", icon: BookOpenText },
  { href: "/libro-diario", label: "Libro Diario", icon: Scale },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b border-white/70 bg-slate-950 text-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r lg:border-white/10">
      <div className="flex h-full flex-col px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/20">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Financiación
            </p>
            <h2 className="text-lg font-semibold tracking-tight">Préstalo</h2>
          </div>
        </div>

        <nav className="mt-6 grid gap-1">
          {items.map(({ href, icon: Icon, label }) => {
            const isActive =
              href === "/" ? pathname === href : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/8 hover:text-white",
                  isActive && "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
