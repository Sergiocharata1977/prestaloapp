"use client";

import { AlertTriangle, CalendarRange, CreditCard, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FinCliente } from "@/types/fin-cliente";
import type { FinCredito } from "@/types/fin-credito";
import type { EvaluacionTier, FinEvaluacion } from "@/types/fin-evaluacion";

const TIER_STYLES: Record<EvaluacionTier, string> = {
  A: "bg-green-100 text-green-800 border-green-200",
  B: "bg-blue-100 text-blue-800 border-blue-200",
  C: "bg-yellow-100 text-yellow-800 border-yellow-200",
  reprobado: "bg-red-100 text-red-800 border-red-200",
};

const TIER_LABELS: Record<EvaluacionTier, string> = {
  A: "Tier A",
  B: "Tier B",
  C: "Tier C",
  reprobado: "Reprobado",
};

type Props = {
  cliente: FinCliente;
  creditos: FinCredito[];
  evaluacionVigente?: FinEvaluacion | null;
};

type PolicyLimits = {
  limiteMensual: number | null;
  limiteTotal: number | null;
};

function ars(value?: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function ratio(consumido: number, limite: number | null): number | null {
  if (!limite || limite <= 0) return null;
  return consumido / limite;
}

function resolveTier(
  cliente: FinCliente,
  evaluacionVigente?: FinEvaluacion | null
): EvaluacionTier | null {
  return (
    cliente.tier_crediticio ??
    evaluacionVigente?.tier_asignado ??
    evaluacionVigente?.tier_sugerido ??
    evaluacionVigente?.tier ??
    null
  );
}

function resolvePolicyLimits(
  creditos: FinCredito[],
  assignedTier: EvaluacionTier | null
): PolicyLimits {
  const aggregated = creditos.reduce<PolicyLimits>(
    (acc, credito) => {
      const tierConfig =
        assignedTier && credito.politica_snapshot?.tiers?.length
          ? credito.politica_snapshot.tiers.find((item) => item.tier === assignedTier)
          : undefined;

      const limiteMensual =
        tierConfig?.limite_mensual ?? credito.politica_snapshot?.limite_mensual ?? null;
      const limiteTotal =
        tierConfig?.limite_total ?? credito.politica_snapshot?.limite_total ?? null;

      return {
        limiteMensual:
          limiteMensual !== null && limiteMensual !== undefined
            ? Math.max(acc.limiteMensual ?? 0, limiteMensual)
            : acc.limiteMensual,
        limiteTotal:
          limiteTotal !== null && limiteTotal !== undefined
            ? Math.max(acc.limiteTotal ?? 0, limiteTotal)
            : acc.limiteTotal,
      };
    },
    { limiteMensual: null, limiteTotal: null }
  );

  return aggregated;
}

function resolveTotalLimit(
  cliente: FinCliente,
  evaluacionVigente: FinEvaluacion | null | undefined,
  policyLimits: PolicyLimits
): number | null {
  return (
    cliente.limite_credito_asignado ??
    cliente.limite_credito_vigente ??
    evaluacionVigente?.limite_credito_asignado ??
    evaluacionVigente?.limite_sugerido ??
    evaluacionVigente?.limite_credito_sugerido ??
    policyLimits.limiteTotal
  );
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function toMonthKey(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const raw = value.slice(0, 7);
    return /^\d{4}-\d{2}$/.test(raw) ? raw : null;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function progressTone(value: number | null) {
  if (value === null) return "bg-slate-200";
  if (value >= 1) return "bg-red-500";
  if (value >= 0.9) return "bg-amber-500";
  return "bg-emerald-500";
}

function progressTrack(value: number | null) {
  if (value === null) return "bg-slate-100";
  if (value >= 1) return "bg-red-100";
  if (value >= 0.9) return "bg-amber-100";
  return "bg-emerald-100";
}

function alertConfig(value: number | null) {
  if (value === null) return null;
  if (value >= 1) {
    return {
      title: "Límite alcanzado",
      text: "El consumo iguala o supera el límite disponible.",
      className: "border-red-200 bg-red-50 text-red-900",
    };
  }
  if (value >= 0.9) {
    return {
      title: "Cerca del límite",
      text: "El cliente está usando más del 90% de su línea.",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }
  return null;
}

function ProgressBar({
  consumido,
  limite,
}: {
  consumido: number;
  limite: number | null;
}) {
  const value = ratio(consumido, limite);
  const width = value === null ? 0 : Math.min(value, 1) * 100;

  return (
    <div className={cn("h-2 rounded-full", progressTrack(value))}>
      <div
        className={cn("h-2 rounded-full transition-all", progressTone(value))}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function ClienteResumenCrediticio({
  cliente,
  creditos,
  evaluacionVigente,
}: Props) {
  const tier = resolveTier(cliente, evaluacionVigente);
  const policyLimits = resolvePolicyLimits(creditos, tier);
  const limiteMensual = policyLimits.limiteMensual;
  const limiteTotal = resolveTotalLimit(cliente, evaluacionVigente, policyLimits);
  const mesActual = currentMonthKey();

  const consumidoMensual = creditos.reduce((acc, credito) => {
    return toMonthKey(credito.fecha_otorgamiento) === mesActual ? acc + Number(credito.capital || 0) : acc;
  }, 0);

  const consumidoTotal =
    creditos.reduce((acc, credito) => {
      const exposure =
        credito.estado === "cancelado" ? 0 : Number(credito.saldo_capital ?? credito.capital ?? 0);
      return acc + exposure;
    }, 0) || Number(cliente.saldo_total_adeudado || 0);

  const disponibleMensual =
    limiteMensual === null ? null : Math.max(limiteMensual - consumidoMensual, 0);
  const disponibleTotal =
    limiteTotal === null ? null : Math.max(limiteTotal - consumidoTotal, 0);

  const alertas = [alertConfig(ratio(consumidoMensual, limiteMensual)), alertConfig(ratio(consumidoTotal, limiteTotal))].filter(
    (value): value is NonNullable<typeof value> => Boolean(value)
  );

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4 text-slate-500" />
          Resumen crediticio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Tier vigente</div>
            <div className="mt-2">
              {tier ? <Badge className={TIER_STYLES[tier]}>{TIER_LABELS[tier]}</Badge> : "—"}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Límite mensual</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{ars(limiteMensual)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Límite total</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{ars(limiteTotal)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Créditos activos</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">
              {cliente.creditos_activos_count}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <CalendarRange className="h-4 w-4 text-slate-500" />
              Consumo mensual
            </div>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Consumido</span>
                <span className="font-semibold text-slate-900">{ars(consumidoMensual)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Disponible</span>
                <span className="font-semibold text-slate-900">{ars(disponibleMensual)}</span>
              </div>
              <ProgressBar consumido={consumidoMensual} limite={limiteMensual} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Gauge className="h-4 w-4 text-slate-500" />
              Consumo total
            </div>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Consumido</span>
                <span className="font-semibold text-slate-900">{ars(consumidoTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Disponible</span>
                <span className="font-semibold text-slate-900">{ars(disponibleTotal)}</span>
              </div>
              <ProgressBar consumido={consumidoTotal} limite={limiteTotal} />
            </div>
          </div>
        </div>

        {alertas.length > 0 && (
          <div className="grid gap-3">
            {alertas.map((alerta) => (
              <div
                key={`${alerta.title}-${alerta.text}`}
                className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", alerta.className)}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">{alerta.title}</div>
                  <div>{alerta.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
