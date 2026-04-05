import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { PlanCuentasService } from "@/services/PlanCuentasService";

export const dynamic = "force-dynamic";

const PLUGIN = "financiacion_consumo";

export const GET = withAuth(async (_req, _ctx, { organizationId }) => {
  const config = await PlanCuentasService.getConfigCuentas(organizationId!, PLUGIN);
  return NextResponse.json({ config });
});

export const PUT = withAuth(
  async (req, _ctx, { organizationId }) => {
    const body = await req.json() as {
      creditos_por_financiaciones: string;
      intereses_no_devengados: string;
      ventas_financiadas: string;
      intereses_ganados: string;
      cuenta_creditos_ctacte?: string;
      cuenta_ventas_ctacte?: string;
      cuenta_ingresos_mora?: string;
      cuenta_ingresos_gastos_adm?: string;
    };
    const required = ["creditos_por_financiaciones", "intereses_no_devengados", "ventas_financiadas", "intereses_ganados"];
    if (required.some((k) => !body[k as keyof typeof body])) {
      return NextResponse.json({ error: "Los 4 campos de cuentas son requeridos" }, { status: 400 });
    }
    await PlanCuentasService.upsertConfigCuentas(organizationId!, PLUGIN, body);
    return NextResponse.json({ ok: true });
  },
  { roles: ["admin", "manager"] }
);
