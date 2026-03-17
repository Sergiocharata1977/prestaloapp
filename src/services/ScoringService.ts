import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import type {
  EvaluacionCreateInput,
  EvaluacionTier,
  FinEvaluacion,
  ScoringItem,
} from '@/types/fin-evaluacion';

// ---------------------------------------------------------------------------
// Catálogo de ítems del scoring
// ---------------------------------------------------------------------------

export const SCORING_ITEMS_CATALOG: Omit<ScoringItem, 'puntaje' | 'nota'>[] = [
  // CUALITATIVOS — 7 ítems (peso 1 c/u, promediados)
  {
    id: 'gestion_empresa',
    categoria: 'cualitativo',
    nombre: 'Gestión general de la empresa',
    peso: 1,
  },
  {
    id: 'condiciones_mercado',
    categoria: 'cualitativo',
    nombre: 'Condiciones del mercado/sector',
    peso: 1,
  },
  {
    id: 'organizacion_interna',
    categoria: 'cualitativo',
    nombre: 'Organización interna',
    peso: 1,
  },
  {
    id: 'situacion_cheques',
    categoria: 'cualitativo',
    nombre: 'Situación de cheques',
    peso: 1,
  },
  {
    id: 'terminos_pago',
    categoria: 'cualitativo',
    nombre: 'Términos de pago con proveedores',
    peso: 1,
  },
  {
    id: 'crecimiento_ventas',
    categoria: 'cualitativo',
    nombre: 'Crecimiento de ventas',
    peso: 1,
  },
  {
    id: 'fidelizacion',
    categoria: 'cualitativo',
    nombre: 'Historia y fidelización',
    peso: 1,
  },

  // CONFLICTOS — 3 ítems
  {
    id: 'concursos_quiebras',
    categoria: 'conflictos',
    nombre: 'Concursos o quiebras pasadas',
    peso: 1,
  },
  {
    id: 'situacion_fiscal',
    categoria: 'conflictos',
    nombre: 'Situación fiscal/impositiva',
    peso: 1,
  },
  {
    id: 'cheques_rechazados',
    categoria: 'conflictos',
    nombre: 'Cheques rechazados en el sistema',
    peso: 1,
  },

  // CUANTITATIVOS — 4 ítems
  {
    id: 'situacion_economica',
    categoria: 'cuantitativo',
    nombre: 'Situación económica general',
    peso: 1,
  },
  {
    id: 'situacion_financiera',
    categoria: 'cuantitativo',
    nombre: 'Ratios financieros',
    peso: 1,
  },
  {
    id: 'volumenes_negocio',
    categoria: 'cuantitativo',
    nombre: 'Volúmenes de negocio',
    peso: 1,
  },
  {
    id: 'situacion_patrimonial',
    categoria: 'cuantitativo',
    nombre: 'Patrimonio neto y garantías',
    peso: 1,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function promedio(items: ScoringItem[], categoria: ScoringItem['categoria']): number {
  const filtered = items.filter(
    (i) => i.categoria === categoria && i.puntaje !== null
  );
  if (filtered.length === 0) return 0;
  const sum = filtered.reduce((acc, i) => acc + (i.puntaje as number), 0);
  return sum / filtered.length;
}

function resolverTier(scoreFinal: number): EvaluacionTier {
  if (scoreFinal >= 8.0) return 'A';
  if (scoreFinal >= 6.0) return 'B';
  if (scoreFinal >= 4.0) return 'C';
  return 'reprobado';
}

// ---------------------------------------------------------------------------
// ScoringService
// ---------------------------------------------------------------------------

export type ScoreResult = {
  score_cualitativo: number;
  score_conflictos: number;
  score_cuantitativo: number;
  score_final: number;
  tier: EvaluacionTier;
};

export class ScoringService {
  static calcularScore(items: ScoringItem[]): ScoreResult {
    const score_cualitativo = promedio(items, 'cualitativo');
    const score_conflictos = promedio(items, 'conflictos');
    const score_cuantitativo = promedio(items, 'cuantitativo');

    // Fórmula ponderada: 43% cualitativos + 31% conflictos + 26% cuantitativos
    const score_final =
      score_cualitativo * 0.43 +
      score_conflictos * 0.31 +
      score_cuantitativo * 0.26;

    return {
      score_cualitativo,
      score_conflictos,
      score_cuantitativo,
      score_final,
      tier: resolverTier(score_final),
    };
  }

  static async crearEvaluacion(
    orgId: string,
    clienteId: string,
    data: EvaluacionCreateInput,
    uid: string
  ): Promise<string> {
    const db = getAdminFirestore();

    // Construir la lista completa de items mergeando catálogo + puntajes del input
    const inputMap = new Map(data.items.map((i) => [i.id, i]));

    const items: ScoringItem[] = SCORING_ITEMS_CATALOG.map((cat) => {
      const input = inputMap.get(cat.id);
      return {
        ...cat,
        puntaje: input?.puntaje ?? null,
        nota: input?.nota,
      };
    });

    const scores = ScoringService.calcularScore(items);

    const now = new Date().toISOString();
    const ref = db.collection(FIN_COLLECTIONS.evaluaciones(orgId)).doc();

    const payload: Omit<FinEvaluacion, 'id'> = {
      organizacion_id: orgId,
      cliente_id: clienteId,
      fecha: now.slice(0, 10),
      evaluado_por: uid,
      items,
      score_cualitativo: scores.score_cualitativo,
      score_conflictos: scores.score_conflictos,
      score_cuantitativo: scores.score_cuantitativo,
      score_final: scores.score_final,
      tier: scores.tier,
      nosis_consultado: data.nosis_consultado,
      observaciones: data.observaciones,
      estado: 'borrador',
      created_at: now,
    };

    await ref.set(payload);
    return ref.id;
  }

  static async getEvaluaciones(
    orgId: string,
    clienteId: string
  ): Promise<FinEvaluacion[]> {
    const db = getAdminFirestore();
    const snapshot = await db
      .collection(FIN_COLLECTIONS.evaluaciones(orgId))
      .where('cliente_id', '==', clienteId)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as FinEvaluacion[];
  }

  static async getUltimaEvaluacion(
    orgId: string,
    clienteId: string
  ): Promise<FinEvaluacion | null> {
    const db = getAdminFirestore();
    const snapshot = await db
      .collection(FIN_COLLECTIONS.evaluaciones(orgId))
      .where('cliente_id', '==', clienteId)
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as FinEvaluacion;
  }
}
