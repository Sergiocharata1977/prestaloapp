import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/firebase/admin";
import { FIN_COLLECTIONS } from "@/firebase/collections";
import { withAuth } from "@/lib/api/withAuth";
import type { FinCtaCteOperacion } from "@/types/fin-ctacte";
import type { FinSucursal } from "@/types/fin-sucursal";

export const dynamic = "force-dynamic";

type AgruparPor = "sin_agrupacion" | "estado" | "sucursal";

type ReporteItem = {
  id: string;
  grupo: string;
  cliente: string;
  fecha_apertura: string;
  comprobante: string;
  monto_original: number;
  saldo_actual: number;
  estado: string;
  dias_desde_ultimo_pago: number | null;
  sucursal: string;
};

function isActiveEstado(estado: FinCtaCteOperacion["estado"]): boolean {
  return estado !== "cancelada" && estado !== "refinanciada";
}

function toTitleCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function daysSince(dateText?: string): number | null {
  if (!dateText) {
    return null;
  }

  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - date.getTime();
  return diffMs < 0 ? 0 : Math.floor(diffMs / 86400000);
}

function resolveAgruparPor(value: string | null): AgruparPor {
  if (value === "estado" || value === "sucursal") {
    return value;
  }

  return "sin_agrupacion";
}

async function requireCtaCteCapability(organizationId: string): Promise<boolean> {
  const db = getAdminFirestore();
  const orgSnap = await db.collection("organizations").doc(organizationId).get();
  const caps = orgSnap.data()?.capabilities as string[] | undefined;
  return Array.isArray(caps) && caps.includes("cta_cte_comercial");
}

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  if (!auth.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hasCapability = await requireCtaCteCapability(auth.organizationId);
  if (!hasCapability) {
    return NextResponse.json({ error: "Plugin no habilitado" }, { status: 403 });
  }

  const agruparPor = resolveAgruparPor(request.nextUrl.searchParams.get("agruparPor"));
  const db = getAdminFirestore();

  const [operacionesSnap, sucursalesSnap] = await Promise.all([
    db.collection(FIN_COLLECTIONS.ctaCteOperaciones(auth.organizationId)).get(),
    db.collection(FIN_COLLECTIONS.sucursales(auth.organizationId)).get(),
  ]);

  const sucursalById = new Map(
    sucursalesSnap.docs.map((doc) => {
      const sucursal = { id: doc.id, ...doc.data() } as FinSucursal;
      return [sucursal.id, sucursal.nombre] as const;
    })
  );

  const items = operacionesSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as FinCtaCteOperacion)
    .filter((operacion) => isActiveEstado(operacion.estado))
    .map<ReporteItem>((operacion) => {
      const sucursal =
        (operacion.sucursal_id && sucursalById.get(operacion.sucursal_id)) || "Sin sucursal";
      const grupo =
        agruparPor === "estado"
          ? toTitleCase(operacion.estado)
          : agruparPor === "sucursal"
            ? sucursal
            : "Cartera activa";

      return {
        id: operacion.id,
        grupo,
        cliente: operacion.cliente_nombre,
        fecha_apertura: operacion.fecha_venta,
        comprobante: operacion.comprobante,
        monto_original: Number(operacion.monto_original || 0),
        saldo_actual: Number(operacion.saldo_actual || 0),
        estado: toTitleCase(operacion.estado),
        dias_desde_ultimo_pago: daysSince(operacion.ultimo_pago_fecha),
        sucursal,
      };
    })
    .sort((a, b) => {
      const groupCompare = a.grupo.localeCompare(b.grupo);
      if (groupCompare !== 0) {
        return groupCompare;
      }

      if (b.saldo_actual !== a.saldo_actual) {
        return b.saldo_actual - a.saldo_actual;
      }

      return a.cliente.localeCompare(b.cliente);
    });

  const groups = Array.from(
    items.reduce((acc, item) => {
      const current = acc.get(item.grupo) ?? {
        key: item.grupo,
        label: item.grupo,
        saldo_total: 0,
        monto_original_total: 0,
        cantidad: 0,
      };

      current.cantidad += 1;
      current.saldo_total += item.saldo_actual;
      current.monto_original_total += item.monto_original;
      acc.set(item.grupo, current);
      return acc;
    }, new Map<string, { key: string; label: string; saldo_total: number; monto_original_total: number; cantidad: number }>())
      .values()
  );

  const resumen = items.reduce(
    (acc, item) => {
      acc.cantidad += 1;
      acc.saldo_total += item.saldo_actual;
      acc.monto_original_total += item.monto_original;
      return acc;
    },
    { cantidad: 0, saldo_total: 0, monto_original_total: 0 }
  );

  return NextResponse.json({
    agruparPor,
    resumen,
    groups,
    items,
  });
});
