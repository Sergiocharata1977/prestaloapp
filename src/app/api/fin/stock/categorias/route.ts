import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import { StockService } from "@/services/StockService";
import type { FinStockCategoriaInput, FinStockRubro } from "@/types/fin-stock";

export const dynamic = "force-dynamic";

function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidRubro(value: unknown): value is FinStockRubro {
  return (
    value === "electrodomesticos" ||
    value === "tecnologia" ||
    value === "ropa_calzado" ||
    value === "muebles_hogar" ||
    value === "otro"
  );
}

export const GET = withAuth(async (_req, _ctx, { organizationId }) => {
  if (!organizationId) {
    return NextResponse.json({ error: "Organization required" }, { status: 403 });
  }

  try {
    const categorias = await StockService.getCategorias(organizationId);
    return NextResponse.json({ categorias });
  } catch {
    return NextResponse.json(
      { error: "No se pudieron obtener las categorias" },
      { status: 500 }
    );
  }
});

export const POST = withAuth(
  async (req, _ctx, { organizationId, user }) => {
    if (!organizationId) {
      return NextResponse.json({ error: "Organization required" }, { status: 403 });
    }

    let body: FinStockCategoriaInput;

    try {
      body = (await req.json()) as FinStockCategoriaInput;
    } catch {
      return NextResponse.json({ error: "Body invalido" }, { status: 400 });
    }

    if (!isValidString(body?.nombre)) {
      return NextResponse.json({ error: "nombre es requerido" }, { status: 400 });
    }

    if (!isValidRubro(body?.rubro)) {
      return NextResponse.json({ error: "rubro es requerido" }, { status: 400 });
    }

    try {
      const categoria = await StockService.createCategoria(
        organizationId,
        {
          ...body,
          nombre: body.nombre.trim(),
          descripcion: typeof body.descripcion === "string" ? body.descripcion.trim() : body.descripcion,
        },
        user.uid
      );

      return NextResponse.json({ categoria });
    } catch {
      return NextResponse.json(
        { error: "No se pudo crear la categoria" },
        { status: 500 }
      );
    }
  },
  { roles: ["admin", "manager"] }
);
