import { adminDb } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import type { FinAsiento, FinAsientoLinea } from '@/types/fin-asiento';
import type { FinCobro } from '@/types/fin-cobro';
import type { FinCredito } from '@/types/fin-credito';
import type { FinConfigCuentas, FinCuenta } from '@/types/fin-plan-cuentas';

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

    const asiento = this.buildAsiento({
      id: adminDb.collection(FIN_COLLECTIONS.asientos(credito.organization_id)).doc().id,
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

    await adminDb
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
    usuarioNombre: string
  ): Promise<string> {
    const [
      cuentaCaja,
      cuentaCreditos,
      cuentaInteresesNoDevengados,
      cuentaInteresesGanados,
    ] = await Promise.all([
      this.getCuenta(cobro.organization_id, cajaAccountId),
      this.getCuenta(cobro.organization_id, config.cuentas.creditos_por_financiaciones),
      this.getCuenta(cobro.organization_id, config.cuentas.intereses_no_devengados),
      this.getCuenta(cobro.organization_id, config.cuentas.intereses_ganados),
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

    const asiento = this.buildAsiento({
      id: adminDb.collection(FIN_COLLECTIONS.asientos(cobro.organization_id)).doc().id,
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

    await adminDb
      .doc(FIN_COLLECTIONS.asiento(cobro.organization_id, asiento.id))
      .set(asiento);

    return asiento.id;
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
    plugin: string
  ): Promise<FinConfigCuentas> {
    const snap = await adminDb.doc(FIN_COLLECTIONS.configCuentas(orgId, plugin)).get();
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
    cuentaId: string
  ): Promise<CuentaContable> {
    if (!cuentaId) {
      throw new Error('Cuenta contable requerida');
    }

    const snap = await adminDb.doc(`${FIN_COLLECTIONS.cuentas(orgId)}/${cuentaId}`).get();
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
