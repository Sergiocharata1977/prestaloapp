"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Eye, FileText, ShieldCheck, ShoppingBag, Wallet } from "lucide-react";
import type { FinCliente } from "@/types/fin-cliente";
import type { FinCobro } from "@/types/fin-cobro";
import type { FinCredito } from "@/types/fin-credito";
import type { EvaluacionTier } from "@/types/fin-evaluacion";
import type { FinOperacionCheque } from "@/types/fin-operacion-cheque";
import type { FinClienteRiesgoApiResponse, FinClienteRiesgoPayload } from "@/types/fin-riesgo";
import { ClienteLegajoTab } from "@/components/fin/cliente/ClienteLegajoTab";
import { ClienteResumenCrediticio } from "@/components/fin/cliente/ClienteResumenCrediticio";
import { ClienteTabs } from "@/components/fin/cliente/ClienteTabs";
import { TabAnalisisRiesgo } from "@/components/fin/cliente/TabAnalisisRiesgo";
import { StatusBadge } from "@/components/fin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { apiFetch } from "@/lib/apiFetch";
import { CAPABILITIES } from "@/lib/capabilities";
import { useAuth } from "@/hooks/useAuth";

const arsFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function ars(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return arsFmt.format(n);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-AR");
}

const TIER_LABELS: Record<EvaluacionTier, string> = {
  A: "Tier A",
  B: "Tier B",
  C: "Tier C",
  reprobado: "Reprobado",
};

