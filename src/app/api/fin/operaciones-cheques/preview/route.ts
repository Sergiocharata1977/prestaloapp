import { withAuth } from '@/lib/api/withAuth';
import { OperacionChequeService } from '@/services/OperacionChequeService';
import type { FinOperacionChequePreviewInput } from '@/types/fin-operacion-cheque';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

const chequeSchema = z.object({
  banco: z.string().trim().min(1, 'banco requerido'),
  numero: z.string().trim().min(1, 'numero requerido'),
  titular: z.string().trim().min(1, 'titular requerido'),
  cuit_librador: z.string().trim().optional(),
  fecha_emision: z.string().trim().optional(),
  fecha_pago: z.string().trim().min(1, 'fecha_pago requerida'),
  importe: z.number().finite().positive('importe debe ser mayor a cero'),
  moneda: z.string().trim().optional(),
  observaciones: z.string().trim().optional(),
});

const previewSchema = z.object({
  cliente_id: z.string().trim().min(1, 'cliente_id requerido'),
  tipo_cliente_id: z.string().trim().optional(),
  sucursal_id: z.string().trim().min(1, 'sucursal_id requerido'),
  tipo_operacion: z.enum(['cheque_propio', 'cheque_terceros']),
  politica_crediticia_id: z.string().trim().optional(),
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
  cheques: z.array(chequeSchema).min(1, 'Debe informar al menos un cheque'),
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

    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json({ error: 'Body requerido' }, { status: 400 });
    }

    const body = previewSchema.parse(json) as FinOperacionChequePreviewInput;
    const preview = await OperacionChequeService.preview(auth.organizationId, body);

    return NextResponse.json(preview);
  } catch (error) {
    if (error instanceof ZodError || error instanceof Error) {
      return NextResponse.json(
        { error: getErrorMessage(error, 'Solicitud invalida') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'No se pudo calcular el preview de la operacion' },
      { status: 500 }
    );
  }
});
