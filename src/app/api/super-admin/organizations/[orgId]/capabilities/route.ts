import "server-only";

import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { auth, getAdminFirestore } from "@/firebase/admin";
import { SUPER_ADMIN_OPTIONS } from "@/lib/api/superAdminAuth";
import { withAuth } from "@/lib/api/withAuth";
import { CAPABILITIES } from "@/lib/capabilities";

export const dynamic = "force-dynamic";

const VALID_CAPABILITIES = Object.values(CAPABILITIES) as string[];

function parseCapabilities(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const { capabilities } = body as Record<string, unknown>;
  if (!Array.isArray(capabilities)) return null;
  const valid = capabilities.filter(
    (c): c is string => typeof c === "string" && VALID_CAPABILITIES.includes(c)
  );
  return valid;
}

export const PATCH = withAuth(async (request, context) => {
  const { orgId } = await context.params;
  const db = getAdminFirestore();

  const json = await request.json().catch(() => null);
  const capabilities = parseCapabilities(json);
  if (capabilities === null) {
    return NextResponse.json(
      { error: "capabilities debe ser un array de strings" },
      { status: 400 }
    );
  }

  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
  }

  // Update org document
  await orgRef.update({ capabilities, updatedAt: Timestamp.now() });

  // Sync capabilities to all users in this org (update their JWT custom claims)
  try {
    const usersInOrg = await auth.listUsers(1000);
    const orgUsers = usersInOrg.users.filter(
      (u) =>
        u.customClaims &&
        typeof u.customClaims === "object" &&
        (u.customClaims as Record<string, unknown>).organizationId === orgId
    );

    await Promise.all(
      orgUsers.map((u) => {
        const currentClaims = (u.customClaims ?? {}) as Record<string, unknown>;
        return auth.setCustomUserClaims(u.uid, {
          ...currentClaims,
          capabilities,
        });
      })
    );
  } catch (syncError) {
    console.error("Error sincronizando capabilities a usuarios:", syncError);
    // Non-fatal: org doc was updated, user claims sync failed
  }

  return NextResponse.json({ capabilities });
}, SUPER_ADMIN_OPTIONS);
