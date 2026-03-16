import { AmortizationService } from '@/services/AmortizationService';

describe('AmortizationService', () => {
  it('calcula sistema frances con 12 cuotas y capital total consistente', () => {
    const tabla = AmortizationService.calcular(
      10000,
      0.05,
      12,
      'frances',
      '2026-01-15'
    );

    expect(tabla.sistema).toBe('frances');
    expect(tabla.cuotas).toHaveLength(12);
    expect(tabla.total_credito).toBeCloseTo(13539.07, 2);
    expect(
      tabla.cuotas.reduce((sum, cuota) => sum + cuota.capital, 0)
    ).toBeCloseTo(10000, 2);
    expect(tabla.total_intereses).toBeCloseTo(3539.07, 2);
  });

  it('calcula sistema aleman con capital fijo e interes decreciente', () => {
    const tabla = AmortizationService.calcular(
      6000,
      0.03,
      6,
      'aleman',
      '2026-01-10'
    );

    expect(tabla.sistema).toBe('aleman');
    expect(tabla.cuotas).toHaveLength(6);
    expect(tabla.cuotas.every((cuota) => cuota.capital === 1000)).toBe(true);
    expect(tabla.cuotas[0].interes).toBeCloseTo(180, 2);
    expect(tabla.cuotas[1].interes).toBeCloseTo(150, 2);
    expect(tabla.cuotas[5].interes).toBeCloseTo(30, 2);
    expect(tabla.cuotas[0].interes).toBeGreaterThan(tabla.cuotas[1].interes);
    expect(tabla.cuotas[1].interes).toBeGreaterThan(tabla.cuotas[2].interes);
  });

  it('genera cuotas iguales y sin intereses cuando la tasa es cero', () => {
    const tabla = AmortizationService.calcular(
      1200,
      0,
      4,
      'frances',
      '2026-01-05'
    );

    expect(tabla.total_intereses).toBe(0);
    expect(tabla.total_credito).toBe(1200);
    expect(tabla.cuotas.every((cuota) => cuota.interes === 0)).toBe(true);
    expect(tabla.cuotas.every((cuota) => cuota.total === 300)).toBe(true);
  });

  it('preserva fin de mes en el calculo de fechas', () => {
    const fechas = AmortizationService.calcularFechasVencimiento(
      '2026-01-31',
      3
    );

    expect(fechas).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('valida capital negativo, cuotas cero y fecha invalida', () => {
    expect(() =>
      AmortizationService.calcular(-1, 0.05, 12, 'frances', '2026-01-15')
    ).toThrow('El capital debe ser mayor a cero');

    expect(() =>
      AmortizationService.calcular(1000, 0.05, 0, 'frances', '2026-01-15')
    ).toThrow('La cantidad de cuotas debe ser un entero mayor a cero');

    expect(() =>
      AmortizationService.calcular(1000, 0.05, 12, 'frances', '2026-02-30')
    ).toThrow();
  });
});