const creditoColumns: Column<FinCredito>[] = [
  { key: "numero_credito", header: "Nro", width: "90px" },
  { key: "articulo_descripcion", header: "Articulo", className: "text-sm" },
  {
    key: "capital",
    header: "Capital",
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
  {
    key: "fecha_otorgamiento",
    header: "Fecha",
    render: (r) => formatDate(r.fecha_otorgamiento),
  },
];

const ventaColumns: Column<FinCredito>[] = [
  { key: "numero_credito", header: "Nro", width: "90px" },
  { key: "articulo_descripcion", header: "Bien / Articulo", className: "text-sm" },
  {
    key: "valor_contado_bien",
    header: "Valor contado",
    render: (r) => (r.valor_contado_bien ? ars(r.valor_contado_bien) : "—"),
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
    key: "estado",
    header: "Estado",
    render: (r) => <StatusBadge estado={r.estado} />,
  },
  {
    key: "fecha_otorgamiento",
    header: "Fecha",
    render: (r) => formatDate(r.fecha_otorgamiento),
  },
];

const chequeColumns: Column<FinOperacionCheque>[] = [
  {
    key: "numero_operacion",
    header: "Operacion",
    render: (r) => r.numero_operacion ?? r.id.slice(0, 8),
  },
  { key: "fecha_operacion", header: "Fecha", render: (r) => formatDate(r.fecha_operacion) },
  { key: "resumen", header: "Cheques", render: (r) => String(r.resumen?.cantidad_cheques ?? "—") },
  {
    key: "importe_bruto",
    header: "Bruto",
    render: (r) => ars(r.resumen?.importe_bruto ?? r.importe_bruto ?? 0),
    className: "text-right font-mono",
  },
  {
    key: "importe_neto_liquidado",
    header: "Neto liquidado",
    render: (r) => ars(r.importe_neto_liquidado ?? r.resumen?.importe_neto ?? 0),
    className: "text-right font-mono font-semibold",
  },
  {
    key: "estado",
    header: "Estado",
    render: (r) => <span className="text-sm text-slate-600">{r.estado}</span>,
  },
];

const cobroColumns: Column<FinCobro>[] = [
  { key: "fecha_cobro", header: "Fecha", render: (r) => formatDate(r.fecha_cobro) },
  { key: "numero_cuota", header: "Cuota", render: (r) => `#${r.numero_cuota}` },
  {
    key: "capital_cobrado",
    header: "Capital",
    render: (r) => ars(r.capital_cobrado),
    className: "text-right font-mono",
  },
  {
    key: "interes_cobrado",
    header: "Interes",
    render: (r) => ars(r.interes_cobrado),
    className: "text-right font-mono",
  },
  {
    key: "total_cobrado",
    header: "Total",
    render: (r) => ars(r.total_cobrado),
    className: "text-right font-mono font-semibold",
  },
  { key: "medio_pago", header: "Medio", render: (r) => r.medio_pago },
];

type CuentaCorrienteData = {
  cobros: FinCobro[];
  total_cobrado: number;
  total_capital: number;
  total_intereses: number;
};

export default function ClienteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { capabilities } = useAuth();
  const hasProductos = capabilities.includes(CAPABILITIES.PRODUCTOS);

  const [cliente, setCliente] = useState<FinCliente | null>(null);
  const [creditos, setCreditos] = useState<FinCredito[]>([]);
  const [operacionesCheques, setOperacionesCheques] = useState<FinOperacionCheque[]>([]);
  const [cuentaCorriente, setCuentaCorriente] = useState<CuentaCorrienteData | null>(null);
  const [riesgo, setRiesgo] = useState<FinClienteRiesgoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [consultandoNosis, setConsultandoNosis] = useState(false);
  const [activeTab, setActiveTab] = useState("resumen");

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    try {
      const [clienteRes, creditosRes, chequesRes, ccRes, riesgoRes] = await Promise.all([
        apiFetch(`/api/fin/clientes/${id}`),
        apiFetch(`/api/fin/creditos?clienteId=${id}`),
        apiFetch(`/api/fin/operaciones-cheques?clienteId=${id}`),
        apiFetch(`/api/fin/clientes/${id}/cuenta-corriente`),
        apiFetch(`/api/fin/clientes/${id}/riesgo`),
      ]);

      const clienteData = (await clienteRes.json()) as { cliente: FinCliente };
      const creditosData = (await creditosRes.json()) as { creditos: FinCredito[] };
      const chequesData = (await chequesRes.json()) as { operaciones: FinOperacionCheque[] };
      const ccData = (await ccRes.json()) as CuentaCorrienteData;
      const riesgoData = (await riesgoRes.json()) as FinClienteRiesgoApiResponse;

      setCliente(clienteData.cliente);
      setCreditos(creditosData.creditos ?? []);
      setOperacionesCheques(chequesData.operaciones ?? []);
      setCuentaCorriente(ccData);
      setRiesgo(riesgoData.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const consultarNosis = async () => {
    if (!id) return;
    setConsultandoNosis(true);

    try {
      await apiFetch(`/api/fin/clientes/${id}/nosis`, { method: "POST" });
      await loadData();
    } finally {
      setConsultandoNosis(false);
    }
  };

  const evaluacionVigente = useMemo(() => riesgo?.evaluacion.actual ?? null, [riesgo]);
  const prestamos = useMemo(
    () => creditos.filter((credito) => credito.tipo_operacion !== "compra_financiada"),
    [creditos]
  );
  const ventasFinanciadas = useMemo(
    () => creditos.filter((credito) => credito.tipo_operacion === "compra_financiada"),
    [creditos]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
    );
  }

  if (!cliente) {
    return <div className="py-16 text-center text-slate-500">Cliente no encontrado.</div>;
  }

  const clienteNombre =
    cliente.tipo === "fisica"
      ? `${cliente.apellido ?? ""}, ${cliente.nombre}`.replace(/^,\s*/, "").trim()
      : cliente.nombre;

  const tabItems = [
    { id: "resumen", label: "Resumen", icon: <Eye className="h-4 w-4" /> },
    {
      id: "prestamos",
      label: "Prestamos",
      icon: <Wallet className="h-4 w-4" />,
      badge: prestamos.length > 0 ? String(prestamos.length) : undefined,
    },
    {
      id: "cheques",
      label: "Cheques",
      icon: <FileText className="h-4 w-4" />,
      badge: operacionesCheques.length > 0 ? String(operacionesCheques.length) : undefined,
    },
    ...(hasProductos
      ? [
          {
            id: "ventas",
            label: "Venta Financiada",
            icon: <ShoppingBag className="h-4 w-4" />,
            badge: ventasFinanciadas.length > 0 ? String(ventasFinanciadas.length) : undefined,
          },
        ]
      : []),
    {
      id: "legajo",
      label: "Legajo / Docs",
      icon: <FileText className="h-4 w-4" />,
      badge: cliente.legajo?.estado === "completo" ? "Completo" : "Incompleto",
    },
    {
      id: "riesgo",
      label: "Analisis de Riesgo",
      icon: <ShieldCheck className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{clienteNombre}</h2>
          <p className="text-sm text-slate-500">CUIT {cliente.cuit}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Tipo", cliente.tipo === "fisica" ? "Persona fisica" : "Persona juridica"],
              ["DNI", cliente.dni ?? "—"],
              ["Telefono", cliente.telefono ?? "—"],
              ["Email", cliente.email ?? "—"],
              ["Domicilio", cliente.domicilio ?? "—"],
              ["Localidad", cliente.localidad ?? "—"],
              ["Provincia", cliente.provincia ?? "—"],
              ["Saldo adeudado", ars(cliente.saldo_total_adeudado)],
              ["Tier vigente", cliente.tier_crediticio ? TIER_LABELS[cliente.tier_crediticio] : "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-400">{label}</dt>
                <dd className="font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <ClienteTabs activeTab={activeTab} onChange={setActiveTab} items={tabItems} />

      {activeTab === "resumen" && (
        <ClienteResumenCrediticio
          cliente={cliente}
          creditos={creditos}
          evaluacionVigente={evaluacionVigente}
        />
      )}

      {activeTab === "prestamos" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Prestamos ({prestamos.length})</h3>
            <Button size="sm" onClick={() => router.push(`/creditos/nuevo?clienteId=${id}`)}>
              Nuevo credito
            </Button>
          </div>

          <DataTable
            columns={creditoColumns}
            data={prestamos}
            emptyMessage="Sin prestamos registrados."
            onRowClick={(row) => router.push(`/creditos/${row.id}`)}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Cuenta corriente</h3>
              {cuentaCorriente && (
                <div className="flex gap-2 text-xs">
                  <span className="rounded-full border border-slate-200 px-3 py-1 font-mono text-slate-700">
                    Capital: {ars(cuentaCorriente.total_capital)}
                  </span>
                  <span className="rounded-full bg-green-100 px-3 py-1 font-mono text-green-800">
                    Total cobrado: {ars(cuentaCorriente.total_cobrado)}
                  </span>
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
      )}

      {activeTab === "cheques" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Operaciones de cheques ({operacionesCheques.length})
            </h3>
            <Button size="sm" variant="outline" onClick={() => router.push(`/operaciones-cheques?clienteId=${id}`)}>
              Ver todas
            </Button>
          </div>

          <DataTable
            columns={chequeColumns}
            data={operacionesCheques}
            emptyMessage="Sin operaciones de cheques."
            onRowClick={(row) => router.push(`/operaciones-cheques/${row.id}`)}
          />
        </div>
      )}

      {activeTab === "ventas" && hasProductos && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Ventas Financiadas ({ventasFinanciadas.length})
            </h3>
            <Button size="sm" variant="outline" onClick={() => router.push("/ventas-financiadas")}>
              Ver todas
            </Button>
          </div>

          <DataTable
            columns={ventaColumns}
            data={ventasFinanciadas}
            emptyMessage="Sin ventas financiadas para este cliente."
            onRowClick={(row) => router.push(`/creditos/${row.id}`)}
          />
        </div>
      )}

      {activeTab === "legajo" && (
        <ClienteLegajoTab cliente={cliente} onClienteUpdated={setCliente} />
      )}

      {activeTab === "riesgo" && (
        <TabAnalisisRiesgo
          clienteId={id}
          riesgo={riesgo}
          consultandoNosis={consultandoNosis}
          onConsultarNosis={consultarNosis}
        />
      )}
    </div>
  );
}
