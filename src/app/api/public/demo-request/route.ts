import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/firebase/admin";
import { isOrganizationPlan } from "@/lib/super-admin/provisionOrganization";

type CreateDemoRequestPayload = {
  contactName: string;
  organizationName: string;
  email: string;
  phone: string | null;
  notes: string | null;
  requestedPlan: "free" | "pro" | "enterprise";
};

function parseString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseBody(body: unknown):
  | { error: string }
  | { value: CreateDemoRequestPayload } {
  if (!body || typeof body !== "object") {
    return { error: "Payload inválido" };
  }

  const payload = body as Record<string, unknown>;
  const contactName = parseString(payload.contactName);
  const organizationName = parseString(payload.organizationName);
  const email = parseString(payload.email)?.toLowerCase() ?? null;
  const phone = parseString(payload.phone);
  const notes = parseString(payload.notes);
  const requestedPlan = payload.requestedPlan;

  if (!contactName || contactName.length < 3) {
    return { error: "El nombre de contacto debe tener al menos 3 caracteres" };
  }

  if (!organizationName || organizationName.length < 3) {
    return { error: "El nombre de la organización debe tener al menos 3 caracteres" };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Email inválido" };
  }

  if (notes && notes.length > 1000) {
    return { error: "Las notas no pueden superar los 1000 caracteres" };
  }

  if (!isOrganizationPlan(requestedPlan)) {
    return { error: "Plan inválido" };
  }

  return {
    value: {
      contactName,
      organizationName,
      email,
      phone,
      notes,
      requestedPlan,
    },
  };
}

export async function POST(request: Request) {
  const parsed = parseBody(await request.json());
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const duplicateSnapshot = await db
      .collection("demo_requests")
      .where("email", "==", parsed.value.email)
      .where("status", "in", ["pending", "processing"])
      .limit(1)
      .get();

    if (!duplicateSnapshot.empty) {
      return NextResponse.json(
        { error: "Ya existe una solicitud en curso para este email" },
        { status: 409 }
      );
    }

    const now = Timestamp.now();
    const docRef = await db.collection("demo_requests").add({
      ...parsed.value,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      approvedAt: null,
      approvedOrganizationId: null,
      approvedAdminUid: null,
      lastError: null,
    });

    return NextResponse.json({ id: docRef.id, success: true }, { status: 201 });
  } catch (error) {
    console.error("Error al crear demo request:", error);
    return NextResponse.json(
      { error: "No se pudo registrar la solicitud de demo" },
      { status: 500 }
    );
  }
}
