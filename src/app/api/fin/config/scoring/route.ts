import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { ScoringService } from '@/services/ScoringService';
import type {
  FinScoringConfigUpdateInput,
  ScoringCategoriaPesos,
  ScoringTierConfig,
} from '@/types/fin-evaluacion';

const READ_ROLES = ['admin', 'gerente', 'operador', 'manager', 'operator'];
const ADMIN_ROLES = ['admin', 'gerente', 'manager'];

function validatePesos(pesos: ScoringCategoriaPesos): string | null {
  const total = pesos.cualitativo + pesos.conflictos + pesos.cuantitativo;
  if (Math.abs(total - 1) > 0.001) {
    return `Los pesos deben sumar 1. Actual: ${total.toFixed(2)}`;
  }

  const invalid = Object.values(pesos).some(value => value < 0 || value > 1);
  if (invalid) {
    return 'Los pesos deben estar entre 0 y 1';
  }

  return null;
}

function validateTiers(tiers: ScoringTierConfig[]): string | null {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return 'Se requieren umbrales por tier';
  }

  const seen = new Set<string>();
  for (const tier of tiers) {
    if (seen.has(tier.tier)) {
      return 'No puede haber tiers duplicados';
    }
    seen.add(tier.tier);

    if (tier.min_score < 0 || tier.min_score > 10) {
      return `min_score invalido para tier ${tier.tier}`;
    }

    if (tier.max_score !== null && (tier.max_score < tier.min_score || tier.max_score > 10)) {
      return `max_score invalido para tier ${tier.tier}`;
    }
  }

  return null;
}

function parseBody(body: Partial<FinScoringConfigUpdateInput>): FinScoringConfigUpdateInput {
  if (!body.pesos_categoria || !body.tiers || body.frecuencia_vigencia_meses === undefined) {
    throw new Error('pesos_categoria, tiers y frecuencia_vigencia_meses son requeridos');
  }

  const pesosError = validatePesos(body.pesos_categoria);
  if (pesosError) {
    throw new Error(pesosError);
  }

  const tiersError = validateTiers(body.tiers);
  if (tiersError) {
    throw new Error(tiersError);
  }

  if (body.frecuencia_vigencia_meses < 1 || body.frecuencia_vigencia_meses > 60) {
    throw new Error('frecuencia_vigencia_meses debe estar entre 1 y 60');
  }

  return {
    pesos_categoria: body.pesos_categoria,
    tiers: body.tiers,
    frecuencia_vigencia_meses: body.frecuencia_vigencia_meses,
  };
}

export const GET = withAuth(async (_request, _context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const config = await ScoringService.getOrCreateConfig(auth.organizationId);
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener configuracion' },
      { status: 400 }
    );
  }
}, { roles: READ_ROLES });

export const PATCH = withAuth(async (request, _context, auth) => {
  try {
    if (!auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<FinScoringConfigUpdateInput>;
    const input = parseBody(body);

    await ScoringService.updateConfig(auth.organizationId, input, auth.user.uid);
    const config = await ScoringService.getOrCreateConfig(auth.organizationId);

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar configuracion' },
      { status: 400 }
    );
  }
}, { roles: ADMIN_ROLES });
