"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  History,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SCORING_ITEMS_CATALOG, calcularScore } from "@/lib/scoring/utils";
import type { FinCliente, FinClienteNosisConsulta } from "@/types/fin-cliente";
import type {
  EvaluacionTier,
  FinEvaluacion,
  FinEvaluacionUpsertResult,
  ScoringItem,
} from "@/types/fin-evaluacion";

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

type PuntajeMap = Record<string, string>;

function round2(n: number): string {
  return n.toFixed(2);
}

function ars(value?: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calculateLimit(tier: EvaluacionTier): number | null {
  if (tier === "A") return 5_000_000;
  if (tier === "B") return 2_000_000;
  if (tier === "C") return 500_000;
  return null;
}

function statusBadgeClass(status?: FinEvaluacion["estado"]) {
  if (status === "aprobada") return "bg-green-100 text-green-800 border-green-200";
  if (status === "rechazada") return "bg-red-100 text-red-800 border-red-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
}

export default function EvaluacionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clienteId = params.id;

  const [cliente, setCliente] = useState<FinCliente | null>(null);
  const [evaluaciones, setEvaluaciones] = useState<FinEvaluacion[]>([]);
  const [nosisConsultas, setNosisConsultas] = useState<FinClienteNosisConsulta[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<FinEvaluacion | null>(null);

  const [puntajes, setPuntajes] = useState<PuntajeMap>(() => {
    const initial: PuntajeMap = {};
    for (const item of SCORING_ITEMS_CATALOG) {
      initial[item.id] = "";
    }
    return initial;
  });
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [nosisConsultado, setNosisConsultado] = useState(false);
  const [observaciones, setObservaciones] = useState("");

  const loadData = useCallback(async () => {
    if (!clienteId) return;

    setLoading(true);
    setError(null);
    try {
      const [clienteRes, evaluacionesRes, nosisRes] = await Promise.all([
        apiFetch(`/api/fin/clientes/${clienteId}`),
        apiFetch(`/api/fin/clientes/${clienteId}/evaluacion`),
        apiFetch(`/api/fin/clientes/${clienteId}/nosis`),
      ]);

      if (!clienteRes.ok) throw new Error("No se pudo cargar el cliente");
      if (!evaluacionesRes.ok) throw new Error("No se pudo cargar la evaluación");
      if (!nosisRes.ok) throw new Error("No se pudo cargar el historial Nosis");

      const clienteData = (await clienteRes.json()) as { cliente: FinCliente };
      const evaluacionesData = (await evaluacionesRes.json()) as { evaluaciones: FinEvaluacion[] };
      const nosisData = (await nosisRes.json()) as {
        data?: {
          historial?: FinClienteNosisConsulta[];
        };
      };

      setCliente(clienteData.cliente);
      setEvaluaciones(evaluacionesData.evaluaciones ?? []);
      setNosisConsultas(nosisData.data?.historial ?? []);
      setNosisConsultado(Boolean(clienteData.cliente.nosis_ultimo));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const preview = useMemo(() => {
    const items: ScoringItem[] = SCORING_ITEMS_CATALOG.map((cat) => ({
      ...cat,
      puntaje: puntajes[cat.id] !== "" ? Number(puntajes[cat.id]) : null,
      nota: notas[cat.id] || undefined,
    }));
    const completeCount = items.filter((item) => item.puntaje !== null).length;
    if (completeCount === 0) return null;
    return calcularScore(items);
  }, [notas, puntajes]);

  const ultimaEvaluacion = evaluaciones[0] ?? null;
  const evaluacionVigente =
    evaluaciones.find((evaluacion) => evaluacion.es_vigente) ?? ultimaEvaluacion;
  const ultimaConsultaNosis = nosisConsultas[0] ?? null;

  const handlePuntaje = (id: string, value: string) => {
    const num = Number(value);
    if (value !== "" && (Number.isNaN(num) || num < 1 || num > 10)) return;
    setPuntajes((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async () => {
    const incompletos = SCORING_ITEMS_CATALOG.filter((item) => !puntajes[item.id]);
    if (incompletos.length > 0) {
      setError(`Faltan puntajes en: ${incompletos.map((item) => item.nombre).join(", ")}`);
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const latestNosisScore = cliente?.nosis_ultimo?.score ?? ultimaConsultaNosis?.score ?? null;
      const latestNosisPayload = ultimaConsultaNosis
        ? {
            fecha_consulta: ultimaConsultaNosis.fecha_consulta,
            score: ultimaConsultaNosis.score,
            situacion_bcra: ultimaConsultaNosis.situacion_bcra,
            cheques_rechazados: ultimaConsultaNosis.cheques_rechazados,
            juicios_activos: ultimaConsultaNosis.juicios_activos,
            estado: ultimaConsultaNosis.estado,
            error_mensaje: ultimaConsultaNosis.error_mensaje,
          }
        : undefined;

      const body = {
        items: SCORING_ITEMS_CATALOG.map((item) => ({
          id: item.id,
          puntaje: Number(puntajes[item.id]),
          nota: notas[item.id] || undefined,
        })),
        nosis_consultado: nosisConsultado,
        score_nosis: latestNosisScore,
        nosis_resultado: latestNosisPayload,
        observaciones: observaciones || undefined,
      };

      const res = await apiFetch(`/api/fin/clientes/${clienteId}/evaluacion`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Error al guardar evaluación");
      }

      const data = (await res.json()) as FinEvaluacionUpsertResult;
      setResultado(data.evaluacion);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Evaluación crediticia</h2>
          <p className="text-sm text-slate-500">
            Resumen vigente, Nosis y nueva evaluación para el cliente.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href={`/clientes/${clienteId}`}>
            <Button variant="outline" size="sm">Volver al cliente</Button>
          </Link>
          <Link href={`/clientes/${clienteId}/evaluacion/historial`}>
            <Button variant="outline" size="sm">
              <History className="mr-2 h-4 w-4" />
              Ver historial
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              Resumen vigente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Score calculado</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">
                  {evaluacionVigente ? round2(evaluacionVigente.score_final) : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Score Nosis</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">
                  {cliente?.nosis_ultimo?.score ?? ultimaConsultaNosis?.score ?? "—"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Tier sugerido</div>
                <div className="mt-2">
                  {evaluacionVigente ? (
                    <Badge className={TIER_STYLES[evaluacionVigente.tier_sugerido ?? evaluacionVigente.tier]}>
                      {TIER_LABELS[evaluacionVigente.tier_sugerido ?? evaluacionVigente.tier]}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Tier asignado</div>
                <div className="mt-2">
                  {cliente?.tier_crediticio || evaluacionVigente?.tier_asignado ? (
                    <Badge className={TIER_STYLES[(cliente?.tier_crediticio ?? evaluacionVigente?.tier_asignado)!]}>
                      {TIER_LABELS[(cliente?.tier_crediticio ?? evaluacionVigente?.tier_asignado)!]}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm text-slate-500">Límite sugerido</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {ars(
                    evaluacionVigente?.limite_sugerido ??
                      evaluacionVigente?.limite_credito_sugerido ??
                      (evaluacionVigente ? calculateLimit(evaluacionVigente.tier) : null)
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm text-slate-500">Límite asignado</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {ars(cliente?.limite_credito_asignado ?? cliente?.limite_credito_vigente ?? evaluacionVigente?.limite_credito_asignado)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm text-slate-500">Estado</div>
                <div className="mt-2">
                  <Badge className={statusBadgeClass(evaluacionVigente?.estado)}>
                    {evaluacionVigente?.estado ?? "sin evaluación"}
                  </Badge>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm text-slate-500">Vigencia</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {formatDate(cliente?.evaluacion_vigente_hasta ?? evaluacionVigente?.updated_at)}
                </div>
              </div>
            </div>

            {evaluacionVigente ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Cualitativos</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {round2(evaluacionVigente.score_cualitativo)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Conflictos</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {round2(evaluacionVigente.score_conflictos)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Cuantitativos</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {round2(evaluacionVigente.score_cuantitativo)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                No hay una evaluación vigente todavía. Podés registrar una nueva abajo.
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {evaluacionVigente?.estado === "borrador" ? (
                "El backend actual solo expone alta e historial de evaluaciones. La aprobación o rechazo se mostrará cuando exista una acción específica de backend."
              ) : (
                "La decisión visible proviene de la última evaluación almacenada y de la asignación vigente del cliente."
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nosis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Último score</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {cliente?.nosis_ultimo?.score ?? ultimaConsultaNosis?.score ?? "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Situación BCRA</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {cliente?.nosis_ultimo?.situacion_bcra ?? ultimaConsultaNosis?.situacion_bcra ?? "—"}
                  </div>
                </div>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Cheques rechazados</dt>
                  <dd className="font-medium text-slate-900">
                    {cliente?.nosis_ultimo?.cheques_rechazados ?? ultimaConsultaNosis?.cheques_rechazados ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Juicios activos</dt>
                  <dd className="font-medium text-slate-900">
                    {cliente?.nosis_ultimo?.juicios_activos ?? ultimaConsultaNosis?.juicios_activos ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Última consulta</dt>
                  <dd className="font-medium text-slate-900">
                    {formatDate(cliente?.nosis_ultimo?.fecha ?? ultimaConsultaNosis?.fecha_consulta)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Estado último intento</dt>
                  <dd className="font-medium text-slate-900">
                    {ultimaConsultaNosis?.estado ?? (cliente?.nosis_ultimo ? "exitoso" : "sin consulta")}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Historial reciente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {evaluaciones.slice(0, 3).map((evaluacion) => (
                <div key={evaluacion.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{formatDate(evaluacion.created_at)}</div>
                      <div className="text-sm text-slate-500">
                        Score {round2(evaluacion.score_final)} · Nosis {evaluacion.score_nosis ?? "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={TIER_STYLES[evaluacion.tier_sugerido ?? evaluacion.tier]}>
                        {TIER_LABELS[evaluacion.tier_sugerido ?? evaluacion.tier]}
                      </Badge>
                      <Badge className={statusBadgeClass(evaluacion.estado)}>{evaluacion.estado}</Badge>
                    </div>
                  </div>
                </div>
              ))}
              {nosisConsultas.slice(0, 3).map((consulta) => (
                <div key={consulta.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{formatDate(consulta.fecha_consulta)}</div>
                      <div className="text-sm text-slate-500">
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
                      Nosis {consulta.estado}
                    </Badge>
                  </div>
                </div>
              ))}
              {evaluaciones.length === 0 && nosisConsultas.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Todavía no hay evaluaciones ni consultas Nosis registradas.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {preview && (
        <Card className="border-2 border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Score estimado en tiempo real</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <div className="text-xs text-slate-400">Cualitativos</div>
                <div className="text-lg font-semibold">{round2(preview.score_cualitativo)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Conflictos</div>
                <div className="text-lg font-semibold">{round2(preview.score_conflictos)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Cuantitativos</div>
                <div className="text-lg font-semibold">{round2(preview.score_cuantitativo)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Score final</div>
                <div className="text-2xl font-bold text-slate-900">{round2(preview.score_final)}</div>
              </div>
              <Badge className={TIER_STYLES[preview.tier]}>{TIER_LABELS[preview.tier]}</Badge>
              <div>
                <div className="text-xs text-slate-400">Límite sugerido</div>
                <div className="text-lg font-semibold text-slate-900">{ars(calculateLimit(preview.tier))}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {[
            { key: "cualitativo", label: "Aspectos cualitativos (43%)" },
            { key: "conflictos", label: "Conflictos e incumplimientos (31%)" },
            { key: "cuantitativo", label: "Aspectos cuantitativos (26%)" },
          ].map((categoria) => {
            const items = SCORING_ITEMS_CATALOG.filter((item) => item.categoria === categoria.key);

            return (
              <Card key={categoria.key}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{categoria.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr]"
                    >
                      <label
                        htmlFor={`puntaje-${item.id}`}
                        className="flex items-center text-sm font-medium text-slate-700"
                      >
                        {item.nombre}
                      </label>
                      <input
                        id={`puntaje-${item.id}`}
                        type="number"
                        min={1}
                        max={10}
                        step={1}
                        value={puntajes[item.id] ?? ""}
                        onChange={(e) => handlePuntaje(item.id, e.target.value)}
                        className="w-24 rounded-md border border-slate-300 px-3 py-1.5 text-center text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="1-10"
                      />
                      <input
                        type="text"
                        value={notas[item.id] ?? ""}
                        onChange={(e) =>
                          setNotas((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Nota opcional"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Información adicional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={nosisConsultado}
                  onChange={(e) => setNosisConsultado(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Consulté Nosis antes de esta evaluación
              </label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="font-medium text-slate-900">Último score Nosis disponible</div>
                <div className="mt-1 text-xl font-semibold">
                  {cliente?.nosis_ultimo?.score ?? ultimaConsultaNosis?.score ?? "—"}
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="observaciones" className="text-sm font-medium text-slate-700">
                  Observaciones
                </label>
                <textarea
                  id="observaciones"
                  rows={6}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Comentarios adicionales sobre la evaluación..."
                />
              </div>
            </CardContent>
          </Card>

          {resultado && (
            <Card className="border-2 border-green-200 bg-green-50/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-green-900">
                  <CheckCircle2 className="h-4 w-4" />
                  Evaluación guardada correctamente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className={TIER_STYLES[resultado.tier_sugerido ?? resultado.tier]}>
                    {TIER_LABELS[resultado.tier_sugerido ?? resultado.tier]}
                  </Badge>
                  <Badge className={statusBadgeClass(resultado.estado)}>{resultado.estado}</Badge>
                </div>
                <div className="text-sm text-slate-700">
                  Score final {round2(resultado.score_final)} · Límite sugerido{" "}
                  {ars(resultado.limite_sugerido ?? resultado.limite_credito_sugerido)}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-dashed">
            <CardContent className="py-6">
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                <p>
                  Si el backend incorpora endpoints de aprobación o rechazo, esta vista ya
                  tiene espacio para mostrar la decisión vigente y el límite asignado.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={guardando}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              {guardando ? "Guardando..." : "Guardar evaluación"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
