"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import type { FinTipoCliente } from "@/types/fin-tipo-cliente";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { NuevoTipoClienteDialog } from "@/components/fin/dialogs/NuevoTipoClienteDialog";

const columns: Column<FinTipoCliente>[] = [
  { key: "codigo", header: "Codigo", width: "120px", className: "font-mono" },
  {
    key: "nombre",
    header: "Nombre",
    render: (row) => <span className="font-medium text-slate-900">{row.nombre}</span>,
  },
  {
    key: "tipo_base",
    header: "Base",
    render: (row) => <Badge variant="outline">{row.tipo_base === "persona" ? "Persona" : "Empresa"}</Badge>,
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
  {
    key: "reglas",
    header: "Reglas",
    render: (row) =>
      [
        row.requiere_legajo ? "Legajo" : null,
        row.requiere_evaluacion_vigente ? "Eval. vigente" : null,
        row.permite_cheques_propios ? "Cheques propios" : null,
        row.permite_cheques_terceros ? "Cheques terceros" : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Sin reglas especiales",
  },
];

export default function TiposClientePage() {
  const [tipos, setTipos] = useState<FinTipoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchTipos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/fin/tipos-cliente");
      if (!res.ok) throw new Error("No se pudieron cargar los tipos de cliente");
      const data = (await res.json()) as { tiposCliente?: FinTipoCliente[]; tipos?: FinTipoCliente[] };
      setTipos(data.tiposCliente ?? data.tipos ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTipos();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Tipos de cliente</h2>
          <p className="text-sm text-slate-500">Clasificacion interna y requisitos operativos por segmento.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchTipos}>
            <RefreshCw className="h-4 w-4" />
            Refrescar
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo tipo
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable columns={columns} data={tipos} loading={loading} emptyMessage="No hay tipos de cliente cargados." />

      <NuevoTipoClienteDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={() => fetchTipos()} />
    </div>
  );
}
