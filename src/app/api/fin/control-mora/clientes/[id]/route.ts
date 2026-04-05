import { withAuth } from "@/lib/api/withAuth";
import { MoraService } from "@/services/MoraService";
import type { FinMoraEtapa } from "@/types/fin-mora";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";

type RouteContext = {
  params: {
    id: string;
  };
};

const patchSchema = z.object({
  etapa: z.enum(["sin_gestion", "pre_judicial", "judicial"]),
  motivo: z.string().trim().optional(),
  proxima_accion_at: z.string().trim().optional(),
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
      const cliente = await MoraService.actualizarEtapaCliente(auth.organizationId, id, {
        etapa: body.etapa as FinMoraEtapa,
        motivo: body.motivo,
        proxima_accion_at: body.proxima_accion_at,
        usuario: {
          id: auth.user.uid,
          nombre: auth.user.name ?? auth.user.email ?? auth.user.uid,
        },
      });

      return NextResponse.json({ cliente });
    } catch (error) {
      if (error instanceof ZodError || error instanceof Error) {
        return NextResponse.json(
          { error: getErrorMessage(error, "Solicitud invalida") },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "No se pudo actualizar la etapa de mora" },
        { status: 500 }
      );
    }
  }
);
