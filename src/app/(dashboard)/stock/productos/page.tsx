"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Boxes, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CAPABILITIES } from "@/lib/capabilities";
import { apiFetch } from "@/lib/apiFetch";
import type { FinStockCategoria, FinStockProducto } from "@/types/fin-stock";
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

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

const TABLE_THEME = {
  containerClassName: "border-slate-800 bg-slate-900",
  headClassName: "border-slate-800 bg-slate-950/70",
  headerCellClassName: "text-slate-300",
  rowClassName: "border-slate-800 hover:!bg-slate-800/60",
  cellClassName: "text-slate-200",
  emptyClassName: "border-slate-800 bg-slate-900",
  skeletonClassName: "bg-slate-800",
} as const;

function formatMoney(value: number) {
  return currency.format(value);
}

function stockTone(stockActual: number, stockMinimo: number) {
  return stockActual <= stockMinimo
    ? "border-red-500/20 bg-red-500/10 text-red-400"
    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
}

export default function StockProductosPage() {
  const router = useRouter();
  const { capabilities, loading: authLoading } = useAuth();

  const [categorias, setCategorias] = useState<FinStockCategoria[]>([]);
  const [productos, setProductos] = useState<FinStockProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState("all");
  const [soloConStock, setSoloConStock] = useState(false);

  useEffect(() => {
    if (!authLoading && !capabilities.includes(CAPABILITIES.STOCK_MERCADERIA)) {
      router.replace("/dashboard");
    }
  }, [authLoading, capabilities, router]);

  async function loadCategorias() {
    const response = await apiFetch("/api/fin/stock/categorias");
    const json = (await response.json().catch(() => ({}))) as {
      categorias?: FinStockCategoria[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(json.error ?? "No se pudieron cargar las categorias");
    }

    setCategorias(json.categorias ?? []);
  }

  async function loadProductos() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (categoriaId !== "all") {
        params.set("categoriaId", categoriaId);
      }
      if (soloConStock) {
        params.set("soloConStock", "true");
      }

      const response = await apiFetch(`/api/fin/stock/productos${params.size ? `?${params}` : ""}`);
      const json = (await response.json().catch(() => ({}))) as {
        productos?: FinStockProducto[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(json.error ?? "No se pudieron cargar los productos");
      }

      setProductos(json.productos ?? []);
    } catch (err) {
      setProductos([]);
      setError(err instanceof Error ? err.message : "No se pudieron cargar los productos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && capabilities.includes(CAPABILITIES.STOCK_MERCADERIA)) {
      void loadCategorias().catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "No se pudieron cargar las categorias");
      });
    }
  }, [authLoading, capabilities]);

  useEffect(() => {
    if (!authLoading && capabilities.includes(CAPABILITIES.STOCK_MERCADERIA)) {
      void loadProductos();
    }
  }, [authLoading, capabilities, categoriaId, soloConStock]);

  const summary = useMemo(
    () => ({
      total: productos.length,
      alertas: productos.filter((item) => item.stock_actual <= item.stock_minimo).length,
    }),
    [productos]
  );

  const columns: Column<FinStockProducto>[] = [
    {
      key: "codigo",
      header: "Codigo",
      width: "120px",
      render: (row) => <span className="font-mono text-slate-300">{row.codigo}</span>,
    },
    {
      key: "nombre",
      header: "Nombre",
      render: (row) => (
        <div>
          <p className="font-medium text-white">{row.nombre}</p>
          <p className="text-xs text-slate-400">{row.marca || row.modelo || "Sin marca/modelo"}</p>
        </div>
      ),
    },
    {
      key: "categoria_nombre",
      header: "Categoria",
    },
    {
      key: "stock_actual",
      header: "Stock actual",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Badge className={stockTone(row.stock_actual, row.stock_minimo)}>
            {row.stock_actual <= row.stock_minimo ? "Stock bajo" : "Stock OK"}
          </Badge>
          <span className="font-mono text-slate-200">{row.stock_actual}</span>
        </div>
      ),
    },
    {
      key: "precio_venta_contado",
      header: "Precio venta",
      render: (row) => formatMoney(row.precio_venta_contado),
      className: "text-right font-mono",
    },
    {
      key: "activo",
      header: "Estado",
      render: (row) => (
        <Badge
          className={
            row.activo
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/20 bg-red-500/10 text-red-400"
          }
        >
          {row.activo ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
  ];

  if (authLoading) {
    return <div className="h-60 animate-pulse rounded-2xl bg-slate-900" />;
  }

  return (
    <div className="space-y-6 bg-slate-950 text-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Productos</h1>
          <p className="text-sm text-slate-400">
            Seguimiento del catalogo activo, stock disponible y alertas operativas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            onClick={() => void loadProductos()}
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button asChild className="bg-amber-500 text-slate-950 hover:bg-amber-400">
            <Link href="/stock/productos/nuevo">
              <Plus className="h-4 w-4" />
              Nuevo producto
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            label: "Total productos",
            value: String(summary.total),
            detail: "Segun filtros actuales",
            icon: Boxes,
          },
          {
            label: "Alertas stock bajo",
            value: String(summary.alertas),
            detail: "Productos en umbral o por debajo",
            icon: AlertTriangle,
          },
        ].map(({ label, value, detail, icon: Icon }) => (
          <Card key={label} className="border-slate-800 bg-slate-900 text-white">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-400">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-300">{label}</p>
                <p className="text-2xl font-semibold text-white">{value}</p>
                <p className="text-xs text-slate-400">{detail}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 lg:flex-row lg:items-center">
        <div className="min-w-52 space-y-2">
          <p className="text-sm font-medium text-slate-300">Categoria</p>
          <Select value={categoriaId} onValueChange={setCategoriaId}>
            <SelectTrigger className="border-slate-700 bg-slate-950 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-950 text-white">
              <SelectItem value="all" className="text-slate-200 focus:bg-slate-800 focus:text-white">
                Todas
              </SelectItem>
              {categorias.map((categoria) => (
                <SelectItem
                  key={categoria.id}
                  value={categoria.id}
                  className="text-slate-200 focus:bg-slate-800 focus:text-white"
                >
                  {categoria.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-3 text-sm text-slate-300 lg:mt-6">
          <input
            type="checkbox"
            checked={soloConStock}
            onChange={(event) => setSoloConStock(event.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-500 accent-amber-500"
          />
          Mostrar solo productos con stock disponible
        </label>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={productos}
        loading={loading}
        emptyMessage="No hay productos para el filtro seleccionado."
        onRowClick={(row) => router.push(`/stock/productos/${row.id}`)}
        {...TABLE_THEME}
      />
    </div>
  );
}
