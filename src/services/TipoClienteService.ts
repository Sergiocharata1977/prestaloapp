import { FIN_COLLECTIONS } from '@/firebase/collections';
import { getAdminFirestore } from '@/firebase/admin';
import type {
  FinTipoCliente,
  FinTipoClienteCreateInput,
} from '@/types/fin-tipo-cliente';

type TipoClienteListFilters = {
  activo?: boolean;
};

type TipoClienteUpdateInput = Partial<FinTipoClienteCreateInput>;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: string | undefined): string {
  return (value || '').trim();
}

function normalizeCode(value: string | undefined): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function mapTipoCliente(
  doc: FirebaseFirestore.DocumentSnapshot
): FinTipoCliente | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinTipoCliente;
}

export class TipoClienteService {
  static async crear(
    orgId: string,
    input: FinTipoClienteCreateInput
  ): Promise<FinTipoCliente> {
    const db = getAdminFirestore();
    const ref = db.collection(FIN_COLLECTIONS.tiposCliente(orgId)).doc();
    const now = nowIso();
    const nombre = normalizeText(input.nombre);
    const codigo = normalizeCode(input.codigo);

    if (!nombre) {
      throw new Error('nombre requerido');
    }

    if (!codigo) {
      throw new Error('codigo requerido');
    }

    const payload: Omit<FinTipoCliente, 'id'> = {
      ...input,
      organization_id: orgId,
      nombre,
      codigo,
      descripcion: normalizeText(input.descripcion) || undefined,
      created_at: now,
      updated_at: now,
    };

    await ref.set(payload);

    return {
      id: ref.id,
      ...payload,
    };
  }

  static async getById(
    orgId: string,
    tipoClienteId: string
  ): Promise<FinTipoCliente | null> {
    const db = getAdminFirestore();
    const doc = await db.doc(FIN_COLLECTIONS.tipoCliente(orgId, tipoClienteId)).get();
    return mapTipoCliente(doc);
  }

  static async list(
    orgId: string,
    filters: TipoClienteListFilters = {}
  ): Promise<FinTipoCliente[]> {
    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(
      FIN_COLLECTIONS.tiposCliente(orgId)
    );

    if (typeof filters.activo === 'boolean') {
      query = query.where('activo', '==', filters.activo);
    }

    const snapshot = await query.get();

    return snapshot.docs
      .map(doc => mapTipoCliente(doc))
      .filter((item): item is FinTipoCliente => Boolean(item))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  static async actualizar(
    orgId: string,
    tipoClienteId: string,
    input: TipoClienteUpdateInput
  ): Promise<FinTipoCliente | null> {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.tipoCliente(orgId, tipoClienteId));
    const snap = await ref.get();

    if (!snap.exists) {
      return null;
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

    if (typeof input.codigo === 'string') {
      const codigo = normalizeCode(input.codigo);
      if (!codigo) {
        throw new Error('codigo requerido');
      }

      updates.codigo = codigo;
    }

    if ('descripcion' in input) {
      updates.descripcion = normalizeText(input.descripcion) || null;
    }

    const passthroughKeys: Array<keyof FinTipoClienteCreateInput> = [
      'tipo_base',
      'activo',
      'requiere_legajo',
      'requiere_evaluacion_vigente',
      'permite_cheques_propios',
      'permite_cheques_terceros',
      'limite_mensual',
      'limite_total',
      'tier_minimo_requerido',
    ];

    for (const key of passthroughKeys) {
      if (key in input) {
        updates[key] = input[key] ?? null;
      }
    }

    await ref.update(updates);
    return this.getById(orgId, tipoClienteId);
  }

  static async eliminar(orgId: string, tipoClienteId: string): Promise<boolean> {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.tipoCliente(orgId, tipoClienteId));
    const snap = await ref.get();

    if (!snap.exists) {
      return false;
    }

    await ref.delete();
    return true;
  }
}
