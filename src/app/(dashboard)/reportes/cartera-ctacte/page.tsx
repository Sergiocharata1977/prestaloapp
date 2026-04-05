"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/apiFetch";

type AgruparPor = "sin_agrupacion" | "estado" | "sucursal";

type ReporteItem = {
  id: string;
  grupo: string;
  cliente: string;
  fecha_apertura: string;
  comprobante: string;
  monto_original: number;
  saldo_actual: number;
  estado: string;
  dias_desde_ultimo_pago: number | null;
  sucursal: string;
};

type ReporteGroup = {
  key: string;
  label: string;
  saldo_total: number;
  monto_original_total: number;
  cantidad: number;
};

type ReporteResponse = {
  agruparPor: AgruparPor;
  resumen: {
    cantidad: number;
    saldo_total: number;
    monto_original_total: number;
  };
  groups: ReporteGroup[];
  items: ReporteItem[];
};

const AGRUPAR_OPTIONS: { value: AgruparPor; label: string }[] = [
  { value: "sin_agrupacion", label: "Sin agrupacion" },
  { value: "estado", label: "Por estado" },
  { value: "sucursal", label: "Por sucursal" },
];

const fmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function ars(value: number) {
  return fmt.format(value);
}

function exportarExcel(data: ReporteResponse) {
  const rows = data.items.map((item) => ({
    Grupo: item.grupo,
    Cliente: item.cliente,
    "Fecha apertura": item.fecha_apertura,
    Comprobante: item.comprobante,
    "Monto original": item.monto_original,
    "Saldo actual": item.saldo_actual,
    Estado: item.estado,
    Sucursal: item.sucursal,
    "Dias desde ultimo pago": item.dias_desde_ultimo_pago ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 20 },
    { wch: 28 },
    { wch: 14 },
    { wch: 16 },
    { wch: 15 },
    { wch: 15 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cartera activa");
  XLSX.writeFile(wb, `cartera-ctacte-${data.agruparPor}.xlsx`);
}

const columns: Column<ReporteItem>[] = [
  { key: "cliente", header: "Cliente" },
  { key: "fecha_apertura", header: "Fecha apertura" },
  { key: "comprobante", header: "Comprobante" },
  {
    key: "monto_original",
    header: "Monto original",
    render: (row) => ars(row.monto_original),
    className: "text-right font-mono",
  },
  {
    key: "saldo_actual",
    header: "Saldo actual",
    render: (row) => ars(row.saldo_actual),
    className: "text-right font-mono font-semibold",
  },
  { key: "estado", header: "Estado" },
  {
    key: "dias_desde_ultimo_pago",
    header: "Dias desde ultimo pago",
    render: (row) =>
      row.dias_desde_ultimo_pago === null ? "Sin pagos" : String(row.dias_desde_ultimo_pago),
    className: "text-right",
  },
];

export default function ReporteCarteraCtaCtePage() {
  const [agruparPor, setAgruparPor] = useState<AgruparPor>("sin_agrupacion");
  const [data, setData] = useState<ReporteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    apiFetch(`/api/fin/reportes/cartera-ctacte?agruparPor=${agruparPor}`)
      .then(async (response) => {
        const json = (await response.json()) as ReporteResponse & { error?: string };
        if (!response.ok) {
          throw new Error(json.error ?? "No se pudo cargar la cartera activa");
        }
        setData(json);
      })
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : "No se pudo cargar la cartera activa");
      })
      .finally(() => setLoading(false));
  }, [agruparPor]);

  const groups = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.groups.map((group) => ({
      ...group,
      items: data.items.filter((item) => item.grupo === group.key),
    }));
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <Badge className="w-fit border-amber-200 bg-white text-amber-700">
            Reporte financiero
          </Badge>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Cartera activa de cuenta corriente
            </h1>
            <p className="text-sm text-slate-500">
              Saldos vigentes de operaciones financiadas con agrupacion configurable.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={agruparPor} onValueChange={(value) => setAgruparPor(value as AgruparPor)}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Agrupar por" />
            </SelectTrigger>
            <SelectContent>
              {AGRUPAR_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => data && exportarExcel(data)}
            disabled={!data || data.items.length === 0}
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Operaciones activas</p>
              <p className="text-2xl font-semibold text-slate-900">
                {data ? data.resumen.cantidad : "-"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Saldo activo</p>
            <p className="text-2xl font-semibold text-slate-900">
              {data ? ars(data.resumen.saldo_total) : "-"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Monto original</p>
            <p className="text-2xl font-semibold text-slate-900">
              {data ? ars(data.resumen.monto_original_total) : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.key} className="space-y-3">
            {agruparPor !== "sin_agrupacion" && (
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{group.label}</h2>
                  <p className="text-sm text-slate-500">{group.cantidad} operacion(es)</p>
                </div>
                <p className="text-sm font-medium text-slate-700">
                  Saldo grupo: {ars(group.saldo_total)}
                </p>
              </div>
            )}

            <DataTable
              columns={columns}
              data={group.items}
              loading={loading}
              emptyMessage="No hay operaciones para mostrar."
            />
          </section>
        ))}

        {!loading && (!data || data.items.length === 0) && (
          <DataTable columns={columns} data={[]} emptyMessage="No hay operaciones activas." />
        )}
      </div>
    </div>
  );
}
