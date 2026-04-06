jest.mock('@/services/ClienteService', () => ({
  ClienteService: {
    getById: jest.fn(),
    listarConsultasNosis: jest.fn(),
  },
}))

jest.mock('@/services/CreditoService', () => ({
  CreditoService: {
    getByCliente: jest.fn(),
  },
}))

jest.mock('@/services/LineaCreditoService', () => ({
  LineaCreditoService: {
    getLineaCreditoActual: jest.fn(),
    buildFromSources: jest.fn(),
  },
}))

jest.mock('@/services/ScoringService', () => ({
  ScoringService: {
    getEvaluaciones: jest.fn(),
    getUltimaEvaluacion: jest.fn(),
  },
}))

import { ClienteService } from '@/services/ClienteService'
import { ClienteRiesgoService } from '@/services/ClienteRiesgoService'
import { CreditoService } from '@/services/CreditoService'
import { LineaCreditoService } from '@/services/LineaCreditoService'
import { ScoringService } from '@/services/ScoringService'
import type { FinCliente } from '@/types/fin-cliente'
import type { FinCredito } from '@/types/fin-credito'
import type { FinEvaluacion } from '@/types/fin-evaluacion'
import type { FinLineaCredito } from '@/types/fin-linea-credito'

const clienteServiceMock = ClienteService as jest.Mocked<typeof ClienteService>
const creditoServiceMock = CreditoService as jest.Mocked<typeof CreditoService>
const lineaCreditoServiceMock = LineaCreditoService as jest.Mocked<typeof LineaCreditoService>
const scoringServiceMock = ScoringService as jest.Mocked<typeof ScoringService>

