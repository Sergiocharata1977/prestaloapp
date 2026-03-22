import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import type { FinCredito } from '@/types/fin-credito';
import type {
  IndicadoresComercialesParams,
  IndicadoresComercialesResponse,
  IndicadoresComercialesKpis,
  MixPlazo,
  MixTipoCliente,
  TicketMensual,
} from '@/types/fin-indicadores-comerciales';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MESES_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function monthKey(dateStr: string): string {
  // dateStr = YYYY-MM-DD
  return dateStr.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MESES_ES[parseInt(m, 10) - 1]} ${y}`;
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

/** Percentil (0-100) de un array de números ya ordenado */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class IndicadoresComercialesService {
  static async build(
    orgId: string,
    params: IndicadoresComercialesParams
  ): Promise<IndicadoresComercialesResponse> {
    const db = getAdminFirestore();

    // ── 1. Ventana temporal ─────────────────────────────────────────────────
    const fromDate = new Date(`${params.fromMonth}-01`);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = addMonths(fromDate, params.months);
    const fromStr = fromDate.toISOString().slice(0, 10);
    const toStr = toDate.toISOString().slice(0, 10);

    // ── 2. Query créditos otorgados en la ventana ───────────────────────────
    const creditosCol = db.collection(FIN_COLLECTIONS.creditos(orgId));

    let query = creditosCol
      .where('fecha_otorgamiento', '>=', fromStr)
      .where('fecha_otorgamiento', '<', toStr);

    if (params.sucursalId) {
      query = query.where('sucursal_id', '==', params.sucursalId) as typeof query;
    }
    if (params.tipoClienteId) {
      query = query.where('tipo_cliente_id', '==', params.tipoClienteId) as typeof query;
    }
    if (params.planId) {
      query = query.where('plan_financiacion_id', '==', params.planId) as typeof query;
    }
    if (params.politicaId) {
      query = query.where('politica_crediticia_id', '==', params.politicaId) as typeof query;
    }

    const snap = await query.get();

    // Excluir cancelados e incobrables
    const EXCLUIDOS = new Set(['cancelado', 'incobrable']);
    const creditos: FinCredito[] = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as FinCredito))
      .filter((c) => !EXCLUIDOS.has(c.estado));

    // ── 3. KPIs globales ────────────────────────────────────────────────────
    const capitals = creditos.map((c) => c.capital).sort((a, b) => a - b);
    const totalCapital = capitals.reduce((s, v) => s + v, 0);
    const kpis: IndicadoresComercialesKpis = {
      ticketPromedio: creditos.length > 0 ? Math.round((totalCapital / creditos.length) * 100) / 100 : 0,
      ticketP25: Math.round(percentile(capitals, 25) * 100) / 100,
      ticketP50: Math.round(percentile(capitals, 50) * 100) / 100,
      ticketP75: Math.round(percentile(capitals, 75) * 100) / 100,
      totalCreditosActivos: creditos.length,
      totalCapitalActivo: Math.round(totalCapital * 100) / 100,
    };

    // ── 4. Tendencia mensual de ticket ──────────────────────────────────────
    // Construir columnas de meses en la ventana
    const monthKeys: string[] = [];
    for (let i = 0; i < params.months; i++) {
      const month = addMonths(fromDate, i);
      const y = month.getFullYear();
      const m = String(month.getMonth() + 1).padStart(2, '0');
      monthKeys.push(`${y}-${m}`);
    }

    const byMonth = new Map<string, { count: number; total: number }>();
    for (const mk of monthKeys) {
      byMonth.set(mk, { count: 0, total: 0 });
    }
    for (const c of creditos) {
      const mk = monthKey(c.fecha_otorgamiento);
      const cell = byMonth.get(mk);
      if (cell) {
        cell.count += 1;
        cell.total += c.capital;
      }
    }

    const tendenciaMensual: TicketMensual[] = monthKeys.map((mk) => {
      const cell = byMonth.get(mk) ?? { count: 0, total: 0 };
      return {
        monthKey: mk,
        label: monthLabel(mk),
        creditosCount: cell.count,
        totalCapital: Math.round(cell.total * 100) / 100,
        ticketPromedio: cell.count > 0 ? Math.round((cell.total / cell.count) * 100) / 100 : 0,
      };
    });

    // ── 5. Mix por tipo de cliente ──────────────────────────────────────────
    const byTipo = new Map<string, { label: string; count: number; total: number }>();
    for (const c of creditos) {
      const tipoId = c.tipo_cliente_id ?? 'sin_tipo';
      const tipoLabel =
        c.tipo_cliente_snapshot?.nombre ?? 'Sin clasificar';
      const existing = byTipo.get(tipoId) ?? { label: tipoLabel, count: 0, total: 0 };
      existing.count += 1;
      existing.total += c.capital;
      byTipo.set(tipoId, existing);
    }

    const totalCreditosMix = creditos.length;
    const mixTipoCliente: MixTipoCliente[] = Array.from(byTipo.entries())
      .map(([tipoClienteId, { label, count, total }]) => ({
        tipoClienteId,
        tipoClienteLabel: label,
        creditosCount: count,
        totalCapital: Math.round(total * 100) / 100,
        porcentaje: totalCreditosMix > 0 ? Math.round((count / totalCreditosMix) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.creditosCount - a.creditosCount);

    // ── 6. Mix por plazo ────────────────────────────────────────────────────
    const byPlazo = new Map<number, number>();
    for (const c of creditos) {
      byPlazo.set(c.cantidad_cuotas, (byPlazo.get(c.cantidad_cuotas) ?? 0) + 1);
    }

    const mixPlazo: MixPlazo[] = Array.from(byPlazo.entries())
      .map(([plazo, count]) => ({
        plazo,
        label: `${plazo} ${plazo === 1 ? 'cuota' : 'cuotas'}`,
        creditosCount: count,
        porcentaje: totalCreditosMix > 0 ? Math.round((count / totalCreditosMix) * 10000) / 100 : 0,
      }))
      .sort((a, b) => a.plazo - b.plazo);

    return {
      tendenciaMensual,
      mixTipoCliente,
      mixPlazo,
      kpis,
      generatedAt: new Date().toISOString(),
      params,
    };
  }
}
