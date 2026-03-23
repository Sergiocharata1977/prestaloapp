"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Printer, ShoppingBag } from "lucide-react";
import type { FinCliente } from "@/types/fin-cliente";
import type { FinPlanFinanciacion } from "@/types/fin-plan-financiacion";
import type { FinPoliticaCrediticia } from "@/types/fin-politica-crediticia";
import type { FinSucursal } from "@/types/fin-sucursal";
import type { TablaAmortizacion } from "@/services/AmortizationService";
import { resolverTasa } from "@/lib/fin/planUtils";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/hooks/useAuth";
import { CAPABILITIES } from "@/lib/capabilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TipoFormulario = "prestamo" | "compra_financiada";

interface FormState {
  sucursal_id: string;
  cliente_id: string;
  politica_id: string;
  plan_financiacion_id: string;
  articulo_descripcion: string;
  capital: string;
  cantidad_cuotas: string;
  tasa_mensual: number;
  fecha_otorgamiento: string;
  fecha_primer_vencimiento: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedClienteId?: string;
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function ars(v?: number | null) {
  if (typeof v !== "number" || isNaN(v)) return "—";
  return fmt.format(v);
}

function buildLabel(c: FinCliente) {
  return c.tipo === "fisica"
    ? `${c.apellido ?? ""}, ${c.nombre}`.replace(/^,\s*/, "").trim()
    : c.nombre;
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function dia5MesSiguiente() {
  const d = new Date();
  const m = d.getMonth() === 11 ? 1 : d.getMonth() + 2;
  const y = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
  return `${y}-${String(m).padStart(2, "0")}-05`;
}

const EMPTY: FormState = {
  sucursal_id: "",
  cliente_id: "",
  politica_id: "",
  plan_financiacion_id: "",
  articulo_descripcion: "",
  capital: "",
  cantidad_cuotas: "",
  tasa_mensual: 5,
  fecha_otorgamiento: todayIso(),
  fecha_primer_vencimiento: dia5MesSiguiente(),
};

// ---------------------------------------------------------------------------
// Subcomponent: Buscador de clientes
// ---------------------------------------------------------------------------

function ClienteSearch({
  value,
  onSelect,
}: {
  value: FinCliente | null;
  onSelect: (c: FinCliente) => void;
}) {
  const [search, setSearch] = useState(value ? buildLabel(value) : "");
  const [resultados, setResultados] = useState<FinCliente[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value) setSearch(buildLabel(value));
  }, [value]);

