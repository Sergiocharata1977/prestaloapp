import type { EvaluacionTier } from '@/types/fin-evaluacion';

export type FinPoliticaTipoOperacion =
  | 'consumo'
  | 'empresa'
  | 'cheque_propio'
  | 'cheque_terceros';

export interface FinPoliticaTierConfig {
  tier: EvaluacionTier;
  limite_mensual?: number;
  limite_total?: number;
  requiere_garantia?: boolean;
  monto_maximo_otorgamiento?: number;
}

export interface FinPoliticaCrediticia {
  id: string;
  organization_id: string;
  nombre: string;
  codigo: string;
  descripcion?: string;
  tipo_cliente_id: string;
  tipo_operacion: FinPoliticaTipoOperacion;
  activo: boolean;
  requiere_legajo: boolean;
  requiere_evaluacion_vigente: boolean;
  permite_cheques_propios: boolean;
  permite_cheques_terceros: boolean;
  dias_vigencia_evaluacion?: number;
  monto_minimo?: number;
  monto_maximo?: number;
  limite_mensual?: number;
  limite_total?: number;
  tiers: FinPoliticaTierConfig[];
  created_at: string;
  updated_at: string;
}

export type FinPoliticaCrediticiaCreateInput = Omit<
  FinPoliticaCrediticia,
  'id' | 'organization_id' | 'created_at' | 'updated_at'
>;
