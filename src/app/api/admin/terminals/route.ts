import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminFirestore } from "@/firebase/admin";
import { withAuth } from "@/lib/api/withAuth";

export const runtime = "nodejs";

const createTerminalSchema = z.object({
  nombre: z.string().trim().min(1, "nombre es obligatorio"),
  personnel_id: z.string().trim().min(1, "personnel_id es obligatorio"),
});

const PERSONNEL_COLLECTION_CANDIDATES = [
  "personnel",
  "rrhh_personnel",
  "hr_personnel",
  "personal",
] as const;

type PersonnelAssignment = {
  personnel_id: string;
  personnel_nombre?: string;
  empleado_nombre?: string;
  puesto_id?: string;
  puesto_nombre?: string;
  departamento_id?: string;
  departamento_nombre?: string;
};

type TerminalRecord = {
  id: string;
  organization_id: string;
  nombre: string;
  status: string;
  personnel_id: string;
  puesto_id?: string;
  puesto_nombre?: string;
  departamento_id?: string;
  departamento_nombre?: string;
  pairing_code?: string;
  pairing_expires_at?: FirebaseFirestore.Timestamp;
  created_at: FirebaseFirestore.Timestamp;
  updated_at: FirebaseFirestore.Timestamp;
  last_heartbeat?: FirebaseFirestore.Timestamp | null;
  [key: string]: unknown;
};

function requireOrganizationId(organizationId: string | null): string {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  return organizationId;
}

function terminalsCollection(orgId: string) {
  return `organizations/${orgId}/terminals`;
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

async function resolvePersonnelAssignment(
  orgId: string,
  personnelId: string
): Promise<PersonnelAssignment | null> {
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

function mapTerminal(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): TerminalRecord | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...(doc.data() ?? {}),
  } as TerminalRecord;
}

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  try {
    const orgId = requireOrganizationId(auth.organizationId);
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status")?.trim() || null;
    const departamentoId = searchParams.get("departamento_id")?.trim() || null;
    const puestoId = searchParams.get("puesto_id")?.trim() || null;

    let query: FirebaseFirestore.Query = getAdminFirestore()
      .collection(terminalsCollection(orgId))
      .orderBy("last_heartbeat", "desc");

    if (status) {
      query = query.where("status", "==", status);
    }

    if (departamentoId) {
      query = query.where("departamento_id", "==", departamentoId);
    }

    if (puestoId) {
      query = query.where("puesto_id", "==", puestoId);
    }

    const snapshot = await query.get();
    const terminals = snapshot.docs
      .map((doc) => mapTerminal(doc))
      .filter((terminal): terminal is TerminalRecord => terminal !== null);

    return NextResponse.json(terminals);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudieron listar las terminales",
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

    const body = createTerminalSchema.parse(json);
    const personnel = await resolvePersonnelAssignment(orgId, body.personnel_id);

    if (!personnel) {
      return NextResponse.json({ error: "Personnel no existe en la organizacion" }, { status: 404 });
    }

    const db = getAdminFirestore();
    const now = Timestamp.now();
    const ref = db.collection(terminalsCollection(orgId)).doc();
    const pairingCode = await generatePairingCode();

    const terminal: TerminalRecord = {
      id: ref.id,
      organization_id: orgId,
      nombre: body.nombre,
      status: "pending",
      personnel_id: personnel.personnel_id,
      personnel_nombre: personnel.personnel_nombre,
      empleado_nombre: personnel.empleado_nombre,
      puesto_id: personnel.puesto_id,
      puesto_nombre: personnel.puesto_nombre,
      departamento_id: personnel.departamento_id,
      departamento_nombre: personnel.departamento_nombre,
      pairing_code: pairingCode,
      pairing_expires_at: Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000),
      created_at: now,
      updated_at: now,
      last_heartbeat: null,
      created_by: auth.user.uid,
    };

    await ref.set(terminal);

    return NextResponse.json(terminal, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo crear la terminal",
      },
      { status: 400 }
    );
  }
});
