"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FinCuenta } from "@/types/fin-plan-cuentas";
import type { MayorMovimiento } from "@/app/api/fin/asientos/mayor/route";
import { apiFetch } from "@/lib/apiFetch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

const origenLabel: Record<string, string> = {
  credito_otorgado: "Otorgamiento",
  cobro_cuota: "Cobro cuota",
  ajuste_manual: "Ajuste manual",
};

type MayorResult = {
  movimientos: MayorMovimiento[];
  total_debe: number;
  total_haber: number;
  saldo: number;
};

export default function MayorPage() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [cuentas, setCuentas] = useState<FinCuenta[]>([]);
  const [cuentaId, setCuentaId] = useState("");
  const [desde, setDesde] = useState(`${thisMonth}-01`);
  const [result, setResult] = useState<MayorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiFetch("/api/fin/plan-cuentas/cuentas")
      .then((r) => r.json())
      .then((d) => setCuentas((d as { cuentas: FinCuenta[] }).cuentas ?? []));
  }, []);

  useEffect(() => {
    if (!cuentaId) return;
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(() => {
      setLoading(true);
      apiFetch(`/api/fin/asientos/mayor?cuenta_id=${cuentaId}&desde=${desde}`)
        .then((r) => r.json())
        .then((d) => setResult(d as MayorResult))
        .finally(() => setLoading(false));
    }, 300);
  }, [cuentaId, desde]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Mayor por cuenta</h2>
        <p className="text-sm text-slate-500">
          Movimientos de una cuenta del plan de cuentas
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-80 space-y-1">
          <Label>Cuenta contable</Label>
          <Select onValueChange={setCuentaId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccioná una cuenta" />
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
        <div className="space-y-1">
          <Label>Desde</Label>
          <Input
            type="date"
            className="w-40"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
      </div>

      {!cuentaId && (
        <p className="text-sm text-slate-400">
          Seleccioná una cuenta para ver sus movimientos.
        </p>
      )}

      {loading && (
        <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
      )}

      {!loading && result && cuentaId && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="font-mono">
              Debe: {ars(result.total_debe)}
            </Badge>
            <Badge variant="outline" className="font-mono">
              Haber: {ars(result.total_haber)}
            </Badge>
            <Badge
              className={
                result.saldo >= 0
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }
            >
              Saldo: {ars(result.saldo)}
            </Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Movimientos</CardTitle>
            </CardHeader>
            <CardContent>
              {result.movimientos.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Sin movimientos para el período.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200/80 bg-slate-50/60">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-slate-500">
                          Fecha
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-slate-500">
                          Origen
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-slate-500">
                          Descripción
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-slate-500">
                          Debe
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-slate-500">
                          Haber
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-slate-500">
                          Saldo acum.
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let saldo = 0;
                        return result.movimientos.map((m, i) => {
                          saldo += m.debe - m.haber;
                          return (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="px-4 py-3 text-slate-700">
                                {m.fecha.slice(0, 10)}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="text-xs">
                                  {origenLabel[m.origen] ?? m.origen}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                <Link
                                  href={`/asientos/${m.asiento_id}`}
                                  className="hover:text-amber-700 hover:underline"
                                >
                                  {m.descripcion}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-slate-900">
                                {m.debe > 0 ? ars(m.debe) : "—"}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-slate-900">
                                {m.haber > 0 ? ars(m.haber) : "—"}
                              </td>
                              <td
                                className={`px-4 py-3 text-right font-mono font-medium ${
                                  saldo >= 0
                                    ? "text-green-700"
                                    : "text-red-700"
                                }`}
                              >
                                {ars(saldo)}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold">
                      <tr>
                        <td colSpan={3} className="px-4 py-2 text-slate-700">
                          Totales
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-slate-900">
                          {ars(result.total_debe)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-slate-900">
                          {ars(result.total_haber)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-mono ${
                            result.saldo >= 0 ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {ars(result.saldo)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
