import { withAuth } from '@/lib/api/withAuth';
import { ChequeService } from '@/services/ChequeService';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

type RouteContext = {
  params: {
    id: string;
  };
};

const chequeEstadoSchema = z.enum([
  'recibido',
  'en_cartera',
  'depositado',
  'acreditado',
  'rechazado',
  'pre_judicial',
  'judicial',
]);

const patchSchema = z.object({
  estado_nuevo: chequeEstadoSchema,
  motivo: z.string().trim().optional(),
  observaciones: z.string().trim().optional(),
  gastos_rechazo: z
    .array(
      z.object({
        concepto: z.string().trim().min(1, 'concepto requerido'),
        importe: z.number().finite().min(0, 'importe invalido'),
      })
    )
    .optional(),
});

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

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
      const cheque = await ChequeService.cambiarEstadoCheque(auth.organizationId, id, {
        estado: body.estado_nuevo,
        motivo: body.motivo,
        observaciones: body.observaciones,
        gastos_rechazo: body.gastos_rechazo,
        usuario: {
          id: auth.user.uid,
          nombre: auth.user.name ?? auth.user.email ?? auth.user.uid,
        },
      });

      if (!cheque) {
        return NextResponse.json({ error: 'Cheque no encontrado' }, { status: 404 });
      }

      return NextResponse.json({ cheque });
    } catch (error) {
      if (error instanceof ZodError || error instanceof Error) {
        return NextResponse.json(
          { error: getErrorMessage(error, 'Solicitud invalida') },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'No se pudo actualizar el estado del cheque' },
        { status: 500 }
      );
    }
  }
);
