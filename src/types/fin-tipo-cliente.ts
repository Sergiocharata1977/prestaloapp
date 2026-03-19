import type { EvaluacionTier } from '@/types/fin-evaluacion';

export type FinTipoClienteBase = 'persona' | 'empresa';

export interface FinTipoCliente {
  id: string;
  organization_id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipo_base: FinTipoClienteBase;
  activo: boolean;
  requiere_legajo: boolean;
  requiere_evaluacion_vigente: boolean;
  permite_cheques_propios: boolean;
  permite_cheques_terceros: boolean;
  limite_mensual?: number;
  limite_total?: number;
  tier_minimo_requerido?: EvaluacionTier;
  created_at: string;
  updated_at: string;
}

export type FinTipoClienteCreateInput = Omit<
  FinTipoCliente,
  'id' | 'organization_id' | 'created_at' | 'updated_at'
>;
