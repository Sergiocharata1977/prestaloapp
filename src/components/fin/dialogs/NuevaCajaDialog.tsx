"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const schema = z.object({
  sucursal_id: z.string().min(1, "La sucursal es obligatoria"),
  monto_inicial: z.number().min(0, "El monto no puede ser negativo"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NuevaCajaDialog({ open, onOpenChange, onSuccess }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fecha: today, monto_inicial: 0 },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const res = await apiFetch("/api/fin/cajas", {
        method: "POST",
        body: JSON.stringify(values),
      });
      if (res.status === 409) {
        setServerError("Ya existe una caja abierta para esta sucursal hoy.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Error al abrir caja");
      }
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Abrir caja</DialogTitle>
          <DialogDescription>Registrá la apertura de caja del día</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sucursal_id">Sucursal (ID)</Label>
            <Input id="sucursal_id" placeholder="ID de sucursal" {...register("sucursal_id")} />
            {errors.sucursal_id && (
              <p className="text-xs text-red-600">{errors.sucursal_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="monto_inicial">Monto inicial ($)</Label>
            <Input
              id="monto_inicial"
              type="number"
              min={0}
              step="0.01"
              {...register("monto_inicial", { valueAsNumber: true })}
            />
            {errors.monto_inicial && (
              <p className="text-xs text-red-600">{errors.monto_inicial.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" type="date" {...register("fecha")} />
            {errors.fecha && (
              <p className="text-xs text-red-600">{errors.fecha.message}</p>
            )}
          </div>

          {serverError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Abriendo…" : "Abrir caja"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
