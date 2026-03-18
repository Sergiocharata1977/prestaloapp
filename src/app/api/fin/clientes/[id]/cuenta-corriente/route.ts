import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { getAdminFirestore } from "@/firebase/admin";
import { FIN_COLLECTIONS } from "@/firebase/collections";
import type { FinCobro } from "@/types/fin-cobro";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, ctx, { organizationId }) => {
  const orgId = organizationId!;
  const { id: clienteId } = await ctx.params;
  const db = getAdminFirestore();

  const snap = await db
    .collection(FIN_COLLECTIONS.cobros(orgId))
    .where("cliente_id", "==", clienteId)
    .orderBy("fecha_cobro", "desc")
    .get();

  const cobros: FinCobro[] = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as FinCobro)
  );

  const total_cobrado = cobros.reduce((s, c) => s + c.total_cobrado, 0);
  const total_capital = cobros.reduce((s, c) => s + c.capital_cobrado, 0);
  const total_intereses = cobros.reduce((s, c) => s + c.interes_cobrado, 0);

  return NextResponse.json({ cobros, total_cobrado, total_capital, total_intereses });
});
