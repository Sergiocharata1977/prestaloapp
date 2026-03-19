import "server-only";

import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const pairTerminalSchema = z.object({
  pairing_code: z.string().trim().min(1),
  hostname: z.string().trim().min(1),
  os: z.enum(["windows", "macos", "linux"]),
  ip_local: z.string().trim().min(1).optional(),
  mac_address: z.string().trim().min(1).optional(),
  agent_version: z.string().trim().min(1),
});

function getOrganizationId(
  doc: FirebaseFirestore.QueryDocumentSnapshot
): string | null {
  const data = doc.data();

  if (typeof data.organization_id === "string" && data.organization_id.trim()) {
    return data.organization_id.trim();
  }

  return doc.ref.parent.parent?.id ?? null;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "INVALID_JSON_BODY" },
      { status: 400 }
    );
  }

  const parsed = pairTerminalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const terminalSecret = process.env.TERMINAL_JWT_SECRET;
  if (!terminalSecret) {
    return NextResponse.json(
      { success: false, error: "TERMINAL_JWT_SECRET_NOT_CONFIGURED" },
      { status: 500 }
    );
  }

  try {
    const db = getAdminFirestore();
    const now = Timestamp.now();
    const terminalSnapshot = await db
      .collectionGroup("terminals")
      .where("pairing_code", "==", parsed.data.pairing_code)
      .where("status", "==", "pending")
      .where("pairing_expires_at", ">", now)
      .limit(1)
      .get();

    if (terminalSnapshot.empty) {
      return NextResponse.json(
        { success: false, error: "INVALID_PAIRING_CODE" },
        { status: 400 }
      );
    }

    const terminalDoc = terminalSnapshot.docs[0];
    const organizationId = getOrganizationId(terminalDoc);

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: "TERMINAL_ORGANIZATION_NOT_RESOLVED" },
        { status: 500 }
      );
    }

    await terminalDoc.ref.update({
      status: "active",
      hostname: parsed.data.hostname,
      os: parsed.data.os,
      ip_local: parsed.data.ip_local ?? FieldValue.delete(),
      mac_address: parsed.data.mac_address ?? FieldValue.delete(),
      agent_version: parsed.data.agent_version,
      activated_at: now,
      pairing_code: FieldValue.delete(),
      pairing_expires_at: FieldValue.delete(),
    });

    const terminalToken = await new SignJWT({
      terminal_id: terminalDoc.id,
      organization_id: organizationId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1y")
      .sign(new TextEncoder().encode(terminalSecret));

    return NextResponse.json({
      success: true,
      data: {
        terminal_id: terminalDoc.id,
        terminal_token: terminalToken,
        organization_id: organizationId,
      },
    });
  } catch (error) {
    console.error("POST /api/agent/pair failed", error);

    return NextResponse.json(
      { success: false, error: "PAIRING_FAILED" },
      { status: 500 }
    );
  }
}
