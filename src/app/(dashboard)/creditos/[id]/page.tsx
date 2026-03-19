"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import type { FinCredito } from "@/types/fin-credito";
import type { FinCuota } from "@/types/fin-cuota";
import { StatusBadge } from "@/components/fin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { apiFetch } from "@/lib/apiFetch";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function pct(n?: number) {
  return typeof n === "number" ? `${n}%` : "No disponible";
}

function tipoOperacionLabel(tipo?: FinCredito["tipo_operacion"]) {
  switch (tipo) {
    case "consumo":
      return "Consumo";
    case "empresa":
      return "Empresa";
    case "cheque_propio":
      return "Cheque propio";
    case "cheque_terceros":
      return "Cheque de terceros";
    default:
      return "No definido";
  }
}

const cuotaColumns: Column<FinCuota>[] = [
  { key: "numero_cuota", header: "Nro", width: "60px" },
  { key: "fecha_vencimiento", header: "Vencimiento" },
  {
    key: "capital",
    header: "Capital",
    render: (r) => ars(r.capital),
    className: "text-right font-mono",
  },
  {
    key: "interes",
    header: "Interes",
    render: (r) => ars(r.interes),
    className: "text-right font-mono",
  },
  {
    key: "total",
    header: "Total",
    render: (r) => ars(r.total),
    className: "text-right font-mono font-semibold",
  },
  {
    key: "estado",
    header: "Estado",
    render: (r) => <StatusBadge estado={r.estado} />,
  },
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
    return <div className="py-16 text-center text-slate-500">Credito no encontrado.</div>;
  }

  const cuotasPendientes = cuotas.filter(
    (cuota) => cuota.estado === "pendiente" || cuota.estado === "vencida"
  );
  const politicaAplicada =
    credito.politica_snapshot?.nombre ??
    credito.politica_snapshot?.codigo ??
    credito.politica_crediticia_id ??
    "No disponible";
  const planAplicado =
    credito.plan_snapshot?.nombre ??
    credito.plan_financiacion_id ??
    "Configuracion manual";
  const tipoClienteSnapshot =
    credito.tipo_cliente_snapshot?.nombre ??
    credito.tipo_cliente_snapshot?.codigo ??
    "No disponible";
  const politicaCodigoNombre = credito.politica_snapshot
    ? `${credito.politica_snapshot.codigo} | ${credito.politica_snapshot.nombre}`
    : "No disponible";
  const tipoClienteCodigoNombre = credito.tipo_cliente_snapshot
    ? `${credito.tipo_cliente_snapshot.codigo} | ${credito.tipo_cliente_snapshot.nombre}`
    : "No disponible";
  const tramosPlan =
    credito.plan_snapshot?.tramos_tasa?.length
      ? credito.plan_snapshot.tramos_tasa
          .map((tramo) => `${tramo.cantidad_cuotas} cuotas: ${tramo.tasa_mensual}%`)
          .join(" | ")
      : "No disponible";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Credito {credito.numero_credito}
          </h2>
          <p className="text-sm text-slate-500">{credito.articulo_descripcion}</p>
        </div>
        <StatusBadge estado={credito.estado} />
        <Button asChild variant="outline" className="ml-auto">
          <Link
            href={`/print/credito/${credito.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Printer className="h-4 w-4" />
            Imprimir contrato
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Capital", ars(credito.capital)],
          ["Total credito", ars(credito.total_credito)],
          ["Saldo capital", ars(credito.saldo_capital)],
          ["Sistema", credito.sistema === "frances" ? "Frances" : "Aleman"],
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Trazabilidad</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {[
                ["Tipo de operacion", tipoOperacionLabel(credito.tipo_operacion)],
                ["Politica aplicada", politicaAplicada],
                ["ID politica", credito.politica_crediticia_id ?? "No disponible"],
                ["Plan aplicado", planAplicado],
                ["ID plan", credito.plan_financiacion_id ?? "No disponible"],
                ["Tipo de cliente", tipoClienteSnapshot],
                ["Snapshot tipo cliente", tipoClienteCodigoNombre],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Snapshot de politica</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {[
                ["Codigo / nombre", politicaCodigoNombre],
                [
                  "Tipo de operacion snapshot",
                  tipoOperacionLabel(credito.politica_snapshot?.tipo_operacion),
                ],
                [
                  "Requiere legajo",
                  credito.politica_snapshot
                    ? credito.politica_snapshot.requiere_legajo
                      ? "Si"
                      : "No"
                    : "No disponible",
                ],
                [
                  "Evaluacion vigente",
                  credito.politica_snapshot
                    ? credito.politica_snapshot.requiere_evaluacion_vigente
                      ? "Si"
                      : "No"
                    : "No disponible",
                ],
                [
                  "Limite mensual",
                  typeof credito.politica_snapshot?.limite_mensual === "number"
                    ? ars(credito.politica_snapshot.limite_mensual)
                    : "No disponible",
                ],
                [
                  "Limite total",
                  typeof credito.politica_snapshot?.limite_total === "number"
                    ? ars(credito.politica_snapshot.limite_total)
                    : "No disponible",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Snapshot financiero</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {[
                ["Tasa mensual snapshot", pct(credito.snapshot_tasa_mensual)],
                ["Tasa punitoria snapshot", pct(credito.snapshot_tasa_punitoria_mensual)],
                [
                  "Cargo fijo snapshot",
                  typeof credito.snapshot_cargo_fijo === "number"
                    ? ars(credito.snapshot_cargo_fijo)
                    : "No disponible",
                ],
                [
                  "Cargo variable snapshot",
                  pct(credito.snapshot_cargo_variable_pct),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan y condiciones aplicadas</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Plan snapshot", credito.plan_snapshot?.nombre ?? "No disponible"],
              ["Tramos de tasa snapshot", tramosPlan],
              ["Tier sugerido", credito.tier_sugerido ?? "No disponible"],
              ["Tier asignado", credito.tier_asignado ?? "No disponible"],
              [
                "Limite asignado",
                typeof credito.limite_credito_asignado === "number"
                  ? ars(credito.limite_credito_asignado)
                  : "No disponible",
              ],
              [
                "Punitorio del plan",
                credito.plan_snapshot
                  ? pct(credito.plan_snapshot.tasa_punitoria_mensual)
                  : "No disponible",
              ],
              [
                "Cargo fijo del plan",
                typeof credito.plan_snapshot?.cargo_fijo === "number"
                  ? ars(credito.plan_snapshot.cargo_fijo)
                  : "No disponible",
              ],
              [
                "Cargo variable del plan",
                pct(credito.plan_snapshot?.cargo_variable_pct),
              ],
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
              width: "280px",
              render: (cuota) => (
                <div className="flex items-center justify-end gap-2">
                  {(cuota.estado === "pendiente" || cuota.estado === "vencida") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/cobros/nuevo?cuotaId=${cuota.id}&creditoId=${credito.id}`);
                      }}
                    >
                      Cobrar
                    </Button>
                  )}
                  {cuota.cobro_id && (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/print/cobro/${cuota.cobro_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Printer className="h-4 w-4" />
                        Imprimir recibo
                      </Link>
                    </Button>
                  )}
                </div>
              ),
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
