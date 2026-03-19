export type ScoringItem = {
  id: string
  categoria: 'cualitativo' | 'conflictos' | 'cuantitativo'
  nombre: string
  peso: number
  puntaje: number | null
  nota?: string
}

export type EvaluacionTier = 'A' | 'B' | 'C' | 'reprobado'

export type EvaluacionEstado = 'borrador' | 'aprobada' | 'rechazada'

export type ScoringCategoria = ScoringItem['categoria']

export type ScoringCategoriaPesos = Record<ScoringCategoria, number>

export type ScoringTierConfig = {
  tier: EvaluacionTier
  min_score: number
  max_score: number | null
}

export type FinScoringConfig = {
  id: string
  organization_id: string
  pesos_categoria: ScoringCategoriaPesos
  tiers: ScoringTierConfig[]
  frecuencia_vigencia_meses: number
  created_at: string
  updated_at: string
  updated_by?: string
}

export type FinScoringConfigUpdateInput = {
  pesos_categoria: ScoringCategoriaPesos
  tiers: ScoringTierConfig[]
  frecuencia_vigencia_meses: number
}

export type EvaluacionHistorialAccion =
  | 'creada'
  | 'aprobada'
  | 'rechazada'
  | 'desmarcada_vigencia'

export type FinEvaluacionResultadoCalculado = {
  score_cualitativo: number
  score_conflictos: number
  score_cuantitativo: number
  score_final: number
  score_nosis?: number | null
  tier_sugerido: EvaluacionTier
  limite_sugerido?: number | null
  calculado_at: string
  scoring_config_id?: string
}

export type FinEvaluacionDecision = {
  estado: EvaluacionEstado
  tier_asignado?: EvaluacionTier
  limite_credito_asignado?: number
  motivo?: string
  observaciones?: string
  decidida_por?: string
  decidida_at?: string
}

export type FinEvaluacionHistorialItem = {
  fecha: string
  accion: EvaluacionHistorialAccion
  actor_id?: string
  estado?: EvaluacionEstado
  detalle?: string
}

export type FinEvaluacion = {
  id: string
  organizacion_id: string
  cliente_id: string
  fecha: string
  evaluado_por: string
  items: ScoringItem[]
  resultado_calculado: FinEvaluacionResultadoCalculado
  decision: FinEvaluacionDecision
  historial: FinEvaluacionHistorialItem[]
  score_cualitativo: number
  score_conflictos: number
  score_cuantitativo: number
  score_final: number
  tier: EvaluacionTier
  score_nosis?: number | null
  tier_sugerido: EvaluacionTier
  tier_asignado?: EvaluacionTier
  scoring_config_id?: string
  scoring_config_snapshot?: FinScoringConfigUpdateInput
  limite_sugerido?: number | null
  limite_credito_asignado?: number
  limite_credito_sugerido?: number
  es_vigente: boolean
  nosis_consultado: boolean
  nosis_resultado?: Record<string, unknown>
  observaciones?: string
  estado: EvaluacionEstado
  created_at: string
  updated_at: string
}

export type EvaluacionCreateInput = {
  items: Array<{ id: string; puntaje: number; nota?: string }>
  nosis_consultado: boolean
  score_nosis?: number | null
  nosis_resultado?: Record<string, unknown>
  observaciones?: string
}

export type EvaluacionAprobarInput = {
  tier_asignado?: EvaluacionTier
  limite_credito_asignado?: number
  motivo?: string
  observaciones?: string
}

export type EvaluacionRechazarInput = {
  motivo?: string
  observaciones?: string
}

export type FinEvaluacionUpsertResult = {
  id: string
  evaluacion: FinEvaluacion | null
  scores: {
    score_cualitativo: number
    score_conflictos: number
    score_cuantitativo: number
    score_final: number
    tier: EvaluacionTier
  }
}
