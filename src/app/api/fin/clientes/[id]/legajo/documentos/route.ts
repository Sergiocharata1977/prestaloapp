import { withAuth } from '@/lib/api/withAuth';
import { LegajoService } from '@/services/LegajoService';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

const documentoSchema = z.object({
  tipo: z.string().trim().min(1, 'tipo requerido'),
  nombre: z.string().trim().min(1, 'nombre requerido'),
  descripcion: z.string().trim().optional(),
  estado: z
    .enum(['pendiente', 'presentado', 'aprobado', 'rechazado', 'vencido'])
    .optional(),
  obligatorio: z.boolean().optional(),
  archivo_url: z.string().trim().optional(),
  archivo_nombre: z.string().trim().optional(),
  archivo_mime: z.string().trim().optional(),
  archivo_size: z.number().finite().nonnegative().optional(),
  fecha_vencimiento: z.string().trim().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type RouteContext = {
  params: {
    id: string;
  };
};

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

  return error.message.includes('requerido') || error.message.includes('invalida');
}

export const GET = withAuth<RouteContext['params']>(
  async (_request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { id } = await context.params;
      const { legajo, documentos } = await LegajoService.listDocumentos(
        auth.organizationId,
        id
      );

      return NextResponse.json({ legajo, documentos });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo obtener los documentos del legajo' },
        { status: 500 }
      );
    }
  }
);

export const POST = withAuth<RouteContext['params']>(
  async (request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const json = await request.json().catch(() => null);
      if (!json) {
        return NextResponse.json({ error: 'Body requerido' }, { status: 400 });
      }

      const body = documentoSchema.parse(json);
      const { id } = await context.params;
      const documento = await LegajoService.addDocumento(
        auth.organizationId,
        id,
        body,
        auth.user.uid
      );
      const legajo = await LegajoService.getDetalle(auth.organizationId, id, auth.user.uid);

      return NextResponse.json({ documento, legajo }, { status: 201 });
    } catch (error) {
      if (isBadRequestError(error)) {
        return NextResponse.json(
          { error: getErrorMessage(error, 'Solicitud invalida') },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'No se pudo agregar el documento al legajo' },
        { status: 500 }
      );
    }
  }
);
