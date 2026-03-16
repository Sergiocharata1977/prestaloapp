"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { FinCuota } from "@/types/fin-cuota";
import type { FinCredito } from "@/types/fin-credito";
import type { FinSucursal, FinCaja } from "@/types/fin-sucursal";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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

export default function NuevoCobroPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cuotaId = searchParams.get("cuotaId");
  const creditoId = searchParams.get("creditoId");

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
    const promises: Promise<unknown>[] = [
      apiFetch("/api/fin/sucursales").then((r) => r.json()),
    ];
    if (cuotaId && creditoId) {
      promises.push(
        apiFetch(`/api/fin/creditos/${creditoId}`).then((r) => r.json()),
        apiFetch(`/api/fin/creditos/${creditoId}/cuotas`).then((r) => r.json())
      );
    }
    Promise.all(promises)
      .then(([sData, cData, cuotasData]) => {
        setSucursales((sData as { sucursales: FinSucursal[] }).sucursales ?? []);
        if (cData) setCredito(cData as FinCredito);
        if (cuotasData && cuotaId) {
          const todas = (cuotasData as { cuotas: FinCuota[] }).cuotas ?? [];
          setCuota(todas.find((c) => c.id === cuotaId) ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, [cuotaId, creditoId]);

  useEffect(() => {
    if (!sucursalId) return;
    setCajas([]);
    setCajaId("");
    apiFetch(`/api/fin/sucursales/${sucursalId}/cajas`)
      .then((r) => r.json())
      .then((d) => setCajas((d as { cajas: FinCaja[] }).cajas ?? []));
  }, [sucursalId]);

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
      router.push("/cobros");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="h-60 animate-pulse rounded-2xl bg-slate-200" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Registrar cobro</h2>
          <p className="text-sm text-slate-500">Confirmá los datos del pago</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {cuota && credito && (
          <Card>
            <CardHeader>
              <CardTitle>Cuota a cobrar</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Crédito #", credito.numero_credito],
                  ["Cuota", `${cuota.numero_cuota} de ${credito.cantidad_cuotas}`],
                  ["Vencimiento", cuota.fecha_vencimiento],
                  ["Capital", ars(cuota.capital)],
                  ["Interés", ars(cuota.interes)],
                  ["Total a cobrar", ars(cuota.total)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-slate-400">{label}</dt>
                    <dd className="font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Caja y medio de pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <Select value={sucursalId} onValueChange={setSucursalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná una sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
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

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleConfirm}
                disabled={!cajaId || !cuota || submitting}
              >
                {submitting ? "Registrando…" : "Confirmar cobro"}
              </Button>
              <Button variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
