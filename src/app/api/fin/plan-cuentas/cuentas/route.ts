import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { PlanCuentasService } from "@/services/PlanCuentasService";
import type { FinCuenta } from "@/types/fin-plan-cuentas";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, _ctx, { organizationId }) => {
  const { searchParams } = new URL(req.url);
  const rubroId = searchParams.get("rubroId") ?? undefined;
  const cuentas = await PlanCuentasService.getCuentas(organizationId!, rubroId);
  return NextResponse.json({ cuentas });
});

export const POST = withAuth(
  async (req, _ctx, { organizationId }) => {
    const body = (await req.json()) as Omit<FinCuenta, "id" | "organization_id">;
    if (!body.codigo || !body.nombre) {
      return NextResponse.json({ error: "codigo y nombre son requeridos" }, { status: 400 });
    }
    const id = await PlanCuentasService.crearCuenta(organizationId!, body);
    return NextResponse.json({ id }, { status: 201 });
  },
  { roles: ["admin", "manager"] }
);
