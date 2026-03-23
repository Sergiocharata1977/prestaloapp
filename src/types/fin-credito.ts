import type { EvaluacionTier } from '@/types/fin-evaluacion';
import type { FinPlanFinanciacion, FinTramoTasa } from '@/types/fin-plan-financiacion';
import type {
  FinPoliticaCrediticia,
  FinPoliticaTipoOperacion,
} from '@/types/fin-politica-crediticia';
import type { FinTipoCliente } from '@/types/fin-tipo-cliente';

export type FinSistemaAmortizacion = 'frances' | 'aleman';

export type FinCreditoEstado =
  | 'activo'
  | 'cancelado'
  | 'en_mora'
  | 'refinanciado'
  | 'incobrable';

export type FinCreditoTipoOperacion = FinPoliticaTipoOperacion | 'compra_financiada';

export interface FinCreditoTipoClienteSnapshot {
  id: string;
  codigo: string;
  nombre: string;
  tipo_base: FinTipoCliente['tipo_base'];
}

export interface FinCreditoPoliticaSnapshot {
  id: string;
  codigo: string;
  nombre: string;
  tipo_operacion: FinPoliticaCrediticia['tipo_operacion'];
  requiere_legajo: boolean;
  requiere_evaluacion_vigente: boolean;
  limite_mensual?: number;
  limite_total?: number;
  tiers?: FinPoliticaCrediticia['tiers'];
}

export interface FinCreditoPlanSnapshot {
  id: string;
  nombre: string;
  tramos_tasa: FinTramoTasa[];
  tasa_punitoria_mensual: FinPlanFinanciacion['tasa_punitoria_mensual'];
  cargo_fijo?: number;
  cargo_variable_pct?: number;
}

export interface FinCredito {
  id: string;
  organization_id: string;
  sucursal_id: string;
  cliente_id: string;
  tipo_cliente_id?: string;
  numero_credito: string;
  articulo_descripcion: string;
  articulo_codigo?: string;
  tipo_operacion?: FinCreditoTipoOperacion;
  valor_contado_bien?: number;
  politica_crediticia_id?: string;
  plan_financiacion_id?: string;
  tipo_cliente_snapshot?: FinCreditoTipoClienteSnapshot;
  politica_snapshot?: FinCreditoPoliticaSnapshot;
  plan_snapshot?: FinCreditoPlanSnapshot;
  tier_sugerido?: EvaluacionTier;
  tier_asignado?: EvaluacionTier;
  limite_credito_asignado?: number;
  capital: number;
  tasa_mensual: number;
  snapshot_tasa_mensual: number;
  snapshot_tasa_punitoria_mensual: number;
  snapshot_cargo_fijo?: number;
  snapshot_cargo_variable_pct?: number;
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
  tipo_cliente_id?: string;
  articulo_descripcion: string;
  articulo_codigo?: string;
  tipo_operacion?: FinCreditoTipoOperacion;
  valor_contado_bien?: number;
  politica_crediticia_id?: string;
  plan_financiacion_id?: string;
  tipo_cliente_snapshot?: FinCreditoTipoClienteSnapshot;
  politica_snapshot?: FinCreditoPoliticaSnapshot;
  plan_snapshot?: FinCreditoPlanSnapshot;
  tier_sugerido?: EvaluacionTier;
  tier_asignado?: EvaluacionTier;
  limite_credito_asignado?: number;
  capital: number;
  tasa_mensual?: number;
  cantidad_cuotas: number;
  sistema: FinSistemaAmortizacion;
  fecha_otorgamiento: string;
  fecha_primer_vencimiento: string;
};
