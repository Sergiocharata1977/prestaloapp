import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { getAdminFirestore } from "@/firebase/admin";
import { FIN_COLLECTIONS } from "@/firebase/collections";
import type { FinAsiento, FinAsientoLinea } from "@/types/fin-asiento";

export const dynamic = "force-dynamic";

function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

type LineaInput = {
  cuenta_id: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debe: number;
  haber: number;
  descripcion: string;
};

export const POST = withAuth(async (req, _ctx, { organizationId, user }) => {
  const orgId = organizationId!;
  const body = (await req.json()) as {
    fecha?: string;
    descripcion?: string;
    lineas?: LineaInput[];
  };

  if (!body.fecha || !body.descripcion || !Array.isArray(body.lineas) || body.lineas.length < 2) {
    return NextResponse.json(
      { error: "fecha, descripcion y al menos 2 líneas son requeridas" },
      { status: 400 }
    );
  }

  const lineas: FinAsientoLinea[] = body.lineas.map((l) => ({
    cuenta_id: l.cuenta_id,
    cuenta_codigo: l.cuenta_codigo ?? "",
    cuenta_nombre: l.cuenta_nombre ?? "",
    debe: round2(Number(l.debe) || 0),
    haber: round2(Number(l.haber) || 0),
    descripcion: l.descripcion ?? "",
  }));

  const total_debe = round2(lineas.reduce((s, l) => s + l.debe, 0));
  const total_haber = round2(lineas.reduce((s, l) => s + l.haber, 0));

  if (Math.abs(total_debe - total_haber) > 0.01) {
    return NextResponse.json(
      { error: `Asiento desbalanceado: debe=${total_debe} haber=${total_haber}` },
      { status: 400 }
    );
  }

  const db = getAdminFirestore();
  const periodo = new Date(body.fecha).toISOString().slice(0, 7);
  const asientoRef = db.collection(FIN_COLLECTIONS.asientos(orgId)).doc();

  const asiento: FinAsiento = {
    id: asientoRef.id,
    organization_id: orgId,
    sucursal_id: "",
    origen: "ajuste_manual",
    documento_id: asientoRef.id,
    documento_tipo: "ajuste",
    fecha: body.fecha,
    periodo,
    estado: "contabilizado",
    lineas,
    total_debe,
    total_haber,
    creado_por: {
      usuario_id: user.uid,
      nombre: user.name ?? user.email ?? user.uid,
      timestamp: new Date().toISOString(),
    },
  };

  await asientoRef.set(asiento);
  return NextResponse.json({ asientoId: asientoRef.id }, { status: 201 });
});

export const GET = withAuth(async (req, _ctx, { organizationId }) => {
  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const origen = searchParams.get("origen");

  const db = getAdminFirestore();
  let q = db
    .collection(FIN_COLLECTIONS.asientos(organizationId!))
    .orderBy("fecha", "desc")
    .limit(50);

  if (desde) q = q.where("fecha", ">=", desde) as typeof q;
  if (hasta) q = q.where("fecha", "<=", hasta) as typeof q;
  if (origen) q = q.where("origen", "==", origen) as typeof q;

  const snap = await q.get();
  const asientos: FinAsiento[] = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as FinAsiento)
  );
  return NextResponse.json({ asientos });
});
