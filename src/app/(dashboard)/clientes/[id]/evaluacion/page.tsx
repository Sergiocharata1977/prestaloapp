"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Save } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ScoringCategoria } from "@/types/fin-evaluacion";

type CatalogItem = { id: string; categoria: ScoringCategoria; nombre: string };

const CATALOG: CatalogItem[] = [
  { id: "gestion_empresa",       categoria: "cualitativo",  nombre: "Gestion general de la empresa" },
  { id: "condiciones_mercado",   categoria: "cualitativo",  nombre: "Condiciones del mercado/sector" },
  { id: "organizacion_interna",  categoria: "cualitativo",  nombre: "Organizacion interna" },
  { id: "situacion_cheques",     categoria: "cualitativo",  nombre: "Situacion de cheques" },
  { id: "terminos_pago",         categoria: "cualitativo",  nombre: "Terminos de pago con proveedores" },
  { id: "crecimiento_ventas",    categoria: "cualitativo",  nombre: "Crecimiento de ventas" },
  { id: "fidelizacion",          categoria: "cualitativo",  nombre: "Historia y fidelizacion" },
  { id: "concursos_quiebras",    categoria: "conflictos",   nombre: "Concursos o quiebras pasadas" },
  { id: "situacion_fiscal",      categoria: "conflictos",   nombre: "Situacion fiscal/impositiva" },
  { id: "cheques_rechazados",    categoria: "conflictos",   nombre: "Cheques rechazados en el sistema" },
  { id: "situacion_economica",   categoria: "cuantitativo", nombre: "Situacion economica general" },
  { id: "situacion_financiera",  categoria: "cuantitativo", nombre: "Ratios financieros" },
  { id: "volumenes_negocio",     categoria: "cuantitativo", nombre: "Volumenes de negocio" },
  { id: "situacion_patrimonial", categoria: "cuantitativo", nombre: "Patrimonio neto y garantias" },
];

const PESOS: Record<ScoringCategoria, number> = { cualitativo: 0.43, conflictos: 0.31, cuantitativo: 0.26 };

