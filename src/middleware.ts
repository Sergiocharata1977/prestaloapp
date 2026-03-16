import { NextRequest, NextResponse } from "next/server";

import { auth as adminAuth } from "@/firebase/admin";

const PUBLIC_PATHS = new Set<string>(["/", "/api/health"]);

function getBearerToken(request: NextRequest): string | null {
  const authHeader =
    request.headers.get("authorization") ?? request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

async function hasValidAuth(request: NextRequest): Promise<boolean> {
  const bearerToken = getBearerToken(request);
  const sessionCookie = request.cookies.get("session")?.value ?? null;

  try {
    if (bearerToken) {
      await adminAuth.verifyIdToken(bearerToken);
      return true;
    }

    if (sessionCookie) {
      await adminAuth.verifySessionCookie(sessionCookie, true);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/api/fin/")) {
    return NextResponse.next();
  }

  if (request.method === "OPTIONS") {
    return NextResponse.next();
  }

  const isAuthorized = await hasValidAuth(request);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/api/health", "/api/fin/:path*"],
};
