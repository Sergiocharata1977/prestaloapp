import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { getAdminFirestore } from "@/firebase/admin";
import { FIN_COLLECTIONS } from "@/firebase/collections";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, _ctx, { organizationId }) => {
  const orgId = organizationId!;
  const db = getAdminFirestore();

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const [clientesSnap, creditosSnap, cobrosHoySnap] = await Promise.all([
    db.collection(FIN_COLLECTIONS.clientes(orgId)).select().get(),
    db
      .collection(FIN_COLLECTIONS.creditos(orgId))
      .where("estado", "==", "activo")
      .select("saldo_capital")
      .get(),
    db
      .collection(FIN_COLLECTIONS.cobros(orgId))
      .where("fecha_cobro", ">=", today)
      .where("fecha_cobro", "<", tomorrow)
      .select("total_cobrado")
      .get(),
  ]);

  const montoCartera = creditosSnap.docs.reduce(
    (sum, doc) => sum + (Number(doc.data().saldo_capital) || 0),
    0
  );
  const montoCobrosHoy = cobrosHoySnap.docs.reduce(
    (sum, doc) => sum + (Number(doc.data().total_cobrado) || 0),
    0
  );

  return NextResponse.json({
    total_clientes: clientesSnap.size,
    creditos_activos: creditosSnap.size,
    monto_cartera: montoCartera,
    cobros_hoy: cobrosHoySnap.size,
    monto_cobros_hoy: montoCobrosHoy,
  });
});
