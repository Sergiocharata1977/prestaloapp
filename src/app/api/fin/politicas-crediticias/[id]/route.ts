import { withAuth } from '@/lib/api/withAuth';
import { PoliticaCrediticiaService } from '@/services/PoliticaCrediticiaService';
import type { FinPoliticaCrediticiaCreateInput } from '@/types/fin-politica-crediticia';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

type RouteContext = {
  params: {
    id: string;
  };
};

const politicaTierSchema = z.object({
  tier: z.enum(['A', 'B', 'C', 'D', 'E']),
  limite_mensual: z.number().finite().nonnegative().optional(),
  limite_total: z.number().finite().nonnegative().optional(),
  requiere_garantia: z.boolean().optional(),
  monto_maximo_otorgamiento: z.number().finite().nonnegative().optional(),
});

const politicaPatchSchema = z
  .object({
    nombre: z.string().trim().min(1, 'nombre requerido').optional(),
    codigo: z.string().trim().min(1, 'codigo requerido').optional(),
    descripcion: z.string().trim().optional(),
    tipo_cliente_id: z.string().trim().min(1, 'tipo_cliente_id requerido').optional(),
    tipo_operacion: z
      .enum(['consumo', 'empresa', 'cheque_propio', 'cheque_terceros'])
      .optional(),
    activo: z.boolean().optional(),
    requiere_legajo: z.boolean().optional(),
    requiere_evaluacion_vigente: z.boolean().optional(),
    permite_cheques_propios: z.boolean().optional(),
    permite_cheques_terceros: z.boolean().optional(),
    dias_vigencia_evaluacion: z.number().int().positive().optional(),
    monto_minimo: z.number().finite().nonnegative().optional(),
    monto_maximo: z.number().finite().nonnegative().optional(),
    limite_mensual: z.number().finite().nonnegative().optional(),
    limite_total: z.number().finite().nonnegative().optional(),
    tiers: z.array(politicaTierSchema).optional(),
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
      const politica = await PoliticaCrediticiaService.getById(auth.organizationId, id);

      if (!politica) {
        return NextResponse.json(
          { error: 'Politica crediticia no encontrada' },
          { status: 404 }
        );
      }

      return NextResponse.json({ politica });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo obtener la politica crediticia' },
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

      const body = politicaPatchSchema.parse(json) as Partial<FinPoliticaCrediticiaCreateInput>;
      const politica = await PoliticaCrediticiaService.actualizar(
        auth.organizationId,
        id,
        body
      );

      if (!politica) {
        return NextResponse.json(
          { error: 'Politica crediticia no encontrada' },
          { status: 404 }
        );
      }

      return NextResponse.json({ politica });
    } catch (error) {
      if (error instanceof ZodError || error instanceof Error) {
        return NextResponse.json(
          { error: getErrorMessage(error, 'Solicitud invalida') },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'No se pudo actualizar la politica crediticia' },
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
      const deleted = await PoliticaCrediticiaService.eliminar(auth.organizationId, id);

      if (!deleted) {
        return NextResponse.json(
          { error: 'Politica crediticia no encontrada' },
          { status: 404 }
        );
      }

      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo eliminar la politica crediticia' },
        { status: 500 }
      );
    }
  }
);
