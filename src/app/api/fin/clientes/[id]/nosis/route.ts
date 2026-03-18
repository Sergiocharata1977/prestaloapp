import { withAuth } from '@/lib/api/withAuth';
import { ClienteService } from '@/services/ClienteService';
import { NosisService } from '@/services/NosisService';
import type { FinClienteNosisUltimo } from '@/types/fin-cliente';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: {
    id: string;
  };
};

export const POST = withAuth<RouteContext['params']>(
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

      const apiKey = process.env.NOSIS_API_KEY?.trim();
      if (!apiKey) {
        return NextResponse.json(
          { error: 'No se pudo consultar Nosis' },
          { status: 500 }
        );
      }

      const resultado = await NosisService.consultar(cliente.cuit, apiKey);
      const resumen: FinClienteNosisUltimo = {
        fecha: new Date().toISOString(),
        score: resultado.score,
        situacion_bcra: resultado.situacion_bcra,
        cheques_rechazados: resultado.cheques_rechazados,
        juicios_activos: resultado.juicios_activos,
        consultado_por: auth.user.uid,
      };

      await ClienteService.actualizarNosisUltimo(auth.organizationId, id, resumen);

      return NextResponse.json({ resultado });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo consultar Nosis' },
        { status: 500 }
      );
    }
  },
  { roles: ['admin', 'manager', 'operator'] }
);
