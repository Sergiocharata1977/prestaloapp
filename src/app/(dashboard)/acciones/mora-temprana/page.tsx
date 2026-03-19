"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Clock3,
  MessageSquareWarning,
  PhoneCall,
  WalletCards,
} from "lucide-react";
import { StatusBadge } from "@/components/fin/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiFetch";
import type { FinCredito } from "@/types/fin-credito";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

const columns: Column<FinCredito>[] = [
  { key: "numero_credito", header: "Credito", width: "110px" },
  { key: "articulo_descripcion", header: "Articulo" },
  {
    key: "saldo_capital",
    header: "Saldo",
    render: (row) => ars(row.saldo_capital ?? 0),
    className: "text-right font-mono font-semibold",
  },
  {
    key: "cantidad_cuotas",
    header: "Cuotas",
    render: (row) => `${row.cuotas_pagas}/${row.cantidad_cuotas}`,
    className: "text-center",
  },
  {
    key: "fecha_primer_vencimiento",
    header: "Primer vto.",
    render: (row) => row.fecha_primer_vencimiento,
  },
  {
    key: "estado",
    header: "Estado",
    render: (row) => <StatusBadge estado={row.estado} />,
  },
  {
    key: "gestion_sugerida",
    header: "Gestion sugerida",
    render: () => (
      <span className="text-xs font-medium text-amber-700">
        Llamado + promesa de pago
      </span>
    ),
  },
];

const practices = [
  "Primer contacto dentro de las 24 horas del vencimiento para evitar normalizar el atraso.",
  "Registrar promesa de pago con fecha y canal de contacto para medir cumplimiento.",
  "Escalar a segundo contacto y aviso formal si no hay respuesta en 48 a 72 horas.",
  "Ofrecer regularizacion o refinanciacion solo despues de validar capacidad de pago actual.",
];

export default function MoraTempranaPage() {
  const [creditos, setCreditos] = useState<FinCredito[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch("/api/fin/creditos?estado=en_mora")
      .then((response) => response.json())
      .then((data) => setCreditos((data as { creditos?: FinCredito[] }).creditos ?? []))
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const cartera = creditos.reduce((acc, credito) => acc + (credito.saldo_capital ?? 0), 0);
    const tickets = creditos.filter((credito) => (credito.saldo_capital ?? 0) > 0).length;
    const saldoPromedio = tickets > 0 ? cartera / tickets : 0;

    return {
      cartera,
      tickets,
      saldoPromedio,
    };
  }, [creditos]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            Acciones
          </Badge>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Mora temprana
            </h1>
            <p className="max-w-3xl text-sm text-slate-500">
              Bandeja para los atrasos iniciales. El objetivo es recuperar rapido,
              documentar bien y cortar el paso a mora severa.
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/cobros/nuevo">Registrar cobro</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Cartera en mora temprana",
            value: ars(summary.cartera),
            detail: "Saldo vivo en gestion inicial",
            icon: WalletCards,
          },
          {
            label: "Casos abiertos",
            value: String(summary.tickets),
            detail: "Creditos a contactar hoy",
            icon: BellRing,
          },
          {
            label: "Saldo promedio",
            value: ars(summary.saldoPromedio),
            detail: "Referencia para promesa de pago",
            icon: Clock3,
          },
        ].map(({ icon: Icon, label, value, detail }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
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
        <Card>
          <CardHeader>
            <CardTitle>Lista de gestion</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={creditos}
              loading={loading}
              emptyMessage="No hay creditos en mora temprana."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Buenas practicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <PhoneCall className="h-4 w-4" />
                Secuencia sugerida
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {practices.map((practice) => (
                  <li key={practice} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>{practice}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <MessageSquareWarning className="h-4 w-4 text-slate-600" />
                Acciones operativas recomendadas
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>1. Confirmar telefono, WhatsApp y contacto alternativo del cliente.</li>
                <li>2. Registrar motivo del atraso y fecha cierta de regularizacion.</li>
                <li>3. Reintentar contacto antes de las 72 horas si no responde.</li>
                <li>4. Bloquear nuevas operaciones hasta normalizar deuda.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
