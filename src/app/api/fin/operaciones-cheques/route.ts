import { withAuth } from '@/lib/api/withAuth';
import { OperacionChequeService } from '@/services/OperacionChequeService';
import type { FinOperacionChequeCreateInput } from '@/types/fin-operacion-cheque';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

const chequeSchema = z.object({
  numero: z.string().trim().min(1, 'numero requerido'),
  banco: z.string().trim().min(1, 'banco requerido'),
  titular: z.string().trim().min(1, 'titular requerido'),
  cuit_librador: z.string().trim().optional(),
  fecha_emision: z.string().trim().optional(),
  fecha_pago: z.string().trim().min(1, 'fecha_pago requerida'),
  importe: z.number().finite().positive('importe debe ser mayor a cero'),
  moneda: z.string().trim().optional(),
  observaciones: z.string().trim().optional(),
});

const createSchema = z.object({
  sucursal_id: z.string().trim().min(1, 'sucursal_id requerido'),
  cliente_id: z.string().trim().min(1, 'cliente_id requerido'),
  tipo_cliente_id: z.string().trim().optional(),
  tipo_operacion: z.enum(['cheque_propio', 'cheque_terceros']),
  politica_crediticia_id: z.string().trim().optional(),
  moneda: z.string().trim().optional(),
  fecha_operacion: z.string().trim().min(1, 'fecha_operacion requerida'),
  fecha_liquidacion: z.string().trim().optional(),
  tasa_mensual: z.number().finite().nonnegative('tasa_mensual invalida').optional(),
  gastos: z.number().finite().nonnegative('gastos invalidos').optional(),
  gastos_fijos: z
    .array(
      z.object({
        concepto: z.string().trim().min(1, 'concepto requerido'),
        importe: z.number().finite().nonnegative('importe invalido'),
      })
    )
    .optional(),
  gastos_variables: z
    .array(
      z.object({
        concepto: z.string().trim().min(1, 'concepto requerido'),
        porcentaje: z.number().finite().nonnegative('porcentaje invalido'),
      })
    )
    .optional(),
  observaciones: z.string().trim().optional(),
  caja_id: z.string().trim().optional(),
  base_contable: z.object({
    cuenta_cheques_id: z.string().trim().min(1, 'cuenta_cheques_id requerida'),
    cuenta_liquidadora_id: z.string().trim().min(1, 'cuenta_liquidadora_id requerida'),
    cuenta_ingresos_id: z.string().trim().min(1, 'cuenta_ingresos_id requerida'),
  }),
  cheques: z.array(chequeSchema).min(1, 'Debe informar al menos un cheque'),
});

const estadoSchema = z.enum(['borrador', 'pendiente', 'confirmada', 'liquidada', 'anulada']);
const tipoOperacionSchema = z.enum(['cheque_propio', 'cheque_terceros']);

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
    const sucursalId = searchParams.get('sucursalId')?.trim() || undefined;
    const estadoParsed = estadoSchema.safeParse(searchParams.get('estado'));
    const tipoOperacionParsed = tipoOperacionSchema.safeParse(
      searchParams.get('tipoOperacion')
    );

    const operaciones = await OperacionChequeService.list(auth.organizationId, {
      cliente_id: clienteId,
      sucursal_id: sucursalId,
      estado: estadoParsed.success ? estadoParsed.data : undefined,
      tipo_operacion: tipoOperacionParsed.success ? tipoOperacionParsed.data : undefined,
    });

    return NextResponse.json({ operaciones });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener la lista de operaciones de cheque' },
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

    const body = createSchema.parse(json) as FinOperacionChequeCreateInput;
    const result = await OperacionChequeService.registrar(
      auth.organizationId,
      body,
      auth.user.uid,
      auth.user.name ?? auth.user.email ?? auth.user.uid
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError || error instanceof Error) {
      return NextResponse.json(
        { error: getErrorMessage(error, 'Solicitud invalida') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'No se pudo crear la operacion de cheque' },
      { status: 500 }
    );
  }
});
