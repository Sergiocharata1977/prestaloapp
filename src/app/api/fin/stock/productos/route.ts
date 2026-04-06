import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import { StockService } from "@/services/StockService";
import type { FinStockProductoInput } from "@/types/fin-stock";

export const dynamic = "force-dynamic";

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export const GET = withAuth(async (req, _ctx, { organizationId }) => {
  if (!organizationId) {
    return NextResponse.json({ error: "Organization required" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const categoriaId = url.searchParams.get("categoriaId") || undefined;
    const soloConStock = url.searchParams.get("soloConStock") === "true";
    const productos = await StockService.getProductos(organizationId, {
      categoriaId,
      activo: true,
      soloConStock,
    });

    return NextResponse.json({ productos });
  } catch {
    return NextResponse.json(
      { error: "No se pudieron obtener los productos" },
      { status: 500 }
    );
  }
});

export const POST = withAuth(
  async (req, _ctx, { organizationId, user }) => {
    if (!organizationId) {
      return NextResponse.json({ error: "Organization required" }, { status: 403 });
    }

    let body: FinStockProductoInput;

    try {
      body = (await req.json()) as FinStockProductoInput;
    } catch {
      return NextResponse.json({ error: "Body invalido" }, { status: 400 });
    }

    if (!body?.nombre || !body.nombre.trim() || !body?.codigo || !body.codigo.trim() || !body?.categoria_id) {
      return NextResponse.json(
        { error: "Nombre, codigo y categoria son requeridos" },
        { status: 400 }
      );
    }

    if (!isNonNegativeNumber(body.precio_venta_contado)) {
      return NextResponse.json(
        { error: "precio_venta_contado debe ser >= 0" },
        { status: 400 }
      );
    }

    if (!isNonNegativeNumber(body.stock_minimo)) {
      return NextResponse.json(
        { error: "stock_minimo debe ser >= 0" },
        { status: 400 }
      );
    }

    try {
      const producto = await StockService.createProducto(
        organizationId,
        {
          ...body,
          nombre: body.nombre.trim(),
          codigo: body.codigo.trim(),
          categoria_id: body.categoria_id.trim(),
          descripcion: typeof body.descripcion === "string" ? body.descripcion.trim() : body.descripcion,
          marca: typeof body.marca === "string" ? body.marca.trim() : body.marca,
          modelo: typeof body.modelo === "string" ? body.modelo.trim() : body.modelo,
        },
        user.uid
      );

      return NextResponse.json({ producto });
    } catch (err) {
      const error = err instanceof Error ? err.message : "No se pudo crear el producto";
      const status = error.toLowerCase().includes("no encontrada") ? 404 : 500;
      return NextResponse.json({ error }, { status });
    }
  },
  { roles: ["admin", "manager"] }
);
