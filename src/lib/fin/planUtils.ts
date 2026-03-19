import type { FinPlanFinanciacion, FinTramoTasa } from '@/types/fin-plan-financiacion';

/**
 * Resuelve la tasa mensual para una cantidad de cuotas dada, buscando en los tramos del plan.
 * Función pura reutilizable en cliente y servidor.
 */
export function resolverTasa(plan: FinPlanFinanciacion, cantidadCuotas: number): number {
  const tramosOrdenados = [...plan.tramos_tasa].sort(
    (a, b) => a.cantidad_cuotas - b.cantidad_cuotas
  );
  const exacto = tramosOrdenados.find((t) => t.cantidad_cuotas === cantidadCuotas);
  if (exacto) return exacto.tasa_mensual;
  const superior = tramosOrdenados.find((t) => t.cantidad_cuotas > cantidadCuotas);
  if (superior) return superior.tasa_mensual;
  return tramosOrdenados[tramosOrdenados.length - 1].tasa_mensual;
}

/** Ordena tramos por cantidad_cuotas ascendente. */
export function ordenarTramos(tramos: FinTramoTasa[]): FinTramoTasa[] {
  return [...tramos].sort((a, b) => a.cantidad_cuotas - b.cantidad_cuotas);
}
