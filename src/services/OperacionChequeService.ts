import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import { ChequeService } from '@/services/ChequeService';
import { JournalEntryService } from '@/services/JournalEntryService';
import type { FinCheque, FinChequeCreateInput, FinChequeTipo } from '@/types/fin-cheque';
import type {
  FinOperacionCheque,
  FinOperacionChequeCreateInput,
  FinOperacionChequeDetalle,
  FinOperacionChequeEstado,
  FinOperacionChequePreview,
  FinOperacionChequePreviewInput,
  FinOperacionChequeResumen,
} from '@/types/fin-operacion-cheque';
import type { FinCaja } from '@/types/fin-sucursal';

type OperacionChequeListFilters = {
  cliente_id?: string;
  sucursal_id?: string;
  estado?: FinOperacionChequeEstado;
  tipo_operacion?: FinOperacionCheque['tipo_operacion'];
};

function nowIso(): string {
  return new Date().toISOString();
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeText(value: string | undefined, fieldName: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${fieldName} requerido`);
  }

  return normalized;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeMoney(value: number, fieldName: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} invalido`);
  }

  if (value <= 0) {
    throw new Error(`${fieldName} debe ser mayor a cero`);
  }

  return round2(value);
}

function normalizeDate(value: string | undefined, fieldName: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${fieldName} requerida`);
  }

  if (Number.isNaN(new Date(normalized).getTime())) {
    throw new Error(`${fieldName} invalida`);
  }

  return normalized;
}

function startOfDayUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function diferenciaDiasCorridos(desde: string, hasta: string): number {
  const from = new Date(desde);
  const to = new Date(hasta);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('Fecha invalida');
  }

  return Math.floor((startOfDayUtc(to) - startOfDayUtc(from)) / 86400000);
}

function resolveChequeTipo(tipoOperacion: FinOperacionCheque['tipo_operacion']): FinChequeTipo {
  return tipoOperacion === 'cheque_propio' ? 'cheque_propio' : 'cheque_terceros';
}

function buildNumeroOperacion(fechaIso: string, sequence: string): string {
  const fecha = fechaIso.slice(0, 10).replace(/-/g, '');
  return `CH-${fecha}-${sequence.padStart(4, '0')}`;
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

function mapCaja(doc: FirebaseFirestore.DocumentSnapshot): FinCaja | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinCaja;
}

function buildPreviewMetrics(input: FinOperacionChequePreviewInput): {
  fechaLiquidacion: string;
  resumen: FinOperacionChequeResumen;
} {
  const cheques = input.cheques ?? [];
  if (cheques.length === 0) {
    throw new Error('Debe informar al menos un cheque');
  }

  const fechaLiquidacion = normalizeDate(
    input.fecha_liquidacion ?? input.fecha_operacion,
    'fecha_liquidacion'
  );
  const tasaMensual = round2(input.tasa_mensual ?? 0);
  const importeBruto = round2(
    cheques.reduce((acc, cheque) => acc + normalizeMoney(cheque.importe, 'importe'), 0)
  );

  const calculos = cheques.map(cheque => {
    const fechaPago = normalizeDate(cheque.fecha_pago, 'fecha_pago');
    const diasCorridos = diferenciaDiasCorridos(fechaLiquidacion, fechaPago);

    if (diasCorridos < 0) {
      throw new Error('fecha_pago debe ser posterior o igual a fecha_liquidacion');
    }

    return {
      fechaPago,
      diasCorridos,
      descuento: round2(cheque.importe * (tasaMensual / 100 / 30) * diasCorridos),
    };
  });

  const descuentoTotal = round2(
    calculos.reduce((acc, item) => acc + item.descuento, 0)
  );
  const gastosFijosTotal = round2(
    (input.gastos ?? 0) +
      (input.gastos_fijos ?? []).reduce(
        (acc, item) => acc + normalizeMoney(item.importe, 'importe'),
        0
      )
  );
  const gastosVariablesTotal = round2(
    (input.gastos_variables ?? []).reduce(
      (acc, item) => acc + importeBruto * ((item.porcentaje || 0) / 100),
      0
    )
  );
  const gastosTotal = round2(gastosFijosTotal + gastosVariablesTotal);
  const importeNeto = round2(importeBruto - descuentoTotal - gastosTotal);

  if (importeNeto <= 0) {
    throw new Error('El importe neto debe ser mayor a cero');
  }

  const fechas = calculos.map(item => item.fechaPago).sort((a, b) => a.localeCompare(b));
  const diasPromedio = round2(
    calculos.reduce((acc, item) => acc + item.diasCorridos, 0) / calculos.length
  );

  return {
    fechaLiquidacion,
    resumen: {
      cantidad_cheques: cheques.length,
      importe_bruto: importeBruto,
      descuento: descuentoTotal,
      gastos: gastosTotal,
      gastos_fijos_total: gastosFijosTotal,
      gastos_variables_total: gastosVariablesTotal,
      importe_neto: importeNeto,
      fecha_pago_min: fechas[0],
      fecha_pago_max: fechas[fechas.length - 1],
      dias_corridos_promedio: diasPromedio,
    },
  };
}

async function validarPoliticaYTipoCliente(
  orgId: string,
  input: FinOperacionChequePreviewInput,
  importeBruto: number
) {
  if (!input.politica_crediticia_id) {
    return;
  }

  const db = getAdminFirestore();
  const [clienteSnap, politicaSnap] = await Promise.all([
    db.doc(FIN_COLLECTIONS.cliente(orgId, input.cliente_id)).get(),
    db.doc(FIN_COLLECTIONS.politicaCrediticia(orgId, input.politica_crediticia_id)).get(),
  ]);

  if (!clienteSnap.exists) {
    throw new Error('Cliente no encontrado');
  }

  if (!politicaSnap.exists) {
    throw new Error('Politica crediticia no encontrada');
  }

  const cliente = clienteSnap.data() as { tipo_cliente_id?: string } | undefined;
  const politica = politicaSnap.data() as {
    activo?: boolean;
    tipo_cliente_id?: string;
    tipo_operacion?: string;
    permite_cheques_propios?: boolean;
    permite_cheques_terceros?: boolean;
    monto_minimo?: number;
    monto_maximo?: number;
  };

  if (!politica.activo) {
    throw new Error('La politica crediticia no esta activa');
  }

  if (!input.tipo_operacion) {
    throw new Error('tipo_operacion requerido');
  }

  if (politica.tipo_operacion !== input.tipo_operacion) {
    throw new Error('La politica no corresponde al tipo de operacion indicado');
  }

  const tipoClienteId = input.tipo_cliente_id ?? cliente?.tipo_cliente_id;
  if (tipoClienteId && politica.tipo_cliente_id !== tipoClienteId) {
    throw new Error('La politica no corresponde al tipo de cliente indicado');
  }

  if (input.tipo_operacion === 'cheque_propio' && !politica.permite_cheques_propios) {
    throw new Error('La politica no permite cheques propios');
  }

  if (
    input.tipo_operacion === 'cheque_terceros' &&
    !politica.permite_cheques_terceros
  ) {
    throw new Error('La politica no permite cheques de terceros');
  }

  if (typeof politica.monto_minimo === 'number' && importeBruto < politica.monto_minimo) {
    throw new Error('El importe es menor al minimo permitido por la politica');
  }

  if (typeof politica.monto_maximo === 'number' && importeBruto > politica.monto_maximo) {
    throw new Error('El importe supera el maximo permitido por la politica');
  }
}

export class OperacionChequeService {
  static async preview(
    orgId: string,
    input: FinOperacionChequePreviewInput
  ): Promise<FinOperacionChequePreview> {
    const metrics = buildPreviewMetrics(input);
    await validarPoliticaYTipoCliente(orgId, input, metrics.resumen.importe_bruto);

    return {
      resumen: metrics.resumen,
      dias_corridos: metrics.resumen.dias_corridos_promedio,
      tasa_mensual_aplicada: round2(input.tasa_mensual ?? 0),
      descuento: metrics.resumen.descuento,
      gastos_fijos_total: metrics.resumen.gastos_fijos_total,
      gastos_variables_total: metrics.resumen.gastos_variables_total,
      total_gastos: metrics.resumen.gastos,
      importe_neto_liquidado: metrics.resumen.importe_neto,
      importe_bruto: metrics.resumen.importe_bruto,
    };
  }

  static calcularResumen(input: Pick<FinOperacionChequeCreateInput, 'cheques' | 'gastos'>) {
    const metrics = buildPreviewMetrics({
      cliente_id: 'preview',
      sucursal_id: 'preview',
      tipo_operacion: 'cheque_terceros',
      fecha_operacion: new Date().toISOString().slice(0, 10),
      cheques: input.cheques,
      gastos: input.gastos,
    });

    return metrics.resumen;
  }

  static async registrar(
    orgId: string,
    input: FinOperacionChequeCreateInput,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<{ operacionId: string; asientoId: string; chequeIds: string[] }> {
    const db = getAdminFirestore();
    const now = nowIso();

    if (!input.cheques?.length) {
      throw new Error('Debe informar al menos un cheque');
    }

    if (!input.base_contable) {
      throw new Error('base_contable requerida');
    }

    if (!input.tipo_operacion) {
      throw new Error('tipo_operacion requerido');
    }

    const tipoOperacion = input.tipo_operacion;
    const chequesInput = input.cheques;
    const baseContable = input.base_contable;

    const fechaOperacion = normalizeDate(
      input.fecha_operacion ?? input.fecha_liquidacion,
      'fecha_operacion'
    );
    const preview = await this.preview(orgId, {
      cliente_id: input.cliente_id,
      tipo_cliente_id: input.tipo_cliente_id,
      sucursal_id: input.sucursal_id,
      politica_crediticia_id: input.politica_crediticia_id,
      tipo_operacion: tipoOperacion,
      fecha_operacion: fechaOperacion,
      fecha_liquidacion: input.fecha_liquidacion,
      tasa_mensual: input.tasa_mensual,
      gastos: input.gastos,
      gastos_fijos: input.gastos_fijos,
      gastos_variables: input.gastos_variables,
      cheques: chequesInput,
    });

    const fechaLiquidacion = normalizeDate(
      input.fecha_liquidacion ?? fechaOperacion,
      'fecha_liquidacion'
    );
    const operacionRef = db.collection(FIN_COLLECTIONS.operacionesCheque(orgId)).doc();
    const asientoRef = db.collection(FIN_COLLECTIONS.asientos(orgId)).doc();
    const chequeIds = chequesInput.map(() => db.collection(FIN_COLLECTIONS.cheques(orgId)).doc().id);
    const tipoCheque = resolveChequeTipo(tipoOperacion);

    const operacion: FinOperacionCheque = {
      id: operacionRef.id,
      organization_id: orgId,
      sucursal_id: normalizeText(input.sucursal_id, 'sucursal_id'),
      cliente_id: normalizeText(input.cliente_id, 'cliente_id'),
      tipo_cliente_id: input.tipo_cliente_id,
      politica_crediticia_id: input.politica_crediticia_id,
      numero_operacion: buildNumeroOperacion(fechaOperacion, operacionRef.id.slice(-4)),
      tipo_operacion: tipoOperacion,
      estado: input.caja_id ? 'liquidada' : 'pendiente',
      moneda: normalizeOptionalText(input.moneda) ?? 'ARS',
      fecha_operacion: fechaOperacion,
      fecha_liquidacion: fechaLiquidacion,
      resumen: preview.resumen,
      base_contable: {
        cuenta_cheques_id: normalizeText(
          baseContable.cuenta_cheques_id,
          'cuenta_cheques_id'
        ),
        cuenta_liquidadora_id: normalizeText(
          baseContable.cuenta_liquidadora_id,
          'cuenta_liquidadora_id'
        ),
        cuenta_ingresos_id: normalizeText(
          baseContable.cuenta_ingresos_id,
          'cuenta_ingresos_id'
        ),
      },
      cheque_ids: chequeIds,
      caja_id: input.caja_id,
      observaciones: normalizeOptionalText(input.observaciones),
      asiento_liquidacion_id: input.caja_id ? asientoRef.id : undefined,
      liquidacion_confirmada_at: input.caja_id ? now : undefined,
      liquidacion_confirmada_por: input.caja_id
        ? {
            user_id: usuarioId,
            nombre: usuarioNombre,
          }
        : undefined,
      created_at: now,
      created_by: usuarioId,
      updated_at: now,
    };

    const cheques: FinCheque[] = chequesInput.map((chequeInput, index) => ({
      id: chequeIds[index],
      organization_id: orgId,
      operacion_cheque_id: operacion.id,
      cliente_id: operacion.cliente_id,
      tipo_cliente_id: input.tipo_cliente_id,
      sucursal_id: operacion.sucursal_id,
      tipo: tipoCheque,
      numero: normalizeText(chequeInput.numero, 'numero'),
      banco: normalizeText(chequeInput.banco, 'banco'),
      titular: normalizeText(chequeInput.titular, 'titular'),
      fecha_pago: normalizeDate(chequeInput.fecha_pago, 'fecha_pago'),
      importe: normalizeMoney(chequeInput.importe, 'importe'),
      moneda: normalizeOptionalText(chequeInput.moneda) ?? operacion.moneda ?? 'ARS',
      estado: input.caja_id ? 'liquidado' : 'pendiente_liquidacion',
      cuit_librador: normalizeOptionalText(chequeInput.cuit_librador),
      fecha_emision: normalizeOptionalText(chequeInput.fecha_emision),
      observaciones: normalizeOptionalText(chequeInput.observaciones),
      asiento_liquidacion_id: input.caja_id ? asientoRef.id : undefined,
      liquidado_at: input.caja_id ? now : undefined,
      created_at: now,
      created_by: usuarioId,
      updated_at: now,
    }));

    return db.runTransaction(async transaction => {
      let asientoId = '';

      if (input.caja_id) {
        const cajaRef = db.doc(FIN_COLLECTIONS.caja(orgId, operacion.sucursal_id, input.caja_id));
        const cajaSnap = await transaction.get(cajaRef);
        const caja = mapCaja(cajaSnap);

        if (!caja) {
          throw new Error('Caja no encontrada');
        }

        if (caja.estado !== 'abierta') {
          throw new Error('La caja debe estar abierta para confirmar la liquidacion');
        }

        asientoId = await JournalEntryService.generarAsientoLiquidacionOperacionCheque(
          operacion,
          usuarioId,
          usuarioNombre,
          {
            transaction,
            asientoId: asientoRef.id,
          }
        );

        transaction.update(cajaRef, {
          saldo_actual: round2(caja.saldo_actual + (preview.resumen?.importe_neto ?? 0)),
          updated_at: now,
        });
      }

      transaction.set(operacionRef, {
        ...operacion,
        asiento_liquidacion_id: asientoId || operacion.asiento_liquidacion_id,
      });

      cheques.forEach(cheque => {
        const chequeRef = db.doc(FIN_COLLECTIONS.cheque(orgId, cheque.id));
        transaction.set(chequeRef, cheque);
      });

      return {
        operacionId: operacion.id,
        asientoId,
        chequeIds,
      };
    });
  }

  static async confirmarLiquidacion(
    orgId: string,
    operacionId: string,
    sucursalId: string,
    cajaId: string,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<FinOperacionCheque | null> {
    const db = getAdminFirestore();

    return db.runTransaction(async transaction => {
      const operacionRef = db.doc(FIN_COLLECTIONS.operacionCheque(orgId, operacionId));
      const cajaRef = db.doc(FIN_COLLECTIONS.caja(orgId, sucursalId, cajaId));
      const [operacionSnap, cajaSnap] = await Promise.all([
        transaction.get(operacionRef),
        transaction.get(cajaRef),
      ]);

      const operacion = mapOperacion(operacionSnap);
      const caja = mapCaja(cajaSnap);

      if (!operacion) {
        return null;
      }

      if (!caja) {
        throw new Error('Caja no encontrada');
      }

      if (caja.estado !== 'abierta') {
        throw new Error('La caja debe estar abierta para confirmar la liquidacion');
      }

      if (operacion.estado === 'liquidada') {
        throw new Error('La operacion ya fue liquidada');
      }

      const now = nowIso();
      const asientoId = await JournalEntryService.generarAsientoLiquidacionOperacionCheque(
        operacion,
        usuarioId,
        usuarioNombre,
        {
          transaction,
        }
      );

      transaction.update(cajaRef, {
        saldo_actual: round2(caja.saldo_actual + (operacion.resumen?.importe_neto ?? 0)),
        updated_at: now,
      });

      transaction.update(operacionRef, {
        sucursal_id: sucursalId,
        caja_id: cajaId,
        estado: 'liquidada',
        asiento_liquidacion_id: asientoId,
        liquidacion_confirmada_at: now,
        liquidacion_confirmada_por: {
          user_id: usuarioId,
          nombre: usuarioNombre,
        },
        updated_at: now,
      });

      for (const chequeId of operacion.cheque_ids ?? []) {
        await ChequeService.actualizarEstado(orgId, chequeId, 'liquidado', {
          transaction,
          asiento_liquidacion_id: asientoId,
          liquidado_at: now,
        });
      }

      return {
        ...operacion,
        sucursal_id: sucursalId,
        caja_id: cajaId,
        estado: 'liquidada',
        asiento_liquidacion_id: asientoId,
        liquidacion_confirmada_at: now,
        liquidacion_confirmada_por: {
          user_id: usuarioId,
          nombre: usuarioNombre,
        },
        updated_at: now,
      };
    });
  }

  static async getById(
    orgId: string,
    operacionId: string
  ): Promise<FinOperacionCheque | null> {
    const db = getAdminFirestore();
    const doc = await db.doc(FIN_COLLECTIONS.operacionCheque(orgId, operacionId)).get();
    return mapOperacion(doc);
  }

  static async getDetalle(
    orgId: string,
    operacionId: string
  ): Promise<FinOperacionChequeDetalle | null> {
    const operacion = await this.getById(orgId, operacionId);
    if (!operacion) {
      return null;
    }

    const cheques = (
      await Promise.all(
        (operacion.cheque_ids ?? []).map(chequeId =>
          ChequeService.getChequeById(orgId, chequeId)
        )
      )
    ).filter((cheque): cheque is FinCheque => cheque !== null);

    return {
      ...operacion,
      cheques,
    };
  }

  static async list(
    orgId: string,
    filters: OperacionChequeListFilters = {}
  ): Promise<FinOperacionCheque[]> {
    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(
      FIN_COLLECTIONS.operacionesCheque(orgId)
    );

    if (filters.cliente_id) {
      query = query.where('cliente_id', '==', filters.cliente_id);
    }

    if (filters.sucursal_id) {
      query = query.where('sucursal_id', '==', filters.sucursal_id);
    }

    if (filters.estado) {
      query = query.where('estado', '==', filters.estado);
    }

    if (filters.tipo_operacion) {
      query = query.where('tipo_operacion', '==', filters.tipo_operacion);
    }

    query = query.orderBy('fecha_operacion', 'desc').orderBy('created_at', 'desc');

    const snapshot = await query.get();
    return snapshot.docs
      .map(doc => mapOperacion(doc))
      .filter((operacion): operacion is FinOperacionCheque => operacion !== null);
  }
}
