"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import type { FinCliente } from "@/types/fin-cliente";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

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

export default function ClientesPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<FinCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
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

  useEffect(() => {
    fetchClientes("");
  }, []);

  const handleSearch = (value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchClientes(value), 300);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Clientes</h2>
          <p className="text-sm text-slate-500">Gestión de clientes del sistema</p>
        </div>
        <Button onClick={() => router.push("/clientes/nuevo")}>
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Buscar por nombre, CUIT…"
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={clientes}
        loading={loading}
        emptyMessage="No se encontraron clientes."
        onRowClick={(row) => router.push(`/clientes/${row.id}`)}
      />
    </div>
  );
}
