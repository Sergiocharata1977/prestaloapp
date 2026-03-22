import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { ProyeccionCobranzasService } from '@/services/ProyeccionCobranzasService';
import type { ProyeccionAgruparPor, ProyeccionCobranzasParams } from '@/types/fin-proyeccion-cobranzas';

export const dynamic = 'force-dynamic';

const VALID_AGRUPAR: ProyeccionAgruparPor[] = [
  'tipo_cliente',
  'cliente',
  'clasificacion_interna',
  'sucursal',
  'plan',
  'politica',
  'sin_agrupacion',
];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const GET = withAuth(async (req, _ctx, { organizationId }) => {
  if (!organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;

  // fromMonth: YYYY-MM, default = mes actual
  const fromMonthRaw = sp.get('fromMonth')?.trim() ?? '';
  const fromMonth = /^\d{4}-\d{2}$/.test(fromMonthRaw) ? fromMonthRaw : currentMonth();

  // months: 6 | 12 | 18 | 24, default = 12
  const monthsRaw = parseInt(sp.get('months') ?? '12', 10);
  const months = [6, 12, 18, 24].includes(monthsRaw) ? monthsRaw : 12;

  // agruparPor
  const agruparPorRaw = sp.get('agruparPor') ?? 'tipo_cliente';
  const agruparPor: ProyeccionAgruparPor = VALID_AGRUPAR.includes(agruparPorRaw as ProyeccionAgruparPor)
    ? (agruparPorRaw as ProyeccionAgruparPor)
    : 'tipo_cliente';

  // incluirVencidas
  const incluirVencidas = sp.get('incluirVencidas') !== 'false';

  const params: ProyeccionCobranzasParams = {
    fromMonth,
    months,
    agruparPor,
    incluirVencidas,
    clienteId: sp.get('clienteId') ?? undefined,
    tipoClienteId: sp.get('tipoClienteId') ?? undefined,
    clasificacionInterna: sp.get('clasificacionInterna') ?? undefined,
    sucursalId: sp.get('sucursalId') ?? undefined,
    planId: sp.get('planId') ?? undefined,
    politicaId: sp.get('politicaId') ?? undefined,
  };

  try {
    const resultado = await ProyeccionCobranzasService.build(organizationId, params);
    return NextResponse.json(resultado);
  } catch (err) {
    console.error('[proyeccion-cobranzas]', err);
    return NextResponse.json(
      { error: 'Error al calcular proyección de cobranzas' },
      { status: 500 }
    );
  }
});
