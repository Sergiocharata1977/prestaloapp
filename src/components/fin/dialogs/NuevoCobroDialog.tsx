"use client";

import { useEffect, useState } from "react";
import type { FinCuota } from "@/types/fin-cuota";
import type { FinCredito } from "@/types/fin-credito";
import type { FinSucursal, FinCaja } from "@/types/fin-sucursal";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuotaId: string;
  creditoId: string;
  onSuccess: () => void;
}

export function NuevoCobroDialog({ open, onOpenChange, cuotaId, creditoId, onSuccess }: Props) {
  const [cuota, setCuota] = useState<FinCuota | null>(null);
  const [credito, setCredito] = useState<FinCredito | null>(null);
  const [sucursales, setSucursales] = useState<FinSucursal[]>([]);
  const [cajas, setCajas] = useState<FinCaja[]>([]);
  const [sucursalId, setSucursalId] = useState("");
  const [cajaId, setCajaId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !cuotaId || !creditoId) return;
    setLoading(true);
    Promise.all([
      apiFetch("/api/fin/sucursales").then((r) => r.json()),
      apiFetch(`/api/fin/creditos/${creditoId}`).then((r) => r.json()),
      apiFetch(`/api/fin/creditos/${creditoId}/cuotas`).then((r) => r.json()),
    ])
      .then(([sData, cData, cuotasData]) => {
        setSucursales((sData as { sucursales: FinSucursal[] }).sucursales ?? []);
        setCredito(cData as FinCredito);
        const todas = (cuotasData as { cuotas: FinCuota[] }).cuotas ?? [];
        setCuota(todas.find((c) => c.id === cuotaId) ?? null);
      })
      .finally(() => setLoading(false));
  }, [open, cuotaId, creditoId]);

  useEffect(() => {
    if (!sucursalId) return;
    setCajas([]);
    setCajaId("");
    apiFetch(`/api/fin/sucursales/${sucursalId}/cajas`)
      .then((r) => r.json())
      .then((d) => setCajas((d as { cajas: FinCaja[] }).cajas ?? []));
  }, [sucursalId]);

  const handleClose = () => {
    setSucursalId("");
    setCajaId("");
    setCajas([]);
    setError(null);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!cuota || !credito || !cajaId) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/fin/cobros", {
        method: "POST",
        body: JSON.stringify({
          sucursal_id: sucursalId,
          caja_id: cajaId,
          credito_id: credito.id,
          cuota_id: cuota.id,
          medio_pago: "efectivo",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Error al registrar cobro");
      }
      handleClose();
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar cobro</DialogTitle>
          <DialogDescription>Confirmá los datos del pago de cuota</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        ) : (
          <div className="space-y-4">
            {cuota && credito && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Cuota a cobrar</p>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ["Crédito #", credito.numero_credito],
                    ["Cuota", `${cuota.numero_cuota} de ${credito.cantidad_cuotas}`],
                    ["Vencimiento", cuota.fecha_vencimiento],
                    ["Capital", ars(cuota.capital)],
                    ["Interés", ars(cuota.interes)],
                    ["Total a cobrar", ars(cuota.total)],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <dt className="text-slate-400">{label}</dt>
                      <dd className="font-medium text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Sucursal</Label>
                <Select value={sucursalId} onValueChange={setSucursalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná una sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {cajas.length > 0 && (
                <div className="space-y-2">
                  <Label>Caja</Label>
                  <Select value={cajaId} onValueChange={setCajaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná una caja" />
                    </SelectTrigger>
                    <SelectContent>
                      {cajas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre} — {ars(c.saldo_actual)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Medio de pago</Label>
                <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                  Efectivo
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!cajaId || !cuota || submitting || loading}
          >
            {submitting ? "Registrando…" : "Confirmar cobro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
