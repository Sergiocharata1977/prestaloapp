import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminFirestore } from "@/firebase/admin";
import { withAuth } from "@/lib/api/withAuth";

export const runtime = "nodejs";

const updateTerminalSchema = z
  .object({
    nombre: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    personnel_id: z.string().trim().min(1).optional(),
    action: z.enum(["quarantine", "revoke_reactivate"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Debe enviar al menos un campo a actualizar",
  })
  .refine(
    (value) =>
      !value.action ||
      (!value.nombre && !value.status && !value.personnel_id),
    {
      message: "action no se puede combinar con otros campos",
      path: ["action"],
    }
  );

async function generatePairingCode(): Promise<string> {
  const db = getAdminFirestore();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const chunk = () =>
      Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(
        ""
      );
    const pairingCode = `DC-${chunk()}-${chunk()}`;

    const existing = await db
      .collectionGroup("terminals")
      .where("pairing_code", "==", pairingCode)
      .limit(1)
      .get();

    if (existing.empty) {
      return pairingCode;
    }
  }

  throw new Error("No se pudo generar un pairing_code unico");
}

const PERSONNEL_COLLECTION_CANDIDATES = [
  "personnel",
  "rrhh_personnel",
  "hr_personnel",
  "personal",
] as const;

type RouteParams = { id: string };

function requireOrganizationId(organizationId: string | null): string {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  return organizationId;
}

function terminalDocPath(orgId: string, terminalId: string) {
  return `organizations/${orgId}/terminals/${terminalId}`;
}

function toTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getNestedString(
  raw: Record<string, unknown>,
  ...paths: string[][]
): string | undefined {
  for (const path of paths) {
    let current: unknown = raw;

    for (const key of path) {
      if (!current || typeof current !== "object") {
        current = undefined;
        break;
      }

      current = (current as Record<string, unknown>)[key];
    }

    const value = toTrimmedString(current);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function resolvePersonnelName(raw: Record<string, unknown>): string | undefined {
  const directName = getNestedString(
    raw,
    ["empleado_nombre"],
    ["personnel_nombre"],
    ["nombre_completo"],
    ["full_name"],
    ["display_name"],
    ["name"],
    ["nombre"]
  );

  if (directName) {
    return directName;
  }

  const firstName = getNestedString(raw, ["first_name"], ["given_name"], ["nombre"]);
  const lastName = getNestedString(raw, ["last_name"], ["family_name"], ["apellido"]);
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim();

  return combined || undefined;
}

async function resolvePersonnelAssignment(orgId: string, personnelId: string) {
  const db = getAdminFirestore();

  for (const collectionName of PERSONNEL_COLLECTION_CANDIDATES) {
    const doc = await db
      .doc(`organizations/${orgId}/${collectionName}/${personnelId}`)
      .get();

    if (!doc.exists) {
      continue;
    }

    const raw = doc.data() ?? {};

    return {
      personnel_id: doc.id,
      personnel_nombre: resolvePersonnelName(raw),
      empleado_nombre: resolvePersonnelName(raw),
      puesto_id: getNestedString(
        raw,
        ["puesto_id"],
        ["position_id"],
        ["puesto", "id"],
        ["position", "id"]
      ),
      puesto_nombre: getNestedString(
        raw,
        ["puesto_nombre"],
        ["position_name"],
        ["puesto", "nombre"],
        ["position", "name"],
        ["puesto", "name"]
      ),
      departamento_id: getNestedString(
        raw,
        ["departamento_id"],
        ["department_id"],
        ["departamento", "id"],
        ["department", "id"]
      ),
      departamento_nombre: getNestedString(
        raw,
        ["departamento_nombre"],
        ["department_name"],
        ["departamento", "nombre"],
        ["department", "name"],
        ["departamento", "name"]
      ),
    };
  }

  return null;
}

export const GET = withAuth<RouteParams>(async (_request, context, auth) => {
  try {
    const orgId = requireOrganizationId(auth.organizationId);
    const { id } = await context.params;
    const doc = await getAdminFirestore().doc(terminalDocPath(orgId, id)).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Terminal no encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      id: doc.id,
      ...(doc.data() ?? {}),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo obtener la terminal",
      },
      { status: 400 }
    );
  }
});

export const PATCH = withAuth<RouteParams>(async (request, context, auth) => {
  try {
    const orgId = requireOrganizationId(auth.organizationId);
    const { id } = await context.params;
    const db = getAdminFirestore();
    const ref = db.doc(terminalDocPath(orgId, id));
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: "Terminal no encontrada" }, { status: 404 });
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json({ error: "Body requerido" }, { status: 400 });
    }

    const body = updateTerminalSchema.parse(json);
    const now = Timestamp.now();
    const updates: Record<string, unknown> = {
      updated_at: now,
      updated_by: auth.user.uid,
    };

    if (body.action === "quarantine") {
      updates.status = "quarantined";
      updates.status_updated_at = now;
      updates.quarantined_at = now;
      updates.terminal_token_revoked_at = now;
    }

    if (body.action === "revoke_reactivate") {
      const pairingCode = await generatePairingCode();

      updates.status = "pending";
      updates.status_updated_at = now;
      updates.quarantined_at = FieldValue.delete();
      updates.terminal_token_revoked_at = now;
      updates.pairing_code = pairingCode;
      updates.pairing_expires_at = Timestamp.fromMillis(
        now.toMillis() + 24 * 60 * 60 * 1000
      );
      updates.reactivated_at = now;
    }

    if (body.nombre) {
      updates.nombre = body.nombre;
    }

    if (body.status) {
      updates.status = body.status;
      updates.status_updated_at = now;

      if (body.status === "quarantined") {
        updates.quarantined_at = now;
        updates.terminal_token_revoked_at = now;
      } else {
        updates.quarantined_at = FieldValue.delete();
      }
    }

    if (body.personnel_id) {
      const personnel = await resolvePersonnelAssignment(orgId, body.personnel_id);

      if (!personnel) {
        return NextResponse.json(
          { error: "Personnel no existe en la organizacion" },
          { status: 404 }
        );
      }

      updates.personnel_id = personnel.personnel_id;
      updates.personnel_nombre = personnel.personnel_nombre ?? FieldValue.delete();
      updates.empleado_nombre = personnel.empleado_nombre ?? FieldValue.delete();
      updates.puesto_id = personnel.puesto_id ?? FieldValue.delete();
      updates.puesto_nombre = personnel.puesto_nombre ?? FieldValue.delete();
      updates.departamento_id = personnel.departamento_id ?? FieldValue.delete();
      updates.departamento_nombre = personnel.departamento_nombre ?? FieldValue.delete();
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
        error: error instanceof Error ? error.message : "No se pudo actualizar la terminal",
      },
      { status: 400 }
    );
  }
});
