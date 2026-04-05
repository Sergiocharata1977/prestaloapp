'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Power, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/apiFetch';
import type {
  FinCtaCteCargoT,
  FinCtaCteEntregaMinimaT,
  FinCtaCtePolitica,
} from '@/types/fin-ctacte';

type PoliticaFormState = {
  nombre: string;
  descripcion: string;
  activa: boolean;
  entrega_minima_tipo: FinCtaCteEntregaMinimaT;
  entrega_minima_valor: string;
  gasto_fijo_mensual: string;
  dia_control: string;
  gracia_dias: string;
  aplica_mora_sin_pago: boolean;
  mora_tipo: FinCtaCteCargoT;
  mora_valor: string;
  permite_refinanciacion: boolean;
};

const EMPTY_FORM: PoliticaFormState = {
  nombre: '',
  descripcion: '',
  activa: true,
  entrega_minima_tipo: 'pct_compra',
  entrega_minima_valor: '20',
  gasto_fijo_mensual: '0',
  dia_control: '10',
  gracia_dias: '5',
  aplica_mora_sin_pago: true,
  mora_tipo: 'pct_saldo',
  mora_valor: '5',
  permite_refinanciacion: true,
};

function politicaToForm(politica: FinCtaCtePolitica): PoliticaFormState {
  return {
    nombre: politica.nombre,
    descripcion: politica.descripcion ?? '',
    activa: politica.activa,
    entrega_minima_tipo: politica.reglas.entrega_minima_tipo,
    entrega_minima_valor: String(politica.reglas.entrega_minima_valor),
    gasto_fijo_mensual: String(politica.reglas.gasto_fijo_mensual),
    dia_control: String(politica.reglas.dia_control),
    gracia_dias: String(politica.reglas.gracia_dias),
    aplica_mora_sin_pago: politica.reglas.aplica_mora_sin_pago,
    mora_tipo: politica.reglas.mora_tipo,
    mora_valor: String(politica.reglas.mora_valor),
    permite_refinanciacion: politica.reglas.permite_refinanciacion,
  };
}

function buildPayload(form: PoliticaFormState) {
  return {
    nombre: form.nombre,
    descripcion: form.descripcion || undefined,
    activa: form.activa,
    reglas: {
      entrega_minima_tipo: form.entrega_minima_tipo,
      entrega_minima_valor: Number(form.entrega_minima_valor),
      gasto_fijo_mensual: Number(form.gasto_fijo_mensual),
      dia_control: Number(form.dia_control),
      gracia_dias: Number(form.gracia_dias),
      aplica_mora_sin_pago: form.aplica_mora_sin_pago,
      mora_tipo: form.mora_tipo,
      mora_valor: Number(form.mora_valor),
      permite_refinanciacion: form.permite_refinanciacion,
    },
  };
}

function entregaText(politica: FinCtaCtePolitica): string {
  const tipoMap: Record<FinCtaCteEntregaMinimaT, string> = {
    monto_fijo: 'Monto fijo',
    pct_compra: '% compra',
    pct_saldo: '% saldo',
  };

  return `${tipoMap[politica.reglas.entrega_minima_tipo]} ${politica.reglas.entrega_minima_valor}`;
}

function moraText(politica: FinCtaCtePolitica): string {
  const tipoMap: Record<FinCtaCteCargoT, string> = {
    monto_fijo: 'Monto fijo',
    pct_saldo: '% saldo',
  };

  return `${tipoMap[politica.reglas.mora_tipo]} ${politica.reglas.mora_valor}`;
}

