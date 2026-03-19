import { getAdminFirestore } from '@/firebase/admin'
import { FIN_COLLECTIONS } from '@/firebase/collections'
import { FieldValue } from 'firebase-admin/firestore'
import type {
  EvaluacionAprobarInput,
  EvaluacionCreateInput,
  EvaluacionEstado,
  EvaluacionRechazarInput,
  FinEvaluacion,
  FinEvaluacionDecision,
  FinEvaluacionHistorialItem,
  FinEvaluacionResultadoCalculado,
  FinScoringConfig,
  FinScoringConfigUpdateInput,
  ScoringItem,
} from '@/types/fin-evaluacion'
import {
  DEFAULT_SCORING_CONFIG,
  SCORING_ITEMS_CATALOG,
  calcularScore,
  type ScoreResult,
} from '@/lib/scoring/utils'

export { SCORING_ITEMS_CATALOG, calcularScore, type ScoreResult }

export class ScoringService {
  static calcularScore = calcularScore

  static async getOrCreateConfig(orgId: string): Promise<FinScoringConfig> {
    const db = getAdminFirestore()
    const ref = db.doc(FIN_COLLECTIONS.scoringConfig(orgId))
    const snapshot = await ref.get()

    if (snapshot.exists) {
      return {
        id: snapshot.id,
        ...snapshot.data(),
      } as FinScoringConfig
    }

    const now = new Date().toISOString()
    const payload: Omit<FinScoringConfig, 'id'> = {
      organization_id: orgId,
      pesos_categoria: DEFAULT_SCORING_CONFIG.pesos_categoria,
      tiers: DEFAULT_SCORING_CONFIG.tiers,
      frecuencia_vigencia_meses: DEFAULT_SCORING_CONFIG.frecuencia_vigencia_meses,
      created_at: now,
      updated_at: now,
    }

    await ref.set(payload)

    return {
      id: ref.id,
      ...payload,
    }
  }

  static async updateConfig(
    orgId: string,
    input: FinScoringConfigUpdateInput,
    userId: string
  ): Promise<void> {
    const db = getAdminFirestore()
    const ref = db.doc(FIN_COLLECTIONS.scoringConfig(orgId))
    const existing = await this.getOrCreateConfig(orgId)

    await ref.set(
      {
        organization_id: orgId,
        created_at: existing.created_at,
        updated_at: new Date().toISOString(),
        updated_by: userId,
        ...input,
      },
      { merge: true }
    )
  }

