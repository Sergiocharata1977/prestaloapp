import { getAdminFirestore } from '@/firebase/admin';
import { withAuth } from '@/lib/api/withAuth';
import { CtaCteControlMensualService } from '@/services/CtaCteControlMensualService';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

export const dynamic = 'force-dynamic';

type RouteParams = {
  id: string;
};

async function requireCtaCteCapability(organizationId: string): Promise<boolean> {
  const db = getAdminFirestore();
  const orgSnap = await db.collection('organizations').doc(organizationId).get();
  const caps = orgSnap.data()?.capabilities as string[] | undefined;
  return Array.isArray(caps) && caps.includes('cta_cte_comercial');
}

const bodySchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/, 'periodo invalido'),
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

function getErrorStatus(error: unknown): number {
  if (error instanceof ZodError) {
    return 400;
  }

  if (error instanceof Error) {
    if (
      error.message.includes('ya fue ejecutado') ||
      error.message.includes('no esta activa')
    ) {
      return 409;
    }

    if (error.message.includes('no encontrada')) {
      return 404;
    }

    if (error.message.includes('invalido')) {
      return 400;
    }
  }

  return 500;
}

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
      const json = await request.json().catch(() => null);
      if (!json) {
        return NextResponse.json({ error: 'Body requerido' }, { status: 400 });
      }

      const body = bodySchema.parse(json);
      const control = await CtaCteControlMensualService.ejecutarControlPeriodo(
        auth.organizationId,
        id,
        body.periodo,
        auth.user.uid,
        auth.user.name ?? auth.user.email ?? auth.user.uid
      );

      return NextResponse.json({ control }, { status: 201 });
    } catch (error) {
      const status = getErrorStatus(error);
      return NextResponse.json(
        {
          error:
            status === 500
              ? 'No se pudo ejecutar el control mensual'
              : getErrorMessage(error, 'Solicitud invalida'),
        },
        { status }
      );
    }
  }
);
