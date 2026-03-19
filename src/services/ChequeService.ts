import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';
import type {
  FinCheque,
  FinChequeCreateInput,
  FinChequeEstado,
  FinChequeEstadoActual,
  FinChequeEvento,
  FinChequeGastoRechazo,
  FinChequeTipo,
  FinOperacionCheque,
  FinOperacionChequeCreateInput,
  FinOperacionChequeEstado,
  FinOperacionChequeGastoFijo,
  FinOperacionChequeGastoVariable,
  FinOperacionChequePreview,
  FinOperacionChequePreviewInput,
} from '@/types/fin-cheque';

type ChequeListFilters = {
  operacion_cheque_id?: string;
  cliente_id?: string;
  sucursal_id?: string;
  estado?: FinChequeEstado;
  tipo?: FinChequeTipo;
};

type OperacionChequeListFilters = {
  cliente_id?: string;
  cheque_id?: string;
  estado?: FinOperacionChequeEstado;
};

function nowIso(): string {
  return new Date().toISOString();
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeMoney(value: number, fieldName: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} invalido`);
  }

  if (value < 0) {
    throw new Error(`${fieldName} no puede ser negativo`);
  }

  return round2(value);
}

function requireText(value: string | undefined, fieldName: string): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    throw new Error(`${fieldName} requerido`);
  }

  return normalized;
}

function normalizeEstado(estado: FinChequeEstado): FinChequeEstadoActual {
  switch (estado) {
    case 'ingresado':
      return 'recibido';
    case 'aplicado':
    case 'pendiente_liquidacion':
      return 'en_cartera';
    case 'liquidado':
      return 'acreditado';
    case 'anulado':
      return 'pre_judicial';
    default:
      return estado;
  }
}

function normalizeGastosRechazo(
  gastos?: FinChequeGastoRechazo[]
): FinChequeGastoRechazo[] | undefined {
  if (!gastos) {
    return undefined;
  }

  return gastos.map((gasto, index) => ({
    concepto: requireText(gasto.concepto, `gastos_rechazo[${index}].concepto`),
    importe: normalizeMoney(gasto.importe, `gastos_rechazo[${index}].importe`),
  }));
}

function buildEventoCheque(input: {
  fecha: string;
  tipo: FinChequeEvento['tipo'];
  estadoAnterior?: FinChequeEstado;
  estadoNuevo: FinChequeEstado;
  observaciones?: string;
  motivo?: string;
  gastosRechazo?: FinChequeGastoRechazo[];
  usuario?: { id: string; nombre: string };
}): FinChequeEvento {
  return {
    id: `${input.fecha}-${Math.random().toString(36).slice(2, 10)}`,
    fecha: input.fecha,
    tipo: input.tipo,
    estado_anterior: input.estadoAnterior
      ? normalizeEstado(input.estadoAnterior)
      : undefined,
    estado_nuevo: normalizeEstado(input.estadoNuevo),
    observaciones: normalizeText(input.observaciones),
    motivo: normalizeText(input.motivo),
    gastos_rechazo: input.gastosRechazo,
    usuario: input.usuario,
  };
}

function validateTransition(
  actual: FinChequeEstadoActual,
  siguiente: FinChequeEstadoActual
) {
  if (actual === siguiente) {
    return;
  }

  const allowed: Record<FinChequeEstadoActual, FinChequeEstadoActual[]> = {
    recibido: ['en_cartera', 'rechazado'],
    en_cartera: ['depositado', 'rechazado'],
    depositado: ['acreditado', 'rechazado'],
    acreditado: [],
    rechazado: ['pre_judicial'],
    pre_judicial: ['judicial'],
    judicial: [],
  };

  if (!allowed[actual].includes(siguiente)) {
    throw new Error(`Transicion invalida de ${actual} a ${siguiente}`);
  }
}

function mapCheque(
  doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot
): FinCheque | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinCheque;
}

function mapOperacion(
  doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot
): FinOperacionCheque | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinOperacionCheque;
}

function startOfDayUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function diferenciaDiasCorridos(desde: string, hasta: string): number {
  const inicio = new Date(desde);
  const fin = new Date(hasta);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    throw new Error('Fecha invalida');
  }

  return Math.floor((startOfDayUtc(fin) - startOfDayUtc(inicio)) / 86400000);
}

function totalGastosFijos(gastos: FinOperacionChequeGastoFijo[]): number {
  return round2(gastos.reduce((acc, item) => acc + item.importe, 0));
}

function totalGastosVariables(
  importeBruto: number,
  gastos: FinOperacionChequeGastoVariable[]
): number {
  return round2(
    gastos.reduce((acc, item) => acc + importeBruto * (item.porcentaje / 100), 0)
  );
}

export class ChequeService {
  static buildPreview(input: FinOperacionChequePreviewInput): FinOperacionChequePreview {
    const diasCorridos = diferenciaDiasCorridos(
      input.fecha_liquidacion,
      input.fecha_pago
    );

    if (diasCorridos < 0) {
      throw new Error('fecha_pago debe ser posterior o igual a fecha_liquidacion');
    }

    const tasaMensualAplicada = round2(input.tasa_mensual ?? 0);
    const descuento = round2(
      input.importe_bruto * (tasaMensualAplicada / 100 / 30) * diasCorridos
    );
    const gastosFijosTotal = totalGastosFijos(input.gastos_fijos ?? []);
    const gastosVariablesTotal = totalGastosVariables(
      input.importe_bruto,
      input.gastos_variables ?? []
    );
    const totalGastos = round2(gastosFijosTotal + gastosVariablesTotal);
    const importeNetoLiquidado = round2(
      input.importe_bruto - descuento - totalGastos
    );

    return {
      dias_corridos: diasCorridos,
      tasa_mensual_aplicada: tasaMensualAplicada,
      descuento,
      gastos_fijos_total: gastosFijosTotal,
      gastos_variables_total: gastosVariablesTotal,
      total_gastos: totalGastos,
      importe_neto_liquidado: importeNetoLiquidado,
      importe_bruto: round2(input.importe_bruto),
    };
  }

  static async preview(
    _orgId: string,
    input: FinOperacionChequePreviewInput
  ): Promise<{ preview: FinOperacionChequePreview }> {
    return { preview: this.buildPreview(input) };
  }

  static async createCheque(orgId: string, input: FinChequeCreateInput): Promise<FinCheque> {
    const db = getAdminFirestore();
    const ref = db.collection(FIN_COLLECTIONS.cheques(orgId)).doc();
    const now = nowIso();

    const cheque: FinCheque = {
      id: ref.id,
      organization_id: orgId,
      cliente_id: input.cliente_id,
      tipo_cliente_id: input.tipo_cliente_id,
      sucursal_id: input.sucursal_id,
      tipo: input.tipo,
      numero: requireText(input.numero, 'numero'),
      banco: requireText(input.banco, 'banco'),
      titular: requireText(input.titular, 'titular'),
      cuit_librador: normalizeText(input.cuit_librador),
      fecha_emision: normalizeText(input.fecha_emision),
      fecha_pago: input.fecha_pago.trim(),
      importe: round2(input.importe),
      moneda: normalizeText(input.moneda) ?? 'ARS',
      estado: 'recibido',
      observaciones: normalizeText(input.observaciones),
      eventos: [
        buildEventoCheque({
          fecha: now,
          tipo: 'alta',
          estadoNuevo: 'recibido',
          observaciones: input.observaciones,
        }),
      ],
      created_at: now,
      updated_at: now,
    };

    await ref.set(cheque);
    return cheque;
  }

  static async getById(orgId: string, chequeId: string): Promise<FinCheque | null> {
    const db = getAdminFirestore();
    const doc = await db.doc(FIN_COLLECTIONS.cheque(orgId, chequeId)).get();
    return mapCheque(doc);
  }

  static async getChequeById(orgId: string, chequeId: string): Promise<FinCheque | null> {
    return this.getById(orgId, chequeId);
  }

  static async list(
    orgId: string,
    filters: ChequeListFilters = {}
  ): Promise<FinCheque[]> {
    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(FIN_COLLECTIONS.cheques(orgId));

    if (filters.operacion_cheque_id) {
      query = query.where('operacion_cheque_id', '==', filters.operacion_cheque_id);
    }

    if (filters.cliente_id) {
      query = query.where('cliente_id', '==', filters.cliente_id);
    }

    if (filters.sucursal_id) {
      query = query.where('sucursal_id', '==', filters.sucursal_id);
    }

    if (filters.estado) {
      query = query.where('estado', '==', filters.estado);
    }

    if (filters.tipo) {
      query = query.where('tipo', '==', filters.tipo);
    }

    query = query.orderBy('fecha_pago', 'asc').orderBy('created_at', 'asc');

    const snapshot = await query.get();
    return snapshot.docs
      .map(doc => mapCheque(doc))
      .filter((cheque): cheque is FinCheque => cheque !== null);
  }

  static async listCheques(
    orgId: string,
    filters: ChequeListFilters = {}
  ): Promise<FinCheque[]> {
    return this.list(orgId, filters);
  }

  static async listByOperacion(
    orgId: string,
    operacionChequeId: string
  ): Promise<FinCheque[]> {
    return this.list(orgId, { operacion_cheque_id: operacionChequeId });
  }

  static async createOperacion(
    orgId: string,
    input: FinOperacionChequeCreateInput,
    user: { uid: string; name: string }
  ): Promise<{ operacion: FinOperacionCheque; cheque: FinCheque }> {
    const db = getAdminFirestore();
    const preview = this.buildPreview(input);
    const now = nowIso();

    return db.runTransaction(async transaction => {
      let cheque: FinCheque | null = null;
      let chequeRef: FirebaseFirestore.DocumentReference;

      if (input.cheque_id) {
        chequeRef = db.doc(FIN_COLLECTIONS.cheque(orgId, input.cheque_id));
        const chequeSnap = await transaction.get(chequeRef);
        cheque = mapCheque(chequeSnap);

        if (!cheque) {
          throw new Error('Cheque no encontrado');
        }
      } else if (input.cheque) {
        chequeRef = db.collection(FIN_COLLECTIONS.cheques(orgId)).doc();
        cheque = {
          id: chequeRef.id,
          organization_id: orgId,
          operacion_cheque_id: undefined,
          cliente_id: input.cheque.cliente_id,
          tipo_cliente_id: input.cheque.tipo_cliente_id,
          sucursal_id: input.cheque.sucursal_id,
          tipo: input.cheque.tipo,
          numero: requireText(input.cheque.numero, 'numero'),
          banco: requireText(input.cheque.banco, 'banco'),
          titular: requireText(input.cheque.titular, 'titular'),
          cuit_librador: normalizeText(input.cheque.cuit_librador),
          fecha_emision: normalizeText(input.cheque.fecha_emision),
          fecha_pago: input.cheque.fecha_pago.trim(),
          importe: round2(input.cheque.importe),
          moneda: normalizeText(input.cheque.moneda) ?? 'ARS',
          estado: input.caja_id ? 'acreditado' : 'en_cartera',
          observaciones: normalizeText(input.cheque.observaciones),
          eventos: [
            buildEventoCheque({
              fecha: now,
              tipo: 'alta',
              estadoNuevo: input.caja_id ? 'acreditado' : 'en_cartera',
              observaciones: input.cheque.observaciones,
              usuario: { id: user.uid, nombre: user.name },
            }),
          ],
          created_at: now,
          created_by: user.uid,
          updated_at: now,
        };
        transaction.set(chequeRef, cheque);
      } else {
        throw new Error('cheque_id o cheque requerido');
      }

      const operacionRef = db.collection(FIN_COLLECTIONS.operacionesCheques(orgId)).doc();
      const operacion: FinOperacionCheque = {
        id: operacionRef.id,
        organization_id: orgId,
        cheque_id: cheque.id,
        cliente_id: input.cliente_id,
        tipo_cliente_id: input.tipo_cliente_id,
        politica_crediticia_id: input.politica_crediticia_id,
        sucursal_id: input.sucursal_id,
        caja_id: input.caja_id,
        tipo: input.tipo,
        fecha_operacion: now.slice(0, 10),
        fecha_liquidacion: input.fecha_liquidacion,
        fecha_pago: input.fecha_pago,
        dias_corridos: preview.dias_corridos,
        importe_bruto: preview.importe_bruto,
        tasa_mensual_aplicada: preview.tasa_mensual_aplicada,
        descuento: preview.descuento,
        gastos_fijos: input.gastos_fijos ?? [],
        gastos_variables: input.gastos_variables ?? [],
        gastos_fijos_total: preview.gastos_fijos_total,
        gastos_variables_total: preview.gastos_variables_total,
        total_gastos: preview.total_gastos,
        importe_neto_liquidado: preview.importe_neto_liquidado,
        estado: input.caja_id ? 'confirmada' : 'pendiente',
        liquidacion_confirmada_at: input.caja_id ? now : undefined,
        liquidacion_confirmada_por: input.caja_id
          ? { user_id: user.uid, nombre: user.name }
          : undefined,
        observaciones: normalizeText(input.observaciones),
        created_at: now,
        updated_at: now,
      };

      transaction.set(operacionRef, operacion);
      transaction.set(
        chequeRef,
        {
          operacion_cheque_id: operacion.id,
          estado: input.caja_id ? 'acreditado' : 'en_cartera',
          eventos: FieldValue.arrayUnion(
            buildEventoCheque({
              fecha: now,
              tipo: 'cambio_estado',
              estadoAnterior: cheque.estado,
              estadoNuevo: input.caja_id ? 'acreditado' : 'en_cartera',
              observaciones: 'Cheque asociado a operacion de descuento',
              usuario: { id: user.uid, nombre: user.name },
            })
          ),
          updated_at: now,
        },
        { merge: true }
      );

      return {
        operacion,
        cheque: {
          ...cheque,
          operacion_cheque_id: operacion.id,
          estado: input.caja_id ? 'acreditado' : 'en_cartera',
          eventos: [
            ...(cheque.eventos ?? []),
            buildEventoCheque({
              fecha: now,
              tipo: 'cambio_estado',
              estadoAnterior: cheque.estado,
              estadoNuevo: input.caja_id ? 'acreditado' : 'en_cartera',
              observaciones: 'Cheque asociado a operacion de descuento',
              usuario: { id: user.uid, nombre: user.name },
            }),
          ],
          updated_at: now,
        },
      };
    });
  }

  static async getOperacionById(
    orgId: string,
    operacionId: string
  ): Promise<FinOperacionCheque | null> {
    const db = getAdminFirestore();
    const doc = await db.doc(FIN_COLLECTIONS.operacionCheque(orgId, operacionId)).get();
    return mapOperacion(doc);
  }

  static async listOperaciones(
    orgId: string,
    filters: OperacionChequeListFilters = {}
  ): Promise<FinOperacionCheque[]> {
    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(
      FIN_COLLECTIONS.operacionesCheques(orgId)
    );

    if (filters.cliente_id) {
      query = query.where('cliente_id', '==', filters.cliente_id);
    }

    if (filters.cheque_id) {
      query = query.where('cheque_id', '==', filters.cheque_id);
    }

    if (filters.estado) {
      query = query.where('estado', '==', filters.estado);
    }

    const snapshot = await query.get();
    return snapshot.docs
      .map(doc => mapOperacion(doc))
      .filter((operacion): operacion is FinOperacionCheque => operacion !== null);
  }

  static async confirmarLiquidacion(
    orgId: string,
    operacionId: string,
    input: { sucursal_id: string; caja_id: string },
    user: { uid: string; name: string }
  ): Promise<FinOperacionCheque | null> {
    const db = getAdminFirestore();
    const now = nowIso();

    return db.runTransaction(async transaction => {
      const operacionRef = db.doc(FIN_COLLECTIONS.operacionCheque(orgId, operacionId));
      const operacionSnap = await transaction.get(operacionRef);
      const operacion = mapOperacion(operacionSnap);

      if (!operacion) {
        return null;
      }

      const chequeRef = db.doc(FIN_COLLECTIONS.cheque(orgId, operacion.cheque_id));
      const chequeSnap = await transaction.get(chequeRef);
      const cheque = mapCheque(chequeSnap);
      transaction.update(operacionRef, {
        estado: 'confirmada',
        sucursal_id: input.sucursal_id,
        caja_id: input.caja_id,
        liquidacion_confirmada_at: now,
        liquidacion_confirmada_por: {
          user_id: user.uid,
          nombre: user.name,
        },
        updated_at: now,
      });
      transaction.update(chequeRef, {
        estado: 'acreditado',
        eventos: FieldValue.arrayUnion(
          buildEventoCheque({
            fecha: now,
            tipo: 'cambio_estado',
            estadoAnterior: cheque?.estado ?? 'depositado',
            estadoNuevo: 'acreditado',
            observaciones: 'Liquidacion confirmada',
            usuario: { id: user.uid, nombre: user.name },
          })
        ),
        updated_at: now,
      });

      return {
        ...operacion,
        estado: 'confirmada',
        sucursal_id: input.sucursal_id,
        caja_id: input.caja_id,
        liquidacion_confirmada_at: now,
        liquidacion_confirmada_por: {
          user_id: user.uid,
          nombre: user.name,
        },
        updated_at: now,
      };
    });
  }

  static async anularOperacion(
    orgId: string,
    operacionId: string
  ): Promise<FinOperacionCheque | null> {
    const db = getAdminFirestore();
    const now = nowIso();

    return db.runTransaction(async transaction => {
      const operacionRef = db.doc(FIN_COLLECTIONS.operacionCheque(orgId, operacionId));
      const operacionSnap = await transaction.get(operacionRef);
      const operacion = mapOperacion(operacionSnap);

      if (!operacion) {
        return null;
      }

      const chequeRef = db.doc(FIN_COLLECTIONS.cheque(orgId, operacion.cheque_id));
      const chequeSnap = await transaction.get(chequeRef);
      const cheque = mapCheque(chequeSnap);
      transaction.update(operacionRef, {
        estado: 'anulada',
        updated_at: now,
      });
      transaction.update(chequeRef, {
        estado: 'recibido',
        operacion_cheque_id: null,
        eventos: FieldValue.arrayUnion(
          buildEventoCheque({
            fecha: now,
            tipo: 'cambio_estado',
            estadoAnterior: cheque?.estado ?? 'en_cartera',
            estadoNuevo: 'recibido',
            observaciones: 'Operacion anulada',
          })
        ),
        updated_at: now,
      });

      return {
        ...operacion,
        estado: 'anulada',
        updated_at: now,
      };
    });
  }

  static async actualizarEstado(
    orgId: string,
    chequeId: string,
    estado: FinChequeEstado,
    options: {
      transaction?: FirebaseFirestore.Transaction;
      asiento_liquidacion_id?: string;
      liquidado_at?: string;
      motivo?: string;
      observaciones?: string;
      gastos_rechazo?: FinChequeGastoRechazo[];
      usuario?: { id: string; nombre: string };
    } = {}
  ): Promise<void> {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.cheque(orgId, chequeId));
    const now = nowIso();
    const snap = options.transaction ? await options.transaction.get(ref) : await ref.get();
    const cheque = mapCheque(snap);

    if (!cheque) {
      throw new Error('Cheque no encontrado');
    }

    const estadoActual = normalizeEstado(cheque.estado);
    const nuevoEstado = normalizeEstado(estado);
    validateTransition(estadoActual, nuevoEstado);

    const gastosRechazo = normalizeGastosRechazo(options.gastos_rechazo);
    const updates: Record<string, unknown> = {
      estado: nuevoEstado,
      updated_at: now,
      eventos: FieldValue.arrayUnion(
        buildEventoCheque({
          fecha: now,
          tipo:
            nuevoEstado === 'rechazado' && estadoActual === 'rechazado'
              ? 'actualizacion_rechazo'
              : 'cambio_estado',
          estadoAnterior: estadoActual,
          estadoNuevo: nuevoEstado,
          observaciones: options.observaciones,
          motivo: options.motivo,
          gastosRechazo,
          usuario: options.usuario,
        })
      ),
    };

    if (nuevoEstado === 'rechazado') {
      updates.motivo_rechazo = normalizeText(options.motivo);
      if (gastosRechazo) {
        updates.gastos_rechazo = gastosRechazo;
      }
    } else {
      updates.motivo_rechazo = FieldValue.delete();
      updates.gastos_rechazo = FieldValue.delete();
    }

    if ('asiento_liquidacion_id' in options) {
      updates.asiento_liquidacion_id = options.asiento_liquidacion_id;
    }

    if ('liquidado_at' in options) {
      updates.liquidado_at = options.liquidado_at;
    }

    if (options.transaction) {
      options.transaction.update(ref, updates);
      return;
    }

    await ref.update(updates);
  }

  static async cambiarEstadoCheque(
    orgId: string,
    chequeId: string,
    input: {
      estado: FinChequeEstado;
      motivo?: string;
      observaciones?: string;
      gastos_rechazo?: FinChequeGastoRechazo[];
      usuario?: { id: string; nombre: string };
    }
  ): Promise<FinCheque | null> {
    const cheque = await this.getById(orgId, chequeId);
    if (!cheque) {
      return null;
    }

    const estadoActual = normalizeEstado(cheque.estado);
    const nuevoEstado = normalizeEstado(input.estado);

    if (nuevoEstado === 'rechazado' && !input.motivo?.trim()) {
      throw new Error('motivo requerido para rechazar el cheque');
    }

    if (estadoActual === 'rechazado' && nuevoEstado === 'rechazado') {
      const db = getAdminFirestore();
      const ref = db.doc(FIN_COLLECTIONS.cheque(orgId, chequeId));
      const now = nowIso();
      const gastosRechazo = normalizeGastosRechazo(input.gastos_rechazo);

      await ref.update({
        estado: 'rechazado',
        motivo_rechazo: normalizeText(input.motivo),
        gastos_rechazo: gastosRechazo ?? [],
        updated_at: now,
        eventos: FieldValue.arrayUnion(
          buildEventoCheque({
            fecha: now,
            tipo: 'actualizacion_rechazo',
            estadoAnterior: 'rechazado',
            estadoNuevo: 'rechazado',
            observaciones: input.observaciones,
            motivo: input.motivo,
            gastosRechazo: gastosRechazo ?? [],
            usuario: input.usuario,
          })
        ),
      });

      return this.getById(orgId, chequeId);
    }

    await this.actualizarEstado(orgId, chequeId, nuevoEstado, {
      motivo: input.motivo,
      observaciones: input.observaciones,
      gastos_rechazo: input.gastos_rechazo,
      usuario: input.usuario,
      liquidado_at: nuevoEstado === 'acreditado' ? nowIso() : undefined,
    });

    return this.getById(orgId, chequeId);
  }

  static async updateCheque(
    orgId: string,
    chequeId: string,
    input: Partial<FinChequeCreateInput> & { estado?: FinChequeEstado }
  ): Promise<FinCheque | null> {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.cheque(orgId, chequeId));
    const snap = await ref.get();

    if (!snap.exists) {
      return null;
    }

    const updates: Record<string, unknown> = {
      updated_at: nowIso(),
    };

    if (typeof input.numero === 'string') {
      updates.numero = input.numero.trim();
    }

    if (typeof input.banco === 'string') {
      updates.banco = input.banco.trim();
    }

    if (typeof input.titular === 'string') {
      updates.titular = input.titular.trim();
    }

    if (typeof input.fecha_emision === 'string') {
      updates.fecha_emision = input.fecha_emision.trim();
    }

    if (typeof input.fecha_pago === 'string') {
      updates.fecha_pago = input.fecha_pago.trim();
    }

    if (typeof input.importe === 'number') {
      updates.importe = round2(input.importe);
    }

    if (typeof input.moneda === 'string') {
      updates.moneda = input.moneda.trim();
    }

    if (typeof input.observaciones === 'string') {
      updates.observaciones = input.observaciones.trim();
    }

    if (typeof input.estado === 'string') {
      updates.estado = normalizeEstado(input.estado);
    }

    await ref.update(updates);
    return this.getById(orgId, chequeId);
  }
}
