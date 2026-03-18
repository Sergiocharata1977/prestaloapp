"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, LayoutGrid, List, CreditCard } from "lucide-react";
import type { FinCliente } from "@/types/fin-cliente";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { NuevoClienteDialog } from "@/components/fin/dialogs/NuevoClienteDialog";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

const columns: Column<FinCliente>[] = [
  {
    key: "nombre",
    header: "Cliente",
    render: (r) => (
      <span className="font-medium text-slate-900">
        {r.tipo === "fisica" ? `${r.apellido ?? ""}, ${r.nombre}` : r.nombre}
      </span>
    ),
  },
  { key: "cuit", header: "CUIT" },
  {
    key: "tipo",
    header: "Tipo",
    render: (r) => (
      <Badge variant="outline">
        {r.tipo === "fisica" ? "Física" : "Jurídica"}
      </Badge>
    ),
  },
  {
    key: "creditos_activos_count",
    header: "Créditos activos",
    render: (r) => String(r.creditos_activos_count),
  },
  {
    key: "saldo_total_adeudado",
    header: "Saldo adeudado",
    render: (r) => ars(r.saldo_total_adeudado),
    className: "text-right font-mono",
  },
];

type ViewMode = "lista" | "tarjetas";

export default function ClientesPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<FinCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [view, setView] = useState<ViewMode>("lista");
  const [dialogOpen, setDialogOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchClientes = (query: string) => {
    setLoading(true);
    setError(null);
    const url = query ? `/api/fin/clientes?q=${encodeURIComponent(query)}` : "/api/fin/clientes";
    apiFetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar clientes");
        return res.json();
      })
      .then((data) => setClientes(data.clientes ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchClientes(""); }, []);

  const handleSearch = (value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchClientes(value), 300);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Clientes</h2>
          <p className="text-sm text-slate-500">Gestión de clientes del sistema</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      {/* Filters + view toggle */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, CUIT…"
            value={q}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
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

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Vista lista */}
      {view === "lista" && (
        <DataTable
          columns={columns}
          data={clientes}
          loading={loading}
          emptyMessage="No se encontraron clientes."
          onRowClick={(row) => router.push(`/clientes/${row.id}`)}
        />
      )}

      {/* Vista tarjetas */}
      {view === "tarjetas" && (
        loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : clientes.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">No se encontraron clientes.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clientes.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/clientes/${c.id}`)}
                className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:border-amber-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900 group-hover:text-amber-700">
                      {c.tipo === "fisica" ? `${c.apellido ?? ""}, ${c.nombre}` : c.nombre}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">{c.cuit}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {c.tipo === "fisica" ? "Física" : "Jurídica"}
                  </Badge>
                </div>

                <div className="mt-4 flex items-center gap-1 text-xs text-slate-500">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>
                    {c.creditos_activos_count} crédito{c.creditos_activos_count !== 1 ? "s" : ""} activo{c.creditos_activos_count !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Saldo adeudado</span>
                  <span className={`font-mono text-sm font-semibold ${c.saldo_total_adeudado > 0 ? "text-amber-700" : "text-slate-400"}`}>
                    {ars(c.saldo_total_adeudado)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      <NuevoClienteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={(id) => {
          fetchClientes(q);
          router.push(`/clientes/${id}`);
        }}
      />
    </div>
  );
}
