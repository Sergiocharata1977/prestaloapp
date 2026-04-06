// src/types/fin-stock.ts

export type FinStockRubro =
  | 'electrodomesticos'
  | 'tecnologia'
  | 'ropa_calzado'
  | 'muebles_hogar'
  | 'otro';

export const FIN_STOCK_RUBRO_LABELS: Record<FinStockRubro, string> = {
  electrodomesticos: 'Electrodomésticos',
  tecnologia: 'Tecnología',
  ropa_calzado: 'Ropa y Calzado',
  muebles_hogar: 'Muebles y Hogar',
  otro: 'Otro',
};

export type FinStockUnidad = 'unidad' | 'par' | 'docena' | 'kg' | 'metro';

export const FIN_STOCK_UNIDAD_LABELS: Record<FinStockUnidad, string> = {
  unidad: 'Unidad',
  par: 'Par',
  docena: 'Docena',
  kg: 'Kilogramo',
  metro: 'Metro',
};

// ─── Categoría ───────────────────────────────────────────────────────────────

export interface FinStockCategoria {
  id: string;
  organization_id: string;
  nombre: string;
  descripcion?: string;
  rubro: FinStockRubro;
  activa: boolean;
  createdAt: string;
  createdBy: string;
}

export type FinStockCategoriaInput = Omit<FinStockCategoria, 'id' | 'organization_id' | 'createdAt' | 'createdBy'>;

// ─── Producto ────────────────────────────────────────────────────────────────

export interface FinStockProducto {
  id: string;
  organization_id: string;
  categoria_id: string;
  categoria_nombre: string;     // desnormalizado para queries rápidas
  codigo: string;               // SKU / código interno
  nombre: string;
  descripcion?: string;
  marca?: string;
  modelo?: string;
  unidad_medida: FinStockUnidad;
  precio_costo?: number;         // costo de adquisición (opcional)
  precio_venta_contado: number;  // precio de lista al contado
  activo: boolean;
  stock_actual: number;          // actualizado en cada movimiento (desnormalizado)
  stock_minimo: number;          // umbral para alerta de stock bajo
  requiere_serie: boolean;       // si cada unidad tiene número de serie
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export type FinStockProductoInput = Omit<
  FinStockProducto,
  'id' | 'organization_id' | 'categoria_nombre' | 'stock_actual' | 'createdAt' | 'createdBy' | 'updatedAt'
>;

// ─── Movimiento de Stock ──────────────────────────────────────────────────────

export type FinMovimientoStockTipo =
  | 'ingreso_compra'              // entrada por compra a proveedor
  | 'ingreso_devolucion_cliente'  // devolución de un cliente
  | 'ingreso_ajuste'              // ajuste manual positivo
  | 'egreso_venta_financiada'     // salida por crédito de venta financiada
  | 'egreso_venta_ctacte'         // salida por operación de cuenta corriente
  | 'egreso_ajuste'               // ajuste manual negativo
  | 'egreso_devolucion_proveedor';// devolución a proveedor

export const FIN_MOVIMIENTO_TIPO_LABELS: Record<FinMovimientoStockTipo, string> = {
  ingreso_compra: 'Ingreso por compra',
  ingreso_devolucion_cliente: 'Devolución de cliente',
  ingreso_ajuste: 'Ajuste manual (+)',
  egreso_venta_financiada: 'Venta financiada',
  egreso_venta_ctacte: 'Venta Cta. Cte.',
  egreso_ajuste: 'Ajuste manual (−)',
  egreso_devolucion_proveedor: 'Devolución a proveedor',
};

export const FIN_MOVIMIENTO_INGRESO_TIPOS: FinMovimientoStockTipo[] = [
  'ingreso_compra',
  'ingreso_devolucion_cliente',
  'ingreso_ajuste',
];

export interface FinMovimientoStock {
  id: string;
  organization_id: string;
  producto_id: string;
  producto_nombre: string;     // desnormalizado
  tipo: FinMovimientoStockTipo;
  cantidad: number;            // siempre positivo; el tipo determina la dirección
  stock_anterior: number;      // snapshot antes del movimiento
  stock_nuevo: number;         // snapshot después del movimiento
  /** ID del crédito o operación cta-cte que originó el movimiento (si aplica) */
  referencia_id?: string;
  referencia_tipo?: 'credito' | 'ctacte';
  referencia_numero?: string;  // número de crédito u operación
  costo_unitario?: number;
  precio_unitario?: number;
  numero_serie?: string;       // si requiere_serie = true
  notas?: string;
  createdAt: string;
  createdBy: string;
}

export type FinMovimientoStockInput = Omit<
  FinMovimientoStock,
  'id' | 'organization_id' | 'stock_anterior' | 'stock_nuevo' | 'createdAt' | 'createdBy'
>;

// ─── Resumen para listado ─────────────────────────────────────────────────────

export interface FinStockResumen {
  producto_id: string;
  producto_nombre: string;
  categoria_nombre: string;
  rubro: FinStockRubro;
  stock_actual: number;
  stock_minimo: number;
  alerta_stock_bajo: boolean;
  precio_venta_contado: number;
  ultimo_movimiento?: string;
}
