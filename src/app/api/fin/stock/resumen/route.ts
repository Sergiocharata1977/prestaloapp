import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import { StockService } from "@/services/StockService";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, _ctx, { organizationId }) => {
  if (!organizationId) {
    return NextResponse.json({ error: "Organization required" }, { status: 403 });
  }

  try {
    const resumen = await StockService.getResumenStock(organizationId);
    const alertas = resumen.filter((item) => item.alerta_stock_bajo).length;

    return NextResponse.json({ resumen, alertas });
  } catch {
    return NextResponse.json(
      { error: "No se pudo obtener el resumen de stock" },
      { status: 500 }
    );
  }
});
