"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { FinCuenta, FinConfigCuentas } from "@/types/fin-plan-cuentas";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CAMPOS = [
  { key: "creditos_por_financiaciones", label: "Créditos por Financiaciones (Activo)" },
  { key: "intereses_no_devengados", label: "Intereses No Devengados (Activo ajuste)" },
  { key: "ventas_financiadas", label: "Ventas Financiadas (Resultado ＋)" },
  { key: "intereses_ganados", label: "Intereses Ganados (Resultado ＋)" },
] as const;

export default function ConfigurarPlanCuentasPage() {
  const router = useRouter();
  const [cuentas, setCuentas] = useState<FinCuenta[]>([]);
  const [config, setConfig] = useState<Partial<FinConfigCuentas["cuentas"]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/fin/plan-cuentas/cuentas").then((r) => r.json()),
      apiFetch("/api/fin/plan-cuentas/config").then((r) => r.json()),
    ]).then(([cData, cfgData]) => {
      setCuentas((cData as { cuentas: FinCuenta[] }).cuentas ?? []);
      const existing = (cfgData as { config: FinConfigCuentas | null }).config;
      if (existing) setConfig(existing.cuentas);
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await apiFetch("/api/fin/plan-cuentas/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });
    setSaved(true);
    setSaving(false);
  };

  const imputables = cuentas.filter((c) => c.imputable);

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
          <h2 className="text-2xl font-semibold text-slate-900">Configurar cuentas</h2>
          <p className="text-sm text-slate-500">
            Mapeo de cuentas contables para financiación al consumo
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Cuentas requeridas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {CAMPOS.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <Select
                value={config[key] ?? ""}
                onValueChange={(v) => setConfig((prev) => ({ ...prev, [key]: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná una cuenta…" />
                </SelectTrigger>
                <SelectContent>
                  {imputables.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} — {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          {saved && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Configuración guardada correctamente.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : "Guardar configuración"}
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
