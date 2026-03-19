// Utilidades puras de scoring, seguras para client y server.
import type {
  EvaluacionTier,
  FinScoringConfigUpdateInput,
  ScoringCategoria,
  ScoringCategoriaPesos,
  ScoringItem,
  ScoringTierConfig,
} from '@/types/fin-evaluacion';

export const SCORING_ITEMS_CATALOG: Omit<ScoringItem, 'puntaje' | 'nota'>[] = [
  { id: 'gestion_empresa', categoria: 'cualitativo', nombre: 'Gestion general de la empresa', peso: 1 },
  { id: 'condiciones_mercado', categoria: 'cualitativo', nombre: 'Condiciones del mercado/sector', peso: 1 },
  { id: 'organizacion_interna', categoria: 'cualitativo', nombre: 'Organizacion interna', peso: 1 },
  { id: 'situacion_cheques', categoria: 'cualitativo', nombre: 'Situacion de cheques', peso: 1 },
  { id: 'terminos_pago', categoria: 'cualitativo', nombre: 'Terminos de pago con proveedores', peso: 1 },
  { id: 'crecimiento_ventas', categoria: 'cualitativo', nombre: 'Crecimiento de ventas', peso: 1 },
  { id: 'fidelizacion', categoria: 'cualitativo', nombre: 'Historia y fidelizacion', peso: 1 },
  { id: 'concursos_quiebras', categoria: 'conflictos', nombre: 'Concursos o quiebras pasadas', peso: 1 },
  { id: 'situacion_fiscal', categoria: 'conflictos', nombre: 'Situacion fiscal/impositiva', peso: 1 },
  { id: 'cheques_rechazados', categoria: 'conflictos', nombre: 'Cheques rechazados en el sistema', peso: 1 },
  { id: 'situacion_economica', categoria: 'cuantitativo', nombre: 'Situacion economica general', peso: 1 },
  { id: 'situacion_financiera', categoria: 'cuantitativo', nombre: 'Ratios financieros', peso: 1 },
  { id: 'volumenes_negocio', categoria: 'cuantitativo', nombre: 'Volumenes de negocio', peso: 1 },
  { id: 'situacion_patrimonial', categoria: 'cuantitativo', nombre: 'Patrimonio neto y garantias', peso: 1 },
];

export type ScoreResult = {
  score_cualitativo: number;
  score_conflictos: number;
  score_cuantitativo: number;
  score_final: number;
  tier: EvaluacionTier;
};

export const DEFAULT_SCORING_PESOS: ScoringCategoriaPesos = {
  cualitativo: 0.43,
  conflictos: 0.31,
  cuantitativo: 0.26,
};

export const DEFAULT_SCORING_TIERS: ScoringTierConfig[] = [
  { tier: 'A', min_score: 8, max_score: null },
  { tier: 'B', min_score: 6, max_score: 7.99 },
  { tier: 'C', min_score: 4, max_score: 5.99 },
  { tier: 'reprobado', min_score: 0, max_score: 3.99 },
];

export const DEFAULT_SCORING_CONFIG: FinScoringConfigUpdateInput = {
  pesos_categoria: DEFAULT_SCORING_PESOS,
  tiers: DEFAULT_SCORING_TIERS,
  frecuencia_vigencia_meses: 6,
};

function promedio(items: ScoringItem[], categoria: ScoringCategoria): number {
  const filtered = items.filter(item => item.categoria === categoria && item.puntaje !== null);
  if (filtered.length === 0) {
    return 0;
  }

  return filtered.reduce((acc, item) => acc + (item.puntaje as number), 0) / filtered.length;
}

export function resolverTier(
  scoreFinal: number,
  tiers: ScoringTierConfig[] = DEFAULT_SCORING_TIERS
): EvaluacionTier {
  const sorted = [...tiers].sort((a, b) => b.min_score - a.min_score);
  const match = sorted.find(tier => {
    const maxScoreOk = tier.max_score === null || scoreFinal <= tier.max_score;
    return scoreFinal >= tier.min_score && maxScoreOk;
  });

  return match?.tier ?? 'reprobado';
}

export function calcularScore(
  items: ScoringItem[],
  config: FinScoringConfigUpdateInput = DEFAULT_SCORING_CONFIG
): ScoreResult {
  const score_cualitativo = promedio(items, 'cualitativo');
  const score_conflictos = promedio(items, 'conflictos');
  const score_cuantitativo = promedio(items, 'cuantitativo');
  const score_final =
    score_cualitativo * config.pesos_categoria.cualitativo +
    score_conflictos * config.pesos_categoria.conflictos +
    score_cuantitativo * config.pesos_categoria.cuantitativo;

  return {
    score_cualitativo,
    score_conflictos,
    score_cuantitativo,
    score_final,
    tier: resolverTier(score_final, config.tiers),
  };
}