function buildCliente(overrides: Partial<FinCliente> = {}): FinCliente {
  return {
    id: 'cli-1',
    organization_id: 'org-1',
    tipo: 'fisica',
    nombre: 'Ada',
    cuit: '20-12345678-9',
    evaluacion_vigente_hasta: '2099-12-31T00:00:00.000Z',
    creditos_activos_count: 0,
    saldo_total_adeudado: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    created_by: 'test',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

function buildEvaluacion(overrides: Partial<FinEvaluacion> = {}): FinEvaluacion {
  return {
    id: 'ev-1',
    organizacion_id: 'org-1',
    cliente_id: 'cli-1',
    fecha: '2026-04-01',
    evaluado_por: 'analista',
    items: [],
    resultado_calculado: {
      score_cualitativo: 85,
      score_conflictos: 85,
      score_cuantitativo: 85,
      score_final: 85,
      tier_sugerido: 'A',
      calculado_at: '2026-04-01T00:00:00.000Z',
    },
    decision: {
      estado: 'aprobada',
    },
    historial: [],
    score_cualitativo: 85,
    score_conflictos: 85,
    score_cuantitativo: 85,
    score_final: 85,
    tier: 'A',
    tier_sugerido: 'A',
    limite_sugerido: 100000,
    limite_credito_asignado: 100000,
    es_vigente: true,
    nosis_consultado: false,
    estado: 'aprobada',
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

function buildLineaCredito(overrides: Partial<FinLineaCredito> = {}): FinLineaCredito {
  return {
    id: 'linea-1',
    organization_id: 'org-1',
    cliente_id: 'cli-1',
    limite_mensual: 50000,
    limite_total: 100000,
    consumo_actual: 25000,
    consumo_mensual_actual: 10000,
    disponible_actual: 75000,
    disponible_mensual_actual: 40000,
    disponible_total_actual: 75000,
    vigencia: {
      desde: '2026-04-01T00:00:00.000Z',
      hasta: '2026-12-31T00:00:00.000Z',
      vigente: true,
      estado: 'vigente',
    },
    evaluacion_vigente: {
      id: 'ev-1',
      fecha: '2026-04-01',
      estado: 'aprobada',
      tier: 'A',
      tier_asignado: 'A',
      limite_credito_asignado: 100000,
    },
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

function buildCredito(overrides: Partial<FinCredito> = {}): FinCredito {
  return {
    id: 'cred-1',
    organization_id: 'org-1',
    sucursal_id: 'suc-1',
    cliente_id: 'cli-1',
    numero_credito: '0001',
    articulo_descripcion: 'Moto',
    capital: 10000,
    tasa_mensual: 5,
    snapshot_tasa_mensual: 5,
    snapshot_tasa_punitoria_mensual: 7,
    cantidad_cuotas: 12,
    sistema: 'frances',
    total_intereses: 1000,
    total_credito: 11000,
    valor_cuota_promedio: 916.67,
    fecha_otorgamiento: '2026-04-01',
    fecha_primer_vencimiento: '2026-05-01',
    estado: 'activo',
    cuotas_count: 12,
    cuotas_pagas: 0,
    saldo_capital: 10000,
    asiento_otorgamiento_id: 'as-1',
    created_at: '2026-04-01T00:00:00.000Z',
    created_by: 'test',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('ClienteRiesgoService metricas consolidadas', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-05T12:00:00.000Z'))
    jest.clearAllMocks()

    clienteServiceMock.getById.mockResolvedValue(buildCliente())
    clienteServiceMock.listarConsultasNosis.mockResolvedValue([])
    scoringServiceMock.getEvaluaciones.mockResolvedValue([buildEvaluacion()])
    scoringServiceMock.getUltimaEvaluacion.mockResolvedValue(buildEvaluacion())
    lineaCreditoServiceMock.getLineaCreditoActual.mockResolvedValue(buildLineaCredito())
    lineaCreditoServiceMock.buildFromSources.mockReturnValue(buildLineaCredito())
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('agrega cantidades y porcentajes de mora sobre el portafolio del cliente', async () => {
    creditoServiceMock.getByCliente.mockResolvedValue([
      buildCredito({
        id: 'cred-activo',
        capital: 10000,
        saldo_capital: 8000,
        estado: 'activo',
        fecha_otorgamiento: '2026-03-20',
      }),
      buildCredito({
        id: 'cred-mora',
        capital: 20000,
        saldo_capital: 15000,
        estado: 'en_mora',
        fecha_otorgamiento: '2026-04-02',
      }),
      buildCredito({
        id: 'cred-refi',
        capital: 5000,
        saldo_capital: 3000,
        estado: 'refinanciado',
        fecha_otorgamiento: '2026-02-10',
      }),
      buildCredito({
        id: 'cred-cancelado',
        capital: 7000,
        saldo_capital: 0,
        estado: 'cancelado',
        fecha_otorgamiento: '2026-01-15',
      }),
      buildCredito({
        id: 'cred-incobrable',
        capital: 3000,
        saldo_capital: 3000,
        estado: 'incobrable',
        fecha_otorgamiento: '2026-03-01',
      }),
    ])

    const result = await ClienteRiesgoService.getResumenRiesgo('org-1', 'cli-1')

    expect(result).not.toBeNull()
    expect(result?.metricas).toMatchObject({
      total_creditos: 5,
      creditos_activos: 3,
      creditos_en_mora: 1,
      creditos_cancelados: 1,
      creditos_refinanciados: 1,
      creditos_incobrables: 1,
      capital_total_otorgado: 45000,
      saldo_capital_activo: 26000,
      ticket_promedio: 9000,
      porcentaje_creditos_en_mora: 20,
      porcentaje_saldo_en_mora: 57.69,
      antiguedad_primer_credito_dias: 80,
      fecha_ultimo_credito: '2026-04-02',
    })
  })

  it('devuelve metricas en cero cuando el cliente no tiene creditos', async () => {
    creditoServiceMock.getByCliente.mockResolvedValue([])

    const result = await ClienteRiesgoService.getResumenRiesgo('org-1', 'cli-1')

    expect(result).not.toBeNull()
    expect(result?.metricas).toMatchObject({
      total_creditos: 0,
      creditos_activos: 0,
      creditos_en_mora: 0,
      capital_total_otorgado: 0,
      saldo_capital_activo: 0,
      ticket_promedio: 0,
      porcentaje_creditos_en_mora: 0,
      porcentaje_saldo_en_mora: 0,
      antiguedad_primer_credito_dias: null,
      fecha_ultimo_credito: null,
    })
  })
})
