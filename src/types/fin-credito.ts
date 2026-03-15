export type FinSistemaAmortizacion = 'frances' | 'aleman';

export type FinCreditoEstado =
  | 'activo'
  | 'cancelado'
  | 'en_mora'
  | 'refinanciado'
  | 'incobrable';

export interface FinCredito {
  id: string;
  organization_id: string;
  sucursal_id: string;
  cliente_id: string;
  numero_credito: string;
  articulo_descripcion: string;
  articulo_codigo?: string;
  capital: number;
  tasa_mensual: number;
  cantidad_cuotas: number;
  sistema: FinSistemaAmortizacion;
  total_intereses: number;
  total_credito: number;
  valor_cuota_promedio: number;
  fecha_otorgamiento: string;
  fecha_primer_vencimiento: string;
  estado: FinCreditoEstado;
  cuotas_count: number;
  cuotas_pagas: number;
  saldo_capital: number;
  asiento_otorgamiento_id: string;
  created_at: string;
  created_by: string;
  updated_at: string;
}

export type FinCreditoCreateInput = {
  sucursal_id: string;
  cliente_id: string;
  articulo_descripcion: string;
  articulo_codigo?: string;
  capital: number;
  tasa_mensual: number;
  cantidad_cuotas: number;
  sistema: FinSistemaAmortizacion;
  fecha_otorgamiento: string;
  fecha_primer_vencimiento: string;
};
