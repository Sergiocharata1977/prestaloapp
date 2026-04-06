"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CAPABILITIES } from "@/lib/capabilities";
import { apiFetch } from "@/lib/apiFetch";
import {
  FIN_STOCK_UNIDAD_LABELS,
  type FinStockCategoria,
  type FinStockProductoInput,
  type FinStockUnidad,
} from "@/types/fin-stock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().min(0, "Debe ser mayor o igual a 0").optional()
);

const requiredNumber = z.preprocess(
  (value) => Number(value),
  z.number().min(0, "Debe ser mayor o igual a 0")
);

const schema = z.object({
  codigo: z.string().min(1, "El codigo es obligatorio"),
  nombre: z.string().min(1, "El nombre es obligatorio"),
  descripcion: z.string().optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  categoria_id: z.string().min(1, "La categoria es obligatoria"),
  unidad_medida: z.enum(["unidad", "par", "docena", "kg", "metro"]),
  precio_costo: optionalNumber,
  precio_venta_contado: requiredNumber,
  stock_minimo: requiredNumber,
  requiere_serie: z.boolean(),
});

type FormValues = z.input<typeof schema>;
type SubmitValues = z.output<typeof schema>;

const UNIDAD_OPTIONS = Object.entries(FIN_STOCK_UNIDAD_LABELS) as [FinStockUnidad, string][];

export default function NuevoProductoPage() {
  const router = useRouter();
  const { capabilities, loading: authLoading } = useAuth();

  const [categorias, setCategorias] = useState<FinStockCategoria[]>([]);
  const [loadingCategorias, setLoadingCategorias] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, SubmitValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      codigo: "",
      nombre: "",
      descripcion: "",
      marca: "",
      modelo: "",
      categoria_id: "",
      unidad_medida: "unidad",
      precio_costo: undefined,
      precio_venta_contado: 0,
      stock_minimo: 0,
      requiere_serie: false,
    },
  });

  const values = watch();

  useEffect(() => {
    if (!authLoading && !capabilities.includes(CAPABILITIES.STOCK_MERCADERIA)) {
      router.replace("/dashboard");
    }
  }, [authLoading, capabilities, router]);

  useEffect(() => {
    if (authLoading || !capabilities.includes(CAPABILITIES.STOCK_MERCADERIA)) {
      return;
    }

    setLoadingCategorias(true);
    apiFetch("/api/fin/stock/categorias")
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        const payload = json as { categorias?: FinStockCategoria[]; error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudieron cargar las categorias");
        }

        const activas = (payload.categorias ?? []).filter((item) => item.activa);
        setCategorias(activas);
        if (activas.length > 0) {
          setValue("categoria_id", activas[0].id);
        }
      })
      .catch((err: unknown) => {
        setServerError(err instanceof Error ? err.message : "No se pudieron cargar las categorias");
      })
      .finally(() => setLoadingCategorias(false));
  }, [authLoading, capabilities, setValue]);

  const onSubmit = handleSubmit(async (formValues) => {
    setServerError(null);

    const payload: FinStockProductoInput = {
      ...formValues,
      descripcion: formValues.descripcion?.trim() || undefined,
      marca: formValues.marca?.trim() || undefined,
      modelo: formValues.modelo?.trim() || undefined,
      activo: true,
    };

    try {
      const response = await apiFetch("/api/fin/stock/productos", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? "No se pudo crear el producto");
      }

      router.push("/stock/productos");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "No se pudo crear el producto");
    }
  });

  if (authLoading) {
    return <div className="h-60 animate-pulse rounded-2xl bg-slate-900" />;
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
        <div>
          <h1 className="text-2xl font-semibold text-white">Nuevo producto</h1>
          <p className="text-sm text-slate-400">
            Alta de SKU, categoria y condiciones comerciales del catalogo.
          </p>
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-900 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <PackagePlus className="h-5 w-5 text-amber-400" />
            Datos del producto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="codigo" className="text-slate-300">
                  Codigo
                </Label>
                <Input
                  id="codigo"
                  {...register("codigo")}
                  className="border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
                />
                {errors.codigo && <p className="text-xs text-red-400">{errors.codigo.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre" className="text-slate-300">
                  Nombre
                </Label>
                <Input
                  id="nombre"
                  {...register("nombre")}
                  className="border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
                />
                {errors.nombre && <p className="text-xs text-red-400">{errors.nombre.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion" className="text-slate-300">
                Descripcion
              </Label>
              <Textarea
                id="descripcion"
                {...register("descripcion")}
                className="border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="marca" className="text-slate-300">
                  Marca
                </Label>
                <Input
                  id="marca"
                  {...register("marca")}
                  className="border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modelo" className="text-slate-300">
                  Modelo
                </Label>
                <Input
                  id="modelo"
                  {...register("modelo")}
                  className="border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Categoria</Label>
                <Select
                  value={values.categoria_id || undefined}
                  onValueChange={(value) => setValue("categoria_id", value, { shouldValidate: true })}
                  disabled={loadingCategorias || categorias.length === 0}
                >
                  <SelectTrigger className="border-slate-700 bg-slate-950 text-white">
                    <SelectValue
                      placeholder={loadingCategorias ? "Cargando categorias..." : "Selecciona una categoria"}
                    />
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
                {errors.categoria_id && (
                  <p className="text-xs text-red-400">{errors.categoria_id.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Unidad de medida</Label>
                <Select
                  value={values.unidad_medida}
                  onValueChange={(value) =>
                    setValue("unidad_medida", value as FinStockUnidad, { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="border-slate-700 bg-slate-950 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-950 text-white">
                    {UNIDAD_OPTIONS.map(([value, label]) => (
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
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="precio_costo" className="text-slate-300">
                  Precio costo
                </Label>
                <Input
                  id="precio_costo"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register("precio_costo")}
                  className="border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
                />
                {errors.precio_costo && (
                  <p className="text-xs text-red-400">{errors.precio_costo.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="precio_venta_contado" className="text-slate-300">
                  Precio venta contado
                </Label>
                <Input
                  id="precio_venta_contado"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register("precio_venta_contado")}
                  className="border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
                />
                {errors.precio_venta_contado && (
                  <p className="text-xs text-red-400">{errors.precio_venta_contado.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock_minimo" className="text-slate-300">
                  Stock minimo
                </Label>
                <Input
                  id="stock_minimo"
                  type="number"
                  min="0"
                  step="1"
                  {...register("stock_minimo")}
                  className="border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
                />
                {errors.stock_minimo && (
                  <p className="text-xs text-red-400">{errors.stock_minimo.message}</p>
                )}
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
              <input
                type="checkbox"
                checked={values.requiere_serie}
                onChange={(event) =>
                  setValue("requiere_serie", event.target.checked, { shouldValidate: true })
                }
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-500 accent-amber-500"
              />
              <div>
                <p className="text-sm font-medium text-slate-200">Requiere serie</p>
                <p className="text-xs text-slate-400">
                  Obliga a registrar numero de serie por unidad en movimientos.
                </p>
              </div>
            </label>

            {serverError && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {serverError}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                className="bg-amber-500 text-slate-950 hover:bg-amber-400"
                disabled={isSubmitting || loadingCategorias}
              >
                {isSubmitting ? "Guardando..." : "Crear producto"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
                onClick={() => router.push("/stock/productos")}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
