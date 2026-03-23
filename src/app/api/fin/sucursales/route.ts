import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import { withAuth } from '@/lib/api/withAuth';
import type { FinSucursal, FinSucursalCreateInput } from '@/types/fin-sucursal';

const READ_ROLES = ['admin', 'gerente', 'operador'];
const ADMIN_ROLES = ['admin'];

function requireOrganizationId(organizationId: string | null): string {
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  return organizationId;
}

function mapSucursal(
  doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot
): FinSucursal | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinSucursal;
}

export const GET = withAuth(async (_request, _context, authContext) => {
  try {
    const orgId = requireOrganizationId(authContext.organizationId);
    const db = getAdminFirestore();
    const snapshot = await db
      .collection(FIN_COLLECTIONS.sucursales(orgId))
      .where('activa', '==', true)
      .get();

    const sucursales = snapshot.docs
      .map(doc => mapSucursal(doc))
      .filter((sucursal): sucursal is FinSucursal => sucursal !== null)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    return NextResponse.json({ success: true, data: sucursales });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar sucursales' },
      { status: 400 }
    );
  }
}, { roles: READ_ROLES });

export const POST = withAuth(async (request, _context, authContext) => {
  try {
    const orgId = requireOrganizationId(authContext.organizationId);
    const body = (await request.json()) as Partial<FinSucursalCreateInput>;
    const nombre = body.nombre?.trim();

    if (!nombre) {
      return NextResponse.json({ error: 'nombre es obligatorio' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const ref = db.collection(FIN_COLLECTIONS.sucursales(orgId)).doc();
    const now = new Date().toISOString();
    const sucursal: FinSucursal = {
      id: ref.id,
      organization_id: orgId,
      nombre,
      direccion: body.direccion?.trim() || undefined,
      activa: true,
      created_at: now,
    };

    await ref.set(sucursal);

    return NextResponse.json({ success: true, data: sucursal }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear sucursal' },
      { status: 400 }
    );
  }
}, { roles: ADMIN_ROLES });
