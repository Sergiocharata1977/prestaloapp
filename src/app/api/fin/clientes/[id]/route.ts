import { withAuth } from '@/lib/api/withAuth';
import { ClienteService } from '@/services/ClienteService';
import type { FinClienteCreateInput } from '@/types/fin-cliente';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: {
    id: string;
  };
};

function isBadRequestError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('requerido') ||
    error.message.includes('Ya existe') ||
    error.message.includes('invalido') ||
    error.message.includes('inválido')
  );
}

export const GET = withAuth<RouteContext['params']>(
  async (_request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const cliente = await ClienteService.getById(
        auth.organizationId,
        context.params.id
      );

      if (!cliente) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      }

      return NextResponse.json({ cliente });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo obtener el cliente' },
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

      const body = (await request.json().catch(() => null)) as
        | Partial<FinClienteCreateInput>
        | null;

      if (!body || Object.keys(body).length === 0) {
        return NextResponse.json({ error: 'Body requerido' }, { status: 400 });
      }

      const cliente = await ClienteService.actualizar(
        auth.organizationId,
        context.params.id,
        body
      );

      if (!cliente) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      }

      return NextResponse.json({ cliente });
    } catch (error) {
      if (isBadRequestError(error)) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Solicitud invalida' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'No se pudo actualizar el cliente' },
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

      const deleted = await ClienteService.eliminar(
        auth.organizationId,
        context.params.id
      );

      if (!deleted) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      }

      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo eliminar el cliente' },
        { status: 500 }
      );
    }
  }
);
