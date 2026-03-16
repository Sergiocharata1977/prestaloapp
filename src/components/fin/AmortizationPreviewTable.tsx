"use client";

import type { TablaAmortizacion } from "@/services/AmortizationService";

function ars(value: number) {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

export function AmortizationPreviewTable({
  tabla,
  loading,
}: {
  tabla: TablaAmortizacion | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!tabla) {
    return (
      <div className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
        <p className="text-sm text-slate-400">
          Completá el formulario para ver la tabla de amortización.
        </p>
      </div>
    );
  }

  const totCapital = tabla.cuotas.reduce((s, c) => s + c.capital, 0);
  const totInteres = tabla.cuotas.reduce((s, c) => s + c.interes, 0);
  const totTotal = tabla.cuotas.reduce((s, c) => s + c.total, 0);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
      <div className="border-b border-slate-200/80 px-4 py-3">
        <p className="text-sm font-medium text-slate-700">
          Sistema {tabla.sistema === "frances" ? "Francés" : "Alemán"} —{" "}
          {tabla.cantidad_cuotas} cuotas · Total crédito{" "}
          {ars(tabla.total_credito)}
        </p>
      </div>
      <table className="w-full text-xs">
        <thead className="bg-slate-50/60 text-slate-500">
          <tr>
            <th className="px-3 py-2 text-right">Nro</th>
            <th className="px-3 py-2 text-left">Vencimiento</th>
            <th className="px-3 py-2 text-right">Capital</th>
            <th className="px-3 py-2 text-right">Interés</th>
            <th className="px-3 py-2 text-right font-semibold">Total</th>
            <th className="px-3 py-2 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {tabla.cuotas.map((c) => (
            <tr
              key={c.numero_cuota}
              className="border-t border-slate-100 hover:bg-amber-50/30"
            >
              <td className="px-3 py-2 text-right text-slate-500">
                {c.numero_cuota}
              </td>
              <td className="px-3 py-2 text-slate-700">{c.fecha_vencimiento}</td>
              <td className="px-3 py-2 text-right text-slate-700">
                {ars(c.capital)}
              </td>
              <td className="px-3 py-2 text-right text-slate-500">
                {ars(c.interes)}
              </td>
              <td className="px-3 py-2 text-right font-medium text-slate-900">
                {ars(c.total)}
              </td>
              <td className="px-3 py-2 text-right text-slate-500">
                {ars(c.saldo_capital_fin)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold">
          <tr>
            <td colSpan={2} className="px-3 py-2 text-slate-600">
              Totales
            </td>
            <td className="px-3 py-2 text-right text-slate-800">
              {ars(totCapital)}
            </td>
            <td className="px-3 py-2 text-right text-slate-600">
              {ars(totInteres)}
            </td>
            <td className="px-3 py-2 text-right text-slate-900">
              {ars(totTotal)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
