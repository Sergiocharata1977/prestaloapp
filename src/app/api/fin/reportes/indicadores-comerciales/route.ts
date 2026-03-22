import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { IndicadoresComercialesService } from '@/services/IndicadoresComercialesService';
import type { IndicadoresComercialesParams } from '@/types/fin-indicadores-comerciales';

export const dynamic = 'force-dynamic';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const GET = withAuth(async (req, _ctx, { organizationId }) => {
  if (!organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;

  const fromMonthRaw = sp.get('fromMonth')?.trim() ?? '';
  const fromMonth = /^\d{4}-\d{2}$/.test(fromMonthRaw) ? fromMonthRaw : currentMonth();

  const monthsRaw = parseInt(sp.get('months') ?? '12', 10);
  const months = [6, 12, 18, 24].includes(monthsRaw) ? monthsRaw : 12;

  const params: IndicadoresComercialesParams = {
    fromMonth,
    months,
    tipoClienteId: sp.get('tipoClienteId') ?? undefined,
    sucursalId: sp.get('sucursalId') ?? undefined,
    planId: sp.get('planId') ?? undefined,
    politicaId: sp.get('politicaId') ?? undefined,
  };

  try {
    const resultado = await IndicadoresComercialesService.build(organizationId, params);
    return NextResponse.json(resultado);
  } catch (err) {
    console.error('[indicadores-comerciales]', err);
    return NextResponse.json(
      { error: 'Error al calcular indicadores comerciales' },
      { status: 500 }
    );
  }
});
