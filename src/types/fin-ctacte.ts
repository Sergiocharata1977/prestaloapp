// ─── Reglas configurables por operación ──────────────────────────────────────

export type FinCtaCteEntregaMinimaT = 'monto_fijo' | 'pct_compra' | 'pct_saldo';
export type FinCtaCteCargoT         = 'monto_fijo' | 'pct_saldo';

export interface FinCtaCteReglas {
  /** Tipo de cálculo para la entrega mínima mensual exigida */
  entrega_minima_tipo:   FinCtaCteEntregaMinimaT;
  /** Valor para calcular la entrega mínima (importe fijo o porcentaje) */
  entrega_minima_valor:  number;
  /** Gasto fijo mensual a aplicar (0 = no aplica) */
  gasto_fijo_mensual:    number;
  /** Día del mes en que se realiza el control (1..28) */
  dia_control:           number;
  /** Días de gracia desde el dia_control antes de aplicar mora */
  gracia_dias:           number;
  /** Si aplicar mora cuando no hubo ningún pago en el período */
  aplica_mora_sin_pago:  boolean;
  /** Tipo de cálculo para la mora */
  mora_tipo:             FinCtaCteCargoT;
  /** Valor para calcular la mora */
  mora_valor:            number;
  /** Si la operación puede refinanciarse */
  permite_refinanciacion: boolean;
}

// ─── Operación principal ──────────────────────────────────────────────────────

export type FinCtaCteEstado =
  | 'activa'
  | 'al_dia'
  | 'incumplida'
  | 'sin_pago'
  | 'refinanciada'
  | 'cancelada'
  | 'judicial';

export interface FinCtaCteOperacion {
  id: string;
  organization_id: string;
  cliente_id: string;
  /** Snapshot del nombre para display sin join */
  cliente_nombre: string;
  sucursal_id?: string;

  // Datos de la venta de origen
  fecha_venta: string;          // YYYY-MM-DD
  comprobante: string;          // N° factura / remito
  detalle_mercaderia: string;
  monto_original: number;
  /** Saldo vivo actual — siempre recalculado por movimientos */
  saldo_actual: number;

  estado: FinCtaCteEstado;
  ultimo_pago_fecha?:      string;   // YYYY-MM-DD
  ultimo_control_periodo?: string;   // YYYY-MM

  /** Copia de reglas al momento de creación — inmutable salvo refinanciación */
  reglas: FinCtaCteReglas;

  /** Si viene de una refinanciación, id de la operación original */
  refinanciacion_origen_id?: string;

  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

// ─── Movimientos ─────────────────────────────────────────────────────────────

export type FinCtaCteMovimientoTipo =
  | 'venta_inicial'
  | 'pago_cliente'
  | 'gasto_fijo'
  | 'mora'
  | 'ajuste_manual'
  | 'refinanciacion'
  | 'cancelacion';

export interface FinCtaCteMovimiento {
  id: string;
  organization_id: string;
  operacion_id: string;

  tipo:         FinCtaCteMovimientoTipo;
  fecha:        string;   // YYYY-MM-DD
  importe:      number;   // siempre positivo
  /** Negativo = reduce saldo · Positivo = aumenta saldo */
  impacto_saldo: number;
  saldo_anterior: number;
  saldo_nuevo:    number;

  descripcion:  string;
  /** Para movimientos mensuales (mora, gasto_fijo): período YYYY-MM */
  periodo?:     string;

  // Vínculos opcionales
  asiento_id?:  string;
  caja_id?:     string;

  createdAt:  string;
  createdBy:  string;
}

// ─── Control mensual ─────────────────────────────────────────────────────────

export interface FinCtaCteControlMensual {
  id: string;
  organization_id: string;
  operacion_id: string;
  /** Período controlado en formato YYYY-MM */
  periodo: string;

  total_pagado:              number;
  entrega_minima_esperada:   number;
  cumple_minimo:             boolean;
  hubo_pago:                 boolean;

  mora_aplicada:             number;
  gasto_fijo_aplicado:       number;

  estado_resultante:         FinCtaCteEstado;
  procesado_en:              string;
  procesado_por:             string;
}

// ─── Política reutilizable ───────────────────────────────────────────────────

export interface FinCtaCtePolitica {
  id: string;
  organization_id: string;
  nombre: string;
  descripcion?: string;
  activa: boolean;
  reglas: FinCtaCteReglas;
  createdAt: string;
  createdBy: string;
}

export interface FinCtaCtePoliticaInput {
  nombre: string;
  descripcion?: string;
  activa: boolean;
  reglas: FinCtaCteReglas;
}

export interface FinCtaCteControlMasivoSummary {
  periodo: string;
  procesadas: number;
  al_dia: number;
  incumplidas: number;
  sin_pago: number;
  judicial: number;
  errores: Array<{ operacion_id: string; error: string }>;
}
