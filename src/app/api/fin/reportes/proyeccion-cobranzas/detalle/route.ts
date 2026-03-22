import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import type { FinCuota } from '@/types/fin-cuota';
import type { FinCredito } from '@/types/fin-credito';
import type { FinCliente } from '@/types/fin-cliente';
import type {
  ProyeccionAgruparPor,
  ProyeccionDetalleCuota,
  ProyeccionDetalleResponse,
} from '@/types/fin-proyeccion-cobranzas';

export const dynamic = 'force-dynamic';

const VALID_AGRUPAR: ProyeccionAgruparPor[] = [
  'tipo_cliente', 'cliente', 'clasificacion_interna',
  'sucursal', 'plan', 'politica', 'sin_agrupacion',
];

const ESTADOS_EXCLUIDOS = new Set(['cancelado', 'incobrable']);

async function batchGet<T>(
  col: FirebaseFirestore.CollectionReference,
  ids: string[],
  fields: string[]
): Promise<Map<string, T>> {
  const result = new Map<string, T>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 500) {
    const refs = unique.slice(i, i + 500).map((id) => col.doc(id));
    const snaps = await col.firestore.getAll(...refs, { fieldMask: fields });
    for (const s of snaps) {
      if (s.exists) result.set(s.id, { id: s.id, ...s.data() } as T);
    }
  }
  return result;
}

export const GET = withAuth(async (req, _ctx, { organizationId }) => {
  if (!organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;

  const groupId = sp.get('groupId') ?? '';
  const monthKey = sp.get('monthKey') ?? '';
  const groupLabel = sp.get('groupLabel') ?? groupId;
  const agruparPorRaw = sp.get('agruparPor') ?? 'tipo_cliente';
  const agruparPor: ProyeccionAgruparPor = VALID_AGRUPAR.includes(agruparPorRaw as ProyeccionAgruparPor)
    ? (agruparPorRaw as ProyeccionAgruparPor)
    : 'tipo_cliente';

  if (!groupId || !monthKey) {
    return NextResponse.json({ error: 'groupId y monthKey son requeridos' }, { status: 400 });
  }

  const db = getAdminFirestore();
  const cuotasCol = db.collection(FIN_COLLECTIONS.cuotas(organizationId));
  const today = new Date().toISOString().slice(0, 10);

  // ── Query cuotas según monthKey ──
  let cuotasDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  if (monthKey === 'vencido') {
    const snap = await cuotasCol
      .where('estado', '==', 'vencida')
      .get();
    cuotasDocs = snap.docs.filter((d) => !d.data().cobro_id);
  } else {
    // monthKey = "YYYY-MM" → rango de días del mes
    const [y, m] = monthKey.split('-');
    const from = `${y}-${m}-01`;
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    const to = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

    const snap = await cuotasCol
      .where('estado', '==', 'pendiente')
      .where('fecha_vencimiento', '>=', from)
      .where('fecha_vencimiento', '<=', to)
      .get();
    cuotasDocs = snap.docs;
  }

  if (cuotasDocs.length === 0) {
    return NextResponse.json({ cuotas: [], total: 0, monthKey, groupLabel });
  }

  const allCuotas = cuotasDocs.map((d) => ({ id: d.id, ...d.data() } as FinCuota));

  // ── Batch fetch créditos ──
  const creditoIds = allCuotas.map((c) => c.credito_id);
  const creditosCol = db.collection(FIN_COLLECTIONS.creditos(organizationId));
  const creditosMap = await batchGet<FinCredito>(creditosCol, creditoIds, [
    'estado', 'tipo_cliente_id', 'tipo_cliente_snapshot',
    'plan_financiacion_id', 'plan_snapshot',
    'politica_crediticia_id', 'politica_snapshot',
    'sucursal_id',
  ]);

  // ── Batch fetch clientes ──
  const clienteIds = allCuotas.map((c) => c.cliente_id);
  const clientesCol = db.collection(FIN_COLLECTIONS.clientes(organizationId));
  const clientesMap = await batchGet<FinCliente>(clientesCol, clienteIds, [
    'nombre', 'cuit', 'tipo_cliente_id', 'tipo_cliente_nombre', 'clasificacion_interna',
  ]);

  // ── Filtrar por grupo y estado crédito ──
  const filtered = allCuotas.filter((cuota) => {
    const credito = creditosMap.get(cuota.credito_id);
    if (!credito) return false;
    if (ESTADOS_EXCLUIDOS.has(credito.estado)) return false;

    if (agruparPor === 'sin_agrupacion') return true;

    const cliente = clientesMap.get(cuota.cliente_id);

    switch (agruparPor) {
      case 'tipo_cliente': {
        const id = credito.tipo_cliente_id ?? cliente?.tipo_cliente_id ?? 'sin_tipo';
        return id === groupId;
      }
      case 'cliente':
        return cuota.cliente_id === groupId;
      case 'clasificacion_interna': {
        const clasif = cliente?.clasificacion_interna ?? 'sin_clasificacion';
        return clasif === groupId;
      }
      case 'sucursal': {
        const suc = cuota.sucursal_id ?? 'sin_sucursal';
        return suc === groupId;
      }
      case 'plan':
        return (credito.plan_financiacion_id ?? 'sin_plan') === groupId;
      case 'politica':
        return (credito.politica_crediticia_id ?? 'sin_politica') === groupId;
      default:
        return true;
    }
  });

  // ── Construir respuesta ──
  const cuotas: ProyeccionDetalleCuota[] = filtered.map((cuota) => {
    const cliente = clientesMap.get(cuota.cliente_id);
    let diasMora: number | null = null;
    if (cuota.estado === 'vencida' && cuota.fecha_vencimiento) {
      const venc = new Date(cuota.fecha_vencimiento);
      const diff = new Date(today).getTime() - venc.getTime();
      diasMora = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    }
    return {
      cuotaId: cuota.id,
      clienteId: cuota.cliente_id,
      clienteNombre: cliente?.nombre ?? cuota.cliente_id,
      cuit: cliente?.cuit ?? '',
      creditoId: cuota.credito_id,
      numeroCuota: cuota.numero_cuota,
      fechaVencimiento: cuota.fecha_vencimiento,
      capital: cuota.capital,
      interes: cuota.interes,
      total: cuota.total,
      estado: cuota.estado as 'pendiente' | 'vencida',
      diasMora,
    };
  });

  // Ordenar por fecha vencimiento, luego cliente
  cuotas.sort((a, b) => {
    const dateCompare = a.fechaVencimiento.localeCompare(b.fechaVencimiento);
    if (dateCompare !== 0) return dateCompare;
    return a.clienteNombre.localeCompare(b.clienteNombre);
  });

  const total = cuotas.reduce((s, c) => s + c.total, 0);

  return NextResponse.json({
    cuotas,
    total: Math.round(total * 100) / 100,
    monthKey,
    groupLabel,
  } satisfies ProyeccionDetalleResponse);
});
