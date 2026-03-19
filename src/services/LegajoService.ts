import { FIN_COLLECTIONS } from '@/firebase/collections';
import { getAdminFirestore } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

type LegajoDocumentoEstado =
  | 'pendiente'
  | 'presentado'
  | 'aprobado'
  | 'rechazado'
  | 'vencido';

type LegajoDocumentoInput = {
  tipo: string;
  nombre: string;
  descripcion?: string;
  estado?: LegajoDocumentoEstado;
  obligatorio?: boolean;
  archivo_url?: string;
  archivo_nombre?: string;
  archivo_mime?: string;
  archivo_size?: number;
  fecha_vencimiento?: string;
  metadata?: Record<string, unknown>;
};

type LegajoDocumentoMutableInput = Partial<Omit<LegajoDocumentoInput, 'metadata'>> & {
  metadata?: Record<string, unknown> | null;
};

export type FinLegajoDocumento = {
  id: string;
  legajo_id: string;
  cliente_id: string;
  organization_id: string;
  tipo: string;
  nombre: string;
  descripcion?: string;
  estado: LegajoDocumentoEstado;
  obligatorio: boolean;
  archivo_url?: string;
  archivo_nombre?: string;
  archivo_mime?: string;
  archivo_size?: number;
  fecha_vencimiento?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};

export type FinLegajo = {
  id: string;
  cliente_id: string;
  organization_id: string;
  completo: boolean;
  documentos_total: number;
  documentos_obligatorios: number;
  documentos_obligatorios_aprobados: number;
  documentos_pendientes: number;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};

