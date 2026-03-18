import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import type {
  EvaluacionCreateInput,
  FinEvaluacion,
  ScoringItem,
} from '@/types/fin-evaluacion';
import {
  SCORING_ITEMS_CATALOG,
  calcularScore,
  type ScoreResult,
} from '@/lib/scoring/utils';

export { SCORING_ITEMS_CATALOG, calcularScore, type ScoreResult };

// ---------------------------------------------------------------------------
// ScoringService — solo métodos que usan Firebase Admin (server-side)
// ---------------------------------------------------------------------------

export class ScoringService {
  static calcularScore = calcularScore;

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
