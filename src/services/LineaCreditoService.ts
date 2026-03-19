import { ClienteService } from '@/services/ClienteService'
import { CreditoService } from '@/services/CreditoService'
import { ScoringService } from '@/services/ScoringService'
import type { FinCliente } from '@/types/fin-cliente'
import type { FinCredito } from '@/types/fin-credito'
import type {
  FinLineaCredito,
  FinLineaCreditoBuildInput,
  FinLineaCreditoEstado,
  FinLineaCreditoEvaluacionRef,
  FinLineaCreditoVigencia,
} from '@/types/fin-linea-credito'

function nowIso(): string {
  return new Date().toISOString()
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeLimit(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized < 0) {
    return null
  }

  return round2(normalized)
}

function resolveAvailable(limit: number | null, consumption: number): number | null {
  if (limit === null) {
    return null
  }

  return round2(Math.max(limit - consumption, 0))
}

function resolveCurrentMonthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7)
}

function resolveLineaEstado(
  evaluacionExists: boolean,
  vigente: boolean
): FinLineaCreditoEstado {
  if (!evaluacionExists) {
    return 'sin_evaluacion'
  }

  return vigente ? 'vigente' : 'vencida'
}

function buildEvaluacionRef(
  input: FinLineaCreditoBuildInput['evaluacion']
): FinLineaCreditoEvaluacionRef | null {
  if (!input) {
    return null
  }

  return {
    id: input.id,
    fecha: input.fecha,
    estado: input.estado,
    tier: input.tier,
    tier_asignado: input.tier_asignado,
    limite_credito_asignado: input.limite_credito_asignado,
  }
}

export class LineaCreditoService {
  static calcularConsumoActual(creditos: FinCredito[]): number {
    return round2(
      creditos.reduce((acc, credito) => acc + Number(credito.saldo_capital || 0), 0)
    )
  }

  static calcularConsumoMensualActual(
    creditos: FinCredito[],
    periodo = resolveCurrentMonthKey()
  ): number {
    return round2(
      creditos
        .filter(credito => credito.fecha_otorgamiento.slice(0, 7) === periodo)
        .reduce((acc, credito) => acc + Number(credito.capital || 0), 0)
    )
  }

  static calcularDisponibleActual(params: {
    limite_total: number | null
    limite_mensual: number | null
    consumo_actual: number
    consumo_mensual_actual: number
  }): {
    disponible_actual: number
    disponible_total_actual: number | null
    disponible_mensual_actual: number | null
  } {
    const disponibleTotal = resolveAvailable(params.limite_total, params.consumo_actual)
    const disponibleMensual = resolveAvailable(
      params.limite_mensual,
      params.consumo_mensual_actual
    )

    const disponibles = [disponibleTotal, disponibleMensual].filter(
      (value): value is number => value !== null
    )

    return {
      disponible_actual:
        disponibles.length > 0 ? round2(Math.min(...disponibles)) : 0,
      disponible_total_actual: disponibleTotal,
      disponible_mensual_actual: disponibleMensual,
    }
  }

  static build(input: FinLineaCreditoBuildInput): FinLineaCredito {
    const timestamp = input.updated_at ?? input.evaluacion?.updated_at ?? nowIso()
    const createdAt = input.created_at ?? input.evaluacion?.created_at ?? timestamp
    const consumoActual = round2(Number(input.consumo_actual || 0))
    const consumoMensualActual = round2(Number(input.consumo_mensual_actual || 0))
    const limiteTotal =
      normalizeLimit(input.limite_total) ??
      normalizeLimit(input.evaluacion?.limite_credito_asignado) ??
      normalizeLimit(input.evaluacion?.limite_sugerido)
    const limiteMensual = normalizeLimit(input.limite_mensual)
    const vigenteHasta = input.evaluacion_vigente_hasta ?? undefined
    const vigente = vigenteHasta ? new Date(vigenteHasta).getTime() >= Date.now() : true
    const evaluacionRef = buildEvaluacionRef(input.evaluacion)
    const disponibles = this.calcularDisponibleActual({
      limite_total: limiteTotal,
      limite_mensual: limiteMensual,
      consumo_actual: consumoActual,
      consumo_mensual_actual: consumoMensualActual,
    })

    const vigencia: FinLineaCreditoVigencia = {
      desde: input.evaluacion?.fecha ?? createdAt,
      hasta: vigenteHasta,
      vigente,
      estado: resolveLineaEstado(Boolean(input.evaluacion), vigente),
    }

    return {
      id: `${input.cliente_id}-linea-credito`,
      organization_id: input.organization_id,
      cliente_id: input.cliente_id,
      limite_mensual: limiteMensual,
      limite_total: limiteTotal,
      consumo_actual: consumoActual,
      consumo_mensual_actual: consumoMensualActual,
      disponible_actual: disponibles.disponible_actual,
      disponible_total_actual: disponibles.disponible_total_actual,
      disponible_mensual_actual: disponibles.disponible_mensual_actual,
      vigencia,
      evaluacion_vigente: evaluacionRef,
      created_at: createdAt,
      updated_at: timestamp,
    }
  }

  static async getLineaCreditoActual(
    orgId: string,
    clienteId: string
  ): Promise<FinLineaCredito | null> {
    const [cliente, evaluacion, creditos] = await Promise.all([
      ClienteService.getById(orgId, clienteId),
      ScoringService.getUltimaEvaluacion(orgId, clienteId),
      CreditoService.getByCliente(orgId, clienteId),
    ])

    if (!cliente) {
      return null
    }

    return this.buildFromSources({
      cliente,
      creditos,
      evaluacion,
    })
  }

  static buildFromSources(params: {
    cliente: Pick<
      FinCliente,
      | 'id'
      | 'organization_id'
      | 'limite_credito_asignado'
      | 'limite_credito_vigente'
      | 'evaluacion_vigente_hasta'
      | 'updated_at'
      | 'created_at'
    >
    creditos?: FinCredito[]
    evaluacion?: FinLineaCreditoBuildInput['evaluacion']
    limite_mensual?: number | null
  }): FinLineaCredito {
    const creditos = (params.creditos ?? []).filter(credito =>
      ['activo', 'en_mora', 'refinanciado'].includes(credito.estado)
    )

    return this.build({
      organization_id: params.cliente.organization_id,
      cliente_id: params.cliente.id,
      limite_mensual: params.limite_mensual ?? null,
      limite_total:
        params.cliente.limite_credito_vigente ??
        params.cliente.limite_credito_asignado ??
        null,
      consumo_actual: this.calcularConsumoActual(creditos),
      consumo_mensual_actual: this.calcularConsumoMensualActual(creditos),
      evaluacion: params.evaluacion ?? null,
      evaluacion_vigente_hasta: params.cliente.evaluacion_vigente_hasta,
      created_at: params.cliente.created_at,
      updated_at: params.cliente.updated_at,
    })
  }
}
