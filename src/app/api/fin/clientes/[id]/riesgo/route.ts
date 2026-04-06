import { withAuth } from '@/lib/api/withAuth';
import { ClienteService } from '@/services/ClienteService';
import { LineaCreditoService } from '@/services/LineaCreditoService';
import { ScoringService } from '@/services/ScoringService';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: {
    id: string;
  };
};

export const dynamic = 'force-dynamic';

const READ_ROLES = ['admin', 'gerente', 'operador', 'manager', 'operator'];

export const GET = withAuth<RouteContext['params']>(
  async (_request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { id } = await context.params;
      const cliente = await ClienteService.getById(auth.organizationId, id);

      if (!cliente) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      }

      const [evaluaciones, linea, consultasNosis] = await Promise.all([
        ScoringService.getEvaluaciones(auth.organizationId, id),
        LineaCreditoService.getLineaCreditoActual(auth.organizationId, id),
        ClienteService.listarConsultasNosis(auth.organizationId, id, 20),
      ]);

      const evaluacionActual =
        evaluaciones.find((evaluacion) => evaluacion.es_vigente) ??
        evaluaciones[0] ??
        null;

      return NextResponse.json({
        success: true,
        data: {
          cliente: {
            id: cliente.id,
            tier_crediticio: cliente.tier_crediticio ?? null,
            limite_credito_asignado: cliente.limite_credito_asignado ?? null,
            limite_credito_vigente: cliente.limite_credito_vigente ?? null,
            evaluacion_id_ultima: cliente.evaluacion_id_ultima ?? null,
            evaluacion_vigente_hasta: cliente.evaluacion_vigente_hasta ?? null,
            saldo_total_adeudado: cliente.saldo_total_adeudado ?? 0,
          },
          evaluacion: {
            actual: evaluacionActual,
            historial: evaluaciones,
          },
          linea,
          nosis: {
            ultimo: cliente.nosis_ultimo ?? null,
            historial: consultasNosis,
          },
        },
      });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo obtener el riesgo del cliente' },
        { status: 500 }
      );
    }
  },
  { roles: READ_ROLES }
);
