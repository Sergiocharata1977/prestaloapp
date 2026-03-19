import { Landmark, Percent, Receipt, Wallet } from "lucide-react";
import type {
  ChequeDraft,
  OfferPreview,
  OfferTerms,
} from "@/components/fin/cheques/types";
import { ars } from "@/components/fin/cheques/cheque-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChequeOfferPreviewProps = {
  preview: OfferPreview;
  terms: OfferTerms;
  cheques: ChequeDraft[];
};

export function ChequeOfferPreview({
  preview,
  terms,
  cheques,
}: ChequeOfferPreviewProps) {
  const items = [
    {
      label: "Nominal total",
      value: ars(preview.nominalTotal),
      icon: Landmark,
      tone: "bg-slate-100 text-slate-700",
    },
    {
      label: "Descuento",
      value: ars(preview.descuentoTotal),
      icon: Percent,
      tone: "bg-amber-100 text-amber-800",
    },
    {
      label: "Gastos",
      value: ars(preview.gastosTotal),
      icon: Receipt,
      tone: "bg-orange-100 text-orange-800",
    },
    {
      label: "Neto a acreditar",
      value: ars(preview.netoTotal),
      icon: Wallet,
      tone: "bg-emerald-100 text-emerald-800",
    },
  ];

  return (
    <Card className="border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,1))]">
      <CardHeader>
        <CardTitle>Preview de oferta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(({ icon: Icon, label, tone, value }) => (
            <div
              key={label}
              className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-xl p-2 ${tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    {label}
                  </p>
                  <p className="text-lg font-semibold text-slate-900">{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-slate-400">Cheques cargados</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{cheques.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-slate-400">Plazo promedio</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {preview.plazoPromedioDias} dias
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-slate-400">Tasa / gastos</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {terms.tasaDescuentoMensual}% mensual
            </p>
            <p className="text-xs text-slate-500">
              {terms.gastoVariablePct}% variable + {ars(terms.gastoFijoPorCheque)} fijo
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
