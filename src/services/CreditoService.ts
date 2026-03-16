import { FIN_COLLECTIONS } from '@/firebase/collections';
import { getAdminFirestore } from '@/firebase/admin';
import { AmortizationService } from '@/services/AmortizationService';
import type { FinAsiento, FinAsientoLinea } from '@/types/fin-asiento';
import type { FinConfigCuentas, FinCuenta } from '@/types/fin-plan-cuentas';
import type { FinCredito, FinCreditoCreateInput, FinCreditoEstado } from '@/types/fin-credito';
import type { FinCuota, FinCuotaEstado } from '@/types/fin-cuota';
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
    const tablaAmortizacion = AmortizationService.calcular(
      input.capital,
      input.tasa_mensual,
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

      const config = normalizeConfig(orgId, configSnap.data());
      const [
        creditosSnap,
        interesesNoDevengadosSnap,
        ventasFinanciadasSnap,
      ] = await Promise.all([
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
      ]);

      const nextSequence = sequenceSnap.exists
        ? Number(sequenceSnap.data()?.value || 0) + 1
        : 1;

      const numeroCredito = `${year}-${String(nextSequence).padStart(6, '0')}`;

      const credito: FinCredito = {
        id: creditoRef.id,
        organization_id: orgId,
        sucursal_id: input.sucursal_id,
        cliente_id: input.cliente_id,
        numero_credito: numeroCredito,
        articulo_descripcion: input.articulo_descripcion.trim(),
        articulo_codigo: input.articulo_codigo?.trim() || undefined,
        capital: round2(input.capital),
        tasa_mensual: input.tasa_mensual,
        cantidad_cuotas: input.cantidad_cuotas,
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
        asiento_otorgamiento_id: asientoRef.id,
        created_at: now,
        created_by: usuarioId,
        updated_at: now,
      };

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

      transaction.set(creditoRef, credito);
      transaction.set(asientoRef, asiento);
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
