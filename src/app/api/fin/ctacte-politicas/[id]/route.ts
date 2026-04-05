import { getAdminFirestore } from '@/firebase/admin';
import { withAuth } from '@/lib/api/withAuth';
import { CtaCtePoliticaService } from '@/services/CtaCtePoliticaService';
import type { FinCtaCtePoliticaInput } from '@/types/fin-ctacte';
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

const reglasSchema = z.object({
  entrega_minima_tipo: z.enum(['monto_fijo', 'pct_compra', 'pct_saldo']),
  entrega_minima_valor: z.number().finite().min(0, 'entrega_minima_valor no puede ser negativo'),
  gasto_fijo_mensual: z.number().finite().min(0, 'gasto_fijo_mensual no puede ser negativo'),
  dia_control: z.number().int('dia_control debe ser entero').min(1).max(28),
  gracia_dias: z.number().int('gracia_dias debe ser entero').min(0),
  aplica_mora_sin_pago: z.boolean(),
  mora_tipo: z.enum(['monto_fijo', 'pct_saldo']),
  mora_valor: z.number().finite().min(0, 'mora_valor no puede ser negativo'),
  permite_refinanciacion: z.boolean(),
});

const politicaPatchSchema = z
  .object({
    nombre: z.string().trim().min(1, 'nombre requerido').optional(),
    descripcion: z.string().trim().optional(),
    activa: z.boolean().optional(),
    reglas: reglasSchema
      .refine((value) => Object.keys(value).length > 0, 'reglas requeridas')
      .optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Body requerido');

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export const GET = withAuth<RouteParams>(async (_request: NextRequest, context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const hasCapability = await requireCtaCteCapability(auth.organizationId);
    if (!hasCapability) {
      return NextResponse.json({ error: 'Plugin no habilitado' }, { status: 403 });
    }

    const { id } = await context.params;
    const politica = await CtaCtePoliticaService.getById(auth.organizationId, id);

    if (!politica) {
      return NextResponse.json(
        { error: 'Politica de cuenta corriente no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ politica });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener la politica de cuenta corriente' },
      { status: 500 }
    );
  }
});

export const PATCH = withAuth<RouteParams>(async (request: NextRequest, context, auth) => {
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

    const body = politicaPatchSchema.parse(json) as Partial<FinCtaCtePoliticaInput>;
    const politica = await CtaCtePoliticaService.actualizar(auth.organizationId, id, body);

    if (!politica) {
      return NextResponse.json(
        { error: 'Politica de cuenta corriente no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ politica });
  } catch (error) {
    if (error instanceof ZodError || error instanceof Error) {
      return NextResponse.json(
        { error: getErrorMessage(error, 'Solicitud invalida') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'No se pudo actualizar la politica de cuenta corriente' },
      { status: 500 }
    );
  }
});
