import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { CobroService } from '@/services/CobroService';
import type { FinCobroCreateInput } from '@/types/fin-cobro';

const OPERATOR_ROLES = ['admin', 'gerente', 'operador'];

function requireOrganizationId(organizationId: string | null): string {
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  return organizationId;
}

export const GET = withAuth(async (request, _context, authContext) => {
  try {
    const orgId = requireOrganizationId(authContext.organizationId);
    const { searchParams } = new URL(request.url);

    const cobros = await CobroService.list(orgId, {
      credito_id:
        searchParams.get('creditoId')?.trim() ||
        searchParams.get('credito_id')?.trim() ||
        undefined,
      sucursal_id:
        searchParams.get('sucursalId')?.trim() ||
        searchParams.get('sucursal_id')?.trim() ||
        undefined,
      desde: searchParams.get('desde')?.trim() || undefined,
    });

    return NextResponse.json({ success: true, data: cobros });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar cobros' },
      { status: 400 }
    );
  }
}, { roles: OPERATOR_ROLES });

export const POST = withAuth(async (request, _context, authContext) => {
  try {
    const orgId = requireOrganizationId(authContext.organizationId);
    const body = (await request.json()) as Partial<FinCobroCreateInput>;

    if (
      !body?.sucursal_id ||
      !body?.caja_id ||
      !body?.credito_id ||
      !body?.cuota_id ||
      !body?.medio_pago
    ) {
      return NextResponse.json(
        { error: 'sucursal_id, caja_id, credito_id, cuota_id y medio_pago son obligatorios' },
        { status: 400 }
      );
    }

    const result = await CobroService.registrar(
      orgId,
      {
        sucursal_id: body.sucursal_id,
        caja_id: body.caja_id,
        credito_id: body.credito_id,
        cuota_id: body.cuota_id,
        medio_pago: body.medio_pago,
      },
      authContext.user.uid,
      authContext.user.name || authContext.user.email || authContext.user.uid
    );

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al registrar cobro' },
      { status: 400 }
    );
  }
}, { roles: OPERATOR_ROLES });
