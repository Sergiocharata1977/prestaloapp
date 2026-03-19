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
        title: "Lista de clientes",
        content: [
          "La pantalla muestra todos los clientes con: nombre, CUIT, tipo (física/jurídica), clasificación interna, créditos activos y saldo adeudado.",
          "Filtro por tipo de cliente: seleccionar del dropdown para ver solo un segmento. El header muestra cuántos clientes y el total de cartera del filtro.",
          "Búsqueda por nombre o CUIT con debounce de 300ms.",
          "Vista lista (tabla) o tarjetas — alternar con los botones de la esquina derecha.",
        ],
      },
      {
        title: "Alta de clientes",
        content: [
          "Hacer clic en '+ Nuevo cliente'.",
          "Completar: tipo (persona física o jurídica), nombre, CUIT, DNI, teléfono, email y domicilio.",
          "Opcionalmente asignar un tipo de cliente (clasificación interna).",
          "El sistema detecta duplicados por CUIT.",
        ],
      },
      {
        title: "Detalle del cliente — 360°",
        content: [
          "Tab Resumen: evaluación vigente, score, tier asignado, límites de crédito, datos Nosis.",
          "Tab Legajo: checklist de documentos requeridos por tipo de cliente.",
          "Sección Créditos: todos los créditos del cliente con estado y cuotas pagas/total.",
          "Sección Operaciones de cheques: operaciones de descuento vinculadas al cliente (aparece solo si tiene).",
          "Sección Cuenta corriente: historial de cobros con capital, interés y total cobrado.",
          "Botón 'Nueva evaluación': abre el formulario de scoring.",
          "Botón 'Consultar Nosis': dispara consulta al servicio externo.",
        ],
      },
      {
        title: "Evaluación crediticia",
        content: [
          "14 ítems en 3 categorías: Cualitativos (43%), Conflictos (31%), Cuantitativos (26%).",
          "Puntuar del 1 al 10 cada ítem. El score final se calcula en vivo.",
          "Score Nosis opcional — se puede ingresar manualmente.",
          "Al guardar queda como evaluación vigente. Las anteriores pasan a historial.",
          "El analista puede Aprobar (asignar tier y límite) o Rechazar.",
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
          "Ingresar capital, cuotas y sistema (Francés o Alemán).",
          "La tasa mensual se resuelve automáticamente según los tramos del plan.",
          "El panel derecho muestra la tabla de amortización en tiempo real.",
          "Al confirmar: se crea el crédito, se generan las cuotas y se registra el asiento contable automáticamente.",
        ],
      },
      {
        title: "Cuotas y cobros",
        content: [
          "Cada crédito genera cuotas con fecha de vencimiento, capital, interés y total.",
          "Para cobrar: ir al crédito → seleccionar cuota → 'Registrar cobro'.",
          "Seleccionar caja, sucursal y medio de pago.",
          "Las cuotas vencidas calculan mora usando la tasa punitoria del snapshot del crédito.",
          "El recibo de cobro se puede imprimir desde el cobro.",
        ],
      },
      {
        title: "Trazabilidad",
        content: [
          "Cada crédito guarda un snapshot de las condiciones del momento: política, plan, tasa mensual, tasa punitoria, cargos.",
          "Cambios futuros en la configuración no afectan créditos existentes.",
          "El detalle del crédito muestra el contrato imprimible con tabla de amortización completa.",
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
    subsections: [
      {
        title: "Nueva operación",
        content: [
          "Ir a Cheques → 'Nueva operación'.",
          "Seleccionar cliente y cargar uno o más cheques: banco, número, CUIT librador, fecha de vencimiento, valor nominal.",
          "El sistema calcula el descuento por días corridos usando la tasa del plan.",
          "Preview: nominal, días, descuento, gastos fijos, gastos variables y neto a acreditar.",
          "Al confirmar: se liquida la operación y se registra el asiento contable automáticamente.",
        ],
      },
      {
        title: "Seguimiento — Kanban",
        content: [
          "Estados progresivos: recibido → en_cartera → depositado → acreditado.",
          "Estados de problema: rechazado, pre_judicial, judicial.",
          "Hacer clic en un cheque para ver detalle y cambiar estado.",
          "El rechazo permite registrar gastos adicionales.",
          "La liquidación se puede imprimir desde el detalle.",
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
          "14 ítems en 3 categorías con pesos configurables.",
          "Score final 0-10 determina el tier: A (≥8), B (≥6), C (≥4), Reprobado (<4).",
          "El analista puede overridear el tier sugerido al aprobar.",
        ],
      },
      {
        title: "Nosis",
        content: [
          "Ficha del cliente → 'Consultar Nosis': dispara consulta al servicio externo.",
          "Se guarda historial: score, situación BCRA, cheques rechazados, juicios activos, fecha.",
          "El score Nosis puede incluirse en la evaluación crediticia.",
        ],
      },
      {
        title: "Líneas de crédito",
        content: [
          "Cada cliente con evaluación aprobada tiene límite mensual y total.",
          "El sistema valida que un nuevo crédito no supere los límites disponibles.",
          "La ficha del cliente muestra: tier vigente, límite, consumido y disponible.",
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
          "Clasificación interna: ej. Persona A, Persona B, Empresa A, Empresa B.",
          "Cada tipo tiene: nombre, descripción, tipo base (persona/empresa).",
          "En la lista de clientes se puede filtrar por tipo para ver segmentos.",
        ],
      },
      {
        title: "Políticas crediticias",
        content: [
          "Una política agrupa las condiciones para un segmento.",
          "Define: qué tipos de cliente aplican, si requiere legajo y/o evaluación vigente, si acepta cheques propios/terceros.",
          "Múltiples planes de financiación pueden estar asociados a una política.",
        ],
      },
      {
        title: "Planes de financiación",
        content: [
          "Define las tasas según cantidad de cuotas (tramos). Ej: 3 cuotas → 4.5%, 6 → 5.0%, 12 → 5.8%.",
          "Incluye: tasa punitoria mensual (para calcular mora), cargo fijo y cargo variable %.",
          "El plan editor tiene una grilla de tramos con columnas Cuotas / Tasa mensual %.",
          "Al crear un crédito, la tasa se resuelve automáticamente según las cuotas elegidas.",
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
        title: "Principio de diseño",
        content: [
          "Todos los asientos son generados automáticamente por los formularios operativos.",
          "No hay ingreso manual de asientos ni páginas de Libro Diario/Mayor en el sistema.",
          "Los registros contables quedan en la base de datos para auditoría externa.",
        ],
      },
      {
        title: "¿Qué genera un asiento?",
        content: [
          "Otorgar crédito → asiento de 4 líneas: Créditos / Intereses no devengados / Ventas financiadas.",
          "Cobrar cuota → asiento de 4 líneas: Caja / Créditos / Intereses ganados / devengamiento.",
          "Liquidar operación de cheque → asiento: Cheques en cartera / Caja / Ingresos por descuento.",
        ],
      },
      {
        title: "Plan de cuentas",
        content: [
          "Árbol configurable: Rubros → Cuentas.",
          "Naturaleza: activo, pasivo, patrimonio, ingresos, egresos.",
          "La configuración del plugin mapea qué cuenta usar para cada tipo de movimiento.",
        ],
      },
      {
        title: "Cajas y sucursales",
        content: [
          "Cada cobro se asocia a una caja y sucursal.",
          "La caja registra apertura con monto inicial y se cierra con el resumen del día.",
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
          "Líneas consumidas: % de uso del cupo mensual/total por cliente.",
          "Cartera de cheques: cheques en cartera por estado, banco y fecha de vencimiento.",
          "Cheques rechazados: detalle de rechazos con gastos y estado judicial.",
          "Cobros del período: cobros registrados con capital, interés y mora.",
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
          "Contrato de crédito: ficha del crédito → 'Imprimir contrato'. Tabla de amortización completa + datos del cliente + espacio para firmas.",
          "Recibo de cobro: listado de cobros → 'Imprimir recibo'. Cuota pagada, caja, fecha y firma del cobrador.",
          "Liquidación de cheque: detalle de la operación → 'Imprimir liquidación'. Detalle de cheques + cálculo del descuento.",
        ],
      },
      {
        title: "¿Cómo imprimir?",
        content: [
          "Al hacer clic en el botón de impresión, se abre una nueva pestaña con el documento.",
          "Usar Ctrl+P (o Cmd+P en Mac) para imprimir o guardar como PDF.",
          "El documento oculta los elementos de navegación al imprimir.",
        ],
      },
    ],
  },
  {
    id: "datos",
    icon: <FileText className="h-5 w-5" />,
    title: "Datos del sistema",
    badge: "Referencia",
    badgeColor: "bg-gray-100 text-gray-800",
    subsections: [
      {
        title: "Versión actual",
        content: [
          "OLA 9 — Sidebar limpio, filtro por tipo de cliente, detalle 360° del cliente.",
          "Contabilidad: 100% automática. Sin asientos manuales.",
          "Todos los formularios que mueven dinero generan asiento balanceado al confirmar.",
        ],
      },
      {
        title: "Acceso y roles",
        content: [
          "El sistema es multi-tenant: cada organización tiene sus propios datos aislados.",
          "El login es compartido con el ecosistema 9001app.",
          "Las terminales remotas usan autenticación JWT independiente.",
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
        PrestaloApp — Plataforma financiera multi-tenant · OLA 9
      </p>
    </div>
  );
}
