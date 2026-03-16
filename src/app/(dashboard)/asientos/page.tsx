"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FinAsiento } from "@/types/fin-asiento";
import { apiFetch } from "@/lib/apiFetch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

const origenLabel: Record<string, string> = {
  credito_otorgado: "Otorgamiento",
  cobro_cuota: "Cobro cuota",
};

const columns: Column<FinAsiento>[] = [
  { key: "fecha", header: "Fecha", render: (r) => r.fecha.slice(0, 10) },
  { key: "periodo", header: "Período" },
  {
    key: "origen",
    header: "Origen",
    render: (r) => (
      <Badge variant="outline">{origenLabel[r.origen] ?? r.origen}</Badge>
    ),
  },
  { key: "documento_tipo", header: "Doc tipo" },
  {
    key: "total_debe",
    header: "Debe",
    render: (r) => ars(r.total_debe),
    className: "text-right font-mono",
  },
  {
    key: "total_haber",
    header: "Haber",
    render: (r) => ars(r.total_haber),
    className: "text-right font-mono",
  },
  {
    key: "estado",
    header: "Balance",
    render: (r) =>
      Math.abs(r.total_debe - r.total_haber) < 0.01 ? (
        <Badge className="bg-green-100 text-green-800">Balanceado</Badge>
      ) : (
        <Badge className="bg-red-100 text-red-800">Desbalanceado</Badge>
      ),
  },
];

export default function AsientosPage() {
  const router = useRouter();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [asientos, setAsientos] = useState<FinAsiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState(`${thisMonth}-01`);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/fin/asientos?desde=${desde}`)
      .then((r) => r.json())
      .then((d) => setAsientos((d as { asientos: FinAsiento[] }).asientos ?? []))
      .finally(() => setLoading(false));
  }, [desde]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Libro Diario</h2>
        <p className="text-sm text-slate-500">Asientos generados automáticamente</p>
      </div>

      <div className="flex items-center gap-3">
        <Label htmlFor="desde" className="text-sm text-slate-600">
          Desde
        </Label>
        <Input
          id="desde"
          type="date"
          className="w-40"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />
        <span className="text-sm text-slate-400">{asientos.length} asientos</span>
      </div>

      <DataTable
        columns={columns}
        data={asientos}
        loading={loading}
        emptyMessage="Sin asientos para el período seleccionado."
        onRowClick={(row) => router.push(`/asientos/${row.id}`)}
      />
    </div>
  );
}
