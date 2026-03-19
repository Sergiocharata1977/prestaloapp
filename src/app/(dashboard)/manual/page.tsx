"use client";

import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  LayoutDashboard,
  Scale,
  Settings,
  ShieldCheck,
  ClipboardList,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

type Section = {
  id: string;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeColor?: string;
  iconBg?: string;
  subsections: {
    title: string;
    content: string[];
  }[];
};

const SECTIONS: Section[] = [
  {
    id: "dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
    title: "Dashboard",
    badge: "Operativo",
    badgeColor: "bg-blue-100 text-blue-800",
    iconBg: "bg-blue-100 text-blue-600",
    subsections: [
      {
        title: "¿Qué muestra?",
        content: [
          "Resumen del día: cobros pendientes, créditos vencidos y cartera activa.",
          "Accesos rápidos a las operaciones más frecuentes.",
          "Indicadores de caja y saldo del día.",
        ],
      },
    ],
  },
  {
    id: "clientes",
    icon: <Users className="h-5 w-5" />,
    title: "Clientes",
    badge: "Core",
    badgeColor: "bg-green-100 text-green-800",
    iconBg: "bg-green-100 text-green-600",
    subsections: [
      {
        title: "Lista de clientes",
        content: [
          "Nombre, CUIT, tipo (física/jurídica), clasificación, créditos activos y saldo adeudado.",
          "Filtro por tipo de cliente. Header muestra total de cartera del filtro activo.",
          "Búsqueda por nombre o CUIT con debounce de 300ms.",
          "Vista lista (tabla) o tarjetas.",
        ],
      },
      {
        title: "Alta de clientes",
        content: [
          "Clic en '+ Nuevo cliente' → formulario popup.",
          "Tipo (persona física/jurídica), nombre, CUIT, DNI, teléfono, email, domicilio.",
          "El sistema detecta duplicados por CUIT.",
        ],
      },
      {
        title: "Detalle del cliente — 360°",
        content: [
          "Evaluación vigente, score, tier, límites de crédito, datos Nosis.",
          "Legajo: checklist de documentos requeridos.",
          "Créditos del cliente con estado y cuotas pagas.",
          "Operaciones de cheques vinculadas.",
          "Botón 'Nueva evaluación' y 'Consultar Nosis'.",
        ],
      },
      {
        title: "Evaluación crediticia",
        content: [
          "14 ítems en 3 categorías: Cualitativos (43%), Conflictos (31%), Cuantitativos (26%).",
          "Score final 0-10 determina el tier: A (≥8), B (≥6), C (≥4), Reprobado (<4).",
          "Al guardar queda como evaluación vigente. Las anteriores pasan a historial.",
        ],
      },
    ],
  },
  {
    id: "creditos",
    icon: <CreditCard className="h-5 w-5" />,
    title: "Créditos",
    badge: "Core",
    badgeColor: "bg-green-100 text-green-800",
    iconBg: "bg-green-100 text-green-600",
    subsections: [
      {
        title: "Otorgar un crédito",
        content: [
          "Créditos → '+ Nuevo crédito' o desde la ficha del cliente.",
          "Seleccionar cliente, política crediticia y plan de financiación.",
          "Ingresar capital, cuotas y sistema (Francés o Alemán).",
          "La tasa se resuelve automáticamente según los tramos del plan.",
          "Al confirmar: crédito, cuotas y asiento contable automático.",
        ],
      },
      {
        title: "Cuotas y cobros",
        content: [
          "Cada crédito genera cuotas con fecha de vencimiento, capital, interés y total.",
          "Cobrar: crédito → cuota → 'Cobrar' → popup con caja y medio de pago.",
          "Las cuotas vencidas calculan mora con la tasa punitoria del snapshot.",
          "El recibo de cobro se puede imprimir.",
        ],
      },
      {
        title: "Trazabilidad",
        content: [
          "Cada crédito guarda snapshot de política, plan, tasa mensual, tasa punitoria y cargos.",
          "Cambios futuros en configuración no afectan créditos existentes.",
          "Botón 'Imprimir contrato' con tabla de amortización completa.",
        ],
      },
    ],
  },
  {
    id: "cheques",
    icon: <ClipboardList className="h-5 w-5" />,
    title: "Descuento de cheques",
    badge: "Operativo",
    badgeColor: "bg-blue-100 text-blue-800",
    iconBg: "bg-blue-100 text-blue-600",
    subsections: [
      {
        title: "Nueva operación",
        content: [
          "Cheques → 'Nueva operación'.",
          "Cliente + uno o más cheques: banco, número, CUIT librador, vencimiento, valor nominal.",
          "Preview automático: nominal, días, descuento, gastos y neto a acreditar.",
          "Al confirmar: liquidación + asiento contable automático.",
        ],
      },
      {
        title: "Seguimiento — Kanban",
        content: [
          "Estados: recibido → en_cartera → depositado → acreditado.",
          "Estados de problema: rechazado, pre_judicial, judicial.",
          "Clic en cheque para ver detalle y cambiar estado.",
        ],
      },
    ],
  },
  {
    id: "cobros",
    icon: <Wallet className="h-5 w-5" />,
    title: "Cobros",
    badge: "Operativo",
    badgeColor: "bg-blue-100 text-blue-800",
    iconBg: "bg-blue-100 text-blue-600",
    subsections: [
      {
        title: "Registrar un cobro",
        content: [
          "Desde el detalle del crédito → cuota pendiente → botón 'Cobrar'.",
          "Seleccionar caja, sucursal y medio de pago.",
          "El sistema calcula mora si la cuota está vencida.",
          "Al confirmar genera asiento contable automático.",
        ],
      },
      {
        title: "Lista de cobros",
        content: [
          "Historial completo de cobros con capital, interés, mora y total.",
          "Botón 'Imprimir recibo' por cobro.",
          "Filtro por fecha y cliente.",
        ],
      },
    ],
  },
  {
    id: "scoring",
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Scoring y riesgo",
    badge: "Riesgo",
    badgeColor: "bg-purple-100 text-purple-800",
    iconBg: "bg-purple-100 text-purple-600",
    subsections: [
      {
        title: "Modelo de scoring",
        content: [
          "14 ítems en 3 categorías con pesos configurables.",
          "Score 0-10 → tier: A (≥8), B (≥6), C (≥4), Reprobado (<4).",
          "El analista puede overridear el tier sugerido al aprobar.",
        ],
      },
      {
        title: "Nosis",
        content: [
          "Ficha del cliente → 'Consultar Nosis': score, situación BCRA, cheques rechazados, juicios.",
          "Se guarda historial de consultas.",
          "El score Nosis puede incluirse en la evaluación crediticia.",
        ],
      },
      {
        title: "Líneas de crédito",
        content: [
          "Cada cliente aprobado tiene límite mensual y total.",
          "La ficha muestra: tier vigente, límite, consumido y disponible.",
        ],
      },
    ],
  },
  {
    id: "configuracion",
    icon: <Settings className="h-5 w-5" />,
    title: "Configuración",
    badge: "Admin",
    badgeColor: "bg-amber-100 text-amber-800",
    iconBg: "bg-amber-100 text-amber-600",
    subsections: [
      {
        title: "Tipos de cliente",
        content: [
          "Clasificación interna: Persona A, Persona B, Empresa A, etc.",
          "Cada tipo define si requiere legajo, evaluación vigente, y si acepta cheques.",
          "Sirve para filtrar clientes y aplicar políticas segmentadas.",
        ],
      },
      {
        title: "Políticas crediticias",
        content: [
          "Agrupa condiciones para un segmento de clientes.",
          "Define: legajo requerido, evaluación vigente, límites mensuales y totales.",
        ],
      },
      {
        title: "Planes de financiación",
        content: [
          "Tasas por tramos de cuotas: 3 cuotas → 4.5%, 6 → 5.0%, 12 → 5.8%.",
          "Tasa punitoria mensual, cargo fijo y cargo variable %.",
          "La tasa se aplica automáticamente al crear un crédito.",
        ],
      },
      {
        title: "Cajas y usuarios",
        content: [
          "Cajas: puntos de cobro físicos organizados por sucursal.",
          "Usuarios: altas y roles de operadores de la organización.",
          "Plan de cuentas: árbol Rubros → Cuentas con el plan contable mínimo.",
        ],
      },
    ],
  },
  {
    id: "contabilidad",
    icon: <Scale className="h-5 w-5" />,
    title: "Contabilidad",
    badge: "Financiero",
    badgeColor: "bg-slate-100 text-slate-800",
    iconBg: "bg-slate-100 text-slate-600",
    subsections: [
      {
        title: "Asientos automáticos",
        content: [
          "Otorgar crédito → asiento: Créditos / Intereses no devengados / Ventas financiadas.",
          "Cobrar cuota → asiento: Caja / Créditos / Intereses ganados.",
          "Liquidar cheque → asiento: Cheques en cartera / Caja / Ingresos por descuento.",
          "No hay ingreso manual de asientos.",
        ],
      },
      {
        title: "Plan de cuentas",
        content: [
          "5 rubros: Activo, Pasivo, Patrimonio Neto, Ingresos, Egresos.",
          "26 cuentas mínimas para financiera.",
          "Botón 'Inicializar' carga el plan base automáticamente.",
        ],
      },
    ],
  },
  {
    id: "reportes",
    icon: <FileText className="h-5 w-5" />,
    title: "Reportes",
    badge: "Gestión",
    badgeColor: "bg-teal-100 text-teal-800",
    iconBg: "bg-teal-100 text-teal-600",
    subsections: [
      {
        title: "Reportes disponibles",
        content: [
          "Cartera activa: créditos vigentes con capital pendiente y próximas cuotas.",
          "Líneas consumidas: % de uso del cupo por cliente.",
          "Cartera de cheques: por estado, banco y vencimiento.",
          "Cobros del período: capital, interés y mora.",
        ],
      },
    ],
  },
  {
    id: "impresion",
    icon: <BookOpen className="h-5 w-5" />,
    title: "Impresión",
    badge: "Operativo",
    badgeColor: "bg-blue-100 text-blue-800",
    iconBg: "bg-blue-100 text-blue-600",
    subsections: [
      {
        title: "Documentos imprimibles",
        content: [
          "Contrato de crédito: ficha del crédito → 'Imprimir contrato'.",
          "Recibo de cobro: botón en cada cobro → nueva pestaña.",
          "Liquidación de cheque: detalle de la operación → 'Imprimir liquidación'.",
          "Usar Ctrl+P para imprimir o guardar como PDF.",
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// SectionCard
// ---------------------------------------------------------------------------

function SectionCard({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-sm transition-all",
        open && "shadow-md ring-1 ring-amber-200"
      )}
    >
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-start gap-3 p-5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", section.iconBg ?? "bg-slate-100 text-slate-600")}>
          {section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{section.title}</span>
            {section.badge && (
              <Badge className={cn("text-xs px-2 py-0", section.badgeColor)}>
                {section.badge}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 leading-snug">
            {section.subsections[0].title}
            {section.subsections.length > 1 && ` +${section.subsections.length - 1} más`}
          </p>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 mt-1" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 mt-1" />
        )}
      </button>

      {/* Contenido expandido */}
      {open && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4">
          {section.subsections.map((sub) => (
            <div key={sub.title}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {sub.title}
              </h4>
              <ul className="space-y-1.5">
                {sub.content.map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ManualSistemasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Manual de sistemas</h2>
        <p className="mt-1 text-sm text-slate-500">
          Guía funcional y operativa de PrestaloApp. Hacer clic en cada módulo para expandir.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}
      </div>

      <p className="text-center text-xs text-slate-400">
        PrestaloApp — Plataforma financiera multi-tenant · OLA 9
      </p>
    </div>
  );
}
