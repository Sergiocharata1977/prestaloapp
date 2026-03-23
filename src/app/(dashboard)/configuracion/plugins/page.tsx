"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Package } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLUGIN_CAPABILITIES } from "@/lib/capabilities";

export default function PluginsPage() {
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/fin/organizacion/capabilities")
      .then((r) => r.json())
      .then((d: { capabilities?: string[] }) => {
        setCapabilities(d.capabilities ?? []);
      })
      .catch(() => setError("No se pudieron cargar los plugins"))
      .finally(() => setLoading(false));
  }, []);

  function toggle(cap: string) {
    setSuccess(false);
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      const response = await apiFetch("/api/fin/organizacion/capabilities", {
        method: "PATCH",
        body: JSON.stringify({ capabilities }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      setSuccess(true);
    } catch (e) {
      console.error(e);
      setError("No se pudo guardar los plugins");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Plugins</h2>
          <p className="text-sm text-slate-500">
            Activá o desactivá funcionalidades para tu organización
          </p>
        </div>
        <Button
          className="bg-slate-900 hover:bg-slate-800"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Plugins actualizados. Los cambios se verán al renovar sesión.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {PLUGIN_CAPABILITIES.map((plugin) => {
          const enabled = capabilities.includes(plugin.value);
          return (
            <Card
              key={plugin.value}
              className={`cursor-pointer transition-colors ${
                enabled ? "border-slate-900 bg-slate-50" : "hover:bg-slate-50"
              }`}
              onClick={() => toggle(plugin.value)}
            >
              <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                <div
                  className={`mt-0.5 rounded-xl p-2 ${
                    enabled ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <Package className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-sm font-semibold text-slate-900">
                    {plugin.label}
                  </CardTitle>
                </div>
                {enabled ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-slate-900" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-slate-300" />
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">{plugin.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
