"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, PencilLine, Save } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CAPABILITIES } from "@/lib/capabilities";
import { apiFetch } from "@/lib/apiFetch";
import {
  FIN_MOVIMIENTO_TIPO_LABELS,
  FIN_STOCK_UNIDAD_LABELS,
  type FinMovimientoStock,
  type FinStockCategoria,
  type FinStockProducto,
  type FinStockUnidad,
} from "@/types/fin-stock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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

type ProductFormState = {
  codigo: string;
  nombre: string;
  descripcion: string;
  marca: string;
  modelo: string;
  categoria_id: string;
  unidad_medida: FinStockUnidad;
  precio_costo: string;
  precio_venta_contado: string;
  stock_minimo: string;
  requiere_serie: boolean;
  activo: boolean;
};

function formatMoney(value?: number) {
  return typeof value === "number" ? currency.format(value) : "No definido";
}

function stockTone(stockActual: number, stockMinimo: number) {
  return stockActual <= stockMinimo
    ? "border-red-500/20 bg-red-500/10 text-red-400"
    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
}

function toFormState(producto: FinStockProducto): ProductFormState {
  return {
    codigo: producto.codigo,
    nombre: producto.nombre,
    descripcion: producto.descripcion ?? "",
    marca: producto.marca ?? "",
    modelo: producto.modelo ?? "",
    categoria_id: producto.categoria_id,
    unidad_medida: producto.unidad_medida,
    precio_costo:
      typeof producto.precio_costo === "number" ? String(producto.precio_costo) : "",
    precio_venta_contado: String(producto.precio_venta_contado),
    stock_minimo: String(producto.stock_minimo),
    requiere_serie: producto.requiere_serie,
    activo: producto.activo,
  };
}

