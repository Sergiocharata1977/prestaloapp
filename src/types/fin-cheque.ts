export type FinChequeTipo =
  | 'cheque_propio'
  | 'cheque_terceros'
  | 'propio'
  | 'terceros';

export type FinChequeEstadoActual =
  | 'recibido'
  | 'en_cartera'
  | 'depositado'
  | 'acreditado'
  | 'rechazado'
  | 'pre_judicial'
  | 'judicial';

export type FinChequeEstadoLegacy =
  | 'ingresado'
  | 'aplicado'
  | 'pendiente_liquidacion'
  | 'liquidado'
  | 'anulado';

export type FinChequeEstado =
  | FinChequeEstadoActual
  | FinChequeEstadoLegacy;

export interface FinChequeGastoRechazo {
  concepto: string;
  importe: number;
}

export interface FinChequeEvento {
  id: string;
  fecha: string;
  tipo: 'alta' | 'cambio_estado' | 'actualizacion_rechazo';
  estado_anterior?: FinChequeEstadoActual;
  estado_nuevo: FinChequeEstadoActual;
  observaciones?: string;
  motivo?: string;
  gastos_rechazo?: FinChequeGastoRechazo[];
  usuario?: {
    id: string;
    nombre: string;
  };
}

export interface FinCheque {
  id: string;
  organization_id: string;
  operacion_cheque_id?: string;
  cliente_id: string;
  tipo_cliente_id?: string;
  sucursal_id: string;
  tipo: FinChequeTipo;
  numero?: string;
  banco?: string;
  titular?: string;
  banco_nombre?: string;
  numero_cheque?: string;
  librador_nombre?: string;
  cuit_librador?: string;
  fecha_emision?: string;
  fecha_pago: string;
  importe: number;
  moneda: string;
  estado: FinChequeEstado;
  observaciones?: string;
  motivo_rechazo?: string;
  gastos_rechazo?: FinChequeGastoRechazo[];
  eventos?: FinChequeEvento[];
  asiento_liquidacion_id?: string;
  liquidado_at?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export type FinChequeCreateInput = Omit<
  FinCheque,
  | 'id'
  | 'organization_id'
  | 'operacion_cheque_id'
  | 'estado'
  | 'motivo_rechazo'
  | 'gastos_rechazo'
  | 'eventos'
  | 'asiento_liquidacion_id'
  | 'liquidado_at'
  | 'created_at'
  | 'created_by'
  | 'updated_at'
>;

export interface FinOperacionChequeGastoFijo {
  concepto: string;
  importe: number;
}

export interface FinOperacionChequeGastoVariable {
  concepto: string;
  porcentaje: number;
}

export type FinOperacionChequeEstado = 'pendiente' | 'confirmada' | 'anulada';

export interface FinOperacionChequePreview {
  dias_corridos: number;
  tasa_mensual_aplicada: number;
  descuento: number;
  gastos_fijos_total: number;
  gastos_variables_total: number;
  total_gastos: number;
  importe_neto_liquidado: number;
  importe_bruto: number;
}

export interface FinOperacionCheque {
  id: string;
  organization_id: string;
  cheque_id: string;
  cliente_id: string;
  tipo_cliente_id?: string;
  politica_crediticia_id: string;
  sucursal_id: string;
  caja_id?: string;
  tipo: FinChequeTipo;
  fecha_operacion: string;
  fecha_liquidacion: string;
  fecha_pago: string;
  dias_corridos: number;
  importe_bruto: number;
  tasa_mensual_aplicada: number;
  descuento: number;
  gastos_fijos: FinOperacionChequeGastoFijo[];
  gastos_variables: FinOperacionChequeGastoVariable[];
  gastos_fijos_total: number;
  gastos_variables_total: number;
  total_gastos: number;
  importe_neto_liquidado: number;
  estado: FinOperacionChequeEstado;
  liquidacion_confirmada_at?: string;
  liquidacion_confirmada_por?: {
    user_id: string;
    nombre: string;
  };
  observaciones?: string;
  created_at: string;
  updated_at: string;
}

export interface FinOperacionChequePreviewInput {
  cliente_id: string;
  tipo_cliente_id?: string;
  sucursal_id: string;
  politica_crediticia_id: string;
  tipo: FinChequeTipo;
  fecha_liquidacion: string;
  fecha_pago: string;
  importe_bruto: number;
  tasa_mensual?: number;
  gastos_fijos?: FinOperacionChequeGastoFijo[];
  gastos_variables?: FinOperacionChequeGastoVariable[];
}

export interface FinOperacionChequeCreateInput
  extends FinOperacionChequePreviewInput {
  cheque_id?: string;
  caja_id?: string;
  observaciones?: string;
  cheque?: FinChequeCreateInput;
}
