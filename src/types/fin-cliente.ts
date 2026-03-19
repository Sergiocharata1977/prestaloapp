import type { EvaluacionTier } from '@/types/fin-evaluacion';

export type FinClienteTipo = 'fisica' | 'juridica';
export type FinClienteLegajoEstado = 'completo' | 'incompleto';
export type FinClienteLegajoDocumentoEstado = 'pendiente' | 'cargado' | 'observado';

export interface FinClienteLegajoChecklistItem {
  id: string;
  clave: string;
  label: string;
  obligatorio: boolean;
  completo: boolean;
  observaciones?: string;
  updated_at?: string;
}

export interface FinClienteLegajoDocumento {
  id: string;
  nombre: string;
  categoria: string;
  estado: FinClienteLegajoDocumentoEstado;
  archivo_nombre?: string;
  observaciones?: string;
  updated_at?: string;
}

export interface FinClienteLegajo {
  estado: FinClienteLegajoEstado;
  checklist: FinClienteLegajoChecklistItem[];
  documentos: FinClienteLegajoDocumento[];
  notas?: string;
  updated_at?: string;
}

export interface FinClienteNosisUltimo {
  fecha: string;
  score: number | null;
  situacion_bcra: number | null;
  cheques_rechazados: number;
  juicios_activos: number;
  estado: 'exitoso' | 'error';
  tiempo_respuesta_ms: number;
  consultado_por: string;
}

export interface FinClienteNosisConsulta {
  id: string;
  cuit: string;
  fecha_consulta: string;
  fechaConsulta?: string;
  tipo_consulta: 'completo';
  tipoConsulta?: 'completo';
  score: number | null;
  scoreObtenido?: number | null;
  situacion_bcra: number | null;
  situacionBcra?: number | null;
  cheques_rechazados: number;
  chequesRechazados?: number;
  juicios_activos: number;
  juiciosActivos?: number;
  estado: 'exitoso' | 'error';
  tiempo_respuesta_ms: number;
  tiempoRespuestaMs?: number;
  http_status: number | null;
  solicitadoPor?: {
    userId: string;
    nombre?: string;
  };
  consultado_por: {
    user_id: string;
    nombre?: string;
  };
  error_mensaje?: string;
  errorMensaje?: string;
  raw_response?: unknown;
  createdAt?: string;
}

export interface FinCliente {
  id: string;
  organization_id: string;
  tipo: FinClienteTipo;
  nombre: string;
  apellido?: string;
  dni?: string;
  cuit: string;
  telefono?: string;
  email?: string;
  domicilio?: string;
  localidad?: string;
  provincia?: string;
  clasificacion_interna?: string;
  tipo_cliente_id?: string;
  tipo_cliente_codigo?: string;
  tipo_cliente_nombre?: string;
  tier_crediticio?: EvaluacionTier;
  limite_credito_asignado?: number;
  limite_credito_vigente?: number;
  evaluacion_id_ultima?: string;
  evaluacion_vigente_hasta?: string;
  nosis_ultimo?: FinClienteNosisUltimo;
  legajo?: FinClienteLegajo;
  creditos_activos_count: number;
  saldo_total_adeudado: number;
  created_at: string;
  created_by: string;
  updated_at: string;
}

export type FinClienteCreateInput = Omit<
  FinCliente,
  | 'id'
  | 'organization_id'
  | 'creditos_activos_count'
  | 'saldo_total_adeudado'
  | 'created_at'
  | 'created_by'
  | 'updated_at'
>;
