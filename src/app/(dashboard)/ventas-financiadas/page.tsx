"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleDollarSign, List, Plus, ShoppingBag, Tag } from "lucide-react";
import type { FinCredito } from "@/types/fin-credito";
import { NuevoCreditoDialog } from "@/components/fin/dialogs/NuevoCreditoDialog";
import { StatusBadge } from "@/components/fin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { apiFetch } from "@/lib/apiFetch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function ars(n: number) {
  return fmt.format(n);
}

const columns: Column<FinCredito>[] = [
  { key: "numero_credito", header: "Nro", width: "90px" },
  { key: "articulo_descripcion", header: "Artículo / Bien", className: "text-sm" },
  {
    key: "valor_contado_bien",
    header: "Valor contado",
    render: (r) =>
      r.valor_contado_bien ? ars(r.valor_contado_bien) : "—",
    className: "text-right font-mono text-slate-500",
  },
  {
    key: "capital",
    header: "Financiado",
    render: (r) => ars(r.capital),
    className: "text-right font-mono",
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

export default function VentasFinanciadasPage() {
  const router = useRouter();
  const [ventas, setVentas] = useState<FinCredito[]>([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchVentas = (filtroEstado: string) => {
    setLoading(true);
    const params = new URLSearchParams({ tipo: "compra_financiada" });
    if (filtroEstado !== "todos") params.set("estado", filtroEstado);
    apiFetch(`/api/fin/creditos?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setVentas((d as { creditos: FinCredito[] }).creditos ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchVentas(estado);
  }, [estado]);

  const summary = useMemo(() => {
    const activas = ventas.filter((v) => v.estado === "activo");
    const totalFinanciado = ventas.reduce((a, v) => a + (v.capital ?? 0), 0);
    const cartera = activas.reduce((a, v) => a + (v.saldo_capital ?? 0), 0);
    return { activas: activas.length, totalFinanciado, cartera };
  }, [ventas]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Venta Financiada
          </h2>
          <p className="text-sm text-slate-500">
            Financiación de bienes y productos con tabla de cuotas
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva venta
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Cartera activa",
            value: ars(summary.cartera),
            detail: `${summary.activas} operación(es) vigentes`,
            icon: ShoppingBag,
          },
          {
            label: "Total financiado",
            value: ars(summary.totalFinanciado),
            detail: `${ventas.length} operación(es) en vista`,
            icon: CircleDollarSign,
          },
          {
            label: "Operaciones activas",
            value: String(summary.activas),
            detail: "Solo estado activo",
            icon: List,
          },
        ].map(({ icon: Icon, label, value, detail }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-2xl font-semibold text-slate-900">{value}</p>
                <p className="text-xs text-slate-400">{detail}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
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

        {/* Badge indicador de plugin */}
        <span className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          <Tag className="h-3 w-3" />
          Plugin: Productos
        </span>
      </div>

      {/* Tabla */}
      <DataTable
        columns={columns}
        data={ventas}
        loading={loading}
        emptyMessage="No hay ventas financiadas para el filtro seleccionado."
        onRowClick={(row) => router.push(`/creditos/${row.id}`)}
      />

      {/* Dialog */}
      <NuevoCreditoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => fetchVentas(estado)}
      />
    </div>
  );
}
