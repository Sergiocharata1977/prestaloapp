import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export type DecodedToken = {
  uid: string;
  email?: string;
  role?: string;
  organizationId?: string | null;
  admin?: boolean;
  [key: string]: unknown;
};

type OrganizationApiErrorCode = 400 | 401 | 403;

export function toOrganizationApiError(
  code: OrganizationApiErrorCode,
  message: string
) {
  return NextResponse.json({ error: message }, { status: code });
}

export function resolveAuthorizedOrganizationId(
  request: NextRequest,
  decodedToken: DecodedToken
): string | null {
  if (typeof decodedToken.organizationId === "string" && decodedToken.organizationId) {
    return decodedToken.organizationId;
  }

  if (decodedToken.admin === true) {
    const headerOrgId = request.headers.get("x-org-id")?.trim();
    return headerOrgId ? headerOrgId : null;
  }

  return null;
}
