"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Shield, Users, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/organizaciones", label: "Organizaciones", icon: Building2 },
  { href: "/super-admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/super-admin/demo-requests", label: "Demo Requests", icon: ClipboardList },
];

export function SuperAdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b border-white/10 bg-blue-950 text-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/30">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-blue-300">
              Sistema
            </p>
            <h2 className="text-lg font-semibold tracking-tight">Super Admin</h2>
          </div>
        </div>

        <nav className="mt-6 grid gap-1">
          {items.map(({ href, icon: Icon, label }) => {
            const isActive =
              pathname === href ||
              (href !== "/super-admin" && pathname.startsWith(href));

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-blue-200 transition-colors hover:bg-white/8 hover:text-white",
                  isActive &&
                    "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs text-blue-400 transition-colors hover:text-blue-200"
          >
            ← Volver al panel de organización
          </Link>
        </div>
      </div>
    </aside>
  );
}
