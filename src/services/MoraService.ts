import { getAdminFirestore } from "@/firebase/admin";
import { FIN_COLLECTIONS } from "@/firebase/collections";
import { MoraAgendaService } from "@/services/MoraAgendaService";
import { ChequeService } from "@/services/ChequeService";
import { ClienteService } from "@/services/ClienteService";
import { CreditoService } from "@/services/CreditoService";
import type { FinCheque } from "@/types/fin-cheque";
import type { FinCliente } from "@/types/fin-cliente";
import type { FinCredito } from "@/types/fin-credito";
import type {
  FinClienteMoraResumen,
  FinMoraAccion,
  FinMoraAccionEstado,
  FinMoraAccionFilters,
  FinMoraAccionClase,
  FinMoraAgendaItem,
  FinMoraTimelineItem,
  FinMoraAccionTipo,
  FinMoraEtapa,
} from "@/types/fin-mora";

function nowIso() {
  return new Date().toISOString();
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function startOfDayUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function diffDays(fromIso: string, to = new Date()) {
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((startOfDayUtc(to) - startOfDayUtc(from)) / 86400000)
  );
}

function compactObject<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      ([, item]) => item !== undefined
    )
  ) as Partial<T>;
}

function resolveMaxEtapa(etapas: Array<FinMoraEtapa | undefined>): FinMoraEtapa {
  const priorities: Record<FinMoraEtapa, number> = {
    sin_gestion: 0,
    mora_temprana: 1,
    pre_judicial: 2,
    judicial: 3,
  };

  return etapas.reduce<FinMoraEtapa>((current, etapa) => {
    if (!etapa) {
      return current;
    }

    return priorities[etapa] > priorities[current] ? etapa : current;
  }, "sin_gestion");
}

function resolveEtapaBase(
  cliente: FinCliente,
  creditos: FinCredito[],
  cheques: FinCheque[],
  acciones: FinMoraAccion[] = []
): FinMoraEtapa {
  return resolveMaxEtapa([
    creditos.some((credito) => credito.estado === "incobrable") ||
    cheques.some((cheque) => cheque.estado === "judicial")
      ? "judicial"
      : undefined,
    cheques.some(
      (cheque) =>
        cheque.estado === "pre_judicial" || cheque.estado === "rechazado"
    )
      ? "pre_judicial"
      : undefined,
    creditos.some((credito) => credito.estado === "en_mora")
      ? "mora_temprana"
      : undefined,
    ...acciones.map((accion) => accion.etapa ?? accion.clase),
    cliente.gestion_mora_etapa,
  ]);
}

function normalizeAccion(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
) {
  return MoraAgendaService.normalizeAccion({
    id: doc.id,
    ...(doc.data() as Omit<FinMoraAccion, "id">),
  });
}

async function getClienteMoraContext(orgId: string, clienteId: string) {
  const [cliente, creditos, cheques, acciones] = await Promise.all([
    ClienteService.getById(orgId, clienteId),
    CreditoService.list(orgId),
    ChequeService.list(orgId),
    MoraService.listAcciones(orgId, { clienteId }),
  ]);

  if (!cliente) {
    throw new Error("Cliente no encontrado");
  }

  const creditosCliente = creditos.filter((credito) => credito.cliente_id === clienteId);
  const chequesCliente = cheques.filter((cheque) => cheque.cliente_id === clienteId);
  const accionesCliente = acciones.map((accion) =>
    MoraAgendaService.normalizeAccion(accion)
  );

  return {
    cliente,
    creditos: creditosCliente,
    cheques: chequesCliente,
    acciones: accionesCliente,
    etapa: resolveEtapaBase(cliente, creditosCliente, chequesCliente, accionesCliente),
    agenda: MoraAgendaService.listAgenda(accionesCliente),
  };
}

async function syncClienteMoraMetadata(
  orgId: string,
  clienteId: string,
  usuario: { id: string; nombre: string }
) {
  const db = getAdminFirestore();
  const context = await getClienteMoraContext(orgId, clienteId);
  const now = nowIso();

  await db.doc(FIN_COLLECTIONS.cliente(orgId, clienteId)).update({
    gestion_mora_etapa: context.etapa,
    gestion_mora_proxima_accion_at: context.agenda[0]?.programada_at ?? null,
    gestion_mora_updated_at: now,
    gestion_mora_updated_by: usuario.nombre,
    updated_at: now,
  });
}

