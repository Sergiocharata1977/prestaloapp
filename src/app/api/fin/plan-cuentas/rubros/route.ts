import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { PlanCuentasService } from "@/services/PlanCuentasService";
import type { FinRubro } from "@/types/fin-plan-cuentas";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, _ctx, { organizationId }) => {
  const rubros = await PlanCuentasService.getRubros(organizationId!);
  return NextResponse.json({ rubros });
});

export const POST = withAuth(
  async (req, _ctx, { organizationId }) => {
    const body = (await req.json()) as Omit<FinRubro, "id" | "organization_id">;
    if (!body.codigo || !body.nombre || !body.naturaleza) {
      return NextResponse.json({ error: "codigo, nombre y naturaleza son requeridos" }, { status: 400 });
    }
    const id = await PlanCuentasService.crearRubro(organizationId!, body);
    return NextResponse.json({ id }, { status: 201 });
  },
  { roles: ["admin", "manager"] }
);
