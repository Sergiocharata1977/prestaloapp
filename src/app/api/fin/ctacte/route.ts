import { getAdminFirestore } from '@/firebase/admin';
import { withAuth } from '@/lib/api/withAuth';
import { CtaCteService } from '@/services/CtaCteService';
import { StockService } from '@/services/StockService';
import type { FinCtaCteEstado } from '@/types/fin-ctacte';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

export const dynamic = 'force-dynamic';

// ─── Capability helper ────────────────────────────────────────────────────────

async function requireCtaCteCapability(organizationId: string): Promise<boolean> {
  const db = getAdminFirestore();
  const orgSnap = await db.collection('organizations').doc(organizationId).get();
  const caps = orgSnap.data()?.capabilities as string[] | undefined;
  return Array.isArray(caps) && caps.includes('cta_cte_comercial');
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ctaCteEstadoValues = [
  'activa',
  'al_dia',
  'incumplida',
  'sin_pago',
  'refinanciada',
  'cancelada',
  'judicial',
] as const;

const ctaCteEstadoSchema = z.enum(ctaCteEstadoValues);

const nuevaOperacionSchema = z.object({
  cliente_id: z.string().trim().min(1, 'cliente_id requerido'),
  cliente_nombre: z.string().trim().min(1, 'cliente_nombre requerido'),
  sucursal_id: z.string().trim().optional(),
  fecha_venta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_venta invalida'),
  comprobante: z.string().trim().min(1, 'comprobante requerido'),
  detalle_mercaderia: z.string().trim().min(1, 'detalle_mercaderia requerido'),
  monto_original: z.number().finite().positive('monto_original debe ser mayor a cero'),
  reglas: z.object({
    entrega_minima_tipo: z.enum(['monto_fijo', 'pct_compra', 'pct_saldo']),
    entrega_minima_valor: z.number().finite().min(0, 'entrega_minima_valor no puede ser negativo'),
    gasto_fijo_mensual: z.number().finite().min(0, 'gasto_fijo_mensual no puede ser negativo'),
    dia_control: z.number().int('dia_control debe ser entero').min(1).max(28),
    gracia_dias: z.number().int('gracia_dias debe ser entero').min(0),
    aplica_mora_sin_pago: z.boolean(),
    mora_tipo: z.enum(['monto_fijo', 'pct_saldo']),
    mora_valor: z.number().finite().min(0, 'mora_valor no puede ser negativo'),
    permite_refinanciacion: z.boolean(),
  }),
  mercaderia_items: z
    .array(
      z.object({
        productoId: z.string().trim().min(1, 'productoId requerido'),
        nombre: z.string().trim().optional(),
        cantidad: z.number().int('cantidad debe ser entera').positive('cantidad debe ser mayor a cero'),
        precioUnitario: z.number().finite().min(0, 'precioUnitario no puede ser negativo'),
      })
    )
    .optional(),
});

// ─── Error helpers ────────────────────────────────────────────────────────────

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
    error.message.includes('negativo') ||
    error.message.includes('mayor a cero') ||
    error.message.includes('entero')
  );
}

function parseEstado(value: string | null): FinCtaCteEstado | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = ctaCteEstadoSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const hasCapability = await requireCtaCteCapability(auth.organizationId);
    if (!hasCapability) {
      return NextResponse.json({ error: 'Plugin no habilitado' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const estado = parseEstado(searchParams.get('estado'));
    const clienteId = searchParams.get('clienteId')?.trim() || undefined;

    const operaciones = await CtaCteService.getOperaciones(auth.organizationId, {
      estado,
      clienteId,
    });

    return NextResponse.json({ operaciones });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener la lista de operaciones de cuenta corriente' },
      { status: 500 }
    );
  }
});

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

    const body = nuevaOperacionSchema.parse(json);
    const id = await CtaCteService.crearOperacion(
      auth.organizationId,
      body,
      auth.user.uid,
      auth.user.name ?? auth.user.email ?? auth.user.uid
    );
    const operacionNumero = body.comprobante;

    if (Array.isArray(body.mercaderia_items) && body.mercaderia_items.length > 0) {
      for (const item of body.mercaderia_items) {
        try {
          const producto = await StockService.getProducto(auth.organizationId, item.productoId);
          if (producto) {
            await StockService.registrarMovimiento(
              auth.organizationId,
              {
                producto_id: item.productoId,
                producto_nombre: producto.nombre,
                tipo: 'egreso_venta_ctacte',
                cantidad: item.cantidad,
                referencia_id: id,
                referencia_tipo: 'ctacte',
                referencia_numero: operacionNumero,
                precio_unitario: item.precioUnitario,
              },
              auth.user.uid
            );
          }
        } catch (err) {
          console.error('[stock] Error al descontar item:', item.productoId, err);
        }
      }
    }

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (isBadRequestError(error)) {
      return NextResponse.json(
        { error: getErrorMessage(error, 'Solicitud invalida') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'No se pudo crear la operacion de cuenta corriente' },
      { status: 500 }
    );
  }
});
