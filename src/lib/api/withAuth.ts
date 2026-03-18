import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth as adminAuth } from "@/firebase/admin";
import {
  resolveAuthorizedOrganizationId,
  toOrganizationApiError,
} from "@/middleware/verifyOrganization";

export type DecodedToken = DecodedIdToken & {
  role?: string;
  organizationId?: string | null;
  admin?: boolean;
};

export type AuthContext = {
  user: DecodedToken;
  organizationId: string | null;
};

type RouteContext<TParams extends Record<string, string> = Record<string, string>> = {
  params: Promise<TParams>;
};

type RouteHandler<
  TParams extends Record<string, string> = Record<string, string>
> = (
  request: NextRequest,
  context: RouteContext<TParams>,
  authContext: AuthContext
) => Promise<Response> | Response;

export type WithAuthOptions = {
  roles?: string[];
};

function getBearerToken(request: NextRequest): string | null {
  const authHeader =
    request.headers.get("authorization") ?? request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

async function decodeRequestToken(request: NextRequest): Promise<DecodedToken> {
  const bearerToken = getBearerToken(request);
  const sessionCookie = request.cookies.get("session")?.value ?? null;

  if (!bearerToken && !sessionCookie) {
    throw new Error("Missing auth token");
  }

  if (bearerToken) {
    return (await adminAuth.verifyIdToken(bearerToken)) as DecodedToken;
  }

  return (await adminAuth.verifySessionCookie(sessionCookie as string, true)) as DecodedToken;
}

function hasRequiredRole(decodedToken: DecodedToken, roles: string[]): boolean {
  const currentRole =
    typeof decodedToken.role === "string" ? decodedToken.role : null;

  if (!currentRole) {
    return false;
  }

  return roles.includes(currentRole);
}

export function withAuth<
  TParams extends Record<string, string> = Record<string, string>
>(handler: RouteHandler<TParams>, options: WithAuthOptions = {}) {
  return async (
    request: NextRequest,
    context: RouteContext<TParams>
  ): Promise<Response> => {
    let decodedToken: DecodedToken;

    try {
      decodedToken = await decodeRequestToken(request);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (options.roles && options.roles.length > 0) {
      const roleAllowed = hasRequiredRole(decodedToken, options.roles);
      if (!roleAllowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const organizationId = resolveAuthorizedOrganizationId(request, decodedToken);
    if (!organizationId && decodedToken.admin !== true) {
      return toOrganizationApiError(
        403,
        "No authorized organization could be resolved"
      );
    }

    return handler(request, context, {
      user: decodedToken,
      organizationId,
    });
  };
}
