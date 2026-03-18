"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SCORING_ITEMS_CATALOG, calcularScore } from "@/lib/scoring/utils";
import type { EvaluacionTier, ScoringItem } from "@/types/fin-evaluacion";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIER_STYLES: Record<EvaluacionTier, string> = {
  A: "bg-green-100 text-green-800 border-green-200",
  B: "bg-blue-100 text-blue-800 border-blue-200",
  C: "bg-yellow-100 text-yellow-800 border-yellow-200",
  reprobado: "bg-red-100 text-red-800 border-red-200",
};

const TIER_LABELS: Record<EvaluacionTier, string> = {
  A: "Tier A — Excelente",
  B: "Tier B — Bueno",
  C: "Tier C — Aceptable",
  reprobado: "Reprobado",
};

function round2(n: number): string {
  return n.toFixed(2);
}

function calcularLimite(tier: EvaluacionTier): number | null {
  const limites: Record<EvaluacionTier, number | null> = {
    A: 5_000_000,
    B: 2_000_000,
    C: 500_000,
    reprobado: null,
  };
  return limites[tier];
}

function ars(n: number): string {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type PuntajeMap = Record<string, string>; // string for input value

export default function EvaluacionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clienteId = params.id;

  const [puntajes, setPuntajes] = useState<PuntajeMap>(() => {
    const initial: PuntajeMap = {};
    SCORING_ITEMS_CATALOG.forEach((item) => {
      initial[item.id] = "";
    });
    return initial;
  });

  const [notas, setNotas] = useState<Record<string, string>>({});
  const [nosisConsultado, setNosisConsultado] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{
    id: string;
    tier: EvaluacionTier;
    score_final: number;
    score_cualitativo: number;
    score_conflictos: number;
    score_cuantitativo: number;
    limite: number | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Preview en tiempo real
  const [preview, setPreview] = useState<{
    score_cualitativo: number;
    score_conflictos: number;
    score_cuantitativo: number;
    score_final: number;
    tier: EvaluacionTier;
  } | null>(null);

  const recalcularPreview = useCallback(() => {
    const items: ScoringItem[] = SCORING_ITEMS_CATALOG.map((cat) => ({
      ...cat,
      puntaje: puntajes[cat.id] !== "" ? Number(puntajes[cat.id]) : null,
    }));

    const haySuficientes = items.some((i) => i.puntaje !== null);
    if (!haySuficientes) {
      setPreview(null);
      return;
    }

    const result = calcularScore(items);
    setPreview(result);
  }, [puntajes]);

  useEffect(() => {
    recalcularPreview();
  }, [recalcularPreview]);

  const handlePuntaje = (id: string, value: string) => {
    // Validar rango 1-10
    const num = Number(value);
    if (value !== "" && (isNaN(num) || num < 1 || num > 10)) return;
    setPuntajes((prev) => ({ ...prev, [id]: value }));
  };

  const handleNota = (id: string, value: string) => {
    setNotas((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async () => {
    setError(null);

    // Verificar que todos los ítems tienen puntaje
    const incompletos = SCORING_ITEMS_CATALOG.filter(
      (item) => puntajes[item.id] === "" || puntajes[item.id] === undefined
    );
    if (incompletos.length > 0) {
      setError(`Faltan puntajes en: ${incompletos.map((i) => i.nombre).join(", ")}`);
      return;
    }

    setGuardando(true);
    try {
      const body = {
        items: SCORING_ITEMS_CATALOG.map((item) => ({
          id: item.id,
          puntaje: Number(puntajes[item.id]),
          nota: notas[item.id] || undefined,
        })),
        nosis_consultado: nosisConsultado,
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

      const data = (await res.json()) as {
        id: string;
        evaluacion: { tier: EvaluacionTier; score_final: number; score_cualitativo: number; score_conflictos: number; score_cuantitativo: number };
      };

      const ev = data.evaluacion;
      setResultado({
        id: data.id,
        tier: ev.tier,
        score_final: ev.score_final,
        score_cualitativo: ev.score_cualitativo,
        score_conflictos: ev.score_conflictos,
        score_cuantitativo: ev.score_cuantitativo,
        limite: calcularLimite(ev.tier),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGuardando(false);
    }
  };

  const categorias: { key: ScoringItem["categoria"]; label: string }[] = [
    { key: "cualitativo", label: "Aspectos Cualitativos (peso 43%)" },
    { key: "conflictos", label: "Conflictos e Incumplimientos (peso 31%)" },
    { key: "cuantitativo", label: "Aspectos Cuantitativos (peso 26%)" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Nueva evaluación crediticia</h2>
          <p className="text-sm text-slate-500">Completar los 14 ítems del scoring (escala 1–10)</p>
        </div>
        <div className="ml-auto">
          <Link href={`/clientes/${clienteId}/evaluacion/historial`}>
            <Button variant="outline" size="sm">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Ver historial
            </Button>
          </Link>
        </div>
      </div>

      {/* Preview score en tiempo real */}
      {preview && (
        <Card className="border-2 border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Score estimado (tiempo real)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="text-center">
                <div className="text-xs text-slate-400">Cualitativos</div>
                <div className="text-lg font-semibold">{round2(preview.score_cualitativo)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-400">Conflictos</div>
                <div className="text-lg font-semibold">{round2(preview.score_conflictos)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-400">Cuantitativos</div>
                <div className="text-lg font-semibold">{round2(preview.score_cuantitativo)}</div>
              </div>
              <div className="mx-2 h-10 w-px bg-slate-200" />
              <div className="text-center">
                <div className="text-xs text-slate-400">Score final</div>
                <div className="text-2xl font-bold">{round2(preview.score_final)}</div>
              </div>
              <Badge className={`text-sm px-3 py-1 ${TIER_STYLES[preview.tier]}`}>
                {TIER_LABELS[preview.tier]}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Secciones por categoría */}
      {categorias.map(({ key, label }) => {
        const items = SCORING_ITEMS_CATALOG.filter((i) => i.categoria === key);
        const puntajesCategoria = items
          .map((i) => (puntajes[i.id] !== "" ? Number(puntajes[i.id]) : null))
          .filter((p): p is number => p !== null);
        const promCat =
          puntajesCategoria.length > 0
            ? puntajesCategoria.reduce((a, b) => a + b, 0) / puntajesCategoria.length
            : null;

        return (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{label}</CardTitle>
              {promCat !== null && (
                <span className="text-sm font-semibold text-slate-600">
                  Promedio: {round2(promCat)}
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr]">
                  <div className="flex items-center">
                    <label
                      htmlFor={`puntaje-${item.id}`}
                      className="text-sm font-medium text-slate-700"
                    >
                      {item.nombre}
                    </label>
                  </div>
                  <div className="flex items-center justify-start sm:justify-center">
                    <input
                      id={`puntaje-${item.id}`}
                      type="number"
                      min={1}
                      max={10}
                      step={1}
                      value={puntajes[item.id] ?? ""}
                      onChange={(e) => handlePuntaje(item.id, e.target.value)}
                      className="w-20 rounded-md border border-slate-300 px-3 py-1.5 text-center text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="1-10"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={notas[item.id] ?? ""}
                      onChange={(e) => handleNota(item.id, e.target.value)}
                      className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Nota opcional..."
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Campos adicionales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Información adicional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              id="nosis-consultado"
              type="checkbox"
              checked={nosisConsultado}
              onChange={(e) => setNosisConsultado(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="nosis-consultado" className="text-sm font-medium text-slate-700">
              Consulté Nosis antes de esta evaluación
            </label>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="observaciones" className="text-sm font-medium text-slate-700">
              Observaciones
            </label>
            <textarea
              id="observaciones"
              rows={4}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Comentarios adicionales sobre la evaluación..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Errores */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Resultado guardado */}
      {resultado && (
        <Card className={`border-2 ${TIER_STYLES[resultado.tier]}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evaluacion guardada correctamente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="text-center">
                <div className="text-xs opacity-70">Score final</div>
                <div className="text-3xl font-bold">{round2(resultado.score_final)}</div>
              </div>
              <Badge className={`text-base px-4 py-2 ${TIER_STYLES[resultado.tier]}`}>
                {TIER_LABELS[resultado.tier]}
              </Badge>
              {resultado.limite !== null && (
                <div className="text-center">
                  <div className="text-xs opacity-70">Límite sugerido</div>
                  <div className="text-lg font-semibold">{ars(resultado.limite)}</div>
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-3">
              <Link href={`/clientes/${clienteId}/evaluacion/historial`}>
                <Button variant="outline" size="sm">
                  Ver historial completo
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/clientes/${clienteId}`)}
              >
                Volver al cliente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botón guardar */}
      {!resultado && (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar evaluación"}
          </Button>
        </div>
      )}
    </div>
  );
}
