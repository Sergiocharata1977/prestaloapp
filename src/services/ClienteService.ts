import { FIN_COLLECTIONS } from '@/firebase/collections';
import { getAdminFirestore } from '@/firebase/admin';
import { ScoringService } from '@/services/ScoringService';
import type {
  FinCliente,
  FinClienteCreateInput,
  FinClienteLegajo,
  FinClienteNosisConsulta,
  FinClienteNosisUltimo,
} from '@/types/fin-cliente';
import { FieldValue } from 'firebase-admin/firestore';

type FinClienteUpdateInput = Partial<FinClienteCreateInput>;

function nowIso(): string {
  return new Date().toISOString();
}

function addMonthsIso(dateIso: string, months: number): string {
  const date = new Date(dateIso);

  if (Number.isNaN(date.getTime())) {
    return dateIso;
  }

  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString();
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

function normalizeLegajo(legajo?: FinClienteLegajo) {
  if (!legajo) {
    return FieldValue.delete();
  }

  const now = nowIso();
  const checklist = Array.isArray(legajo.checklist)
    ? legajo.checklist.map((item, index) => ({
        id: item.id?.trim() || `check-${index + 1}`,
        clave: item.clave?.trim() || `item-${index + 1}`,
        label: item.label?.trim() || `Item ${index + 1}`,
        obligatorio: Boolean(item.obligatorio),
        completo: Boolean(item.completo),
        observaciones: item.observaciones?.trim() || undefined,
        updated_at: now,
      }))
    : [];

  const documentos = Array.isArray(legajo.documentos)
    ? legajo.documentos
        .map((documento, index) => {
          const nombre = documento.nombre?.trim();
          const categoria = documento.categoria?.trim();

          if (!nombre || !categoria) {
            return null;
          }

          return {
            id: documento.id?.trim() || `doc-${index + 1}`,
            nombre,
            categoria,
            estado: documento.estado ?? 'pendiente',
            archivo_nombre: documento.archivo_nombre?.trim() || undefined,
            observaciones: documento.observaciones?.trim() || undefined,
            updated_at: now,
          };
        })
        .filter((documento): documento is NonNullable<typeof documento> => Boolean(documento))
    : [];

  const requeridos = checklist.filter(item => item.obligatorio);
  const estado =
    requeridos.length > 0 && requeridos.every(item => item.completo)
      ? 'completo'
      : 'incompleto';

  return {
    estado,
    checklist,
    documentos,
    notas: legajo.notas?.trim() || undefined,
    updated_at: now,
  } satisfies FinClienteLegajo;
}

function prefixBounds(value: string) {
  return [value, `${value}\uf8ff`] as const;
}

function normalizeMoney(value: number, fieldName: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} invalido`);
  }

  if (value < 0) {
    throw new Error(`${fieldName} no puede ser negativo`);
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateCupoDisponible(
  limiteCreditoVigente?: number,
  saldoTotalAdeudado = 0
): number {
  const limite = Number.isFinite(limiteCreditoVigente) ? Number(limiteCreditoVigente) : 0;
  const saldo = Number.isFinite(saldoTotalAdeudado) ? Number(saldoTotalAdeudado) : 0;

  return Math.max(normalizeMoney(limite, 'limite_credito_vigente') - normalizeMoney(saldo, 'saldo_total_adeudado'), 0);
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
  static buildLineaCredito(cliente: FinCliente) {
    const limite_credito_asignado =
      typeof cliente.limite_credito_asignado === 'number'
        ? cliente.limite_credito_asignado
        : null;
    const limite_credito_vigente =
      typeof cliente.limite_credito_vigente === 'number'
        ? cliente.limite_credito_vigente
        : limite_credito_asignado;

    return {
      cliente_id: cliente.id,
      organization_id: cliente.organization_id,
      tier_crediticio: cliente.tier_crediticio ?? null,
      limite_credito_asignado,
      limite_credito_vigente,
      saldo_total_adeudado: cliente.saldo_total_adeudado ?? 0,
      cupo_disponible: calculateCupoDisponible(
        limite_credito_vigente ?? undefined,
        cliente.saldo_total_adeudado
      ),
      evaluacion_id_ultima: cliente.evaluacion_id_ultima ?? null,
      evaluacion_vigente_hasta: cliente.evaluacion_vigente_hasta ?? null,
      updated_at: cliente.updated_at,
    };
  }

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

  static async list(
    orgId: string,
    limit = 50,
    filters: { tipoClienteId?: string } = {}
  ): Promise<FinCliente[]> {
    const db = getAdminFirestore();
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    let query: FirebaseFirestore.Query = db
      .collection(FIN_COLLECTIONS.clientes(orgId))
      .orderBy('updated_at', 'desc');

    if (filters.tipoClienteId) {
      query = query.where('tipo_cliente_id', '==', filters.tipoClienteId);
    }

    const snapshot = await query.limit(safeLimit).get();

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

    if ('legajo' in input) {
      updates.legajo = normalizeLegajo(input.legajo);
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

  static async obtenerLineaCredito(orgId: string, clienteId: string) {
    const cliente = await this.getById(orgId, clienteId);

    if (!cliente) {
      return null;
    }

    return this.buildLineaCredito(cliente);
  }

  static async asignarLineaCredito(
    orgId: string,
    clienteId: string,
    input: {
      limite_credito_asignado: number;
      limite_credito_vigente?: number;
      tier_crediticio?: FinCliente['tier_crediticio'];
      evaluacion_id_ultima?: string;
      evaluacion_vigente_hasta?: string;
    }
  ) {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.cliente(orgId, clienteId));
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return null;
    }

    const limiteAsignado = normalizeMoney(
      input.limite_credito_asignado,
      'limite_credito_asignado'
    );
    const limiteVigente = normalizeMoney(
      input.limite_credito_vigente ?? input.limite_credito_asignado,
      'limite_credito_vigente'
    );

    if (limiteVigente > limiteAsignado) {
      throw new Error('limite_credito_vigente no puede superar limite_credito_asignado');
    }

    if (
      input.evaluacion_vigente_hasta &&
      Number.isNaN(new Date(input.evaluacion_vigente_hasta).getTime())
    ) {
      throw new Error('evaluacion_vigente_hasta invalida');
    }

    const updates: Record<string, unknown> = {
      limite_credito_asignado: limiteAsignado,
      limite_credito_vigente: limiteVigente,
      updated_at: nowIso(),
    };

    if ('tier_crediticio' in input) {
      updates.tier_crediticio = input.tier_crediticio ?? FieldValue.delete();
    }

    if ('evaluacion_id_ultima' in input) {
      updates.evaluacion_id_ultima = input.evaluacion_id_ultima?.trim() || FieldValue.delete();
    }

    if ('evaluacion_vigente_hasta' in input) {
      updates.evaluacion_vigente_hasta =
        input.evaluacion_vigente_hasta?.trim() || FieldValue.delete();
    }

    await ref.update(updates);
    return this.obtenerLineaCredito(orgId, clienteId);
  }

  static async recalcularLineaCredito(orgId: string, clienteId: string) {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.cliente(orgId, clienteId));
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return null;
    }

    const cliente = mapDoc(snapshot);
    if (!cliente) {
      return null;
    }

    const evaluacion = await db
      .collection(FIN_COLLECTIONS.evaluaciones(orgId))
      .where('cliente_id', '==', clienteId)
      .where('estado', '==', 'aprobada')
      .orderBy('updated_at', 'desc')
      .limit(1)
      .get();

    const evaluacionAprobada = evaluacion.empty
      ? null
      : ({
          id: evaluacion.docs[0].id,
          ...evaluacion.docs[0].data(),
        } as Awaited<ReturnType<typeof ScoringService.getUltimaEvaluacion>> extends infer T
          ? NonNullable<T>
          : never);

    let evaluacionVigenteHasta = cliente.evaluacion_vigente_hasta;

    if (evaluacionAprobada) {
      const config = await ScoringService.getOrCreateConfig(orgId);
      const baseDate =
        evaluacionAprobada.decision.decidida_at ??
        evaluacionAprobada.updated_at ??
        nowIso();
      evaluacionVigenteHasta = addMonthsIso(baseDate, config.frecuencia_vigencia_meses);
    }

    const limiteAsignadoEvaluacion =
      evaluacionAprobada?.limite_credito_asignado ??
      evaluacionAprobada?.decision?.limite_credito_asignado;
    const tierEvaluacion =
      evaluacionAprobada?.tier_asignado ??
      evaluacionAprobada?.decision?.tier_asignado ??
      evaluacionAprobada?.tier_sugerido;

    const limiteAsignado =
      typeof limiteAsignadoEvaluacion === 'number'
        ? normalizeMoney(limiteAsignadoEvaluacion, 'limite_credito_asignado')
        : typeof cliente.limite_credito_asignado === 'number'
          ? normalizeMoney(cliente.limite_credito_asignado, 'limite_credito_asignado')
          : 0;

    const limiteVigente = calculateCupoDisponible(
      limiteAsignado,
      cliente.saldo_total_adeudado
    );

    await ref.update({
      tier_crediticio: tierEvaluacion ?? cliente.tier_crediticio ?? FieldValue.delete(),
      limite_credito_asignado: limiteAsignado,
      limite_credito_vigente: limiteVigente,
      evaluacion_id_ultima: evaluacionAprobada?.id ?? cliente.evaluacion_id_ultima ?? FieldValue.delete(),
      evaluacion_vigente_hasta: evaluacionVigenteHasta ?? FieldValue.delete(),
      updated_at: nowIso(),
    });

    return this.obtenerLineaCredito(orgId, clienteId);
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

  static async listarConsultasNosis(
    orgId: string,
    clienteId: string,
    limit = 20
  ): Promise<FinClienteNosisConsulta[]> {
    const db = getAdminFirestore();
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const snapshot = await db
      .collection(FIN_COLLECTIONS.clienteNosisConsultas(orgId, clienteId))
      .orderBy('fecha_consulta', 'desc')
      .limit(safeLimit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as FinClienteNosisConsulta[];
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
