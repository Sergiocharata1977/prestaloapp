"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ClipboardCheck,
  History,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EvaluacionTier, FinEvaluacion } from "@/types/fin-evaluacion";
import type { FinClienteRiesgoPayload, FinRiesgoSemaforo } from "@/types/fin-riesgo";

type Props = {
  clienteId: string;
  riesgo: FinClienteRiesgoPayload | null;
  consultandoNosis: boolean;
  onConsultarNosis: () => Promise<void>;
};

const TIER_STYLES: Record<EvaluacionTier, string> = {
  A: "bg-green-100 text-green-800 border-green-200",
  B: "bg-blue-100 text-blue-800 border-blue-200",
  C: "bg-yellow-100 text-yellow-800 border-yellow-200",
  reprobado: "bg-red-100 text-red-800 border-red-200",
};

const TIER_LABELS: Record<EvaluacionTier, string> = {
  A: "Tier A",
  B: "Tier B",
  C: "Tier C",
  reprobado: "Reprobado",
};

function ars(value?: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-AR");
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-AR");
}

function percent(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

function estadoClass(estado?: FinEvaluacion["estado"]) {
  if (estado === "aprobada") return "bg-green-100 text-green-800 border-green-200";
  if (estado === "rechazada") return "bg-red-100 text-red-800 border-red-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
}

function semaforoConfig(semaforo: FinRiesgoSemaforo) {
  if (semaforo === "rojo") {
    return {
      label: "Riesgo alto",
      dot: "bg-red-500",
      panel: "border-red-200 bg-red-50/80",
      badge: "border-red-200 bg-red-50 text-red-700",
      Icon: ShieldX,
    };
  }

  if (semaforo === "amarillo") {
    return {
      label: "Riesgo medio",
      dot: "bg-amber-400",
      panel: "border-amber-200 bg-amber-50/80",
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      Icon: ShieldAlert,
    };
  }

  return {
    label: "Riesgo controlado",
    dot: "bg-emerald-500",
    panel: "border-emerald-200 bg-emerald-50/80",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Icon: ShieldCheck,
  };
}

function resolveSemaforo(riesgo: FinClienteRiesgoPayload): FinRiesgoSemaforo {
  if (riesgo.nosis.ultimo?.juicios_activos || riesgo.nosis.ultimo?.cheques_rechazados) {
    return "rojo";
  }
  if (!riesgo.evaluacion.actual || riesgo.evaluacion.actual.estado !== "aprobada") {
    return "amarillo";
  }
  if ((riesgo.evaluacion.actual.score_final ?? 0) < 60) {
    return "amarillo";
  }
  return "verde";
}

function resolveTierClass(tier?: EvaluacionTier | null): string {
  return tier ? TIER_STYLES[tier] : "border-slate-200 bg-slate-100 text-slate-600";
}

function resolveTierLabel(tier?: EvaluacionTier | null): string {
  return tier ? TIER_LABELS[tier] : "Pendiente";
}

export function TabAnalisisRiesgo({
  clienteId,
  riesgo,
  consultandoNosis,
  onConsultarNosis,
}: Props) {
  if (!riesgo) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-slate-500">
          No se pudo cargar el resumen consolidado de riesgo.
        </CardContent>
      </Card>
    );
  }

  const evaluacion = riesgo.evaluacion.actual;
  const historial = riesgo.evaluacion.historial.slice(0, 4);
  const linea = riesgo.linea;
  const nosis = riesgo.nosis.ultimo;
  const tierSugerido = evaluacion?.tier_sugerido ?? evaluacion?.tier ?? null;
  const tierAsignado = riesgo.cliente.tier_crediticio ?? evaluacion?.tier_asignado ?? null;
  const limiteAsignado =
    riesgo.cliente.limite_credito_asignado ??
    riesgo.cliente.limite_credito_vigente ??
    evaluacion?.limite_credito_asignado ??
    linea?.limite_total ??
    null;
  const porcentajeUsado =
    linea?.limite_total && linea.limite_total > 0
      ? (linea.consumo_actual / linea.limite_total) * 100
      : null;
  const semaforo = semaforoConfig(resolveSemaforo(riesgo));
  const SemaforoIcon = semaforo.Icon;

  const alertas: Array<{
    codigo: string;
    nivel: "warning" | "critical";
    titulo: string;
    detalle: string;
  }> = [];
  if (!evaluacion) {
    alertas.push({
      codigo: "sin_evaluacion_vigente",
      nivel: "warning",
      titulo: "Sin evaluacion vigente",
      detalle: "No hay una evaluacion crediticia vigente para respaldar nueva exposicion.",
    });
  } else if (evaluacion.estado !== "aprobada") {
    alertas.push({
      codigo: "evaluacion_no_aprobada",
      nivel: "warning",
      titulo: "Evaluacion no aprobada",
      detalle: `La ultima evaluacion se encuentra en estado ${evaluacion.estado}.`,
    });
  }

  if ((nosis?.cheques_rechazados ?? 0) > 0) {
    alertas.push({
      codigo: "nosis_cheques_rechazados",
      nivel: "critical",
      titulo: "Cheques rechazados",
      detalle: `Nosis informa ${nosis?.cheques_rechazados} cheque(s) rechazados.`,
    });
  }

  if ((nosis?.juicios_activos ?? 0) > 0) {
    alertas.push({
      codigo: "nosis_juicios_activos",
      nivel: "critical",
      titulo: "Juicios activos",
      detalle: `Nosis informa ${nosis?.juicios_activos} juicio(s) activo(s).`,
    });
  }

  if (
    linea?.disponible_total_actual !== null &&
    linea?.disponible_total_actual !== undefined &&
    linea.disponible_total_actual <= 0
  ) {
    alertas.push({
      codigo: "linea_agotada",
      nivel: "warning",
      titulo: "Linea agotada",
      detalle: "La linea actual no tiene disponible total remanente.",
    });
  }

  const recomendaciones: Array<{
    codigo: string;
    prioridad: "baja" | "media" | "alta";
    detalle: string;
  }> =
    alertas.length > 0
      ? [
          {
            codigo: "revision_manual",
            prioridad: alertas.some((item) => item.nivel === "critical") ? "alta" : "media",
            detalle:
              alertas.some((item) => item.nivel === "critical")
                ? "Escalar a analisis manual antes de otorgar nuevo cupo."
                : "Actualizar evaluacion y validar consistencia con linea y Nosis.",
          },
        ]
      : [
          {
            codigo: "seguimiento_regular",
            prioridad: "baja",
            detalle: "Mantener monitoreo regular de evaluacion, linea y comportamiento externo.",
          },
        ];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              Analisis de riesgo
            </CardTitle>
            <div className={cn("inline-flex items-center gap-3 rounded-2xl border px-4 py-3", semaforo.panel)}>
              <span className={cn("h-3 w-3 rounded-full", semaforo.dot)} />
              <SemaforoIcon className="h-4 w-4" />
              <div>
                <div className="text-sm font-semibold text-slate-900">{semaforo.label}</div>
                <div className="text-xs text-slate-600">
                  Vista consolidada de evaluacion, linea y Nosis.
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/clientes/${clienteId}/evaluacion`}>
              <Button size="sm">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Nueva evaluacion
              </Button>
            </Link>
            <Link href={`/clientes/${clienteId}/evaluacion/historial`}>
              <Button variant="outline" size="sm">
                <History className="mr-2 h-4 w-4" />
                Historial
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onConsultarNosis()}
              disabled={consultandoNosis}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", consultandoNosis && "animate-spin")} />
              {consultandoNosis ? "Consultando..." : "Consultar Nosis"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Semaforo</div>
              <div className="mt-2">
                <Badge className={semaforo.badge}>{semaforo.label}</Badge>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Score final</div>
              <div className="mt-1 text-3xl font-semibold text-slate-900">
                {evaluacion ? evaluacion.score_final.toFixed(2) : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Score Nosis</div>
              <div className="mt-1 text-3xl font-semibold text-slate-900">
                {evaluacion?.score_nosis ?? nosis?.score ?? "—"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Estado</div>
              <div className="mt-2">
                <Badge className={estadoClass(evaluacion?.estado)}>
                  {evaluacion?.estado ?? "Sin evaluacion"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Tier sugerido</div>
              <div className="mt-2">
                <Badge className={resolveTierClass(tierSugerido)}>{resolveTierLabel(tierSugerido)}</Badge>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Tier asignado</div>
              <div className="mt-2">
                <Badge className={resolveTierClass(tierAsignado)}>{resolveTierLabel(tierAsignado)}</Badge>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Limite asignado</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{ars(limiteAsignado)}</div>
              <div className="mt-1 text-xs text-slate-500">
                Vigencia {formatDate(riesgo.cliente.evaluacion_vigente_hasta ?? linea?.vigencia.hasta)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Porcentaje usado</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{percent(porcentajeUsado)}</div>
              <div className="mt-1 text-xs text-slate-500">
                Consumido {ars(linea?.consumo_actual ?? riesgo.cliente.saldo_total_adeudado)}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Maximo atraso</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {alertas.some((item) => item.codigo === "linea_agotada")
                  ? "Linea agotada"
                  : alertas.some((item) => item.nivel === "critical")
                    ? "Revision inmediata"
                    : "Sin atraso informado"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Cuotas vencidas impagas</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {alertas.some((item) => item.nivel === "critical")
                  ? "Revisar cartera"
                  : "Sin dato consolidado"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Cheques rechazados</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{nosis?.cheques_rechazados ?? 0}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Juicios activos</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{nosis?.juicios_activos ?? 0}</div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 text-sm font-medium text-slate-900">Alertas</div>
              <div className="space-y-3">
                {alertas.map((alerta) => (
                  <div
                    key={alerta.codigo}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-sm",
                      alerta.nivel === "critical"
                        ? "border-red-200 bg-red-50 text-red-900"
                        : "border-amber-200 bg-amber-50 text-amber-900"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <div className="font-semibold">{alerta.titulo}</div>
                        <div className="mt-1">{alerta.detalle}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 text-sm font-medium text-slate-900">Recomendaciones</div>
              <div className="space-y-3">
                {recomendaciones.map((item) => (
                  <div
                    key={item.codigo}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-sm",
                      item.prioridad === "alta"
                        ? "border-red-200 bg-white"
                        : item.prioridad === "media"
                          ? "border-amber-200 bg-white"
                          : "border-slate-200 bg-white"
                    )}
                  >
                    <div className="font-semibold text-slate-900">Prioridad {item.prioridad}</div>
                    <div className="mt-1 text-slate-600">{item.detalle}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-slate-900">Resumen del historial</div>
              <div className="text-xs text-slate-500">
                {riesgo.evaluacion.historial.length} evaluacion{riesgo.evaluacion.historial.length === 1 ? "" : "es"}
              </div>
            </div>
            {historial.length > 0 ? (
              <div className="space-y-3">
                {historial.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 text-sm md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{formatDate(item.fecha)}</div>
                      <div className="text-slate-500">
                        Score {item.score_final.toFixed(0)} · {resolveTierLabel(item.tier_sugerido ?? item.tier)}
                      </div>
                    </div>
                    <Badge className={estadoClass(item.estado)}>{item.estado}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Sin evaluaciones registradas.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linea y Nosis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-900">Ultima consulta Nosis</div>
            <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ["Score", nosis?.score ?? "N/D"],
                ["Situacion BCRA", nosis?.situacion_bcra ?? "N/D"],
                ["Cheques rechazados", nosis?.cheques_rechazados ?? 0],
                ["Juicios activos", nosis?.juicios_activos ?? 0],
                ["Fecha consulta", formatDateTime(nosis?.fecha)],
                ["Consultado por", nosis?.consultado_por ?? "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="text-sm font-medium text-slate-900">Linea consolidada</div>
            <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ["Limite total", ars(linea?.limite_total)],
                ["Limite mensual", ars(linea?.limite_mensual)],
                ["Disponible total", ars(linea?.disponible_total_actual)],
                ["Disponible mensual", ars(linea?.disponible_mensual_actual)],
                ["Consumo actual", ars(linea?.consumo_actual)],
                ["Estado", linea?.vigencia.estado ?? "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="text-sm font-medium text-slate-900">Consultas recientes</div>
            {riesgo.nosis.historial.length > 0 ? (
              <div className="space-y-3">
                {riesgo.nosis.historial.slice(0, 4).map((consulta) => (
                  <div key={consulta.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900">
                          {formatDateTime(consulta.fecha_consulta)}
                        </div>
                        <div className="text-slate-500">
                          Score {consulta.score ?? "—"} · BCRA {consulta.situacion_bcra ?? "—"}
                        </div>
                      </div>
                      <Badge
                        className={
                          consulta.estado === "exitoso"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-red-100 text-red-800 border-red-200"
                        }
                      >
                        {consulta.estado}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Sin consultas Nosis registradas.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
