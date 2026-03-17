"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  sucursal_id: z.string().min(1, "La sucursal es obligatoria"),
  monto_inicial: z.number().min(0, "El monto no puede ser negativo"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
});

type FormValues = z.infer<typeof schema>;

export default function NuevaCajaPage() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fecha: today,
      monto_inicial: 0,
    },
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
      router.push("/cajas");
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Abrir caja</h2>
          <p className="text-sm text-slate-500">Registrá la apertura de caja del día</p>
        </div>
      </div>

      <div className="max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Datos de apertura</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sucursal_id">Sucursal</Label>
                <Input
                  id="sucursal_id"
                  placeholder="ID de sucursal"
                  {...register("sucursal_id")}
                />
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
                <Input
                  id="fecha"
                  type="date"
                  {...register("fecha")}
                />
                {errors.fecha && (
                  <p className="text-xs text-red-600">{errors.fecha.message}</p>
                )}
              </div>

              {serverError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {serverError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Abriendo…" : "Abrir caja"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
