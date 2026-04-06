"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Filter,
  HandCoins,
  Siren,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import type {
  FinClienteMoraResumen,
  FinMoraAgendaItem,
  FinMoraAccionEstado,
  FinMoraEtapa,
  FinMoraAccionPrioridad,
  FinMoraAccionTipo,
} from "@/types/fin-mora";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type QuickFilter = "all" | "overdue" | "today" | "promises";

type AgendaRow = FinMoraAgendaItem & {
  clienteNombre: string;
  clienteDocumento: string;
  diasAtrasoCliente: number;
  agendaDeltaDias: number;
  isOverdue: boolean;
  isToday: boolean;
  isPromise: boolean;
};

function fullName(cliente: FinClienteMoraResumen) {
  return cliente.tipo === "fisica"
    ? `${cliente.apellido ?? ""}, ${cliente.nombre}`.replace(/^,\s*/, "")
    : cliente.nombre;
}

function etapaLabel(etapa: FinMoraEtapa) {
  switch (etapa) {
    case "mora_temprana":
      return "Mora temprana";
    case "pre_judicial":
      return "Pre judicial";
    case "judicial":
      return "Judicial";
    default:
      return "Sin gestion";
  }
}

function estadoLabel(estado: FinMoraAccionEstado) {
  switch (estado) {
    case "pendiente":
      return "Pendiente";
    case "programada":
      return "Programada";
    case "en_curso":
      return "En curso";
    case "ejecutada":
      return "Realizada";
    case "cancelada":
      return "Cancelada";
    case "vencida":
      return "Vencida";
    default:
      return estado;
  }
}

function prioridadLabel(prioridad: FinMoraAccionPrioridad) {
  switch (prioridad) {
    case "baja":
      return "Baja";
    case "media":
      return "Media";
    case "alta":
      return "Alta";
    case "urgente":
      return "Urgente";
    default:
      return prioridad;
  }
}

function tipoLabel(tipo: FinMoraAccionTipo) {
  const labels: Record<FinMoraAccionTipo, string> = {
    llamado: "Llamado",
    whatsapp: "WhatsApp",
    email: "Email",
    carta_documento: "Carta documento",
    visita: "Visita",
    acuerdo: "Acuerdo",
    derivacion_estudio: "Derivacion a estudio",
    demanda: "Demanda",
    nota_interna: "Nota interna",
    sms: "SMS",
    tarea: "Tarea",
    recordatorio: "Recordatorio",
    audiencia: "Audiencia",
    presentacion_judicial: "Presentacion judicial",
    gestion_documental: "Gestion documental",
    actualizacion_estado: "Actualizacion de estado",
  };

  return labels[tipo] ?? tipo;
}

function formatDate(value?: string) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(date);
}

function diffCalendarDays(value?: string) {
  if (!value) {
    return 0;
  }

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return 0;
  }

  const now = new Date();
  const startToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = Date.UTC(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  );

  return Math.floor((startTarget - startToday) / 86400000);
}

function timingLabel(row: AgendaRow) {
  if (row.isOverdue) {
    return `Vencida hace ${Math.abs(row.agendaDeltaDias)} d`;
  }

  if (row.isToday) {
    return "Vence hoy";
  }

  if (row.diasAtrasoCliente > 0) {
    return `${row.diasAtrasoCliente} d mora`;
  }

  return `Vence en ${row.agendaDeltaDias} d`;
}