const TIERS = [
  { min: 8, label: "Tier A",    color: "bg-green-100 text-green-800 border-green-200" },
  { min: 6, label: "Tier B",    color: "bg-blue-100 text-blue-800 border-blue-200" },
  { min: 4, label: "Tier C",    color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { min: 0, label: "Reprobado", color: "bg-red-100 text-red-800 border-red-200" },
];

const CATEGORIA_LABELS: Record<ScoringCategoria, string> = {
  cualitativo:  "Factores cualitativos (43%)",
  conflictos:   "Conflictos e historial (31%)",
  cuantitativo: "Factores cuantitativos (26%)",
};

type ItemScore = { puntaje: number | null; nota: string };
type ScoreMap  = Record<string, ItemScore>;

function calcScore(s: ScoreMap) {
  const by: Record<ScoringCategoria, number[]> = { cualitativo: [], conflictos: [], cuantitativo: [] };
  let completo = true;
  for (const item of CATALOG) {
    const p = s[item.id]?.puntaje;
    if (p === null || p === undefined) { completo = false; continue; }
    by[item.categoria].push(p);
  }
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const cualitativo  = avg(by.cualitativo);
  const conflictos   = avg(by.conflictos);
  const cuantitativo = avg(by.cuantitativo);
  const final = cualitativo * PESOS.cualitativo + conflictos * PESOS.conflictos + cuantitativo * PESOS.cuantitativo;
  const tier  = TIERS.find((t) => final >= t.min) ?? TIERS[TIERS.length - 1];
  return { cualitativo, conflictos, cuantitativo, final, tier, completo };
}

const CATEGORIAS: ScoringCategoria[] = ["cualitativo", "conflictos", "cuantitativo"];

export default function NuevaEvaluacionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clienteId = params.id;

  const [scores, setScores] = useState<ScoreMap>(() => {
    const init: ScoreMap = {};
    for (const item of CATALOG) init[item.id] = { puntaje: null, nota: "" };
    return init;
  });
  const [nosisScore,    setNosisScore]    = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const result = calcScore(scores);

  const setPuntaje = (id: string, val: number | null) =>
    setScores((prev) => ({ ...prev, [id]: { ...prev[id], puntaje: val } }));

  const setNota = (id: string, nota: string) =>
    setScores((prev) => ({ ...prev, [id]: { ...prev[id], nota } }));

  const handleSubmit = async () => {
    setError(null);
    if (!result.completo) { setError("Completar todos los items antes de guardar."); return; }
    setSaving(true);
    try {
      const items = CATALOG.map((item) => ({
        id: item.id,
        puntaje: scores[item.id].puntaje as number,
        nota: scores[item.id].nota || undefined,
      }));
      const nosisNum = nosisScore ? parseFloat(nosisScore) : undefined;
      const res = await apiFetch(`/api/fin/clientes/${clienteId}/evaluacion`, {
        method: "POST",
        body: JSON.stringify({
          items,
          nosis_consultado: !!nosisNum,
          score_nosis: nosisNum ?? null,
          observaciones: observaciones || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "Error al guardar");
      }
      router.push(`/clientes/${clienteId}/evaluacion/historial`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/clientes/${clienteId}/evaluacion/historial`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Nueva evaluacion crediticia</h2>
          <p className="text-sm text-slate-500">Puntuar del 1 al 10 cada item</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        {/* Items */}
        <div className="space-y-6">
          {CATEGORIAS.map((cat) => (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{CATEGORIA_LABELS[cat]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {CATALOG.filter((i) => i.categoria === cat).map((item) => {
                  const curr = scores[item.id];
                  return (
                    <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="font-medium text-slate-900">{item.nombre}</div>
                          <div className="flex flex-wrap gap-1">
                            {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setPuntaje(item.id, n)}
                                className={`h-8 w-8 rounded-lg border text-sm font-medium transition-colors ${
                                  curr.puntaje === n
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setPuntaje(item.id, null)}
                              className={`h-8 rounded-lg border px-2 text-xs transition-colors ${
                                curr.puntaje === null
                                  ? "border-amber-500 bg-amber-50 text-amber-700"
                                  : "border-slate-200 text-slate-400 hover:bg-slate-50"
                              }`}
                            >
                              S/D
                            </button>
                          </div>
                        </div>
                        <div className="sm:w-44">
                          <Label className="text-xs text-slate-400">Nota</Label>
                          <Textarea
                            rows={2}
                            value={curr.nota}
                            onChange={(e) => setNota(item.id, e.target.value)}
                            placeholder="Opcional..."
                            className="mt-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Datos adicionales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nosis">Score Nosis (dejar vacio si no se consulto)</Label>
                <Input
                  id="nosis"
                  type="number"
                  min={0}
                  max={1000}
                  value={nosisScore}
                  onChange={(e) => setNosisScore(e.target.value)}
                  placeholder="Ej: 750"
                  className="max-w-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="obs">Observaciones</Label>
                <Textarea
                  id="obs"
                  rows={3}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Contexto adicional, alertas o notas del analista..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Score en vivo */}
        <div className="sticky top-6 space-y-4 self-start">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Score en vivo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {CATEGORIAS.map((cat) => {
                const val = cat === "cualitativo" ? result.cualitativo
                  : cat === "conflictos" ? result.conflictos
                  : result.cuantitativo;
                return (
                  <div key={cat} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
                    <span className="capitalize text-slate-500">{cat}</span>
                    <span className="font-mono font-semibold">{val.toFixed(2)}</span>
                  </div>
                );
              })}

              <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                <div className="text-xs uppercase tracking-wide text-slate-400">Score final</div>
                <div className="mt-1 text-4xl font-bold">{result.final.toFixed(2)}</div>
              </div>

              <div className="text-center">
                <Badge className={result.tier.color}>{result.tier.label}</Badge>
              </div>

              {result.completo ? (
                <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  Todos los items completados
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Faltan items por puntuar
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={saving || !result.completo}
              >
                {saving
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Save className="mr-2 h-4 w-4" />}
                {saving ? "Guardando..." : "Guardar evaluacion"}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/clientes/${clienteId}/evaluacion/historial`)}
              >
                Ver historial
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs uppercase tracking-wide text-slate-400">
                Escala de tiers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {TIERS.map((t) => (
                <div key={t.label} className="flex items-center justify-between rounded-lg px-2 py-1 text-xs">
                  <Badge className={t.color}>{t.label}</Badge>
                  <span className="font-mono text-slate-500">{"\u2265"} {t.min}.0</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