export type FinLegajoDetalle = FinLegajo & {
  documentos: FinLegajoDocumento[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${field} requerido`);
  }

  return normalized;
}

function validateOptionalDate(value: string | undefined, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`${field} invalida`);
  }

  return normalized;
}

function validateEstado(value: string | undefined): LegajoDocumentoEstado {
  if (!value) {
    return 'pendiente';
  }

  const estados: LegajoDocumentoEstado[] = [
    'pendiente',
    'presentado',
    'aprobado',
    'rechazado',
    'vencido',
  ];

  if (!estados.includes(value as LegajoDocumentoEstado)) {
    throw new Error('estado invalido');
  }

  return value as LegajoDocumentoEstado;
}

function mapDocumento(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): FinLegajoDocumento | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinLegajoDocumento;
}

function mapLegajo(doc: FirebaseFirestore.DocumentSnapshot): FinLegajo | null {
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as FinLegajo;
}

function buildLegajoSummary(
  legajo: FinLegajo,
  documentos: FinLegajoDocumento[]
): FinLegajo {
  const documentosObligatorios = documentos.filter((documento) => documento.obligatorio);
  const documentosObligatoriosAprobados = documentosObligatorios.filter(
    (documento) => documento.estado === 'aprobado'
  );
  const documentosPendientes = documentos.filter((documento) =>
    documento.obligatorio
      ? documento.estado !== 'aprobado'
      : documento.estado === 'pendiente' || documento.estado === 'rechazado'
  );
  const completo =
    documentosObligatorios.length > 0 &&
    documentosObligatoriosAprobados.length === documentosObligatorios.length;

  return {
    ...legajo,
    completo,
    documentos_total: documentos.length,
    documentos_obligatorios: documentosObligatorios.length,
    documentos_obligatorios_aprobados: documentosObligatoriosAprobados.length,
    documentos_pendientes: documentosPendientes.length,
  };
}

async function persistLegajoSummary(
  orgId: string,
  legajoId: string,
  summary: FinLegajo,
  userId: string
): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(FIN_COLLECTIONS.legajo(orgId, legajoId)).set(
    {
      completo: summary.completo,
      documentos_total: summary.documentos_total,
      documentos_obligatorios: summary.documentos_obligatorios,
      documentos_obligatorios_aprobados: summary.documentos_obligatorios_aprobados,
      documentos_pendientes: summary.documentos_pendientes,
      updated_at: nowIso(),
      updated_by: userId,
    },
    { merge: true }
  );
}

export class LegajoService {
  static async getById(orgId: string, legajoId: string): Promise<FinLegajo | null> {
    const db = getAdminFirestore();
    const doc = await db.doc(FIN_COLLECTIONS.legajo(orgId, legajoId)).get();
    return mapLegajo(doc);
  }

  static async getByClienteId(orgId: string, clienteId: string): Promise<FinLegajo | null> {
    const db = getAdminFirestore();
    const snapshot = await db
      .collection(FIN_COLLECTIONS.legajos(orgId))
      .where('cliente_id', '==', clienteId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    } as FinLegajo;
  }

  static async getOrCreate(
    orgId: string,
    clienteId: string,
    userId: string
  ): Promise<FinLegajo> {
    const existente = await this.getByClienteId(orgId, clienteId);
    if (existente) {
      return this.refreshEstado(orgId, existente.id, userId);
    }

    const db = getAdminFirestore();
    const now = nowIso();
    const ref = db.collection(FIN_COLLECTIONS.legajos(orgId)).doc();

    const payload: Omit<FinLegajo, 'id'> = {
      cliente_id: clienteId,
      organization_id: orgId,
      completo: false,
      documentos_total: 0,
      documentos_obligatorios: 0,
      documentos_obligatorios_aprobados: 0,
      documentos_pendientes: 0,
      created_at: now,
      created_by: userId,
      updated_at: now,
      updated_by: userId,
    };

    await ref.set(payload);

    return {
      id: ref.id,
      ...payload,
    };
  }

  static async listDocumentos(
    orgId: string,
    clienteId: string
  ): Promise<{ legajo: FinLegajo; documentos: FinLegajoDocumento[] }> {
    const legajo = await this.getOrCreate(orgId, clienteId, 'system');
    const db = getAdminFirestore();
    const snapshot = await db
      .collection(FIN_COLLECTIONS.legajoDocumentos(orgId, legajo.id))
      .orderBy('created_at', 'desc')
      .get();

    const documentos = snapshot.docs
      .map((doc) => mapDocumento(doc))
      .filter((documento): documento is FinLegajoDocumento => Boolean(documento));
    const summary = buildLegajoSummary(legajo, documentos);

    return { legajo: summary, documentos };
  }

  static async getDetalle(
    orgId: string,
    clienteId: string,
    userId: string
  ): Promise<FinLegajoDetalle> {
    const legajo = await this.getOrCreate(orgId, clienteId, userId);
    const db = getAdminFirestore();
    const snapshot = await db
      .collection(FIN_COLLECTIONS.legajoDocumentos(orgId, legajo.id))
      .orderBy('created_at', 'desc')
      .get();

    const documentos = snapshot.docs
      .map((doc) => mapDocumento(doc))
      .filter((documento): documento is FinLegajoDocumento => Boolean(documento));
    const summary = buildLegajoSummary(legajo, documentos);

    await persistLegajoSummary(orgId, legajo.id, summary, userId);

    return {
      ...summary,
      documentos,
    };
  }

  static async addDocumento(
    orgId: string,
    clienteId: string,
    input: LegajoDocumentoInput,
    userId: string
  ): Promise<FinLegajoDocumento> {
    const legajo = await this.getOrCreate(orgId, clienteId, userId);
    const db = getAdminFirestore();
    const ref = db.collection(FIN_COLLECTIONS.legajoDocumentos(orgId, legajo.id)).doc();
    const now = nowIso();

    const payload: Omit<FinLegajoDocumento, 'id'> = {
      legajo_id: legajo.id,
      cliente_id: clienteId,
      organization_id: orgId,
      tipo: normalizeText(input.tipo, 'tipo'),
      nombre: normalizeText(input.nombre, 'nombre'),
      descripcion: input.descripcion?.trim() || undefined,
      estado: validateEstado(input.estado),
      obligatorio: Boolean(input.obligatorio),
      archivo_url: input.archivo_url?.trim() || undefined,
      archivo_nombre: input.archivo_nombre?.trim() || undefined,
      archivo_mime: input.archivo_mime?.trim() || undefined,
      archivo_size:
        typeof input.archivo_size === 'number' && Number.isFinite(input.archivo_size)
          ? input.archivo_size
          : undefined,
      fecha_vencimiento: validateOptionalDate(input.fecha_vencimiento, 'fecha_vencimiento'),
      metadata: input.metadata,
      created_at: now,
      created_by: userId,
      updated_at: now,
      updated_by: userId,
    };

    await ref.set(payload);
    await this.refreshEstado(orgId, legajo.id, userId);

    return {
      id: ref.id,
      ...payload,
    };
  }

  static async updateDocumento(
    orgId: string,
    clienteId: string,
    documentoId: string,
    input: LegajoDocumentoMutableInput,
    userId: string
  ): Promise<FinLegajoDocumento | null> {
    const legajo = await this.getOrCreate(orgId, clienteId, userId);
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.legajoDocumento(orgId, legajo.id, documentoId));
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return null;
    }

    const updates: Record<string, unknown> = {
      updated_at: nowIso(),
      updated_by: userId,
    };

    if ('tipo' in input) {
      updates.tipo = normalizeText(input.tipo, 'tipo');
    }

    if ('nombre' in input) {
      updates.nombre = normalizeText(input.nombre, 'nombre');
    }

    if ('descripcion' in input) {
      updates.descripcion = input.descripcion?.trim() || FieldValue.delete();
    }

    if ('estado' in input) {
      updates.estado = validateEstado(input.estado);
    }

    if ('obligatorio' in input) {
      updates.obligatorio = Boolean(input.obligatorio);
    }

    if ('archivo_url' in input) {
      updates.archivo_url = input.archivo_url?.trim() || FieldValue.delete();
    }

    if ('archivo_nombre' in input) {
      updates.archivo_nombre = input.archivo_nombre?.trim() || FieldValue.delete();
    }

    if ('archivo_mime' in input) {
      updates.archivo_mime = input.archivo_mime?.trim() || FieldValue.delete();
    }

    if ('archivo_size' in input) {
      updates.archivo_size =
        typeof input.archivo_size === 'number' && Number.isFinite(input.archivo_size)
          ? input.archivo_size
          : FieldValue.delete();
    }

    if ('fecha_vencimiento' in input) {
      updates.fecha_vencimiento =
        validateOptionalDate(input.fecha_vencimiento, 'fecha_vencimiento') ??
        FieldValue.delete();
    }

    if ('metadata' in input) {
      updates.metadata = input.metadata ?? FieldValue.delete();
    }

    await ref.update(updates);
    await this.refreshEstado(orgId, legajo.id, userId);

    const updated = await ref.get();
    return mapDocumento(updated);
  }

  static async getDocumento(
    orgId: string,
    clienteId: string,
    documentoId: string,
    userId: string
  ): Promise<FinLegajoDocumento | null> {
    const legajo = await this.getOrCreate(orgId, clienteId, userId);
    const db = getAdminFirestore();
    const doc = await db.doc(FIN_COLLECTIONS.legajoDocumento(orgId, legajo.id, documentoId)).get();
    return mapDocumento(doc);
  }

  static async refreshEstado(
    orgId: string,
    legajoId: string,
    userId: string
  ): Promise<FinLegajo> {
    const legajo = await this.getById(orgId, legajoId);
    if (!legajo) {
      throw new Error('Legajo no encontrado');
    }

    const db = getAdminFirestore();
    const snapshot = await db
      .collection(FIN_COLLECTIONS.legajoDocumentos(orgId, legajoId))
      .get();
    const documentos = snapshot.docs
      .map((doc) => mapDocumento(doc))
      .filter((documento): documento is FinLegajoDocumento => Boolean(documento));
    const summary = buildLegajoSummary(legajo, documentos);

    await persistLegajoSummary(orgId, legajoId, summary, userId);

    return {
      ...summary,
      updated_at: nowIso(),
      updated_by: userId,
    };
  }
}
