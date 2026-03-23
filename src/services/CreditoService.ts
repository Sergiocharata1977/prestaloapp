import { FIN_COLLECTIONS } from '@/firebase/collections';
import { getAdminFirestore } from '@/firebase/admin';
import { AmortizationService } from '@/services/AmortizationService';
import { LineaCreditoService } from '@/services/LineaCreditoService';
import { PlanFinanciacionService } from '@/services/PlanFinanciacionService';
import type { FinAsiento, FinAsientoLinea } from '@/types/fin-asiento';
import type { FinCliente } from '@/types/fin-cliente';
import type { FinConfigCuentas, FinCuenta } from '@/types/fin-plan-cuentas';
import type { FinCredito, FinCreditoCreateInput, FinCreditoEstado } from '@/types/fin-credito';
import type { FinCuota, FinCuotaEstado } from '@/types/fin-cuota';
import type { FinEvaluacion } from '@/types/fin-evaluacion';
import type { FinLineaCredito } from '@/types/fin-linea-credito';
import type { FinPlanFinanciacion } from '@/types/fin-plan-financiacion';
import type { FinPoliticaCrediticia } from '@/types/fin-politica-crediticia';
import type { FinTipoCliente } from '@/types/fin-tipo-cliente';
import { FieldValue } from 'firebase-admin/firestore';

type CreditoListFilters = {
  cliente_id?: string;
  estado?: FinCreditoEstado;
  sucursal_id?: string;
};

type CuentaContable = Pick<FinCuenta, 'id' | 'codigo' | 'nombre'>;

const PLUGIN_ID = 'financiacion_consumo';

function nowIso(): string {
  return new Date().toISOString();
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function startOfDayUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function diferenciaDias(desde: Date, hasta: Date): number {
  return Math.floor((startOfDayUtc(hasta) - startOfDayUtc(desde)) / 86400000);
}

function minNumber(values: Array<number | null | undefined>): number | null {
  const normalized = values.filter((value): value is number => typeof value === 'number');
  return normalized.length > 0 ? Math.min(...normalized) : null;
}

function resolvePeriodoOtorgamiento(fechaOtorgamiento: string): string {
  return fechaOtorgamiento.slice(0, 7);
}

function resolveConsumoMensual(
  creditos: FinCredito[],
  periodo: string
): number {
  return round2(
    creditos
      .filter(credito => credito.fecha_otorgamiento.slice(0, 7) === periodo)
      .reduce((acc, credito) => acc + Number(credito.capital || 0), 0)
  );
}

function resolvePoliticaTier(
  politica: FinPoliticaCrediticia | undefined,
  evaluacion: FinEvaluacion | null
) {
  if (!politica || !evaluacion) {
    return undefined;
  }

  const tier = evaluacion.tier_asignado ?? evaluacion.tier;
  return politica.tiers.find(item => item.tier === tier);
}

function isLegajoCompleto(cliente: FinCliente): boolean {
  return cliente.legajo?.estado === 'completo';
}

function isEvaluacionClienteVigente(
  cliente: FinCliente,
  evaluacion: FinEvaluacion | null,
  fechaControl: string
): boolean {
  if (!evaluacion || !evaluacion.es_vigente || evaluacion.estado !== 'aprobada') {
    return false;
  }

  if (!cliente.evaluacion_vigente_hasta) {
    return true;
  }

  return cliente.evaluacion_vigente_hasta >= fechaControl;
}

function mapCliente(
  doc: FirebaseFirestore.DocumentSnapshot
): FinCliente | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinCliente;
}

function mapEvaluacion(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): FinEvaluacion | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinEvaluacion;
}

