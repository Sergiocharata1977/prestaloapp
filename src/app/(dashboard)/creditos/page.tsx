"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LayoutGrid, List } from "lucide-react";
import type { FinCredito } from "@/types/fin-credito";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/fin/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NuevoCreditoDialog } from "@/components/fin/dialogs/NuevoCreditoDialog";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

const columns: Column<FinCredito>[] = [
  { key: "numero_credito", header: "Nro", width: "90px" },
  { key: "articulo_descripcion", header: "Artículo", className: "text-sm" },
  {
    key: "capital",
    header: "Capital",
    render: (r) => ars(r.capital),
    className: "text-right font-mono",
  },
  {
    key: "sistema",
    header: "Sistema",
    render: (r) => (r.sistema === "frances" ? "Francés" : "Alemán"),
  },
  {
    key: "cantidad_cuotas",
    header: "Cuotas",
    render: (r) => `${r.cuotas_pagas}/${r.cantidad_cuotas}`,
  },
  {
    key: "saldo_capital",
    header: "Saldo",
    render: (r) => ars(r.saldo_capital),
    className: "text-right font-mono",
  },
  {
    key: "estado",
    header: "Estado",
    render: (r) => <StatusBadge estado={r.estado} />,
  },
  { key: "fecha_otorgamiento", header: "Fecha" },
];

type ViewMode = "lista" | "tarjetas";

export default function CreditosPage() {
  const router = useRouter();
  const [creditos, setCreditos] = useState<FinCredito[]>([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState("todos");
  const [view, setView] = useState<ViewMode>("lista");
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchCreditos = (filtroEstado: string) => {
    setLoading(true);
    const url = filtroEstado !== "todos" ? `/api/fin/creditos?estado=${filtroEstado}` : "/api/fin/creditos";
    apiFetch(url)
      .then((r) => r.json())
      .then((d) => setCreditos((d as { creditos: FinCredito[] }).creditos ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCreditos(estado); }, [estado]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Créditos</h2>
          <p className="text-sm text-slate-500">Cartera de créditos al consumo</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo crédito
        </Button>
      </div>

      {/* Filters + view toggle */}
      <div className="flex items-center gap-3">
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="activo">Activos</SelectItem>
            <SelectItem value="cancelado">Cancelados</SelectItem>
            <SelectItem value="en_mora">En mora</SelectItem>
            <SelectItem value="incobrable">Incobrables</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex rounded-lg border border-slate-200 bg-white p-1 gap-1">
          <button
            onClick={() => setView("lista")}
            className={`rounded p-1.5 transition-colors ${view === "lista" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600"}`}
            title="Vista lista"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("tarjetas")}
            className={`rounded p-1.5 transition-colors ${view === "tarjetas" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600"}`}
            title="Vista tarjetas"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Vista lista */}
      {view === "lista" && (
        <DataTable
          columns={columns}
          data={creditos}
          loading={loading}
          emptyMessage="No hay créditos para el filtro seleccionado."
          onRowClick={(row) => router.push(`/creditos/${row.id}`)}
        />
      )}

      {/* Vista tarjetas */}
      {view === "tarjetas" && (
        loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : creditos.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">No hay créditos para el filtro seleccionado.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creditos.map((cr) => (
              <button
                key={cr.id}
                onClick={() => router.push(`/creditos/${cr.id}`)}
                className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:border-amber-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-amber-700">#{cr.numero_credito}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm font-medium text-slate-900 group-hover:text-amber-700">
                      {cr.articulo_descripcion}
                    </p>
                  </div>
                  <StatusBadge estado={cr.estado} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-400">Capital</p>
                    <p className="font-mono font-semibold text-slate-900">{ars(cr.capital)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Saldo</p>
                    <p className="font-mono font-semibold text-slate-900">{ars(cr.saldo_capital)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Sistema</p>
                    <p className="text-slate-700">{cr.sistema === "frances" ? "Francés" : "Alemán"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Cuotas</p>
                    <p className="text-slate-700">{cr.cuotas_pagas}/{cr.cantidad_cuotas}</p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-400">{cr.fecha_otorgamiento}</p>
              </button>
            ))}
          </div>
        )
      )}

      <NuevoCreditoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => fetchCreditos(estado)}
      />
    </div>
  );
}
