"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarCheck2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/hooks/useAuth";
import { CAPABILITIES } from "@/lib/capabilities";

type ControlMasivoResponse = {
  periodo: string;
  procesadas: number;
  al_dia: number;
  incumplidas: number;
  sin_pago: number;
  judicial: number;
  errores: Array<{ operacion_id: string; error: string }>;
  error?: string;
};

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function CtaCorrienteControlMensualPage() {
  const router = useRouter();
  const { capabilities, loading: authLoading } = useAuth();

  const [periodo, setPeriodo] = useState(currentPeriod);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ControlMasivoResponse | null>(null);

  useEffect(() => {
    if (!authLoading && !capabilities.includes(CAPABILITIES.CTA_CTE_COMERCIAL)) {
      router.replace("/dashboard");
    }
  }, [authLoading, capabilities, router]);

  async function ejecutarControl() {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch("/api/fin/ctacte/control-masivo", {
        method: "POST",
        body: JSON.stringify({ periodo }),
      });
      const json = (await response.json().catch(() => ({}))) as ControlMasivoResponse;

      if (!response.ok) {
        throw new Error(json.error ?? "No se pudo ejecutar el control mensual");
      }

      setResultado(json);
    } catch (err) {
      setResultado(null);
      setError(
        err instanceof Error ? err.message : "No se pudo ejecutar el control mensual"
      );
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return <div className="h-60 animate-pulse rounded-2xl bg-slate-200" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/cta-corriente")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-slate-500">Volver a cartera</span>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Control mensual</h1>
          <p className="text-sm text-slate-500">
            Ejecuta el cierre del período para todas las operaciones activas.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/cta-corriente">Ver cartera</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5 text-slate-500" />
            Ejecutar control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="periodo">Período</Label>
            <Input
              id="periodo"
              type="month"
              value={periodo}
              onChange={(event) => setPeriodo(event.target.value)}
            />
          </div>

          <Button onClick={() => void ejecutarControl()} disabled={loading || !periodo}>
            <ShieldAlert className="h-4 w-4" />
            {loading
              ? "Ejecutando control..."
              : "Ejecutar control para todas las operaciones activas"}
          </Button>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {resultado ? (
        <Card>
          <CardHeader>
            <CardTitle>Resultado del período {resultado.periodo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Procesadas", value: resultado.procesadas },
                { label: "Al día", value: resultado.al_dia },
                { label: "Incumplidas", value: resultado.incumplidas },
                { label: "Sin pago", value: resultado.sin_pago },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="text-2xl font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>

            {resultado.errores.length > 0 ? (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Operaciones con error
                </h2>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <ul className="space-y-2 text-sm text-amber-900">
                    {resultado.errores.map((item) => (
                      <li key={`${item.operacion_id}-${item.error}`}>
                        {item.operacion_id}: {item.error}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
