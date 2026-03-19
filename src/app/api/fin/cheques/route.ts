import { withAuth } from '@/lib/api/withAuth';
import { ChequeService } from '@/services/ChequeService';
import type { FinChequeCreateInput } from '@/types/fin-cheque';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

const createSchema = z.object({
  cliente_id: z.string().trim().min(1, 'cliente_id requerido'),
  tipo_cliente_id: z.string().trim().min(1).optional(),
  sucursal_id: z.string().trim().min(1, 'sucursal_id requerido'),
  tipo: z.enum(['cheque_propio', 'cheque_terceros']),
  numero: z.string().trim().min(1, 'numero requerido'),
  banco: z.string().trim().min(1, 'banco requerido'),
  titular: z.string().trim().min(1, 'titular requerido'),
  cuit_librador: z.string().trim().optional(),
  fecha_emision: z.iso.date().optional(),
  fecha_pago: z.iso.date('fecha_pago invalida'),
  importe: z.number().finite().positive('importe debe ser mayor a cero'),
  moneda: z.string().trim().min(1).optional(),
  observaciones: z.string().trim().optional(),
});

const estadoSchema = z.enum([
  'recibido',
  'en_cartera',
  'depositado',
  'acreditado',
  'rechazado',
  'pre_judicial',
  'judicial',
]);
const tipoSchema = z.enum(['cheque_propio', 'cheque_terceros']);

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
    const clienteId = searchParams.get('clienteId')?.trim() || undefined;
    const estadoParsed = estadoSchema.safeParse(searchParams.get('estado'));
    const tipoParsed = tipoSchema.safeParse(searchParams.get('tipo'));

    const cheques = await ChequeService.listCheques(auth.organizationId, {
      cliente_id: clienteId,
      estado: estadoParsed.success ? estadoParsed.data : undefined,
      tipo: tipoParsed.success ? tipoParsed.data : undefined,
    });

    return NextResponse.json({ cheques });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener la lista de cheques' },
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

    const body = createSchema.parse(json) as FinChequeCreateInput;
    const cheque = await ChequeService.createCheque(auth.organizationId, body);

    return NextResponse.json({ cheque }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError || error instanceof Error) {
      return NextResponse.json(
        { error: getErrorMessage(error, 'Solicitud invalida') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'No se pudo crear el cheque' },
      { status: 500 }
    );
  }
});
