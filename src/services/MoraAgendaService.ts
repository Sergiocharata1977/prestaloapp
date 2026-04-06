import type {
  FinMoraAccion,
  FinMoraAccionCategoria,
  FinMoraAccionClase,
  FinMoraAccionEstado,
  FinMoraAccionFilters,
  FinMoraAccionPrioridad,
  FinMoraAccionTipo,
  FinMoraAgendaItem,
  FinMoraEtapa,
  FinMoraTimelineItem,
} from "@/types/fin-mora";

type NormalizeAccionInput = Omit<FinMoraAccion, "id" | "organization_id" | "created_at" | "created_by"> &
  Partial<Pick<FinMoraAccion, "id" | "organization_id" | "created_at" | "created_by">>;

const TIPO_CATEGORIA_MAP: Record<FinMoraAccionTipo, FinMoraAccionCategoria> = {
  llamado: "contacto",
  whatsapp: "contacto",
  email: "contacto",
  carta_documento: "intimacion",
  visita: "seguimiento",
  acuerdo: "negociacion",
  derivacion_estudio: "derivacion",
  demanda: "judicial",
  nota_interna: "interna",
  sms: "contacto",
  tarea: "agenda",
  recordatorio: "agenda",
  audiencia: "judicial",
  presentacion_judicial: "judicial",
  gestion_documental: "documental",
  actualizacion_estado: "administrativa",
};

