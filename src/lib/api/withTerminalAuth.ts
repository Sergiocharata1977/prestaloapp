import "server-only";

import type { JWTPayload } from "jose";
import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getAdminFirestore } from "@/lib/firebase/admin";
import type { TerminalContext } from "@/types/agent-terminal";

type TerminalJwtPayload = JWTPayload & {
  terminal_id?: string;
  organization_id?: string;
};

export type TerminalAuthContext = {
  organizationId: string;
  terminalId: string;
  terminalContext: TerminalContext;
  terminalData: Record<string, unknown>;
};

type RouteContext<TParams extends Record<string, string> = Record<string, string>> = {
  params: Promise<TParams>;
};

type RouteHandler<
  TParams extends Record<string, string> = Record<string, string>
> = (
  request: NextRequest,
  context: RouteContext<TParams>,
  authContext: TerminalAuthContext
) => Promise<Response> | Response;

function getBearerToken(request: NextRequest): string | null {
  const authHeader =
    request.headers.get("authorization") ?? request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

async function decodeTerminalToken(token: string): Promise<TerminalJwtPayload> {
  const secret = process.env.TERMINAL_JWT_SECRET;

  if (!secret) {
    throw new Error("TERMINAL_JWT_SECRET_NOT_CONFIGURED");
  }

  const verified = await jwtVerify(
    token,
    new TextEncoder().encode(secret),
    { algorithms: ["HS256"] }
  );

  return verified.payload as TerminalJwtPayload;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function withTerminalAuth<
  TParams extends Record<string, string> = Record<string, string>
>(handler: RouteHandler<TParams>) {
  return async (
    request: NextRequest,
    context: RouteContext<TParams>
  ): Promise<Response> => {
    const bearerToken = getBearerToken(request);

    if (!bearerToken) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    let payload: TerminalJwtPayload;

    try {
      payload = await decodeTerminalToken(bearerToken);
    } catch {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const terminalId = toOptionalString(payload.terminal_id);
    const organizationId = toOptionalString(payload.organization_id);

    if (!terminalId || !organizationId) {
      return NextResponse.json(
        { success: false, error: "INVALID_TERMINAL_TOKEN" },
        { status: 401 }
      );
    }

    const db = getAdminFirestore();
    const terminalSnap = await db
      .doc(`organizations/${organizationId}/terminals/${terminalId}`)
      .get();

    if (!terminalSnap.exists) {
      return NextResponse.json(
        { success: false, error: "TERMINAL_NOT_FOUND" },
        { status: 401 }
      );
    }

    const terminalData = (terminalSnap.data() ?? {}) as Record<string, unknown>;

    if (terminalData.status === "quarantined") {
      return NextResponse.json(
        { success: false, error: "TERMINAL_QUARANTINED" },
        { status: 403 }
      );
    }

    const terminalContext: TerminalContext = {
      terminal_id: terminalId,
      personnel_id: toOptionalString(terminalData.personnel_id),
      puesto_id: toOptionalString(terminalData.puesto_id),
      departamento_id: toOptionalString(terminalData.departamento_id),
    };

    return handler(request, context, {
      organizationId,
      terminalId,
      terminalContext,
      terminalData,
    });
  };
}