  static async crearEvaluacion(
    orgId: string,
    clienteId: string,
    data: EvaluacionCreateInput,
    uid: string
  ): Promise<string> {
    const db = getAdminFirestore()
    const inputMap = new Map(data.items.map((item) => [item.id, item]))

    const items: ScoringItem[] = SCORING_ITEMS_CATALOG.map((catalogItem) => {
      const input = inputMap.get(catalogItem.id)
      return {
        ...catalogItem,
        puntaje: input?.puntaje ?? null,
        nota: input?.nota,
      }
    })

    const config = await ScoringService.getOrCreateConfig(orgId)
    const scoringConfig: FinScoringConfigUpdateInput = {
      pesos_categoria: config.pesos_categoria,
      tiers: config.tiers,
      frecuencia_vigencia_meses: config.frecuencia_vigencia_meses,
    }
    const scores = ScoringService.calcularScore(items, scoringConfig)
    const now = new Date().toISOString()
    const ref = db.collection(FIN_COLLECTIONS.evaluaciones(orgId)).doc()

    const resultadoCalculado = ScoringService.buildResultadoCalculado(
      scores,
      data.score_nosis,
      now,
      config.id
    )
    const decision = ScoringService.buildDecision('borrador')
    const historial = [
      ScoringService.buildHistorialItem(now, 'creada', uid, 'borrador'),
    ]

    const payload: Omit<FinEvaluacion, 'id'> = {
      organizacion_id: orgId,
      cliente_id: clienteId,
      fecha: now.slice(0, 10),
      evaluado_por: uid,
      items,
      resultado_calculado: resultadoCalculado,
      decision,
      historial,
      score_cualitativo: resultadoCalculado.score_cualitativo,
      score_conflictos: resultadoCalculado.score_conflictos,
      score_cuantitativo: resultadoCalculado.score_cuantitativo,
      score_final: resultadoCalculado.score_final,
      tier: resultadoCalculado.tier_sugerido,
      score_nosis: resultadoCalculado.score_nosis,
      tier_sugerido: resultadoCalculado.tier_sugerido,
      scoring_config_id: config.id,
      scoring_config_snapshot: scoringConfig,
      limite_sugerido: resultadoCalculado.limite_sugerido,
      limite_credito_sugerido: resultadoCalculado.limite_sugerido ?? undefined,
      es_vigente: true,
      nosis_consultado: data.nosis_consultado,
      nosis_resultado: data.nosis_resultado,
      observaciones: data.observaciones,
      estado: decision.estado,
      created_at: now,
      updated_at: now,
    }

    const snapshot = await db
      .collection(FIN_COLLECTIONS.evaluaciones(orgId))
      .where('cliente_id', '==', clienteId)
      .where('es_vigente', '==', true)
      .get()

    const batch = db.batch()
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        es_vigente: false,
        updated_at: now,
        historial: FieldValue.arrayUnion(
          ScoringService.buildHistorialItem(
            now,
            'desmarcada_vigencia',
            uid,
            undefined,
            `Reemplazada por evaluacion ${ref.id}`
          )
        ),
      })
    })
    batch.set(ref, payload)
    await batch.commit()

    return ref.id
  }

  static async getEvaluaciones(
    orgId: string,
    clienteId: string
  ): Promise<FinEvaluacion[]> {
    const db = getAdminFirestore()
    const snapshot = await db
      .collection(FIN_COLLECTIONS.evaluaciones(orgId))
      .where('cliente_id', '==', clienteId)
      .orderBy('created_at', 'desc')
      .get()

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as FinEvaluacion[]
  }

  static async getUltimaEvaluacion(
    orgId: string,
    clienteId: string
  ): Promise<FinEvaluacion | null> {
    const db = getAdminFirestore()

    const vigenteSnapshot = await db
      .collection(FIN_COLLECTIONS.evaluaciones(orgId))
      .where('cliente_id', '==', clienteId)
      .where('es_vigente', '==', true)
      .orderBy('created_at', 'desc')
      .limit(1)
      .get()

    if (!vigenteSnapshot.empty) {
      return {
        id: vigenteSnapshot.docs[0].id,
        ...vigenteSnapshot.docs[0].data(),
      } as FinEvaluacion
    }

    const snapshot = await db
      .collection(FIN_COLLECTIONS.evaluaciones(orgId))
      .where('cliente_id', '==', clienteId)
      .orderBy('created_at', 'desc')
      .limit(1)
      .get()

    if (snapshot.empty) return null

    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as FinEvaluacion
  }

  static async aprobarEvaluacion(
    orgId: string,
    evaluacionId: string,
    data: EvaluacionAprobarInput,
    uid: string
  ): Promise<void> {
    const evaluacion = await this.getEvaluacionById(orgId, evaluacionId)

    if (!evaluacion) {
      throw new Error('Evaluacion no encontrada')
    }

    const now = new Date().toISOString()
    const tierAsignado = data.tier_asignado ?? evaluacion.tier_sugerido
    const limiteCreditoAsignado =
      data.limite_credito_asignado ??
      evaluacion.limite_credito_asignado ??
      evaluacion.limite_sugerido

    const decision = ScoringService.buildDecision('aprobada', {
      tier_asignado: tierAsignado,
      limite_credito_asignado: limiteCreditoAsignado ?? undefined,
      motivo: data.motivo,
      observaciones: data.observaciones ?? evaluacion.observaciones,
      decidida_por: uid,
      decidida_at: now,
    })

    await this.actualizarDecision(orgId, evaluacionId, decision, uid, now, 'aprobada')
  }

  static async rechazarEvaluacion(
    orgId: string,
    evaluacionId: string,
    data: EvaluacionRechazarInput,
    uid: string
  ): Promise<void> {
    const evaluacion = await this.getEvaluacionById(orgId, evaluacionId)

    if (!evaluacion) {
      throw new Error('Evaluacion no encontrada')
    }

    const now = new Date().toISOString()
    const decision = ScoringService.buildDecision('rechazada', {
      motivo: data.motivo,
      observaciones: data.observaciones ?? evaluacion.observaciones,
      decidida_por: uid,
      decidida_at: now,
    })

    await this.actualizarDecision(orgId, evaluacionId, decision, uid, now, 'rechazada')
  }

  private static async getEvaluacionById(
    orgId: string,
    evaluacionId: string
  ): Promise<FinEvaluacion | null> {
    const db = getAdminFirestore()
    const doc = await db
      .collection(FIN_COLLECTIONS.evaluaciones(orgId))
      .doc(evaluacionId)
      .get()

    if (!doc.exists) return null

    return {
      id: doc.id,
      ...doc.data(),
    } as FinEvaluacion
  }

  private static async actualizarDecision(
    orgId: string,
    evaluacionId: string,
    decision: FinEvaluacionDecision,
    uid: string,
    now: string,
    estado: Extract<EvaluacionEstado, 'aprobada' | 'rechazada'>
  ): Promise<void> {
    const db = getAdminFirestore()

    await db
      .collection(FIN_COLLECTIONS.evaluaciones(orgId))
      .doc(evaluacionId)
      .update({
        decision,
        estado,
        tier_asignado: decision.tier_asignado,
        limite_credito_asignado: decision.limite_credito_asignado,
        observaciones: decision.observaciones,
        updated_at: now,
        historial: FieldValue.arrayUnion(
          ScoringService.buildHistorialItem(now, estado, uid, estado, decision.motivo)
        ),
      })
  }

  private static buildResultadoCalculado(
    scores: ScoreResult,
    scoreNosis: number | null | undefined,
    now: string,
    scoringConfigId?: string
  ): FinEvaluacionResultadoCalculado {
    return {
      score_cualitativo: scores.score_cualitativo,
      score_conflictos: scores.score_conflictos,
      score_cuantitativo: scores.score_cuantitativo,
      score_final: scores.score_final,
      score_nosis: scoreNosis ?? null,
      tier_sugerido: scores.tier,
      limite_sugerido: ScoringService.calcularLimiteSugerido(scores.tier),
      calculado_at: now,
      scoring_config_id: scoringConfigId,
    }
  }

  private static buildDecision(
    estado: EvaluacionEstado,
    overrides: Partial<FinEvaluacionDecision> = {}
  ): FinEvaluacionDecision {
    return {
      estado,
      ...overrides,
    }
  }

  private static buildHistorialItem(
    fecha: string,
    accion: FinEvaluacionHistorialItem['accion'],
    actorId?: string,
    estado?: EvaluacionEstado,
    detalle?: string
  ): FinEvaluacionHistorialItem {
    return {
      fecha,
      accion,
      actor_id: actorId,
      estado,
      detalle,
    }
  }

  private static calcularLimiteSugerido(tier: ScoreResult['tier']): number | null {
    switch (tier) {
      case 'A':
        return 5_000_000
      case 'B':
        return 2_000_000
      case 'C':
        return 500_000
      default:
        return null
    }
  }
}
