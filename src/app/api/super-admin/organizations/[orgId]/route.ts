import "server-only";

import { NextResponse } from "next/server";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { auth, getAdminFirestore } from "@/firebase/admin";
import { SUPER_ADMIN_OPTIONS } from "@/lib/api/superAdminAuth";
import { withAuth } from "@/lib/api/withAuth";
import type {
  Organization,
  OrganizationPlan,
  OrganizationStatus,
} from "@/types/super-admin";

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
  capabilities?: unknown;
};

function isOrganizationPlan(value: unknown): value is OrganizationPlan {
  return typeof value === "string" && VALID_PLANS.includes(value as OrganizationPlan);
}

function isOrganizationStatus(value: unknown): value is OrganizationStatus {
  return (
    typeof value === "string" && VALID_STATUSES.includes(value as OrganizationStatus)
  );
}

function serializeTimestamp(value: unknown): string | null {
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

async function toOrganization(
  doc: FirebaseFirestore.DocumentSnapshot<DocumentData>
): Promise<Organization> {
  const data = (doc.data() ?? {}) as FirestoreOrganization;
  const metrics = await getOrganizationMetrics(doc.id);

  const capabilities = Array.isArray(data.capabilities)
    ? (data.capabilities as unknown[]).filter((c): c is string => typeof c === "string")
    : [];

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
    capabilities,
  };
}

function parsePatchBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return { error: "Payload invalido" as const };
  }

  const { name, plan, status } = body as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length < 3) {
    return { error: "El nombre debe tener al menos 3 caracteres" as const };
  }

  if (!isOrganizationPlan(plan)) {
    return { error: "Plan invalido" as const };
  }

  if (!isOrganizationStatus(status)) {
    return { error: "Estado invalido" as const };
  }

  return {
    value: {
      name: name.trim(),
      plan,
      status,
    },
  };
}

export const GET = withAuth(async (_request, context) => {
  try {
    const { orgId } = await context.params;
    const db = getAdminFirestore();
    const doc = await db.collection("organizations").doc(orgId).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Organización no encontrada" },
        { status: 404 }
      );
    }

    const organization = await toOrganization(doc);
    return NextResponse.json({ organization });
  } catch (error) {
    console.error("Error al obtener organización:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la organización" },
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
    const { orgId } = await context.params;
    const db = getAdminFirestore();
    const docRef = db.collection("organizations").doc(orgId);
    const currentDoc = await docRef.get();

    if (!currentDoc.exists) {
      return NextResponse.json(
        { error: "Organización no encontrada" },
        { status: 404 }
      );
    }

    await docRef.update({
      ...parsed.value,
      updatedAt: Timestamp.now(),
    });

    const updatedDoc = await docRef.get();
    const organization = await toOrganization(updatedDoc);
    return NextResponse.json({ organization });
  } catch (error) {
    console.error("Error al actualizar organización:", error);
    return NextResponse.json(
      { error: "No se pudo actualizar la organización" },
      { status: 500 }
    );
  }
}, SUPER_ADMIN_OPTIONS);

export const DELETE = withAuth(async (_request, context) => {
  try {
    const { orgId } = await context.params;
    const db = getAdminFirestore();
    const docRef = db.collection("organizations").doc(orgId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Organización no encontrada" },
        { status: 404 }
      );
    }

    const data = (doc.data() ?? {}) as FirestoreOrganization;

    await docRef.delete();

    if (typeof data.adminUid === "string" && data.adminUid) {
      try {
        await auth.deleteUser(data.adminUid);
      } catch (deleteUserError) {
        console.error(
          "No se pudo eliminar el usuario admin de la organización:",
          deleteUserError
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al eliminar organización:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar la organización" },
      { status: 500 }
    );
  }
}, SUPER_ADMIN_OPTIONS);
