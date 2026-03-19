"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, LayoutGrid, List, CreditCard, Filter, Database } from "lucide-react";
import type { FinCliente } from "@/types/fin-cliente";
import type { FinTipoCliente } from "@/types/fin-tipo-cliente";
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
    key: "tipo_cliente_id",
    header: "Clasificación",
    render: (r) => r.tipo_cliente_nombre ? (
      <span className="text-xs text-slate-600">{r.tipo_cliente_nombre}</span>
    ) : (
      <span className="text-xs text-slate-400">—</span>
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
  const [tipos, setTipos] = useState<FinTipoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tipoClienteId, setTipoClienteId] = useState("");
  const [view, setView] = useState<ViewMode>("lista");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSeedDemo = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const res = await apiFetch("/api/fin/seed-demo", { method: "POST" });
      const body = await res.json() as { ok?: boolean; clientes?: number; creditos?: number; error?: string };
      if (!res.ok) {
        setSeedMsg({ ok: false, text: body.error ?? "Error al cargar datos demo" });
      } else {
        setSeedMsg({ ok: true, text: `Cargados: ${body.clientes ?? 0} clientes con créditos.` });
        fetchClientes("", "");
      }
    } catch {
      setSeedMsg({ ok: false, text: "Error de conexión" });
    } finally {
      setSeeding(false);
    }
  };

  // Cargar tipos de cliente para el filtro
  useEffect(() => {
    apiFetch("/api/fin/tipos-cliente")
      .then((res) => res.ok ? res.json() : { tipos: [] })
      .then((data) => setTipos(data.tipos ?? []))
      .catch(() => {});
  }, []);

  const fetchClientes = (query: string, tipoId: string) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (tipoId) params.set("tipoClienteId", tipoId);
    const url = `/api/fin/clientes${params.toString() ? `?${params}` : ""}`;
    apiFetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar clientes");
        return res.json();
      })
      .then((data) => setClientes(data.clientes ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchClientes("", ""); }, []);

  const handleSearch = (value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchClientes(value, tipoClienteId), 300);
  };

  const handleTipoChange = (value: string) => {
    setTipoClienteId(value);
    fetchClientes(q, value);
  };

  // Totalizar saldo para mostrar en el header del filtro
  const totalSaldo = clientes.reduce((acc, c) => acc + (c.saldo_total_adeudado ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Clientes</h2>
          <p className="text-sm text-slate-500">
            {clientes.length} cliente{clientes.length !== 1 ? "s" : ""}
            {tipoClienteId || q ? " (filtrado)" : ""}
            {" · "}
            <span className="font-medium text-amber-700">{ars(totalSaldo)}</span> en cartera
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, CUIT…"
            value={q}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {/* Filtro tipo cliente */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={tipoClienteId}
            onChange={(e) => handleTipoChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">Todos los tipos</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
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

      {/* Banner seed cuando no hay clientes y no hay búsqueda activa */}
      {!loading && clientes.length === 0 && !q && !tipoClienteId && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
          <Database className="h-10 w-10 text-amber-400" />
          <div>
            <p className="font-semibold text-slate-800">No hay clientes todavía</p>
            <p className="mt-1 text-sm text-slate-500">
              Podés cargar datos demo para probar el sistema con 8 clientes y créditos ficticios.
            </p>
          </div>
          {seedMsg && (
            <div className={`rounded-xl border px-4 py-2 text-sm ${seedMsg.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
              {seedMsg.text}
            </div>
          )}
          <Button onClick={handleSeedDemo} disabled={seeding} variant="default">
            <Database className="h-4 w-4" />
            {seeding ? "Cargando datos..." : "Cargar datos demo"}
          </Button>
        </div>
      )}

      {/* Vista lista */}
      {(loading || clientes.length > 0 || q || tipoClienteId) && view === "lista" && (
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
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {c.tipo === "fisica" ? "Física" : "Jurídica"}
                    </Badge>
                    {c.tipo_cliente_nombre && (
                      <span className="text-xs text-slate-400">{c.tipo_cliente_nombre}</span>
                    )}
                  </div>
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
          fetchClientes(q, tipoClienteId);
          router.push(`/clientes/${id}`);
        }}
      />
    </div>
  );
}
