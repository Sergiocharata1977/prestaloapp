"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  BookOpenText,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  MonitorSmartphone,
  Scale,
  Settings,
  TableProperties,
  Users,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

const mainItems = [
  { href: "/dashboard",          label: "Dashboard",      icon: LayoutDashboard },
  { href: "/clientes",           label: "Clientes",       icon: Users },
  { href: "/creditos",           label: "Creditos",       icon: CreditCard },
  { href: "/operaciones-cheques",label: "Cheques",        icon: ClipboardList },
  { href: "/cobros",             label: "Cobros",         icon: Wallet },
  { href: "/cajas",              label: "Cajas",          icon: BriefcaseBusiness },
];

const configItems = [
  { href: "/tipos-cliente",         label: "Tipos cliente", icon: Users },
  { href: "/politicas-crediticias", label: "Politicas",     icon: Scale },
  { href: "/planes-financiacion",   label: "Planes",        icon: BookOpenText },
];

const bottomItems = [
  { href: "/reportes",      label: "Reportes",       icon: FileText },
  { href: "/plan-cuentas",  label: "Plan de Cuentas",icon: BookOpenText },
  { href: "/asientos",      label: "Libro Diario",   icon: Scale },
  { href: "/asientos/mayor",label: "Mayor",          icon: TableProperties },
  { href: "/manual",        label: "Manual",         icon: BookOpen },
];

const capabilityItems = [
  {
    href: "/terminales",
    label: "Terminales",
    icon: MonitorSmartphone,
    capability: "terminal_control",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function NavLink({
  href,
  icon: Icon,
  label,
  pathname,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  pathname: string;
}) {
  const isActive =
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  return (
    <Link
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
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar() {
  const pathname = usePathname();
  const { capabilities } = useAuth();

  const visibleCapabilityItems = capabilityItems.filter((item) =>
    capabilities.includes(item.capability)
  );

  const configActive = configItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href)
  );
  const [configOpen, setConfigOpen] = useState(configActive);

  return (
    <aside className="w-full border-b border-white/70 bg-slate-950 text-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r lg:border-white/10">
      <div className="flex h-full flex-col overflow-y-auto px-4 py-5 sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/20">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Financiacion
            </p>
            <h2 className="text-lg font-semibold tracking-tight">Prestalo</h2>
          </div>
        </div>

        {/* Main nav */}
        <nav className="mt-6 grid gap-1">
          {mainItems.map(({ href, icon, label }) => (
            <NavLink key={href} href={href} icon={icon} label={label} pathname={pathname} />
          ))}
        </nav>

        {/* Configuración — desplegable */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setConfigOpen((v) => !v)}
            className={cn(
              "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
              configActive
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:bg-white/8 hover:text-white"
            )}
          >
            <span className="flex items-center gap-3">
              <Settings className="h-4 w-4" />
              Configuracion
            </span>
            {configOpen ? (
              <ChevronDown className="h-4 w-4 opacity-60" />
            ) : (
              <ChevronRight className="h-4 w-4 opacity-60" />
            )}
          </button>

          {configOpen && (
            <div className="ml-3 mt-1 grid gap-1 border-l border-white/10 pl-3">
              {configItems.map(({ href, icon, label }) => (
                <NavLink key={href} href={href} icon={icon} label={label} pathname={pathname} />
              ))}
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <nav className="mt-6 grid gap-1">
          {bottomItems.map(({ href, icon, label }) => (
            <NavLink key={href} href={href} icon={icon} label={label} pathname={pathname} />
          ))}
        </nav>

        {/* IT / Gobierno */}
        {visibleCapabilityItems.length > 0 && (
          <div className="mt-8">
            <p className="px-4 text-xs uppercase tracking-[0.24em] text-slate-500">
              IT / Gobierno
            </p>
            <nav className="mt-3 grid gap-1">
              {visibleCapabilityItems.map(({ href, icon, label }) => (
                <NavLink key={href} href={href} icon={icon} label={label} pathname={pathname} />
              ))}
            </nav>
          </div>
        )}
      </div>
    </aside>
  );
}
