"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CircleDollarSign, FileBarChart, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { apiFetch } from "@/lib/apiFetch";

function ars(value: number) {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function number(value: number) {
  return value.toLocaleString("es-AR");
}

type LineaConsumidaItem = {
  id: string;
  cliente_nombre: string;
  cuit: string;
  limite_total: number | null;
  consumo_actual: number;
  disponible_actual: number | null;
  utilizacion_pct: number | null;
  estado_linea: string;
  evaluacion_fecha?: string;
  vigente_hasta?: string;
};

type ChequeEstadoItem = {
  id: string;
  estado: string;
  cantidad: number;
  importe_total: number;
};

type EvaluacionRechazadaItem = {
  id: string;
  cliente_nombre: string;
  cuit: string;
  fecha: string;
  tier_sugerido: string;
  score_final: number;
  motivo?: string;
};

type ChequeRechazadoItem = {
  id: string;
  cliente_nombre: string;
  cuit: string;
  numero: string;
  banco: string;
  fecha_pago: string;
  importe: number;
  estado: string;
};

type ReportesResponse = {
  lineas_consumidas: {
    resumen: {
      clientes_con_linea: number;
      limite_total: number;
      consumo_actual: number;
      disponible_total: number;
      utilizacion_global_pct: number | null;
    };
    items: LineaConsumidaItem[];
  };
  cartera_cheques: {
    resumen: {
      total_cheques: number;
      importe_total: number;
    };
    por_estado: ChequeEstadoItem[];
  };
  rechazados: {
    resumen: {
      evaluaciones_rechazadas: number;
      cheques_rechazados: number;
      monto_cheques_rechazados: number;
    };
    evaluaciones: EvaluacionRechazadaItem[];
    cheques: ChequeRechazadoItem[];
  };
};

type SummaryCard = {
  label: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
};

const lineasColumns: Column<LineaConsumidaItem>[] = [
  {
    key: "cliente_nombre",
    header: "Cliente",
    render: (row) => (
      <div>
        <p className="font-medium text-slate-900">{row.cliente_nombre}</p>
        <p className="text-xs text-slate-500">{row.cuit}</p>
      </div>
    ),
  },
  {
    key: "limite_total",
    header: "Limite",
    render: (row) => (row.limite_total === null ? "-" : ars(row.limite_total)),
    className: "text-right font-mono",
  },
  {
    key: "consumo_actual",
    header: "Consumido",
    render: (row) => ars(row.consumo_actual),
    className: "text-right font-mono",
  },
  {
    key: "disponible_actual",
    header: "Disponible",
    render: (row) => (row.disponible_actual === null ? "-" : ars(row.disponible_actual)),
    className: "text-right font-mono",
  },
  {
    key: "utilizacion_pct",
    header: "Uso",
    render: (row) => (row.utilizacion_pct === null ? "-" : `${row.utilizacion_pct}%`),
    className: "text-right",
  },
  {
    key: "estado_linea",
    header: "Estado",
    render: (row) => (
      <Badge variant={row.estado_linea === "vigente" ? "secondary" : "outline"}>
        {row.estado_linea}
      </Badge>
    ),
  },
];

const carteraColumns: Column<ChequeEstadoItem>[] = [
  { key: "estado", header: "Estado" },
  {
    key: "cantidad",
    header: "Cantidad",
    render: (row) => number(row.cantidad),
    className: "text-right font-medium",
  },
  {
    key: "importe_total",
    header: "Importe",
    render: (row) => ars(row.importe_total),
    className: "text-right font-mono",
  },
];

const evaluacionesColumns: Column<EvaluacionRechazadaItem>[] = [
  {
    key: "cliente_nombre",
    header: "Cliente",
    render: (row) => (
      <div>
        <p className="font-medium text-slate-900">{row.cliente_nombre}</p>
        <p className="text-xs text-slate-500">{row.cuit}</p>
      </div>
    ),
  },
  { key: "fecha", header: "Fecha" },
  { key: "tier_sugerido", header: "Tier" },
  {
    key: "score_final",
    header: "Score",
    render: (row) => row.score_final.toFixed(2),
    className: "text-right font-mono",
  },
  {
    key: "motivo",
    header: "Motivo",
    render: (row) => row.motivo || "-",
  },
];

const chequesRechazadosColumns: Column<ChequeRechazadoItem>[] = [
  {
    key: "cliente_nombre",
    header: "Cliente",
    render: (row) => (
      <div>
        <p className="font-medium text-slate-900">{row.cliente_nombre}</p>
        <p className="text-xs text-slate-500">{row.cuit}</p>
      </div>
    ),
  },
  { key: "numero", header: "Cheque" },
  { key: "banco", header: "Banco" },
  { key: "fecha_pago", header: "Fecha pago" },
  {
    key: "importe",
    header: "Importe",
    render: (row) => ars(row.importe),
    className: "text-right font-mono",
  },
];

export default function ReportesPage() {
  const [data, setData] = useState<ReportesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/fin/reportes")
      .then((response) => response.json())
      .then((payload) => setData(payload as ReportesResponse))
      .finally(() => setLoading(false));
  }, []);

  const cards: SummaryCard[] = data
    ? [
        {
          label: "Lineas consumidas",
          value: number(data.lineas_consumidas.resumen.clientes_con_linea),
          detail: `Uso global ${data.lineas_consumidas.resumen.utilizacion_global_pct ?? 0}%`,
          icon: Wallet,
        },
        {
          label: "Consumo actual",
          value: ars(data.lineas_consumidas.resumen.consumo_actual),
          detail: `Disponible ${ars(data.lineas_consumidas.resumen.disponible_total)}`,
          icon: CircleDollarSign,
        },
        {
          label: "Cheques en cartera",
          value: number(data.cartera_cheques.resumen.total_cheques),
          detail: `Nominal ${ars(data.cartera_cheques.resumen.importe_total)}`,
          icon: FileBarChart,
        },
        {
          label: "Rechazados",
          value: number(
            data.rechazados.resumen.cheques_rechazados +
              data.rechazados.resumen.evaluaciones_rechazadas
          ),
          detail: `Cheques ${ars(data.rechazados.resumen.monto_cheques_rechazados)}`,
          icon: AlertTriangle,
        },
      ]
    : [];

  const skeletonCards = Array.from({ length: 4 }, (_, index) => index);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_16px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
        <Badge className="w-fit">Reportes operativos</Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Lineas, cheques y rechazados
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Vista minima para seguimiento de consumo de linea, cartera de cheques por
            estado y alertas de rechazos.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? skeletonCards.map((item) => (
              <Card key={String(item)}>
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="h-14 w-full animate-pulse rounded-xl bg-slate-200" />
                </CardContent>
              </Card>
            ))
          : cards.map((item) => (
              <Card key={item.label}>
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{item.label}</p>
                    <p className="text-2xl font-semibold text-slate-900">{item.value}</p>
                    <p className="text-xs text-slate-500">{item.detail}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Reporte de lineas consumidas</CardTitle>
            <CardDescription>
              Clientes con limite vigente o consumo actual sobre su linea.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={lineasColumns}
              data={data?.lineas_consumidas.items ?? []}
              loading={loading}
              emptyMessage="No hay lineas con consumo o limite asignado."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cartera de cheques por estado</CardTitle>
            <CardDescription>Distribucion nominal y cantidad por estado operativo.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={carteraColumns}
              data={data?.cartera_cheques.por_estado ?? []}
              loading={loading}
              emptyMessage="No hay cheques en cartera."
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reporte de rechazados</CardTitle>
            <CardDescription>Evaluaciones de scoring rechazadas.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={evaluacionesColumns}
              data={data?.rechazados.evaluaciones ?? []}
              loading={loading}
              emptyMessage="No hay evaluaciones rechazadas."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cheques rechazados</CardTitle>
            <CardDescription>Detalle operativo para seguimiento comercial y legal.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={chequesRechazadosColumns}
              data={data?.rechazados.cheques ?? []}
              loading={loading}
              emptyMessage="No hay cheques rechazados."
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