export default function ProductoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { capabilities, loading: authLoading } = useAuth();
  const id = params.id;

  const [producto, setProducto] = useState<FinStockProducto | null>(null);
  const [categorias, setCategorias] = useState<FinStockCategoria[]>([]);
  const [movimientos, setMovimientos] = useState<FinMovimientoStock[]>([]);
  const [form, setForm] = useState<ProductFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !capabilities.includes(CAPABILITIES.STOCK_MERCADERIA)) {
      router.replace("/dashboard");
    }
  }, [authLoading, capabilities, router]);

  async function loadData() {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const [productoResponse, movimientosResponse, categoriasResponse] = await Promise.all([
        apiFetch(`/api/fin/stock/productos/${id}`),
        apiFetch(`/api/fin/stock/movimientos?productoId=${id}`),
        apiFetch("/api/fin/stock/categorias"),
      ]);

      const productoJson = (await productoResponse.json().catch(() => ({}))) as {
        producto?: FinStockProducto;
        error?: string;
      };
      const movimientosJson = (await movimientosResponse.json().catch(() => ({}))) as {
        movimientos?: FinMovimientoStock[];
        error?: string;
      };
      const categoriasJson = (await categoriasResponse.json().catch(() => ({}))) as {
        categorias?: FinStockCategoria[];
        error?: string;
      };

      if (!productoResponse.ok) {
        throw new Error(productoJson.error ?? "No se pudo cargar el producto");
      }
      if (!movimientosResponse.ok) {
        throw new Error(movimientosJson.error ?? "No se pudieron cargar los movimientos");
      }
      if (!categoriasResponse.ok) {
        throw new Error(categoriasJson.error ?? "No se pudieron cargar las categorias");
      }

      setProducto(productoJson.producto ?? null);
      setForm(productoJson.producto ? toFormState(productoJson.producto) : null);
      setMovimientos((movimientosJson.movimientos ?? []).slice(0, 20));
      setCategorias((categoriasJson.categorias ?? []).filter((item) => item.activa));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el detalle");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && capabilities.includes(CAPABILITIES.STOCK_MERCADERIA)) {
      void loadData();
    }
  }, [authLoading, capabilities, id]);

  const movimientoColumns: Column<FinMovimientoStock>[] = [
    {
      key: "createdAt",
      header: "Fecha",
      width: "180px",
      render: (row) => (
        <div>
          <p className="text-slate-200">{new Date(row.createdAt).toLocaleDateString("es-AR")}</p>
          <p className="text-xs text-slate-400">
            {new Date(row.createdAt).toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      render: (row) => (
        <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-400">
          {FIN_MOVIMIENTO_TIPO_LABELS[row.tipo]}
        </Badge>
      ),
    },
    {
      key: "cantidad",
      header: "Cantidad",
      render: (row) => {
        const ingreso = row.stock_nuevo >= row.stock_anterior;
        return (
          <span className={ingreso ? "font-mono text-emerald-400" : "font-mono text-red-400"}>
            {ingreso ? "+" : "-"}
            {row.cantidad}
          </span>
        );
      },
    },
    {
      key: "stock_nuevo",
      header: "Stock resultante",
      render: (row) => <span className="font-mono text-slate-200">{row.stock_nuevo}</span>,
    },
    {
      key: "referencia_numero",
      header: "Referencia",
      render: (row) =>
        row.referencia_numero ? (
          <div>
            <p className="text-slate-200">{row.referencia_numero}</p>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {row.referencia_tipo ?? "manual"}
            </p>
          </div>
        ) : (
          <span className="text-slate-500">Sin referencia</span>
        ),
    },
  ];

  const summary = useMemo(() => {
    if (!producto) return null;

    return {
      stockActual: producto.stock_actual,
      stockMinimo: producto.stock_minimo,
      precioVenta: producto.precio_venta_contado,
    };
  }, [producto]);

  async function handleSave() {
    if (!producto || !form) return;

    setSaving(true);
    setError(null);

    try {
      const payload = {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        marca: form.marca.trim() || undefined,
        modelo: form.modelo.trim() || undefined,
        categoria_id: form.categoria_id,
        unidad_medida: form.unidad_medida,
        precio_costo: form.precio_costo.trim() ? Number(form.precio_costo) : undefined,
        precio_venta_contado: Number(form.precio_venta_contado),
        stock_minimo: Number(form.stock_minimo),
        requiere_serie: form.requiere_serie,
        activo: form.activo,
      };

      const response = await apiFetch(`/api/fin/stock/productos/${producto.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? "No se pudo actualizar el producto");
      }

      setEditing(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el producto");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return <div className="h-60 animate-pulse rounded-2xl bg-slate-900" />;
  }

  if (error && !producto) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <Button
          variant="outline"
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
          onClick={() => void loadData()}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  if (!producto || !form || !summary) {
    return <div className="py-16 text-center text-slate-400">Producto no encontrado.</div>;
  }

  return (
    <div className="space-y-6 bg-slate-950 text-white">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-300 hover:bg-slate-900 hover:text-white"
          onClick={() => router.push("/stock/productos")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold text-white">{producto.nombre}</h1>
          <p className="text-sm text-slate-400">
            SKU {producto.codigo} · Categoria {producto.categoria_nombre}
          </p>
        </div>
        <Button
          variant="outline"
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
          onClick={() => {
            if (editing) {
              setForm(toFormState(producto));
              setEditing(false);
              return;
            }
            setEditing(true);
          }}
        >
          <PencilLine className="h-4 w-4" />
          {editing ? "Cancelar" : "Editar"}
        </Button>
        {editing ? (
          <Button className="bg-amber-500 text-slate-950 hover:bg-amber-400" onClick={() => void handleSave()} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900 text-white">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-300">Stock actual</p>
            <div className="mt-3 flex items-center gap-3">
              <Badge className={stockTone(summary.stockActual, summary.stockMinimo)}>
                {summary.stockActual <= summary.stockMinimo ? "Stock bajo" : "Stock OK"}
              </Badge>
              <span className="text-3xl font-semibold text-white">{summary.stockActual}</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">Minimo configurado: {summary.stockMinimo}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900 text-white">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-300">Precio venta</p>
            <p className="mt-3 text-3xl font-semibold text-white">{formatMoney(summary.precioVenta)}</p>
            <p className="mt-2 text-xs text-slate-400">Costo: {formatMoney(producto.precio_costo)}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900 text-white">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-300">Estado</p>
            <div className="mt-3 flex items-center gap-3">
              <Badge
                className={
                  producto.activo
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/20 bg-red-500/10 text-red-400"
                }
              >
                {producto.activo ? "Activo" : "Inactivo"}
              </Badge>
              <span className="text-sm text-slate-400">
                Serie: {producto.requiere_serie ? "Requerida" : "No requerida"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      <Card className="border-slate-800 bg-slate-900 text-white">
        <CardHeader>
          <CardTitle className="text-white">Datos del producto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Codigo</Label>
              {editing ? (
                <Input
                  value={form.codigo}
                  onChange={(event) => setForm((current) => current ? { ...current, codigo: event.target.value } : current)}
                  className="border-slate-700 bg-slate-950 text-white"
                />
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200">
                  {producto.codigo}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Nombre</Label>
              {editing ? (
                <Input
                  value={form.nombre}
                  onChange={(event) => setForm((current) => current ? { ...current, nombre: event.target.value } : current)}
                  className="border-slate-700 bg-slate-950 text-white"
                />
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200">
                  {producto.nombre}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Descripcion</Label>
            {editing ? (
              <Textarea
                value={form.descripcion}
                onChange={(event) =>
                  setForm((current) => current ? { ...current, descripcion: event.target.value } : current)
                }
                className="border-slate-700 bg-slate-950 text-white"
              />
            ) : (
              <p className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200">
                {producto.descripcion || "Sin descripcion"}
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Marca</Label>
              {editing ? (
                <Input
                  value={form.marca}
                  onChange={(event) => setForm((current) => current ? { ...current, marca: event.target.value } : current)}
                  className="border-slate-700 bg-slate-950 text-white"
                />
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200">
                  {producto.marca || "Sin dato"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Modelo</Label>
              {editing ? (
                <Input
                  value={form.modelo}
                  onChange={(event) => setForm((current) => current ? { ...current, modelo: event.target.value } : current)}
                  className="border-slate-700 bg-slate-950 text-white"
                />
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200">
                  {producto.modelo || "Sin dato"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Precio costo</Label>
              {editing ? (
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio_costo}
                  onChange={(event) =>
                    setForm((current) => current ? { ...current, precio_costo: event.target.value } : current)
                  }
                  className="border-slate-700 bg-slate-950 text-white"
                />
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200">
                  {formatMoney(producto.precio_costo)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Precio venta</Label>
              {editing ? (
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio_venta_contado}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, precio_venta_contado: event.target.value } : current
                    )
                  }
                  className="border-slate-700 bg-slate-950 text-white"
                />
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200">
                  {formatMoney(producto.precio_venta_contado)}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Categoria</Label>
              {editing ? (
                <Select
                  value={form.categoria_id}
                  onValueChange={(value) =>
                    setForm((current) => current ? { ...current, categoria_id: value } : current)
                  }
                >
                  <SelectTrigger className="border-slate-700 bg-slate-950 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-950 text-white">
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
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200">
                  {producto.categoria_nombre}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Unidad</Label>
              {editing ? (
                <Select
                  value={form.unidad_medida}
                  onValueChange={(value) =>
                    setForm((current) =>
                      current ? { ...current, unidad_medida: value as FinStockUnidad } : current
                    )
                  }
                >
                  <SelectTrigger className="border-slate-700 bg-slate-950 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-950 text-white">
                    {Object.entries(FIN_STOCK_UNIDAD_LABELS).map(([value, label]) => (
                      <SelectItem
                        key={value}
                        value={value}
                        className="text-slate-200 focus:bg-slate-800 focus:text-white"
                      >
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200">
                  {FIN_STOCK_UNIDAD_LABELS[producto.unidad_medida]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Stock minimo</Label>
              {editing ? (
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock_minimo}
                  onChange={(event) =>
                    setForm((current) => current ? { ...current, stock_minimo: event.target.value } : current)
                  }
                  className="border-slate-700 bg-slate-950 text-white"
                />
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200">
                  {producto.stock_minimo}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Flags</Label>
              <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200">
                {editing ? (
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.requiere_serie}
                        onChange={(event) =>
                          setForm((current) =>
                            current ? { ...current, requiere_serie: event.target.checked } : current
                          )
                        }
                        className="h-4 w-4 accent-amber-500"
                      />
                      Requiere serie
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.activo}
                        onChange={(event) =>
                          setForm((current) =>
                            current ? { ...current, activo: event.target.checked } : current
                          )
                        }
                        className="h-4 w-4 accent-amber-500"
                      />
                      Producto activo
                    </label>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Badge className="border-slate-700 bg-slate-900 text-slate-200">
                      {producto.requiere_serie ? "Requiere serie" : "Sin serie"}
                    </Badge>
                    <Badge className={producto.activo ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-red-500/20 bg-red-500/10 text-red-400"}>
                      {producto.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900 text-white">
        <CardHeader>
          <CardTitle className="text-white">Ultimos 20 movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={movimientoColumns}
            data={movimientos}
            emptyMessage="No hay movimientos registrados para este producto."
            {...TABLE_THEME}
          />
        </CardContent>
      </Card>
    </div>
  );
}
