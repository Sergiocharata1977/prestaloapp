"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Boxes, PackagePlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/apiFetch";
import type { FinMovimientoStock, FinMovimientoStockTipo, FinStockProducto } from "@/types/fin-stock";

const INGRESO_TIPOS = [
  { value: "ingreso_compra", label: "Ingreso por compra" },
  { value: "ingreso_devolucion_cliente", label: "Devolución de cliente" },
  { value: "ingreso_ajuste", label: "Ajuste manual (+)" },
] as const satisfies Array<{ value: FinMovimientoStockTipo; label: string }>;

const schema = z.object({
  producto_id: z.string().min(1, "Seleccioná un producto"),
  tipo: z.enum([
    "ingreso_compra",
    "ingreso_devolucion_cliente",
    "ingreso_ajuste",
  ]),
  cantidad: z
    .number()
    .gt(0, "La cantidad debe ser mayor a cero"),
  costo_unitario: z
    .number()
    .min(0, "El costo no puede ser negativo")
    .optional(),
  notas: z.string().max(500, "Máximo 500 caracteres").optional(),
  numero_serie: z.string().max(120, "Máximo 120 caracteres").optional(),
});

type FormValues = z.infer<typeof schema>;

type ProductosResponse = {
  productos: FinStockProducto[];
  error?: string;
};

type MovimientoPostResponse = {
  movimiento?: FinMovimientoStock;
  error?: string;
};

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const emptyValues: FormValues = {
  producto_id: "",
  tipo: "ingreso_compra",
  cantidad: 1,
  costo_unitario: undefined,
  notas: "",
  numero_serie: "",
};

