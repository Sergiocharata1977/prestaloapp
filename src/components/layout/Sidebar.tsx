"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  BookOpen,
  BookOpenText,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Gavel,
  Layers,
  LayoutDashboard,
  MonitorSmartphone,
  Package,
  Scale,
  Settings,
  ShoppingBag,
  Siren,
  UserCircle2,
  Users,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

const mainItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes",  label: "Clientes",  icon: Users },
  { href: "/cobros",    label: "Cobros",    icon: Wallet },
];

const operacionesItems = [
  { href: "/creditos",            label: "Prestamos",        icon: CreditCard,    capability: undefined },
  { href: "/operaciones-cheques", label: "Cheques",          icon: ClipboardList, capability: undefined },
  { href: "/ventas-financiadas",  label: "Venta Financiada", icon: ShoppingBag,   capability: "productos" },
];

const accionesItems = [
  { href: "/acciones/mora-temprana", label: "Mora temprana", icon: Siren },
  { href: "/acciones/judiciales", label: "Judiciales", icon: Gavel },
];

const configItems = [
  { href: "/tipos-cliente",          label: "Tipos cliente",   icon: Users },
  { href: "/politicas-crediticias",  label: "Politicas",       icon: Scale },
  { href: "/planes-financiacion",    label: "Planes",          icon: BookOpenText },
  { href: "/cajas",                  label: "Cajas",           icon: BriefcaseBusiness },
  { href: "/usuarios",               label: "Usuarios",        icon: UserCircle2 },
  { href: "/plan-cuentas",           label: "Plan de Cuentas", icon: BookOpen },
  { href: "/configuracion/plugins",  label: "Plugins",         icon: Package },
];

const reportesItems = [
  { href: "/reportes",                              label: "Operativos",      icon: FileText,    capability: undefined },
  { href: "/reportes/proyeccion-cobranzas",         label: "Proyec. cobros",  icon: CalendarDays, capability: "proyeccion_cobranzas" },
  { href: "/reportes/indicadores-comerciales",      label: "Indicadores",     icon: BarChart2,    capability: "analytics_comercial" },
];

const bottomItems = [
  { href: "/manual", label: "Manual", icon: BookOpen },
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

function CollapsibleSection({
  label,
  icon: Icon,
  items,
  pathname,
}: {
  label: string;
  icon: React.ElementType;
  items: { href: string; label: string; icon: React.ElementType; capability?: string }[];
  pathname: string;
}) {
  const { capabilities } = useAuth();

  const visibleItems = items.filter(
    (item) => !item.capability || capabilities.includes(item.capability)
  );

  const isActive = visibleItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href)
  );
  const [open, setOpen] = useState(isActive);

  if (visibleItems.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
          isActive
            ? "bg-white/10 text-white"
            : "text-slate-400 hover:bg-white/8 hover:text-white"
        )}
      >
        <span className="flex items-center gap-3">
          <Icon className="h-4 w-4" />
          {label}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 opacity-60" />
        ) : (
          <ChevronRight className="h-4 w-4 opacity-60" />
        )}
      </button>

      {open && (
        <div className="ml-3 mt-1 grid gap-1 border-l border-white/10 pl-3">
          {visibleItems.map(({ href, icon, label: itemLabel }) => (
            <NavLink key={href} href={href} icon={icon} label={itemLabel} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
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

        {/* Operaciones — desplegable */}
        <div className="mt-5">
          <CollapsibleSection
            label="Operaciones"
            icon={Layers}
            items={operacionesItems}
            pathname={pathname}
          />
        </div>

        {/* Reportes — desplegable */}
        <div className="mt-5">
          <CollapsibleSection
            label="Reportes"
            icon={FileText}
            items={reportesItems}
            pathname={pathname}
          />
        </div>

        {/* Bottom nav */}
        <nav className="mt-5 grid gap-1">
          {bottomItems.map(({ href, icon, label }) => (
            <NavLink key={href} href={href} icon={icon} label={label} pathname={pathname} />
          ))}
        </nav>

        <div className="mt-5">
          <CollapsibleSection
            label="Acciones"
            icon={ClipboardList}
            items={accionesItems}
            pathname={pathname}
          />
        </div>

        {/* Configuracion — desplegable */}
        <div className="mt-5">
          <CollapsibleSection
            label="Configuracion"
            icon={Settings}
            items={configItems}
            pathname={pathname}
          />
        </div>

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
