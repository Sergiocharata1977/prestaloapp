import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import { CtaCteJournalService } from '@/services/CtaCteJournalService';
import type {
  FinCtaCteEstado,
  FinCtaCteMovimiento,
  FinCtaCteOperacion,
} from '@/types/fin-ctacte';

type CrearOperacionInput = Omit<
  FinCtaCteOperacion,
  'id' | 'organization_id' | 'saldo_actual' | 'estado' | 'createdAt' | 'createdBy' | 'updatedAt'
>;

function nowIso(): string {
  return new Date().toISOString();
}

export class CtaCteService {
  /**
   * Crea la operacion y el movimiento inicial `venta_inicial`.
   * Devuelve el id de la operacion creada.
   */
  static async crearOperacion(
    orgId: string,
    data: CrearOperacionInput,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<string> {
    const db = getAdminFirestore();
    const now = nowIso();
    const opRef = db.collection(FIN_COLLECTIONS.ctaCteOperaciones(orgId)).doc();
    const movRef = db.collection(FIN_COLLECTIONS.ctaCteMovimientos(orgId)).doc();
    const asientoRef = db.collection(FIN_COLLECTIONS.asientos(orgId)).doc();

    const operacion: FinCtaCteOperacion = {
      ...data,
      id: opRef.id,
      organization_id: orgId,
      saldo_actual: data.monto_original,
      estado: 'activa',
      createdAt: now,
      updatedAt: now,
      createdBy: usuarioId,
    };

    const movInicial: FinCtaCteMovimiento = {
      id: movRef.id,
      organization_id: orgId,
      operacion_id: opRef.id,
      tipo: 'venta_inicial',
      fecha: data.fecha_venta,
      importe: data.monto_original,
      impacto_saldo: data.monto_original,
      saldo_anterior: 0,
      saldo_nuevo: data.monto_original,
      descripcion: `Apertura: ${data.comprobante}`,
      createdAt: now,
      createdBy: usuarioId,
    };

    await db.runTransaction(async transaction => {
      const config = await CtaCteJournalService.getConfigCuentas(orgId, {
        transaction,
      });
      const asientoId = config
        ? await CtaCteJournalService.generarAsiento(
            operacion,
            movInicial,
            config,
            usuarioId,
            usuarioNombre,
            {
              transaction,
              asientoId: asientoRef.id,
            }
          )
        : null;

      transaction.set(opRef, operacion);
      transaction.set(movRef, {
        ...movInicial,
        asiento_id: asientoId ?? undefined,
      });
    });

    return opRef.id;
  }

  /**
   * Registra una entrega de dinero del cliente.
   * Si el saldo resultante es 0, marca la operacion como cancelada.
   */
  static async registrarPago(
    orgId: string,
    operacionId: string,
    importe: number,
    fecha: string,
    descripcion: string,
    cajaId: string | undefined,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<void> {
    if (importe <= 0) {
      throw new Error('El importe del pago debe ser mayor a cero');
    }

    const db = getAdminFirestore();
    const opRef = db.doc(FIN_COLLECTIONS.ctaCteOperacion(orgId, operacionId));

    await db.runTransaction(async transaction => {
      const snap = await transaction.get(opRef);
      if (!snap.exists) {
        throw new Error(`Operacion ${operacionId} no encontrada`);
      }

      const op = snap.data() as FinCtaCteOperacion;
      const config = await CtaCteJournalService.getConfigCuentas(orgId, {
        transaction,
      });
      const saldoAnterior = Number(op.saldo_actual || 0);
      const saldoNuevo = Math.max(0, saldoAnterior - importe);
      const estadoNuevo: FinCtaCteOperacion['estado'] =
        saldoNuevo === 0 ? 'cancelada' : op.estado;
      const movRef = db.collection(FIN_COLLECTIONS.ctaCteMovimientos(orgId)).doc();
      const asientoRef = db.collection(FIN_COLLECTIONS.asientos(orgId)).doc();

      const mov: FinCtaCteMovimiento = {
        id: movRef.id,
        organization_id: orgId,
        operacion_id: operacionId,
        tipo: 'pago_cliente',
        fecha,
        importe,
        impacto_saldo: -importe,
        saldo_anterior: saldoAnterior,
        saldo_nuevo: saldoNuevo,
        descripcion,
        caja_id: cajaId,
        createdAt: nowIso(),
        createdBy: usuarioId,
      };

      const asientoId = config
        ? await CtaCteJournalService.generarAsiento(
            op,
            mov,
            config,
            usuarioId,
            usuarioNombre,
            {
              transaction,
              asientoId: asientoRef.id,
            }
          ).catch(error => {
            if (
              error instanceof Error &&
              error.message.includes('Caja contable no configurada')
            ) {
              return null;
            }

            throw error;
          })
        : null;

      transaction.set(movRef, {
        ...mov,
        asiento_id: asientoId ?? undefined,
      });
      transaction.update(opRef, {
        saldo_actual: saldoNuevo,
        ultimo_pago_fecha: fecha,
        estado: estadoNuevo,
        updatedAt: nowIso(),
      });
    });
  }

  /**
   * Devuelve las operaciones de cuenta corriente para una organización.
   * Acepta filtros opcionales de estado y/o clienteId.
   */
  static async getOperaciones(
    orgId: string,
    filtros?: { estado?: FinCtaCteEstado; clienteId?: string }
  ): Promise<FinCtaCteOperacion[]> {
    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(
      FIN_COLLECTIONS.ctaCteOperaciones(orgId)
    );

    if (filtros?.estado) {
      query = query.where('estado', '==', filtros.estado);
    }

    if (filtros?.clienteId) {
      query = query.where('cliente_id', '==', filtros.clienteId);
    }

    const snap = await query.get();
    return snap.docs.map(doc => doc.data() as FinCtaCteOperacion);
  }

  /**
   * Devuelve una operación de cuenta corriente por id, o null si no existe.
   */
  static async getOperacion(
    orgId: string,
    operacionId: string
  ): Promise<FinCtaCteOperacion | null> {
    const db = getAdminFirestore();
    const snap = await db
      .doc(FIN_COLLECTIONS.ctaCteOperacion(orgId, operacionId))
      .get();

    if (!snap.exists) {
      return null;
    }

    return snap.data() as FinCtaCteOperacion;
  }

  static async getMovimientos(
    orgId: string,
    operacionId: string
  ): Promise<FinCtaCteMovimiento[]> {
    const db = getAdminFirestore();
    const snap = await db
      .collection(FIN_COLLECTIONS.ctaCteMovimientos(orgId))
      .where('operacion_id', '==', operacionId)
      .orderBy('fecha', 'asc')
      .get();

    return snap.docs.map(doc => doc.data() as FinCtaCteMovimiento);
  }
}
