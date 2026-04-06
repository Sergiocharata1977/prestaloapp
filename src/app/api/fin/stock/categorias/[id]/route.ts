import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import { StockService } from "@/services/StockService";
import type { FinStockCategoriaInput, FinStockRubro } from "@/types/fin-stock";

export const dynamic = "force-dynamic";

function isValidRubro(value: unknown): value is FinStockRubro {
  return (
    value === "electrodomesticos" ||
    value === "tecnologia" ||
    value === "ropa_calzado" ||
    value === "muebles_hogar" ||
    value === "otro"
  );
}

export const GET = withAuth(async (_req, ctx, { organizationId }) => {
  if (!organizationId) {
    return NextResponse.json({ error: "Organization required" }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const categoria = await StockService.getCategoria(organizationId, id);

    if (!categoria) {
      return NextResponse.json({ error: "Categoria no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ categoria });
  } catch {
    return NextResponse.json(
      { error: "No se pudo obtener la categoria" },
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
    let body: Partial<FinStockCategoriaInput>;

    try {
      body = (await req.json()) as Partial<FinStockCategoriaInput>;
    } catch {
      return NextResponse.json({ error: "Body invalido" }, { status: 400 });
    }

    if ("nombre" in body && (typeof body.nombre !== "string" || body.nombre.trim().length === 0)) {
      return NextResponse.json({ error: "nombre invalido" }, { status: 400 });
    }

    if ("rubro" in body && !isValidRubro(body.rubro)) {
      return NextResponse.json({ error: "rubro invalido" }, { status: 400 });
    }

    try {
      const categoria = await StockService.getCategoria(organizationId, id);

      if (!categoria) {
        return NextResponse.json({ error: "Categoria no encontrada" }, { status: 404 });
      }

      await StockService.updateCategoria(organizationId, id, {
        ...body,
        nombre: typeof body.nombre === "string" ? body.nombre.trim() : body.nombre,
        descripcion:
          typeof body.descripcion === "string" ? body.descripcion.trim() : body.descripcion,
      });

      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json(
        { error: "No se pudo actualizar la categoria" },
        { status: 500 }
      );
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
      const categoria = await StockService.getCategoria(organizationId, id);

      if (!categoria) {
        return NextResponse.json({ error: "Categoria no encontrada" }, { status: 404 });
      }

      await StockService.desactivarCategoria(organizationId, id);
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json(
        { error: "No se pudo desactivar la categoria" },
        { status: 500 }
      );
    }
  },
  { roles: ["admin", "manager"] }
);
