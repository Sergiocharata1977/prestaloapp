import { withAuth } from '@/lib/api/withAuth';
import { PlanFinanciacionService } from '@/services/PlanFinanciacionService';
import type { FinPlanFinanciacionCreateInput } from '@/types/fin-plan-financiacion';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

type RouteContext = {
  params: {
    id: string;
  };
};

const tramoSchema = z.object({
  cantidad_cuotas: z.number().int().nonnegative('cantidad_cuotas invalida'),
  tasa_mensual: z.number().finite().nonnegative('tasa_mensual invalida'),
});

const planPatchSchema = z
  .object({
    nombre: z.string().trim().min(1, 'nombre requerido').optional(),
    politica_id: z.string().trim().min(1, 'politica_id requerido').optional(),
    tramos_tasa: z
      .array(tramoSchema)
      .min(1, 'Debe informar al menos un tramo de tasa')
      .optional(),
    tasa_punitoria_mensual: z
      .number()
      .finite()
      .nonnegative('tasa_punitoria_mensual invalida')
      .optional(),
    cargo_fijo: z.number().finite().nonnegative().optional(),
    cargo_variable_pct: z.number().finite().nonnegative().optional(),
    activo: z.boolean().optional(),
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
      const plan = await PlanFinanciacionService.getById(auth.organizationId, id);

      if (!plan) {
        return NextResponse.json(
          { error: 'Plan de financiacion no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json({ plan });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo obtener el plan de financiacion' },
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

      const body = planPatchSchema.parse(json) as Partial<FinPlanFinanciacionCreateInput>;
      const plan = await PlanFinanciacionService.actualizar(auth.organizationId, id, body);

      if (!plan) {
        return NextResponse.json(
          { error: 'Plan de financiacion no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json({ plan });
    } catch (error) {
      if (error instanceof ZodError || error instanceof Error) {
        return NextResponse.json(
          { error: getErrorMessage(error, 'Solicitud invalida') },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'No se pudo actualizar el plan de financiacion' },
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
      const deleted = await PlanFinanciacionService.eliminar(auth.organizationId, id);

      if (!deleted) {
        return NextResponse.json(
          { error: 'Plan de financiacion no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo eliminar el plan de financiacion' },
        { status: 500 }
      );
    }
  }
);
