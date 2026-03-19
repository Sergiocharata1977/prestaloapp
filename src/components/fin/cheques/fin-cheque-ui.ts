import type {
  FinCheque,
  FinChequeEstado,
  FinChequeEstadoActual,
  FinChequeEvento,
} from "@/types/fin-cheque";
import type { FinOperacionChequeDetalle } from "@/types/fin-operacion-cheque";

export const CHEQUE_STATUS_ORDER: FinChequeEstadoActual[] = [
  "recibido",
  "en_cartera",
  "depositado",
  "acreditado",
  "rechazado",
  "pre_judicial",
  "judicial",
];

export const CHEQUE_STATUS_LABEL: Record<FinChequeEstadoActual, string> = {
  recibido: "Recibido",
  en_cartera: "En cartera",
  depositado: "Depositado",
  acreditado: "Acreditado",
  rechazado: "Rechazado",
  pre_judicial: "Pre judicial",
  judicial: "Judicial",
};

const STATUS_TONE: Record<FinChequeEstadoActual, string> = {
  recibido: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  en_cartera: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  depositado: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  acreditado: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  rechazado: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  pre_judicial: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  judicial: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
};

const LEGACY_TO_CURRENT: Record<string, FinChequeEstadoActual> = {
  ingresado: "recibido",
  aplicado: "en_cartera",
  pendiente_liquidacion: "en_cartera",
  liquidado: "acreditado",
  anulado: "pre_judicial",
};

export function normalizeChequeEstado(estado: FinChequeEstado): FinChequeEstadoActual {
  return LEGACY_TO_CURRENT[estado] ?? (estado as FinChequeEstadoActual);
}

export function formatChequeEstado(estado: FinChequeEstado): string {
  return CHEQUE_STATUS_LABEL[normalizeChequeEstado(estado)];
}

export function getChequeStatusTone(estado: FinChequeEstado): string {
  return STATUS_TONE[normalizeChequeEstado(estado)];
}

export function formatMoney(value: number, currency = "ARS"): string {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
}

export function formatDate(value?: string): string {
  if (!value) {
    return "-";
  }

  const rawDate = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(rawDate.getTime())) {
    return value;
  }

  return rawDate.toLocaleDateString("es-AR");
}

export function formatDateTime(value?: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatChequeTipo(tipo: FinCheque["tipo"]): string {
  return tipo === "cheque_propio" || tipo === "propio"
    ? "Cheque propio"
    : "Cheque de terceros";
}

export function getDaysToPayment(fechaPago: string): number | null {
  const paymentDate = new Date(`${fechaPago}T00:00:00`);
  if (Number.isNaN(paymentDate.getTime())) {
    return null;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((paymentDate.getTime() - today.getTime()) / 86400000);
}

export function getChequeStatusOptions(estado: FinChequeEstado): FinChequeEstadoActual[] {
  const current = normalizeChequeEstado(estado);
  const transitions: Record<FinChequeEstadoActual, FinChequeEstadoActual[]> = {
    recibido: ["en_cartera", "rechazado"],
    en_cartera: ["depositado", "rechazado"],
    depositado: ["acreditado", "rechazado"],
    acreditado: [],
    rechazado: ["pre_judicial"],
    pre_judicial: ["judicial"],
    judicial: [],
  };

  return transitions[current];
}

export type TimelineItem = {
  id: string;
  date: string;
  title: string;
  description: string;
  tone: string;
};

function buildEventDescription(evento: FinChequeEvento): string {
  const parts = [
    evento.estado_anterior
      ? `${CHEQUE_STATUS_LABEL[evento.estado_anterior]} -> ${CHEQUE_STATUS_LABEL[evento.estado_nuevo]}`
      : CHEQUE_STATUS_LABEL[evento.estado_nuevo],
    evento.motivo ? `Motivo: ${evento.motivo}` : "",
    evento.observaciones || "",
    evento.usuario?.nombre ? `Usuario: ${evento.usuario.nombre}` : "",
  ].filter(Boolean);

  return parts.join(" | ");
}

export function buildChequeTimeline(
  cheque: FinCheque,
  operacion: FinOperacionChequeDetalle | null
): TimelineItem[] {
  const chequeItems: TimelineItem[] = (cheque.eventos ?? []).map(evento => ({
    id: evento.id,
    date: evento.fecha,
    title:
      evento.tipo === "alta"
        ? "Alta del cheque"
        : evento.tipo === "actualizacion_rechazo"
          ? "Actualizacion de rechazo"
          : "Cambio de estado",
    description: buildEventDescription(evento),
    tone: getChequeStatusTone(evento.estado_nuevo),
  }));

  const operationItems: TimelineItem[] = operacion
    ? [
        {
          id: `op-created-${operacion.id}`,
          date: operacion.created_at,
          title: "Operacion vinculada",
          description: `Operacion ${operacion.numero_operacion ?? operacion.id} registrada.`,
          tone: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
        },
        ...(operacion.liquidacion_confirmada_at
          ? [
              {
                id: `op-liquidated-${operacion.id}`,
                date: operacion.liquidacion_confirmada_at,
                title: "Liquidacion confirmada",
                description: `Caja ${operacion.caja_id ?? "-"} | ${operacion.liquidacion_confirmada_por?.nombre ?? "Sin usuario"}`,
                tone: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
              },
            ]
          : []),
      ]
    : [];

  return [...chequeItems, ...operationItems].sort((a, b) => b.date.localeCompare(a.date));
}
