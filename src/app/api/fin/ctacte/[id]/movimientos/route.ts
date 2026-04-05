import { getAdminFirestore } from '@/firebase/admin';
import { withAuth } from '@/lib/api/withAuth';
import { CtaCteService } from '@/services/CtaCteService';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type RouteParams = {
  id: string;
};

// ─── Capability helper ────────────────────────────────────────────────────────

async function requireCtaCteCapability(organizationId: string): Promise<boolean> {
  const db = getAdminFirestore();
  const orgSnap = await db.collection('organizations').doc(organizationId).get();
  const caps = orgSnap.data()?.capabilities as string[] | undefined;
  return Array.isArray(caps) && caps.includes('cta_cte_comercial');
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const GET = withAuth<RouteParams>(
  async (_request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const hasCapability = await requireCtaCteCapability(auth.organizationId);
      if (!hasCapability) {
        return NextResponse.json({ error: 'Plugin no habilitado' }, { status: 403 });
      }

      const { id } = await context.params;
      const movimientos = await CtaCteService.getMovimientos(auth.organizationId, id);

      return NextResponse.json({ movimientos });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo obtener el historial de movimientos' },
        { status: 500 }
      );
    }
  }
);
