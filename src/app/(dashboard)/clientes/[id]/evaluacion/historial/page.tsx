"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvaluacionTier, FinEvaluacion } from "@/types/fin-evaluacion";

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
  A: "Tier A",
  B: "Tier B",
  C: "Tier C",
  reprobado: "Reprobado",
};

function round2(n: number): string {
  return n.toFixed(2);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HistorialEvaluacionesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clienteId = params.id;

  const [evaluaciones, setEvaluaciones] = useState<FinEvaluacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clienteId) return;
    apiFetch(`/api/fin/clientes/${clienteId}/evaluacion`)
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar evaluaciones");
        return res.json() as Promise<{ evaluaciones: FinEvaluacion[] }>;
      })
      .then((data) => setEvaluaciones(data.evaluaciones))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Error desconocido")
      )
      .finally(() => setLoading(false));
  }, [clienteId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Historial de evaluaciones</h2>
          <p className="text-sm text-slate-500">
            {evaluaciones.length === 0
              ? "Sin evaluaciones registradas"
              : `${evaluaciones.length} evaluación${evaluaciones.length !== 1 ? "es" : ""} registrada${evaluaciones.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="ml-auto">
          <Link href={`/clientes/${clienteId}/evaluacion`}>
            <Button size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nueva evaluación
            </Button>
          </Link>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabla / Lista */}
      {evaluaciones.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-400">No hay evaluaciones crediticias para este cliente.</p>
            <Link href={`/clientes/${clienteId}/evaluacion`} className="mt-4 inline-block">
              <Button variant="outline" size="sm">
                <PlusCircle className="mr-2 h-4 w-4" />
                Crear primera evaluación
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evaluaciones</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Fecha</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-500">Tier</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-500">Score final</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-500">Cualitativos</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-500">Conflictos</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-500">Cuantitativos</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-500">Nosis</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluaciones.map((ev) => (
                    <tr
                      key={ev.id}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-slate-700">{ev.fecha}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={`text-xs ${TIER_STYLES[ev.tier]}`}>
                          {TIER_LABELS[ev.tier]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-slate-900">
                        {round2(ev.score_final)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-600">
                        {round2(ev.score_cualitativo)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-600">
                        {round2(ev.score_conflictos)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-600">
                        {round2(ev.score_cuantitativo)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {ev.nosis_consultado ? (
                          <Badge variant="outline" className="text-xs text-green-700 border-green-200">
                            Si
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-slate-400">
                            No
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-slate-500">
                        {ev.observaciones ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botón volver al cliente */}
      <div className="flex justify-start">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/clientes/${clienteId}`)}>
          Volver al cliente
        </Button>
      </div>
    </div>
  );
}
