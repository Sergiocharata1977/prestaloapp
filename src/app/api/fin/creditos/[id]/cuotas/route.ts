import { withAuth } from '@/lib/api/withAuth';
import { CreditoService } from '@/services/CreditoService';
import type { FinCuotaEstado } from '@/types/fin-cuota';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

type RouteContext = {
  params: {
    id: string;
  };
};

const cuotaEstadoSchema = z.enum(['pendiente', 'pagada', 'vencida']);

function parseEstado(value: string | null): FinCuotaEstado | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = cuotaEstadoSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export const GET = withAuth<RouteContext['params']>(
  async (request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { id } = await context.params;
      const credito = await CreditoService.getById(auth.organizationId, id);

      if (!credito) {
        return NextResponse.json({ error: 'Credito no encontrado' }, { status: 404 });
      }

      const estado = parseEstado(request.nextUrl.searchParams.get('estado'));
      const cuotas = await CreditoService.getCuotas(auth.organizationId, id, estado);

      return NextResponse.json({ cuotas });
    } catch {
      return NextResponse.json(
        { error: 'No se pudieron obtener las cuotas' },
        { status: 500 }
      );
    }
  }
);
