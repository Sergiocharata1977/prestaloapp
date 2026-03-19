"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Settings } from "lucide-react";
import type { FinRubro, FinCuenta } from "@/types/fin-plan-cuentas";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const naturalezaLabel: Record<string, string> = {
  activo: "Activo",
  pasivo: "Pasivo",
  patrimonio_neto: "Patrimonio Neto",
  resultado_positivo: "Resultado +",
  resultado_negativo: "Resultado -",
};

const naturalezaColor: Record<string, string> = {
  activo:              "border-blue-200 bg-blue-50 text-blue-700",
  pasivo:              "border-red-200 bg-red-50 text-red-700",
  patrimonio_neto:     "border-purple-200 bg-purple-50 text-purple-700",
  resultado_positivo:  "border-green-200 bg-green-50 text-green-700",
  resultado_negativo:  "border-amber-200 bg-amber-50 text-amber-700",
};

type RubroConCuentas = FinRubro & { cuentas: FinCuenta[] };

export default function PlanCuentasPage() {
  const router = useRouter();
  const [rubros, setRubros] = useState<RubroConCuentas[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      apiFetch("/api/fin/plan-cuentas/rubros").then((r) => r.json()),
      apiFetch("/api/fin/plan-cuentas/cuentas").then((r) => r.json()),
    ]).then(([rubrosData, cuentasData]) => {
      const rs: FinRubro[] = (rubrosData as { rubros: FinRubro[] }).rubros ?? [];
      const cs: FinCuenta[] = (cuentasData as { cuentas: FinCuenta[] }).cuentas ?? [];
      setRubros(
        rs.map((r) => ({
          ...r,
          cuentas: cs.filter((c) => c.rubro_id === r.id),
        }))
      );
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedError(null);
    try {
      const res = await apiFetch("/api/fin/plan-cuentas/seed", { method: "POST" });
      const body = await res.json() as { ok?: boolean; rubros?: number; cuentas?: number; error?: string };
      if (!res.ok) {
        setSeedError(body.error ?? "Error al inicializar");
        return;
      }
      loadData();
    } catch {
      setSeedError("Error de conexión");
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Plan de Cuentas</h2>
          <p className="text-sm text-slate-500">Estructura contable del módulo financiero</p>
        </div>
        <div className="flex gap-2">
          {rubros.length === 0 && (
            <Button onClick={handleSeed} disabled={seeding} variant="default">
              <Database className="h-4 w-4" />
              {seeding ? "Inicializando..." : "Inicializar plan de cuentas"}
            </Button>
          )}
          <Button variant="outline" onClick={() => router.push("/plan-cuentas/configurar")}>
            <Settings className="h-4 w-4" />
            Configurar cuentas
          </Button>
        </div>
      </div>

      {seedError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {seedError}
        </div>
      )}

      {rubros.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <Database className="h-10 w-10 text-slate-300" />
          <div>
            <p className="font-medium text-slate-700">Sin plan de cuentas</p>
            <p className="mt-1 text-sm text-slate-400">
              Hacé clic en "Inicializar plan de cuentas" para cargar el plan mínimo
              para una financiera (5 rubros, 26 cuentas).
            </p>
          </div>
          <Button onClick={handleSeed} disabled={seeding}>
            <Database className="h-4 w-4" />
            {seeding ? "Inicializando..." : "Inicializar plan de cuentas"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {rubros.map((rubro) => (
              <div
                key={rubro.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center"
              >
                <p className="font-mono text-xs text-slate-400">{rubro.codigo}</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{rubro.nombre}</p>
                <p className="mt-1 text-xs text-slate-500">{rubro.cuentas.length} cuentas</p>
              </div>
            ))}
          </div>

          {/* Detalle por rubro */}
          {rubros.map((rubro) => (
            <Card key={rubro.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-slate-500">
                    {rubro.codigo}
                  </span>
                  <CardTitle>{rubro.nombre}</CardTitle>
                  <Badge className={naturalezaColor[rubro.naturaleza] ?? ""}>
                    {naturalezaLabel[rubro.naturaleza] ?? rubro.naturaleza}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {rubro.cuentas.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin cuentas.</p>
                ) : (
                  <div className="space-y-1">
                    {rubro.cuentas.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <span className="w-20 font-mono text-xs text-slate-400">
                          {c.codigo}
                        </span>
                        <span className="flex-1 text-slate-700">{c.nombre}</span>
                        <div className="flex gap-1.5">
                          {c.imputable && (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200">Imputable</Badge>
                          )}
                          {c.requiere_caja && (
                            <Badge variant="outline" className="text-xs text-slate-500">Caja</Badge>
                          )}
                          {c.requiere_tercero && (
                            <Badge variant="outline" className="text-xs text-slate-500">Tercero</Badge>
                          )}
                          {!c.activa && (
                            <Badge variant="outline" className="text-slate-400">Inactiva</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
