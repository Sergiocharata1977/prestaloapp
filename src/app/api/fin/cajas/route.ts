import { withAuth } from '@/lib/api/withAuth'
import { NextResponse } from 'next/server'
import { getAdminFirestore } from '@/firebase/admin'
import { FIN_CAJAS } from '@/firebase/collections'
import { z } from 'zod'

const CreateCajaSchema = z.object({
  sucursal_id: z.string().min(1),
  monto_inicial: z.number().min(0),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// GET: listar cajas de la org, ordenadas por fecha DESC, limit 50
export const GET = withAuth(async (_req, _ctx, authContext) => {
  const { organizationId } = authContext
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization required' }, { status: 403 })
  }
  const db = getAdminFirestore()
  const snap = await db
    .collection(FIN_CAJAS)
    .where('organizacion_id', '==', organizationId)
    .orderBy('fecha', 'desc')
    .limit(50)
    .get()
  const cajas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return NextResponse.json({ cajas })
})

// POST: abrir nueva caja
export const POST = withAuth(async (req, _ctx, authContext) => {
  const { organizationId, user } = authContext
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization required' }, { status: 403 })
  }
  const body = await req.json()
  const parsed = CreateCajaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { sucursal_id, monto_inicial, fecha } = parsed.data
  const db = getAdminFirestore()

  // Verificar que no exista caja abierta para esa sucursal y fecha
  const existing = await db
    .collection(FIN_CAJAS)
    .where('organizacion_id', '==', organizationId)
    .where('sucursal_id', '==', sucursal_id)
    .where('fecha', '==', fecha)
    .where('estado', '==', 'abierta')
    .limit(1)
    .get()

  if (!existing.empty) {
    return NextResponse.json(
      { error: 'Ya existe una caja abierta para esta sucursal hoy.' },
      { status: 409 }
    )
  }

  const ref = db.collection(FIN_CAJAS).doc()
  const caja = {
    organizacion_id: organizationId,
    sucursal_id,
    fecha,
    estado: 'abierta',
    monto_inicial,
    monto_final: null,
    diferencia: null,
    cobros_del_dia: 0,
    monto_cobrado: 0,
    abierta_por: user.uid,
    cerrada_por: null,
    created_at: new Date().toISOString(),
    closed_at: null,
  }
  await ref.set(caja)
  return NextResponse.json({ id: ref.id, caja: { id: ref.id, ...caja } }, { status: 201 })
})
