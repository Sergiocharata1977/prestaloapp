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

const READ_ROLES = ['admin', 'gerente', 'operador', 'manager', 'operator'];

export const GET = withAuth<RouteContext['params']>(
  async (request: NextRequest, context, auth) => {
    try {
      if (!auth.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { id } = await context.params;
      const cliente = await ClienteService.getById(auth.organizationId, id);

      if (!cliente) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      }

      const { searchParams } = new URL(request.url);
      const limit = Number(searchParams.get('limit') || '20');
      const historial = await ClienteService.listarConsultasNosis(
        auth.organizationId,
        id,
        Number.isFinite(limit) ? limit : 20
      );

      return NextResponse.json({
        success: true,
        consultas: historial,
        data: {
          ultimo: cliente.nosis_ultimo ?? null,
          historial,
        },
      });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo obtener el historial Nosis' },
        { status: 500 }
      );
    }
  },
  { roles: READ_ROLES }
);

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
      const usuarioNombre =
        auth.user.name ??
        auth.user.email ??
        auth.user.uid;
      const consulta = await NosisService.logConsulta(
        auth.organizationId,
        id,
        cliente.cuit,
        resultado,
        auth.user.uid,
        usuarioNombre
      );
      const resumen: FinClienteNosisUltimo = {
        fecha: consulta.fecha_consulta,
        score: resultado.score,
        situacion_bcra: resultado.situacion_bcra,
        cheques_rechazados: resultado.cheques_rechazados,
        juicios_activos: resultado.juicios_activos,
        estado: resultado.estado,
        tiempo_respuesta_ms: resultado.tiempo_respuesta_ms,
        consultado_por: auth.user.uid,
      };

      await ClienteService.actualizarNosisUltimo(auth.organizationId, id, resumen);

      return NextResponse.json({ success: true, data: { resultado, consulta } });
    } catch {
      return NextResponse.json(
        { error: 'No se pudo consultar Nosis' },
        { status: 500 }
      );
    }
  },
  { roles: READ_ROLES }
);
