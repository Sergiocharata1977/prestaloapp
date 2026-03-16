"use client";

import type { FinCreditoEstado } from "@/types/fin-credito";
import type { FinCuotaEstado } from "@/types/fin-cuota";
import { Badge } from "@/components/ui/badge";

const colorMap: Record<string, string> = {
  // crédito
  activo: "bg-green-100 text-green-800",
  cancelado: "bg-slate-100 text-slate-600",
  en_mora: "bg-orange-100 text-orange-800",
  refinanciado: "bg-blue-100 text-blue-800",
  incobrable: "bg-red-100 text-red-800",
  // cuota
  pendiente: "bg-blue-100 text-blue-800",
  pagada: "bg-green-100 text-green-800",
  vencida: "bg-red-100 text-red-800",
};

const labelMap: Record<string, string> = {
  activo: "Activo",
  cancelado: "Cancelado",
  en_mora: "En mora",
  refinanciado: "Refinanciado",
  incobrable: "Incobrable",
  pendiente: "Pendiente",
  pagada: "Pagada",
  vencida: "Vencida",
};

export function StatusBadge({
  estado,
}: {
  estado: FinCreditoEstado | FinCuotaEstado;
}) {
  return (
    <Badge className={colorMap[estado] ?? "bg-slate-100 text-slate-600"}>
      {labelMap[estado] ?? estado}
    </Badge>
  );
}
