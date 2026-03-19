"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChequeOfferPreview } from "@/components/fin/cheques/ChequeOfferPreview";
import { createChequeOperation } from "@/components/fin/cheques/cheque-storage";
import {
  ars,
  calculateOfferPreview,
  createEmptyChequeDraft,
  getDefaultTerms,
} from "@/components/fin/cheques/cheque-utils";
import type { ChequeDraft, CounterpartyType } from "@/components/fin/cheques/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ChequeOperationForm() {
  const router = useRouter();
  const [cliente, setCliente] = useState("");
  const [cuit, setCuit] = useState("");
  const [tipoContraparte, setTipoContraparte] = useState<CounterpartyType>("empresa");
  const [observaciones, setObservaciones] = useState("");
  const [acreditacionEstimada, setAcreditacionEstimada] = useState(
    new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [terms, setTerms] = useState(getDefaultTerms());
  const [cheques, setCheques] = useState<ChequeDraft[]>([
    createEmptyChequeDraft(1),
    createEmptyChequeDraft(2),
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => calculateOfferPreview(cheques, terms), [cheques, terms]);

  const updateCheque = (id: string, field: keyof ChequeDraft, value: string) => {
    setCheques((current) =>
      current.map((cheque) =>
        cheque.id === id
          ? {
              ...cheque,
              [field]: field === "nominal" ? Number(value) || 0 : value,
            }
          : cheque
      )
    );
  };

  const addCheque = () => {
    setCheques((current) => [...current, createEmptyChequeDraft(current.length + 1)]);
  };

  const removeCheque = (id: string) => {
    setCheques((current) =>
      current.length > 1 ? current.filter((item) => item.id !== id) : current
    );
  };

  const canSubmit =
    cliente.trim().length > 0 &&
    cuit.trim().length > 0 &&
    cheques.every(
      (cheque) =>
        cheque.banco.trim().length > 0 &&
        cheque.numero.trim().length > 0 &&
        cheque.librador.trim().length > 0 &&
        cheque.fechaPago.trim().length > 0 &&
        cheque.nominal > 0
    ) &&
    preview.netoTotal > 0;

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError("Completa cliente, cheques y montos validos antes de cotizar.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const operation = createChequeOperation({
        cliente: cliente.trim(),
        cuit: cuit.trim(),
        tipoContraparte,
        estado: "cotizada",
        acreditacionEstimada,
        observaciones: observaciones.trim(),
        cheques,
        terms,
      });

      router.push(`/operaciones-cheques/${operation.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "No se pudo guardar la operacion"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos de la operacion</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cliente">Cliente</Label>
              <Input
                id="cliente"
                value={cliente}
                onChange={(event) => setCliente(event.target.value)}
                placeholder="Nombre o razon social"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cuit">CUIT / CUIL</Label>
              <Input
                id="cuit"
                value={cuit}
                onChange={(event) => setCuit(event.target.value)}
                placeholder="30-00000000-0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="acreditacion">Acreditacion estimada</Label>
              <Input
                id="acreditacion"
                type="date"
                value={acreditacionEstimada}
                onChange={(event) => setAcreditacionEstimada(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de contraparte</Label>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {([
                  ["empresa", "Empresa"],
                  ["persona", "Persona"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTipoContraparte(value)}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      tipoContraparte === value
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="obs">Observaciones</Label>
              <Textarea
                id="obs"
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
                placeholder="Contexto de la operacion, cliente, prioridad de acreditacion, etc."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Carga de cheques</CardTitle>
            <Button variant="outline" size="sm" onClick={addCheque}>
              <Plus className="h-4 w-4" />
              Agregar cheque
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {cheques.map((cheque, index) => (
              <div
                key={cheque.id}
                className="rounded-[1.25rem] border border-slate-200/80 bg-slate-50/60 p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Cheque {index + 1}
                    </p>
                    <p className="text-xs text-slate-500">
                      Completa banco, librador, fecha de pago y nominal.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCheque(cheque.id)}
                    disabled={cheques.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className="space-y-2">
                    <Label>Banco</Label>
                    <Input
                      value={cheque.banco}
                      onChange={(event) =>
                        updateCheque(cheque.id, "banco", event.target.value)
                      }
                      placeholder="Banco Nacion"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Numero</Label>
                    <Input
                      value={cheque.numero}
                      onChange={(event) =>
                        updateCheque(cheque.id, "numero", event.target.value)
                      }
                      placeholder="00012345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Librador</Label>
                    <Input
                      value={cheque.librador}
                      onChange={(event) =>
                        updateCheque(cheque.id, "librador", event.target.value)
                      }
                      placeholder="Empresa emisora"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de pago</Label>
                    <Input
                      type="date"
                      value={cheque.fechaPago}
                      onChange={(event) =>
                        updateCheque(cheque.id, "fechaPago", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nominal</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cheque.nominal || ""}
                      onChange={(event) =>
                        updateCheque(cheque.id, "nominal", event.target.value)
                      }
                      placeholder="0.00"
                    />
                    <p className="text-xs text-slate-500">
                      {ars(Number(cheque.nominal) || 0)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Parametros de oferta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tasa">Tasa de descuento mensual (%)</Label>
              <Input
                id="tasa"
                type="number"
                min="0"
                step="0.1"
                value={terms.tasaDescuentoMensual}
                onChange={(event) =>
                  setTerms((current) => ({
                    ...current,
                    tasaDescuentoMensual: Number(event.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gasto-var">Gasto variable (%)</Label>
              <Input
                id="gasto-var"
                type="number"
                min="0"
                step="0.1"
                value={terms.gastoVariablePct}
                onChange={(event) =>
                  setTerms((current) => ({
                    ...current,
                    gastoVariablePct: Number(event.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gasto-fijo">Gasto fijo por cheque</Label>
              <Input
                id="gasto-fijo"
                type="number"
                min="0"
                step="1"
                value={terms.gastoFijoPorCheque}
                onChange={(event) =>
                  setTerms((current) => ({
                    ...current,
                    gastoFijoPorCheque: Number(event.target.value) || 0,
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <ChequeOfferPreview preview={preview} terms={terms} cheques={cheques} />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "Guardando..." : "Guardar y ver detalle"}
          </Button>
          <Button variant="outline" onClick={() => router.push("/operaciones-cheques")}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
