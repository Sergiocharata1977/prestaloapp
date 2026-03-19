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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/fin/StatusBadge";
import { ClienteLegajoTab } from "@/components/fin/cliente/ClienteLegajoTab";
import { ClienteResumenCrediticio } from "@/components/fin/cliente/ClienteResumenCrediticio";
import { ClienteTabs } from "@/components/fin/cliente/ClienteTabs";

function ars(n?: number | null) {
  if (n === null || n === undefined) return "â€”";
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function formatDate(value?: string | null) {
  if (!value) return "â€”";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    render: (r) => (r.sistema === "frances" ? "FrancÃ©s" : "AlemÃ¡n"),
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

const chequeColumns: Column<FinOperacionCheque>[] = [
  {
    key: "numero_operacion",
    header: "Operación",
    render: (r) => r.numero_operacion ?? r.id.slice(0, 8),
  },
  {
    key: "fecha_operacion",
    header: "Fecha",
    render: (r) => r.fecha_operacion.slice(0, 10),
  },
  {
    key: "resumen",
    header: "Cheques",
    render: (r) => String(r.resumen?.cantidad_cheques ?? "—"),
  },
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
    header: "InterÃ©s",
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
  const [operacionesCheques, setOperacionesCheques] = useState<FinOperacionCheque[]>([]);
  const [cuentaCorriente, setCuentaCorriente] = useState<CuentaCorrienteData | null>(null);
  const [evaluaciones, setEvaluaciones] = useState<FinEvaluacion[]>([]);
  const [nosisConsultas, setNosisConsultas] = useState<FinClienteNosisConsulta[]>([]);
  const [loading, setLoading] = useState(true);
  const [consultandoNosis, setConsultandoNosis] = useState(false);
  const [activeTab, setActiveTab] = useState<"resumen" | "legajo">("resumen");

  const loadData = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const [clienteRes, creditosRes, chequesRes, ccRes, evaluacionesRes, nosisRes] = await Promise.all([
        apiFetch(`/api/fin/clientes/${id}`),
        apiFetch(`/api/fin/creditos?clienteId=${id}`),
        apiFetch(`/api/fin/operaciones-cheques?clienteId=${id}`),
        apiFetch(`/api/fin/clientes/${id}/cuenta-corriente`),
        apiFetch(`/api/fin/clientes/${id}/evaluacion`),
        apiFetch(`/api/fin/clientes/${id}/nosis`),
      ]);

      const clienteData = (await clienteRes.json()) as { cliente: FinCliente };
      const creditosData = (await creditosRes.json()) as { creditos: FinCredito[] };
      const chequesData = (await chequesRes.json()) as { operaciones: FinOperacionCheque[] };
      const ccData = (await ccRes.json()) as CuentaCorrienteData;
      const evaluacionesData = (await evaluacionesRes.json()) as { evaluaciones: FinEvaluacion[] };
      const nosisData = (await nosisRes.json()) as {
        data?: {
          historial?: FinClienteNosisConsulta[];
        };
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
      const res = await apiFetch(`/api/fin/clientes/${id}/nosis`, { method: "POST" });
      if (!res.ok) throw new Error("Error al consultar Nosis");
      await loadData();
    } finally {
      setConsultandoNosis(false);
    }
  };

  const evaluacionVigente = useMemo(
    () => evaluaciones.find((item) => item.es_vigente) ?? evaluaciones[0] ?? null,
    [evaluaciones]
  );
  const nosis = cliente?.nosis_ultimo;
  const ultimaConsultaNosis = nosisConsultas[0] ?? null;
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
    return <div className="py-16 text-center text-slate-500">Cliente no encontrado.</div>;
  }

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

      <Card>
        <CardHeader>
          <CardTitle>Datos del cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Tipo", cliente.tipo === "fisica" ? "Persona fÃ­sica" : "Persona jurÃ­dica"],
              ["DNI", cliente.dni ?? "â€”"],
              ["TelÃ©fono", cliente.telefono ?? "â€”"],
              ["Email", cliente.email ?? "â€”"],
              ["Domicilio", cliente.domicilio ?? "â€”"],
              ["Localidad", cliente.localidad ?? "â€”"],
              ["Provincia", cliente.provincia ?? "â€”"],
              ["Saldo adeudado", ars(cliente.saldo_total_adeudado)],
              ["Tier vigente", cliente.tier_crediticio ? TIER_LABELS[cliente.tier_crediticio] : "â€”"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-400">{label}</dt>
                <dd className="font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <ClienteTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        items={[
          {
            id: "resumen",
            label: "Resumen",
            icon: <Eye className="h-4 w-4" />,
          },
          {
            id: "legajo",
            label: "Legajo",
            icon: <FileText className="h-4 w-4" />,
            badge: legajoEstado === "completo" ? "Completo" : "Incompleto",
          },
        ]}
      />

      {activeTab === "legajo" ? (
        <ClienteLegajoTab cliente={cliente} onClienteUpdated={setCliente} />
      ) : (
        <>
          <ClienteResumenCrediticio
            cliente={cliente}
            creditos={creditos}
            evaluacionVigente={evaluacionVigente}
          />

          <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-slate-500" />
                  EvaluaciÃ³n crediticia
                </CardTitle>
                <div className="flex gap-2">
                  <Link href={`/clientes/${id}/evaluacion`}>
                    <Button size="sm">
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      Nueva evaluaciÃ³n
                    </Button>
                  </Link>
                  <Link href={`/clientes/${id}/evaluacion/historial`}>
                    <Button variant="outline" size="sm">
                      <History className="mr-2 h-4 w-4" />
                      Ver historial
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {evaluacionVigente ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Score calculado</div>
                        <div className="mt-1 text-3xl font-semibold text-slate-900">
                          {evaluacionVigente.score_final.toFixed(2)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Score Nosis</div>
                        <div className="mt-1 text-3xl font-semibold text-slate-900">
                          {evaluacionVigente.score_nosis ?? nosis?.score ?? "â€”"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Tier sugerido</div>
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
                                  (cliente.tier_crediticio ?? evaluacionVigente.tier_asignado)!
                                ]
                              }
                            >
                              {
                                TIER_LABELS[
                                  (cliente.tier_crediticio ?? evaluacionVigente.tier_asignado)!
                                ]
                              }
                            </Badge>
                          ) : (
                            <span className="text-sm text-slate-500">Pendiente</span>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="text-sm text-slate-500">LÃ­mite sugerido</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">
                          {ars(
                            evaluacionVigente.limite_sugerido ??
                              evaluacionVigente.limite_credito_sugerido
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="text-sm text-slate-500">LÃ­mite asignado</div>
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
                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="text-sm text-slate-500">Cualitativos</div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">
                          {evaluacionVigente.score_cualitativo.toFixed(2)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="text-sm text-slate-500">Conflictos</div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">
                          {evaluacionVigente.score_conflictos.toFixed(2)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="text-sm text-slate-500">Cuantitativos</div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">
                          {evaluacionVigente.score_cuantitativo.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Link href={`/clientes/${id}/evaluacion`}>
                        <Button variant="outline" size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          Ver tablero de evaluaciÃ³n
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Este cliente todavÃ­a no tiene evaluaciÃ³n crediticia registrada.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>InformaciÃ³n Nosis</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={consultarNosis}
                  disabled={consultandoNosis}
                >
                  <RefreshCw className={`h-3 w-3 ${consultandoNosis ? "animate-spin" : ""}`} />
                  {consultandoNosis ? "Consultando..." : "Consultar Nosis"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {nosis ? (
                  <>
                    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-400">Score</dt>
                        <dd className="font-medium">{nosis.score ?? "N/D"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">SituaciÃ³n BCRA</dt>
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
                        <dd className="font-medium">{formatDate(nosis.fecha)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">Consultado por</dt>
                        <dd className="font-medium">{nosis.consultado_por}</dd>
                      </div>
                    </dl>

                    <div className="space-y-2 border-t border-slate-100 pt-4">
                      <div className="text-sm font-medium text-slate-900">Historial reciente</div>
                      {nosisConsultas.slice(0, 3).map((consulta) => (
                        <div
                          key={consulta.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm"
                        >
                          <div>
                            <div className="font-medium text-slate-900">
                              {formatDate(consulta.fecha_consulta)}
                            </div>
                            <div className="text-slate-500">
                              Score {consulta.score ?? "â€”"} Â· BCRA{" "}
                              {consulta.situacion_bcra ?? "â€”"}
                            </div>
                          </div>
                          <Badge
                            className={
                              consulta.estado === "exitoso"
                                ? "bg-green-100 text-green-800 border-green-200"
                                : "bg-red-100 text-red-800 border-red-200"
                            }
                          >
                            {consulta.estado}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">
                    Sin datos Nosis. HacÃ© clic en &quot;Consultar Nosis&quot;.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">CrÃ©ditos</h3>
              <Button size="sm" onClick={() => router.push(`/creditos/nuevo?clienteId=${id}`)}>
                Nuevo crÃ©dito
              </Button>
            </div>
            <DataTable
              columns={creditoColumns}
              data={creditos}
              emptyMessage="Sin crÃ©ditos registrados."
              onRowClick={(row) => router.push(`/creditos/${row.id}`)}
            />
          </div>

          {operacionesCheques.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Operaciones de cheques</h3>
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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Cuenta corriente</h3>
              <div className="flex items-center gap-3">
                <Link href={`/clientes/${id}/cuenta-corriente`}>
                  <Button variant="outline" size="sm">
                    <History className="mr-1 h-3 w-3" />
                    Cuenta corriente
                  </Button>
                </Link>
                {cuentaCorriente && (
                  <div className="flex gap-3">
                    <Badge variant="outline" className="font-mono">
                      Capital: {ars(cuentaCorriente.total_capital)}
                    </Badge>
                    <Badge variant="outline" className="font-mono">
                      Intereses: {ars(cuentaCorriente.total_intereses)}
                    </Badge>
                    <Badge className="bg-green-100 font-mono text-green-800">
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
        </>
      )}
    </div>
  );
}
