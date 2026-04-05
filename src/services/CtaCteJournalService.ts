import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import type { FinAsiento, FinAsientoLinea } from '@/types/fin-asiento';
import type {
  FinCtaCteMovimiento,
  FinCtaCteMovimientoTipo,
  FinCtaCteOperacion,
} from '@/types/fin-ctacte';
import type { FinCaja } from '@/types/fin-sucursal';
import type { FinConfigCtaCte, FinCuenta } from '@/types/fin-plan-cuentas';

const PLUGIN_ID = 'ctacte';
const LEGACY_PLUGIN_ID = 'financiacion_consumo';

type CuentaContable = Pick<FinCuenta, 'id' | 'codigo' | 'nombre'>;

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

function resolveOrigen(
  tipo: FinCtaCteMovimientoTipo
): FinAsiento['origen'] | null {
  switch (tipo) {
    case 'venta_inicial':
      return 'ctacte_venta_inicial';
    case 'pago_cliente':
      return 'ctacte_pago_cliente';
    case 'mora':
      return 'ctacte_mora';
    case 'gasto_fijo':
      return 'ctacte_gasto_fijo';
    default:
      return null;
  }
}

export class CtaCteJournalService {
  static async getConfigCuentas(
    orgId: string,
    options: {
      transaction?: FirebaseFirestore.Transaction;
    } = {}
  ): Promise<FinConfigCtaCte | null> {
    const db = getAdminFirestore();
    const refs = [
      db.doc(FIN_COLLECTIONS.configCuentas(orgId, PLUGIN_ID)),
      db.doc(FIN_COLLECTIONS.configCuentas(orgId, LEGACY_PLUGIN_ID)),
    ];

    for (const ref of refs) {
      const snap = options.transaction
        ? await options.transaction.get(ref)
        : await ref.get();

      if (!snap.exists) {
        continue;
      }

      const raw = snap.data() as Partial<FinConfigCtaCte> & {
        cuentas?: Partial<FinConfigCtaCte['cuentas']> & {
          cuenta_creditos_ctacte?: string;
          cuenta_ventas_ctacte?: string;
          cuenta_ingresos_mora?: string;
          cuenta_ingresos_gastos_adm?: string;
        };
        cuenta_creditos_ctacte?: string;
        cuenta_ventas_ctacte?: string;
        cuenta_ingresos_mora?: string;
        cuenta_ingresos_gastos_adm?: string;
        creditos_ctacte?: string;
        ventas_ctacte?: string;
        ingresos_mora_ctacte?: string;
        ingresos_gastos_adm?: string;
        caja_default?: string;
      };

      const cuentas: FinConfigCtaCte['cuentas'] = {
        creditos_ctacte: String(
          raw.cuentas?.creditos_ctacte ??
            raw.cuentas?.cuenta_creditos_ctacte ??
            raw.creditos_ctacte ??
            raw.cuenta_creditos_ctacte ??
            ''
        ).trim(),
        ventas_ctacte: String(
          raw.cuentas?.ventas_ctacte ??
            raw.cuentas?.cuenta_ventas_ctacte ??
            raw.ventas_ctacte ??
            raw.cuenta_ventas_ctacte ??
            ''
        ).trim(),
        ingresos_mora_ctacte: String(
          raw.cuentas?.ingresos_mora_ctacte ??
            raw.cuentas?.cuenta_ingresos_mora ??
            raw.ingresos_mora_ctacte ??
            raw.cuenta_ingresos_mora ??
            ''
        ).trim(),
        ingresos_gastos_adm: String(
          raw.cuentas?.ingresos_gastos_adm ??
            raw.cuentas?.cuenta_ingresos_gastos_adm ??
            raw.ingresos_gastos_adm ??
            raw.cuenta_ingresos_gastos_adm ??
            ''
        ).trim(),
        caja_default: String(raw.cuentas?.caja_default ?? raw.caja_default ?? '').trim(),
      };

      if (
        !cuentas.creditos_ctacte ||
        !cuentas.ventas_ctacte ||
        !cuentas.ingresos_mora_ctacte ||
        !cuentas.ingresos_gastos_adm ||
        !cuentas.caja_default
      ) {
        throw new Error(
          `Configuracion de cuentas incompleta para org=${orgId} plugin=${snap.id}`
        );
      }

      return {
        organization_id: raw.organization_id ?? orgId,
        plugin: raw.plugin ?? snap.id,
        cuentas,
      };
    }

    return null;
  }

