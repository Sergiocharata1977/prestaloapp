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
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    subsections: [
      {
        title: "Alta de clientes",
        content: [
          "Hacer clic en '+ Nuevo cliente' en la pantalla de Clientes.",
          "Completar: tipo de cliente (persona física o jurídica), nombre, CUIT, DNI, teléfono, email y domicilio.",
          "El sistema asigna automáticamente el tipo de clasificación interno si se configuró un tipo de cliente.",
          "Una vez guardado, el cliente aparece en el listado con vista de tarjeta o tabla.",
        ],
      },
      {
        title: "Ficha del cliente",
        content: [
          "Muestra datos personales, créditos activos, cuenta corriente, evaluación crediticia vigente y datos Nosis.",
          "Tab Resumen: evaluación vigente con score final, score Nosis, tier sugerido y asignado, límites.",
          "Tab Legajo: checklist de documentos por tipo de cliente (DNI, ingresos, etc.). Marcar como completo cada ítem.",
          "Botón 'Nueva evaluación': abre el formulario de scoring con los 14 ítems del modelo.",
          "Botón 'Consultar Nosis': dispara la consulta al servicio externo y guarda el historial.",
        ],
      },
      {
        title: "Evaluación crediticia",
        content: [
          "Se accede desde la ficha del cliente o desde el menú lateral.",
          "14 ítems agrupados en 3 categorías: Cualitativos (43%), Conflictos (31%), Cuantitativos (26%).",
          "Puntuar cada ítem del 1 al 10. El score final se calcula en vivo.",
          "Score Nosis es opcional; se puede ingresar manualmente si se consultó por fuera.",
          "Al guardar, la evaluación queda marcada como vigente. Las anteriores pasan a historial.",
          "El analista puede luego Aprobar (asignar tier y límite) o Rechazar la evaluación.",
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
    subsections: [
      {
        title: "Otorgar un crédito",
        content: [
          "Ir a Créditos → '+ Nuevo crédito' o desde la ficha del cliente.",
          "Seleccionar cliente, política crediticia y plan de financiación.",
          "Ingresar capital, cantidad de cuotas y sistema de amortización (Francés o Alemán).",
          "El sistema resuelve la tasa mensual automáticamente según los tramos del plan seleccionado.",
          "El panel derecho muestra la tabla de amortización en tiempo real antes de confirmar.",
          "Al confirmar: se crea el crédito, se generan las cuotas y se registra el asiento contable.",
        ],
      },
      {
        title: "Cuotas y cobros",
        content: [
          "Cada crédito genera cuotas con fecha de vencimiento, capital, interés y total.",
          "Para cobrar una cuota: ir al crédito → seleccionar cuota → 'Registrar cobro'.",
          "Seleccionar caja, sucursal y medio de pago. El sistema registra el cobro y actualiza el saldo.",
          "Las cuotas vencidas calculan mora automáticamente usando la tasa punitoria del snapshot del crédito.",
          "El recibo de cobro se puede imprimir desde el botón 'Imprimir recibo' en cada cobro.",
        ],
      },
      {
        title: "Trazabilidad",
        content: [
          "Cada crédito guarda un snapshot de las condiciones al momento del otorgamiento: política, plan, tasa mensual, tasa punitoria, cargos.",
          "Esto garantiza que cambios futuros en la configuración no afecten créditos existentes.",
          "El detalle del crédito muestra el contrato imprimible con tabla de amortización completa.",
        ],
      },
    ],
  },
  {
    id: "cheques",
    icon: <FileText className="h-5 w-5" />,
    title: "Descuento de cheques",
    badge: "Operativo",
    badgeColor: "bg-blue-100 text-blue-800",
    subsections: [
      {
        title: "Nueva operación de cheque",
        content: [
          "Ir a Cheques → 'Nueva operación'.",
          "Seleccionar cliente y cargar uno o más cheques: banco, número, CUIT librador, fecha de vencimiento, valor nominal.",
          "El sistema calcula el descuento por días corridos usando la tasa del plan asociado a la política del cliente.",
          "La pantalla de preview muestra: nominal, días, descuento, gastos fijos, gastos variables y neto a acreditar.",
          "Al confirmar se liquida la operación, se registra el asiento contable y los cheques quedan en estado 'en_cartera'.",
        ],
      },
      {
        title: "Seguimiento — Kanban",
        content: [
          "La vista Kanban agrupa los cheques por estado: recibido → en_cartera → depositado → acreditado.",
          "Estados de problema: rechazado, pre_judicial, judicial.",
          "Hacer clic en un cheque para ver el detalle y cambiar el estado.",
          "El rechazo de cheque permite registrar gastos adicionales.",
          "La liquidación de la operación se puede imprimir desde el detalle.",
        ],
      },
    ],
  },
  {
    id: "scoring",
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Scoring y evaluación de riesgo",
    badge: "Riesgo",
    badgeColor: "bg-purple-100 text-purple-800",
    subsections: [
      {
        title: "Modelo de scoring",
        content: [
          "El sistema combina score propio (14 ítems) y score externo Nosis.",
          "Los 14 ítems se agrupan en 3 categorías con pesos configurables: cualitativos, conflictos, cuantitativos.",
          "El resultado es un score de 0 a 10 que determina el tier: A (≥8), B (≥6), C (≥4), Reprobado (<4).",
          "El analista puede overridear el tier sugerido asignando un tier diferente al aprobar la evaluación.",
        ],
      },
      {
        title: "Nosis",
        content: [
          "Desde la ficha del cliente → 'Consultar Nosis' para disparar la consulta al servicio externo.",
          "Se guarda historial con: score, situación BCRA, cheques rechazados, juicios activos, fecha y estado.",
          "El score Nosis puede incluirse en la evaluación crediticia.",
          "La frecuencia de vigencia de la evaluación se configura en Configuración → Scoring (meses).",
        ],
      },
      {
        title: "Líneas de crédito",
        content: [
          "Cada cliente con evaluación aprobada puede tener una línea de crédito con límite mensual y total.",
          "El sistema valida automáticamente que un nuevo crédito no supere los límites disponibles.",
          "La ficha del cliente muestra: tier vigente, límite mensual/total, consumido y disponible.",
          "El recálculo de cupo se puede disparar manualmente desde la ficha del cliente.",
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
    subsections: [
      {
        title: "Tipos de cliente",
        content: [
          "Definen la clasificación interna: ej. Persona A, Persona B, Empresa A, Empresa B.",
          "Cada tipo tiene: nombre, descripción, habilitado para personas físicas / jurídicas.",
          "Los tipos de cliente determinan qué política y plan aplica por defecto.",
        ],
      },
      {
        title: "Políticas crediticias",
        content: [
          "Una política agrupa las condiciones para un segmento de clientes.",
          "Define: qué tipos de cliente aplican, si se requiere legajo completo, si se requiere evaluación vigente, si acepta cheques propios / de terceros.",
          "Múltiples planes de financiación pueden estar asociados a una política.",
        ],
      },
      {
        title: "Planes de financiación",
        content: [
          "Un plan define las tasas que aplican según cantidad de cuotas.",
          "Ejemplo: 3 cuotas → 4.5% mensual, 6 cuotas → 5.0%, 12 cuotas → 5.8%.",
          "Además incluye: tasa punitoria mensual, cargo fijo y cargo variable porcentual.",
          "Al crear un crédito se selecciona el plan; la tasa se resuelve automáticamente según las cuotas elegidas.",
          "El plan editor tiene una grilla de tramos: filas con 'Cuotas' y 'Tasa mensual %'.",
        ],
      },
      {
        title: "Configuración de scoring",
        content: [
          "Se accede via API /api/fin/config/scoring.",
          "Permite ajustar los pesos de cada categoría (cualitativo / conflictos / cuantitativo).",
          "También define los umbrales de cada tier y la frecuencia de vigencia en meses.",
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
    subsections: [
      {
        title: "Plan de cuentas",
        content: [
          "Árbol contable configurable por organización.",
          "Soporta activo, pasivo, patrimonio, ingresos y egresos.",
          "Las cuentas se usan en los asientos automáticos que genera el sistema al otorgar créditos y liquidar cheques.",
        ],
      },
      {
        title: "Libro diario y mayor",
        content: [
          "Cada operación (cobro, otorgamiento, liquidación de cheque) genera un asiento automático.",
          "El libro diario muestra todos los asientos ordenados por fecha.",
          "El mayor agrupa movimientos por cuenta contable.",
        ],
      },
      {
        title: "Cajas y sucursales",
        content: [
          "Cada cobro se asocia a una caja y sucursal.",
          "La caja registra apertura con monto inicial y se cierra con el resumen del día.",
          "El reporte de caja muestra: cobros, liquidaciones y saldo final.",
        ],
      },
    ],
  },
  {
    id: "reportes",
    icon: <Wallet className="h-5 w-5" />,
    title: "Reportes",
    badge: "Gestión",
    badgeColor: "bg-teal-100 text-teal-800",
    subsections: [
      {
        title: "Reportes disponibles",
        content: [
          "Cartera activa: créditos vigentes con capital pendiente y próximas cuotas a vencer.",
          "Líneas consumidas: porcentaje de uso del cupo mensual y total por cliente.",
          "Cartera de cheques: cheques en cartera por estado, banco y fecha de vencimiento.",
          "Cheques rechazados: detalle de rechazos con gastos y estado judicial.",
          "Cobros del período: cobros registrados con detalle de capital, interés y mora.",
        ],
      },
    ],
  },
  {
    id: "impresion",
    icon: <BookOpen className="h-5 w-5" />,
    title: "Impresión de documentos",
    badge: "Operativo",
    badgeColor: "bg-blue-100 text-blue-800",
    subsections: [
      {
        title: "Documentos imprimibles",
        content: [
          "Contrato de crédito: desde la ficha del crédito → 'Imprimir contrato'. Incluye tabla de amortización completa, datos del cliente, condiciones aplicadas y espacio para firmas.",
          "Recibo de cobro: desde el listado de cobros de un crédito → 'Imprimir recibo'. Incluye datos del cuota pagada, caja, fecha y firma del cobrador.",
          "Liquidación de cheque: desde el detalle de la operación → 'Imprimir liquidación'. Incluye detalle de cheques, cálculo del descuento y condiciones aplicadas.",
        ],
      },
      {
        title: "¿Cómo imprimir?",
        content: [
          "Al hacer clic en el botón de impresión, se abre una nueva pestaña con el documento.",
          "Usar Ctrl+P (o Cmd+P en Mac) para imprimir o guardar como PDF.",
          "El documento oculta automáticamente los elementos de navegación al imprimir.",
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// AccordionSection
// ---------------------------------------------------------------------------

function AccordionSection({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                {section.icon}
              </div>
              <CardTitle className="text-base font-semibold text-slate-900">
                {section.title}
              </CardTitle>
              {section.badge && (
                <Badge className={cn("text-xs", section.badgeColor)}>
                  {section.badge}
                </Badge>
              )}
            </div>
            {open ? (
              <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
            )}
          </div>
        </CardHeader>
      </button>

      {open && (
        <CardContent className="space-y-6 pt-0">
          {section.subsections.map((sub) => (
            <div key={sub.title}>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">
                {sub.title}
              </h4>
              <ul className="space-y-1.5">
                {sub.content.map((line, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-slate-600"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ManualSistemasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">
          Manual de sistemas
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Guía funcional y operativa de PrestaloApp. Hacer clic en cada módulo
          para expandir.
        </p>
      </div>

      <div className="grid gap-3">
        {SECTIONS.map((section) => (
          <AccordionSection key={section.id} section={section} />
        ))}
      </div>

      <p className="text-center text-xs text-slate-400">
        PrestaloApp — Plataforma financiera multi-tenant · Versión 1.0
      </p>
    </div>
  );
}
