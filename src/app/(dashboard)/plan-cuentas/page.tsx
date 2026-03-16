"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import type { FinRubro, FinCuenta } from "@/types/fin-plan-cuentas";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const naturalezaLabel: Record<string, string> = {
  activo: "Activo",
  pasivo: "Pasivo",
  patrimonio_neto: "Patrimonio Neto",
  resultado_positivo: "Resultado ＋",
  resultado_negativo: "Resultado −",
};

type RubroConCuentas = FinRubro & { cuentas: FinCuenta[] };

export default function PlanCuentasPage() {
  const router = useRouter();
  const [rubros, setRubros] = useState<RubroConCuentas[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

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
        <Button variant="outline" onClick={() => router.push("/plan-cuentas/configurar")}>
          <Settings className="h-4 w-4" />
          Configurar cuentas
        </Button>
      </div>

      {rubros.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300">
          <p className="text-sm text-slate-400">
            Sin plan de cuentas configurado. Ejecutá el script de seed.
          </p>
        </div>
      ) : (
        rubros.map((rubro) => (
          <Card key={rubro.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-slate-500">
                  {rubro.codigo}
                </span>
                <CardTitle>{rubro.nombre}</CardTitle>
                <Badge variant="outline">
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
                      {c.imputable && (
                        <Badge className="bg-blue-50 text-blue-700">Imputable</Badge>
                      )}
                      {!c.activa && (
                        <Badge variant="outline" className="text-slate-400">
                          Inactiva
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
