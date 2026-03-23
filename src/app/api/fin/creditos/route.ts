import { withAuth } from '@/lib/api/withAuth';
import { CreditoService } from '@/services/CreditoService';
import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import type {
  FinCreditoCreateInput,
  FinCreditoEstado,
  FinCreditoTipoOperacion,
  FinSistemaAmortizacion,
} from '@/types/fin-credito';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

const creditoEstadoSchema = z.enum([
  'activo',
  'cancelado',
  'en_mora',
  'refinanciado',
  'incobrable',
]);

const creditoCreateSchema = z.object({
  sucursal_id: z.string().trim().optional().default(''),
  cliente_id: z.string().trim().min(1, 'cliente_id requerido'),
  tipo_cliente_id: z.string().trim().min(1).optional(),
  tipo_operacion: z
    .enum(['consumo', 'empresa', 'cheque_propio', 'cheque_terceros', 'compra_financiada'])
    .optional(),
  valor_contado_bien: z.number().finite().positive().optional(),
  politica_crediticia_id: z.string().trim().min(1).optional(),
  plan_financiacion_id: z.string().trim().min(1).optional(),
  articulo_descripcion: z.string().trim().min(1, 'articulo_descripcion requerido'),
  articulo_codigo: z.string().trim().min(1).optional(),
  capital: z.number().finite().positive('capital debe ser mayor a cero'),
  tasa_mensual: z.number().finite().min(0, 'tasa_mensual no puede ser negativa').optional(),
  cantidad_cuotas: z
    .number()
    .int('cantidad_cuotas debe ser un entero')
    .positive('cantidad_cuotas debe ser mayor a cero'),
  sistema: z.enum(['frances', 'aleman']),
  fecha_otorgamiento: z.iso.date('fecha_otorgamiento invalida'),
  fecha_primer_vencimiento: z.iso.date('fecha_primer_vencimiento invalida'),
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

function isBadRequestError(error: unknown): boolean {
  if (error instanceof ZodError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('requerido') ||
    error.message.includes('invalida') ||
    error.message.includes('invalido') ||
    error.message.includes('No encontrado') ||
    error.message.includes('no encontrada') ||
    error.message.includes('incompleta') ||
    error.message.includes('negativa') ||
    error.message.includes('mayor a cero') ||
    error.message.includes('entero') ||
    error.message.includes('linea disponible') ||
    error.message.includes('politica') ||
    error.message.includes('evaluacion') ||
    error.message.includes('legajo') ||
    error.message.includes('No hay') ||
    error.message.includes('La politica')
  );
}

function parseEstado(value: string | null): FinCreditoEstado | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = creditoEstadoSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function parseSistema(value: string): FinSistemaAmortizacion {
  return value as FinSistemaAmortizacion;
}

function parseTipoOperacion(
  value: string | undefined
): FinCreditoTipoOperacion | undefined {
  return value as FinCreditoTipoOperacion | undefined;
}

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const clienteId = searchParams.get('clienteId')?.trim() || undefined;
    const sucursalId = searchParams.get('sucursalId')?.trim() || undefined;
    const estado = parseEstado(searchParams.get('estado'));
    const tipo = searchParams.get('tipo')?.trim() || undefined;

    let creditos = await CreditoService.list(auth.organizationId, {
      cliente_id: clienteId,
      sucursal_id: sucursalId,
      estado,
    });

    if (tipo) {
      creditos = creditos.filter((c) => c.tipo_operacion === tipo);
    }

    return NextResponse.json({ creditos });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener la lista de creditos' },
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

    const body = creditoCreateSchema.parse(json);

    // Resolver sucursal: si viene vacía, usar la primera activa de la org
    let sucursalId = body.sucursal_id ?? '';
    if (!sucursalId) {
      const db = getAdminFirestore();
      const snap = await db
        .collection(FIN_COLLECTIONS.sucursales(auth.organizationId))
        .where('activa', '==', true)
        .limit(1)
        .get();
      if (snap.empty) {
        return NextResponse.json(
          { error: 'No hay sucursales configuradas. Creá al menos una antes de otorgar créditos.' },
          { status: 400 }
        );
      }
      sucursalId = snap.docs[0].id;
    }

    const payload: FinCreditoCreateInput = {
      ...body,
      sucursal_id: sucursalId,
      sistema: parseSistema(body.sistema),
      tipo_operacion: parseTipoOperacion(body.tipo_operacion),
      valor_contado_bien: body.valor_contado_bien,
    };

    const result = await CreditoService.crear(
      auth.organizationId,
      payload,
      auth.user.uid,
      auth.user.name ?? auth.user.email ?? auth.user.uid
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (isBadRequestError(error)) {
      return NextResponse.json(
        { error: getErrorMessage(error, 'Solicitud invalida') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'No se pudo crear el credito' },
      { status: 500 }
    );
  }
});
