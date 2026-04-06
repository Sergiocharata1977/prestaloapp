import { withAuth } from "@/lib/api/withAuth";
import { MoraService } from "@/services/MoraService";
import type {
  FinMoraAccionEstado,
  FinMoraAccionPrioridad,
  FinMoraAccionTipo,
} from "@/types/fin-mora";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";

type RouteContext = {
  params: {
    id: string;
  };
};

const patchSchema = z
  .object({
    estado: z
      .enum([
        "pendiente",
        "programada",
        "en_curso",
        "ejecutada",
        "cancelada",
        "vencida",
      ])
      .optional(),
    resultado_codigo: z
      .enum([
        "pendiente",
        "sin_contacto",
        "contacto_efectivo",
        "compromiso_pago",
        "pago_parcial",
        "pago_total",
        "rehusado",
        "requiere_documentacion",
        "derivado_estudio",
        "demanda_iniciada",
        "cerrado",
      ])
      .optional(),
    resultado_texto: z.string().trim().optional(),
    notas: z.string().trim().optional(),
    prioridad: z.enum(["baja", "media", "alta", "urgente"]).optional(),
    proxima_accion_tipo: z
      .enum([
        "llamado",
        "whatsapp",
        "email",
        "carta_documento",
        "visita",
        "acuerdo",
        "derivacion_estudio",
        "demanda",
        "nota_interna",
        "sms",
        "tarea",
        "recordatorio",
        "audiencia",
        "presentacion_judicial",
        "gestion_documental",
        "actualizacion_estado",
      ])
      .optional(),
    proxima_accion_at: z.string().trim().optional(),
    responsable_user_id: z.string().trim().optional(),
    responsable_nombre: z.string().trim().optional(),
    executed_at: z.string().trim().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Debe indicar al menos un campo a actualizar",
  });

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export const PATCH = withAuth<RouteContext["params"]>(
  async (request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { id } = await context.params;
      const json = await request.json().catch(() => null);
      if (!json) {
        return NextResponse.json({ error: "Body requerido" }, { status: 400 });
      }

      const body = patchSchema.parse(json);
      const accion = await MoraService.updateAccion(auth.organizationId, id, {
        estado: body.estado as FinMoraAccionEstado | undefined,
        resultado_codigo: body.resultado_codigo,
        resultado_texto: body.resultado_texto,
        notas: body.notas,
        prioridad: body.prioridad as FinMoraAccionPrioridad | undefined,
        proxima_accion_tipo: body.proxima_accion_tipo as
          | FinMoraAccionTipo
          | undefined,
        proxima_accion_at: body.proxima_accion_at,
        responsable_user_id: body.responsable_user_id,
        responsable_nombre: body.responsable_nombre,
        executed_at: body.executed_at,
        usuario: {
          id: auth.user.uid,
          nombre: auth.user.name ?? auth.user.email ?? auth.user.uid,
        },
      });

      return NextResponse.json({ accion });
    } catch (error) {
      if (error instanceof ZodError || error instanceof Error) {
        return NextResponse.json(
          { error: getErrorMessage(error, "Solicitud invalida") },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "No se pudo actualizar la accion de mora" },
        { status: 500 }
      );
    }
  }
);
