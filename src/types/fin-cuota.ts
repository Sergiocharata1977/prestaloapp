export type FinCuotaEstado = 'pendiente' | 'pagada' | 'vencida';

export interface FinCuota {
  id: string;
  organization_id: string;
  sucursal_id: string;
  credito_id: string;
  cliente_id: string;
  numero_cuota: number;
  fecha_vencimiento: string;
  capital: number;
  interes: number;
  total: number;
  saldo_capital_inicio: number;
  saldo_capital_fin: number;
  estado: FinCuotaEstado;
  cobro_id?: string;
  fecha_pago?: string;
  created_at: string;
  updated_at: string;
}