function prioridadClasses(prioridad: FinMoraAccionPrioridad) {
  switch (prioridad) {
    case "urgente":
      return "border-red-200 bg-red-50 text-red-700";
    case "alta":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "media":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function estadoClasses(estado: FinMoraAccionEstado) {
  switch (estado) {
    case "vencida":
      return "border-red-200 bg-red-50 text-red-700";
    case "en_curso":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "programada":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

const columns: Column<AgendaRow>[] = [
  {
    key: "cliente",
    header: "Cliente",
    render: (row) => (
      <div>
        <p className="font-medium text-slate-900">{row.clienteNombre}</p>
        <p className="text-xs text-slate-400">{row.clienteDocumento}</p>
      </div>
    ),
  },
  {
    key: "etapa",
    header: "Etapa",
    render: (row) => etapaLabel(row.etapa),
  },
  {
    key: "tipo",
    header: "Tipo de accion",
    render: (row) => (
      <div>
        <p className="font-medium text-slate-800">{tipoLabel(row.tipo)}</p>
        <p className="text-xs text-slate-400">{row.titulo}</p>
      </div>
    ),
  },
  {
    key: "estado",
    header: "Estado",
    render: (row) => (
      <Badge variant="outline" className={estadoClasses(row.estado)}>
        {estadoLabel(row.estado)}
      </Badge>
    ),
  },
  {
    key: "prioridad",
    header: "Prioridad",
    render: (row) => (
      <Badge variant="outline" className={prioridadClasses(row.prioridad)}>
        {prioridadLabel(row.prioridad)}
      </Badge>
    ),
  },
  {
    key: "responsable",
    header: "Responsable",
    render: (row) => row.responsable_nombre || "Sin asignar",
  },
  {
    key: "proxima_accion",
    header: "Proxima accion",
    render: (row) => (
      <div>
        <p className="font-medium text-slate-800">{formatDate(row.programada_at)}</p>
        <p className="text-xs text-slate-400">{row.descripcion || "Seguimiento operativo"}</p>
      </div>
    ),
  },
  {
    key: "timing",
    header: "Dias de atraso / venc.",
    className: "whitespace-nowrap font-medium",
    render: (row) => timingLabel(row),
  },
];

export function MoraAgendaBoard() {
  const [agenda, setAgenda] = useState<FinMoraAgendaItem[]>([]);
  const [clientes, setClientes] = useState<FinClienteMoraResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [etapa, setEtapa] = useState<"all" | FinMoraEtapa>("all");
  const [estado, setEstado] = useState<"all" | FinMoraAccionEstado>("all");
  const [responsable, setResponsable] = useState("all");
  const [soloVencidas, setSoloVencidas] = useState(false);

  const fetchAgenda = async () => {
    setLoading(true);
    setError(null);

    const query = new URLSearchParams();
    if (etapa !== "all") {
      query.set("etapa", etapa);
    }
    if (estado !== "all") {
      query.set("estado", estado);
    }
    if (responsable !== "all") {
      query.set("responsableUserId", responsable);
    }
    if (soloVencidas) {
      query.set("soloVencidas", "true");
    }

    const agendaUrl = query.size
      ? `/api/fin/control-mora/agenda?${query.toString()}`
      : "/api/fin/control-mora/agenda";

    try {
      const [agendaRes, clientesRes] = await Promise.all([
        apiFetch(agendaUrl),
        apiFetch("/api/fin/control-mora/clientes"),
      ]);

      const [agendaData, clientesData] = await Promise.all([
        agendaRes.json(),
        clientesRes.json(),
      ]);

      setAgenda((agendaData as { agenda?: FinMoraAgendaItem[] }).agenda ?? []);
      setClientes((clientesData as { clientes?: FinClienteMoraResumen[] }).clientes ?? []);
    } catch {
      setError("No se pudo cargar la agenda operativa de cobranzas.");
      setAgenda([]);
      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchAgenda = useEffectEvent(fetchAgenda);

  useEffect(() => {
    void handleFetchAgenda();
  }, [etapa, estado, responsable, soloVencidas]);

  const clientesById = useMemo(
    () => new Map(clientes.map((cliente) => [cliente.id, cliente])),
    [clientes]
  );

  const rows = useMemo<AgendaRow[]>(() => {
    return agenda.map((item) => {
      const cliente = clientesById.get(item.cliente_id);
      const agendaDeltaDias = diffCalendarDays(item.programada_at);
      const isOverdue = agendaDeltaDias < 0 || item.estado === "vencida";
      const isToday = agendaDeltaDias === 0;
      const text = `${item.titulo} ${item.descripcion ?? ""}`.toLowerCase();
      const isPromise =
        item.tipo === "acuerdo" ||
        text.includes("promesa") ||
        text.includes("compromiso pago") ||
        text.includes("compromiso de pago");

      return {
        ...item,
        clienteNombre: cliente ? fullName(cliente) : "Cliente no disponible",
        clienteDocumento: cliente?.cuit ?? item.cliente_id,
        diasAtrasoCliente: cliente?.dias_max_mora ?? 0,
        agendaDeltaDias,
        isOverdue,
        isToday,
        isPromise,
      };
    });
  }, [agenda, clientesById]);

  const rowsFiltered = useMemo(() => {
    return rows.filter((row) => {
      if (quickFilter === "overdue") {
        return row.isOverdue;
      }
      if (quickFilter === "today") {
        return row.isToday;
      }
      if (quickFilter === "promises") {
        return row.isPromise;
      }
      return true;
    });
  }, [quickFilter, rows]);

  const summary = useMemo(() => {
    const overdue = rows.filter((row) => row.isOverdue).length;
    const today = rows.filter((row) => row.isToday).length;
    const promises = rows.filter((row) => row.isPromise).length;
    const urgent = rows.filter((row) => row.prioridad === "urgente" || row.prioridad === "alta").length;

    return {
      total: rows.length,
      overdue,
      today,
      promises,
      urgent,
    };
  }, [rows]);

  const responsables = useMemo(() => {
    return Array.from(
      new Map(
        rows
          .filter((row) => row.responsable_user_id && row.responsable_nombre)
          .map((row) => [row.responsable_user_id as string, row.responsable_nombre as string])
      )
    ).map(([id, nombre]) => ({ id, nombre }));
  }, [rows]);

  return (
    <div className="space-y-6">
      <section className="chart-panel p-6 sm:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Badge className="mb-3 w-fit border-amber-200/80 bg-white/80 text-amber-700 shadow-sm">
              Control de mora
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Agenda operativa
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Seguimiento diario de acciones pendientes, vencidas y promesas por controlar,
              separado del CRM de gestiones.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-2 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
              {summary.total} acciones activas
            </div>
            <Button variant="outline" onClick={() => void fetchAgenda()}>
              Actualizar agenda
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            key: "overdue" as const,
            label: "Acciones vencidas",
            value: summary.overdue,
            detail: "Seguimientos fuera de fecha",
            icon: AlertTriangle,
            tone: "border-red-200 bg-red-50 text-red-700",
          },
          {
            key: "today" as const,
            label: "Acciones de hoy",
            value: summary.today,
            detail: "Pendientes del dia operativo",
            icon: CalendarClock,
            tone: "border-blue-200 bg-blue-50 text-blue-700",
          },
          {
            key: "promises" as const,
            label: "Promesas a controlar",
            value: summary.promises,
            detail: "Acuerdos y compromisos registrados",
            icon: HandCoins,
            tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
          },
          {
            key: "all" as const,
            label: "Total agenda",
            value: summary.total,
            detail: `${summary.urgent} de prioridad alta o urgente`,
            icon: Siren,
            tone: "border-amber-200 bg-amber-50 text-amber-700",
          },
        ].map(({ key, label, value, detail, icon: Icon, tone }) => (
          <button
            type="button"
            key={label}
            onClick={() => setQuickFilter(key)}
            className={`rounded-[1.5rem] border bg-white p-5 text-left shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 ${
              quickFilter === key ? "border-slate-900 ring-2 ring-slate-900/10" : "border-white/70"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-3xl font-semibold text-slate-950">{value}</p>
                <p className="mt-1 text-xs text-slate-500">{detail}</p>
              </div>
              <div className={`rounded-2xl border p-3 ${tone}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </button>
        ))}
      </div>

      <Card className="border-white/70 bg-white/85 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Filtros operativos</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Segmenta por etapa, estado, responsable y vencimiento.
            </p>
          </div>
          <Badge variant="outline" className="gap-2">
            <Filter className="h-3.5 w-3.5" />
            {rowsFiltered.length} en vista
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Select value={etapa} onValueChange={(value) => setEtapa(value as "all" | FinMoraEtapa)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las etapas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las etapas</SelectItem>
                <SelectItem value="mora_temprana">Mora temprana</SelectItem>
                <SelectItem value="pre_judicial">Pre judicial</SelectItem>
                <SelectItem value="judicial">Judicial</SelectItem>
              </SelectContent>
            </Select>

            <Select value={estado} onValueChange={(value) => setEstado(value as "all" | FinMoraAccionEstado)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="programada">Programada</SelectItem>
                <SelectItem value="en_curso">En curso</SelectItem>
                <SelectItem value="vencida">Vencida</SelectItem>
              </SelectContent>
            </Select>

            <Select value={responsable} onValueChange={setResponsable}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los responsables" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los responsables</SelectItem>
                {responsables.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant={soloVencidas ? "default" : "outline"}
              onClick={() => setSoloVencidas((current) => !current)}
              className="justify-between"
            >
              Solo vencidas
              {soloVencidas ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setQuickFilter("all")}>
              Ver todo
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setQuickFilter("overdue")}>
              Ir a vencidas
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setQuickFilter("today")}>
              Ir a hoy
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setQuickFilter("promises")}>
              Ir a promesas
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="border-white/70 bg-white/85 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardTitle>Bandeja diaria de acciones</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={rowsFiltered}
            loading={loading}
            emptyMessage="No hay acciones para los filtros seleccionados."
          />
        </CardContent>
      </Card>
    </div>
  );
}