export default function NuevoIngresoStockPage() {
  const router = useRouter();
  const [productos, setProductos] = useState<FinStockProducto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    let active = true;

    async function loadProductos() {
      setLoadingProductos(true);
      try {
        const response = await apiFetch("/api/fin/stock/productos");
        const json = (await response.json()) as ProductosResponse;

        if (!response.ok) {
          throw new Error(json.error ?? "No se pudieron obtener los productos");
        }

        if (!active) {
          return;
        }

        setProductos(json.productos ?? []);
      } catch (err) {
        if (active) {
          setServerError(err instanceof Error ? err.message : "No se pudieron obtener los productos");
        }
      } finally {
        if (active) {
          setLoadingProductos(false);
        }
      }
    }

    void loadProductos();

    return () => {
      active = false;
    };
  }, []);

  const productoId = watch("producto_id");
  const tipo = watch("tipo");
  const productoSeleccionado = useMemo(
    () => productos.find((item) => item.id === productoId),
    [productoId, productos]
  );

  useEffect(() => {
    if (!productoSeleccionado?.requiere_serie) {
      setValue("numero_serie", "");
    }
  }, [productoSeleccionado?.requiere_serie, setValue]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    try {
      const response = await apiFetch("/api/fin/stock/movimientos", {
        method: "POST",
        body: JSON.stringify({
          producto_id: values.producto_id,
          tipo: values.tipo,
          cantidad: values.cantidad,
          costo_unitario: values.costo_unitario,
          notas: values.notas?.trim() || undefined,
          numero_serie: productoSeleccionado?.requiere_serie
            ? values.numero_serie?.trim() || undefined
            : undefined,
        }),
      });

      const json = (await response.json()) as MovimientoPostResponse;

      if (!response.ok || !json.movimiento) {
        throw new Error(json.error ?? "No se pudo registrar el ingreso");
      }

      const movimiento = json.movimiento;
      const nombreProducto = productoSeleccionado?.nombre ?? movimiento.producto_nombre;

      setProductos((current) =>
        current.map((item) =>
          item.id === movimiento.producto_id
            ? { ...item, stock_actual: movimiento.stock_nuevo }
            : item
        )
      );

      toast.success(
        `Ingresadas ${movimiento.cantidad} unidades de ${nombreProducto}. Stock actual: ${movimiento.stock_nuevo}`,
        {
          action: {
            label: "Registrar otro ingreso",
            onClick: () => reset(emptyValues),
          },
          cancel: {
            label: "Ver stock",
            onClick: () => router.push("/stock"),
          },
        }
      );

      reset(emptyValues);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "No se pudo registrar el ingreso");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/stock")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-slate-500">Volver al panel de stock</span>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.45)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
              <PackagePlus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Nuevo ingreso de mercadería</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Registrá compras a proveedor, devoluciones de clientes o ajustes positivos de stock.
              </p>
            </div>
          </div>

          <Button
            asChild
            variant="outline"
            className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
          >
            <Link href="/stock/movimientos">Ver movimientos</Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="border-slate-800 bg-slate-900 text-slate-100">
          <CardHeader>
            <CardTitle className="text-white">Registrar ingreso</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-300">Producto</Label>
                <Select
                  value={productoId || undefined}
                  onValueChange={(value) => setValue("producto_id", value, { shouldValidate: true })}
                >
                  <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100">
                    <SelectValue
                      placeholder={
                        loadingProductos ? "Cargando productos..." : "Seleccioná un producto"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {productos.map((producto) => (
                      <SelectItem key={producto.id} value={producto.id}>
                        {producto.codigo} - {producto.nombre} [{producto.stock_actual}]
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.producto_id ? (
                  <p className="text-xs text-red-400">{errors.producto_id.message}</p>
                ) : null}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-300">Tipo</Label>
                  <Select
                    value={tipo}
                    onValueChange={(value) =>
                      setValue("tipo", value as FormValues["tipo"], { shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INGRESO_TIPOS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.tipo ? <p className="text-xs text-red-400">{errors.tipo.message}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cantidad" className="text-slate-300">
                    Cantidad
                  </Label>
                  <Input
                    id="cantidad"
                    type="number"
                    min={1}
                    step="1"
                    className="border-slate-700 bg-slate-950 text-slate-100"
                    {...register("cantidad", { valueAsNumber: true })}
                  />
                  {errors.cantidad ? (
                    <p className="text-xs text-red-400">{errors.cantidad.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="costo_unitario" className="text-slate-300">
                    Costo unitario
                  </Label>
                  <Input
                    id="costo_unitario"
                    type="number"
                    min={0}
                    step="0.01"
                    className="border-slate-700 bg-slate-950 text-slate-100"
                    {...register("costo_unitario", {
                      setValueAs: (value) => parseOptionalNumber(String(value ?? "")),
                    })}
                  />
                  {errors.costo_unitario ? (
                    <p className="text-xs text-red-400">{errors.costo_unitario.message}</p>
                  ) : (
                    <p className="text-xs text-slate-500">Opcional. Precio pagado al proveedor.</p>
                  )}
                </div>

                {productoSeleccionado?.requiere_serie ? (
                  <div className="space-y-2">
                    <Label htmlFor="numero_serie" className="text-slate-300">
                      Número de serie
                    </Label>
                    <Input
                      id="numero_serie"
                      className="border-slate-700 bg-slate-950 text-slate-100"
                      {...register("numero_serie")}
                    />
                    {errors.numero_serie ? (
                      <p className="text-xs text-red-400">{errors.numero_serie.message}</p>
                    ) : (
                      <p className="text-xs text-slate-500">Obligatorio para productos serializados.</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
                    El campo de serie se habilita solo cuando el producto seleccionado lo requiere.
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notas" className="text-slate-300">
                  Notas
                </Label>
                <Textarea
                  id="notas"
                  className="min-h-28 border-slate-700 bg-slate-950 text-slate-100"
                  {...register("notas")}
                />
                {errors.notas ? <p className="text-xs text-red-400">{errors.notas.message}</p> : null}
              </div>

              {serverError ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                  {serverError}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting || loadingProductos}>
                  {isSubmitting ? "Registrando..." : "Registrar ingreso"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800"
                  onClick={() => reset(emptyValues)}
                >
                  Limpiar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card className="border-slate-800 bg-slate-900 text-slate-100">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-400/10 p-3 text-amber-300">
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Producto actual
                  </p>
                  <p className="text-lg font-semibold text-white">
                    {productoSeleccionado?.nombre ?? "Sin seleccionar"}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-400">
                <p>Código: {productoSeleccionado?.codigo ?? "—"}</p>
                <p>Stock actual: {productoSeleccionado?.stock_actual ?? "—"}</p>
                <p>Stock mínimo: {productoSeleccionado?.stock_minimo ?? "—"}</p>
                <p>
                  Serializado:{" "}
                  {productoSeleccionado
                    ? productoSeleccionado.requiere_serie
                      ? "Sí"
                      : "No"
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900 text-slate-100">
            <CardContent className="p-5 text-sm text-slate-400">
              <p className="font-medium text-white">Flujo recomendado</p>
              <p className="mt-2">
                Seleccioná el producto, confirmá la cantidad y registrá el costo unitario si querés conservar el dato de compra.
              </p>
              <p className="mt-3">
                Si el artículo requiere serie, el backend bloquea el alta hasta completar ese campo.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
