import { withAuth } from '@/lib/api/withAuth';
import { ScoringService } from '@/services/ScoringService';
import type {
  EvaluacionAprobarInput,
  EvaluacionCreateInput,
  EvaluacionRechazarInput,
} from '@/types/fin-evaluacion';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: {
    id: string;
  };
};

export const GET = withAuth<RouteContext['params']>(
  async (_request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { id } = await context.params;
      const evaluaciones = await ScoringService.getEvaluaciones(auth.organizationId, id);

      return NextResponse.json({ evaluaciones });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo obtener las evaluaciones' },
        { status: 500 }
      );
    }
  }
);

export const POST = withAuth<RouteContext['params']>(
  async (request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { id } = await context.params;
      const body = (await request.json().catch(() => null)) as
        | EvaluacionCreateInput
        | null;

      if (!body) {
        return NextResponse.json({ error: 'Body requerido' }, { status: 400 });
      }

      if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json(
          { error: 'Se requieren los items de evaluación' },
          { status: 400 }
        );
      }

      // Build items for score calculation before persisting
      const { SCORING_ITEMS_CATALOG } = await import('@/services/ScoringService');
      const inputMap = new Map(body.items.map((i) => [i.id, i]));
      const itemsParaCalculo = SCORING_ITEMS_CATALOG.map((cat) => {
        const input = inputMap.get(cat.id);
        return {
          ...cat,
          puntaje: input?.puntaje ?? null,
          nota: input?.nota,
        };
      });

      const scores = ScoringService.calcularScore(itemsParaCalculo);

      const evalId = await ScoringService.crearEvaluacion(
        auth.organizationId,
        id,
        body,
        auth.user.uid
      );

      const evaluacion = await ScoringService.getEvaluaciones(auth.organizationId, id)
        .then((list) => list.find((e) => e.id === evalId) ?? null);

      return NextResponse.json({ id: evalId, evaluacion, scores }, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo crear la evaluación' },
        { status: 500 }
      );
    }
  }
);

type EvaluacionDecisionBody = {
  evaluacionId?: string;
  accion?: 'aprobar' | 'rechazar';
  tier_asignado?: EvaluacionAprobarInput['tier_asignado'];
  limite_credito_asignado?: EvaluacionAprobarInput['limite_credito_asignado'];
  motivo?: string;
  observaciones?: string;
};

export const PATCH = withAuth<RouteContext['params']>(
  async (request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { id } = await context.params;
      const body = (await request.json().catch(() => null)) as EvaluacionDecisionBody | null;

      if (!body?.evaluacionId || !body.accion) {
        return NextResponse.json(
          { error: 'Se requieren evaluacionId y accion' },
          { status: 400 }
        );
      }

      if (body.accion === 'aprobar') {
        const payload: EvaluacionAprobarInput = {
          tier_asignado: body.tier_asignado,
          limite_credito_asignado: body.limite_credito_asignado,
          motivo: body.motivo,
          observaciones: body.observaciones,
        };

        await ScoringService.aprobarEvaluacion(
          auth.organizationId,
          body.evaluacionId,
          payload,
          auth.user.uid
        );
      } else if (body.accion === 'rechazar') {
        const payload: EvaluacionRechazarInput = {
          motivo: body.motivo,
          observaciones: body.observaciones,
        };

        await ScoringService.rechazarEvaluacion(
          auth.organizationId,
          body.evaluacionId,
          payload,
          auth.user.uid
        );
      } else {
        return NextResponse.json({ error: 'Accion invalida' }, { status: 400 });
      }

      const evaluacion = await ScoringService.getEvaluaciones(auth.organizationId, id).then(
        list => list.find(item => item.id === body.evaluacionId) ?? null
      );

      return NextResponse.json({ evaluacion });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'No se pudo actualizar la decision de la evaluacion',
        },
        { status: 500 }
      );
    }
  }
);
