import { withAuth } from "@/lib/api/withAuth";
import { MoraService } from "@/services/MoraService";
import type {
  FinMoraAccionClase,
  FinMoraAccionEstado,
  FinMoraEtapa,
} from "@/types/fin-mora";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const etapaSchema = z.enum(["mora_temprana", "pre_judicial", "judicial"]);
const estadoSchema = z.enum([
  "pendiente",
  "programada",
  "en_curso",
  "ejecutada",
  "cancelada",
  "vencida",
]);

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const etapaParsed = etapaSchema.safeParse(searchParams.get("etapa"));
    const estadoParsed = estadoSchema.safeParse(searchParams.get("estado"));
    const responsableUserId =
      searchParams.get("responsableUserId")?.trim() || undefined;
    const clienteId = searchParams.get("clienteId")?.trim() || undefined;
    const soloVencidas = ["1", "true", "si"].includes(
      (searchParams.get("soloVencidas") ?? "").trim().toLowerCase()
    );

    const agenda = await MoraService.listAgenda(auth.organizationId, {
      cliente_id: clienteId,
      etapa: etapaParsed.success
        ? (etapaParsed.data as FinMoraEtapa & FinMoraAccionClase)
        : undefined,
      estado: estadoParsed.success
        ? (estadoParsed.data as FinMoraAccionEstado)
        : undefined,
      responsable_user_id: responsableUserId,
      vencidas: soloVencidas,
    });

    return NextResponse.json({ agenda });
  } catch {
    return NextResponse.json(
      { error: "No se pudo obtener la agenda de cobranzas" },
      { status: 500 }
    );
  }
});
