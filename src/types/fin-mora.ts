import type { FinCheque } from "@/types/fin-cheque";
import type { FinCliente } from "@/types/fin-cliente";
import type { FinCredito } from "@/types/fin-credito";

export type FinMoraEtapa =
  | "sin_gestion"
  | "mora_temprana"
  | "pre_judicial"
  | "judicial";

export type FinMoraAccionClase = Exclude<FinMoraEtapa, "sin_gestion">;

export type FinMoraAccionEstado =
  | "pendiente"
  | "programada"
  | "en_curso"
  | "ejecutada"
  | "cancelada"
  | "vencida";

export type FinMoraAccionPrioridad = "baja" | "media" | "alta" | "urgente";

export type FinMoraAccionCategoria =
  | "contacto"
  | "seguimiento"
  | "negociacion"
  | "intimacion"
  | "derivacion"
  | "judicial"
  | "administrativa"
  | "documental"
  | "agenda"
  | "interna";

export type FinMoraResultadoCodigo =
  | "pendiente"
  | "sin_contacto"
  | "contacto_efectivo"
  | "compromiso_pago"
  | "pago_parcial"
  | "pago_total"
  | "rehusado"
  | "requiere_documentacion"
  | "derivado_estudio"
  | "demanda_iniciada"
  | "cerrado";

export type FinMoraEntidadTipo =
  | "cliente"
  | "credito"
  | "cuota"
  | "cheque"
  | "documento"
  | "expediente";

export type FinMoraAccionTipo =
  | "llamado"
  | "whatsapp"
  | "email"
  | "carta_documento"
  | "visita"
  | "acuerdo"
  | "derivacion_estudio"
  | "demanda"
  | "nota_interna"
  | "sms"
  | "tarea"
  | "recordatorio"
  | "audiencia"
  | "presentacion_judicial"
  | "gestion_documental"
  | "actualizacion_estado";

export interface FinMoraAccionResponsable {
  user_id: string;
  nombre: string;
}

export interface FinMoraAccion {
  id: string;
  organization_id: string;
  cliente_id: string;
  etapa?: FinMoraEtapa;
  categoria?: FinMoraAccionCategoria;
  clase?: FinMoraAccionClase;
  tipo: FinMoraAccionTipo;
  estado?: FinMoraAccionEstado;
  prioridad?: FinMoraAccionPrioridad;
  resultado?: string;
  resultado_codigo?: FinMoraResultadoCodigo;
  resultado_texto?: string;
  notas?: string;
  entidad_tipo?: FinMoraEntidadTipo;
  entidad_id?: string;
  credito_id?: string;
  cuota_id?: string;
  cheque_id?: string;
  saldo_exigible_snapshot?: number;
  dias_mora_snapshot?: number;
  compromiso_pago_fecha?: string;
  compromiso_pago_monto?: number;
  compromiso_pago_cumplido?: boolean;
  proxima_accion_tipo?: FinMoraAccionTipo;
  proxima_accion_at?: string;
  fecha_vencimiento_accion?: string;
  responsable_user_id?: string;
  responsable_nombre?: string;
  sector_responsable?: string;
  estudio_juridico_nombre?: string;
  expediente_numero?: string;
  documento_tipo?: string;
  documento_url?: string;
  executed_at?: string;
  created_at: string;
  updated_at?: string;
  created_by: FinMoraAccionResponsable;
}

export interface FinMoraAgendaItem {
  id: string;
  accion_id?: string;
  cliente_id: string;
  etapa: FinMoraEtapa;
  tipo: FinMoraAccionTipo;
  estado: FinMoraAccionEstado;
  prioridad: FinMoraAccionPrioridad;
  titulo: string;
  descripcion?: string;
  programada_at: string;
  vencimiento_at?: string;
  responsable_user_id?: string;
  responsable_nombre?: string;
  entidad_tipo?: FinMoraEntidadTipo;
  entidad_id?: string;
  credito_id?: string;
  cuota_id?: string;
  cheque_id?: string;
}

export interface FinMoraTimelineItem {
  id: string;
  accion_id?: string;
  cliente_id: string;
  etapa: FinMoraEtapa;
  categoria?: FinMoraAccionCategoria;
  tipo: FinMoraAccionTipo;
  estado?: FinMoraAccionEstado;
  prioridad?: FinMoraAccionPrioridad;
  titulo: string;
  descripcion?: string;
  resultado_codigo?: FinMoraResultadoCodigo;
  resultado_texto?: string;
  entidad_tipo?: FinMoraEntidadTipo;
  entidad_id?: string;
  responsable_user_id?: string;
  responsable_nombre?: string;
  executed_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface FinMoraAccionFilters {
  cliente_id?: string;
  etapa?: Exclude<FinMoraEtapa, "sin_gestion">;
  clase?: FinMoraAccionClase;
  categoria?: FinMoraAccionCategoria;
  tipo?: FinMoraAccionTipo;
  estado?: FinMoraAccionEstado;
  prioridad?: FinMoraAccionPrioridad;
  responsable_user_id?: string;
  entidad_tipo?: FinMoraEntidadTipo;
  entidad_id?: string;
  vencidas?: boolean;
  desde?: string;
  hasta?: string;
}

export interface FinClienteMoraResumen extends FinCliente {
  mora_etapa: FinMoraEtapa;
  mora_estado:
    | "normal"
    | "en_mora"
    | "mora_temprana"
    | "pre_judicial"
    | "judicial";
  creditos_en_mora_count: number;
  creditos_incobrables_count: number;
  cheques_observados_count: number;
  saldo_vencido: number;
  dias_max_mora: number;
  ultima_accion_at?: string;
  proxima_accion_at?: string;
  proxima_accion_estado?: FinMoraAccionEstado;
  proxima_accion_tipo?: FinMoraAccionTipo;
  proxima_accion_prioridad?: FinMoraAccionPrioridad;
  proxima_accion_responsable?: string;
  acciones_count: number;
  agenda?: FinMoraAgendaItem[];
  timeline?: FinMoraTimelineItem[];
  creditos_relacionados: Pick<
    FinCredito,
    "id" | "numero_credito" | "estado" | "saldo_capital" | "fecha_primer_vencimiento"
  >[];
  cheques_relacionados: Pick<
    FinCheque,
    "id" | "numero" | "estado" | "importe" | "fecha_pago"
  >[];
}