function resolveLineaCredito(params: {
  cliente: FinCliente;
  creditosActivos: FinCredito[];
  evaluacion: FinEvaluacion | null;
  politica?: FinPoliticaCrediticia;
  fechaOtorgamiento: string;
}): FinLineaCredito {
  const politicaTier = resolvePoliticaTier(params.politica, params.evaluacion);
  const limitePoliticaTotal =
    politicaTier?.limite_total ?? params.politica?.limite_total ?? null;
  const limitePoliticaMensual =
    politicaTier?.limite_mensual ?? params.politica?.limite_mensual ?? null;
  const limiteClienteTotal =
    params.cliente.limite_credito_vigente ??
    params.cliente.limite_credito_asignado ??
    params.evaluacion?.limite_credito_asignado ??
    params.evaluacion?.limite_credito_sugerido ??
    null;

  const consumoActual = LineaCreditoService.calcularConsumoActual(
    params.creditosActivos
  );
  const consumoMensualActual = resolveConsumoMensual(
    params.creditosActivos,
    resolvePeriodoOtorgamiento(params.fechaOtorgamiento)
  );

  const disponible = LineaCreditoService.calcularDisponibleActual({
    limite_total: minNumber([limiteClienteTotal, limitePoliticaTotal]),
    limite_mensual: limitePoliticaMensual,
    consumo_actual: consumoActual,
    consumo_mensual_actual: consumoMensualActual,
  });

  return {
    id: `${params.cliente.id}-linea-credito`,
    organization_id: params.cliente.organization_id,
    cliente_id: params.cliente.id,
    limite_total: minNumber([limiteClienteTotal, limitePoliticaTotal]),
    limite_mensual: limitePoliticaMensual,
    consumo_actual: consumoActual,
    consumo_mensual_actual: consumoMensualActual,
    disponible_actual: disponible.disponible_actual,
    disponible_total_actual: disponible.disponible_total_actual,
    disponible_mensual_actual: disponible.disponible_mensual_actual,
    vigencia: {
      desde: params.evaluacion?.fecha ?? params.cliente.created_at,
      hasta: params.cliente.evaluacion_vigente_hasta,
      vigente: isEvaluacionClienteVigente(
        params.cliente,
        params.evaluacion,
        params.fechaOtorgamiento
      ),
      estado: params.evaluacion
        ? isEvaluacionClienteVigente(
            params.cliente,
            params.evaluacion,
            params.fechaOtorgamiento
          )
          ? 'vigente'
          : 'vencida'
        : 'sin_evaluacion',
    },
    evaluacion_vigente: params.evaluacion
      ? {
          id: params.evaluacion.id,
          fecha: params.evaluacion.fecha,
          estado: params.evaluacion.estado,
          tier: params.evaluacion.tier,
          tier_asignado: params.evaluacion.tier_asignado,
          limite_credito_asignado: params.evaluacion.limite_credito_asignado,
        }
      : null,
    created_at: params.cliente.created_at,
    updated_at: params.cliente.updated_at,
  };
}

function mapCredito(
  doc: FirebaseFirestore.DocumentSnapshot
): FinCredito | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinCredito;
}

function resolveCuotaEstado(cuota: FinCuota): FinCuotaEstado {
  if (cuota.estado === 'pagada') {
    return 'pagada';
  }

  const today = new Date().toISOString().slice(0, 10);
  return cuota.fecha_vencimiento < today ? 'vencida' : 'pendiente';
}

function mapCuota(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): FinCuota | null {
  if (!doc.exists) {
    return null;
  }

  const cuota = {
    id: doc.id,
    ...doc.data(),
  } as FinCuota;

  return {
    ...cuota,
    estado: resolveCuotaEstado(cuota),
  };
}

