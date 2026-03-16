"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import type { FinCuenta } from "@/types/fin-plan-cuentas";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

type Linea = {
  cuenta_id: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debe: string;
  haber: string;
  descripcion: string;
};

const EMPTY_LINEA: Linea = {
  cuenta_id: "",
  cuenta_codigo: "",
  cuenta_nombre: "",
  debe: "",
  haber: "",
  descripcion: "",
};

export default function NuevoAsientoPage() {
  const router = useRouter();
  const [cuentas, setCuentas] = useState<FinCuenta[]>([]);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([
    { ...EMPTY_LINEA },
    { ...EMPTY_LINEA },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/fin/plan-cuentas/cuentas")
      .then((r) => r.json())
      .then((d) => setCuentas((d as { cuentas: FinCuenta[] }).cuentas ?? []));
  }, []);

  const totalDebe = lineas.reduce((s, l) => s + (parseFloat(l.debe) || 0), 0);
  const totalHaber = lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0);
  const balanceado = Math.abs(totalDebe - totalHaber) < 0.01;

  const updateLinea = (i: number, field: keyof Linea, value: string) => {
    setLineas((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const selectCuenta = (i: number, cuentaId: string) => {
    const c = cuentas.find((x) => x.id === cuentaId);
    if (!c) return;
    setLineas((prev) => {
      const next = [...prev];
      next[i] = {
        ...next[i],
        cuenta_id: c.id,
        cuenta_codigo: c.codigo,
        cuenta_nombre: c.nombre,
      };
      return next;
    });
  };

  const addLinea = () => setLineas((prev) => [...prev, { ...EMPTY_LINEA }]);

  const removeLinea = (i: number) => {
    if (lineas.length <= 2) return;
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    setServerError(null);
    if (!fecha || !descripcion.trim()) {
      setServerError("Fecha y descripción son obligatorias.");
      return;
    }
    if (!balanceado) {
      setServerError("El asiento debe estar balanceado (Debe = Haber).");
      return;
    }
    if (lineas.some((l) => !l.cuenta_id)) {
      setServerError("Todas las líneas deben tener una cuenta seleccionada.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/fin/asientos", {
        method: "POST",
        body: JSON.stringify({
          fecha,
          descripcion,
          lineas: lineas.map((l) => ({
            cuenta_id: l.cuenta_id,
            cuenta_codigo: l.cuenta_codigo,
            cuenta_nombre: l.cuenta_nombre,
            debe: parseFloat(l.debe) || 0,
            haber: parseFloat(l.haber) || 0,
            descripcion: l.descripcion,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Error al guardar");
      }
      const data = (await res.json()) as { asientoId: string };
      router.push(`/asientos/${data.asientoId}`);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Asiento de ajuste</h2>
          <p className="text-sm text-slate-500">
            Registrá un asiento contable manual con doble partida
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Encabezado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="descripcion">Descripción general</Label>
              <Input
                id="descripcion"
                placeholder="Ej: Castigo deuda cliente García"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Líneas del asiento</CardTitle>
          <div className="flex items-center gap-3">
            <Badge
              className={
                balanceado
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }
            >
              {balanceado ? "Balanceado" : "Desbalanceado"}
            </Badge>
            <span className="text-xs text-slate-500">
              Debe {ars(totalDebe)} · Haber {ars(totalHaber)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {lineas.map((linea, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3"
            >
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Cuenta</Label>
                  <Select
                    value={linea.cuenta_id}
                    onValueChange={(v) => selectCuenta(i, v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Seleccioná cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {cuentas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.codigo} — {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-5 h-8 w-8 text-slate-400 hover:text-red-600"
                  onClick={() => removeLinea(i)}
                  disabled={lineas.length <= 2}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Debe ($)</Label>
                  <Input
                    className="h-8 text-sm font-mono"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={linea.debe}
                    onChange={(e) => {
                      updateLinea(i, "debe", e.target.value);
                      if (e.target.value) updateLinea(i, "haber", "");
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Haber ($)</Label>
                  <Input
                    className="h-8 text-sm font-mono"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={linea.haber}
                    onChange={(e) => {
                      updateLinea(i, "haber", e.target.value);
                      if (e.target.value) updateLinea(i, "debe", "");
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Descripción</Label>
                  <Input
                    className="h-8 text-sm"
                    placeholder="Detalle de la línea"
                    value={linea.descripcion}
                    onChange={(e) => updateLinea(i, "descripcion", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addLinea}>
            <Plus className="h-3.5 w-3.5" />
            Agregar línea
          </Button>
        </CardContent>
      </Card>

      {serverError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={submitting || !balanceado}>
          {submitting ? "Guardando…" : "Guardar asiento"}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
