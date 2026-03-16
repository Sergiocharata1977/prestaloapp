import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { getAdminFirestore } from "@/firebase/admin";
import { FIN_COLLECTIONS } from "@/firebase/collections";
import type { FinAsiento } from "@/types/fin-asiento";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, _ctx, { organizationId }) => {
  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const origen = searchParams.get("origen");

  const db = getAdminFirestore();
  let q = db
    .collection(FIN_COLLECTIONS.asientos(organizationId!))
    .orderBy("fecha", "desc")
    .limit(50);

  if (desde) q = q.where("fecha", ">=", desde) as typeof q;
  if (hasta) q = q.where("fecha", "<=", hasta) as typeof q;
  if (origen) q = q.where("origen", "==", origen) as typeof q;

  const snap = await q.get();
  const asientos: FinAsiento[] = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as FinAsiento)
  );
  return NextResponse.json({ asientos });
});
