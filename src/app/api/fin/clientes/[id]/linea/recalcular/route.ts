import { withAuth } from '@/lib/api/withAuth';
import { ClienteService } from '@/services/ClienteService';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: {
    id: string;
  };
};

export const POST = withAuth<RouteContext['params']>(
  async (_request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { id } = await context.params;
      const linea = await ClienteService.recalcularLineaCredito(auth.organizationId, id);

      if (!linea) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      }

      return NextResponse.json({ linea });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'No se pudo recalcular el cupo del cliente',
        },
        { status: 500 }
      );
    }
  }
);
