import { FIN_COLLECTIONS } from '@/firebase/collections';
import { getAdminFirestore } from '@/firebase/admin';
import type {
  FinPlanFinanciacion,
  FinPlanFinanciacionCreateInput,
  FinTramoTasa,
} from '@/types/fin-plan-financiacion';
import type { FinPoliticaCrediticia } from '@/types/fin-politica-crediticia';

type PlanListFilters = {
  politica_id?: string;
  tipo_cliente_id?: string;
  activo?: boolean;
};

type PlanUpdateInput = Partial<FinPlanFinanciacionCreateInput>;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: string | undefined): string {
  return (value || '').trim();
}

function mapPlan(
  doc: FirebaseFirestore.DocumentSnapshot
): FinPlanFinanciacion | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinPlanFinanciacion;
}

function validateTramos(tramos: FinTramoTasa[]): FinTramoTasa[] {
  if (!Array.isArray(tramos) || tramos.length === 0) {
    throw new Error('Debe informar al menos un tramo de tasa');
  }

  const normalized = PlanFinanciacionService.ordenarTramos(
    tramos.map(tramo => ({
      cantidad_cuotas: Number(tramo.cantidad_cuotas),
      tasa_mensual: Number(tramo.tasa_mensual),
    }))
  );

  const keys = new Set<number>();

  for (const tramo of normalized) {
    if (!Number.isInteger(tramo.cantidad_cuotas) || tramo.cantidad_cuotas < 0) {
      throw new Error('cantidad_cuotas invalida en tramos_tasa');
    }

    if (!Number.isFinite(tramo.tasa_mensual) || tramo.tasa_mensual < 0) {
      throw new Error('tasa_mensual invalida en tramos_tasa');
    }

    if (keys.has(tramo.cantidad_cuotas)) {
      throw new Error('No puede haber cuotas repetidas en tramos_tasa');
    }

    keys.add(tramo.cantidad_cuotas);
  }

  return normalized;
}

async function getPolitica(
  orgId: string,
  politicaId: string
): Promise<FinPoliticaCrediticia> {
  const db = getAdminFirestore();
  const snap = await db.doc(FIN_COLLECTIONS.politicaCrediticia(orgId, politicaId)).get();

  if (!snap.exists) {
    throw new Error('Politica crediticia no encontrada');
  }

  return {
    id: snap.id,
    ...snap.data(),
  } as FinPoliticaCrediticia;
}

export class PlanFinanciacionService {
  static ordenarTramos(tramos: FinTramoTasa[]): FinTramoTasa[] {
    return [...tramos].sort((a, b) => a.cantidad_cuotas - b.cantidad_cuotas);
  }

  static resolverTasa(plan: FinPlanFinanciacion, cantidadCuotas: number): number {
    const tramosOrdenados = this.ordenarTramos(plan.tramos_tasa);
    const exacto = tramosOrdenados.find(
      tramo => tramo.cantidad_cuotas === cantidadCuotas
    );
    if (exacto) {
      return exacto.tasa_mensual;
    }

    const superior = tramosOrdenados.find(
      tramo => tramo.cantidad_cuotas > cantidadCuotas
    );
    if (superior) {
      return superior.tasa_mensual;
    }

    return tramosOrdenados[tramosOrdenados.length - 1]?.tasa_mensual ?? 0;
  }

  static async crear(
    orgId: string,
    input: FinPlanFinanciacionCreateInput
  ): Promise<FinPlanFinanciacion> {
    const db = getAdminFirestore();
    const ref = db.collection(FIN_COLLECTIONS.planesFinanciacion(orgId)).doc();
    const now = nowIso();
    const politica = await getPolitica(orgId, input.politica_id);

    if (politica.organization_id !== orgId) {
      throw new Error('La politica no pertenece a la organizacion');
    }

    const payload: Omit<FinPlanFinanciacion, 'id'> = {
      ...input,
      organization_id: orgId,
      nombre: normalizeText(input.nombre),
      tramos_tasa: validateTramos(input.tramos_tasa),
      created_at: now,
      updated_at: now,
    };

    if (!payload.nombre) {
      throw new Error('nombre requerido');
    }

    await ref.set(payload);

    return {
      id: ref.id,
      ...payload,
    };
  }

  static async getById(
    orgId: string,
    planId: string
  ): Promise<FinPlanFinanciacion | null> {
    const db = getAdminFirestore();
    const doc = await db.doc(FIN_COLLECTIONS.planFinanciacion(orgId, planId)).get();
    return mapPlan(doc);
  }

  static async list(
    orgId: string,
    filters: PlanListFilters = {}
  ): Promise<FinPlanFinanciacion[]> {
    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(
      FIN_COLLECTIONS.planesFinanciacion(orgId)
    );

    if (filters.politica_id) {
      query = query.where('politica_id', '==', filters.politica_id);
    }

    if (typeof filters.activo === 'boolean') {
      query = query.where('activo', '==', filters.activo);
    }

    const snapshot = await query.get();
    let items = snapshot.docs
      .map(doc => mapPlan(doc))
      .filter((item): item is FinPlanFinanciacion => Boolean(item));

    if (filters.tipo_cliente_id) {
      const politicaIds = new Set(
        (
          await db
            .collection(FIN_COLLECTIONS.politicasCrediticias(orgId))
            .where('tipo_cliente_id', '==', filters.tipo_cliente_id)
            .get()
        ).docs.map(doc => doc.id)
      );

      items = items.filter(item => politicaIds.has(item.politica_id));
    }

    return items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  static async actualizar(
    orgId: string,
    planId: string,
    input: PlanUpdateInput
  ): Promise<FinPlanFinanciacion | null> {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.planFinanciacion(orgId, planId));
    const snap = await ref.get();

    if (!snap.exists) {
      return null;
    }

    if (typeof input.politica_id === 'string') {
      const politica = await getPolitica(orgId, input.politica_id);
      if (politica.organization_id !== orgId) {
        throw new Error('La politica no pertenece a la organizacion');
      }
    }

    const updates: Record<string, unknown> = {
      updated_at: nowIso(),
    };

    if (typeof input.nombre === 'string') {
      const nombre = normalizeText(input.nombre);
      if (!nombre) {
        throw new Error('nombre requerido');
      }

      updates.nombre = nombre;
    }

    if (typeof input.politica_id === 'string') {
      updates.politica_id = input.politica_id;
    }

    if ('tramos_tasa' in input && input.tramos_tasa) {
      updates.tramos_tasa = validateTramos(input.tramos_tasa);
    }

    const passthroughKeys: Array<keyof FinPlanFinanciacionCreateInput> = [
      'tasa_punitoria_mensual',
      'cargo_fijo',
      'cargo_variable_pct',
      'activo',
    ];

    for (const key of passthroughKeys) {
      if (key in input) {
        updates[key] = input[key] ?? null;
      }
    }

    await ref.update(updates);
    return this.getById(orgId, planId);
  }

  static async eliminar(orgId: string, planId: string): Promise<boolean> {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.planFinanciacion(orgId, planId));
    const snap = await ref.get();

    if (!snap.exists) {
      return false;
    }

    await ref.delete();
    return true;
  }
}
