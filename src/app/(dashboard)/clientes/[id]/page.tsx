"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardCheck,
  Eye,
  FileText,
  History,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import type {
  FinCliente,
  FinClienteNosisConsulta,
} from "@/types/fin-cliente";
import type { FinCredito } from "@/types/fin-credito";
import type { FinCobro } from "@/types/fin-cobro";
import type { EvaluacionTier, FinEvaluacion } from "@/types/fin-evaluacion";
import type { FinOperacionCheque } from "@/types/fin-operacion-cheque";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/hooks/useAuth";
import { CAPABILITIES } from "@/lib/capabilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/fin/StatusBadge";
import { ClienteLegajoTab } from "@/components/fin/cliente/ClienteLegajoTab";
import { ClienteResumenCrediticio } from "@/components/fin/cliente/ClienteResumenCrediticio";
import { ClienteTabs } from "@/components/fin/cliente/ClienteTabs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-AR");
}

const TIER_STYLES: Record<EvaluacionTier, string> = {
  A: "bg-green-100 text-green-800 border-green-200",
  B: "bg-blue-100 text-blue-800 border-blue-200",
  C: "bg-yellow-100 text-yellow-800 border-yellow-200",
  reprobado: "bg-red-100 text-red-800 border-red-200",
};

const TIER_LABELS: Record<EvaluacionTier, string> = {
  A: "Tier A",
  B: "Tier B",
  C: "Tier C",
  reprobado: "Reprobado",
};

