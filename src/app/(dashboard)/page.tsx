"use client";

import { useEffect, useState } from "react";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  ReceiptText,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch } from "@/lib/apiFetch";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

type DashboardStats = {
  total_clientes: number;
  creditos_activos: number;
  monto_cartera: number;
  cobros_hoy: number;
  monto_cobros_hoy: number;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    apiFetch("/api/fin/dashboard")
      .then((r) => r.json())
      .then((d) => setStats(d as DashboardStats));
  }, []);

  const items = [
    {
      title: "Total Clientes",
      value: stats ? String(stats.total_clientes) : "—",
      detail: "Base de clientes activos",
      icon: Users,
    },
    {
      title: "Créditos Activos",
      value: stats ? String(stats.creditos_activos) : "—",
      detail: "Operaciones vigentes",
      icon: BriefcaseBusiness,
    },
    {
      title: "Cobros del Día",
      value: stats ? String(stats.cobros_hoy) : "—",
      detail: stats ? `Recaudado: ${ars(stats.monto_cobros_hoy)}` : "Pagos de hoy",
      icon: ReceiptText,
    },
    {
      title: "Monto en Cartera",
      value: stats ? ars(stats.monto_cartera) : "—",
      detail: "Capital administrado activo",
      icon: BadgeDollarSign,
    },
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-[0_16px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
        <Badge className="w-fit">Dashboard operativo</Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Resumen general
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Métricas en tiempo real de clientes, créditos, cobranzas y cartera.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map(({ detail, icon: Icon, title, value }) => (
          <Card
            key={title}
            className="border-white/70 bg-white/88 shadow-[0_18px_48px_rgba(15,23,42,0.08)]"
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardDescription>{title}</CardDescription>
                <CardTitle className="text-3xl font-semibold tracking-tight">
                  {value}
                </CardTitle>
              </div>
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <Icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
