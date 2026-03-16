"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

const columns: Column<FinCredito>[] = [
  { key: "numero_credito", header: "Nro", width: "90px" },
  { key: "cliente_id", header: "Cliente ID", className: "font-mono text-xs text-slate-400" },
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

export default function CreditosPage() {
  const router = useRouter();
  const [creditos, setCreditos] = useState<FinCredito[]>([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState("todos");

  useEffect(() => {
    setLoading(true);
    const url =
      estado !== "todos"
        ? `/api/fin/creditos?estado=${estado}`
        : "/api/fin/creditos";
    apiFetch(url)
      .then((r) => r.json())
      .then((d) => setCreditos((d as { creditos: FinCredito[] }).creditos ?? []))
      .finally(() => setLoading(false));
  }, [estado]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Créditos</h2>
          <p className="text-sm text-slate-500">Cartera de créditos al consumo</p>
        </div>
        <Button onClick={() => router.push("/creditos/nuevo")}>
          <Plus className="h-4 w-4" />
          Nuevo crédito
        </Button>
      </div>

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
      </div>

      <DataTable
        columns={columns}
        data={creditos}
        loading={loading}
        emptyMessage="No hay créditos para el filtro seleccionado."
        onRowClick={(row) => router.push(`/creditos/${row.id}`)}
      />
    </div>
  );
}
