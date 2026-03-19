import "server-only";

import { NextResponse } from "next/server";
import { auth, getAdminFirestore } from "@/firebase/admin";
import { SUPER_ADMIN_OPTIONS } from "@/lib/api/superAdminAuth";
import { withAuth } from "@/lib/api/withAuth";
import type { Organization, SuperAdminRole, SuperAdminUser } from "@/types/super-admin";

const VALID_ROLES: SuperAdminRole[] = [
  "super_admin",
  "admin",
  "gerente",
  "operador",
  "manager",
  "operator",
];

type CreateUserPayload = {
  email: string;
  password: string;
  displayName: string;
  role: SuperAdminRole;
  organizationId: string | null;
};

function isSuperAdminRole(value: unknown): value is SuperAdminRole {
  return typeof value === "string" && VALID_ROLES.includes(value as SuperAdminRole);
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildClaims(role: SuperAdminRole, organizationId: string | null) {
  if (role === "super_admin") {
    return { admin: true, role, organizationId: null };
  }

  return {
    admin: role === "admin",
    role,
    organizationId,
  };
}

function parseOrganizationId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseCreateBody(body: unknown):
  | { error: string }
  | { value: CreateUserPayload } {
  if (!body || typeof body !== "object") {
    return { error: "Payload invalido" };
  }

  const { email, password, displayName, role, organizationId } = body as Record<
    string,
    unknown
  >;

  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return { error: "Email invalido" };
  }

  if (typeof password !== "string" || password.trim().length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres" };
  }

  if (typeof displayName !== "string" || displayName.trim().length < 3) {
    return { error: "El nombre debe tener al menos 3 caracteres" };
  }

  if (!isSuperAdminRole(role)) {
    return { error: "Rol invalido" };
  }

  const normalizedOrganizationId = parseOrganizationId(organizationId);
  if (role !== "super_admin" && !normalizedOrganizationId) {
    return { error: "organizationId es requerido para usuarios de tenant" };
  }

  return {
    value: {
      email: email.trim().toLowerCase(),
      password: password.trim(),
      displayName: displayName.trim(),
      role,
      organizationId: role === "super_admin" ? null : normalizedOrganizationId,
    },
  };
}

async function listAllUsers() {
  const users = [];
  let nextPageToken: string | undefined;

  do {
    const page = await auth.listUsers(1000, nextPageToken);
    users.push(...page.users);
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  return users;
}

async function buildOrganizationsMap() {
  const db = getAdminFirestore();
  const snapshot = await db.collection("organizations").get();
  const map = new Map<string, string>();

  for (const doc of snapshot.docs) {
    const data = doc.data() as Partial<Organization>;
    const name =
      typeof data.name === "string" && data.name.trim().length > 0
        ? data.name
        : doc.id;
    map.set(doc.id, name);
  }

  return map;
}

function toSuperAdminUser(
  user: Awaited<ReturnType<typeof auth.getUser>>,
  organizations: Map<string, string>
): SuperAdminUser {
  const claims = user.customClaims ?? {};
  const role = isSuperAdminRole(claims.role) ? claims.role : null;
  const organizationId =
    typeof claims.organizationId === "string" && claims.organizationId
      ? claims.organizationId
      : null;

  return {
    id: user.uid,
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    role,
    organizationId,
    organizationName: organizationId ? organizations.get(organizationId) ?? organizationId : null,
    disabled: user.disabled,
    createdAt: toIsoDate(user.metadata.creationTime),
    lastSignInAt: toIsoDate(user.metadata.lastSignInTime),
    admin: claims.admin === true,
  };
}

export const GET = withAuth(async () => {
  try {
    const [users, organizations] = await Promise.all([
      listAllUsers(),
      buildOrganizationsMap(),
    ]);

    const serializedUsers = users
      .map((user) => toSuperAdminUser(user, organizations))
      .sort((left, right) => {
        const leftDate = left.lastSignInAt ?? left.createdAt ?? "";
        const rightDate = right.lastSignInAt ?? right.createdAt ?? "";
        return rightDate.localeCompare(leftDate);
      });

    return NextResponse.json({ users: serializedUsers });
  } catch (error) {
    console.error("Error al listar usuarios globales:", error);
    return NextResponse.json(
      { error: "No se pudieron cargar los usuarios" },
      { status: 500 }
    );
  }
}, SUPER_ADMIN_OPTIONS);

export const POST = withAuth(async (request) => {
  const parsed = parseCreateBody(await request.json());
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { email, password, displayName, role, organizationId } = parsed.value;
  const organizations = await buildOrganizationsMap();

  if (organizationId && !organizations.has(organizationId)) {
    return NextResponse.json(
      { error: "La organización seleccionada no existe" },
      { status: 400 }
    );
  }

  try {
    const createdUser = await auth.createUser({
      email,
      password,
      displayName,
    });

    await auth.setCustomUserClaims(createdUser.uid, buildClaims(role, organizationId));
    const user = await auth.getUser(createdUser.uid);

    return NextResponse.json(
      { user: toSuperAdminUser(user, organizations) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al crear usuario global:", error);
    return NextResponse.json(
      { error: "No se pudo crear el usuario" },
      { status: 500 }
    );
  }
}, SUPER_ADMIN_OPTIONS);
