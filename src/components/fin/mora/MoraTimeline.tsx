"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Gavel,
  HandCoins,
  MessageSquare,
  Phone,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import type {
  FinMoraAccionCategoria,
  FinMoraAccionEstado,
  FinMoraEtapa,
  FinMoraResultadoCodigo,
  FinMoraTimelineItem,
} from "@/types/fin-mora";
import { Badge } from "@/components/ui/badge";

// ─── Helpers visuales ─────────────────────────────────────────────────────────

function etapaBadgeClass(etapa: FinMoraEtapa) {
  switch (etapa) {
    case "mora_temprana":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "pre_judicial":
      return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case "judicial":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    default:
      return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  }
}

function etapaLabel(etapa: FinMoraEtapa) {
  switch (etapa) {
    case "mora_temprana":
      return "Mora temprana";
    case "pre_judicial":
      return "Pre-judicial";
    case "judicial":
      return "Judicial";
    default:
      return "Sin gestión";
  }
}

function estadoIcon(estado?: FinMoraAccionEstado) {
  switch (estado) {
    case "ejecutada":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "cancelada":
      return <XCircle className="h-4 w-4 text-slate-500" />;
    case "vencida":
      return <XCircle className="h-4 w-4 text-red-400" />;
    default:
      return <Clock3 className="h-4 w-4 text-amber-400" />;
  }
}

function categoriaIcon(categoria?: FinMoraAccionCategoria) {
  switch (categoria) {
    case "contacto":
      return <Phone className="h-3.5 w-3.5" />;
    case "negociacion":
      return <HandCoins className="h-3.5 w-3.5" />;
    case "judicial":
      return <Gavel className="h-3.5 w-3.5" />;
    case "documental":
      return <FileText className="h-3.5 w-3.5" />;
    default:
      return <MessageSquare className="h-3.5 w-3.5" />;
  }
}

function resultadoLabel(codigo?: FinMoraResultadoCodigo) {
  const map: Partial<Record<FinMoraResultadoCodigo, string>> = {
    sin_contacto: "Sin contacto",
    contacto_efectivo: "Contacto efectivo",
    compromiso_pago: "Compromiso de pago",
    pago_parcial: "Pago parcial",
    pago_total: "Pago total",
    rehusado: "Rehusó pagar",
    derivado_estudio: "Derivado a estudio",
    demanda_iniciada: "Demanda iniciada",
    cerrado: "Cerrado",
  };
  return codigo ? (map[codigo] ?? codigo) : null;
}

function formatDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MoraTimelineProps {
  clienteId: string;
  /** Si se pasa, usa los items directamente sin hacer fetch */
  items?: FinMoraTimelineItem[];
  className?: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function MoraTimeline({ clienteId, items: itemsProp, className }: MoraTimelineProps) {
  const [items, setItems] = useState<FinMoraTimelineItem[]>(itemsProp ?? []);
  const [loading, setLoading] = useState(!itemsProp);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (itemsProp) {
      setItems(itemsProp);
      return;
    }
    setLoading(true);
    apiFetch(`/api/fin/control-mora/clientes/${clienteId}/timeline`)
      .then((r) => r.json())
      .then((d) => {
        const data = d as { timeline?: FinMoraTimelineItem[] };
        setItems(data.timeline ?? []);
      })
      .catch(() => setError("No se pudo cargar el historial."))
      .finally(() => setLoading(false));
  }, [clienteId, itemsProp]);

  if (loading) {
    return (
      <p className="text-sm text-slate-500 py-4">Cargando historial...</p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-400 py-4">{error}</p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-4">
        Sin acciones registradas aún.
      </p>
    );
  }

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {items.map((item, idx) => (
        <div key={item.id ?? idx} className="flex gap-3">
          {/* Línea vertical + ícono de estado */}
          <div className="flex flex-col items-center">
            <div className="mt-0.5 flex-shrink-0">{estadoIcon(item.estado)}</div>
            {idx < items.length - 1 && (
              <div className="mt-1.5 w-px flex-1 bg-slate-700/50" />
            )}
          </div>

          {/* Contenido */}
          <div className="pb-4 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {/* Categoría ícono + título */}
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                <span className="text-slate-400">
                  {categoriaIcon(item.categoria)}
                </span>
                {item.titulo}
              </span>

              {/* Etapa badge */}
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${etapaBadgeClass(item.etapa)}`}
              >
                {etapaLabel(item.etapa)}
              </span>
            </div>

            {/* Resultado */}
            {item.resultado_codigo && item.resultado_codigo !== "pendiente" && (
              <p className="text-xs text-slate-400 mb-1">
                <span className="font-medium text-slate-300">
                  {resultadoLabel(item.resultado_codigo)}
                </span>
                {item.resultado_texto && ` — ${item.resultado_texto}`}
              </p>
            )}

            {/* Descripción */}
            {item.descripcion && (
              <p className="text-xs text-slate-500 mb-1">{item.descripcion}</p>
            )}

            {/* Meta: responsable + fecha */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
              {item.responsable_nombre && (
                <span>{item.responsable_nombre}</span>
              )}
              <span>{formatDate(item.executed_at ?? item.created_at)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
