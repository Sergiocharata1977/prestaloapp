"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { FinTipoCliente } from "@/types/fin-tipo-cliente";
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

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().positive("Debe ser mayor a 0").optional()
);

const schema = z.object({
  nombre: z.string().min(1, "Requerido"),
  codigo: z.string().min(1, "Requerido"),
  descripcion: z.string().optional(),
  tipo_cliente_id: z.string().min(1, "Selecciona un tipo de cliente"),
  tipo_operacion: z.enum(["consumo", "empresa", "cheque_propio", "cheque_terceros"]),
  activo: z.boolean(),
  requiere_legajo: z.boolean(),
  requiere_evaluacion_vigente: z.boolean(),
  permite_cheques_propios: z.boolean(),
  permite_cheques_terceros: z.boolean(),
  dias_vigencia_evaluacion: optionalNumber,
  monto_minimo: optionalNumber,
  monto_maximo: optionalNumber,
  limite_mensual: optionalNumber,
  limite_total: optionalNumber,
  tiers: z.array(z.object({})).default([]),
});

type FormValues = z.input<typeof schema>;
type SubmitValues = z.output<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const booleanFields = [
  ["activo", "Activa"],
  ["requiere_legajo", "Requiere legajo"],
  ["requiere_evaluacion_vigente", "Requiere evaluacion vigente"],
  ["permite_cheques_propios", "Permite cheques propios"],
  ["permite_cheques_terceros", "Permite cheques terceros"],
] as const;

export function NuevaPoliticaCrediticiaDialog({ open, onOpenChange, onSuccess }: Props) {
  const [tiposCliente, setTiposCliente] = useState<FinTipoCliente[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(false);
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
      tipo_operacion: "consumo",
      activo: true,
      requiere_legajo: false,
      requiere_evaluacion_vigente: false,
      permite_cheques_propios: false,
      permite_cheques_terceros: false,
      tiers: [],
    },
  });

  const values = watch();

  useEffect(() => {
    if (!open) return;
    setLoadingTipos(true);
    apiFetch("/api/fin/tipos-cliente")
      .then((res) => res.json())
      .then((data) => setTiposCliente((data as { tiposCliente?: FinTipoCliente[]; tipos?: FinTipoCliente[] }).tiposCliente ?? (data as { tipos?: FinTipoCliente[] }).tipos ?? []))
      .finally(() => setLoadingTipos(false));
  }, [open]);

  const close = () => {
    reset();
    setServerError(null);
    onOpenChange(false);
  };

  const onSubmit = handleSubmit(async (formValues) => {
    setServerError(null);
    try {
      const res = await apiFetch("/api/fin/politicas-crediticias", {
        method: "POST",
        body: JSON.stringify({ ...formValues, tiers: [] }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Error al crear politica");
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
          <DialogTitle>Nueva politica crediticia</DialogTitle>
          <DialogDescription>Configura reglas comerciales y operativas para otorgamiento.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" {...register("nombre")} />
              {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="codigo">Codigo</Label>
              <Input id="codigo" {...register("codigo")} />
              {errors.codigo && <p className="text-xs text-red-600">{errors.codigo.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripcion</Label>
            <Textarea id="descripcion" {...register("descripcion")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de cliente</Label>
              <Select value={values.tipo_cliente_id} onValueChange={(value) => setValue("tipo_cliente_id", value)}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingTipos ? "Cargando tipos..." : "Selecciona un tipo"} />
                </SelectTrigger>
                <SelectContent>
                  {tiposCliente.map((tipo) => (
                    <SelectItem key={tipo.id} value={tipo.id}>
                      {tipo.codigo} - {tipo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.tipo_cliente_id && <p className="text-xs text-red-600">{errors.tipo_cliente_id.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Tipo de operacion</Label>
              <Select value={values.tipo_operacion} onValueChange={(value) => setValue("tipo_operacion", value as FormValues["tipo_operacion"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consumo">Consumo</SelectItem>
                  <SelectItem value="empresa">Empresa</SelectItem>
                  <SelectItem value="cheque_propio">Cheque propio</SelectItem>
                  <SelectItem value="cheque_terceros">Cheque terceros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="monto_minimo">Monto minimo</Label>
              <Input id="monto_minimo" type="number" step="0.01" {...register("monto_minimo")} />
              {errors.monto_minimo && <p className="text-xs text-red-600">{errors.monto_minimo.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="monto_maximo">Monto maximo</Label>
              <Input id="monto_maximo" type="number" step="0.01" {...register("monto_maximo")} />
              {errors.monto_maximo && <p className="text-xs text-red-600">{errors.monto_maximo.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="limite_mensual">Limite mensual</Label>
              <Input id="limite_mensual" type="number" step="0.01" {...register("limite_mensual")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limite_total">Limite total</Label>
              <Input id="limite_total" type="number" step="0.01" {...register("limite_total")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dias_vigencia_evaluacion">Dias vigencia evaluacion</Label>
              <Input id="dias_vigencia_evaluacion" type="number" {...register("dias_vigencia_evaluacion")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {booleanFields.map(([field, label]) => (
              <div key={field} className="space-y-2">
                <Label>{label}</Label>
                <Select
                  value={String(values[field])}
                  onValueChange={(value) => setValue(field, value === "true")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Si</SelectItem>
                    <SelectItem value="false">No</SelectItem>
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
              {isSubmitting ? "Guardando..." : "Guardar politica"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