function getPeriodo(fechaIso: string): string {
  const date = new Date(fechaIso);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha invalida para asiento: ${fechaIso}`);
  }

  return date.toISOString().slice(0, 7);
}

function buildLinea(
  cuenta: CuentaContable,
  descripcion: string,
  debe = 0,
  haber = 0
): FinAsientoLinea {
  return {
    cuenta_id: cuenta.id,
    cuenta_codigo: cuenta.codigo,
    cuenta_nombre: cuenta.nombre,
    debe: round2(debe),
    haber: round2(haber),
    descripcion,
  };
}

function normalizeConfig(
  orgId: string,
  raw: FirebaseFirestore.DocumentData | undefined
): FinConfigCuentas {
  if (!raw) {
    throw new Error(
      `Configuracion de cuentas no encontrada para plugin ${PLUGIN_ID}`
    );
  }

  const cuentas = raw.cuentas ?? {
    creditos_por_financiaciones: raw.creditos_por_financiaciones,
    intereses_no_devengados: raw.intereses_no_devengados,
    ventas_financiadas: raw.ventas_financiadas,
    intereses_ganados: raw.intereses_ganados,
  };

  const config: FinConfigCuentas = {
    organization_id: raw.organization_id || orgId,
    plugin: raw.plugin || PLUGIN_ID,
    cuentas: {
      creditos_por_financiaciones: String(
        cuentas.creditos_por_financiaciones || ''
      ).trim(),
      intereses_no_devengados: String(
        cuentas.intereses_no_devengados || ''
      ).trim(),
      ventas_financiadas: String(cuentas.ventas_financiadas || '').trim(),
      intereses_ganados: String(cuentas.intereses_ganados || '').trim(),
    },
  };

  if (
    !config.cuentas.creditos_por_financiaciones ||
    !config.cuentas.intereses_no_devengados ||
    !config.cuentas.ventas_financiadas
  ) {
    throw new Error(
      `Configuracion de cuentas incompleta para plugin ${PLUGIN_ID}`
    );
  }

  return config;
}

function parseCuenta(
  id: string,
  raw: FirebaseFirestore.DocumentData | undefined
): CuentaContable {
  if (!raw?.codigo || !raw?.nombre) {
    throw new Error(`Cuenta contable invalida: ${id}`);
  }

  return {
    id,
    codigo: String(raw.codigo),
    nombre: String(raw.nombre),
  };
}

function buildAsientoOtorgamiento(
  credito: FinCredito,
  config: FinConfigCuentas,
  cuentas: {
    creditos: CuentaContable;
    interesesNoDevengados: CuentaContable;
    ventasFinanciadas: CuentaContable;
  },
  asientoId: string,
  usuarioId: string,
  usuarioNombre: string
): FinAsiento {
  const lineas: FinAsientoLinea[] = [
    buildLinea(
      cuentas.creditos,
      `Otorgamiento credito ${credito.numero_credito} - capital`,
      credito.capital,
      0
    ),
    buildLinea(
      cuentas.interesesNoDevengados,
      `Otorgamiento credito ${credito.numero_credito} - interes diferido`,
      credito.total_intereses,
      0
    ),
    buildLinea(
      cuentas.ventasFinanciadas,
      `Otorgamiento credito ${credito.numero_credito} - venta financiada`,
      0,
      credito.capital
    ),
    buildLinea(
      cuentas.interesesNoDevengados,
      `Otorgamiento credito ${credito.numero_credito} - contrapartida interes diferido`,
      0,
      credito.total_intereses
    ),
  ];

  const total_debe = round2(
    lineas.reduce((acc, linea) => acc + Number(linea.debe || 0), 0)
  );
  const total_haber = round2(
    lineas.reduce((acc, linea) => acc + Number(linea.haber || 0), 0)
  );

  if (total_debe !== total_haber) {
    throw new Error('El asiento de otorgamiento quedo desbalanceado');
  }

  return {
    id: asientoId,
    organization_id: credito.organization_id,
    sucursal_id: credito.sucursal_id,
    origen: 'credito_otorgado',
    documento_id: credito.id,
    documento_tipo: 'credito',
    fecha: credito.fecha_otorgamiento,
    periodo: getPeriodo(credito.fecha_otorgamiento),
    estado: 'contabilizado',
    lineas,
    total_debe,
    total_haber,
    creado_por: {
      usuario_id: usuarioId,
      nombre: usuarioNombre,
      timestamp: nowIso(),
    },
  };
}

export class CreditoService {
  static async resolveTasaInput(
    orgId: string,
    input: Pick<
      FinCreditoCreateInput,
      | 'cantidad_cuotas'
      | 'plan_financiacion_id'
      | 'tasa_mensual'
      | 'tipo_cliente_id'
      | 'politica_crediticia_id'
      | 'plan_snapshot'
      | 'politica_snapshot'
      | 'tipo_cliente_snapshot'
    >
  ): Promise<{
    tasaMensual: number;
    plan?: FinPlanFinanciacion;
    politica?: FinPoliticaCrediticia;
    tipoCliente?: FinTipoCliente;
  }> {
    const db = getAdminFirestore();

    if (!input.plan_financiacion_id) {
      if (typeof input.tasa_mensual !== 'number') {
        throw new Error('tasa_mensual requerida');
      }

      return { tasaMensual: input.tasa_mensual };
    }

    const planSnap = await db
      .doc(FIN_COLLECTIONS.planFinanciacion(orgId, input.plan_financiacion_id))
      .get();

    if (!planSnap.exists) {
      throw new Error('Plan de financiacion no encontrado');
    }

    const plan = {
      id: planSnap.id,
      ...planSnap.data(),
    } as FinPlanFinanciacion;

    const politicaSnap = await db
      .doc(FIN_COLLECTIONS.politicaCrediticia(orgId, plan.politica_id))
      .get();

    if (!politicaSnap.exists) {
      throw new Error('Politica crediticia no encontrada');
    }

    const politica = {
      id: politicaSnap.id,
      ...politicaSnap.data(),
    } as FinPoliticaCrediticia;

    const tipoClienteSnap = await db
      .doc(FIN_COLLECTIONS.tipoCliente(orgId, politica.tipo_cliente_id))
      .get();

    const tipoCliente = tipoClienteSnap.exists
      ? ({
          id: tipoClienteSnap.id,
          ...tipoClienteSnap.data(),
        } as FinTipoCliente)
      : undefined;

    return {
      tasaMensual: PlanFinanciacionService.resolverTasa(plan, input.cantidad_cuotas),
      plan,
      politica,
      tipoCliente,
    };
  }

  static calcularMora(
    credito: FinCredito,
    cuota: FinCuota,
    fechaCalculo: Date
  ): number {
    const diasVencidos = Math.max(
      0,
      diferenciaDias(new Date(cuota.fecha_vencimiento), fechaCalculo)
    );

    if (diasVencidos === 0) {
      return 0;
    }

    const tasaDiaria = credito.snapshot_tasa_punitoria_mensual / 100 / 30;
    return round2(cuota.total * tasaDiaria * diasVencidos);
  }

  static async validarOtorgamiento(
    orgId: string,
    input: FinCreditoCreateInput
  ): Promise<{
    linea: FinLineaCredito;
    cliente: FinCliente;
    evaluacion: FinEvaluacion | null;
    tasaData: Awaited<ReturnType<typeof CreditoService.resolveTasaInput>>;
  }> {
    const db = getAdminFirestore();
    const tasaData = await this.resolveTasaInput(orgId, input);
    const [clienteSnap, evaluacionSnap, creditosSnap] = await Promise.all([
      db.doc(FIN_COLLECTIONS.cliente(orgId, input.cliente_id)).get(),
      db
        .collection(FIN_COLLECTIONS.evaluaciones(orgId))
        .where('cliente_id', '==', input.cliente_id)
        .where('es_vigente', '==', true)
        .limit(1)
        .get(),
      db
        .collection(FIN_COLLECTIONS.creditos(orgId))
        .where('cliente_id', '==', input.cliente_id)
        .get(),
    ]);

    const cliente = mapCliente(clienteSnap);
    if (!cliente) {
      throw new Error('Cliente no encontrado');
    }

    const evaluacion =
      evaluacionSnap.docs
        .map(doc => mapEvaluacion(doc))
        .find((item): item is FinEvaluacion => Boolean(item)) ?? null;

    const creditosActivos = creditosSnap.docs
      .map(doc => mapCredito(doc))
      .filter((credito): credito is FinCredito => Boolean(credito))
      .filter(credito =>
        ['activo', 'en_mora', 'refinanciado'].includes(credito.estado)
      );

    const linea = resolveLineaCredito({
      cliente,
      creditosActivos,
      evaluacion,
      politica: tasaData.politica,
      fechaOtorgamiento: input.fecha_otorgamiento,
    });

    if (linea.disponible_actual <= 0 || input.capital > linea.disponible_actual) {
      throw new Error('No hay linea disponible suficiente para otorgar el credito');
    }

    if (
      tasaData.politica?.requiere_evaluacion_vigente &&
      !isEvaluacionClienteVigente(cliente, evaluacion, input.fecha_otorgamiento)
    ) {
      throw new Error('La politica requiere una evaluacion vigente');
    }

    if (tasaData.politica?.requiere_legajo && !isLegajoCompleto(cliente)) {
      throw new Error('La politica requiere legajo completo');
    }

    return {
      linea,
      cliente,
      evaluacion,
      tasaData,
    };
  }

  static async crear(
    orgId: string,
    input: FinCreditoCreateInput,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<{
    creditoId: string;
    asientoId: string;
    tabla_amortizacion: ReturnType<typeof AmortizationService.calcular>;
  }> {
    const db = getAdminFirestore();
    const validacion = await this.validarOtorgamiento(orgId, input);
    const { linea, evaluacion, tasaData } = validacion;
    const tablaAmortizacion = AmortizationService.calcular(
      input.capital,
      tasaData.tasaMensual / 100,
      input.cantidad_cuotas,
      input.sistema,
      input.fecha_primer_vencimiento
    );

    const now = nowIso();
    const creditoRef = db.collection(FIN_COLLECTIONS.creditos(orgId)).doc();
    const asientoRef = db.collection(FIN_COLLECTIONS.asientos(orgId)).doc();
    const year = new Date(input.fecha_otorgamiento).getUTCFullYear();

    if (Number.isNaN(year)) {
      throw new Error('fecha_otorgamiento invalida');
    }

    const sequenceRef = db.doc(
      `${FIN_COLLECTIONS.orgBase(orgId)}/fin_sequences/creditos_${year}`
    );
    const clienteRef = db.doc(FIN_COLLECTIONS.cliente(orgId, input.cliente_id));
    const configRef = db.doc(FIN_COLLECTIONS.configCuentas(orgId, PLUGIN_ID));

    return db.runTransaction(async transaction => {
      const [
        sequenceSnap,
        clienteSnap,
        configSnap,
      ] = await Promise.all([
        transaction.get(sequenceRef),
        transaction.get(clienteRef),
        transaction.get(configRef),
      ]);

      if (!clienteSnap.exists) {
        throw new Error('Cliente no encontrado');
      }

      const clienteActual = mapCliente(clienteSnap);
      if (!clienteActual) {
        throw new Error('Cliente no encontrado');
      }

      const [evaluacionTxSnap, creditosClienteTxSnap] = await Promise.all([
        transaction.get(
          db
            .collection(FIN_COLLECTIONS.evaluaciones(orgId))
            .where('cliente_id', '==', input.cliente_id)
            .where('es_vigente', '==', true)
            .limit(1)
        ),
        transaction.get(
          db
            .collection(FIN_COLLECTIONS.creditos(orgId))
            .where('cliente_id', '==', input.cliente_id)
        ),
      ]);

      const evaluacionActual =
        evaluacionTxSnap.docs
          .map(doc => mapEvaluacion(doc))
          .find((item): item is FinEvaluacion => Boolean(item)) ?? evaluacion;

      const creditosClienteActivos = creditosClienteTxSnap.docs
        .map(doc => mapCredito(doc))
        .filter((credito): credito is FinCredito => Boolean(credito))
        .filter(credito =>
          ['activo', 'en_mora', 'refinanciado'].includes(credito.estado)
        );

      const lineaActual = resolveLineaCredito({
        cliente: clienteActual,
        creditosActivos: creditosClienteActivos,
        evaluacion: evaluacionActual,
        politica: tasaData.politica,
        fechaOtorgamiento: input.fecha_otorgamiento,
      });

      if (
        lineaActual.disponible_actual <= 0 ||
        input.capital > lineaActual.disponible_actual
      ) {
        throw new Error('No hay linea disponible suficiente para otorgar el credito');
      }

      if (
        tasaData.politica?.requiere_evaluacion_vigente &&
        !isEvaluacionClienteVigente(
          clienteActual,
          evaluacionActual,
          input.fecha_otorgamiento
        )
      ) {
        throw new Error('La politica requiere una evaluacion vigente');
      }

      if (tasaData.politica?.requiere_legajo && !isLegajoCompleto(clienteActual)) {
        throw new Error('La politica requiere legajo completo');
      }

      let config: FinConfigCuentas | null = null;
      try {
        config = normalizeConfig(orgId, configSnap.data());
      } catch {
        // Plan de cuentas no configurado — asiento contable omitido
      }

      const accountSnaps = config
        ? await Promise.all([
            transaction.get(
              db.doc(
                `${FIN_COLLECTIONS.cuentas(orgId)}/${config.cuentas.creditos_por_financiaciones}`
              )
            ),
            transaction.get(
              db.doc(
                `${FIN_COLLECTIONS.cuentas(orgId)}/${config.cuentas.intereses_no_devengados}`
              )
            ),
            transaction.get(
              db.doc(
                `${FIN_COLLECTIONS.cuentas(orgId)}/${config.cuentas.ventas_financiadas}`
              )
            ),
          ])
        : null;

      const nextSequence = sequenceSnap.exists
        ? Number(sequenceSnap.data()?.value || 0) + 1
        : 1;

      const numeroCredito = `${year}-${String(nextSequence).padStart(6, '0')}`;

      const credito: FinCredito = {
        id: creditoRef.id,
        organization_id: orgId,
        sucursal_id: input.sucursal_id,
        cliente_id: input.cliente_id,
        tipo_cliente_id:
          input.tipo_cliente_id ??
          tasaData.tipoCliente?.id ??
          input.tipo_cliente_snapshot?.id,
        numero_credito: numeroCredito,
        articulo_descripcion: input.articulo_descripcion.trim(),
        articulo_codigo: input.articulo_codigo?.trim() || undefined,
        tipo_operacion:
          input.tipo_operacion ??
          tasaData.politica?.tipo_operacion ??
          input.politica_snapshot?.tipo_operacion,
        politica_crediticia_id:
          input.politica_crediticia_id ??
          tasaData.politica?.id ??
          input.politica_snapshot?.id,
        plan_financiacion_id:
          input.plan_financiacion_id ??
          tasaData.plan?.id ??
          input.plan_snapshot?.id,
        tipo_cliente_snapshot:
          input.tipo_cliente_snapshot ??
          (tasaData.tipoCliente
            ? {
                id: tasaData.tipoCliente.id,
                codigo: tasaData.tipoCliente.codigo,
                nombre: tasaData.tipoCliente.nombre,
                tipo_base: tasaData.tipoCliente.tipo_base,
              }
            : undefined),
        politica_snapshot:
          input.politica_snapshot ??
          (tasaData.politica
            ? {
                id: tasaData.politica.id,
                codigo: tasaData.politica.codigo,
                nombre: tasaData.politica.nombre,
                tipo_operacion: tasaData.politica.tipo_operacion,
                requiere_legajo: tasaData.politica.requiere_legajo,
                requiere_evaluacion_vigente:
                  tasaData.politica.requiere_evaluacion_vigente,
                limite_mensual: tasaData.politica.limite_mensual,
                limite_total: tasaData.politica.limite_total,
                tiers: tasaData.politica.tiers,
              }
            : undefined),
        plan_snapshot:
          input.plan_snapshot ??
          (tasaData.plan
            ? {
                id: tasaData.plan.id,
                nombre: tasaData.plan.nombre,
                tramos_tasa: tasaData.plan.tramos_tasa,
                tasa_punitoria_mensual: tasaData.plan.tasa_punitoria_mensual,
                cargo_fijo: tasaData.plan.cargo_fijo,
                cargo_variable_pct: tasaData.plan.cargo_variable_pct,
              }
            : undefined),
        tier_sugerido:
          input.tier_sugerido ?? evaluacionActual?.tier_sugerido ?? evaluacion?.tier_sugerido,
        tier_asignado:
          input.tier_asignado ?? evaluacionActual?.tier_asignado ?? evaluacion?.tier_asignado,
        limite_credito_asignado:
          input.limite_credito_asignado ??
          evaluacionActual?.limite_credito_asignado ??
          evaluacion?.limite_credito_asignado ??
          lineaActual.limite_total ??
          linea.limite_total ??
          undefined,
        capital: round2(input.capital),
        tasa_mensual: tasaData.tasaMensual,
        cantidad_cuotas: input.cantidad_cuotas,
        snapshot_tasa_mensual: tasaData.tasaMensual,
        snapshot_tasa_punitoria_mensual:
          tasaData.plan?.tasa_punitoria_mensual ??
          input.plan_snapshot?.tasa_punitoria_mensual ??
          0,
        snapshot_cargo_fijo:
          tasaData.plan?.cargo_fijo ?? input.plan_snapshot?.cargo_fijo,
        snapshot_cargo_variable_pct:
          tasaData.plan?.cargo_variable_pct ?? input.plan_snapshot?.cargo_variable_pct,
        sistema: input.sistema,
        total_intereses: tablaAmortizacion.total_intereses,
        total_credito: tablaAmortizacion.total_credito,
        valor_cuota_promedio: tablaAmortizacion.valor_cuota_promedio,
        fecha_otorgamiento: input.fecha_otorgamiento,
        fecha_primer_vencimiento: input.fecha_primer_vencimiento,
        estado: 'activo',
        cuotas_count: input.cantidad_cuotas,
        cuotas_pagas: 0,
        saldo_capital: round2(input.capital),
        asiento_otorgamiento_id: config ? asientoRef.id : '',
        created_at: now,
        created_by: usuarioId,
        updated_at: now,
      };

      transaction.set(creditoRef, credito);

      if (config && accountSnaps) {
        const [creditosSnap, interesesNoDevengadosSnap, ventasFinanciadasSnap] =
          accountSnaps;
        const asiento = buildAsientoOtorgamiento(
          credito,
          config,
          {
            creditos: parseCuenta(
              config.cuentas.creditos_por_financiaciones,
              creditosSnap.data()
            ),
            interesesNoDevengados: parseCuenta(
              config.cuentas.intereses_no_devengados,
              interesesNoDevengadosSnap.data()
            ),
            ventasFinanciadas: parseCuenta(
              config.cuentas.ventas_financiadas,
              ventasFinanciadasSnap.data()
            ),
          },
          asientoRef.id,
          usuarioId,
          usuarioNombre
        );
        transaction.set(asientoRef, asiento);
      }
      transaction.set(
        sequenceRef,
        {
          value: nextSequence,
          year,
          updated_at: now,
        },
        { merge: true }
      );
      transaction.update(clienteRef, {
        creditos_activos_count: FieldValue.increment(1),
        saldo_total_adeudado: FieldValue.increment(round2(input.capital)),
        updated_at: now,
      });

      for (const cuotaCalculada of tablaAmortizacion.cuotas) {
        const cuotaRef = db.collection(FIN_COLLECTIONS.cuotas(orgId)).doc();
        const cuota: FinCuota = {
          id: cuotaRef.id,
          organization_id: orgId,
          sucursal_id: input.sucursal_id,
          credito_id: creditoRef.id,
          cliente_id: input.cliente_id,
          numero_cuota: cuotaCalculada.numero_cuota,
          fecha_vencimiento: cuotaCalculada.fecha_vencimiento,
          capital: cuotaCalculada.capital,
          interes: cuotaCalculada.interes,
          total: cuotaCalculada.total,
          saldo_capital_inicio: cuotaCalculada.saldo_capital_inicio,
          saldo_capital_fin: cuotaCalculada.saldo_capital_fin,
          estado: 'pendiente',
          created_at: now,
          updated_at: now,
        };

        transaction.set(cuotaRef, cuota);
      }

      return {
        creditoId: creditoRef.id,
        asientoId: asientoRef.id,
        tabla_amortizacion: tablaAmortizacion,
      };
    });
  }

  static async getById(
    orgId: string,
    creditoId: string
  ): Promise<FinCredito | null> {
    const db = getAdminFirestore();
    const doc = await db.doc(FIN_COLLECTIONS.credito(orgId, creditoId)).get();
    return mapCredito(doc);
  }

  static async getByCliente(
    orgId: string,
    clienteId: string
  ): Promise<FinCredito[]> {
    return this.list(orgId, { cliente_id: clienteId });
  }

  static async list(
    orgId: string,
    filters: CreditoListFilters = {}
  ): Promise<FinCredito[]> {
    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(FIN_COLLECTIONS.creditos(orgId));

    if (filters.cliente_id) {
      query = query.where('cliente_id', '==', filters.cliente_id);
    }

    if (filters.estado) {
      query = query.where('estado', '==', filters.estado);
    }

    if (filters.sucursal_id) {
      query = query.where('sucursal_id', '==', filters.sucursal_id);
    }

    const snapshot = await query.get();

    return snapshot.docs
      .map(doc => mapCredito(doc))
      .filter((credito): credito is FinCredito => Boolean(credito))
      .sort((a, b) => b.fecha_otorgamiento.localeCompare(a.fecha_otorgamiento));
  }

  static async getCuotas(
    orgId: string,
    creditoId: string,
    estado?: FinCuotaEstado
  ): Promise<FinCuota[]> {
    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db
      .collection(FIN_COLLECTIONS.cuotas(orgId))
      .where('credito_id', '==', creditoId);

    if (estado === 'pagada') {
      query = query.where('estado', '==', 'pagada');
    } else if (estado === 'pendiente') {
      query = query.where('estado', '==', 'pendiente');
    } else if (estado === 'vencida') {
      query = query.where('estado', '==', 'pendiente');
    }

    const snapshot = await query.get();
    const cuotas = snapshot.docs
      .map(doc => mapCuota(doc))
      .filter((cuota): cuota is FinCuota => Boolean(cuota))
      .sort((a, b) => a.numero_cuota - b.numero_cuota);

    if (!estado) {
      return cuotas;
    }

    return cuotas.filter(cuota => cuota.estado === estado);
  }

  static async getCuotasPendientes(
    orgId: string,
    creditoId: string
  ): Promise<FinCuota[]> {
    const cuotas = await this.getCuotas(orgId, creditoId);
    return cuotas.filter(
      cuota => cuota.estado === 'pendiente' || cuota.estado === 'vencida'
    );
  }

  static async actualizarEstado(
    orgId: string,
    creditoId: string,
    estado: FinCreditoEstado
  ): Promise<void> {
    const db = getAdminFirestore();
    await db.doc(FIN_COLLECTIONS.credito(orgId, creditoId)).update({
      estado,
      updated_at: nowIso(),
    });
  }
}
