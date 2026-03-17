import { withAuth } from '@/lib/api/withAuth'
import { NextResponse } from 'next/server'
import { getAdminFirestore } from '@/firebase/admin'
import { FIN_CAJAS, FIN_COBROS } from '@/firebase/collections'
import { z } from 'zod'

const CerrarCajaSchema = z.object({
  monto_final: z.number().min(0),
})

// GET: detalle de la caja + cobros del día
export const GET = withAuth(async (_req, ctx, authContext) => {
  const { organizationId } = authContext
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization required' }, { status: 403 })
  }
  const { id } = await ctx.params
  const db = getAdminFirestore()
  const doc = await db.collection(FIN_CAJAS).doc(id).get()
  if (!doc.exists) {
    return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 })
  }
  const caja = { id: doc.id, ...doc.data() }
  // Cobros del día asociados a esta caja
  const cobrosSnap = await db
    .collection(FIN_COBROS)
    .where('organizacion_id', '==', organizationId)
    .where('caja_id', '==', id)
    .orderBy('created_at', 'desc')
    .get()
  const cobros = cobrosSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  return NextResponse.json({ caja, cobros })
})

// PATCH: cerrar caja
export const PATCH = withAuth(async (req, ctx, authContext) => {
  const { organizationId, user } = authContext
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization required' }, { status: 403 })
  }
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = CerrarCajaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const db = getAdminFirestore()
  const ref = db.collection(FIN_CAJAS).doc(id)
  const doc = await ref.get()
  if (!doc.exists) {
    return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 })
  }
  const data = doc.data() as Record<string, unknown>
  if (data.estado === 'cerrada') {
    return NextResponse.json({ error: 'La caja ya fue cerrada.' }, { status: 409 })
  }
  const { monto_final } = parsed.data
  const montoCobrado = typeof data.monto_cobrado === 'number' ? data.monto_cobrado : 0
  const diferencia = monto_final - montoCobrado
  await ref.update({
    estado: 'cerrada',
    monto_final,
    diferencia,
    cerrada_por: user.uid,
    closed_at: new Date().toISOString(),
  })
  return NextResponse.json({ ok: true, diferencia })
})
