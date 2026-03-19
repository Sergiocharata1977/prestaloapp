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

const patchSchema = z
  .object({
    numero: z.string().trim().min(1).optional(),
    banco: z.string().trim().min(1).optional(),
    titular: z.string().trim().min(1).optional(),
    fecha_emision: z.iso.date().optional(),
    fecha_pago: z.iso.date().optional(),
    importe: z.number().finite().positive().optional(),
    moneda: z.string().trim().min(1).optional(),
    observaciones: z.string().trim().optional(),
    estado: chequeEstadoSchema.optional(),
    motivo: z.string().trim().optional(),
    gastos_rechazo: z
      .array(
        z.object({
          concepto: z.string().trim().min(1, 'concepto requerido'),
          importe: z.number().finite().min(0, 'importe invalido'),
        })
      )
      .optional(),
  })
  .refine(body => Object.keys(body).length > 0, 'Body requerido');

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
      const cheque = await ChequeService.getChequeById(auth.organizationId, id);

      if (!cheque) {
        return NextResponse.json({ error: 'Cheque no encontrado' }, { status: 404 });
      }

      return NextResponse.json({ cheque });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo obtener el cheque' },
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
      const actor = {
        id: auth.user.uid,
        nombre: auth.user.name ?? auth.user.email ?? auth.user.uid,
      };
      const cheque = body.estado
        ? await ChequeService.cambiarEstadoCheque(auth.organizationId, id, {
            estado: body.estado,
            motivo: body.motivo,
            observaciones: body.observaciones,
            gastos_rechazo: body.gastos_rechazo,
            usuario: actor,
          })
        : await ChequeService.updateCheque(auth.organizationId, id, body);

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
        { error: 'No se pudo actualizar el cheque' },
        { status: 500 }
      );
    }
  }
);
