import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import { CtaCteJournalService } from '@/services/CtaCteJournalService';
import type {
  FinCtaCteControlMensual,
  FinCtaCteEstado,
  FinCtaCteMovimiento,
  FinCtaCteOperacion,
  FinCtaCteReglas,
} from '@/types/fin-ctacte';

function nowIso(): string {
  return new Date().toISOString();
}

function isPeriodo(periodo: string): boolean {
  return /^\d{4}-\d{2}$/.test(periodo);
}

function getPeriodoBounds(periodo: string): { desde: string; hasta: string } {
  const [year, month] = periodo.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    desde: `${periodo}-01`,
    hasta: `${periodo}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

function calcularEntregaMinima(
  reglas: FinCtaCteReglas,
  montoOriginal: number,
  saldoActual: number
): number {
  switch (reglas.entrega_minima_tipo) {
    case 'monto_fijo':
      return reglas.entrega_minima_valor;
    case 'pct_compra':
      return montoOriginal * (reglas.entrega_minima_valor / 100);
    case 'pct_saldo':
      return saldoActual * (reglas.entrega_minima_valor / 100);
    default:
      return 0;
  }
}

function calcularMora(reglas: FinCtaCteReglas, saldoActual: number): number {
  if (reglas.mora_valor <= 0) {
    return 0;
  }

  switch (reglas.mora_tipo) {
    case 'monto_fijo':
      return reglas.mora_valor;
    case 'pct_saldo':
      return saldoActual * (reglas.mora_valor / 100);
    default:
      return 0;
  }
}

function determinarEstadoResultante(
  operacion: FinCtaCteOperacion,
  huboPago: boolean,
  cumpleMinimo: boolean
): FinCtaCteEstado {
  if (operacion.saldo_actual <= 0) {
    return 'cancelada';
  }

  if (operacion.estado === 'judicial') {
    return 'judicial';
  }

  if (!huboPago) {
    return 'sin_pago';
  }

  if (!cumpleMinimo) {
    return 'incumplida';
  }

  return 'al_dia';
}

export class CtaCteControlMensualService {
  static async ejecutarControlPeriodo(
    orgId: string,
    operacionId: string,
    periodo: string,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<FinCtaCteControlMensual> {
    if (!isPeriodo(periodo)) {
      throw new Error('Periodo invalido. Debe tener formato YYYY-MM');
    }

    const db = getAdminFirestore();
    const existente = await db
      .collection(FIN_COLLECTIONS.ctaCteControlMensual(orgId))
      .where('operacion_id', '==', operacionId)
      .where('periodo', '==', periodo)
      .limit(1)
      .get();

    if (!existente.empty) {
      throw new Error(`Control del periodo ${periodo} ya fue ejecutado`);
    }

    const operacionRef = db.doc(FIN_COLLECTIONS.ctaCteOperacion(orgId, operacionId));
    const operacionSnap = await operacionRef.get();
    if (!operacionSnap.exists) {
      throw new Error(`Operacion ${operacionId} no encontrada`);
    }

    const operacion = operacionSnap.data() as FinCtaCteOperacion;
    if (operacion.estado === 'cancelada' || operacion.estado === 'refinanciada') {
      throw new Error('La operacion no esta activa para control mensual');
    }

    const { desde, hasta } = getPeriodoBounds(periodo);
    const movimientosSnap = await db
      .collection(FIN_COLLECTIONS.ctaCteMovimientos(orgId))
      .where('operacion_id', '==', operacionId)
      .get();

    const movimientos = movimientosSnap.docs.map(
      doc => doc.data() as FinCtaCteMovimiento
    );
    const pagosPeriodo = movimientos.filter(
      mov =>
        mov.tipo === 'pago_cliente' &&
        mov.fecha >= desde &&
        mov.fecha <= hasta
    );

    const totalPagado = pagosPeriodo.reduce(
      (acc, mov) => acc + Number(mov.importe || 0),
      0
    );
    const entregaMinimaEsperada = calcularEntregaMinima(
      operacion.reglas,
      Number(operacion.monto_original || 0),
      Number(operacion.saldo_actual || 0)
    );
    const huboPago = totalPagado > 0;
    const cumpleMinimo = totalPagado >= entregaMinimaEsperada;
    const aplicarMora =
      (huboPago && !cumpleMinimo) || (!huboPago && operacion.reglas.aplica_mora_sin_pago);
    const moraAplicada = aplicarMora
      ? calcularMora(operacion.reglas, Number(operacion.saldo_actual || 0))
      : 0;
    const gastoFijoAplicado =
      operacion.reglas.gasto_fijo_mensual > 0 ? operacion.reglas.gasto_fijo_mensual : 0;
    const estadoResultante = determinarEstadoResultante(
      operacion,
      huboPago,
      cumpleMinimo
    );
    const controlId = `${operacionId}_${periodo}`;
    const controlRef = db.doc(FIN_COLLECTIONS.ctaCteControlDoc(orgId, controlId));
    const procesadoEn = nowIso();
    const fechaProceso = procesadoEn.slice(0, 10);

    const control: FinCtaCteControlMensual = {
      id: controlId,
      organization_id: orgId,
      operacion_id: operacionId,
      periodo,
      total_pagado: totalPagado,
      entrega_minima_esperada: entregaMinimaEsperada,
      cumple_minimo: cumpleMinimo,
      hubo_pago: huboPago,
      mora_aplicada: moraAplicada,
      gasto_fijo_aplicado: gastoFijoAplicado,
      estado_resultante: estadoResultante,
      procesado_en: procesadoEn,
      procesado_por: usuarioId,
    };

    await db.runTransaction(async transaction => {
      const opSnap = await transaction.get(operacionRef);
      if (!opSnap.exists) {
        throw new Error(`Operacion ${operacionId} no encontrada`);
      }

      const currentOp = opSnap.data() as FinCtaCteOperacion;
      const config = await CtaCteJournalService.getConfigCuentas(orgId, {
        transaction,
      });
      const controlSnap = await transaction.get(controlRef);
      if (controlSnap.exists) {
        throw new Error(`Control del periodo ${periodo} ya fue ejecutado`);
      }

      let saldoActual = Number(currentOp.saldo_actual || 0);

      if (gastoFijoAplicado > 0) {
        const gastoRef = db.collection(FIN_COLLECTIONS.ctaCteMovimientos(orgId)).doc();
        const gastoMovimiento: FinCtaCteMovimiento = {
          id: gastoRef.id,
          organization_id: orgId,
          operacion_id: operacionId,
          tipo: 'gasto_fijo',
          fecha: fechaProceso,
          importe: gastoFijoAplicado,
          impacto_saldo: gastoFijoAplicado,
          saldo_anterior: saldoActual,
          saldo_nuevo: saldoActual + gastoFijoAplicado,
          descripcion: `Gasto fijo mensual ${periodo}`,
          periodo,
          createdAt: procesadoEn,
          createdBy: usuarioId,
        };

        saldoActual = gastoMovimiento.saldo_nuevo;
        const asientoId = config
          ? await CtaCteJournalService.generarAsiento(
              currentOp,
              gastoMovimiento,
              config,
              usuarioId,
              usuarioNombre,
              { transaction }
            )
          : null;

        transaction.set(gastoRef, {
          ...gastoMovimiento,
          asiento_id: asientoId ?? undefined,
        });
      }

      if (moraAplicada > 0) {
        const moraRef = db.collection(FIN_COLLECTIONS.ctaCteMovimientos(orgId)).doc();
        const moraMovimiento: FinCtaCteMovimiento = {
          id: moraRef.id,
          organization_id: orgId,
          operacion_id: operacionId,
          tipo: 'mora',
          fecha: fechaProceso,
          importe: moraAplicada,
          impacto_saldo: moraAplicada,
          saldo_anterior: saldoActual,
          saldo_nuevo: saldoActual + moraAplicada,
          descripcion: `Mora mensual ${periodo}`,
          periodo,
          createdAt: procesadoEn,
          createdBy: usuarioId,
        };

        saldoActual = moraMovimiento.saldo_nuevo;
        const asientoId = config
          ? await CtaCteJournalService.generarAsiento(
              currentOp,
              moraMovimiento,
              config,
              usuarioId,
              usuarioNombre,
              { transaction }
            )
          : null;

        transaction.set(moraRef, {
          ...moraMovimiento,
          asiento_id: asientoId ?? undefined,
        });
      }

      transaction.set(controlRef, control);
      transaction.update(operacionRef, {
        saldo_actual: saldoActual,
        estado: estadoResultante,
        ultimo_control_periodo: periodo,
        updatedAt: procesadoEn,
      });
    });

    return control;
  }

  static async ejecutarControlMasivo(
    orgId: string,
    periodo: string,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<{
    periodo: string;
    procesadas: number;
    al_dia: number;
    incumplidas: number;
    sin_pago: number;
    judicial: number;
    errores: Array<{ operacion_id: string; error: string }>;
  }> {
    const db = getAdminFirestore();
    const snapshot = await db.collection(FIN_COLLECTIONS.ctaCteOperaciones(orgId)).get();
    const operaciones = snapshot.docs
      .map(doc => doc.data() as FinCtaCteOperacion)
      .filter(
        operacion =>
          operacion.estado !== 'cancelada' && operacion.estado !== 'refinanciada'
      );

    const summary = {
      periodo,
      procesadas: 0,
      al_dia: 0,
      incumplidas: 0,
      sin_pago: 0,
      judicial: 0,
      errores: [] as Array<{ operacion_id: string; error: string }>,
    };

    for (const operacion of operaciones) {
      try {
        const control = await this.ejecutarControlPeriodo(
          orgId,
          operacion.id,
          periodo,
          usuarioId,
          usuarioNombre
        );

        summary.procesadas += 1;

        if (control.estado_resultante === 'al_dia') {
          summary.al_dia += 1;
        } else if (control.estado_resultante === 'incumplida') {
          summary.incumplidas += 1;
        } else if (control.estado_resultante === 'sin_pago') {
          summary.sin_pago += 1;
        } else if (control.estado_resultante === 'judicial') {
          summary.judicial += 1;
        }
      } catch (error) {
        summary.errores.push({
          operacion_id: operacion.id,
          error: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    return summary;
  }
}
