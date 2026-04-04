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
      <section className="chart-panel flex flex-col gap-4 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge className="w-fit border-amber-200/80 bg-white/80 text-amber-700 shadow-sm">
              Dashboard operativo
            </Badge>
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
            className="overflow-hidden border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(255,249,240,0.98)_100%)] shadow-[0_18px_48px_rgba(15,23,42,0.08)]"
          >
            <CardContent className="relative p-6">
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl"
                style={{ background: "rgba(245, 158, 11, 0.18)" }}
                aria-hidden="true"
              />
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {title}
                  </p>
                  <p className="text-3xl font-semibold tracking-tight text-slate-950">
                    {value}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200/70 bg-white/80 p-3 text-amber-700 shadow-[0_10px_24px_rgba(180,83,9,0.08)]">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-6 h-px bg-gradient-to-r from-amber-200/70 via-amber-100/40 to-transparent" />
              <p className="mt-4 text-sm text-slate-500">
                {detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
