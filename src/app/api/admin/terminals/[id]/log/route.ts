import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminFirestore } from "@/firebase/admin";
import { withAuth } from "@/lib/api/withAuth";
import type { TerminalActionLog } from "@/types/agent-terminal";

export const runtime = "nodejs";

const logDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

type RouteParams = { id: string };
type TerminalActionLogWithId = TerminalActionLog & { id: string };

function requireOrganizationId(organizationId: string | null): string {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  return organizationId;
}

function terminalDocPath(orgId: string, terminalId: string) {
  return `organizations/${orgId}/terminals/${terminalId}`;
}

function terminalLogsCollection(orgId: string) {
  return `organizations/${orgId}/terminal_action_log`;
}

async function ensureTerminalExists(orgId: string, terminalId: string) {
  const doc = await getAdminFirestore().doc(terminalDocPath(orgId, terminalId)).get();

  if (!doc.exists) {
    throw new Error("TERMINAL_NOT_FOUND");
  }
}

function mapLog(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): TerminalActionLogWithId | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...(doc.data() ?? {}),
  } as TerminalActionLogWithId;
}

export const GET = withAuth<RouteParams>(async (request, context, auth) => {
  try {
    const orgId = requireOrganizationId(auth.organizationId);
    const { id } = await context.params;
    await ensureTerminalExists(orgId, id);

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(
      Math.max(Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1),
      200
    );
    const tool = searchParams.get("tool")?.trim() || null;
    const result = searchParams.get("result")?.trim() || null;

    let query: FirebaseFirestore.Query = getAdminFirestore()
      .collection(terminalLogsCollection(orgId))
      .where("terminal_id", "==", id)
      .orderBy("timestamp", "desc")
      .limit(limit);

    if (tool) {
      query = query.where("tool", "==", tool);
    }

    if (result) {
      query = query.where("result", "==", result);
    }

    const snapshot = await query.get();
    const logs = snapshot.docs
      .map((doc) => mapLog(doc))
      .filter((log): log is TerminalActionLogWithId => log !== null);

    return NextResponse.json(logs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo obtener el log";
    const status = message === "TERMINAL_NOT_FOUND" ? 404 : 400;

    return NextResponse.json(
      { error: message === "TERMINAL_NOT_FOUND" ? "Terminal no encontrada" : message },
      { status }
    );
  }
});

export const PATCH = withAuth<RouteParams>(async (request, context, auth) => {
  try {
    const orgId = requireOrganizationId(auth.organizationId);
    const { id } = await context.params;
    await ensureTerminalExists(orgId, id);

    const logId = request.nextUrl.searchParams.get("logId")?.trim();
    if (!logId) {
      return NextResponse.json({ error: "logId es obligatorio" }, { status: 400 });
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json({ error: "Body requerido" }, { status: 400 });
    }

    const body = logDecisionSchema.parse(json);
    const ref = getAdminFirestore().doc(`${terminalLogsCollection(orgId)}/${logId}`);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: "Log no encontrado" }, { status: 404 });
    }

    const logData = snapshot.data() as Record<string, unknown>;
    if (logData.terminal_id !== id) {
      return NextResponse.json({ error: "Log no encontrado" }, { status: 404 });
    }

    const now = Timestamp.now();
    const updates: Record<string, unknown> =
      body.action === "approve"
        ? {
            result: "success",
            approved_by: auth.user.uid,
            approved_at: now,
            reviewed_at: now,
          }
        : {
            result: "blocked",
            block_reason: "REJECTED_BY_ADMIN",
            reviewed_at: now,
          };

    await ref.update(updates);

    const updated = await ref.get();
    return NextResponse.json(mapLog(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el log";
    const status = message === "TERMINAL_NOT_FOUND" ? 404 : 400;

    return NextResponse.json(
      { error: message === "TERMINAL_NOT_FOUND" ? "Terminal no encontrada" : message },
      { status }
    );
  }
});
