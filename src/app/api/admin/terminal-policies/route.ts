import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminFirestore } from "@/firebase/admin";
import { withAuth } from "@/lib/api/withAuth";

export const runtime = "nodejs";

const createTerminalPolicySchema = z
  .object({
    nombre: z.string().trim().min(1, "nombre es obligatorio"),
    departamento_id: z.string().trim().min(1).optional(),
    puesto_id: z.string().trim().min(1).optional(),
    terminal_id: z.string().trim().min(1).optional(),
    allowed_tools: z.array(z.string().trim().min(1)).default([]),
    require_approval_for: z.array(z.string().trim().min(1)).default([]),
    prioridad: z.number().int("prioridad debe ser entera"),
    allowed_hours: z.unknown().optional(),
    activo: z.boolean().optional(),
  })
  .refine(
    (value) =>
      Boolean(value.departamento_id || value.puesto_id || value.terminal_id),
    {
      message: "Al menos uno de departamento_id, puesto_id o terminal_id es requerido",
      path: ["departamento_id"],
    }
  );

type TerminalPolicy = {
  id: string;
  organization_id: string;
  nombre: string;
  prioridad: number;
  activo: boolean;
  [key: string]: unknown;
};

function requireOrganizationId(organizationId: string | null): string {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  return organizationId;
}

function terminalPoliciesCollection(orgId: string) {
  return `organizations/${orgId}/terminal_policy`;
}

function mapPolicy(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): TerminalPolicy | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...(doc.data() ?? {}),
  } as TerminalPolicy;
}

export const GET = withAuth(async (_request: NextRequest, _context, auth) => {
  try {
    const orgId = requireOrganizationId(auth.organizationId);
    const snapshot = await getAdminFirestore()
      .collection(terminalPoliciesCollection(orgId))
      .orderBy("prioridad", "desc")
      .get();

    const policies = snapshot.docs
      .map((doc) => mapPolicy(doc))
      .filter((policy): policy is TerminalPolicy => policy !== null);

    return NextResponse.json(policies);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudieron listar las politicas",
      },
      { status: 400 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    const orgId = requireOrganizationId(auth.organizationId);
    const json = await request.json().catch(() => null);

    if (!json) {
      return NextResponse.json({ error: "Body requerido" }, { status: 400 });
    }

    const body = createTerminalPolicySchema.parse(json);
    const db = getAdminFirestore();
    const ref = db.collection(terminalPoliciesCollection(orgId)).doc();
    const now = Timestamp.now();

    const policy: TerminalPolicy = {
      id: ref.id,
      organization_id: orgId,
      nombre: body.nombre,
      departamento_id: body.departamento_id,
      puesto_id: body.puesto_id,
      terminal_id: body.terminal_id,
      allowed_tools: body.allowed_tools,
      require_approval_for: body.require_approval_for,
      prioridad: body.prioridad,
      allowed_hours: body.allowed_hours,
      activo: body.activo ?? true,
      created_at: now,
      updated_at: now,
      created_by: auth.user.uid,
    };

    await ref.set(policy);

    return NextResponse.json(policy, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo crear la politica",
      },
      { status: 400 }
    );
  }
});
