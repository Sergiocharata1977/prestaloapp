"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import type { FinPlanFinanciacion } from "@/types/fin-plan-financiacion";
import type { FinPoliticaCrediticia } from "@/types/fin-politica-crediticia";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { NuevoPlanFinanciacionDialog } from "@/components/fin/dialogs/NuevoPlanFinanciacionDialog";

type PlanRow = FinPlanFinanciacion & { politica_nombre?: string };

const columns: Column<PlanRow>[] = [
  {
    key: "nombre",
    header: "Plan",
    render: (row) => <span className="font-medium text-slate-900">{row.nombre}</span>,
  },
  { key: "politica_nombre", header: "Politica" },
  {
    key: "tramos_tasa",
    header: "Tramos",
    render: (row) => row.tramos_tasa.map((tramo) => `${tramo.cantidad_cuotas} -> ${tramo.tasa_mensual}%`).join(" · "),
  },
  {
    key: "tasa_punitoria_mensual",
    header: "Punitoria",
    render: (row) => `${row.tasa_punitoria_mensual}%`,
  },
  {
    key: "activo",
    header: "Estado",
    render: (row) => (
      <Badge variant="outline" className={row.activo ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-500"}>
        {row.activo ? "Activo" : "Inactivo"}
      </Badge>
    ),
  },
];

export default function PlanesFinanciacionPage() {
  const [planes, setPlanes] = useState<FinPlanFinanciacion[]>([]);
  const [politicas, setPoliticas] = useState<FinPoliticaCrediticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [planesRes, politicasRes] = await Promise.all([
        apiFetch("/api/fin/planes-financiacion"),
        apiFetch("/api/fin/politicas-crediticias"),
      ]);

      if (!planesRes.ok) throw new Error("No se pudieron cargar los planes");
      if (!politicasRes.ok) throw new Error("No se pudieron cargar las politicas");

      const planesData = (await planesRes.json()) as { planesFinanciacion?: FinPlanFinanciacion[]; planes?: FinPlanFinanciacion[] };
      const politicasData = (await politicasRes.json()) as {
        politicasCrediticias?: FinPoliticaCrediticia[];
        politicas?: FinPoliticaCrediticia[];
      };

      setPlanes(planesData.planesFinanciacion ?? planesData.planes ?? []);
      setPoliticas(politicasData.politicasCrediticias ?? politicasData.politicas ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const rows = useMemo<PlanRow[]>(() => {
    const politicasMap = new Map(politicas.map((politica) => [politica.id, politica.nombre]));
    return planes.map((plan) => ({
      ...plan,
      politica_nombre: politicasMap.get(plan.politica_id) ?? plan.politica_id,
    }));
  }, [planes, politicas]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Planes de financiacion</h2>
          <p className="text-sm text-slate-500">Tasas por cuotas y condiciones punitorias para originacion.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
            Refrescar
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo plan
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No hay planes de financiacion cargados." />

      <NuevoPlanFinanciacionDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={() => fetchData()} />
    </div>
  );
}
