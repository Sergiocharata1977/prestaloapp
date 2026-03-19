import { withAuth } from '@/lib/api/withAuth';
import { PlanFinanciacionService } from '@/services/PlanFinanciacionService';
import type { FinPlanFinanciacionCreateInput } from '@/types/fin-plan-financiacion';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

const tramoSchema = z.object({
  cantidad_cuotas: z.number().int().nonnegative('cantidad_cuotas invalida'),
  tasa_mensual: z.number().finite().nonnegative('tasa_mensual invalida'),
});

const planSchema = z.object({
  nombre: z.string().trim().min(1, 'nombre requerido'),
  politica_id: z.string().trim().min(1, 'politica_id requerido'),
  tramos_tasa: z.array(tramoSchema).min(1, 'Debe informar al menos un tramo de tasa'),
  tasa_punitoria_mensual: z
    .number()
    .finite()
    .nonnegative('tasa_punitoria_mensual invalida'),
  cargo_fijo: z.number().finite().nonnegative().optional(),
  cargo_variable_pct: z.number().finite().nonnegative().optional(),
  activo: z.boolean(),
});

function parseBooleanFilter(value: string | null): boolean | undefined {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const politicaId = searchParams.get('politicaId')?.trim() || undefined;
    const tipoClienteId = searchParams.get('tipoClienteId')?.trim() || undefined;
    const activo = parseBooleanFilter(searchParams.get('activo'));

    const planes = await PlanFinanciacionService.list(auth.organizationId, {
      politica_id: politicaId,
      tipo_cliente_id: tipoClienteId,
      activo,
    });

    return NextResponse.json({ planes });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener la lista de planes de financiacion' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json({ error: 'Body requerido' }, { status: 400 });
    }

    const body = planSchema.parse(json) as FinPlanFinanciacionCreateInput;
    const plan = await PlanFinanciacionService.crear(auth.organizationId, body);

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError || error instanceof Error) {
      return NextResponse.json(
        { error: getErrorMessage(error, 'Solicitud invalida') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'No se pudo crear el plan de financiacion' },
      { status: 500 }
    );
  }
});
