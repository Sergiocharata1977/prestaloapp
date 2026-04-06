import { withAuth } from "@/lib/api/withAuth";
import { MoraService } from "@/services/MoraService";
import type {
  FinMoraAccionClase,
  FinMoraAccionEstado,
  FinMoraAccionPrioridad,
  FinMoraAccionTipo,
} from "@/types/fin-mora";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";

const etapaSchema = z.enum(["mora_temprana", "pre_judicial", "judicial"]);
const claseSchema = etapaSchema;
const estadoSchema = z.enum([
  "pendiente",
  "programada",
  "en_curso",
  "ejecutada",
  "cancelada",
  "vencida",
]);
const prioridadSchema = z.enum(["baja", "media", "alta", "urgente"]);
const resultadoCodigoSchema = z.enum([
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
]);
const entidadTipoSchema = z.enum([
  "cliente",
  "credito",
  "cuota",
  "cheque",
  "documento",
  "expediente",
]);
const tipoSchema = z.enum([
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
]);

const createSchema = z.object({
  cliente_id: z.string().trim().min(1, "cliente_id requerido"),
  clase: claseSchema.optional(),
  etapa: claseSchema.optional(),
  tipo: tipoSchema,
  categoria: z
    .enum([
      "contacto",
      "seguimiento",
      "negociacion",
      "intimacion",
      "derivacion",
      "judicial",
      "administrativa",
      "documental",
      "agenda",
      "interna",
    ])
    .optional(),
  estado: estadoSchema.optional(),
  prioridad: prioridadSchema.optional(),
  resultado: z.string().trim().optional(),
  resultado_codigo: resultadoCodigoSchema.optional(),
  resultado_texto: z.string().trim().optional(),
  notas: z.string().trim().optional(),
  proxima_accion_tipo: tipoSchema.optional(),
  proxima_accion_at: z.string().trim().optional(),
  fecha_vencimiento_accion: z.string().trim().optional(),
  responsable_user_id: z.string().trim().optional(),
  responsable_nombre: z.string().trim().optional(),
  entidad_tipo: entidadTipoSchema.optional(),
  entidad_id: z.string().trim().optional(),
  credito_id: z.string().trim().optional(),
  cuota_id: z.string().trim().optional(),
  cheque_id: z.string().trim().optional(),
  compromiso_pago_fecha: z.string().trim().optional(),
  compromiso_pago_monto: z.coerce.number().nonnegative().optional(),
}).superRefine((value, ctx) => {
  if (!value.clase && !value.etapa) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["etapa"],
      message: "etapa requerida",
    });
  }
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
    const etapaParsed = etapaSchema.safeParse(
      searchParams.get("etapa") ?? searchParams.get("clase")
    );
    const estadoParsed = estadoSchema.safeParse(searchParams.get("estado"));
    const responsableUserId =
      searchParams.get("responsableUserId")?.trim() || undefined;
    const soloVencidas = ["1", "true", "si"].includes(
      (searchParams.get("soloVencidas") ?? "").trim().toLowerCase()
    );
    const acciones = await MoraService.listAcciones(auth.organizationId, {
      clienteId,
      etapa: etapaParsed.success ? etapaParsed.data : undefined,
      estado: estadoParsed.success
        ? (estadoParsed.data as FinMoraAccionEstado)
        : undefined,
      responsableUserId,
      soloVencidas,
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
      etapa: (body.etapa ?? body.clase) as FinMoraAccionClase,
      tipo: body.tipo as FinMoraAccionTipo,
      categoria: body.categoria,
      estado: body.estado as FinMoraAccionEstado | undefined,
      prioridad: body.prioridad as FinMoraAccionPrioridad | undefined,
      resultado: body.resultado,
      resultado_codigo: body.resultado_codigo,
      resultado_texto: body.resultado_texto,
      notas: body.notas,
      proxima_accion_tipo: body.proxima_accion_tipo,
      proxima_accion_at: body.proxima_accion_at,
      fecha_vencimiento_accion: body.fecha_vencimiento_accion,
      responsable_user_id: body.responsable_user_id,
      responsable_nombre: body.responsable_nombre,
      entidad_tipo: body.entidad_tipo,
      entidad_id: body.entidad_id,
      credito_id: body.credito_id,
      cuota_id: body.cuota_id,
      cheque_id: body.cheque_id,
      compromiso_pago_fecha: body.compromiso_pago_fecha,
      compromiso_pago_monto: body.compromiso_pago_monto,
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
