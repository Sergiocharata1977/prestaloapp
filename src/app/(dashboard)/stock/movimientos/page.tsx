"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Filter, PackageSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/apiFetch";
import {
  FIN_MOVIMIENTO_TIPO_LABELS,
  type FinMovimientoStock,
  type FinMovimientoStockTipo,
  type FinStockProducto,
} from "@/types/fin-stock";

type ProductosResponse = {
  productos: FinStockProducto[];
  error?: string;
};

type MovimientosResponse = {
  movimientos: FinMovimientoStock[];
  error?: string;
};

function toStartOfDay(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function toEndOfDay(date: string): string {
  return `${date}T23:59:59.999Z`;
}

function isIngreso(tipo: FinMovimientoStockTipo): boolean {
  return tipo.startsWith("ingreso_");
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function buildReference(item: FinMovimientoStock): string {
  if (item.referencia_numero) {
    return item.referencia_numero;
  }

  if (item.referencia_tipo && item.referencia_id) {
    return `${item.referencia_tipo} ${item.referencia_id}`;
  }

  return "Sin referencia";
}

const MOVIMIENTO_TIPOS = Object.entries(FIN_MOVIMIENTO_TIPO_LABELS) as Array<
  [FinMovimientoStockTipo, string]
>;

const columns: Column<FinMovimientoStock>[] = [
  {
    key: "createdAt",
    header: "Fecha",
    render: (row) => formatDateTime(row.createdAt),
    width: "170px",
  },
  { key: "producto_nombre", header: "Producto", width: "220px" },
  {
    key: "tipo",
    header: "Tipo",
    render: (row) => (
      <Badge
        className={
          isIngreso(row.tipo)
            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
            : "border-red-400/30 bg-red-400/10 text-red-300"
        }
      >
        {FIN_MOVIMIENTO_TIPO_LABELS[row.tipo]}
      </Badge>
    ),
    width: "190px",
  },
  {
    key: "cantidad",
    header: "Cantidad",
    className: "text-right font-mono font-semibold",
    render: (row) => (
      <span className={isIngreso(row.tipo) ? "text-emerald-300" : "text-red-300"}>
        {isIngreso(row.tipo) ? "+" : "-"}
        {row.cantidad}
      </span>
    ),
    width: "110px",
  },
  {
    key: "stock_nuevo",
    header: "Stock resultante",
    className: "text-right font-mono",
    width: "120px",
  },
  {
    key: "referencia",
    header: "Referencia",
    render: (row) => buildReference(row),
    width: "180px",
  },
  {
    key: "notas",
    header: "Notas",
    render: (row) => row.notas?.trim() || "—",
  },
];

export default function StockMovimientosPage() {
  const [productos, setProductos] = useState<FinStockProducto[]>([]);
  const [movimientos, setMovimientos] = useState<FinMovimientoStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [productoId, setProductoId] = useState("all");
  const [tiposSeleccionados, setTiposSeleccionados] = useState<FinMovimientoStockTipo[]>([]);

  useEffect(() => {
    let active = true;

    async function loadProductos() {
      try {
        const response = await apiFetch("/api/fin/stock/productos");
        const json = (await response.json()) as ProductosResponse;

        if (!response.ok) {
          throw new Error(json.error ?? "No se pudieron obtener los productos");
        }

        if (active) {
          setProductos(json.productos ?? []);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "No se pudieron obtener los productos");
        }
      }
    }

    void loadProductos();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadMovimientos() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();

        if (productoId !== "all") {
          params.set("productoId", productoId);
        }

        if (tiposSeleccionados.length === 1) {
          params.set("tipo", tiposSeleccionados[0]);
        }

        if (desde) {
          params.set("desde", toStartOfDay(desde));
        }

        if (hasta) {
          params.set("hasta", toEndOfDay(hasta));
        }

        const response = await apiFetch(`/api/fin/stock/movimientos?${params.toString()}`);
        const json = (await response.json()) as MovimientosResponse;

        if (!response.ok) {
          throw new Error(json.error ?? "No se pudieron obtener los movimientos");
        }

        if (!active) {
          return;
        }

        setMovimientos(json.movimientos ?? []);
      } catch (err) {
        if (active) {
          setMovimientos([]);
          setError(err instanceof Error ? err.message : "No se pudieron obtener los movimientos");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadMovimientos();

    return () => {
      active = false;
    };
  }, [desde, hasta, productoId, tiposSeleccionados]);

  const movimientosFiltrados = useMemo(() => {
    if (tiposSeleccionados.length <= 1) {
      return movimientos;
    }

    return movimientos.filter((item) => tiposSeleccionados.includes(item.tipo));
  }, [movimientos, tiposSeleccionados]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.45)] sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge className="w-fit border-amber-400/30 bg-amber-400/10 text-amber-300">
              Auditoría de stock
            </Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Movimientos</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Historial completo de ingresos y egresos con filtros por fecha, tipo y producto.
              </p>
            </div>
          </div>
          <Card className="border-slate-800 bg-slate-900 text-slate-100">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-2xl bg-amber-400/10 p-3 text-amber-300">
                <PackageSearch className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Registros en vista
                </p>
                <p className="text-2xl font-semibold text-white">{loading ? "..." : movimientosFiltrados.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-800 bg-slate-900 p-5 text-slate-100">
        <div className="mb-5 flex items-center gap-2">
          <Filter className="h-4 w-4 text-amber-300" />
          <h2 className="text-base font-semibold text-white">Filtros</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="desde" className="text-slate-300">
              Fecha desde
            </Label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <Input
                id="desde"
                type="date"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
                className="border-slate-700 bg-slate-950 pl-10 text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hasta" className="text-slate-300">
              Fecha hasta
            </Label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <Input
                id="hasta"
                type="date"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
                className="border-slate-700 bg-slate-950 pl-10 text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Producto</Label>
            <Select value={productoId} onValueChange={setProductoId}>
              <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100">
                <SelectValue placeholder="Todos los productos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los productos</SelectItem>
                {productos.map((producto) => (
                  <SelectItem key={producto.id} value={producto.id}>
                    {producto.codigo} - {producto.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipos" className="text-slate-300">
              Tipo
            </Label>
            <select
              id="tipos"
              multiple
              value={tiposSeleccionados}
              onChange={(event) => {
                const next = Array.from(event.currentTarget.selectedOptions).map(
                  (option) => option.value as FinMovimientoStockTipo
                );
                setTiposSeleccionados(next);
              }}
              className="min-h-32 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10"
            >
              {MOVIMIENTO_TIPOS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">Podés seleccionar uno o varios tipos.</p>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </section>

      <div className="[&_table]:bg-slate-900 [&_tbody_td]:text-slate-200 [&_thead]:bg-slate-950 [&_thead_th]:text-slate-400">
        <DataTable
          columns={columns}
          data={movimientosFiltrados}
          loading={loading}
          emptyMessage="No hay movimientos para los filtros seleccionados."
        />
      </div>
    </div>
  );
}
