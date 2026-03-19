import { withAuth } from '@/lib/api/withAuth';
import { ClienteService } from '@/services/ClienteService';
import type { FinCliente } from '@/types/fin-cliente';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

type RouteContext = {
  params: {
    id: string;
  };
};

const lineaBodySchema = z.object({
  limite_credito_asignado: z
    .number()
    .finite('limite_credito_asignado invalido')
    .min(0, 'limite_credito_asignado no puede ser negativo'),
  limite_credito_vigente: z
    .number()
    .finite('limite_credito_vigente invalido')
    .min(0, 'limite_credito_vigente no puede ser negativo')
    .optional(),
  tier_crediticio: z.enum(['A', 'B', 'C', 'reprobado']).optional(),
  evaluacion_id_ultima: z.string().trim().min(1).optional(),
  evaluacion_vigente_hasta: z.string().datetime().optional(),
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

function isBadRequestError(error: unknown): boolean {
  if (error instanceof ZodError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('invalido') ||
    error.message.includes('invalida') ||
    error.message.includes('negativo') ||
    error.message.includes('superar')
  );
}

async function assignLinea(
  request: NextRequest,
  context: { params: Promise<RouteContext['params']> },
  auth: { organizationId: string | null }
) {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Body requerido' }, { status: 400 });
    }

    const parsed = lineaBodySchema.parse(body);
    const linea = await ClienteService.asignarLineaCredito(auth.organizationId, id, {
      ...parsed,
      tier_crediticio: parsed.tier_crediticio as FinCliente['tier_crediticio'],
    });

    if (!linea) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ linea });
  } catch (error) {
    if (isBadRequestError(error)) {
      return NextResponse.json(
        { error: getErrorMessage(error, 'Solicitud invalida') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'No se pudo asignar la linea de credito' },
      { status: 500 }
    );
  }
}

export const GET = withAuth<RouteContext['params']>(
  async (_request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { id } = await context.params;
      const linea = await ClienteService.obtenerLineaCredito(auth.organizationId, id);

      if (!linea) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      }

      return NextResponse.json({ linea });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo obtener la linea de credito' },
        { status: 500 }
      );
    }
  }
);

export const POST = withAuth<RouteContext['params']>(assignLinea);

export const PATCH = withAuth<RouteContext['params']>(assignLinea);
