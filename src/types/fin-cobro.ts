export type FinMedioPago = 'efectivo';

export interface FinCobro {
  id: string;
  organization_id: string;
  sucursal_id: string;
  caja_id: string;
  credito_id: string;
  cuota_id: string;
  cliente_id: string;
  numero_cuota: number;
  capital_cobrado: number;
  interes_cobrado: number;
  total_cobrado: number;
  medio_pago: FinMedioPago;
  fecha_cobro: string;
  usuario_id: string;
  usuario_nombre: string;
  asiento_id: string;
  created_at: string;
}

export type FinCobroCreateInput = {
  sucursal_id: string;
  caja_id: string;
  credito_id: string;
  cuota_id: string;
  medio_pago: FinMedioPago;
};
