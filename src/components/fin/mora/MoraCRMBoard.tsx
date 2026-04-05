"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { BellRing, FileWarning, Gavel, PhoneCall, Scale } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import type {
  FinClienteMoraResumen,
  FinMoraAccion,
  FinMoraAccionClase,
  FinMoraEtapa,
} from "@/types/fin-mora";
import type { FinTipoCliente } from "@/types/fin-tipo-cliente";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function fullName(cliente: FinClienteMoraResumen) {
  return cliente.tipo === "fisica"
    ? `${cliente.apellido ?? ""}, ${cliente.nombre}`.replace(/^,\s*/, "")
    : cliente.nombre;
}

function etapaLabel(etapa: FinMoraEtapa) {
  switch (etapa) {
    case "pre_judicial":
      return "Pre judicial";
    case "judicial":
      return "Judicial";
    default:
      return "Sin gestión";
  }
}

function tipoLabel(tipo: string) {
  const labels: Record<string, string> = {
    llamado: "Llamado",
    whatsapp: "WhatsApp",
    email: "Email",
    carta_documento: "Carta documento",
    visita: "Visita",
    acuerdo: "Acuerdo",
    derivacion_estudio: "Derivación estudio",
    demanda: "Demanda",
    nota_interna: "Nota interna",
  };

  return labels[tipo] ?? tipo;
}

const columns: Column<FinClienteMoraResumen>[] = [
  {
    key: "nombre",
    header: "Cliente",
    render: (row) => (
      <div>
        <p className="font-medium text-slate-900">{fullName(row)}</p>
        <p className="text-xs text-slate-400">{row.cuit}</p>
      </div>
    ),
  },
  {
    key: "tipo_cliente_nombre",
    header: "Clasificación",
    render: (row) => row.tipo_cliente_nombre || "Sin tipo",
  },
  {
    key: "creditos_en_mora_count",
    header: "Créditos mora",
    render: (row) =>
      `${row.creditos_en_mora_count + row.creditos_incobrables_count} caso(s)`,
  },
  {
    key: "saldo_vencido",
    header: "Saldo vencido",
    className: "text-right font-mono font-semibold",
    render: (row) => ars(row.saldo_vencido),
  },
  {
    key: "dias_max_mora",
    header: "Días mora",
    className: "text-center",
    render: (row) => String(row.dias_max_mora),
  },
  {
    key: "mora_etapa",
    header: "Etapa",
    render: (row) => (
      <Badge
        variant="outline"
        className={
          row.mora_etapa === "judicial"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
        }
      >
        {etapaLabel(row.mora_etapa)}
      </Badge>
    ),
  },
];

type Props = {
  clase: FinMoraAccionClase;
  title: string;
  description: string;
};

