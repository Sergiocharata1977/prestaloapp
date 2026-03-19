import { FIN_COLLECTIONS } from '@/firebase/collections';
import { getAdminFirestore } from '@/firebase/admin';
import type {
  FinPoliticaCrediticia,
  FinPoliticaCrediticiaCreateInput,
} from '@/types/fin-politica-crediticia';

type PoliticaListFilters = {
  tipo_cliente_id?: string;
  activo?: boolean;
};

type PoliticaUpdateInput = Partial<FinPoliticaCrediticiaCreateInput>;

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

function mapPolitica(
  doc: FirebaseFirestore.DocumentSnapshot
): FinPoliticaCrediticia | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinPoliticaCrediticia;
}

async function assertTipoClienteExists(orgId: string, tipoClienteId: string) {
  const db = getAdminFirestore();
  const snap = await db.doc(FIN_COLLECTIONS.tipoCliente(orgId, tipoClienteId)).get();

  if (!snap.exists) {
    throw new Error('Tipo de cliente no encontrado');
  }
}

export class PoliticaCrediticiaService {
  static async crear(
    orgId: string,
    input: FinPoliticaCrediticiaCreateInput
  ): Promise<FinPoliticaCrediticia> {
    const db = getAdminFirestore();
    const ref = db.collection(FIN_COLLECTIONS.politicasCrediticias(orgId)).doc();
    const now = nowIso();
    const nombre = normalizeText(input.nombre);
    const codigo = normalizeCode(input.codigo);

    if (!nombre) {
      throw new Error('nombre requerido');
    }

    if (!codigo) {
      throw new Error('codigo requerido');
    }

    await assertTipoClienteExists(orgId, input.tipo_cliente_id);

    const payload: Omit<FinPoliticaCrediticia, 'id'> = {
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
    politicaId: string
  ): Promise<FinPoliticaCrediticia | null> {
    const db = getAdminFirestore();
    const doc = await db
      .doc(FIN_COLLECTIONS.politicaCrediticia(orgId, politicaId))
      .get();
    return mapPolitica(doc);
  }

  static async list(
    orgId: string,
    filters: PoliticaListFilters = {}
  ): Promise<FinPoliticaCrediticia[]> {
    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(
      FIN_COLLECTIONS.politicasCrediticias(orgId)
    );

    if (filters.tipo_cliente_id) {
      query = query.where('tipo_cliente_id', '==', filters.tipo_cliente_id);
    }

    if (typeof filters.activo === 'boolean') {
      query = query.where('activo', '==', filters.activo);
    }

    const snapshot = await query.get();

    return snapshot.docs
      .map(doc => mapPolitica(doc))
      .filter((item): item is FinPoliticaCrediticia => Boolean(item))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  static async actualizar(
    orgId: string,
    politicaId: string,
    input: PoliticaUpdateInput
  ): Promise<FinPoliticaCrediticia | null> {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.politicaCrediticia(orgId, politicaId));
    const snap = await ref.get();

    if (!snap.exists) {
      return null;
    }

    if (typeof input.tipo_cliente_id === 'string') {
      await assertTipoClienteExists(orgId, input.tipo_cliente_id);
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

    const passthroughKeys: Array<keyof FinPoliticaCrediticiaCreateInput> = [
      'tipo_cliente_id',
      'tipo_operacion',
      'activo',
      'requiere_legajo',
      'requiere_evaluacion_vigente',
      'permite_cheques_propios',
      'permite_cheques_terceros',
      'dias_vigencia_evaluacion',
      'monto_minimo',
      'monto_maximo',
      'limite_mensual',
      'limite_total',
      'tiers',
    ];

    for (const key of passthroughKeys) {
      if (key in input) {
        updates[key] = input[key] ?? null;
      }
    }

    await ref.update(updates);
    return this.getById(orgId, politicaId);
  }

  static async eliminar(orgId: string, politicaId: string): Promise<boolean> {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.politicaCrediticia(orgId, politicaId));
    const snap = await ref.get();

    if (!snap.exists) {
      return false;
    }

    await ref.delete();
    return true;
  }
}
