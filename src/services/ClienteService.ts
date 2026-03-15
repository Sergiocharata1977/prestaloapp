import { FIN_COLLECTIONS } from '@/firebase/collections';
import { getAdminFirestore } from '@/lib/firebase/admin';
import type {
  FinCliente,
  FinClienteCreateInput,
  FinClienteNosisUltimo,
} from '@/types/fin-cliente';
import { FieldValue } from 'firebase-admin/firestore';

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeDigits(value: string | undefined): string {
  return (value || '').replace(/\D/g, '');
}

function normalizeText(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function prefixBounds(value: string) {
  return [value, `${value}\uf8ff`] as const;
}

function mapDoc(doc: FirebaseFirestore.DocumentSnapshot): FinCliente | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinCliente;
}

export class ClienteService {
  static async crear(
    orgId: string,
    input: FinClienteCreateInput,
    usuarioId: string
  ): Promise<string> {
    const db = getAdminFirestore();
    const cuit = normalizeDigits(input.cuit);

    if (!cuit) {
      throw new Error('El CUIT es requerido');
    }

    const existente = await this.getByCuit(orgId, cuit);
    if (existente) {
      throw new Error('Ya existe un cliente con ese CUIT');
    }

    const now = nowIso();
    const ref = db.collection(FIN_COLLECTIONS.clientes(orgId)).doc();

    const payload: Omit<FinCliente, 'id'> & {
      nombre_normalized: string;
      apellido_normalized?: string;
      cuit_normalized: string;
      dni_normalized?: string;
    } = {
      ...input,
      organization_id: orgId,
      nombre: input.nombre.trim(),
      apellido: input.apellido?.trim() || undefined,
      dni: normalizeDigits(input.dni) || undefined,
      cuit,
      telefono: input.telefono?.trim() || undefined,
      email: input.email?.trim() || undefined,
      domicilio: input.domicilio?.trim() || undefined,
      localidad: input.localidad?.trim() || undefined,
      provincia: input.provincia?.trim() || undefined,
      creditos_activos_count: 0,
      saldo_total_adeudado: 0,
      created_at: now,
      created_by: usuarioId,
      updated_at: now,
      nombre_normalized: normalizeText(input.nombre),
      apellido_normalized: normalizeText(input.apellido) || undefined,
      cuit_normalized: cuit,
      dni_normalized: normalizeDigits(input.dni) || undefined,
    };

    await ref.set(payload);
    return ref.id;
  }

  static async getById(
    orgId: string,
    clienteId: string
  ): Promise<FinCliente | null> {
    const db = getAdminFirestore();
    const doc = await db.doc(FIN_COLLECTIONS.cliente(orgId, clienteId)).get();
    return mapDoc(doc);
  }

  static async getByCuit(
    orgId: string,
    cuit: string
  ): Promise<FinCliente | null> {
    const db = getAdminFirestore();
    const cuitNormalizado = normalizeDigits(cuit);

    if (!cuitNormalizado) {
      return null;
    }

    const snapshot = await db
      .collection(FIN_COLLECTIONS.clientes(orgId))
      .where('cuit_normalized', '==', cuitNormalizado)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    } as FinCliente;
  }

  static async buscar(orgId: string, query: string): Promise<FinCliente[]> {
    const db = getAdminFirestore();
    const raw = query.trim();

    if (raw.length < 3) {
      return [];
    }

    const normalized = normalizeText(raw);
    const digits = normalizeDigits(raw);
    const [nameStart, nameEnd] = prefixBounds(normalized);
    const promises: Promise<FirebaseFirestore.QuerySnapshot>[] = [
      db
        .collection(FIN_COLLECTIONS.clientes(orgId))
        .where('nombre_normalized', '>=', nameStart)
        .where('nombre_normalized', '<=', nameEnd)
        .limit(10)
        .get(),
      db
        .collection(FIN_COLLECTIONS.clientes(orgId))
        .where('apellido_normalized', '>=', nameStart)
        .where('apellido_normalized', '<=', nameEnd)
        .limit(10)
        .get(),
    ];

    if (digits) {
      promises.push(
        db
          .collection(FIN_COLLECTIONS.clientes(orgId))
          .where('cuit_normalized', '==', digits)
          .limit(10)
          .get(),
        db
          .collection(FIN_COLLECTIONS.clientes(orgId))
          .where('dni_normalized', '==', digits)
          .limit(10)
          .get()
      );
    }

    const snapshots = await Promise.all(promises);
    const seen = new Map<string, FinCliente>();

    for (const snapshot of snapshots) {
      for (const doc of snapshot.docs) {
        if (!seen.has(doc.id)) {
          seen.set(doc.id, {
            id: doc.id,
            ...doc.data(),
          } as FinCliente);
        }
      }
    }

    return [...seen.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es')
    );
  }

  static async actualizarNosisUltimo(
    orgId: string,
    clienteId: string,
    nosis: FinClienteNosisUltimo
  ): Promise<void> {
    const db = getAdminFirestore();
    await db.doc(FIN_COLLECTIONS.cliente(orgId, clienteId)).update({
      nosis_ultimo: nosis,
      updated_at: nowIso(),
    });
  }

  static async incrementarCreditosActivos(
    orgId: string,
    clienteId: string,
    deltaCapital: number
  ): Promise<void> {
    const db = getAdminFirestore();
    await db.doc(FIN_COLLECTIONS.cliente(orgId, clienteId)).update({
      creditos_activos_count: FieldValue.increment(1),
      saldo_total_adeudado: FieldValue.increment(deltaCapital),
      updated_at: nowIso(),
    });
  }

  static async decrementarCreditosActivos(
    orgId: string,
    clienteId: string,
    deltaCapital: number
  ): Promise<void> {
    const db = getAdminFirestore();
    await db.doc(FIN_COLLECTIONS.cliente(orgId, clienteId)).update({
      creditos_activos_count: FieldValue.increment(-1),
      saldo_total_adeudado: FieldValue.increment(-deltaCapital),
      updated_at: nowIso(),
    });
  }
}
