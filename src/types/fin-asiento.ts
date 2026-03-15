export type FinAsientoOrigen = 'credito_otorgado' | 'cobro_cuota';

export interface FinAsientoLinea {
  cuenta_id: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debe: number;
  haber: number;
  descripcion: string;
}

export interface FinAsiento {
  id: string;
  organization_id: string;
  sucursal_id: string;
  origen: FinAsientoOrigen;
  documento_id: string;
  documento_tipo: string;
  fecha: string;
  periodo: string;
  estado: 'contabilizado';
  lineas: FinAsientoLinea[];
  total_debe: number;
  total_haber: number;
  creado_por: {
    usuario_id: string;
    nombre: string;
    timestamp: string;
  };
}
