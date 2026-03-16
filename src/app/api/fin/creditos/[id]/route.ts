import { withAuth } from '@/lib/api/withAuth';
import { CreditoService } from '@/services/CreditoService';
import type { FinCreditoEstado } from '@/types/fin-credito';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

type RouteContext = {
  params: {
    id: string;
  };
};

const creditoEstadoSchema = z.enum([
  'activo',
  'cancelado',
  'en_mora',
  'refinanciado',
  'incobrable',
]);

const creditoEstadoPatchSchema = z.object({
  estado_nuevo: creditoEstadoSchema,
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
  return error instanceof ZodError;
}

function parseEstado(value: string): FinCreditoEstado {
  return value as FinCreditoEstado;
}

export const GET = withAuth<RouteContext['params']>(
  async (_request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const credito = await CreditoService.getById(
        auth.organizationId,
        context.params.id
      );

      if (!credito) {
        return NextResponse.json({ error: 'Credito no encontrado' }, { status: 404 });
      }

      const cuotas = await CreditoService.getCuotas(auth.organizationId, context.params.id);

      return NextResponse.json({ credito: { ...credito, cuotas } });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo obtener el credito' },
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

      const credito = await CreditoService.getById(
        auth.organizationId,
        context.params.id
      );

      if (!credito) {
        return NextResponse.json({ error: 'Credito no encontrado' }, { status: 404 });
      }

      const json = await request.json().catch(() => null);
      if (!json) {
        return NextResponse.json({ error: 'Body requerido' }, { status: 400 });
      }

      const body = creditoEstadoPatchSchema.parse(json);
      await CreditoService.actualizarEstado(
        auth.organizationId,
        context.params.id,
        parseEstado(body.estado_nuevo)
      );

      const actualizado = await CreditoService.getById(
        auth.organizationId,
        context.params.id
      );

      return NextResponse.json({ credito: actualizado });
    } catch (error) {
      if (isBadRequestError(error)) {
        return NextResponse.json(
          { error: getErrorMessage(error, 'Solicitud invalida') },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'No se pudo actualizar el credito' },
        { status: 500 }
      );
    }
  }
);
