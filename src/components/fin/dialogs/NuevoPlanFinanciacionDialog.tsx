"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import type { FinPoliticaCrediticia } from "@/types/fin-politica-crediticia";
import type { FinPlanFinanciacion } from "@/types/fin-plan-financiacion";
import { ordenarTramos } from "@/lib/fin/planUtils";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().min(0, "Debe ser mayor o igual a 0").optional()
);

const tramoSchema = z.object({
  cantidad_cuotas: z.number().int().positive("Debe ser mayor a 0"),
  tasa_mensual: z.number().positive("Debe ser mayor a 0"),
});

const schema = z.object({
  nombre: z.string().min(1, "Requerido"),
  politica_id: z.string().min(1, "Selecciona una politica"),
  tasa_punitoria_mensual: z.number().positive("Debe ser mayor a 0"),
  cargo_fijo: optionalNumber,
  cargo_variable_pct: optionalNumber,
  activo: z.boolean(),
  tramos_tasa: z.array(tramoSchema).min(1, "Debes cargar al menos un tramo"),
});

type FormValues = z.input<typeof schema>;
type SubmitValues = z.output<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialPlan?: FinPlanFinanciacion | null;
}

const defaultValues: FormValues = {
  nombre: "",
  politica_id: "",
  tasa_punitoria_mensual: 0,
  cargo_fijo: undefined,
  cargo_variable_pct: undefined,
  activo: true,
  tramos_tasa: [{ cantidad_cuotas: 1, tasa_mensual: 0 }],
};

export function NuevoPlanFinanciacionDialog({
  open,
  onOpenChange,
  onSuccess,
  initialPlan,
}: Props) {
  const [politicas, setPoliticas] = useState<FinPoliticaCrediticia[]>([]);
  const [loadingPoliticas, setLoadingPoliticas] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, SubmitValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "tramos_tasa",
  });

  const values = watch();
  const orderedPreview = useMemo(
    () => ordenarTramos((values.tramos_tasa ?? []).filter((tramo) => Number.isFinite(tramo.cantidad_cuotas) && Number.isFinite(tramo.tasa_mensual))),
    [values.tramos_tasa]
  );

  useEffect(() => {
    if (!open) return;
    setLoadingPoliticas(true);
    apiFetch("/api/fin/politicas-crediticias")
      .then((res) => res.json())
      .then((data) =>
        setPoliticas(
          (data as { politicasCrediticias?: FinPoliticaCrediticia[]; politicas?: FinPoliticaCrediticia[] }).politicasCrediticias ??
            (data as { politicas?: FinPoliticaCrediticia[] }).politicas ??
            []
        )
      )
      .finally(() => setLoadingPoliticas(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (initialPlan) {
      reset({
        nombre: initialPlan.nombre,
        politica_id: initialPlan.politica_id,
        tasa_punitoria_mensual: initialPlan.tasa_punitoria_mensual,
        cargo_fijo: initialPlan.cargo_fijo,
        cargo_variable_pct: initialPlan.cargo_variable_pct,
        activo: initialPlan.activo,
        tramos_tasa:
          initialPlan.tramos_tasa?.length > 0
            ? ordenarTramos(initialPlan.tramos_tasa)
            : [{ cantidad_cuotas: 1, tasa_mensual: 0 }],
      });
    } else {
      reset(defaultValues);
    }
  }, [initialPlan, open, reset]);

  const close = () => {
    reset(defaultValues);
    setServerError(null);
    onOpenChange(false);
  };

  const onSubmit = handleSubmit(async (formValues) => {
    setServerError(null);
    try {
      const payload = {
        ...formValues,
        tramos_tasa: ordenarTramos(formValues.tramos_tasa),
      };

      const endpoint = initialPlan?.id
        ? `/api/fin/planes-financiacion/${initialPlan.id}`
        : "/api/fin/planes-financiacion";

      const res = await apiFetch(endpoint, {
        method: initialPlan?.id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ??
            (initialPlan?.id ? "Error al actualizar plan" : "Error al crear plan")
        );
      }

      close();
      onSuccess?.();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Error inesperado");
    }
  });

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialPlan?.id ? "Editar plan de financiacion" : "Nuevo plan de financiacion"}
          </DialogTitle>
          <DialogDescription>
            Define politica asociada, tasa punitoria y tramos por cantidad de cuotas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" {...register("nombre")} />
              {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Politica crediticia</Label>
              <Select value={values.politica_id} onValueChange={(value) => setValue("politica_id", value)}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingPoliticas ? "Cargando politicas..." : "Selecciona una politica"} />
                </SelectTrigger>
                <SelectContent>
                  {politicas.map((politica) => (
                    <SelectItem key={politica.id} value={politica.id}>
                      {politica.codigo} - {politica.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.politica_id && <p className="text-xs text-red-600">{errors.politica_id.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tasa_punitoria_mensual">Tasa punitoria mensual (%)</Label>
              <Input id="tasa_punitoria_mensual" type="number" step="0.01" {...register("tasa_punitoria_mensual", { valueAsNumber: true })} />
              {errors.tasa_punitoria_mensual && <p className="text-xs text-red-600">{errors.tasa_punitoria_mensual.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cargo_fijo">Cargo fijo</Label>
              <Input id="cargo_fijo" type="number" step="0.01" {...register("cargo_fijo")} />
              {errors.cargo_fijo && <p className="text-xs text-red-600">{errors.cargo_fijo.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cargo_variable_pct">Cargo variable (%)</Label>
              <Input id="cargo_variable_pct" type="number" step="0.01" {...register("cargo_variable_pct")} />
              {errors.cargo_variable_pct && <p className="text-xs text-red-600">{errors.cargo_variable_pct.message}</p>}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Tramos de tasa por cuotas</h3>
                <p className="text-xs text-slate-500">Los tramos se ordenan automaticamente al guardar.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ cantidad_cuotas: 1, tasa_mensual: 0 })}
              >
                <Plus className="h-4 w-4" />
                Agregar tramo
              </Button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Cuotas</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Tasa mensual (%)</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {fields
                    .map((field, index) => ({ field, index, cuota: values.tramos_tasa?.[index]?.cantidad_cuotas ?? field.cantidad_cuotas }))
                    .sort((a, b) => a.cuota - b.cuota)
                    .map(({ field, index }) => (
                      <tr key={field.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3">
                          <Input type="number" {...register(`tramos_tasa.${index}.cantidad_cuotas`, { valueAsNumber: true })} />
                          {errors.tramos_tasa?.[index]?.cantidad_cuotas && (
                            <p className="mt-1 text-xs text-red-600">{errors.tramos_tasa[index]?.cantidad_cuotas?.message}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Input type="number" step="0.01" {...register(`tramos_tasa.${index}.tasa_mensual`, { valueAsNumber: true })} />
                          {errors.tramos_tasa?.[index]?.tasa_mensual && (
                            <p className="mt-1 text-xs text-red-600">{errors.tramos_tasa[index]?.tasa_mensual?.message}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {errors.tramos_tasa?.message && <p className="text-xs text-red-600">{errors.tramos_tasa.message}</p>}

            {orderedPreview.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                Orden de envio:{" "}
                {orderedPreview.map((tramo) => `${tramo.cantidad_cuotas} cuotas -> ${tramo.tasa_mensual}%`).join(" | ")}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Activo</Label>
            <Select value={String(values.activo)} onValueChange={(value) => setValue("activo", value === "true")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Si</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {serverError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : initialPlan?.id ? "Actualizar plan" : "Guardar plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
