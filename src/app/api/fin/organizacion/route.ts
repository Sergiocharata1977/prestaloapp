import "server-only";

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { getAdminFirestore } from "@/firebase/admin";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, _ctx, { organizationId }) => {
  if (!organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getAdminFirestore();
  const doc = await db.collection("organizations").doc(organizationId).get();
  if (!doc.exists) {
    return NextResponse.json({ name: organizationId, plan: "free" });
  }
  const data = doc.data() ?? {};
  return NextResponse.json({
    id: doc.id,
    name: typeof data.name === "string" ? data.name : organizationId,
    plan: typeof data.plan === "string" ? data.plan : "free",
    status: typeof data.status === "string" ? data.status : "active",
  });
});
