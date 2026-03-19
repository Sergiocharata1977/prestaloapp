"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, ChevronRight, ShieldCheck, Wallet } from "lucide-react";
import type { FinCliente } from "@/types/fin-cliente";
import type { FinEvaluacion } from "@/types/fin-evaluacion";
import type { FinLineaCredito } from "@/types/fin-linea-credito";
import type { FinPlanFinanciacion } from "@/types/fin-plan-financiacion";
import type { FinPoliticaCrediticia } from "@/types/fin-politica-crediticia";
import type { FinSucursal } from "@/types/fin-sucursal";
import type { TablaAmortizacion } from "@/services/AmortizationService";
import { resolverTasa } from "@/lib/fin/planUtils";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { AmortizationPreviewTable } from "@/components/fin/AmortizationPreviewTable";

const schema = z.object({
  sucursal_id: z.string().min(1, "Selecciona una sucursal"),
  cliente_id: z.string().min(1, "Selecciona un cliente"),
  politica_id: z.string().min(1, "Selecciona una politica"),
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedClienteId?: string;
  onSuccess?: () => void;
}

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function ars(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "No disponible";
  return currencyFormatter.format(value);
}

function buildClienteLabel(cliente: FinCliente) {
  return cliente.tipo === "fisica"
    ? `${cliente.apellido ?? ""}, ${cliente.nombre}`.replace(/^,\s*/, "").trim()
    : cliente.nombre;
}

function resolveClientePayload(data: unknown) {
  const payload = data as { cliente?: FinCliente } | FinCliente;
  if ("cliente" in (payload as { cliente?: FinCliente })) {
    return (payload as { cliente?: FinCliente }).cliente ?? null;
  }
  return payload as FinCliente;
}

function resolveEvaluacionesPayload(data: unknown) {
  return ((data as { evaluaciones?: FinEvaluacion[] }).evaluaciones ?? []).sort((a, b) =>
    b.fecha.localeCompare(a.fecha)
  );
}

function resolveLineaPayload(data: unknown) {
  return ((data as { linea?: FinLineaCredito }).linea ?? null) as FinLineaCredito | null;
}

function resolveCupoDisponible(cliente: FinCliente | null, linea: FinLineaCredito | null) {
  if (linea) return linea.disponible_actual;
  if (!cliente) return null;

  const limite = cliente.limite_credito_vigente ?? cliente.limite_credito_asignado ?? null;
  if (typeof limite !== "number") return null;
  return Math.max(limite - (cliente.saldo_total_adeudado ?? 0), 0);
}

export function NuevoCreditoDialog({
  open,
  onOpenChange,
  preselectedClienteId,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [sucursales, setSucursales] = useState<FinSucursal[]>([]);
  const [planes, setPlanes] = useState<FinPlanFinanciacion[]>([]);
  const [politicas, setPoliticas] = useState<FinPoliticaCrediticia[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteResultados, setClienteResultados] = useState<FinCliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<FinCliente | null>(null);
  const [lineaCredito, setLineaCredito] = useState<FinLineaCredito | null>(null);
  const [evaluaciones, setEvaluaciones] = useState<FinEvaluacion[]>([]);
  const [clienteStatusLoading, setClienteStatusLoading] = useState(false);
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
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sistema: "frances",
      cliente_id: preselectedClienteId ?? "",
      politica_id: "",
      plan_financiacion_id: "",
      tasa_mensual: 5,
    },
  });

  const loadClienteContext = async (clienteId: string) => {
    setClienteStatusLoading(true);
    try {
      const [clienteRes, lineaRes, evaluacionesRes] = await Promise.all([
        apiFetch(`/api/fin/clientes/${clienteId}`).then((response) => response.json()),
        apiFetch(`/api/fin/clientes/${clienteId}/linea`)
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null),
        apiFetch(`/api/fin/clientes/${clienteId}/evaluacion`)
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null),
      ]);

      const cliente = resolveClientePayload(clienteRes);
      setClienteSeleccionado(cliente);
      setLineaCredito(resolveLineaPayload(lineaRes));
      setEvaluaciones(resolveEvaluacionesPayload(evaluacionesRes));

      if (cliente) {
        setClienteSearch(buildClienteLabel(cliente));
        setValue("cliente_id", cliente.id, { shouldValidate: true });
      }
    } finally {
      setClienteStatusLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    Promise.all([
      apiFetch("/api/fin/sucursales").then((response) => response.json()),
      apiFetch("/api/fin/planes-financiacion?activo=true")
        .then((response) => response.json())
        .catch(() => ({ planes: [] })),
      apiFetch("/api/fin/politicas-crediticias?activo=true")
        .then((response) => response.json())
        .catch(() => ({ politicas: [] })),
    ]).then(([sucursalesData, planesData, politicasData]) => {
      setSucursales((sucursalesData as { sucursales?: FinSucursal[] }).sucursales ?? []);
      setPlanes(
        (planesData as { planesFinanciacion?: FinPlanFinanciacion[]; planes?: FinPlanFinanciacion[] })
          .planesFinanciacion ??
          (planesData as { planes?: FinPlanFinanciacion[] }).planes ??
          []
      );
      setPoliticas(
        (politicasData as {
          politicasCrediticias?: FinPoliticaCrediticia[];
          politicas?: FinPoliticaCrediticia[];
        }).politicasCrediticias ??
          (politicasData as { politicas?: FinPoliticaCrediticia[] }).politicas ??
          []
      );
    });
  }, [open]);

  useEffect(() => {
    if (!open || !preselectedClienteId) return;
    void loadClienteContext(preselectedClienteId);
  }, [open, preselectedClienteId]);

  const handleClienteSearch = (query: string) => {
    setClienteSearch(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query) {
      setClienteResultados([]);
      setClienteSeleccionado(null);
      setLineaCredito(null);
      setEvaluaciones([]);
      setValue("cliente_id", "", { shouldValidate: true });
      return;
    }

    debounceRef.current = setTimeout(() => {
      apiFetch(`/api/fin/clientes?q=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((data) =>
          setClienteResultados((data as { clientes?: FinCliente[] }).clientes ?? [])
        );
    }, 300);
  };

  const currentValues = watch();
  const politicasFiltradas = politicas.filter((politica) => {
    if (!clienteSeleccionado?.tipo_cliente_id) return true;
    return politica.tipo_cliente_id === clienteSeleccionado.tipo_cliente_id;
  });
  const planesFiltrados = planes.filter((plan) =>
    currentValues.politica_id ? plan.politica_id === currentValues.politica_id : true
  );
  const politicaSeleccionada =
    politicas.find((politica) => politica.id === currentValues.politica_id) ?? null;
  const planSeleccionado =
    planes.find((plan) => plan.id === currentValues.plan_financiacion_id) ?? null;

  useEffect(() => {
    if (planSeleccionado && planSeleccionado.politica_id !== currentValues.politica_id) {
      setValue("politica_id", planSeleccionado.politica_id, { shouldValidate: true });
    }
  }, [currentValues.politica_id, planSeleccionado, setValue]);

  useEffect(() => {
    if (
      currentValues.plan_financiacion_id &&
      planSeleccionado &&
      planSeleccionado.politica_id !== currentValues.politica_id
    ) {
      setValue("plan_financiacion_id", "", { shouldValidate: true });
    }
  }, [
    currentValues.plan_financiacion_id,
    currentValues.politica_id,
    planSeleccionado,
    setValue,
  ]);

  useEffect(() => {
    if (!planSeleccionado || !currentValues.cantidad_cuotas) {
      setTasaAplicada(null);
      return;
    }

    const tasa = resolverTasa(
      planSeleccionado,
      currentValues.cantidad_cuotas
    );
    setTasaAplicada(tasa);
    setValue("tasa_mensual", tasa, { shouldDirty: true, shouldValidate: true });
  }, [currentValues.cantidad_cuotas, planSeleccionado, setValue]);

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
  }, [tasaAplicada, watchedFields.join(",")]);

  const cupoDisponible = resolveCupoDisponible(clienteSeleccionado, lineaCredito);
  const evaluacionVigente =
    lineaCredito?.evaluacion_vigente ??
    evaluaciones.find(
      (evaluacion) => evaluacion.es_vigente && evaluacion.estado === "aprobada"
    ) ??
    null;
  const tierActual =
    evaluacionVigente?.tier_asignado ??
    evaluacionVigente?.tier ??
    clienteSeleccionado?.tier_crediticio ??
    null;
  const tierConfig = politicaSeleccionada?.tiers.find((item) => item.tier === tierActual);
  const bloqueos: string[] = [];
  const avisos: string[] = [];

  if (politicaSeleccionada && clienteSeleccionado) {
    if (
      politicaSeleccionada.requiere_legajo &&
      clienteSeleccionado.legajo?.estado !== "completo"
    ) {
      bloqueos.push(
        "Legajo incompleto. La politica seleccionada exige legajo completo antes de otorgar."
      );
    }

    if (politicaSeleccionada.requiere_evaluacion_vigente) {
      if (!evaluacionVigente) {
        bloqueos.push(
          "Scoring sin vigencia. La politica seleccionada requiere una evaluacion aprobada y vigente."
        );
      } else if ((evaluacionVigente.tier_asignado ?? evaluacionVigente.tier) === "reprobado") {
        bloqueos.push(
          "Scoring rechazado. El cliente figura reprobado para esta operatoria."
        );
      }
    }

    if (
      typeof currentValues.capital === "number" &&
      typeof cupoDisponible === "number" &&
      currentValues.capital > cupoDisponible
    ) {
      bloqueos.push(
        `Limite excedido. El cupo disponible del cliente es ${ars(cupoDisponible)}.`
      );
    }

    if (
      typeof currentValues.capital === "number" &&
      typeof politicaSeleccionada.monto_maximo === "number" &&
      currentValues.capital > politicaSeleccionada.monto_maximo
    ) {
      bloqueos.push(
        `Limite de politica excedido. El maximo permitido es ${ars(
          politicaSeleccionada.monto_maximo
        )}.`
      );
    }

    if (
      typeof currentValues.capital === "number" &&
      typeof politicaSeleccionada.monto_minimo === "number" &&
      currentValues.capital < politicaSeleccionada.monto_minimo
    ) {
      avisos.push(
        `Monto por debajo del minimo sugerido por politica: ${ars(
          politicaSeleccionada.monto_minimo
        )}.`
      );
    }

    if (
      typeof currentValues.capital === "number" &&
      typeof tierConfig?.monto_maximo_otorgamiento === "number" &&
      currentValues.capital > tierConfig.monto_maximo_otorgamiento
    ) {
      bloqueos.push(
        `Limite por tier ${tierConfig.tier} excedido. Tope del tier: ${ars(
          tierConfig.monto_maximo_otorgamiento
        )}.`
      );
    }
  }

  if (clienteSeleccionado && typeof cupoDisponible !== "number") {
    avisos.push(
      "No se pudo determinar el cupo disponible con precision. Se usara la validacion final del backend."
    );
  }

  const goToStep2 = handleSubmit(() => {
    if (bloqueos.length > 0) return;
    setStep(2);
  });

  const confirmSubmit = async () => {
    if (bloqueos.length > 0) {
      setServerError(bloqueos[0]);
      setStep(1);
      return;
    }

    setServerError(null);
    try {
      const values = getValues();
      const { politica_id: _politicaId, ...payload } = values;
      const res = await apiFetch("/api/fin/creditos", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Error al crear credito");
      }
      const data = (await res.json()) as { creditoId: string };
      handleClose();
      onSuccess?.();
      router.push(`/creditos/${data.creditoId}`);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Error inesperado");
      setStep(1);
    }
  };

  const handleClose = () => {
    reset({
      sistema: "frances",
      cliente_id: preselectedClienteId ?? "",
      politica_id: "",
      plan_financiacion_id: "",
      tasa_mensual: 5,
    });
    setStep(1);
    setTabla(null);
    setTasaAplicada(null);
    setPlanes([]);
    setPoliticas([]);
    setClienteSearch("");
    setClienteSeleccionado(null);
    setLineaCredito(null);
    setEvaluaciones([]);
    setClienteResultados([]);
    setServerError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo credito</DialogTitle>
          <DialogDescription>
            Paso {step} de 2 - {step === 1 ? "Datos del credito" : "Confirmacion"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={goToStep2} className="space-y-4">
              <div className="space-y-2">
                <Label>Sucursal</Label>
                <Select
                  value={currentValues.sucursal_id}
                  onValueChange={(value) => setValue("sucursal_id", value)}
                >
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
                {errors.sucursal_id && (
                  <p className="text-xs text-red-600">{errors.sucursal_id.message}</p>
                )}
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
                            void loadClienteContext(cliente.id);
                            setClienteResultados([]);
                          }}
                        >
                          <span className="font-medium">{buildClienteLabel(cliente)}</span>
                          <span className="text-slate-400">{cliente.cuit}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {clienteSeleccionado && (
                  <p className="text-xs text-green-700">
                    Cliente seleccionado: CUIT {clienteSeleccionado.cuit}
                  </p>
                )}
                {clienteStatusLoading && (
                  <p className="text-xs text-slate-500">Cargando contexto del cliente...</p>
                )}
                {errors.cliente_id && (
                  <p className="text-xs text-red-600">{errors.cliente_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Politica crediticia</Label>
                <Select
                  value={currentValues.politica_id}
                  onValueChange={(value) => setValue("politica_id", value, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una politica" />
                  </SelectTrigger>
                  <SelectContent>
                    {politicasFiltradas.map((politica) => (
                      <SelectItem key={politica.id} value={politica.id}>
                        {politica.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.politica_id && (
                  <p className="text-xs text-red-600">{errors.politica_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="articulo_descripcion">Descripcion del articulo</Label>
                <Input id="articulo_descripcion" {...register("articulo_descripcion")} />
                {errors.articulo_descripcion && (
                  <p className="text-xs text-red-600">
                    {errors.articulo_descripcion.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Sistema de amortizacion</Label>
                <Select
                  value={currentValues.sistema}
                  onValueChange={(value) =>
                    setValue("sistema", value as "frances" | "aleman")
                  }
                >
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
                  onValueChange={(value) =>
                    setValue("plan_financiacion_id", value === "__manual__" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tasa manual" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__manual__">Tasa manual</SelectItem>
                    {planesFiltrados.map((plan) => (
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
                  <Input
                    id="capital"
                    type="number"
                    step="0.01"
                    {...register("capital", { valueAsNumber: true })}
                  />
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
                  {errors.tasa_mensual && (
                    <p className="text-xs text-red-600">{errors.tasa_mensual.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cantidad_cuotas">Cuotas</Label>
                  <Input
                    id="cantidad_cuotas"
                    type="number"
                    {...register("cantidad_cuotas", { valueAsNumber: true })}
                  />
                  {errors.cantidad_cuotas && (
                    <p className="text-xs text-red-600">{errors.cantidad_cuotas.message}</p>
                  )}
                  {currentValues.plan_financiacion_id && tasaAplicada !== null && (
                    <p className="text-xs text-amber-700">Tasa aplicada por plan: {tasaAplicada}%</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="fecha_otorgamiento">Fecha de otorgamiento</Label>
                  <Input id="fecha_otorgamiento" type="date" {...register("fecha_otorgamiento")} />
                  {errors.fecha_otorgamiento && (
                    <p className="text-xs text-red-600">{errors.fecha_otorgamiento.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fecha_primer_vencimiento">Primer vencimiento</Label>
                  <Input
                    id="fecha_primer_vencimiento"
                    type="date"
                    {...register("fecha_primer_vencimiento")}
                  />
                  {errors.fecha_primer_vencimiento && (
                    <p className="text-xs text-red-600">
                      {errors.fecha_primer_vencimiento.message}
                    </p>
                  )}
                </div>
              </div>

              {bloqueos.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    Bloqueos de originacion
                  </div>
                  {bloqueos.map((bloqueo) => (
                    <p key={bloqueo}>{bloqueo}</p>
                  ))}
                </div>
              )}

              {avisos.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    Avisos de control
                  </div>
                  {avisos.map((aviso) => (
                    <p key={aviso}>{aviso}</p>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Button type="submit" className="flex-1" disabled={bloqueos.length > 0}>
                  Continuar <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
              </div>
            </form>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Wallet className="h-4 w-4" />
                  Contexto del cliente
                </div>
                <dl className="grid gap-3 text-sm">
                  {[
                    ["Cliente", clienteSeleccionado ? buildClienteLabel(clienteSeleccionado) : "No seleccionado"],
                    ["Cupo disponible", ars(cupoDisponible)],
                    ["Tier actual", tierActual ?? "No disponible"],
                    ["Linea de credito", lineaCredito?.vigencia?.estado ?? "No disponible"],
                    ["Politica", politicaSeleccionada?.nombre ?? "No seleccionada"],
                    ["Plan", planSeleccionado?.nombre ?? "Tasa manual"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-slate-400">{label}</dt>
                      <dd className="font-medium text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600">Vista previa tabla de amortizacion</p>
                <AmortizationPreviewTable tabla={tabla} loading={tablaLoading} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && tabla && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Cliente", clienteSeleccionado ? buildClienteLabel(clienteSeleccionado) : currentValues.cliente_id],
                  ["Articulo", currentValues.articulo_descripcion],
                  ["Capital", currentValues.capital ? ars(currentValues.capital) : "No disponible"],
                  ["Sistema", currentValues.sistema === "frances" ? "Frances" : "Aleman"],
                  ["Politica", politicaSeleccionada?.nombre ?? "No seleccionada"],
                  ["Plan", planSeleccionado?.nombre ?? "Tasa manual"],
                  ["Tasa mensual", `${tasaAplicada ?? currentValues.tasa_mensual}%`],
                  ["Cuotas", String(currentValues.cantidad_cuotas)],
                  ["Total credito", ars(tabla.total_credito)],
                  ["Total intereses", ars(tabla.total_intereses)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-slate-400">{label}</dt>
                    <dd className="font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {serverError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <AmortizationPreviewTable tabla={tabla} loading={false} />

            <div className="flex gap-3">
              <Button onClick={confirmSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Otorgando..." : "Confirmar y otorgar"}
              </Button>
              <Button variant="outline" onClick={() => setStep(1)}>
                Volver
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
