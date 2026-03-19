import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { cookies, headers } from "next/headers";
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

function getBearerTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function getBearerToken(request: NextRequest): string | null {
  return getBearerTokenFromHeader(
    request.headers.get("authorization") ?? request.headers.get("Authorization")
  );
}

async function decodeAuthToken(input: {
  bearerToken?: string | null;
  sessionCookie?: string | null;
}): Promise<DecodedToken> {
  const bearerToken = input.bearerToken ?? null;
  const sessionCookie = input.sessionCookie ?? null;

  if (!bearerToken && !sessionCookie) {
    throw new Error("Missing auth token");
  }

  if (bearerToken) {
    return (await adminAuth.verifyIdToken(bearerToken)) as DecodedToken;
  }

  return (await adminAuth.verifySessionCookie(sessionCookie as string, true)) as DecodedToken;
}

async function decodeRequestToken(request: NextRequest): Promise<DecodedToken> {
  return decodeAuthToken({
    bearerToken: getBearerToken(request),
    sessionCookie: request.cookies.get("session")?.value ?? null,
  });
}

export function hasRequiredRole(decodedToken: DecodedToken, roles: string[]): boolean {
  const currentRole =
    typeof decodedToken.role === "string" ? decodedToken.role : null;

  if (!currentRole) {
    return false;
  }

  return roles.includes(currentRole);
}

export async function requireServerAuthContext(
  options: WithAuthOptions = {}
): Promise<AuthContext> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const decodedToken = await decodeAuthToken({
    bearerToken: getBearerTokenFromHeader(
      headerStore.get("authorization") ?? headerStore.get("Authorization")
    ),
    sessionCookie: cookieStore.get("session")?.value ?? null,
  });

  if (options.roles && options.roles.length > 0) {
    const roleAllowed = hasRequiredRole(decodedToken, options.roles);
    if (!roleAllowed) {
      throw new Error("Forbidden");
    }
  }

  const headerOrgId = headerStore.get("x-org-id")?.trim() ?? null;
  const organizationId =
    typeof decodedToken.organizationId === "string" && decodedToken.organizationId
      ? decodedToken.organizationId
      : decodedToken.admin === true
        ? headerOrgId
        : null;

  if (!organizationId && decodedToken.admin !== true) {
    throw new Error("No authorized organization could be resolved");
  }

  return {
    user: decodedToken,
    organizationId,
  };
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
