"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer } from "lucide-react";
import type { FinCobro } from "@/types/fin-cobro";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/ui/data-table";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

const columns: Column<FinCobro>[] = [
  { key: "fecha_cobro", header: "Fecha", render: (r) => r.fecha_cobro.slice(0, 10) },
  { key: "usuario_nombre", header: "Operador" },
  { key: "numero_cuota", header: "Cuota #", render: (r) => String(r.numero_cuota) },
  { key: "capital_cobrado", header: "Capital", render: (r) => ars(r.capital_cobrado), className: "text-right font-mono" },
  { key: "interes_cobrado", header: "Interés", render: (r) => ars(r.interes_cobrado), className: "text-right font-mono" },
  { key: "total_cobrado", header: "Total", render: (r) => ars(r.total_cobrado), className: "text-right font-mono font-semibold" },
  { key: "medio_pago", header: "Medio de pago", render: (r) => r.medio_pago === "efectivo" ? "Efectivo" : r.medio_pago },
  {
    key: "actions",
    header: "",
    width: "180px",
    render: (cobro) => (
      <div className="flex justify-end">
        <Button asChild size="sm" variant="outline">
          <Link
            href={`/print/cobro/${cobro.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Printer className="h-4 w-4" />
            Imprimir recibo
          </Link>
        </Button>
      </div>
    ),
  },
];

export default function CobrosPage() {
  const router = useRouter();
  const firstDayOfMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();
  const [cobros, setCobros] = useState<FinCobro[]>([]);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState(firstDayOfMonth);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/fin/cobros?desde=${desde}`)
      .then((r) => r.json())
      .then((d) => setCobros((d as { cobros: FinCobro[] }).cobros ?? []))
      .finally(() => setLoading(false));
  }, [desde]);

  const totalDia = cobros.reduce((s, c) => s + c.total_cobrado, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Cobros</h2>
          <p className="text-sm text-slate-500">Registro de pagos recibidos</p>
        </div>
        <Button onClick={() => router.push("/cobros/nuevo")}>
          <Plus className="h-4 w-4" />
          Registrar cobro
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-600" htmlFor="desde">Desde</label>
        <Input
          id="desde"
          type="date"
          className="w-40"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />
        {cobros.length > 0 && (
          <span className="ml-auto text-sm font-semibold text-slate-900">
            Total: {ars(totalDia)}
          </span>
        )}
      </div>

      <DataTable
        columns={columns}
        data={cobros}
        loading={loading}
        emptyMessage="No hay cobros para la fecha seleccionada."
      />
    </div>
  );
}
