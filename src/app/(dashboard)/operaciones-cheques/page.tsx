"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CircleDollarSign,
  Plus,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStoredChequeOperations } from "@/components/fin/cheques/cheque-storage";
import {
  ars,
  formatDate,
  formatStatus,
  getStatusTone,
} from "@/components/fin/cheques/cheque-utils";
import type { ChequeOperation } from "@/components/fin/cheques/types";

const columns: Column<ChequeOperation>[] = [
  { key: "numeroOperacion", header: "Operacion", width: "130px" },
  {
    key: "cliente",
    header: "Cliente",
    render: (row) => (
      <div>
        <p className="font-medium text-slate-900">{row.cliente}</p>
        <p className="text-xs text-slate-500">{row.cuit}</p>
      </div>
    ),
  },
  {
    key: "cheques",
    header: "Cheques",
    render: (row) => `${row.cheques.length}`,
    className: "text-center font-medium",
    width: "90px",
  },
  {
    key: "nominal",
    header: "Nominal",
    render: (row) => ars(row.preview.nominalTotal),
    className: "text-right font-mono",
  },
  {
    key: "neto",
    header: "Neto",
    render: (row) => ars(row.preview.netoTotal),
    className: "text-right font-mono font-semibold",
  },
  {
    key: "estado",
    header: "Estado",
    render: (row) => (
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusTone(row.estado)}`}
      >
        {formatStatus(row.estado)}
      </span>
    ),
  },
  {
    key: "acreditacionEstimada",
    header: "Acreditacion",
    render: (row) => formatDate(row.acreditacionEstimada),
  },
];

export default function OperacionesChequesPage() {
  const router = useRouter();
  const [operations, setOperations] = useState<ChequeOperation[]>([]);

  useEffect(() => {
    setOperations(getStoredChequeOperations());
  }, []);

  const summary = useMemo(() => {
    return operations.reduce(
      (acc, operation) => {
        acc.nominal += operation.preview.nominalTotal;
        acc.neto += operation.preview.netoTotal;
        acc.cheques += operation.cheques.length;
        return acc;
      },
      { nominal: 0, neto: 0, cheques: 0 }
    );
  }, [operations]);

  const carteraSinVencer = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return operations.reduce(
      (acc, operation) => {
        if (operation.estado === "liquidada" || operation.estado === "rechazada") {
          return acc;
        }

        const nominalVigente = operation.cheques.reduce((subtotal, cheque) => {
          const fechaPago = new Date(`${cheque.fechaPago}T00:00:00`);
          if (Number.isNaN(fechaPago.getTime()) || fechaPago < today) {
            return subtotal;
          }
          return subtotal + cheque.nominal;
        }, 0);

        return {
          nominal: acc.nominal + nominalVigente,
          operaciones: acc.operaciones + (nominalVigente > 0 ? 1 : 0),
          cheques: acc.cheques + operation.cheques.filter((cheque) => {
            const fechaPago = new Date(`${cheque.fechaPago}T00:00:00`);
            return !Number.isNaN(fechaPago.getTime()) && fechaPago >= today;
          }).length,
        };
      },
      { nominal: 0, operaciones: 0, cheques: 0 }
    );
  }, [operations]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            Descuento de cheques
          </Badge>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Operaciones de cheque
            </h1>
            <p className="max-w-3xl text-sm text-slate-500">
              Gestiona alta, cotizacion y seguimiento de operaciones con multiples
              cheques desde un flujo unico.
            </p>
          </div>
        </div>

        <Button asChild>
          <Link href="/operaciones-cheques/nueva">
            <Plus className="h-4 w-4" />
            Nueva operacion
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Cartera sin vencer",
            value: ars(carteraSinVencer.nominal),
            detail: `${carteraSinVencer.cheques} cheque(s) vigentes`,
            icon: WalletCards,
          },
          {
            label: "Neto estimado",
            value: ars(summary.neto),
            detail: `${operations.length} operacion(es) cargadas`,
            icon: Building2,
          },
          {
            label: "Nominal operado",
            value: ars(summary.nominal),
            detail: `${carteraSinVencer.operaciones} operacion(es) con cartera vigente`,
            icon: CircleDollarSign,
          },
          {
            label: "Cheques cargados",
            value: String(summary.cheques),
            detail: "Historial total",
            icon: ReceiptText,
          },
        ].map(({ icon: Icon, label, value, detail }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-2xl font-semibold text-slate-900">{value}</p>
                <p className="text-xs text-slate-400">{detail}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={operations}
        emptyMessage="Todavia no hay operaciones de cheque."
        onRowClick={(row) => router.push(`/operaciones-cheques/${row.id}`)}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {operations.slice(0, 2).map((operation) => (
          <button
            key={operation.id}
            type="button"
            onClick={() => router.push(`/operaciones-cheques/${operation.id}`)}
            className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 text-left shadow-sm transition-all hover:border-amber-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  {operation.numeroOperacion}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {operation.cliente}
                </h2>
                <p className="text-sm text-slate-500">
                  {operation.cheques.length} cheque(s) | acreditacion{" "}
                  {formatDate(operation.acreditacionEstimada)}
                </p>
              </div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusTone(operation.estado)}`}
              >
                {formatStatus(operation.estado)}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">Nominal</p>
                <p className="font-mono text-sm font-semibold text-slate-900">
                  {ars(operation.preview.nominalTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Descuento</p>
                <p className="font-mono text-sm font-semibold text-slate-900">
                  {ars(operation.preview.descuentoTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Gastos</p>
                <p className="font-mono text-sm font-semibold text-slate-900">
                  {ars(operation.preview.gastosTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Neto</p>
                <p className="font-mono text-sm font-semibold text-emerald-700">
                  {ars(operation.preview.netoTotal)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm font-medium text-amber-700">
              Ver detalle
              <ArrowRight className="h-4 w-4" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
