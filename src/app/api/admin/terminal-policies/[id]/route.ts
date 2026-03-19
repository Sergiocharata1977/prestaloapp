import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminFirestore } from "@/firebase/admin";
import { withAuth } from "@/lib/api/withAuth";

export const runtime = "nodejs";

const updateTerminalPolicySchema = z
  .object({
    nombre: z.string().trim().min(1).optional(),
    departamento_id: z.string().trim().min(1).nullable().optional(),
    puesto_id: z.string().trim().min(1).nullable().optional(),
    terminal_id: z.string().trim().min(1).nullable().optional(),
    allowed_tools: z.array(z.string().trim().min(1)).optional(),
    require_approval_for: z.array(z.string().trim().min(1)).optional(),
    prioridad: z.number().int().optional(),
    allowed_hours: z.unknown().optional(),
    activo: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Debe enviar al menos un campo a actualizar",
  });

type RouteParams = { id: string };

function requireOrganizationId(organizationId: string | null): string {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  return organizationId;
}

function terminalPolicyDocPath(orgId: string, id: string) {
  return `organizations/${orgId}/terminal_policy/${id}`;
}

function mapNullableString(value: string | null | undefined) {
  return value === null ? FieldValue.delete() : value;
}

export const PATCH = withAuth<RouteParams>(async (request, context, auth) => {
  try {
    const orgId = requireOrganizationId(auth.organizationId);
    const { id } = await context.params;
    const ref = getAdminFirestore().doc(terminalPolicyDocPath(orgId, id));
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: "Politica no encontrada" }, { status: 404 });
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json({ error: "Body requerido" }, { status: 400 });
    }

    const body = updateTerminalPolicySchema.parse(json);
    const updates: Record<string, unknown> = {
      updated_at: Timestamp.now(),
      updated_by: auth.user.uid,
    };

    if (body.nombre !== undefined) {
      updates.nombre = body.nombre;
    }

    if (body.departamento_id !== undefined) {
      updates.departamento_id = mapNullableString(body.departamento_id);
    }

    if (body.puesto_id !== undefined) {
      updates.puesto_id = mapNullableString(body.puesto_id);
    }

    if (body.terminal_id !== undefined) {
      updates.terminal_id = mapNullableString(body.terminal_id);
    }

    if (body.allowed_tools !== undefined) {
      updates.allowed_tools = body.allowed_tools;
    }

    if (body.require_approval_for !== undefined) {
      updates.require_approval_for = body.require_approval_for;
    }

    if (body.prioridad !== undefined) {
      updates.prioridad = body.prioridad;
    }

    if (body.allowed_hours !== undefined) {
      updates.allowed_hours = body.allowed_hours;
    }

    if (body.activo !== undefined) {
      updates.activo = body.activo;
    }

    await ref.update(updates);

    const updated = await ref.get();
    return NextResponse.json({
      id: updated.id,
      ...(updated.data() ?? {}),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo actualizar la politica",
      },
      { status: 400 }
    );
  }
});
