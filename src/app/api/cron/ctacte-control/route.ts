import { getAdminFirestore } from '@/firebase/admin';
import { CtaCteControlMensualService } from '@/services/CtaCteControlMensualService';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function resolvePeriodo(value: string | null): string {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  const now = new Date();
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = previousMonth.getUTCFullYear();
  const month = String(previousMonth.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  if (vercelCronHeader) {
    return true;
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${secret}`;
}

async function handleCron(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const periodo = resolvePeriodo(request.nextUrl.searchParams.get('periodo'));
  const db = getAdminFirestore();
  const orgsSnap = await db
    .collection('organizations')
    .where('status', '==', 'active')
    .get();

  const organizaciones = orgsSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as { capabilities?: unknown }) }))
    .filter((org) => {
      const capabilities = Array.isArray(org.capabilities)
        ? org.capabilities.filter((item): item is string => typeof item === 'string')
        : [];

      return capabilities.includes('cta_cte_comercial');
    });

  const resultados: Array<{
    organizationId: string;
    procesadas: number;
    errores: number;
    summary?: Awaited<ReturnType<typeof CtaCteControlMensualService.ejecutarControlMasivo>>;
    error?: string;
  }> = [];

  for (const org of organizaciones) {
    try {
      const summary = await CtaCteControlMensualService.ejecutarControlMasivo(
        org.id,
        periodo,
        'cron:vercel',
        'Cron Vercel'
      );

      console.info('[cron][ctacte-control]', {
        organizationId: org.id,
        periodo,
        procesadas: summary.procesadas,
        errores: summary.errores.length,
      });

      resultados.push({
        organizationId: org.id,
        procesadas: summary.procesadas,
        errores: summary.errores.length,
        summary,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error al ejecutar control masivo';

      console.error('[cron][ctacte-control]', {
        organizationId: org.id,
        periodo,
        error: message,
      });

      resultados.push({
        organizationId: org.id,
        procesadas: 0,
        errores: 1,
        error: message,
      });
    }
  }

  return NextResponse.json(
    {
      periodo,
      organizaciones_procesadas: resultados.length,
      resultados,
    },
    { status: 200 }
  );
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}
