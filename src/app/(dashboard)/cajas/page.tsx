"use client";

import { useEffect, useState } from "react";
import type { FinSucursal, FinCaja } from "@/types/fin-sucursal";
import { apiFetch } from "@/lib/apiFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

type SucursalConCajas = FinSucursal & { cajas: FinCaja[] };

export default function CajasPage() {
  const [items, setItems] = useState<SucursalConCajas[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/fin/sucursales")
      .then((r) => r.json())
      .then(async (d) => {
        const sucursales: FinSucursal[] =
          (d as { sucursales: FinSucursal[] }).sucursales ?? [];
        const withCajas = await Promise.all(
          sucursales.map(async (s) => {
            const cajaRes = await apiFetch(
              `/api/fin/sucursales/${s.id}/cajas`
            ).then((r) => r.json());
            return {
              ...s,
              cajas: (cajaRes as { cajas: FinCaja[] }).cajas ?? [],
            };
          })
        );
        setItems(withCajas);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm">
        No hay sucursales configuradas.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Cajas</h2>
        <p className="text-sm text-slate-500">
          Saldos por sucursal y caja
        </p>
      </div>

      {items.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle>{s.nombre}</CardTitle>
              <Badge variant={s.activa ? "default" : "outline"}>
                {s.activa ? "Activa" : "Inactiva"}
              </Badge>
            </div>
            {s.direccion && (
              <p className="text-sm text-slate-500">{s.direccion}</p>
            )}
          </CardHeader>
          <CardContent>
            {s.cajas.length === 0 ? (
              <p className="text-sm text-slate-400">Sin cajas configuradas.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {s.cajas.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{c.nombre}</p>
                      <Badge
                        variant="outline"
                        className={
                          c.estado === "abierta"
                            ? "border-green-200 text-green-700"
                            : "border-slate-200 text-slate-500"
                        }
                      >
                        {c.estado}
                      </Badge>
                    </div>
                    <p className="text-lg font-semibold text-slate-900">
                      {ars(c.saldo_actual)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
