"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, Printer, Wallet } from "lucide-react";
import type { FinCobro } from "@/types/fin-cobro";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

const columns: Column<FinCobro>[] = [
  { key: "fecha_cobro", header: "Fecha", render: (r) => r.fecha_cobro.slice(0, 10) },
  { key: "usuario_nombre", header: "Operador" },
  { key: "numero_cuota", header: "Cuota #", render: (r) => String(r.numero_cuota) },
  { key: "capital_cobrado", header: "Capital", render: (r) => ars(r.capital_cobrado), className: "text-right font-mono" },
  { key: "interes_cobrado", header: "Interes", render: (r) => ars(r.interes_cobrado), className: "text-right font-mono" },
  { key: "total_cobrado", header: "Total", render: (r) => ars(r.total_cobrado), className: "text-right font-mono font-semibold" },
  { key: "medio_pago", header: "Medio de pago", render: (r) => (r.medio_pago === "efectivo" ? "Efectivo" : r.medio_pago) },
  {
    key: "actions",
    header: "",
    width: "180px",
    render: (cobro) => (
      <div className="flex justify-end">
        <Button asChild size="sm" variant="outline">
          <Link href={`/print/cobro/${cobro.id}`} target="_blank" rel="noopener noreferrer">
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
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();
  const [cobros, setCobros] = useState<FinCobro[]>([]);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState(firstDayOfMonth);

  useEffect(() => {
    apiFetch(`/api/fin/cobros?desde=${desde}`)
      .then((r) => r.json())
      .then((d) => setCobros((d as { cobros: FinCobro[] }).cobros ?? []))
      .finally(() => setLoading(false));
  }, [desde]);

  const totalDia = cobros.reduce((s, c) => s + c.total_cobrado, 0);

  return (
    <div className="space-y-6">
      <section className="chart-panel p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Badge className="mb-3 w-fit border-amber-200/80 bg-white/80 text-amber-700 shadow-sm">
              Cobranzas
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Cobros</h2>
            <p className="mt-2 text-sm text-slate-500">Registro de pagos recibidos y emision de recibos</p>
          </div>
          <Button onClick={() => router.push("/cobros/nuevo")}>
            <Plus className="h-4 w-4" />
            Registrar cobro
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="rounded-[1.5rem] border border-white/70 bg-white/80 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-slate-600" htmlFor="desde">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              Desde
            </label>
            <Input
              id="desde"
              type="date"
              className="w-40"
              value={desde}
              onChange={(e) => {
                setLoading(true);
                setDesde(e.target.value);
              }}
            />
          </div>
        </div>

        <Card className="overflow-hidden border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,249,240,0.98)_100%)] shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl border border-amber-200/70 bg-white/80 p-3 text-amber-700 shadow-[0_10px_24px_rgba(180,83,9,0.08)]">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total filtrado</p>
              <p className="text-2xl font-semibold text-slate-950">{ars(totalDia)}</p>
              <p className="text-xs text-slate-500">{cobros.length} cobro(s) en vista</p>
            </div>
          </CardContent>
        </Card>
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
