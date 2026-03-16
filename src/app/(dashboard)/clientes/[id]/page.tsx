"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import type { FinCliente } from "@/types/fin-cliente";
import type { FinCredito } from "@/types/fin-credito";
import type { FinCobro } from "@/types/fin-cobro";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/fin/StatusBadge";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

const creditoColumns: Column<FinCredito>[] = [
  { key: "numero_credito", header: "Nro" },
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
    key: "estado",
    header: "Estado",
    render: (r) => <StatusBadge estado={r.estado} />,
  },
  { key: "fecha_otorgamiento", header: "Fecha" },
];

const cobroColumns: Column<FinCobro>[] = [
  { key: "fecha_cobro", header: "Fecha", render: (r) => r.fecha_cobro.slice(0, 10) },
  {
    key: "numero_cuota",
    header: "Cuota",
    render: (r) => `#${r.numero_cuota}`,
  },
  {
    key: "capital_cobrado",
    header: "Capital",
    render: (r) => ars(r.capital_cobrado),
    className: "text-right font-mono",
  },
  {
    key: "interes_cobrado",
    header: "Interés",
    render: (r) => ars(r.interes_cobrado),
    className: "text-right font-mono",
  },
  {
    key: "total_cobrado",
    header: "Total",
    render: (r) => ars(r.total_cobrado),
    className: "text-right font-mono font-semibold",
  },
  {
    key: "medio_pago",
    header: "Medio",
    render: (r) => <Badge variant="outline">{r.medio_pago}</Badge>,
  },
];

type CuentaCorrienteData = {
  cobros: FinCobro[];
  total_cobrado: number;
  total_capital: number;
  total_intereses: number;
};

export default function ClienteDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [cliente, setCliente] = useState<FinCliente | null>(null);
  const [creditos, setCreditos] = useState<FinCredito[]>([]);
  const [cuentaCorriente, setCuentaCorriente] = useState<CuentaCorrienteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [consultandoNosis, setConsultandoNosis] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch(`/api/fin/clientes/${id}`).then((r) => r.json()),
      apiFetch(`/api/fin/creditos?clienteId=${id}`).then((r) => r.json()),
      apiFetch(`/api/fin/clientes/${id}/cuenta-corriente`).then((r) => r.json()),
    ])
      .then(([clienteData, creditosData, ccData]) => {
        setCliente(clienteData as FinCliente);
        setCreditos((creditosData as { creditos: FinCredito[] }).creditos ?? []);
        setCuentaCorriente(ccData as CuentaCorrienteData);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const consultarNosis = async () => {
    if (!id) return;
    setConsultandoNosis(true);
    try {
      const res = await apiFetch(`/api/fin/clientes/${id}/nosis`, { method: "POST" });
      if (!res.ok) throw new Error("Error al consultar Nosis");
      const updated = await apiFetch(`/api/fin/clientes/${id}`).then((r) => r.json());
      setCliente(updated as FinCliente);
    } finally {
      setConsultandoNosis(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-16 text-slate-500">Cliente no encontrado.</div>
    );
  }

  const nosis = cliente.nosis_ultimo;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {cliente.tipo === "fisica"
              ? `${cliente.apellido ?? ""}, ${cliente.nombre}`
              : cliente.nombre}
          </h2>
          <p className="text-sm text-slate-500">CUIT {cliente.cuit}</p>
        </div>
      </div>

      {/* Datos */}
      <Card>
        <CardHeader>
          <CardTitle>Datos del cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Tipo", cliente.tipo === "fisica" ? "Persona física" : "Persona jurídica"],
              ["DNI", cliente.dni ?? "—"],
              ["Teléfono", cliente.telefono ?? "—"],
              ["Email", cliente.email ?? "—"],
              ["Domicilio", cliente.domicilio ?? "—"],
              ["Localidad", cliente.localidad ?? "—"],
              ["Provincia", cliente.provincia ?? "—"],
              ["Saldo adeudado", ars(cliente.saldo_total_adeudado)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-400">{label}</dt>
                <dd className="font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Nosis */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Información Nosis</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={consultarNosis}
            disabled={consultandoNosis}
          >
            <RefreshCw className={`h-3 w-3 ${consultandoNosis ? "animate-spin" : ""}`} />
            {consultandoNosis ? "Consultando…" : "Consultar Nosis"}
          </Button>
        </CardHeader>
        <CardContent>
          {nosis ? (
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-400">Score</dt>
                <dd className="font-medium">{nosis.score ?? "N/D"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Situación BCRA</dt>
                <dd className="font-medium">{nosis.situacion_bcra ?? "N/D"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Cheques rechazados</dt>
                <dd className="font-medium">{nosis.cheques_rechazados}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Juicios activos</dt>
                <dd className="font-medium">{nosis.juicios_activos}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Fecha consulta</dt>
                <dd className="font-medium">{nosis.fecha}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-400">Sin datos Nosis. Hacé clic en "Consultar Nosis".</p>
          )}
        </CardContent>
      </Card>

      {/* Créditos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Créditos</h3>
          <Button
            size="sm"
            onClick={() => router.push(`/creditos/nuevo?clienteId=${id}`)}
          >
            Nuevo crédito
          </Button>
        </div>
        <DataTable
          columns={creditoColumns}
          data={creditos}
          emptyMessage="Sin créditos registrados."
          onRowClick={(row) => router.push(`/creditos/${row.id}`)}
        />
      </div>

      {/* Cuenta corriente */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Cuenta corriente</h3>
          {cuentaCorriente && (
            <div className="flex gap-3">
              <Badge variant="outline" className="font-mono">
                Capital: {ars(cuentaCorriente.total_capital)}
              </Badge>
              <Badge variant="outline" className="font-mono">
                Intereses: {ars(cuentaCorriente.total_intereses)}
              </Badge>
              <Badge className="bg-green-100 text-green-800 font-mono">
                Total cobrado: {ars(cuentaCorriente.total_cobrado)}
              </Badge>
            </div>
          )}
        </div>
        <DataTable
          columns={cobroColumns}
          data={cuentaCorriente?.cobros ?? []}
          emptyMessage="Sin cobros registrados."
        />
      </div>
    </div>
  );
}
