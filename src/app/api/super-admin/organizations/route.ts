import "server-only";

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/firebase/admin";
import { SUPER_ADMIN_OPTIONS } from "@/lib/api/superAdminAuth";
import { withAuth } from "@/lib/api/withAuth";
import {
  parseCreateOrganizationBody,
  provisionOrganizationWithAdmin,
  toOrganization,
} from "@/lib/super-admin/provisionOrganization";

export const GET = withAuth(async () => {
  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection("organizations").orderBy("createdAt", "desc").get();
    const organizations = await Promise.all(
      snapshot.docs.map((doc) => toOrganization(doc))
    );

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error("Error al listar organizaciones:", error);
    return NextResponse.json(
      { error: "No se pudieron cargar las organizaciones" },
      { status: 500 }
    );
  }
}, SUPER_ADMIN_OPTIONS);

export const POST = withAuth(async (request) => {
  const parsed = parseCreateOrganizationBody(await request.json());
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const { organization } = await provisionOrganizationWithAdmin(parsed.value);
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    console.error("Error al crear organización:", error);
    return NextResponse.json(
      { error: "No se pudo crear la organización" },
      { status: 500 }
    );
  }
}, SUPER_ADMIN_OPTIONS);
