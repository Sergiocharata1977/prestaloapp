"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { FinAsiento } from "@/types/fin-asiento";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

export default function AsientoDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [asiento, setAsiento] = useState<FinAsiento | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/fin/asientos/${id}`)
      .then((r) => r.json())
      .then((d) => setAsiento(d as FinAsiento))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="h-60 animate-pulse rounded-2xl bg-slate-200" />;
  }
  if (!asiento) {
    return <div className="py-16 text-center text-slate-500">Asiento no encontrado.</div>;
  }

  const balanceado = Math.abs(asiento.total_debe - asiento.total_haber) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Asiento — {asiento.fecha.slice(0, 10)}
          </h2>
          <p className="text-sm text-slate-500">
            Período {asiento.periodo} · {asiento.documento_tipo}
          </p>
        </div>
        <Badge className={balanceado ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
          {balanceado ? "Balanceado" : "Desbalanceado"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Líneas del asiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200/80 bg-slate-50/60">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">Código</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">Cuenta</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500">Debe</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500">Haber</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {asiento.lineas.map((l, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{l.cuenta_codigo}</td>
                    <td className="px-4 py-3 text-slate-700">{l.cuenta_nombre}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-900">
                      {l.debe > 0 ? ars(l.debe) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-900">
                      {l.haber > 0 ? ars(l.haber) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{l.descripcion}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold">
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-slate-700">Totales</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-900">{ars(asiento.total_debe)}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-900">{ars(asiento.total_haber)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
