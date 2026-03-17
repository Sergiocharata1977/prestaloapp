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

export type FinEvaluacion = {
  id: string
  organizacion_id: string
  cliente_id: string
  fecha: string
  evaluado_por: string
  items: ScoringItem[]
  score_cualitativo: number
  score_conflictos: number
  score_cuantitativo: number
  score_final: number
  tier: EvaluacionTier
  limite_credito_sugerido?: number
  nosis_consultado: boolean
  nosis_resultado?: Record<string, unknown>
  observaciones?: string
  estado: EvaluacionEstado
  created_at: string
}

export type EvaluacionCreateInput = {
  items: Array<{ id: string; puntaje: number; nota?: string }>
  nosis_consultado: boolean
  observaciones?: string
}
