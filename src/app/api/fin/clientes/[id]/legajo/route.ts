import { withAuth } from '@/lib/api/withAuth';
import { LegajoService } from '@/services/LegajoService';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: {
    id: string;
  };
};

export const GET = withAuth<RouteContext['params']>(
  async (_request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { id } = await context.params;
      const legajo = await LegajoService.getDetalle(
        auth.organizationId,
        id,
        auth.user.uid
      );

      return NextResponse.json({ legajo });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : 'No se pudo obtener el legajo',
        },
        { status: 500 }
      );
    }
  }
);

export const POST = withAuth<RouteContext['params']>(
  async (_request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { id } = await context.params;
      const legajo = await LegajoService.getOrCreate(
        auth.organizationId,
        id,
        auth.user.uid
      );

      return NextResponse.json({ legajo }, { status: 201 });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : 'No se pudo crear el legajo',
        },
        { status: 500 }
      );
    }
  }
);
