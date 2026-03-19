import { PlanFinanciacionService } from '@/services/PlanFinanciacionService';

describe('PlanFinanciacionService.resolverTasa', () => {
  const plan = {
    id: 'plan-1',
    organization_id: 'org-1',
    nombre: 'Plan test',
    politica_id: 'pol-1',
    tramos_tasa: [
      { cantidad_cuotas: 3, tasa_mensual: 4.5 },
      { cantidad_cuotas: 6, tasa_mensual: 5.1 },
      { cantidad_cuotas: 12, tasa_mensual: 5.8 },
    ],
    tasa_punitoria_mensual: 8,
    activo: true,
    created_at: '2026-03-18T00:00:00.000Z',
    updated_at: '2026-03-18T00:00:00.000Z',
  };

  it('usa el tramo exacto cuando la cantidad de cuotas coincide', () => {
    expect(PlanFinanciacionService.resolverTasa(plan, 6)).toBe(5.1);
  });

  it('usa el tramo inmediatamente superior cuando no hay match exacto', () => {
    expect(PlanFinanciacionService.resolverTasa(plan, 5)).toBe(5.1);
  });

  it('usa el ultimo tramo como fallback cuando supera el maximo configurado', () => {
    expect(PlanFinanciacionService.resolverTasa(plan, 18)).toBe(5.8);
  });
});
