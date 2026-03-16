import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { getAdminFirestore } from "@/firebase/admin";
import { FIN_COLLECTIONS } from "@/firebase/collections";
import type { FinAsiento } from "@/types/fin-asiento";

export const dynamic = "force-dynamic";

export type MayorMovimiento = {
  asiento_id: string;
  fecha: string;
  origen: string;
  descripcion: string;
  debe: number;
  haber: number;
};

export const GET = withAuth(async (req, _ctx, { organizationId }) => {
  const orgId = organizationId!;
  const { searchParams } = new URL(req.url);
  const cuentaId = searchParams.get("cuenta_id");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  if (!cuentaId) {
    return NextResponse.json({ error: "cuenta_id requerido" }, { status: 400 });
  }

  const db = getAdminFirestore();
  let q = db
    .collection(FIN_COLLECTIONS.asientos(orgId))
    .orderBy("fecha") as FirebaseFirestore.Query;

  if (desde) q = q.where("fecha", ">=", desde);
  if (hasta) q = q.where("fecha", "<=", hasta + "T23:59:59");

  const snap = await q.get();

  const movimientos: MayorMovimiento[] = [];

  for (const doc of snap.docs) {
    const a = { id: doc.id, ...doc.data() } as FinAsiento;
    for (const linea of a.lineas) {
      if (linea.cuenta_id === cuentaId) {
        movimientos.push({
          asiento_id: a.id,
          fecha: a.fecha,
          origen: a.origen,
          descripcion: linea.descripcion,
          debe: linea.debe,
          haber: linea.haber,
        });
      }
    }
  }

  const total_debe = movimientos.reduce((s, m) => s + m.debe, 0);
  const total_haber = movimientos.reduce((s, m) => s + m.haber, 0);

  return NextResponse.json({
    movimientos,
    total_debe,
    total_haber,
    saldo: total_debe - total_haber,
  });
});
