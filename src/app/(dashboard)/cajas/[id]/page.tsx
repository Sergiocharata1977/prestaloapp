"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { FinCaja } from "@/types/fin-caja";
import type { FinCobro } from "@/types/fin-cobro";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

export default function CajaDetallePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [caja, setCaja] = useState<FinCaja | null>(null);
  const [cobros, setCobros] = useState<FinCobro[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [montoFinal, setMontoFinal] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [cerrarError, setCerrarError] = useState<string | null>(null);
  const [diferencia, setDiferencia] = useState<number | null>(null);

  const cargarCaja = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/fin/cajas/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const data = d as { caja: FinCaja; cobros: FinCobro[] };
        setCaja(data.caja ?? null);
        setCobros(data.cobros ?? []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    cargarCaja();
  }, [cargarCaja]);

  const handleCerrar = async () => {
    setCerrarError(null);
    const monto = parseFloat(montoFinal);
    if (isNaN(monto) || monto < 0) {
      setCerrarError("Ingresá un monto válido.");
      return;
    }
    setCerrando(true);
    try {
      const res = await apiFetch(`/api/fin/cajas/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ monto_final: monto }),
      });
      if (res.status === 409) {
        setCerrarError("La caja ya fue cerrada.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Error al cerrar caja");
      }
      const data = (await res.json()) as { diferencia: number };
      setDiferencia(data.diferencia);
      setDialogOpen(false);
      cargarCaja();
    } catch (e) {
      setCerrarError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setCerrando(false);
    }
  };

  if (loading) {
    return <div className="h-60 animate-pulse rounded-2xl bg-slate-200" />;
  }

  if (!caja) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm">
        Caja no encontrada.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Detalle de caja</h2>
          <p className="text-sm text-slate-500">{caja.fecha}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Información general</CardTitle>
              <Badge
                variant="outline"
                className={
                  caja.estado === "abierta"
                    ? "border-green-200 text-green-700"
                    : "border-slate-200 text-slate-500"
                }
              >
                {caja.estado === "abierta" ? "Abierta" : "Cerrada"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["Sucursal", caja.sucursal_id],
                ["Fecha", caja.fecha],
                ["Monto inicial", ars(caja.monto_inicial)],
                ["Monto cobrado", ars(caja.monto_cobrado)],
                ...(caja.estado === "cerrada" && caja.monto_final !== undefined
                  ? [
                      ["Monto final", ars(caja.monto_final ?? 0)],
                    ]
                  : []),
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>

            {diferencia !== null && (
              <div
                className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                  diferencia >= 0
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {diferencia >= 0
                  ? `Sobrante: ${ars(diferencia)}`
                  : `Faltante: ${ars(Math.abs(diferencia))}`}
              </div>
            )}

            {caja.estado === "abierta" && (
              <div className="mt-4">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive">Cerrar caja</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cerrar caja</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="monto_final">Monto final ($)</Label>
                        <Input
                          id="monto_final"
                          type="number"
                          min={0}
                          step="0.01"
                          value={montoFinal}
                          onChange={(e) => setMontoFinal(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>

                      {cerrarError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {cerrarError}
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Button onClick={handleCerrar} disabled={cerrando}>
                          {cerrando ? "Cerrando…" : "Confirmar"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setDialogOpen(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </CardContent>
        </Card>

        {cobros.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Cobros del día</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-500">
                      <th className="pb-2 pr-4 font-medium">Cliente</th>
                      <th className="pb-2 pr-4 text-right font-medium">Monto</th>
                      <th className="pb-2 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobros.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-slate-50 last:border-0"
                      >
                        <td className="py-2 pr-4 text-slate-700">{c.cliente_id}</td>
                        <td className="py-2 pr-4 text-right font-mono font-semibold text-slate-900">
                          {ars(c.total_cobrado)}
                        </td>
                        <td className="py-2 text-slate-500">
                          {c.created_at.slice(0, 10)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