export function buildClienteMoraResumen(params: {
  cliente: FinCliente;
  creditos: FinCredito[];
  cheques: FinCheque[];
  acciones: FinMoraAccion[];
}): FinClienteMoraResumen {
  const { cliente, creditos, cheques, acciones } = params;
  const creditosEnMora = creditos.filter((credito) => credito.estado === "en_mora");
  const creditosIncobrables = creditos.filter(
    (credito) => credito.estado === "incobrable"
  );
  const chequesObservados = cheques.filter((cheque) =>
    ["rechazado", "pre_judicial", "judicial"].includes(cheque.estado)
  );
  const accionesNormalizadas = acciones.map((accion) =>
    MoraAgendaService.normalizeAccion(accion)
  );
  const etapa = resolveEtapaBase(cliente, creditos, cheques, accionesNormalizadas);
  const timeline = MoraAgendaService.listTimeline(accionesNormalizadas);
  const agenda = MoraAgendaService.listAgenda(accionesNormalizadas);
  const proximaAccion = agenda[0];
  const ultimaAccion = timeline[0];
  const saldoVencido = round2(
    creditosEnMora.reduce((acc, credito) => acc + Number(credito.saldo_capital || 0), 0) +
      creditosIncobrables.reduce(
        (acc, credito) => acc + Number(credito.saldo_capital || 0),
        0
      ) +
      chequesObservados.reduce((acc, cheque) => acc + Number(cheque.importe || 0), 0)
  );
  const diasMaxMora = Math.max(
    0,
    ...creditosEnMora.map((credito) => diffDays(credito.fecha_primer_vencimiento)),
    ...creditosIncobrables.map((credito) => diffDays(credito.fecha_primer_vencimiento)),
    ...chequesObservados.map((cheque) => diffDays(cheque.fecha_pago))
  );

  return {
    ...cliente,
    mora_etapa: etapa,
    mora_estado:
      etapa === "judicial"
        ? "judicial"
        : etapa === "pre_judicial"
          ? "pre_judicial"
          : etapa === "mora_temprana"
            ? "mora_temprana"
            : creditosEnMora.length > 0 || chequesObservados.length > 0
              ? "en_mora"
              : "normal",
    creditos_en_mora_count: creditosEnMora.length,
    creditos_incobrables_count: creditosIncobrables.length,
    cheques_observados_count: chequesObservados.length,
    saldo_vencido: saldoVencido,
    dias_max_mora: diasMaxMora,
    ultima_accion_at: ultimaAccion?.executed_at ?? ultimaAccion?.created_at,
    proxima_accion_at:
      cliente.gestion_mora_proxima_accion_at ?? proximaAccion?.programada_at,
    acciones_count: accionesNormalizadas.length,
    proxima_accion_estado: proximaAccion?.estado,
    proxima_accion_tipo: proximaAccion?.tipo,
    proxima_accion_prioridad: proximaAccion?.prioridad,
    proxima_accion_responsable: proximaAccion?.responsable_nombre,
    agenda,
    timeline,
    creditos_relacionados: creditos.map((credito) => ({
      id: credito.id,
      numero_credito: credito.numero_credito,
      estado: credito.estado,
      saldo_capital: credito.saldo_capital,
      fecha_primer_vencimiento: credito.fecha_primer_vencimiento,
    })),
    cheques_relacionados: cheques.map((cheque) => ({
      id: cheque.id,
      numero: cheque.numero,
      estado: cheque.estado,
      importe: cheque.importe,
      fecha_pago: cheque.fecha_pago,
    })),
  };
}

