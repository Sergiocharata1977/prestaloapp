"use client";

import { useEffect, useMemo, useState } from "react";
import { FileWarning, Gavel, Landmark, Scale, ShieldAlert } from "lucide-react";
import { StatusBadge } from "@/components/fin/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { apiFetch } from "@/lib/apiFetch";
import type { FinCheque } from "@/types/fin-cheque";
import type { FinCredito } from "@/types/fin-credito";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

const creditoColumns: Column<FinCredito>[] = [
  { key: "numero_credito", header: "Credito", width: "110px" },
  { key: "articulo_descripcion", header: "Articulo" },
  {
    key: "saldo_capital",
    header: "Saldo",
    render: (row) => ars(row.saldo_capital ?? 0),
    className: "text-right font-mono font-semibold",
  },
  { key: "fecha_otorgamiento", header: "Otorgado" },
  {
    key: "estado",
    header: "Estado",
    render: (row) => <StatusBadge estado={row.estado} />,
  },
];

const chequeColumns: Column<FinCheque>[] = [
  { key: "numero", header: "Cheque", render: (row) => row.numero ?? "-" },
  { key: "banco", header: "Banco", render: (row) => row.banco ?? "-" },
  { key: "fecha_pago", header: "Fecha pago" },
  {
    key: "importe",
    header: "Importe",
    render: (row) => ars(row.importe ?? 0),
    className: "text-right font-mono font-semibold",
  },
  {
    key: "estado",
    header: "Estado",
    render: (row) => (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
        {row.estado.replace("_", " ")}
      </span>
    ),
  },
];

const practices = [
  "Emitir intimacion formal y consolidar respaldo documental antes de derivar.",
  "Congelar nuevas excepciones sobre clientes judicializados o con cheques rechazados criticos.",
  "Mantener trazabilidad completa de gestiones, acuerdos, rechazo y costos de recupero.",
  "Revisar mensualmente recuperabilidad, honorarios y decision de castigo.",
];

export default function JudicialesPage() {
  const [creditos, setCreditos] = useState<FinCredito[]>([]);
  const [cheques, setCheques] = useState<FinCheque[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/api/fin/creditos?estado=incobrable").then((response) => response.json()),
      apiFetch("/api/fin/cheques").then((response) => response.json()),
    ])
      .then(([creditosData, chequesData]) => {
        setCreditos((creditosData as { creditos?: FinCredito[] }).creditos ?? []);
        const allCheques = (chequesData as { cheques?: FinCheque[] }).cheques ?? [];
        setCheques(
          allCheques.filter(
            (cheque) =>
              cheque.estado === "pre_judicial" ||
              cheque.estado === "judicial" ||
              cheque.estado === "rechazado"
          )
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const carteraCreditos = creditos.reduce(
      (acc, credito) => acc + (credito.saldo_capital ?? 0),
      0
    );
    const carteraCheques = cheques.reduce((acc, cheque) => acc + (cheque.importe ?? 0), 0);

    return {
      carteraCreditos,
      carteraCheques,
      casos: creditos.length + cheques.length,
    };
  }, [creditos, cheques]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          Control de mora
        </Badge>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Judicial
          </h1>
          <p className="max-w-3xl text-sm text-slate-500">
            Bandeja consolidada para casos pre-judiciales y judiciales con foco en
            recupero, evidencia y derivacion ordenada.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Cartera judicial creditos",
            value: ars(summary.carteraCreditos),
            detail: `${creditos.length} credito(s) escalados`,
            icon: Landmark,
          },
          {
            label: "Cartera judicial cheques",
            value: ars(summary.carteraCheques),
            detail: `${cheques.length} cheque(s) observados`,
            icon: Gavel,
          },
          {
            label: "Casos a seguimiento",
            value: String(summary.casos),
            detail: "Pre-judicial + judicial",
            icon: ShieldAlert,
          },
        ].map(({ icon: Icon, label, value, detail }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-2xl bg-rose-100 p-3 text-rose-700">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-2xl font-semibold text-slate-900">{value}</p>
                <p className="text-xs text-slate-400">{detail}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Creditos judicializados o incobrables</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={creditoColumns}
                data={creditos}
                loading={loading}
                emptyMessage="No hay creditos escalados."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cheques en pre-judicial o judicial</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={chequeColumns}
                data={cheques}
                loading={loading}
                emptyMessage="No hay cheques judicializados."
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Practicas recomendadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-800">
                <Scale className="h-4 w-4" />
                Secuencia sugerida
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {practices.map((practice) => (
                  <li key={practice} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
                    <span>{practice}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileWarning className="h-4 w-4 text-slate-600" />
                Checklist minimo del legajo
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>1. Contrato, recibos, cronograma y saldo actualizado.</li>
                <li>2. DNI o CUIT, domicilio, garante y evidencia de contacto.</li>
                <li>3. Intimaciones, promesas incumplidas y gastos asociados.</li>
                <li>4. Estudio asignado, estado procesal y proxima accion.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
