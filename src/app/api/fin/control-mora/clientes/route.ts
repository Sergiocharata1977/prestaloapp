import { withAuth } from "@/lib/api/withAuth";
import { MoraService } from "@/services/MoraService";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const etapaSchema = z.enum(["mora_temprana", "pre_judicial", "judicial"]);

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q")?.trim() || undefined;
    const tipoClienteId = searchParams.get("tipoClienteId")?.trim() || undefined;
    const etapaParsed = etapaSchema.safeParse(searchParams.get("etapa"));
    const clientes = await MoraService.listClientes(auth.organizationId, {
      q,
      tipoClienteId,
      etapa: etapaParsed.success ? etapaParsed.data : undefined,
    });

    return NextResponse.json({ clientes });
  } catch {
    return NextResponse.json(
      { error: "No se pudo obtener la cartera en mora" },
      { status: 500 }
    );
  }
});
