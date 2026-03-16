import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { CobroService } from '@/services/CobroService';

const OPERATOR_ROLES = ['admin', 'gerente', 'operador'];

function requireOrganizationId(organizationId: string | null): string {
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  return organizationId;
}

export const GET = withAuth<{ id: string }>(async (_request, context, authContext) => {
  try {
    const orgId = requireOrganizationId(authContext.organizationId);
    const cobro = await CobroService.getById(orgId, context.params.id);

    if (!cobro) {
      return NextResponse.json({ error: 'Cobro no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: cobro });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener cobro' },
      { status: 400 }
    );
  }
}, { roles: OPERATOR_ROLES });
