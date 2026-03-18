import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import { withAuth } from '@/lib/api/withAuth';
import type { FinCaja, FinCajaCreateInput } from '@/types/fin-sucursal';

const READ_ROLES = ['admin', 'gerente', 'operador'];
const ADMIN_ROLES = ['admin'];

function requireOrganizationId(organizationId: string | null): string {
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  return organizationId;
}

function mapCaja(
  doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot
): FinCaja | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinCaja;
}

export const GET = withAuth<{ id: string }>(async (_request, context, authContext) => {
  try {
    const orgId = requireOrganizationId(authContext.organizationId);
    const { id } = await context.params;
    const db = getAdminFirestore();
    const sucursalRef = db.doc(FIN_COLLECTIONS.sucursal(orgId, id));
    const sucursalSnap = await sucursalRef.get();

    if (!sucursalSnap.exists) {
      return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 });
    }

    const snapshot = await db
      .collection(FIN_COLLECTIONS.cajas(orgId, id))
      .orderBy('nombre', 'asc')
      .get();

    const cajas = snapshot.docs
      .map(doc => mapCaja(doc))
      .filter((caja): caja is FinCaja => caja !== null);

    return NextResponse.json({ success: true, data: cajas });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar cajas' },
      { status: 400 }
    );
  }
}, { roles: READ_ROLES });

export const POST = withAuth<{ id: string }>(async (request, context, authContext) => {
  try {
    const orgId = requireOrganizationId(authContext.organizationId);
    const { id } = await context.params;
    const body = (await request.json()) as Partial<FinCajaCreateInput>;
    const nombre = body.nombre?.trim();
    const cuentaContableId = body.cuenta_contable_id?.trim();

    if (!nombre || !cuentaContableId) {
      return NextResponse.json(
        { error: 'nombre y cuenta_contable_id son obligatorios' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const sucursalRef = db.doc(FIN_COLLECTIONS.sucursal(orgId, id));
    const cuentaRef = db.doc(`${FIN_COLLECTIONS.cuentas(orgId)}/${cuentaContableId}`);
    const [sucursalSnap, cuentaSnap] = await Promise.all([
      sucursalRef.get(),
      cuentaRef.get(),
    ]);

    if (!sucursalSnap.exists) {
      return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 });
    }

    if (!cuentaSnap.exists) {
      return NextResponse.json(
        { error: 'Cuenta contable no encontrada' },
        { status: 404 }
      );
    }

    const ref = db.collection(FIN_COLLECTIONS.cajas(orgId, id)).doc();
    const now = new Date().toISOString();
    const caja: FinCaja = {
      id: ref.id,
      organization_id: orgId,
      sucursal_id: id,
      nombre,
      cuenta_contable_id: cuentaContableId,
      estado: 'abierta',
      saldo_actual: 0,
      updated_at: now,
    };

    await ref.set(caja);

    return NextResponse.json({ success: true, data: caja }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear caja' },
      { status: 400 }
    );
  }
}, { roles: ADMIN_ROLES });