export class MoraService {
  static async listClientes(
    orgId: string,
    filters: {
      q?: string;
      tipoClienteId?: string;
      etapa?: Exclude<FinMoraEtapa, "sin_gestion">;
    } = {}
  ): Promise<FinClienteMoraResumen[]> {
    const clientesBase = filters.q
      ? await ClienteService.buscar(orgId, filters.q)
      : await ClienteService.list(orgId, 100, { tipoClienteId: filters.tipoClienteId });
    const clientes = filters.tipoClienteId
      ? clientesBase.filter((cliente) => cliente.tipo_cliente_id === filters.tipoClienteId)
      : clientesBase;

    const [creditos, cheques, acciones] = await Promise.all([
      CreditoService.list(orgId),
      ChequeService.list(orgId),
      this.listAcciones(orgId),
    ]);

    return clientes
      .map((cliente) =>
        buildClienteMoraResumen({
          cliente,
          creditos: creditos.filter((credito) => credito.cliente_id === cliente.id),
          cheques: cheques.filter((cheque) => cheque.cliente_id === cliente.id),
          acciones: acciones.filter((accion) => accion.cliente_id === cliente.id),
        })
      )
      .filter((cliente) => cliente.mora_estado !== "normal")
      .filter((cliente) => (filters.etapa ? cliente.mora_etapa === filters.etapa : true))
      .sort((a, b) => {
        const bySaldo = b.saldo_vencido - a.saldo_vencido;
        return bySaldo !== 0 ? bySaldo : b.dias_max_mora - a.dias_max_mora;
      });
  }

  static async listAcciones(
    orgId: string,
    filters: {
      clienteId?: string;
      etapa?: FinMoraAccionClase;
      clase?: FinMoraAccionClase;
      estado?: FinMoraAccionEstado;
      responsableUserId?: string;
      soloVencidas?: boolean;
    } = {}
  ): Promise<FinMoraAccion[]> {
    const db = getAdminFirestore();
    const snapshot = await db
      .collection(FIN_COLLECTIONS.moraAcciones(orgId))
      .orderBy("created_at", "desc")
      .get();

    return MoraAgendaService.filterAcciones(
      snapshot.docs.map(normalizeAccion),
      {
        cliente_id: filters.clienteId,
        etapa: filters.etapa,
        clase: filters.clase,
        estado: filters.estado,
        responsable_user_id: filters.responsableUserId,
        vencidas: filters.soloVencidas,
      }
    );
  }

  static async actualizarEtapaCliente(
    orgId: string,
    clienteId: string,
    input: {
      etapa: FinMoraEtapa;
      motivo?: string;
      proxima_accion_at?: string;
      usuario: { id: string; nombre: string };
      registrar_accion_automatica?: boolean;
    }
  ) {
    const now = nowIso();
    const clienteActual = await ClienteService.getById(orgId, clienteId);
    const db = getAdminFirestore();

    if (!clienteActual) {
      throw new Error("Cliente no encontrado");
    }

    await db.doc(FIN_COLLECTIONS.cliente(orgId, clienteId)).update({
      gestion_mora_etapa: input.etapa,
      gestion_mora_motivo: input.motivo?.trim() || null,
      gestion_mora_proxima_accion_at: input.proxima_accion_at?.trim() || null,
      gestion_mora_updated_at: now,
      gestion_mora_updated_by: input.usuario.nombre,
      updated_at: now,
    });

    if (
      input.registrar_accion_automatica &&
      clienteActual.gestion_mora_etapa !== input.etapa &&
      input.etapa !== "sin_gestion"
    ) {
      await this.crearAccion(orgId, {
        cliente_id: clienteId,
        etapa: input.etapa,
        tipo: "actualizacion_estado",
        categoria: "administrativa",
        estado: "ejecutada",
        resultado: `Cambio de etapa a ${input.etapa}`,
        resultado_codigo: "cerrado",
        resultado_texto: input.motivo ?? `Cambio de etapa a ${input.etapa}`,
        notas: input.motivo,
        proxima_accion_at: input.proxima_accion_at,
        usuario: input.usuario,
      });
    }

    if (input.etapa === "sin_gestion") {
      await syncClienteMoraMetadata(orgId, clienteId, input.usuario);
    }

    return ClienteService.getById(orgId, clienteId);
  }

