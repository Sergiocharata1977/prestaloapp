"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Landmark, RefreshCw, Wallet } from "lucide-react";
import type { FinCheque, FinChequeEstadoActual } from "@/types/fin-cheque";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChequeStatusBadge } from "@/components/fin/cheques/ChequeStatusBadge";
import {
  CHEQUE_STATUS_LABEL,
  CHEQUE_STATUS_ORDER,
  formatChequeTipo,
  formatDate,
  formatMoney,
  getDaysToPayment,
  normalizeChequeEstado,
} from "@/components/fin/cheques/fin-cheque-ui";

type FetchState = {
  loading: boolean;
  error: string | null;
};

export function ChequeKanbanBoard() {
  const [cheques, setCheques] = useState<FinCheque[]>([]);
  const [state, setState] = useState<FetchState>({ loading: true, error: null });

  const loadCheques = async () => {
    setState({ loading: true, error: null });
    try {
      const response = await apiFetch("/api/fin/cheques");
      const data = (await response.json()) as { cheques?: FinCheque[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "No se pudo obtener la lista de cheques");
      }

      setCheques(data.cheques ?? []);
      setState({ loading: false, error: null });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "No se pudo obtener la lista de cheques",
      });
    }
  };

  useEffect(() => {
    void loadCheques();
  }, []);

  const grouped = useMemo(() => {
    return cheques.reduce<Record<FinChequeEstadoActual, FinCheque[]>>(
      (acc, cheque) => {
        acc[normalizeChequeEstado(cheque.estado)].push(cheque);
        return acc;
      },
      {
        recibido: [],
        en_cartera: [],
        depositado: [],
        acreditado: [],
        rechazado: [],
        pre_judicial: [],
        judicial: [],
      }
    );
  }, [cheques]);

  const summary = useMemo(() => {
    return cheques.reduce(
      (acc, cheque) => {
        acc.total += cheque.importe;
        if (normalizeChequeEstado(cheque.estado) === "rechazado") {
          acc.rechazados += 1;
        }
        if (normalizeChequeEstado(cheque.estado) === "acreditado") {
          acc.acreditados += cheque.importe;
        }
        return acc;
      },
      { total: 0, rechazados: 0, acreditados: 0 }
    );
  }, [cheques]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-700">
            Operatoria de cheques
          </p>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Kanban de cheques
            </h1>
            <p className="max-w-3xl text-sm text-slate-500">
              Vista operativa para seguimiento por estado, vencimientos y acceso rapido al
              detalle de cada cheque.
            </p>
          </div>
        </div>

        <Button variant="outline" onClick={() => void loadCheques()} disabled={state.loading}>
          <RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Cartera total</p>
              <p className="text-2xl font-semibold text-slate-900">
                {formatMoney(summary.total)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Acreditado</p>
              <p className="text-2xl font-semibold text-slate-900">
                {formatMoney(summary.acreditados)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Cheques rechazados</p>
            <p className="text-2xl font-semibold text-slate-900">{summary.rechazados}</p>
          </CardContent>
        </Card>
      </div>

      {state.error ? (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="pt-6 text-sm text-rose-700">{state.error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4 2xl:grid-cols-7">
        {CHEQUE_STATUS_ORDER.map(status => (
          <Card key={status} className="bg-slate-50/60">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{CHEQUE_STATUS_LABEL[status]}</CardTitle>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {grouped[status].length}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {state.loading ? (
                Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={`${status}-${index}`}
                    className="h-36 animate-pulse rounded-2xl bg-white"
                  />
                ))
              ) : grouped[status].length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
                  Sin cheques en esta columna.
                </div>
              ) : (
                grouped[status].map(cheque => {
                  const days = getDaysToPayment(cheque.fecha_pago);

                  return (
                    <Link
                      key={cheque.id}
                      href={`/cheques/${cheque.id}`}
                      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-amber-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            {cheque.numero || cheque.id.slice(-8)}
                          </p>
                          <h2 className="mt-1 text-sm font-semibold text-slate-900">
                            {cheque.banco || "Banco no informado"}
                          </h2>
                        </div>
                        <ChequeStatusBadge estado={cheque.estado} />
                      </div>

                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Importe</span>
                          <span className="font-mono font-semibold text-slate-900">
                            {formatMoney(cheque.importe, cheque.moneda)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Pago</span>
                          <span className="text-slate-700">{formatDate(cheque.fecha_pago)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Tipo</span>
                          <span className="text-right text-slate-700">
                            {formatChequeTipo(cheque.tipo)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs">
                        <span
                          className={
                            days !== null && days < 0 ? "text-rose-600" : "text-slate-500"
                          }
                        >
                          {days === null
                            ? "Fecha invalida"
                            : days < 0
                              ? `${Math.abs(days)} dias vencido`
                              : `${days} dias para pago`}
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                          Ver detalle
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
