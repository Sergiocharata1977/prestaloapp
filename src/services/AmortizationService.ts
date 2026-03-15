export interface CuotaCalculada {
  numero_cuota: number;
  fecha_vencimiento: string;
  capital: number;
  interes: number;
  total: number;
  saldo_capital_inicio: number;
  saldo_capital_fin: number;
}

export interface TablaAmortizacion {
  sistema: 'frances' | 'aleman';
  capital: number;
  tasa_mensual: number;
  cantidad_cuotas: number;
  total_intereses: number;
  total_credito: number;
  valor_cuota_promedio: number;
  cuotas: CuotaCalculada[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseIsoDateOnly(dateIso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);

  if (!match) {
    throw new Error('La fecha debe estar en formato ISO YYYY-MM-DD');
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (Number.isNaN(date.getTime())) {
    throw new Error('La fecha de vencimiento es invalida');
  }

  return date;
}

function formatIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonthUtc(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addMonthsPreservingMonthEnd(dateIso: string, monthsToAdd: number): string {
  const baseDate = parseIsoDateOnly(dateIso);
  const baseYear = baseDate.getUTCFullYear();
  const baseMonth = baseDate.getUTCMonth();
  const baseDay = baseDate.getUTCDate();
  const baseLastDay = lastDayOfMonthUtc(baseYear, baseMonth);

  const targetMonthIndex = baseMonth + monthsToAdd;
  const targetYear = baseYear + Math.floor(targetMonthIndex / 12);
  const normalizedMonth =
    ((targetMonthIndex % 12) + 12) % 12;
  const targetLastDay = lastDayOfMonthUtc(targetYear, normalizedMonth);
  const targetDay =
    baseDay === baseLastDay ? targetLastDay : Math.min(baseDay, targetLastDay);

  return formatIsoDateOnly(
    new Date(Date.UTC(targetYear, normalizedMonth, targetDay))
  );
}

export class AmortizationService {
  static calcular(
    capital: number,
    tasaMensual: number,
    cantidadCuotas: number,
    sistema: 'frances' | 'aleman',
    fechaPrimerVencimiento: string
  ): TablaAmortizacion {
    this.validarEntradas(
      capital,
      tasaMensual,
      cantidadCuotas,
      fechaPrimerVencimiento
    );

    const cuotas =
      sistema === 'frances'
        ? this.calcularFrances(
            capital,
            tasaMensual,
            cantidadCuotas,
            fechaPrimerVencimiento
          )
        : this.calcularAleman(
            capital,
            tasaMensual,
            cantidadCuotas,
            fechaPrimerVencimiento
          );

    const totalIntereses = round2(
      cuotas.reduce((sum, cuota) => sum + cuota.interes, 0)
    );
    const totalCredito = round2(
      cuotas.reduce((sum, cuota) => sum + cuota.total, 0)
    );
    const valorCuotaPromedio = round2(totalCredito / cantidadCuotas);

    return {
      sistema,
      capital: round2(capital),
      tasa_mensual: tasaMensual,
      cantidad_cuotas: cantidadCuotas,
      total_intereses: totalIntereses,
      total_credito: totalCredito,
      valor_cuota_promedio: valorCuotaPromedio,
      cuotas,
    };
  }

  private static validarEntradas(
    capital: number,
    tasaMensual: number,
    cantidadCuotas: number,
    fechaPrimerVencimiento: string
  ): void {
    if (capital <= 0) {
      throw new Error('El capital debe ser mayor a cero');
    }

    if (tasaMensual < 0) {
      throw new Error('La tasa mensual no puede ser negativa');
    }

    if (!Number.isInteger(cantidadCuotas) || cantidadCuotas <= 0) {
      throw new Error('La cantidad de cuotas debe ser un entero mayor a cero');
    }

    parseIsoDateOnly(fechaPrimerVencimiento);
  }

  private static calcularFrances(
    capital: number,
    tasaMensual: number,
    cantidadCuotas: number,
    fechaPrimerVencimiento: string
  ): CuotaCalculada[] {
    const fechas = this.calcularFechasVencimiento(
      fechaPrimerVencimiento,
      cantidadCuotas
    );
    const cuotas: CuotaCalculada[] = [];
    const cuotaTeorica =
      tasaMensual === 0
        ? capital / cantidadCuotas
        : (capital * tasaMensual) /
          (1 - Math.pow(1 + tasaMensual, -cantidadCuotas));

    let saldo = round2(capital);
    let capitalAcumulado = 0;

    for (let index = 0; index < cantidadCuotas; index++) {
      const numeroCuota = index + 1;
      const saldoInicio = saldo;
      const interes = round2(saldoInicio * tasaMensual);
      let capitalCuota =
        index === cantidadCuotas - 1
          ? round2(capital - capitalAcumulado)
          : round2(cuotaTeorica - interes);

      if (capitalCuota > saldoInicio) {
        capitalCuota = saldoInicio;
      }

      let total = round2(capitalCuota + interes);
      let saldoFin = round2(saldoInicio - capitalCuota);

      if (index === cantidadCuotas - 1) {
        capitalCuota = round2(saldoInicio);
        total = round2(capitalCuota + interes);
        saldoFin = 0;
      }

      cuotas.push({
        numero_cuota: numeroCuota,
        fecha_vencimiento: fechas[index],
        capital: capitalCuota,
        interes,
        total,
        saldo_capital_inicio: saldoInicio,
        saldo_capital_fin: saldoFin,
      });

      capitalAcumulado = round2(capitalAcumulado + capitalCuota);
      saldo = saldoFin;
    }

    return cuotas;
  }

  private static calcularAleman(
    capital: number,
    tasaMensual: number,
    cantidadCuotas: number,
    fechaPrimerVencimiento: string
  ): CuotaCalculada[] {
    const fechas = this.calcularFechasVencimiento(
      fechaPrimerVencimiento,
      cantidadCuotas
    );
    const cuotas: CuotaCalculada[] = [];
    const capitalFijoTeorico = capital / cantidadCuotas;

    let saldo = round2(capital);
    let capitalAcumulado = 0;

    for (let index = 0; index < cantidadCuotas; index++) {
      const numeroCuota = index + 1;
      const saldoInicio = saldo;
      const interes = round2(saldoInicio * tasaMensual);
      let capitalCuota =
        index === cantidadCuotas - 1
          ? round2(capital - capitalAcumulado)
          : round2(capitalFijoTeorico);

      if (capitalCuota > saldoInicio) {
        capitalCuota = saldoInicio;
      }

      const total = round2(capitalCuota + interes);
      const saldoFin =
        index === cantidadCuotas - 1 ? 0 : round2(saldoInicio - capitalCuota);

      cuotas.push({
        numero_cuota: numeroCuota,
        fecha_vencimiento: fechas[index],
        capital: capitalCuota,
        interes,
        total,
        saldo_capital_inicio: saldoInicio,
        saldo_capital_fin: saldoFin,
      });

      capitalAcumulado = round2(capitalAcumulado + capitalCuota);
      saldo = saldoFin;
    }

    return cuotas;
  }

  static calcularFechasVencimiento(
    fechaPrimera: string,
    cantidad: number
  ): string[] {
    parseIsoDateOnly(fechaPrimera);

    return Array.from({ length: cantidad }, (_, index) =>
      addMonthsPreservingMonthEnd(fechaPrimera, index)
    );
  }
}
