'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { FinLedgerEntry, LedgerEntryType } from '@/types/fin-ledger';

function ars(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

type LedgerResponse = {
  movimientos: FinLedgerEntry[];
  saldo_actual: number;
};

function tipoBadge(tipo: LedgerEntryType) {
  switch (tipo) {
    case 'cobro_cuota':
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          cobro_cuota
        </Badge>
      );
    case 'otorgamiento':
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
          otorgamiento
        </Badge>
      );
    case 'mora':
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">mora</Badge>
      );
    case 'ajuste_manual':
      return (
        <Badge className="bg-slate-100 text-slate-700 border-slate-200">
          ajuste_manual
        </Badge>
      );
    case 'refinanciacion':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          refinanciacion
        </Badge>
      );
    default:
      return <Badge variant="outline">{tipo}</Badge>;
  }
}

export default function CuentaCorrientePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/fin/clientes/${id}/ledger`)
      .then((r) => r.json())
      .then((json) => setData(json as LedgerResponse))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-200" />
        ))}
      </div>
    );
  }

  const saldo = data?.saldo_actual ?? 0;
  const movimientos = data?.movimientos ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/clientes/${id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold text-slate-900">
            Cuenta corriente
          </h2>
          <p className="text-sm text-slate-500">Cliente ID: {id}</p>
        </div>
        {saldo >= 0 ? (
          <Badge className="bg-green-100 text-green-800 border-green-200 font-mono text-sm px-3 py-1">
            Saldo: {ars(saldo)}
          </Badge>
        ) : (
          <Badge className="bg-red-100 text-red-800 border-red-200 font-mono text-sm px-3 py-1">
            Saldo: {ars(saldo)}
          </Badge>
        )}
      </div>

      {/* Tabla de movimientos */}
      {movimientos.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          Sin movimientos registrados
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Descripción
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  Debe
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  Haber
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movimientos.map((mov) => (
                <tr key={mov.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">
                    {mov.fecha.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">{tipoBadge(mov.tipo)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {mov.descripcion}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-700">
                    {mov.debe > 0 ? ars(mov.debe) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-blue-700">
                    {mov.haber > 0 ? ars(mov.haber) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                    {ars(mov.saldo_acumulado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Botón Volver */}
      <div>
        <Button variant="outline" onClick={() => router.push(`/clientes/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver al cliente
        </Button>
      </div>
    </div>
  );
}
