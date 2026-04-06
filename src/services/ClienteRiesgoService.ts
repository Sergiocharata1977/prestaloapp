import { ClienteService } from '@/services/ClienteService'
import { CreditoService } from '@/services/CreditoService'
import { LineaCreditoService } from '@/services/LineaCreditoService'
import { ScoringService } from '@/services/ScoringService'
import type { FinCliente, FinClienteNosisConsulta, FinClienteNosisUltimo } from '@/types/fin-cliente'
import type { FinCreditoCreateInput } from '@/types/fin-credito'
import type { FinCredito } from '@/types/fin-credito'
import type { FinEvaluacion } from '@/types/fin-evaluacion'
import type { FinLineaCredito } from '@/types/fin-linea-credito'

type FinRiesgoSemaforo = 'verde' | 'amarillo' | 'rojo'

interface FinRiesgoAlerta {
  codigo: string
  nivel: 'info' | 'warning' | 'critical'
  titulo: string
  detalle: string
}

interface FinRiesgoRecomendacion {
  codigo: string
  prioridad: 'baja' | 'media' | 'alta'
  detalle: string
}

interface FinClienteRiesgoMetricas {
  total_creditos: number
  creditos_activos: number
  creditos_en_mora: number
  creditos_cancelados: number
  creditos_refinanciados: number
  creditos_incobrables: number
  capital_total_otorgado: number
  saldo_capital_activo: number
  ticket_promedio: number
  porcentaje_creditos_en_mora: number
  porcentaje_saldo_en_mora: number
  antiguedad_primer_credito_dias: number | null
  fecha_ultimo_credito: string | null
}

interface FinClienteRiesgoResumen {
  semaforo: FinRiesgoSemaforo
  score: number | null
  alertas: FinRiesgoAlerta[]
  recomendaciones: FinRiesgoRecomendacion[]
  origen_reglas: 'fallback_local'
}

interface FinClienteRiesgoFuentes {
  metricas: 'fallback_local'
  reglas: 'fallback_local'
  degradado: boolean
  observaciones: string[]
}

export type FinOriginacionRiesgoEstado =
  | 'aprobado'
  | 'advertencia'
  | 'revision_manual'
  | 'bloqueado'

export interface FinOriginacionRiesgoItem {
  codigo: string
  nivel: 'warning' | 'critical'
  accion: 'advertencia' | 'revision_manual' | 'bloqueo'
  titulo: string
  detalle: string
}

export interface FinOriginacionRiesgoDecision {
  estado: FinOriginacionRiesgoEstado
  permite_otorgar: boolean
  requiere_revision_manual: boolean
  semaforo: FinRiesgoSemaforo
  score: number | null
  linea_disponible: number | null
  items: FinOriginacionRiesgoItem[]
}

export interface FinClienteRiesgoResponse {
  generated_at: string
  cliente: FinCliente
  evaluaciones: FinEvaluacion[]
  evaluacion_vigente: FinEvaluacion | null
  linea_credito_actual: FinLineaCredito | null
  creditos: FinCredito[]
  nosis: {
    ultimo: FinClienteNosisUltimo | null
    consultas_recientes: FinClienteNosisConsulta[]
    ultima_consulta: FinClienteNosisConsulta | null
  }
  metricas: FinClienteRiesgoMetricas
  riesgo: FinClienteRiesgoResumen
  fuentes: FinClienteRiesgoFuentes
}

