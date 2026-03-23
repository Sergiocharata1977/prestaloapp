import { withAuth } from '@/lib/api/withAuth';
import { auth, getAdminFirestore } from '@/firebase/admin';
import { CAPABILITIES } from '@/lib/capabilities';
import { Timestamp } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const VALID_CAPABILITIES = Object.values(CAPABILITIES) as string[];

export const GET = withAuth(async (_req: NextRequest, _ctx, { organizationId }) => {
  if (!organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getAdminFirestore();
  const orgSnap = await db.collection('organizations').doc(organizationId).get();
  if (!orgSnap.exists) {
    return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 });
  }

  const data = orgSnap.data() ?? {};
  const capabilities = Array.isArray(data.capabilities)
    ? (data.capabilities as unknown[]).filter((c): c is string => typeof c === 'string')
    : [];

  return NextResponse.json({ capabilities });
}, { roles: ['admin', 'super_admin'] });

export const PATCH = withAuth(async (request: NextRequest, _ctx, { organizationId }) => {
  if (!organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  if (!json || !Array.isArray(json.capabilities)) {
    return NextResponse.json({ error: 'capabilities debe ser un array' }, { status: 400 });
  }

  const capabilities = (json.capabilities as unknown[]).filter(
    (c): c is string => typeof c === 'string' && VALID_CAPABILITIES.includes(c)
  );

  const db = getAdminFirestore();
  const orgRef = db.collection('organizations').doc(organizationId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 });
  }

  await orgRef.update({ capabilities, updatedAt: Timestamp.now() });

  // Sincronizar JWT claims de todos los usuarios de la org
  try {
    const usersResult = await auth.listUsers(1000);
    const orgUsers = usersResult.users.filter(
      (u) =>
        u.customClaims &&
        (u.customClaims as Record<string, unknown>).organizationId === organizationId
    );
    await Promise.all(
      orgUsers.map((u) =>
        auth.setCustomUserClaims(u.uid, {
          ...(u.customClaims ?? {}),
          capabilities,
        })
      )
    );
  } catch (e) {
    console.error('Error sincronizando capabilities:', e);
  }

  return NextResponse.json({ capabilities });
}, { roles: ['admin', 'super_admin'] });
