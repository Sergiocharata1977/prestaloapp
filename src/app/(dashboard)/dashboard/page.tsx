"use client";

import { useEffect, useState } from "react";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  Database,
  ReceiptText,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadStats = () => {
    apiFetch("/api/fin/dashboard")
      .then((r) => r.json())
      .then((d) => setStats(d as DashboardStats));
  };

  useEffect(() => { loadStats(); }, []);

  const handleSeedDemo = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const res = await apiFetch("/api/fin/seed-demo", { method: "POST" });
      const body = await res.json() as { ok?: boolean; clientes?: number; creditos?: number; error?: string };
      if (!res.ok) {
        setSeedMsg({ ok: false, text: body.error ?? "Error al cargar datos demo" });
      } else {
        setSeedMsg({ ok: true, text: `Datos cargados: ${body.clientes ?? 0} clientes, ${body.creditos ?? 0} créditos con cuotas.` });
        loadStats();
      }
    } catch {
      setSeedMsg({ ok: false, text: "Error de conexión" });
    } finally {
      setSeeding(false);
    }
  };

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
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge className="w-fit">Dashboard operativo</Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Resumen general
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Métricas en tiempo real de clientes, créditos, cobranzas y cartera.
            </p>
          </div>
          {stats?.total_clientes === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedDemo}
              disabled={seeding}
              className="shrink-0"
            >
              <Database className="h-4 w-4" />
              {seeding ? "Cargando..." : "Cargar datos demo"}
            </Button>
          )}
        </div>
        {seedMsg && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${seedMsg.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            {seedMsg.text}
          </div>
        )}
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
