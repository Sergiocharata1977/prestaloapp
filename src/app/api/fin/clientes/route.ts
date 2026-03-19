import { withAuth } from '@/lib/api/withAuth';
import { ClienteService } from '@/services/ClienteService';
import type { FinClienteCreateInput } from '@/types/fin-cliente';
import { NextRequest, NextResponse } from 'next/server';

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

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const query = request.nextUrl.searchParams.get('q')?.trim();
    const tipoClienteId = request.nextUrl.searchParams.get('tipoClienteId')?.trim() || undefined;
    const clientes = query
      ? await ClienteService.buscar(auth.organizationId, query)
      : await ClienteService.list(auth.organizationId, 50, { tipoClienteId });

    return NextResponse.json({ clientes });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener la lista de clientes' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as
      | FinClienteCreateInput
      | null;

    if (!body) {
      return NextResponse.json({ error: 'Body requerido' }, { status: 400 });
    }

    const id = await ClienteService.crear(auth.organizationId, body, auth.user.uid);
    const cliente = await ClienteService.getById(auth.organizationId, id);

    return NextResponse.json({ id, cliente }, { status: 201 });
  } catch (error) {
    if (isBadRequestError(error)) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Solicitud invalida' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'No se pudo crear el cliente' },
      { status: 500 }
    );
  }
});
