"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import type { FinPoliticaCrediticia } from "@/types/fin-politica-crediticia";
import type { FinTipoCliente } from "@/types/fin-tipo-cliente";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { NuevaPoliticaCrediticiaDialog } from "@/components/fin/dialogs/NuevaPoliticaCrediticiaDialog";

type PoliticaRow = FinPoliticaCrediticia & { tipo_cliente_nombre?: string };

const currency = (value?: number) =>
  value === undefined ? "—" : value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });

const columns: Column<PoliticaRow>[] = [
  { key: "codigo", header: "Codigo", width: "120px", className: "font-mono" },
  {
    key: "nombre",
    header: "Nombre",
    render: (row) => <span className="font-medium text-slate-900">{row.nombre}</span>,
  },
  { key: "tipo_cliente_nombre", header: "Tipo cliente" },
  {
    key: "tipo_operacion",
    header: "Operacion",
    render: (row) => <Badge variant="outline">{row.tipo_operacion}</Badge>,
  },
  {
    key: "monto_maximo",
    header: "Rango",
    render: (row) => `${currency(row.monto_minimo)} - ${currency(row.monto_maximo)}`,
  },
  {
    key: "activo",
    header: "Estado",
    render: (row) => (
      <Badge variant="outline" className={row.activo ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-500"}>
        {row.activo ? "Activa" : "Inactiva"}
      </Badge>
    ),
  },
];

export default function PoliticasCrediticiasPage() {
  const [politicas, setPoliticas] = useState<FinPoliticaCrediticia[]>([]);
  const [tiposCliente, setTiposCliente] = useState<FinTipoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [politicasRes, tiposRes] = await Promise.all([
        apiFetch("/api/fin/politicas-crediticias"),
        apiFetch("/api/fin/tipos-cliente"),
      ]);

      if (!politicasRes.ok) throw new Error("No se pudieron cargar las politicas");
      if (!tiposRes.ok) throw new Error("No se pudieron cargar los tipos de cliente");

      const politicasData = (await politicasRes.json()) as {
        politicasCrediticias?: FinPoliticaCrediticia[];
        politicas?: FinPoliticaCrediticia[];
      };
      const tiposData = (await tiposRes.json()) as { tiposCliente?: FinTipoCliente[]; tipos?: FinTipoCliente[] };

      setPoliticas(politicasData.politicasCrediticias ?? politicasData.politicas ?? []);
      setTiposCliente(tiposData.tiposCliente ?? tiposData.tipos ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const rows = useMemo<PoliticaRow[]>(() => {
    const tiposMap = new Map(tiposCliente.map((tipo) => [tipo.id, tipo.nombre]));
    return politicas.map((politica) => ({
      ...politica,
      tipo_cliente_nombre: tiposMap.get(politica.tipo_cliente_id) ?? politica.tipo_cliente_id,
    }));
  }, [politicas, tiposCliente]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Politicas crediticias</h2>
          <p className="text-sm text-slate-500">Reglas de otorgamiento por tipo de cliente y operacion.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
            Refrescar
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva politica
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No hay politicas crediticias cargadas." />

      <NuevaPoliticaCrediticiaDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={() => fetchData()} />
    </div>
  );
}