  static async crearAccion(
    orgId: string,
    input: {
      cliente_id: string;
      etapa?: FinMoraAccionClase;
      clase?: FinMoraAccionClase;
      tipo: FinMoraAccionTipo;
      categoria?: FinMoraAccion["categoria"];
      estado?: FinMoraAccionEstado;
      prioridad?: FinMoraAccion["prioridad"];
      resultado?: string;
      resultado_codigo?: FinMoraAccion["resultado_codigo"];
      resultado_texto?: string;
      notas?: string;
      proxima_accion_tipo?: FinMoraAccion["proxima_accion_tipo"];
      proxima_accion_at?: string;
      fecha_vencimiento_accion?: string;
      responsable_user_id?: string;
      responsable_nombre?: string;
      entidad_tipo?: FinMoraAccion["entidad_tipo"];
      entidad_id?: string;
      credito_id?: string;
      cuota_id?: string;
      cheque_id?: string;
      compromiso_pago_fecha?: string;
      compromiso_pago_monto?: number;
      usuario: { id: string; nombre: string };
    }
  ): Promise<FinMoraAccion> {
    const db = getAdminFirestore();
    const ref = db.collection(FIN_COLLECTIONS.moraAcciones(orgId)).doc();
    const now = nowIso();
    const etapa = input.etapa ?? input.clase ?? "mora_temprana";
    const accion = MoraAgendaService.normalizeAccion({
      id: ref.id,
      organization_id: orgId,
      cliente_id: input.cliente_id,
      etapa,
      clase: etapa,
      tipo: input.tipo,
      categoria: input.categoria,
      estado: input.estado,
      prioridad: input.prioridad,
      resultado: input.resultado,
      resultado_codigo: input.resultado_codigo,
      resultado_texto: input.resultado_texto,
      notas: input.notas,
      proxima_accion_tipo: input.proxima_accion_tipo,
      proxima_accion_at: input.proxima_accion_at,
      fecha_vencimiento_accion: input.fecha_vencimiento_accion,
      responsable_user_id: input.responsable_user_id,
      responsable_nombre: input.responsable_nombre,
      entidad_tipo: input.entidad_tipo,
      entidad_id: input.entidad_id,
      credito_id: input.credito_id,
      cuota_id: input.cuota_id,
      cheque_id: input.cheque_id,
      compromiso_pago_fecha: input.compromiso_pago_fecha,
      compromiso_pago_monto: input.compromiso_pago_monto,
      created_at: now,
      updated_at: now,
      created_by: {
        user_id: input.usuario.id,
        nombre: input.usuario.nombre,
      },
    });

    await ref.set(compactObject(accion));
    await syncClienteMoraMetadata(orgId, input.cliente_id, input.usuario);
    return accion;
  }

  static async getAccionById(orgId: string, accionId: string): Promise<FinMoraAccion> {
    const db = getAdminFirestore();
    const snapshot = await db.doc(FIN_COLLECTIONS.moraAccion(orgId, accionId)).get();

    if (!snapshot.exists) {
      throw new Error("Accion de mora no encontrada");
    }

    return normalizeAccion(snapshot);
  }