type SafeResult<T> = {
  value: T
  issues: string[]
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function diffDaysFromNow(dateIso: string | undefined): number | null {
  if (!dateIso) {
    return null
  }

  const date = new Date(dateIso)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return Math.max(Math.floor((Date.now() - date.getTime()) / 86400000), 0)
}

function safeDateCompareDesc(a: string, b: string): number {
  return b.localeCompare(a)
}

function buildMetricas(creditos: FinCredito[]): FinClienteRiesgoMetricas {
  const activos = creditos.filter((credito) =>
    ['activo', 'en_mora', 'refinanciado'].includes(credito.estado)
  )
  const enMora = creditos.filter((credito) => credito.estado === 'en_mora')
  const capitalTotal = round2(
    creditos.reduce((acc, credito) => acc + Number(credito.capital || 0), 0)
  )
  const saldoActivo = round2(
    activos.reduce((acc, credito) => acc + Number(credito.saldo_capital || 0), 0)
  )
  const saldoEnMora = round2(
    enMora.reduce((acc, credito) => acc + Number(credito.saldo_capital || 0), 0)
  )
  const sorted = [...creditos].sort((a, b) =>
    safeDateCompareDesc(a.fecha_otorgamiento, b.fecha_otorgamiento)
  )
  const firstCredit = sorted.at(-1)
  const lastCredit = sorted[0]

  return {
    total_creditos: creditos.length,
    creditos_activos: activos.length,
    creditos_en_mora: enMora.length,
    creditos_cancelados: creditos.filter((credito) => credito.estado === 'cancelado').length,
    creditos_refinanciados: creditos.filter((credito) => credito.estado === 'refinanciado').length,
    creditos_incobrables: creditos.filter((credito) => credito.estado === 'incobrable').length,
    capital_total_otorgado: capitalTotal,
    saldo_capital_activo: saldoActivo,
    ticket_promedio: creditos.length > 0 ? round2(capitalTotal / creditos.length) : 0,
    porcentaje_creditos_en_mora:
      creditos.length > 0 ? round2((enMora.length / creditos.length) * 100) : 0,
    porcentaje_saldo_en_mora:
      saldoActivo > 0 ? round2((saldoEnMora / saldoActivo) * 100) : 0,
    antiguedad_primer_credito_dias: diffDaysFromNow(firstCredit?.fecha_otorgamiento),
    fecha_ultimo_credito: lastCredit?.fecha_otorgamiento ?? null,
  }
}

function buildAlertas(params: {
  cliente: FinCliente
  evaluacionVigente: FinEvaluacion | null
  lineaCredito: FinLineaCredito | null
  metricas: FinClienteRiesgoMetricas
  nosisUltimo: FinClienteNosisUltimo | null
}): FinRiesgoAlerta[] {
  const alertas: FinRiesgoAlerta[] = []
  const vigenciaDias = diffDaysFromNow(params.cliente.evaluacion_vigente_hasta)

  if (!params.evaluacionVigente) {
    alertas.push({
      codigo: 'sin_evaluacion_vigente',
      nivel: 'critical',
      titulo: 'Sin evaluacion vigente',
      detalle: 'El cliente no tiene evaluacion crediticia vigente para respaldar decision automatica.',
    })
  }

  if (
    params.evaluacionVigente &&
    params.evaluacionVigente.estado !== 'aprobada'
  ) {
    alertas.push({
      codigo: 'evaluacion_no_aprobada',
      nivel: 'warning',
      titulo: 'Evaluacion no aprobada',
      detalle: `La ultima evaluacion vigente se encuentra en estado ${params.evaluacionVigente.estado}.`,
    })
  }

  if (vigenciaDias !== null && vigenciaDias > 0) {
    alertas.push({
      codigo: 'evaluacion_vencida',
      nivel: 'warning',
      titulo: 'Evaluacion vencida',
      detalle: 'La vigencia de evaluacion informada en cliente ya se encuentra vencida.',
    })
  }

  if (params.metricas.creditos_en_mora > 0) {
    alertas.push({
      codigo: 'creditos_en_mora',
      nivel: params.metricas.creditos_en_mora >= 2 ? 'critical' : 'warning',
      titulo: 'Comportamiento en mora',
      detalle: `${params.metricas.creditos_en_mora} credito(s) en mora y ${params.metricas.porcentaje_saldo_en_mora}% del saldo activo comprometido.`,
    })
  }

  if (params.nosisUltimo?.estado === 'error') {
    alertas.push({
      codigo: 'nosis_error',
      nivel: 'warning',
      titulo: 'Nosis con error',
      detalle: 'La ultima consulta a Nosis no devolvio un resultado exitoso.',
    })
  }

  if ((params.nosisUltimo?.cheques_rechazados ?? 0) > 0) {
    alertas.push({
      codigo: 'nosis_cheques_rechazados',
      nivel: 'critical',
      titulo: 'Cheques rechazados',
      detalle: `Nosis informa ${params.nosisUltimo?.cheques_rechazados} cheque(s) rechazados.`,
    })
  }

  if ((params.nosisUltimo?.juicios_activos ?? 0) > 0) {
    alertas.push({
      codigo: 'nosis_juicios_activos',
      nivel: 'critical',
      titulo: 'Juicios activos',
      detalle: `Nosis informa ${params.nosisUltimo?.juicios_activos} juicio(s) activo(s).`,
    })
  }

  if (
    params.lineaCredito &&
    params.lineaCredito.disponible_total_actual !== null &&
    params.lineaCredito.disponible_total_actual <= 0
  ) {
    alertas.push({
      codigo: 'linea_sin_disponible',
      nivel: 'warning',
      titulo: 'Linea agotada',
      detalle: 'La linea de credito vigente no tiene disponible total remanente.',
    })
  }

  return alertas
}

function buildRecomendaciones(alertas: FinRiesgoAlerta[]): FinRiesgoRecomendacion[] {
  const recomendaciones: FinRiesgoRecomendacion[] = []

  if (alertas.some((alerta) => alerta.codigo === 'sin_evaluacion_vigente')) {
    recomendaciones.push({
      codigo: 'generar_evaluacion',
      prioridad: 'alta',
      detalle: 'Generar o actualizar la evaluacion crediticia antes de otorgar nueva linea o credito.',
    })
  }

  if (
    alertas.some((alerta) =>
      ['creditos_en_mora', 'nosis_cheques_rechazados', 'nosis_juicios_activos'].includes(
        alerta.codigo
      )
    )
  ) {
    recomendaciones.push({
      codigo: 'revisar_riesgo_duro',
      prioridad: 'alta',
      detalle: 'Escalar a analisis manual y restringir nuevo otorgamiento hasta revisar antecedentes.',
    })
  }

  if (alertas.some((alerta) => alerta.codigo === 'linea_sin_disponible')) {
    recomendaciones.push({
      codigo: 'revisar_linea_credito',
      prioridad: 'media',
      detalle: 'Validar si corresponde ampliar linea o esperar cancelaciones para liberar cupo.',
    })
  }

  if (recomendaciones.length === 0) {
    recomendaciones.push({
      codigo: 'monitoreo_regular',
      prioridad: 'baja',
      detalle: 'Mantener seguimiento regular con informacion actual de evaluacion, Nosis y performance.',
    })
  }

  return recomendaciones
}

function buildSemaforo(params: {
  alertas: FinRiesgoAlerta[]
  evaluacionVigente: FinEvaluacion | null
  nosisUltimo: FinClienteNosisUltimo | null
}): { semaforo: FinRiesgoSemaforo; score: number | null } {
  let score = params.evaluacionVigente?.score_final ?? null

  if (score !== null) {
    if ((params.nosisUltimo?.cheques_rechazados ?? 0) > 0) {
      score -= 25
    }
    if ((params.nosisUltimo?.juicios_activos ?? 0) > 0) {
      score -= 30
    }
    if (params.alertas.some((alerta) => alerta.codigo === 'creditos_en_mora')) {
      score -= 20
    }
    score = round2(Math.max(score, 0))
  }

  if (params.alertas.some((alerta) => alerta.nivel === 'critical')) {
    return { semaforo: 'rojo', score }
  }

  if (
    params.alertas.length > 0 ||
    (score !== null && score < 60) ||
    params.evaluacionVigente?.estado === 'rechazada'
  ) {
    return { semaforo: 'amarillo', score }
  }

  return { semaforo: 'verde', score }
}

async function safeLoad<T>(
  label: string,
  loader: () => Promise<T>,
  fallback: T
): Promise<SafeResult<T>> {
  try {
    return {
      value: await loader(),
      issues: [],
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'error desconocido'
    return {
      value: fallback,
      issues: [`${label}: ${detail}`],
    }
  }
}

export class ClienteRiesgoService {
  static async getResumenRiesgo(
    orgId: string,
    clienteId: string
  ): Promise<FinClienteRiesgoResponse | null> {
    const cliente = await ClienteService.getById(orgId, clienteId)

    if (!cliente) {
      return null
    }

    const [evaluacionesResult, evaluacionVigenteResult, creditosResult, lineaResult, nosisResult] =
      await Promise.all([
        safeLoad('evaluaciones', () => ScoringService.getEvaluaciones(orgId, clienteId), []),
        safeLoad('evaluacion_vigente', () => ScoringService.getUltimaEvaluacion(orgId, clienteId), null),
        safeLoad('creditos', () => CreditoService.getByCliente(orgId, clienteId), []),
        safeLoad('linea_credito_actual', () => LineaCreditoService.getLineaCreditoActual(orgId, clienteId), null),
        safeLoad(
          'nosis_consultas',
          () => ClienteService.listarConsultasNosis(orgId, clienteId, 5),
          []
        ),
      ])

    const evaluaciones = [...evaluacionesResult.value].sort((a, b) =>
      safeDateCompareDesc(a.created_at, b.created_at)
    )
    const evaluacionVigente =
      evaluacionVigenteResult.value ??
      evaluaciones.find((evaluacion) => evaluacion.es_vigente) ??
      null
    const creditos = [...creditosResult.value].sort((a, b) =>
      safeDateCompareDesc(a.fecha_otorgamiento, b.fecha_otorgamiento)
    )
    const lineaCredito =
      lineaResult.value ??
      LineaCreditoService.buildFromSources({
        cliente,
        creditos,
        evaluacion: evaluacionVigente
          ? {
              id: evaluacionVigente.id,
              fecha: evaluacionVigente.fecha,
              estado: evaluacionVigente.estado,
              tier: evaluacionVigente.tier,
              tier_asignado: evaluacionVigente.tier_asignado,
              limite_credito_asignado: evaluacionVigente.limite_credito_asignado,
              limite_sugerido: evaluacionVigente.limite_sugerido,
              created_at: evaluacionVigente.created_at,
              updated_at: evaluacionVigente.updated_at,
              es_vigente: evaluacionVigente.es_vigente,
            }
          : null,
      })

    const consultasNosis = [...nosisResult.value].sort((a, b) =>
      safeDateCompareDesc(a.fecha_consulta, b.fecha_consulta)
    )
    const ultimaConsultaNosis = consultasNosis[0] ?? null
    const nosisUltimo: FinClienteNosisUltimo | null =
      cliente.nosis_ultimo ??
      (ultimaConsultaNosis
        ? {
            fecha: ultimaConsultaNosis.fecha_consulta,
            score: ultimaConsultaNosis.score,
            situacion_bcra: ultimaConsultaNosis.situacion_bcra,
            cheques_rechazados: ultimaConsultaNosis.cheques_rechazados,
            juicios_activos: ultimaConsultaNosis.juicios_activos,
            estado: ultimaConsultaNosis.estado,
            tiempo_respuesta_ms: ultimaConsultaNosis.tiempo_respuesta_ms,
            consultado_por:
              ultimaConsultaNosis.consultado_por.nombre ??
              ultimaConsultaNosis.consultado_por.user_id,
          }
        : null)

    const metricas = buildMetricas(creditos)
    const alertas = buildAlertas({
      cliente,
      evaluacionVigente,
      lineaCredito,
      metricas,
      nosisUltimo,
    })
    const recomendaciones = buildRecomendaciones(alertas)
    const riesgoBase = buildSemaforo({
      alertas,
      evaluacionVigente,
      nosisUltimo,
    })
    const issues = [
      ...evaluacionesResult.issues,
      ...evaluacionVigenteResult.issues,
      ...creditosResult.issues,
      ...lineaResult.issues,
      ...nosisResult.issues,
    ]

    return {
      generated_at: new Date().toISOString(),
      cliente,
      evaluaciones,
      evaluacion_vigente: evaluacionVigente,
      linea_credito_actual: lineaCredito,
      creditos,
      nosis: {
        ultimo: nosisUltimo,
        consultas_recientes: consultasNosis,
        ultima_consulta: ultimaConsultaNosis,
      },
      metricas,
      riesgo: {
        semaforo: riesgoBase.semaforo,
        score: riesgoBase.score,
        alertas,
        recomendaciones,
        origen_reglas: 'fallback_local',
      },
      fuentes: {
        metricas: 'fallback_local',
        reglas: 'fallback_local',
        degradado: issues.length > 0,
        observaciones: issues,
      },
    }
  }

  static async evaluarOriginacionCredito(
    orgId: string,
    input: FinCreditoCreateInput
  ): Promise<FinOriginacionRiesgoDecision | null> {
    const resumen = await this.getResumenRiesgo(orgId, input.cliente_id)

    if (!resumen) {
      return null
    }

    const items = new Map<string, FinOriginacionRiesgoItem>()
    let lineaDisponible = resumen.linea_credito_actual?.disponible_actual ?? null
    let requiereEvaluacionVigente = false

    const addItem = (item: FinOriginacionRiesgoItem) => {
      if (!items.has(item.codigo)) {
        items.set(item.codigo, item)
      }
    }

    try {
      const validacion = await CreditoService.validarOtorgamiento(orgId, input)
      lineaDisponible = validacion.linea.disponible_actual
      requiereEvaluacionVigente =
        validacion.tasaData.politica?.requiere_evaluacion_vigente ?? false
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'No se pudo validar la originacion'

      try {
        const tasaData = await CreditoService.resolveTasaInput(orgId, input)
        requiereEvaluacionVigente =
          tasaData.politica?.requiere_evaluacion_vigente ?? requiereEvaluacionVigente
      } catch {
        // Si no se puede resolver la tasa, dejamos que la validacion normal del circuito lo informe.
      }

      if (detail.includes('linea disponible suficiente')) {
        addItem({
          codigo: 'linea_insuficiente',
          nivel: 'critical',
          accion: 'bloqueo',
          titulo: 'Linea disponible insuficiente',
          detalle:
            lineaDisponible !== null
              ? `La linea disponible actual es ${round2(lineaDisponible)} y no alcanza para otorgar ${round2(input.capital)}.`
              : 'La linea disponible actual no alcanza para otorgar el monto solicitado.',
        })
      }

      if (detail.includes('evaluacion vigente')) {
        addItem({
          codigo: 'evaluacion_requerida',
          nivel: 'critical',
          accion: 'bloqueo',
          titulo: 'Evaluacion vigente requerida',
          detalle: 'La politica vigente exige una evaluacion aprobada y dentro de vigencia.',
        })
      }

      if (detail.includes('legajo completo')) {
        addItem({
          codigo: 'legajo_incompleto',
          nivel: 'critical',
          accion: 'bloqueo',
          titulo: 'Legajo incompleto',
          detalle: 'La politica vigente exige legajo completo antes del otorgamiento.',
        })
      }
    }

    if (
      requiereEvaluacionVigente &&
      !resumen.evaluacion_vigente &&
      !items.has('evaluacion_requerida')
    ) {
      addItem({
        codigo: 'evaluacion_requerida',
        nivel: 'critical',
        accion: 'bloqueo',
        titulo: 'Evaluacion vigente requerida',
        detalle: 'No existe una evaluacion vigente para respaldar el otorgamiento automatico.',
      })
    }

    if (resumen.riesgo.semaforo === 'rojo') {
      addItem({
        codigo: 'riesgo_semaforo_rojo',
        nivel: 'critical',
        accion: 'revision_manual',
        titulo: 'Riesgo en semaforo rojo',
        detalle: 'El resumen consolidado de riesgo requiere revision manual antes de otorgar el credito.',
      })
    }

    resumen.riesgo.alertas
      .filter((alerta) => alerta.codigo.startsWith('nosis_'))
      .forEach((alerta) => {
        addItem({
          codigo: alerta.codigo,
          nivel: alerta.nivel === 'critical' ? 'critical' : 'warning',
          accion: alerta.nivel === 'critical' ? 'revision_manual' : 'advertencia',
          titulo: alerta.titulo,
          detalle: alerta.detalle,
        })
      })

    const resultItems = Array.from(items.values())
    const estado: FinOriginacionRiesgoEstado = resultItems.some(
      (item) => item.accion === 'bloqueo'
    )
      ? 'bloqueado'
      : resultItems.some((item) => item.accion === 'revision_manual')
        ? 'revision_manual'
        : resultItems.length > 0
          ? 'advertencia'
          : 'aprobado'

    return {
      estado,
      permite_otorgar: estado === 'aprobado' || estado === 'advertencia',
      requiere_revision_manual: estado === 'revision_manual',
      semaforo: resumen.riesgo.semaforo,
      score: resumen.riesgo.score,
      linea_disponible: lineaDisponible,
      items: resultItems,
    }
  }
}
