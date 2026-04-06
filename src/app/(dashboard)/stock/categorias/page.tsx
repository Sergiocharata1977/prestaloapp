"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Plus, Power, RefreshCw, Tags } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CAPABILITIES } from "@/lib/capabilities";
import { apiFetch } from "@/lib/apiFetch";
import {
  FIN_STOCK_RUBRO_LABELS,
  type FinStockCategoria,
  type FinStockCategoriaInput,
  type FinStockRubro,
} from "@/types/fin-stock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const TABLE_THEME = {
  containerClassName: "border-slate-800 bg-slate-900",
  headClassName: "border-slate-800 bg-slate-950/70",
  headerCellClassName: "text-slate-300",
  rowClassName: "border-slate-800 hover:!bg-slate-800/60",
  cellClassName: "text-slate-200",
  emptyClassName: "border-slate-800 bg-slate-900",
  skeletonClassName: "bg-slate-800",
} as const;

const RUBRO_OPTIONS = Object.entries(FIN_STOCK_RUBRO_LABELS) as [FinStockRubro, string][];

const DEFAULT_FORM: FinStockCategoriaInput = {
  nombre: "",
  descripcion: "",
  rubro: "otro",
  activa: true,
};

function estadoBadge(activa: boolean) {
  return activa
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
    : "border-red-500/20 bg-red-500/10 text-red-400";
}

