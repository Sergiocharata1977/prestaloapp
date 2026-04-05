import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import type { FinAsiento, FinAsientoLinea } from '@/types/fin-asiento';
import type { FinCobro } from '@/types/fin-cobro';
import type { FinCtaCteMovimiento, FinCtaCteOperacion } from '@/types/fin-ctacte';
import type { FinCredito } from '@/types/fin-credito';
import type { FinOperacionCheque } from '@/types/fin-operacion-cheque';
import type { FinConfigCuentas, FinCuenta } from '@/types/fin-plan-cuentas';

type CuentaContable = Pick<FinCuenta, 'id' | 'codigo' | 'nombre'>;
type CtaCteConfig = {
  cuenta_creditos_ctacte: string;
  cuenta_ventas_ctacte: string;
  cuenta_ingresos_mora: string;
  cuenta_ingresos_gastos_adm: string;
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

export class JournalEntryService {
  static async generarAsientoOtorgamiento(
    credito: FinCredito,
    config: FinConfigCuentas,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<string> {
    const [
      cuentaCreditos,
      cuentaInteresesNoDevengados,
      cuentaVentasFinanciadas,
    ] = await Promise.all([
      this.getCuenta(credito.organization_id, config.cuentas.creditos_por_financiaciones),
      this.getCuenta(credito.organization_id, config.cuentas.intereses_no_devengados),
      this.getCuenta(credito.organization_id, config.cuentas.ventas_financiadas),
    ]);

    const lineas: FinAsientoLinea[] = [
      buildLinea(
        cuentaCreditos,
        `Otorgamiento credito ${credito.numero_credito} - capital`,
        credito.capital,
        0
      ),
      buildLinea(
        cuentaInteresesNoDevengados,
        `Otorgamiento credito ${credito.numero_credito} - interes diferido`,
        credito.total_intereses,
        0
      ),
      buildLinea(
        cuentaVentasFinanciadas,
        `Otorgamiento credito ${credito.numero_credito} - venta financiada`,
        0,
        credito.capital
      ),
      buildLinea(
        cuentaInteresesNoDevengados,
        `Otorgamiento credito ${credito.numero_credito} - contrapartida interes diferido`,
        0,
        credito.total_intereses
      ),
    ];

    this.validarBalance(lineas);
    const db = getAdminFirestore();

    const asiento = this.buildAsiento({
      id: db.collection(FIN_COLLECTIONS.asientos(credito.organization_id)).doc().id,
      organization_id: credito.organization_id,
      sucursal_id: credito.sucursal_id,
      origen: 'credito_otorgado',
      documento_id: credito.id,
      documento_tipo: 'credito',
      fecha: credito.fecha_otorgamiento,
      lineas,
      usuarioId,
      usuarioNombre,
    });

    await db
      .doc(FIN_COLLECTIONS.asiento(credito.organization_id, asiento.id))
      .set(asiento);

    return asiento.id;
  }

  static async generarAsientoCobro(
    cobro: FinCobro,
    cuotaCapital: number,
    cuotaInteres: number,
    cajaAccountId: string,
    config: FinConfigCuentas,
    usuarioId: string,
    usuarioNombre: string,
    options: {
      transaction?: FirebaseFirestore.Transaction;
      asientoId?: string;
    } = {}
  ): Promise<string> {
    const [
      cuentaCaja,
      cuentaCreditos,
      cuentaInteresesNoDevengados,
      cuentaInteresesGanados,
    ] = await Promise.all([
      this.getCuenta(cobro.organization_id, cajaAccountId, options),
      this.getCuenta(
        cobro.organization_id,
        config.cuentas.creditos_por_financiaciones,
        options
      ),
      this.getCuenta(
        cobro.organization_id,
        config.cuentas.intereses_no_devengados,
        options
      ),
      this.getCuenta(cobro.organization_id, config.cuentas.intereses_ganados, options),
    ]);

    const lineas: FinAsientoLinea[] = [
      buildLinea(
        cuentaCaja,
        `Cobro cuota ${cobro.numero_cuota} - ingreso de caja`,
        cobro.total_cobrado,
        0
      ),
      buildLinea(
        cuentaCreditos,
        `Cobro cuota ${cobro.numero_cuota} - cancelacion de capital`,
        0,
        cuotaCapital
      ),
      buildLinea(
        cuentaInteresesNoDevengados,
        `Cobro cuota ${cobro.numero_cuota} - reversa interes diferido`,
        cuotaInteres,
        0
      ),
      buildLinea(
        cuentaInteresesNoDevengados,
        `Cobro cuota ${cobro.numero_cuota} - baja interes diferido`,
        0,
        cuotaInteres
      ),
      buildLinea(
        cuentaInteresesGanados,
        `Cobro cuota ${cobro.numero_cuota} - reconocimiento de interes`,
        0,
        cuotaInteres
      ),
    ];

    this.validarBalance(lineas);
    const db = getAdminFirestore();
    const asientoId =
      options.asientoId ??
      db.collection(FIN_COLLECTIONS.asientos(cobro.organization_id)).doc().id;
    const asientoRef = db.doc(FIN_COLLECTIONS.asiento(cobro.organization_id, asientoId));

    const asiento = this.buildAsiento({
      id: asientoId,
      organization_id: cobro.organization_id,
      sucursal_id: cobro.sucursal_id,
      origen: 'cobro_cuota',
      documento_id: cobro.id,
      documento_tipo: 'cobro',
      fecha: cobro.fecha_cobro,
      lineas,
      usuarioId,
      usuarioNombre,
    });

    if (options.transaction) {
      options.transaction.set(asientoRef, asiento);
    } else {
      await asientoRef.set(asiento);
    }

    return asiento.id;
  }

  static async generarAsientoLiquidacionOperacionCheque(
    operacion: FinOperacionCheque,
    usuarioId: string,
    usuarioNombre: string,
    options: {
      transaction?: FirebaseFirestore.Transaction;
      asientoId?: string;
    } = {}
  ): Promise<string> {
    if (!operacion.base_contable || !operacion.resumen) {
      throw new Error('Operacion de cheque incompleta para generar asiento');
    }

    const { base_contable, resumen } = operacion;
    const [cuentaCheques, cuentaLiquidadora, cuentaIngresos] = await Promise.all([
      this.getCuenta(
        operacion.organization_id,
        base_contable.cuenta_cheques_id,
        options
      ),
      this.getCuenta(
        operacion.organization_id,
        base_contable.cuenta_liquidadora_id,
        options
      ),
      this.getCuenta(
        operacion.organization_id,
        base_contable.cuenta_ingresos_id,
        options
      ),
    ]);

    const lineas: FinAsientoLinea[] = [
      buildLinea(
        cuentaCheques,
        `Liquidacion operacion ${operacion.numero_operacion} - ingreso de cheques`,
        resumen.importe_bruto,
        0
      ),
      buildLinea(
        cuentaLiquidadora,
        `Liquidacion operacion ${operacion.numero_operacion} - egreso neto`,
        0,
        resumen.importe_neto
      ),
    ];

    if (resumen.gastos > 0) {
      lineas.push(
        buildLinea(
          cuentaIngresos,
          `Liquidacion operacion ${operacion.numero_operacion} - gastos e ingresos`,
          0,
          resumen.gastos
        )
      );
    }

    this.validarBalance(lineas);
    const db = getAdminFirestore();
    const asientoId =
      options.asientoId ??
      db.collection(FIN_COLLECTIONS.asientos(operacion.organization_id)).doc().id;
    const asientoRef = db.doc(FIN_COLLECTIONS.asiento(operacion.organization_id, asientoId));

    const asiento = this.buildAsiento({
      id: asientoId,
      organization_id: operacion.organization_id,
      sucursal_id: operacion.sucursal_id,
      origen: 'descuento_cheque_liquidado',
      documento_id: operacion.id,
      documento_tipo: 'operacion_cheque',
      fecha: operacion.fecha_liquidacion,
      lineas,
      usuarioId,
      usuarioNombre,
    });

    if (options.transaction) {
      options.transaction.set(asientoRef, asiento);
    } else {
      await asientoRef.set(asiento);
    }

    return asiento.id;
  }

  static async generarAsientoCtaCteVentaInicial(
    operacion: FinCtaCteOperacion,
    config: CtaCteConfig,
    usuarioId: string,
    usuarioNombre: string,
    options: {
      transaction?: FirebaseFirestore.Transaction;
      asientoId?: string;
    } = {}
  ): Promise<string> {
    const [cuentaCreditos, cuentaVentas] = await Promise.all([
      this.getCuenta(operacion.organization_id, config.cuenta_creditos_ctacte, options),
      this.getCuenta(operacion.organization_id, config.cuenta_ventas_ctacte, options),
    ]);

    const lineas: FinAsientoLinea[] = [
      buildLinea(
        cuentaCreditos,
        `Alta cuenta corriente ${operacion.comprobante} - saldo inicial`,
        operacion.monto_original,
        0
      ),
      buildLinea(
        cuentaVentas,
        `Alta cuenta corriente ${operacion.comprobante} - venta`,
        0,
        operacion.monto_original
      ),
    ];

    this.validarBalance(lineas);
    return this.persistAsiento(
      {
        id:
          options.asientoId ??
          getAdminFirestore().collection(FIN_COLLECTIONS.asientos(operacion.organization_id)).doc()
            .id,
        organization_id: operacion.organization_id,
        sucursal_id: operacion.sucursal_id ?? '',
        origen: 'ctacte_venta_inicial',
        documento_id: operacion.id,
        documento_tipo: 'ctacte_operacion',
        fecha: operacion.fecha_venta,
        lineas,
        usuarioId,
        usuarioNombre,
      },
      options
    );
  }

  static async generarAsientoCtaCtePagoCliente(
    movimiento: FinCtaCteMovimiento,
    operacion: FinCtaCteOperacion,
    cajaAccountId: string,
    config: CtaCteConfig,
    usuarioId: string,
    usuarioNombre: string,
    options: {
      transaction?: FirebaseFirestore.Transaction;
      asientoId?: string;
    } = {}
  ): Promise<string> {
    const [cuentaCaja, cuentaCreditos] = await Promise.all([
      this.getCuenta(operacion.organization_id, cajaAccountId, options),
      this.getCuenta(operacion.organization_id, config.cuenta_creditos_ctacte, options),
    ]);

    const lineas: FinAsientoLinea[] = [
      buildLinea(
        cuentaCaja,
        `Pago cuenta corriente ${operacion.comprobante} - ingreso`,
        movimiento.importe,
        0
      ),
      buildLinea(
        cuentaCreditos,
        `Pago cuenta corriente ${operacion.comprobante} - cancelacion saldo`,
        0,
        movimiento.importe
      ),
    ];

    this.validarBalance(lineas);
    return this.persistAsiento(
      {
        id:
          options.asientoId ??
          getAdminFirestore().collection(FIN_COLLECTIONS.asientos(operacion.organization_id)).doc()
            .id,
        organization_id: operacion.organization_id,
        sucursal_id: operacion.sucursal_id ?? '',
        origen: 'ctacte_pago_cliente',
        documento_id: movimiento.id,
        documento_tipo: 'ctacte_movimiento',
        fecha: movimiento.fecha,
        lineas,
        usuarioId,
        usuarioNombre,
      },
      options
    );
  }

  static async generarAsientoCtaCteMora(
    movimiento: FinCtaCteMovimiento,
    operacion: FinCtaCteOperacion,
    config: CtaCteConfig,
    usuarioId: string,
    usuarioNombre: string,
    options: {
      transaction?: FirebaseFirestore.Transaction;
      asientoId?: string;
    } = {}
  ): Promise<string> {
    const [cuentaCreditos, cuentaIngresosMora] = await Promise.all([
      this.getCuenta(operacion.organization_id, config.cuenta_creditos_ctacte, options),
      this.getCuenta(operacion.organization_id, config.cuenta_ingresos_mora, options),
    ]);

    const lineas: FinAsientoLinea[] = [
      buildLinea(
        cuentaCreditos,
        `Mora cuenta corriente ${operacion.comprobante} - incremento saldo`,
        movimiento.importe,
        0
      ),
      buildLinea(
        cuentaIngresosMora,
        `Mora cuenta corriente ${operacion.comprobante} - ingreso`,
        0,
        movimiento.importe
      ),
    ];

    this.validarBalance(lineas);
    return this.persistAsiento(
      {
        id:
          options.asientoId ??
          getAdminFirestore().collection(FIN_COLLECTIONS.asientos(operacion.organization_id)).doc()
            .id,
        organization_id: operacion.organization_id,
        sucursal_id: operacion.sucursal_id ?? '',
        origen: 'ctacte_mora',
        documento_id: movimiento.id,
        documento_tipo: 'ctacte_movimiento',
        fecha: movimiento.fecha,
        lineas,
        usuarioId,
        usuarioNombre,
      },
      options
    );
  }

  static async generarAsientoCtaCteGastoFijo(
    movimiento: FinCtaCteMovimiento,
    operacion: FinCtaCteOperacion,
    config: CtaCteConfig,
    usuarioId: string,
    usuarioNombre: string,
    options: {
      transaction?: FirebaseFirestore.Transaction;
      asientoId?: string;
    } = {}
  ): Promise<string> {
    const [cuentaCreditos, cuentaIngresosGastosAdm] = await Promise.all([
      this.getCuenta(operacion.organization_id, config.cuenta_creditos_ctacte, options),
      this.getCuenta(operacion.organization_id, config.cuenta_ingresos_gastos_adm, options),
    ]);

    const lineas: FinAsientoLinea[] = [
      buildLinea(
        cuentaCreditos,
        `Gasto administrativo cuenta corriente ${operacion.comprobante}`,
        movimiento.importe,
        0
      ),
      buildLinea(
        cuentaIngresosGastosAdm,
        `Gasto administrativo cuenta corriente ${operacion.comprobante}`,
        0,
        movimiento.importe
      ),
    ];

    this.validarBalance(lineas);
    return this.persistAsiento(
      {
        id:
          options.asientoId ??
          getAdminFirestore().collection(FIN_COLLECTIONS.asientos(operacion.organization_id)).doc()
            .id,
        organization_id: operacion.organization_id,
        sucursal_id: operacion.sucursal_id ?? '',
        origen: 'ctacte_gasto_fijo',
        documento_id: movimiento.id,
        documento_tipo: 'ctacte_movimiento',
        fecha: movimiento.fecha,
        lineas,
        usuarioId,
        usuarioNombre,
      },
      options
    );
  }

  private static validarBalance(lineas: FinAsientoLinea[]): void {
    const totalDebe = round2(
      lineas.reduce((acc, linea) => acc + Number(linea.debe || 0), 0)
    );
    const totalHaber = round2(
      lineas.reduce((acc, linea) => acc + Number(linea.haber || 0), 0)
    );

    if (totalDebe !== totalHaber) {
      throw new Error(`Asiento desbalanceado: debe=${totalDebe} haber=${totalHaber}`);
    }
  }

  static async getConfigCuentas(
    orgId: string,
    plugin: string,
    options: {
      transaction?: FirebaseFirestore.Transaction;
    } = {}
  ): Promise<FinConfigCuentas> {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.configCuentas(orgId, plugin));
    const snap = options.transaction
      ? await options.transaction.get(ref)
      : await ref.get();
    if (!snap.exists) {
      throw new Error(
        `Configuracion de cuentas no encontrada para org=${orgId} plugin=${plugin}`
      );
    }

    const raw = snap.data() as Partial<FinConfigCuentas> & {
      creditos_por_financiaciones?: string;
      intereses_no_devengados?: string;
      ventas_financiadas?: string;
      intereses_ganados?: string;
    };

    const cuentas = raw.cuentas ?? {
      creditos_por_financiaciones: raw.creditos_por_financiaciones ?? '',
      intereses_no_devengados: raw.intereses_no_devengados ?? '',
      ventas_financiadas: raw.ventas_financiadas ?? '',
      intereses_ganados: raw.intereses_ganados ?? '',
    };

    if (
      !cuentas.creditos_por_financiaciones ||
      !cuentas.intereses_no_devengados ||
      !cuentas.ventas_financiadas ||
      !cuentas.intereses_ganados
    ) {
      throw new Error(
        `Configuracion de cuentas incompleta para org=${orgId} plugin=${plugin}`
      );
    }

    return {
      organization_id: raw.organization_id ?? orgId,
      plugin: raw.plugin ?? plugin,
      cuentas,
    };
  }

  private static async getCuenta(
    orgId: string,
    cuentaId: string,
    options: {
      transaction?: FirebaseFirestore.Transaction;
    } = {}
  ): Promise<CuentaContable> {
    if (!cuentaId) {
      throw new Error('Cuenta contable requerida');
    }

    const db = getAdminFirestore();
    const ref = db.doc(`${FIN_COLLECTIONS.cuentas(orgId)}/${cuentaId}`);
    const snap = options.transaction
      ? await options.transaction.get(ref)
      : await ref.get();
    if (!snap.exists) {
      throw new Error(`Cuenta contable no encontrada: ${cuentaId}`);
    }

    const cuenta = snap.data() as Partial<FinCuenta>;
    if (!cuenta.codigo || !cuenta.nombre) {
      throw new Error(`Cuenta contable invalida: ${cuentaId}`);
    }

    return {
      id: snap.id,
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
    };
  }

  private static async persistAsiento(
    input: Parameters<typeof JournalEntryService.buildAsiento>[0],
    options: {
      transaction?: FirebaseFirestore.Transaction;
    } = {}
  ): Promise<string> {
    const db = getAdminFirestore();
    const asientoRef = db.doc(FIN_COLLECTIONS.asiento(input.organization_id, input.id));
    const asiento = this.buildAsiento(input);

    if (options.transaction) {
      options.transaction.set(asientoRef, asiento);
    } else {
      await asientoRef.set(asiento);
    }

    return asiento.id;
  }

  private static buildAsiento(input: {
    id: string;
    organization_id: string;
    sucursal_id: string;
    origen: FinAsiento['origen'];
    documento_id: string;
    documento_tipo: string;
    fecha: string;
    lineas: FinAsientoLinea[];
    usuarioId: string;
    usuarioNombre: string;
  }): FinAsiento {
    const total_debe = round2(
      input.lineas.reduce((acc, linea) => acc + Number(linea.debe || 0), 0)
    );
    const total_haber = round2(
      input.lineas.reduce((acc, linea) => acc + Number(linea.haber || 0), 0)
    );

    return {
      id: input.id,
      organization_id: input.organization_id,
      sucursal_id: input.sucursal_id,
      origen: input.origen,
      documento_id: input.documento_id,
      documento_tipo: input.documento_tipo,
      fecha: input.fecha,
      periodo: getPeriodo(input.fecha),
      estado: 'contabilizado',
      lineas: input.lineas,
      total_debe,
      total_haber,
      creado_por: {
        usuario_id: input.usuarioId,
        nombre: input.usuarioNombre,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
