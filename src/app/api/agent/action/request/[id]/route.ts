import "server-only";

import { NextResponse } from "next/server";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { withTerminalAuth } from "@/lib/api/withTerminalAuth";

export const runtime = "nodejs";

type RouteParams = {
  id: string;
};

export const GET = withTerminalAuth<RouteParams>(
  async (_request, context, authContext) => {
    const { id } = await context.params;

    try {
      const db = getAdminFirestore();
      const logSnap = await db
        .doc(`organizations/${authContext.organizationId}/terminal_action_log/${id}`)
        .get();

      if (!logSnap.exists) {
        return NextResponse.json(
          { success: false, error: "ACTION_LOG_NOT_FOUND" },
          { status: 404 }
        );
      }

      const logData = (logSnap.data() ?? {}) as Record<string, unknown>;

      if (logData.terminal_id !== authContext.terminalId) {
        return NextResponse.json(
          { success: false, error: "FORBIDDEN" },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          status:
            typeof logData.result === "string" ? logData.result : "pending_approval",
          approved_by:
            typeof logData.approved_by === "string" ? logData.approved_by : null,
        },
      });
    } catch (error) {
      console.error("GET /api/agent/action/request/[id] failed", error);

      return NextResponse.json(
        { success: false, error: "ACTION_REQUEST_STATUS_FAILED" },
        { status: 500 }
      );
    }
  }
);
