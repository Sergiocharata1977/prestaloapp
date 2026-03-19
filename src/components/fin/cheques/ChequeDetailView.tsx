"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRightLeft, Landmark, LoaderCircle } from "lucide-react";
import { useParams } from "next/navigation";
import type { FinCheque } from "@/types/fin-cheque";
import type { FinOperacionChequeDetalle } from "@/types/fin-operacion-cheque";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChequeStatusBadge } from "@/components/fin/cheques/ChequeStatusBadge";
import {
  buildChequeTimeline,
  formatChequeEstado,
  formatChequeTipo,
  formatDate,
  formatDateTime,
  formatMoney,
  getChequeStatusOptions,
  getDaysToPayment,
} from "@/components/fin/cheques/fin-cheque-ui";

type LoadState = {
  loading: boolean;
  error: string | null;
};

export function ChequeDetailView() {
  const params = useParams<{ id: string }>();
  const [cheque, setCheque] = useState<FinCheque | null>(null);
  const [operacion, setOperacion] = useState<FinOperacionChequeDetalle | null>(null);
  const [state, setState] = useState<LoadState>({ loading: true, error: null });
  const [saving, setSaving] = useState(false);
  const [nextStatus, setNextStatus] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadCheque = async () => {
    if (!params.id) {
      return;
    }

    setState({ loading: true, error: null });
    setFeedback(null);

    try {
      const chequeResponse = await apiFetch(`/api/fin/cheques/${params.id}`);
      const chequeData = (await chequeResponse.json()) as {
        cheque?: FinCheque;
        error?: string;
      };

      if (!chequeResponse.ok || !chequeData.cheque) {
        throw new Error(chequeData.error || "No se pudo obtener el cheque");
      }

      setCheque(chequeData.cheque);
      setNextStatus("");

      if (chequeData.cheque.operacion_cheque_id) {
        const operacionResponse = await apiFetch(
          `/api/fin/operaciones-cheques/${chequeData.cheque.operacion_cheque_id}`
        );
        const operacionData = (await operacionResponse.json()) as {
          operacion?: FinOperacionChequeDetalle;
        };

        setOperacion(
          operacionResponse.ok && operacionData.operacion ? operacionData.operacion : null
        );
      } else {
        setOperacion(null);
      }

      setState({ loading: false, error: null });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "No se pudo obtener el cheque",
      });
    }
  };

  useEffect(() => {
    void loadCheque();
  }, [params.id]);

  const availableTransitions = useMemo(
    () => (cheque ? getChequeStatusOptions(cheque.estado) : []),
    [cheque]
  );

  const timeline = useMemo(
    () => (cheque ? buildChequeTimeline(cheque, operacion) : []),
    [cheque, operacion]
  );

  const submitStatusChange = async () => {
    if (!cheque || !nextStatus) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const response = await apiFetch(`/api/fin/cheques/${cheque.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          estado: nextStatus,
          observaciones: observaciones.trim() || undefined,
        }),
      });

      const data = (await response.json()) as { cheque?: FinCheque; error?: string };
      if (!response.ok || !data.cheque) {
        throw new Error(data.error || "No se pudo actualizar el estado");
      }

      setCheque(data.cheque);
      setObservaciones("");
      setNextStatus("");
      setFeedback(`Estado actualizado a ${formatChequeEstado(data.cheque.estado)}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo actualizar el estado");
    } finally {
      setSaving(false);
    }
  };

  if (state.loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Cargando cheque...
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-[1.5rem] bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (state.error || !cheque) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/cheques/kanban">
            <ArrowLeft className="h-4 w-4" />
            Volver al Kanban
          </Link>
        </Button>
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="pt-6 text-sm text-rose-700">
            {state.error || "Cheque no encontrado."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const daysToPayment = getDaysToPayment(cheque.fecha_pago);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/cheques/kanban">
              <ArrowLeft className="h-4 w-4" />
              Volver al Kanban
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
              {cheque.numero || cheque.id}
            </p>
            <ChequeStatusBadge estado={cheque.estado} />
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {cheque.banco || "Cheque sin banco"}
            </h1>
            <p className="text-sm text-slate-500">
              {formatChequeTipo(cheque.tipo)} | Titular: {cheque.titular || "-"}
            </p>
          </div>
        </div>

        {operacion ? (
          <Button asChild variant="outline">
            <Link href={`/operaciones-cheques/${operacion.id}`}>
              <ArrowRightLeft className="h-4 w-4" />
              Ver operacion
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Importe</p>
              <p className="text-xl font-semibold text-slate-900">
                {formatMoney(cheque.importe, cheque.moneda)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Fecha de pago</p>
            <p className="text-xl font-semibold text-slate-900">{formatDate(cheque.fecha_pago)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Estado actual</p>
            <p className="text-xl font-semibold text-slate-900">
              {formatChequeEstado(cheque.estado)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Pago estimado</p>
            <p className="text-xl font-semibold text-slate-900">
              {daysToPayment === null
                ? "-"
                : daysToPayment < 0
                  ? `${Math.abs(daysToPayment)} dias vencido`
                  : `${daysToPayment} dias`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Datos del cheque</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 md:grid-cols-2">
                {[
                  ["Banco", cheque.banco || "-"],
                  ["Numero", cheque.numero || "-"],
                  ["Titular", cheque.titular || "-"],
                  ["CUIT librador", cheque.cuit_librador || "-"],
                  ["Fecha emision", formatDate(cheque.fecha_emision)],
                  ["Fecha pago", formatDate(cheque.fecha_pago)],
                  ["Sucursal", cheque.sucursal_id],
                  ["Cliente", cheque.cliente_id],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-sm text-slate-500">{label}</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {timeline.length === 0 ? (
                <p className="text-sm text-slate-500">No hay eventos registrados.</p>
              ) : (
                timeline.map(item => (
                  <div key={item.id} className="flex gap-4">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <div className="flex-1 rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{item.title}</p>
                          <p className="text-sm text-slate-500">{item.description}</p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.tone}`}
                        >
                          {formatDateTime(item.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cambiar estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {availableTransitions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  El cheque no tiene transiciones operativas disponibles.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Siguiente estado</label>
                    <Select value={nextStatus} onValueChange={setNextStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTransitions.map(status => (
                          <SelectItem key={status} value={status}>
                            {formatChequeEstado(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Observaciones</label>
                    <Textarea
                      value={observaciones}
                      onChange={event => setObservaciones(event.target.value)}
                      placeholder="Detalle operativo del cambio de estado"
                    />
                  </div>

                  <Button
                    onClick={() => void submitStatusChange()}
                    disabled={!nextStatus || saving}
                    className="w-full"
                  >
                    {saving ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Guardando
                      </>
                    ) : (
                      "Actualizar estado"
                    )}
                  </Button>
                </>
              )}

              {feedback ? <p className="text-sm text-slate-600">{feedback}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operacion asociada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {operacion ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">Numero</span>
                    <span className="text-sm font-medium text-slate-900">
                      {operacion.numero_operacion || operacion.id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">Estado</span>
                    <span className="text-sm font-medium text-slate-900">{operacion.estado}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">Fecha liquidacion</span>
                    <span className="text-sm font-medium text-slate-900">
                      {formatDate(operacion.fecha_liquidacion)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">Importe neto</span>
                    <span className="text-sm font-medium text-slate-900">
                      {formatMoney(
                        operacion.resumen?.importe_neto ?? operacion.importe_neto_liquidado ?? 0,
                        cheque.moneda
                      )}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Este cheque no tiene una operacion vinculada.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Observaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={cheque.observaciones || ""} readOnly className="min-h-32" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