  return (
    <div className="relative">
      <Input
        className="h-9"
        placeholder="Buscar por nombre o CUIT..."
        value={search}
        onChange={(e) => {
          const q = e.target.value;
          setSearch(q);
          if (debounce.current) clearTimeout(debounce.current);
          if (!q) { setResultados([]); return; }
          debounce.current = setTimeout(() => {
            apiFetch(`/api/fin/clientes?q=${encodeURIComponent(q)}`)
              .then((r) => r.json())
              .then((d) =>
                setResultados((d as { clientes?: FinCliente[] }).clientes ?? [])
              );
          }, 300);
        }}
      />
      {resultados.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-lg">
          {resultados.map((c) => (
            <button
              key={c.id}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-indigo-50"
              onClick={() => {
                onSelect(c);
                setSearch(buildLabel(c));
                setResultados([]);
              }}
            >
              <span className="font-medium">{buildLabel(c)}</span>
              <span className="text-xs text-slate-400">{c.cuit}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponent: Resumen cuotas
// ---------------------------------------------------------------------------

function ResumenCuotas({
  tabla,
  loading,
}: {
  tabla: TablaAmortizacion | null;
  loading: boolean;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-3 text-center text-sm font-semibold text-slate-600">
        Resumen de Operación
      </h3>
      {loading ? (
        <p className="mt-8 text-center text-xs text-slate-400">Calculando...</p>
      ) : !tabla ? (
        <p className="mt-8 text-center text-xs text-slate-400">
          Completá monto y cuotas para ver el detalle
        </p>
      ) : (
        <div className="space-y-1 overflow-y-auto">
          {tabla.cuotas.map((c) => (
            <div
              key={c.numero_cuota}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-white"
            >
              <span className="text-slate-500">
                Cuota {c.numero_cuota} · {c.fecha_vencimiento.slice(0, 10)}
              </span>
              <span className="font-semibold tabular-nums text-slate-800">
                {ars(c.total)}
              </span>
            </div>
          ))}
          <div className="mt-3 flex items-center justify-between border-t border-slate-300 pt-2 text-xs font-semibold">
            <span className="text-slate-600">Total a pagar</span>
            <span className="text-slate-900">{ars(tabla.total_credito)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Intereses</span>
            <span>{ars(tabla.total_intereses)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NuevoCreditoDialog({
  open,
  onOpenChange,
  preselectedClienteId,
  onSuccess,
}: Props) {
  const router = useRouter();
  const { capabilities } = useAuth();
  const hasSucursalesMulti = capabilities.includes(CAPABILITIES.SUCURSALES_MULTI);
  const hasProductos = capabilities.includes(CAPABILITIES.PRODUCTOS);

  const [tipo, setTipo] = useState<TipoFormulario | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY });
  const [valorContado, setValorContado] = useState("");
  const [creditoCreado, setCreditoCreado] = useState<{ id: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [sucursales, setSucursales] = useState<FinSucursal[]>([]);
  const [planes, setPlanes] = useState<FinPlanFinanciacion[]>([]);
  const [politicas, setPoliticas] = useState<FinPoliticaCrediticia[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<FinCliente | null>(null);
  const [tabla, setTabla] = useState<TablaAmortizacion | null>(null);
  const [tablaLoading, setTablaLoading] = useState(false);

  const previewRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // Load catalogs
  useEffect(() => {
    if (!open || !tipo) return;
    Promise.all([
      apiFetch("/api/fin/sucursales").then((r) => r.json()),
      apiFetch("/api/fin/planes-financiacion?activo=true").then((r) => r.json()).catch(() => ({})),
      apiFetch("/api/fin/politicas-crediticias?activo=true").then((r) => r.json()).catch(() => ({})),
    ]).then(([sd, pd, pol]) => {
      const sArr = (sd as { sucursales?: FinSucursal[] }).sucursales ?? [];
      const pArr =
        (pd as { planesFinanciacion?: FinPlanFinanciacion[] }).planesFinanciacion ??
        (pd as { planes?: FinPlanFinanciacion[] }).planes ?? [];
      const polArr =
        (pol as { politicasCrediticias?: FinPoliticaCrediticia[] }).politicasCrediticias ??
        (pol as { politicas?: FinPoliticaCrediticia[] }).politicas ?? [];
      setSucursales(sArr);
      setPlanes(pArr);
      setPoliticas(polArr);
      if (!hasSucursalesMulti && sArr.length > 0) setField("sucursal_id", sArr[0].id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipo]);

  // Preselected client
  useEffect(() => {
    if (!open || !preselectedClienteId || !tipo) return;
    apiFetch(`/api/fin/clientes/${preselectedClienteId}`)
      .then((r) => r.json())
      .then((res) => {
        const c = (res as { cliente?: FinCliente }).cliente ?? (res as FinCliente);
        if (c?.id) handleClienteSelect(c);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectedClienteId, tipo]);

  const handleClienteSelect = (c: FinCliente) => {
    setClienteSeleccionado(c);
    setField("cliente_id", c.id);
    setPoliticas((prev) => {
      const match = prev.filter((p) => p.tipo_cliente_id === c.tipo_cliente_id);
      if (match.length === 1) {
        setField("politica_id", match[0].id);
        setPlanes((plns) => {
          const planMatch = plns.filter((pl) => pl.politica_id === match[0].id);
          if (planMatch.length > 0) setField("plan_financiacion_id", planMatch[0].id);
          return plns;
        });
      }
      return prev;
    });
  };

  // Auto política cuando cargan los catálogos
  useEffect(() => {
    if (!clienteSeleccionado || politicas.length === 0) return;
    const match = politicas.filter((p) => p.tipo_cliente_id === clienteSeleccionado.tipo_cliente_id);
    if (match.length === 1 && !form.politica_id) {
      setField("politica_id", match[0].id);
      const planMatch = planes.filter((pl) => pl.politica_id === match[0].id);
      if (planMatch.length > 0 && !form.plan_financiacion_id)
        setField("plan_financiacion_id", planMatch[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSeleccionado, politicas, planes]);

  // Auto plan cuando cambia política
  useEffect(() => {
    if (!form.politica_id || planes.length === 0) return;
    const match = planes.filter((p) => p.politica_id === form.politica_id);
    if (match.length > 0 && !match.find((p) => p.id === form.plan_financiacion_id))
      setField("plan_financiacion_id", match[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.politica_id, planes]);

  // Tasa desde plan
  useEffect(() => {
    const plan = planes.find((p) => p.id === form.plan_financiacion_id);
    const cuotas = parseInt(form.cantidad_cuotas);
    if (!plan || !cuotas) return;
    setField("tasa_mensual", resolverTasa(plan, cuotas));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.plan_financiacion_id, form.cantidad_cuotas, planes]);

  // Live preview
  useEffect(() => {
    const capital = parseFloat(form.capital);
    const cuotas = parseInt(form.cantidad_cuotas);
    if (!capital || !cuotas || !form.fecha_primer_vencimiento || !form.tasa_mensual) {
      setTabla(null);
      return;
    }
    if (previewRef.current) clearTimeout(previewRef.current);
    previewRef.current = setTimeout(() => {
      setTablaLoading(true);
      apiFetch("/api/fin/creditos/preview", {
        method: "POST",
        body: JSON.stringify({
          capital,
          tasa_mensual: form.tasa_mensual,
          plan_financiacion_id: form.plan_financiacion_id || undefined,
          cantidad_cuotas: cuotas,
          sistema: "frances",
          fecha_primer_vencimiento: form.fecha_primer_vencimiento,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          const d = data as { tabla?: TablaAmortizacion; tabla_amortizacion?: TablaAmortizacion; tasa_mensual_aplicada?: number };
          setTabla(d.tabla ?? d.tabla_amortizacion ?? null);
          if (d.tasa_mensual_aplicada) setField("tasa_mensual", d.tasa_mensual_aplicada);
        })
        .catch(() => setTabla(null))
        .finally(() => setTablaLoading(false));
    }, 500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.capital, form.cantidad_cuotas, form.tasa_mensual, form.fecha_primer_vencimiento, form.plan_financiacion_id]);

  const handleConfirm = async () => {
    setServerError(null);
    const capital = parseFloat(form.capital);
    const cuotas = parseInt(form.cantidad_cuotas);
    if (!form.cliente_id) return setServerError("Seleccioná un cliente.");
    if (!capital || capital <= 0) return setServerError("Ingresá un monto válido.");
    if (!cuotas || cuotas <= 0) return setServerError("Ingresá la cantidad de cuotas.");
    if (tipo === "compra_financiada" && !form.articulo_descripcion.trim())
      return setServerError("Ingresá la descripción del bien.");

    setSubmitting(true);
    try {
      const payload = {
        sucursal_id: form.sucursal_id,
        cliente_id: form.cliente_id,
        plan_financiacion_id: form.plan_financiacion_id || undefined,
        tipo_operacion: tipo === "compra_financiada" ? ("compra_financiada" as const) : undefined,
        articulo_descripcion: tipo === "prestamo" ? "Préstamo personal" : form.articulo_descripcion,
        valor_contado_bien:
          tipo === "compra_financiada" && valorContado ? parseFloat(valorContado) : undefined,
        capital,
        tasa_mensual: form.tasa_mensual,
        cantidad_cuotas: cuotas,
        sistema: "frances" as const,
        fecha_otorgamiento: form.fecha_otorgamiento,
        fecha_primer_vencimiento: form.fecha_primer_vencimiento,
      };
      const res = await apiFetch("/api/fin/creditos", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Error al crear crédito");
      }
      const data = (await res.json()) as { creditoId: string };
      setCreditoCreado({ id: data.creditoId });
      onSuccess?.();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setForm({ ...EMPTY });
    setTipo(null);
    setValorContado("");
    setCreditoCreado(null);
    setServerError(null);
    setTabla(null);
    setClienteSeleccionado(null);
    onOpenChange(false);
  };

  const politicaSeleccionada = politicas.find((p) => p.id === form.politica_id);
  const planSeleccionado = planes.find((p) => p.id === form.plan_financiacion_id);

  // ─── Success screen ───────────────────────────────────────────────────────
  if (creditoCreado) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center gap-5 py-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Crédito otorgado</h3>
              <p className="mt-1 text-sm text-slate-500">La operación fue registrada correctamente.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => window.open(`/print/credito/${creditoCreado.id}`, "_blank")}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Pagaré
              </Button>
              <Button variant="outline" onClick={() => { handleClose(); router.push(`/creditos/${creditoCreado.id}`); }}>
                Ver crédito
              </Button>
              <Button variant="ghost" onClick={handleClose}>Cerrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Selector de tipo ─────────────────────────────────────────────────────
  if (!tipo) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva operación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">¿Qué tipo de operación querés registrar?</p>
          <div className="grid gap-3 pt-2">
            <button
              type="button"
              onClick={() => setTipo("prestamo")}
              className="flex items-center gap-4 rounded-2xl border-2 border-slate-200 p-5 text-left transition-colors hover:border-indigo-400 hover:bg-indigo-50"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Préstamo</p>
                <p className="text-sm text-slate-500">Otorgá dinero en efectivo con tabla de cuotas</p>
              </div>
            </button>

            {hasProductos && (
              <button
                type="button"
                onClick={() => setTipo("compra_financiada")}
                className="flex items-center gap-4 rounded-2xl border-2 border-slate-200 p-5 text-left transition-colors hover:border-violet-400 hover:bg-violet-50"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Compra Financiada</p>
                  <p className="text-sm text-slate-500">Financiá un bien o producto con valor de contado</p>
                </div>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Formulario ───────────────────────────────────────────────────────────
  const isPrestamo = tipo === "prestamo";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isPrestamo ? "bg-indigo-100 text-indigo-600" : "bg-violet-100 text-violet-600"}`}>
              {isPrestamo ? <CreditCard className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle>{isPrestamo ? "Nuevo Préstamo" : "Nueva Compra Financiada"}</DialogTitle>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-slate-600"
                onClick={() => { setTipo(null); setForm({ ...EMPTY }); setTabla(null); setClienteSeleccionado(null); }}
              >
                ← Cambiar tipo
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* LEFT */}
          <div className="space-y-4">

            {/* Sucursal (multi-sucursal plugin) */}
            {hasSucursalesMulti && (
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Sucursal</Label>
                <Select value={form.sucursal_id} onValueChange={(v) => setField("sucursal_id", v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {sucursales.map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Cliente */}
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Cliente</Label>
              <ClienteSearch value={clienteSeleccionado} onSelect={handleClienteSelect} />
              {clienteSeleccionado && politicaSeleccionada && (
                <p className="text-xs text-indigo-600">
                  {politicaSeleccionada.nombre}
                  {planSeleccionado ? ` · ${planSeleccionado.nombre}` : ""}
                  {form.tasa_mensual ? ` · ${form.tasa_mensual}% mens.` : ""}
                </p>
              )}
            </div>

            {/* Compra Financiada — campos del bien */}
            {!isPrestamo && (
              <div className="space-y-3 rounded-xl bg-violet-50 p-3">
                <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Bien financiado</p>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Descripción del bien</Label>
                  <Input
                    className="h-9 bg-white"
                    placeholder="Ej: Heladera Samsung 300L"
                    value={form.articulo_descripcion}
                    onChange={(e) => setField("articulo_descripcion", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Valor de contado (opcional)</Label>
                  <Input
                    className="h-9 bg-white"
                    type="number"
                    placeholder="$"
                    value={valorContado}
                    onChange={(e) => setValorContado(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Monto */}
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">
                {isPrestamo ? "Monto del préstamo" : "Monto a financiar"}
              </Label>
              <Input
                className="h-9"
                type="number"
                step="0.01"
                placeholder="$0,00"
                value={form.capital}
                onChange={(e) => setField("capital", e.target.value)}
              />
            </div>

            {/* Cuotas */}
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Cantidad de cuotas</Label>
              <Input
                className="h-9"
                type="number"
                placeholder="Ej: 12"
                value={form.cantidad_cuotas}
                onChange={(e) => setField("cantidad_cuotas", e.target.value)}
              />
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Otorgamiento</Label>
                <Input
                  className="h-9 text-xs"
                  type="date"
                  value={form.fecha_otorgamiento}
                  onChange={(e) => setField("fecha_otorgamiento", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">1er vencimiento</Label>
                <Input
                  className="h-9 text-xs"
                  type="date"
                  value={form.fecha_primer_vencimiento}
                  onChange={(e) => setField("fecha_primer_vencimiento", e.target.value)}
                />
              </div>
            </div>

            {serverError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {serverError}
              </p>
            )}

            <Button
              className={`w-full ${isPrestamo ? "bg-indigo-600 hover:bg-indigo-700" : "bg-violet-600 hover:bg-violet-700"}`}
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? "Procesando..." : isPrestamo ? "Confirmar Préstamo" : "Confirmar Compra Financiada"}
            </Button>
          </div>

          {/* RIGHT — preview cuotas */}
          <ResumenCuotas tabla={tabla} loading={tablaLoading} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