  static async updateAccion(
    orgId: string,
    accionId: string,
    input: {
      etapa?: FinMoraEtapa;
      clase?: FinMoraAccionClase;
      categoria?: FinMoraAccion["categoria"];
      estado?: FinMoraAccionEstado;
      prioridad?: FinMoraAccion["prioridad"];
      resultado?: string;
      resultado_codigo?: FinMoraAccion["resultado_codigo"];
      resultado_texto?: string;
      notas?: string;
      proxima_accion_tipo?: FinMoraAccion["proxima_accion_tipo"];
      proxima_accion_at?: string;
      fecha_vencimiento_accion?: string;
      responsable_user_id?: string;
      responsable_nombre?: string;
      entidad_tipo?: FinMoraAccion["entidad_tipo"];
      entidad_id?: string;
      credito_id?: string;
      cuota_id?: string;
      cheque_id?: string;
      compromiso_pago_fecha?: string;
      compromiso_pago_monto?: number;
      compromiso_pago_cumplido?: boolean;
      executed_at?: string;
      usuario: { id: string; nombre: string };
    }
  ): Promise<FinMoraAccion> {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.moraAccion(orgId, accionId));
    const current = await this.getAccionById(orgId, accionId);
    const nextEtapa = input.etapa ?? input.clase ?? current.etapa ?? current.clase;
    const nextEstado = input.estado ?? current.estado;
    const nextExecutedAt =
      input.executed_at !== undefined
        ? input.executed_at
        : nextEstado === "ejecutada" && !current.executed_at
          ? nowIso()
          : current.executed_at;
    const updated = MoraAgendaService.normalizeAccion({
      ...current,
      etapa: nextEtapa,
      clase: input.clase ?? current.clase,
      categoria: input.categoria ?? current.categoria,
      estado: input.estado ?? current.estado,
      prioridad: input.prioridad ?? current.prioridad,
      resultado: input.resultado !== undefined ? input.resultado : current.resultado,
      resultado_codigo: input.resultado_codigo ?? current.resultado_codigo,
      resultado_texto:
        input.resultado_texto !== undefined
          ? input.resultado_texto
          : current.resultado_texto,
      notas: input.notas !== undefined ? input.notas : current.notas,
      proxima_accion_tipo:
        input.proxima_accion_tipo !== undefined
          ? input.proxima_accion_tipo
          : current.proxima_accion_tipo,
      proxima_accion_at:
        input.proxima_accion_at !== undefined
          ? input.proxima_accion_at
          : current.proxima_accion_at,
      fecha_vencimiento_accion:
        input.fecha_vencimiento_accion !== undefined
          ? input.fecha_vencimiento_accion
          : current.fecha_vencimiento_accion,
      responsable_user_id:
        input.responsable_user_id !== undefined
          ? input.responsable_user_id
          : current.responsable_user_id,
      responsable_nombre:
        input.responsable_nombre !== undefined
          ? input.responsable_nombre
          : current.responsable_nombre,
      entidad_tipo:
        input.entidad_tipo !== undefined ? input.entidad_tipo : current.entidad_tipo,
      entidad_id: input.entidad_id !== undefined ? input.entidad_id : current.entidad_id,
      credito_id: input.credito_id !== undefined ? input.credito_id : current.credito_id,
      cuota_id: input.cuota_id !== undefined ? input.cuota_id : current.cuota_id,
      cheque_id: input.cheque_id !== undefined ? input.cheque_id : current.cheque_id,
      compromiso_pago_fecha:
        input.compromiso_pago_fecha !== undefined
          ? input.compromiso_pago_fecha
          : current.compromiso_pago_fecha,
      compromiso_pago_monto:
        input.compromiso_pago_monto !== undefined
          ? input.compromiso_pago_monto
          : current.compromiso_pago_monto,
      compromiso_pago_cumplido:
        input.compromiso_pago_cumplido !== undefined
          ? input.compromiso_pago_cumplido
          : current.compromiso_pago_cumplido,
      executed_at: nextExecutedAt,
      updated_at: nowIso(),
    });

    await ref.set(compactObject(updated), { merge: true });
    await syncClienteMoraMetadata(orgId, current.cliente_id, input.usuario);

    return updated;
  }

  static async listAgenda(
    orgId: string,
    filters: Pick<
      FinMoraAccionFilters,
      "cliente_id" | "etapa" | "estado" | "responsable_user_id" | "vencidas"
    > = {}
  ): Promise<FinMoraAgendaItem[]> {
    const acciones = await this.listAcciones(orgId, {
      clienteId: filters.cliente_id,
      etapa: filters.etapa,
      estado: filters.estado,
      responsableUserId: filters.responsable_user_id,
      soloVencidas: filters.vencidas,
    });

    return MoraAgendaService.listAgenda(acciones, {
      cliente_id: filters.cliente_id,
      etapa: filters.etapa,
      estado: filters.estado,
      responsable_user_id: filters.responsable_user_id,
      vencidas: filters.vencidas,
    });
  }

  static async listClienteTimeline(
    orgId: string,
    clienteId: string
  ): Promise<FinMoraTimelineItem[]> {
    const acciones = await this.listAcciones(orgId, { clienteId });
    return MoraAgendaService.listTimeline(acciones, { cliente_id: clienteId });
  }

  static async listTimelineByCliente(
    orgId: string,
    clienteId: string
  ): Promise<FinMoraTimelineItem[]> {
    return this.listClienteTimeline(orgId, clienteId);
  }
}
