import type {
  ChequeDraft,
  ChequeOperation,
  ChequeStatus,
  OfferPreview,
  OfferTerms,
} from "@/components/fin/cheques/types";

const DEFAULT_TERMS: OfferTerms = {
  tasaDescuentoMensual: 4.2,
  gastoFijoPorCheque: 2500,
  gastoVariablePct: 1.1,
};

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function ars(value: number) {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

export function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatStatus(status: ChequeStatus) {
  switch (status) {
    case "borrador":
      return "Borrador";
    case "cotizada":
      return "Cotizada";
    case "aprobada":
      return "Aprobada";
    case "liquidada":
      return "Liquidada";
    case "rechazada":
      return "Rechazada";
    default:
      return status;
  }
}

export function getStatusTone(status: ChequeStatus) {
  switch (status) {
    case "liquidada":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "aprobada":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    case "cotizada":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "rechazada":
      return "bg-red-50 text-red-700 ring-1 ring-red-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
}

export function calculateOfferPreview(
  cheques: ChequeDraft[],
  terms: OfferTerms = DEFAULT_TERMS
): OfferPreview {
  const today = new Date();
  const normalizedToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  let nominalTotal = 0;
  let descuentoTotal = 0;
  let gastosTotal = 0;
  let weightedDays = 0;

  cheques.forEach((cheque) => {
    const nominal = Number(cheque.nominal) || 0;
    const paymentDate = new Date(`${cheque.fechaPago}T00:00:00`);
    const diffMs = paymentDate.getTime() - normalizedToday.getTime();
    const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const descuento =
      nominal * (terms.tasaDescuentoMensual / 100) * (days / 30);
    const gastoVariable = nominal * (terms.gastoVariablePct / 100);

    nominalTotal += nominal;
    descuentoTotal += descuento;
    gastosTotal += terms.gastoFijoPorCheque + gastoVariable;
    weightedDays += nominal * days;
  });

  const plazoPromedioDias = nominalTotal > 0 ? weightedDays / nominalTotal : 0;
  const netoTotal = nominalTotal - descuentoTotal - gastosTotal;

  return {
    nominalTotal: roundCurrency(nominalTotal),
    descuentoTotal: roundCurrency(descuentoTotal),
    gastosTotal: roundCurrency(gastosTotal),
    netoTotal: roundCurrency(netoTotal),
    plazoPromedioDias: Math.round(plazoPromedioDias),
  };
}

export function getDefaultTerms() {
  return { ...DEFAULT_TERMS };
}

export function buildOperationNumber(index: number) {
  return `OP-CH-${String(index).padStart(4, "0")}`;
}

export function createEmptyChequeDraft(index: number): ChequeDraft {
  const date = new Date();
  date.setDate(date.getDate() + 30 + index * 7);

  return {
    id: `draft-${index}-${Date.now()}`,
    banco: "",
    numero: "",
    librador: "",
    fechaPago: date.toISOString().slice(0, 10),
    nominal: 0,
  };
}

export function getSeedOperations(): ChequeOperation[] {
  return [
    {
      id: "seed-op-ch-0001",
      numeroOperacion: "OP-CH-0001",
      cliente: "Agroinsumos del Sur SA",
      cuit: "30-71234567-8",
      tipoContraparte: "empresa",
      estado: "liquidada",
      createdAt: "2026-03-10T10:15:00.000Z",
      acreditacionEstimada: "2026-03-11",
      observaciones: "Operacion cerrada con cheques mixtos de cartera habitual.",
      cheques: [
        {
          id: "seed-cheque-1",
          banco: "Banco Nacion",
          numero: "00012458",
          librador: "Comercial del Litoral SRL",
          fechaPago: "2026-04-18",
          nominal: 2250000,
        },
        {
          id: "seed-cheque-2",
          banco: "Santander",
          numero: "00099142",
          librador: "Servicios Integrales Delta SA",
          fechaPago: "2026-05-02",
          nominal: 1750000,
        },
      ],
      terms: {
        tasaDescuentoMensual: 3.8,
        gastoFijoPorCheque: 3000,
        gastoVariablePct: 0.9,
      },
      preview: {
        nominalTotal: 4000000,
        descuentoTotal: 221666.67,
        gastosTotal: 42000,
        netoTotal: 3736333.33,
        plazoPromedioDias: 38,
      },
    },
    {
      id: "seed-op-ch-0002",
      numeroOperacion: "OP-CH-0002",
      cliente: "Mariana Ibarra",
      cuit: "27-28555444-1",
      tipoContraparte: "persona",
      estado: "cotizada",
      createdAt: "2026-03-15T14:40:00.000Z",
      acreditacionEstimada: "2026-03-19",
      observaciones: "Oferta enviada, pendiente de confirmacion del cliente.",
      cheques: [
        {
          id: "seed-cheque-3",
          banco: "BBVA",
          numero: "00155110",
          librador: "Metalurgica Pampeana SA",
          fechaPago: "2026-04-12",
          nominal: 980000,
        },
      ],
      terms: {
        tasaDescuentoMensual: 4.4,
        gastoFijoPorCheque: 2500,
        gastoVariablePct: 1.25,
      },
      preview: {
        nominalTotal: 980000,
        descuentoTotal: 40293.33,
        gastosTotal: 14750,
        netoTotal: 924956.67,
        plazoPromedioDias: 28,
      },
    },
  ];
}
