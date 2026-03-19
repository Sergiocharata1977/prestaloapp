import { withAuth } from '@/lib/api/withAuth';
import { TipoClienteService } from '@/services/TipoClienteService';
import type { FinTipoClienteCreateInput } from '@/types/fin-tipo-cliente';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

type RouteContext = {
  params: {
    id: string;
  };
};

const tipoClientePatchSchema = z
  .object({
    codigo: z.string().trim().min(1, 'codigo requerido').optional(),
    nombre: z.string().trim().min(1, 'nombre requerido').optional(),
    descripcion: z.string().trim().optional(),
    tipo_base: z.enum(['persona', 'empresa']).optional(),
    activo: z.boolean().optional(),
    requiere_legajo: z.boolean().optional(),
    requiere_evaluacion_vigente: z.boolean().optional(),
    permite_cheques_propios: z.boolean().optional(),
    permite_cheques_terceros: z.boolean().optional(),
    limite_mensual: z.number().finite().nonnegative().optional(),
    limite_total: z.number().finite().nonnegative().optional(),
    tier_minimo_requerido: z.enum(['A', 'B', 'C', 'D', 'E']).optional(),
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
      const tipoCliente = await TipoClienteService.getById(auth.organizationId, id);

      if (!tipoCliente) {
        return NextResponse.json(
          { error: 'Tipo de cliente no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json({ tipoCliente });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo obtener el tipo de cliente' },
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

      const body = tipoClientePatchSchema.parse(json) as Partial<FinTipoClienteCreateInput>;
      const tipoCliente = await TipoClienteService.actualizar(
        auth.organizationId,
        id,
        body
      );

      if (!tipoCliente) {
        return NextResponse.json(
          { error: 'Tipo de cliente no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json({ tipoCliente });
    } catch (error) {
      if (error instanceof ZodError || error instanceof Error) {
        return NextResponse.json(
          { error: getErrorMessage(error, 'Solicitud invalida') },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'No se pudo actualizar el tipo de cliente' },
        { status: 500 }
      );
    }
  }
);

export const DELETE = withAuth<RouteContext['params']>(
  async (_request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { id } = await context.params;
      const deleted = await TipoClienteService.eliminar(auth.organizationId, id);

      if (!deleted) {
        return NextResponse.json(
          { error: 'Tipo de cliente no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo eliminar el tipo de cliente' },
        { status: 500 }
      );
    }
  }
);
