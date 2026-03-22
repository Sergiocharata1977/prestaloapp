"use client";

import { useEffect, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  CalendarDays,
  Download,
  TrendingUp,
  AlertTriangle,
  CircleDollarSign,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/apiFetch";
import type {
  ProyeccionCobranzasResponse,
  ProyeccionAgruparPor,
} from "@/types/fin-proyeccion-cobranzas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ars(v: number) {
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Tipos de filtro
// ---------------------------------------------------------------------------

interface Filtros {
  months: string;
  agruparPor: ProyeccionAgruparPor;
  incluirVencidas: boolean;
  tipoClienteId: string;
  sucursalId: string;
}

const defaultFiltros: Filtros = {
  months: "12",
  agruparPor: "tipo_cliente",
  incluirVencidas: true,
  tipoClienteId: "",
  sucursalId: "",
};

// ---------------------------------------------------------------------------
// Opción de selects
// ---------------------------------------------------------------------------

const AGRUPAR_OPTIONS: { value: ProyeccionAgruparPor; label: string }[] = [
  { value: "tipo_cliente", label: "Tipo de cliente" },
  { value: "cliente", label: "Cliente" },
  { value: "clasificacion_interna", label: "Clasificación interna" },
  { value: "sucursal", label: "Sucursal" },
  { value: "plan", label: "Plan de financiación" },
  { value: "politica", label: "Política crediticia" },
  { value: "sin_agrupacion", label: "Sin agrupación (total)" },
];

// ---------------------------------------------------------------------------
// Exportar Excel
// ---------------------------------------------------------------------------

function exportarExcel(data: ProyeccionCobranzasResponse) {
  const headers = ["Concepto", ...data.columns.map((c) => c.label), "Total"];

  const body = data.rows.map((row) => [
    row.label,
    ...data.columns.map((col) => {
      const cell = row.values.find((v) => v.monthKey === col.key);
      return cell?.amount ?? 0;
    }),
    row.total,
  ]);

  const totalesRow = [
    "TOTAL",
    ...data.columns.map((col) => data.totalsByMonth[col.key] ?? 0),
    data.grandTotal,
  ];

  const aoa = [headers, ...body, totalesRow];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Ancho de columnas
  ws["!cols"] = [
    { wch: 28 },
    ...data.columns.map(() => ({ wch: 14 })),
    { wch: 14 },
  ];

  // Formato número para todas las celdas numéricas
  const numFmt = '#,##0.00';
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    for (let C = 1; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[addr] && typeof ws[addr].v === 'number') {
        ws[addr].z = numFmt;
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Proyección");
  XLSX.writeFile(wb, `proyeccion-cobranzas-${data.params.fromMonth}.xlsx`);
}

// ---------------------------------------------------------------------------
// Componente KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  icon: React.ElementType;
  variant?: "default" | "warning";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div
          className={
            variant === "warning"
              ? "rounded-2xl bg-red-100 p-3 text-red-600"
              : "rounded-2xl bg-amber-100 p-3 text-amber-700"
          }
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-xl font-semibold text-slate-900 leading-tight">{value}</p>
          {detail && <p className="text-xs text-slate-400 mt-0.5">{detail}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tabla Matriz
// ---------------------------------------------------------------------------

function TablaMatriz({ data }: { data: ProyeccionCobranzasResponse }) {
  if (data.rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="text-slate-500 text-sm">
          No hay cuotas pendientes en el período seleccionado.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          {/* ── ENCABEZADO ── */}
          <thead>
            <tr className="bg-slate-800 text-white">
              {/* Col conceptos — sticky */}
              <th
                className="sticky left-0 z-20 bg-slate-800 px-4 py-3 text-left font-semibold min-w-[200px] border-r border-slate-600"
                style={{ minWidth: 200 }}
              >
                Concepto
              </th>
              {/* Columnas de meses */}
              {data.columns.map((col) => (
                <th
                  key={col.key}
                  className={
                    "px-4 py-3 text-right font-semibold whitespace-nowrap min-w-[130px] border-r border-slate-600 " +
                    (col.isVencido ? "bg-red-800 text-red-100" : "")
                  }
                  style={{ minWidth: 130 }}
                >
                  {col.label}
                </th>
              ))}
              {/* Col total */}
              <th
                className="px-4 py-3 text-right font-semibold whitespace-nowrap min-w-[140px] bg-slate-900"
                style={{ minWidth: 140 }}
              >
                Total
              </th>
            </tr>
          </thead>

          {/* ── FILAS ── */}
          <tbody>
            {data.rows.map((row, rowIdx) => (
              <tr
                key={row.id}
                className={
                  rowIdx % 2 === 0
                    ? "bg-white hover:bg-amber-50 transition-colors"
                    : "bg-slate-50 hover:bg-amber-50 transition-colors"
                }
              >
                {/* Label concepto — sticky */}
                <td
                  className="sticky left-0 z-10 bg-inherit px-4 py-2.5 font-medium text-slate-800 border-r border-slate-200 whitespace-nowrap"
                  style={{ minWidth: 200 }}
                >
                  {row.label}
                  <span className="ml-2 text-xs text-slate-400 font-normal">
                    ({row.cuotasTotal} cuotas)
                  </span>
                </td>
                {/* Celdas de meses */}
                {data.columns.map((col) => {
                  const cell = row.values.find((v) => v.monthKey === col.key);
                  const amount = cell?.amount ?? 0;
                  return (
                    <td
                      key={col.key}
                      className={
                        "px-4 py-2.5 text-right font-mono border-r border-slate-100 " +
                        (col.isVencido
                          ? amount > 0
                            ? "text-red-700 bg-red-50"
                            : "text-slate-300 bg-red-50"
                          : amount > 0
                          ? "text-slate-800"
                          : "text-slate-300")
                      }
                      style={{ minWidth: 130 }}
                    >
                      {amount > 0 ? ars(amount) : "—"}
                    </td>
                  );
                })}
                {/* Total fila */}
                <td
                  className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 bg-slate-50 border-l border-slate-200"
                  style={{ minWidth: 140 }}
                >
                  {ars(row.total)}
                </td>
              </tr>
            ))}
          </tbody>

          {/* ── FILA TOTALES ── */}
          <tfoot>
            <tr className="bg-slate-800 text-white font-bold border-t-2 border-slate-400">
              <td
                className="sticky left-0 z-20 bg-slate-800 px-4 py-3 text-sm uppercase tracking-wide border-r border-slate-600"
                style={{ minWidth: 200 }}
              >
                TOTAL ESPERADO
              </td>
              {data.columns.map((col) => {
                const total = data.totalsByMonth[col.key] ?? 0;
                return (
                  <td
                    key={col.key}
                    className={
                      "px-4 py-3 text-right font-mono border-r border-slate-600 " +
                      (col.isVencido ? "bg-red-900 text-red-100" : "")
                    }
                    style={{ minWidth: 130 }}
                  >
                    {total > 0 ? ars(total) : "—"}
                  </td>
                );
              })}
              <td
                className="px-4 py-3 text-right font-mono bg-slate-900"
                style={{ minWidth: 140 }}
              >
                {ars(data.grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProyeccionCobranzasPage() {
  const [filtros, setFiltros] = useState<Filtros>(defaultFiltros);
  const [pendingFiltros, setPendingFiltros] = useState<Filtros>(defaultFiltros);
  const [data, setData] = useState<ProyeccionCobranzasResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(
    async (f: Filtros) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          fromMonth: currentMonth(),
          months: f.months,
          agruparPor: f.agruparPor,
          incluirVencidas: String(f.incluirVencidas),
          ...(f.tipoClienteId ? { tipoClienteId: f.tipoClienteId } : {}),
          ...(f.sucursalId ? { sucursalId: f.sucursalId } : {}),
        });
        const res = await apiFetch(`/api/fin/reportes/proyeccion-cobranzas?${params}`);
        if (res.ok) {
          setData((await res.json()) as ProyeccionCobranzasResponse);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Carga inicial
  useEffect(() => {
    void fetchData(defaultFiltros);
  }, [fetchData]);

  function handleAplicar() {
    setFiltros(pendingFiltros);
    void fetchData(pendingFiltros);
  }

  const kpis = data?.kpis;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_16px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
        <Badge className="w-fit">Reportes</Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <CalendarDays className="h-7 w-7 text-amber-600" />
            Proyección de cobranzas
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Flujo de fondos esperado mes a mes según cuotas pendientes. Las filas son
            conceptos agrupados; las columnas, los próximos meses. El total de cada
            columna representa el monto esperado a cobrar en ese mes.
          </p>
        </div>
      </section>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* Meses a proyectar */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Meses a proyectar</label>
          <Select
            value={pendingFiltros.months}
            onValueChange={(v) => setPendingFiltros((f) => ({ ...f, months: v }))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
              <SelectItem value="18">18 meses</SelectItem>
              <SelectItem value="24">24 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Agrupar por */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Agrupar por</label>
          <Select
            value={pendingFiltros.agruparPor}
            onValueChange={(v) =>
              setPendingFiltros((f) => ({ ...f, agruparPor: v as ProyeccionAgruparPor }))
            }
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGRUPAR_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Incluir vencidas */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Vencidas impagas</label>
          <Select
            value={pendingFiltros.incluirVencidas ? "si" : "no"}
            onValueChange={(v) =>
              setPendingFiltros((f) => ({ ...f, incluirVencidas: v === "si" }))
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="si">Incluir</SelectItem>
              <SelectItem value="no">Excluir</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Botón aplicar */}
        <button
          type="button"
          onClick={handleAplicar}
          disabled={loading}
          className="h-9 rounded-lg bg-amber-600 px-5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Calculando…" : "Aplicar"}
        </button>

        {/* Spacer + export */}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => data && exportarExcel(data)}
            disabled={!data || loading}
            className="flex items-center gap-2 h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="h-14 w-full animate-pulse rounded-xl bg-slate-200" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <KpiCard
              label="Total futuro proyectado"
              value={kpis ? ars(kpis.totalFuturo) : "—"}
              detail={kpis ? `${kpis.cuotasPendientes} cuotas pendientes` : undefined}
              icon={TrendingUp}
            />
            <KpiCard
              label="Próximo mes"
              value={kpis ? ars(kpis.proximoMes) : "—"}
              detail={
                kpis && data
                  ? `${data.columns.find((c) => !c.isVencido)?.label ?? ""}`
                  : undefined
              }
              icon={CircleDollarSign}
            />
            <KpiCard
              label="Próximos 3 meses"
              value={kpis ? ars(kpis.proximos3Meses) : "—"}
              detail={kpis ? `Prom. mensual ${kpis ? ars(kpis.promedioMensual) : "—"}` : undefined}
              icon={Clock}
            />
            <KpiCard
              label="Vencido impago"
              value={kpis ? ars(kpis.vencidoImpago) : "—"}
              detail={kpis ? `${kpis.cuotasVencidas} cuotas vencidas` : undefined}
              icon={AlertTriangle}
              variant="warning"
            />
          </>
        )}
      </section>

      {/* ── Info de agrupación activa ── */}
      {data && !loading && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{data.rows.length} grupos</span>
          <span>·</span>
          <span>
            {data.kpis.clientesAlcanzados} clientes · {data.kpis.cuotasPendientes + data.kpis.cuotasVencidas} cuotas
          </span>
          <span>·</span>
          <span>
            Agrupado por{" "}
            <span className="font-medium text-slate-700">
              {AGRUPAR_OPTIONS.find((o) => o.value === filtros.agruparPor)?.label}
            </span>
          </span>
          <span>·</span>
          <span className="text-slate-400">
            Generado {new Date(data.generatedAt).toLocaleTimeString("es-AR")}
          </span>
        </div>
      )}

      {/* ── Tabla matriz ── */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
      ) : data ? (
        <TablaMatriz data={data} />
      ) : null}
    </div>
  );
}
