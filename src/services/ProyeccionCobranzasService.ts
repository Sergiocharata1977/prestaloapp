import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import type { FinCuota } from '@/types/fin-cuota';
import type { FinCredito } from '@/types/fin-credito';
import type { FinCliente } from '@/types/fin-cliente';
import type {
  ProyeccionAgruparPor,
  ProyeccionCobranzasColumn,
  ProyeccionCobranzasCell,
  ProyeccionCobranzasRow,
  ProyeccionCobranzasKpis,
  ProyeccionCobranzasParams,
  ProyeccionCobranzasResponse,
} from '@/types/fin-proyeccion-cobranzas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MESES_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
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

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
}

/** Batch un array de IDs en grupos de max 500 (límite Firestore getAll) */
async function batchGetDocs<T>(
  collection: FirebaseFirestore.CollectionReference,
  ids: string[],
  selectFields: string[]
): Promise<Map<string, T>> {
  const result = new Map<string, T>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 500) {
    const chunk = unique.slice(i, i + 500);
    const refs = chunk.map((id) => collection.doc(id));
    const snaps = await collection.firestore.getAll(...refs, { fieldMask: selectFields });
    for (const snap of snaps) {
      if (snap.exists) {
        result.set(snap.id, { id: snap.id, ...snap.data() } as T);
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Resolver label de agrupación
// ---------------------------------------------------------------------------

function resolveGroupKey(
  cuota: FinCuota,
  agruparPor: ProyeccionAgruparPor,
  credito: FinCredito | undefined,
  cliente: FinCliente | undefined
): { groupId: string; groupLabel: string } {
  switch (agruparPor) {
    case 'tipo_cliente': {
      const id = credito?.tipo_cliente_id ?? cliente?.tipo_cliente_id ?? 'sin_tipo';
      const label =
        credito?.tipo_cliente_snapshot?.nombre ??
        cliente?.tipo_cliente_nombre ??
        'Sin clasificar';
      return { groupId: id, groupLabel: label };
    }
    case 'cliente': {
      const id = cuota.cliente_id;
      const label = cliente?.nombre ?? cuota.cliente_id;
      return { groupId: id, groupLabel: label };
    }
    case 'clasificacion_interna': {
      const id = cliente?.clasificacion_interna ?? 'sin_clasificacion';
      const label = cliente?.clasificacion_interna ?? 'Sin clasificación';
      return { groupId: id, groupLabel: label };
    }
    case 'sucursal': {
      const id = cuota.sucursal_id ?? 'sin_sucursal';
      const label = id === 'sin_sucursal' ? 'Sin sucursal' : id;
      return { groupId: id, groupLabel: label };
    }
    case 'plan': {
      const id = credito?.plan_financiacion_id ?? 'sin_plan';
      const label = credito?.plan_snapshot?.nombre ?? 'Sin plan';
      return { groupId: id, groupLabel: label };
    }
    case 'politica': {
      const id = credito?.politica_crediticia_id ?? 'sin_politica';
      const label = credito?.politica_snapshot?.nombre ?? 'Sin política';
      return { groupId: id, groupLabel: label };
    }
    case 'sin_agrupacion':
    default:
      return { groupId: 'total', groupLabel: 'Total cartera' };
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ProyeccionCobranzasService {
  static async build(
    orgId: string,
    params: ProyeccionCobranzasParams
  ): Promise<ProyeccionCobranzasResponse> {
    const db = getAdminFirestore();

    // ── 1. Ventana temporal ────────────────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fromDate = new Date(`${params.fromMonth}-01`);
    fromDate.setHours(0, 0, 0, 0);

    // endDate = último día del último mes proyectado
    const lastMonth = addMonths(fromDate, params.months - 1);
    const endDate = endOfMonth(lastMonth);

    const todayStr = today.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    const cuotasCol = db.collection(FIN_COLLECTIONS.cuotas(orgId));

    // ── 2. Query cuotas pendientes futuras ────────────────────────────────
    let queryPendientes = cuotasCol
      .where('estado', '==', 'pendiente')
      .where('fecha_vencimiento', '>=', todayStr)
      .where('fecha_vencimiento', '<=', endDateStr);

    if (params.sucursalId) {
      queryPendientes = queryPendientes.where('sucursal_id', '==', params.sucursalId) as typeof queryPendientes;
    }
    if (params.clienteId) {
      queryPendientes = queryPendientes.where('cliente_id', '==', params.clienteId) as typeof queryPendientes;
    }

    // ── 3. Query cuotas vencidas impagas ──────────────────────────────────
    let cuotasVencidasDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    if (params.incluirVencidas) {
      let queryVencidas = cuotasCol
        .where('estado', '==', 'vencida');

      if (params.sucursalId) {
        queryVencidas = queryVencidas.where('sucursal_id', '==', params.sucursalId) as typeof queryVencidas;
      }
      if (params.clienteId) {
        queryVencidas = queryVencidas.where('cliente_id', '==', params.clienteId) as typeof queryVencidas;
      }

      const vencidasSnap = await queryVencidas.get();
      // Filtrar solo las que NO tienen cobro_id (realmente impagas)
      cuotasVencidasDocs = vencidasSnap.docs.filter((d) => !d.data().cobro_id);
    }

    const pendientesSnap = await queryPendientes.get();

    const allCuotaDocs = [...pendientesSnap.docs, ...cuotasVencidasDocs];

    if (allCuotaDocs.length === 0) {
      return this.emptyResponse(params, orgId);
    }

    const allCuotas = allCuotaDocs.map((d) => ({ id: d.id, ...d.data() } as FinCuota));

    // ── 4. Batch fetch créditos ────────────────────────────────────────────
    const creditoIds = allCuotas.map((c) => c.credito_id);
    const creditosCol = db.collection(FIN_COLLECTIONS.creditos(orgId));
    const creditosMap = await batchGetDocs<FinCredito>(creditosCol, creditoIds, [
      'estado',
      'tipo_cliente_id',
      'tipo_cliente_snapshot',
      'plan_financiacion_id',
      'plan_snapshot',
      'politica_crediticia_id',
      'politica_snapshot',
      'sucursal_id',
    ]);

    // ── 5. Batch fetch clientes ────────────────────────────────────────────
    const clienteIds = allCuotas.map((c) => c.cliente_id);
    const clientesCol = db.collection(FIN_COLLECTIONS.clientes(orgId));
    const clientesMap = await batchGetDocs<FinCliente>(clientesCol, clienteIds, [
      'nombre',
      'tipo_cliente_id',
      'tipo_cliente_nombre',
      'clasificacion_interna',
    ]);

    // ── 6. Filtrar cuotas por estado crédito y filtros secundarios ─────────
    const ESTADOS_EXCLUIDOS = new Set(['cancelado', 'incobrable']);

    const cuotasFiltradas = allCuotas.filter((cuota) => {
      const credito = creditosMap.get(cuota.credito_id);
      if (!credito) return false;
      if (ESTADOS_EXCLUIDOS.has(credito.estado)) return false;

      // filtro por tipo de cliente
      if (params.tipoClienteId) {
        const tipoId = credito.tipo_cliente_id ?? clientesMap.get(cuota.cliente_id)?.tipo_cliente_id;
        if (tipoId !== params.tipoClienteId) return false;
      }

      // filtro por clasificacion_interna
      if (params.clasificacionInterna) {
        const clasif = clientesMap.get(cuota.cliente_id)?.clasificacion_interna;
        if (clasif !== params.clasificacionInterna) return false;
      }

      // filtro por plan
      if (params.planId && credito.plan_financiacion_id !== params.planId) return false;

      // filtro por política
      if (params.politicaId && credito.politica_crediticia_id !== params.politicaId) return false;

      return true;
    });

    // ── 7. Construir columnas ──────────────────────────────────────────────
    const columns: ProyeccionCobranzasColumn[] = [];

    const tieneVencidas = params.incluirVencidas && cuotasFiltradas.some((c) => c.estado === 'vencida');
    if (tieneVencidas) {
      columns.push({ key: 'vencido', label: 'Vencido', isVencido: true });
    }

    for (let i = 0; i < params.months; i++) {
      const month = addMonths(fromDate, i);
      const key = monthKey(month);
      columns.push({ key, label: monthLabel(key) });
    }

    const columnKeys = new Set(columns.map((c) => c.key));

    // ── 8. Agrupar y acumular ──────────────────────────────────────────────
    // groupId → monthKey → { amount, count }
    const accumulator = new Map<string, Map<string, { amount: number; count: number }>>();
    const labelByGroup = new Map<string, string>();

    for (const cuota of cuotasFiltradas) {
      const credito = creditosMap.get(cuota.credito_id);
      const cliente = clientesMap.get(cuota.cliente_id);

      const { groupId, groupLabel } = resolveGroupKey(
        cuota,
        params.agruparPor,
        credito,
        cliente
      );

      labelByGroup.set(groupId, groupLabel);

      // Determinar a qué columna pertenece
      let colKey: string;
      if (cuota.estado === 'vencida') {
        colKey = 'vencido';
      } else {
        // cuota.fecha_vencimiento es YYYY-MM-DD → tomar los primeros 7 chars = YYYY-MM
        colKey = cuota.fecha_vencimiento.slice(0, 7);
      }

      if (!columnKeys.has(colKey)) continue; // fuera de ventana

      if (!accumulator.has(groupId)) {
        accumulator.set(groupId, new Map());
      }
      const groupMap = accumulator.get(groupId)!;
      const current = groupMap.get(colKey) ?? { amount: 0, count: 0 };
      groupMap.set(colKey, {
        amount: current.amount + cuota.total,
        count: current.count + 1,
      });
    }

    // ── 9. Construir rows ──────────────────────────────────────────────────
    const rows: ProyeccionCobranzasRow[] = [];

    for (const [groupId, groupMap] of accumulator.entries()) {
      const values: ProyeccionCobranzasCell[] = columns.map((col) => {
        const cell = groupMap.get(col.key) ?? { amount: 0, count: 0 };
        return {
          monthKey: col.key,
          amount: Math.round(cell.amount * 100) / 100,
          cuotasCount: cell.count,
        };
      });

      const total = values.reduce((s, v) => s + v.amount, 0);
      const cuotasTotal = values.reduce((s, v) => s + v.cuotasCount, 0);

      rows.push({
        id: groupId,
        label: labelByGroup.get(groupId) ?? groupId,
        values,
        total: Math.round(total * 100) / 100,
        cuotasTotal,
      });
    }

    // Ordenar filas por total descendente
    rows.sort((a, b) => b.total - a.total);

    // ── 10. Totals por columna ─────────────────────────────────────────────
    const totalsByMonth: Record<string, number> = {};
    for (const col of columns) {
      const sum = rows.reduce((s, row) => {
        const cell = row.values.find((v) => v.monthKey === col.key);
        return s + (cell?.amount ?? 0);
      }, 0);
      totalsByMonth[col.key] = Math.round(sum * 100) / 100;
    }

    const grandTotal = Object.values(totalsByMonth).reduce((s, v) => s + v, 0);

    // ── 11. KPIs ───────────────────────────────────────────────────────────
    const futureCols = columns.filter((c) => !c.isVencido);
    const vencidoImpago = totalsByMonth['vencido'] ?? 0;
    const totalFuturo = futureCols.reduce((s, c) => s + (totalsByMonth[c.key] ?? 0), 0);

    const proximoMesKey = futureCols[0]?.key ?? '';
    const proximoMes = totalsByMonth[proximoMesKey] ?? 0;

    const proximos3Meses = futureCols
      .slice(0, 3)
      .reduce((s, c) => s + (totalsByMonth[c.key] ?? 0), 0);

    const proximos6Meses = futureCols
      .slice(0, 6)
      .reduce((s, c) => s + (totalsByMonth[c.key] ?? 0), 0);

    const cuotasPendientes = cuotasFiltradas.filter((c) => c.estado === 'pendiente').length;
    const cuotasVencidas = cuotasFiltradas.filter((c) => c.estado === 'vencida').length;
    const clientesAlcanzados = new Set(cuotasFiltradas.map((c) => c.cliente_id)).size;
    const promedioMensual =
      futureCols.length > 0
        ? Math.round((totalFuturo / futureCols.length) * 100) / 100
        : 0;

    const kpis: ProyeccionCobranzasKpis = {
      totalFuturo: Math.round(totalFuturo * 100) / 100,
      vencidoImpago: Math.round(vencidoImpago * 100) / 100,
      proximoMes: Math.round(proximoMes * 100) / 100,
      proximos3Meses: Math.round(proximos3Meses * 100) / 100,
      proximos6Meses: Math.round(proximos6Meses * 100) / 100,
      cuotasPendientes,
      cuotasVencidas,
      clientesAlcanzados,
      promedioMensual,
    };

    return {
      columns,
      rows,
      totalsByMonth,
      grandTotal: Math.round(grandTotal * 100) / 100,
      kpis,
      generatedAt: new Date().toISOString(),
      params,
    };
  }

  // ── Respuesta vacía ──────────────────────────────────────────────────────
  private static emptyResponse(
    params: ProyeccionCobranzasParams,
    _orgId: string
  ): ProyeccionCobranzasResponse {
    const fromDate = new Date(`${params.fromMonth}-01`);
    const columns: ProyeccionCobranzasColumn[] = [];
    for (let i = 0; i < params.months; i++) {
      const month = addMonths(fromDate, i);
      const key = monthKey(month);
      columns.push({ key, label: monthLabel(key) });
    }
    const totalsByMonth: Record<string, number> = {};
    for (const col of columns) totalsByMonth[col.key] = 0;

    return {
      columns,
      rows: [],
      totalsByMonth,
      grandTotal: 0,
      kpis: {
        totalFuturo: 0,
        vencidoImpago: 0,
        proximoMes: 0,
        proximos3Meses: 0,
        proximos6Meses: 0,
        cuotasPendientes: 0,
        cuotasVencidas: 0,
        clientesAlcanzados: 0,
        promedioMensual: 0,
      },
      generatedAt: new Date().toISOString(),
      params,
    };
  }
}
