"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { EvaluacionTier } from "@/types/fin-evaluacion";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const tierOptions = ["A", "B", "C", "reprobado"] as const satisfies readonly EvaluacionTier[];

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().positive("Debe ser mayor a 0").optional()
);

const schema = z.object({
  codigo: z.string().min(1, "Requerido"),
  nombre: z.string().min(1, "Requerido"),
  descripcion: z.string().optional(),
  tipo_base: z.enum(["persona", "empresa"]),
  activo: z.boolean(),
  requiere_legajo: z.boolean(),
  requiere_evaluacion_vigente: z.boolean(),
  permite_cheques_propios: z.boolean(),
  permite_cheques_terceros: z.boolean(),
  limite_mensual: optionalNumber,
  limite_total: optionalNumber,
  tier_minimo_requerido: z.enum(tierOptions).optional(),
});

type FormValues = z.input<typeof schema>;
type SubmitValues = z.output<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const booleanOptions = [
  { value: "true", label: "Si" },
  { value: "false", label: "No" },
] as const;

export function NuevoTipoClienteDialog({ open, onOpenChange, onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, SubmitValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo_base: "persona",
      activo: true,
      requiere_legajo: false,
      requiere_evaluacion_vigente: false,
      permite_cheques_propios: false,
      permite_cheques_terceros: false,
    },
  });

  const values = watch();

  const close = () => {
    reset();
    setServerError(null);
    onOpenChange(false);
  };

  const onSubmit = handleSubmit(async (formValues) => {
    setServerError(null);
    try {
      const res = await apiFetch("/api/fin/tipos-cliente", {
        method: "POST",
        body: JSON.stringify(formValues),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Error al crear tipo de cliente");
      }

      close();
      onSuccess?.();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Error inesperado");
    }
  });

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo tipo de cliente</DialogTitle>
          <DialogDescription>Configuracion base para clasificar clientes y reglas de originacion.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="codigo">Codigo</Label>
              <Input id="codigo" {...register("codigo")} />
              {errors.codigo && <p className="text-xs text-red-600">{errors.codigo.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" {...register("nombre")} />
              {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripcion</Label>
            <Textarea id="descripcion" {...register("descripcion")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo base</Label>
              <Select value={values.tipo_base} onValueChange={(value) => setValue("tipo_base", value as FormValues["tipo_base"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="persona">Persona</SelectItem>
                  <SelectItem value="empresa">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tier minimo requerido</Label>
              <Select
                value={values.tier_minimo_requerido ?? "none"}
                onValueChange={(value) =>
                  setValue("tier_minimo_requerido", value === "none" ? undefined : (value as EvaluacionTier))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin requisito" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin requisito</SelectItem>
                  {tierOptions.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      Tier {tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="limite_mensual">Limite mensual</Label>
              <Input id="limite_mensual" type="number" step="0.01" {...register("limite_mensual")} />
              {errors.limite_mensual && <p className="text-xs text-red-600">{errors.limite_mensual.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="limite_total">Limite total</Label>
              <Input id="limite_total" type="number" step="0.01" {...register("limite_total")} />
              {errors.limite_total && <p className="text-xs text-red-600">{errors.limite_total.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["activo", "Activo"],
              ["requiere_legajo", "Requiere legajo"],
              ["requiere_evaluacion_vigente", "Requiere evaluacion vigente"],
              ["permite_cheques_propios", "Permite cheques propios"],
              ["permite_cheques_terceros", "Permite cheques terceros"],
            ].map(([field, label]) => (
              <div key={field} className="space-y-2">
                <Label>{label}</Label>
                <Select
                  value={String(values[field as keyof FormValues])}
                  onValueChange={(value) => setValue(field as keyof FormValues, value === "true" as never)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {booleanOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
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
              {isSubmitting ? "Guardando..." : "Guardar tipo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
