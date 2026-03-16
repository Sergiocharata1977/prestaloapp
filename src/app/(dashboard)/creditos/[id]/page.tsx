"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { FinCredito } from "@/types/fin-credito";
import type { FinCuota } from "@/types/fin-cuota";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/fin/StatusBadge";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

const cuotaColumns: Column<FinCuota>[] = [
  { key: "numero_cuota", header: "Nro", width: "60px" },
  { key: "fecha_vencimiento", header: "Vencimiento" },
  { key: "capital", header: "Capital", render: (r) => ars(r.capital), className: "text-right font-mono" },
  { key: "interes", header: "Interés", render: (r) => ars(r.interes), className: "text-right font-mono" },
  { key: "total", header: "Total", render: (r) => ars(r.total), className: "text-right font-mono font-semibold" },
  { key: "estado", header: "Estado", render: (r) => <StatusBadge estado={r.estado} /> },
];

export default function CreditoDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [credito, setCredito] = useState<FinCredito | null>(null);
  const [cuotas, setCuotas] = useState<FinCuota[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch(`/api/fin/creditos/${id}`).then((r) => r.json()),
      apiFetch(`/api/fin/creditos/${id}/cuotas`).then((r) => r.json()),
    ])
      .then(([creditoData, cuotasData]) => {
        setCredito(creditoData as FinCredito);
        setCuotas((cuotasData as { cuotas: FinCuota[] }).cuotas ?? []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="h-60 animate-pulse rounded-2xl bg-slate-200" />;
  }

  if (!credito) {
    return <div className="py-16 text-center text-slate-500">Crédito no encontrado.</div>;
  }

  const cuotasPendientes = cuotas.filter(
    (c) => c.estado === "pendiente" || c.estado === "vencida"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Crédito {credito.numero_credito}
          </h2>
          <p className="text-sm text-slate-500">{credito.articulo_descripcion}</p>
        </div>
        <StatusBadge estado={credito.estado} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Capital", ars(credito.capital)],
          ["Total crédito", ars(credito.total_credito)],
          ["Saldo capital", ars(credito.saldo_capital)],
          ["Sistema", credito.sistema === "frances" ? "Francés" : "Alemán"],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-xl font-semibold text-slate-900">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalles</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            {[
              ["Tasa mensual", `${credito.tasa_mensual}%`],
              ["Cuotas", `${credito.cuotas_pagas}/${credito.cantidad_cuotas} pagas`],
              ["Cuota promedio", ars(credito.valor_cuota_promedio)],
              ["Total intereses", ars(credito.total_intereses)],
              ["Fecha otorgamiento", credito.fecha_otorgamiento],
              ["Primer vencimiento", credito.fecha_primer_vencimiento],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-400">{label}</dt>
                <dd className="font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Tabla de cuotas</h3>
        <DataTable
          columns={[
            ...cuotaColumns,
            {
              key: "actions",
              header: "",
              width: "120px",
              render: (r) =>
                r.estado === "pendiente" || r.estado === "vencida" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(
                        `/cobros/nuevo?cuotaId=${r.id}&creditoId=${credito.id}`
                      );
                    }}
                  >
                    Cobrar
                  </Button>
                ) : null,
            },
          ]}
          data={cuotas}
          emptyMessage="Sin cuotas."
        />
      </div>

      {cuotasPendientes.length > 0 && (
        <p className="text-sm text-slate-500">
          {cuotasPendientes.length} cuota(s) pendiente(s) de cobro.
        </p>
      )}
    </div>
  );
}
