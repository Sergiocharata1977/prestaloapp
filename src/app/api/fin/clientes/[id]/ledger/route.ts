import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { LedgerService } from '@/services/LedgerService';

const OPERATOR_ROLES = ['admin', 'gerente', 'operador'];

function requireOrganizationId(organizationId: string | null): string {
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  return organizationId;
}

export const GET = withAuth<{ id: string }>(
  async (_request, context, authContext) => {
    try {
      const orgId = requireOrganizationId(authContext.organizationId);
      const { id: clienteId } = await context.params;

      const [movimientos, saldo_actual] = await Promise.all([
        LedgerService.getMovimientos(orgId, clienteId),
        LedgerService.getSaldo(orgId, clienteId),
      ]);

      return NextResponse.json({ movimientos, saldo_actual });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Error al obtener movimientos',
        },
        { status: 400 }
      );
    }
  },
  { roles: OPERATOR_ROLES }
);
