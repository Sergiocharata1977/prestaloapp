"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  PackagePlus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { apiFetch } from "@/lib/apiFetch";
import type { FinMovimientoStock, FinStockProducto, FinStockResumen } from "@/types/fin-stock";

type ResumenResponse = {
  resumen: FinStockResumen[];
  alertas: number;
  error?: string;
};

type ProductosResponse = {
  productos: FinStockProducto[];
  error?: string;
};

type MovimientosResponse = {
  movimientos: FinMovimientoStock[];
  error?: string;
};

type LowStockRow = FinStockResumen & {
  id: string;
};

function formatDate(value?: string): string {
  if (!value) {
    return "Sin movimientos";
  }

  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const lowStockColumns: Column<LowStockRow>[] = [
  { key: "producto_nombre", header: "Producto" },
  { key: "categoria_nombre", header: "Categoría" },
  {
    key: "stock_actual",
    header: "Stock actual",
    className: "text-right font-mono",
  },
  {
    key: "stock_minimo",
    header: "Stock mínimo",
    className: "text-right font-mono",
  },
];

export default function StockDashboardPage() {
  const [productos, setProductos] = useState<FinStockProducto[]>([]);
  const [resumen, setResumen] = useState<FinStockResumen[]>([]);
  const [movimientos, setMovimientos] = useState<FinMovimientoStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      try {
        const [productosRes, resumenRes, movimientosRes] = await Promise.all([
          apiFetch("/api/fin/stock/productos"),
          apiFetch("/api/fin/stock/resumen"),
          apiFetch(
            `/api/fin/stock/movimientos?desde=${encodeURIComponent(
              sevenDaysAgo.toISOString()
            )}`
          ),
        ]);

        const [productosJson, resumenJson, movimientosJson] = await Promise.all([
          productosRes.json() as Promise<ProductosResponse>,
          resumenRes.json() as Promise<ResumenResponse>,
          movimientosRes.json() as Promise<MovimientosResponse>,
        ]);

        if (!productosRes.ok) {
          throw new Error(productosJson.error ?? "No se pudieron obtener los productos");
        }

        if (!resumenRes.ok) {
          throw new Error(resumenJson.error ?? "No se pudo obtener el resumen de stock");
        }

        if (!movimientosRes.ok) {
          throw new Error(movimientosJson.error ?? "No se pudieron obtener los movimientos");
        }

        if (!active) {
          return;
        }

        setProductos(productosJson.productos ?? []);
        setResumen(resumenJson.resumen ?? []);
        setMovimientos(movimientosJson.movimientos ?? []);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el panel de stock");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const alertas = useMemo(
    () => resumen.filter((item) => item.alerta_stock_bajo),
    [resumen]
  );

  const alertasRows = useMemo<LowStockRow[]>(
    () => alertas.map((item) => ({ ...item, id: item.producto_id })),
    [alertas]
  );

  const cards = [
    {
      label: "Productos activos",
      value: productos.length,
      helper: "Catálogo vigente",
      icon: Box,
    },
    {
      label: "Alertas stock bajo",
      value: alertas.length,
      helper: "Reposición pendiente",
      icon: AlertTriangle,
    },
    {
      label: "Ingresos 7 días",
      value: movimientos.filter((item) => item.tipo.startsWith("ingreso_")).length,
      helper: "Compras, devoluciones y ajustes",
      icon: TrendingUp,
    },
    {
      label: "Egresos 7 días",
      value: movimientos.filter((item) => item.tipo.startsWith("egreso_")).length,
      helper: "Ventas, devoluciones y ajustes",
      icon: TrendingDown,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.45)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge className="w-fit border-amber-400/30 bg-amber-400/10 text-amber-300">
              Plugin de stock
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">Mercadería y movimientos</h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300">
                Seguimiento de ingresos, egresos y alertas de reposición sobre el inventario activo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-amber-400 text-slate-950 hover:bg-amber-300">
              <Link href="/stock/ingresos/nueva">
                <PackagePlus className="h-4 w-4" />
                Nuevo ingreso
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              <Link href="/stock/movimientos">Ver movimientos</Link>
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ helper, icon: Icon, label, value }) => (
          <Card key={label} className="border-slate-800 bg-slate-900 text-slate-50">
            <CardContent className="flex items-start justify-between p-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                <p className="text-3xl font-semibold text-white">{loading ? "..." : value}</p>
                <p className="text-sm text-slate-400">{helper}</p>
              </div>
              <div className="rounded-2xl bg-amber-400/10 p-3 text-amber-300">
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 rounded-[1.75rem] border border-slate-800 bg-slate-900 p-5 text-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Stock bajo</h2>
              <p className="text-sm text-slate-400">
                Productos en o por debajo del mínimo configurado.
              </p>
            </div>
            <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-300">
              {alertas.length} alerta(s)
            </Badge>
          </div>

          <DataTable
            columns={lowStockColumns}
            data={alertasRows}
            loading={loading}
            emptyMessage="No hay productos con alerta de stock bajo."
          />

          {alertas.length > 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-300">
              Último movimiento detectado: {formatDate(alertas[0]?.ultimo_movimiento)}
            </div>
          ) : null}
        </div>

        <aside className="rounded-[1.75rem] border border-slate-800 bg-slate-900 p-5 text-slate-100">
          <h2 className="text-lg font-semibold text-white">Acceso rápido</h2>
          <p className="mt-2 text-sm text-slate-400">
            Flujos principales del módulo para carga, consulta y control operativo.
          </p>

          <div className="mt-5 space-y-3">
            {[
              {
                href: "/stock/productos",
                title: "Productos",
                text: "Alta, edición y consulta del catálogo.",
              },
              {
                href: "/stock/ingresos/nueva",
                title: "Ingresar mercadería",
                text: "Registrar compras y ajustes positivos.",
              },
              {
                href: "/stock/movimientos",
                title: "Historial de movimientos",
                text: "Auditar ingresos y egresos del inventario.",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4 transition hover:border-amber-400/40 hover:bg-slate-950"
              >
                <div>
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.text}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-300" />
              </Link>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
