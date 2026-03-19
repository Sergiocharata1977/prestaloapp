"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { FinCliente } from "@/types/fin-cliente";
import type { FinPlanFinanciacion } from "@/types/fin-plan-financiacion";
import type { FinSucursal } from "@/types/fin-sucursal";
import type { TablaAmortizacion } from "@/services/AmortizationService";
import { PlanFinanciacionService } from "@/services/PlanFinanciacionService";
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
import { AmortizationPreviewTable } from "@/components/fin/AmortizationPreviewTable";

const schema = z.object({
  sucursal_id: z.string().min(1, "Selecciona una sucursal"),
  cliente_id: z.string().min(1, "Selecciona un cliente"),
  plan_financiacion_id: z.string().optional(),
  articulo_descripcion: z.string().min(1, "Requerido"),
  capital: z.number().positive("Debe ser mayor a 0"),
  tasa_mensual: z.number().positive("Debe ser mayor a 0"),
  cantidad_cuotas: z.number().int().positive("Debe ser mayor a 0"),
  sistema: z.enum(["frances", "aleman"]),
  fecha_otorgamiento: z.string().min(1, "Requerido"),
  fecha_primer_vencimiento: z.string().min(1, "Requerido"),
});

type FormValues = z.infer<typeof schema>;

export default function NuevoCreditoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClienteId = searchParams.get("clienteId");

  const [step, setStep] = useState<1 | 2>(1);
  const [sucursales, setSucursales] = useState<FinSucursal[]>([]);
  const [planes, setPlanes] = useState<FinPlanFinanciacion[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteResultados, setClienteResultados] = useState<FinCliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<FinCliente | null>(null);
  const [tabla, setTabla] = useState<TablaAmortizacion | null>(null);
  const [tasaAplicada, setTasaAplicada] = useState<number | null>(null);
  const [tablaLoading, setTablaLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sistema: "frances",
      cliente_id: preselectedClienteId ?? "",
      plan_financiacion_id: "",
      tasa_mensual: 5,
    },
  });

  useEffect(() => {
    Promise.all([
      apiFetch("/api/fin/sucursales").then((response) => response.json()),
      apiFetch("/api/fin/planes-financiacion?activo=true")
        .then((response) => response.json())
        .catch(() => ({ planesFinanciacion: [] })),
    ]).then(([sucursalesData, planesData]) => {
      setSucursales((sucursalesData as { sucursales?: FinSucursal[] }).sucursales ?? []);
      setPlanes(
        (planesData as { planesFinanciacion?: FinPlanFinanciacion[]; planes?: FinPlanFinanciacion[] }).planesFinanciacion ??
          (planesData as { planes?: FinPlanFinanciacion[] }).planes ??
          []
      );
    });
  }, []);

  useEffect(() => {
    if (!preselectedClienteId) return;
    apiFetch(`/api/fin/clientes/${preselectedClienteId}`)
      .then((response) => response.json())
      .then((data) => {
        const cliente = data as FinCliente;
        setClienteSeleccionado(cliente);
        setClienteSearch(cliente.tipo === "fisica" ? `${cliente.apellido ?? ""}, ${cliente.nombre}` : cliente.nombre);
        setValue("cliente_id", cliente.id);
      });
  }, [preselectedClienteId, setValue]);

  const handleClienteSearch = (query: string) => {
    setClienteSearch(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query) {
      setClienteResultados([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      apiFetch(`/api/fin/clientes?q=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((data) => setClienteResultados((data as { clientes?: FinCliente[] }).clientes ?? []));
    }, 300);
  };

  const currentValues = watch();

  useEffect(() => {
    const plan = planes.find((item) => item.id === currentValues.plan_financiacion_id);

    if (!plan || !currentValues.cantidad_cuotas) {
      setTasaAplicada(null);
      return;
    }

    const tasa = PlanFinanciacionService.resolverTasa(plan, currentValues.cantidad_cuotas);
    setTasaAplicada(tasa);
    setValue("tasa_mensual", tasa, { shouldDirty: true, shouldValidate: true });
  }, [currentValues.cantidad_cuotas, currentValues.plan_financiacion_id, planes, setValue]);

  const watchedFields = watch([
    "capital",
    "tasa_mensual",
    "cantidad_cuotas",
    "sistema",
    "fecha_primer_vencimiento",
    "plan_financiacion_id",
  ]);

  useEffect(() => {
    const [capital, tasa, cuotas, sistema, fecha, planId] = watchedFields;
    const tasaPreview = planId ? tasaAplicada ?? tasa : tasa;

    if (!capital || !cuotas || !fecha || !tasaPreview) return;
    if (previewRef.current) clearTimeout(previewRef.current);
    previewRef.current = setTimeout(() => {
      setTablaLoading(true);
      apiFetch("/api/fin/creditos/preview", {
        method: "POST",
        body: JSON.stringify({
          capital,
          tasa_mensual: tasaPreview,
          plan_financiacion_id: planId || undefined,
          cantidad_cuotas: cuotas,
          sistema,
          fecha_primer_vencimiento: fecha,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          const payload = data as {
            tabla?: TablaAmortizacion;
            tabla_amortizacion?: TablaAmortizacion;
            tasa_mensual_aplicada?: number;
          };
          setTabla(payload.tabla ?? payload.tabla_amortizacion ?? null);
          setTasaAplicada(payload.tasa_mensual_aplicada ?? tasaPreview);
        })
        .catch(() => {
          setTabla(null);
          setTasaAplicada(planId ? tasaPreview : null);
        })
        .finally(() => setTablaLoading(false));
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedFields.join(","), tasaAplicada]);

  const goToStep2 = handleSubmit(() => setStep(2));

  const confirmSubmit = async () => {
    setServerError(null);
    try {
      const values = getValues();
      const res = await apiFetch("/api/fin/creditos", {
        method: "POST",
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Error al crear credito");
      }
      const data = (await res.json()) as { creditoId: string };
      router.push(`/creditos/${data.creditoId}`);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Error inesperado");
      setStep(1);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Nuevo credito</h2>
          <p className="text-sm text-slate-500">
            Paso {step} de 2 - {step === 1 ? "Datos del credito" : "Confirmacion"}
          </p>
        </div>
      </div>

      {step === 1 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Datos del credito</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={goToStep2} className="space-y-4">
                <div className="space-y-2">
                  <Label>Sucursal</Label>
                  <Select value={currentValues.sucursal_id} onValueChange={(value) => setValue("sucursal_id", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una sucursal" />
                    </SelectTrigger>
                    <SelectContent>
                      {sucursales.map((sucursal) => (
                        <SelectItem key={sucursal.id} value={sucursal.id}>
                          {sucursal.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.sucursal_id && <p className="text-xs text-red-600">{errors.sucursal_id.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <div className="relative">
                    <Input
                      placeholder="Buscar cliente por nombre o CUIT..."
                      value={clienteSearch}
                      onChange={(event) => handleClienteSearch(event.target.value)}
                    />
                    {clienteResultados.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
                        {clienteResultados.map((cliente) => (
                          <button
                            key={cliente.id}
                            type="button"
                            className="flex w-full items-start gap-3 px-4 py-3 text-sm hover:bg-amber-50"
                            onClick={() => {
                              setClienteSeleccionado(cliente);
                              setValue("cliente_id", cliente.id);
                              setClienteSearch(cliente.tipo === "fisica" ? `${cliente.apellido ?? ""}, ${cliente.nombre}` : cliente.nombre);
                              setClienteResultados([]);
                            }}
                          >
                            <span className="font-medium">
                              {cliente.tipo === "fisica" ? `${cliente.apellido ?? ""}, ${cliente.nombre}` : cliente.nombre}
                            </span>
                            <span className="text-slate-400">{cliente.cuit}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {clienteSeleccionado && (
                    <p className="text-xs text-green-700">Cliente seleccionado: CUIT {clienteSeleccionado.cuit}</p>
                  )}
                  {errors.cliente_id && <p className="text-xs text-red-600">{errors.cliente_id.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="articulo_descripcion">Descripcion del articulo</Label>
                  <Input id="articulo_descripcion" {...register("articulo_descripcion")} />
                  {errors.articulo_descripcion && <p className="text-xs text-red-600">{errors.articulo_descripcion.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Sistema de amortizacion</Label>
                  <Select value={currentValues.sistema} onValueChange={(value) => setValue("sistema", value as "frances" | "aleman")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frances">Frances (cuota fija)</SelectItem>
                      <SelectItem value="aleman">Aleman (capital fijo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Plan de financiacion</Label>
                  <Select
                    value={currentValues.plan_financiacion_id || "__manual__"}
                    onValueChange={(value) => setValue("plan_financiacion_id", value === "__manual__" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tasa manual" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__manual__">Tasa manual</SelectItem>
                      {planes.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="capital">Capital ($)</Label>
                    <Input id="capital" type="number" step="0.01" {...register("capital", { valueAsNumber: true })} />
                    {errors.capital && <p className="text-xs text-red-600">{errors.capital.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tasa_mensual">Tasa mensual (%)</Label>
                    <Input
                      id="tasa_mensual"
                      type="number"
                      step="0.01"
                      disabled={Boolean(currentValues.plan_financiacion_id)}
                      {...register("tasa_mensual", { valueAsNumber: true })}
                    />
                    {errors.tasa_mensual && <p className="text-xs text-red-600">{errors.tasa_mensual.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cantidad_cuotas">Cuotas</Label>
                    <Input id="cantidad_cuotas" type="number" {...register("cantidad_cuotas", { valueAsNumber: true })} />
                    {errors.cantidad_cuotas && <p className="text-xs text-red-600">{errors.cantidad_cuotas.message}</p>}
                    {currentValues.plan_financiacion_id && tasaAplicada !== null && (
                      <p className="text-xs text-amber-700">Tasa aplicada por plan: {tasaAplicada}%</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="fecha_otorgamiento">Fecha de otorgamiento</Label>
                    <Input id="fecha_otorgamiento" type="date" {...register("fecha_otorgamiento")} />
                    {errors.fecha_otorgamiento && <p className="text-xs text-red-600">{errors.fecha_otorgamiento.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fecha_primer_vencimiento">Primer vencimiento</Label>
                    <Input id="fecha_primer_vencimiento" type="date" {...register("fecha_primer_vencimiento")} />
                    {errors.fecha_primer_vencimiento && <p className="text-xs text-red-600">{errors.fecha_primer_vencimiento.message}</p>}
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Continuar
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-600">Vista previa tabla de amortizacion</h3>
            <AmortizationPreviewTable tabla={tabla} loading={tablaLoading} />
          </div>
        </div>
      )}

      {step === 2 && tabla && (
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Confirmar credito</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Cliente", clienteSeleccionado?.nombre ?? currentValues.cliente_id],
                  ["Articulo", currentValues.articulo_descripcion],
                  ["Capital", currentValues.capital?.toLocaleString("es-AR", { style: "currency", currency: "ARS" })],
                  ["Sistema", currentValues.sistema === "frances" ? "Frances" : "Aleman"],
                  ["Tasa mensual", `${tasaAplicada ?? currentValues.tasa_mensual}%`],
                  ["Cuotas", String(currentValues.cantidad_cuotas)],
                  ["Total credito", tabla.total_credito.toLocaleString("es-AR", { style: "currency", currency: "ARS" })],
                  ["Total intereses", tabla.total_intereses.toLocaleString("es-AR", { style: "currency", currency: "ARS" })],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-slate-400">{label}</dt>
                    <dd className="font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>

              {serverError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {serverError}
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={confirmSubmit} disabled={isSubmitting}>
                  {isSubmitting ? "Otorgando..." : "Confirmar y otorgar"}
                </Button>
                <Button variant="outline" onClick={() => setStep(1)}>
                  Volver
                </Button>
              </div>
            </CardContent>
          </Card>
          <AmortizationPreviewTable tabla={tabla} loading={false} />
        </div>
      )}
    </div>
  );
}
