export type ProyeccionAgruparPor =
  | 'tipo_cliente'
  | 'cliente'
  | 'clasificacion_interna'
  | 'sucursal'
  | 'plan'
  | 'politica'
  | 'sin_agrupacion';

export interface ProyeccionCobranzasParams {
  fromMonth: string;           // YYYY-MM
  months: number;              // 6 | 12 | 18 | 24
  agruparPor: ProyeccionAgruparPor;
  incluirVencidas: boolean;
  // filtros opcionales
  clienteId?: string;
  tipoClienteId?: string;
  clasificacionInterna?: string;
  sucursalId?: string;
  planId?: string;
  politicaId?: string;
}

export interface ProyeccionCobranzasColumn {
  key: string;        // "vencido" | "2026-04" | "2026-05" ...
  label: string;      // "Vencido" | "Abr 2026" | "May 2026" ...
  isVencido?: boolean;
}

export interface ProyeccionCobranzasCell {
  monthKey: string;
  amount: number;
  cuotasCount: number;
}

export interface ProyeccionCobranzasRow {
  id: string;
  label: string;
  values: ProyeccionCobranzasCell[];
  total: number;
  cuotasTotal: number;
}

export interface ProyeccionCobranzasKpis {
  totalFuturo: number;
  vencidoImpago: number;
  proximoMes: number;
  proximos3Meses: number;
  proximos6Meses: number;
  cuotasPendientes: number;
  cuotasVencidas: number;
  clientesAlcanzados: number;
  promedioMensual: number;
}

export interface ProyeccionCobranzasResponse {
  columns: ProyeccionCobranzasColumn[];
  rows: ProyeccionCobranzasRow[];
  totalsByMonth: Record<string, number>;
  grandTotal: number;
  kpis: ProyeccionCobranzasKpis;
  generatedAt: string;
  params: ProyeccionCobranzasParams;
}
