import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import type {
  FinCtaCtePolitica,
  FinCtaCtePoliticaInput,
} from '@/types/fin-ctacte';

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: string | undefined): string {
  return (value || '').trim();
}

function mapPolitica(
  doc: FirebaseFirestore.DocumentSnapshot
): FinCtaCtePolitica | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinCtaCtePolitica;
}

export class CtaCtePoliticaService {
  static async crear(
    orgId: string,
    input: FinCtaCtePoliticaInput,
    usuarioId: string
  ): Promise<FinCtaCtePolitica> {
    const db = getAdminFirestore();
    const ref = db.collection(FIN_COLLECTIONS.ctaCtePoliticas(orgId)).doc();
    const now = nowIso();
    const nombre = normalizeText(input.nombre);

    if (!nombre) {
      throw new Error('nombre requerido');
    }

    const payload: Omit<FinCtaCtePolitica, 'id'> = {
      organization_id: orgId,
      nombre,
      descripcion: normalizeText(input.descripcion) || undefined,
      activa: input.activa,
      reglas: input.reglas,
      createdAt: now,
      createdBy: usuarioId,
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
  ): Promise<FinCtaCtePolitica | null> {
    const db = getAdminFirestore();
    const doc = await db.doc(FIN_COLLECTIONS.ctaCtePolitica(orgId, politicaId)).get();
    return mapPolitica(doc);
  }

  static async list(
    orgId: string,
    filters: { activa?: boolean } = {}
  ): Promise<FinCtaCtePolitica[]> {
    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(
      FIN_COLLECTIONS.ctaCtePoliticas(orgId)
    );

    if (typeof filters.activa === 'boolean') {
      query = query.where('activa', '==', filters.activa);
    }

    const snapshot = await query.get();
    return snapshot.docs
      .map((doc) => mapPolitica(doc))
      .filter((item): item is FinCtaCtePolitica => Boolean(item))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  static async actualizar(
    orgId: string,
    politicaId: string,
    input: Partial<FinCtaCtePoliticaInput>
  ): Promise<FinCtaCtePolitica | null> {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.ctaCtePolitica(orgId, politicaId));
    const snap = await ref.get();

    if (!snap.exists) {
      return null;
    }

    const updates: Record<string, unknown> = {};

    if (typeof input.nombre === 'string') {
      const nombre = normalizeText(input.nombre);
      if (!nombre) {
        throw new Error('nombre requerido');
      }

      updates.nombre = nombre;
    }

    if ('descripcion' in input) {
      updates.descripcion = normalizeText(input.descripcion) || null;
    }

    if (typeof input.activa === 'boolean') {
      updates.activa = input.activa;
    }

    if (input.reglas) {
      updates.reglas = input.reglas;
    }

    await ref.update(updates);
    return this.getById(orgId, politicaId);
  }
}
