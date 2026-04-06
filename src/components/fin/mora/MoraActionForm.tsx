"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import type {
  FinMoraAccionClase,
  FinMoraAccionPrioridad,
  FinMoraAccionTipo,
  FinMoraResultadoCodigo,
} from "@/types/fin-mora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Catálogos ────────────────────────────────────────────────────────────────

const TIPO_OPTIONS: { value: FinMoraAccionTipo; label: string }[] = [
  { value: "llamado", label: "Llamado" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "visita", label: "Visita" },
  { value: "acuerdo", label: "Acuerdo" },
  { value: "carta_documento", label: "Carta documento" },
  { value: "derivacion_estudio", label: "Derivación a estudio" },
  { value: "demanda", label: "Demanda" },
  { value: "audiencia", label: "Audiencia" },
  { value: "presentacion_judicial", label: "Presentación judicial" },
  { value: "gestion_documental", label: "Gestión documental" },
  { value: "tarea", label: "Tarea" },
  { value: "recordatorio", label: "Recordatorio" },
  { value: "nota_interna", label: "Nota interna" },
  { value: "actualizacion_estado", label: "Actualización de estado" },
];

const RESULTADO_OPTIONS: { value: FinMoraResultadoCodigo; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "sin_contacto", label: "Sin contacto" },
  { value: "contacto_efectivo", label: "Contacto efectivo" },
  { value: "compromiso_pago", label: "Compromiso de pago" },
  { value: "pago_parcial", label: "Pago parcial" },
  { value: "pago_total", label: "Pago total" },
  { value: "rehusado", label: "Rehusó pagar" },
  { value: "requiere_documentacion", label: "Requiere documentación" },
  { value: "derivado_estudio", label: "Derivado a estudio" },
  { value: "demanda_iniciada", label: "Demanda iniciada" },
  { value: "cerrado", label: "Cerrado" },
];

const PRIORIDAD_OPTIONS: { value: FinMoraAccionPrioridad; label: string }[] = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MoraActionFormProps {
  clienteId: string;
  clase: FinMoraAccionClase;
  defaultPrioridad?: FinMoraAccionPrioridad;
  onSuccess?: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function MoraActionForm({
  clienteId,
  clase,
  defaultPrioridad = "media",
  onSuccess,
}: MoraActionFormProps) {
  const [tipo, setTipo] = useState<FinMoraAccionTipo>("llamado");
  const [resultadoCodigo, setResultadoCodigo] =
    useState<FinMoraResultadoCodigo>("pendiente");
  const [resultadoTexto, setResultadoTexto] = useState("");
  const [notas, setNotas] = useState("");
  const [prioridad, setPrioridad] =
    useState<FinMoraAccionPrioridad>(defaultPrioridad);
  const [responsableNombre, setResponsableNombre] = useState("");
  const [proximaAccionTipo, setProximaAccionTipo] =
    useState<FinMoraAccionTipo>("recordatorio");
  const [proximaAccionAt, setProximaAccionAt] = useState("");
  const [compromisoPagoFecha, setCompromisoPagoFecha] = useState("");
  const [compromisoPagoMonto, setCompromisoPagoMonto] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tieneCompromiso = resultadoCodigo === "compromiso_pago";

  const handleSubmit = async () => {
    if (!resultadoTexto.trim()) {
      setError("Completá el resultado de la gestión.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        cliente_id: clienteId,
        clase,
        etapa: clase,
        tipo,
        prioridad,
        resultado: resultadoTexto,
        resultado_codigo: resultadoCodigo,
        resultado_texto: resultadoTexto,
        notas: notas || undefined,
        responsable_nombre: responsableNombre || undefined,
        proxima_accion_tipo: proximaAccionTipo || undefined,
        proxima_accion_at: proximaAccionAt || undefined,
      };

      if (tieneCompromiso && compromisoPagoFecha) {
        payload.compromiso_pago_fecha = compromisoPagoFecha;
        if (compromisoPagoMonto) {
          payload.compromiso_pago_monto = parseFloat(compromisoPagoMonto);
        }
      }

      const res = await apiFetch("/api/fin/control-mora/acciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "No se pudo registrar la acción.");
      }

      // reset
      setResultadoTexto("");
      setNotas("");
      setResponsableNombre("");
      setProximaAccionAt("");
      setCompromisoPagoFecha("");
      setCompromisoPagoMonto("");
      setResultadoCodigo("pendiente");
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo registrar la acción."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tipo + Prioridad */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            Tipo de acción
          </p>
          <Select
            value={tipo}
            onValueChange={(v) => setTipo(v as FinMoraAccionTipo)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPO_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            Prioridad
          </p>
          <Select
            value={prioridad}
            onValueChange={(v) => setPrioridad(v as FinMoraAccionPrioridad)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORIDAD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resultado */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            Resultado
          </p>
          <Select
            value={resultadoCodigo}
            onValueChange={(v) =>
              setResultadoCodigo(v as FinMoraResultadoCodigo)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESULTADO_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            Responsable
          </p>
          <Input
            value={responsableNombre}
            onChange={(e) => setResponsableNombre(e.target.value)}
            placeholder="Ej. Cobranzas, Estudio externo"
          />
        </div>
      </div>

      {/* Detalle del resultado */}
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          Detalle de la gestión <span className="text-red-400">*</span>
        </p>
        <Textarea
          value={resultadoTexto}
          onChange={(e) => setResultadoTexto(e.target.value)}
          placeholder="Describí qué ocurrió en esta gestión"
          rows={2}
        />
      </div>

      {/* Compromiso de pago (condicional) */}
      {tieneCompromiso && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
            Compromiso de pago
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-slate-500">Fecha comprometida</p>
              <Input
                type="date"
                value={compromisoPagoFecha}
                onChange={(e) => setCompromisoPagoFecha(e.target.value)}
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-500">Monto (opcional)</p>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={compromisoPagoMonto}
                onChange={(e) => setCompromisoPagoMonto(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      )}

      {/* Próxima acción */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            Próxima acción
          </p>
          <Select
            value={proximaAccionTipo}
            onValueChange={(v) => setProximaAccionTipo(v as FinMoraAccionTipo)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPO_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            Fecha próxima acción
          </p>
          <Input
            type="date"
            value={proximaAccionAt ? proximaAccionAt.slice(0, 10) : ""}
            onChange={(e) => setProximaAccionAt(e.target.value)}
          />
        </div>
      </div>

      {/* Notas */}
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          Notas internas (opcional)
        </p>
        <Textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas adicionales para el equipo"
          rows={2}
        />
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button
        onClick={() => void handleSubmit()}
        disabled={saving || !resultadoTexto.trim()}
        className="w-full"
      >
        {saving ? "Guardando..." : "Registrar acción"}
      </Button>
    </div>
  );
}
