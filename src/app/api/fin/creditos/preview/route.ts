import { AmortizationService } from '@/services/AmortizationService';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

const previewSchema = z.object({
  capital: z.number().finite().positive('capital debe ser mayor a cero'),
  tasa_mensual: z.number().finite().min(0, 'tasa_mensual no puede ser negativa'),
  cantidad_cuotas: z
    .number()
    .int('cantidad_cuotas debe ser un entero')
    .positive('cantidad_cuotas debe ser mayor a cero'),
  sistema: z.enum(['frances', 'aleman']),
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

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json({ error: 'Body requerido' }, { status: 400 });
    }

    const body = previewSchema.parse(json);
    const tabla_amortizacion = AmortizationService.calcular(
      body.capital,
      body.tasa_mensual,
      body.cantidad_cuotas,
      body.sistema,
      body.fecha_primer_vencimiento
    );

    return NextResponse.json({ tabla_amortizacion });
  } catch (error) {
    if (error instanceof ZodError || error instanceof Error) {
      return NextResponse.json(
        { error: getErrorMessage(error, 'Solicitud invalida') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'No se pudo calcular la tabla de amortizacion' },
      { status: 500 }
    );
  }
}
