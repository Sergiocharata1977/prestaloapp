import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import { StockService } from "@/services/StockService";
import type { FinStockProductoInput } from "@/types/fin-stock";

export const dynamic = "force-dynamic";

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export const GET = withAuth(async (_req, ctx, { organizationId }) => {
  if (!organizationId) {
    return NextResponse.json({ error: "Organization required" }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const producto = await StockService.getProducto(organizationId, id);

    if (!producto) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ producto });
  } catch {
    return NextResponse.json(
      { error: "No se pudo obtener el producto" },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(
  async (req, ctx, { organizationId }) => {
    if (!organizationId) {
      return NextResponse.json({ error: "Organization required" }, { status: 403 });
    }

    const { id } = await ctx.params;
    let body: Partial<FinStockProductoInput>;

    try {
      body = (await req.json()) as Partial<FinStockProductoInput>;
    } catch {
      return NextResponse.json({ error: "Body invalido" }, { status: 400 });
    }

    if ("nombre" in body && (typeof body.nombre !== "string" || body.nombre.trim().length === 0)) {
      return NextResponse.json({ error: "nombre invalido" }, { status: 400 });
    }

    if ("codigo" in body && (typeof body.codigo !== "string" || body.codigo.trim().length === 0)) {
      return NextResponse.json({ error: "codigo invalido" }, { status: 400 });
    }

    if ("categoria_id" in body && (typeof body.categoria_id !== "string" || body.categoria_id.trim().length === 0)) {
      return NextResponse.json({ error: "categoria_id invalido" }, { status: 400 });
    }

    if ("precio_venta_contado" in body && !isNonNegativeNumber(body.precio_venta_contado)) {
      return NextResponse.json(
        { error: "precio_venta_contado debe ser >= 0" },
        { status: 400 }
      );
    }

    if ("stock_minimo" in body && !isNonNegativeNumber(body.stock_minimo)) {
      return NextResponse.json(
        { error: "stock_minimo debe ser >= 0" },
        { status: 400 }
      );
    }

    try {
      const producto = await StockService.getProducto(organizationId, id);

      if (!producto) {
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
      }

      await StockService.updateProducto(organizationId, id, {
        ...body,
        nombre: typeof body.nombre === "string" ? body.nombre.trim() : body.nombre,
        codigo: typeof body.codigo === "string" ? body.codigo.trim() : body.codigo,
        categoria_id: typeof body.categoria_id === "string" ? body.categoria_id.trim() : body.categoria_id,
        descripcion: typeof body.descripcion === "string" ? body.descripcion.trim() : body.descripcion,
        marca: typeof body.marca === "string" ? body.marca.trim() : body.marca,
        modelo: typeof body.modelo === "string" ? body.modelo.trim() : body.modelo,
      });

      return NextResponse.json({ ok: true });
    } catch (err) {
      const error = err instanceof Error ? err.message : "No se pudo actualizar el producto";
      const status = error.toLowerCase().includes("no encontrada") ? 404 : 500;
      return NextResponse.json({ error }, { status });
    }
  },
  { roles: ["admin", "manager"] }
);

export const DELETE = withAuth(
  async (_req, ctx, { organizationId }) => {
    if (!organizationId) {
      return NextResponse.json({ error: "Organization required" }, { status: 403 });
    }

    const { id } = await ctx.params;

    try {
      const producto = await StockService.getProducto(organizationId, id);

      if (!producto) {
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
      }

      await StockService.desactivarProducto(organizationId, id);
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json(
        { error: "No se pudo desactivar el producto" },
        { status: 500 }
      );
    }
  },
  { roles: ["admin", "manager"] }
);