function estadoClass(estado?: FinEvaluacion["estado"]) {
  if (estado === "aprobada") return "bg-green-100 text-green-800 border-green-200";
  if (estado === "rechazada") return "bg-red-100 text-red-800 border-red-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const creditoColumns: Column<FinCredito>[] = [
  { key: "numero_credito", header: "Nro", width: "90px" },
  { key: "articulo_descripcion", header: "Artículo", className: "text-sm" },
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
  { key: "articulo_descripcion", header: "Bien / Artículo", className: "text-sm" },
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
    header: "Operación",
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
    render: (r) => <Badge variant="outline">{r.estado}</Badge>,
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ClienteDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { capabilities } = useAuth();
  const hasProductos = capabilities.includes(CAPABILITIES.PRODUCTOS);

  const [cliente, setCliente] = useState<FinCliente | null>(null);
  const [creditos, setCreditos] = useState<FinCredito[]>([]);
  const [operacionesCheques, setOperacionesCheques] = useState<FinOperacionCheque[]>([]);
  const [cuentaCorriente, setCuentaCorriente] = useState<CuentaCorrienteData | null>(null);
  const [evaluaciones, setEvaluaciones] = useState<FinEvaluacion[]>([]);
  const [nosisConsultas, setNosisConsultas] = useState<FinClienteNosisConsulta[]>([]);
  const [loading, setLoading] = useState(true);
  const [consultandoNosis, setConsultandoNosis] = useState(false);
  const [activeTab, setActiveTab] = useState("resumen");

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [clienteRes, creditosRes, chequesRes, ccRes, evaluacionesRes, nosisRes] =
        await Promise.all([
          apiFetch(`/api/fin/clientes/${id}`),
          apiFetch(`/api/fin/creditos?clienteId=${id}`),
          apiFetch(`/api/fin/operaciones-cheques?clienteId=${id}`),
          apiFetch(`/api/fin/clientes/${id}/cuenta-corriente`),
          apiFetch(`/api/fin/clientes/${id}/evaluacion`),
          apiFetch(`/api/fin/clientes/${id}/nosis`),
        ]);

      const clienteData = (await clienteRes.json()) as { cliente: FinCliente };
      const creditosData = (await creditosRes.json()) as { creditos: FinCredito[] };
      const chequesData = (await chequesRes.json()) as {
        operaciones: FinOperacionCheque[];
      };
      const ccData = (await ccRes.json()) as CuentaCorrienteData;
      const evaluacionesData = (await evaluacionesRes.json()) as {
        evaluaciones: FinEvaluacion[];
      };
      const nosisData = (await nosisRes.json()) as {
        data?: { historial?: FinClienteNosisConsulta[] };
      };

      setCliente(clienteData.cliente);
      setCreditos(creditosData.creditos ?? []);
      setOperacionesCheques(chequesData.operaciones ?? []);
      setCuentaCorriente(ccData);
      setEvaluaciones(evaluacionesData.evaluaciones ?? []);
      setNosisConsultas(nosisData.data?.historial ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

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

  const evaluacionVigente = useMemo(
    () => evaluaciones.find((e) => e.es_vigente) ?? evaluaciones[0] ?? null,
    [evaluaciones]
  );

  const prestamos = useMemo(
    () => creditos.filter((c) => c.tipo_operacion !== "compra_financiada"),
    [creditos]
  );

  const ventasFinanciadas = useMemo(
    () => creditos.filter((c) => c.tipo_operacion === "compra_financiada"),
    [creditos]
  );

  const nosis = cliente?.nosis_ultimo;
  const legajoEstado = cliente?.legajo?.estado ?? "incompleto";

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
    return (
      <div className="py-16 text-center text-slate-500">Cliente no encontrado.</div>
    );
  }

  const clienteNombre =
    cliente.tipo === "fisica"
      ? `${cliente.apellido ?? ""}, ${cliente.nombre}`.replace(/^,\s*/, "").trim()
      : cliente.nombre;

  const tabItems = [
    { id: "resumen",   label: "Resumen",          icon: <Eye className="h-4 w-4" /> },
    {
      id: "prestamos",
      label: "Préstamos",
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
            badge:
              ventasFinanciadas.length > 0 ? String(ventasFinanciadas.length) : undefined,
          },
        ]
      : []),
    {
      id: "legajo",
      label: "Legajo / Docs",
      icon: <FileText className="h-4 w-4" />,
      badge: legajoEstado === "completo" ? "Completo" : "Incompleto",
    },
    {
      id: "riesgo",
      label: "Análisis de Riesgo",
      icon: <ShieldCheck className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{clienteNombre}</h2>
          <p className="text-sm text-slate-500">CUIT {cliente.cuit}</p>
        </div>
      </div>

      {/* Datos del cliente */}
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
              [
                "Tier vigente",
                cliente.tier_crediticio ? TIER_LABELS[cliente.tier_crediticio] : "—",
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

      {/* Tab bar */}
      <ClienteTabs activeTab={activeTab} onChange={setActiveTab} items={tabItems} />

      {/* ── TAB: RESUMEN ──────────────────────────────────────────────────── */}
      {activeTab === "resumen" && (
        <ClienteResumenCrediticio
          cliente={cliente}
          creditos={creditos}
          evaluacionVigente={evaluacionVigente}
        />
      )}

      {/* ── TAB: PRÉSTAMOS ────────────────────────────────────────────────── */}
      {activeTab === "prestamos" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Préstamos ({prestamos.length})
            </h3>
            <Button
              size="sm"
              onClick={() => router.push(`/creditos/nuevo?clienteId=${id}`)}
            >
              Nuevo crédito
            </Button>
          </div>

          <DataTable
            columns={creditoColumns}
            data={prestamos}
            emptyMessage="Sin préstamos registrados."
            onRowClick={(row) => router.push(`/creditos/${row.id}`)}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Cuenta corriente</h3>
              <div className="flex items-center gap-3">
                <Link href={`/clientes/${id}/cuenta-corriente`}>
                  <Button variant="outline" size="sm">
                    <History className="mr-1 h-3 w-3" />
                    Ver completo
                  </Button>
                </Link>
                {cuentaCorriente && (
                  <div className="flex gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      Capital: {ars(cuentaCorriente.total_capital)}
                    </Badge>
                    <Badge className="bg-green-100 font-mono text-xs text-green-800">
                      Total cobrado: {ars(cuentaCorriente.total_cobrado)}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            <DataTable
              columns={cobroColumns}
              data={cuentaCorriente?.cobros ?? []}
              emptyMessage="Sin cobros registrados."
            />
          </div>
        </div>
      )}

      {/* ── TAB: CHEQUES ──────────────────────────────────────────────────── */}
      {activeTab === "cheques" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Operaciones de cheques ({operacionesCheques.length})
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/operaciones-cheques?clienteId=${id}`)}
            >
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

      {/* ── TAB: VENTA FINANCIADA (plugin productos) ──────────────────────── */}
      {activeTab === "ventas" && hasProductos && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Ventas Financiadas ({ventasFinanciadas.length})
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/ventas-financiadas")}
            >
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

      {/* ── TAB: LEGAJO / DOCUMENTACIÓN ───────────────────────────────────── */}
      {activeTab === "legajo" && (
        <ClienteLegajoTab cliente={cliente} onClienteUpdated={setCliente} />
      )}

      {/* ── TAB: ANÁLISIS DE RIESGO ───────────────────────────────────────── */}
      {activeTab === "riesgo" && (
        <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          {/* Evaluación crediticia */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-500" />
                Evaluación crediticia
              </CardTitle>
              <div className="flex gap-2">
                <Link href={`/clientes/${id}/evaluacion`}>
                  <Button size="sm">
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Nueva evaluación
                  </Button>
                </Link>
                <Link href={`/clientes/${id}/evaluacion/historial`}>
                  <Button variant="outline" size="sm">
                    <History className="mr-2 h-4 w-4" />
                    Historial
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {evaluacionVigente ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Score final
                      </div>
                      <div className="mt-1 text-3xl font-semibold text-slate-900">
                        {evaluacionVigente.score_final.toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Score Nosis
                      </div>
                      <div className="mt-1 text-3xl font-semibold text-slate-900">
                        {evaluacionVigente.score_nosis ?? nosis?.score ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Tier sugerido
                      </div>
                      <div className="mt-2">
                        <Badge
                          className={
                            TIER_STYLES[
                              evaluacionVigente.tier_sugerido ?? evaluacionVigente.tier
                            ]
                          }
                        >
                          {TIER_LABELS[
                            evaluacionVigente.tier_sugerido ?? evaluacionVigente.tier
                          ]}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Estado</div>
                      <div className="mt-2">
                        <Badge className={estadoClass(evaluacionVigente.estado)}>
                          {evaluacionVigente.estado}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-sm text-slate-500">Tier asignado</div>
                      <div className="mt-2">
                        {cliente.tier_crediticio || evaluacionVigente.tier_asignado ? (
                          <Badge
                            className={
                              TIER_STYLES[
                                (cliente.tier_crediticio ??
                                  evaluacionVigente.tier_asignado)!
                              ]
                            }
                          >
                            {
                              TIER_LABELS[
                                (cliente.tier_crediticio ??
                                  evaluacionVigente.tier_asignado)!
                              ]
                            }
                          </Badge>
                        ) : (
                          <span className="text-sm text-slate-500">Pendiente</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-sm text-slate-500">Límite sugerido</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">
                        {ars(
                          evaluacionVigente.limite_sugerido ??
                            evaluacionVigente.limite_credito_sugerido
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-sm text-slate-500">Límite asignado</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">
                        {ars(
                          cliente.limite_credito_asignado ??
                            cliente.limite_credito_vigente ??
                            evaluacionVigente.limite_credito_asignado
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-sm text-slate-500">Vigencia</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {formatDate(
                          cliente.evaluacion_vigente_hasta ?? evaluacionVigente.updated_at
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      ["Cualitativos", evaluacionVigente.score_cualitativo.toFixed(2)],
                      ["Conflictos", evaluacionVigente.score_conflictos.toFixed(2)],
                      ["Cuantitativos", evaluacionVigente.score_cuantitativo.toFixed(2)],
                    ].map(([label, val]) => (
                      <div key={label} className="rounded-xl border border-slate-200 p-4">
                        <div className="text-sm text-slate-500">{label}</div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">{val}</div>
                      </div>
                    ))}
                  </div>

                  {evaluaciones.length > 1 && (
                    <div className="space-y-2 border-t border-slate-100 pt-4">
                      <div className="text-sm font-medium text-slate-700">
                        Historial de evaluaciones
                      </div>
                      {evaluaciones.map((ev) => (
                        <div
                          key={ev.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm"
                        >
                          <div>
                            <span className="font-medium">{formatDate(ev.fecha)}</span>
                            <span className="ml-2 text-slate-500">
                              Score {ev.score_final.toFixed(0)} ·{" "}
                              {TIER_LABELS[ev.tier_sugerido ?? ev.tier]}
                            </span>
                          </div>
                          <Badge className={estadoClass(ev.estado)}>{ev.estado}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">Sin evaluación crediticia registrada.</p>
              )}
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
                <RefreshCw
                  className={`h-3 w-3 ${consultandoNosis ? "animate-spin" : ""}`}
                />
                {consultandoNosis ? "Consultando..." : "Consultar Nosis"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {nosis ? (
                <>
                  <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    {[
                      ["Score", nosis.score ?? "N/D"],
                      ["Situación BCRA", nosis.situacion_bcra ?? "N/D"],
                      ["Cheques rechazados", String(nosis.cheques_rechazados)],
                      ["Juicios activos", String(nosis.juicios_activos)],
                      ["Fecha consulta", formatDateTime(nosis.fecha)],
                      ["Consultado por", nosis.consultado_por],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <dt className="text-slate-400">{label}</dt>
                        <dd className="font-medium">{val}</dd>
                      </div>
                    ))}
                  </dl>

                  {nosisConsultas.length > 0 && (
                    <div className="space-y-2 border-t border-slate-100 pt-4">
                      <div className="text-sm font-medium text-slate-900">
                        Consultas recientes
                      </div>
                      {nosisConsultas.slice(0, 4).map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm"
                        >
                          <div>
                            <div className="font-medium">
                              {formatDateTime(c.fecha_consulta)}
                            </div>
                            <div className="text-slate-500">
                              Score {c.score ?? "—"} · BCRA {c.situacion_bcra ?? "—"}
                            </div>
                          </div>
                          <Badge
                            className={
                              c.estado === "exitoso"
                                ? "bg-green-100 text-green-800 border-green-200"
                                : "bg-red-100 text-red-800 border-red-200"
                            }
                          >
                            {c.estado}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  Sin datos Nosis. Hacé clic en &quot;Consultar Nosis&quot;.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
