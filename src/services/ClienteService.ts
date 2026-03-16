import { FIN_COLLECTIONS } from '@/firebase/collections';
import { getAdminFirestore } from '@/firebase/admin';
import type {
  FinCliente,
  FinClienteCreateInput,
  FinClienteNosisUltimo,
} from '@/types/fin-cliente';
import { FieldValue } from 'firebase-admin/firestore';

type FinClienteUpdateInput = Partial<FinClienteCreateInput>;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeDigits(value: string | undefined): string {
  return (value || '').replace(/\D/g, '');
}

function normalizeText(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function optionalTextUpdate(value: string | undefined) {
  const normalized = value?.trim() || undefined;
  return normalized ?? FieldValue.delete();
}

function optionalDigitsUpdate(value: string | undefined) {
  const normalized = normalizeDigits(value) || undefined;
  return normalized ?? FieldValue.delete();
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

  static async list(orgId: string, limit = 50): Promise<FinCliente[]> {
    const db = getAdminFirestore();
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const snapshot = await db
      .collection(FIN_COLLECTIONS.clientes(orgId))
      .orderBy('updated_at', 'desc')
      .limit(safeLimit)
      .get();

    return snapshot.docs
      .map(doc => mapDoc(doc))
      .filter((cliente): cliente is FinCliente => Boolean(cliente));
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

  static async actualizar(
    orgId: string,
    clienteId: string,
    input: FinClienteUpdateInput
  ): Promise<FinCliente | null> {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.cliente(orgId, clienteId));
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return null;
    }

    const actual = mapDoc(snapshot);
    if (!actual) {
      return null;
    }

    const updates: Record<string, unknown> = {
      updated_at: nowIso(),
    };

    if (typeof input.tipo === 'string') {
      updates.tipo = input.tipo;
    }

    if (typeof input.nombre === 'string') {
      const nombre = input.nombre.trim();
      if (!nombre) {
        throw new Error('El nombre es requerido');
      }
      updates.nombre = nombre;
      updates.nombre_normalized = normalizeText(nombre);
    }

    if ('apellido' in input) {
      updates.apellido = optionalTextUpdate(input.apellido);
      updates.apellido_normalized = normalizeText(input.apellido) || FieldValue.delete();
    }

    if ('dni' in input) {
      const dni = normalizeDigits(input.dni) || undefined;
      updates.dni = optionalDigitsUpdate(input.dni);
      updates.dni_normalized = dni || FieldValue.delete();
    }

    if ('cuit' in input) {
      const cuit = normalizeDigits(input.cuit);
      if (!cuit) {
        throw new Error('El CUIT es requerido');
      }

      if (cuit !== actual.cuit) {
        const existente = await this.getByCuit(orgId, cuit);
        if (existente && existente.id !== clienteId) {
          throw new Error('Ya existe un cliente con ese CUIT');
        }
      }

      updates.cuit = cuit;
      updates.cuit_normalized = cuit;
    }

    if ('telefono' in input) {
      updates.telefono = optionalTextUpdate(input.telefono);
    }

    if ('email' in input) {
      updates.email = optionalTextUpdate(input.email);
    }

    if ('domicilio' in input) {
      updates.domicilio = optionalTextUpdate(input.domicilio);
    }

    if ('localidad' in input) {
      updates.localidad = optionalTextUpdate(input.localidad);
    }

    if ('provincia' in input) {
      updates.provincia = optionalTextUpdate(input.provincia);
    }

    await ref.update(updates);
    return this.getById(orgId, clienteId);
  }

  static async eliminar(orgId: string, clienteId: string): Promise<boolean> {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.cliente(orgId, clienteId));
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return false;
    }

    await ref.delete();
    return true;
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
