import { NextRequest, NextResponse } from "next/server";

// Edge Runtime — NO puede usar firebase-admin (Node.js APIs incompatibles)
// Solo verifica presencia del token. La verificación real la hace withAuth en cada route.

const PUBLIC_PATHS = new Set<string>(["/", "/api/health"]);

function hasTokenPresent(request: NextRequest): boolean {
  const authHeader =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token.length > 0) return true;
  }

  if (request.cookies.has("session")) return true;

  return false;
}

export function middleware(request: NextRequest) {
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

  if (!hasTokenPresent(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/fin/:path*"],
};