export default function CtaCtePoliticasPage() {
  const [politicas, setPoliticas] = useState<FinCtaCtePolitica[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinCtaCtePolitica | null>(null);
  const [form, setForm] = useState<PoliticaFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch('/api/fin/ctacte-politicas');
      const json = (await response.json().catch(() => null)) as
        | { politicas?: FinCtaCtePolitica[]; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(json?.error ?? 'No se pudieron cargar las politicas');
      }

      setPoliticas(json?.politicas ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const rows = useMemo(() => politicas, [politicas]);

  const columns: Column<FinCtaCtePolitica>[] = [
    {
      key: 'nombre',
      header: 'Politica',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.nombre}</p>
          <p className="text-xs text-slate-500">{row.descripcion || 'Sin descripcion'}</p>
        </div>
      ),
    },
    {
      key: 'entrega',
      header: 'Entrega minima',
      render: (row) => entregaText(row),
    },
    {
      key: 'mora',
      header: 'Mora',
      render: (row) => moraText(row),
    },
    {
      key: 'dia_control',
      header: 'Control',
      render: (row) => `Dia ${row.reglas.dia_control} + ${row.reglas.gracia_dias} dias`,
    },
    {
      key: 'activa',
      header: 'Estado',
      render: (row) => (
        <Badge
          variant="outline"
          className={
            row.activa
              ? 'border-emerald-200 text-emerald-700'
              : 'border-slate-200 text-slate-500'
          }
        >
          {row.activa ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(row);
              setForm(politicaToForm(row));
              setDialogOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              setError(null);
              const response = await apiFetch(`/api/fin/ctacte-politicas/${row.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ ...buildPayload(politicaToForm(row)), activa: !row.activa }),
              });
              const json = (await response.json().catch(() => null)) as { error?: string } | null;

              if (!response.ok) {
                setError(json?.error ?? 'No se pudo actualizar el estado de la politica');
                return;
              }

              await fetchData();
            }}
          >
            <Power className="h-4 w-4" />
            {row.activa ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      ),
    },
  ];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const endpoint = editing
        ? `/api/fin/ctacte-politicas/${editing.id}`
        : '/api/fin/ctacte-politicas';
      const method = editing ? 'PATCH' : 'POST';
      const response = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(buildPayload(form)),
      });
      const json = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(json?.error ?? 'No se pudo guardar la politica');
      }

      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await fetchData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar la politica');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Politicas de cuenta corriente</h2>
          <p className="text-sm text-slate-500">
            Plantillas reutilizables para precargar reglas al dar de alta operaciones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void fetchData()}>
            <RefreshCw className="h-4 w-4" />
            Refrescar
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setForm(EMPTY_FORM);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nueva politica
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Politicas configuradas</CardTitle>
          <CardDescription>
            La operacion guarda las reglas inline; editar una politica no altera historicos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            emptyMessage="No hay politicas de cuenta corriente cargadas."
          />
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar politica de cuenta corriente' : 'Nueva politica de cuenta corriente'}
            </DialogTitle>
            <DialogDescription>
              Defini reglas reutilizables para ventas financiadas con control mensual.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
                Nombre
                <Input
                  value={form.nombre}
                  onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
                  placeholder="Politica mostrador 20/5"
                  required
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
                Descripcion
                <Textarea
                  value={form.descripcion}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, descripcion: event.target.value }))
                  }
                  placeholder="Uso sugerido, segmento o notas operativas"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Entrega minima
                <select
                  className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  value={form.entrega_minima_tipo}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      entrega_minima_tipo: event.target.value as FinCtaCteEntregaMinimaT,
                    }))
                  }
                >
                  <option value="monto_fijo">Monto fijo</option>
                  <option value="pct_compra">% compra</option>
                  <option value="pct_saldo">% saldo</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Valor entrega minima
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.entrega_minima_valor}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      entrega_minima_valor: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Gasto fijo mensual
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.gasto_fijo_mensual}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      gasto_fijo_mensual: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Dia control
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    step="1"
                    value={form.dia_control}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, dia_control: event.target.value }))
                    }
                    required
                  />
                </label>

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Dias de gracia
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={form.gracia_dias}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, gracia_dias: event.target.value }))
                    }
                    required
                  />
                </label>
              </div>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Tipo mora
                <select
                  className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  value={form.mora_tipo}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      mora_tipo: event.target.value as FinCtaCteCargoT,
                    }))
                  }
                >
                  <option value="monto_fijo">Monto fijo</option>
                  <option value="pct_saldo">% saldo</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Valor mora
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.mora_valor}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, mora_valor: event.target.value }))
                  }
                  required
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.aplica_mora_sin_pago}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      aplica_mora_sin_pago: event.target.checked,
                    }))
                  }
                />
                Aplicar mora si no hubo pago
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.permite_refinanciacion}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      permite_refinanciacion: event.target.checked,
                    }))
                  }
                />
                Permite refinanciacion
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.activa}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      activa: event.target.checked,
                    }))
                  }
                />
                Politica activa
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setEditing(null);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear politica'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