export function MoraCRMBoard({ clase, title, description }: Props) {
  const [clientes, setClientes] = useState<FinClienteMoraResumen[]>([]);
  const [acciones, setAcciones] = useState<FinMoraAccion[]>([]);
  const [tipos, setTipos] = useState<FinTipoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tipoClienteId, setTipoClienteId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<FinMoraEtapa>(clase);
  const [motivo, setMotivo] = useState("");
  const [proximaAccion, setProximaAccion] = useState("");
  const [accionTipo, setAccionTipo] = useState(
    clase === "judicial" ? "derivacion_estudio" : "llamado"
  );
  const [resultado, setResultado] = useState("");
  const [notas, setNotas] = useState("");

  const fetchData = async (params?: { q?: string; tipoClienteId?: string }) => {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({ etapa: clase });
    if (params?.q) {
      query.set("q", params.q);
    }
    if (params?.tipoClienteId) {
      query.set("tipoClienteId", params.tipoClienteId);
    }

    try {
      const [clientesRes, accionesRes, tiposRes] = await Promise.all([
        apiFetch(`/api/fin/control-mora/clientes?${query.toString()}`),
        apiFetch(`/api/fin/control-mora/acciones?clase=${clase}`),
        apiFetch("/api/fin/tipos-cliente"),
      ]);

      const [clientesData, accionesData, tiposData] = await Promise.all([
        clientesRes.json(),
        accionesRes.json(),
        tiposRes.json(),
      ]);

      const nextClientes = (clientesData as { clientes?: FinClienteMoraResumen[] }).clientes ?? [];
      setClientes(nextClientes);
      setAcciones((accionesData as { acciones?: FinMoraAccion[] }).acciones ?? []);
      setTipos((tiposData as { tipos?: FinTipoCliente[] }).tipos ?? []);
      setSelectedId((current) => current ?? nextClientes[0]?.id ?? null);
    } catch {
      setError("No se pudo cargar la cartera en mora.");
      setClientes([]);
      setAcciones([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchData = useEffectEvent(fetchData);

  useEffect(() => {
    void handleFetchData();
  }, [clase]);

  const selectedCliente = useMemo(
    () => clientes.find((cliente) => cliente.id === selectedId) ?? null,
    [clientes, selectedId]
  );

  useEffect(() => {
    if (!selectedCliente) {
      setEtapa(clase);
      setMotivo("");
      setProximaAccion("");
      return;
    }

    setEtapa(selectedCliente.mora_etapa);
    setMotivo(selectedCliente.gestion_mora_motivo ?? "");
    setProximaAccion(selectedCliente.proxima_accion_at ?? "");
  }, [selectedCliente, clase]);

  const accionesCliente = useMemo(
    () =>
      acciones.filter(
        (accion) => accion.cliente_id === selectedId && accion.clase === clase
      ),
    [acciones, clase, selectedId]
  );

  const summary = useMemo(() => {
    const cartera = clientes.reduce((acc, cliente) => acc + cliente.saldo_vencido, 0);
    return {
      cartera,
      clientes: clientes.length,
      accionesPendientes: clientes.filter((cliente) => cliente.proxima_accion_at).length,
    };
  }, [clientes]);

  const saveEtapa = async () => {
    if (!selectedCliente) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/fin/control-mora/clientes/${selectedCliente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etapa,
          motivo,
          proxima_accion_at: proximaAccion || undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo actualizar la etapa");
      }

      await fetchData({ q, tipoClienteId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la etapa.");
    } finally {
      setSaving(false);
    }
  };

  const submitAccion = async () => {
    if (!selectedCliente || !resultado.trim()) {
      setError("Seleccioná un cliente y cargá el resultado de la gestión.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/fin/control-mora/acciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: selectedCliente.id,
          clase,
          tipo: accionTipo,
          resultado,
          notas: notas || undefined,
          proxima_accion_at: proximaAccion || undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo registrar la acción");
      }

      setResultado("");
      setNotas("");
      await fetchData({ q, tipoClienteId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la acción.");
    } finally {
      setSaving(false);
    }
  };

  const practices =
    clase === "judicial"
      ? [
          "Derivación formal a estudio con evidencia consolidada y fecha.",
          "Registro del estado procesal y próxima acción obligatoria.",
          "Congelar excepciones comerciales mientras el caso siga judicializado.",
        ]
      : [
          "Primer contacto dentro de 24 horas del vencimiento.",
          "Promesa de pago siempre con fecha y canal registrado.",
          "Escalar a intimación formal si no hay respuesta.",
        ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          Control de mora
        </Badge>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="max-w-3xl text-sm text-slate-500">{description}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Clientes en gestión",
            value: String(summary.clientes),
            detail: "Misma base de clientes, filtrada por etapa",
            icon: clase === "judicial" ? Scale : BellRing,
          },
          {
            label: "Saldo vencido",
            value: ars(summary.cartera),
            detail: "Capital y cheques observados",
            icon: FileWarning,
          },
          {
            label: "Próximas acciones",
            value: String(summary.accionesPendientes),
            detail: "Casos con seguimiento agendado",
            icon: clase === "judicial" ? Gavel : PhoneCall,
          },
        ].map(({ label, value, detail, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
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

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar cliente o CUIT"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="max-w-sm"
        />
        <Select value={tipoClienteId || "todos"} onValueChange={(value) => setTipoClienteId(value === "todos" ? "" : value)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {tipos.map((tipo) => (
              <SelectItem key={tipo.id} value={tipo.id}>
                {tipo.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => void fetchData({ q, tipoClienteId })}>
          Filtrar
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Cartera filtrada por cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={clientes}
              loading={loading}
              emptyMessage="No hay clientes en esta etapa."
              onRowClick={(row) => setSelectedId(row.id)}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ficha de gestión</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedCliente ? (
                <p className="text-sm text-slate-400">
                  Seleccioná un cliente para gestionar la mora.
                </p>
              ) : (
                <>
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      {fullName(selectedCliente)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {selectedCliente.cuit} · {ars(selectedCliente.saldo_vencido)} ·{" "}
                      {selectedCliente.dias_max_mora} día(s) de mora
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Etapa
                      </p>
                      <Select
                        value={etapa}
                        onValueChange={(value) => setEtapa(value as FinMoraEtapa)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sin_gestion">Sin gestión</SelectItem>
                          <SelectItem value="pre_judicial">Pre judicial</SelectItem>
                          <SelectItem value="judicial">Judicial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Próxima acción
                      </p>
                      <Input
                        type="date"
                        value={proximaAccion ? proximaAccion.slice(0, 10) : ""}
                        onChange={(event) => setProximaAccion(event.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Motivo / estado actual
                    </p>
                    <Textarea
                      value={motivo}
                      onChange={(event) => setMotivo(event.target.value)}
                      placeholder="Resumen corto del pase o estado del caso"
                    />
                  </div>

                  <Button onClick={() => void saveEtapa()} disabled={saving}>
                    Guardar etapa
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acción CRM</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Tipo
                </p>
                <Select value={accionTipo} onValueChange={setAccionTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "llamado",
                      "whatsapp",
                      "email",
                      "carta_documento",
                      "visita",
                      "acuerdo",
                      "derivacion_estudio",
                      "demanda",
                      "nota_interna",
                    ].map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipoLabel(tipo)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Resultado
                </p>
                <Input
                  value={resultado}
                  onChange={(event) => setResultado(event.target.value)}
                  placeholder="Ej. intimado, promesa de pago, enviado a estudio"
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Notas
                </p>
                <Textarea
                  value={notas}
                  onChange={(event) => setNotas(event.target.value)}
                  placeholder="Detalle de la gestión realizada"
                />
              </div>

              <Button onClick={() => void submitAccion()} disabled={saving || !selectedCliente}>
                Registrar acción
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Acciones registradas</CardTitle>
          </CardHeader>
          <CardContent>
            {accionesCliente.length === 0 ? (
              <p className="text-sm text-slate-400">No hay acciones para el cliente seleccionado.</p>
            ) : (
              <div className="space-y-3">
                {accionesCliente.map((accion) => (
                  <div
                    key={accion.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          {tipoLabel(accion.tipo)} · {accion.resultado}
                        </p>
                        <p className="text-xs text-slate-500">
                          {accion.created_at.slice(0, 10)} · {accion.created_by.nombre}
                        </p>
                      </div>
                      <Badge variant="outline">{etapaLabel(accion.clase)}</Badge>
                    </div>
                    {accion.notas && (
                      <p className="mt-2 text-sm text-slate-600">{accion.notas}</p>
                    )}
                    {accion.proxima_accion_at && (
                      <p className="mt-2 text-xs text-amber-700">
                        Próxima acción: {accion.proxima_accion_at.slice(0, 10)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Procedimiento operativo</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm text-slate-600">
              {practices.map((practice, index) => (
                <li key={practice}>
                  {index + 1}. {practice}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
