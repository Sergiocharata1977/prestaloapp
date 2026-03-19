import { NextResponse } from "next/server";

import { getAdminFirestore } from "@/firebase/admin";
import { withAuth } from "@/lib/api/withAuth";
import type { TerminalActionLog } from "@/types/agent-terminal";

export const runtime = "nodejs";

type RouteParams = { id: string };

type TerminalActionLogWithId = TerminalActionLog & { id: string };

type TerminalSummary = {
  id: string;
  nombre?: string;
  personnel_nombre?: string;
  empleado_nombre?: string;
};

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

async function loadTerminalSummaries(orgId: string, terminalIds: string[]) {
  if (terminalIds.length === 0) {
    return new Map<string, TerminalSummary>();
  }

  const db = getAdminFirestore();
  const refs = terminalIds.map((terminalId) => db.doc(terminalDocPath(orgId, terminalId)));
  const docs = await db.getAll(...refs);

  return docs.reduce((acc, doc) => {
    if (!doc.exists) {
      return acc;
    }

    const data = doc.data() ?? {};
    acc.set(doc.id, {
      id: doc.id,
      nombre: typeof data.nombre === "string" ? data.nombre : undefined,
      personnel_nombre:
        typeof data.personnel_nombre === "string" ? data.personnel_nombre : undefined,
      empleado_nombre:
        typeof data.empleado_nombre === "string" ? data.empleado_nombre : undefined,
    });
    return acc;
  }, new Map<string, TerminalSummary>());
}

export const GET = withAuth<RouteParams>(async (request, context, auth) => {
  try {
    const orgId = requireOrganizationId(auth.organizationId);
    const { id } = await context.params;
    const rawLimit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
    const limit = Math.min(Math.max(rawLimit || 20, 1), 20);

    const snapshot = await getAdminFirestore()
      .collection(terminalLogsCollection(orgId))
      .where("proceso_id", "==", id)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    const logs = snapshot.docs
      .map((doc) => mapLog(doc))
      .filter((log): log is TerminalActionLogWithId => log !== null);

    const terminalSummaries = await loadTerminalSummaries(
      orgId,
      Array.from(new Set(logs.map((log) => log.terminal_id).filter(Boolean)))
    );

    return NextResponse.json(
      logs.map((log) => {
        const terminal = terminalSummaries.get(log.terminal_id);

        return {
          id: log.id,
          proceso_id: log.proceso_id ?? id,
          terminal_id: log.terminal_id,
          terminal_nombre: terminal?.nombre ?? log.terminal_id,
          empleado_nombre:
            terminal?.empleado_nombre ?? terminal?.personnel_nombre ?? log.personnel_id ?? "-",
          tool: log.tool,
          result: log.result,
          timestamp: log.timestamp,
          terminal_log_href: `/terminales/${log.terminal_id}`,
        };
      })
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo obtener la actividad digital",
      },
      { status: 400 }
    );
  }
});
