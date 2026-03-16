"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  tipo: z.enum(["fisica", "juridica"]),
  nombre: z.string().min(1, "Requerido"),
  apellido: z.string().optional(),
  dni: z.string().optional(),
  cuit: z.string().min(11, "CUIT inválido").max(11, "CUIT inválido"),
  telefono: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  domicilio: z.string().optional(),
  localidad: z.string().optional(),
  provincia: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NuevoClientePage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: "fisica" },
  });

  const tipo = watch("tipo");

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await apiFetch("/api/fin/clientes", {
        method: "POST",
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Error al crear cliente");
      }
      const data = (await res.json()) as { id: string };
      router.push(`/clientes/${data.id}`);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Error inesperado");
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Nuevo cliente</h2>
          <p className="text-sm text-slate-500">Completá los datos del cliente</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Tipo de persona</Label>
              <Select
                value={tipo}
                onValueChange={(v) =>
                  setValue("tipo", v as "fisica" | "juridica")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fisica">Persona física</SelectItem>
                  <SelectItem value="juridica">Persona jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nombre">
                  {tipo === "fisica" ? "Nombre" : "Razón social"}
                </Label>
                <Input id="nombre" {...register("nombre")} />
                {errors.nombre && (
                  <p className="text-xs text-red-600">{errors.nombre.message}</p>
                )}
              </div>
              {tipo === "fisica" && (
                <div className="space-y-2">
                  <Label htmlFor="apellido">Apellido</Label>
                  <Input id="apellido" {...register("apellido")} />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {tipo === "fisica" && (
                <div className="space-y-2">
                  <Label htmlFor="dni">DNI</Label>
                  <Input id="dni" {...register("dni")} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="cuit">CUIT (sin guiones)</Label>
                <Input id="cuit" placeholder="20123456789" {...register("cuit")} />
                {errors.cuit && (
                  <p className="text-xs text-red-600">{errors.cuit.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" {...register("telefono")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="domicilio">Domicilio</Label>
              <Input id="domicilio" {...register("domicilio")} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="localidad">Localidad</Label>
                <Input id="localidad" {...register("localidad")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provincia">Provincia</Label>
                <Input id="provincia" {...register("provincia")} />
              </div>
            </div>

            {serverError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando…" : "Guardar cliente"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
