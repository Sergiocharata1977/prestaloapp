import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import { JournalEntryService } from '@/services/JournalEntryService';
import type { FinCobro, FinCobroCreateInput } from '@/types/fin-cobro';
import type { FinConfigCuentas } from '@/types/fin-plan-cuentas';
import type { FinCredito } from '@/types/fin-credito';
import type { FinCuota, FinCuotaEstado } from '@/types/fin-cuota';
import type { FinCaja, FinCajaEstado } from '@/types/fin-sucursal';
import { FieldValue } from 'firebase-admin/firestore';

type CobroListFilters = {
  credito_id?: string;
  sucursal_id?: string;
  desde?: string;
};

const PLUGIN_ID = 'financiacion_consumo';

function nowIso(): string {
  return new Date().toISOString();
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function resolveCuotaEstado(cuota: FinCuota): FinCuotaEstado {
  if (cuota.estado === 'pagada') {
    return 'pagada';
  }

  const today = new Date().toISOString().slice(0, 10);
  return cuota.fecha_vencimiento < today ? 'vencida' : 'pendiente';
}

function mapCobro(
  doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot
): FinCobro | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinCobro;
}

function mapCredito(doc: FirebaseFirestore.DocumentSnapshot): FinCredito | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinCredito;
}

function mapCuota(doc: FirebaseFirestore.DocumentSnapshot): FinCuota | null {
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

function mapCaja(doc: FirebaseFirestore.DocumentSnapshot): FinCaja | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinCaja;
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
    !config.cuentas.intereses_ganados
  ) {
    throw new Error(
      `Configuracion de cuentas incompleta para plugin ${PLUGIN_ID}`
    );
  }

  return config;
}

function validateCajaEstado(estado: FinCajaEstado | undefined): void {
  if (estado !== 'abierta') {
    throw new Error('La caja debe estar abierta para registrar cobros');
  }
}

export class CobroService {
  static async registrar(
    orgId: string,
    input: FinCobroCreateInput,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<{ cobroId: string; asientoId: string }> {
    const db = getAdminFirestore();
    const now = nowIso();
    const cobroRef = db.collection(FIN_COLLECTIONS.cobros(orgId)).doc();
    const asientoRef = db.collection(FIN_COLLECTIONS.asientos(orgId)).doc();
    const cuotaRef = db.doc(FIN_COLLECTIONS.cuota(orgId, input.cuota_id));
    const creditoRef = db.doc(FIN_COLLECTIONS.credito(orgId, input.credito_id));
    const cajaRef = db.doc(
      FIN_COLLECTIONS.caja(orgId, input.sucursal_id, input.caja_id)
    );
    const configRef = db.doc(FIN_COLLECTIONS.configCuentas(orgId, PLUGIN_ID));

    return db.runTransaction(async transaction => {
      const [cuotaSnap, creditoSnap, cajaSnap, configSnap] = await Promise.all([
        transaction.get(cuotaRef),
        transaction.get(creditoRef),
        transaction.get(cajaRef),
        transaction.get(configRef),
      ]);

      const cuota = mapCuota(cuotaSnap);
      if (!cuota) {
        throw new Error('Cuota no encontrada');
      }

      if (cuota.credito_id !== input.credito_id) {
        throw new Error('La cuota no pertenece al credito indicado');
      }

      if (cuota.sucursal_id !== input.sucursal_id) {
        throw new Error('La cuota no pertenece a la sucursal indicada');
      }

      if (!['pendiente', 'vencida'].includes(cuota.estado)) {
        throw new Error('La cuota ya fue cobrada');
      }

      const credito = mapCredito(creditoSnap);
      if (!credito) {
        throw new Error('Credito no encontrado');
      }

      if (credito.estado === 'cancelado') {
        throw new Error('El credito ya esta cancelado');
      }

      const caja = mapCaja(cajaSnap);
      if (!caja) {
        throw new Error('Caja no encontrada');
      }

      validateCajaEstado(caja.estado);

      if (!caja.cuenta_contable_id?.trim()) {
        throw new Error('La caja no tiene cuenta contable configurada');
      }

      const config = normalizeConfig(orgId, configSnap.data());
      const capitalCobrado = round2(cuota.capital);
      const interesCobrado = round2(cuota.interes);
      const totalCobrado = round2(capitalCobrado + interesCobrado);
      const nuevasCuotasPagas = Number(credito.cuotas_pagas || 0) + 1;
      const saldoCapitalActualizado = round2(
        Number(credito.saldo_capital || 0) - capitalCobrado
      );
      const creditoCancelado = nuevasCuotasPagas >= Number(credito.cuotas_count || 0);

      const cobro: FinCobro = {
        id: cobroRef.id,
        organization_id: orgId,
        sucursal_id: input.sucursal_id,
        caja_id: input.caja_id,
        credito_id: input.credito_id,
        cuota_id: input.cuota_id,
        cliente_id: cuota.cliente_id,
        numero_cuota: cuota.numero_cuota,
        capital_cobrado: capitalCobrado,
        interes_cobrado: interesCobrado,
        total_cobrado: totalCobrado,
        medio_pago: input.medio_pago,
        fecha_cobro: now,
        usuario_id: usuarioId,
        usuario_nombre: usuarioNombre,
        asiento_id: asientoRef.id,
        created_at: now,
      };

      const asientoId = await JournalEntryService.generarAsientoCobro(
        cobro,
        capitalCobrado,
        interesCobrado,
        caja.cuenta_contable_id,
        config,
        usuarioId,
        usuarioNombre,
        {
          transaction,
          asientoId: asientoRef.id,
        }
      );

      transaction.set(cobroRef, cobro);

      transaction.update(cuotaRef, {
        estado: 'pagada',
        cobro_id: cobroRef.id,
        fecha_pago: now,
        updated_at: now,
      });

      transaction.update(creditoRef, {
        cuotas_pagas: nuevasCuotasPagas,
        saldo_capital: Math.max(0, saldoCapitalActualizado),
        estado: creditoCancelado ? 'cancelado' : credito.estado,
        updated_at: now,
      });

      transaction.update(cajaRef, {
        saldo_actual: FieldValue.increment(totalCobrado),
        updated_at: now,
      });

      return {
        cobroId: cobroRef.id,
        asientoId,
      };
    });
  }

  static async getById(orgId: string, cobroId: string): Promise<FinCobro | null> {
    const db = getAdminFirestore();
    const doc = await db.doc(FIN_COLLECTIONS.cobro(orgId, cobroId)).get();
    return mapCobro(doc);
  }

  static async list(
    orgId: string,
    filters: CobroListFilters = {}
  ): Promise<FinCobro[]> {
    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(FIN_COLLECTIONS.cobros(orgId));

    if (filters.credito_id) {
      query = query.where('credito_id', '==', filters.credito_id);
    }

    if (filters.sucursal_id) {
      query = query.where('sucursal_id', '==', filters.sucursal_id);
    }

    if (filters.desde) {
      query = query.where('fecha_cobro', '>=', filters.desde);
    }

    query = query.orderBy('fecha_cobro', 'desc');

    const snapshot = await query.get();
    return snapshot.docs
      .map(doc => mapCobro(doc))
      .filter((cobro): cobro is FinCobro => cobro !== null);
  }
}
