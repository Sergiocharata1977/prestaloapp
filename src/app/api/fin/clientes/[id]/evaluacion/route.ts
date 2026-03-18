import { withAuth } from '@/lib/api/withAuth';
import { ScoringService } from '@/services/ScoringService';
import type { EvaluacionCreateInput } from '@/types/fin-evaluacion';
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
