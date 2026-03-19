import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { withTerminalAuth } from "@/lib/api/withTerminalAuth";
import { TerminalPolicyService } from "@/services/TerminalPolicyService";
import type { ActionResult, BlockReason, TerminalActionLog } from "@/types/agent-terminal";

export const runtime = "nodejs";

const createActionLogSchema = z.object({
  tool: z.string().trim().min(1),
  params: z.record(z.string(), z.unknown()),
  result: z.enum([
    "success",
    "error",
    "blocked",
    "pending_approval",
    "approved",
    "rejected",
  ]),
  duration_ms: z.number().int().nonnegative().optional(),
  proceso_id: z.string().trim().min(1).optional(),
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

  const parsed = createActionLogSchema.safeParse(body);

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

    let result: ActionResult = parsed.data.result;
    let blockReason: BlockReason | undefined;

    if (!policy.allowed_tools.includes(parsed.data.tool)) {
      result = "blocked";
      blockReason = "TOOL_NOT_ALLOWED";
    }

    const logPayload: TerminalActionLog = {
      organization_id: authContext.organizationId,
      ...authContext.terminalContext,
      tool: parsed.data.tool,
      params: parsed.data.params,
      result,
      duration_ms: parsed.data.duration_ms,
      proceso_id: parsed.data.proceso_id,
      block_reason: blockReason,
      timestamp: Timestamp.now(),
    };

    const logRef = await db
      .collection(`organizations/${authContext.organizationId}/terminal_action_log`)
      .add(logPayload);

    return NextResponse.json({
      success: true,
      data: { log_id: logRef.id },
    });
  } catch (error) {
    console.error("POST /api/agent/action/log failed", error);

    return NextResponse.json(
      { success: false, error: "ACTION_LOG_CREATE_FAILED" },
      { status: 500 }
    );
  }
});
