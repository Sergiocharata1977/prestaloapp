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

function isSuperAdminRole(value: unknown): value is SuperAdminRole {
  return typeof value === "string" && VALID_ROLES.includes(value as SuperAdminRole);
}

function parseOrganizationId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function parsePatchBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return { error: "Payload invalido" as const };
  }

  const payload = body as Record<string, unknown>;
  const role = payload.role;
  const displayName = payload.displayName;
  const organizationId = parseOrganizationId(payload.organizationId);
  const disabled = payload.disabled;
  const resetPassword = payload.resetPassword;

  if (role !== undefined && !isSuperAdminRole(role)) {
    return { error: "Rol invalido" as const };
  }

  if (
    displayName !== undefined &&
    (typeof displayName !== "string" || displayName.trim().length < 3)
  ) {
    return { error: "El nombre debe tener al menos 3 caracteres" as const };
  }

  if (disabled !== undefined && typeof disabled !== "boolean") {
    return { error: "El flag disabled debe ser boolean" as const };
  }

  if (resetPassword !== undefined && typeof resetPassword !== "boolean") {
    return { error: "El flag resetPassword debe ser boolean" as const };
  }

  if (role !== "super_admin" && role !== undefined && !organizationId) {
    return { error: "organizationId es requerido para usuarios de tenant" as const };
  }

  return {
    value: {
      role: role as SuperAdminRole | undefined,
      displayName: typeof displayName === "string" ? displayName.trim() : undefined,
      organizationId: role === "super_admin" ? null : organizationId,
      disabled: disabled as boolean | undefined,
      resetPassword: resetPassword === true,
    },
  };
}

export const GET = withAuth(async (_request, context) => {
  try {
    const { uid } = await context.params;
    const [user, organizations] = await Promise.all([
      auth.getUser(uid),
      buildOrganizationsMap(),
    ]);

    return NextResponse.json({ user: toSuperAdminUser(user, organizations) });
  } catch (error) {
    console.error("Error al obtener usuario global:", error);
    return NextResponse.json(
      { error: "No se pudo cargar el usuario" },
      { status: 500 }
    );
  }
}, SUPER_ADMIN_OPTIONS);

export const PATCH = withAuth(async (request, context) => {
  const parsed = parsePatchBody(await request.json());
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const { uid } = await context.params;
    const [currentUser, organizations] = await Promise.all([
      auth.getUser(uid),
      buildOrganizationsMap(),
    ]);

    const { role, displayName, organizationId, disabled, resetPassword } = parsed.value;

    if (organizationId && !organizations.has(organizationId)) {
      return NextResponse.json(
        { error: "La organización seleccionada no existe" },
        { status: 400 }
      );
    }

    const updateUserPayload: Parameters<typeof auth.updateUser>[1] = {};

    if (displayName !== undefined && displayName !== currentUser.displayName) {
      updateUserPayload.displayName = displayName;
    }

    if (disabled !== undefined && disabled !== currentUser.disabled) {
      updateUserPayload.disabled = disabled;
    }

    if (Object.keys(updateUserPayload).length > 0) {
      await auth.updateUser(uid, updateUserPayload);
    }

    if (role !== undefined) {
      await auth.setCustomUserClaims(uid, buildClaims(role, organizationId));
    }

    let passwordResetLink: string | null = null;
    if (resetPassword && currentUser.email) {
      passwordResetLink = await auth.generatePasswordResetLink(currentUser.email);
    }

    const updatedUser = await auth.getUser(uid);

    return NextResponse.json({
      user: toSuperAdminUser(updatedUser, organizations),
      passwordResetLink,
    });
  } catch (error) {
    console.error("Error al actualizar usuario global:", error);
    return NextResponse.json(
      { error: "No se pudo actualizar el usuario" },
      { status: 500 }
    );
  }
}, SUPER_ADMIN_OPTIONS);

export const DELETE = withAuth(async (_request, context) => {
  try {
    const { uid } = await context.params;
    await auth.deleteUser(uid);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al eliminar usuario global:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar el usuario" },
      { status: 500 }
    );
  }
}, SUPER_ADMIN_OPTIONS);
