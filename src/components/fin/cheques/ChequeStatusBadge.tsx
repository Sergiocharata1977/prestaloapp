"use client";

import type { FinChequeEstado } from "@/types/fin-cheque";
import {
  formatChequeEstado,
  getChequeStatusTone,
} from "@/components/fin/cheques/fin-cheque-ui";

export function ChequeStatusBadge({ estado }: { estado: FinChequeEstado }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getChequeStatusTone(
        estado
      )}`}
    >
      {formatChequeEstado(estado)}
    </span>
  );
}
