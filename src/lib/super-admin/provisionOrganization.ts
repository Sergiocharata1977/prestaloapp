import "server-only";

import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { auth, getAdminFirestore } from "@/firebase/admin";
import type { Organization, OrganizationPlan, OrganizationStatus } from "@/types/super-admin";

const VALID_PLANS: OrganizationPlan[] = ["free", "pro", "enterprise"];
const VALID_STATUSES: OrganizationStatus[] = ["active", "inactive"];

type FirestoreOrganization = {
  name?: unknown;
  slug?: unknown;
  plan?: unknown;
  status?: unknown;
  adminEmail?: unknown;
  adminUid?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ProvisionOrganizationInput = {
  name: string;
  plan: OrganizationPlan;
  adminEmail: string;
  temporaryPassword: string;
};

export function isOrganizationPlan(value: unknown): value is OrganizationPlan {
  return typeof value === "string" && VALID_PLANS.includes(value as OrganizationPlan);
}

export function isOrganizationStatus(value: unknown): value is OrganizationStatus {
  return (
    typeof value === "string" && VALID_STATUSES.includes(value as OrganizationStatus)
  );
}

export function serializeTimestamp(value: unknown): string | null {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}

async function getOrganizationMetrics(orgId: string) {
  const db = getAdminFirestore();
  const [clientsCount, creditsCount] = await Promise.all([
    db.collection(`organizations/${orgId}/fin_clientes`).count().get(),
    db.collection(`organizations/${orgId}/fin_creditos`).count().get(),
  ]);

  return {
    clients: clientsCount.data().count,
    credits: creditsCount.data().count,
  };
}

export async function toOrganization(
  doc:
    | FirebaseFirestore.QueryDocumentSnapshot<DocumentData>
    | FirebaseFirestore.DocumentSnapshot<DocumentData>
): Promise<Organization> {
  const data = (doc.data() ?? {}) as FirestoreOrganization;
  const metrics = await getOrganizationMetrics(doc.id);

  return {
    id: doc.id,
    name: typeof data.name === "string" ? data.name : "Sin nombre",
    slug: typeof data.slug === "string" ? data.slug : doc.id,
    plan: isOrganizationPlan(data.plan) ? data.plan : "free",
    status: isOrganizationStatus(data.status) ? data.status : "inactive",
    adminEmail: typeof data.adminEmail === "string" ? data.adminEmail : "",
    adminUid: typeof data.adminUid === "string" ? data.adminUid : "",
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
    metrics,
  };
}

export function slugifyOrganizationName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "organizacion";
}

export function buildOrganizationId(name: string) {
  return `${slugifyOrganizationName(name)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseCreateOrganizationBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return { error: "Payload invalido" as const };
  }

  const { name, plan, adminEmail, temporaryPassword } = body as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length < 3) {
    return { error: "El nombre debe tener al menos 3 caracteres" as const };
  }

  if (!isOrganizationPlan(plan)) {
    return { error: "Plan invalido" as const };
  }

  if (
    typeof adminEmail !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())
  ) {
    return { error: "Email admin invalido" as const };
  }

  if (
    typeof temporaryPassword !== "string" ||
    temporaryPassword.trim().length < 8
  ) {
    return { error: "La contraseña temporal debe tener al menos 8 caracteres" as const };
  }

  return {
    value: {
      name: name.trim(),
      plan,
      adminEmail: adminEmail.trim().toLowerCase(),
      temporaryPassword: temporaryPassword.trim(),
    },
  };
}

export async function provisionOrganizationWithAdmin(
  input: ProvisionOrganizationInput
) {
  const db = getAdminFirestore();
  const orgId = buildOrganizationId(input.name);
  const now = Timestamp.now();
  let createdUid: string | null = null;

  try {
    const user = await auth.createUser({
      email: input.adminEmail,
      password: input.temporaryPassword,
      displayName: `${input.name} Admin`,
    });
    createdUid = user.uid;

    await auth.setCustomUserClaims(user.uid, {
      admin: true,
      organizationId: orgId,
      role: "admin",
    });

    await db.collection("organizations").doc(orgId).set({
      name: input.name,
      slug: slugifyOrganizationName(input.name),
      plan: input.plan,
      status: "active",
      adminEmail: input.adminEmail,
      adminUid: user.uid,
      createdAt: now,
      updatedAt: now,
    });

    const organization = await toOrganization(
      await db.collection("organizations").doc(orgId).get()
    );

    return {
      organization,
      adminUid: user.uid,
    };
  } catch (error) {
    if (createdUid) {
      try {
        await auth.deleteUser(createdUid);
      } catch (rollbackError) {
        console.error("Rollback fallido al eliminar usuario admin:", rollbackError);
      }
    }

    throw error;
  }
}
