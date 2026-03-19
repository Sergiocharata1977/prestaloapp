import { withAuth } from '@/lib/api/withAuth';
import { PoliticaCrediticiaService } from '@/services/PoliticaCrediticiaService';
import type { FinPoliticaCrediticiaCreateInput } from '@/types/fin-politica-crediticia';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

const politicaTierSchema = z.object({
  tier: z.enum(['A', 'B', 'C', 'D', 'E']),
  limite_mensual: z.number().finite().nonnegative().optional(),
  limite_total: z.number().finite().nonnegative().optional(),
  requiere_garantia: z.boolean().optional(),
  monto_maximo_otorgamiento: z.number().finite().nonnegative().optional(),
});

const politicaSchema = z.object({
  nombre: z.string().trim().min(1, 'nombre requerido'),
  codigo: z.string().trim().min(1, 'codigo requerido'),
  descripcion: z.string().trim().optional(),
  tipo_cliente_id: z.string().trim().min(1, 'tipo_cliente_id requerido'),
  tipo_operacion: z.enum(['consumo', 'empresa', 'cheque_propio', 'cheque_terceros']),
  activo: z.boolean(),
  requiere_legajo: z.boolean(),
  requiere_evaluacion_vigente: z.boolean(),
  permite_cheques_propios: z.boolean(),
  permite_cheques_terceros: z.boolean(),
  dias_vigencia_evaluacion: z.number().int().positive().optional(),
  monto_minimo: z.number().finite().nonnegative().optional(),
  monto_maximo: z.number().finite().nonnegative().optional(),
  limite_mensual: z.number().finite().nonnegative().optional(),
  limite_total: z.number().finite().nonnegative().optional(),
  tiers: z.array(politicaTierSchema),
});

function parseBooleanFilter(value: string | null): boolean | undefined {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const tipoClienteId = searchParams.get('tipoClienteId')?.trim() || undefined;
    const activo = parseBooleanFilter(searchParams.get('activo'));

    const politicas = await PoliticaCrediticiaService.list(auth.organizationId, {
      tipo_cliente_id: tipoClienteId,
      activo,
    });

    return NextResponse.json({ politicas });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener la lista de politicas crediticias' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json({ error: 'Body requerido' }, { status: 400 });
    }

    const body = politicaSchema.parse(json) as FinPoliticaCrediticiaCreateInput;
    const politica = await PoliticaCrediticiaService.crear(auth.organizationId, body);

    return NextResponse.json({ politica }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError || error instanceof Error) {
      return NextResponse.json(
        { error: getErrorMessage(error, 'Solicitud invalida') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'No se pudo crear la politica crediticia' },
      { status: 500 }
    );
  }
});
