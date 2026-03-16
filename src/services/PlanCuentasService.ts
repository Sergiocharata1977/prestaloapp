import "server-only";

import { getAdminFirestore } from "@/firebase/admin";
import { FIN_COLLECTIONS } from "@/firebase/collections";
import type {
  FinCuenta,
  FinRubro,
  FinConfigCuentas,
} from "@/types/fin-plan-cuentas";

export const PlanCuentasService = {
  async getRubros(orgId: string): Promise<FinRubro[]> {
    const db = getAdminFirestore();
    const snap = await db
      .collection(FIN_COLLECTIONS.rubros(orgId))
      .orderBy("orden")
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinRubro));
  },

  async getCuentas(orgId: string, rubroId?: string): Promise<FinCuenta[]> {
    const db = getAdminFirestore();
    let q = db
      .collection(FIN_COLLECTIONS.cuentas(orgId))
      .where("activa", "==", true);
    if (rubroId) q = q.where("rubro_id", "==", rubroId) as typeof q;
    const snap = await q.orderBy("codigo").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinCuenta));
  },

  async getConfigCuentas(
    orgId: string,
    plugin: string
  ): Promise<FinConfigCuentas | null> {
    const db = getAdminFirestore();
    const doc = await db
      .doc(FIN_COLLECTIONS.configCuentas(orgId, plugin))
      .get();
    if (!doc.exists) return null;
    return doc.data() as FinConfigCuentas;
  },

  async upsertConfigCuentas(
    orgId: string,
    plugin: string,
    config: FinConfigCuentas["cuentas"]
  ): Promise<void> {
    const db = getAdminFirestore();
    await db.doc(FIN_COLLECTIONS.configCuentas(orgId, plugin)).set(
      { organization_id: orgId, plugin, cuentas: config },
      { merge: true }
    );
  },

  async crearRubro(
    orgId: string,
    input: Omit<FinRubro, "id" | "organization_id">
  ): Promise<string> {
    const db = getAdminFirestore();
    const ref = await db
      .collection(FIN_COLLECTIONS.rubros(orgId))
      .add({ ...input, organization_id: orgId });
    return ref.id;
  },

  async crearCuenta(
    orgId: string,
    input: Omit<FinCuenta, "id" | "organization_id">
  ): Promise<string> {
    const db = getAdminFirestore();
    const ref = await db
      .collection(FIN_COLLECTIONS.cuentas(orgId))
      .add({ ...input, organization_id: orgId });
    return ref.id;
  },
};
