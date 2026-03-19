import { withAuth } from '@/lib/api/withAuth';
import { OperacionChequeService } from '@/services/OperacionChequeService';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

type RouteContext = {
  params: {
    id: string;
  };
};

const patchSchema = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('confirmar_liquidacion'),
    sucursal_id: z.string().trim().min(1, 'sucursal_id requerido'),
    caja_id: z.string().trim().min(1, 'caja_id requerido'),
  }),
  z.object({
    accion: z.literal('anular'),
  }),
]);

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export const GET = withAuth<RouteContext['params']>(
  async (_request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { id } = await context.params;
      const operacion = await OperacionChequeService.getDetalle(auth.organizationId, id);

      if (!operacion) {
        return NextResponse.json(
          { error: 'Operacion de cheque no encontrada' },
          { status: 404 }
        );
      }

      return NextResponse.json({ operacion });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo obtener la operacion de cheque' },
        { status: 500 }
      );
    }
  }
);

export const PATCH = withAuth<RouteContext['params']>(
  async (request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { id } = await context.params;
      const json = await request.json().catch(() => null);
      if (!json) {
        return NextResponse.json({ error: 'Body requerido' }, { status: 400 });
      }

      const body = patchSchema.parse(json);

      if (body.accion === 'confirmar_liquidacion') {
        const operacion = await OperacionChequeService.confirmarLiquidacion(
          auth.organizationId,
          id,
          body.sucursal_id,
          body.caja_id,
          auth.user.uid,
          auth.user.name ?? auth.user.email ?? auth.user.uid
        );

        if (!operacion) {
          return NextResponse.json(
            { error: 'Operacion de cheque no encontrada' },
            { status: 404 }
          );
        }

        return NextResponse.json({ operacion });
      }

      return NextResponse.json({ error: 'Accion no soportada' }, { status: 400 });
    } catch (error) {
      if (error instanceof ZodError || error instanceof Error) {
        return NextResponse.json(
          { error: getErrorMessage(error, 'Solicitud invalida') },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'No se pudo actualizar la operacion de cheque' },
        { status: 500 }
      );
    }
  }
);
