"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart2,
  TrendingUp,
  Users,
  Layers,
  CircleDollarSign,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiFetch } from "@/lib/apiFetch";
import type { IndicadoresComercialesResponse } from "@/types/fin-indicadores-comerciales";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ars(v: number) {
  return v.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

/** Mes de inicio N meses hacia atrás (para ver histórico) */
function fromMonthBack(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-amber-500/30 bg-amber-500/5" : undefined}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-600">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-semibold tabular-nums">{value}</p>
            {sub && <p className="text-xs text-slate-400">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tooltip personalizado para el gráfico
// ---------------------------------------------------------------------------

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-slate-700">{label}</p>
      <p className="text-slate-500">
        Ticket:{" "}
        <span className="font-semibold text-slate-900">
          {ars(payload[0].value)}
        </span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IndicadoresComercialesPage() {
  const [months, setMonths] = useState("12");
  const [data, setData] = useState<IndicadoresComercialesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        fromMonth: fromMonthBack(parseInt(months)),
        months,
      });
      const res = await apiFetch(
        `/api/fin/reportes/indicadores-comerciales?${params}`
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error al cargar indicadores");
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpis = data?.kpis;
  const tendencia = data?.tendenciaMensual ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <BarChart2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Indicadores Comerciales</h1>
            <p className="text-sm text-slate-500">
              Análisis de ticket y mix de cartera
            </p>
          </div>
        </div>

        {/* Filtro período */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Período:</span>
          <Select value={months} onValueChange={setMonths}>
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
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          icon={CircleDollarSign}
          label="Ticket promedio"
          value={kpis ? ars(kpis.ticketPromedio) : "—"}
          highlight
        />
        <KpiCard
          icon={TrendingUp}
          label="Mediana (P50)"
          value={kpis ? ars(kpis.ticketP50) : "—"}
          sub={kpis ? `P25: ${ars(kpis.ticketP25)}` : undefined}
        />
        <KpiCard
          icon={Users}
          label="Créditos en período"
          value={kpis ? kpis.totalCreditosActivos.toLocaleString("es-AR") : "—"}
        />
        <KpiCard
          icon={Layers}
          label="Capital total"
          value={kpis ? ars(kpis.totalCapitalActivo) : "—"}
          sub={kpis ? `P75: ${ars(kpis.ticketP75)}` : undefined}
        />
      </div>

      {/* Tendencia mensual — línea */}
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">
          Tendencia de ticket promedio mensual
        </h2>

        {loading ? (
          <div className="flex h-64 items-center justify-center text-sm text-slate-400">
            Cargando...
          </div>
        ) : tendencia.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-slate-400">
            Sin datos en el período seleccionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={tendencia}
              margin={{ top: 4, right: 16, left: 16, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
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
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="ticketPromedio"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3, fill: "#f59e0b" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tablas de mix */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mix por tipo de cliente */}
        <div className="rounded-2xl border bg-white">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-700">
              Mix por tipo de cliente
            </h2>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">
                Cargando...
              </p>
            ) : !data?.mixTipoCliente?.length ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">
                Sin datos
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500">
                    <th className="px-5 py-3 text-left font-medium">Tipo</th>
                    <th className="px-4 py-3 text-right font-medium">Créditos</th>
                    <th className="px-4 py-3 text-right font-medium">Capital</th>
                    <th className="px-4 py-3 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mixTipoCliente.map((row) => (
                    <tr key={row.tipoClienteId} className="border-t">
                      <td className="px-5 py-3 font-medium">
                        {row.tipoClienteLabel}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.creditosCount.toLocaleString("es-AR")}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {ars(row.totalCapital)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.porcentaje.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Mix por plazo */}
        <div className="rounded-2xl border bg-white">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-700">
              Mix por plazo
            </h2>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">
                Cargando...
              </p>
            ) : !data?.mixPlazo?.length ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">
                Sin datos
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500">
                    <th className="px-5 py-3 text-left font-medium">Plazo</th>
                    <th className="px-4 py-3 text-right font-medium">Créditos</th>
                    <th className="px-4 py-3 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mixPlazo.map((row) => (
                    <tr key={row.plazo} className="border-t">
                      <td className="px-5 py-3 font-medium">{row.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.creditosCount.toLocaleString("es-AR")}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.porcentaje.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
