import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/firebase/admin";
import { FIN_COLLECTIONS } from "@/firebase/collections";
import { withAuth } from "@/lib/api/withAuth";
import { LineaCreditoService } from "@/services/LineaCreditoService";
import type { FinCheque, FinChequeEstado } from "@/types/fin-cheque";
import type { FinCliente } from "@/types/fin-cliente";
import type { FinCredito } from "@/types/fin-credito";
import type { FinEvaluacion } from "@/types/fin-evaluacion";

export const dynamic = "force-dynamic";

type ReporteLineaConsumida = {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  cuit: string;
  limite_total: number | null;
  consumo_actual: number;
  disponible_actual: number | null;
  utilizacion_pct: number | null;
  estado_linea: string;
  evaluacion_fecha?: string;
  vigente_hasta?: string;
};

type ReporteChequeEstado = {
  id: string;
  estado: FinChequeEstado;
  cantidad: number;
  importe_total: number;
};

type ReporteChequeRechazado = {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  cuit: string;
  numero: string;
  banco: string;
  fecha_pago: string;
  importe: number;
  estado: FinChequeEstado;
};

type ReporteEvaluacionRechazada = {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  cuit: string;
  fecha: string;
  tier_sugerido: string;
  score_final: number;
  motivo?: string;
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildClienteNombre(cliente: Pick<FinCliente, "nombre" | "apellido">): string {
  return [cliente.nombre, cliente.apellido].filter(Boolean).join(" ").trim();
}

export const GET = withAuth(async (_request, _context, auth) => {
  if (!auth.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgId = auth.organizationId;
  const db = getAdminFirestore();

  const [clientesSnap, creditosSnap, evaluacionesVigentesSnap, evaluacionesRechazadasSnap, chequesSnap] =
    await Promise.all([
      db
        .collection(FIN_COLLECTIONS.clientes(orgId))
        .select(
          "nombre",
          "apellido",
          "cuit",
          "organization_id",
          "limite_credito_asignado",
          "limite_credito_vigente",
          "evaluacion_vigente_hasta",
          "created_at",
          "updated_at"
        )
        .get(),
      db
        .collection(FIN_COLLECTIONS.creditos(orgId))
        .select(
          "cliente_id",
          "capital",
          "saldo_capital",
          "estado",
          "fecha_otorgamiento"
        )
        .get(),
      db
        .collection(FIN_COLLECTIONS.evaluaciones(orgId))
        .where("es_vigente", "==", true)
        .select(
          "cliente_id",
          "fecha",
          "estado",
          "tier",
          "tier_asignado",
          "limite_credito_asignado",
          "limite_sugerido",
          "created_at",
          "updated_at"
        )
        .get(),
      db
        .collection(FIN_COLLECTIONS.evaluaciones(orgId))
        .where("estado", "==", "rechazada")
        .select(
          "cliente_id",
          "fecha",
          "tier_sugerido",
          "score_final",
          "decision"
        )
        .get(),
      db
        .collection(FIN_COLLECTIONS.cheques(orgId))
        .select(
          "cliente_id",
          "numero",
          "banco",
          "fecha_pago",
          "importe",
          "estado"
        )
        .get(),
    ]);

  const clientes = clientesSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as FinCliente
  );
  const clientesById = new Map(clientes.map((cliente) => [cliente.id, cliente]));

  const creditosByCliente = new Map<string, FinCredito[]>();
  creditosSnap.docs.forEach((doc) => {
    const credito = { id: doc.id, ...doc.data() } as FinCredito;
    const bucket = creditosByCliente.get(credito.cliente_id) ?? [];
    bucket.push(credito);
    creditosByCliente.set(credito.cliente_id, bucket);
  });

  const evaluacionVigenteByCliente = new Map<string, FinEvaluacion>();
  evaluacionesVigentesSnap.docs.forEach((doc) => {
    const evaluacion = { id: doc.id, ...doc.data() } as FinEvaluacion;
    evaluacionVigenteByCliente.set(evaluacion.cliente_id, evaluacion);
  });

  const lineasConsumidas: ReporteLineaConsumida[] = clientes
    .map((cliente) => {
      const evaluacion = evaluacionVigenteByCliente.get(cliente.id);
      const linea = LineaCreditoService.buildFromSources({
        cliente,
        creditos: creditosByCliente.get(cliente.id) ?? [],
        evaluacion: evaluacion
          ? {
              id: evaluacion.id,
              fecha: evaluacion.fecha,
              estado: evaluacion.estado,
              tier: evaluacion.tier,
              tier_asignado: evaluacion.tier_asignado,
              limite_credito_asignado:
                evaluacion.limite_credito_asignado ?? evaluacion.limite_sugerido ?? undefined,
              limite_sugerido: evaluacion.limite_sugerido ?? undefined,
              es_vigente: evaluacion.es_vigente,
              created_at: evaluacion.created_at,
              updated_at: evaluacion.updated_at,
            }
          : null,
      });

      const limiteTotal = linea.limite_total;
      const consumoActual = safeNumber(linea.consumo_actual);

      return {
        id: cliente.id,
        cliente_id: cliente.id,
        cliente_nombre: buildClienteNombre(cliente),
        cuit: cliente.cuit,
        limite_total: limiteTotal,
        consumo_actual: consumoActual,
        disponible_actual:
          linea.disponible_total_actual ?? linea.disponible_actual ?? null,
        utilizacion_pct:
          limiteTotal && limiteTotal > 0
            ? round2((consumoActual / limiteTotal) * 100)
            : null,
        estado_linea: linea.vigencia.estado,
        evaluacion_fecha: evaluacion?.fecha,
        vigente_hasta: cliente.evaluacion_vigente_hasta,
      };
    })
    .filter((item) => item.limite_total !== null || item.consumo_actual > 0)
    .sort((a, b) => b.consumo_actual - a.consumo_actual);

  const lineasResumen = lineasConsumidas.reduce(
    (acc, item) => {
      acc.clientes_con_linea += 1;
      acc.limite_total += safeNumber(item.limite_total);
      acc.consumo_actual += item.consumo_actual;
      acc.disponible_total += safeNumber(item.disponible_actual);
      return acc;
    },
    {
      clientes_con_linea: 0,
      limite_total: 0,
      consumo_actual: 0,
      disponible_total: 0,
    }
  );

  const cheques = chequesSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as FinCheque
  );

  const carteraChequesByEstado = new Map<FinChequeEstado, ReporteChequeEstado>();
  cheques.forEach((cheque) => {
    const current = carteraChequesByEstado.get(cheque.estado) ?? {
      id: cheque.estado,
      estado: cheque.estado,
      cantidad: 0,
      importe_total: 0,
    };

    current.cantidad += 1;
    current.importe_total = round2(current.importe_total + safeNumber(cheque.importe));
    carteraChequesByEstado.set(cheque.estado, current);
  });

  const carteraCheques = Array.from(carteraChequesByEstado.values()).sort((a, b) =>
    a.estado.localeCompare(b.estado)
  );

  const chequesRechazados: ReporteChequeRechazado[] = cheques
    .filter((cheque) => cheque.estado === "rechazado")
    .map((cheque) => {
      const cliente = clientesById.get(cheque.cliente_id);
      return {
        id: cheque.id,
        cliente_id: cheque.cliente_id,
        cliente_nombre: cliente ? buildClienteNombre(cliente) : cheque.cliente_id,
        cuit: cliente?.cuit ?? "-",
        numero: cheque.numero ?? "-",
        banco: cheque.banco ?? "-",
        fecha_pago: cheque.fecha_pago,
        importe: safeNumber(cheque.importe),
        estado: cheque.estado,
      };
    })
    .sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago));

  const evaluacionesRechazadas: ReporteEvaluacionRechazada[] =
    evaluacionesRechazadasSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as FinEvaluacion)
      .map((evaluacion) => {
        const cliente = clientesById.get(evaluacion.cliente_id);
        return {
          id: evaluacion.id,
          cliente_id: evaluacion.cliente_id,
          cliente_nombre: cliente ? buildClienteNombre(cliente) : evaluacion.cliente_id,
          cuit: cliente?.cuit ?? "-",
          fecha: evaluacion.fecha,
          tier_sugerido: evaluacion.tier_sugerido,
          score_final: round2(safeNumber(evaluacion.score_final)),
          motivo: evaluacion.decision?.motivo,
        };
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return NextResponse.json({
    lineas_consumidas: {
      resumen: {
        ...lineasResumen,
        limite_total: round2(lineasResumen.limite_total),
        consumo_actual: round2(lineasResumen.consumo_actual),
        disponible_total: round2(lineasResumen.disponible_total),
        utilizacion_global_pct:
          lineasResumen.limite_total > 0
            ? round2((lineasResumen.consumo_actual / lineasResumen.limite_total) * 100)
            : null,
      },
      items: lineasConsumidas,
    },
    cartera_cheques: {
      resumen: {
        total_cheques: cheques.length,
        importe_total: round2(
          cheques.reduce((acc, cheque) => acc + safeNumber(cheque.importe), 0)
        ),
      },
      por_estado: carteraCheques,
    },
    rechazados: {
      resumen: {
        evaluaciones_rechazadas: evaluacionesRechazadas.length,
        cheques_rechazados: chequesRechazados.length,
        monto_cheques_rechazados: round2(
          chequesRechazados.reduce((acc, cheque) => acc + cheque.importe, 0)
        ),
      },
      evaluaciones: evaluacionesRechazadas,
      cheques: chequesRechazados,
    },
  });
});
