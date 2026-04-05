import { getAdminFirestore } from "@/firebase/admin";
import { FIN_COLLECTIONS } from "@/firebase/collections";
import { ChequeService } from "@/services/ChequeService";
import { ClienteService } from "@/services/ClienteService";
import { CreditoService } from "@/services/CreditoService";
import type { FinCheque } from "@/types/fin-cheque";
import type { FinCliente } from "@/types/fin-cliente";
import type { FinCredito } from "@/types/fin-credito";
import type {
  FinClienteMoraResumen,
  FinMoraAccion,
  FinMoraAccionClase,
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

function resolveEtapaBase(
  cliente: FinCliente,
  creditos: FinCredito[],
  cheques: FinCheque[]
): FinMoraEtapa {
  if (cliente.gestion_mora_etapa && cliente.gestion_mora_etapa !== "sin_gestion") {
    return cliente.gestion_mora_etapa;
  }

  if (
    creditos.some((credito) => credito.estado === "incobrable") ||
    cheques.some((cheque) => cheque.estado === "judicial")
  ) {
    return "judicial";
  }

  if (
    creditos.some((credito) => credito.estado === "en_mora") ||
    cheques.some(
      (cheque) => cheque.estado === "pre_judicial" || cheque.estado === "rechazado"
    )
  ) {
    return "pre_judicial";
  }

  return "sin_gestion";
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
  const etapa = resolveEtapaBase(cliente, creditos, cheques);
  const ultimaAccion = [...acciones].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const proximaAccion = [...acciones]
    .filter((accion) => accion.proxima_accion_at)
    .sort((a, b) =>
      String(a.proxima_accion_at).localeCompare(String(b.proxima_accion_at))
    )[0];
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
          : creditosEnMora.length > 0 || chequesObservados.length > 0
            ? "en_mora"
            : "normal",
    creditos_en_mora_count: creditosEnMora.length,
    creditos_incobrables_count: creditosIncobrables.length,
    cheques_observados_count: chequesObservados.length,
    saldo_vencido: saldoVencido,
    dias_max_mora: diasMaxMora,
    ultima_accion_at: ultimaAccion?.created_at,
    proxima_accion_at:
      cliente.gestion_mora_proxima_accion_at ?? proximaAccion?.proxima_accion_at,
    acciones_count: acciones.length,
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

    const resumenes = clientes
      .map((cliente) =>
        buildClienteMoraResumen({
          cliente,
          creditos: creditos.filter((credito) => credito.cliente_id === cliente.id),
          cheques: cheques.filter((cheque) => cheque.cliente_id === cliente.id),
          acciones: acciones.filter((accion) => accion.cliente_id === cliente.id),
        })
      )
      .filter((cliente) => cliente.mora_estado !== "normal");

    const filtrados = filters.etapa
      ? resumenes.filter((cliente) => cliente.mora_etapa === filters.etapa)
      : resumenes;

    return filtrados.sort((a, b) => {
      const score = b.saldo_vencido - a.saldo_vencido;
      if (score !== 0) {
        return score;
      }

      return b.dias_max_mora - a.dias_max_mora;
    });
  }

  static async listAcciones(
    orgId: string,
    filters: { clienteId?: string; clase?: FinMoraAccionClase } = {}
  ): Promise<FinMoraAccion[]> {
    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db
      .collection(FIN_COLLECTIONS.moraAcciones(orgId))
      .orderBy("created_at", "desc");

    if (filters.clienteId) {
      query = query.where("cliente_id", "==", filters.clienteId);
    }

    if (filters.clase) {
      query = query.where("clase", "==", filters.clase);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as FinMoraAccion);
  }

  static async actualizarEtapaCliente(
    orgId: string,
    clienteId: string,
    input: {
      etapa: FinMoraEtapa;
      motivo?: string;
      proxima_accion_at?: string;
      usuario: { id: string; nombre: string };
    }
  ) {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.cliente(orgId, clienteId));
    const now = nowIso();

    await ref.update({
      gestion_mora_etapa: input.etapa,
      gestion_mora_motivo: input.motivo?.trim() || null,
      gestion_mora_proxima_accion_at: input.proxima_accion_at?.trim() || null,
      gestion_mora_updated_at: now,
      gestion_mora_updated_by: input.usuario.nombre,
      updated_at: now,
    });

    return ClienteService.getById(orgId, clienteId);
  }

  static async crearAccion(
    orgId: string,
    input: {
      cliente_id: string;
      clase: FinMoraAccionClase;
      tipo: FinMoraAccionTipo;
      resultado: string;
      notas?: string;
      proxima_accion_at?: string;
      usuario: { id: string; nombre: string };
    }
  ): Promise<FinMoraAccion> {
    const db = getAdminFirestore();
    const ref = db.collection(FIN_COLLECTIONS.moraAcciones(orgId)).doc();
    const now = nowIso();
    const accion: FinMoraAccion = {
      id: ref.id,
      organization_id: orgId,
      cliente_id: input.cliente_id,
      clase: input.clase,
      tipo: input.tipo,
      resultado: input.resultado.trim(),
      notas: input.notas?.trim() || undefined,
      proxima_accion_at: input.proxima_accion_at?.trim() || undefined,
      created_at: now,
      created_by: {
        user_id: input.usuario.id,
        nombre: input.usuario.nombre,
      },
    };

    await ref.set(accion);
    await db.doc(FIN_COLLECTIONS.cliente(orgId, input.cliente_id)).update({
      gestion_mora_etapa: input.clase,
      gestion_mora_proxima_accion_at: accion.proxima_accion_at ?? null,
      gestion_mora_updated_at: now,
      gestion_mora_updated_by: input.usuario.nombre,
      updated_at: now,
    });

    return accion;
  }
}
