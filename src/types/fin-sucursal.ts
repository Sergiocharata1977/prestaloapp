export interface FinSucursal {
  id: string;
  organization_id: string;
  nombre: string;
  direccion?: string;
  activa: boolean;
  created_at: string;
}

export type FinSucursalCreateInput = {
  nombre: string;
  direccion?: string;
};

export type FinCajaEstado = 'abierta' | 'cerrada';

export interface FinCaja {
  id: string;
  organization_id: string;
  sucursal_id: string;
  nombre: string;
  cuenta_contable_id: string;
  estado: FinCajaEstado;
  saldo_actual: number;
  updated_at: string;
}

export type FinCajaCreateInput = {
  nombre: string;
  cuenta_contable_id: string;
};
