import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { StockService } from "@/services/StockService";
import type {
  FinMovimientoStockInput,
  FinMovimientoStockTipo,
} from "@/types/fin-stock";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, _ctx, { organizationId }) => {
  const url = new URL(req.url);
  const filtros = {
    productoId: url.searchParams.get("productoId") || undefined,
    tipo: (url.searchParams.get("tipo") || undefined) as
      | FinMovimientoStockTipo
      | undefined,
    desde: url.searchParams.get("desde") || undefined,
    hasta: url.searchParams.get("hasta") || undefined,
  };

  const movimientos = await StockService.getMovimientos(organizationId!, filtros);
  return NextResponse.json({ movimientos });
});

export const POST = withAuth(
  async (req, _ctx, { organizationId, user }) => {
    const body = await req.json() as FinMovimientoStockInput;

    if (!body.producto_id) {
      return NextResponse.json(
        { error: "producto_id requerido" },
        { status: 400 }
      );
    }

    if (!body.tipo) {
      return NextResponse.json({ error: "tipo requerido" }, { status: 400 });
    }

    if (!body.cantidad || body.cantidad <= 0) {
      return NextResponse.json(
        { error: "cantidad debe ser > 0" },
        { status: 400 }
      );
    }

    try {
      const movimiento = await StockService.registrarMovimiento(
        organizationId!,
        body,
        user.uid
      );

      return NextResponse.json({ movimiento });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error al registrar movimiento";
      const status = msg.toLowerCase().includes("insuficiente") ? 422 : 500;

      return NextResponse.json({ error: msg }, { status });
    }
  },
  { roles: ["admin", "manager", "operador"] }
);
