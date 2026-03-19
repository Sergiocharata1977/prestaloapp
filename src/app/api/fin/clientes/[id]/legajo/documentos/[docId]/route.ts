import { withAuth } from '@/lib/api/withAuth';
import { LegajoService } from '@/services/LegajoService';
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

const documentoUpdateSchema = z
  .object({
    tipo: z.string().trim().min(1, 'tipo requerido').optional(),
    nombre: z.string().trim().min(1, 'nombre requerido').optional(),
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
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Body requerido',
  });

type RouteContext = {
  params: {
    id: string;
    docId: string;
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

      const { id, docId } = await context.params;
      const documento = await LegajoService.getDocumento(
        auth.organizationId,
        id,
        docId,
        auth.user.uid
      );

      if (!documento) {
        return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
      }

      return NextResponse.json({ documento });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo obtener el documento del legajo' },
        { status: 500 }
      );
    }
  }
);

export const PATCH = withAuth<RouteContext['params']>(
  async (request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const json = await request.json().catch(() => null);
      if (!json) {
        return NextResponse.json({ error: 'Body requerido' }, { status: 400 });
      }

      const body = documentoUpdateSchema.parse(json);
      const { id, docId } = await context.params;
      const documento = await LegajoService.updateDocumento(
        auth.organizationId,
        id,
        docId,
        body,
        auth.user.uid
      );

      if (!documento) {
        return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
      }

      const legajo = await LegajoService.getDetalle(auth.organizationId, id, auth.user.uid);

      return NextResponse.json({ documento, legajo });
    } catch (error) {
      if (isBadRequestError(error)) {
        return NextResponse.json(
          { error: getErrorMessage(error, 'Solicitud invalida') },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'No se pudo actualizar el documento del legajo' },
        { status: 500 }
      );
    }
  }
);
