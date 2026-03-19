import "server-only";

import { NextResponse } from "next/server";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/firebase/admin";
import { SUPER_ADMIN_OPTIONS } from "@/lib/api/superAdminAuth";
import { withAuth } from "@/lib/api/withAuth";
import { isOrganizationPlan, provisionOrganizationWithAdmin, serializeTimestamp } from "@/lib/super-admin/provisionOrganization";
import type { DemoRequest, OrganizationPlan } from "@/types/super-admin";

type FirestoreDemoRequest = {
  contactName?: unknown;
  organizationName?: unknown;
  email?: unknown;
  phone?: unknown;
  notes?: unknown;
  requestedPlan?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  approvedAt?: unknown;
  approvedOrganizationId?: unknown;
  approvedAdminUid?: unknown;
  lastError?: unknown;
};

function toDemoRequest(
  doc:
    | FirebaseFirestore.QueryDocumentSnapshot<DocumentData>
    | FirebaseFirestore.DocumentSnapshot<DocumentData>
): DemoRequest {
  const data = (doc.data() ?? {}) as FirestoreDemoRequest;

  return {
    id: doc.id,
    contactName: typeof data.contactName === "string" ? data.contactName : "Sin nombre",
    organizationName:
      typeof data.organizationName === "string"
        ? data.organizationName
        : "Sin organización",
    email: typeof data.email === "string" ? data.email : "",
    phone: typeof data.phone === "string" ? data.phone : null,
    notes: typeof data.notes === "string" ? data.notes : null,
    requestedPlan: isOrganizationPlan(data.requestedPlan) ? data.requestedPlan : "pro",
    status:
      data.status === "pending" ||
      data.status === "processing" ||
      data.status === "approved" ||
      data.status === "rejected"
        ? data.status
        : "pending",
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
    approvedAt: serializeTimestamp(data.approvedAt),
    approvedOrganizationId:
      typeof data.approvedOrganizationId === "string" ? data.approvedOrganizationId : null,
    approvedAdminUid:
      typeof data.approvedAdminUid === "string" ? data.approvedAdminUid : null,
    lastError: typeof data.lastError === "string" ? data.lastError : null,
  };
}

function buildTemporaryPassword() {
  return `Demo${Math.random().toString(36).slice(2, 8)}!${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function parseConvertBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return { error: "Payload inválido" as const };
  }

  const payload = body as Record<string, unknown>;
  const requestId =
    typeof payload.requestId === "string" && payload.requestId.trim().length > 0
      ? payload.requestId.trim()
      : null;
  const requestedPlan = payload.plan;

  if (!requestId) {
    return { error: "requestId es requerido" as const };
  }

  if (requestedPlan !== undefined && !isOrganizationPlan(requestedPlan)) {
    return { error: "Plan inválido" as const };
  }

  return {
    value: {
      requestId,
      plan: (requestedPlan as OrganizationPlan | undefined) ?? null,
    },
  };
}

export const GET = withAuth(async () => {
  try {
    const db = getAdminFirestore();
    const snapshot = await db
      .collection("demo_requests")
      .orderBy("createdAt", "desc")
      .get();

    return NextResponse.json({
      demoRequests: snapshot.docs.map((doc) => toDemoRequest(doc)),
    });
  } catch (error) {
    console.error("Error al listar demo requests:", error);
    return NextResponse.json(
      { error: "No se pudieron cargar las solicitudes de demo" },
      { status: 500 }
    );
  }
}, SUPER_ADMIN_OPTIONS);

export const POST = withAuth(async (request) => {
  const parsed = parseConvertBody(await request.json());
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const db = getAdminFirestore();
  const now = Timestamp.now();
  const docRef = db.collection("demo_requests").doc(parsed.value.requestId);

  try {
    const requestDoc = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists) {
        throw new Error("not-found");
      }

      const data = snapshot.data() as FirestoreDemoRequest;
      if (data.status === "approved") {
        throw new Error("already-approved");
      }

      if (data.status === "processing") {
        throw new Error("already-processing");
      }

      transaction.update(docRef, {
        status: "processing",
        updatedAt: now,
        lastError: null,
      });

      return snapshot;
    });

    const demoRequest = toDemoRequest(requestDoc);
    const temporaryPassword = buildTemporaryPassword();
    const { organization, adminUid } = await provisionOrganizationWithAdmin({
      name: demoRequest.organizationName,
      plan: parsed.value.plan ?? demoRequest.requestedPlan,
      adminEmail: demoRequest.email,
      temporaryPassword,
    });

    await docRef.update({
      status: "approved",
      updatedAt: Timestamp.now(),
      approvedAt: Timestamp.now(),
      approvedOrganizationId: organization.id,
      approvedAdminUid: adminUid,
      requestedPlan: organization.plan,
      lastError: null,
    });

    const updatedDoc = await docRef.get();

    return NextResponse.json({
      demoRequest: toDemoRequest(updatedDoc),
      organization,
      temporaryPassword,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "not-found") {
        return NextResponse.json(
          { error: "La solicitud no existe" },
          { status: 404 }
        );
      }

      if (error.message === "already-approved") {
        return NextResponse.json(
          { error: "La solicitud ya fue aprobada" },
          { status: 409 }
        );
      }

      if (error.message === "already-processing") {
        return NextResponse.json(
          { error: "La solicitud ya está siendo procesada" },
          { status: 409 }
        );
      }
    }

    try {
      await docRef.update({
        status: "pending",
        updatedAt: Timestamp.now(),
        lastError: "No se pudo convertir la solicitud en organización",
      });
    } catch (revertError) {
      console.error("No se pudo revertir la solicitud demo:", revertError);
    }

    console.error("Error al convertir demo request:", error);
    return NextResponse.json(
      { error: "No se pudo convertir la solicitud en organización" },
      { status: 500 }
    );
  }
}, SUPER_ADMIN_OPTIONS);
