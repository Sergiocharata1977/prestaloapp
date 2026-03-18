"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronRight } from "lucide-react";
import type { FinCliente } from "@/types/fin-cliente";
import type { FinSucursal } from "@/types/fin-sucursal";
import type { TablaAmortizacion } from "@/services/AmortizationService";
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
  sucursal_id: z.string().min(1, "Seleccioná una sucursal"),
  cliente_id: z.string().min(1, "Seleccioná un cliente"),
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
  /** Pre-selecciona un cliente al abrir el dialog */
  preselectedClienteId?: string;
  onSuccess?: () => void;
}

export function NuevoCreditoDialog({ open, onOpenChange, preselectedClienteId, onSuccess }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [sucursales, setSucursales] = useState<FinSucursal[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteResultados, setClienteResultados] = useState<FinCliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<FinCliente | null>(null);
  const [tabla, setTabla] = useState<TablaAmortizacion | null>(null);
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
    },
  });

  // Load sucursales when dialog opens
  useEffect(() => {
    if (!open) return;
    apiFetch("/api/fin/sucursales")
      .then((r) => r.json())
      .then((d) => setSucursales((d as { sucursales: FinSucursal[] }).sucursales ?? []));
  }, [open]);

  // Preselect cliente
  useEffect(() => {
    if (!open || !preselectedClienteId) return;
    apiFetch(`/api/fin/clientes/${preselectedClienteId}`)
      .then((r) => r.json())
      .then((d) => {
        const c = d as FinCliente;
        setClienteSeleccionado(c);
        setClienteSearch(c.tipo === "fisica" ? `${c.apellido ?? ""}, ${c.nombre}` : c.nombre);
        setValue("cliente_id", c.id);
      });
  }, [open, preselectedClienteId, setValue]);

  // Client search
  const handleClienteSearch = (q: string) => {
    setClienteSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q) { setClienteResultados([]); return; }
    debounceRef.current = setTimeout(() => {
      apiFetch(`/api/fin/clientes?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setClienteResultados((d as { clientes: FinCliente[] }).clientes ?? []));
    }, 300);
  };

  // Live amortization preview
  const watchedFields = watch(["capital", "tasa_mensual", "cantidad_cuotas", "sistema", "fecha_primer_vencimiento"]);
  useEffect(() => {
    const [capital, tasa, cuotas, sistema, fecha] = watchedFields;
    if (!capital || !tasa || !cuotas || !fecha) return;
    if (previewRef.current) clearTimeout(previewRef.current);
    previewRef.current = setTimeout(() => {
      setTablaLoading(true);
      apiFetch("/api/fin/creditos/preview", {
        method: "POST",
        body: JSON.stringify({ capital, tasa_mensual: tasa, cantidad_cuotas: cuotas, sistema, fecha_primer_vencimiento: fecha }),
      })
        .then((r) => r.json())
        .then((d) => setTabla((d as { tabla: TablaAmortizacion }).tabla))
        .catch(() => setTabla(null))
        .finally(() => setTablaLoading(false));
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedFields.join(",")]);

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
        throw new Error((body as { error?: string }).error ?? "Error al crear crédito");
      }
      const data = (await res.json()) as { creditoId: string };
      handleClose();
      onSuccess?.();
      router.push(`/creditos/${data.creditoId}`);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Error inesperado");
      setStep(1);
    }
  };

  const handleClose = () => {
    reset();
    setStep(1);
    setTabla(null);
    setClienteSearch("");
    setClienteSeleccionado(null);
    setClienteResultados([]);
    setServerError(null);
    onOpenChange(false);
  };

  const currentValues = watch();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo crédito</DialogTitle>
          <DialogDescription>
            Paso {step} de 2 — {step === 1 ? "Datos del crédito" : "Confirmación"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: form */}
            <form onSubmit={goToStep2} className="space-y-4">
              {/* Sucursal */}
              <div className="space-y-2">
                <Label>Sucursal</Label>
                <Select onValueChange={(v) => setValue("sucursal_id", v)} defaultValue={currentValues.sucursal_id}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná una sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.sucursal_id && <p className="text-xs text-red-600">{errors.sucursal_id.message}</p>}
              </div>

              {/* Cliente */}
              <div className="space-y-2">
                <Label>Cliente</Label>
                <div className="relative">
                  <Input
                    placeholder="Buscar cliente por nombre o CUIT…"
                    value={clienteSearch}
                    onChange={(e) => handleClienteSearch(e.target.value)}
                  />
                  {clienteResultados.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
                      {clienteResultados.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="flex w-full items-start gap-3 px-4 py-3 text-sm hover:bg-amber-50"
                          onClick={() => {
                            setClienteSeleccionado(c);
                            setValue("cliente_id", c.id);
                            setClienteSearch(c.tipo === "fisica" ? `${c.apellido ?? ""}, ${c.nombre}` : c.nombre);
                            setClienteResultados([]);
                          }}
                        >
                          <span className="font-medium">
                            {c.tipo === "fisica" ? `${c.apellido ?? ""}, ${c.nombre}` : c.nombre}
                          </span>
                          <span className="text-slate-400">{c.cuit}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {clienteSeleccionado && (
                  <p className="text-xs text-green-700">✓ Cliente seleccionado: CUIT {clienteSeleccionado.cuit}</p>
                )}
                {errors.cliente_id && <p className="text-xs text-red-600">{errors.cliente_id.message}</p>}
              </div>

              {/* Artículo */}
              <div className="space-y-2">
                <Label htmlFor="articulo_descripcion">Descripción del artículo</Label>
                <Input id="articulo_descripcion" {...register("articulo_descripcion")} />
                {errors.articulo_descripcion && <p className="text-xs text-red-600">{errors.articulo_descripcion.message}</p>}
              </div>

              {/* Sistema */}
              <div className="space-y-2">
                <Label>Sistema de amortización</Label>
                <Select defaultValue="frances" onValueChange={(v) => setValue("sistema", v as "frances" | "aleman")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frances">Francés (cuota fija)</SelectItem>
                    <SelectItem value="aleman">Alemán (capital fijo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Números */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="capital">Capital ($)</Label>
                  <Input id="capital" type="number" step="0.01" {...register("capital", { valueAsNumber: true })} />
                  {errors.capital && <p className="text-xs text-red-600">{errors.capital.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tasa_mensual">Tasa mensual (%)</Label>
                  <Input id="tasa_mensual" type="number" step="0.01" {...register("tasa_mensual", { valueAsNumber: true })} />
                  {errors.tasa_mensual && <p className="text-xs text-red-600">{errors.tasa_mensual.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cantidad_cuotas">Cuotas</Label>
                  <Input id="cantidad_cuotas" type="number" {...register("cantidad_cuotas", { valueAsNumber: true })} />
                  {errors.cantidad_cuotas && <p className="text-xs text-red-600">{errors.cantidad_cuotas.message}</p>}
                </div>
              </div>

              {/* Fechas */}
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

              <div className="flex gap-3">
                <Button type="submit" className="flex-1">
                  Continuar <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
              </div>
            </form>

            {/* Right: amortization preview */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600">Vista previa tabla de amortización</p>
              <AmortizationPreviewTable tabla={tabla} loading={tablaLoading} />
            </div>
          </div>
        )}

        {step === 2 && tabla && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Cliente", clienteSeleccionado?.nombre ?? currentValues.cliente_id],
                  ["Artículo", currentValues.articulo_descripcion],
                  ["Capital", currentValues.capital?.toLocaleString("es-AR", { style: "currency", currency: "ARS" })],
                  ["Sistema", currentValues.sistema === "frances" ? "Francés" : "Alemán"],
                  ["Tasa mensual", `${currentValues.tasa_mensual}%`],
                  ["Cuotas", String(currentValues.cantidad_cuotas)],
                  ["Total crédito", tabla.total_credito.toLocaleString("es-AR", { style: "currency", currency: "ARS" })],
                  ["Total intereses", tabla.total_intereses.toLocaleString("es-AR", { style: "currency", currency: "ARS" })],
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
                {isSubmitting ? "Otorgando…" : "Confirmar y otorgar"}
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
