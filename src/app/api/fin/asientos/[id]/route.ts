import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { getAdminFirestore } from "@/firebase/admin";
import { FIN_COLLECTIONS } from "@/firebase/collections";
import type { FinAsiento } from "@/types/fin-asiento";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, ctx, { organizationId }) => {
  const { id } = await ctx.params;
  const db = getAdminFirestore();
  const doc = await db.doc(FIN_COLLECTIONS.asiento(organizationId!, id)).get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Asiento no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ id: doc.id, ...doc.data() } as FinAsiento);
});
