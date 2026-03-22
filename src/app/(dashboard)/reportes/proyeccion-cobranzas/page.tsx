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
  X,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
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
  ProyeccionDetalleResponse,
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

  ws["!cols"] = [
    { wch: 28 },
    ...data.columns.map(() => ({ wch: 14 })),
    { wch: 14 },
  ];

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
// KPI Card
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
// Tooltip del gráfico
// ---------------------------------------------------------------------------

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; payload: { isVencido?: boolean } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-slate-700">{label}</p>
      <p className="text-slate-500">
        Total:{" "}
        <span className="font-semibold text-slate-900">{ars(payload[0].value)}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gráfico de barras
// ---------------------------------------------------------------------------

function GraficoBarras({ data }: { data: ProyeccionCobranzasResponse }) {
  const chartData = data.columns.map((col) => ({
    label: col.label,
    total: data.totalsByMonth[col.key] ?? 0,
    isVencido: col.isVencido ?? false,
  }));

  const maxVal = Math.max(...chartData.map((d) => d.total), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">
        Cobranza proyectada por mes
      </h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, maxVal * 1.1]}
            tickFormatter={(v: number) =>
              v >= 1_000_000
                ? `${(v / 1_000_000).toFixed(1)}M`
                : v >= 1_000
                ? `${(v / 1_000).toFixed(0)}k`
                : String(v)
            }
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, idx) => (
              <Cell
                key={idx}
                fill={entry.isVencido ? "#fca5a5" : "#f59e0b"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer de detalle (drill-down)
// ---------------------------------------------------------------------------

interface DrilldownTarget {
  groupId: string;
  groupLabel: string;
  monthKey: string;
  monthLabel: string;
  agruparPor: ProyeccionAgruparPor;
  amount: number;
}

function DetalleDrawer({
  target,
  onClose,
}: {
  target: DrilldownTarget;
  onClose: () => void;
}) {
  const [detalle, setDetalle] = useState<ProyeccionDetalleResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setDetalle(null);
    const params = new URLSearchParams({
      groupId: target.groupId,
      monthKey: target.monthKey,
      groupLabel: target.groupLabel,
      agruparPor: target.agruparPor,
    });
    apiFetch(`/api/fin/reportes/proyeccion-cobranzas/detalle?${params}`)
      .then((r) => r.json())
      .then((d) => setDetalle(d as ProyeccionDetalleResponse))
      .finally(() => setLoading(false));
  }, [target]);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div>
            <p className="text-xs text-slate-500">Detalle de cobranza</p>
            <h3 className="text-base font-semibold text-slate-900">
              {target.groupLabel}
            </h3>
            <p className="text-sm text-slate-500">{target.monthLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold tabular-nums text-amber-700">
              {ars(target.amount)}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando...
            </div>
          ) : !detalle?.cuotas?.length ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">
              Sin cuotas en este período
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-xs text-slate-500">
                  <th className="px-5 py-3 text-left font-medium">Cliente</th>
                  <th className="px-3 py-3 text-center font-medium">Cuota</th>
                  <th className="px-3 py-3 text-center font-medium">Venc.</th>
                  <th className="px-3 py-3 text-right font-medium">Total</th>
                  <th className="px-3 py-3 text-right font-medium">Mora</th>
                </tr>
              </thead>
              <tbody>
                {detalle.cuotas.map((c) => (
                  <tr key={c.cuotaId} className="border-t hover:bg-slate-50">
                    <td className="px-5 py-2.5">
                      <p className="font-medium text-slate-800 leading-tight">
                        {c.clienteNombre}
                      </p>
                      <p className="text-xs text-slate-400">{c.cuit}</p>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-500">
                      #{c.numeroCuota}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-500 whitespace-nowrap">
                      {c.fechaVencimiento}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                      {ars(c.total)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {c.diasMora !== null ? (
                        <span
                          className={
                            c.diasMora > 30
                              ? "font-semibold text-red-600"
                              : "text-orange-500"
                          }
                        >
                          {c.diasMora}d
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2">
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-5 py-3 text-slate-700" colSpan={3}>
                    Total ({detalle.cuotas.length} cuotas)
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {ars(detalle.total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tabla Matriz
// ---------------------------------------------------------------------------

function TablaMatriz({
  data,
  agruparPor,
  onCellClick,
}: {
  data: ProyeccionCobranzasResponse;
  agruparPor: ProyeccionAgruparPor;
  onCellClick: (target: DrilldownTarget) => void;
}) {
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
              <th
                className="sticky left-0 z-20 bg-slate-800 px-4 py-3 text-left font-semibold min-w-[200px] border-r border-slate-600"
                style={{ minWidth: 200 }}
              >
                Concepto
              </th>
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
                <td
                  className="sticky left-0 z-10 bg-inherit px-4 py-2.5 font-medium text-slate-800 border-r border-slate-200 whitespace-nowrap"
                  style={{ minWidth: 200 }}
                >
                  {row.label}
                  <span className="ml-2 text-xs text-slate-400 font-normal">
                    ({row.cuotasTotal} cuotas)
                  </span>
                </td>
                {data.columns.map((col) => {
                  const cell = row.values.find((v) => v.monthKey === col.key);
                  const amount = cell?.amount ?? 0;
                  return (
                    <td
                      key={col.key}
                      onClick={() => {
                        if (amount > 0) {
                          onCellClick({
                            groupId: row.id,
                            groupLabel: row.label,
                            monthKey: col.key,
                            monthLabel: col.label,
                            agruparPor,
                            amount,
                          });
                        }
                      }}
                      className={
                        "px-4 py-2.5 text-right font-mono border-r border-slate-100 " +
                        (col.isVencido
                          ? amount > 0
                            ? "text-red-700 bg-red-50 cursor-pointer hover:bg-red-100"
                            : "text-slate-300 bg-red-50"
                          : amount > 0
                          ? "text-slate-800 cursor-pointer hover:bg-amber-50"
                          : "text-slate-300")
                      }
                      style={{ minWidth: 130 }}
                    >
                      {amount > 0 ? ars(amount) : "—"}
                    </td>
                  );
                })}
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
  const [drilldown, setDrilldown] = useState<DrilldownTarget | null>(null);

  const fetchData = useCallback(async (f: Filtros) => {
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
  }, []);

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
            Flujo de fondos esperado mes a mes según cuotas pendientes. Hacé clic en
            cualquier celda para ver el detalle de cuotas individuales.
          </p>
        </div>
      </section>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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

        <button
          type="button"
          onClick={handleAplicar}
          disabled={loading}
          className="h-9 rounded-lg bg-amber-600 px-5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Calculando…" : "Aplicar"}
        </button>

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
              detail={kpis ? `Prom. mensual ${ars(kpis.promedioMensual)}` : undefined}
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

      {/* ── Gráfico de barras ── */}
      {!loading && data && data.columns.length > 0 && (
        <GraficoBarras data={data} />
      )}
      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-[220px] animate-pulse rounded-lg bg-slate-100" />
        </div>
      )}

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
        <TablaMatriz
          data={data}
          agruparPor={filtros.agruparPor}
          onCellClick={setDrilldown}
        />
      ) : null}

      {/* ── Drawer drill-down ── */}
      {drilldown && (
        <DetalleDrawer target={drilldown} onClose={() => setDrilldown(null)} />
      )}
    </div>
  );
}
