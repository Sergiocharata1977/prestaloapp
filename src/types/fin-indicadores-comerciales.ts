export interface IndicadoresComercialesParams {
  fromMonth: string;  // YYYY-MM — mes inicial del rango
  months: number;     // 6 | 12 | 18 | 24
  tipoClienteId?: string;
  sucursalId?: string;
  planId?: string;
  politicaId?: string;
}

/** Ticket promedio mensual (capital desembolsado / # créditos ese mes) */
export interface TicketMensual {
  monthKey: string;   // YYYY-MM
  label: string;      // "Ene 2026"
  ticketPromedio: number;
  creditosCount: number;
  totalCapital: number;
}

/** Distribución de cuotas por tipo de cliente */
export interface MixTipoCliente {
  tipoClienteId: string;
  tipoClienteLabel: string;
  creditosCount: number;
  totalCapital: number;
  porcentaje: number;
}

/** Distribución por cantidad de cuotas (plazo) */
export interface MixPlazo {
  plazo: number;          // e.g. 6, 12, 24
  label: string;          // "6 cuotas"
  creditosCount: number;
  porcentaje: number;
}

export interface IndicadoresComercialesKpis {
  ticketPromedio: number;
  ticketP25: number;
  ticketP50: number;
  ticketP75: number;
  totalCreditosActivos: number;
  totalCapitalActivo: number;
}

export interface IndicadoresComercialesResponse {
  tendenciaMensual: TicketMensual[];
  mixTipoCliente: MixTipoCliente[];
  mixPlazo: MixPlazo[];
  kpis: IndicadoresComercialesKpis;
  generatedAt: string;
  params: IndicadoresComercialesParams;
}
