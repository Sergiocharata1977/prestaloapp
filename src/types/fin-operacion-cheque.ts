import type { FinCheque, FinChequeCreateInput } from '@/types/fin-cheque';

export type FinOperacionChequeTipo = 'cheque_propio' | 'cheque_terceros';

export type FinOperacionChequeEstado =
  | 'borrador'
  | 'pendiente'
  | 'confirmada'
  | 'liquidada'
  | 'anulada';

export interface FinOperacionChequeGastoFijo {
  concepto: string;
  importe: number;
}

export interface FinOperacionChequeGastoVariable {
  concepto: string;
  porcentaje: number;
}

export interface FinOperacionChequeBaseContable {
  cuenta_cheques_id: string;
  cuenta_liquidadora_id: string;
  cuenta_ingresos_id: string;
}

export interface FinOperacionChequeResumen {
  cantidad_cheques: number;
  importe_bruto: number;
  descuento?: number;
  gastos: number;
  gastos_fijos_total?: number;
  gastos_variables_total?: number;
  importe_neto: number;
  fecha_pago_min: string;
  fecha_pago_max: string;
  dias_corridos_promedio?: number;
}

export interface FinOperacionCheque {
  id: string;
  organization_id: string;
  sucursal_id: string;
  cliente_id: string;
  numero_operacion?: string;
  tipo_operacion?: FinOperacionChequeTipo;
  cheque_id?: string;
  politica_crediticia_id?: string;
  tipo_cliente_id?: string;
  caja_id?: string;
  tipo?: FinOperacionChequeTipo;
  estado: FinOperacionChequeEstado;
  moneda?: string;
  fecha_operacion: string;
  fecha_liquidacion: string;
  fecha_pago?: string;
  dias_corridos?: number;
  importe_bruto?: number;
  tasa_mensual_aplicada?: number;
  descuento?: number;
  gastos_fijos?: FinOperacionChequeGastoFijo[];
  gastos_variables?: FinOperacionChequeGastoVariable[];
  gastos_fijos_total?: number;
  gastos_variables_total?: number;
  total_gastos?: number;
  importe_neto_liquidado?: number;
  resumen?: FinOperacionChequeResumen;
  base_contable?: FinOperacionChequeBaseContable;
  cheque_ids?: string[];
  observaciones?: string;
  asiento_liquidacion_id?: string;
  liquidacion_confirmada_at?: string;
  liquidacion_confirmada_por?: {
    user_id: string;
    nombre: string;
  };
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export interface FinOperacionChequeDetalle extends FinOperacionCheque {
  cheques: FinCheque[];
}

export type FinOperacionChequePreviewInput = {
  cliente_id: string;
  tipo_cliente_id?: string;
  sucursal_id: string;
  politica_crediticia_id?: string;
  tipo?: FinOperacionChequeTipo;
  tipo_operacion?: FinOperacionChequeTipo;
  fecha_operacion?: string;
  fecha_liquidacion?: string;
  fecha_pago?: string;
  importe_bruto?: number;
  tasa_mensual?: number;
  gastos_fijos?: FinOperacionChequeGastoFijo[];
  gastos_variables?: FinOperacionChequeGastoVariable[];
  cheques?: FinChequeCreateInput[];
  gastos?: number;
};

export interface FinOperacionChequePreview {
  resumen?: FinOperacionChequeResumen;
  dias_corridos?: number;
  tasa_mensual_aplicada?: number;
  descuento?: number;
  gastos_fijos_total?: number;
  gastos_variables_total?: number;
  total_gastos?: number;
  importe_neto_liquidado?: number;
  importe_bruto?: number;
}

export type FinOperacionChequeCreateInput = {
  sucursal_id: string;
  cliente_id: string;
  tipo_operacion?: FinOperacionChequeTipo;
  tipo?: FinOperacionChequeTipo;
  tipo_cliente_id?: string;
  politica_crediticia_id?: string;
  moneda?: string;
  fecha_operacion?: string;
  fecha_liquidacion?: string;
  fecha_pago?: string;
  importe_bruto?: number;
  tasa_mensual?: number;
  gastos?: number;
  gastos_fijos?: FinOperacionChequeGastoFijo[];
  gastos_variables?: FinOperacionChequeGastoVariable[];
  observaciones?: string;
  base_contable?: FinOperacionChequeBaseContable;
  cheques?: FinChequeCreateInput[];
  cheque_id?: string;
  caja_id?: string;
  cheque?: FinChequeCreateInput;
};