export default function StockCategoriasPage() {
  const router = useRouter();
  const { capabilities, loading: authLoading } = useAuth();

  const [categorias, setCategorias] = useState<FinStockCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState<FinStockCategoria | null>(null);
  const [targetDelete, setTargetDelete] = useState<FinStockCategoria | null>(null);
  const [form, setForm] = useState<FinStockCategoriaInput>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !capabilities.includes(CAPABILITIES.STOCK_MERCADERIA)) {
      router.replace("/dashboard");
    }
  }, [authLoading, capabilities, router]);

  async function loadCategorias() {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch("/api/fin/stock/categorias");
      const json = (await response.json().catch(() => ({}))) as {
        categorias?: FinStockCategoria[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(json.error ?? "No se pudieron cargar las categorias");
      }

      setCategorias(json.categorias ?? []);
    } catch (err) {
      setCategorias([]);
      setError(err instanceof Error ? err.message : "No se pudieron cargar las categorias");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && capabilities.includes(CAPABILITIES.STOCK_MERCADERIA)) {
      void loadCategorias();
    }
  }, [authLoading, capabilities]);

  const summary = useMemo(
    () => ({
      total: categorias.length,
      activas: categorias.filter((item) => item.activa).length,
      inactivas: categorias.filter((item) => !item.activa).length,
    }),
    [categorias]
  );

  function openCreateDialog() {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setError(null);
    setDialogOpen(true);
  }

  function openEditDialog(categoria: FinStockCategoria) {
    setEditing(categoria);
    setForm({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion ?? "",
      rubro: categoria.rubro,
      activa: categoria.activa,
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        ...form,
        descripcion: form.descripcion?.trim() ? form.descripcion.trim() : undefined,
      };

      const response = await apiFetch(
        editing ? `/api/fin/stock/categorias/${editing.id}` : "/api/fin/stock/categorias",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );
      const json = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? "No se pudo guardar la categoria");
      }

      setDialogOpen(false);
      setEditing(null);
      setForm(DEFAULT_FORM);
      await loadCategorias();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la categoria");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!targetDelete) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch(`/api/fin/stock/categorias/${targetDelete.id}`, {
        method: "DELETE",
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? "No se pudo desactivar la categoria");
      }

      setConfirmOpen(false);
      setTargetDelete(null);
      await loadCategorias();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desactivar la categoria");
    } finally {
      setSubmitting(false);
    }
  }

  const columns: Column<FinStockCategoria>[] = [
    {
      key: "nombre",
      header: "Nombre",
      render: (row) => <span className="font-medium text-white">{row.nombre}</span>,
    },
    {
      key: "rubro",
      header: "Rubro",
      render: (row) => (
        <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-400">
          {FIN_STOCK_RUBRO_LABELS[row.rubro]}
        </Badge>
      ),
    },
    {
      key: "descripcion",
      header: "Descripcion",
      render: (row) => (
        <span className="text-slate-400">{row.descripcion?.trim() || "Sin descripcion"}</span>
      ),
    },
    {
      key: "activa",
      header: "Estado",
      render: (row) => (
        <Badge className={estadoBadge(row.activa)}>{row.activa ? "Activa" : "Inactiva"}</Badge>
      ),
    },
    {
      key: "acciones",
      header: "",
      width: "180px",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
            onClick={(event) => {
              event.stopPropagation();
              openEditDialog(row);
            }}
          >
            <Edit3 className="h-4 w-4" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
            onClick={(event) => {
              event.stopPropagation();
              setTargetDelete(row);
              setConfirmOpen(true);
            }}
            disabled={!row.activa}
          >
            <Power className="h-4 w-4" />
            Desactivar
          </Button>
        </div>
      ),
    },
  ];

  if (authLoading) {
    return <div className="h-60 animate-pulse rounded-2xl bg-slate-900" />;
  }

  return (
    <div className="space-y-6 bg-slate-950 text-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Categorias</h1>
          <p className="text-sm text-slate-400">
            Organiza el catalogo por rubros y controla la disponibilidad comercial.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            onClick={() => void loadCategorias()}
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button className="bg-amber-500 text-slate-950 hover:bg-amber-400" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Nueva categoria
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Categorias", value: String(summary.total), detail: "Total registradas" },
          { label: "Activas", value: String(summary.activas), detail: "Disponibles para productos" },
          { label: "Inactivas", value: String(summary.inactivas), detail: "Ocultas para nuevas altas" },
        ].map(({ label, value, detail }) => (
          <Card key={label} className="border-slate-800 bg-slate-900 text-white">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-400">
                <Tags className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-300">{label}</p>
                <p className="text-2xl font-semibold text-white">{value}</p>
                <p className="text-xs text-slate-400">{detail}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={categorias}
        loading={loading}
        emptyMessage="No hay categorias registradas."
        {...TABLE_THEME}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setForm(DEFAULT_FORM);
          }
        }}
      >
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editing ? "Editar categoria" : "Nueva categoria"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Define nombre, rubro y estado comercial de la categoria.
            </DialogDescription>
          </DialogHeader>

          <form id="categoria-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre" className="text-slate-300">
                Nombre
              </Label>
              <Input
                id="nombre"
                required
                value={form.nombre}
                onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
                className="border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Rubro</Label>
              <Select
                value={form.rubro}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, rubro: value as FinStockRubro }))
                }
              >
                <SelectTrigger className="border-slate-700 bg-slate-950 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-950 text-white">
                  {RUBRO_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-slate-200 focus:bg-slate-800 focus:text-white">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion" className="text-slate-300">
                Descripcion
              </Label>
              <Textarea
                id="descripcion"
                value={form.descripcion ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, descripcion: event.target.value }))
                }
                className="border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
              />
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
              <input
                type="checkbox"
                checked={form.activa}
                onChange={(event) =>
                  setForm((current) => ({ ...current, activa: event.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-500 accent-amber-500"
              />
              <div>
                <p className="text-sm font-medium text-slate-200">Categoria activa</p>
                <p className="text-xs text-slate-400">
                  Si la desactivas, no se ofrecera para nuevos productos.
                </p>
              </div>
            </label>
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
              onClick={() => setDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="categoria-form"
              className="bg-amber-500 text-slate-950 hover:bg-amber-400"
              disabled={submitting}
            >
              {submitting ? "Guardando..." : editing ? "Guardar cambios" : "Crear categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setTargetDelete(null);
        }}
      >
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Desactivar categoria</DialogTitle>
            <DialogDescription className="text-slate-400">
              {targetDelete
                ? `La categoria "${targetDelete.nombre}" quedara inactiva para nuevas altas.`
                : "Confirma la desactivacion de la categoria."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
              onClick={() => setConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-red-500 text-white hover:bg-red-400"
              onClick={() => void handleDeactivate()}
              disabled={submitting}
            >
              {submitting ? "Desactivando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
