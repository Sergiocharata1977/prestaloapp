import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/firebase/admin";
import { withAuth } from "@/lib/api/withAuth";

export const dynamic = "force-dynamic";

type OrgUser = {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  role: string | null;
  disabled: boolean;
  lastSignInTime: string | null;
};

export const GET = withAuth(async (_request: NextRequest, _context, authData) => {
  try {
    if (!authData.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Listar hasta 1000 usuarios de Firebase Auth y filtrar por organizationId
    const listResult = await auth.listUsers(1000);

    const users: OrgUser[] = listResult.users
      .filter((u) => {
        const claims = u.customClaims as Record<string, unknown> | undefined;
        return claims?.organizationId === authData.organizationId;
      })
      .map((u) => ({
        id: u.uid,
        uid: u.uid,
        email: u.email ?? null,
        displayName: u.displayName ?? null,
        role: ((u.customClaims as Record<string, unknown> | undefined)?.role as string) ?? null,
        disabled: u.disabled,
        lastSignInTime: u.metadata.lastSignInTime ?? null,
      }));

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json(
      { error: "No se pudo obtener los usuarios" },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, _context, authData) => {
  try {
    if (!authData.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as {
      email?: string;
      password?: string;
      displayName?: string;
      role?: string;
    } | null;

    if (!body?.email || !body?.password || !body?.displayName) {
      return NextResponse.json(
        { error: "email, password y displayName son requeridos" },
        { status: 400 }
      );
    }

    const role = body.role ?? "operador";

    const userRecord = await auth.createUser({
      email: body.email.trim(),
      password: body.password,
      displayName: body.displayName.trim(),
    });

    await auth.setCustomUserClaims(userRecord.uid, {
      role,
      organizationId: authData.organizationId,
      admin: role === "admin",
    });

    return NextResponse.json(
      {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear usuario";
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
