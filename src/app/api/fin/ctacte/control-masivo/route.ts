import { getAdminFirestore } from '@/firebase/admin';
import { withAuth } from '@/lib/api/withAuth';
import { CtaCteControlMensualService } from '@/services/CtaCteControlMensualService';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

export const dynamic = 'force-dynamic';

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

export const POST = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const hasCapability = await requireCtaCteCapability(auth.organizationId);
    if (!hasCapability) {
      return NextResponse.json({ error: 'Plugin no habilitado' }, { status: 403 });
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json({ error: 'Body requerido' }, { status: 400 });
    }

    const body = bodySchema.parse(json);
    const summary = await CtaCteControlMensualService.ejecutarControlMasivo(
      auth.organizationId,
      body.periodo,
      auth.user.uid,
      auth.user.name ?? auth.user.email ?? auth.user.uid
    );

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    const status = error instanceof ZodError ? 400 : 500;
    return NextResponse.json(
      {
        error:
          status === 500
            ? 'No se pudo ejecutar el control masivo'
            : getErrorMessage(error, 'Solicitud invalida'),
      },
      { status }
    );
  }
});
