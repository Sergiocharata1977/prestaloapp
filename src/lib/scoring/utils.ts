// Utilidades PURAS de scoring — sin dependencias de servidor.
// Seguro para importar desde 'use client' y desde server components.
import type { EvaluacionTier, ScoringItem } from '@/types/fin-evaluacion';

export const SCORING_ITEMS_CATALOG: Omit<ScoringItem, 'puntaje' | 'nota'>[] = [
  // CUALITATIVOS — 7 ítems
  { id: 'gestion_empresa', categoria: 'cualitativo', nombre: 'Gestión general de la empresa', peso: 1 },
  { id: 'condiciones_mercado', categoria: 'cualitativo', nombre: 'Condiciones del mercado/sector', peso: 1 },
  { id: 'organizacion_interna', categoria: 'cualitativo', nombre: 'Organización interna', peso: 1 },
  { id: 'situacion_cheques', categoria: 'cualitativo', nombre: 'Situación de cheques', peso: 1 },
  { id: 'terminos_pago', categoria: 'cualitativo', nombre: 'Términos de pago con proveedores', peso: 1 },
  { id: 'crecimiento_ventas', categoria: 'cualitativo', nombre: 'Crecimiento de ventas', peso: 1 },
  { id: 'fidelizacion', categoria: 'cualitativo', nombre: 'Historia y fidelización', peso: 1 },
  // CONFLICTOS — 3 ítems
  { id: 'concursos_quiebras', categoria: 'conflictos', nombre: 'Concursos o quiebras pasadas', peso: 1 },
  { id: 'situacion_fiscal', categoria: 'conflictos', nombre: 'Situación fiscal/impositiva', peso: 1 },
  { id: 'cheques_rechazados', categoria: 'conflictos', nombre: 'Cheques rechazados en el sistema', peso: 1 },
  // CUANTITATIVOS — 4 ítems
  { id: 'situacion_economica', categoria: 'cuantitativo', nombre: 'Situación económica general', peso: 1 },
  { id: 'situacion_financiera', categoria: 'cuantitativo', nombre: 'Ratios financieros', peso: 1 },
  { id: 'volumenes_negocio', categoria: 'cuantitativo', nombre: 'Volúmenes de negocio', peso: 1 },
  { id: 'situacion_patrimonial', categoria: 'cuantitativo', nombre: 'Patrimonio neto y garantías', peso: 1 },
];

export type ScoreResult = {
  score_cualitativo: number;
  score_conflictos: number;
  score_cuantitativo: number;
  score_final: number;
  tier: EvaluacionTier;
};

function promedio(items: ScoringItem[], categoria: ScoringItem['categoria']): number {
  const filtered = items.filter((i) => i.categoria === categoria && i.puntaje !== null);
  if (filtered.length === 0) return 0;
  return filtered.reduce((acc, i) => acc + (i.puntaje as number), 0) / filtered.length;
}

export function resolverTier(scoreFinal: number): EvaluacionTier {
  if (scoreFinal >= 8.0) return 'A';
  if (scoreFinal >= 6.0) return 'B';
  if (scoreFinal >= 4.0) return 'C';
  return 'reprobado';
}

export function calcularScore(items: ScoringItem[]): ScoreResult {
  const score_cualitativo = promedio(items, 'cualitativo');
  const score_conflictos = promedio(items, 'conflictos');
  const score_cuantitativo = promedio(items, 'cuantitativo');
  const score_final =
    score_cualitativo * 0.43 +
    score_conflictos * 0.31 +
    score_cuantitativo * 0.26;
  return { score_cualitativo, score_conflictos, score_cuantitativo, score_final, tier: resolverTier(score_final) };
}
