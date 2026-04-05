"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, ShieldAlert, Wallet } from "lucide-react";
import type { FinCtaCteEstado, FinCtaCteOperacion } from "@/types/fin-ctacte";
import { useAuth } from "@/hooks/useAuth";
import { CAPABILITIES } from "@/lib/capabilities";
import { apiFetch } from "@/lib/apiFetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";

type TabKey = "activas" | "al_dia" | "sin_pago" | "incumplidas" | "judiciales";

const fmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function ars(n: number) {
  return fmt.format(n);
}

function formatEstado(estado: FinCtaCteEstado) {
  switch (estado) {
    case "activa":
      return "Activa";
    case "al_dia":
      return "Al día";
    case "sin_pago":
      return "Sin pago";
    case "incumplida":
      return "Incumplida";
    case "refinanciada":
      return "Refinanciada";
    case "cancelada":
      return "Cancelada";
    case "judicial":
      return "Judicial";
    default:
      return estado;
  }
}

function estadoTone(estado: FinCtaCteEstado) {
  switch (estado) {
    case "al_dia":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "sin_pago":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "incumplida":
      return "bg-orange-100 text-orange-900 border-orange-200";
    case "cancelada":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "judicial":
      return "bg-red-100 text-red-800 border-red-200";
    case "refinanciada":
      return "bg-sky-100 text-sky-800 border-sky-200";
    default:
      return "bg-blue-100 text-blue-800 border-blue-200";
  }
}

const columns: Column<FinCtaCteOperacion>[] = [
  { key: "cliente_nombre", header: "Cliente" },
  {
    key: "saldo_actual",
    header: "Saldo actual",
    render: (row) => ars(row.saldo_actual),
    className: "text-right font-mono font-semibold",
  },
  {
    key: "monto_original",
    header: "Monto original",
    render: (row) => ars(row.monto_original),
    className: "text-right font-mono text-slate-500",
  },
  {
    key: "ultimo_pago_fecha",
    header: "Último pago",
    render: (row) => row.ultimo_pago_fecha ?? "Sin pagos",
  },
  {
    key: "estado",
    header: "Estado",
    render: (row) => (
      <Badge className={estadoTone(row.estado)}>
        {formatEstado(row.estado)}
      </Badge>
    ),
  },
  {
    key: "acciones",
    header: "",
    render: (row) => (
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href={`/cta-corriente/${row.id}`}>Ver detalle</Link>
        </Button>
      </div>
    ),
    className: "text-right",
    width: "120px",
  },
];

const TABS: { key: TabKey; label: string }[] = [
  { key: "al_dia", label: "Al día" },
  { key: "sin_pago", label: "Sin pago este mes" },
  { key: "incumplidas", label: "Entrega insuficiente" },
  { key: "judiciales", label: "Judiciales" },
  { key: "activas", label: "Todas activas" },
];

export default function CtaCorrientePage() {
  const router = useRouter();
  const { capabilities, loading: authLoading } = useAuth();

  const [operaciones, setOperaciones] = useState<FinCtaCteOperacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabActiva, setTabActiva] = useState<TabKey>("activas");

  useEffect(() => {
    if (!authLoading && !capabilities.includes(CAPABILITIES.CTA_CTE_COMERCIAL)) {
      router.replace("/dashboard");
    }
  }, [authLoading, capabilities, router]);

  const fetchOperaciones = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch("/api/fin/ctacte");
      const json = (await response.json().catch(() => ({}))) as {
        operaciones?: FinCtaCteOperacion[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(json.error ?? "No se pudo obtener la cartera");
      }

      setOperaciones(json.operaciones ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo obtener la cartera");
      setOperaciones([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && capabilities.includes(CAPABILITIES.CTA_CTE_COMERCIAL)) {
      void fetchOperaciones();
    }
  }, [authLoading, capabilities]);

  const filtered = useMemo(() => {
    switch (tabActiva) {
      case "al_dia":
        return operaciones.filter((item) => item.estado === "al_dia");
      case "sin_pago":
        return operaciones.filter((item) => item.estado === "sin_pago");
      case "incumplidas":
        return operaciones.filter((item) => item.estado === "incumplida");
      case "judiciales":
        return operaciones.filter((item) => item.estado === "judicial");
      default:
        return operaciones.filter(
          (item) => item.estado !== "cancelada" && item.estado !== "refinanciada"
        );
    }
  }, [operaciones, tabActiva]);

  const counts = useMemo(
    () => ({
      activas: operaciones.filter(
        (item) => item.estado !== "cancelada" && item.estado !== "refinanciada"
      ).length,
      al_dia: operaciones.filter((i) => i.estado === "al_dia").length,
      sin_pago: operaciones.filter((i) => i.estado === "sin_pago").length,
      incumplidas: operaciones.filter((i) => i.estado === "incumplida").length,
      judiciales: operaciones.filter((i) => i.estado === "judicial").length,
    }),
    [operaciones]
  );

  const summary = useMemo(() => {
    const activas = operaciones.filter(
      (item) => item.estado !== "cancelada" && item.estado !== "refinanciada"
    );

    return {
      activas: activas.length,
      saldoActivo: activas.reduce((acc, item) => acc + item.saldo_actual, 0),
      sinPago: operaciones.filter((item) => item.estado === "sin_pago").length,
      incumplidas: operaciones.filter((item) => item.estado === "incumplida").length,
    };
  }, [operaciones]);

  if (authLoading) {
    return <div className="h-60 animate-pulse rounded-2xl bg-slate-200" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cta. Cte. Financiada</h1>
          <p className="text-sm text-slate-500">
            Seguimiento de operaciones activas, pagos y estado de cartera.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/cta-corriente/control-mensual">
              <ShieldAlert className="h-4 w-4" />
              Control mensual
            </Link>
          </Button>
          <Button variant="outline" onClick={() => void fetchOperaciones()}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button asChild>
            <Link href="/cta-corriente/nueva">
              <Plus className="h-4 w-4" />
              Nueva cuenta corriente
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Operaciones activas",
            value: String(summary.activas),
            detail: "Excluye canceladas y refinanciadas",
          },
          {
            label: "Saldo activo",
            value: ars(summary.saldoActivo),
            detail: "Saldo vivo de la cartera",
          },
          {
            label: "Sin pago",
            value: String(summary.sinPago),
            detail: "Sin pago registrado en el período",
          },
          {
            label: "Incumplidas",
            value: String(summary.incumplidas),
            detail: "Entrega mínima no cumplida",
          },
        ].map(({ label, value, detail }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <Wallet className="h-5 w-5" />
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

      <div className="flex flex-wrap gap-2">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTabActiva(key)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              tabActiva === key
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {label}
            {counts[key] > 0 ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                  tabActiva === key
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {counts[key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyMessage="No hay operaciones para la bandeja seleccionada."
        onRowClick={(row) => router.push(`/cta-corriente/${row.id}`)}
      />
    </div>
  );
}
