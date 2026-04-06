import { withAuth } from "@/lib/api/withAuth";
import { MoraService } from "@/services/MoraService";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: {
    id: string;
  };
};

export const GET = withAuth<RouteContext["params"]>(
  async (_request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { id } = await context.params;
      const timeline = await MoraService.listClienteTimeline(auth.organizationId, id);

      return NextResponse.json({ timeline });
    } catch {
      return NextResponse.json(
        { error: "No se pudo obtener el historial operativo del cliente" },
        { status: 500 }
      );
    }
  }
);