  static async generarAsiento(
    operacion: FinCtaCteOperacion,
    movimiento: FinCtaCteMovimiento,
    config: FinConfigCtaCte,
    usuarioId: string,
    usuarioNombre: string,
    options: {
      transaction?: FirebaseFirestore.Transaction;
      asientoId?: string;
    } = {}
  ): Promise<string | null> {
    const origen = resolveOrigen(movimiento.tipo);
    if (!origen || movimiento.tipo === 'cancelacion') {
      return null;
    }

    const lineas = await this.buildLineas(operacion, movimiento, config, options);
    this.validarBalance(lineas);

    const db = getAdminFirestore();
    const asientoId =
      options.asientoId ??
      db.collection(FIN_COLLECTIONS.asientos(operacion.organization_id)).doc().id;
    const asientoRef = db.doc(
      FIN_COLLECTIONS.asiento(operacion.organization_id, asientoId)
    );

    const asiento = this.buildAsiento({
      id: asientoId,
      organization_id: operacion.organization_id,
      sucursal_id: operacion.sucursal_id ?? '',
      origen,
      documento_id: movimiento.id,
      documento_tipo: 'ctacte_movimiento',
      fecha: movimiento.fecha,
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

  private static async buildLineas(
    operacion: FinCtaCteOperacion,
    movimiento: FinCtaCteMovimiento,
    config: FinConfigCtaCte,
    options: {
      transaction?: FirebaseFirestore.Transaction;
    }
  ): Promise<FinAsientoLinea[]> {
    const cuentaCreditos = await this.getCuenta(
      operacion.organization_id,
      config.cuentas.creditos_ctacte,
      options
    );

    switch (movimiento.tipo) {
      case 'venta_inicial': {
        const cuentaVentas = await this.getCuenta(
          operacion.organization_id,
          config.cuentas.ventas_ctacte,
          options
        );

        return [
          buildLinea(
            cuentaCreditos,
            `Venta financiada ${operacion.comprobante}`,
            movimiento.importe,
            0
          ),
          buildLinea(
            cuentaVentas,
            `Venta financiada ${operacion.comprobante}`,
            0,
            movimiento.importe
          ),
        ];
      }
      case 'pago_cliente': {
        const cuentaCaja = await this.resolveCuentaCaja(
          operacion,
          movimiento,
          config,
          options
        );

        return [
          buildLinea(
            cuentaCaja,
            `Pago cliente ${operacion.comprobante}`,
            movimiento.importe,
            0
          ),
          buildLinea(
            cuentaCreditos,
            `Pago cliente ${operacion.comprobante}`,
            0,
            movimiento.importe
          ),
        ];
      }
      case 'mora': {
        const cuentaMora = await this.getCuenta(
          operacion.organization_id,
          config.cuentas.ingresos_mora_ctacte,
          options
        );

        return [
          buildLinea(
            cuentaCreditos,
            `Mora ${movimiento.periodo ?? operacion.comprobante}`,
            movimiento.importe,
            0
          ),
          buildLinea(
            cuentaMora,
            `Mora ${movimiento.periodo ?? operacion.comprobante}`,
            0,
            movimiento.importe
          ),
        ];
      }
      case 'gasto_fijo': {
        const cuentaGastosAdm = await this.getCuenta(
          operacion.organization_id,
          config.cuentas.ingresos_gastos_adm,
          options
        );

        return [
          buildLinea(
            cuentaCreditos,
            `Gasto admin ${movimiento.periodo ?? operacion.comprobante}`,
            movimiento.importe,
            0
          ),
          buildLinea(
            cuentaGastosAdm,
            `Gasto admin ${movimiento.periodo ?? operacion.comprobante}`,
            0,
            movimiento.importe
          ),
        ];
      }
      default:
        throw new Error(`Movimiento no soportado para asiento: ${movimiento.tipo}`);
    }
  }

  private static async resolveCuentaCaja(
    operacion: FinCtaCteOperacion,
    movimiento: FinCtaCteMovimiento,
    config: FinConfigCtaCte,
    options: {
      transaction?: FirebaseFirestore.Transaction;
    }
  ): Promise<CuentaContable> {
    if (movimiento.caja_id && operacion.sucursal_id) {
      const db = getAdminFirestore();
      const cajaRef = db.doc(
        FIN_COLLECTIONS.caja(
          operacion.organization_id,
          operacion.sucursal_id,
          movimiento.caja_id
        )
      );
      const cajaSnap = options.transaction
        ? await options.transaction.get(cajaRef)
        : await cajaRef.get();

      if (cajaSnap.exists) {
        const caja = cajaSnap.data() as Partial<FinCaja>;
        if (caja.cuenta_contable_id?.trim()) {
          return this.getCuenta(
            operacion.organization_id,
            caja.cuenta_contable_id,
            options
          );
        }
      }
    }

    return this.getCuenta(operacion.organization_id, config.cuentas.caja_default, options);
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
