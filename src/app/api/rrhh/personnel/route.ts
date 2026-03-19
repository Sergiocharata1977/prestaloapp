import { NextRequest, NextResponse } from "next/server";

import { getAdminFirestore } from "@/firebase/admin";
import { withAuth } from "@/lib/api/withAuth";

export const runtime = "nodejs";

const PERSONNEL_COLLECTION_CANDIDATES = [
  "personnel",
  "rrhh_personnel",
  "hr_personnel",
  "personal",
] as const;

type PersonnelRecord = {
  id: string;
  nombre: string;
  puesto_nombre?: string;
  departamento_nombre?: string;
};

function requireOrganizationId(organizationId: string | null): string {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  return organizationId;
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

function resolvePersonnelName(raw: Record<string, unknown>, fallbackId: string) {
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

  return combined || fallbackId;
}

function toSearchableText(raw: Record<string, unknown>, id: string) {
  return [
    id,
    resolvePersonnelName(raw, id),
    getNestedString(raw, ["email"]),
    getNestedString(raw, ["documento"]),
    getNestedString(raw, ["dni"]),
    getNestedString(raw, ["puesto_nombre"], ["position_name"], ["puesto", "nombre"]),
    getNestedString(
      raw,
      ["departamento_nombre"],
      ["department_name"],
      ["departamento", "nombre"]
    ),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("es-AR");
}

function mapPersonnel(doc: FirebaseFirestore.QueryDocumentSnapshot): PersonnelRecord {
  const raw = (doc.data() ?? {}) as Record<string, unknown>;

  return {
    id: doc.id,
    nombre: resolvePersonnelName(raw, doc.id),
    puesto_nombre: getNestedString(
      raw,
      ["puesto_nombre"],
      ["position_name"],
      ["puesto", "nombre"],
      ["position", "name"]
    ),
    departamento_nombre: getNestedString(
      raw,
      ["departamento_nombre"],
      ["department_name"],
      ["departamento", "nombre"],
      ["department", "name"]
    ),
  };
}

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    const orgId = requireOrganizationId(auth.organizationId);
    const search = request.nextUrl.searchParams.get("search")?.trim().toLocaleLowerCase("es-AR") ?? "";
    const db = getAdminFirestore();
    const seen = new Set<string>();
    const personnel: PersonnelRecord[] = [];

    for (const collectionName of PERSONNEL_COLLECTION_CANDIDATES) {
      const snapshot = await db
        .collection(`organizations/${orgId}/${collectionName}`)
        .limit(search ? 50 : 20)
        .get()
        .catch(() => null);

      if (!snapshot) {
        continue;
      }

      for (const doc of snapshot.docs) {
        if (seen.has(doc.id)) {
          continue;
        }

        const raw = (doc.data() ?? {}) as Record<string, unknown>;
        if (search && !toSearchableText(raw, doc.id).includes(search)) {
          continue;
        }

        seen.add(doc.id);
        personnel.push(mapPersonnel(doc));
      }
    }

    personnel.sort((left, right) => left.nombre.localeCompare(right.nombre, "es-AR"));

    return NextResponse.json({ personnel });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo obtener el personal",
      },
      { status: 400 }
    );
  }
});
