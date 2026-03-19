import type { FinEvaluacion, EvaluacionTier } from '@/types/fin-evaluacion'

export type FinLineaCreditoEstado = 'vigente' | 'vencida' | 'sin_evaluacion'

export interface FinLineaCreditoEvaluacionRef {
  id: string
  fecha: string
  estado: FinEvaluacion['estado']
  tier: EvaluacionTier
  tier_asignado?: EvaluacionTier
  limite_credito_asignado?: number
}

export interface FinLineaCreditoVigencia {
  desde: string
  hasta?: string
  vigente: boolean
  estado: FinLineaCreditoEstado
}

export interface FinLineaCredito {
  id: string
  organization_id: string
  cliente_id: string
  limite_mensual: number | null
  limite_total: number | null
  consumo_actual: number
  consumo_mensual_actual: number
  disponible_actual: number
  disponible_mensual_actual: number | null
  disponible_total_actual: number | null
  vigencia: FinLineaCreditoVigencia
  evaluacion_vigente: FinLineaCreditoEvaluacionRef | null
  created_at: string
  updated_at: string
}

export interface FinLineaCreditoBuildInput {
  organization_id: string
  cliente_id: string
  limite_mensual?: number | null
  limite_total?: number | null
  evaluacion?: Pick<
    FinEvaluacion,
    | 'id'
    | 'fecha'
    | 'estado'
    | 'tier'
    | 'tier_asignado'
    | 'limite_credito_asignado'
    | 'limite_sugerido'
    | 'created_at'
    | 'updated_at'
    | 'es_vigente'
  > | null
  evaluacion_vigente_hasta?: string | null
  consumo_actual?: number
  consumo_mensual_actual?: number
  created_at?: string
  updated_at?: string
}
