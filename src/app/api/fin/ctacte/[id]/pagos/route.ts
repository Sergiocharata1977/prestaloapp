import { getAdminFirestore } from '@/firebase/admin';
import { withAuth } from '@/lib/api/withAuth';
import { CtaCteService } from '@/services/CtaCteService';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

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

// ─── Schema ───────────────────────────────────────────────────────────────────

const pagoSchema = z.object({
  importe: z.number().finite().positive('importe debe ser mayor a cero'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha invalida'),
  descripcion: z.string().trim().min(1, 'descripcion requerida'),
  caja_id: z.string().trim().optional(),
});

// ─── Error helpers ────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function getErrorStatus(error: unknown): number {
  if (error instanceof ZodError) {
    return 400;
  }

  if (error instanceof Error) {
    if (error.message.includes('no encontrada') || error.message.includes('no encontrado')) {
      return 404;
    }

    if (
      error.message.includes('mayor a cero') ||
      error.message.includes('requerida') ||
      error.message.includes('requerido') ||
      error.message.includes('invalida') ||
      error.message.includes('invalido')
    ) {
      return 400;
    }
  }

  return 500;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const POST = withAuth<RouteParams>(
  async (request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const hasCapability = await requireCtaCteCapability(auth.organizationId);
      if (!hasCapability) {
        return NextResponse.json({ error: 'Plugin no habilitado' }, { status: 403 });
      }

      const { id } = await context.params;

      // Verificar que la operación exista y no esté cancelada
      const operacion = await CtaCteService.getOperacion(auth.organizationId, id);
      if (!operacion) {
        return NextResponse.json({ error: 'Operacion no encontrada' }, { status: 404 });
      }

      if (operacion.estado === 'cancelada') {
        return NextResponse.json({ error: 'Operacion ya cancelada' }, { status: 400 });
      }

      const json = await request.json().catch(() => null);
      if (!json) {
        return NextResponse.json({ error: 'Body requerido' }, { status: 400 });
      }

      const body = pagoSchema.parse(json);

      await CtaCteService.registrarPago(
        auth.organizationId,
        id,
        body.importe,
        body.fecha,
        body.descripcion,
        body.caja_id,
        auth.user.uid,
        auth.user.name ?? auth.user.email ?? auth.user.uid
      );

      return NextResponse.json({ ok: true });
    } catch (error) {
      const status = getErrorStatus(error);
      return NextResponse.json(
        {
          error:
            status === 500
              ? 'No se pudo registrar el pago'
              : getErrorMessage(error, 'Solicitud invalida'),
        },
        { status }
      );
    }
  }
);
