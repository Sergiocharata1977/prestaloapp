import { withAuth } from '@/lib/api/withAuth';
import { TipoClienteService } from '@/services/TipoClienteService';
import type { FinTipoClienteCreateInput } from '@/types/fin-tipo-cliente';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

const tipoClienteSchema = z.object({
  codigo: z.string().trim().min(1, 'codigo requerido'),
  nombre: z.string().trim().min(1, 'nombre requerido'),
  descripcion: z.string().trim().optional(),
  tipo_base: z.enum(['persona', 'empresa']),
  activo: z.boolean(),
  requiere_legajo: z.boolean(),
  requiere_evaluacion_vigente: z.boolean(),
  permite_cheques_propios: z.boolean(),
  permite_cheques_terceros: z.boolean(),
  limite_mensual: z.number().finite().nonnegative().optional(),
  limite_total: z.number().finite().nonnegative().optional(),
  tier_minimo_requerido: z.enum(['A', 'B', 'C', 'D', 'E']).optional(),
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

    const activo = parseBooleanFilter(request.nextUrl.searchParams.get('activo'));
    const tiposCliente = await TipoClienteService.list(auth.organizationId, {
      activo,
    });

    return NextResponse.json({ tiposCliente });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener la lista de tipos de cliente' },
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

    const body = tipoClienteSchema.parse(json) as FinTipoClienteCreateInput;
    const tipoCliente = await TipoClienteService.crear(auth.organizationId, body);

    return NextResponse.json({ tipoCliente }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError || error instanceof Error) {
      return NextResponse.json(
        { error: getErrorMessage(error, 'Solicitud invalida') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'No se pudo crear el tipo de cliente' },
      { status: 500 }
    );
  }
});
