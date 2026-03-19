export interface FinTramoTasa {
  cantidad_cuotas: number;
  tasa_mensual: number;
}

export interface FinPlanFinanciacion {
  id: string;
  organization_id: string;
  nombre: string;
  politica_id: string;
  tramos_tasa: FinTramoTasa[];
  tasa_punitoria_mensual: number;
  cargo_fijo?: number;
  cargo_variable_pct?: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export type FinPlanFinanciacionCreateInput = Omit<
  FinPlanFinanciacion,
  'id' | 'organization_id' | 'created_at' | 'updated_at'
>;
