import type {
  FinMoraAccionCategoria,
  FinMoraAccionEstado,
  FinMoraAccionPrioridad,
  FinMoraEtapa,
  FinMoraResultadoCodigo,
} from "@/types/fin-mora";

export const FIN_MORA_ETAPAS = [
  "sin_gestion",
  "mora_temprana",
  "pre_judicial",
  "judicial",
] as const satisfies readonly FinMoraEtapa[];

export const FIN_MORA_ACCION_ESTADOS = [
  "pendiente",
  "programada",
  "en_curso",
  "ejecutada",
  "cancelada",
  "vencida",
] as const satisfies readonly FinMoraAccionEstado[];

export const FIN_MORA_ACCION_PRIORIDADES = [
  "baja",
  "media",
  "alta",
  "urgente",
] as const satisfies readonly FinMoraAccionPrioridad[];

export const FIN_MORA_ACCION_CATEGORIAS = [
  "contacto",
  "seguimiento",
  "negociacion",
  "intimacion",
  "derivacion",
  "judicial",
  "administrativa",
  "documental",
  "agenda",
  "interna",
] as const satisfies readonly FinMoraAccionCategoria[];

export const FIN_MORA_RESULTADOS = [
  "pendiente",
  "sin_contacto",
  "contacto_efectivo",
  "compromiso_pago",
  "pago_parcial",
  "pago_total",
  "rehusado",
  "requiere_documentacion",
  "derivado_estudio",
  "demanda_iniciada",
  "cerrado",
] as const satisfies readonly FinMoraResultadoCodigo[];

const ETAPA_LABELS: Record<FinMoraEtapa, string> = {
  sin_gestion: "Sin gestion",
  mora_temprana: "Mora temprana",
  pre_judicial: "Prejudicial",
  judicial: "Judicial",
};

const ESTADO_LABELS: Record<FinMoraAccionEstado, string> = {
  pendiente: "Pendiente",
  programada: "Programada",
  en_curso: "En curso",
  ejecutada: "Ejecutada",
  cancelada: "Cancelada",
  vencida: "Vencida",
};

const PRIORIDAD_LABELS: Record<FinMoraAccionPrioridad, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};

const CATEGORIA_LABELS: Record<FinMoraAccionCategoria, string> = {
  contacto: "Contacto",
  seguimiento: "Seguimiento",
  negociacion: "Negociacion",
  intimacion: "Intimacion",
  derivacion: "Derivacion",
  judicial: "Judicial",
  administrativa: "Administrativa",
  documental: "Documental",
  agenda: "Agenda",
  interna: "Interna",
};

const RESULTADO_LABELS: Record<FinMoraResultadoCodigo, string> = {
  pendiente: "Pendiente",
  sin_contacto: "Sin contacto",
  contacto_efectivo: "Contacto efectivo",
  compromiso_pago: "Compromiso de pago",
  pago_parcial: "Pago parcial",
  pago_total: "Pago total",
  rehusado: "Rehusado",
  requiere_documentacion: "Requiere documentacion",
  derivado_estudio: "Derivado a estudio",
  demanda_iniciada: "Demanda iniciada",
  cerrado: "Cerrado",
};

export function getFinMoraEtapaLabel(value: FinMoraEtapa): string {
  return ETAPA_LABELS[value];
}

export function getFinMoraAccionEstadoLabel(value: FinMoraAccionEstado): string {
  return ESTADO_LABELS[value];
}

export function getFinMoraAccionPrioridadLabel(
  value: FinMoraAccionPrioridad
): string {
  return PRIORIDAD_LABELS[value];
}

export function getFinMoraAccionCategoriaLabel(
  value: FinMoraAccionCategoria
): string {
  return CATEGORIA_LABELS[value];
}

export function getFinMoraResultadoLabel(value: FinMoraResultadoCodigo): string {
  return RESULTADO_LABELS[value];
}