const TIPO_LABELS: Record<FinMoraAccionTipo, string> = {
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

const ETAPA_LABELS: Record<FinMoraEtapa, string> = {
  sin_gestion: "Sin gestion",
  mora_temprana: "Mora temprana",
  pre_judicial: "Pre judicial",
  judicial: "Judicial",
};

function normalizeText(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function resolveClase(
  etapa?: FinMoraEtapa,
  clase?: FinMoraAccionClase
): FinMoraAccionClase | undefined {
  if (clase) {
    return clase;
  }

  if (etapa && etapa !== "sin_gestion") {
    return etapa;
  }

  return undefined;
}

function resolvePrioridad(
  prioridad?: FinMoraAccionPrioridad,
  etapa?: FinMoraEtapa
): FinMoraAccionPrioridad {
  if (prioridad) {
    return prioridad;
  }

  if (etapa === "judicial") {
    return "alta";
  }

  if (etapa === "pre_judicial") {
    return "media";
  }

  return "media";
}

function resolveEstado(accion: Partial<FinMoraAccion>): FinMoraAccionEstado {
  if (accion.estado) {
    return accion.estado;
  }

  if (accion.executed_at) {
    return "ejecutada";
  }

  const fecha = accion.proxima_accion_at ?? accion.fecha_vencimiento_accion;
  if (!fecha) {
    return "pendiente";
  }

  const ahora = new Date().toISOString().slice(0, 10);
  if (fecha < ahora) {
    return "vencida";
  }

  return "programada";
}

function buildTitulo(accion: FinMoraAccion): string {
  return `${TIPO_LABELS[accion.tipo]} · ${ETAPA_LABELS[accion.etapa ?? accion.clase ?? "sin_gestion"]}`;
}

function buildDescripcion(accion: FinMoraAccion): string | undefined {
  return (
    normalizeText(accion.resultado_texto) ??
    normalizeText(accion.resultado) ??
    normalizeText(accion.notas)
  );
}

export class MoraAgendaService {
  static normalizeAccion(input: NormalizeAccionInput): FinMoraAccion {
    const etapa = input.etapa ?? input.clase ?? "mora_temprana";
    const clase = resolveClase(etapa, input.clase);
    const createdAt = input.created_at ?? input.updated_at ?? "1970-01-01T00:00:00.000Z";
    const createdBy = input.created_by ?? {
      user_id: "system",
      nombre: "Sistema",
    };

    return {
      ...input,
      id: input.id ?? "",
      organization_id: input.organization_id ?? "",
      created_at: createdAt,
      created_by: createdBy,
      etapa,
      clase,
      categoria: input.categoria ?? TIPO_CATEGORIA_MAP[input.tipo],
      estado: resolveEstado(input),
      prioridad: resolvePrioridad(input.prioridad, etapa),
      resultado: normalizeText(input.resultado),
      resultado_texto:
        normalizeText(input.resultado_texto) ?? normalizeText(input.resultado),
      notas: normalizeText(input.notas),
      proxima_accion_at: normalizeText(input.proxima_accion_at),
      fecha_vencimiento_accion:
        normalizeText(input.fecha_vencimiento_accion) ??
        normalizeText(input.proxima_accion_at),
      responsable_user_id:
        input.responsable_user_id ?? input.created_by?.user_id,
      responsable_nombre: input.responsable_nombre ?? input.created_by?.nombre,
      updated_at: input.updated_at ?? createdAt,
    };
  }

  static filterAcciones(
    acciones: FinMoraAccion[],
    filters: FinMoraAccionFilters = {}
  ): FinMoraAccion[] {
    return acciones.filter((accion) => {
      const estado = accion.estado ?? resolveEstado(accion);
      const etapa = accion.etapa ?? accion.clase;
      const fechaBase = accion.executed_at ?? accion.created_at;
      const agendaAt = accion.proxima_accion_at ?? accion.fecha_vencimiento_accion;

      if (filters.cliente_id && accion.cliente_id !== filters.cliente_id) {
        return false;
      }

      if (filters.etapa && etapa !== filters.etapa) {
        return false;
      }

      if (filters.clase && accion.clase !== filters.clase) {
        return false;
      }

      if (filters.categoria && accion.categoria !== filters.categoria) {
        return false;
      }

      if (filters.tipo && accion.tipo !== filters.tipo) {
        return false;
      }

      if (filters.estado && estado !== filters.estado) {
        return false;
      }

      if (filters.prioridad && accion.prioridad !== filters.prioridad) {
        return false;
      }

      if (
        filters.responsable_user_id &&
        accion.responsable_user_id !== filters.responsable_user_id
      ) {
        return false;
      }

      if (filters.entidad_tipo && accion.entidad_tipo !== filters.entidad_tipo) {
        return false;
      }

      if (filters.entidad_id && accion.entidad_id !== filters.entidad_id) {
        return false;
      }

      if (filters.desde && fechaBase < filters.desde) {
        return false;
      }

      if (filters.hasta && fechaBase > filters.hasta) {
        return false;
      }

      if (filters.vencidas && (!agendaAt || agendaAt >= new Date().toISOString().slice(0, 10))) {
        return false;
      }

      return true;
    });
  }

  static buildAgendaItem(accion: FinMoraAccion): FinMoraAgendaItem | null {
    const normalized = this.normalizeAccion(accion);
    const programadaAt =
      normalized.proxima_accion_at ?? normalized.fecha_vencimiento_accion;

    if (!programadaAt) {
      return null;
    }

    if (normalized.estado === "ejecutada" || normalized.estado === "cancelada") {
      return null;
    }

    return {
      id: `${normalized.id}:${programadaAt}`,
      accion_id: normalized.id,
      cliente_id: normalized.cliente_id,
      etapa: normalized.etapa ?? normalized.clase ?? "mora_temprana",
      tipo: normalized.tipo,
      estado: normalized.estado ?? "pendiente",
      prioridad: normalized.prioridad ?? "media",
      titulo: buildTitulo(normalized),
      descripcion: buildDescripcion(normalized),
      programada_at: programadaAt,
      vencimiento_at: normalized.fecha_vencimiento_accion,
      responsable_user_id: normalized.responsable_user_id,
      responsable_nombre: normalized.responsable_nombre,
      entidad_tipo: normalized.entidad_tipo,
      entidad_id: normalized.entidad_id,
      credito_id: normalized.credito_id,
      cuota_id: normalized.cuota_id,
      cheque_id: normalized.cheque_id,
    };
  }

  static listAgenda(
    acciones: FinMoraAccion[],
    filters: FinMoraAccionFilters = {}
  ): FinMoraAgendaItem[] {
    return this.filterAcciones(acciones, filters)
      .map((accion) => this.buildAgendaItem(accion))
      .filter((item): item is FinMoraAgendaItem => item !== null)
      .sort((a, b) => a.programada_at.localeCompare(b.programada_at));
  }

  static buildTimelineItem(accion: FinMoraAccion): FinMoraTimelineItem {
    const normalized = this.normalizeAccion(accion);

    return {
      id: normalized.id,
      accion_id: normalized.id,
      cliente_id: normalized.cliente_id,
      etapa: normalized.etapa ?? normalized.clase ?? "mora_temprana",
      categoria: normalized.categoria,
      tipo: normalized.tipo,
      estado: normalized.estado,
      prioridad: normalized.prioridad,
      titulo: buildTitulo(normalized),
      descripcion: buildDescripcion(normalized),
      resultado_codigo: normalized.resultado_codigo,
      resultado_texto: normalized.resultado_texto,
      entidad_tipo: normalized.entidad_tipo,
      entidad_id: normalized.entidad_id,
      responsable_user_id: normalized.responsable_user_id,
      responsable_nombre: normalized.responsable_nombre,
      executed_at: normalized.executed_at,
      created_at: normalized.created_at,
      updated_at: normalized.updated_at,
    };
  }

  static listTimeline(
    acciones: FinMoraAccion[],
    filters: FinMoraAccionFilters = {}
  ): FinMoraTimelineItem[] {
    return this.filterAcciones(acciones, filters)
      .map((accion) => this.buildTimelineItem(accion))
      .sort((a, b) =>
        (b.executed_at ?? b.created_at).localeCompare(a.executed_at ?? a.created_at)
      );
  }
}
