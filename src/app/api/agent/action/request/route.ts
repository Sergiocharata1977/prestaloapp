import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { withTerminalAuth } from "@/lib/api/withTerminalAuth";
import { TerminalPolicyService } from "@/services/TerminalPolicyService";
import type { TerminalActionLog } from "@/types/agent-terminal";

export const runtime = "nodejs";

const requestActionSchema = z.object({
  tool: z.string().trim().min(1),
  params: z.record(z.string(), z.unknown()),
  proceso_id: z.string().trim().min(1).optional(),
  justification: z.string().trim().min(1),
});

export const POST = withTerminalAuth(async (request, _context, authContext) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "INVALID_JSON_BODY" },
      { status: 400 }
    );
  }

  const parsed = requestActionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const db = getAdminFirestore();
    const policy = await TerminalPolicyService.resolvePolicy(
      authContext.organizationId,
      authContext.terminalId
    );

    const isAllowed = policy.allowed_tools.includes(parsed.data.tool);

    const logPayload: TerminalActionLog = {
      organization_id: authContext.organizationId,
      ...authContext.terminalContext,
      tool: parsed.data.tool,
      params: parsed.data.params,
      proceso_id: parsed.data.proceso_id,
      justification: parsed.data.justification,
      result: isAllowed ? "pending_approval" : "blocked",
      required_approval: isAllowed ? true : false,
      block_reason: isAllowed ? undefined : "TOOL_NOT_ALLOWED",
      timestamp: Timestamp.now(),
    };

    const logRef = await db
      .collection(`organizations/${authContext.organizationId}/terminal_action_log`)
      .add(logPayload);

    return NextResponse.json({
      success: true,
      data: {
        log_id: logRef.id,
        status: isAllowed ? "pending" : logPayload.result,
      },
    });
  } catch (error) {
    console.error("POST /api/agent/action/request failed", error);

    return NextResponse.json(
      { success: false, error: "ACTION_REQUEST_CREATE_FAILED" },
      { status: 500 }
    );
  }
});
