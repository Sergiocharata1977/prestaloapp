import { withAuth } from "@/lib/api/withAuth";
import { MoraService } from "@/services/MoraService";
import type { FinMoraAccionClase, FinMoraAccionTipo } from "@/types/fin-mora";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";

const claseSchema = z.enum(["pre_judicial", "judicial"]);

const createSchema = z.object({
  cliente_id: z.string().trim().min(1, "cliente_id requerido"),
  clase: claseSchema,
  tipo: z.enum([
    "llamado",
    "whatsapp",
    "email",
    "carta_documento",
    "visita",
    "acuerdo",
    "derivacion_estudio",
    "demanda",
    "nota_interna",
  ]),
  resultado: z.string().trim().min(1, "resultado requerido"),
  notas: z.string().trim().optional(),
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

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const clienteId = searchParams.get("clienteId")?.trim() || undefined;
    const claseParsed = claseSchema.safeParse(searchParams.get("clase"));
    const acciones = await MoraService.listAcciones(auth.organizationId, {
      clienteId,
      clase: claseParsed.success ? claseParsed.data : undefined,
    });

    return NextResponse.json({ acciones });
  } catch {
    return NextResponse.json(
      { error: "No se pudieron obtener las acciones de mora" },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json({ error: "Body requerido" }, { status: 400 });
    }

    const body = createSchema.parse(json);
    const accion = await MoraService.crearAccion(auth.organizationId, {
      cliente_id: body.cliente_id,
      clase: body.clase as FinMoraAccionClase,
      tipo: body.tipo as FinMoraAccionTipo,
      resultado: body.resultado,
      notas: body.notas,
      proxima_accion_at: body.proxima_accion_at,
      usuario: {
        id: auth.user.uid,
        nombre: auth.user.name ?? auth.user.email ?? auth.user.uid,
      },
    });

    return NextResponse.json({ accion }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError || error instanceof Error) {
      return NextResponse.json(
        { error: getErrorMessage(error, "Solicitud invalida") },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "No se pudo registrar la accion de mora" },
      { status: 500 }
    );
  }
});
