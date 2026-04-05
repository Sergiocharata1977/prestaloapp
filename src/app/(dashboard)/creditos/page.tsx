"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleDollarSign, LayoutGrid, List, Plus, WalletCards } from "lucide-react";
import type { FinCredito } from "@/types/fin-credito";
import { NuevoCreditoDialog } from "@/components/fin/dialogs/NuevoCreditoDialog";
import { StatusBadge } from "@/components/fin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { apiFetch } from "@/lib/apiFetch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function ars(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

const columns: Column<FinCredito>[] = [
  { key: "numero_credito", header: "Nro", width: "90px" },
  { key: "articulo_descripcion", header: "Articulo", className: "text-sm" },
  {
    key: "capital",
    header: "Capital",
    render: (r) => ars(r.capital),
    className: "text-right font-mono tabular-nums",
  },
  {
    key: "sistema",
    header: "Sistema",
    render: (r) => (r.sistema === "frances" ? "Frances" : "Aleman"),
  },
  {
    key: "cantidad_cuotas",
    header: "Cuotas",
    render: (r) => `${r.cuotas_pagas}/${r.cantidad_cuotas}`,
    className: "tabular-nums",
  },
  {
    key: "saldo_capital",
    header: "Saldo",
    render: (r) => ars(r.saldo_capital),
    className: "text-right font-mono tabular-nums",
  },
  {
    key: "estado",
    header: "Estado",
    render: (r) => <StatusBadge estado={r.estado} />,
  },
  { key: "fecha_otorgamiento", header: "Fecha" },
];

type ViewMode = "lista" | "tarjetas";

export default function CreditosPage() {
  const router = useRouter();
  const [creditos, setCreditos] = useState<FinCredito[]>([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState("todos");
  const [view, setView] = useState<ViewMode>("lista");
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchCreditos = (filtroEstado: string) => {
    const url =
      filtroEstado !== "todos"
        ? `/api/fin/creditos?estado=${filtroEstado}`
        : "/api/fin/creditos";
    apiFetch(url)
      .then((r) => r.json())
      .then((d) => setCreditos((d as { creditos: FinCredito[] }).creditos ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCreditos(estado);
  }, [estado]);

  const handleEstadoChange = (value: string) => {
    setLoading(true);
    setEstado(value);
  };

  const summary = useMemo(() => {
    const creditosVigentes = creditos.filter((credito) => credito.estado === "activo");

    const carteraSinVencer = creditosVigentes.reduce(
      (acc, credito) => acc + (credito.saldo_capital ?? 0),
      0
    );
    const capitalColocado = creditos.reduce(
      (acc, credito) => acc + (credito.capital ?? 0),
      0
    );

    return {
      carteraSinVencer,
      capitalColocado,
      creditosVigentes: creditosVigentes.length,
    };
  }, [creditos]);

  return (
    <div className="space-y-6">
      <section className="chart-panel p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-3">
              <span className="inline-flex rounded-full border border-amber-200/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 shadow-sm">
                Cartera activa
              </span>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Creditos</h2>
            <p className="mt-2 text-sm text-slate-500">
              Cartera con otorgamiento rapido y flujo bajo politica para personas y empresas
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/creditos/nuevo")}>
              Nuevo bajo politica
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuevo rapido
            </Button>
          </div>
        </div>
      </section>

      <div className="rounded-[1.5rem] border border-white/70 bg-white/80 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex items-center gap-3">
          <Select value={estado} onValueChange={handleEstadoChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="activo">Activos</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
              <SelectItem value="en_mora">En mora</SelectItem>
              <SelectItem value="incobrable">Incobrables</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <button
              onClick={() => setView("lista")}
              className={`cursor-pointer rounded p-1.5 transition-colors ${
                view === "lista"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Vista lista"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("tarjetas")}
              className={`cursor-pointer rounded p-1.5 transition-colors ${
                view === "tarjetas"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Vista tarjetas"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Cartera sin vencer",
            value: ars(summary.carteraSinVencer),
            detail: `${summary.creditosVigentes} credito(s) vigentes`,
            icon: WalletCards,
            iconBg: "bg-emerald-500/10 border-emerald-200/70 text-emerald-700",
            iconShadow: "rgba(5,150,105,0.08)",
            glow: "rgba(16,185,129,0.13)",
          },
          {
            label: "Capital colocado",
            value: ars(summary.capitalColocado),
            detail: `${creditos.length} operacion(es) en vista`,
            icon: CircleDollarSign,
            iconBg: "bg-blue-500/10 border-blue-200/70 text-blue-700",
            iconShadow: "rgba(29,78,216,0.07)",
            glow: "rgba(37,99,235,0.10)",
          },
          {
            label: "Creditos vigentes",
            value: String(summary.creditosVigentes),
            detail: "Solo estado activo",
            icon: List,
            iconBg: "bg-amber-500/10 border-amber-200/70 text-amber-700",
            iconShadow: "rgba(180,83,9,0.08)",
            glow: "rgba(245,158,11,0.18)",
          },
        ].map(({ icon: Icon, label, value, detail, iconBg, iconShadow, glow }) => (
          <Card
            key={label}
            className="overflow-hidden border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,249,240,0.98)_100%)] shadow-[0_18px_40px_rgba(15,23,42,0.06)]"
          >
            <CardContent className="relative p-6">
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl"
                style={{ background: glow }}
                aria-hidden="true"
              />
              <div className={`w-fit rounded-2xl border p-3 shadow-[0_10px_24px_var(--icon-shadow)] ${iconBg}`}
                style={{ "--icon-shadow": iconShadow } as React.CSSProperties}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                <p className="tabular-nums text-2xl font-semibold text-slate-950">{value}</p>
                <p className="text-xs text-slate-400">{detail}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {view === "lista" && (
        <DataTable
          columns={columns}
          data={creditos}
          loading={loading}
          emptyMessage="No hay creditos para el filtro seleccionado."
          onRowClick={(row) => router.push(`/creditos/${row.id}`)}
        />
      )}

      {view === "tarjetas" &&
        (loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : creditos.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">
            No hay creditos para el filtro seleccionado.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creditos.map((cr) => (
              <button
                key={cr.id}
                onClick={() => router.push(`/creditos/${cr.id}`)}
                className="group rounded-2xl border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,249,240,0.98)_100%)] p-5 text-left shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition-all hover:border-amber-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-amber-700">#{cr.numero_credito}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm font-medium text-slate-900 group-hover:text-amber-700">
                      {cr.articulo_descripcion}
                    </p>
                  </div>
                  <StatusBadge estado={cr.estado} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-400">Capital</p>
                    <p className="font-mono font-semibold text-slate-900">{ars(cr.capital)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Saldo</p>
                    <p className="font-mono font-semibold text-slate-900">{ars(cr.saldo_capital)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Sistema</p>
                    <p className="text-slate-700">{cr.sistema === "frances" ? "Frances" : "Aleman"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Cuotas</p>
                    <p className="text-slate-700">
                      {cr.cuotas_pagas}/{cr.cantidad_cuotas}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-400">{cr.fecha_otorgamiento}</p>
              </button>
            ))}
          </div>
        ))}

      <NuevoCreditoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setLoading(true);
          fetchCreditos(estado);
        }}
      />
    </div>
  );
}
