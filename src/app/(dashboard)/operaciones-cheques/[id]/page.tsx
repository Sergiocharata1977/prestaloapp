"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CircleDollarSign,
  FileStack,
  Landmark,
  Printer,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { getChequeOperationById } from "@/components/fin/cheques/cheque-storage";
import {
  ars,
  formatDate,
  formatStatus,
  getStatusTone,
} from "@/components/fin/cheques/cheque-utils";
import type { ChequeOperation } from "@/components/fin/cheques/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";

const chequeColumns: Column<ChequeOperation["cheques"][number]>[] = [
  { key: "numero", header: "Cheque", width: "120px" },
  { key: "banco", header: "Banco" },
  { key: "librador", header: "Librador" },
  {
    key: "fechaPago",
    header: "Fecha pago",
    render: (row) => formatDate(row.fechaPago),
  },
  {
    key: "nominal",
    header: "Nominal",
    render: (row) => ars(row.nominal),
    className: "text-right font-mono font-semibold",
  },
];

export default function OperacionChequeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [operation, setOperation] = useState<ChequeOperation | null>(null);

  useEffect(() => {
    if (!params.id) {
      return;
    }

    setOperation(getChequeOperationById(params.id));
  }, [params.id]);

  if (!operation) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/operaciones-cheques")}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-10 text-center text-slate-500">
          Operacion no encontrada.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/operaciones-cheques")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {operation.numeroOperacion}
              </Badge>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusTone(operation.estado)}`}
              >
                {formatStatus(operation.estado)}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                {operation.cliente}
              </h1>
              <p className="text-sm text-slate-500">
                {operation.cuit} | {operation.tipoContraparte === "empresa" ? "Empresa" : "Persona"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link
              href={`/print/cheque/${operation.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Printer className="h-4 w-4" />
              Imprimir liquidacion
            </Link>
          </Button>
          <Button onClick={() => router.push("/operaciones-cheques/nueva")}>
            Nueva operacion
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Nominal total",
            value: ars(operation.preview.nominalTotal),
            icon: Landmark,
          },
          {
            label: "Descuento",
            value: ars(operation.preview.descuentoTotal),
            icon: CircleDollarSign,
          },
          {
            label: "Gastos",
            value: ars(operation.preview.gastosTotal),
            icon: FileStack,
          },
          {
            label: "Neto",
            value: ars(operation.preview.netoTotal),
            icon: CalendarClock,
          },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-xl font-semibold text-slate-900">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Cheques incluidos</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={chequeColumns}
              data={operation.cheques}
              emptyMessage="No hay cheques asociados."
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalle de oferta</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                {[
                  ["Nominal", ars(operation.preview.nominalTotal)],
                  ["Descuento", ars(operation.preview.descuentoTotal)],
                  ["Gastos", ars(operation.preview.gastosTotal)],
                  ["Neto estimado", ars(operation.preview.netoTotal)],
                  ["Plazo promedio", `${operation.preview.plazoPromedioDias} dias`],
                  ["Acreditacion estimada", formatDate(operation.acreditacionEstimada)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Condiciones aplicadas</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                {[
                  ["Tasa descuento mensual", `${operation.terms.tasaDescuentoMensual}%`],
                  ["Gasto variable", `${operation.terms.gastoVariablePct}%`],
                  ["Gasto fijo por cheque", ars(operation.terms.gastoFijoPorCheque)],
                  ["Fecha de alta", new Date(operation.createdAt).toLocaleString("es-AR")],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Observaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-600">
                {operation.observaciones || "Sin observaciones registradas."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
